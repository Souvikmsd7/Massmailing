import { calculateCosineSimilarity, evaluateSemanticMatch } from './semanticMatchService';

describe('SemanticMatchService', () => {
  it('calculates cosine similarity of identical vectors as 1.0', () => {
    const vec = [0.5, 0.5, 0.5, 0.5];
    const sim = calculateCosineSimilarity(vec, vec);
    expect(sim).toBeCloseTo(1.0);
  });

  it('calculates orthogonal vectors as 0.0', () => {
    const vecA = [1, 0, 0, 0];
    const vecB = [0, 1, 0, 0];
    const sim = calculateCosineSimilarity(vecA, vecB);
    expect(sim).toBe(0);
  });

  it('evaluates semantic score normalized to 0-100 scale', () => {
    const vecA = [0.6, 0.8];
    const vecB = [0.6, 0.8];
    const result = evaluateSemanticMatch(vecA, vecB);
    expect(result.similarity).toBeCloseTo(1.0);
    expect(result.semanticScore).toBe(100);
  });
});
