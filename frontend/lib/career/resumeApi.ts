import api from '@/lib/api';
import { Resume, ResumeListItem } from '@/lib/types';

export async function uploadResume(file: File): Promise<ResumeListItem> {
  const formData = new FormData();
  formData.append('resume', file);
  const res = await api.post('/api/career/resumes', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function listResumes(): Promise<ResumeListItem[]> {
  const res = await api.get('/api/career/resumes');
  return res.data.data;
}

export async function getResume(id: string): Promise<Resume> {
  const res = await api.get(`/api/career/resumes/${id}`);
  return res.data.data;
}

export async function deleteResume(id: string): Promise<void> {
  await api.delete(`/api/career/resumes/${id}`);
}

export async function parseResume(id: string): Promise<{ resume: ResumeListItem; parsed: unknown }> {
  const res = await api.post(`/api/career/resumes/${id}/parse`);
  return res.data.data;
}
