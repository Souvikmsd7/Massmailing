# MassMailer — Production Readiness & Architecture Upgrade

You are working on my existing **MassMailer** application, an AI-powered outreach automation platform.

## Existing Stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL + Prisma
- Queue: Redis + BullMQ
- AI: Google Gemini API
- Authentication: JWT access + refresh tokens
- Email: Multiple SMTP providers
- Deployment: Docker + Docker Compose

## Important Instructions

**Do NOT rewrite the project from scratch.**

First inspect the entire existing codebase and understand:

- folder structure
- database schema
- authentication flow
- campaign creation flow
- email sending flow
- BullMQ implementation
- SMTP configuration
- tracking implementation
- frontend API architecture
- existing error handling
- Docker configuration

Reuse the existing architecture wherever possible.

Before modifying anything, identify the files/components that need changes and explain the implementation plan.

Then implement the following improvements incrementally.

---

# 1. Production-Grade Authentication

Review the current JWT implementation.

Implement a secure browser authentication architecture.

Requirements:

- Short-lived access token
- Refresh-token rotation
- Refresh-token expiration
- Secure token storage
- HttpOnly cookies where appropriate
- Secure/SameSite cookie configuration
- Proper CSRF protection where cookie-based authentication is used
- Never expose sensitive refresh tokens unnecessarily to JavaScript
- Proper logout/invalidation
- Refresh-token revocation
- Protection against token replay
- Server-side authentication middleware
- Authorization middleware for protected resources
- Consistent 401/403 responses

Review the current Axios interceptor.

The interceptor should:

- Detect 401 responses
- Perform only one refresh request when multiple requests fail simultaneously
- Queue pending requests
- Retry them after successful refresh
- Reject all queued requests if refresh fails
- Avoid infinite refresh loops

Do not claim that HttpOnly cookies alone provide complete XSS/CSRF protection.

Add appropriate security comments/documentation.

---

# 2. Campaign State Machine

Introduce a robust campaign lifecycle.

Recommended states:

```text
DRAFT
SCHEDULED
PROCESSING
PAUSED
COMPLETED
CANCELLED
FAILED
```

Use a database enum if appropriate.

Implement valid state transitions.

Example:

```text
DRAFT → SCHEDULED
DRAFT → PROCESSING

SCHEDULED → PROCESSING
SCHEDULED → CANCELLED

PROCESSING → PAUSED
PROCESSING → COMPLETED
PROCESSING → FAILED
PROCESSING → CANCELLED

PAUSED → PROCESSING
PAUSED → CANCELLED
```

Prevent invalid transitions.

Create backend service methods such as:

```text
createCampaign()
scheduleCampaign()
startCampaign()
pauseCampaign()
resumeCampaign()
cancelCampaign()
completeCampaign()
failCampaign()
```

The frontend should display the current campaign state clearly.

---

# 3. Reliable BullMQ Email Processing

Review the current email queue implementation and make it production-ready.

Requirements:

- Separate campaign/job creation from email delivery
- API request should NOT wait for bulk email sending
- Use BullMQ workers for asynchronous processing
- Configure controlled concurrency
- Configure retry attempts
- Use exponential backoff
- Track job status
- Track failed jobs
- Prevent duplicate email sending
- Make jobs idempotent
- Handle worker crashes safely
- Gracefully handle Redis failures
- Gracefully handle SMTP failures
- Persist important delivery state in PostgreSQL

Each email recipient/job should have a durable status.

For example:

```text
PENDING
QUEUED
PROCESSING
SENT
FAILED
BOUNCED
CANCELLED
```

A worker must check the current recipient/email status before sending so that retries do not accidentally send duplicate emails.

---

# 4. Pause / Resume / Cancel Campaigns

Implement real campaign controls.

### Pause

When a campaign is paused:

- Do not enqueue new recipients
- Existing active jobs should finish safely where practical
- Workers must check campaign state before sending
- Future scheduled jobs should not send while paused

### Resume

When resumed:

- Continue from remaining recipients
- Do not resend successfully sent recipients
- Requeue only eligible recipients

### Cancel

When cancelled:

- Prevent future sends
- Mark remaining unsent recipients as cancelled
- Do not modify already-sent records

### Retry Failed

Add the ability to retry failed recipients selectively.

Only retry eligible failures.

Do not retry permanent failures indefinitely.

---

# 5. Provider-Aware SMTP Sending

Review the current multi-SMTP implementation.

Do NOT position SMTP rotation as a way to bypass provider restrictions, spam filters, or provider limits.

Instead implement it as:

> Provider-aware load distribution and reliability management.

Requirements:

- Provider health status
- Connection validation
- Per-provider sending limits
- Configurable concurrency
- Retry/backoff
- Temporary vs permanent SMTP error classification
- Provider failure isolation
- Automatic temporary disablement after repeated failures
- Recovery/health checks
- Round-robin or weighted provider selection
- Avoid selecting unhealthy providers

