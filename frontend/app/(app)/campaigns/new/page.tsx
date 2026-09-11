'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Contact } from '@/lib/types';
import { toast } from 'sonner';
import {
  Upload, Users, PenSquare, Eye, CheckCircle2, X, Plus, Trash2,
  FileText, AlertCircle, Info, ChevronLeft, ChevronRight, Send,
  Variable, Paperclip, Download
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
  const resumeRef = useRef<HTMLInputElement>(null);

  // Preview state
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewData, setPreviewData] = useState<{ to: string; subject: string; html: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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
      setCsvMappingStep(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to upload CSV');
    } finally {
      setCsvUploading(false);
    }
  };

  const handleCsvParse = async () => {
    if (!csvMapping.email) {
      toast.error('Please select the email column');
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
        toast.success(`Imported ${res.data.contacts.length} valid contacts`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to parse CSV');
    }
  };

  // ---- Manual Entry ----
  const handleManualParse = async () => {
    try {
      const res = await api.post('/api/contacts/validate', { input: manualInput });
      const contacts: Contact[] = res.data.valid.map((email: string) => ({ email }));
      setContacts(contacts);
      if (res.data.invalid.length > 0) {
        toast.warning(`${res.data.invalid.length} invalid emails were skipped`);
      }
      toast.success(`${res.data.validCount} valid recipients added`);
    } catch {
      toast.error('Failed to validate emails');
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
      toast.error('Failed to load preview');
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

      toast.success('Campaign created and started!');
      router.push(`/campaigns/${campaignId}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create campaign');
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
            <div className="flex gap-2 mb-6">
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
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <PenSquare size={18} className="text-violet-400" />
              Compose Email
            </h2>

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
              <label className="label">Resume Attachment</label>
              <div
                className="drop-zone"
                onClick={() => resumeRef.current?.click()}
                style={{ padding: '1rem' }}
              >
                {attachment ? (
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-violet-400" />
                    <span className="text-sm">{attachment.name}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAttachment(null); }}
                      className="ml-auto text-[var(--text-muted)] hover:text-red-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-[var(--text-secondary)]">
                    <Paperclip size={20} className="text-violet-400" />
                    <span className="text-sm">Click to attach resume (PDF, DOC, DOCX · max 10MB)</span>
                  </div>
                )}
                <input
                  ref={resumeRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
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
    </div>
  );
}
