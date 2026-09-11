import { CampaignStatus, RecipientStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: CampaignStatus | RecipientStatus | string;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  PROCESSING: 'Processing',
  SENDING: 'Sending',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  STOPPED: 'Cancelled',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
  PENDING: 'Pending',
  QUEUED: 'Queued',
  SENT: 'Sent',
  BOUNCED: 'Bounced',
};

const STATUS_DOTS: Record<string, string> = {
  PROCESSING: 'bg-cyan-400',
  SENDING: 'bg-cyan-400',
  QUEUED: 'bg-indigo-400',
  SENT: 'bg-emerald-400',
  COMPLETED: 'bg-emerald-400',
  PENDING: 'bg-amber-400',
  FAILED: 'bg-red-400',
  BOUNCED: 'bg-rose-500',
  PAUSED: 'bg-violet-400',
  SCHEDULED: 'bg-blue-400',
  STOPPED: 'bg-slate-400',
  DRAFT: 'bg-slate-400',
  CANCELLED: 'bg-slate-500',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const cls = `badge badge-${status.toLowerCase()}`;
  const dotCls = STATUS_DOTS[status] || 'bg-slate-400';

  return (
    <span className={cls}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotCls} inline-block`} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}
