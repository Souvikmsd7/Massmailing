import { callGeminiJson, GeminiError } from './geminiClient';
import { ParsedResumeSchema, ParsedResume } from './resumeSchema';
import { logger } from '../../utils/logger';

/**
 * Parse raw resume text using Gemini.
 *
 * - Sends a strict prompt that prohibits AI from inventing information
 * - Validates output with Zod
 * - Returns null if Gemini is unavailable (caller decides fallback)
 */
export async function parseResumeText(rawText: string): Promise<ParsedResume | null> {
  // Limit input to avoid excessive token usage
  const truncatedText = rawText.slice(0, 15_000);

  const prompt = `You are a precise resume data extraction system.

Extract structured information from the resume text below.

STRICT RULES:
1. ONLY extract information explicitly present in the resume text.
2. Do NOT invent, infer, or hallucinate any employers, job titles, dates, technologies, achievements, certifications, or education.
3. If a field is not clearly present in the text, return null or an empty array.
4. For skills, extract only explicitly mentioned skills/technologies.
5. Return ONLY valid JSON matching the schema below. No markdown, no explanation.

OUTPUT SCHEMA:
{
  "headline": "string | null",
  "summary": "string | null",
  "location": "string | null",
  "yearsOfExperience": "number | null",
  "skills": ["string"],
  "experience": [
    {
      "company": "string | null",
      "role": "string | null",
      "startDate": "string | null",
      "endDate": "string | null",
      "description": "string | null",
      "technologies": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string | null",
      "degree": "string | null",
      "field": "string | null",
      "startDate": "string | null",
      "endDate": "string | null"
    }
  ],
  "projects": [
    {
      "name": "string | null",
      "description": "string | null",
      "technologies": ["string"],
      "url": "string | null"
    }
  ],
  "certifications": ["string"]
}

RESUME TEXT:
${truncatedText}`;

  try {
    const raw = await callGeminiJson(prompt);
    const result = ParsedResumeSchema.safeParse(raw);

    if (!result.success) {
      logger.warn('[ResumeParser] Zod validation failed on Gemini output', {
        issues: result.error.issues,
      });
      return null;
    }

    return result.data;
  } catch (err) {
    if (err instanceof GeminiError) {
      logger.warn(`[ResumeParser] Gemini error: ${err.code} — ${err.message}`);
      return null;
    }
    logger.error('[ResumeParser] Unexpected error during parsing', {}, err as Error);
    return null;
  }
}
