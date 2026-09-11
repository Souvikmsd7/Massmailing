import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { comparePassword } from '../utils/hash';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/jwt';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

// Helper for setting HTTP-Only security cookies
function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid email or password format' });
      return;
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const family = uuidv4();
    const tokenId = uuidv4();
    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.id, email: user.email, family, tokenId });

    const hashed = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Save refresh token record in DB
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashed,
        family,
        expiresAt,
      },
    });

    setAuthCookies(res, accessToken, refreshToken);

    const expiresIn = 15 * 60;
    const expiresAtIso = new Date(Date.now() + expiresIn * 1000).toISOString();

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token: accessToken,
      refreshToken,
      expiresIn,
      expiresAt: expiresAtIso,
    });
  } catch (err) {
    logger.error('[Auth] Login error', {}, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh (Obtain new Access Token using Refresh Token with rotation)
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = refreshSchema.safeParse(req.body);
    const refreshToken = req.cookies?.refreshToken || (parsed.success ? parsed.data.refreshToken : null);

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token is required' });
      return;
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const hashed = hashToken(refreshToken);
    const existingToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashed },
    });

    // Protection against Token Replay Attack: If token is revoked or not found, invalidate entire token family!
    if (!existingToken || existingToken.isRevoked) {
      logger.warn('[Security Alert] Token replay detected! Revoking token family', { family: payload.family });
      await prisma.refreshToken.updateMany({
        where: { family: payload.family },
        data: { isRevoked: true },
      });
      res.clearCookie('token');
      res.clearCookie('refreshToken');
      res.status(401).json({ error: 'Token reuse detected. Session revoked.' });
      return;
    }

    // Revoke current refresh token
    await prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { isRevoked: true },
    });

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.status(401).json({ error: 'User session invalid' });
      return;
    }

    // Issue rotated new refresh token in the same family
    const newTokenId = uuidv4();
    const newAccessToken = signAccessToken({ userId: user.id, email: user.email });
    const newRefreshToken = signRefreshToken({
      userId: user.id,
      email: user.email,
      family: payload.family,
      tokenId: newTokenId,
    });

    const newHashed = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newHashed,
        family: payload.family,
        expiresAt,
      },
    });

    setAuthCookies(res, newAccessToken, newRefreshToken);

    const expiresIn = 15 * 60;
    const expiresAtIso = new Date(Date.now() + expiresIn * 1000).toISOString();

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn,
      expiresAt: expiresAtIso,
    });
  } catch (err) {
    logger.error('[Auth] Refresh error', {}, err);
    res.status(500).json({ error: 'Failed to refresh token session' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (refreshToken) {
      const hashed = hashToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashed },
        data: { isRevoked: true },
      }).catch(() => {});
    }
  } catch { /* ignore */ }

  res.clearCookie('token');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

// GET /api/auth/me (protected)
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (err) {
    logger.error('[Auth] Me error', {}, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
