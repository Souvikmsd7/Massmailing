# MassMailer — Phase 2 Final Fix: Migration, Tests & Verification

You are working on the existing `Souvikmsd7/Massmailing` repository.

The Phase 2 implementation has already been audited. Do **not** redesign or refactor the existing architecture.

Your task is ONLY to close the remaining Phase 2 blockers and verify the repository.

## 1. FIX THE PRISMA MIGRATION — REQUIRED

The current Prisma schema contains:

```prisma
canonicalJobUrl String?
```

and the application already reads/writes this field.

However, the existing migration:

```text
backend/prisma/migrations/20260915000000_add_job_discovery/migration.sql
```

does NOT create `canonicalJobUrl`.

Fix this properly.

Requirements:

- Do NOT edit an already-applied migration.
- Create a new Prisma migration, for example:

```text
20260917000000_add_canonical_job_url
```

- Add the `canonicalJobUrl` column.
- Add the appropriate database index/unique constraint based on the existing deduplication design.
- Keep nullable behavior compatible with existing data.
- Ensure the Prisma schema and migration history are consistent.
- Do not delete or rewrite existing migrations.

Then verify:

```bash
npx prisma format
npx prisma generate
npx prisma migrate status
```

If a migration cannot safely be generated because of the current database state, resolve the issue without modifying historical migrations.

---

## 2. ADD FINAL DEDUPLICATION TESTS

Add focused tests for the existing deduplication implementation.

Verify:

### A. Source ID deduplication

Same:

```text
source + sourceJobId
```

must resolve to the same Job.

### B. Canonical URL deduplication

These should resolve to the same canonical URL:

```text
https://example.com/jobs/123
https://example.com/jobs/123/
https://example.com/jobs/123?utm_source=google
https://example.com/jobs/123?utm_source=linkedin
```

But meaningful query parameters must remain meaningful.

For example, do NOT blindly remove every query parameter.

### C. Content hash deduplication

Equivalent normalized jobs from different sources should be detected through `contentHash`.

### D. Different jobs must remain different

Do not accidentally deduplicate two genuinely different URLs/jobs.

### E. Idempotency

Running the same `ingestJobs()` input twice must result in:

```text
first run  → created
second run → duplicate
```

not two database records.

---

## 3. ADD FIRECRAWL TESTS

Do not make real Firecrawl API calls in tests.

Mock the HTTP layer.

Test at minimum:

### Successful discovery

A mocked search page containing multiple job links should produce multiple `RawJob` records.

Verify:

```text
maxResults = 3 → no more than 3 jobs returned
maxResults = 10 → up to 10 valid jobs returned
```

### Invalid individual job

If one job page cannot be parsed:

```text
valid jobs → retained
invalid job → skipped
```

### HTTP 429

Verify that a Firecrawl 429 produces `FirecrawlTransientError`.

### HTTP 5xx

Verify that a Firecrawl 5xx produces `FirecrawlTransientError`.

### Timeout/network failure

Verify that timeout/network failures produce `FirecrawlTransientError`.

### Missing API key

Verify that missing:

```text
FIRECRAWL_API_KEY
```

produces `FirecrawlConfigurationError`.

Do not weaken the current error semantics just to make tests pass.

---

## 4. ADD WORKER RETRY TEST

Add a focused test proving the worker does not swallow transient Firecrawl failures.

The expected behavior is:

```text
FirecrawlTransientError
        ↓
worker throws
        ↓
BullMQ receives failure
        ↓
job is eligible for retry
```

Do not require a real Redis instance if the existing test architecture allows mocking.

The important assertion is that the worker handler **rejects/throws** the transient error rather than returning successful stats.

---

## 5. VERIFY POSTED DATE FILTERS

Add or strengthen tests for:

```text
24h
7d
30d
```

Verify:

- EXACT dates are filtered correctly.
- APPROXIMATE dates are filtered correctly.
- UNKNOWN dates are excluded from recent-date filtering.
- Future posted dates are not incorrectly treated as valid recent jobs.

Do not change the confidence model:

```text
EXACT
APPROXIMATE
UNKNOWN
```

---

## 6. TIGHTEN JOB URL EXTRACTION ONLY IF NEEDED

Review:

```text
isLikelyJobUrl()
```

in the Firecrawl adapter.

The current heuristic allows ordinary links based only on link-text length.

Improve this minimally so obvious navigation links are not treated as job postings.

Do NOT attempt to build a universal web crawler.

The adapter only needs to reliably handle the current Phase 2 source.

---

## 7. DO NOT CHANGE PHASE 1

Before making changes, treat all existing Phase 1 functionality as frozen.

Do NOT modify:

- CandidateProfile
- Resume upload/parsing
- ResumeVersion
- Skill normalization
- CandidateSkill
- Phase 1 APIs
- Phase 1 authentication/authorization

unless a test reveals a genuine regression caused by the Phase 2 changes.

If a regression is found, fix only that regression.

---

## 8. DO NOT START PHASE 3

Do NOT implement:

- pgvector
- embeddings
- semantic matching
- RAG
- LangChain
- resume optimization
- job scoring
- Playwright
- auto-apply
- application automation
- cover-letter generation
- AI job matching

Phase 2 ends after job discovery, normalization, deduplication, ingestion, filtering and reliable background processing.

---

# FINAL VERIFICATION

Run the appropriate commands for the actual repository.

At minimum verify:

```bash
cd backend

npm install
npx prisma format
npx prisma generate
npx prisma migrate status
npm test
npm run build
```

Then verify the frontend:

```bash
cd ../frontend

npm install
npm test
npm run build
```

If a test/build command does not exist, report that clearly instead of pretending it passed.

Also verify:

```bash
git status
git diff
```

Check specifically for:

- secrets/API keys
- `.env` files
- personal resume files
- generated sensitive data
- unrelated refactors
- accidental Phase 3 code

---

# REQUIRED FINAL REPORT

Your final response must contain exactly these sections:

## 1. PHASE 2 STATUS

Use:

```text
PHASE 2 STATUS: COMPLETE
```

ONLY if all mandatory requirements above pass.

Otherwise use:

```text
PHASE 2 STATUS: NOT COMPLETE
```

## 2. Migration

State:

- migration created
- `canonicalJobUrl` present in database migration
- `prisma migrate status` result

## 3. Tests

Report the actual results for:

- deduplication
- ingestion/idempotency
- Firecrawl
- worker retry
- posted-date filtering
- Phase 1 regression
- existing MassMailer regression
- frontend tests/build
- backend tests/build

Do not claim a test passed unless you actually ran it.

## 4. Remaining Issues

List only genuine remaining issues.

## 5. Phase Boundary

Confirm that no Phase 3 functionality was added.

STOP after this task.
Do not continue into Phase 3.
