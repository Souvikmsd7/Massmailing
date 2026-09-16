# MassMailer — Phase 2 Final Hardening & Sign-Off

You are working on the existing MassMailer.

## OBJECTIVE

Phase 2 — Job Discovery & Ingestion has already been implemented.

Your task now is to **audit, fix, test, and harden the existing Phase 2 implementation** based on the following requirements.

Do NOT start Phase 3.

Do NOT implement:

- Job matching
- pgvector
- embeddings
- RAG
- resume optimization
- auto-apply
- Playwright
- application tracking
- LangChain
- Python AI services
- cover-letter generation
- AI scoring

Do NOT refactor unrelated MassMailer functionality.

Preserve all existing Phase 1 and MassMailer features.

---

# 1. FIX CANONICAL JOB URL DEDUPLICATION

Current problem:

The deduplication layer generates a normalized/canonical URL, but the `Job` database model does not persist a canonical URL and the ingestion process primarily relies on `contentHash`.

This must be corrected.

## Required behavior

Deduplication priority must be:

1. `source + sourceJobId`
2. canonical/normalized job URL
3. content hash

Canonical URL normalization must remove tracking parameters such as:

- utm_source
- utm_medium
- utm_campaign
- utm_term
- utm_content
- fbclid
- gclid

It should also normalize:

- trailing slash
- hostname casing
- default ports
- URL encoding where appropriate

Do NOT blindly remove legitimate query parameters that identify the actual job.

## Database

Add a persisted canonical URL field if necessary, for example:

`canonicalJobUrl`

Make the design suitable for unique lookup/deduplication.

Create a proper Prisma migration.

Do NOT modify existing migration history.

Do NOT use `prisma db push` as a substitute for a migration.

## Important

Do not accidentally treat two genuinely different jobs as duplicates merely because they share a company domain.

Add tests covering:

- same source + same sourceJobId
- same canonical URL
- URL with UTM parameters
- URL with different tracking parameters
- different jobs with different URLs
- same URL but changed description/content
- content-hash duplicate
- malformed URL handling

---

# 2. FIX JOB INGESTION CREATED/UPDATED DETECTION

The current ingestion implementation must not determine whether a job was created or updated by comparing timestamps such as:

`createdAt === updatedAt`

This is unreliable.

Implement deterministic behavior.

The ingestion result should clearly distinguish:

- created
- updated
- duplicate
- invalid
- error

Do not silently classify an update as a duplicate.

Define the semantics clearly in code and tests.

Example result:

```ts
{
  received: 10,
  invalid: 1,
  duplicate: 2,
  created: 5,
  updated: 2,
  errors: 0
}
```

Update any affected types, worker logging, tests, and documentation.

---

# 3. FIX FIRECRAWL JOB DISCOVERY

The current Firecrawl implementation appears capable of extracting only a very limited number of jobs from a result page.

The UI supports:

`maxResults`

but the adapter must actually respect that contract.

The adapter should return:

```ts
RawJob[]
```

with potentially multiple jobs.

## Required architecture

Use this flow:

```text
Discovery request
      ↓
JobSource adapter
      ↓
Search/results page
      ↓
Identify job listings/URLs
      ↓
Fetch/extract individual job pages when required
      ↓
RawJob[]
      ↓
Zod validation
      ↓
Normalization
      ↓
Deduplication
      ↓
Database
```

Do not fake multiple jobs from a single page.

Do not invent job information.

Do not fabricate posting dates, companies, salaries, or skills.

## maxResults

If:

```text
maxResults = 20
```

the adapter should attempt to return up to 20 actual discovered jobs.

It may return fewer if the source genuinely provides fewer valid jobs.

Document this behavior.

## Failure behavior

Do NOT swallow all Firecrawl errors and return `[]`.

Distinguish:

### Configuration errors

Example:

- missing API key

These can fail clearly without retrying indefinitely.

### Transient errors

Examples:

- timeout
- HTTP 429
- temporary 5xx
- network failure

These should propagate so BullMQ can retry.

### Invalid source content

This can be logged and skipped without causing the entire worker job to fail.

---

# 4. FIX BULLMQ RETRY / FAILURE SEMANTICS

Current worker behavior catches source failures and can allow BullMQ to consider the job successful.

Fix this.

Required behavior:

```text
Transient Firecrawl failure
        ↓
throw error
        ↓
BullMQ marks job failed
        ↓
BullMQ retry
        ↓
exponential backoff
```

Do not catch an error and return success unless the failure is intentionally non-retryable.

