import { PrismaClient, CampaignStatus } from '@prisma/client';
import { enqueueCampaign } from './emailWorker';
import { CampaignStateMachine } from '../services/campaignState';
import { sseManager } from '../utils/sse';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();
let schedulerInterval: NodeJS.Timeout | null = null;
const CHECK_INTERVAL_MS = 30000; // Check every 30 seconds

export async function processDueScheduledCampaigns(): Promise<number> {
  try {
    const now = new Date();
    const dueCampaigns = await prisma.campaign.findMany({
      where: {
        status: CampaignStatus.SCHEDULED,
        scheduledAt: {
          lte: now,
        },
      },
    });

    if (dueCampaigns.length === 0) {
      return 0;
    }

    logger.info(`[Scheduler] Found ${dueCampaigns.length} scheduled campaigns due for execution`);

    let processedCount = 0;
    for (const campaign of dueCampaigns) {
      try {
        CampaignStateMachine.validateTransition(
          campaign.status,
          CampaignStatus.PROCESSING,
          campaign.id
        );

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: CampaignStatus.PROCESSING,
            updatedBy: 'System Scheduler',
          },
        });

        await enqueueCampaign(campaign.id, campaign.batchSize, campaign.batchDelay);

        sseManager.emit(campaign.id, {
          type: 'scheduled_started',
          campaignId: campaign.id,
          status: CampaignStatus.PROCESSING,
        });

        logger.info(`[Scheduler] Successfully launched scheduled campaign`, {
          campaignId: campaign.id,
          name: campaign.name,
          scheduledAt: campaign.scheduledAt,
        });

        processedCount++;
      } catch (err: any) {
        logger.error(
          `[Scheduler] Failed to process scheduled campaign ${campaign.id}`,
          { campaignId: campaign.id },
          err
        );
      }
    }

    return processedCount;
  } catch (err: any) {
    logger.error('[Scheduler] Error querying due scheduled campaigns', {}, err);
    return 0;
  }
}

export function startCampaignSchedulerWorker(): void {
  if (schedulerInterval) return;

  logger.info('[Scheduler] Starting Campaign Scheduler Worker (checking every 30s)');

  // Run initial check immediately
  processDueScheduledCampaigns().catch((err) => {
    logger.error('[Scheduler] Error in initial scheduled campaign check', {}, err);
  });

  schedulerInterval = setInterval(() => {
    processDueScheduledCampaigns().catch((err) => {
      logger.error('[Scheduler] Error in interval scheduled campaign check', {}, err);
    });
  }, CHECK_INTERVAL_MS);
}

export function stopCampaignSchedulerWorker(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('[Scheduler] Campaign Scheduler Worker stopped');
  }
}
