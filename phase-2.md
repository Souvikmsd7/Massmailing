# MassMailer — Phase 2: Job Discovery & Ingestion

You are working on the existing **MassMailer** repository.

Repository:
https://github.com/Souvikmsd7/Massmailing

Implement **ONLY Phase 2 — Job Discovery & Ingestion**.

The goal is to add a reliable job discovery and ingestion pipeline while preserving **100% of the existing MassMailer functionality and Phase 1 Career Intelligence implementation**.

---

## 1. NON-NEGOTIABLE RULES

### DO NOT break existing functionality

Before making changes:

- Inspect the entire existing architecture.
- Understand existing:
  - authentication
  - Prisma schema
  - Redis
  - BullMQ
  - email workers
  - campaign system
  - SMTP rotation
  - analytics
  - Career Phase 1
  - Docker configuration
  - tests

- Do not rewrite existing working systems unnecessarily.
- Do not refactor the existing large `emailWorker.ts`.
- Do not modify existing MassMailer behavior unless absolutely required for integration.
- Make Phase 2 additive and isolated.

### Do NOT implement later phases

Do NOT implement:

- AI job matching
- Resume optimization
- RAG
- pgvector
- LangChain
- Auto-apply
- Playwright application automation
- Cover-letter generation
- Application automation
- Python AI/ML service
- ML model training

Those belong to later phases.

---

# 2. PHASE 2 OBJECTIVE

Build:

**Job Discovery → Queue → Source Adapter → Validation → Normalization → Deduplication → PostgreSQL**

Architecture:

```text
External Job Sources
        ↓
Job Discovery Service
        ↓
BullMQ Job Discovery Queue
        ↓
Source Adapter / Worker
        ↓
Raw Job Validation
        ↓
Normalization
        ↓
Deduplication
        ↓
PostgreSQL
        ↓
Jobs API
        ↓
Frontend Jobs UI
```

The system must be designed so additional job sources can be added later without rewriting the entire ingestion system.

---

# 3. TECHNOLOGY

Use the existing project stack wherever possible:

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Zod
- Existing Docker/Docker Compose
- Existing authentication
- Existing logging/error-handling conventions

External job-source tooling may use:

- Firecrawl
- Apify

Only use them where appropriate, permitted, and technically justified.

Do NOT add Python in Phase 2.

Do NOT add LangChain.

Do NOT add another database.

---

# 4. FIRST: AUDIT EXISTING REPOSITORY

Before implementation, inspect:

```text
backend/
backend/prisma/
backend/src/
frontend/
docker-compose.yml
package.json
README.md
```

Identify existing:

- Prisma models
- Redis connection
- BullMQ infrastructure
- queue naming conventions
- worker conventions
- authentication middleware
- API response conventions
- error handling
- validation patterns
- frontend routing
- environment configuration
- testing framework

Reuse existing infrastructure rather than creating duplicate implementations.

---

# 5. DATABASE DESIGN

Design the minimum schema required for Phase 2.

At minimum, introduce a `Job` model.

Potential supporting models may include:

```text
Job
JobSource
JobSkill
JobCompany
JobLocation
```

Do not create unnecessary tables.

The `Job` model should support at least:

```text
id
title
description
company
companyUrl
jobUrl
source
sourceJobId
location
remoteType
employmentType
salaryMin
salaryMax
salaryCurrency
postedAt
postedAtConfidence
discoveredAt
contentHash
status
createdAt
updatedAt
```

Adapt field names/types to the existing Prisma conventions.

---

# 6. POSTED DATE RELIABILITY

This is extremely important.

The system must NOT pretend that a job was posted recently when the source does not provide reliable information.

Add:

```text
postedAtConfidence
```

with values such as:

```text
EXACT
APPROXIMATE
UNKNOWN
```

Rules:

### EXACT

Use when the source provides a reliable posting timestamp/date.

### APPROXIMATE

Use when the source only provides information such as:

```text
"2 hours ago"
"Today"
"1 day ago"
```

and the exact timestamp cannot be reliably determined.

### UNKNOWN

Use when the source does not provide usable posting information.

Never invent a posting date.

Store:

```text
discoveredAt
```

separately from:

```text
postedAt
```

These are NOT interchangeable.

---

# 7. JOB SOURCE ABSTRACTION

Create a reusable source interface.

For example:

```typescript
interface JobSource {
  name: string

  discoverJobs(input: JobDiscoveryInput): Promise<RawJob[]>
}
```

Adapt this to the project's conventions.

The source abstraction should allow future adapters such as:

```text
LinkedIn
Indeed
Company Career Pages
Greenhouse
Lever
Other permitted sources
```

Do not implement every possible source now.

Implement only the sources that can be reliably and legally integrated in Phase 2.

---

# 8. RAW JOB CONTRACT

Define a normalized internal input contract using Zod.

