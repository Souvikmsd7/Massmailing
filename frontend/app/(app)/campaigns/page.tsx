'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Campaign } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import { Plus, Search, ArrowRight, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.get(`/api/campaigns?page=${page}&limit=${limit}`)
      .then((res) => {
        setCampaigns(res.data.campaigns);
        setTotal(res.data.total);
      })
      .catch(() => toast.error('Failed to load campaigns'))
      .finally(() => setLoading(false));
  }, [page]);

  const filtered = campaigns.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            {total} total campaign{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/campaigns/new" className="btn btn-primary">
          <Plus size={16} />
          New Campaign
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campaigns..."
          className="input pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <Send size={48} />
          <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">
            {search ? 'No campaigns match your search' : 'No campaigns yet'}
          </h3>
          {!search && (
            <Link href="/campaigns/new" className="btn btn-primary mt-2">
              <Plus size={16} />
              Create Your First Campaign
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Created</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Pending</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const progress = c.recipientCount > 0
                    ? Math.round(((c.sentCount + c.failedCount) / c.recipientCount) * 100)
                    : 0;

                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5 max-w-[250px] truncate">
                          {c.subject}
                        </div>
                        {(c.status === 'SENDING' || c.status === 'PAUSED') && (
                          <div className="mt-1">
                            <div className="progress-bar" style={{ height: 3 }}>
                              <div className="progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)]">{progress}%</span>
                          </div>
                        )}
                      </td>
                      <td className="text-[var(--text-secondary)] text-sm">
                        {new Date(c.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </td>
                      <td>{c.recipientCount}</td>
                      <td className="text-emerald-400 font-medium">{c.sentCount}</td>
                      <td className={c.failedCount > 0 ? 'text-red-400 font-medium' : 'text-[var(--text-muted)]'}>
                        {c.failedCount}
                      </td>
                      <td className="text-amber-400">{c.pendingCount}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>
                        <Link href={`/campaigns/${c.id}`} className="btn btn-ghost btn-sm">
                          View <ArrowRight size={12} />
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
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-ghost btn-sm"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-[var(--text-secondary)]">
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
