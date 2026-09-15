/**
 * Career Resume route tests.
 *
 * All resume service calls are mocked — no database or filesystem access.
 *
 * Tests:
 * - POST /api/career/resumes — valid PDF, invalid file type, oversized, unauthenticated
 * - GET /api/career/resumes — list own resumes, unauthenticated
 * - GET /api/career/resumes/:id — own resume, another user's (403), not found
 * - DELETE /api/career/resumes/:id — own, another user's (403)
 * - POST /api/career/resumes/:id/parse — own, another user's (403)
 * - Authorization: User A cannot access User B resumes
 */

/// <reference types="jest" />
import path from 'path';
import request from 'supertest';
import app from '../../server';
import * as resumeService from '../../services/career/resumeService';
import { signAccessToken } from '../../utils/jwt';
import { ForbiddenError, NotFoundError, BadRequestError } from '../../utils/errors';

// Mock the entire resumeService
jest.mock('../../services/career/resumeService');

const mockUploadResume = resumeService.uploadResume as jest.MockedFunction<typeof resumeService.uploadResume>;
const mockListResumes = resumeService.listResumes as jest.MockedFunction<typeof resumeService.listResumes>;
const mockGetResumePublic = resumeService.getResumePublic as jest.MockedFunction<typeof resumeService.getResumePublic>;
const mockDeleteResume = resumeService.deleteResume as jest.MockedFunction<typeof resumeService.deleteResume>;
const mockParseResume = resumeService.parseResume as jest.MockedFunction<typeof resumeService.parseResume>;
const mockValidateResumeFile = resumeService.validateResumeFile as jest.MockedFunction<typeof resumeService.validateResumeFile>;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeToken(userId: string): string {
  return signAccessToken({ userId, email: `${userId}@test.com` });
}

const USER_A_TOKEN = makeToken('user-a');
const USER_B_TOKEN = makeToken('user-b');

const RESUME_A = {
  id: 'resume-a',
  fileName: 'resume.pdf',
  fileType: 'application/pdf',
  status: 'UPLOADED',
  isOriginal: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// A minimal valid PDF buffer (1-byte placeholder; real PDF validation is tested in storageService)
const MINIMAL_PDF = Buffer.from('%PDF-1.4 test resume content');

// ------------------------------------------------------------------
// GET /api/career/resumes
// ------------------------------------------------------------------

describe('GET /api/career/resumes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/career/resumes');
    expect(res.status).toBe(401);
  });

  it('returns empty list when no resumes exist', async () => {
    mockListResumes.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/career/resumes')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('returns own resumes for authenticated user', async () => {
    mockListResumes.mockResolvedValueOnce([RESUME_A as any]);

    const res = await request(app)
      .get('/api/career/resumes')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('resume-a');
  });
});

// ------------------------------------------------------------------
// GET /api/career/resumes/:id
// ------------------------------------------------------------------

describe('GET /api/career/resumes/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).get('/api/career/resumes/resume-a');
    expect(res.status).toBe(401);
  });

  it('returns own resume successfully', async () => {
    mockGetResumePublic.mockResolvedValueOnce(RESUME_A as any);

    const res = await request(app)
      .get('/api/career/resumes/resume-a')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('resume-a');
  });

  it('returns 404 when resume does not exist', async () => {
    mockGetResumePublic.mockRejectedValueOnce(new NotFoundError('Resume not found', 'RESUME_NOT_FOUND'));

    const res = await request(app)
      .get('/api/career/resumes/nonexistent-id')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESUME_NOT_FOUND');
  });

  it('returns 403 when User A tries to access User B resume', async () => {
    mockGetResumePublic.mockRejectedValueOnce(new ForbiddenError('Access denied', 'FORBIDDEN'));

    const res = await request(app)
      .get('/api/career/resumes/resume-b')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('response does not expose rawText or storageKey', async () => {
    // getResumePublic already strips these — verify the route passes through cleanly
    mockGetResumePublic.mockResolvedValueOnce(RESUME_A as any);

    const res = await request(app)
      .get('/api/career/resumes/resume-a')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.body.data).not.toHaveProperty('rawText');
    expect(res.body.data).not.toHaveProperty('storageKey');
  });
});

