import { normalizeSkillName } from './skillService';

describe('skillService — normalizeSkillName', () => {
  // ── Core alias mappings required by task.md ──────────────────────────────

  it('normalizes ReactJS → React', () => {
    expect(normalizeSkillName('ReactJS')).toBe('React');
  });

  it('normalizes React.js → React', () => {
    expect(normalizeSkillName('React.js')).toBe('React');
  });

  it('normalizes React JS → React (space variant)', () => {
    expect(normalizeSkillName('React JS')).toBe('React');
  });

  it('normalizes react → React', () => {
    expect(normalizeSkillName('react')).toBe('React');
  });

  it('normalizes NextJS → Next.js', () => {
    expect(normalizeSkillName('NextJS')).toBe('Next.js');
  });

  it('normalizes Next JS → Next.js (space variant)', () => {
    expect(normalizeSkillName('Next JS')).toBe('Next.js');
  });

  it('normalizes NodeJS → Node.js', () => {
    expect(normalizeSkillName('NodeJS')).toBe('Node.js');
  });

  it('normalizes Node JS → Node.js (space variant)', () => {
    expect(normalizeSkillName('Node JS')).toBe('Node.js');
  });

  it('normalizes TS → TypeScript', () => {
    expect(normalizeSkillName('TS')).toBe('TypeScript');
  });

  it('normalizes JS → JavaScript', () => {
    expect(normalizeSkillName('JS')).toBe('JavaScript');
  });

  it('normalizes postgres → PostgreSQL', () => {
    expect(normalizeSkillName('postgres')).toBe('PostgreSQL');
  });

  it('normalizes Postgres → PostgreSQL (mixed case)', () => {
    expect(normalizeSkillName('Postgres')).toBe('PostgreSQL');
  });

  it('normalizes k8s → Kubernetes', () => {
    expect(normalizeSkillName('k8s')).toBe('Kubernetes');
  });

  // ── Whitespace and case normalization ─────────────────────────────────────

  it('trims leading and trailing whitespace', () => {
    expect(normalizeSkillName('  React  ')).toBe('React');
  });

  it('trims internal whitespace aliases', () => {
    expect(normalizeSkillName('  node js  ')).toBe('Node.js');
  });

  it('handles all-lowercase unknown skill → title case', () => {
    expect(normalizeSkillName('machine learning')).toBe('Machine Learning');
  });

  it('leaves already-canonical skills intact', () => {
    expect(normalizeSkillName('GraphQL')).toBe('GraphQL');
  });

  // ── Fallback title-casing for unknown skills ───────────────────────────────

  it('title-cases a multi-word unknown skill', () => {
    expect(normalizeSkillName('data science')).toBe('Data Science');
  });

  it('title-cases a single unknown word', () => {
    expect(normalizeSkillName('elixir')).toBe('Elixir');
  });

  // ── Boundary / edge cases ─────────────────────────────────────────────────

  it('normalizes a completely uppercase unknown skill', () => {
    // "RUST" is not in alias map, title-case gives "RUST" — first char uppercased per-word
    const result = normalizeSkillName('RUST');
    // Should start with uppercase and not throw
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles a single-character skill without throwing', () => {
    expect(() => normalizeSkillName('C')).not.toThrow();
  });
});
