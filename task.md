# MassMailer V2 — Phase 1 Remediation & Completion

You are working inside the existing **MassMailer** repository.

Your job is to **finish and harden Phase 1 — Career Intelligence Foundation** based on the existing implementation.

---

# CRITICAL RULES

### 1. Do NOT implement Phase 2

Do NOT implement:

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
- Cover-letter generation
- Application automation
- Auto-apply
- Recruiter discovery

Those belong to later phases.

---

### 2. Do NOT rewrite MassMailer

This is an existing production-oriented project.

Do NOT replace or restructure the existing architecture unnecessarily.

Do NOT remove or break:

- Authentication
- JWT access/refresh tokens
- Campaigns
- Recipients
- Contacts
- HR contacts
- Templates
- SMTP
- SMTP health management
- Email workers
- Tracking
- Analytics
- Follow-ups
- Redis
- BullMQ
- Docker
- Existing APIs

Existing MassMailer functionality must continue to work exactly as before.

---

### 3. Make additive changes

The current Career Intelligence implementation already exists.

Your task is to:

1. Inspect it.
2. Identify incomplete/broken pieces.
3. Fix them.
4. Add missing tests.
5. Verify the entire project.
6. Do not redesign working code unnecessarily.

---

# PHASE 1 TARGET

The completed Phase 1 flow must be:

```text
User
 ↓
Career Intelligence
 ↓
Upload Resume
 ↓
Store Original Resume
 ↓
Extract PDF Text
 ↓
Gemini Resume Parsing
 ↓
Zod Validation
 ↓
Normalize Skills
 ↓
Candidate Profile
 ↓
Candidate Skills
 ↓
PostgreSQL
 ↓
User Reviews/Edits Data
```

Database foundation:

```text
User
 │
 └── CandidateProfile
       │
       ├── Resume
       │     └── ResumeVersion
       │
       └── CandidateSkill
              │
              └── Skill
                    └── SkillAlias
```

---

# STEP 1 — INSPECT BEFORE MODIFYING

Before changing anything, inspect:

```text
backend/prisma/schema.prisma

backend/src/server.ts

backend/src/routes/

backend/src/services/

backend/src/services/ai/

backend/src/middleware/

backend/src/workers/

frontend/app/

frontend/components/

frontend/lib/

backend/package.json

backend/package-lock.json

backend/prisma/migrations/

tests
```

Understand the existing conventions before modifying files.

Do not blindly apply a generic architecture.

---

# STEP 2 — VERIFY PRISMA MODELS

Confirm these models exist and work correctly:

```text
CandidateProfile
Resume
ResumeVersion
Skill
SkillAlias
CandidateSkill
```

Confirm these enums/fields are appropriate:

```text
ResumeStatus
SkillProficiency
SkillSource
```

Required relationships:

```text
User → CandidateProfile

CandidateProfile → Resume

Resume → ResumeVersion

CandidateProfile → CandidateSkill

CandidateSkill → Skill

Skill → SkillAlias
```

Requirements:

- CandidateProfile belongs to exactly one User.
- `userId` should be unique for CandidateProfile.
- CandidateSkill must prevent duplicates.
- Skill normalizedName should be unique.
- SkillAlias should be unique.
- Foreign keys should be correct.
- Use appropriate indexes.
- Use appropriate cascade behavior.

Do NOT alter existing MassMailer models unless required for compatibility.

---

# STEP 3 — VERIFY MIGRATION

Check:

```text
backend/prisma/migrations/
```

There must be a committed migration containing the Career Foundation schema changes.

If the migration is missing, create it using:

```bash
npx prisma migrate dev --name add_career_foundation
```

Do not modify existing migrations.

Run:

```bash
npx prisma generate
```

Then verify the schema works from a clean database.

Production migration command should be:

```bash
npx prisma migrate deploy
```

Do not use `db push` as the canonical production migration process.

---

# STEP 4 — FIX PDF DEPENDENCY

Inspect `resumeService.ts`.

If the implementation uses:

```text
pdf-parse
```

ensure it is explicitly declared in:

```text
backend/package.json
```

Install it properly and update:

```text
backend/package-lock.json
```

Verify:

```bash
npm install
npm run build
```

Do not leave undeclared runtime dependencies.

---

# STEP 5 — REGISTER CAREER ROUTES

Inspect:

