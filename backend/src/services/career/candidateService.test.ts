/// <reference types="jest" />
import { assertOwnership } from './candidateService';
import { NotFoundError, ForbiddenError } from '../../utils/errors';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockFindUnique = jest.fn();
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      candidateProfile: {
        findUnique: mockFindUnique,
      },
    })),
    __mockFindUnique: mockFindUnique,
  };
});

// Import mock handle
const { __mockFindUnique: mockFindUnique } = require('@prisma/client');

describe('candidateService — Authorization & Ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows access when candidateProfile belongs to the requesting user', async () => {
    mockFindUnique.mockResolvedValueOnce({ userId: 'user-A' });
    await expect(assertOwnership('candidate-123', 'user-A')).resolves.toBeUndefined();
  });

  it('throws ForbiddenError when User A tries to access User B profile', async () => {
    mockFindUnique.mockResolvedValueOnce({ userId: 'user-B' });
    await expect(assertOwnership('candidate-123', 'user-A')).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError when profile does not exist', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    await expect(assertOwnership('candidate-999', 'user-A')).rejects.toThrow(NotFoundError);
  });
});
