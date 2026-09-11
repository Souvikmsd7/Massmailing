/**
 * Sanitize HTML to prevent stored XSS in email bodies.
 */
export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '');
}

/**
 * Smart contextual defaults for common email variables when missing in CSV/contact
 */
const DEFAULT_SMART_FALLBACKS: Record<string, string> = {
  name: '',
  company: 'your company',
  job_title: 'the open',
  sender_name: 'Applicant',
};

/**
 * Replace {{variable}} or {{variable|fallback}} placeholders with values from data map.
 * Performs intelligent grammar and punctuation cleanup to avoid awkward spaces or missing text.
 */
export function replacePlaceholders(
  template: string,
  data: Record<string, string | undefined>,
  customFallback = ''
): string {
  if (!template) return '';

  // 1. Replace {{key}} or {{key|default_value}}
  let result = template.replace(/\{\{([^}]+)\}\}/g, (_, expression) => {
    const parts = expression.split('|');
    const key = parts[0].trim();
    const inlineFallback = parts.slice(1).join('|').trim();

    const val = data[key]?.trim();
    if (val) return val;

    if (inlineFallback) return inlineFallback;
    if (customFallback) return customFallback;

    return DEFAULT_SMART_FALLBACKS[key] || '';
  });

  // 2. Smart Punctuation & Grammar Cleanup
  result = result
    // Fix "Hi ," or "Dear ," -> "Hi," or "Dear Hiring Manager,"
    .replace(/\b(Hi|Dear|Hello)\s+,/gi, '$1,')
    .replace(/\b(Hi|Dear|Hello)\s+([.!?:])/gi, '$1$2')
    // Fix "position at ." or "role at ." -> "position."
    .replace(/\b(position|role|opportunity|opening)\s+at\s+([.,!?])/gi, '$1$2')
    .replace(/\b\s+at\s+([.,!?])/gi, '$1')
    // Fix double spaces
    .replace(/[ \t]{2,}/g, ' ')
    // Fix spaces before punctuation (e.g. "at ." -> ".")
    .replace(/\s+([,.!?])/g, '$1')
    .trim();

  return result;
}

/**
 * Normalize email: trim and lowercase.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}
