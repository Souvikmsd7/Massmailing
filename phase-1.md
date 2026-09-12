# MassMailer V2 — Phase 1: Career Intelligence Foundation

You are working on the existing **MassMailer**.

Your task is to implement **ONLY Phase 1 — Career Intelligence Foundation** in the existing project.

## IMPORTANT: Non-Negotiable Rules

1. **DO NOT rewrite or replace the existing MassMailer architecture.**
2. **DO NOT remove any existing features.**
3. **DO NOT break existing APIs, routes, database models, authentication, campaigns, SMTP, tracking, analytics, templates, contacts, follow-ups, or workers.**
4. **DO NOT create a separate application.**
5. Extend the existing backend/frontend architecture.
6. Reuse the existing:
   - PostgreSQL
   - Prisma
   - Redis
   - BullMQ
   - JWT authentication
   - Axios/API layer
   - Zod validation
   - Gemini integration where appropriate
   - Docker setup
   - Existing testing setup

7. Do not introduce unnecessary infrastructure.
8. Do NOT add LangChain, pgvector, Apify, Firecrawl, Playwright, job scraping, job matching, RAG, cover-letter generation, or auto-apply in this phase.
9. Do not invent candidate information or resume experience.
10. The original uploaded resume must always remain preserved and immutable.
11. Every new Career resource must be properly scoped to the authenticated user.
12. Follow the existing project's coding conventions after inspecting the repository.
13. Before modifying files, inspect the existing implementation and understand how it works.
14. Prefer small, additive changes over large refactors.
15. Do not refactor the existing email worker in this phase unless absolutely required for compatibility.

---

# Objective

Add a new **Career Intelligence foundation** to MassMailer.

Phase 1 should allow a user to:

1. Open Career Intelligence.
2. Create/update their candidate profile.
3. Upload a resume.
4. Extract text from the resume.
5. Parse the resume using Gemini.
6. Validate the AI output using Zod.
7. Normalize extracted skills.
8. Store the candidate profile, resume and skills in PostgreSQL.
9. View and edit the extracted information.
10. Preserve the original resume and allow future resume versions.

The final architecture should support future phases:

Candidate → Resume → Skills → Jobs → Matching → Optimization → Applications → MassMailer Outreach

But implement ONLY the first foundation in this phase.

---

# Step 0 — Audit Before Coding

Before making changes:

Inspect the actual repository and identify:

- Current `backend/src` structure
- Current `frontend/app` structure
- `backend/prisma/schema.prisma`
- Existing authentication middleware
- Existing Gemini/AI service
- Existing Axios/API abstraction
- Existing file upload implementation, if any
- Existing validation patterns
- Existing error handling
- Existing tests
- Existing environment configuration
- Existing database migration strategy

Do not assume the architecture from documentation alone.

Create a short internal implementation plan based on what actually exists.

Then implement the changes.

---

# Step 1 — Prisma Career Models

Add the following models to the existing Prisma schema.

## CandidateProfile

Represents the user's canonical professional profile.

Required conceptual fields:

- id
- userId
- headline
- summary
- location
- preferredLocations
- remotePreference
- preferredRoles
- salaryMin
- salaryMax
- noticePeriod
- workAuthorization
- yearsOfExperience
- createdAt
- updatedAt

Use appropriate nullable/optional fields.

Relationship:

User 1 → 1 CandidateProfile

Do not create another User model.

---

# Resume

Represents an uploaded resume.

Conceptual fields:

- id
- candidateId
- fileName
- fileType
- storageKey
- rawText
- parsedData
- status
- createdAt
- updatedAt

Status should support at least:

- UPLOADED
- PROCESSING
- PARSED
- FAILED

Use a suitable Prisma representation.

Important:

The actual PDF/file should NOT be stored directly in PostgreSQL.

Store the file using the project's existing storage mechanism if one exists.

If no storage abstraction exists, implement a small storage abstraction that supports local development without tightly coupling the Career domain to the filesystem.

