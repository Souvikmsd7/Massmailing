import { normalizeSkillName } from './skillService';

describe('skillService — normalizeSkillName', () => {
  it('normalizes ReactJS → React', () => {
    expect(normalizeSkillName('ReactJS')).toBe('React');
  });

  it('normalizes React.js → React', () => {
    expect(normalizeSkillName('React.js')).toBe('React');
  });

  it('normalizes react → React', () => {
    expect(normalizeSkillName('react')).toBe('React');
  });

  it('normalizes NextJS → Next.js', () => {
    expect(normalizeSkillName('NextJS')).toBe('Next.js');
  });

  it('normalizes NodeJS → Node.js', () => {
    expect(normalizeSkillName('NodeJS')).toBe('Node.js');
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

  it('normalizes k8s → Kubernetes', () => {
    expect(normalizeSkillName('k8s')).toBe('Kubernetes');
  });

  it('title-cases unknown skills', () => {
    expect(normalizeSkillName('machine learning')).toBe('Machine Learning');
  });

  it('trims whitespace', () => {
    expect(normalizeSkillName('  React  ')).toBe('React');
  });

  it('leaves already-canonical skills intact', () => {
    expect(normalizeSkillName('GraphQL')).toBe('GraphQL');
  });
});
