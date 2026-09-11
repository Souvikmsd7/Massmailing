import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/analytics - Get aggregate analytics & performance metrics
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Total campaigns
    const totalCampaigns = await prisma.campaign.count({ where: { userId } });

    // Sum overall campaign metrics
    const campaignAggregate = await prisma.campaign.aggregate({
      where: { userId },
      _sum: {
        recipientCount: true,
        sentCount: true,
        failedCount: true,
        openedCount: true,
        clickedCount: true,
      },
    });

    const totalRecipients = campaignAggregate._sum.recipientCount || 0;
    const totalSent = campaignAggregate._sum.sentCount || 0;
    const totalFailed = campaignAggregate._sum.failedCount || 0;
    const totalOpened = campaignAggregate._sum.openedCount || 0;
    const totalClicked = campaignAggregate._sum.clickedCount || 0;

    const deliveryRate = totalSent > 0 ? Number(((totalSent / (totalSent + totalFailed)) * 100).toFixed(1)) : 100;
    const openRate = totalSent > 0 ? Number(((totalOpened / totalSent) * 100).toFixed(1)) : 0;
    const ctrRate = totalSent > 0 ? Number(((totalClicked / totalSent) * 100).toFixed(1)) : 0;

    // Campaign Performance List
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        status: true,
        sentCount: true,
        failedCount: true,
        openedCount: true,
        clickedCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Recent 14-day logs distribution for charts
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const emailLogs = await prisma.emailLog.findMany({
      where: {
        campaign: { userId },
        createdAt: { gte: fourteenDaysAgo },
      },
      select: {
        createdAt: true,
        status: true,
      },
    });

    // Group logs by Date (YYYY-MM-DD)
    const dailyStatsMap: Record<string, { date: string; sent: number; opens: number; clicks: number }> = {};

    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyStatsMap[dateStr] = { date: dateStr, sent: 0, opens: 0, clicks: 0 };
    }

    emailLogs.forEach((log) => {
      const dateStr = log.createdAt.toISOString().split('T')[0];
      if (dailyStatsMap[dateStr]) {
        if (log.status === 'SENT' || log.status === 'FOLLOWUP_SENT') dailyStatsMap[dateStr].sent++;
      }
    });

    // Fetch recipient open/click timestamps for exact trend
    const recentRecipients = await prisma.recipient.findMany({
      where: {
        campaign: { userId },
        OR: [
          { openedAt: { gte: fourteenDaysAgo } },
          { clickedAt: { gte: fourteenDaysAgo } },
        ],
      },
      select: { openedAt: true, clickedAt: true },
    });

    recentRecipients.forEach((rec) => {
      if (rec.openedAt) {
        const dStr = rec.openedAt.toISOString().split('T')[0];
        if (dailyStatsMap[dStr]) dailyStatsMap[dStr].opens++;
      }
      if (rec.clickedAt) {
        const dStr = rec.clickedAt.toISOString().split('T')[0];
        if (dailyStatsMap[dStr]) dailyStatsMap[dStr].clicks++;
      }
    });

    const dailyTrends = Object.values(dailyStatsMap);

    res.json({
      summary: {
        totalCampaigns,
        totalRecipients,
        totalSent,
        totalFailed,
        totalOpened,
        totalClicked,
        deliveryRate,
        openRate,
        ctrRate,
      },
      campaigns: campaigns.map((c) => ({
        ...c,
        openRate: c.sentCount > 0 ? Number(((c.openedCount / c.sentCount) * 100).toFixed(1)) : 0,
        ctr: c.sentCount > 0 ? Number(((c.clickedCount / c.sentCount) * 100).toFixed(1)) : 0,
      })),
      dailyTrends,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
