import { Response, Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { personalizeEmail } from '../services/personalizationService';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// POST /api/email/preview
router.post('/preview', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { subject, body, recipient, campaignId } = req.body;

    if (!subject || !body) {
      res.status(400).json({ error: 'subject and body are required' });
      return;
    }

    // Get sender settings
    const settings = await prisma.settings.findUnique({ where: { userId } });
    const sender = {
      senderName: settings?.senderName || process.env.SMTP_FROM_NAME || '',
      senderEmail: settings?.senderEmail || process.env.SMTP_FROM_EMAIL || '',
      phone: settings?.phone || '',
      linkedin: settings?.linkedin || '',
      portfolio: settings?.portfolio || '',
    };

    const recipientData = recipient || {
      name: 'John Doe',
      email: 'john@example.com',
      company: 'Example Corp',
      jobTitle: 'Software Engineer',
      phone: '+1 555-0100',
      linkedin: 'https://linkedin.com/in/johndoe',
    };

    const { subject: personalizedSubject, html } = personalizeEmail(
      subject,
      body,
      recipientData,
      sender
    );

    res.json({
      to: recipientData.email,
      subject: personalizedSubject,
      html,
      recipient: recipientData,
    });
  } catch (err) {
    console.error('[Email] Preview error:', err);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

export default router;