```text
backend/src/server.ts
```

Make sure the Career routes are actually registered with Express.

Required API surface:

```http
GET    /api/career/profile
POST   /api/career/profile
PATCH  /api/career/profile

POST   /api/career/resumes
GET    /api/career/resumes
GET    /api/career/resumes/:id
DELETE /api/career/resumes/:id
POST   /api/career/resumes/:id/parse

GET    /api/career/skills
POST   /api/career/skills
DELETE /api/career/skills/:skillId
```

Use the existing authentication middleware.

Prefer authentication at the router level where appropriate rather than duplicating authentication logic inside every handler.

Do not accidentally create:

```text
/api/api/career
```

or duplicate `/career` prefixes.

After registering the routes, verify every endpoint actually resolves.

---

# STEP 6 — CANDIDATE PROFILE SECURITY

Review:

```text
candidate.ts
candidateService.ts
```

Every request must derive the user identity from the authenticated request.

Do NOT trust:

```text
userId
candidateId
```

from the client for authorization.

Correct ownership model:

```text
authenticated user
      ↓
CandidateProfile.userId
      ↓
owned resources
```

Verify that:

```text
User A cannot read User B profile.
User A cannot update User B profile.
User A cannot delete User B profile.
```

Use Zod for request validation.

---

# STEP 7 — RESUME SECURITY

Review all resume operations.

A resume must belong to:

```text
authenticated user
    ↓
candidate profile
    ↓
resume
```

Test that changing:

```text
/resumes/:id
```

to another user's resume ID results in an authorization failure.

Do not expose internal storage paths.

Do not use user-provided filenames directly as filesystem paths.

Use generated safe storage keys.

Maintain PDF-only validation and reasonable file-size limits.

---

# STEP 8 — RESUME API RESPONSE PRIVACY

Review:

```http
GET /api/career/resumes
GET /api/career/resumes/:id
```

Do NOT unnecessarily return:

```text
rawText
internal storage path
filesystem path
private internal metadata
```

unless the frontend genuinely requires it.

Use Prisma `select` or response DTOs.

The internal resume processing service may access rawText.

The public API should return only what the authenticated user interface needs.

---

# STEP 9 — RESUME ORIGINAL/VERSION MODEL

Preserve this rule:

```text
Original Resume
      ↓
NEVER OVERWRITE
```

The original upload must remain unchanged.

The system may create:

```text
Original
Optimized Resume A
Optimized Resume B
Optimized Resume C
```

later.

Do not implement optimization now.

Deleting the entire resume is acceptable if the existing product design supports it, but never overwrite the original content during parsing.

---

# STEP 10 — RESUME PARSING PIPELINE

Ensure the implementation follows:

```text
PDF
 ↓
Text extraction
 ↓
Raw text
 ↓
Gemini
 ↓
Structured JSON
 ↓
Zod validation
 ↓
Normalization
 ↓
Database
```

Do not call Gemini directly from route handlers.

Preferred structure:

```text
Route
 ↓
Resume Service
 ↓
Resume Parser
 ↓
Gemini Client
```

---

# STEP 11 — GEMINI CLIENT

Review:

```text
backend/src/services/ai/geminiClient.ts
```

It should centralize:

- API key
- model configuration
- timeout
- retry behavior
- transient errors
- response parsing
- Gemini errors

The API key must exist only on the backend.

Never expose:

```text
GEMINI_API_KEY
```

to frontend code.

Never hard-code credentials.

---

# STEP 12 — STRUCTURED RESUME DATA

Review the Zod schema.

It must support at least:

```text
headline
summary
skills
experience
education
projects
certifications
```

Experience should support:

```text
company
role
startDate
endDate
description
technologies
```

Education:

```text
institution
degree
field
startDate
endDate
```

Projects:

```text
name
description
technologies
url
```

Fields should be appropriately optional because resumes differ.

---

# STEP 13 — AI ANTI-HALLUCINATION

The parser must explicitly instruct Gemini:

Only extract information supported by the resume.

Never invent:

```text
employers
roles
dates
skills
technologies
achievements
certifications
education
```

If information is missing:

```text
null
[]
```

or the appropriate empty value.

Do not fabricate information to make a candidate look stronger.

---

# STEP 14 — SKILL NORMALIZATION

Review:

```text
skillService.ts
```

