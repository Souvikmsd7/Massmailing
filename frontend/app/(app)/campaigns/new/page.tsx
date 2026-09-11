'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Contact } from '@/lib/types';
import { showToast } from '@/lib/swal';
import {
  Upload, Users, PenSquare, Eye, CheckCircle2, X, Plus, Trash2,
  FileText, AlertCircle, Info, ChevronLeft, ChevronRight, Send,
  Variable, Paperclip, Download, UserCheck, Search, Sparkles, Clock
} from 'lucide-react';
import Papa from 'papaparse';

type Step = 'recipients' | 'compose' | 'preview' | 'confirm';

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'recipients', label: 'Recipients', icon: <Users size={14} /> },
  { key: 'compose', label: 'Compose', icon: <PenSquare size={14} /> },
  { key: 'preview', label: 'Preview', icon: <Eye size={14} /> },
  { key: 'confirm', label: 'Confirm', icon: <CheckCircle2 size={14} /> },
];

const VARIABLES = ['{{name}}', '{{email}}', '{{company}}', '{{job_title}}', '{{phone}}', '{{linkedin}}', '{{sender_name}}'];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('recipients');
  const [campaignName, setCampaignName] = useState('');

  // Recipients state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [csvFilePath, setCsvFilePath] = useState('');
  const [csvRawData, setCsvRawData] = useState<Contact[]>([]);
  const [invalidRows, setInvalidRows] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [inputMode, setInputMode] = useState<'csv' | 'manual'>('csv');
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvMappingStep, setCsvMappingStep] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // HR Directory Modal state
  const [showHRModal, setShowHRModal] = useState(false);
  const [hrContactsList, setHrContactsList] = useState<any[]>([]);
  const [hrSearch, setHrSearch] = useState('');
  const [selectedHRIds, setSelectedHRIds] = useState<string[]>([]);
  const [loadingHR, setLoadingHR] = useState(false);

  // Compose state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(`Hi {{name}},

I hope you are doing well.

I am writing to express my interest in the {{job_title}} position at {{company}}.

I have strong experience in software development and would love to contribute to your team.

I have attached my resume for your consideration.

Thank you for your time.

