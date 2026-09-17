import { generateMatchExplanation } from './matchExplanationService';
import * as geminiClient from './geminiClient';

jest.mock('./geminiClient');

describe('MatchExplanationService', () => {
  const mockInput = {
    jobTitle: 'Senior React Developer',
    company: 'Acme Corp',
    matchedSkills: ['React', 'TypeScript'],
    missingSkills: ['Kubernetes'],
    hardFilterEligible: true,
    failedFilters: [],
    skillScore: 80,
    semanticScore: 85,
    overallScore: 82,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('parses valid JSON response from Gemini', async () => {
    (geminiClient.callGeminiJson as jest.Mock).mockResolvedValueOnce({
      summary: 'Strong match for Senior React Developer based on React and TypeScript background.',
      strengths: ['Solid React experience', 'TypeScript proficiency'],
      gaps: ['Lacks Kubernetes knowledge'],
    });

    const result = await generateMatchExplanation(mockInput);
    expect(result.status).toBe('AVAILABLE');
    expect(result.summary).toContain('Senior React Developer');
    expect(result.strengths).toHaveLength(2);
    expect(result.gaps).toHaveLength(1);
  });

  it('falls back gracefully to deterministic explanation if Gemini fails or returns invalid format', async () => {
    (geminiClient.callGeminiJson as jest.Mock).mockRejectedValueOnce(
      new geminiClient.GeminiError('Rate limit exceeded', 'RATE_LIMITED', true)
    );

    const result = await generateMatchExplanation(mockInput);
    expect(result.status).toBe('UNAVAILABLE');
    expect(result.summary).toContain('82/100');
    expect(result.strengths).toContain('Demonstrated skill in React');
    expect(result.gaps).toContain('Missing skill requirement: Kubernetes');
  });
});
