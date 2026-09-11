import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { sseManager } from '../utils/sse';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// GET /api/track/open/:recipientId.png
const handleOpenTrack = async (req: Request, res: Response): Promise<void> => {
  const rawId = (req.params.recipientId as string) || '';
  const recipientId = rawId.replace(/\.png$/, '');

  try {
    if (recipientId && UUID_REGEX.test(recipientId)) {
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

        sseManager.emit(recipient.campaignId, {
          type: 'open',
          recipientId,
          openedAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    logger.error('[Track] Open tracking error', { recipientId }, err);
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
  const rawId = req.params.recipientId as string;
  const targetUrl = (req.query.url as string) || '';

  // Validate URL to prevent Open Redirect vulnerabilities
  const safeRedirectUrl = isValidUrl(targetUrl) ? targetUrl : 'https://google.com';

  try {
    if (rawId && UUID_REGEX.test(rawId)) {
      const recipient = await prisma.recipient.findUnique({
        where: { id: rawId },
        select: { id: true, campaignId: true, clickedAt: true },
      });

      if (recipient) {
        const isFirstClick = !recipient.clickedAt;

        await prisma.$transaction([
          prisma.recipient.update({
            where: { id: rawId },
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
    logger.error('[Track] Click tracking error', { recipientId: rawId }, err);
  } finally {
    res.redirect(302, safeRedirectUrl);
  }
});

export default router;
