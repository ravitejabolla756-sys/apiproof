import { getSmtpConfiguration, sendTransactionalEmail } from './email-delivery.js';

interface PasswordResetMessage {
  email: string;
  name: string;
  token: string;
}

export function isPasswordResetEmailConfigured(): boolean {
  return getSmtpConfiguration() !== null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

export function buildPasswordResetMessage(message: PasswordResetMessage) {
  const config = getSmtpConfiguration();
  if (!config) throw new Error('PASSWORD_RESET_EMAIL_NOT_CONFIGURED');

  const link = new URL('/reset-password', config.appUrl);
  link.hash = `token=${encodeURIComponent(message.token)}`;
  const safeName = escapeHtml(message.name);
  const safeLink = escapeHtml(link.toString());

  return {
    from: config.from,
    to: message.email,
    subject: 'Reset your MY OWL password',
    text: `Hello ${message.name},\n\nUse this link to reset your MY OWL password. It expires in 20 minutes and can be used once:\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hello ${safeName},</p><p>Use the link below to reset your MY OWL password. It expires in 20 minutes and can be used once.</p><p><a href="${safeLink}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  };
}

export async function sendPasswordResetEmail(message: PasswordResetMessage): Promise<void> {
  if (!isPasswordResetEmailConfigured()) throw new Error('PASSWORD_RESET_EMAIL_NOT_CONFIGURED');
  await sendTransactionalEmail(buildPasswordResetMessage(message));
}
