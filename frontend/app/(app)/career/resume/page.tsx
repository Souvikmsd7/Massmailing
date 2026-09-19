'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  uploadResume,
  listResumes,
  deleteResume,
  parseResume,
} from '@/lib/career/resumeApi'
import { ResumeListItem, ParsedResume } from '@/lib/types'
import ResumeUploadZone from '@/components/career/ResumeUploadZone'
import { showToast } from '@/lib/swal'
import {
  FileText,
  Trash2,
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Upload,
  RefreshCw,
} from 'lucide-react'

const STATUS_CONFIG = {
  UPLOADED: {
    label: 'Uploaded',
    icon: Upload,
    cls: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  },
  PROCESSING: {
    label: 'Processing…',
    icon: Clock,
    cls: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
  },
  PARSED: {
    label: 'Parsed ✓',
    icon: CheckCircle2,
    cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  },
  FAILED: {
    label: 'Failed',
    icon: XCircle,
    cls: 'bg-red-500/10 border-red-500/20 text-red-400',
  },
}

export default function ResumePage() {
  const [resumes, setResumes] = useState<ResumeListItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    listResumes()
      .then(setResumes)
      .catch(() => showToast('error', 'Failed to load resumes'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true)
      try {
        await uploadResume(file)
        showToast('success', 'Resume uploaded successfully!')
        refresh()
      } catch (err: unknown) {
        const apiErr = err as {
          response?: { data?: { error?: { message?: string } } }
        }
        showToast(
          'error',
          apiErr?.response?.data?.error?.message || 'Upload failed',
        )
      } finally {
        setUploading(false)
      }
    },
    [refresh],
  )

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
      try {
        await deleteResume(id)
        showToast('success', 'Resume deleted')
        refresh()
      } catch {
        showToast('error', 'Failed to delete resume')
      }
    },
    [refresh],
  )

  const handleParse = useCallback(
    async (id: string) => {
      setParsing(id)
      try {
        const result = await parseResume(id)
        if (result.parsed) {
          const parsedData = result.parsed as ParsedResume
          showToast(
            'success',
            `Parsed! ${parsedData.skills?.length ?? 0} skills extracted.`,
          )
        } else {
          showToast(
            'error',
            'Parsing failed — Gemini could not process the resume',
          )
        }
        refresh()
      } catch (err: unknown) {
        const apiErr = err as {
          response?: { data?: { error?: { message?: string } } }
        }
        showToast(
          'error',
          apiErr?.response?.data?.error?.message || 'Parse failed',
        )
      } finally {
        setParsing(null)
      }
    },
    [refresh],
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-outfit">
            Resume Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Upload your PDF resume and let AI extract structured data
          </p>
        </div>
        <button
          onClick={refresh}
          className="btn btn-ghost btn-sm flex items-center gap-2"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Upload Zone */}
      <div className="card">
        <h2 className="font-bold text-slate-200 mb-4 font-outfit flex items-center gap-2">
          <Upload size={16} className="text-violet-400" /> Upload New Resume
        </h2>
        <ResumeUploadZone onUpload={handleUpload} loading={uploading} />
      </div>

      {/* Resume List */}
      <div className="card">
        <h2 className="font-bold text-slate-200 mb-4 font-outfit flex items-center gap-2">
          <FileText size={16} className="text-violet-400" /> Your Resumes
          <span className="ml-auto text-xs text-slate-500 font-normal">
            {resumes.length} file{resumes.length !== 1 ? 's' : ''}
          </span>
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div
              className="spinner"
              style={{ width: 28, height: 28, borderWidth: 2 }}
            />
          </div>
        ) : resumes.length === 0 ? (
          <div className="empty-state py-10">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-3">
              <FileText size={22} />
            </div>
            <p className="text-slate-400 text-sm">No resumes uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resumes.map((r) => {
              const s = STATUS_CONFIG[r.status]
              const StatusIcon = s.icon
              const isParsing = parsing === r.id
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">
                      {r.fileName}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex-shrink-0 ${s.cls}`}
                  >
                    <StatusIcon size={11} />
                    {s.label}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(r.status === 'UPLOADED' || r.status === 'FAILED') && (
                      <button
                        id={`parse-resume-${r.id}`}
                        onClick={() => handleParse(r.id)}
                        disabled={isParsing}
                        className="btn btn-primary btn-sm flex items-center gap-1.5 text-[11px] px-3 py-1.5"
                      >
                        {isParsing ? (
                          <>
                            <div
                              className="spinner"
                              style={{ width: 12, height: 12, borderWidth: 2 }}
                            />{' '}
                            Parsing…
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} /> Parse
                          </>
                        )}
                      </button>
                    )}
                    {r.status === 'PROCESSING' && (
                      <span className="text-xs text-cyan-400 flex items-center gap-1">
                        <div
                          className="spinner"
                          style={{ width: 12, height: 12, borderWidth: 2 }}
                        />{' '}
                        Processing
                      </span>
                    )}
                    <button
                      id={`delete-resume-${r.id}`}
                      onClick={() => handleDelete(r.id, r.fileName)}
                      className="btn btn-ghost btn-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5"
                      title="Delete resume"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-4 text-xs text-slate-400 space-y-1">
        <p className="flex items-center gap-2">
          <AlertCircle size={12} className="text-amber-400 flex-shrink-0" />{' '}
          <strong className="text-slate-300">Upload:</strong> PDF format only,
          maximum 10MB
        </p>
        <p className="flex items-center gap-2">
          <Sparkles size={12} className="text-violet-400 flex-shrink-0" />{' '}
          <strong className="text-slate-300">Parse:</strong> AI will extract
          skills, experience, education from your resume
        </p>
        <p className="flex items-center gap-2">
          <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />{' '}
          <strong className="text-slate-300">Privacy:</strong> Your resume is
          stored securely and never shared
        </p>
      </div>
    </div>
  )
}
