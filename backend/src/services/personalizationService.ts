import { replacePlaceholders, sanitizeEmailHtml } from '../utils/sanitize';

export interface RecipientData {
  name?: string;
  email: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  linkedin?: string;
  [key: string]: string | undefined;
}

export interface SenderData {
  senderName?: string;
  senderEmail?: string;
  phone?: string;
  linkedin?: string;
  portfolio?: string;
}

/**
 * Build the personalized subject and body for a single recipient.
 */
export function personalizeEmail(
  subject: string,
  body: string,
  recipient: RecipientData,
  sender: SenderData
): { subject: string; html: string } {
  const data: Record<string, string> = {
    name: recipient.name || '',
    email: recipient.email || '',
    company: recipient.company || '',
    job_title: recipient.jobTitle || '',
    phone: recipient.phone || '',
    linkedin: recipient.linkedin || '',
    sender_name: sender.senderName || '',
    sender_email: sender.senderEmail || '',
    sender_phone: sender.phone || '',
    sender_linkedin: sender.linkedin || '',
    sender_portfolio: sender.portfolio || '',
  };

  const personalizedSubject = replacePlaceholders(subject, data);
  const rawHtml = replacePlaceholders(body, data);
  const sanitizedHtml = sanitizeEmailHtml(rawHtml);

  return {
    subject: personalizedSubject,
    html: sanitizedHtml,
  };
}
