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
  scheduledAt?: string;
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

// ─── Career Intelligence Types ────────────────────────────────────────────────

export type ResumeStatus = 'UPLOADED' | 'PROCESSING' | 'PARSED' | 'FAILED';
export type SkillSource = 'RESUME' | 'MANUAL' | 'AI';
export type SkillProficiency = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface ToolItem {
  id?: string;
  name: string;
  link?: string | null;
  usedFor?: string | null;
  includeInProfile?: boolean;
}

export interface ProjectItem {
  id?: string;
  name: string;
  githubUrl?: string | null;
  notes?: string | null;
  includeInProfile?: boolean;
}

export interface CandidateProfile {
  id: string;
  userId: string;
  headline?: string | null;
  summary?: string | null;
  location?: string | null;
  preferredLocations: string[];
  remotePreference?: string | null;
  preferredRoles: string[];
  salaryMin?: number | null;
  salaryMax?: number | null;
  noticePeriod?: string | null;
  workAuthorization?: string | null;
  yearsOfExperience?: number | null;
  tools?: ToolItem[] | null;
  projects?: ProjectItem[] | null;
  createdAt: string;
  updatedAt: string;
  skills?: CandidateSkill[];
  resumes?: ResumeListItem[];
}

export interface ResumeListItem {
  id: string;
  fileName: string;
  fileType: string;
  status: ResumeStatus;
  isOriginal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Resume extends ResumeListItem {
  rawText?: string | null;
  parsedData?: ParsedResume | null;
}

export interface ParsedResume {
  headline?: string | null;
  summary?: string | null;
  location?: string | null;
  yearsOfExperience?: number | null;
  skills: string[];
  experience: {
    company?: string | null;
    role?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    description?: string | null;
    technologies: string[];
  }[];
  education: {
    institution?: string | null;
    degree?: string | null;
    field?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }[];
  projects: {
    name?: string | null;
    description?: string | null;
    technologies: string[];
    url?: string | null;
  }[];
  certifications: string[];
}

export interface Skill {
  id: string;
  name: string;
  normalizedName: string;
  category?: string | null;
  createdAt: string;
}

export interface CandidateSkill {
  candidateId: string;
  skillId: string;
  proficiency?: SkillProficiency | null;
  years?: number | null;
  source: SkillSource;
  createdAt: string;
  updatedAt: string;
  skill: Skill;
}

export type RemoteType = 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'TEMPORARY' | 'UNKNOWN';
export type PostedAtConfidence = 'EXACT' | 'APPROXIMATE' | 'UNKNOWN';
export type JobStatus = 'ACTIVE' | 'EXPIRED' | 'DUPLICATE';

export interface Job {
  id: string;
  title: string;
  normalizedTitle: string;
  description?: string | null;
  company: string;
  companyUrl?: string | null;
  jobUrl: string;
  source: string;
  sourceJobId?: string | null;
  location?: string | null;
  normalizedLocation?: string | null;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  postedAt?: string | null;
  postedAtConfidence: PostedAtConfidence;
  discoveredAt: string;
  contentHash: string;
  status: JobStatus;
  skills: string[];
  createdAt: string;
  updatedAt: string;
}

export interface JobsListResponse {
  jobs: Job[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

