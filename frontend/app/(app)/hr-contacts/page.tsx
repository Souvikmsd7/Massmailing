'use client';

import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { showToast, showConfirm, showAlert } from '@/lib/swal';
import {
  Users,
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Edit2,
  FileSpreadsheet,
  MapPin,
  Building2,
  Mail,
  Phone,
  FileText,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw
} from 'lucide-react';

interface HRContact {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  location: string;
  notes: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export default function HRContactsPage() {
  const [contacts, setContacts] = useState<HRContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<HRContact | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    location: '',
    notes: '',
  });

  // CSV Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/hr-contacts', {
        params: { page, limit: 10, search },
      });
      setContacts(res.data.contacts);
      setTotalPages(res.data.pagination.totalPages);
      setTotalCount(res.data.pagination.total);
    } catch (err: any) {
      showToast('error', err.response?.data?.error || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [page, search]);

  const handleOpenAdd = () => {
    setEditingContact(null);
    setFormData({ name: '', company: '', email: '', phone: '', location: '', notes: '' });
    setShowAddModal(true);
  };

  const handleOpenEdit = (contact: HRContact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name || '',
      company: contact.company || '',
      email: contact.email || '',
      phone: contact.phone || '',
      location: contact.location || '',
      notes: contact.notes || '',
    });
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      showToast('warning', 'Name and Email are required');
      return;
    }

    try {
      setSubmitting(true);
      if (editingContact) {
        await api.put(`/api/hr-contacts/${editingContact.id}`, formData);
        showToast('success', 'HR Contact updated successfully');
      } else {
        await api.post('/api/hr-contacts', formData);
        showToast('success', 'HR Contact added successfully');
      }
      setShowAddModal(false);
      fetchContacts();
    } catch (err: any) {
      showAlert({
        title: 'Error',
        text: err.response?.data?.error || 'Failed to save contact',
        icon: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await showConfirm({
      title: 'Delete Contact?',
      text: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      icon: 'warning',
      confirmButtonText: 'Yes, Delete',
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/hr-contacts/${id}`);
        showToast('success', 'Contact deleted');
        fetchContacts();
      } catch (err: any) {
        showToast('error', err.response?.data?.error || 'Failed to delete contact');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const result = await showConfirm({
      title: `Delete ${selectedIds.length} Contact(s)?`,
      text: `Are you sure you want to delete ${selectedIds.length} selected HR contact(s)?`,
      icon: 'warning',
      confirmButtonText: `Delete ${selectedIds.length} Contacts`,
    });

    if (result.isConfirmed) {
      try {
        const res = await api.post('/api/hr-contacts/bulk-delete', { ids: selectedIds });
        showToast('success', `${res.data.deletedCount} contact(s) deleted`);
        setSelectedIds([]);
        fetchContacts();
      } catch (err: any) {
        showToast('error', err.response?.data?.error || 'Failed to bulk delete contacts');
      }
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(contacts.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Download Dummy CSV Template
  const handleDownloadDummyCSV = () => {
    const headers = ['Name', 'Company Name', 'Email', 'Phone Number', 'Location', 'Notes'];
    const sampleRows = [
      ['Sarah Jenkins', 'Google', 'sarah.jenkins@google.com', '+1 650-253-0000', 'Mountain View, CA', 'Tech Recruiter for Frontend Roles'],
      ['Michael Chang', 'Microsoft', 'mchang@microsoft.com', '+1 425-882-8080', 'Redmond, WA', 'Lead HR Manager'],
      ['Priya Sharma', 'Amazon', 'priya.s@amazon.com', '+91 9876543210', 'Bangalore, India', 'Senior Talent Acquisition'],
    ];

    const csvContent = [
      headers.join(','),
      ...sampleRows.map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'hr_contacts_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Sample CSV downloaded');
  };

  // Export CSV
  const handleExportCSV = () => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/hr-contacts/export`, '_blank');
    showToast('info', 'Exporting HR contacts...');
  };

  // Import CSV
  const handleImportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      showToast('warning', 'Please select a CSV file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      setImporting(true);
      const res = await api.post('/api/hr-contacts/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      showAlert({
        title: 'CSV Import Completed',
        text: `Successfully imported ${res.data.createdCount} contact(s). ${res.data.skippedCount ? `${res.data.skippedCount} duplicated email(s) skipped.` : ''}`,
        icon: 'success',
      });

      setShowImportModal(false);
      setImportFile(null);
      fetchContacts();
    } catch (err: any) {
      showAlert({
        title: 'Import Failed',
        text: err.response?.data?.error || 'Failed to process CSV file',
        icon: 'error',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="main-content">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white shadow-lg">
              <Users size={20} />
            </div>
            HR Contacts Directory
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage your company recruiters, HR contacts, and network leads in one place.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadDummyCSV}
            className="btn btn-ghost text-xs flex items-center gap-1.5"
            title="Download CSV reference format"
          >
            <FileSpreadsheet size={15} className="text-emerald-400" />
            Sample CSV
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary text-xs flex items-center gap-1.5"
          >
            <Upload size={15} />
            Import CSV
          </button>

          <button
            onClick={handleExportCSV}
            className="btn btn-ghost text-xs flex items-center gap-1.5"
          >
            <Download size={15} />
            Export CSV
          </button>

          <button onClick={handleOpenAdd} className="btn btn-primary text-xs flex items-center gap-1.5">
            <Plus size={16} />
            Add HR Contact
          </button>
        </div>
      </div>

      {/* Control Bar: Search & Bulk Action */}
      <div className="card mb-6 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by name, company, email, location..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
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

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {selectedIds.length > 0 && (
            <button onClick={handleBulkDelete} className="btn btn-danger text-xs flex items-center gap-1.5 animate-fadeIn">
              <Trash2 size={14} />
              Delete Selected ({selectedIds.length})
            </button>
          )}

          <button onClick={fetchContacts} className="btn btn-ghost p-2 text-xs" title="Refresh List">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <span className="text-xs text-[var(--text-muted)]">
            Total: <strong className="text-violet-400">{totalCount}</strong> contacts
          </span>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--text-muted)] flex flex-col items-center gap-3">
            <div className="spinner" />
            Loading contacts...
          </div>
        ) : contacts.length === 0 ? (
          <div className="empty-state py-16">
            <Users size={48} className="text-slate-600" />
            <p className="font-semibold text-lg text-slate-300">No HR contacts found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {search
                ? `No contacts match "${search}". Try clearing your search.`
                : 'Start adding HR contacts manually or import a CSV file.'}
            </p>
            <div className="flex items-center gap-3 mt-5">
              {search ? (
                <button onClick={() => setSearch('')} className="btn btn-ghost text-xs">
                  Clear Search
                </button>
              ) : (
                <>
                  <button onClick={handleDownloadDummyCSV} className="btn btn-ghost text-xs">
                    Download Sample CSV
                  </button>
                  <button onClick={handleOpenAdd} className="btn btn-primary text-xs">
                    Add First Contact
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="table-container border-0">
            <table>
              <thead>
                <tr>
                  <th className="w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === contacts.length && contacts.length > 0}
                      onChange={handleSelectAll}
                      className="rounded accent-violet-500 cursor-pointer"
                    />
                  </th>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Notes</th>
                  <th>Created / Updated By</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => {
                  const isSelected = selectedIds.includes(contact.id);
                  return (
                    <tr key={contact.id} className={isSelected ? 'bg-violet-950/20' : ''}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(contact.id)}
                          className="rounded accent-violet-500 cursor-pointer"
                        />
                      </td>
                      <td className="font-medium text-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold text-xs flex items-center justify-center">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{contact.name}</span>
                        </div>
                      </td>
                      <td>
                        {contact.company ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-slate-800/80 px-2 py-1 rounded text-slate-300 border border-slate-700/50">
                            <Building2 size={12} className="text-cyan-400" />
                            {contact.company}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic text-xs">—</span>
                        )}
                      </td>
                      <td className="text-xs text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <Mail size={12} className="text-violet-400" />
                          {contact.email}
                        </span>
                      </td>
                      <td className="text-xs text-slate-300">
                        {contact.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={12} className="text-emerald-400" />
                            {contact.phone}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">—</span>
                        )}
                      </td>
                      <td className="text-xs text-slate-300">
                        {contact.location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} className="text-amber-400" />
                            {contact.location}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">—</span>
                        )}
                      </td>
                      <td className="text-xs text-slate-400 max-w-xs truncate">
                        {contact.notes || <span className="text-slate-600 italic">—</span>}
                      </td>
                      <td className="text-xs">
                        <div className="font-medium text-slate-200">{contact.createdBy || '—'}</div>
                        {contact.updatedBy && contact.updatedBy !== contact.createdBy && (
                          <div className="text-[10px] text-slate-500">Updated by {contact.updatedBy}</div>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(contact)}
                            className="p-1.5 text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 rounded transition"
                            title="Edit Contact"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(contact.id, contact.name)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                            title="Delete Contact"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-ghost p-1.5 text-xs disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2">{page}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn btn-ghost p-1.5 text-xs disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit HR Contact Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal max-w-lg w-full">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
              <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                <Users size={18} className="text-violet-400" />
                {editingContact ? 'Edit HR Contact' : 'Add New HR Contact'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input text-xs"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Corp"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. jane@acme.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input text-xs"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +1 234 567 8900"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Location</label>
                <input
                  type="text"
                  placeholder="e.g. San Francisco, CA / Remote"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div className="form-group">
                <label className="label">Notes / Remarks</label>
                <textarea
                  placeholder="e.g. Prefers email outreach on Tuesdays. Hiring senior backend developers."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input text-xs min-h-[80px]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary text-xs">
                  {submitting ? 'Saving...' : editingContact ? 'Update Contact' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal max-w-md w-full">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
              <h3 className="font-bold text-lg text-slate-100 flex items-center gap-2">
                <Upload size={18} className="text-cyan-400" />
                Import HR Contacts from CSV
              </h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleImportCSV} className="space-y-4">
              <p className="text-xs text-[var(--text-secondary)]">
                Upload a CSV file containing columns like: <code>Name</code>, <code>Company</code>, <code>Email</code>, <code>Phone</code>, <code>Location</code>, <code>Notes</code>.
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="drop-zone py-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-violet-500 transition"
              >
                <FileSpreadsheet size={32} className="text-violet-400" />
                <p className="text-xs font-medium text-slate-200">
                  {importFile ? importFile.name : 'Click to browse CSV file'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : 'CSV format with headers'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImportFile(e.target.files[0]);
                    }
                  }}
                />
              </div>

              <div className="bg-violet-950/30 p-3 rounded-lg border border-violet-500/20 flex items-center justify-between text-xs">
                <span className="text-slate-300">Need standard CSV format?</span>
                <button
                  type="button"
                  onClick={handleDownloadDummyCSV}
                  className="text-violet-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <Download size={13} />
                  Download Sample CSV
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                  }}
                  className="btn btn-ghost text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!importFile || importing}
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  {importing ? (
                    <>
                      <div className="spinner border-white border-t-transparent w-3.5 h-3.5" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Upload & Import
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