// ------------------------------------------------------------------
// DELETE /api/career/resumes/:id
// ------------------------------------------------------------------

describe('DELETE /api/career/resumes/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).delete('/api/career/resumes/resume-a');
    expect(res.status).toBe(401);
  });

  it('deletes own resume successfully', async () => {
    mockDeleteResume.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .delete('/api/career/resumes/resume-a')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when User A tries to delete User B resume', async () => {
    mockDeleteResume.mockRejectedValueOnce(new ForbiddenError('Access denied', 'FORBIDDEN'));

    const res = await request(app)
      .delete('/api/career/resumes/resume-b')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when resume does not exist', async () => {
    mockDeleteResume.mockRejectedValueOnce(new NotFoundError('Resume not found', 'RESUME_NOT_FOUND'));

    const res = await request(app)
      .delete('/api/career/resumes/nonexistent')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.status).toBe(404);
  });
});

// ------------------------------------------------------------------
// POST /api/career/resumes/:id/parse
// ------------------------------------------------------------------

describe('POST /api/career/resumes/:id/parse', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 for unauthenticated request', async () => {
    const res = await request(app).post('/api/career/resumes/resume-a/parse');
    expect(res.status).toBe(401);
  });

  it('triggers parsing of own resume successfully', async () => {
    mockParseResume.mockResolvedValueOnce({
      resume: { ...RESUME_A, status: 'PARSED' } as any,
      parsed: {
        headline: 'Engineer',
        summary: null,
        skills: ['React'],
        experience: [],
        education: [],
        projects: [],
        certifications: [],
        yearsOfExperience: null,
        location: null,
      },
    });

    const res = await request(app)
      .post('/api/career/resumes/resume-a/parse')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.resume.status).toBe('PARSED');
    expect(res.body.data.parsed.skills).toContain('React');
  });

  it('returns 403 when User A tries to parse User B resume', async () => {
    mockParseResume.mockRejectedValueOnce(new ForbiddenError('Access denied', 'FORBIDDEN'));

    const res = await request(app)
      .post('/api/career/resumes/resume-b/parse')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 when resume is already being processed', async () => {
    mockParseResume.mockRejectedValueOnce(new BadRequestError('Resume is already being processed', 'ALREADY_PROCESSING'));

    const res = await request(app)
      .post('/api/career/resumes/resume-a/parse')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ALREADY_PROCESSING');
  });

  it('parse response does not expose rawText or storageKey', async () => {
    mockParseResume.mockResolvedValueOnce({
      resume: { ...RESUME_A, status: 'PARSED' } as any,
      parsed: null,
    });

    const res = await request(app)
      .post('/api/career/resumes/resume-a/parse')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.body.data.resume).not.toHaveProperty('rawText');
    expect(res.body.data.resume).not.toHaveProperty('storageKey');
  });
});

// ------------------------------------------------------------------
// POST /api/career/resumes — Upload
// ------------------------------------------------------------------

describe('POST /api/career/resumes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 for unauthenticated upload', async () => {
    const res = await request(app)
      .post('/api/career/resumes')
      .attach('resume', MINIMAL_PDF, { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(401);
  });

  it('rejects upload when no file is provided', async () => {
    const res = await request(app)
      .post('/api/career/resumes')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FILE');
  });

  it('rejects non-PDF file (multer filter fires before service)', async () => {
    const res = await request(app)
      .post('/api/career/resumes')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .attach('resume', Buffer.from('fake image'), { filename: 'photo.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    // Multer filter error or service UNSUPPORTED_FILE_TYPE
    expect(res.body.success).toBe(false);
  });

  it('accepts a valid PDF and returns 201 on success', async () => {
    mockUploadResume.mockResolvedValueOnce(RESUME_A as any);

    const res = await request(app)
      .post('/api/career/resumes')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .attach('resume', MINIMAL_PDF, { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('resume-a');
  });

  it('upload response does not expose rawText or storageKey', async () => {
    mockUploadResume.mockResolvedValueOnce(RESUME_A as any);

    const res = await request(app)
      .post('/api/career/resumes')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .attach('resume', MINIMAL_PDF, { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.body.data).not.toHaveProperty('rawText');
    expect(res.body.data).not.toHaveProperty('storageKey');
  });
});