The worker should preserve the distinction between:

- source unavailable
- source returned invalid jobs
- ingestion failed
- configuration failure
- successful discovery

## Worker requirements

Verify:

- attempts
- exponential backoff
- concurrency
- failed jobs
- completed jobs
- logging
- retry behavior

Avoid creating unnecessary duplicate Queue instances.

Prefer a clean structure where the queue definition is centralized and the worker consumes the same queue.

Do not introduce a new queue library.

Continue using BullMQ + Redis already used by MassMailer.

---

# 5. STRICT ZOD VALIDATION FOR JOB APIs

Review all Phase 2 job routes.

At minimum validate:

### Discovery

```text
keywords/query
location
maxResults/limit
sources
```

### Job listing

```text
search
remoteType
employmentType
postedWithin
page
limit
```

### Job ID

Validate that IDs are non-empty and safely handled.

Invalid enum values must return a clear `400` response rather than being silently ignored.

Invalid numbers such as:

```text
page=abc
limit=abc
limit=-5
limit=999999
```

must be rejected or safely constrained.

Define reasonable limits.

For example:

```text
page >= 1
limit >= 1
limit <= 100
```

Do not trust frontend validation.

Backend validation is authoritative.

---

# 6. POSTED DATE / 24-HOUR FILTERING

Preserve the existing:

```text
EXACT
APPROXIMATE
UNKNOWN
```

confidence model.

Do NOT invent exact posting timestamps.

For:

```text
postedWithin=24h
```

only include jobs whose `postedAt` is usable according to the established confidence rules.

Be explicit about how `APPROXIMATE` timestamps are handled.

`UNKNOWN` must not incorrectly appear as a recent job.

Add tests for:

- exact timestamp inside 24h
- exact timestamp outside 24h
- approximate timestamp
- unknown timestamp
- 7d
- 30d
- future timestamp
- null timestamp

Use UTC consistently.

---

# 7. SOURCE ADAPTER CONTRACT

Review the `JobSource` interface.

It should clearly define:

```ts
interface JobSource {
  name: string
  discoverJobs(input: JobDiscoveryInput): Promise<RawJob[]>
}
```

Ensure the adapter does not leak provider-specific structures into the ingestion service.

The ingestion service should remain source-agnostic.

Do not add source-specific logic to the database layer.

---

# 8. INGESTION PIPELINE

Ensure the complete pipeline is:

```text
Raw source data
      ↓
RawJobSchema validation
      ↓
Job normalization
      ↓
canonical URL normalization
      ↓
deduplication
      ↓
database persistence
```

No Gemini/LLM should be required for basic job ingestion in Phase 2 unless already explicitly part of the existing implementation.

Do not introduce unnecessary AI calls.

---

# 9. SECURITY

Verify:

- all Career Job routes require authentication
- users cannot access unauthorized/private data
- external URLs are not executed server-side without explicit source-adapter logic
- Firecrawl API key stays server-side
- no secrets are logged
- job URLs are validated
- no arbitrary filesystem operations are introduced
- no SSRF-prone generic URL fetching endpoint is exposed to users

Especially ensure there is no API such as:

```text
POST /fetch-url
```

where a user can submit arbitrary internal/private URLs.

The Firecrawl source adapter should control which URLs are fetched.

---

# 10. TESTS — REQUIRED

Add or improve tests.

## Normalization tests

Test:

- React JS
- Node JS
- Next JS
- Sr.
- Jr.
- Full Stack
- locations
- remote type
- employment type
- duplicate skills

## Deduplication tests

Test:

- source/sourceJobId
- canonical URL
- UTM removal
- tracking parameters
- content hash
- different jobs

## API tests

Test:

- unauthenticated access → 401
- authenticated access → success
- invalid query → 400
- invalid enum → 400
- invalid pagination → 400
- valid filters
- 24h filter
- 7d filter
- 30d filter
- job detail
- nonexistent job → 404

## Worker tests

Mock the source adapter.

Test:

1. successful discovery
2. multiple jobs
3. source returns zero jobs
4. invalid jobs
5. transient source error
6. permanent source error
7. ingestion failure
8. retry behavior
9. aggregated statistics

## Firecrawl adapter tests

Mock Firecrawl.

Do NOT make real external API calls in automated tests.

Test:

- API success
- multiple job results
- maxResults
- timeout
- 429
- 500
- malformed response
- missing API key
- invalid extracted job
- posting-date extraction

---

# 11. PHASE 1 REGRESSION

Before declaring Phase 2 complete, verify that Phase 1 still works.

