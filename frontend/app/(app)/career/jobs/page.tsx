'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { listJobs, discoverJobs } from '@/lib/career/jobsApi';
import { calculateMatch, listMatches, JobMatchRecord } from '@/lib/career/matchesApi';
import { Job } from '@/lib/types';
import { showToast } from '@/lib/swal';
import {
  Briefcase,
  Search,
  MapPin,
  Globe,
  Clock,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Loader2,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Send,
  Target,
} from 'lucide-react';

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [remoteType, setRemoteType] = useState<string>('');
  const [employmentType, setEmploymentType] = useState<string>('');
  const [postedWithin, setPostedWithin] = useState<string>('');

  // Discover modal/trigger state
  const [showDiscover, setShowDiscover] = useState(false);
  const [discKeywords, setDiscKeywords] = useState('');
  const [discLocation, setDiscLocation] = useState('');
  const [discLimit, setDiscLimit] = useState(20);
  const [discovering, setDiscovering] = useState(false);

  // Job Match State
  const [matchMap, setMatchMap] = useState<Record<string, JobMatchRecord>>({});
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);
  const [selectedMatchModal, setSelectedMatchModal] = useState<JobMatchRecord | null>(null);

  const fetchJobsList = useCallback(() => {
    setLoading(true);
    listJobs({
      search: search.trim() || undefined,
      remoteType: remoteType || undefined,
      employmentType: employmentType || undefined,
      postedWithin: postedWithin || undefined,
      page,
      limit: 10,
    })
      .then((res) => {
        setJobs(res.jobs);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages || Math.ceil(res.pagination.total / 10));
      })
      .catch(() => showToast('error', 'Failed to fetch jobs'))
      .finally(() => setLoading(false));

    // Load existing matches for quick badge rendering
    listMatches({ limit: 100 })
      .then((res) => {
        const map: Record<string, JobMatchRecord> = {};
        for (const m of res.matches) {
          map[m.jobId] = m;
        }
        setMatchMap(map);
      })
      .catch(() => {});
  }, [search, remoteType, employmentType, postedWithin, page]);

  useEffect(() => {
    fetchJobsList();
  }, [fetchJobsList]);

  const handleMatchClick = async (jobId: string) => {
    setMatchingJobId(jobId);
    try {
      const match = await calculateMatch(jobId, true);
      setMatchMap((prev) => ({ ...prev, [jobId]: match }));
      setSelectedMatchModal(match);
      showToast('success', `Calculated compatibility score: ${match.overallScore}%`);
    } catch (err: any) {
      showToast('error', err?.response?.data?.error?.message || 'Failed to match job');
    } finally {
      setMatchingJobId(null);
    }
  };

  const handleTriggerDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discKeywords.trim()) return;

    setDiscovering(true);
    try {
      const res = await discoverJobs({
        query: discKeywords.trim(),
        location: discLocation.trim() || undefined,
        limit: Number(discLimit) || 20,
      });
      showToast('success', res.message || 'Discovery task queued in background!');
      setShowDiscover(false);
      setTimeout(fetchJobsList, 2000);
    } catch (err: any) {
      showToast('error', err?.response?.data?.error?.message || 'Failed to trigger discovery');
    } finally {
      setDiscovering(false);
    }
  };

  const getConfidenceBadge = (confidence: string, dateStr?: string | null) => {
    if (confidence === 'EXACT' && dateStr) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={11} /> {new Date(dateStr).toLocaleDateString()} (Exact)
        </span>
      );
    }
    if (confidence === 'APPROXIMATE' && dateStr) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertCircle size={11} /> {new Date(dateStr).toLocaleDateString()} (Approx)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-400 border border-slate-700">
        <HelpCircle size={11} /> Date Unknown
      </span>
    );
  };

  const getRemoteBadge = (remote: string) => {
    switch (remote) {
      case 'REMOTE':
        return <span className="badge badge-cyan">Remote</span>;
      case 'HYBRID':
        return <span className="badge badge-purple">Hybrid</span>;
      case 'ONSITE':
        return <span className="badge badge-slate">Onsite</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-outfit flex items-center gap-2">
            <Briefcase className="text-indigo-400" size={26} /> Job Discovery & Matching Engine
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse jobs, match candidate skills, and generate AI compatibility explanations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/career/matches" className="btn btn-ghost btn-sm flex items-center gap-2 text-indigo-400">
            <Target size={15} /> My Matches
          </Link>
          <button
            onClick={() => setShowDiscover(!showDiscover)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Sparkles size={16} /> Run Discovery
          </button>
          <button onClick={fetchJobsList} className="btn btn-ghost btn-sm flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Discovery Modal / Form Card */}
      {showDiscover && (
        <div className="card border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white font-outfit flex items-center gap-2 text-lg">
              <Sparkles size={18} className="text-indigo-400" /> Discover External Jobs
            </h2>
            <button
              onClick={() => setShowDiscover(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕ Close
            </button>
          </div>
          <form onSubmit={handleTriggerDiscovery} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Role Keywords <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={discKeywords}
                onChange={(e) => setDiscKeywords(e.target.value)}
                placeholder="e.g. Senior React Engineer"
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Location (Optional)
              </label>
              <input
                type="text"
                value={discLocation}
                onChange={(e) => setDiscLocation(e.target.value)}
                placeholder="e.g. Remote or San Francisco"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Max Jobs to Fetch
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={discLimit}
                  onChange={(e) => setDiscLimit(Number(e.target.value))}
                  min={5}
                  max={50}
                  className="input w-full"
                />
                <button
                  type="submit"
                  disabled={discovering || !discKeywords.trim()}
                  className="btn btn-primary whitespace-nowrap flex items-center gap-2"
                >
                  {discovering ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {discovering ? 'Queuing…' : 'Discover'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Filter Controls Bar */}
      <div className="card p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex-1 w-full md:w-auto flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title, company, or keyword..."
            className="bg-transparent text-xs text-white placeholder-slate-500 border-none outline-none w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={remoteType}
            onChange={(e) => {
              setRemoteType(e.target.value);
              setPage(1);
            }}
            className="input text-xs py-2 px-3 bg-slate-950"
          >
            <option value="">All Remote Types</option>
            <option value="REMOTE">Remote</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ONSITE">Onsite</option>
          </select>

          <select
            value={employmentType}
            onChange={(e) => {
              setEmploymentType(e.target.value);
              setPage(1);
            }}
            className="input text-xs py-2 px-3 bg-slate-950"
          >
            <option value="">All Employment Types</option>
            <option value="FULL_TIME">Full Time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERNSHIP">Internship</option>
            <option value="PART_TIME">Part Time</option>
          </select>

          <select
            value={postedWithin}
            onChange={(e) => {
              setPostedWithin(e.target.value);
              setPage(1);
            }}
            className="input text-xs py-2 px-3 bg-slate-950"
          >
            <option value="">All Dates</option>
            <option value="24h">Past 24 Hours</option>
            <option value="7d">Past 7 Days</option>
            <option value="30d">Past 30 Days</option>
          </select>
        </div>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 2 }} />
        </div>
      ) : jobs.length === 0 ? (
        <div className="card empty-state py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-4">
            <Briefcase size={28} />
          </div>
          <h3 className="text-base font-bold text-white font-outfit">No jobs found</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
            Try adjusting your search filters or click "Run Discovery" above to discover jobs from external sources.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Showing {jobs.length} of {total} jobs</span>
            <span>Page {page} of {totalPages}</span>
          </div>

          {jobs.map((job) => {
            const existingMatch = matchMap[job.id];
            const isMatching = matchingJobId === job.id;

            return (
              <div
                key={job.id}
                className="card hover:border-slate-700 transition-all duration-200 group flex flex-col md:flex-row md:items-center justify-between gap-4 p-5"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/career/jobs/${job.id}`}
                      className="font-bold text-lg text-white hover:text-indigo-400 transition-colors font-outfit"
                    >
                      {job.normalizedTitle}
                    </Link>

                    {/* Match Score Badge */}
                    {existingMatch && (
                      <button
                        onClick={() => setSelectedMatchModal(existingMatch)}
                        className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold border transition-all ${
                          existingMatch.overallScore >= 80
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            : existingMatch.overallScore >= 60
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        <Target size={11} /> Match: {existingMatch.overallScore}%
                      </button>
                    )}

                    {getRemoteBadge(job.remoteType)}
                    {job.employmentType !== 'UNKNOWN' && (
                      <span className="badge badge-slate text-[11px] uppercase">
                        {job.employmentType.replace('_', ' ')}
                      </span>
                    )}
                    {getConfidenceBadge(job.postedAtConfidence, job.postedAt)}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">{job.company}</span>
                    {job.normalizedLocation && (
                      <span className="flex items-center gap-1">
                        <MapPin size={13} className="text-slate-500" /> {job.normalizedLocation}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-500">
                      <Globe size={13} /> Source: {job.source}
                    </span>
                  </div>

                  {job.skills && job.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {job.skills.map((skill) => (
                        <span
                          key={skill}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80">
                  <button
                    onClick={() => handleMatchClick(job.id)}
                    disabled={isMatching}
                    className="btn btn-secondary btn-sm text-xs flex items-center gap-1.5"
                  >
                    {isMatching ? (
                      <Loader2 size={13} className="animate-spin text-indigo-400" />
                    ) : (
                      <Target size={13} className="text-indigo-400" />
                    )}
                    {isMatching ? 'Matching…' : existingMatch ? 'Re-Match' : 'Match Me'}
                  </button>

                  <a
                    href={job.jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm text-xs flex items-center gap-1.5"
                  >
                    Apply <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-ghost btn-sm"
              >
                Previous
              </button>
              <span className="text-xs text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn btn-ghost btn-sm"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Match Details Modal */}
      {selectedMatchModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 border-indigo-500/30">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
                  Match Score: {selectedMatchModal.overallScore}%
                </span>
                <h2 className="text-xl font-extrabold text-white font-outfit">
                  Match Breakdown
                </h2>
              </div>
              <button
                onClick={() => setSelectedMatchModal(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-center">
              <div>
                <div className="text-xs text-slate-400">Hard Filters</div>
                <div className="text-lg font-extrabold text-indigo-400">
                  {selectedMatchModal.hardFilterScore}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Skill Score</div>
                <div className="text-lg font-extrabold text-emerald-400">
                  {selectedMatchModal.skillScore}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Semantic Similarity</div>
                <div className="text-lg font-extrabold text-purple-400">
                  {selectedMatchModal.semanticScore}%
                </div>
              </div>
            </div>

            {selectedMatchModal.explanation && (
              <div className="bg-indigo-950/30 border border-indigo-500/20 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Sparkles size={14} /> AI Match Explanation
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {selectedMatchModal.explanation.summary}
                </p>

                {selectedMatchModal.explanation.strengths?.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-emerald-400 block mb-1">
                      Key Strengths:
                    </span>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                      {selectedMatchModal.explanation.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedMatchModal.explanation.gaps?.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-amber-400 block mb-1">
                      Skill Gaps:
                    </span>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                      {selectedMatchModal.explanation.gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedMatchModal(null)} className="btn btn-ghost btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