For example:

```text
RawJob
```

should support:

```text
title
company
description
jobUrl
source
sourceJobId
location
remoteType
employmentType
salary
postedAt
postedAtConfidence
skills
companyUrl
```

Validate all external source data before inserting into PostgreSQL.

Never trust external source data.

---

# 9. NORMALIZATION

Create a dedicated normalization layer.

Normalize:

### Titles

Examples:

```text
Senior React JS Developer
Senior React.js Developer
Senior React Developer
```

should have consistent normalization where appropriate.

### Locations

Normalize obvious formatting differences.

### Remote type

Use a controlled representation such as:

```text
REMOTE
HYBRID
ONSITE
UNKNOWN
```

### Employment type

Use a controlled representation such as:

```text
FULL_TIME
PART_TIME
CONTRACT
INTERNSHIP
TEMPORARY
UNKNOWN
```

### Skills

Extract explicit skills only when reliably available.

Do NOT perform AI matching yet.

Reuse the Phase 1 skill normalization system where appropriate.

Do not duplicate skill normalization logic.

---

# 10. DEDUPLICATION

Implement deterministic job deduplication.

Preferred order:

### 1. Source job ID

If available:

```text
source + sourceJobId
```

must uniquely identify the source posting.

### 2. Canonical URL

Normalize URLs before comparison.

### 3. Content hash

Generate a stable hash from appropriate job fields, for example:

```text
normalized title
company
location
description
```

Use a cryptographic hash such as SHA-256.

Do not use AI for deduplication.

The ingestion pipeline must be idempotent.

Running the same discovery job twice must not create duplicate records.

---

# 11. BULLMQ

Reuse the existing Redis/BullMQ infrastructure.

Introduce a dedicated queue for job discovery.

For example:

```text
job-discovery
```

If the project already has a queue naming convention, follow it.

The architecture should eventually support:

```text
job-discovery
job-processing
job-matching
```

But **only implement the Phase 2 queue(s) required now**.

Do not build Phase 4 matching queues yet.

Workers must:

- handle retries
- handle failures
- avoid duplicate processing
- log useful errors
- avoid crashing the entire worker
- respect existing Redis/BullMQ configuration

Do not interfere with:

```text
email-sending
follow-up
```

queues.

---

# 12. JOB DISCOVERY SERVICE

Create a service responsible for orchestrating discovery.

Conceptually:

```text
JobDiscoveryService
```

Responsibilities:

1. Accept discovery parameters.
2. Select appropriate source adapters.
3. Queue discovery work.
4. Receive source results.
5. Validate jobs.
6. Normalize jobs.
7. Deduplicate.
8. Persist jobs.
9. Return ingestion statistics.

Keep business logic out of route handlers.

Architecture should follow:

```text
Route
  ↓
Service
  ↓
Queue
  ↓
Worker
  ↓
Source Adapter
  ↓
Validation
  ↓
Normalization
  ↓
Persistence
```

---

# 13. API

Add authenticated Career Job APIs.

Potential endpoints:

```text
GET /api/career/jobs
GET /api/career/jobs/:id
POST /api/career/jobs/discover
```

Adapt naming to the existing API conventions.

`POST /discover` should enqueue discovery rather than blocking the HTTP request while scraping/fetching a large number of jobs.

Support filters where reasonable:

```text
keyword
location
remoteType
employmentType
source
postedWithin
company
```

Do not implement semantic/AI matching filters yet.

---

# 14. 24-HOUR JOB FILTER

The API should eventually support:

```text
postedWithin=24h
```

But implement it correctly.

Only jobs with reliable enough `postedAt` information should be treated as recently posted.

Do not classify:

```text
postedAtConfidence = UNKNOWN
```

as definitely posted within 24 hours.

Clearly distinguish:

```text
exact recent jobs
approximate recent jobs
unknown posting date
```

---

# 15. FRONTEND

Add a basic Jobs section.

Suggested routes:

```text
/career/jobs
/career/jobs/:id
```

Follow the existing frontend architecture and styling.

The UI should support:

- job list
- job title
- company
- location
- remote type
- employment type
- posted date
- source
- job details
- external job link
- loading state
- empty state
- error state

Do NOT add:

- match score
- resume optimization
- AI explanation
- auto-apply

Those belong to later phases.

---

# 16. SECURITY

All authenticated job APIs must use existing authentication middleware.

Do not trust:

```text
userId
candidateId
```

from the client.

Validate all inputs.

External URLs must be validated.

Do not allow arbitrary filesystem access.

Do not expose:

- API keys
- Firecrawl keys
- Apify tokens
- Redis credentials
- database credentials

to the frontend.

All external service credentials must remain server-side.

---

# 17. RATE LIMITING / SOURCE SAFETY

Respect source restrictions and reasonable request rates.

