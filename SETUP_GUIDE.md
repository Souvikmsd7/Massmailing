# 🛠️ MassMailer — Complete Installation & Setup Guide

This guide provides step-by-step instructions for installing, configuring, deploying, and maintaining **MassMailer** locally or in production environments.

---

## 📋 System Prerequisites

Before starting, ensure your host environment meets the following requirements:

| Tool / Dependency | Recommended Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` or higher | Core Javascript/TypeScript runtime |
| **npm** | `v10.x` or higher | Package manager |
| **Docker & Docker Compose** | `v24.x+` / `v2.x+` | Containerized deployment (Option A) |
| **PostgreSQL** | `v15.x` or higher | Relational database (Option B) |
| **Redis** | `v7.x` or higher | Asynchronous queue & session store (Option B) |
| **Git** | `v2.x+` | Version control |

---

## 🔑 Environment Configuration

MassMailer uses environment variables to configure database connections, security keys, SMTP rotators, and AI integrations.

### 1. Backend Environment Setup (`backend/.env`)

Create or update the `.env` file inside the `backend/` directory:

```env
# Server Configuration
PORT=4000
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"

# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/massmailer?schema=public"

# Redis Queue Connection
REDIS_URL="redis://localhost:6379"

# Security & Authentication Secrets (Change in production!)
JWT_SECRET="e9a4f682c0b43171804b901cd99e3a6c5a089d7023ab84fe181c0021fa"
JWT_REFRESH_SECRET="c8712f518e910243b901a1e099b9087c5b1287e09923fa817a0981"

# AI Personalization (Google Gemini API Key)
# Get a free key at: https://aistudio.google.com/app/apikey
GEMINI_API_KEY="your-google-gemini-api-key-here"

# Default SMTP Settings (Fallback when no multi-SMTP provider is selected)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM_EMAIL="your-email@gmail.com"
SMTP_FROM_NAME="Your Name"

# Campaign Sending Safeguards
MAX_RECIPIENTS_PER_CAMPAIGN=500
EMAIL_BATCH_SIZE=5
EMAIL_BATCH_DELAY=10000
MAX_RETRIES=3
```

### 2. Frontend Environment Setup (`frontend/.env.local`)

Create or update the `.env.local` file inside the `frontend/` directory:

```env
# Public API Target Endpoint
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

---

## 🐳 Option A: Quick Start with Docker Compose (Recommended)

Docker Compose provisions and orchestrates PostgreSQL, Redis, backend worker services, and Next.js frontend automatically.

### 1. Start Services

From the project root directory:

```bash
# Clone repository (if not already done)
git clone https://github.com/Souvikmsd7/Massmailing.git
cd Massmailing

# Build images and start container suite in detached mode
docker compose up -d --build
```

### 2. Verify Running Containers

```bash
docker compose ps
```

You should see four active containers:
- `massmailer-postgres` (`5432`)
- `massmailer-redis` (`6379`)
- `massmailer-backend` (`4000`)
- `massmailer-frontend` (`3000`)

### 3. Verify System Health

```bash
# General application health
curl -s http://localhost:4000/api/health

# Readiness check (Verifies PostgreSQL & Redis connectivity)
curl -s http://localhost:4000/api/health/readiness
```

---

## 💻 Option B: Manual Local Development Setup

Follow this approach if you prefer running services directly on your host machine.

### 1. Start Database & Cache Services
Ensure local instances of **PostgreSQL** (port `5432`) and **Redis** (port `6379`) are running.

### 2. Setup Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Apply database migrations & generate Prisma client
npx prisma generate
npx prisma db push

# (Optional) Seed initial data
npm run seed

# Start backend development server (with hot reload)
npm run dev
```

The backend server will launch at `http://localhost:4000`.

### 3. Setup Frontend

Open a new terminal window:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Start Next.js development server
npm run dev
```

The frontend application will launch at `http://localhost:3000`.

---

## 🤖 Configuring Features

### 1. Setting up Multi-SMTP Accounts
1. Log into MassMailer at `http://localhost:3000`.
2. Navigate to **Settings** $\rightarrow$ **SMTP Accounts**.
3. Click **Add SMTP Account**.
4. Enter Host (`smtp.gmail.com`), Port (`587`), Username, and App Password.
5. Click **Test Connection** to verify provider health before enabling for campaign load balancing.

### 2. Obtaining Google Gemini AI Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create an API Key.
3. Add it to `backend/.env` under `GEMINI_API_KEY="..."`.
4. Restart the backend container/process.
5. In Campaign Composer, click **✨ AI Personalize Pitch** to test AI copy generation.

---

## 🧪 Running Automated Unit Tests

MassMailer includes Jest unit test suites for verifying campaign state machine transitions, SMTP error classification, CSV parsing, and personalization logic.

```bash
cd backend
npm test
```

---

## ❓ Troubleshooting & Common Issues

### 1. Port Conflicts (e.g. `Address already in use: 4000` or `5432`)
- **Fix**: Change `PORT=4001` in `backend/.env` or adjust host port mappings in `docker-compose.yml`.

### 2. Database Connection Error (`P1001: Can't reach database server`)
- **Fix**: Ensure PostgreSQL is running and `DATABASE_URL` credentials in `.env` match your database user/password. If running inside Docker, use `DATABASE_URL="postgresql://postgres:postgres@massmailer-postgres:5432/massmailer"`.

### 3. CORS Error on Frontend Requests
- **Fix**: Ensure `FRONTEND_URL` in `backend/.env` matches your browser URL (e.g. `http://localhost:3000`).

---

## 📁 Useful Maintenance Commands

```bash
# View backend Docker logs
docker compose logs -f backend

# Open Prisma Studio GUI (Interactive Database Viewer)
cd backend
npx prisma studio

# Rebuild containers from scratch
docker compose down -v
docker compose up -d --build
```
