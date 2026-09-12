'use client';

import { SkillSource } from '@/lib/types';
import { X } from 'lucide-react';

interface Props {
  name: string;
  source: SkillSource;
  onRemove?: () => void;
}

const sourceColors: Record<SkillSource, string> = {
  RESUME: 'bg-violet-500/15 border-violet-500/30 text-violet-300',
  MANUAL: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
  AI: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
};

const sourceLabels: Record<SkillSource, string> = {
  RESUME: 'Resume',
  MANUAL: 'Manual',
  AI: 'AI',
};

export default function SkillBadge({ name, source, onRemove }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold transition-all duration-200 group ${sourceColors[source]}`}
    >
      <span>{name}</span>
      <span className="opacity-50 text-[9px] uppercase tracking-wider">{sourceLabels[source]}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-white/10 p-0.5"
          title={`Remove ${name}`}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}
