import { evaluateSkillMatch, CandidateSkillWithSkill } from './skillMatchService';

describe('SkillMatchService', () => {
  const mockCandidateSkills: CandidateSkillWithSkill[] = [
    {
      candidateId: 'cand-1',
      skillId: 's1',
      proficiency: 'ADVANCED',
      years: 4,
      source: 'RESUME',
      createdAt: new Date(),
      updatedAt: new Date(),
      skill: {
        id: 's1',
        name: 'React',
        normalizedName: 'react',
        category: 'Frontend',
        createdAt: new Date(),
      },
    },
    {
      candidateId: 'cand-1',
      skillId: 's2',
      proficiency: 'EXPERT',
      years: 5,
      source: 'RESUME',
      createdAt: new Date(),
      updatedAt: new Date(),
      skill: {
        id: 's2',
        name: 'Node.js',
        normalizedName: 'node.js',
        category: 'Backend',
        createdAt: new Date(),
      },
    },
    {
      candidateId: 'cand-1',
      skillId: 's3',
      proficiency: 'INTERMEDIATE',
      years: 2,
      source: 'RESUME',
      createdAt: new Date(),
      updatedAt: new Date(),
      skill: {
        id: 's3',
        name: 'PostgreSQL',
        normalizedName: 'postgresql',
        category: 'Database',
        createdAt: new Date(),
      },
    },
  ];

  it('correctly matches EXACT and ALIAS skills and calculates score', () => {
    const jobSkills = ['React', 'nodejs', 'postgres', 'Docker'];
    const result = evaluateSkillMatch(mockCandidateSkills, jobSkills);

    expect(result.matchedSkills).toHaveLength(3);
    expect(result.missingSkills).toEqual(['Docker']);
    expect(result.skillScore).toBe(75); // 3 matched / 4 total = 75%
  });

  it('handles job with zero skills specified', () => {
    const result = evaluateSkillMatch(mockCandidateSkills, []);
    expect(result.skillScore).toBe(100);
    expect(result.matchedSkills).toHaveLength(0);
    expect(result.missingSkills).toHaveLength(0);
  });

  it('handles candidate with zero skills', () => {
    const result = evaluateSkillMatch([], ['React', 'TypeScript']);
    expect(result.skillScore).toBe(0);
    expect(result.missingSkills).toEqual(['React', 'TypeScript']);
    expect(result.matchedSkills).toHaveLength(0);
  });
});
