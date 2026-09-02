import nodemailer from 'nodemailer';
import { Attachment } from 'nodemailer/lib/mailer';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Attachment[];
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
  const fromName = process.env.SMTP_FROM_NAME || process.env.SMTP_USER || '';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '';

  await getTransporter().sendMail({
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
