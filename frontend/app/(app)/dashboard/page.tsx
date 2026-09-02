'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { DashboardStats, Campaign } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import {
  Send, Users, CheckCircle2, XCircle, Clock, TrendingUp, Plus, ArrowRight, Zap
} from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dashboard/stats')
      .then((res) => setStats(res.data))
      .catch(() => toast.error('Failed to load dashboard stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Campaigns',
      value: stats?.totalCampaigns ?? 0,
      icon: Send,
      color: '#8b5cf6',
      gradient: 'from-violet-500/20 to-violet-500/0',
    },
    {
      label: 'Emails Sent',
      value: stats?.totalSent ?? 0,
      icon: CheckCircle2,
      color: '#10b981',
      gradient: 'from-emerald-500/20 to-emerald-500/0',
    },
    {
      label: 'Failed',
      value: stats?.totalFailed ?? 0,
      icon: XCircle,
      color: '#ef4444',
      gradient: 'from-red-500/20 to-red-500/0',
    },
    {
      label: 'Today\'s Sent',
      value: stats?.todaySent ?? 0,
      icon: TrendingUp,
      color: '#06b6d4',
      gradient: 'from-cyan-500/20 to-cyan-500/0',
    },
    {
      label: 'Total Contacts',
      value: stats?.totalContacts ?? 0,
      icon: Users,
      color: '#f59e0b',
      gradient: 'from-amber-500/20 to-amber-500/0',
    },
    {
      label: 'Pending',
      value: stats?.totalPending ?? 0,
      icon: Clock,
      color: '#a78bfa',
      gradient: 'from-violet-400/20 to-violet-400/0',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Your recruiter outreach overview
          </p>
        </div>
        <Link href="/campaigns/new" className="btn btn-primary">
          <Plus size={16} />
          New Campaign
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="stat-card">
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${card.color}20` }}
                >
                  <Icon size={20} style={{ color: card.color }} />
                </div>
              </div>
              <p className="text-3xl font-bold mb-1" style={{ color: card.color }}>
                {card.value.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--text-secondary)] font-medium">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Recent Campaigns */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent Campaigns</h2>
          <Link href="/campaigns" className="btn btn-ghost btn-sm">
            View All <ArrowRight size={14} />
          </Link>
        </div>

        {!stats?.recentCampaigns?.length ? (
          <div className="empty-state">
            <Zap size={48} />
            <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">No campaigns yet</h3>
            <p className="text-sm mb-4">Create your first campaign to start reaching recruiters</p>
            <Link href="/campaigns/new" className="btn btn-primary">
              <Plus size={16} />
              Create Campaign
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Pending</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.recentCampaigns.map((c: Campaign) => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td>{c.recipientCount}</td>
                    <td className="text-emerald-400">{c.sentCount}</td>
                    <td className="text-red-400">{c.failedCount}</td>
                    <td className="text-amber-400">{c.pendingCount}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <Link href={`/campaigns/${c.id}`} className="btn btn-ghost btn-sm">
                        View <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
