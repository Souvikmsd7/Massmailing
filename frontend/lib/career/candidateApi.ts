import api from '@/lib/api';
import { CandidateProfile } from '@/lib/types';

export async function getProfile(): Promise<CandidateProfile | null> {
  const res = await api.get('/api/career/profile');
  return res.data.data;
}

export async function createProfile(data: Partial<CandidateProfile>): Promise<CandidateProfile> {
  const res = await api.post('/api/career/profile', data);
  return res.data.data;
}

export async function updateProfile(data: Partial<CandidateProfile>): Promise<CandidateProfile> {
  const res = await api.patch('/api/career/profile', data);
  return res.data.data;
}
