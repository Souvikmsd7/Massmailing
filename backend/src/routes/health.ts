import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';

const router = Router();
const prisma = new PrismaClient();
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// GET /api/health
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// GET /api/health/readiness
router.get('/readiness', async (_req: Request, res: Response): Promise<void> => {
  let dbStatus = 'healthy';
  let redisStatus = 'healthy';
  let isHealthy = true;

  // Check PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'unhealthy';
    isHealthy = false;
  }

  // Check Redis
  const redis = new IORedis(REDIS_URL, { connectTimeout: 3000, maxRetriesPerRequest: 1 });
  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      redisStatus = 'unhealthy';
      isHealthy = false;
    }
  } catch {
    redisStatus = 'unhealthy';
    isHealthy = false;
  } finally {
    redis.disconnect();
  }

  const responsePayload = {
    status: isHealthy ? 'ok' : 'degraded',
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
    timestamp: new Date().toISOString(),
  };

  if (!isHealthy) {
    res.status(503).json(responsePayload);
    return;
  }

  res.json(responsePayload);
});

export default router;