Example provider states:

```text
ACTIVE
DEGRADED
DISABLED
```

Add configuration so limits can be changed without modifying application code.

---

# 6. Observability & Logging

Introduce structured logging across the backend and workers.

Every important operation should include useful identifiers such as:

```text
requestId
userId
campaignId
recipientId
jobId
providerId
```

Log:

- API requests
- authentication failures
- campaign state changes
- queue events
- worker processing
- SMTP attempts
- SMTP failures
- retries
- tracking events
- database errors
- unexpected exceptions

Do NOT log:

- passwords
- JWT secrets
- refresh tokens
- SMTP passwords
- API keys
- full email contents unnecessarily

Create consistent log levels:

```text
DEBUG
INFO
WARN
ERROR
```

---

# 7. Health & Readiness Endpoints

Implement health checks.

Example:

```text
GET /api/health
GET /api/health/readiness
```

Health should report application status.

Readiness should verify required dependencies such as:

- PostgreSQL
- Redis

Do not expose secrets or sensitive infrastructure information.

Use appropriate HTTP status codes.

Example:

```json
{
  "status": "ok",
  "services": {
    "database": "healthy",
    "redis": "healthy"
  }
}
```

---

# 8. Better Error Handling

Create centralized backend error handling.

Use consistent API responses.

Example:

```json
{
  "success": false,
  "error": {
    "code": "CAMPAIGN_NOT_ACTIVE",
    "message": "Campaign cannot be resumed from its current state."
  }
}
```

Implement:

- custom application errors
- Zod validation errors
- authentication errors
- authorization errors
- database errors
- queue errors
- SMTP errors
- unknown errors

Do not expose stack traces in production responses.

---

# 9. Database Improvements

Review the Prisma schema.

Add appropriate indexes for frequently queried fields.

Pay particular attention to:

- userId
- campaignId
- recipientId
- campaign status
- recipient status
- createdAt
- scheduledAt
- providerId

Review relations and cascading behavior.

Prevent accidental orphan records.

Use transactions where multiple related database updates must remain consistent.

Examples:

- campaign state + job creation
- recipient status + delivery record
- refresh-token rotation

Avoid unnecessary database queries inside worker loops.

Use batching/pagination where appropriate.

---

# 10. Campaign Progress Tracking

Add real-time campaign progress.

Track:

```text
totalRecipients
queued
processing
sent
failed
bounced
opened
clicked
cancelled
```

Calculate progress safely.

Example:

```text
1,250 / 5,000 recipients processed
25%
```

The dashboard should update without requiring a full page reload.

Use the existing architecture where possible.

If WebSockets/SSE are already present, improve them.

Otherwise use an appropriate lightweight polling strategy first rather than introducing unnecessary infrastructure.

---

# 11. Tracking Improvements

Review open and click tracking.

Keep the existing functionality but make it reliable and privacy-conscious.

For open tracking:

```text
/api/track/open/:recipientId
```

For click tracking:

```text
/api/track/click/:recipientId
```

Validate tracking identifiers.

Prevent malformed redirect URLs.

Do not create open/click events repeatedly for the same request without reason.

Track useful metadata where appropriate, but avoid unnecessary personal information.

Document that open tracking is inherently imperfect because email clients may:

- block images
- proxy images
- prefetch images
- cache images

Therefore do not describe opens as guaranteed exact human reads.

---

# 12. AI Personalization Reliability

Review the Gemini integration.

Implement:

- input validation
- reasonable input length limits
- timeout handling
- retry handling for transient failures
- rate-limit handling
- graceful failure
- structured output validation
- safe fallback when AI generation fails

Do not block the entire campaign because one AI personalization request failed.

Where appropriate:

```text
AI generation failure
        ↓
fallback template
        ↓
continue campaign
```

Store only the AI-generated data that is actually required.

---

# 13. Security Review

Perform a basic security audit of the existing application.

Check:

- authentication
- authorization
- IDOR vulnerabilities
- SQL/Prisma query safety
- XSS
- CSRF
- CORS
- rate limiting
- request body limits
- file upload validation
- CSV import validation
- SSRF risks
- open redirect risks
- URL validation
- sensitive environment variables
- password hashing
- cookie configuration
- security headers

Add reasonable protections without overengineering.

For CSV imports:

- validate file type
- limit file size
- validate columns
- sanitize imported values
- reject malformed records
- avoid unsafe formula injection when exporting CSV

---

# 14. Docker & Production Configuration

Review Docker configuration.

Use production-friendly practices:

- multi-stage builds
- non-root containers where practical
- minimal runtime dependencies
- health checks
- environment-based configuration
- no secrets inside images
- proper service dependencies
- separate development and production concerns

Do NOT claim specific memory usage unless it has actually been benchmarked.

---

# 15. Automated Testing

Add or improve tests for the critical business logic.

Prioritize:

### Authentication

- login
- refresh
- logout
- expired token
- revoked refresh token

