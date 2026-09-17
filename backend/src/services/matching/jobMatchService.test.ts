import { calculateJobMatch } from './jobMatchService';
import { PrismaClient } from '@prisma/client';

jest.setTimeout(30000);

const prisma = new PrismaClient();

describe('JobMatchService Integration', () => {
  let userId: string;
  let candidateProfileId: string;
  let jobId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-match-${Date.now()}@example.com`,
        passwordHash: 'hashedpass',
        name: 'Test Candidate',
      },
    });
    userId = user.id;

    // Create candidate profile with skills
    const profile = await prisma.candidateProfile.create({
      data: {
        userId,
        headline: 'Senior Full Stack Engineer',
        summary: 'Experienced with React, Node.js, TypeScript',
        location: 'New York, NY',
        remotePreference: 'remote',
        salaryMin: 100000,
      },
    });
    candidateProfileId = profile.id;

    // Add skills
    const skillReact = await prisma.skill.upsert({
      where: { normalizedName: 'react' },
      update: {},
      create: { name: 'React', normalizedName: 'react' },
    });
    const skillNode = await prisma.skill.upsert({
      where: { normalizedName: 'node.js' },
      update: {},
      create: { name: 'Node.js', normalizedName: 'node.js' },
    });

    await prisma.candidateSkill.createMany({
      data: [
        { candidateId: profile.id, skillId: skillReact.id, proficiency: 'EXPERT' },
        { candidateId: profile.id, skillId: skillNode.id, proficiency: 'ADVANCED' },
      ],
      skipDuplicates: true,
    });

    // Create test job
    const job = await prisma.job.create({
      data: {
        title: 'Senior React & Node Engineer',
        normalizedTitle: 'senior react & node engineer',
        company: 'InnovateTech',
        jobUrl: `https://example.com/jobs/${Date.now()}`,
        source: 'manual',
        sourceJobId: `job-${Date.now()}`,
        location: 'New York, NY',
        normalizedLocation: 'new york, ny',
        remoteType: 'REMOTE',
        employmentType: 'FULL_TIME',
        salaryMin: 120000,
        salaryMax: 160000,
        contentHash: `hash-${Date.now()}`,
        skills: ['React', 'Node.js', 'TypeScript'],
      },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    await prisma.jobMatch.deleteMany({ where: { candidateProfileId } }).catch(() => {});
    await prisma.candidateSkill.deleteMany({ where: { candidateId: candidateProfileId } }).catch(() => {});
    await prisma.candidateProfile.delete({ where: { id: candidateProfileId } }).catch(() => {});
    await prisma.job.delete({ where: { id: jobId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('calculates job match deterministically and persists JobMatch record', async () => {
    const match = await calculateJobMatch(candidateProfileId, jobId, { forceRecalculate: true });

    expect(match).toBeDefined();
    expect(match.candidateProfileId).toBe(candidateProfileId);
    expect(match.jobId).toBe(jobId);
    expect(match.status).toBe('READY');
    expect(match.hardFilterScore).toBe(100);
    expect(match.skillScore).toBe(67); // 2 matched / 3 required = 66.6 -> 67
    expect(match.overallScore).toBeGreaterThan(0);
    expect(match.explanation).toBeDefined();
  });
});
