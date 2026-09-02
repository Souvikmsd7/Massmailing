Build a production-ready **Recruiter Mass Mailer Web Application** using **Next.js (frontend)** and **Node.js/Express (backend)**.

## Goal

The application is for sending job applications to recruiters. I should be able to upload a CSV containing recruiter information and send personalized emails to recruiters **one recipient at a time**.

If the CSV contains 100 recruiter email addresses, the application must send **100 separate emails**, not one email with 100 recipients in the To field.

Each recruiter must receive an email where:

- The `To` field contains only that recruiter's email address.
- Other recruiter email addresses are never exposed.
- Each email is tracked independently.
- Sending one email failure should not stop the remaining emails.

---

# Tech Stack

### Frontend

- Next.js 14+ / latest stable Next.js
- TypeScript
- Tailwind CSS
- Modern responsive UI
- React Hook Form
- Zod for validation
- shadcn/ui or a similarly clean component system

### Backend

- Node.js
- Express.js
- TypeScript
- Nodemailer
- REST API
- PostgreSQL with Prisma ORM
- dotenv for environment variables

### Email

Support SMTP initially using Nodemailer.

Environment variables:

```env
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=
SMTP_FROM_EMAIL=
```

Do not expose SMTP credentials to the frontend.

---

# Main Features

## 1. Dashboard

Create a professional dashboard with:

- Total contacts
- Total emails
- Sent
- Pending
- Failed
- Remaining
- Today's sent count

Show a recent campaign/activity table.

Example:

| Campaign           | Recipients | Sent | Failed | Pending | Status  |
| ------------------ | ---------- | ---- | ------ | ------- | ------- |
| Frontend Developer | 100        | 72   | 3      | 25      | Sending |

---

# 2. CSV Upload

Allow users to upload a CSV file containing recruiter information.

Example CSV:

```csv
name,email,company,job_title
Rahul Sharma,rahul@company.com,ABC Technologies,Frontend Developer
Priya Das,priya@xyz.com,XYZ Solutions,React Developer
Amit Kumar,amit@example.com,Example Ltd,Web Developer
```

The application should:

1. Upload CSV.
2. Parse the CSV.
3. Automatically detect columns.
4. Allow mapping CSV columns to:
   - Name
   - Email
   - Company
   - Job Title
   - Phone
   - LinkedIn

5. Validate email addresses.
6. Detect duplicate emails.
7. Show invalid rows.
8. Allow removing invalid/duplicate rows.
9. Show a preview before sending.

Example:

```text
Imported Contacts: 100

Valid:       94
Invalid:      4
Duplicates:   2
```

Provide a table preview.

---

# 3. Manual Email Entry

Add another option:

### Enter Email Manually

Allow the user to type/paste email addresses.

Support:

```text
hr@company.com
recruiter@company.com
careers@company.com
```

Also support comma-separated and semicolon-separated emails.

Example:

```text
rahul@example.com, priya@example.com, amit@example.com
```

Parse and validate them automatically.

Show:

```text
3 valid recipients
0 invalid
```

---

# 4. Email Composer

Create a professional email composer.

Fields:

### Subject

Example:

```text
Application for Frontend Developer Position
```

### Email Body

Support a rich text editor or Markdown-style editor.

Example:

```text
Hi {{name}},

I hope you're doing well.

I am writing to express my interest in the {{job_title}} position at {{company}}.

I have experience in frontend development using React, Next.js, JavaScript, and TypeScript, and I would love the opportunity to contribute to your team.

I have attached my resume for your consideration.

Thank you for your time.

Best regards,
{{sender_name}}
{{phone}}
{{linkedin}}
```

---

# 5. Personalization

Support dynamic variables:

```text
{{name}}
{{email}}
{{company}}
{{job_title}}
{{phone}}
{{linkedin}}
{{sender_name}}
```

Before sending, replace variables using each recruiter's CSV data.

Example:

For:

```csv
name,email,company,job_title
Rahul Sharma,rahul@abc.com,ABC Technologies,Frontend Developer
```

The recruiter should receive:

```text
Hi Rahul Sharma,

I am writing to express my interest in the Frontend Developer position at ABC Technologies.
```

If a variable is missing, gracefully replace it with an empty string or configurable fallback.

---

# 6. Resume / Attachment

Allow the user to upload a resume.

Supported:

- PDF
- DOC
- DOCX

The selected resume should be attached to every individual email.

Do not upload or store files unnecessarily. If files are stored, use secure storage and delete temporary files after the campaign when appropriate.

Maximum configurable attachment size should be enforced.

---

# 7. Preview Email

Before sending, provide a preview.

Allow the user to select a recruiter and see the exact email that recruiter will receive.

Example:

```text
TO:
rahul@abc.com

SUBJECT:
Application for Frontend Developer Position

BODY:

Hi Rahul,

I am writing to express my interest in...
```

Also show the attachment.

---

