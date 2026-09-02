'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Campaign, Recipient } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import { toast } from 'sonner';
import {
  ArrowLeft, Download, Play, Pause, Square, RefreshCw,
  Mail, CheckCircle2, XCircle, Clock, Send, Users, Wifi
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentEmail, setCurrentEmail] = useState('');
  const [filter, setFilter] = useState<string>('ALL');
  const [liveConnected, setLiveConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  const loadCampaign = useCallback(async () => {
    try {
      const res = await api.get(`/api/campaigns/${id}`);
      setCampaign(res.data.campaign);
      setRecipients(res.data.campaign.recipients || []);
    } catch {
      toast.error('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Connect to SSE
  useEffect(() => {
    loadCampaign();

    const token = localStorage.getItem('mm_token');
    const url = `${API_URL}/api/campaigns/${id}/progress?token=${token}`;

    const es = new EventSource(url);
    sseRef.current = es;

    es.onopen = () => setLiveConnected(true);
    es.onerror = () => setLiveConnected(false);

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'state') {
        setCampaign((prev) => prev ? {
          ...prev,
          status: data.status,
          sentCount: data.sentCount,
          failedCount: data.failedCount,
          pendingCount: data.pendingCount,
        } : prev);
        return;
      }

      if (data.type === 'sending') {
        setCurrentEmail(data.email);
        setRecipients((prev) =>
          prev.map((r) => r.id === data.recipientId ? { ...r, status: 'SENDING' } : r)
        );
      }

      if (data.type === 'sent') {
        setCurrentEmail('');
        setRecipients((prev) =>
          prev.map((r) => r.id === data.recipientId
            ? { ...r, status: 'SENT', sentAt: new Date().toISOString() }
            : r
          )
        );
        setCampaign((prev) => prev ? {
          ...prev,
          sentCount: prev.sentCount + 1,
          pendingCount: Math.max(0, prev.pendingCount - 1),
        } : prev);
      }

      if (data.type === 'failed') {
        setRecipients((prev) =>
          prev.map((r) => r.id === data.recipientId
            ? { ...r, status: 'FAILED', errorMessage: data.error }
            : r
          )
        );
        setCampaign((prev) => prev ? {
          ...prev,
          failedCount: prev.failedCount + 1,
          pendingCount: Math.max(0, prev.pendingCount - 1),
        } : prev);
      }

      if (data.type === 'completed' || data.type === 'stopped') {
        setCampaign((prev) => prev ? {
          ...prev,
          status: data.type === 'completed' ? (data.status || 'COMPLETED') : 'STOPPED',
          sentCount: data.sentCount ?? prev.sentCount,
          failedCount: data.failedCount ?? prev.failedCount,
          pendingCount: 0,
        } : prev);
        setCurrentEmail('');
        setLiveConnected(false);
        if (data.type === 'completed') toast.success('Campaign completed!');
      }

      if (data.type === 'paused') {
        setCampaign((prev) => prev ? { ...prev, status: 'PAUSED' } : prev);
      }
      if (data.type === 'resumed') {
        setCampaign((prev) => prev ? { ...prev, status: 'SENDING' } : prev);
      }
    };

    return () => {
      es.close();
    };
  }, [id, loadCampaign]);

  const action = async (endpoint: string, successMsg: string) => {
    setActionLoading(true);
    try {
      await api.post(`/api/campaigns/${id}/${endpoint}`);
      toast.success(successMsg);
      await loadCampaign();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !campaign) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  const progress = campaign.recipientCount > 0
    ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.recipientCount) * 100)
    : 0;

  const isActive = campaign.status === 'SENDING';
  const isPaused = campaign.status === 'PAUSED';
  const isDone = campaign.status === 'COMPLETED' || campaign.status === 'STOPPED' || campaign.status === 'FAILED';

  const filteredRecipients = filter === 'ALL'
    ? recipients
    : recipients.filter((r) => r.status === filter);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{campaign.name}</h1>
            <p className="text-sm text-[var(--text-secondary)] truncate max-w-lg">{campaign.subject}</p>
          </div>
          <StatusBadge status={campaign.status} />
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          {(isActive || isPaused) && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              {liveConnected ? (
                <>
                  <span className="pulse-dot" />
                  <span className="text-emerald-400">Live</span>
                </>
              ) : (
                <>
                  <Wifi size={12} className="text-[var(--text-muted)]" />
                  Connecting...
                </>
              )}
            </div>
          )}

          {/* Controls */}
          {campaign.status === 'DRAFT' && (
            <button onClick={() => action('start', 'Campaign started!')} disabled={actionLoading} className="btn btn-primary">
              <Play size={16} /> Start
            </button>
          )}
          {isActive && (
            <>
              <button onClick={() => action('pause', 'Campaign paused')} disabled={actionLoading} className="btn btn-secondary">
                <Pause size={15} /> Pause
              </button>
              <button onClick={() => action('stop', 'Campaign stopped')} disabled={actionLoading} className="btn btn-danger">
                <Square size={15} /> Stop
              </button>
            </>
          )}
          {isPaused && (
            <>
              <button onClick={() => action('resume', 'Campaign resumed!')} disabled={actionLoading} className="btn btn-primary">
                <Play size={15} /> Resume
              </button>
              <button onClick={() => action('stop', 'Campaign stopped')} disabled={actionLoading} className="btn btn-danger">
                <Square size={15} /> Stop
              </button>
            </>
          )}
          {isDone && campaign.failedCount > 0 && (
            <button onClick={() => action('retry', 'Retrying failed emails...')} disabled={actionLoading} className="btn btn-secondary">
              <RefreshCw size={15} /> Retry Failed ({campaign.failedCount})
            </button>
          )}

          {/* Export */}
          <a href={`${API_URL}/api/campaigns/${id}/export`} className="btn btn-ghost btn-sm">
            <Download size={15} /> Export CSV
          </a>
        </div>
      </div>

      {/* Progress Panel */}
      {(isActive || isPaused || isDone) && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">
              {isActive ? (
                <span className="flex items-center gap-2">
                  <Send size={16} className="text-cyan-400 animate-pulse" />
                  Sending...
                </span>
              ) : isPaused ? 'Paused' : 'Complete'}
            </h3>
            <span className="text-2xl font-bold gradient-text">{progress}%</span>
          </div>

          <div className="progress-bar mb-4" style={{ height: 10 }}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>

          {currentEmail && (
            <div className="flex items-center gap-2 mb-4 text-sm text-cyan-400">
              <Mail size={14} className="animate-bounce" />
              Sending to: <strong>{currentEmail}</strong>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total', value: campaign.recipientCount, color: 'text-violet-400', icon: Users },
              { label: 'Sent', value: campaign.sentCount, color: 'text-emerald-400', icon: CheckCircle2 },
              { label: 'Failed', value: campaign.failedCount, color: 'text-red-400', icon: XCircle },
              { label: 'Pending', value: campaign.pendingCount, color: 'text-amber-400', icon: Clock },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="text-center p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                  <Icon size={16} className={`mx-auto mb-1 ${s.color}`} />
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-[var(--text-muted)]">{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recipients Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recipients ({recipients.length})</h3>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {['ALL', 'PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED'].map((f) => {
              const count = f === 'ALL' ? recipients.length : recipients.filter(r => r.status === f).length;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`btn btn-sm ${filter === f ? 'btn-secondary' : 'btn-ghost'}`}
                >
                  {f} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {filteredRecipients.length === 0 ? (
          <div className="empty-state py-8">
            <Users size={32} className="mb-2" />
            <p>No recipients with status: {filter}</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Job Title</th>
                  <th>Status</th>
                  <th>Sent At</th>
                  <th>Retries</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipients.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.name || '—'}</td>
                    <td className="text-violet-300">{r.email}</td>
                    <td className="text-[var(--text-secondary)]">{r.company || '—'}</td>
                    <td className="text-[var(--text-secondary)]">{r.jobTitle || '—'}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="text-sm text-[var(--text-secondary)]">
                      {r.sentAt ? new Date(r.sentAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit', minute: '2-digit'
                      }) : '—'}
                    </td>
                    <td className="text-center">
                      {r.retryCount > 0 ? (
                        <span className="text-amber-400 text-sm">{r.retryCount}</span>
                      ) : '—'}
                    </td>
                    <td className="max-w-[200px]">
                      {r.errorMessage ? (
                        <span className="text-red-400 text-xs truncate block" title={r.errorMessage}>
                          {r.errorMessage}
                        </span>
                      ) : '—'}
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