Keep the stored `storageKey`/reference in the database.

Do not assume S3/R2 is required in Phase 1.

---

# ResumeVersion

Prepare the architecture for future job-specific resume optimization.

Conceptual fields:

- id
- resumeId
- name
- type
- content
- metadata
- createdAt

The original resume must never be overwritten.

Future versions will eventually represent job-specific optimized resumes.

Do not implement optimization yet.

---

# Skill

Canonical normalized skill.

Conceptual fields:

- id
- name
- normalizedName
- category
- createdAt

`normalizedName` should have appropriate uniqueness.

Example:

React
react
React.js
ReactJS
React JS

should eventually map to one canonical skill.

---

# SkillAlias

Maps aliases to canonical skills.

Conceptual fields:

- id
- skillId
- alias

Example:

Skill:
React

Aliases:

- React.js
- ReactJS
- React JS

---

# CandidateSkill

Many-to-many relationship between CandidateProfile and Skill.

Conceptual fields:

- candidateId
- skillId
- proficiency
- years
- source
- createdAt
- updatedAt

Use a composite unique constraint where appropriate.

`source` should allow us to distinguish information such as:

- RESUME
- MANUAL
- AI

Do not over-engineer this model.

---

# Prisma Requirements

Use proper:

- foreign keys
- indexes
- unique constraints
- cascade behavior where appropriate
- timestamps

Ensure existing Prisma models remain compatible.

Create a proper migration:

```bash
npx prisma migrate dev --name add_career_foundation
```

Then regenerate Prisma Client.

Do not use `db push` as the canonical schema migration mechanism for this feature.

---

# Step 2 — Career Backend Structure

Follow the existing project's architecture.

Do NOT reorganize the entire backend.

Add Career functionality using the existing route/service conventions.

Preferred conceptual structure:

backend/src/

```text
routes/
  career/
    candidate.ts
    resume.ts
    skills.ts

services/
  career/
    candidateService.ts
    resumeService.ts
    skillService.ts

services/
  ai/
    geminiClient.ts
    resumeParser.ts
    skillExtractor.ts
```

If the existing repository has a different convention, adapt to it rather than forcing this exact structure.

---

# Step 3 — Candidate APIs

Implement authenticated endpoints:

```http
GET    /api/career/profile
POST   /api/career/profile
PATCH  /api/career/profile
```

Requirements:

- Authentication required.
- Only the authenticated user can access their profile.
- Validate request bodies with Zod.
- Return consistent API responses following the existing project convention.
- Do not expose another user's candidate data.
- Handle missing profile gracefully.

---

# Step 4 — Resume APIs

Implement:

```http
POST   /api/career/resumes
GET    /api/career/resumes
GET    /api/career/resumes/:id
DELETE /api/career/resumes/:id
POST   /api/career/resumes/:id/parse
```

Requirements:

- Authentication required.
- Validate file type.
- Validate reasonable file size limits.
- Support PDF first.
- Do not trust the filename extension alone.
- Scope every resume query to the authenticated candidate/user.
- A user must never be able to access another user's resume by changing the ID.
- Preserve the original uploaded file.
- Do not overwrite an existing original resume.
- Return useful processing/error states.

---

# Step 5 — Resume Text Extraction

Implement a small extraction service.

Pipeline:

```text
PDF
 ↓
Text Extraction
 ↓
Raw Resume Text
 ↓
Gemini
 ↓
Structured Resume Data
 ↓
Zod Validation
 ↓
Normalization
 ↓
Database
```

Use an appropriate existing dependency if already installed.

If a PDF extraction library is required, add a minimal, well-maintained dependency.

Do not introduce Python/FastAPI for this phase unless the existing repository already requires it.

The goal is to keep the current Node.js backend architecture.

---

# Step 6 — Gemini Resume Parser

Create a reusable AI abstraction.

Conceptually:

```text
routes
  ↓
resumeService
  ↓
resumeParser
  ↓
geminiClient
  ↓
Gemini
```

