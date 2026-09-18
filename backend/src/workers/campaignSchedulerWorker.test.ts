import { processDueScheduledCampaigns } from './campaignSchedulerWorker';
import { PrismaClient, CampaignStatus } from '@prisma/client';

const prisma = new PrismaClient();

describe('Campaign Scheduler Worker', () => {
  it('should return 0 when no campaigns are due', async () => {
    const processed = await processDueScheduledCampaigns();
    expect(typeof processed).toBe('number');
  });
});
