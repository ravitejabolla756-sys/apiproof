import nodemailer from 'nodemailer';

export interface TransactionalEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SmtpConfiguration {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  appUrl: URL;
}

export function getSmtpConfiguration(environment: NodeJS.ProcessEnv = process.env): SmtpConfiguration | null {
  const host = environment.SMTP_HOST?.trim();
  const port = Number(environment.SMTP_PORT || '587');
  const user = environment.SMTP_USER;
  const password = environment.SMTP_PASSWORD;
  const from = environment.EMAIL_FROM?.trim() || environment.PASSWORD_RESET_FROM?.trim();
  const appUrl = environment.NEXT_PUBLIC_APP_URL || environment.APIPROOF_APP_URL;

  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !password || !from || !appUrl) {
    return null;
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(appUrl);
  } catch {
    return null;
  }
  if (baseUrl.username || baseUrl.password || (environment.NODE_ENV === 'production' && baseUrl.protocol !== 'https:')) {
    return null;
  }

  return { host, port, user, password, from, appUrl: baseUrl };
}

export function isTransactionalEmailConfigured(environment: NodeJS.ProcessEnv = process.env): boolean {
  return getSmtpConfiguration(environment) !== null;
}

export async function sendTransactionalEmail(message: TransactionalEmail): Promise<void> {
  const config = getSmtpConfiguration();
  if (!config) throw new Error('TRANSACTIONAL_EMAIL_NOT_CONFIGURED');

  const secure = process.env.SMTP_SECURE === 'true' || config.port === 465;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure,
    requireTLS: !secure,
    auth: { user: config.user, pass: config.password },
  });

  try {
    await transporter.sendMail(message);
  } finally {
    transporter.close();
  }
}
