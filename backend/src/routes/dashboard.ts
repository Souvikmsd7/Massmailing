import { Response, Router } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PrismaClient, CampaignStatus } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/dashboard/stats
router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCampaigns,
      campaigns,
      todaySent,
      recentCampaigns,
    ] = await Promise.all([
      prisma.campaign.count({ where: { userId } }),
      prisma.campaign.aggregate({
        where: { userId },
        _sum: {
          recipientCount: true,
          sentCount: true,
          failedCount: true,
          pendingCount: true,
        },
      }),
      prisma.recipient.count({
        where: {
          campaign: { userId },
          status: 'SENT',
          sentAt: { gte: today },
        },
      }),
      prisma.campaign.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          status: true,
          recipientCount: true,
          sentCount: true,
          failedCount: true,
          pendingCount: true,
          createdAt: true,
        },
      }),
    ]);

    res.json({
      totalCampaigns,
      totalContacts: campaigns._sum.recipientCount || 0,
      totalSent: campaigns._sum.sentCount || 0,
      totalFailed: campaigns._sum.failedCount || 0,
      totalPending: campaigns._sum.pendingCount || 0,
      todaySent,
      recentCampaigns,
    });
  } catch (err) {
    console.error('[Dashboard] Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