Do NOT make the route directly call Gemini.

The Gemini client should centralize:

- model configuration
- API key handling
- timeout handling
- error handling
- retries where appropriate
- structured response handling

Use environment variables.

Never hard-code API keys.

---

# Step 7 — Structured Resume Data

Define a strict Zod schema for AI output.

At minimum support:

```text
headline
summary
skills
experience
education
projects
certifications
```

Experience should support information such as:

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

All fields should be appropriately optional because resumes vary.

Important:

The AI must NOT invent:

- employers
- job titles
- dates
- technologies
- achievements
- certifications
- education

If information is not present, return null/empty rather than inventing it.

---

# Step 8 — Skill Normalization

Implement deterministic normalization before relying heavily on AI.

Example:

```text
ReactJS
React.js
React JS
react

→ React
```

Similarly support obvious aliases such as:

```text
NextJS → Next.js
NodeJS → Node.js
TS → TypeScript
JS → JavaScript
Postgres → PostgreSQL
```

Do not create an enormous hardcoded dictionary.

Start with a maintainable alias mechanism using:

```text
Skill
SkillAlias
```

The system should:

1. Extract skills.
2. Normalize the names.
3. Find/create canonical Skill.
4. Create CandidateSkill.
5. Preserve the source.

Avoid duplicate skills for the same candidate.

---

# Step 9 — Candidate Profile Generation

After resume parsing:

```text
Resume
 ↓
Parsed Resume Data
 ↓
Candidate Profile
```

Populate the CandidateProfile only with information supported by the resume.

The user must be able to edit the generated profile afterward.

Do not automatically invent:

- salary
- notice period
- work authorization
- preferred location
- preferred roles

Those should remain user-entered unless explicitly provided in the resume.

---

# Step 10 — Frontend

Add a new Career Intelligence area without disturbing existing MassMailer pages.

Conceptual routes:

```text
/career
/career/profile
/career/resume
/career/skills
```

Follow the existing frontend routing/layout/component conventions.

---

# Career Dashboard

Create a simple dashboard showing:

```text
Career Intelligence

Resume
✓ Uploaded / Not uploaded

Profile
✓ Complete / Needs review

Skills
React
Next.js
TypeScript
Node.js
...

Resume Status
Parsed / Processing / Failed
```

Do not build the Jobs dashboard yet.

---

# Resume Upload UI

User flow:

```text
Career Intelligence
        ↓
Upload Resume
        ↓
Processing
        ↓
Resume Parsed
        ↓
Review Information
```

Support:

- PDF upload
- loading state
- processing state
- success state
- failure state
- retry
- validation errors

---

# Profile Editing UI

Display:

- headline
- summary
- location
- preferred locations
- preferred roles
- remote preference
- salary preference
- notice period
- work authorization
- experience

Allow the user to edit and save these values.

AI-generated information must be editable.

---

# Skills UI

Display normalized skills.

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

Allow manual addition/removal if this fits the existing UI conventions.

---

# Step 11 — API Client

Follow the existing frontend API architecture.

Prefer:

```text
frontend/lib/career/
  candidateApi.ts
  resumeApi.ts
  skillsApi.ts
```

if consistent with the repository.

Do not scatter raw Axios requests throughout React components.

---

# Step 12 — Security

Before considering Phase 1 complete, verify:

### Authentication

Every Career API requires authentication.

### Authorization

Verify ownership:

```text
authenticatedUser.id
        ↓
candidateProfile.userId
        ↓
resume.candidateId
```

Never trust a client-provided candidate ID.

### File upload

Protect against:

- unsupported file types
- oversized files
- malformed PDFs
- path traversal
- unsafe filenames

Do not use user-provided filenames as filesystem paths.

### AI

Never send secrets to Gemini.

Do not expose Gemini API keys to the frontend.

### Database

Use parameterized ORM operations through Prisma.

---

# Step 13 — Testing

Add tests following the existing testing conventions.

At minimum:

