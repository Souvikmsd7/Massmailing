export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'PROCESSING' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'STOPPED' | 'FAILED';
export type RecipientStatus = 'PENDING' | 'QUEUED' | 'PROCESSING' | 'SENDING' | 'SENT' | 'FAILED' | 'BOUNCED' | 'CANCELLED';

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
  openedCount?: number;
  clickedCount?: number;
  batchSize: number;
  batchDelay: number;
  maxRetries: number;
  enableFollowUp?: boolean;
  followUpDays?: number;
  followUpSubject?: string;
  followUpBody?: string;
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
  openedAt?: string;
  clickedAt?: string;
  openCount?: number;
  clickCount?: number;
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
  totalOpened?: number;
  totalClicked?: number;
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

export interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmtpAccount {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  fromEmail: string;
  fromName: string;
  dailyLimit: number;
  sentToday: number;
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}
