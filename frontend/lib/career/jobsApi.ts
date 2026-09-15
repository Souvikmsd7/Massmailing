import api from '@/lib/api';
import { Job, JobsListResponse } from '@/lib/types';

export interface DiscoverJobsParams {
  query: string;
  location?: string;
  limit?: number;
  sources?: string[];
}

export interface ListJobsParams {
  search?: string;
  remoteType?: string;
  employmentType?: string;
  status?: string;
  postedWithin?: string;
  page?: number;
  limit?: number;
}

export async function discoverJobs(params: DiscoverJobsParams): Promise<{ jobId: string; status: string; message: string }> {
  const res = await api.post('/api/career/jobs/discover', params);
  return res.data.data;
}

export async function listJobs(params?: ListJobsParams): Promise<JobsListResponse> {
  const res = await api.get('/api/career/jobs', { params });
  return res.data.data;
}

export async function getJob(id: string): Promise<Job> {
  const res = await api.get(`/api/career/jobs/${id}`);
  return res.data.data;
}
