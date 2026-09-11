import nodemailer from 'nodemailer';
import { Attachment } from 'nodemailer/lib/mailer';

export interface CustomSmtpAccount {
  host: string;
  port: number;
  secure?: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName?: string;
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
  smtpAccount?: CustomSmtpAccount;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration is incomplete. Check SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  return transporter;
}

export async function verifySmtp(): Promise<boolean> {
  try {
    await getTransporter().verify();
    return true;
  } catch {
    return false;
  }
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  let mailTransporter: nodemailer.Transporter;
  let fromName: string;
  let fromEmail: string;

  if (options.smtpAccount) {
    const account = options.smtpAccount;
    mailTransporter = nodemailer.createTransport({
      host: account.host,
      port: account.port || 587,
      secure: account.secure || account.port === 465,
      auth: { user: account.username, pass: account.password },
      tls: { rejectUnauthorized: false },
    });
    fromName = account.fromName || process.env.SMTP_FROM_NAME || account.username;
    fromEmail = account.fromEmail || account.username;
  } else {
    mailTransporter = getTransporter();
    fromName = process.env.SMTP_FROM_NAME || process.env.SMTP_USER || '';
    fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '';
  }

  await mailTransporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments,
  });
}

export function resetTransporter(): void {
  transporter = null;
}
