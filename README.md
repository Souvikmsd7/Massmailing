# 📧 MassMailer — Production-Grade AI-Powered Cold Outreach Platform

[![Build & Tests](https://img.shields.io/badge/Tests-19%20Passed%20%7C%20Jest-brightgreen)](#-automated-testing)
[![Stack](https://img.shields.io/badge/Stack-Next.js%2016%20%7C%20Node.js%20%7C%20PostgreSQL%20%7C%20Redis-blue)](#technology-stack)
[![Security](https://img.shields.io/badge/Auth-Dual%20JWT%20Rotation%20%2B%20Family%20Revocation-green)](#-security--authentication)
[![Queue](https://img.shields.io/badge/Queue-BullMQ%20Idempotent%20Workers-orange)](#-queue--reliability-architecture)

MassMailer is an enterprise cold outreach and recruiter mailing web application engineered for reliability, delivery load distribution, AI pitch personalization, and granular engagement tracking.

---

## 🎯 Architecture Overview

```text
Next.js 16 Frontend (React 19 / Tailwind / Axios Queue Interceptor)
        │
        ▼ (HTTP / HttpOnly SameSite Cookies)
Express API Backend (TypeScript / Zod Validation / Logger / AppError)
        ├──► PostgreSQL (Prisma ORM with composite indexes & RefreshToken family revocation)
        ├──► Redis & BullMQ Queue (Job scheduling with exponential backoff)
        └──► Google Gemini 1.5 Flash API (AI pitch personalization with 8s timeout fallback)
        │
        ▼ (Asynchronous Decoupled Execution)
BullMQ Email Worker Processes
        └──► Multi-SMTP Load Balancer & Health Shield (Provider state: ACTIVE/DEGRADED/DISABLED)
```

---

## 🔄 Campaign State Machine

Campaigns adhere to a strict state machine lifecycle preventing invalid state transitions or duplicate dispatches:

```text
                 ┌──────────┐
                 │  DRAFT   │
                 └────┬─────┘
                      │
                      ▼
               ┌──────────────┐
               │  PROCESSING  │◄────────────┐
               └──────┬───────┘             │
                      │                     │
          ┌───────────┼───────────┐         │ (Resume / Retry)
          │           │           │         │
          ▼           ▼           ▼         │
    ┌──────────┐ ┌──────────┐ ┌───────────┐ │
    │  PAUSED  │ │COMPLETED │ │ CANCELLED │ │
    └────┬─────┘ └──────────┘ └───────────┘ │
         │                                  │
         └──────────────────────────────────┘
```

| State Transition | Description |
| :--- | :--- |
| `DRAFT` $\rightarrow$ `PROCESSING` | Campaign is initialized and jobs are enqueued into BullMQ. |
| `PROCESSING` $\rightarrow$ `PAUSED` | Active dispatch is suspended. Workers check state and throw soft errors to hold remaining jobs. |
| `PAUSED` $\rightarrow$ `PROCESSING` | Resumes queueing only unsent recipients (`PENDING` or `QUEUED`). |
| `PROCESSING` $\rightarrow$ `CANCELLED` | Halts execution, drains remaining queue jobs, marks unsent recipients as `CANCELLED`. |
| `PROCESSING` $\rightarrow$ `COMPLETED` | Automatically triggered when all recipients have been processed. |
| `FAILED` $\rightarrow$ `PROCESSING` | Retries failed recipients whose retry count is under maximum configured retries. |

---

## 🔐 Security & Authentication

- **Dual Token Architecture**: Short-lived Access Token (15 min) paired with long-lived Refresh Token (7 days).
- **Token Rotation & Revocation**: Refresh tokens belong to a session family. Refreshing issues a new rotated token and revokes the old hash in PostgreSQL.
- **Replay Protection**: If a revoked token is presented (indicating potential token theft), the entire token family is immediately revoked, forcing re-authentication.
- **HttpOnly Cookies**: Cookies are scoped with `HttpOnly`, `SameSite=Lax`, and `Secure` (in production) to protect against XSS token exfiltration.
- **Input Hardening**: CSV formula injection prevention (prepending `'` to fields starting with `=`, `+`, `-`, `@`), UUID format enforcement on tracking endpoints, and open redirect URL validation.

---

## 🛡️ Provider-Aware SMTP Sending & Health Shield

- **Health Status Evaluation**: Classifies SMTP errors as **TEMPORARY** (network timeout, rate limit 421) vs **PERMANENT** (invalid credentials, 550 user not found).
- **Health Shield**: SMTP accounts experiencing repeated failures transition from `ACTIVE` $\rightarrow$ `DEGRADED` $\rightarrow$ `DISABLED`.
- **Auto-Recovery**: Disabled providers undergo automatic health checks and recover after a 15-minute cooldown.

---

## 🧪 Automated Testing

Unit and integration tests cover critical business logic using Jest:

```bash
cd backend
npm test
```

### Verified Test Suites:
- ✅ **Campaign State Machine**: Validates all permitted transitions and ensures invalid transitions throw `ConflictError`.
- ✅ **SMTP Error Classifier**: Tests classification of permanent vs temporary delivery errors.
- ✅ **Personalization Engine**: Validates variable substitution (`{{name}}`, `{{company}}`).
- ✅ **CSV Parsing Service**: Tests header auto-detection, case-insensitive email deduplication, and invalid format handling.

---

## 🚀 Quick Setup & Deployment

> 📖 **Full Installation & Configuration Guide**: See [SETUP_GUIDE.md](file:///d:/massmailer/SETUP_GUIDE.md) for detailed step-by-step instructions, environment variables, multi-SMTP configuration, and troubleshooting.

### Prerequisites
- Node.js 20+
- PostgreSQL
- Redis Server
- Docker & Docker Compose (optional for production containerized deployment)

### 1. Run Locally with Docker Compose

```bash
# Clone the repository
git clone https://github.com/Souvikmsd7/Massmailing.git
cd Massmailing

# Start PostgreSQL, Redis, Backend, and Frontend containers
docker compose up -d --build

# Access Applications:
# Frontend: http://localhost:3000
# Backend Health: http://localhost:4000/api/health
# Backend Readiness: http://localhost:4000/api/health/readiness
```

### 2. Manual Development Setup

#### Backend:
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev   # Development: runs pending migrations and generates client
npm run dev
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ Environment Variables

### Backend `.env`:
```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/massmailer"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="super-secret-jwt-key"
JWT_REFRESH_SECRET="super-secret-refresh-key"
FRONTEND_URL="http://localhost:3000"
GEMINI_API_KEY="your-google-gemini-api-key"
```

### Frontend `.env.local`:
```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

---

## 🧠 Career Intelligence

MassMailer now includes the foundation for an AI-powered Career Intelligence system.

**Phase 1 supports:**

- Candidate profile (headline, summary, location, salary preferences, notice period, work authorization)
- Resume upload (PDF only, 10MB max, MIME-type validated)
- Resume text extraction (via `pdf-parse`)
- AI resume parsing (Google Gemini, output validated with Zod)
- Skill normalization (ReactJS → React, NodeJS → Node.js, etc.)
- Candidate skills storage (RESUME / MANUAL / AI source tracking)
- Resume version foundation (original preserved, future optimization supported)

**Frontend pages:**
- `/career` — Career Intelligence dashboard
- `/career/resume` — Upload, parse, and manage resumes
- `/career/profile` — Edit candidate profile (pre-populated by AI)
- `/career/skills` — View, add, and remove normalized skills

**Architecture:**
```text
Resume Upload
      ↓
Text Extraction (pdf-parse)
      ↓
Gemini AI (resumeParser)
      ↓
Zod Validation (ParsedResumeSchema)
      ↓
Skill Normalization + CandidateSkill upsert
      ↓
CandidateProfile update
      ↓
PostgreSQL
```

> Note: Job scraping, auto-apply, job matching, RAG, and cover-letter generation are not implemented in Phase 1.
