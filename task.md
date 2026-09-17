# PHASE 3 CORRECTION — REQUIRED FIXES

The current Phase 3 implementation has been audited.

Do NOT rewrite Phase 3.

Do NOT start Phase 4.

Make only the following targeted corrections.

## BLOCKER 1 — IMPLEMENT REAL POSTGRESQL PGVECTOR

Current implementation stores embeddings as:

```prisma
embedding Float[]
```

and calculates cosine similarity inside Node.js.

This does NOT satisfy the Phase 3 requirement for PostgreSQL-native vector similarity.

### Required

Inspect the existing PostgreSQL/Docker setup.

Implement pgvector properly.

The database migration should:

1. Enable the PostgreSQL vector extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

2. Store embeddings in a PostgreSQL `vector(768)` column or the exact dimension returned by the configured embedding model.

3. Keep Prisma compatibility.

If Prisma does not natively represent the vector type in the current setup, use the appropriate unsupported/raw SQL approach rather than replacing pgvector with Float[].

4. Implement PostgreSQL cosine similarity using vector operators, e.g. `<=>`, rather than calculating the similarity entirely in Node.js.

5. Add an appropriate vector index if practical for the current dataset.

For example, an HNSW cosine index may be appropriate:

```sql
CREATE INDEX ...
ON ...
USING hnsw (embedding vector_cosine_ops);
```

Only use this if supported by the project's PostgreSQL/pgvector version.

6. Do not expose embeddings through APIs.

7. Keep the existing content-hash caching behavior.

8. Do not introduce a separate vector database.

9. Do not introduce LangChain.

### Important

The current embedding provider may return 768-dimensional embeddings.

Verify the actual configured embedding dimension instead of blindly assuming it.

The migration and runtime representation must agree.

---

# BLOCKER 2 — HARD FILTER ELIGIBILITY GATE

Current implementation calculates:

```text
hardFilterScore
skillScore
semanticScore
overallScore
```

even if a hard eligibility requirement fails.

This can make an ineligible candidate appear to have a high overall match.

Correct the matching semantics.

### Required behavior

Pipeline:

```text
Candidate
   ↓
Hard Filters
   ↓
Eligible?
 ┌─┴──────────┐
NO            YES
↓              ↓
INELIGIBLE     Skill Matching
               ↓
          Semantic Matching
               ↓
          Overall Score
```

A failed hard filter must be clearly represented.

Do not allow a high skill/semantic score to override a failed hard eligibility requirement.

You may still calculate skill/semantic diagnostics if useful, but the final match state must clearly identify the candidate as ineligible.

Use an explicit field if necessary, such as:

```text
eligible
```

or a suitable match status/reason.

Do NOT invent a new business rule that was not requested.

Document the exact behavior.

---

# BLOCKER 3 — VERIFY SKILL ALIAS ARCHITECTURE

Inspect Phase 1:

- Skill
- SkillAlias
- CandidateSkill
- normalizeSkillName()

The current Phase 3 skill matcher primarily compares normalized names and does not clearly consume the SkillAlias table.

Determine how SkillAlias was intended to work.

If SkillAlias is database-backed canonicalization infrastructure, use it appropriately.

If normalizeSkillName() is intentionally the canonical source and SkillAlias is only used during ingestion/profile normalization, document that explicitly.

Do not create duplicate alias systems.

Required matching behavior remains:

```text
ReactJS
React.js
React JS
react

→ React
```

and:

```text
Postgres
PostgreSQL

→ PostgreSQL
```

Matching must remain deterministic.

---

# TESTS REQUIRED

Add/update tests for:

## pgvector

- embedding stored correctly
- embedding dimensions validated
- cosine similarity works through PostgreSQL
- existing embedding reused when content hash is unchanged
- stale content causes regeneration
- vector similarity does not leak embedding data

## Hard filters

Test:

1. eligible candidate
2. location mismatch
3. remote mismatch
4. salary mismatch where configured
5. multiple failed filters
6. ineligible candidate cannot appear as a normal eligible match

## Skill aliases

Test:

1. exact match
2. canonical normalized match
3. alias match
4. missing skill
5. duplicate job skills
6. zero job skills

## Regression

Run:

```bash
cd backend

npx prisma format
npx prisma generate
npx prisma migrate status
npm test
npm run build
```

Then:

```bash
cd ../frontend

npm run lint
npm run build
```

Do not add a frontend testing framework if one does not already exist.

---

# DATABASE SAFETY

Before changing migrations:

- inspect existing migrations
- do not modify already-applied migration files
- create a new migration
- preserve Phase 1 and Phase 2 migrations

Verify:

```bash
npx prisma migrate status
```

Do not use `prisma db push` as a substitute for the production migration.

---

# PHASE BOUNDARY

DO NOT implement:

- auto apply
- Playwright
- RAG
- LangChain
- resume optimization
- cover letters
- recruiter outreach
- application submission

---

# FINAL REPORT

Do not claim Phase 3 complete unless all three corrections are implemented and verified.

Report:

```text
PHASE 3 CORRECTION STATUS: COMPLETE
```

only when:

- real pgvector is implemented
- PostgreSQL vector similarity works
- hard eligibility is correctly enforced
- skill alias architecture is verified
- tests pass
- backend build passes
- Prisma migration status is clean
- frontend lint/build passes

Otherwise report:

```text
PHASE 3 CORRECTION STATUS: BLOCKED
```

with the exact remaining blocker.

Do not modify unrelated MassMailer functionality.
