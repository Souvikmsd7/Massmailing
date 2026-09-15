/**
 * Jobs Route Tests.
 *
 * Mocks jobDiscoveryService — no DB or Redis connection required.
 */

/// <reference types="jest" />
import request from 'supertest';
import app from '../../server';
import * as jobDiscoveryService from '../../services/jobs/jobDiscoveryService';
import { signAccessToken } from '../../utils/jwt';

jest.mock('../../services/jobs/jobDiscoveryService');

const mockEnqueueDiscovery = jobDiscoveryService.enqueueDiscovery as jest.MockedFunction<typeof jobDiscoveryService.enqueueDiscovery>;
const mockListJobs = jobDiscoveryService.listJobs as jest.MockedFunction<typeof jobDiscoveryService.listJobs>;
const mockGetJobById = jobDiscoveryService.getJobById as jest.MockedFunction<typeof jobDiscoveryService.getJobById>;

function makeToken(userId: string): string {
  return signAccessToken({ userId, email: `${userId}@test.com` });
}

const USER_TOKEN = makeToken('test-user');

describe('Jobs Routes (/api/career/jobs)', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('POST /api/career/jobs/discover', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/career/jobs/discover').send({ query: 'Node.js' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when query parameter is missing', async () => {
      const res = await request(app)
        .post('/api/career/jobs/discover')
        .set('Authorization', `Bearer ${USER_TOKEN}`)
        .send({ location: 'Remote' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('enqueues discovery job and returns 202 status', async () => {
      mockEnqueueDiscovery.mockResolvedValueOnce('job-123');

      const res = await request(app)
        .post('/api/career/jobs/discover')
        .set('Authorization', `Bearer ${USER_TOKEN}`)
        .send({ query: 'Software Engineer', location: 'Remote', limit: 10 });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBe('job-123');
      expect(res.body.data.status).toBe('queued');
    });
  });

  describe('GET /api/career/jobs', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/career/jobs');
      expect(res.status).toBe(401);
    });

    it('returns paginated job list', async () => {
      const mockResult = {
        jobs: [
          {
            id: 'job-1',
            title: 'Senior Engineer',
            company: 'Google',
            jobUrl: 'https://google.com/jobs/1',
            remoteType: 'REMOTE',
            employmentType: 'FULL_TIME',
            postedAtConfidence: 'EXACT',
            skills: ['Node.js', 'TypeScript'],
          } as any,
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 20,
          pages: 1,
        },
      };

      mockListJobs.mockResolvedValueOnce(mockResult);

      const res = await request(app)
        .get('/api/career/jobs?search=Senior&remoteType=REMOTE')
        .set('Authorization', `Bearer ${USER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobs).toHaveLength(1);
      expect(res.body.data.jobs[0].company).toBe('Google');
    });
  });

  describe('GET /api/career/jobs/:id', () => {
    it('returns job detail by ID', async () => {
      const mockJob = {
        id: 'job-1',
        title: 'Senior Engineer',
        company: 'Google',
        jobUrl: 'https://google.com/jobs/1',
      } as any;

      mockGetJobById.mockResolvedValueOnce(mockJob);

      const res = await request(app)
        .get('/api/career/jobs/job-1')
        .set('Authorization', `Bearer ${USER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('job-1');
    });

    it('returns 404 when job is not found', async () => {
      mockGetJobById.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/career/jobs/nonexistent-id')
        .set('Authorization', `Bearer ${USER_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('JOB_NOT_FOUND');
    });
  });
});
