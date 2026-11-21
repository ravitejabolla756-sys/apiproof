import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/server/rate-limit.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';

const INQUIRY_TYPES = new Set(['enterprise', 'custom-rules', 'security', 'self-hosted', 'support']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum;
}

export async function POST(request: Request): Promise<Response> {
  const csrf = assertCsrfProtection(request);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);

  const clientIp = getClientIp(request);
  const rateCheck = await checkRateLimit(`public-contact:${clientIp}`, 3, 60 * 60 * 1000, { failClosed: true });
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetInMs);

  let body: Record<string, unknown> | null;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.', code: 'INVALID_CONTACT_REQUEST' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const inquiryType = typeof body.inquiryType === 'string' ? body.inquiryType : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!text(name, 120) || !text(email, 254) || !EMAIL_PATTERN.test(email)
    || !INQUIRY_TYPES.has(inquiryType) || !text(message, 4000)) {
    return NextResponse.json({ error: 'Please provide valid contact details and inquiry information.', code: 'INVALID_CONTACT_REQUEST' }, { status: 400 });
  }

  // Do not claim delivery or retain personal data until the approved contact
  // provider and retention contract are configured.
  return NextResponse.json(
    { error: 'Contact delivery is temporarily unavailable.', code: 'CONTACT_DELIVERY_UNAVAILABLE' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
