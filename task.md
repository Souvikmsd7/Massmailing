# Phase 3 — Small Targeted Correction Only

We are fixing the remaining issues in the Job Matching Engine from the current implementation.

**Do NOT start Phase 4. Do NOT add RAG, resume optimization, Playwright, auto-apply, cover letters, LangChain, or any unrelated refactoring.**

## 1. Make pgvector failure explicit

Current problem:

- `embeddingService.ts` writes to both `Float[]` and `vector(768)`.
- The pgvector write currently catches and silently ignores errors.
- `semanticMatchService.ts` also silently falls back to Node cosine similarity when pgvector fails.

This can make the system appear to use pgvector while actually using the old in-memory cosine calculation.

### Required fix

Add an explicit configuration flag, for example:

```env
ENABLE_PGVECTOR=true
```

Behavior:

### When `ENABLE_PGVECTOR=true`

- pgvector must be mandatory.
- Failure to write the `vector(768)` value must throw/log a real error.
- Failure of the PostgreSQL `<=>` similarity query must throw/log a real error.
- Do NOT silently fall back to Node cosine similarity.

### When `ENABLE_PGVECTOR=false`

- Explicitly allow the existing `Float[]` + Node cosine fallback for local/offline tests if needed.

Make the behavior clear in code and README/config documentation.

Do not remove pgvector support.

---

## 2. Add one real pgvector integration test

The existing semantic tests may only test the calculation logic and do not prove that PostgreSQL pgvector actually works.

Add a focused integration test that runs against PostgreSQL with pgvector enabled.

The test should:

1. Create/store a candidate embedding.
2. Create/store a job embedding.
3. Ensure the `vector` column is populated.
4. Call the real `calculatePgVectorSimilarity(candidateId, jobId)`.
5. Verify PostgreSQL `<=>` is actually executed successfully.
6. Verify the returned similarity is numeric and within the expected range.

Use a deterministic small example such as identical vectors producing approximately `1.0`.

Do not replace the existing unit tests.

If the repository's test environment cannot run PostgreSQL integration tests automatically, document the required database setup clearly and ensure the test is skipped/fails explicitly rather than falsely passing.

---

## 3. Fix SkillAlias error swallowing

In `skillMatchService.ts`, there is currently behavior equivalent to:

```ts
skillAlias.findMany(...).catch(() => [])
```

Remove this silent fallback.

A database failure must NOT be interpreted as "there are no aliases."

Required behavior:

- Successful query → use aliases.
- Database/query failure → propagate the error or handle it explicitly with an appropriate error.
- Do not silently convert infrastructure failures into a valid zero-alias result.

Keep the existing EXACT and ALIAS matching behavior unchanged.

---

## 4. Migration HNSW handling

Review the HNSW index creation in:

```text
20260917100000_add_pgvector_matching/migration.sql
```

It currently catches all exceptions and ignores them.

Prefer making migration/index failures visible.

Do not redesign the migration. Just avoid silently hiding a broken pgvector index creation.

If there is a legitimate compatibility reason for conditional index creation, add a clear comment explaining it.

---

## 5. Preserve current Phase 3 behavior

Do NOT change:

- Hard-filter eligibility gate
- 30% hard filters / 45% skills / 25% semantic weighting
- EXACT / ALIAS skill matching
- Gemini explanation architecture
- JobMatch persistence
- Candidate/Job models
- Phase 1 resume functionality
- Phase 2 job discovery/ingestion
- Existing MassMailer functionality

Gemini must remain explanatory only; it must not determine the match score.

---

## 6. Tests and verification

Run:

```bash
cd backend

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

Do NOT add a frontend testing framework merely because there is no `npm test` script.

Also inspect:

```bash
git diff
git status
```

Confirm there are:

- no secrets
- no personal resume files
- no unrelated refactoring
- no Phase 4 implementation

## Final report

Report:

```text
PHASE 3 TARGETED CORRECTION STATUS: COMPLETE
```

only if all required corrections and verification pass.

Otherwise report:

```text
PHASE 3 TARGETED CORRECTION STATUS: BLOCKED
```

and list the exact remaining issue.

Include:

- files changed
- pgvector configuration behavior
- integration test result
- SkillAlias error handling result
- migration/index result
- backend test/build result
- frontend lint/build result
- git diff/status summary

Keep this change **small and targeted**. Do not perform unrelated cleanup or architectural refactoring.
