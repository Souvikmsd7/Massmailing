import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/smtp-accounts - List all SMTP accounts for user
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await prisma.smtpAccount.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ accounts });
  } catch (error) {
    console.error('Error fetching SMTP accounts:', error);
    res.status(500).json({ error: 'Failed to fetch SMTP accounts' });
  }
});

// POST /api/smtp-accounts/test - Test connection
router.post('/test', async (req: AuthRequest, res: Response) => {
  try {
    const { host, port, secure, username, password } = req.body;
    if (!host || !username || !password) {
      return res.status(400).json({ error: 'Host, username, and password are required' });
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: Boolean(secure) || Number(port) === 465,
      auth: { user: username, pass: password },
      tls: { rejectUnauthorized: false },
    });

    await transporter.verify();
    res.json({ message: 'SMTP connection test succeeded! credentials are valid.' });
  } catch (error: any) {
    console.error('SMTP Test Failed:', error);
    res.status(400).json({ error: `SMTP Connection Failed: ${error.message || 'Unknown error'}` });
  }
});

// POST /api/smtp-accounts - Create SMTP account
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, host, port, secure, username, password, fromEmail, fromName, dailyLimit } = req.body;

    if (!name || !host || !username || !password || !fromEmail) {
      return res.status(400).json({ error: 'Name, host, username, password, and fromEmail are required' });
    }

    const account = await prisma.smtpAccount.create({
      data: {
        userId: req.user!.userId,
        name,
        host,
        port: Number(port) || 587,
        secure: Boolean(secure) || Number(port) === 465,
        username,
        password,
        fromEmail,
        fromName: fromName || '',
        dailyLimit: Number(dailyLimit) || 500,
        createdBy: req.user!.email as string,
        updatedBy: req.user!.email as string,
      },
    });

    res.status(201).json({ account });
  } catch (error) {
    console.error('Error creating SMTP account:', error);
    res.status(500).json({ error: 'Failed to create SMTP account' });
  }
});

// PUT /api/smtp-accounts/:id - Update SMTP account
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, host, port, secure, username, password, fromEmail, fromName, dailyLimit, isActive } = req.body;

    const existing = await prisma.smtpAccount.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user!.userId) {
      return res.status(404).json({ error: 'SMTP account not found' });
    }

    const updated = await prisma.smtpAccount.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(host && { host }),
        ...(port !== undefined && { port: Number(port) }),
        ...(secure !== undefined && { secure: Boolean(secure) }),
        ...(username && { username }),
        ...(password && { password }),
        ...(fromEmail && { fromEmail }),
        ...(fromName !== undefined && { fromName }),
        ...(dailyLimit !== undefined && { dailyLimit: Number(dailyLimit) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        updatedBy: req.user!.email as string,
      },
    });

    res.json({ account: updated });
  } catch (error) {
    console.error('Error updating SMTP account:', error);
    res.status(500).json({ error: 'Failed to update SMTP account' });
  }
});

// DELETE /api/smtp-accounts/:id - Delete SMTP account
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const existing = await prisma.smtpAccount.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user!.userId) {
      return res.status(404).json({ error: 'SMTP account not found' });
    }

    await prisma.smtpAccount.delete({ where: { id } });
    res.json({ message: 'SMTP account deleted successfully' });
  } catch (error) {
    console.error('Error deleting SMTP account:', error);
    res.status(500).json({ error: 'Failed to delete SMTP account' });
  }
});

export default router;
