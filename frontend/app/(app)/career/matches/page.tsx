'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listMatches, JobMatchRecord } from '@/lib/career/matchesApi';
import { showToast } from '@/lib/swal';
import {
  Target,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Filter,
} from 'lucide-react';

export default function MatchesPage() {
  const [matches, setMatches] = useState<JobMatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState<number>(0);
  const [selectedMatch, setSelectedMatch] = useState<JobMatchRecord | null>(null);

  const fetchMatches = () => {
    setLoading(true);
    listMatches({ minScore: minScore > 0 ? minScore : undefined })
      .then((res) => {
        setMatches(res.matches);
      })
      .catch(() => showToast('error', 'Failed to load job matches'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minScore]);

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (score >= 60) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-slate-800 text-slate-400 border-slate-700';
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-outfit flex items-center gap-2">
            <Target className="text-indigo-400" size={26} /> My Matched Jobs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deterministic skill matching, hard eligibility filtering, and vector similarity powered by Gemini
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchMatches} className="btn btn-ghost btn-sm flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Filter size={16} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-300">Min Score Filter:</span>
          {[0, 60, 75, 85].map((score) => (
            <button
              key={score}
              onClick={() => setMinScore(score)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                minScore === score
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {score === 0 ? 'All Matches' : `${score}%+`}
            </button>
          ))}
        </div>
      </div>

      {/* Matches List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 2 }} />
        </div>
      ) : matches.length === 0 ? (
        <div className="card empty-state py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-4">
            <Target size={28} />
          </div>
          <h3 className="text-base font-bold text-white font-outfit">No match records found</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
            Head to the Job Board and click &ldquo;Match Me&rdquo; on any job to calculate your compatibility score.
          </p>
          <Link href="/career/jobs" className="btn btn-primary btn-sm mt-4 inline-flex items-center gap-2">
            Browse Job Board <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {matches.map((m) => (
            <div
              key={m.id}
              className="card hover:border-slate-700 transition-all p-5 flex flex-col md:flex-row md:items-center justify-between gap-5"
            >
              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`px-3 py-1 text-sm font-bold rounded-full border ${getScoreBadgeColor(
                      m.overallScore
                    )}`}
                  >
                    {m.overallScore}% Overall Match
                  </span>

                  <span className="text-xs text-slate-400">
                    Hard Filter:{' '}
                    {m.hardFilterResults?.eligible ? (
                      <span className="text-emerald-400 font-semibold">Eligible ✓</span>
                    ) : (
                      <span className="text-amber-400 font-semibold">
                        Ineligible ({m.hardFilterResults?.failedFilters.join(', ')})
                      </span>
                    )}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white font-outfit">
                    {m.job?.title || 'Job Match'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {m.job?.company} {m.job?.location ? `• ${m.job.location}` : ''}
                  </p>
                </div>

                {/* Skills tags */}
                {m.skillMatchResults && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.skillMatchResults.matchedSkills.map((sm) => (
                      <span
                        key={sm.jobSkill}
                        className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium flex items-center gap-1"
                      >
                        ✓ {sm.jobSkill}
                      </span>
                    ))}
                    {m.skillMatchResults.missingSkills.map((ms) => (
                      <span
                        key={ms}
                        className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium flex items-center gap-1"
                      >
                        • Missing: {ms}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 border-t md:border-t-0 border-slate-800 pt-3 md:pt-0">
                <button
                  onClick={() => setSelectedMatch(m)}
                  className="btn btn-primary btn-sm text-xs flex items-center gap-1.5"
                >
                  <Sparkles size={13} /> View AI Match Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Match Details Modal */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 border-indigo-500/30">
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={`inline-block px-3 py-1 text-xs font-bold rounded-full border mb-2 ${getScoreBadgeColor(
                    selectedMatch.overallScore
                  )}`}
                >
                  {selectedMatch.overallScore}% Overall Score
                </span>
                <h2 className="text-xl font-extrabold text-white font-outfit">
                  {selectedMatch.job?.title}
                </h2>
                <p className="text-xs text-slate-400">{selectedMatch.job?.company}</p>
              </div>
              <button
                onClick={() => setSelectedMatch(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Score Component Breakdown */}
            <div className="grid grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-center">
              <div>
                <div className="text-xs text-slate-400">Hard Filters</div>
                <div className="text-lg font-extrabold text-indigo-400">
                  {selectedMatch.hardFilterScore}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Skill Score</div>
                <div className="text-lg font-extrabold text-emerald-400">
                  {selectedMatch.skillScore}%
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Semantic Similarity</div>
                <div className="text-lg font-extrabold text-purple-400">
                  {selectedMatch.semanticScore}%
                </div>
              </div>
            </div>

            {/* AI Explanation Summary */}
            {selectedMatch.explanation && (
              <div className="bg-indigo-950/30 border border-indigo-500/20 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Sparkles size={14} /> Why this job matches you
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {selectedMatch.explanation.summary}
                </p>

                {selectedMatch.explanation.strengths?.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-emerald-400 block mb-1">
                      Strengths:
                    </span>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                      {selectedMatch.explanation.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedMatch.explanation.gaps?.length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-amber-400 block mb-1">
                      Potential Gaps:
                    </span>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5">
                      {selectedMatch.explanation.gaps.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedMatch(null)} className="btn btn-ghost btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
