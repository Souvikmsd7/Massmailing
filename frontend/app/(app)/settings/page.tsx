'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Settings } from '@/lib/types';
import { showToast } from '@/lib/swal';
import { Save, User, Mail, Phone, Link2, Globe, Send, RefreshCw } from 'lucide-react';

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

  useEffect(() => {
    api.get('/api/settings')
      .then((res) => setSettings(res.data.settings))
      .catch(() => showToast('error', 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Configure your sender profile and sending preferences
        </p>
      </div>

      {/* Sender Information */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <User size={18} className="text-violet-400" />
          Sender Information
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          These values are used to personalize {"{{sender_name}}"}, {"{{sender_email}}"}, etc. in your email templates.
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
      <div className="card mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Send size={18} className="text-violet-400" />
          Sending Settings
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
            <p className="text-xs text-[var(--text-muted)] mt-1">Safety limit to prevent accidental large sends</p>
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
            <p className="text-xs text-[var(--text-muted)] mt-1">Number of emails per batch</p>
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
            <p className="text-xs text-[var(--text-muted)] mt-1">Milliseconds between batches (10000 = 10s)</p>
          </div>

          <div className="form-group col-span-2">
            <label className="label">Maximum Retry Attempts</label>
            <input
              type="number"
              value={settings.maxRetries}
              onChange={(e) => setSettings(s => ({ ...s, maxRetries: parseInt(e.target.value) || 3 }))}
              min={0} max={10}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* SMTP note */}
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-6 text-sm text-blue-400">
        <p className="font-semibold mb-1">🔒 SMTP Configuration</p>
        <p className="text-blue-300/80">
          SMTP credentials (host, port, username, password) are configured via environment variables
          on the backend for security. Edit <code className="text-violet-400">.env</code> file in the
          backend directory.
        </p>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-lg">
        {saving ? (
          <><span className="spinner" style={{ width: 18, height: 18 }} /> Saving...</>
        ) : (
          <><Save size={18} /> Save Settings</>
        )}
      </button>
    </div>
  );
}
