/**
 * Tests for resumeParser.ts
 *
 * Gemini is mocked — no real API calls in tests.
 */

import { parseResumeText } from './resumeParser';
import * as geminiClient from './geminiClient';

jest.mock('./geminiClient');

const mockCallGeminiJson = geminiClient.callGeminiJson as jest.MockedFunction<typeof geminiClient.callGeminiJson>;

const VALID_PARSED_RESUME = {
  headline: 'Senior Software Engineer',
  summary: 'Experienced full-stack developer',
  location: 'New York, NY',
  yearsOfExperience: 5,
  skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
  experience: [
    {
      company: 'Acme Corp',
      role: 'Senior Engineer',
      startDate: '2020-01',
      endDate: null,
      description: 'Built scalable APIs',
      technologies: ['Node.js', 'PostgreSQL'],
    },
  ],
  education: [
    {
      institution: 'MIT',
      degree: 'B.S.',
      field: 'Computer Science',
      startDate: '2014',
      endDate: '2018',
    },
  ],
  projects: [],
  certifications: ['AWS Certified'],
};

describe('resumeParser — parseResumeText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns parsed resume on valid Gemini output', async () => {
    mockCallGeminiJson.mockResolvedValueOnce(VALID_PARSED_RESUME);

    const result = await parseResumeText('raw resume text');

    expect(result).not.toBeNull();
    expect(result!.headline).toBe('Senior Software Engineer');
    expect(result!.skills).toContain('React');
    expect(result!.experience).toHaveLength(1);
    expect(result!.education).toHaveLength(1);
  });

  it('returns null on invalid Gemini output (Zod failure)', async () => {
    // Return something that cannot be coerced to the schema
    mockCallGeminiJson.mockResolvedValueOnce({ skills: 'not-an-array' });

    const result = await parseResumeText('raw text');
    expect(result).toBeNull();
  });

  it('returns null on missing optional fields', async () => {
    mockCallGeminiJson.mockResolvedValueOnce({
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
    });

    const result = await parseResumeText('sparse resume');
    expect(result).not.toBeNull();
    expect(result!.headline).toBeUndefined();
    expect(result!.skills).toEqual([]);
  });

  it('returns null when Gemini throws GeminiError', async () => {
    const { GeminiError } = jest.requireActual('./geminiClient');
    mockCallGeminiJson.mockRejectedValueOnce(
      new GeminiError('API error', 'SERVER_ERROR', false)
    );

    const result = await parseResumeText('any text');
    expect(result).toBeNull();
  });

  it('returns null when Gemini is rate limited', async () => {
    const { GeminiError } = jest.requireActual('./geminiClient');
    mockCallGeminiJson.mockRejectedValueOnce(
      new GeminiError('Rate limited', 'RATE_LIMITED', true)
    );

    const result = await parseResumeText('any text');
    expect(result).toBeNull();
  });

  it('truncates very long resume text before sending to Gemini', async () => {
    mockCallGeminiJson.mockResolvedValueOnce(VALID_PARSED_RESUME);

    const longText = 'a'.repeat(20_000);
    await parseResumeText(longText);

    const calledPrompt = mockCallGeminiJson.mock.calls[0][0] as string;
    // The prompt includes truncated text — should not contain 20k chars of 'a'
    const resumeSection = calledPrompt.split('RESUME TEXT:')[1] || '';
    expect(resumeSection.length).toBeLessThan(16_000);
  });
});
