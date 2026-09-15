# MassMailer V2 — Phase 1 Final Sign-Off

You have already implemented Phase 1 — Career Intelligence Foundation.

Now perform a **final verification and remediation pass** against the existing code.

## CRITICAL SCOPE RULE

This is the **FINAL Phase 1 cleanup only**.

DO NOT implement Phase 2.

Do NOT add:

- Job discovery
- Job scraping
- Job portals
- Apify
- Firecrawl
- Playwright
- Job matching
- RAG
- pgvector
- LangChain
- Cover letters
- Application automation
- Auto-apply
- Recruiter discovery

Do not redesign the existing MassMailer architecture.

Do not remove or break existing functionality.

---

# OBJECTIVE

Resolve the remaining Phase 1 audit items:

1. Resume API response privacy
2. Prisma migration verification
3. Career API/security/parser test coverage
4. Transactional persistence for resume/profile/skills
5. Skill persistence error handling
6. Full build/test verification
7. Final Phase 1 documentation/status

---

# 1. Resume API Response Privacy

Inspect:

```text
backend/src/services/career/resumeService.ts
backend/src/routes/career/resume.ts
```

Specifically:

```http
GET /api/career/resumes
GET /api/career/resumes/:id
```

The API must NOT unnecessarily expose internal/private fields.

Do not return:

```text
rawText
storageKey
filesystem paths
internal storage implementation details
internal processing metadata
```

unless the frontend genuinely requires them.

Use Prisma `select` or explicit DTO/serializer functions.

The response should contain only fields needed by the authenticated UI, such as:

```text
id
fileName
fileType
status
parsedData
createdAt
updatedAt
```

Use the existing API response conventions.

IMPORTANT:

The internal resume-processing service must still be able to access `rawText` when required.

Do not delete rawText from the database.

---

# 2. Prisma Migration Verification

Inspect:

```text
backend/prisma/schema.prisma
backend/prisma/migrations/
```

Confirm that the Career Foundation schema has a committed migration.

The migration must contain the Phase 1 models:

```text
CandidateProfile
Resume
ResumeVersion
Skill
SkillAlias
CandidateSkill
```

and their relationships/indexes/constraints.

Run:

```bash
cd backend
npx prisma migrate status
```

Then:

```bash
npx prisma generate
```

If the migration is missing, create it:

```bash
npx prisma migrate dev --name add_career_foundation
```

Do NOT modify old migrations.

Do NOT delete migration history.

Verify a clean database can be initialized using:

```bash
npx prisma migrate deploy
```

Do not make `prisma db push` the production migration mechanism.

---

# 3. Career API Test Coverage

Inspect the existing test architecture first.

Follow the project's current testing conventions.

Add tests for:

## Candidate Profile

```text
GET /api/career/profile
POST /api/career/profile
PATCH /api/career/profile
```

Test:

- authenticated request
- unauthenticated request
- valid input
- invalid input
- profile creation
- profile update

---

# 4. Authorization Tests

This is mandatory.

Create at least two test users:

```text
User A
User B
```

Verify:

```text
User A → User A profile = allowed
User A → User B profile = denied

User A → User A resume = allowed
User A → User B resume = denied
```

Also test that client-provided IDs cannot bypass ownership.

Do not rely only on frontend restrictions.

Authorization must be enforced in the backend.

---

# 5. Resume API Tests

Test:

```text
POST /api/career/resumes
GET /api/career/resumes
GET /api/career/resumes/:id
DELETE /api/career/resumes/:id
POST /api/career/resumes/:id/parse
```

At minimum cover:

```text
valid PDF
invalid file type
oversized file
authenticated upload
unauthenticated upload
list own resumes
get own resume
reject another user's resume
delete own resume
parse own resume
reject parse request for another user's resume
```

Use test fixtures rather than committing personal resumes.

---

# 6. Resume Parser Tests

Inspect:

```text
backend/src/services/ai/geminiClient.ts
backend/src/services/ai/resumeParser.ts
backend/src/services/ai/resumeSchema.ts
```

Mock Gemini.

Do NOT call the real Gemini API in tests.

Test:

```text
valid Gemini response
valid response with optional fields missing
invalid schema
malformed JSON
Gemini timeout
Gemini API error
empty resume text
```

Verify invalid Gemini output never gets persisted as valid parsed resume data.

---

# 7. Skill Tests

Keep the existing normalization tests.

Add/verify:

```text
ReactJS → React
React.js → React
React JS → React

NodeJS → Node.js
NextJS → Next.js

TS → TypeScript
JS → JavaScript

Postgres → PostgreSQL
```

Also test:

```text
duplicate CandidateSkill
canonical skill reuse
alias reuse
unknown skill
whitespace handling
case normalization
```

---

# 8. Transactional Resume Persistence

Inspect the current resume parse flow.

The goal is:

```text
Gemini
 ↓
Zod validation
 ↓
Prepare normalized data
 ↓
Prisma transaction
      ├── update Resume
      ├── update CandidateProfile
      └── persist CandidateSkill records
 ↓
COMMIT
```

IMPORTANT:

Never keep a Prisma transaction open while calling Gemini.

Gemini must execute BEFORE the transaction.

If the database transaction fails:

```text
Resume
Profile
Skills
```

must not be left in a misleading partially updated state.

Use:

```ts
prisma.$transaction(...)
```

where appropriate.

---

# 9. Skill Persistence Error Handling

Inspect:

```text
backend/src/services/career/skillService.ts
```

Do NOT silently swallow persistence failures.

Avoid behavior like:

```ts
catch (err) {
  logger.warn(...)
}
```

followed by a successful response.

Instead:

- propagate the failure when the operation is required, or
- return a structured result if partial success is intentionally supported.

