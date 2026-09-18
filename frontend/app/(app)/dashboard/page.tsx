'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { DashboardStats, Campaign } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import {
  Send, Users, CheckCircle2, XCircle, Clock, TrendingUp, Plus, ArrowRight, Zap, Sparkles, BarChart3
} from 'lucide-react';
import { showToast } from '@/lib/swal';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dashboard/stats')
      .then((res) => setStats(res.data))
      .catch(() => showToast('error', 'Failed to load dashboard stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Campaigns',
      value: stats?.totalCampaigns ?? 0,
      icon: Send,
      color: '#a78bfa',
      bgColor: 'rgba(139, 92, 246, 0.12)',
      borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    {
      label: 'Emails Sent',
      value: stats?.totalSent ?? 0,
      icon: CheckCircle2,
      color: '#34d399',
      bgColor: 'rgba(16, 185, 129, 0.12)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    {
      label: 'Today\'s Sent',
      value: stats?.todaySent ?? 0,
      icon: TrendingUp,
      color: '#38bdf8',
      bgColor: 'rgba(6, 182, 212, 0.12)',
      borderColor: 'rgba(6, 182, 212, 0.3)',
    },
    {
      label: 'Total Recipients',
      value: stats?.totalContacts ?? 0,
      icon: Users,
      color: '#fbbf24',
      bgColor: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    {
      label: 'Pending Queue',
      value: stats?.totalPending ?? 0,
      icon: Clock,
      color: '#c4b5fd',
      bgColor: 'rgba(196, 181, 253, 0.12)',
      borderColor: 'rgba(196, 181, 253, 0.3)',
    },
    {
      label: 'Failed Delivery',
      value: stats?.totalFailed ?? 0,
      icon: XCircle,
      color: '#fca5a5',
      bgColor: 'rgba(239, 68, 68, 0.12)',
      borderColor: 'rgba(239, 68, 68, 0.3)',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 md:p-8 bg-gradient-to-r from-violet-950/80 via-slate-900/90 to-slate-950 border border-violet-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="badge badge-violet flex items-center gap-1">
                <Sparkles size={12} className="text-violet-300" /> Executive Outreach Active
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-outfit">Recruiter Outreach Hub</h1>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              Launch targeted 1-to-1 personalized campaigns, track recruiter engagement, and personalise email pitches with AI intelligence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/analytics" className="btn btn-secondary flex items-center gap-2">
              <BarChart3 size={16} /> View Analytics
            </Link>
            <Link href="/campaigns/new" className="btn btn-primary btn-lg flex items-center gap-2 shadow-lg shadow-violet-500/25">
              <Plus size={18} /> New Campaign
            </Link>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <h2 className="text-lg font-bold text-slate-200 mb-4 font-outfit">Platform Engagement Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="stat-card group">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110"
                    style={{ background: card.bgColor, borderColor: card.borderColor }}
                  >
                    <Icon size={20} style={{ color: card.color }} />
                  </div>
                </div>
                <p className="text-3xl font-extrabold mb-1 tracking-tight font-outfit" style={{ color: card.color }}>
                  {card.value.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{card.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-xl text-slate-100 font-outfit">Recent Campaigns</h2>
            <p className="text-xs text-slate-400">Track and monitor your latest outreach performance</p>
          </div>
          <Link href="/campaigns" className="btn btn-ghost btn-sm">
            View All Campaigns <ArrowRight size={14} />
          </Link>
        </div>

        {!stats?.recentCampaigns?.length ? (
          <div className="empty-state">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4">
              <Zap size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-200 mb-1">No campaigns launched yet</h3>
            <p className="text-xs text-slate-400 mb-6 max-w-sm">Create your first personalized 1-to-1 outreach campaign to start connecting with top recruiters.</p>
            <Link href="/campaigns/new" className="btn btn-primary">
              <Plus size={16} /> Create First Campaign
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Recipients</th>
                  <th>Sent</th>
                  <th>Failed</th>
                  <th>Pending</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentCampaigns.map((c: Campaign) => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-semibold text-slate-200">{c.name}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="font-mono text-slate-300">{c.recipientCount}</td>
                    <td className="font-mono font-medium text-emerald-400">{c.sentCount}</td>
                    <td className="font-mono font-medium text-red-400">{c.failedCount}</td>
                    <td className="font-mono font-medium text-amber-400">{c.pendingCount}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <Link href={`/campaigns/${c.id}`} className="btn btn-ghost btn-sm text-violet-300 hover:text-white">
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
