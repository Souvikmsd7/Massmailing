/**
 * Career Candidate Profile route tests.
 *
 * Tests:
 * - GET /api/career/profile — authenticated, unauthenticated
 * - POST /api/career/profile — valid, invalid input, profile creation
 * - PATCH /api/career/profile — valid update, invalid input
 * - Authorization: profile is scoped to authenticated userId (User A cannot see User B's profile)
 */

/// <reference types="jest" />
import request from 'supertest';
import app from '../../server';
import * as candidateService from '../../services/career/candidateService';
import { signAccessToken } from '../../utils/jwt';

// Mock candidateService so we do not hit the real database
jest.mock('../../services/career/candidateService');

const mockGetProfile = candidateService.getProfile as jest.MockedFunction<typeof candidateService.getProfile>;
const mockUpsertProfile = candidateService.upsertProfile as jest.MockedFunction<typeof candidateService.upsertProfile>;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeToken(userId: string): string {
  return signAccessToken({ userId, email: `${userId}@test.com` });
}

const USER_A = 'user-a-id';
const USER_B = 'user-b-id';

const PROFILE_A = {
  id: 'profile-a',
  userId: USER_A,
  headline: 'Senior Engineer',
  summary: 'Builds things',
  location: 'NYC',
  preferredLocations: [],
  remotePreference: null,
  preferredRoles: [],
  salaryMin: null,
  salaryMax: null,
  noticePeriod: null,
  workAuthorization: null,
  yearsOfExperience: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
  skills: [],
  resumes: [],
};

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('GET /api/career/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/career/profile');
    expect(res.status).toBe(401);
  });

  it('returns null data when no profile exists yet', async () => {
    mockGetProfile.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/career/profile')
      .set('Authorization', `Bearer ${makeToken(USER_A)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
  });

  it('returns profile data for authenticated user', async () => {
    mockGetProfile.mockResolvedValueOnce(PROFILE_A as any);

    const res = await request(app)
      .get('/api/career/profile')
      .set('Authorization', `Bearer ${makeToken(USER_A)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.userId).toBe(USER_A);
    expect(res.body.data.headline).toBe('Senior Engineer');
  });

  it('User A cannot see User B profile — each request is scoped to token userId', async () => {
    // The route passes req.user.userId to getProfile, so User A always gets their own profile.
    // Mock returns null for USER_A (no profile yet) vs a valid profile for USER_B
    mockGetProfile.mockImplementation(async (userId: string) => {
      if (userId === USER_B) return { ...PROFILE_A, id: 'profile-b', userId: USER_B } as any;
      return null;
    });

    const resA = await request(app)
      .get('/api/career/profile')
      .set('Authorization', `Bearer ${makeToken(USER_A)}`);
    expect(resA.body.data).toBeNull(); // User A has no profile

    const resB = await request(app)
      .get('/api/career/profile')
      .set('Authorization', `Bearer ${makeToken(USER_B)}`);
    expect(resB.body.data.userId).toBe(USER_B); // User B sees only their profile
  });
});

describe('POST /api/career/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).post('/api/career/profile').send({ headline: 'Test' });
    expect(res.status).toBe(401);
  });

  it('creates profile with valid input', async () => {
    mockUpsertProfile.mockResolvedValueOnce(PROFILE_A as any);

    const res = await request(app)
      .post('/api/career/profile')
      .set('Authorization', `Bearer ${makeToken(USER_A)}`)
      .send({ headline: 'Senior Engineer', location: 'NYC', yearsOfExperience: 5 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.headline).toBe('Senior Engineer');
  });

  it('returns 400 for invalid input — headline exceeds 200 chars', async () => {
    const res = await request(app)
      .post('/api/career/profile')
      .set('Authorization', `Bearer ${makeToken(USER_A)}`)
      .send({ headline: 'x'.repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid remotePreference value', async () => {
    const res = await request(app)
      .post('/api/career/profile')
      .set('Authorization', `Bearer ${makeToken(USER_A)}`)
      .send({ remotePreference: 'not-a-valid-value' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('accepts null for optional nullable fields', async () => {
    mockUpsertProfile.mockResolvedValueOnce({ ...PROFILE_A, headline: null } as any);

    const res = await request(app)
      .post('/api/career/profile')
      .set('Authorization', `Bearer ${makeToken(USER_A)}`)
      .send({ headline: null, summary: null });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe('PATCH /api/career/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).patch('/api/career/profile').send({ headline: 'Updated' });
    expect(res.status).toBe(401);
  });

  it('updates profile with valid partial input', async () => {
    const updated = { ...PROFILE_A, headline: 'Lead Engineer' };
    mockUpsertProfile.mockResolvedValueOnce(updated as any);

    const res = await request(app)
      .patch('/api/career/profile')
      .set('Authorization', `Bearer ${makeToken(USER_A)}`)
      .send({ headline: 'Lead Engineer' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.headline).toBe('Lead Engineer');
  });

  it('returns 400 for invalid patch — salary below 0', async () => {
    const res = await request(app)
      .patch('/api/career/profile')
      .set('Authorization', `Bearer ${makeToken(USER_A)}`)
      .send({ salaryMin: -100 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('accepts an empty body as a no-op patch', async () => {
    mockUpsertProfile.mockResolvedValueOnce(PROFILE_A as any);

    const res = await request(app)
      .patch('/api/career/profile')
      .set('Authorization', `Bearer ${makeToken(USER_A)}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('User A patching cannot affect User B profile (scoped to token userId)', async () => {
    // The route always passes req.user.userId, so User A can only upsert their own profile
    mockUpsertProfile.mockImplementation(async (userId, _data) => {
      return { ...PROFILE_A, userId } as any;
    });

    const res = await request(app)
      .patch('/api/career/profile')
      .set('Authorization', `Bearer ${makeToken(USER_A)}`)
      .send({ headline: 'Hacked' });

    expect(res.status).toBe(200);
    // The upsertProfile was called with USER_A's userId — not USER_B's
    expect(mockUpsertProfile).toHaveBeenCalledWith(USER_A, expect.any(Object));
  });
});
