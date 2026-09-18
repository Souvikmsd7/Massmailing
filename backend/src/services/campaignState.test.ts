import { CampaignStatus } from '@prisma/client';
import { CampaignStateMachine } from './campaignState';
import { ConflictError } from '../utils/errors';

describe('Campaign State Machine', () => {
  it('allows valid state transitions', () => {
    expect(CampaignStateMachine.canTransition(CampaignStatus.DRAFT, CampaignStatus.SCHEDULED)).toBe(true);
    expect(CampaignStateMachine.canTransition(CampaignStatus.DRAFT, CampaignStatus.PROCESSING)).toBe(true);
    expect(CampaignStateMachine.canTransition(CampaignStatus.SCHEDULED, CampaignStatus.PROCESSING)).toBe(true);
    expect(CampaignStateMachine.canTransition(CampaignStatus.SCHEDULED, CampaignStatus.CANCELLED)).toBe(true);
    expect(CampaignStateMachine.canTransition(CampaignStatus.SCHEDULED, CampaignStatus.DRAFT)).toBe(true);
    expect(CampaignStateMachine.canTransition(CampaignStatus.SCHEDULED, CampaignStatus.SCHEDULED)).toBe(true);
    expect(CampaignStateMachine.canTransition(CampaignStatus.PROCESSING, CampaignStatus.PAUSED)).toBe(true);
    expect(CampaignStateMachine.canTransition(CampaignStatus.PAUSED, CampaignStatus.PROCESSING)).toBe(true);
    expect(CampaignStateMachine.canTransition(CampaignStatus.PROCESSING, CampaignStatus.COMPLETED)).toBe(true);
    expect(CampaignStateMachine.canTransition(CampaignStatus.PROCESSING, CampaignStatus.CANCELLED)).toBe(true);
  });

  it('rejects invalid state transitions', () => {
    expect(CampaignStateMachine.canTransition(CampaignStatus.COMPLETED, CampaignStatus.PROCESSING)).toBe(false);
    expect(CampaignStateMachine.canTransition(CampaignStatus.CANCELLED, CampaignStatus.PAUSED)).toBe(false);
    expect(CampaignStateMachine.canTransition(CampaignStatus.DRAFT, CampaignStatus.COMPLETED)).toBe(false);
  });

  it('throws ConflictError on invalid transition validation', () => {
    expect(() => {
      CampaignStateMachine.validateTransition(CampaignStatus.COMPLETED, CampaignStatus.PROCESSING, 'campaign-123');
    }).toThrow(ConflictError);
  });

  it('permits same-state idempotent transitions without error', () => {
    expect(() => {
      CampaignStateMachine.validateTransition(CampaignStatus.PROCESSING, CampaignStatus.PROCESSING, 'campaign-123');
    }).not.toThrow();
  });
});
