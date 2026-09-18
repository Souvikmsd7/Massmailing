'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSkills, addSkill, removeSkill } from '@/lib/career/skillsApi';
import { CandidateSkill } from '@/lib/types';
import SkillBadge from '@/components/career/SkillBadge';
import { showToast } from '@/lib/swal';
import { BrainCircuit, Plus, RefreshCw, Loader2 } from 'lucide-react';

export default function SkillsPage() {
  const [skills, setSkills] = useState<CandidateSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  const refresh = useCallback(() => {
    getSkills()
      .then(setSkills)
      .catch(() => showToast('error', 'Failed to load skills'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSkill.trim();
    if (!name) return;
    setAdding(true);
    try {
      const updated = await addSkill(name);
      setSkills(updated);
      setNewSkill('');
      showToast('success', `Added "${name}"`);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: { message?: string } } } };
      showToast('error', apiErr?.response?.data?.error?.message || 'Failed to add skill');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = useCallback(async (skillId: string, name: string) => {
    try {
      await removeSkill(skillId);
      setSkills((prev) => prev.filter((s) => s.skillId !== skillId));
      showToast('success', `Removed "${name}"`);
    } catch {
      showToast('error', 'Failed to remove skill');
    }
  }, []);

  const resumeSkills = skills.filter((s) => s.source === 'RESUME');
  const manualSkills = skills.filter((s) => s.source === 'MANUAL');
  const aiSkills = skills.filter((s) => s.source === 'AI');

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white font-outfit">Skills</h1>
          <p className="text-sm text-slate-400 mt-1">{skills.length} normalized skills extracted from your resume</p>
        </div>
        <button onClick={refresh} className="btn btn-ghost btn-sm flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Add Skill */}
      <div className="card">
        <h2 className="font-bold text-slate-200 font-outfit mb-4 flex items-center gap-2">
          <Plus size={16} className="text-violet-400" /> Add Skill Manually
        </h2>
        <form onSubmit={handleAdd} className="flex gap-3">
          <input
            id="add-skill-input"
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            placeholder="e.g. React, Python, Docker…"
            className="input flex-1"
            maxLength={100}
          />
          <button
            id="add-skill-btn"
            type="submit"
            disabled={adding || !newSkill.trim()}
            className="btn btn-primary flex items-center gap-2"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
        <p className="text-[11px] text-slate-500 mt-2">Skill names are automatically normalized (e.g. ReactJS → React)</p>
      </div>

      {/* Skills List */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 2 }} />
        </div>
      ) : skills.length === 0 ? (
        <div className="card empty-state py-10">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-3">
            <BrainCircuit size={22} />
          </div>
          <p className="text-slate-400 text-sm">No skills yet — upload and parse your resume to extract skills automatically</p>
        </div>
      ) : (
        <div className="space-y-6">
          {resumeSkills.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-slate-300 text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-400" /> From Resume ({resumeSkills.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {resumeSkills.map((cs) => (
                  <SkillBadge
                    key={cs.skillId}
                    name={cs.skill.name}
                    source={cs.source}
                    onRemove={() => handleRemove(cs.skillId, cs.skill.name)}
                  />
                ))}
              </div>
            </div>
          )}

          {manualSkills.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-slate-300 text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> Manually Added ({manualSkills.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {manualSkills.map((cs) => (
                  <SkillBadge
                    key={cs.skillId}
                    name={cs.skill.name}
                    source={cs.source}
                    onRemove={() => handleRemove(cs.skillId, cs.skill.name)}
                  />
                ))}
              </div>
            </div>
          )}

          {aiSkills.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-slate-300 text-sm mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> AI Extracted ({aiSkills.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {aiSkills.map((cs) => (
                  <SkillBadge
                    key={cs.skillId}
                    name={cs.skill.name}
                    source={cs.source}
                    onRemove={() => handleRemove(cs.skillId, cs.skill.name)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-4">
        <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Source Legend</p>
        <div className="flex flex-wrap gap-3">
          <SkillBadge name="Resume" source="RESUME" />
          <SkillBadge name="Manual" source="MANUAL" />
          <SkillBadge name="AI" source="AI" />
        </div>
      </div>
    </div>
  );
}
