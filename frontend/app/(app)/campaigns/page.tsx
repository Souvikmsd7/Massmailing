'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Campaign } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import { Plus, Search, ArrowRight, Send, ChevronLeft, ChevronRight, Eye, MousePointer, Clock } from 'lucide-react';
import { showToast } from '@/lib/swal';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api.get(`/api/campaigns?page=${page}&limit=${limit}`)
      .then((res) => {
        setCampaigns(res.data.campaigns);
        setTotal(res.data.total);
      })
      .catch(() => showToast('error', 'Failed to load campaigns'))
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = campaigns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subject.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-outfit text-white flex items-center gap-2">
            <Send className="text-violet-400" size={24} />
            Outreach Campaigns
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your recruiter email campaigns ({total} total)
          </p>
        </div>
        <Link href="/campaigns/new" className="btn btn-primary btn-lg shadow-lg shadow-violet-500/20">
          <Plus size={18} />
          New Campaign
        </Link>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by campaign name or email subject..."
          className="input pl-10 text-sm bg-slate-900/80 border-slate-800"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mx-auto mb-4">
            <Send size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-200 mb-1">
            {search ? `No campaigns match "${search}"` : 'No campaigns created yet'}
          </h3>
          <p className="text-xs text-slate-400 mb-6 max-w-sm">Launch a personalized 1-to-1 cold outreach campaign to reach recruiters directly.</p>
          {!search && (
            <Link href="/campaigns/new" className="btn btn-primary">
              <Plus size={16} /> Create Your First Campaign
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="table-container shadow-xl">
            <table>
              <thead>
                <tr>
                  <th className="pl-4">Campaign & Subject</th>
                  <th>Created By</th>
                  <th>Created</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Opens / Clicks</th>
                  <th>Status</th>
                  <th className="pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const progress = c.recipientCount > 0
                    ? Math.round(((c.sentCount + c.failedCount) / c.recipientCount) * 100)
                    : 0;

                  return (
                    <tr key={c.id} className="hover:bg-slate-900/50 transition">
                      <td className="pl-4">
                        <div className="font-semibold text-slate-100">{c.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5 max-w-[280px] truncate font-mono">
                          {c.subject}
                        </div>
                        {c.status === 'SCHEDULED' && c.scheduledAt && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-violet-300 font-medium">
                            <Clock size={11} className="text-violet-400" />
                            Scheduled: {new Date(c.scheduledAt).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </div>
                        )}
                        {(c.status === 'SENDING' || c.status === 'PAUSED' || c.status === 'PROCESSING') && (
                          <div className="mt-2 max-w-[200px]">
                            <div className="progress-bar" style={{ height: 4 }}>
                              <div className="progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">{progress}% completed</span>
                          </div>
                        )}
                      </td>
                      <td className="text-xs">
                        <div className="font-medium text-slate-200">{c.createdBy || '—'}</div>
                        {c.updatedBy && c.updatedBy !== c.createdBy && (
                          <div className="text-[10px] text-slate-500 mt-0.5">Edit: {c.updatedBy}</div>
                        )}
                      </td>
                      <td className="text-slate-400 text-xs font-mono">
                        {new Date(c.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </td>
                      <td className="font-mono text-slate-300">{c.recipientCount}</td>
                      <td className="text-emerald-400 font-mono font-medium">{c.sentCount}</td>
                      <td className="text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Eye size={12} /> {(c as { openedCount?: number }).openedCount || 0}
                          </span>
                          <span className="text-cyan-400 flex items-center gap-1">
                            <MousePointer size={12} /> {(c as { clickedCount?: number }).clickedCount || 0}
                          </span>
                        </div>
                      </td>
                      <td><StatusBadge status={c.status} /></td>
                      <td className="pr-4 text-right">
                        <Link href={`/campaigns/${c.id}`} className="btn btn-ghost btn-sm text-violet-300 hover:text-white">
                          Details <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-ghost btn-sm"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-slate-400 font-medium font-mono">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-ghost btn-sm"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
