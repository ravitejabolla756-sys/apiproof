import nodemailer from 'nodemailer';

export const EMAIL_DELIVERY_MODE_ENV = 'EMAIL_DELIVERY_MODE';

export type EmailDeliveryMode = 'smtp' | 'sink';

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

export interface EmailDeliveryProvider {
  send(message: TransactionalEmail): Promise<void>;
}

export type SmtpTransportFactory = (options: {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth: { user: string; pass: string };
}) => {
  sendMail(message: TransactionalEmail): Promise<unknown>;
  close(): void;
};

function isProduction(environment: NodeJS.ProcessEnv): boolean {
  return environment.NODE_ENV === 'production';
}

export function getEmailDeliveryMode(environment: NodeJS.ProcessEnv = process.env): EmailDeliveryMode {
  return environment[EMAIL_DELIVERY_MODE_ENV]?.trim().toLowerCase() === 'sink' ? 'sink' : 'smtp';
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
  if (baseUrl.username || baseUrl.password || (isProduction(environment) && baseUrl.protocol !== 'https:')) {
    return null;
  }

  return { host, port, user, password, from, appUrl: baseUrl };
}

export function isTransactionalEmailConfigured(environment: NodeJS.ProcessEnv = process.env): boolean {
  if (getEmailDeliveryMode(environment) === 'sink') return !isProduction(environment);
  return getSmtpConfiguration(environment) !== null;
}

function assertSafeEmailMessage(message: TransactionalEmail): void {
  const fields: Array<[string, string]> = [
    ['from', message.from],
    ['to', message.to],
    ['subject', message.subject],
  ];
  if (fields.some(([, value]) => !value.trim() || /[\r\n]/.test(value))) {
    throw new Error('TRANSACTIONAL_EMAIL_MESSAGE_INVALID');
  }
  if (!/^\S+@\S+\.\S+$/.test(message.to)) throw new Error('TRANSACTIONAL_EMAIL_RECIPIENT_INVALID');
  if (!message.text.trim() || !message.html.trim()) throw new Error('TRANSACTIONAL_EMAIL_MESSAGE_INVALID');
}

export function createEmailDeliveryProvider(
  environment: NodeJS.ProcessEnv = process.env,
  transportFactory: SmtpTransportFactory = (options) => nodemailer.createTransport(options),
): EmailDeliveryProvider {
  const mode = getEmailDeliveryMode(environment);
  if (mode === 'sink') {
    if (isProduction(environment)) throw new Error('EMAIL_DELIVERY_SINK_FORBIDDEN_IN_PRODUCTION');
    return {
      async send(message) {
        assertSafeEmailMessage(message);
      },
    };
  }

  const config = getSmtpConfiguration(environment);
  if (!config) throw new Error('TRANSACTIONAL_EMAIL_NOT_CONFIGURED');
  const secure = environment.SMTP_SECURE === 'true' || config.port === 465;
  return {
    async send(message) {
      assertSafeEmailMessage(message);
      const transporter = transportFactory({
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
    },
  };
}

export async function sendTransactionalEmail(
  message: TransactionalEmail,
  provider: EmailDeliveryProvider = createEmailDeliveryProvider(),
): Promise<void> {
  await provider.send(message);
}
