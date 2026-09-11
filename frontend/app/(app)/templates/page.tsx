'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Template } from '@/lib/types';
import { showToast, showConfirm, showAlert } from '@/lib/swal';
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Edit2,
  Send,
  X,
  RefreshCw,
  Copy,
  Variable,
  BookOpen
} from 'lucide-react';

const VARIABLES = ['{{name}}', '{{email}}', '{{company}}', '{{job_title}}', '{{phone}}', '{{linkedin}}', '{{sender_name}}'];

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
  });

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/templates', { params: { search } });
      setTemplates(res.data.templates);
    } catch {
      showToast('error', 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [search]);

  const handleOpenAdd = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      subject: '',
      body: `Hi {{name}},

I hope this email finds you well.

I am reaching out regarding potential {{job_title}} roles at {{company}}. I have strong experience in software engineering and would love to connect.

Best regards,
{{sender_name}}`,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.subject.trim() || !formData.body.trim()) {
      showToast('warning', 'Name, Subject, and Body are required');
      return;
    }

    try {
      setSubmitting(true);
      if (editingTemplate) {
        await api.put(`/api/templates/${editingTemplate.id}`, formData);
        showToast('success', 'Template updated successfully');
      } else {
        await api.post('/api/templates', formData);
        showToast('success', 'Template created successfully');
      }
      setShowModal(false);
      fetchTemplates();
    } catch (err: any) {
      showAlert({
        title: 'Error',
        text: err.response?.data?.error || 'Failed to save template',
        icon: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await showConfirm({
      title: 'Delete Template?',
      text: `Are you sure you want to delete "${name}"?`,
      icon: 'warning',
      confirmButtonText: 'Yes, Delete',
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/templates/${id}`);
        showToast('success', 'Template deleted');
        fetchTemplates();
      } catch (err: any) {
        showToast('error', err.response?.data?.error || 'Failed to delete template');
      }
    }
  };

  const insertVariable = (variable: string) => {
    setFormData((prev) => ({
      ...prev,
      body: prev.body + ' ' + variable,
    }));
  };

  const handleUseInCampaign = (template: Template) => {
    localStorage.setItem('mm_selected_template', JSON.stringify(template));
    router.push('/campaigns/new');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white shadow-lg">
              <BookOpen size={20} />
            </div>
            Email Templates Library
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Create reusable pitch templates with dynamic placeholders like {"{{name}}"}, {"{{company}}"}, {"{{job_title}}"}.
          </p>
        </div>

        <button onClick={handleOpenAdd} className="btn btn-primary text-xs flex items-center gap-1.5">
          <Plus size={16} />
          Create Template
        </button>
      </div>

      {/* Control Bar */}
      <div className="card mb-6 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search templates by name or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={fetchTemplates} className="btn btn-ghost p-2 text-xs" title="Refresh List">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <span className="text-xs text-[var(--text-muted)]">
            Total Templates: <strong className="text-violet-400">{templates.length}</strong>
          </span>
        </div>
      </div>

      {/* Grid of Templates */}
      {loading ? (
        <div className="p-12 text-center text-sm text-[var(--text-muted)] flex flex-col items-center gap-3">
          <div className="spinner" />
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="card empty-state py-16">
          <BookOpen size={48} className="text-slate-600" />
          <p className="font-semibold text-lg text-slate-300">No email templates yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {search
              ? `No templates match "${search}".`
              : 'Save reusable templates for your recruiter outreach campaigns.'}
          </p>
          <button onClick={handleOpenAdd} className="btn btn-primary text-xs mt-5">
            <Plus size={15} />
            Create First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((tpl) => (
            <div key={tpl.id} className="card flex flex-col justify-between hover:border-violet-500/50 transition">
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-bold text-slate-100 text-base truncate flex items-center gap-2">
                    <FileText size={16} className="text-violet-400 flex-shrink-0" />
                    {tpl.name}
                  </h3>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleOpenEdit(tpl)}
                      className="p-1 text-slate-400 hover:text-violet-400 rounded transition"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(tpl.id, tpl.name)}
                      className="p-1 text-slate-400 hover:text-red-400 rounded transition"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 mb-3">
                  <p className="text-xs text-slate-400 font-medium mb-1 truncate">
                    Subject: <span className="text-slate-200">{tpl.subject}</span>
                  </p>
                  <p className="text-xs text-slate-400 line-clamp-3 whitespace-pre-wrap font-mono">
                    {tpl.body}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] text-xs">
                <span className="text-[10px] text-slate-500">
                  By {tpl.createdBy || 'User'}
                </span>

                <button
                  onClick={() => handleUseInCampaign(tpl)}
                  className="btn btn-secondary text-xs py-1 px-3 flex items-center gap-1.5"
                >
                  <Send size={13} />
                  Use in Campaign
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Template Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal max-w-xl w-full">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
              <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                <BookOpen size={18} className="text-violet-400" />
                {editingTemplate ? 'Edit Template' : 'Create Email Template'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1 rounded">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="form-group">
                <label className="label">
                  Template Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Frontend Pitch 2026"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div className="form-group">
                <label className="label">
                  Subject Line <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Application for {{job_title}} at {{company}}"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="input text-xs"
                />
              </div>

              {/* Variable Quick Insert */}
              <div>
                <label className="label mb-1.5 flex items-center gap-1">
                  <Variable size={12} className="text-violet-400" />
                  Insert Personalization Variable
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="btn btn-ghost btn-sm text-[11px] font-mono text-violet-400 py-0.5 px-2"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="label">
                  Email Body <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={8}
                  placeholder="Hi {{name}}, ..."
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="input text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary text-xs">
                  {submitting ? 'Saving...' : editingTemplate ? 'Update Template' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
