# MassMailer — Recruiter Outreach Platform

A production-ready full-stack application for sending personalized job application emails to recruiters **one recipient at a time** with AI-powered pitch generation, multi-SMTP rotation, automated follow-up sequences, and real-time open/click tracking.

## ✨ Features

- 📧 **1-to-1 Sending** — Each recruiter receives a completely separate email. No bulk `To:` fields, no `CC`/`BCC` exposure.
- 💼 **HR Contacts Directory** — Manage recruiter profiles (Name, Company, Email, Phone, Location, Notes, `createdBy`/`updatedBy`) and import them directly into campaigns.
- 📬 **Email Open & Click Tracking** — Real-time 1x1 GIF tracking pixel (`/api/track/open/:recipientId.png`) & link click redirects (`/api/track/click/:recipientId`) with live Open Rate (%) and CTR (%) metrics.
- 📚 **Reusable Templates Library** — Save, edit, preview, and load custom email templates directly inside the campaign composer.
- ✨ **AI Pitch Personalizer** — Generate high-converting cold email pitches powered by Google Gemini API with smart fallback engines across 4 tones (`professional`, `friendly`, `persuasive`, `confident`).
- ⏰ **Automated Follow-Up Sequences** — Schedule delayed follow-up jobs via BullMQ that automatically check recipient open status before sending.
- 🛡️ **Multi-SMTP Account Rotation & Health Shield** — Round-robin rotate sending across active SMTP accounts within daily safety limits, with automatic deactivation of failing servers.
- 📊 **Advanced Analytics & Visual Dashboard** — Interactive 14-day activity trend charts, comparative performance tables, and one-click CSV report exports.
- 📄 **Dummy CSV Template Download** — One-click download of standard reference CSV format directly inside the campaign creation wizard.
- 🔔 **SweetAlert2 UI Integration** — Dark glassmorphic toast notifications, dialogs, and confirmation prompts across all operations.
- 📊 **CSV Import & Auto-Mapping** — Upload recruiter CSVs with auto-detected header mapping and manual input validation.
- 📎 **File Attachments** — Attach PDF, DOC, DOCX, PNG, JPG, or ZIP documents (up to 10MB) to every email.
- 👁️ **Email Preview** — Instant visual preview of personalized emails per recipient prior to launching.
- ⚡ **Live Progress** — Real-time SSE progress stream while campaigns run.
- ⏸️ **Pause / Resume / Stop / Retry** — Full campaign lifecycle control and retry failed recipients.
- 🔒 **Enterprise-Grade Security** — JWT authentication, HTTP-only cookies, rate-limiting, CSRF protection, and XSS HTML sanitization.

---

## 🏗️ Architecture

```
Browser (Next.js 14)
      │
      ├─ REST API ──────────→ Express Backend (port 4000)
      │                              │
      ├─ SSE stream ─────────────────┼─ Prisma → PostgreSQL
      │                              ├─ BullMQ → Redis
      │                              ├─ Nodemailer → Multi-SMTP Rotation
      │                              └─ Gemini API → AI Pitch Generator
```

**Email Queue & Tracking Flow:**
```
Campaign Launch
   ↓
BullMQ Jobs Enqueued
   ↓
Worker selects active SMTP (Multi-SMTP Rotation)
   ↓
Inject 1x1 Tracking Pixel + Rewrite Link URLs
   ↓
Send email via Nodemailer → SMTP
   ↓
Update DB status & emit SSE event → Live UI update
   ↓
(Optional) Schedule delayed follow-up job if recipient hasn't opened
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, SweetAlert2 |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Queue | BullMQ + Redis |
| Email & Transport | Nodemailer (SMTP), Multi-SMTP Rotation |
| AI Integration | Google Gemini API (`@google/generativelanguage`) |
| Real-time | Server-Sent Events (SSE) |
| Auth | JWT + HTTP-only cookies |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (or Docker)
- Redis 7+ (or Docker)

### Option A: Docker (Recommended)

```bash
# Clone and enter directory
cd massmailer

# Copy env file
cp backend/.env.example backend/.env

# Start containers
docker compose up -d

# Run database migrations and seed default admin
docker exec massmailer-backend npx prisma migrate deploy
docker exec massmailer-backend npm run seed
```

### Option B: Manual Setup

**1. Start PostgreSQL and Redis:**
```bash
docker run -d -p 5433:5432 -e POSTGRES_DB=massmailer -e POSTGRES_USER=massmailer -e POSTGRES_PASSWORD=massmailer postgres:16-alpine
docker run -d -p 6379:6379 redis:7-alpine
```

**2. Backend Setup:**
```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, REDIS_URL, SMTP settings, GEMINI_API_KEY (optional)

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed         # Creates default admin user
npm run dev          # Runs on port 4000
```

**3. Frontend Setup:**
```bash
cd frontend
npm install
npm run dev          # Runs on port 3000
```

**4. Open** `http://localhost:3000`

