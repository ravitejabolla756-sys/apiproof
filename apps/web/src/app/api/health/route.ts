/**
 * Public Health Check Endpoint.
 *
 * GET /api/health
 *
 * Evaluates operational readiness:
 * - Application liveness (alive: true)
 * - Environment configuration validity (configValid: boolean)
 * - Database connectivity (database: 'connected' | 'disconnected')
 *
 * Safety model:
 * - Safe for public uptime monitors (Vercel, Kubernetes, Datadog).
 * - Exposes zero sensitive infrastructure details, credentials, or internal paths.
 * - Does not require authentication or browser session.
 */

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/server/db/index.js';
import { validateEnvConfig } from '@/lib/server/env-config.js';

export async function GET(): Promise<NextResponse> {
  const envValidation = validateEnvConfig();
  let dbStatus: 'connected' | 'disconnected';
  try {
    const db = getDatabase();
    await db.queryOne('SELECT 1 as alive');
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  const isConfigValid = envValidation.valid;
  const isDbConnected = dbStatus === 'connected';

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (!isDbConnected) {
    status = 'unhealthy';
  } else if (!isConfigValid) {
    status = 'degraded';
  }

  const httpStatus = status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(
    {
      status,
      alive: true,
      configValid: isConfigValid,
      database: dbStatus,
      timestamp: new Date().toISOString(),
    },
    { status: httpStatus }
  );
}
