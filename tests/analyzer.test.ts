import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ScanResultSchema } from '@apiproof/shared';
import { TypeScriptRepositoryAnalyzer } from '@apiproof/analyzers';
import { fixture, proof, repository } from './helpers.js';

describe('TypeScript Stripe analysis', () => {
  it('detects a bound client with exact one-based, end-exclusive location and function context', async () => {
    const scan = await proof.scan(fixture('affected'));
    expect(ScanResultSchema.safeParse(scan).success).toBe(true);
    expect(scan.providerUsed).toBe(true);
    expect(scan.dependencies[0]).toMatchObject({ installedVersion: null, lockedVersion: '16.12.0' });
    const usage = scan.usages.find((item) => item.kind === 'method');
    expect(usage).toMatchObject({ symbol: 'customers.retrieve', context: { function: 'loadCustomer', class: null },
      location: { file: 'src/customer.ts', start: { line: 6, column: 10 }, end: { line: 6, column: 35 } } });
    const text = await readFile(path.join(fixture('affected'), 'src/customer.ts'), 'utf8');
    expect(text.split('\n')[5]?.slice(9, 34)).toBe('client.customers.retrieve');
    expect(scan.coverage.complete).toBe(true);
  });

  it('does not identify lookalike objects, strings or comments as Stripe', async () => {
    const scan = await proof.scan(fixture('no-stripe'));
    expect(scan.providerUsed).toBe(false);
    expect(scan.usages).toEqual([]);
    expect(scan.dependencies).toEqual([]);
  });

  it('follows cross-file exported clients and CommonJS factory construction', async () => {
    const scan = await proof.scan(fixture('multiple'));
    const methods = scan.usages.filter((usage) => usage.kind === 'method');
    expect(methods).toHaveLength(3);
    expect(methods.map((usage) => usage.context)).toContainEqual({ function: 'get', class: 'CustomerService' });
    expect(methods.map((usage) => usage.context.function)).toContain('findCustomer');
    expect(methods.find((usage) => usage.location.file === 'src/customers.ts')?.evidence.binding.file).toBe('src/client.ts');
  });

  it('handles named constructors, aliases, resource destructuring, optional chains and static element access', async () => {
    const directory = await repository({ 'src.ts': `import { Stripe as SDK } from 'stripe';
const client = new SDK(process.env.KEY!);
const alias = client;
const { customers: resource } = alias;
export async function load(id: string) {
  resource.retrieve(id);
  alias['customers']['retrieve'](id);
  alias.customers?.retrieve(id);
  alias.checkout.sessions.create({});
  alias.webhooks.constructEvent('', '', '');
  alias.paymentIntents.create({});
}` });
    const scan = await proof.scan(directory);
    expect(scan.usages.filter((usage) => usage.kind === 'method').map((usage) => usage.symbol)).toEqual([
      'customers.retrieve', 'customers.retrieve', 'customers.retrieve', 'checkout.sessions.create', 'webhooks.constructEvent', 'paymentIntents.create',
    ]);
  });

  it('captures a literal client API version without treating dynamic configuration as evidence', async () => {
    const directory = await repository({ 'src.ts': `import Stripe from 'stripe';
const configured = new Stripe('', { apiVersion: '2024-10-01' });
const selectedVersion = process.env.STRIPE_API_VERSION;
const dynamic = new Stripe('', { apiVersion: selectedVersion });
configured.customers.retrieve('cus_123');
dynamic.customers.retrieve('cus_456');` });
    const scan = await proof.scan(directory);
    const constructions = scan.usages.filter((usage) => usage.kind === 'construction');
    expect(constructions).toHaveLength(2);
    expect(constructions.find((usage) => usage.apiVersion === '2024-10-01')).toBeDefined();
    expect(constructions.find((usage) => usage.apiVersion === undefined)).toBeDefined();
    const methods = scan.usages.filter((usage) => usage.kind === 'method');
    expect(methods.find((usage) => usage.symbol === 'customers.retrieve' && usage.apiVersion === '2024-10-01')).toBeDefined();
    expect(methods.find((usage) => usage.symbol === 'customers.retrieve' && usage.apiVersion === undefined)).toBeDefined();
    const configuredUsage = scan.usageIR?.find((usage) => usage.apiVersion === '2024-10-01');
    expect(configuredUsage).toMatchObject({ apiVersion: '2024-10-01', dynamic: false });
  });

  it('treats provider subpath imports as resource evidence', async () => {
    const scan = await new TypeScriptRepositoryAnalyzer().analyze({
      'package.json': '{"name":"firebase-fixture","dependencies":{"firebase":"^12.0.0"}}',
      'src.ts': `import { getVertexAI } from 'firebase/vertexai';
export const legacy = getVertexAI;`,
    }, { id: 'firebase', packageName: 'firebase', constructorExports: [] });
    expect(scan.usages).toContainEqual(expect.objectContaining({ kind: 'resource', symbol: 'firebase/vertexai' }));
    expect(scan.usageIR).toContainEqual(expect.objectContaining({ resource: 'firebase/vertexai' }));
  });

  it('resolves namespace/default CommonJS variants and import-equals', async () => {
    const directory = await repository({
      'a.ts': `import * as SDK from 'stripe'; const s = new SDK.default(''); s.customers.retrieve('');`,
      'b.cts': `const SDK = require('stripe').default; const s = new SDK(''); s.customers.retrieve('');`,
      'c.cts': `import SDK = require('stripe'); const s = new SDK(''); s.customers.retrieve('');`,
    });
    const scan = await proof.scan(directory);
    expect(scan.usages.filter((usage) => usage.kind === 'method')).toHaveLength(3);
  });

  it('respects lexical shadowing of imported identifiers and require', async () => {
    const directory = await repository({ 'src.ts': `import Stripe from 'stripe';
const stripe = new Stripe('');
function unrelated(stripe: { customers: { retrieve(id: string): string } }) { stripe.customers.retrieve(''); }
function local(require: (name: string) => any) { const SDK = require('stripe'); const s = new SDK(''); s.customers.retrieve(''); }
stripe.customers.retrieve('');` });
    expect((await proof.scan(directory)).usages.filter((usage) => usage.kind === 'method')).toHaveLength(1);
  });

  it('detects type imports, typed parameters and class properties', async () => {
    const directory = await repository({ 'src.ts': `import Stripe from 'stripe';
import type { PaymentIntent as Intent } from 'stripe';
export type Payment = Stripe.PaymentIntent;
export function handle(intent: Intent, client: Stripe) { return client.customers.retrieve(intent.id); }
export class Service {
  constructor(private readonly stripe: Stripe) {}
  load(id: string) { return this.stripe.customers.retrieve(id); }
}
export class Constructed {
  private readonly client = new Stripe('');
  load(id: string) { return this.client.customers.retrieve(id); }
}` });
    const scan = await proof.scan(directory);
    expect(scan.usages.filter((usage) => usage.kind === 'type' && usage.symbol === 'PaymentIntent')).toHaveLength(2);
    const methods = scan.usages.filter((usage) => usage.kind === 'method');
    expect(methods).toHaveLength(3);
    expect(methods.find((usage) => usage.context.class === 'Service')?.evidence.basis).toBe('type-annotation');
  });

  it('reports dynamic imports and syntax errors without returning source or secrets', async () => {
    const directory = await repository({
      'dynamic.ts': `const SDK = await import('stripe');`,
      'broken.ts': `const secret = 'sk_test_NEVER_PRINT_THIS'; function broken( {`,
      '.env': 'STRIPE_SECRET_KEY=NEVER_PRINT_ENV',
      'dist/ignored.ts': `import Stripe from 'stripe';`,
    });
    const scan = await proof.scan(directory);
    expect(scan.coverage).toMatchObject({ filesAnalyzed: 2, complete: false });
    expect(scan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining(['SYNTAX_ERROR', 'DYNAMIC_IMPORT']));
    expect(JSON.stringify(scan)).not.toContain('NEVER_PRINT');
  });

  it('does not trust reassigned provider bindings', async () => {
    const directory = await repository({ 'src.ts': `import Stripe from 'stripe';
let client = new Stripe(''); client = unrelated; client.customers.retrieve('');` });
    const scan = await proof.scan(directory);
    expect(scan.usages.filter((usage) => usage.kind === 'method')).toHaveLength(0);
    expect(scan.diagnostics.map((item) => item.code)).toContain('MUTATED_BINDING');
  });

  it('produces stable results and does not write into the repository', async () => {
    const directory = await repository({ 'src.ts': `import Stripe from 'stripe'; const client = new Stripe(''); client.customers.retrieve('');` });
    const before = await readFile(path.join(directory, 'src.ts'));
    const first = await proof.scan(directory);
    const second = await proof.scan(directory);
    expect(first).toEqual(second);
    expect(await readFile(path.join(directory, 'src.ts'))).toEqual(before);
    expect(first.audit.inputDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});