Ensure obvious aliases resolve to one canonical skill.

Examples:

```text
ReactJS
React.js
React JS
react

→ React
```

```text
NodeJS
Node.js
Node JS

→ Node.js
```

```text
NextJS
Next.js

→ Next.js
```

```text
TS
TypeScript

→ TypeScript
```

```text
JS
JavaScript

→ JavaScript
```

```text
Postgres
PostgreSQL

→ PostgreSQL
```

Do not create an enormous hardcoded dictionary.

Use the Skill + SkillAlias database design.

Unknown skills should still be stored safely without generating duplicates.

---

# STEP 15 — SKILL PERSISTENCE

Do not silently swallow skill persistence failures.

If multiple skills are being saved:

```text
skill 1
skill 2
skill 3
...
```

avoid a state where:

```text
Resume = PARSED
Profile = UPDATED
Skills = partially saved
```

without reporting the problem.

Prefer a Prisma transaction for related database writes after AI processing is complete.

IMPORTANT:

Do NOT keep a Prisma transaction open while calling Gemini.

Correct:

```text
Gemini
 ↓
validate
 ↓
prepare data
 ↓
BEGIN transaction
 ↓
update resume/profile/skills
 ↓
COMMIT
```

---

# STEP 16 — RESUME PARSE FAILURE STATES

Ensure the Resume status correctly reflects:

```text
UPLOADED
PROCESSING
PARSED
FAILED
```

If parsing fails:

```text
Resume → FAILED
```

Store a safe error representation if the current schema supports it.

Do not expose stack traces or secrets to the frontend.

The original uploaded file must remain available for retry.

---

# STEP 17 — FRONTEND

Inspect the existing frontend conventions.

Add or complete:

```text
/career
/career/profile
/career/resume
/career/skills
```

Do not change existing MassMailer pages unnecessarily.

Career dashboard should show:

```text
Career Intelligence

Resume
Uploaded / Not uploaded

Resume Status
Processing / Parsed / Failed

Profile
Complete / Needs Review

Skills
React
Next.js
TypeScript
Node.js
...
```

---

# STEP 18 — RESUME UPLOAD UI

Implement:

```text
Upload Resume
      ↓
Uploading
      ↓
Processing
      ↓
Parsed
      ↓
Review
```

Handle:

- invalid PDF
- oversized file
- upload failure
- parsing failure
- retry
- loading state
- success state

Do not make the UI assume parsing always succeeds.

---

# STEP 19 — PROFILE EDITING

Allow users to edit:

```text
headline
summary
location
preferredLocations
preferredRoles
remotePreference
salaryMin
salaryMax
noticePeriod
workAuthorization
yearsOfExperience
```

Do NOT infer the following from the resume unless explicitly present:

```text
salary
notice period
work authorization
preferred roles
preferred locations
```

AI-generated data must always be editable.

---

# STEP 20 — SKILLS UI

Display normalized skills.

Allow appropriate manual modification if consistent with the existing UI.

Example:

```text
Skills

React
Next.js
TypeScript
Node.js
PostgreSQL
Redis
Docker
```

Do not expose internal database IDs unnecessarily.

---

# STEP 21 — FRONTEND API LAYER

Follow the existing Axios architecture.

If consistent with the current codebase, use:

```text
frontend/lib/career/
├── candidateApi.ts
├── resumeApi.ts
└── skillsApi.ts
```

Avoid putting raw Axios calls throughout React components.

Reuse the existing authentication/token-refresh mechanism.

Do not create another authentication system.

---

# STEP 22 — TESTS

This is mandatory.

Add tests following the project's existing test conventions.

## Candidate API

Test:

```text
GET profile
POST profile
PATCH profile
unauthenticated request
invalid input
```

## Authorization

Test:

```text
User A → User A profile = allowed
User A → User B profile = denied

User A → User A resume = allowed
User A → User B resume = denied
```

## Resume

Test:

```text
valid PDF
invalid file type
oversized file
list resumes
get resume
delete resume
retry failed parse
```

## Resume Parser

Mock Gemini.

Test:

```text
valid Gemini response
invalid Gemini response
malformed JSON
missing optional fields
Gemini timeout
Gemini API failure
```

Do NOT make real Gemini calls from automated tests.

## Skills

Test:

