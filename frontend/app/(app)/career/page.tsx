'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProfile } from '@/lib/career/candidateApi';
import { listResumes } from '@/lib/career/resumeApi';
import { getSkills } from '@/lib/career/skillsApi';
import { CandidateProfile, ResumeListItem, CandidateSkill } from '@/lib/types';
import {
  BrainCircuit, FileText, User, Sparkles, CheckCircle2, AlertCircle,
  Clock, XCircle, ArrowRight, Upload
} from 'lucide-react';
import { showToast } from '@/lib/swal';

const statusConfig = {
  UPLOADED: { label: 'Uploaded', icon: Upload, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  PROCESSING: { label: 'Processing…', icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  PARSED: { label: 'Parsed', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  FAILED: { label: 'Failed', icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

export default function CareerDashboard() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [skills, setSkills] = useState<CandidateSkill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getProfile().catch(() => null),
      listResumes().catch(() => []),
      getSkills().catch(() => []),
    ])
      .then(([p, r, s]) => {
        setProfile(p);
        setResumes(r);
        setSkills(s);
      })
      .catch(() => showToast('error', 'Failed to load Career Intelligence data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    );
  }

  const latestResume = resumes[0];
  const resumeStatus = latestResume
    ? statusConfig[latestResume.status]
    : null;

  const profileComplete = profile && (profile.headline || profile.summary || profile.location);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-6 md:p-8 bg-gradient-to-r from-indigo-950/80 via-slate-900/90 to-slate-950 border border-indigo-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="badge badge-violet flex items-center gap-1">
                <Sparkles size={12} className="text-violet-300" /> Phase 1 Active
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-outfit">Career Intelligence</h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Build your professional profile, upload your resume, and let AI extract your skills and experience.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/career/resume" className="btn btn-secondary flex items-center gap-2">
              <Upload size={16} /> Upload Resume
            </Link>
            <Link href="/career/profile" className="btn btn-primary flex items-center gap-2 shadow-lg shadow-violet-500/25">
              <User size={16} /> Edit Profile
            </Link>
          </div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Resume Card */}
        <div className="card group hover:border-violet-500/30 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <FileText size={18} className="text-violet-400" />
            </div>
            <h3 className="font-bold text-slate-200 font-outfit">Resume</h3>
          </div>
          {latestResume ? (
            <div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold mb-3 ${resumeStatus?.bg} ${resumeStatus?.color}`}>
                {resumeStatus && <resumeStatus.icon size={12} />}
                {resumeStatus?.label}
              </div>
              <p className="text-xs text-slate-400 truncate">{latestResume.fileName}</p>
              <p className="text-[10px] text-slate-500 mt-1">
                {new Date(latestResume.createdAt).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-slate-800/60 border-slate-700 text-slate-400 mb-3">
                <AlertCircle size={12} /> Not uploaded
              </div>
              <Link href="/career/resume" className="block text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Upload now →
              </Link>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <div className="card group hover:border-violet-500/30 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <User size={18} className="text-cyan-400" />
            </div>
            <h3 className="font-bold text-slate-200 font-outfit">Profile</h3>
          </div>
          {profileComplete ? (
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-emerald-500/10 border-emerald-500/20 text-emerald-400 mb-3">
                <CheckCircle2 size={12} /> Complete
              </div>
              {profile?.headline && <p className="text-xs text-slate-300 truncate">{profile.headline}</p>}
              {profile?.location && <p className="text-[10px] text-slate-500 mt-1">{profile.location}</p>}
            </div>
          ) : (
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-amber-500/10 border-amber-500/20 text-amber-400 mb-3">
                <AlertCircle size={12} /> Needs review
              </div>
              <Link href="/career/profile" className="block text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Complete profile →
              </Link>
            </div>
          )}
        </div>

        {/* Skills Card */}
        <div className="card group hover:border-violet-500/30 transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <BrainCircuit size={18} className="text-emerald-400" />
            </div>
            <div className="flex-1 flex items-center justify-between">
              <h3 className="font-bold text-slate-200 font-outfit">Skills</h3>
              <span className="text-xs text-slate-400">{skills.length} extracted</span>
            </div>
          </div>
          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {skills.slice(0, 8).map((cs) => (
                <span key={cs.skillId} className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-300 font-medium">
                  {cs.skill.name}
                </span>
              ))}
              {skills.length > 8 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] text-slate-500">
                  +{skills.length - 8} more
                </span>
              )}
            </div>
          ) : (
            <div>
              <p className="text-xs text-slate-500 mb-2">No skills extracted yet</p>
              <Link href="/career/skills" className="block text-xs text-violet-400 hover:text-violet-300 transition-colors">
                Add skills manually →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="font-bold text-lg text-slate-100 mb-4 font-outfit">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/career/resume', icon: Upload, label: 'Upload / Manage Resume', desc: 'Upload PDF and trigger AI parsing' },
            { href: '/career/profile', icon: User, label: 'Edit Profile', desc: 'Update headline, summary, preferences' },
            { href: '/career/skills', icon: BrainCircuit, label: 'Manage Skills', desc: 'View, add, or remove skills' },
          ].map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{label}</p>
                <p className="text-[11px] text-slate-500">{desc}</p>
              </div>
              <ArrowRight size={14} className="text-slate-600 group-hover:text-violet-400 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
