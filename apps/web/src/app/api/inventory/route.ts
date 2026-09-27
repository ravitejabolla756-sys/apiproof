/**
 * API Inventory & Rule Registry Endpoint.
 *
 * GET /api/inventory
 *
 * Returns real server-backed API provider rule registry state.
 * Reflects supported API providers (Stripe, Twilio) and active breaking change rules.
 */

import { NextResponse } from 'next/server';
import { loadProviderRegistry } from '@/lib/server/registry-utils.js';

export interface ProviderInventoryItem {
  id: string;
  name: string;
  category: string;
  status: 'reviewed' | 'detected';
  rulesCount: number;
  description: string;
  rules: Array<{
    id: string;
    title: string;
    severity: string;
    description: string;
  }>;
}

export async function GET(): Promise<NextResponse> {
  try {
    const stripeRules = await loadProviderRegistry('stripe');
    const twilioRules = await loadProviderRegistry('twilio');

    const providers: ProviderInventoryItem[] = [
      {
        id: 'stripe',
        name: 'Stripe',
        category: 'Payments & Subscriptions',
        status: 'reviewed',
        rulesCount: stripeRules.length,
        description: 'Deterministic AST analysis for Stripe Node.js SDK breaking changes (SDK v12 to v16+).',
        rules: stripeRules.map((r) => ({
          id: r.id,
          title: r.title,
          severity: r.severity,
          description: r.description,
        })),
      },
      {
        id: 'twilio',
        name: 'Twilio',
        category: 'Communications & SMS',
        status: 'reviewed',
        rulesCount: twilioRules.length,
        description: 'Deterministic AST analysis for Twilio Node.js SDK breaking changes (SDK v3 to v4+).',
        rules: twilioRules.map((r) => ({
          id: r.id,
          title: r.title,
          severity: r.severity,
          description: r.description,
        })),
      },
    ];

    return NextResponse.json({
      ok: true,
      providers,
      totalRulesCount: stripeRules.length + twilioRules.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load inventory';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
