import { describe, it, expect } from 'vitest';
import { ApiProof } from '@apiproof/core';
import { TypeScriptRepositoryAnalyzer } from '@apiproof/analyzers';
import { StripeProvider, TwilioProvider, loadTwilioRegistry } from '@apiproof/providers';
import path from 'node:path';

describe('Twilio Provider & Change Intelligence Pipeline', () => {
  const analyzer = new TypeScriptRepositoryAnalyzer();
  const twilioProvider = new TwilioProvider();
  const stripeProvider = new StripeProvider();
  const apiProof = new ApiProof(analyzer, twilioProvider);
  const stripeApiProof = new ApiProof(analyzer, stripeProvider);

  // Test 1: Affected Twilio usage detected (legacy Twiml uppercase alias)
  it('1. detects affected Twilio legacy Twiml uppercase namespace usage', async () => {
    const registry = await loadTwilioRegistry(path.resolve('registry/twilio'));
    const change = registry.find(c => c.id === 'twilio-twiml-namespace-casing')!;

    const files = new Map<string, string>([
      ['package.json', JSON.stringify({ dependencies: { twilio: '3.80.0' } })],
      ['src/voice.js', `
        const twilio = require('twilio');
        function buildResponse() {
          const response = new twilio.Twiml.VoiceResponse();
          return response.toString();
        }
      `]
    ]);

    const impact = await apiProof.impact(files, change);
    expect(impact.status).toBe('potentially-affected');
    expect(impact.impacts.length).toBeGreaterThan(0);
    expect(impact.impacts[0]!.symbol).toContain('Twiml.VoiceResponse');
  });

  // Test 2: Unaffected Twilio usage correctly classified (modern lowercase twiml)
  it('2. classifies modern lowercase twiml usage as not affected', async () => {
    const registry = await loadTwilioRegistry(path.resolve('registry/twilio'));
    const change = registry.find(c => c.id === 'twilio-twiml-namespace-casing')!;

    const files = new Map<string, string>([
      ['package.json', JSON.stringify({ dependencies: { twilio: '5.12.2' } })],
      ['src/voice.js', `
        const twilio = require('twilio');
        function buildResponse() {
          const response = new twilio.twiml.VoiceResponse();
          return response.toString();
        }
      `]
    ]);

    const impact = await apiProof.impact(files, change);
    expect(impact.impacts).toHaveLength(0);
    expect(impact.status).toBe('no-matched-usage');
  });

  // Test 3: Same SDK installed but affected symbol absent
  it('3. reports no impact when Twilio SDK is installed but affected method is absent', async () => {
    const registry = await loadTwilioRegistry(path.resolve('registry/twilio'));
    const change = registry.find(c => c.id === 'twilio-programmable-fax-removed')!;

    const files = new Map<string, string>([
      ['package.json', JSON.stringify({ dependencies: { twilio: '5.12.2' } })],
      ['src/telephony.js', `
        const twilio = require('twilio');
        const client = twilio('AC123', 'token123');
        async function makeCall() {
          return client.calls.create({ to: '+15551234567', from: '+15559876543', url: 'https://example.com/voice' });
        }
      `]
    ]);

    const impact = await apiProof.impact(files, change);
    expect(impact.impacts).toHaveLength(0);
    expect(impact.status).toBe('no-matched-usage');
  });

  // Test 4: Similar property/method name belonging to another library rejected
  it('4. rejects lookalike symbol belonging to a non-Twilio object', async () => {
    const registry = await loadTwilioRegistry(path.resolve('registry/twilio'));
    const change = registry.find(c => c.id === 'twilio-twiml-namespace-casing')!;

    const files = new Map<string, string>([
      ['package.json', JSON.stringify({ dependencies: { twilio: '5.12.2' } })],
      ['src/other.js', `
        const customLib = require('custom-logger');
        const x = new customLib.Twiml.VoiceResponse();
      `]
    ]);

    const impact = await apiProof.impact(files, change);
    expect(impact.impacts).toHaveLength(0);
  });

  // Test 5: Aliased import/client supported
  it('5. follows aliased require and client binding', async () => {
    const registry = await loadTwilioRegistry(path.resolve('registry/twilio'));
    const change = registry.find(c => c.id === 'twilio-programmable-fax-removed')!;

    const files = new Map<string, string>([
      ['package.json', JSON.stringify({ dependencies: { twilio: '3.80.0' } })],
      ['src/fax.js', `
        const t = require('twilio');
        const c = t('AC123', 'token');
        async function send() {
          return c.fax.v1.faxes.create({ to: '+15550000000', mediaUrl: 'https://example.com/doc.pdf' });
        }
      `]
    ]);

    const impact = await apiProof.impact(files, change);
    expect(impact.status).toBe('potentially-affected');
    expect(impact.impacts.length).toBeGreaterThan(0);
  });

  // Test 6: No false Stripe classification
  it('6. does not classify Twilio usage as Stripe', async () => {
    const files = new Map<string, string>([
      ['package.json', JSON.stringify({ dependencies: { twilio: '5.12.2' } })],
      ['src/telephony.js', `
        const twilio = require('twilio');
        const client = twilio('AC123', 'token');
        client.calls.create({ to: '+15551234567', from: '+15559876543' });
      `]
    ]);

    const scan = await stripeApiProof.scan(files);
    expect(scan.providerUsed).toBe(false);
    expect(scan.usages).toHaveLength(0);
  });

  // Test 7: Malformed source fails safely
  it('7. handles syntax errors in source safely with diagnostic warning', async () => {
    const registry = await loadTwilioRegistry(path.resolve('registry/twilio'));
    const change = registry.find(c => c.id === 'twilio-twiml-namespace-casing')!;

    const files = new Map<string, string>([
      ['package.json', JSON.stringify({ dependencies: { twilio: '5.12.2' } })],
      ['src/broken.js', `const twilio = require('twilio'); const x = { invalid syntax (((`]
    ]);

    const scan = await apiProof.scan(files);
    expect(scan.diagnostics.some(d => d.code === 'SYNTAX_ERROR')).toBe(true);

    const impact = await apiProof.impact(files, change);
    expect(impact.impacts).toHaveLength(0);
  });
});
