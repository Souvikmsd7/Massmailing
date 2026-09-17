import request from 'supertest';
import app from '../../server';
import { PrismaClient } from '@prisma/client';
import { signAccessToken } from '../../utils/jwt';

jest.setTimeout(30000);

const prisma = new PrismaClient();

describe('Career Matches API Routes', () => {
  let userAId: string;
  let userAToken: string;
  let candidateAId: string;

  let userBId: string;
  let userBToken: string;
  let candidateBId: string;

  let jobId: string;
  let matchAId: string;

  beforeAll(async () => {
    // User A
    const userA = await prisma.user.create({
      data: {
        email: `usera-${Date.now()}@example.com`,
        passwordHash: 'hashedpass',
        name: 'User A',
      },
    });
    userAId = userA.id;
    userAToken = signAccessToken({ userId: userA.id, email: userA.email });

    const profileA = await prisma.candidateProfile.create({
      data: {
        userId: userAId,
        headline: 'Frontend React Developer',
        location: 'New York, NY',
      },
    });
    candidateAId = profileA.id;

    // User B
    const userB = await prisma.user.create({
      data: {
        email: `userb-${Date.now()}@example.com`,
        passwordHash: 'hashedpass',
        name: 'User B',
      },
    });
    userBId = userB.id;
    userBToken = signAccessToken({ userId: userB.id, email: userB.email });

    const profileB = await prisma.candidateProfile.create({
      data: {
        userId: userBId,
        headline: 'Backend Python Engineer',
      },
    });
    candidateBId = profileB.id;

    // Job
    const job = await prisma.job.create({
      data: {
        title: 'React Developer',
        normalizedTitle: 'react developer',
        company: 'WebCorp',
        jobUrl: `https://example.com/jobs/${Date.now()}`,
        source: 'manual',
        sourceJobId: `job-route-${Date.now()}`,
        contentHash: `hash-route-${Date.now()}`,
        skills: ['React', 'TypeScript'],
      },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    await prisma.jobMatch.deleteMany({ where: { OR: [{ candidateProfileId: candidateAId }, { candidateProfileId: candidateBId }] } }).catch(() => {});
    await prisma.candidateProfile.deleteMany({ where: { OR: [{ id: candidateAId }, { id: candidateBId }] } }).catch(() => {});
    await prisma.job.delete({ where: { id: jobId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { OR: [{ id: userAId }, { id: userBId }] } }).catch(() => {});
  });

  it('requires authentication for POST /api/career/matches', async () => {
    const res = await request(app).post('/api/career/matches').send({ jobId });
    expect(res.status).toBe(401);
  });

  it('POST /api/career/matches calculates match for logged-in user', async () => {
    const res = await request(app)
      .post('/api/career/matches')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ jobId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.candidateProfileId).toBe(candidateAId);
    expect(res.body.data.jobId).toBe(jobId);
    expect(res.body.data.overallScore).toBeGreaterThanOrEqual(0);

    matchAId = res.body.data.id;
  });

  it('GET /api/career/matches lists matches for User A', async () => {
    const res = await request(app)
      .get('/api/career/matches')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.matches.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.matches[0].id).toBe(matchAId);
  });

  it('GET /api/career/matches/:id retrieves single match for owner', async () => {
    const res = await request(app)
      .get(`/api/career/matches/${matchAId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(matchAId);
  });

  it('enforces authorization: User B cannot retrieve User A match record', async () => {
    const res = await request(app)
      .get(`/api/career/matches/${matchAId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(404);
  });
});
