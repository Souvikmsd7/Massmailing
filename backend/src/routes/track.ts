import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { sseManager } from '../utils/sse';

const router = Router();
const prisma = new PrismaClient();

// 1x1 Transparent GIF Buffer
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// GET /api/track/open/:recipientId.png (also supports without extension)
const handleOpenTrack = async (req: Request, res: Response): Promise<void> => {
  const rawId = (req.params.recipientId as string) || '';
  const recipientId = rawId.replace(/\.png$/, '');

  try {
    if (recipientId) {
      const recipient = await prisma.recipient.findUnique({
        where: { id: recipientId },
        select: { id: true, campaignId: true, openedAt: true },
      });

      if (recipient) {
        const isFirstOpen = !recipient.openedAt;

        await prisma.$transaction([
          prisma.recipient.update({
            where: { id: recipientId },
            data: {
              openedAt: recipient.openedAt || new Date(),
              openCount: { increment: 1 },
            },
          }),
          ...(isFirstOpen
            ? [
                prisma.campaign.update({
                  where: { id: recipient.campaignId },
                  data: { openedCount: { increment: 1 } },
                }),
              ]
            : []),
        ]);

        // Send SSE event
        sseManager.emit(recipient.campaignId, {
          type: 'open',
          recipientId,
          openedAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error('[Track] Open tracking error:', err);
  } finally {
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.end(TRANSPARENT_GIF);
  }
};

router.get('/open/:recipientId', handleOpenTrack);
router.get('/open/:recipientId.png', handleOpenTrack);

// GET /api/track/click/:recipientId?url=...
router.get('/click/:recipientId', async (req: Request, res: Response): Promise<void> => {
  const recipientId = req.params.recipientId as string;
  const targetUrl = (req.query.url as string) || 'https://google.com';

  try {
    if (recipientId) {
      const recipient = await prisma.recipient.findUnique({
        where: { id: recipientId },
        select: { id: true, campaignId: true, clickedAt: true },
      });

      if (recipient) {
        const isFirstClick = !recipient.clickedAt;

        await prisma.$transaction([
          prisma.recipient.update({
            where: { id: recipientId },
            data: {
              clickedAt: recipient.clickedAt || new Date(),
              clickCount: { increment: 1 },
            },
          }),
          ...(isFirstClick
            ? [
                prisma.campaign.update({
                  where: { id: recipient.campaignId },
                  data: { clickedCount: { increment: 1 } },
                }),
              ]
            : []),
        ]);
      }
    }
  } catch (err) {
    console.error('[Track] Click tracking error:', err);
  } finally {
    res.redirect(302, targetUrl);
  }
});

export default router;
