'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Settings } from '@/lib/types';
import { showToast, showConfirm } from '@/lib/swal';
import { Save, User, Mail, Phone, Link2, Globe, Send, Server, Plus, Trash2, Edit, CheckCircle2, XCircle, ShieldCheck, Zap } from 'lucide-react';

interface SmtpAccount {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  dailyLimit: number;
  sentToday: number;
  isActive: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    senderName: '',
    senderEmail: '',
    phone: '',
    linkedin: '',
    portfolio: '',
    maxRecipientsPerCampaign: 500,
    emailBatchSize: 5,
    emailBatchDelay: 10000,
    maxRetries: 3,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Multi-SMTP State
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [editingSmtp, setEditingSmtp] = useState<SmtpAccount | null>(null);
  const [smtpForm, setSmtpForm] = useState({
    name: '',
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: '',
    dailyLimit: 500,
  });
  const [testingSmtp, setTestingSmtp] = useState(false);

  useEffect(() => {
    fetchSettingsAndSmtp();
  }, []);

  const fetchSettingsAndSmtp = async () => {
    try {
      setLoading(true);
      const [setRes, smtpRes] = await Promise.all([
        api.get('/api/settings'),
        api.get('/api/smtp-accounts').catch(() => ({ data: { accounts: [] } })),
      ]);
      setSettings(setRes.data.settings);
      setSmtpAccounts(smtpRes.data.accounts || []);
    } catch {
      showToast('error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put('/api/settings', {
        ...settings,
        emailBatchDelay: settings.emailBatchDelay,
      });
      setSettings(res.data.settings);
      showToast('success', 'Settings saved successfully!');
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSmtpModal = (account?: SmtpAccount) => {
    if (account) {
      setEditingSmtp(account);
      setSmtpForm({
        name: account.name,
        host: account.host,
        port: account.port,
        secure: account.secure,
        username: account.username,
        password: '',
        fromEmail: account.fromEmail,
        fromName: account.fromName,
        dailyLimit: account.dailyLimit,
      });
    } else {
      setEditingSmtp(null);
      setSmtpForm({
        name: '',
        host: '',
        port: 587,
        secure: false,
        username: '',
        password: '',
        fromEmail: '',
        fromName: '',
        dailyLimit: 500,
      });
    }
    setShowSmtpModal(true);
  };

  const handleTestSmtp = async () => {
    if (!smtpForm.host || !smtpForm.username || !smtpForm.password) {
      showToast('warning', 'Please fill in Host, Username, and Password to test connection');
      return;
    }
    try {
      setTestingSmtp(true);
      const res = await api.post('/api/smtp-accounts/test', smtpForm);
      showToast('success', res.data.message || 'SMTP Connection Test Succeeded!');
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'SMTP Connection Failed');
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSmtp) {
        await api.put(`/api/smtp-accounts/${editingSmtp.id}`, smtpForm);
        showToast('success', 'SMTP Account updated!');
      } else {
        await api.post('/api/smtp-accounts', smtpForm);
        showToast('success', 'SMTP Account added!');
      }
      setShowSmtpModal(false);
      fetchSettingsAndSmtp();
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed to save SMTP account');
    }
  };

  const handleToggleSmtpActive = async (account: SmtpAccount) => {
    try {
      await api.put(`/api/smtp-accounts/${account.id}`, { isActive: !account.isActive });
      showToast('info', `Account "${account.name}" ${!account.isActive ? 'activated' : 'deactivated'}`);
      fetchSettingsAndSmtp();
    } catch {
      showToast('error', 'Failed to update account status');
    }
  };

  const handleDeleteSmtp = async (id: string, name: string) => {
    const res = await showConfirm({
      title: 'Delete SMTP Account?',
      text: `Are you sure you want to delete "${name}"?`,
      confirmButtonText: 'Yes, Delete',
    });
    if (!res.isConfirmed) return;
    try {
      await api.delete(`/api/smtp-accounts/${id}`);
      showToast('success', 'SMTP Account deleted');
      fetchSettingsAndSmtp();
    } catch {
      showToast('error', 'Failed to delete SMTP account');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-outfit text-white flex items-center gap-2">
          <Server className="text-violet-400" size={24} />
          System Settings & SMTP Rotation
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Configure sender profiles, Multi-SMTP Account rotation, and sending safety limits
        </p>
      </div>

      {/* Multi-SMTP Accounts & Health Shield */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2 text-slate-100">
              <Server size={18} className="text-violet-400" />
              Multi-SMTP Rotation & Health Shield
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Add multiple SMTP servers. Campaigns will automatically round-robin rotate sending across active servers.
            </p>
          </div>
          <button onClick={() => handleOpenSmtpModal()} className="btn btn-primary btn-sm flex items-center gap-1">
            <Plus size={16} /> Add SMTP Account
          </button>
        </div>

        {smtpAccounts.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-900/50 border border-dashed border-slate-800">
            <ShieldCheck size={32} className="mx-auto text-slate-500 mb-2" />
            <p className="text-sm font-medium text-slate-300">No Custom SMTP Accounts Added</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              System is currently using default environment SMTP settings. Add custom SMTP accounts to enable high-deliverability account rotation and Health Shield protection!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {smtpAccounts.map((account) => (
              <div
                key={account.id}
                className={`p-4 rounded-xl border transition-all ${
                  account.isActive
                    ? 'bg-slate-900/80 border-violet-500/30'
                    : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{account.name}</span>
                      {account.isActive ? (
                        <span className="badge badge-emerald flex items-center gap-1 text-[10px]">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="badge badge-slate flex items-center gap-1 text-[10px]">
                          <XCircle size={12} /> Paused
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      {account.username} ({account.host}:{account.port})
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleSmtpActive(account)}
                      className="btn btn-ghost btn-xs text-slate-400 hover:text-white"
                      title={account.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <Zap size={14} className={account.isActive ? 'text-amber-400' : 'text-slate-500'} />
                    </button>
                    <button
                      onClick={() => handleOpenSmtpModal(account)}
                      className="btn btn-ghost btn-xs text-slate-400 hover:text-violet-400"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteSmtp(account.id, account.name)}
                      className="btn btn-ghost btn-xs text-slate-400 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                  <span>From: {account.fromEmail}</span>
                  <span>
                    Sent Today: <strong className="text-violet-400">{account.sentToday}</strong> / {account.dailyLimit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sender Information */}
      <div className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <User size={18} className="text-violet-400" />
          Sender Profile & Personalization
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          These default values populate {"{{sender_name}}"}, {"{{sender_email}}"}, etc. in your email templates.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="label">Your Name</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={settings.senderName}
                onChange={(e) => setSettings(s => ({ ...s, senderName: e.target.value }))}
                placeholder="John Doe"
                className="input pl-8"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Your Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="email"
                value={settings.senderEmail}
                onChange={(e) => setSettings(s => ({ ...s, senderEmail: e.target.value }))}
                placeholder="john@example.com"
                className="input pl-8"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Phone Number</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => setSettings(s => ({ ...s, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                className="input pl-8"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="label">LinkedIn URL</label>
            <div className="relative">
              <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="url"
                value={settings.linkedin}
                onChange={(e) => setSettings(s => ({ ...s, linkedin: e.target.value }))}
                placeholder="https://linkedin.com/in/johndoe"
                className="input pl-8"
              />
            </div>
          </div>

          <div className="form-group col-span-2">
            <label className="label">Portfolio / Website</label>
            <div className="relative">
              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="url"
                value={settings.portfolio}
                onChange={(e) => setSettings(s => ({ ...s, portfolio: e.target.value }))}
                placeholder="https://yourportfolio.com"
                className="input pl-8"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sending Settings */}
      <div className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Send size={18} className="text-violet-400" />
          Queue Rate & Safety Settings
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group col-span-2">
            <label className="label">Max Recipients Per Campaign</label>
            <input
              type="number"
              value={settings.maxRecipientsPerCampaign}
              onChange={(e) => setSettings(s => ({ ...s, maxRecipientsPerCampaign: parseInt(e.target.value) || 500 }))}
              min={1} max={10000}
              className="input"
            />
          </div>

          <div className="form-group">
            <label className="label">Emails Per Batch</label>
            <input
              type="number"
              value={settings.emailBatchSize}
              onChange={(e) => setSettings(s => ({ ...s, emailBatchSize: parseInt(e.target.value) || 5 }))}
              min={1} max={100}
              className="input"
            />
          </div>

          <div className="form-group">
            <label className="label">Delay Between Batches (ms)</label>
            <input
              type="number"
              value={settings.emailBatchDelay}
              onChange={(e) => setSettings(s => ({ ...s, emailBatchDelay: parseInt(e.target.value) || 10000 }))}
              min={1000} max={300000}
              className="input"
            />
          </div>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-lg">
        {saving ? (
          <><span className="spinner" style={{ width: 18, height: 18 }} /> Saving...</>
        ) : (
          <><Save size={18} /> Save Settings</>
        )}
      </button>

      {/* SMTP Add/Edit Modal */}
      {showSmtpModal && (
        <div className="modal-backdrop" onClick={() => setShowSmtpModal(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Server size={18} className="text-violet-400" />
              {editingSmtp ? 'Edit SMTP Account' : 'Add Multi-SMTP Account'}
            </h2>

            <form onSubmit={handleSaveSmtp} className="space-y-4">
              <div className="form-group">
                <label className="label">Account Friendly Name *</label>
                <input
                  type="text"
                  required
                  value={smtpForm.name}
                  onChange={(e) => setSmtpForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Gmail Work Account / SendGrid Main"
                  className="input"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="form-group col-span-2">
                  <label className="label">SMTP Host *</label>
                  <input
                    type="text"
                    required
                    value={smtpForm.host}
                    onChange={(e) => setSmtpForm(f => ({ ...f, host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Port</label>
                  <input
                    type="number"
                    value={smtpForm.port}
                    onChange={(e) => setSmtpForm(f => ({ ...f, port: parseInt(e.target.value) || 587 }))}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="label">Username / Email *</label>
                  <input
                    type="text"
                    required
                    value={smtpForm.username}
                    onChange={(e) => setSmtpForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="user@gmail.com"
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Password / App Key *</label>
                  <input
                    type="password"
                    required={!editingSmtp}
                    value={smtpForm.password}
                    onChange={(e) => setSmtpForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={editingSmtp ? '•••••••• (unchanged)' : 'App Password'}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="label">From Email *</label>
                  <input
                    type="email"
                    required
                    value={smtpForm.fromEmail}
                    onChange={(e) => setSmtpForm(f => ({ ...f, fromEmail: e.target.value }))}
                    placeholder="you@domain.com"
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label className="label">From Name</label>
                  <input
                    type="text"
                    value={smtpForm.fromName}
                    onChange={(e) => setSmtpForm(f => ({ ...f, fromName: e.target.value }))}
                    placeholder="John Doe"
                    className="input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Daily Send Safety Limit</label>
                <input
                  type="number"
                  value={smtpForm.dailyLimit}
                  onChange={(e) => setSmtpForm(f => ({ ...f, dailyLimit: parseInt(e.target.value) || 500 }))}
                  min={1} max={10000}
                  className="input"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleTestSmtp}
                  disabled={testingSmtp}
                  className="btn btn-ghost btn-sm text-violet-400 hover:text-violet-300"
                >
                  {testingSmtp ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Zap size={16} />}
                  Test Connection
                </button>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowSmtpModal(false)} className="btn btn-ghost">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingSmtp ? 'Update Account' : 'Save Account'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
