/**
 * Job Discovery Worker Tests.
 *
 * Tests the worker's processing logic in isolation by mocking:
 *   - Source adapters (FirecrawlAdapter)
 *   - ingestJobs service
 *
 * Does NOT require a real Redis or database connection.
 */

/// <reference types="jest" />
import { FirecrawlConfigurationError, FirecrawlTransientError } from '../services/jobs/adapters/firecrawlAdapter';

// Mock the ingestJobs service before importing worker
jest.mock('../services/jobs/jobIngestionService');
// Mock Redis/BullMQ so no real connection is made
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
  }));
});
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    on: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  })),
  Job: jest.fn(),
}));

import { ingestJobs } from '../services/jobs/jobIngestionService';
import { processDiscoveryJob } from './jobDiscoveryWorker';

const mockIngestJobs = ingestJobs as jest.MockedFunction<typeof ingestJobs>;

// ─── Mock Source Adapter ───────────────────────────────────────────────────────

const mockDiscoverJobs = jest.fn();
const mockAdapter = {
  name: 'mock-source',
  discoverJobs: mockDiscoverJobs,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('JobDiscoveryWorker — processing logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const adapters = { firecrawl: mockAdapter } as any;

  const defaultStats = {
    received: 0,
    invalid: 0,
    duplicate: 0,
    created: 0,
    updated: 0,
    errors: 0,
  };

  it('1. successful discovery — returns aggregated stats', async () => {
    const rawJobs = [
      { title: 'Engineer', company: 'Acme', jobUrl: 'https://acme.com/j/1', source: 'firecrawl' },
    ];
    mockDiscoverJobs.mockResolvedValueOnce(rawJobs);
    mockIngestJobs.mockResolvedValueOnce({ ...defaultStats, received: 1, created: 1 });

    const result = await processDiscoveryJob(
      { input: { keywords: 'React developer' }, sources: ['firecrawl'] },
      adapters
    );

    expect(mockDiscoverJobs).toHaveBeenCalledTimes(1);
    expect(mockIngestJobs).toHaveBeenCalledWith(rawJobs);
    expect(result.received).toBe(1);
    expect(result.created).toBe(1);
  });

  it('2. multiple jobs — aggregated stats are summed correctly', async () => {
    const rawJobs = Array.from({ length: 5 }, (_, i) => ({
      title: `Engineer ${i}`,
      company: 'Acme',
      jobUrl: `https://acme.com/j/${i}`,
      source: 'firecrawl',
    }));
    mockDiscoverJobs.mockResolvedValueOnce(rawJobs);
    mockIngestJobs.mockResolvedValueOnce({ ...defaultStats, received: 5, created: 4, duplicate: 1 });

    const result = await processDiscoveryJob(
      { input: { keywords: 'engineer' }, sources: ['firecrawl'] },
      adapters
    );

    expect(result.received).toBe(5);
    expect(result.created).toBe(4);
    expect(result.duplicate).toBe(1);
  });

  it('3. source returns zero jobs — returns zero stats, no error', async () => {
    mockDiscoverJobs.mockResolvedValueOnce([]);
    mockIngestJobs.mockResolvedValueOnce({ ...defaultStats });

    const result = await processDiscoveryJob(
      { input: { keywords: 'obscure role' }, sources: ['firecrawl'] },
      adapters
    );

    expect(result.received).toBe(0);
    expect(result.created).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('4. invalid jobs — counted in stats.invalid', async () => {
    const rawJobs = [{ invalid: 'data' }];
    mockDiscoverJobs.mockResolvedValueOnce(rawJobs);
    mockIngestJobs.mockResolvedValueOnce({ ...defaultStats, received: 1, invalid: 1 });

    const result = await processDiscoveryJob(
      { input: { keywords: 'engineer' }, sources: ['firecrawl'] },
      adapters
    );

    expect(result.invalid).toBe(1);
    expect(result.created).toBe(0);
  });

  it('5. transient source error — propagates (enables BullMQ retry)', async () => {
    mockDiscoverJobs.mockRejectedValueOnce(
      new FirecrawlTransientError('Firecrawl rate limited (HTTP 429)', 429)
    );

    await expect(
      processDiscoveryJob(
        { input: { keywords: 'engineer' }, sources: ['firecrawl'] },
        adapters
      )
    ).rejects.toThrow(FirecrawlTransientError);

    // ingestJobs should NOT have been called
    expect(mockIngestJobs).not.toHaveBeenCalled();
  });

  it('6. config error (missing API key) — propagates as FirecrawlConfigurationError', async () => {
    mockDiscoverJobs.mockRejectedValueOnce(
      new FirecrawlConfigurationError('FIRECRAWL_API_KEY is not configured')
    );

    await expect(
      processDiscoveryJob(
        { input: { keywords: 'engineer' }, sources: ['firecrawl'] },
        adapters
      )
    ).rejects.toThrow(FirecrawlConfigurationError);

    expect(mockIngestJobs).not.toHaveBeenCalled();
  });

  it('7. ingestion database exception — propagates error', async () => {
    const rawJobs = [{ title: 'E', company: 'C', jobUrl: 'https://c.com/1', source: 'firecrawl' }];
    mockDiscoverJobs.mockResolvedValueOnce(rawJobs);
    mockIngestJobs.mockRejectedValueOnce(new Error('Database connection lost'));

    await expect(
      processDiscoveryJob(
        { input: { keywords: 'engineer' }, sources: ['firecrawl'] },
        adapters
      )
    ).rejects.toThrow('Database connection lost');
  });

  it('8. ingestion stats containing persistence errors — throws error to fail BullMQ job', async () => {
    const rawJobs = [{ title: 'E', company: 'C', jobUrl: 'https://c.com/1', source: 'firecrawl' }];
    mockDiscoverJobs.mockResolvedValueOnce(rawJobs);
    mockIngestJobs.mockResolvedValueOnce({ ...defaultStats, received: 1, errors: 1 });

    await expect(
      processDiscoveryJob(
        { input: { keywords: 'engineer' }, sources: ['firecrawl'] },
        adapters
      )
    ).rejects.toThrow('Job ingestion completed with 1 persistence error(s)');
  });

  it('9. unknown source name — skips gracefully without error', async () => {
    const result = await processDiscoveryJob(
      { input: { keywords: 'engineer' }, sources: ['nonexistent-source'] },
      adapters
    );

    expect(result.received).toBe(0);
    expect(mockDiscoverJobs).not.toHaveBeenCalled();
  });

  it('10. aggregated stats — multiple sources summed correctly', async () => {
    const mockAdapter2 = { name: 'source2', discoverJobs: jest.fn() };
    const multiAdapters = { source1: mockAdapter, source2: mockAdapter2 } as any;

    mockDiscoverJobs.mockResolvedValueOnce([]);
    mockAdapter2.discoverJobs.mockResolvedValueOnce([]);
    mockIngestJobs
      .mockResolvedValueOnce({ ...defaultStats, received: 3, created: 2, duplicate: 1 })
      .mockResolvedValueOnce({ ...defaultStats, received: 5, created: 3, updated: 2 });

    const result = await processDiscoveryJob(
      { input: { keywords: 'engineer' }, sources: ['source1', 'source2'] },
      multiAdapters
    );

    expect(result.received).toBe(8);
    expect(result.created).toBe(5);
    expect(result.duplicate).toBe(1);
    expect(result.updated).toBe(2);
  });
});

// ─── Error Class Tests ────────────────────────────────────────────────────────

describe('FirecrawlConfigurationError', () => {
  it('has isRetryable = false', () => {
    const err = new FirecrawlConfigurationError('Missing API key');
    expect(err.isRetryable).toBe(false);
    expect(err.name).toBe('FirecrawlConfigurationError');
    expect(err.message).toBe('Missing API key');
  });
});

describe('FirecrawlTransientError', () => {
  it('has isRetryable = true', () => {
    const err = new FirecrawlTransientError('Rate limited', 429);
    expect(err.isRetryable).toBe(true);
    expect(err.name).toBe('FirecrawlTransientError');
    expect(err.statusCode).toBe(429);
  });
});