# 8. 1-to-1 Sending Logic

THIS IS VERY IMPORTANT.

Never send:

```text
To: recruiter1@example.com, recruiter2@example.com, recruiter3@example.com
```

Instead, send:

```text
Email #1
To: recruiter1@example.com

Email #2
To: recruiter2@example.com

Email #3
To: recruiter3@example.com
```

Every recipient must receive an independent email.

Use a backend queue/job-processing architecture.

For example:

```text
Campaign
   ↓
Recipient 1 → Send email → Success
Recipient 2 → Send email → Success
Recipient 3 → Send email → Failed
Recipient 4 → Send email → Success
```

A failed email must not stop the campaign.

---

# 9. Sending Queue

Do not send 100 emails simultaneously.

Implement controlled sending with a configurable delay/rate limit.

Example settings:

```text
Emails per batch: 5
Delay between batches: 10 seconds
```

Make these configurable from the UI.

For larger campaigns, use a proper job queue such as:

- BullMQ
- Redis

Structure the system so that the email sending process runs on the backend and does not depend on the browser remaining open.

Each recipient should have a status:

```text
PENDING
SENDING
SENT
FAILED
```

Store:

- sent_at
- error_message
- retry_count

---

# 10. Retry Failed Emails

After a campaign finishes, show failed emails.

Example:

```text
Campaign Complete

Total: 100
Sent: 94
Failed: 6
```

Provide:

```text
Retry Failed
```

The retry operation should only resend failed recipients.

Allow a configurable maximum retry count.

---

# 11. Campaign System

Every bulk send should be treated as a campaign.

Create:

### Create Campaign

Fields:

```text
Campaign Name
Recipients
Subject
Email Body
Attachment
Sending Rate
```

Example:

```text
Campaign:
Frontend Developer Applications - September

Recipients:
100

Subject:
Application for Frontend Developer Position
```

Store campaigns in PostgreSQL.

---

# 12. Campaign History

Create a campaign history page.

Show:

```text
Campaign Name
Created Date
Total Recipients
Sent
Failed
Pending
Status
```

Clicking a campaign should open detailed information.

---

# 13. Recipient-Level Tracking

For every recipient store:

```text
id
campaign_id
name
email
company
job_title
status
sent_at
error_message
retry_count
```

Show a detailed table:

| Name  | Email                                 | Company | Status | Sent At |
| ----- | ------------------------------------- | ------- | ------ | ------- |
| Rahul | [rahul@abc.com](mailto:rahul@abc.com) | ABC     | Sent   | 10:32   |
| Priya | [priya@xyz.com](mailto:priya@xyz.com) | XYZ     | Failed | -       |

---

# 14. Stop / Pause Campaign

While sending, provide:

```text
Pause
Resume
Stop
```

If paused:

```text
Sent: 45
Pending: 55
Status: Paused
```

Resume should continue from pending recipients.

Stop should prevent pending emails from being sent.

Already sent emails must remain marked as SENT.

---

# 15. Safety and Sending Limits

Implement safeguards against accidental massive sends.

Add:

```text
Maximum recipients per campaign
Daily sending limit
Per-minute sending limit
```

Before sending, display a confirmation:

```text
You are about to send 100 individual emails.

Each recruiter will receive a separate email.

[Cancel] [Start Campaign]
```

Do not allow accidental double submission.

Once sending starts, disable the Start button.

---

# 16. Email Validation

Validate:

- Email format
- Empty email
- Duplicate email
- Invalid CSV rows

Normalize emails:

```text
Rahul@Example.com
```

to:

```text
rahul@example.com
```

before duplicate checking.

---

# 17. CSV Export

Allow exporting campaign results as CSV.

Example:

```csv
name,email,company,status,sent_at,error
Rahul Sharma,rahul@abc.com,ABC Technologies,SENT,2026-09-02 10:30,
Priya Das,priya@xyz.com,XYZ Solutions,FAILED,,SMTP error
```

---

# 18. Settings

Create a settings page.

Include:

### Sender Information

```text
Sender Name
Sender Email
Phone
LinkedIn
Portfolio
```

### SMTP Configuration

Allow configuration through environment variables and optionally provide a UI for non-secret sender settings.

Never expose SMTP password to the client.

### Sending Settings

```text
Max emails per campaign
Emails per batch
Delay between batches
Maximum retries
```

---

# 19. Authentication

Add basic authentication so the mailer cannot be publicly accessed.

Implement:

- Login
- Logout
- Protected dashboard
- Secure password handling
- HTTP-only authentication cookies or JWT
- Route protection

Do not store plain-text passwords.

---

# 20. Database Design

Use Prisma.

Create models similar to:

```text
User
Campaign
Recipient
EmailLog
Settings
```

Relationships:

```text
User
 └── Campaign
      └── Recipient
           └── EmailLog
```

Use proper indexes for:

```text
email
campaign_id
status
created_at
```

