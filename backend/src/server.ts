import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

// Routes
import authRoutes from './routes/auth';
import campaignRoutes from './routes/campaigns';
import contactRoutes from './routes/contacts';
import emailRoutes from './routes/email';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';
import hrContactsRoutes from './routes/hr-contacts';
import trackRoutes from './routes/track';
import templateRoutes from './routes/templates';
import aiRoutes from './routes/ai';
import smtpRoutes from './routes/smtp';
import analyticsRoutes from './routes/analytics';
import healthRoutes from './routes/health';

// Career Intelligence routes
import careerCandidateRoutes from './routes/career/candidate';
import careerResumeRoutes from './routes/career/resume';
import careerSkillsRoutes from './routes/career/skills';
import careerJobsRoutes from './routes/career/jobs';

// Workers
import { startWorker } from './workers/emailWorker';
import { startJobDiscoveryWorker } from './workers/jobDiscoveryWorker';

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));

// CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Public routes & Health checks
app.use('/api/health', healthRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/track', trackRoutes);

// Protected routes
app.use('/api/campaigns', authMiddleware, campaignRoutes);
app.use('/api/contacts', authMiddleware, contactRoutes);
app.use('/api/email', authMiddleware, emailRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/hr-contacts', authMiddleware, hrContactsRoutes);
app.use('/api/templates', authMiddleware, templateRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/smtp-accounts', authMiddleware, smtpRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);

// Career Intelligence
app.use('/api/career', authMiddleware, careerCandidateRoutes);
app.use('/api/career/resumes', authMiddleware, careerResumeRoutes);
app.use('/api/career/skills', authMiddleware, careerSkillsRoutes);
app.use('/api/career/jobs', authMiddleware, careerJobsRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Centralized error handler
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    startWorker();
    startJobDiscoveryWorker();
  });
}

export default app;
