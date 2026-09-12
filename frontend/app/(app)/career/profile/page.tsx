'use client';

import { useEffect, useState } from 'react';
import { getProfile, updateProfile } from '@/lib/career/candidateApi';
import { CandidateProfile } from '@/lib/types';
import { showToast } from '@/lib/swal';
import { User, Save, MapPin, DollarSign, Briefcase, Clock, Globe, Loader2 } from 'lucide-react';

const remoteOptions = [
  { value: '', label: 'Not specified' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Partial<CandidateProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferredLocationsInput, setPreferredLocationsInput] = useState('');
  const [preferredRolesInput, setPreferredRolesInput] = useState('');

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (p) {
          setProfile(p);
          setPreferredLocationsInput((p.preferredLocations ?? []).join(', '));
          setPreferredRolesInput((p.preferredRoles ?? []).join(', '));
        }
      })
      .catch(() => showToast('error', 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile({
        ...profile,
        preferredLocations: preferredLocationsInput.split(',').map((s) => s.trim()).filter(Boolean),
        preferredRoles: preferredRolesInput.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setProfile(updated);
      showToast('success', 'Profile saved!');
    } catch {
      showToast('error', 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    );
  }

  const field = (label: string, id: string, key: keyof CandidateProfile, type = 'text', placeholder = '') => (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
      <input
        id={id}
        type={type}
        value={(profile[key] as string | number | undefined) ?? ''}
        onChange={(e) => setProfile((p) => ({ ...p, [key]: type === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value }))}
        placeholder={placeholder}
        className="input w-full"
      />
    </div>
  );

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-outfit">Candidate Profile</h1>
          <p className="text-sm text-slate-400 mt-1">AI-extracted fields are editable — always review before use</p>
        </div>
        <button
          id="save-profile-btn"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary flex items-center gap-2"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>

      {/* Basic Info */}
      <div className="card space-y-4">
        <h2 className="font-bold text-slate-200 font-outfit flex items-center gap-2">
          <User size={16} className="text-violet-400" /> Basic Information
        </h2>
        {field('Headline', 'profile-headline', 'headline', 'text', 'e.g. Senior Software Engineer')}
        <div>
          <label htmlFor="profile-summary" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Summary</label>
          <textarea
            id="profile-summary"
            value={profile.summary ?? ''}
            onChange={(e) => setProfile((p) => ({ ...p, summary: e.target.value }))}
            rows={4}
            placeholder="Brief professional summary..."
            className="input w-full resize-none"
          />
        </div>
        {field('Years of Experience', 'profile-years', 'yearsOfExperience', 'number', '5')}
      </div>

      {/* Location */}
      <div className="card space-y-4">
        <h2 className="font-bold text-slate-200 font-outfit flex items-center gap-2">
          <MapPin size={16} className="text-cyan-400" /> Location & Remote
        </h2>
        {field('Current Location', 'profile-location', 'location', 'text', 'e.g. New York, NY')}
        <div>
          <label htmlFor="profile-preferred-locations" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Preferred Locations</label>
          <input
            id="profile-preferred-locations"
            type="text"
            value={preferredLocationsInput}
            onChange={(e) => setPreferredLocationsInput(e.target.value)}
            placeholder="e.g. New York, San Francisco, London (comma-separated)"
            className="input w-full"
          />
        </div>
        <div>
          <label htmlFor="profile-remote" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Remote Preference</label>
          <select
            id="profile-remote"
            value={profile.remotePreference ?? ''}
            onChange={(e) => setProfile((p) => ({ ...p, remotePreference: e.target.value || null }))}
            className="input w-full"
          >
            {remoteOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Work Preferences */}
      <div className="card space-y-4">
        <h2 className="font-bold text-slate-200 font-outfit flex items-center gap-2">
          <Briefcase size={16} className="text-emerald-400" /> Work Preferences
        </h2>
        <div>
          <label htmlFor="profile-preferred-roles" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Preferred Roles</label>
          <input
            id="profile-preferred-roles"
            type="text"
            value={preferredRolesInput}
            onChange={(e) => setPreferredRolesInput(e.target.value)}
            placeholder="e.g. Software Engineer, Full-stack Developer (comma-separated)"
            className="input w-full"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-salary-min" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Salary Min (USD)</label>
            <input
              id="profile-salary-min"
              type="number"
              value={profile.salaryMin ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, salaryMin: e.target.value ? Number(e.target.value) : null }))}
              placeholder="80000"
              className="input w-full"
            />
          </div>
          <div>
            <label htmlFor="profile-salary-max" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Salary Max (USD)</label>
            <input
              id="profile-salary-max"
              type="number"
              value={profile.salaryMax ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, salaryMax: e.target.value ? Number(e.target.value) : null }))}
              placeholder="120000"
              className="input w-full"
            />
          </div>
        </div>
      </div>

      {/* Availability */}
      <div className="card space-y-4">
        <h2 className="font-bold text-slate-200 font-outfit flex items-center gap-2">
          <Clock size={16} className="text-amber-400" /> Availability
        </h2>
        {field('Notice Period', 'profile-notice', 'noticePeriod', 'text', 'e.g. 2 weeks, 1 month, Immediate')}
        <div>
          <label htmlFor="profile-work-auth" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Work Authorization</label>
          <input
            id="profile-work-auth"
            type="text"
            value={profile.workAuthorization ?? ''}
            onChange={(e) => setProfile((p) => ({ ...p, workAuthorization: e.target.value }))}
            placeholder="e.g. US Citizen, OPT, H1B, EU Work Permit"
            className="input w-full"
          />
        </div>
      </div>

      {/* Save Button (bottom) */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary flex items-center gap-2"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
