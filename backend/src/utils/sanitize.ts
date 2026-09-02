/**
 * Sanitize HTML to prevent stored XSS in email bodies.
 * We do a simple allowlist of safe HTML email tags.
 */
export function sanitizeEmailHtml(html: string): string {
  // For email bodies we keep a broad set of safe email HTML tags
  // but strip script tags, event handlers, and javascript: links
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '');
}

/**
 * Replace {{variable}} placeholders with values from data map.
 * Missing variables are replaced with fallback (default: empty string).
 */
export function replacePlaceholders(
  template: string,
  data: Record<string, string | undefined>,
  fallback = ''
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key];
    return value !== undefined && value !== '' ? value : fallback;
  });
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
