import { CampaignStatus } from '@prisma/client';
import { BadRequestError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';

const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  [CampaignStatus.DRAFT]: [CampaignStatus.SCHEDULED, CampaignStatus.PROCESSING],
  [CampaignStatus.SCHEDULED]: [
    CampaignStatus.PROCESSING,
    CampaignStatus.CANCELLED,
    CampaignStatus.DRAFT,
    CampaignStatus.SCHEDULED,
  ],
  [CampaignStatus.PROCESSING]: [
    CampaignStatus.PAUSED,
    CampaignStatus.COMPLETED,
    CampaignStatus.FAILED,
    CampaignStatus.CANCELLED,
  ],
  [CampaignStatus.PAUSED]: [CampaignStatus.PROCESSING, CampaignStatus.CANCELLED],
  [CampaignStatus.COMPLETED]: [], // Terminal state (or retried via recipient-level status resets)
  [CampaignStatus.CANCELLED]: [],
  [CampaignStatus.FAILED]: [CampaignStatus.PROCESSING], // Allow retry transition
};

export class CampaignStateMachine {
  public static canTransition(current: CampaignStatus, next: CampaignStatus): boolean {
    if (current === next) return true; // Idempotent same-state check
    const allowed = VALID_TRANSITIONS[current] || [];
    return allowed.includes(next);
  }

  public static validateTransition(current: CampaignStatus, next: CampaignStatus, campaignId: string): void {
    if (current === next) return; // Idempotent
    if (!this.canTransition(current, next)) {
      logger.warn('Invalid campaign state transition attempt', {
        campaignId,
        fromStatus: current,
        toStatus: next,
      });
      throw new ConflictError(
        `Cannot transition campaign from ${current} to ${next}`,
        'INVALID_STATE_TRANSITION'
      );
    }
  }
}