## Candidate

```text
GET profile
create profile
update profile
unauthorized access
```

## Resume

```text
upload valid PDF
reject invalid file
reject oversized file
list resumes
get own resume
reject another user's resume
delete own resume
```

## Skills

```text
normalize ReactJS → React
normalize React.js → React
avoid duplicate CandidateSkill
create canonical Skill
map aliases
```

## Resume parser

Test:

```text
valid Gemini output
invalid Gemini output
missing optional fields
malformed AI response
AI failure
```

Mock Gemini in tests.

Do not make real Gemini API calls from automated tests.

---

# Step 14 — Existing System Regression Check

After implementation, verify that existing functionality still works:

```text
Authentication
Campaign creation
Campaign execution
Email sending
SMTP selection
Tracking
Analytics
Templates
Contacts
Follow-ups
Existing BullMQ workers
```

Do not modify existing behavior unless necessary.

Run the existing test suite.

---

# Step 15 — Documentation

Update the README with a small section:

```text
## Career Intelligence

MassMailer now includes the foundation for an AI-powered Career Intelligence system.

Phase 1 supports:

- Candidate profile
- Resume upload
- Resume text extraction
- AI resume parsing
- Skill normalization
- Resume version foundation
```

Do not document features that have not been implemented.

Do not claim job scraping, auto-apply, RAG, or job matching yet.

---

# Phase 1 Definition of Done

Phase 1 is complete only when all of these are true:

- [ ] Existing MassMailer functionality still works.
- [ ] Prisma migration successfully applies.
- [ ] CandidateProfile exists.
- [ ] Resume exists.
- [ ] ResumeVersion exists.
- [ ] Skill exists.
- [ ] SkillAlias exists.
- [ ] CandidateSkill exists.
- [ ] Candidate APIs work.
- [ ] Resume upload works.
- [ ] PDF text extraction works.
- [ ] Gemini resume parsing works.
- [ ] Gemini output is validated using Zod.
- [ ] Skills are normalized.
- [ ] Candidate skills are stored.
- [ ] Original resume is preserved.
- [ ] User can review/edit extracted profile information.
- [ ] User ownership is enforced.
- [ ] File-upload security is implemented.
- [ ] Tests are added.
- [ ] Existing tests pass.
- [ ] README is updated accurately.
- [ ] No real secrets are introduced.
- [ ] No Phase 2+ functionality has been implemented.

---

# VERY IMPORTANT — Final Response Format

When you finish implementation, do NOT just say "done."

Report:

## 1. Files Created

List every new file.

## 2. Files Modified

List every modified file and explain why.

## 3. Database Changes

List every new Prisma model, relationship, index and migration.

## 4. API Endpoints

List every new endpoint.

## 5. Frontend Changes

List every new page/component/API client.

## 6. Tests

List tests added and their results.

## 7. Existing Functionality

Confirm what existing MassMailer functionality was verified.

## 8. Problems Encountered

List any implementation issues or compromises.

## 9. Phase 2 Recommendations

ONLY describe what should come next. Do not implement Phase 2.

The next phase will eventually be:

**Job Intelligence → Job discovery → normalization → deduplication → job storage.**

Do not implement it now.

---

# Final Principle

This is an evolution of MassMailer, not a rewrite.

The final product architecture should eventually become:

```text
                    MASSMAILER
                         │
          ┌──────────────┴──────────────┐
          │                             │
       OUTREACH                   CAREER INTELLIGENCE
          │                             │
    Campaigns                       Candidate
    Contacts                       Resume
    Templates                      Skills
    SMTP                            Jobs
    Tracking                        Matching
    Follow-ups                      Applications
          │                             │
          └──────────────┬──────────────┘
                         │
                  AI-Powered Workflow
                         │
          Discover → Match → Optimize
                         ↓
                     Apply
                         ↓
                    Outreach
                         ↓
                 Track → Follow Up
```

Build Phase 1 cleanly so that the later phases can be added without another architectural rewrite.
