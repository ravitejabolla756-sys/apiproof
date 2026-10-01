import nodemailer from 'nodemailer';

interface PasswordResetMessage {
  email: string;
  name: string;
  token: string;
}

function getEmailConfiguration() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.PASSWORD_RESET_FROM?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APIPROOF_APP_URL;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from || !appUrl) {
    return null;
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(appUrl);
  } catch {
    return null;
  }
  if (baseUrl.username || baseUrl.password || (process.env.NODE_ENV === 'production' && baseUrl.protocol !== 'https:')) return null;

  return {
    host,
    port,
    user,
    password,
    from,
    resetUrl: new URL('/reset-password', baseUrl),
  };
}

export function isPasswordResetEmailConfigured(): boolean {
  return getEmailConfiguration() !== null;
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
  const config = getEmailConfiguration();
  if (!config) throw new Error('PASSWORD_RESET_EMAIL_NOT_CONFIGURED');

  const link = new URL(config.resetUrl);
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
  const config = getEmailConfiguration();
  if (!config) throw new Error('PASSWORD_RESET_EMAIL_NOT_CONFIGURED');

  const secure = process.env.SMTP_SECURE === 'true' || config.port === 465;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    requireTLS: !secure,
    auth: { user: config.user, pass: config.password },
  });

  try {
    await transporter.sendMail(buildPasswordResetMessage(message));
  } finally {
    transporter.close();
  }
}
