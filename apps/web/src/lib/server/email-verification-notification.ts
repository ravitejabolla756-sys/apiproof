import crypto from 'node:crypto';
import { getDatabase, type DatabaseAdapter } from './db/index.js';
import { sendTrackedEmail } from './email-delivery-state.js';
import { sendTransactionalEmail, type TransactionalEmail } from './email-delivery.js';
import {
  buildEmailVerificationMessage,
  requestEmailVerification,
  type EmailVerificationMessage,
} from './email-verification.js';

export const EMAIL_VERIFICATION_TEMPLATE_KEY = 'auth.email_verification';
export const EMAIL_VERIFICATION_TEMPLATE_VERSION = 'v1';

function digestToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export type EmailVerificationTransport = (message: TransactionalEmail) => Promise<void>;

/**
 * Connects the existing verification-token service to the bounded delivery ledger.
 * The token itself is never persisted in the delivery record or event key.
 */
export async function requestTrackedEmailVerification(
  userId: string,
  transport: EmailVerificationTransport = sendTransactionalEmail,
  database: DatabaseAdapter = getDatabase(),
): Promise<'sent' | 'already_verified' | 'unavailable'> {
  return requestEmailVerification(userId, async (message: EmailVerificationMessage) => {
    const tokenDigest = digestToken(message.token);
    await sendTrackedEmail(
      {
        eventKey: `email-verification:${userId}:${tokenDigest}`,
        templateKey: EMAIL_VERIFICATION_TEMPLATE_KEY,
        templateVersion: EMAIL_VERIFICATION_TEMPLATE_VERSION,
        recipientUserId: userId,
      },
      () => transport(buildEmailVerificationMessage(message)),
      database,
    );
  }, { allowUnconfiguredTransport: transport !== sendTransactionalEmail });
}
