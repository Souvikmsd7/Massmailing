import api from '@/lib/api';
import { CandidateSkill } from '@/lib/types';

export async function getSkills(): Promise<CandidateSkill[]> {
  const res = await api.get('/api/career/skills');
  return res.data.data;
}

export async function addSkill(name: string): Promise<CandidateSkill[]> {
  const res = await api.post('/api/career/skills', { name });
  return res.data.data;
}

export async function removeSkill(skillId: string): Promise<void> {
  await api.delete(`/api/career/skills/${skillId}`);
}