```text
ReactJS → React
React.js → React
NodeJS → Node.js
NextJS → Next.js
TS → TypeScript
JS → JavaScript
Postgres → PostgreSQL
duplicate skill prevention
alias reuse
unknown skill handling
```

---

# STEP 23 — BUILD AND REGRESSION

Run:

```bash
npm install
npm run build
npm test
```

from the backend.

Run the frontend build/tests according to the existing project scripts.

Verify existing MassMailer functionality:

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
BullMQ workers
```

Do not change their behavior.

If an existing test fails because of your changes, fix the regression before reporting completion.

---

# STEP 24 — README

Update documentation accurately.

Document:

```text
Career Intelligence — Phase 1
```

Include:

```text
Candidate profile
Resume upload
PDF extraction
Gemini parsing
Zod validation
Skill normalization
Resume versions
```

Do NOT claim:

```text
Job scraping
Job matching
RAG
Auto-apply
Application automation
```

because those are future phases.

Change production database documentation to:

```bash
npx prisma migrate deploy
```

and development migration documentation to:

```bash
npx prisma migrate dev
```

Replace example secrets with obvious placeholders:

```env
JWT_SECRET="replace-with-a-long-random-secret"
JWT_REFRESH_SECRET="replace-with-a-different-long-random-secret"
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
GEMINI_API_KEY="your-gemini-api-key"
```

Never commit real credentials.

---

# STEP 25 — DO NOT OVER-ENGINEER

Do NOT add:

```text
Kafka
Celery
MongoDB
Pinecone
Kubernetes
microservices
Python service
LangChain
pgvector
Apify
Firecrawl
Playwright
```

unless something already exists and is required.

Phase 1 should remain:

```text
Next.js
Express
TypeScript
Prisma
PostgreSQL
Redis/BullMQ
Gemini
Zod
Docker
```

---

# PHASE 1 DEFINITION OF DONE

Do not report Phase 1 complete until:

### Database

- [ ] CandidateProfile
- [ ] Resume
- [ ] ResumeVersion
- [ ] Skill
- [ ] SkillAlias
- [ ] CandidateSkill
- [ ] Correct relationships
- [ ] Correct indexes
- [ ] Migration committed

### Backend

- [ ] Career routes registered
- [ ] Candidate APIs work
- [ ] Resume APIs work
- [ ] Skills APIs work
- [ ] Authentication enforced
- [ ] Authorization enforced
- [ ] PDF upload works
- [ ] PDF extraction works
- [ ] Gemini parsing works
- [ ] Zod validation works
- [ ] Skill normalization works
- [ ] Original resume preserved
- [ ] Parse failures handled
- [ ] API responses don't expose unnecessary private fields

### Frontend

- [ ] Career dashboard
- [ ] Resume upload
- [ ] Resume processing state
- [ ] Profile editing
- [ ] Skills display/editing
- [ ] Error handling

### Testing

- [ ] Candidate tests
- [ ] Resume tests
- [ ] Authorization tests
- [ ] Parser tests
- [ ] Skill tests
- [ ] Existing tests pass
- [ ] Build passes

### Security

- [ ] No real secrets committed
- [ ] Gemini key backend-only
- [ ] User ownership enforced
- [ ] File paths protected
- [ ] File size/type validation
- [ ] Raw resume text not unnecessarily exposed

### Regression

- [ ] Existing MassMailer features still work
- [ ] Existing email worker still works
- [ ] Existing authentication still works
- [ ] Existing SMTP functionality still works

---

# FINAL RESPONSE FORMAT

When you finish, respond with exactly these sections:

## 1. Summary

What was fixed.

## 2. Files Created

List every file.

## 3. Files Modified

List every file and why.

## 4. Database

List models, indexes, relationships and migration.

## 5. APIs

List all Career endpoints and their behavior.

## 6. Frontend

List new pages/components.

## 7. Security

List security/authorization changes.

## 8. Tests

List tests added and exact results.

## 9. Build

Report exact build/test results.

## 10. Regression

Report existing MassMailer functionality verified.

## 11. Remaining Issues

Be honest about anything still incomplete.

## 12. Phase 2 Readiness

Answer:

```text
PHASE 1 STATUS: COMPLETE
```

only if every mandatory requirement above passes.

Otherwise answer:

```text
PHASE 1 STATUS: NOT COMPLETE
```

and list exactly what remains.

Do not implement Phase 2.
