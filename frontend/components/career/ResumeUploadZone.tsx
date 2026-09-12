'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';

interface Props {
  onUpload: (file: File) => void;
  loading?: boolean;
}

export default function ResumeUploadZone({ onUpload, loading }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are supported.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File must be under 10MB.');
        return;
      }
      onUpload(file);
    },
    [onUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div>
      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all duration-300
          ${dragOver
            ? 'border-violet-400 bg-violet-500/10 scale-[1.01]'
            : 'border-slate-700 bg-slate-900/40 hover:border-violet-500/60 hover:bg-violet-500/5'
          }
          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center">
          {loading
            ? <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
            : <Upload size={28} className="text-violet-400" />
          }
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-200 text-sm">
            {loading ? 'Uploading…' : 'Drop your PDF resume here'}
          </p>
          <p className="text-xs text-slate-400 mt-1">or click to browse · PDF only · max 10MB</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600/20 border border-violet-500/30">
          <FileText size={14} className="text-violet-400" />
          <span className="text-xs text-violet-300 font-medium">PDF Resume</span>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <X size={14} />
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
