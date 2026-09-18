'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { showToast } from '@/lib/swal';
import {
  TrendingUp,
  Eye,
  MousePointer,
  Award,
  BarChart3,
  Send,
  FileSpreadsheet,
} from 'lucide-react';

interface SummaryStats {
  totalCampaigns: number;
  totalRecipients: number;
  totalSent: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  deliveryRate: number;
  openRate: number;
  ctrRate: number;
}

interface CampaignPerf {
  id: string;
  name: string;
  status: string;
  sentCount: number;
  failedCount: number;
  openedCount: number;
  clickedCount: number;
  openRate: number;
  ctr: number;
  createdAt: string;
}

interface DailyTrend {
  date: string;
  sent: number;
  opens: number;
  clicks: number;
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignPerf[]>([]);
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sent' | 'opens' | 'clicks'>('opens');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/analytics');
      setSummary(res.data.summary);
      setCampaigns(res.data.campaigns || []);
      setTrends(res.data.dailyTrends || []);
    } catch {
      showToast('error', 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAnalytics();
  }, []);

  const handleExportCSV = () => {
    if (!campaigns.length) return;
    const headers = ['Campaign Name', 'Status', 'Sent', 'Failed', 'Opened', 'Clicked', 'Open Rate (%)', 'CTR (%)', 'Created At'];
    const rows = campaigns.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      c.status,
      c.sentCount,
      c.failedCount,
      c.openedCount,
      c.clickedCount,
      c.openRate,
      c.ctr,
      new Date(c.createdAt).toLocaleDateString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MassMailer_Analytics_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    showToast('success', 'Analytics report exported!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  const maxTrendVal = Math.max(1, ...trends.map((t) => t[activeTab]));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="text-violet-400" size={28} />
            Analytics & Campaign Intelligence
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Real-time delivery performance, open rate tracking, and engagement metrics
          </p>
        </div>

        <button onClick={handleExportCSV} className="btn btn-secondary flex items-center gap-2 self-start md:self-auto">
          <FileSpreadsheet size={16} className="text-emerald-400" />
          Export CSV Report
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Sent</span>
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
              <Send size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-white mt-3">{summary?.totalSent || 0}</p>
          <p className="text-xs text-slate-400 mt-1">
            Across {summary?.totalCampaigns || 0} active campaigns
          </p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Open Rate</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Eye size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-400 mt-3">{summary?.openRate || 0}%</p>
          <p className="text-xs text-slate-400 mt-1">
            {summary?.totalOpened || 0} emails opened
          </p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Click Rate (CTR)</span>
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <MousePointer size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-cyan-400 mt-3">{summary?.ctrRate || 0}%</p>
          <p className="text-xs text-slate-400 mt-1">
            {summary?.totalClicked || 0} link clicks
          </p>
        </div>

        <div className="card p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Delivery Rate</span>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Award size={18} />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-400 mt-3">{summary?.deliveryRate || 100}%</p>
          <p className="text-xs text-slate-400 mt-1">
            {summary?.totalFailed || 0} bounces / failed
          </p>
        </div>
      </div>

      {/* Visual Chart Section */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-semibold text-lg text-slate-100 flex items-center gap-2">
              <TrendingUp size={18} className="text-violet-400" />
              14-Day Activity Trends
            </h2>
            <p className="text-xs text-[var(--text-muted)]">Daily breakdown of email dispatches, open signals, and link clicks</p>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
            {(['opens', 'sent', 'clicks'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-violet-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="h-48 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-slate-800/80">
          {trends.map((t) => {
            const val = t[activeTab];
            const heightPercent = maxTrendVal > 0 ? (val / maxTrendVal) * 100 : 0;
            const formattedDate = new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

            return (
              <div key={t.date} className="flex-1 flex flex-col items-center group relative">
                {/* Tooltip */}
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-150 bg-slate-900 text-slate-100 text-[10px] px-2 py-1 rounded border border-slate-700 pointer-events-none whitespace-nowrap z-20 shadow-xl">
                  <strong>{val}</strong> {activeTab} ({formattedDate})
                </div>

                {/* Bar */}
                <div className="w-full bg-slate-800/40 rounded-t h-full flex items-end">
                  <div
                    style={{ height: `${Math.max(6, heightPercent)}%` }}
                    className={`w-full rounded-t transition-all duration-300 ${
                      activeTab === 'opens'
                        ? 'bg-emerald-500 group-hover:bg-emerald-400'
                        : activeTab === 'clicks'
                        ? 'bg-cyan-500 group-hover:bg-cyan-400'
                        : 'bg-violet-500 group-hover:bg-violet-400'
                    }`}
                  />
                </div>

                {/* Label */}
                <span className="text-[10px] text-slate-500 mt-2 truncate w-full text-center">
                  {formattedDate}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Campaign Performance Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-lg text-slate-100">Campaign Performance Breakdown</h2>
          <p className="text-xs text-[var(--text-muted)]">Detailed engagement metrics per campaign</p>
        </div>

        {campaigns.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No campaigns launched yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900/60 text-slate-400 text-xs border-b border-slate-800">
                  <th className="p-3 pl-4">Campaign Name</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Sent</th>
                  <th className="p-3">Opened</th>
                  <th className="p-3">Clicked</th>
                  <th className="p-3">Open Rate</th>
                  <th className="p-3">CTR</th>
                  <th className="p-3 pr-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-900/40 transition">
                    <td className="p-3 pl-4 font-medium text-slate-100">{c.name}</td>
                    <td className="p-3">
                      <span className={`badge ${
                        c.status === 'COMPLETED' ? 'badge-emerald' :
                        c.status === 'SENDING' ? 'badge-violet' : 'badge-slate'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono">{c.sentCount}</td>
                    <td className="p-3 font-mono text-emerald-400">{c.openedCount}</td>
                    <td className="p-3 font-mono text-cyan-400">{c.clickedCount}</td>
                    <td className="p-3 font-mono font-semibold text-emerald-400">{c.openRate}%</td>
                    <td className="p-3 font-mono font-semibold text-cyan-400">{c.ctr}%</td>
                    <td className="p-3 pr-4 text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString()}
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