For resume parsing, prefer atomic persistence.

Example:

```text
12 skills detected
12 skills persisted
```

or:

```text
persistence failed
→ transaction rolled back
→ resume parse marked failed
```

Do not report successful parsing when required skill persistence failed.

---

# 10. Resume Failure State

Verify:

```text
UPLOADED
PROCESSING
PARSED
FAILED
```

behavior.

Successful flow:

```text
UPLOAD
 ↓
PROCESSING
 ↓
PARSED
```

Failure:

```text
UPLOAD
 ↓
PROCESSING
 ↓
FAILED
```

If parsing fails:

- original resume must remain intact
- parsedData must not contain invalid/incomplete AI output
- the user must be able to retry
- internal stack traces must not be exposed to the frontend

---

# 11. File Upload Security Verification

Verify existing protections remain intact:

- PDF-only
- reasonable file-size limit
- safe generated storage filename
- no path traversal
- no use of user filename as filesystem path

If practical, verify PDF file signature/content.

Do not expand file support beyond PDF in this phase.

---

# 12. Frontend Regression

Verify:

```text
/career
/career/profile
/career/resume
/career/skills
```

work with the backend.

Check:

- upload
- loading state
- processing state
- parsed state
- failure state
- retry
- profile editing
- skill display

Do not break existing MassMailer pages.

---

# 13. Existing MassMailer Regression

Run the existing test suite.

Verify at minimum:

```text
Authentication
Campaigns
Contacts
HR Contacts
Templates
SMTP
Email sending
Tracking
Analytics
Follow-ups
BullMQ
```

Do NOT refactor the existing email worker as part of this task.

If a regression appears because of Phase 1 changes, fix it.

---

# 14. Build Verification

From backend:

```bash
npm install
npm run build
npm test
```

Run the appropriate frontend commands based on the existing package scripts.

Also run Prisma:

```bash
npx prisma generate
npx prisma migrate status
```

If the project provides a lint command, run it as well.

---

# 15. Database Clean-Install Verification

Use a clean/test database.

Verify:

```bash
npx prisma migrate deploy
```

works successfully.

Then verify:

```text
CandidateProfile
Resume
ResumeVersion
Skill
SkillAlias
CandidateSkill
```

are created correctly.

Do not use a production database for destructive testing.

---

# 16. README Verification

Ensure the README accurately documents Phase 1.

It should mention only:

```text
Candidate Profile
Resume Upload
PDF Extraction
Gemini Resume Parsing
Zod Validation
Skill Normalization
Resume Versions
```

It must NOT claim:

```text
Job scraping
Job matching
RAG
Auto-apply
Application automation
Cover letters
```

as implemented features.

For database documentation:

Development:

```bash
npx prisma migrate dev
```

Production:

```bash
npx prisma migrate deploy
```

Example environment values must clearly be placeholders.

Never commit real credentials.

---

# 17. Check Git Diff Carefully

Before finishing, inspect:

```bash
git status
git diff
```

Confirm:

- no secrets
- no `.env`
- no personal resumes
- no real candidate data
- no API keys
- no unnecessary generated files
- no unrelated refactors
- no Phase 2 implementation

Do not commit secrets even if they are only accidentally present in test fixtures.

---

# 18. Final Phase 1 Acceptance Test

The following complete flow must work:

```text
User Login
   ↓
Career Intelligence
   ↓
Upload PDF Resume
   ↓
Resume Stored
   ↓
PDF Text Extracted
   ↓
Gemini Parses Resume
   ↓
Zod Validates Output
   ↓
Skills Normalized
   ↓
Candidate Profile Updated
   ↓
Candidate Skills Persisted
   ↓
Resume Status = PARSED
   ↓
User Reviews Data
   ↓
User Edits Profile
   ↓
Changes Persist
```

And this must fail safely:

```text
User A
 ↓
User B Resume ID
 ↓
403 / appropriate authorization error
```

---

# 19. DO NOT Add These During This Task

Absolutely no:

```text
Job
JobSource
JobMatch
Application
ApplicationQuestion
RAG
Embedding
pgvector
Apify
Firecrawl
Playwright
LangChain
AutoApply
```

These belong to Phase 2+.

---

# FINAL REPORT

When finished, provide:

## 1. Phase 1 Status

Use exactly one:

```text
PHASE 1 STATUS: COMPLETE
```

or

```text
PHASE 1 STATUS: NOT COMPLETE
```

Do not claim COMPLETE unless every mandatory check passes.

## 2. Files Modified

List every file and reason.

## 3. Files Created

List every file and reason.

## 4. Database

Report:

- models
- indexes
- relationships
- migration name
- migration status

## 5. API

List every Career endpoint tested.

## 6. Security

Report:

- authentication
- authorization
- ownership tests
- file validation
- response privacy
- secret handling

## 7. AI

Report:

- Gemini abstraction
- Zod validation
- parser tests
- failure handling

## 8. Resume Processing

Report:

- upload
- extraction
- parsing
- normalization
- persistence
- transaction behavior

## 9. Tests

Give the exact test command and result.

Example:

```text
Tests: 42 passed, 0 failed
```

Do not invent numbers.

## 10. Build

Report exact result of:

```text
backend build
frontend build
lint, if available
```

## 11. Regression

Report existing MassMailer tests/features verified.

## 12. Remaining Issues

Be completely honest.

## 13. Phase 2 Readiness

Only after all mandatory requirements pass:

```text
PHASE 1 STATUS: COMPLETE
READY FOR PHASE 2
```

Otherwise:

```text
PHASE 1 STATUS: NOT COMPLETE
```

with the exact remaining blockers.

Do NOT implement Phase 2.