Do not implement aggressive scraping.

Do not bypass:

- CAPTCHA
- authentication
- access controls
- robots restrictions
- anti-bot protections

If a source cannot be accessed reliably/permitted, make the adapter fail gracefully.

---

# 18. TESTING

Add comprehensive Phase 2 tests.

At minimum test:

### Schema

- valid job
- invalid job
- invalid enum
- missing required fields

### Normalization

- title normalization
- location normalization
- remote type
- employment type
- skill normalization

### Deduplication

- same source ID
- same canonical URL
- same content hash
- different jobs are preserved

### Posted date

Test:

```text
EXACT
APPROXIMATE
UNKNOWN
```

including 24-hour filtering.

### API

- authentication required
- valid discovery request
- invalid discovery request
- job listing
- job details
- filters

### Authorization

Ensure users cannot access private data belonging to another user if any user-scoped job functionality is introduced.

### Queue/worker

Mock source adapters and test:

- successful discovery
- retry
- failure
- duplicate job
- malformed source response

Do NOT make tests dependent on live external scraping services.

Mock Firecrawl/Apify/source adapters.

---

# 19. REGRESSION TESTING

After implementation, verify that Phase 1 still works:

```text
Candidate Profile
Resume Upload
Resume Parsing
Resume Versions
Skill Management
Skill Normalization
```

Then verify existing MassMailer:

```text
Authentication
Campaigns
Recipients
Templates
AI personalization
SMTP
Email sending
Follow-ups
Tracking
Analytics
CSV
Redis/BullMQ
```

No existing tests should regress.

---

# 20. MIGRATION

Create a proper Prisma migration.

Do NOT simply modify:

```text
schema.prisma
```

without creating the migration.

Verify:

```bash
npx prisma migrate status
npx prisma generate
```

Run the migration against a clean test database if possible.

Do not delete or rewrite existing migrations.

---

# 21. ENVIRONMENT VARIABLES

If Phase 2 requires new credentials, update the example environment file.

Use obvious placeholders:

```text
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
APIFY_API_TOKEN=your_apify_api_token_here
```

Never commit real credentials.

Inspect:

```text
.gitignore
.env
.env.example
```

before completing the work.

---

# 22. DOCUMENTATION

Update README with:

```text
Phase 2 — Job Discovery & Ingestion
```

Document:

- architecture
- supported sources
- setup
- environment variables
- queue
- worker
- API endpoints
- database migration
- limitations
- source/date reliability

Explicitly state that Phase 3+ functionality is not implemented.

---

# 23. CODE QUALITY

Follow existing project conventions.

Avoid:

- unnecessary dependencies
- duplicate services
- duplicate Redis clients
- duplicate queue infrastructure
- giant route handlers
- giant service files
- hardcoded credentials
- hardcoded URLs
- `any` unless unavoidable
- swallowing errors
- silent failures

Errors should propagate appropriately.

Use structured logging consistent with the existing application.

---

# 24. DO NOT OVERENGINEER

This is Phase 2.

Do not introduce:

```text
Kafka
Celery
MongoDB
Elasticsearch
Kubernetes
LangChain
pgvector
Python microservices
ML models
AI agents
```

unless an existing project requirement absolutely requires them.

They are not required for Phase 2.

---

# 25. FINAL VERIFICATION

Run as many of these as supported by the repository:

```bash
npm install
npm run build
npm test
npx prisma generate
npx prisma migrate status
```

Also run the frontend build/tests if separately configured.

Verify Docker if applicable.

Check:

```bash
git status
git diff
```

Look specifically for:

- secrets
- API keys
- personal information
- real resumes
- real recruiter data
- unrelated modifications
- accidental Phase 3+ implementation

---

# 26. FINAL REPORT

At the end, provide a concise report containing:

### Phase 2 implementation

- Files created
- Files modified
- Database models
- Migration
- Queues
- Workers
- Source adapters
- APIs
- Frontend
- Tests

### Verification

Show the result of:

```text
Build:
Tests:
Prisma:
Migration:
Docker:
Phase 1 regression:
MassMailer regression:
```

### Scope verification

Explicitly confirm:

```text
AI Matching: NOT IMPLEMENTED
RAG: NOT IMPLEMENTED
pgvector: NOT IMPLEMENTED
Resume Optimization: NOT IMPLEMENTED
Auto Apply: NOT IMPLEMENTED
Playwright: NOT IMPLEMENTED
Python AI/ML Service: NOT IMPLEMENTED
LangChain: NOT IMPLEMENTED
```

### Final status

Only report:

```text
PHASE 2 STATUS: COMPLETE
```

if all required implementation, migration, tests, security checks, and regression checks pass.

Otherwise report:

```text
PHASE 2 STATUS: NOT COMPLETE
```

and clearly list every blocker.

**Do not start Phase 3.**
