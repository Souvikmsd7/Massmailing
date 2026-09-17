/**
 * Centralized Gemini API client.
 *
 * Handles:
 * - Model configuration and API key from environment
 * - Timeout via AbortSignal
 * - Transient error retry with exponential backoff
 * - Structured JSON extraction
 * - Error classification
 *
 * NEVER hard-code API keys. NEVER expose this client to the frontend.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_TIMEOUT_MS = 30_000;
const GEMINI_MAX_RETRIES = 2;

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_API_KEY' | 'TIMEOUT' | 'RATE_LIMITED' | 'SERVER_ERROR' | 'PARSE_ERROR' | 'EMPTY_RESPONSE',
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Gemini with a text prompt. Returns the raw text response.
 * Retries on transient errors with exponential backoff.
 */
export async function callGemini(prompt: string, jsonMode = true): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new GeminiError(
      'GEMINI_API_KEY is not configured',
      'NO_API_KEY',
      false
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    ...(jsonMode ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
  };

  let lastError: GeminiError | null = null;

  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(Math.pow(2, attempt) * 500); // 1s, 2s
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      });

      if (response.status === 401 || (response.status === 400 && !(await response.clone().text().catch(() => '')).includes('INVALID_ARGUMENT'))) {
        throw new GeminiError('Invalid or unauthorized Google Gemini API key. Pass a valid API key from https://aistudio.google.com/', 'NO_API_KEY', false);
      }

      if (response.status === 429) {
        lastError = new GeminiError('Gemini rate limit exceeded', 'RATE_LIMITED', true);
        continue;
      }

      if (response.status >= 500) {
        lastError = new GeminiError(`Gemini server error: ${response.status}`, 'SERVER_ERROR', true);
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new GeminiError(
          `Gemini request failed: ${response.status} ${body.slice(0, 200)}`,
          'SERVER_ERROR',
          false
        );
      }

      const data = (await response.json()) as any;
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new GeminiError('Gemini returned empty response', 'EMPTY_RESPONSE', false);
      }

      return text;
    } catch (err) {
      if (err instanceof GeminiError) {
        if (!err.retryable) throw err;
        lastError = err;
        continue;
      }

      // AbortError from timeout
      if ((err as any)?.name === 'AbortError' || (err as any)?.name === 'TimeoutError') {
        lastError = new GeminiError('Gemini request timed out', 'TIMEOUT', true);
        continue;
      }

      throw err;
    }
  }

  throw lastError ?? new GeminiError('Gemini request failed after retries', 'SERVER_ERROR', true);
}

/**
 * Call Gemini and parse the response as JSON.
 * Throws GeminiError with code PARSE_ERROR if the response cannot be parsed.
 */
export async function callGeminiJson<T = unknown>(prompt: string): Promise<T> {
  const text = await callGemini(prompt, true);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError(
      `Gemini returned invalid JSON: ${text.slice(0, 200)}`,
      'PARSE_ERROR',
      false
    );
  }
}
