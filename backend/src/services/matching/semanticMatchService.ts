/**
 * Semantic Match Engine.
 *
 * Computes vector similarity between candidate embedding and job embedding.
 * Maps cosine similarity [-1.0, 1.0] to normalized 0-100 similarity score.
 */

export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

  const length = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function evaluateSemanticMatch(candidateVector: number[], jobVector: number[]): {
  similarity: number;
  semanticScore: number;
} {
  const rawSimilarity = calculateCosineSimilarity(candidateVector, jobVector);
  // Cosine similarity for text embeddings ranges from 0 to 1. Scale to 0-100.
  const similarity = Math.max(0, Math.min(1, rawSimilarity));
  const semanticScore = Math.round(similarity * 100);

  return {
    similarity,
    semanticScore,
  };
}
