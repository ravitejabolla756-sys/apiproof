import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { interaction } from './normalize.js';
import type { ContractInteraction } from '@apiproof/shared';

export interface HarnessResponse { status: number; headers?: Record<string, string>; body: unknown }
export interface ContractHarness { start(): Promise<string>; stop(): Promise<void>; interactions(): ContractInteraction[] }

export class LocalContractHarness implements ContractHarness {
  private server: Server | undefined;
  private captured: ContractInteraction[] = [];
  constructor(private readonly response: HarnessResponse = { status: 200, body: { id: 'fixture' } }) {}

  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => { if (body.length < 65_536) body += chunk.toString(); });
      req.on('end', () => {
        if (this.captured.length >= 20) { res.statusCode = 429; res.end('interaction limit'); return; }
        const headers = req.headers;
        this.captured.push(interaction({ method: req.method ?? 'GET', url: `http://127.0.0.1${req.url ?? '/'}`, headers: { 'content-type': headers['content-type'] ?? '', authorization: headers.authorization ?? '' }, body }));
        res.statusCode = this.response.status;
        for (const [key, value] of Object.entries(this.response.headers ?? {})) res.setHeader(key, value);
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(this.response.body));
      });
    });
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const address = this.server.address();
    if (!address || typeof address === 'string') throw new Error('Harness failed to bind');
    return `http://127.0.0.1:${address.port}`;
  }

  async stop(): Promise<void> {
    if (this.server) await new Promise<void>((resolve) => this.server!.close(() => resolve()));
    this.server = undefined;
  }

  interactions(): ContractInteraction[] { return this.captured.map((value) => structuredClone(value)); }
}

export class FakeContractHarness implements ContractHarness {
  private captured: ContractInteraction[] = [];
  constructor(private readonly requests: ContractInteraction[] = []) {}
  async start(): Promise<string> { this.captured = this.requests; return 'http://127.0.0.1/fake'; }
  async stop(): Promise<void> {}
  interactions(): ContractInteraction[] { return structuredClone(this.captured); }
}