---

## 🔐 Authentication

Default admin credentials (created via `npm run seed`):
- **Email:** `admin@massmailer.local`
- **Password:** `Admin@1234`

---

## 📧 Multi-SMTP & Single SMTP Setup

Edit `backend/.env` for default fallback SMTP:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx   # App Password
SMTP_FROM_EMAIL=your@gmail.com
SMTP_FROM_NAME=Your Name
```

> **Note:** You can also add and manage multiple SMTP servers dynamically from the **/settings** page in the web app! The system will round-robin rotate sending across active accounts and automatically disable failing credentials (Health Shield).

---

## 📡 API Reference

```
Authentication & System
POST   /api/auth/login               Login
POST   /api/auth/logout              Logout
GET    /api/auth/me                  Current user profile

HR Contacts Directory
GET    /api/hr-contacts              List HR contacts (with search/pagination)
POST   /api/hr-contacts              Create HR contact
PUT    /api/hr-contacts/:id          Update HR contact
DELETE /api/hr-contacts/:id          Delete HR contact
GET    /api/hr-contacts/export       Export contacts as CSV

Email Templates Library
GET    /api/templates                List user templates
POST   /api/templates                Create template
PUT    /api/templates/:id            Update template
DELETE /api/templates/:id            Delete template

AI Pitch Personalizer
POST   /api/ai/generate-pitch        Generate pitch via Gemini API / Fallback engine

Multi-SMTP Accounts
GET    /api/smtp-accounts            List SMTP accounts
POST   /api/smtp-accounts            Add SMTP account
PUT    /api/smtp-accounts/:id        Update SMTP account / Toggle active
DELETE /api/smtp-accounts/:id        Delete SMTP account
POST   /api/smtp-accounts/test       Test SMTP connection

Open & Click Tracking
GET    /api/track/open/:recipientId.png  1x1 Transparent open pixel
GET    /api/track/click/:recipientId      Link click redirect handler

Advanced Analytics
GET    /api/analytics                Aggregate stats, 14-day trend, campaign table

Campaign Lifecycle
POST   /api/campaigns                Create campaign
GET    /api/campaigns                List campaigns
GET    /api/campaigns/:id            Campaign details + recipients
POST   /api/campaigns/:id/start      Start sending queue
POST   /api/campaigns/:id/pause      Pause sending
POST   /api/campaigns/:id/resume     Resume sending
POST   /api/campaigns/:id/stop       Stop campaign
POST   /api/campaigns/:id/retry      Retry failed recipients
GET    /api/campaigns/:id/export     Export campaign results as CSV
GET    /api/campaigns/:id/progress   SSE live progress stream

Settings & Utility
GET    /api/settings                 Get user profile & sending limits
PUT    /api/settings                 Update user profile & sending limits
```

---

## 🔒 Security & Best Practices

- **1-to-1 Isolation:** Every email dispatched has exactly one recipient in the `To:` header.
- **Health Shield:** Failing or unauthorized SMTP servers are safely isolated automatically.
- **Sanitized HTML:** Email body inputs are sanitized to strip malicious script tags.
- **JWT Protection:** Authentication via secure HTTP-only cookies and Bearer tokens.
- **Rate Limiting:** Express rate limiting on auth and global API endpoints.

---

## 📁 Project Structure

```
massmailer/
├── frontend/                 # Next.js 14 Frontend
│   ├── app/
│   │   ├── (app)/           # Authenticated routes (with Sidebar layout)
│   │   │   ├── dashboard/   # High-level stats & quick campaign view
│   │   │   ├── campaigns/   # Campaign list, new wizard, & [id] detail page
│   │   │   ├── hr-contacts/ # HR Recruiter Directory CRUD page
│   │   │   ├── templates/   # Reusable Email Templates page
│   │   │   ├── analytics/   # Visual trend charts & analytics page
│   │   │   └── settings/    # Multi-SMTP & profile configuration
│   │   └── login/           # Glassmorphic Login page
│   ├── components/          # Sidebar, StatusBadge, SweetAlert2 helpers
│   └── lib/                 # API client, Auth context, types, swal
│
├── backend/                  # Express REST API & BullMQ Worker
│   ├── src/
│   │   ├── routes/          # API route modules (ai, analytics, hr-contacts, smtp, track, etc.)
│   │   ├── services/        # Email service, personalization, AI generator
│   │   ├── workers/         # BullMQ email sending & follow-up worker
│   │   ├── middleware/       # Auth, upload, rate-limiting
│   │   └── utils/           # JWT, SSE manager, HTML sanitizer
│   └── prisma/
│       └── schema.prisma    # PostgreSQL Prisma database schema
│
├── docker-compose.yml
└── README.md
```
