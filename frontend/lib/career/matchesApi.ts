import api from '@/lib/api';

export interface JobMatchRecord {
  id: string;
  candidateProfileId: string;
  jobId: string;
  overallScore: number;
  hardFilterScore: number;
  skillScore: number;
  semanticScore: number;
  status: 'CALCULATING' | 'READY' | 'FAILED' | 'STALE';
  hardFilterResults?: {
    eligible: boolean;
    locationMatch: boolean | null;
    remoteMatch: boolean | null;
    employmentTypeMatch: boolean | null;
    experienceMatch: boolean | null;
    workAuthorizationMatch: boolean | null;
    salaryMatch: boolean | null;
    failedFilters: string[];
  };
  skillMatchResults?: {
    matchedSkills: Array<{
      candidateSkill: string;
      jobSkill: string;
      matchType: 'EXACT' | 'ALIAS';
      confidence: number;
    }>;
    missingSkills: string[];
    partialSkills: Array<{ candidateSkill: string; jobSkill: string }>;
    skillScore: number;
  };
  explanation?: {
    summary: string;
    strengths: string[];
    gaps: string[];
    status: 'AVAILABLE' | 'UNAVAILABLE';
  };
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    title: string;
    company: string;
    location?: string | null;
    remoteType?: string;
    employmentType?: string;
    skills?: string[];
    jobUrl?: string;
  };
}

export interface MatchesListResponse {
  matches: JobMatchRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export async function calculateMatch(jobId: string, forceRecalculate = false): Promise<JobMatchRecord> {
  const res = await api.post('/api/career/matches', { jobId, forceRecalculate });
  return res.data.data;
}

export async function listMatches(params?: {
  minScore?: number;
  status?: string;
  jobId?: string;
  page?: number;
  limit?: number;
}): Promise<MatchesListResponse> {
  const res = await api.get('/api/career/matches', { params });
  return res.data.data;
}

export async function getMatchById(id: string): Promise<JobMatchRecord> {
  const res = await api.get(`/api/career/matches/${id}`);
  return res.data.data;
}