---

# 21. Backend API

Create clean REST APIs.

Example:

```text
POST   /api/auth/login

POST   /api/campaigns
GET    /api/campaigns
GET    /api/campaigns/:id
POST   /api/campaigns/:id/start
POST   /api/campaigns/:id/pause
POST   /api/campaigns/:id/resume
POST   /api/campaigns/:id/stop
POST   /api/campaigns/:id/retry

POST   /api/contacts/import
POST   /api/contacts/validate

POST   /api/email/preview

GET    /api/dashboard/stats

GET    /api/campaigns/:id/export
```

Use proper validation and error handling.

---

# 22. UI Design

Create a clean modern SaaS-style interface.

Use:

- Sidebar navigation
- Dashboard cards
- Data tables
- Progress bars
- Status badges
- Toast notifications
- Modal confirmations
- Loading states
- Empty states
- Error states
- Responsive design

Sidebar:

```text
Dashboard
Campaigns
Contacts
Compose
Settings
```

Dashboard should look professional enough for real daily use.

---

# 23. Real-Time Campaign Progress

While a campaign is running, show live progress.

Example:

```text
Sending...

████████████████░░░░ 78%

78 / 100 sent

Sent:     75
Failed:    3
Pending:  22

Current:
rahul@example.com

[Pause] [Stop]
```

Use WebSockets or Server-Sent Events for live progress updates.

---

# 24. Error Handling

Handle:

- SMTP authentication errors
- Invalid email addresses
- Connection failures
- Timeout
- Rate limits
- Attachment errors
- Database errors
- CSV parsing errors

Show human-readable errors in the UI.

Example:

```text
Failed to send to recruiter@example.com

Reason:
SMTP connection timeout
```

Do not expose sensitive SMTP credentials or internal stack traces to users.

---

# 25. Security

Implement:

- Input validation
- Rate limiting
- CSRF protection where applicable
- Secure authentication
- Authorization
- File type validation
- File size limits
- Sanitization of email HTML
- No SMTP credentials in frontend
- No sensitive information in logs
- Protection against malicious CSV content
- Protection against duplicate campaign submission

Be careful with HTML email content to prevent stored XSS.

---

# 26. Project Structure

Use a clean structure similar to:

```text
mailer-app/
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── types/
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── workers/
│   │   ├── middleware/
│   │   ├── utils/
│   │   └── server.ts
│   │
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   └── package.json
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

# 27. Docker

Provide Docker Compose for:

```text
Next.js
Node.js API
PostgreSQL
Redis
```

Make local development easy with:

```bash
docker compose up
```

---

# 28. Environment Variables

Create `.env.example`.

Example:

```env
DATABASE_URL=

REDIS_URL=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=

JWT_SECRET=

MAX_RECIPIENTS_PER_CAMPAIGN=100
EMAIL_BATCH_SIZE=5
EMAIL_BATCH_DELAY=10000
MAX_RETRIES=3
```

---

# 29. Important Email Requirements

Use Nodemailer on the backend.

For every recipient:

```typescript
await transporter.sendMail({
  from: sender,
  to: recipient.email,
  subject: personalizedSubject,
  html: personalizedBody,
  attachments: [...]
});
```

Never put multiple recruiter emails in the `to` field.

Do not use CC/BCC for the campaign recipient list.

Each email should be independently logged.

---

# 30. Testing

Create tests for:

### CSV

- Valid CSV
- Invalid email
- Duplicate email
- Missing columns

### Personalization

- Replace variables
- Missing variables
- Special characters

### Email

- One recipient receives one email
- Multiple recipients generate separate messages
- Failed email does not stop queue
- Retry failed emails

### Campaign

- Start
- Pause
- Resume
- Stop
- Completion
- Duplicate start prevention

---

# 31. README

Create a detailed README containing:

1. Project overview
2. Architecture
3. Tech stack
4. Installation
5. Environment variables
6. Database setup
7. Redis setup
8. SMTP configuration
9. Running frontend
10. Running backend
11. Docker setup
12. Production deployment
13. API documentation
14. Testing
15. Security considerations

---

# Important Implementation Requirement

Build this as a **real working application**, not a static UI mockup.

The complete flow must work:

```text
Login
  ↓
Dashboard
  ↓
Create Campaign
  ↓
Upload CSV / Enter Emails
  ↓
Validate Contacts
  ↓
Compose Subject + Body
  ↓
Personalize Email
  ↓
Attach Resume
  ↓
Preview
  ↓
Confirm
  ↓
Create Sending Queue
  ↓
Send Individual Emails
  ↓
Track Each Recipient
  ↓
Show Live Progress
  ↓
Campaign Complete
  ↓
Retry Failed Emails
  ↓
Export Results
```

Prioritize **reliability, security, clean architecture, and a polished UI** over unnecessary features.

Make sensible implementation decisions where requirements are unspecified. Provide complete source code and setup instructions.
