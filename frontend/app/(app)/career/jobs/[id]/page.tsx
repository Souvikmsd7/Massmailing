'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getJob } from '@/lib/career/jobsApi';
import { Job } from '@/lib/types';
import { showToast } from '@/lib/swal';
import {
  Briefcase,
  ArrowLeft,
  MapPin,
  Globe,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Building2,
  DollarSign,
  Calendar,
  Sparkles,
} from 'lucide-react';

export default function JobDetailPage({ params }: { params?: { id?: string } }) {
  // Support both Next.js App Router params prop and useParams hook
  const routeParams = useParams();
  const jobId = params?.id || (routeParams?.id as string);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(() => {
    if (!jobId) return;
    setLoading(true);
    getJob(jobId)
      .then(setJob)
      .catch((err) => {
        showToast('error', err?.response?.data?.error?.message || 'Failed to load job details');
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const getConfidenceBadge = (confidence: string, dateStr?: string | null) => {
    if (confidence === 'EXACT' && dateStr) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={13} /> Posted: {new Date(dateStr).toLocaleDateString()} (Exact Date)
        </span>
      );
    }
    if (confidence === 'APPROXIMATE' && dateStr) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertCircle size={13} /> Posted: {new Date(dateStr).toLocaleDateString()} (Approximate Date)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium bg-slate-800 text-slate-400 border border-slate-700">
        <HelpCircle size={13} /> Posted Date Unknown
      </span>
    );
  };

  const getRemoteBadge = (remote: string) => {
    switch (remote) {
      case 'REMOTE':
        return <span className="badge badge-cyan text-xs">Remote</span>;
      case 'HYBRID':
        return <span className="badge badge-purple text-xs">Hybrid</span>;
      case 'ONSITE':
        return <span className="badge badge-slate text-xs">Onsite</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 2 }} />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="card py-16 text-center space-y-4 max-w-2xl mx-auto">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
          <Briefcase size={24} />
        </div>
        <h2 className="text-xl font-bold text-white font-outfit">Job Not Found</h2>
        <p className="text-sm text-slate-400">The requested job listing could not be found or has been removed.</p>
        <Link href="/career/jobs" className="btn btn-ghost inline-flex items-center gap-2 text-xs">
          <ArrowLeft size={14} /> Back to Jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back button */}
      <div>
        <Link href="/career/jobs" className="btn btn-ghost btn-sm inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white">
          <ArrowLeft size={14} /> Back to Jobs
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="card p-6 space-y-4 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white font-outfit tracking-tight">
                {job.normalizedTitle}
              </h1>
              {getRemoteBadge(job.remoteType)}
              {job.employmentType !== 'UNKNOWN' && (
                <span className="badge badge-slate text-xs uppercase">
                  {job.employmentType.replace('_', ' ')}
                </span>
              )}
            </div>

            {job.title !== job.normalizedTitle && (
              <p className="text-xs text-slate-400">
                Original Title: <span className="italic text-slate-300">"{job.title}"</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300 pt-1">
              <span className="font-semibold text-indigo-400 flex items-center gap-1.5">
                <Building2 size={16} /> {job.company}
              </span>

              {job.normalizedLocation && (
                <span className="flex items-center gap-1.5 text-slate-300">
                  <MapPin size={15} className="text-slate-400" /> {job.normalizedLocation}
                </span>
              )}

              {(job.salaryMin || job.salaryMax) && (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <DollarSign size={15} />
                  {job.salaryCurrency || '$'}
                  {job.salaryMin ? job.salaryMin.toLocaleString() : 'N/A'} -{' '}
                  {job.salaryMax ? job.salaryMax.toLocaleString() : 'N/A'}
                </span>
              )}
            </div>
          </div>

          <a
            href={job.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary flex items-center justify-center gap-2 whitespace-nowrap self-start"
          >
            Apply on Source <ExternalLink size={14} />
          </a>
        </div>

        <hr className="border-slate-800/80 my-2" />

        {/* Metadata Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
          <div>{getConfidenceBadge(job.postedAtConfidence, job.postedAt)}</div>

          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-slate-500" />
            <span>Discovered: {new Date(job.discoveredAt).toLocaleDateString()}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Globe size={14} className="text-slate-500" />
            <span>Ingested Source: <span className="font-mono text-slate-300">{job.source}</span></span>
          </div>
        </div>
      </div>

      {/* Extracted Skills Section */}
      {job.skills && job.skills.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-bold text-white font-outfit text-sm flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-400" /> Normalized Skills ({job.skills.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {job.skills.map((skill) => (
              <span
                key={skill}
                className="text-xs px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Job Description Card */}
      <div className="card space-y-4">
        <h2 className="font-bold text-white font-outfit text-base">Job Description</h2>
        {job.description ? (
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans bg-slate-950/40 p-5 rounded-xl border border-slate-800/60">
            {job.description}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">No description available for this job posting.</p>
        )}
      </div>
    </div>
  );
}