### Campaign

- valid state transitions
- invalid state transitions
- pause
- resume
- cancellation

### Queue

- job retry
- idempotency
- duplicate prevention
- failure handling

### SMTP

- provider selection
- unhealthy provider exclusion
- temporary failure
- permanent failure

### Tracking

- open tracking
- click tracking
- invalid tracking ID
- unsafe redirect URL

Use the testing framework already present in the repository. If none exists, choose a lightweight TypeScript-compatible testing setup appropriate for the existing project.

---

# 16. README Rewrite

After implementation, rewrite the README so it accurately describes the system.

Do NOT make exaggerated claims.

Remove or reword unsupported claims such as:

- guaranteed spam prevention
- guaranteed domain reputation protection
- exact open rates
- guaranteed conversion improvements
- unverified performance numbers
- unverified memory usage
- unverified sub-second latency
- unverified 10,000+ recipient benchmarks

Instead describe measurable engineering capabilities.

The README should contain:

## Overview

What MassMailer is.

## Problem

The problems it solves.

## Architecture

Include a clean architecture diagram.

```text
Next.js
   ↓
Express API
   ↓
PostgreSQL
   ↓
Redis / BullMQ
   ↓
Email Workers
   ↓
SMTP Providers
```

Also show:

```text
Next.js
   ↓
Express
   ├── PostgreSQL
   ├── Redis
   └── Gemini

BullMQ Worker
   ├── Redis
   ├── PostgreSQL
   └── SMTP Providers
```

## Key Features

- AI personalization
- campaign management
- asynchronous email processing
- multi-provider email delivery
- templates
- follow-up sequences
- analytics
- tracking
- contact management

## Campaign Lifecycle

Document the state machine.

## Reliability

Explain:

- retries
- backoff
- idempotency
- provider health
- failure handling

## Security

Explain:

- authentication
- authorization
- token lifecycle
- validation
- secure cookies
- rate limiting

## Technology Stack

Explain why each technology is used.

## Local Development

Provide accurate setup instructions.

## Docker

Provide accurate Docker commands.

## Environment Variables

Document required variables without exposing real secrets.

## Testing

Explain how to run tests.

---

# 17. Frontend UX Improvements

Improve the existing dashboard without redesigning the entire application.

Campaign pages should clearly show:

- campaign state
- progress
- sent
- failed
- bounced
- opened
- clicked
- remaining
- scheduled time

Provide clear actions:

```text
Pause
Resume
Cancel
Retry Failed
```

Disable invalid actions based on campaign state.

Show confirmation dialogs for destructive actions.

Show meaningful loading/error/empty states.

Avoid unnecessary animations or UI complexity.

---

# 18. Final Validation

After implementation:

1. Run TypeScript checks.
2. Run linting.
3. Run unit/integration tests.
4. Run Prisma validation.
5. Run database migrations safely.
6. Build frontend.
7. Build backend.
8. Build Docker images.
9. Start Docker Compose.
10. Verify health endpoints.
11. Verify Redis connectivity.
12. Verify PostgreSQL connectivity.
13. Test campaign creation.
14. Test queue processing.
15. Test pause/resume/cancel.
16. Test retry behavior.
17. Test SMTP failure handling.
18. Test authentication refresh.
19. Test tracking.
20. Test AI personalization.

Fix all errors introduced by your changes.

---

# Important Engineering Principles

Follow these principles throughout the implementation:

### Do not over-engineer.

Prefer simple, maintainable solutions.

### Do not break existing functionality.

Preserve working features unless there is a clear security/reliability reason to change them.

### Do not fake benchmarks.

If performance has not been measured, don't claim a specific number.

### Do not bypass provider restrictions.

SMTP provider management should improve reliability and controlled delivery, not circumvent provider policies.

### Prefer idempotent operations.

Especially for:

- email sending
- queue jobs
- campaign state transitions
- refresh tokens

### Keep business logic out of controllers.

Prefer:

```text
Controller
   ↓
Service
   ↓
Repository / Prisma
```

Workers should use the same business services where appropriate.

### Keep TypeScript strict.

Avoid unnecessary `any`.

### Validate external input.

Use Zod consistently.

### Keep secrets out of logs and source code.

---

# Deliverables

At the end, provide:

## 1. Implementation Summary

List what was changed.

## 2. Files Changed

For each important file:

```text
path/to/file.ts
→ What changed and why
```

## 3. Database Changes

Explain Prisma schema/migration changes.

## 4. API Changes

List new/modified endpoints.

## 5. Queue Architecture

Explain how jobs now work.

## 6. Security Improvements

Explain the security changes.

## 7. Testing

List tests added and their results.

## 8. Remaining Risks

Be honest about anything that still needs production work.

## 9. README

Provide the final updated README.

Most importantly: **inspect the existing implementation first, make the smallest reasonable changes, preserve existing features, and do not fabricate functionality that does not exist.**
