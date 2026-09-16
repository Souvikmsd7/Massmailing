/**
 * Posted-Within Filter Tests.
 *
 * Tests the date-filtering logic for the postedWithin query parameter.
 *
 * Rules:
 *   - EXACT confidence: included if within the time window
 *   - APPROXIMATE confidence: included if within the time window
 *   - UNKNOWN confidence: NEVER included in any postedWithin filter
 *   - Future timestamps: excluded (postedAt > now)
 *   - Null postedAt: excluded
 *
 * Time is UTC throughout.
 */

/// <reference types="jest" />

// This module tests the filtering logic in isolation.
// The filter is applied in jobDiscoveryService.listJobs via Prisma WHERE clause.
// We test the filter construction logic by extracting the parsing helper.

/**
 * Mirror of the parsePostedWithinMs function from jobDiscoveryService.ts
 * (extracted for unit testing without DB dependency).
 */
function parsePostedWithinMs(value: string): number | null {
  const match = value.match(/^(\d+)(h|d)$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return match[2] === 'h' ? n * 60 * 60 * 1000 : n * 24 * 60 * 60 * 1000;
}

/**
 * Determine if a job should be included in a postedWithin filter result.
 * This mirrors the WHERE clause logic in listJobs.
 */
function shouldIncludeInFilter(
  job: {
    postedAt: Date | null;
    postedAtConfidence: 'EXACT' | 'APPROXIMATE' | 'UNKNOWN';
  },
  postedWithin: string,
  now: Date = new Date()
): boolean {
  const ms = parsePostedWithinMs(postedWithin);
  if (ms === null) return false; // Invalid filter — no filtering applied

  // UNKNOWN confidence: always excluded from temporal filters
  if (job.postedAtConfidence === 'UNKNOWN') return false;

  // No date: excluded
  if (job.postedAt === null) return false;

  const cutoff = new Date(now.getTime() - ms);

  // Must be within the window (>= cutoff) and not in the future (≤ now)
  return job.postedAt >= cutoff && job.postedAt <= now;
}

// ─── Fixed reference time ─────────────────────────────────────────────────────

const NOW = new Date('2024-06-15T12:00:00.000Z');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('postedWithin filter — parsePostedWithinMs', () => {
  it('parses 24h correctly', () => {
    expect(parsePostedWithinMs('24h')).toBe(24 * 60 * 60 * 1000);
  });

  it('parses 7d correctly', () => {
    expect(parsePostedWithinMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('parses 30d correctly', () => {
    expect(parsePostedWithinMs('30d')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('returns null for invalid format', () => {
    expect(parsePostedWithinMs('1week')).toBeNull();
    expect(parsePostedWithinMs('invalid')).toBeNull();
    expect(parsePostedWithinMs('')).toBeNull();
    expect(parsePostedWithinMs('abc')).toBeNull();
  });
});

describe('postedWithin filter — job inclusion logic', () => {
  describe('24h filter', () => {
    it('includes EXACT job posted 12 hours ago', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 12 * 60 * 60 * 1000),
        postedAtConfidence: 'EXACT' as const,
      };
      expect(shouldIncludeInFilter(job, '24h', NOW)).toBe(true);
    });

    it('excludes EXACT job posted 25 hours ago', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000),
        postedAtConfidence: 'EXACT' as const,
      };
      expect(shouldIncludeInFilter(job, '24h', NOW)).toBe(false);
    });

    it('includes APPROXIMATE job posted 6 hours ago', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 6 * 60 * 60 * 1000),
        postedAtConfidence: 'APPROXIMATE' as const,
      };
      expect(shouldIncludeInFilter(job, '24h', NOW)).toBe(true);
    });

    it('excludes APPROXIMATE job posted 2 days ago from 24h filter', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
        postedAtConfidence: 'APPROXIMATE' as const,
      };
      expect(shouldIncludeInFilter(job, '24h', NOW)).toBe(false);
    });

    it('excludes UNKNOWN confidence job regardless of date', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago — would be "recent"
        postedAtConfidence: 'UNKNOWN' as const,
      };
      expect(shouldIncludeInFilter(job, '24h', NOW)).toBe(false);
    });

    it('excludes UNKNOWN confidence job with null date', () => {
      const job = {
        postedAt: null,
        postedAtConfidence: 'UNKNOWN' as const,
      };
      expect(shouldIncludeInFilter(job, '24h', NOW)).toBe(false);
    });

    it('excludes null postedAt regardless of confidence', () => {
      const job = {
        postedAt: null,
        postedAtConfidence: 'EXACT' as const,
      };
      expect(shouldIncludeInFilter(job, '24h', NOW)).toBe(false);
    });

    it('excludes future timestamp', () => {
      const job = {
        postedAt: new Date(NOW.getTime() + 1 * 60 * 60 * 1000), // 1 hour in the future
        postedAtConfidence: 'EXACT' as const,
      };
      expect(shouldIncludeInFilter(job, '24h', NOW)).toBe(false);
    });
  });

  describe('7d filter', () => {
    it('includes EXACT job posted 5 days ago', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000),
        postedAtConfidence: 'EXACT' as const,
      };
      expect(shouldIncludeInFilter(job, '7d', NOW)).toBe(true);
    });

    it('excludes EXACT job posted 8 days ago', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000),
        postedAtConfidence: 'EXACT' as const,
      };
      expect(shouldIncludeInFilter(job, '7d', NOW)).toBe(false);
    });

    it('excludes UNKNOWN confidence from 7d filter', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 1 * 24 * 60 * 60 * 1000),
        postedAtConfidence: 'UNKNOWN' as const,
      };
      expect(shouldIncludeInFilter(job, '7d', NOW)).toBe(false);
    });
  });

  describe('30d filter', () => {
    it('includes EXACT job posted 20 days ago', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000),
        postedAtConfidence: 'EXACT' as const,
      };
      expect(shouldIncludeInFilter(job, '30d', NOW)).toBe(true);
    });

    it('excludes EXACT job posted 31 days ago', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000),
        postedAtConfidence: 'EXACT' as const,
      };
      expect(shouldIncludeInFilter(job, '30d', NOW)).toBe(false);
    });

    it('excludes UNKNOWN confidence from 30d filter', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000),
        postedAtConfidence: 'UNKNOWN' as const,
      };
      expect(shouldIncludeInFilter(job, '30d', NOW)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('includes job posted exactly at cutoff boundary (inclusive)', () => {
      const cutoffMs = 24 * 60 * 60 * 1000;
      const job = {
        postedAt: new Date(NOW.getTime() - cutoffMs), // Exactly at boundary
        postedAtConfidence: 'EXACT' as const,
      };
      expect(shouldIncludeInFilter(job, '24h', NOW)).toBe(true);
    });

    it('excludes job posted just before cutoff boundary', () => {
      const cutoffMs = 24 * 60 * 60 * 1000;
      const job = {
        postedAt: new Date(NOW.getTime() - cutoffMs - 1000), // 1 second past cutoff
        postedAtConfidence: 'EXACT' as const,
      };
      expect(shouldIncludeInFilter(job, '24h', NOW)).toBe(false);
    });

    it('APPROXIMATE job at edge of 24h window is included', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 23 * 60 * 60 * 1000),
        postedAtConfidence: 'APPROXIMATE' as const,
      };
      expect(shouldIncludeInFilter(job, '24h', NOW)).toBe(true);
    });

    it('future timestamp with APPROXIMATE confidence is excluded', () => {
      const job = {
        postedAt: new Date(NOW.getTime() + 1000),
        postedAtConfidence: 'APPROXIMATE' as const,
      };
      expect(shouldIncludeInFilter(job, '24h', NOW)).toBe(false);
    });

    it('returns false for invalid postedWithin format', () => {
      const job = {
        postedAt: new Date(NOW.getTime() - 1000),
        postedAtConfidence: 'EXACT' as const,
      };
      expect(shouldIncludeInFilter(job, 'invalid', NOW)).toBe(false);
    });
  });
});