Specifically test:

- candidate profile
- resume upload
- resume retrieval
- resume ownership
- resume deletion
- resume parsing
- skill normalization
- manual skill management

Verify that Phase 2 changes did not expose:

```text
rawText
storageKey
```

from resume APIs unnecessarily.

Do not modify Phase 1 behavior unless required for security/regression.

---

# 12. EXISTING MASSMAILER REGRESSION

Do not break existing:

- authentication
- JWT refresh
- campaigns
- recipients
- HR contacts
- templates
- SMTP accounts
- SMTP rotation
- email sending
- follow-ups
- tracking
- analytics
- dashboard
- Docker setup
- health endpoint

Do not refactor the large existing email worker merely for code cleanliness.

---

# 13. DATABASE VERIFICATION

After making schema changes:

Run:

```bash
npx prisma format
npx prisma generate
npx prisma migrate status
```

Verify the migration history is consistent.

If a new migration is required:

```bash
npx prisma migrate dev
```

Do not modify already-committed migration SQL manually unless absolutely necessary.

Verify a clean database can be initialized using:

```bash
npx prisma migrate deploy
```

Document the result.

---

# 14. BUILD / TEST VERIFICATION

Run the actual commands supported by the repository.

Backend:

```bash
npm install
npm run build
npm test
```

Frontend:

```bash
npm install
npm run build
```

Run frontend tests if configured.

If any command fails:

- investigate the real cause
- fix it if related to Phase 2
- do not simply suppress the failure
- report unrelated pre-existing failures separately

Do not claim success without actually running the command.

---

# 15. CODE QUALITY

Keep the current architecture.

Preferred flow:

```text
route
 ↓
service
 ↓
source adapter / ingestion layer
 ↓
Prisma
```

Avoid:

- business logic inside routes
- direct Prisma calls from frontend
- duplicate normalization implementations
- duplicated queue definitions
- giant new files
- unnecessary abstractions
- unnecessary dependencies

Use existing project conventions.

---

# 16. README / DOCUMENTATION

Update documentation to accurately describe what Phase 2 actually supports.

Document:

- JobSource abstraction
- discovery flow
- Firecrawl source
- normalization
- deduplication
- posted-date confidence
- BullMQ job discovery queue
- supported filters
- limitations
- environment variables

Do not claim functionality that the implementation does not actually provide.

Clearly state that Phase 3 is not implemented.

---

# 17. SCOPE CONTROL

Before finishing, inspect:

```bash
git status
git diff
```

Look for:

- secrets
- API keys
- `.env` files
- personal resumes
- personal contact data
- generated files
- unrelated refactors
- accidental Phase 3 implementation

Remove anything that should not be committed.

Do not commit real credentials.

---

# 18. FINAL SIGN-OFF CRITERIA

You may report:

`PHASE 2 STATUS: COMPLETE`

ONLY if ALL of the following are true:

- canonical URL deduplication works
- source/sourceJobId deduplication works
- content-hash deduplication works
- ingestion correctly distinguishes created/updated/duplicate
- Firecrawl can return multiple real jobs
- maxResults is respected
- Firecrawl transient errors propagate correctly
- BullMQ retry behavior works
- API validation is strict
- posted-date filtering is correct
- authentication is enforced
- worker tests exist
- API tests exist
- adapter tests exist
- Phase 1 regression passes
- existing MassMailer tests/build pass
- Prisma migration is valid
- `prisma migrate status` is clean
- backend build passes
- frontend build passes
- no secrets are committed
- no Phase 3 functionality has been implemented

If ANY mandatory item fails:

`PHASE 2 STATUS: NOT COMPLETE`

Do not hide failures behind warnings.

---

# FINAL RESPONSE FORMAT

After implementation, provide:

## Phase 2 Status

`COMPLETE` or `NOT COMPLETE`

## Changes Made

List every meaningful change.

## Tests Run

Show the exact commands and their results.

Example:

```text
npm test              PASS
npm run build         PASS
npx prisma generate   PASS
npx prisma migrate status PASS
```

## Deduplication Verification

Explain exactly how:

```text
sourceJobId
canonical URL
contentHash
```

are handled.

## Firecrawl Verification

Explain how many real jobs can be returned and how `maxResults` works.

## Retry Verification

Explain what happens for:

```text
429
5xx
timeout
invalid source data
missing API key
```

## Remaining Issues

List any remaining issues honestly.

## Phase Boundary

Confirm explicitly:

`Phase 3 NOT IMPLEMENTED`

Do not proceed to Phase 3.
