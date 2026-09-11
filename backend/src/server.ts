import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from './middleware/auth';

// Routes
import authRoutes from './routes/auth';
import campaignRoutes from './routes/campaigns';
import contactRoutes from './routes/contacts';
import emailRoutes from './routes/email';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';

// Worker
import { startWorker } from './workers/emailWorker';

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
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' },
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', authLimiter, authRoutes);

// Protected routes
app.use('/api/campaigns', authMiddleware, campaignRoutes);
app.use('/api/contacts', authMiddleware, contactRoutes);
app.use('/api/email', authMiddleware, emailRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  startWorker();
});

export default app;