Best regards,
{{sender_name}}`);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [batchSize, setBatchSize] = useState(5);
  const [batchDelay, setBatchDelay] = useState(10);
  const [enableFollowUp, setEnableFollowUp] = useState(false);
  const [followUpDays, setFollowUpDays] = useState(3);
  const [followUpSubject, setFollowUpSubject] = useState('');
  const [followUpBody, setFollowUpBody] = useState('');
  const resumeRef = useRef<HTMLInputElement>(null);

  // Preview state
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewData, setPreviewData] = useState<{ to: string; subject: string; html: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Saved Templates state
  const [userTemplates, setUserTemplates] = useState<any[]>([]);

  // AI Pitch Generator state
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiRole, setAiRole] = useState('');
  const [aiCompany, setAiCompany] = useState('');
  const [aiJobDescription, setAiJobDescription] = useState('');
  const [aiTone, setAiTone] = useState<'professional' | 'friendly' | 'persuasive' | 'confident'>('professional');
  const [generatingAI, setGeneratingAI] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('mm_selected_template');
    if (saved) {
      try {
        const tpl = JSON.parse(saved);
        if (tpl.subject) setSubject(tpl.subject);
        if (tpl.body) setBody(tpl.body);
        showToast('info', `Loaded template "${tpl.name}"`);
      } catch {}
      localStorage.removeItem('mm_selected_template');
    }

    api.get('/api/templates').then((res) => {
      setUserTemplates(res.data.templates || []);
    }).catch(() => {});
  }, []);

  const handleGenerateAIPitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiRole.trim()) {
      showToast('warning', 'Target Job Role is required');
      return;
    }
    try {
      setGeneratingAI(true);
      const res = await api.post('/api/ai/generate-pitch', {
        role: aiRole,
        company: aiCompany,
        jobDescription: aiJobDescription,
        tone: aiTone,
      });
      setSubject(res.data.subject);
      setBody(res.data.body);
      showToast('success', res.data.source === 'ai' ? '✨ AI Pitch Generated!' : 'Personalized Pitch Generated!');
      setShowAIModal(false);
    } catch {
      showToast('error', 'Failed to generate AI pitch');
    } finally {
      setGeneratingAI(false);
    }
  };

  // Confirm state
  const [submitting, setSubmitting] = useState(false);

  // ---- Helpers ----
  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  const downloadSampleCsv = () => {
    const rows = [
      ['name', 'email', 'company', 'job_title', 'phone', 'linkedin'],
      ['Rahul Sharma', 'rahul.sharma@techcorp.com', 'TechCorp India', 'Engineering Manager', '+91-9876543210', 'linkedin.com/in/rahulsharma'],
      ['Priya Mehta', 'priya.mehta@startupxyz.in', 'StartupXYZ', 'HR Manager', '+91-9123456789', 'linkedin.com/in/priyamehta'],
      ['Amit Verma', 'amit.verma@globalsol.com', 'Global Solutions', 'Technical Recruiter', '+91-9988776655', 'linkedin.com/in/amitverma'],
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'massmailer_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredHRList = hrContactsList.filter((c) => {
    const query = hrSearch.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(query) ||
      (c.company || '').toLowerCase().includes(query) ||
      (c.email || '').toLowerCase().includes(query) ||
      (c.location || '').toLowerCase().includes(query)
    );
  });

  const canGoNext = () => {
    if (step === 'recipients') return contacts.length > 0 && campaignName.trim().length > 0;
    if (step === 'compose') return subject.trim().length > 0 && body.trim().length > 0;
    return true;
  };

  // ---- CSV Upload ----
  const handleCsvUpload = async (file: File) => {
    setCsvUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/contacts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCsvHeaders(res.data.headers);
      setCsvFilePath(res.data.filePath);

      // Auto-detect mapping
      const auto = res.data.autoMapping || {};
      setCsvMapping({
        email: auto.email || '',
        name: auto.name || '',
        company: auto.company || '',
        jobTitle: auto.jobTitle || '',
        phone: auto.phone || '',
        linkedin: auto.linkedin || '',
      });
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed to upload CSV');
    } finally {
      setCsvUploading(false);
    }
  };

  const handleCsvParse = async () => {
    if (!csvMapping.email) {
      showToast('error', 'Please select the email column');
      return;
    }
    try {
      const res = await api.post('/api/contacts/parse', {
        filePath: csvFilePath,
        mapping: csvMapping,
      });
      setContacts(res.data.contacts);
      setInvalidRows(res.data.invalid || []);
      setDuplicates(res.data.duplicates || []);
      setCsvMappingStep(false);
      if (res.data.contacts.length > 0) {
        showToast('success', `Imported ${res.data.contacts.length} valid contacts`);
      }
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed to parse CSV');
    }
  };

  // ---- HR Directory Import Modal ----
  const openHRModal = async () => {
    try {
      setLoadingHR(true);
      setShowHRModal(true);
      const res = await api.get('/api/hr-contacts?limit=500');
      const list = res.data.contacts || [];
      if (list.length === 0) {
        showToast('info', 'No saved HR contacts found in directory');
        setShowHRModal(false);
        return;
      }
      setHrContactsList(list);
      setSelectedHRIds(list.map((c: any) => c.id));
    } catch {
      showToast('error', 'Failed to load HR contacts');
      setShowHRModal(false);
    } finally {
      setLoadingHR(false);
    }
  };

  const handleImportFromHRModal = () => {
    const selected = hrContactsList.filter((c) => selectedHRIds.includes(c.id));
    if (selected.length === 0) {
      showToast('warning', 'Please select at least one contact');
      return;
    }
    const newContacts: Contact[] = selected.map((c) => ({
      name: c.name,
      company: c.company,
      email: c.email,
      phone: c.phone,
    }));

    setContacts((prev) => {
      const existingEmails = new Set(prev.map((item) => item.email.toLowerCase()));
      const filteredNew = newContacts.filter(
        (item) => !existingEmails.has(item.email.toLowerCase())
      );
      return [...prev, ...filteredNew];
    });

    showToast('success', `Imported ${selected.length} contacts from HR Directory`);
    setShowHRModal(false);
  };

  // ---- Manual Entry ----
  const handleManualParse = async () => {
    try {
      const res = await api.post('/api/contacts/validate', { input: manualInput });
      const contacts: Contact[] = res.data.valid.map((email: string) => ({ email }));
      setContacts(contacts);
      if (res.data.invalid.length > 0) {
        showToast('warning', `${res.data.invalid.length} invalid emails were skipped`);
      }
      showToast('success', `${res.data.validCount} valid recipients added`);
    } catch {
      showToast('error', 'Failed to validate emails');
    }
  };

  // ---- Preview ----
  const loadPreview = async (index: number) => {
    setPreviewLoading(true);
    setPreviewIndex(index);
    try {
      const res = await api.post('/api/email/preview', {
        subject,
        body,
        recipient: contacts[index],
      });
      setPreviewData(res.data);
    } catch {
      showToast('error', 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ---- Submit ----
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formData = new FormData();

      const data = {
        name: campaignName,
        subject,
        body,
        batchSize,
        batchDelay: batchDelay * 1000,
        enableFollowUp,
        followUpDays,
        followUpSubject,
        followUpBody,
        recipients: contacts,
      };
      formData.append('data', JSON.stringify(data));

      if (attachment) {
        formData.append('resume', attachment);
      }

      const res = await api.post('/api/campaigns', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const campaignId = res.data.campaign.id;

      // Start campaign immediately
      await api.post(`/api/campaigns/${campaignId}/start`);

      showToast('success', 'Campaign created and started!');
      router.push(`/campaigns/${campaignId}`);
    } catch (err: any) {
      showToast('error', err?.response?.data?.error || 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      const nextStep = STEPS[nextIndex].key;
      if (nextStep === 'preview') loadPreview(0);
      setStep(nextStep);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setStep(STEPS[prevIndex].key);
  };

  const insertVariable = (v: string) => {
    setBody(prev => prev + v);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">New Campaign</h1>
        <p className="text-[var(--text-secondary)] text-sm mt-1">
          Set up your recruiter outreach campaign
        </p>
      </div>

      {/* Step Indicator */}
      <div className="card mb-6">
        <div className="step-indicator">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1">
              <div
                className={`step-dot cursor-pointer ${
                  s.key === step ? 'active' :
                  i < currentStepIndex ? 'completed' : 'inactive'
                }`}
                onClick={() => i < currentStepIndex && setStep(s.key)}
              >
                {i < currentStepIndex ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <div className="ml-2 mr-2 hidden sm:block">
                <p className={`text-xs font-medium ${s.key === step ? 'text-violet-400' : 'text-[var(--text-muted)]'}`}>
                  {s.label}
                </p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`step-line ${i < currentStepIndex ? 'completed' : ''}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Campaign Name (always visible) */}
      <div className="card mb-4">
        <div className="form-group">
          <label className="label">Campaign Name *</label>
          <input
            type="text"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="e.g. Frontend Developer Applications - September 2026"
            className="input"
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="card mb-6">

        {/* STEP 1: Recipients */}
        {step === 'recipients' && (
          <div>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Users size={18} className="text-violet-400" />
              Add Recipients
            </h2>

            {/* Mode toggle */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => { setInputMode('csv'); setContacts([]); }}
                className={`btn btn-sm flex-1 justify-center ${inputMode === 'csv' ? 'btn-primary' : 'btn-ghost'}`}
              >
                <Upload size={14} /> CSV Upload
              </button>
              <button
                onClick={() => { setInputMode('manual'); setContacts([]); }}
                className={`btn btn-sm flex-1 justify-center ${inputMode === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
              >
                <PenSquare size={14} /> Manual Entry
              </button>
              <button
                onClick={openHRModal}
                className="btn btn-sm btn-secondary flex-1 justify-center"
                title="Select saved contacts from HR Contacts Directory"
              >
                <UserCheck size={14} /> Import from HR Directory
              </button>
            </div>

            {inputMode === 'csv' && (
              <div>
                {!csvMappingStep && contacts.length === 0 && (
                  <>
                    <div
                      className="drop-zone mb-4"
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file) handleCsvUpload(file);
                      }}
                    >
                      {csvUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="spinner" />
                          <p className="text-sm text-[var(--text-secondary)]">Uploading...</p>
                        </div>
                      ) : (
                        <>
                          <Upload size={32} className="mx-auto mb-3 text-violet-400" />
                          <p className="font-medium mb-1">Drop your CSV file here</p>
                          <p className="text-sm text-[var(--text-secondary)]">or click to browse</p>
                          <p className="text-xs text-[var(--text-muted)] mt-2">Max 5MB · CSV only</p>
                        </>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleCsvUpload(e.target.files[0])}
                      />
                    </div>

                    <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400">
                      <div className="flex items-start gap-2">
                        <Info size={16} className="flex-shrink-0 mt-0.5" />
                        <div>
                          <strong>Expected format:</strong> name, email, company, job_title, phone, linkedin
                          <br />
                          <code className="text-[10px] opacity-70">Rahul Sharma,rahul@company.com,ABC Tech,Frontend Developer</code>
                        </div>
                      </div>
                      <button
                        onClick={downloadSampleCsv}
                        className="btn btn-sm flex-shrink-0"
                        style={{
                          background: 'rgba(99,102,241,0.15)',
                          border: '1px solid rgba(99,102,241,0.35)',
                          color: '#a5b4fc',
                          fontSize: '0.75rem',
                          gap: '0.35rem',
                          whiteSpace: 'nowrap',
                        }}
                        title="Download a sample CSV you can fill in"
                      >
                        <Download size={13} />
                        Sample CSV
                      </button>
                    </div>
                  </>
                )}

                {/* Column Mapping */}
                {csvMappingStep && (
                  <div>
                    <h3 className="font-medium mb-3">Map CSV Columns</h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                      We detected these headers. Map them to contact fields.
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {['email', 'name', 'company', 'jobTitle', 'phone', 'linkedin'].map((field) => (
                        <div key={field} className="form-group">
                          <label className="label">{field === 'jobTitle' ? 'Job Title' : field.charAt(0).toUpperCase() + field.slice(1)}{field === 'email' ? ' *' : ''}</label>
                          <select
                            className="input"
                            value={csvMapping[field] || ''}
                            onChange={(e) => setCsvMapping(m => ({ ...m, [field]: e.target.value }))}
                          >
                            <option value="">-- Skip --</option>
                            {csvHeaders.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button onClick={handleCsvParse} className="btn btn-primary">
                        Import Contacts
                      </button>
                      <button onClick={() => setCsvMappingStep(false)} className="btn btn-ghost">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Results */}
                {contacts.length > 0 && (
                  <div>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                        <p className="text-2xl font-bold text-emerald-400">{contacts.length}</p>
                        <p className="text-xs text-emerald-300">Valid</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                        <p className="text-2xl font-bold text-red-400">{invalidRows.length}</p>
                        <p className="text-xs text-red-300">Invalid</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                        <p className="text-2xl font-bold text-amber-400">{duplicates.length}</p>
                        <p className="text-xs text-amber-300">Duplicates</p>
                      </div>
                    </div>

                    <div className="table-container max-h-64 overflow-y-auto">
                      <table>
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Name</th>
                            <th>Company</th>
                            <th>Job Title</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {contacts.map((c, i) => (
                            <tr key={i}>
                              <td className="text-violet-300">{c.email}</td>
                              <td>{c.name || '—'}</td>
                              <td>{c.company || '—'}</td>
                              <td>{c.jobTitle || '—'}</td>
                              <td>
                                <button
                                  onClick={() => setContacts(cs => cs.filter((_, j) => j !== i))}
                                  className="text-[var(--text-muted)] hover:text-red-400"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={() => { setContacts([]); setCsvMappingStep(false); }}
                      className="btn btn-ghost btn-sm mt-3"
                    >
                      <Upload size={14} /> Re-upload CSV
                    </button>
                  </div>
                )}
              </div>
            )}

            {inputMode === 'manual' && (
              <div>
                <div className="form-group mb-3">
                  <label className="label">Email Addresses</label>
                  <textarea
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Enter emails separated by newlines, commas, or semicolons:&#10;&#10;hr@company.com&#10;recruiter@company.com&#10;careers@example.com"
                    className="input"
                    style={{ minHeight: 180 }}
                  />
                </div>
                <button onClick={handleManualParse} className="btn btn-secondary">
                  <CheckCircle2 size={16} /> Validate Emails
                </button>

                {contacts.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-3 text-emerald-400">
                      <CheckCircle2 size={16} />
                      <span className="text-sm font-medium">{contacts.length} valid recipients</span>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
                      {contacts.map((c, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                          {c.email}
                          <button onClick={() => setContacts(cs => cs.filter((_, j) => j !== i))}>
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Compose */}
        {step === 'compose' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <PenSquare size={18} className="text-violet-400" />
                Compose Email
              </h2>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowAIModal(true)}
                  className="btn btn-secondary text-xs flex items-center gap-1.5 border-violet-500/40 text-violet-300 hover:text-white"
                >
                  <Sparkles size={14} className="text-cyan-400" />
                  AI Personalize Pitch
                </button>

                {userTemplates.length > 0 && (
                  <select
                    className="input text-xs py-1.5 px-2.5 max-w-xs"
                    defaultValue=""
                    onChange={(e) => {
                      const tpl = userTemplates.find((t) => t.id === e.target.value);
                      if (tpl) {
                        setSubject(tpl.subject);
                        setBody(tpl.body);
                        showToast('success', `Applied template "${tpl.name}"`);
                      }
                    }}
                  >
                    <option value="" disabled>-- Load Template --</option>
                    {userTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="form-group mb-4">
              <label className="label">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Application for Frontend Developer Position"
                className="input"
              />
            </div>

            {/* Variable insert buttons */}
            <div className="mb-3">
              <label className="label mb-2">Insert Variable</label>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVariable(v)}
                    className="btn btn-ghost btn-sm font-mono text-violet-400"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group mb-4">
              <label className="label">Email Body *</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="input font-mono text-sm"
                style={{ minHeight: 320 }}
                placeholder="Hi {{name}},..."
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Use {"{{name}}"}, {"{{company}}"}, {"{{job_title}}"}, etc. for personalization
              </p>
            </div>

            {/* Attachment */}
            <div className="form-group mb-4">
              <label className="label">Email Attachment (Resume / Cover Letter / Documents)</label>
              <div
                className="drop-zone"
                onClick={() => resumeRef.current?.click()}
                style={{ padding: '1rem' }}
              >
                {attachment ? (
                  <div className="flex items-center gap-3">
                    <Paperclip size={20} className="text-emerald-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-100">{attachment.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {(attachment.size / 1024 / 1024) >= 1
                          ? `${(attachment.size / 1024 / 1024).toFixed(2)} MB`
                          : `${(attachment.size / 1024).toFixed(1)} KB`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAttachment(null); }}
                      className="ml-auto p-1 text-slate-400 hover:text-red-400 rounded transition"
                      title="Remove attachment"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <Paperclip size={20} className="text-violet-400" />
                    <span className="text-sm">Attach file (PDF, DOC, DOCX, PNG, JPG, ZIP · max 10MB)</span>
                  </div>
                )}
                <input
                  ref={resumeRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.zip,.rar"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && setAttachment(e.target.files[0])}
                />
              </div>
            </div>

            {/* Sending settings */}
            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              <h3 className="font-medium mb-3 text-sm">Sending Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Emails per batch</label>
                  <input
                    type="number"
                    value={batchSize}
                    onChange={(e) => setBatchSize(parseInt(e.target.value) || 5)}
                    min={1} max={50}
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Delay between batches (seconds)</label>
                  <input
                    type="number"
                    value={batchDelay}
                    onChange={(e) => setBatchDelay(parseInt(e.target.value) || 10)}
                    min={1} max={300}
                    className="input"
                  />
                </div>
              </div>
            </div>

            {/* Automated Follow-Up Sequence */}
            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-violet-400" />
                  <div>
                    <h3 className="font-medium text-sm text-slate-200">Automated Follow-Up Sequence</h3>
                    <p className="text-xs text-[var(--text-muted)]">Automatically send a follow-up email if recipient does not open/reply after X days</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableFollowUp}
                    onChange={(e) => setEnableFollowUp(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                </label>
              </div>

              {enableFollowUp && (
                <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-4">
                  <div className="form-group">
                    <label className="label">Wait Days Before Sending Follow-Up</label>
                    <input
                      type="number"
                      value={followUpDays}
                      onChange={(e) => setFollowUpDays(parseInt(e.target.value) || 3)}
                      min={1} max={30}
                      className="input w-36"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Follow-Up Subject (Leave blank to use 'Re: ' + original subject)</label>
                    <input
                      type="text"
                      value={followUpSubject}
                      onChange={(e) => setFollowUpSubject(e.target.value)}
                      placeholder={`Re: ${subject || 'Original Subject'}`}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Follow-Up Body *</label>
                    <textarea
                      value={followUpBody}
                      onChange={(e) => setFollowUpBody(e.target.value)}
                      className="input font-mono text-sm"
                      style={{ minHeight: 120 }}
                      placeholder="Hi {{name}}, just following up on my previous email regarding {{job_title}} at {{company}}..."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Preview */}
        {step === 'preview' && (
          <div>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Eye size={18} className="text-violet-400" />
              Email Preview
            </h2>

            {/* Recipient selector */}
            <div className="flex items-center gap-3 mb-4">
              <label className="label mb-0">Preview for:</label>
              <select
                className="input flex-1"
                value={previewIndex}
                onChange={(e) => loadPreview(parseInt(e.target.value))}
              >
                {contacts.map((c, i) => (
                  <option key={i} value={i}>
                    {c.name ? `${c.name} (${c.email})` : c.email}
                  </option>
                ))}
              </select>
              <div className="flex gap-1">
                <button
                  onClick={() => loadPreview(Math.max(0, previewIndex - 1))}
                  disabled={previewIndex === 0}
                  className="btn btn-ghost btn-sm"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => loadPreview(Math.min(contacts.length - 1, previewIndex + 1))}
                  disabled={previewIndex === contacts.length - 1}
                  className="btn btn-ghost btn-sm"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {previewLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="spinner" />
              </div>
            ) : previewData ? (
              <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                {/* Email header */}
                <div className="p-4 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                  <div className="flex gap-2 mb-1 text-sm">
                    <span className="text-[var(--text-muted)] w-16">To:</span>
                    <span className="text-violet-400">{previewData.to}</span>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="text-[var(--text-muted)] w-16">Subject:</span>
                    <span className="font-medium">{previewData.subject}</span>
                  </div>
                  {attachment && (
                    <div className="flex gap-2 text-sm mt-1">
                      <span className="text-[var(--text-muted)] w-16">Attachment:</span>
                      <span className="text-amber-400 flex items-center gap-1">
                        <Paperclip size={12} /> {attachment.name}
                      </span>
                    </div>
                  )}
                </div>
                {/* Email body */}
                <div
                  className="p-6 bg-white text-gray-900 text-sm leading-relaxed"
                  style={{ minHeight: 200, whiteSpace: 'pre-wrap', fontFamily: 'Arial, sans-serif' }}
                  dangerouslySetInnerHTML={{ __html: previewData.html }}
                />
              </div>
            ) : null}

            <p className="text-xs text-[var(--text-muted)] mt-3 flex items-center gap-1">
              <Info size={12} /> This is exactly what {contacts[previewIndex]?.email} will receive.
              Each recipient gets their own personalized email.
            </p>
          </div>
        )}

        {/* STEP 4: Confirm */}
        {step === 'confirm' && (
          <div>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-violet-400" />
              Confirm & Send
            </h2>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] mb-1">Campaign</p>
                <p className="font-semibold">{campaignName}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] mb-1">Recipients</p>
                <p className="font-semibold text-violet-400">{contacts.length}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] mb-1">Subject</p>
                <p className="font-semibold text-sm truncate">{subject}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)] mb-1">Batch Settings</p>
                <p className="font-semibold text-sm">{batchSize} emails / {batchDelay}s delay</p>
              </div>
            </div>

            {/* Warning box */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-6">
              <div className="flex gap-3">
                <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-400 mb-1">Ready to send {contacts.length} individual emails</p>
                  <p className="text-sm text-amber-300/80">
                    Each recruiter will receive a <strong>separate, personalized email</strong>.
                    No recruiter will see another's email address.
                    This action cannot be undone once started.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-primary btn-lg w-full justify-center"
            >
              {submitting ? (
                <>
                  <span className="spinner" style={{ width: 18, height: 18 }} />
                  Creating Campaign...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Start Sending {contacts.length} Emails
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          disabled={currentStepIndex === 0}
          className="btn btn-ghost"
        >
          <ChevronLeft size={16} /> Back
        </button>

        {step !== 'confirm' && (
          <button
            onClick={goNext}
            disabled={!canGoNext()}
            className="btn btn-primary"
          >
            {step === 'preview' ? 'Review & Confirm' : 'Continue'}
            <ChevronRight size={16} />
          </button>
        )}
      </div>
      {showHRModal && (
        <div className="modal-overlay">
          <div className="modal max-w-2xl w-full max-h-[85vh] flex flex-col p-6">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
              <div>
                <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                  <UserCheck size={18} className="text-violet-400" />
                  Import from HR Directory
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Select recruiters from your saved HR Directory to add as campaign recipients.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHRModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search & Selection Counter */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search by name, company, email, location..."
                  value={hrSearch}
                  onChange={(e) => setHrSearch(e.target.value)}
                  className="input pl-8 text-xs py-1.5"
                />
              </div>
              <span className="text-xs text-[var(--text-muted)]">
                Selected: <strong className="text-violet-400">{selectedHRIds.length}</strong> / {filteredHRList.length}
              </span>
            </div>

            {/* HR Contacts List Table */}
            <div className="flex-1 overflow-y-auto border border-[var(--border)] rounded-xl mb-4 max-h-[350px]">
              {loadingHR ? (
                <div className="p-8 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
                  <div className="spinner" />
                  Loading HR contacts...
                </div>
              ) : filteredHRList.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                  {hrSearch ? `No contacts match "${hrSearch}"` : 'No saved HR contacts in directory.'}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                    <tr>
                      <th className="w-10 p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedHRIds.length === filteredHRList.length && filteredHRList.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedHRIds(filteredHRList.map((c) => c.id));
                            } else {
                              setSelectedHRIds([]);
                            }
                          }}
                          className="rounded accent-violet-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-2.5 text-left">Name</th>
                      <th className="p-2.5 text-left">Company</th>
                      <th className="p-2.5 text-left">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHRList.map((c) => {
                      const isSelected = selectedHRIds.includes(c.id);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => {
                            setSelectedHRIds((prev) =>
                              prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            );
                          }}
                          className={`cursor-pointer hover:bg-violet-950/20 ${isSelected ? 'bg-violet-950/30' : ''}`}
                        >
                          <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedHRIds((prev) =>
                                  prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                );
                              }}
                              className="rounded accent-violet-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-2.5 font-medium text-slate-100">{c.name}</td>
                          <td className="p-2.5 text-slate-300">{c.company || '—'}</td>
                          <td className="p-2.5 text-violet-300">{c.email}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  if (selectedHRIds.length === filteredHRList.length) setSelectedHRIds([]);
                  else setSelectedHRIds(filteredHRList.map((c) => c.id));
                }}
                className="btn btn-ghost text-xs"
              >
                {selectedHRIds.length === filteredHRList.length ? 'Deselect All' : 'Select All'}
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowHRModal(false)}
                  className="btn btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportFromHRModal}
                  disabled={selectedHRIds.length === 0}
                  className="btn btn-primary text-xs"
                >
                  Import Selected ({selectedHRIds.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Pitch Personalizer Modal */}
      {showAIModal && (
        <div className="modal-overlay">
          <div className="modal max-w-lg w-full">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
              <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                <Sparkles size={18} className="text-cyan-400" />
                AI Personalize Pitch
              </h3>
              <button
                type="button"
                onClick={() => setShowAIModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGenerateAIPitch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Target Job Role *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Frontend Engineer"
                    value={aiRole}
                    onChange={(e) => setAiRole(e.target.value)}
                    className="input text-xs"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Target Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Google / TechCorp"
                    value={aiCompany}
                    onChange={(e) => setAiCompany(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Email Tone</label>
                <select
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value as any)}
                  className="input text-xs"
                >
                  <option value="professional">Professional & Formal</option>
                  <option value="friendly">Friendly & Warm</option>
                  <option value="persuasive">Persuasive & Impact-Focused</option>
                  <option value="confident">Confident & Direct</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label">Job Description / Key Requirements (Optional)</label>
                <textarea
                  rows={4}
                  placeholder="Paste job posting highlights, tech stack requirements (e.g. React, Next.js, Node.js), or key responsibilities..."
                  value={aiJobDescription}
                  onChange={(e) => setAiJobDescription(e.target.value)}
                  className="input text-xs min-h-[90px]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowAIModal(false)}
                  className="btn btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generatingAI}
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  {generatingAI ? (
                    <>
                      <div className="spinner border-white border-t-transparent w-3.5 h-3.5" />
                      Generating Pitch...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="text-cyan-300" />
                      Generate Pitch
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
