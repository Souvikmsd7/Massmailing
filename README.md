# MassMailer — Recruiter Outreach Platform

A production-ready full-stack application for sending personalized job application emails to recruiters **one recipient at a time**.

## ✨ Features

- 📧 **1-to-1 Sending** — Each recruiter receives a completely separate email. No bulk To: fields, no CC/BCC exposure.
- 📊 **CSV Import** — Upload recruiter CSVs with auto-detected column mapping
- ✍️ **Manual Entry** — Paste comma/newline-separated email lists
- 🎨 **Personalization** — Dynamic `{{name}}`, `{{company}}`, `{{job_title}}` variable substitution
- 📎 **Resume Attachment** — Attach PDF/DOC/DOCX to every email
- 👁️ **Email Preview** — See exactly what each recruiter will receive before sending
- ⚡ **Live Progress** — Real-time SSE progress bar while campaign runs
- ⏸️ **Pause / Resume / Stop** — Full campaign lifecycle control
- 🔄 **Retry Failed** — Retry only failed recipients after campaign completes
- 📥 **CSV Export** — Export campaign results with per-recipient status
- 🔒 **Secure** — JWT auth, rate limiting, CSRF protection, input sanitization, no credential exposure

## 🏗️ Architecture

```
Browser (Next.js 14)
      │
      ├─ REST API ──────────→ Express Backend (port 4000)
      │                              │
      ├─ SSE stream ─────────────────┤
      │                              ├─ Prisma → PostgreSQL
      │                              ├─ BullMQ → Redis
      │                              └─ Nodemailer → SMTP
```

**Email Queue Flow:**
```
Campaign Start
   ↓
BullMQ Jobs (one per recipient)
   ↓
Worker picks up job
   ↓
Send email via Nodemailer → SMTP
   ↓
Update DB status
   ↓
Emit SSE event → Frontend updates live
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Queue | BullMQ + Redis |
| Email | Nodemailer (SMTP) |
| Real-time | Server-Sent Events (SSE) |
| Auth | JWT + HTTP-only cookies |

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (or Docker)
- Redis 7+ (or Docker)

### Option A: Docker (Recommended)

```bash
# Clone and go into the project
cd massmailer

# Copy env and fill in SMTP credentials
cp backend/.env.example backend/.env
# Edit backend/.env with your SMTP settings

# Start everything
docker compose up -d

# Run migrations and seed
docker exec massmailer-backend npx prisma migrate deploy
docker exec massmailer-backend npm run seed
```

### Option B: Manual

**1. Start PostgreSQL and Redis** (locally or via Docker):
```bash
docker run -d -p 5433:5432 -e POSTGRES_DB=massmailer -e POSTGRES_USER=massmailer -e POSTGRES_PASSWORD=massmailer postgres:16-alpine
docker run -d -p 6379:6379 redis:7-alpine
```

**2. Backend Setup:**
```bash
cd backend
cp .env.example .env
# Edit .env with your SMTP credentials

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed         # Creates admin user
npm run dev          # Starts on port 4000
```

**3. Frontend Setup:**
```bash
cd frontend
npm install
npm run dev          # Starts on port 3000
```

**4. Open** `http://localhost:3000`

## 🔐 Authentication

Default credentials (set in `backend/.env`):
- **Email:** `admin@massmailer.local`
- **Password:** `Admin@1234`

Change `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before seeding.

## 📧 SMTP Configuration

Edit `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com       # Gmail
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx   # App password (not account password)
SMTP_FROM_EMAIL=your@gmail.com
SMTP_FROM_NAME=Your Name
```

### Gmail Setup
1. Enable 2-Factor Authentication
2. Go to Google Account → Security → App Passwords
3. Generate an App Password for "Mail"
4. Use that password in `SMTP_PASSWORD`

## 🌍 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `SMTP_HOST` | SMTP server hostname | - |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASSWORD` | SMTP password | - |
| `SMTP_FROM_EMAIL` | From email address | - |
| `SMTP_FROM_NAME` | From display name | - |
| `JWT_SECRET` | JWT signing secret (change!) | - |
| `PORT` | Backend port | `4000` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `MAX_RECIPIENTS_PER_CAMPAIGN` | Safety limit | `500` |
| `EMAIL_BATCH_SIZE` | Emails per batch | `5` |
| `EMAIL_BATCH_DELAY` | Delay between batches (ms) | `10000` |
| `MAX_RETRIES` | Max retry attempts | `3` |

## 📡 API Reference

```
POST   /api/auth/login               Login
POST   /api/auth/logout              Logout
GET    /api/auth/me                  Current user

GET    /api/dashboard/stats          Dashboard statistics

POST   /api/campaigns                Create campaign
GET    /api/campaigns                List campaigns
GET    /api/campaigns/:id            Campaign details + recipients
POST   /api/campaigns/:id/start      Start sending
POST   /api/campaigns/:id/pause      Pause
POST   /api/campaigns/:id/resume     Resume
POST   /api/campaigns/:id/stop       Stop (cancels pending)
POST   /api/campaigns/:id/retry      Retry failed recipients
GET    /api/campaigns/:id/export     Export results as CSV
GET    /api/campaigns/:id/progress   SSE live progress stream

POST   /api/contacts/import          Upload and detect CSV headers
POST   /api/contacts/parse           Parse CSV with column mapping
POST   /api/contacts/validate        Validate manual email input

POST   /api/email/preview            Preview personalized email

GET    /api/settings                 Get settings
PUT    /api/settings                 Update settings
```

## 🧪 Testing

```bash
cd backend
npm test
```

Tests cover:
- CSV parsing (valid, invalid email, duplicates, missing columns)
- Personalization (variable replacement, missing variables, XSS sanitization)

## 🔒 Security

- **No bulk To:** Every `sendMail()` call has exactly one recipient in `to:`
- **JWT auth:** HTTP-only cookies + Authorization header
- **Rate limiting:** 200 req/15min globally, 10 req/15min for auth
- **Input validation:** Zod schemas on all API inputs
- **XSS protection:** Email HTML sanitized (script tags, event handlers stripped)
- **File validation:** Resume: PDF/DOC/DOCX only, max 10MB; CSV: max 5MB
- **No credential leakage:** SMTP credentials never sent to frontend
- **Helmet:** Security headers on all responses

## 📁 Project Structure

```
massmailer/
├── frontend/                 # Next.js 14 App
│   ├── app/
│   │   ├── (app)/           # Protected routes (with sidebar)
│   │   │   ├── dashboard/   # Dashboard page
│   │   │   ├── campaigns/   # Campaign list + new + [id] detail
│   │   │   └── settings/    # Settings page
│   │   └── login/           # Login page
│   ├── components/          # Shared components
│   └── lib/                 # API client, auth context, types
│
├── backend/                  # Express API
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Business logic
│   │   ├── workers/         # BullMQ email worker
│   │   ├── middleware/       # Auth, upload, rate-limit
│   │   └── utils/           # JWT, hash, SSE, sanitize
│   └── prisma/
│       └── schema.prisma    # Database schema
│
├── docker-compose.yml
└── README.md
```
