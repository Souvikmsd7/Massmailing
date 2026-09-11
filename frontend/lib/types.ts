export type CampaignStatus = 'DRAFT' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'FAILED';
export type RecipientStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: CampaignStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  batchSize: number;
  batchDelay: number;
  maxRetries: number;
  attachmentPath?: string;
  attachmentName?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  recipients?: Recipient[];
}

export interface Recipient {
  id: string;
  campaignId: string;
  name?: string;
  email: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  linkedin?: string;
  status: RecipientStatus;
  sentAt?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
}

export interface Settings {
  senderName: string;
  senderEmail: string;
  phone: string;
  linkedin: string;
  portfolio: string;
  maxRecipientsPerCampaign: number;
  emailBatchSize: number;
  emailBatchDelay: number;
  maxRetries: number;
}

export interface DashboardStats {
  totalCampaigns: number;
  totalContacts: number;
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  todaySent: number;
  recentCampaigns: Campaign[];
}

export interface Contact {
  email: string;
  name?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  linkedin?: string;
  rowIndex?: number;
}
