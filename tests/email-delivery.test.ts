import { describe, expect, it, vi } from 'vitest';
import {
  createEmailDeliveryProvider,
  getEmailDeliveryMode,
  getSmtpConfiguration,
  isTransactionalEmailConfigured,
  type TransactionalEmail,
} from '../apps/web/src/lib/server/email-delivery.js';

const message: TransactionalEmail = {
  from: 'MY OWL <no-reply@example.test>',
  to: 'owner@example.test',
  subject: 'A safe subject',
  text: 'Plain text body',
  html: '<p>HTML body</p>',
};

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    SMTP_HOST: 'smtp.example.test',
    SMTP_PORT: '587',
    SMTP_USER: 'mailer@example.test',
    SMTP_PASSWORD: 'test-only-secret',
    EMAIL_FROM: 'MY OWL <no-reply@example.test>',
    APIPROOF_APP_URL: 'https://apiproof.test',
    ...overrides,
  };
}

describe('transactional email delivery', () => {
  it('accepts the shared EMAIL_FROM contract and keeps password-reset fallback compatibility', () => {
    expect(getSmtpConfiguration(environment())).toMatchObject({ from: 'MY OWL <no-reply@example.test>' });
    expect(getSmtpConfiguration(environment({ EMAIL_FROM: undefined, PASSWORD_RESET_FROM: 'legacy@example.test' }))).toMatchObject({ from: 'legacy@example.test' });
  });

  it('rejects insecure production callback URLs and never enables the sink there', () => {
    expect(getSmtpConfiguration(environment({ NODE_ENV: 'production', APIPROOF_APP_URL: 'http://apiproof.test' }))).toBeNull();
    expect(isTransactionalEmailConfigured(environment({ NODE_ENV: 'production', EMAIL_DELIVERY_MODE: 'sink' }))).toBe(false);
    expect(() => createEmailDeliveryProvider(environment({ NODE_ENV: 'production', EMAIL_DELIVERY_MODE: 'sink' }))).toThrow('EMAIL_DELIVERY_SINK_FORBIDDEN_IN_PRODUCTION');
  });

  it('supports a non-production sink without exposing message content to a transport', async () => {
    const provider = createEmailDeliveryProvider(environment({ EMAIL_DELIVERY_MODE: 'sink' }));
    await expect(provider.send(message)).resolves.toBeUndefined();
    expect(getEmailDeliveryMode(environment({ EMAIL_DELIVERY_MODE: 'sink' }))).toBe('sink');
  });

  it('closes the SMTP transport and validates header-sensitive fields', async () => {
    const sendMail = vi.fn(async () => undefined);
    const close = vi.fn();
    const provider = createEmailDeliveryProvider(environment(), () => ({ sendMail, close }));

    await provider.send(message);
    expect(sendMail).toHaveBeenCalledWith(message);
    expect(close).toHaveBeenCalledOnce();
    await expect(provider.send({ ...message, subject: 'Injected\nBcc: attacker@example.test' })).rejects.toThrow('TRANSACTIONAL_EMAIL_MESSAGE_INVALID');
    await expect(provider.send({ ...message, to: 'not-an-email' })).rejects.toThrow('TRANSACTIONAL_EMAIL_RECIPIENT_INVALID');
  });
});
