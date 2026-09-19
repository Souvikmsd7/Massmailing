'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { getProfile, updateProfile } from '@/lib/career/candidateApi';
import { CandidateProfile, ToolItem, ProjectItem } from '@/lib/types';
import { showToast } from '@/lib/swal';
import {
  Wrench,
  FolderGit2,
  Plus,
  Trash2,
  ExternalLink,
  Save,
  Loader2,
  Search,
  Eye,
  EyeOff,
  List,
  LayoutGrid
} from 'lucide-react';

export default function ToolsProjectsPage() {
  const [profile, setProfile] = useState<Partial<CandidateProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data states
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  // UI Filter & View states
  const [activeTab, setActiveTab] = useState<'tools' | 'projects'>('tools');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSync, setFilterSync] = useState<'all' | 'profile' | 'personal'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const fetchProfileData = useCallback(async () => {
    try {
      const p = await getProfile();
      if (p) {
        setProfile(p);
        setTools(p.tools ?? []);
        setProjects(p.projects ?? []);
      }
    } catch {
      showToast('error', 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  // Helper to persist changes immediately to server
  const saveToServer = async (updatedTools: ToolItem[], updatedProjects: ProjectItem[]) => {
    setSaving(true);
    try {
      const validTools = updatedTools.filter((t) => t.name.trim() !== '');
      const validProjects = updatedProjects.filter((p) => p.name.trim() !== '');

      const updated = await updateProfile({
        ...profile,
        tools: validTools,
        projects: validProjects,
      });

      setProfile(updated);
      setTools(updated.tools ?? []);
      setProjects(updated.projects ?? []);
    } catch {
      showToast('error', 'Failed to update server records');
    } finally {
      setSaving(false);
    }
  };

  const handleManualSave = async () => {
    setSaving(true);
    try {
      const validTools = tools.filter((t) => t.name.trim() !== '');
      const validProjects = projects.filter((p) => p.name.trim() !== '');

      const updated = await updateProfile({
        ...profile,
        tools: validTools,
        projects: validProjects,
      });

      setProfile(updated);
      setTools(updated.tools ?? []);
      setProjects(updated.projects ?? []);
      showToast('success', 'Changes saved successfully!');
    } catch {
      showToast('error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Tool Handlers (CRUD with immediate save on delete)
  const addTool = () => {
    const newItem: ToolItem = {
      id: 'tool-' + Date.now(),
      name: '',
      link: '',
      usedFor: '',
      includeInProfile: false,
    };
    setTools((prev) => [newItem, ...prev]);
  };

  const updateTool = (index: number, field: keyof ToolItem, value: string | boolean) => {
    setTools((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  const deleteTool = async (indexToDelete: number) => {
    const updatedTools = tools.filter((_, i) => i !== indexToDelete);
    setTools(updatedTools);
    await saveToServer(updatedTools, projects);
    showToast('success', 'Tool deleted successfully');
  };

  // Project Handlers (CRUD with immediate save on delete)
  const addProject = () => {
    const newItem: ProjectItem = {
      id: 'proj-' + Date.now(),
      name: '',
      githubUrl: '',
      notes: '',
      includeInProfile: false,
    };
    setProjects((prev) => [newItem, ...prev]);
  };

  const updateProject = (index: number, field: keyof ProjectItem, value: string | boolean) => {
    setProjects((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const deleteProject = async (indexToDelete: number) => {
    const updatedProjects = projects.filter((_, i) => i !== indexToDelete);
    setProjects(updatedProjects);
    await saveToServer(tools, updatedProjects);
    showToast('success', 'Project deleted successfully');
  };

  // Filtered lists
  const filteredTools = useMemo(() => {
    return tools.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.usedFor && t.usedFor.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.link && t.link.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;
      if (filterSync === 'profile') return t.includeInProfile === true;
      if (filterSync === 'personal') return !t.includeInProfile;
      return true;
    });
  }, [tools, searchQuery, filterSync]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.notes && p.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.githubUrl && p.githubUrl.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;
      if (filterSync === 'profile') return p.includeInProfile === true;
      if (filterSync === 'personal') return !p.includeInProfile;
      return true;
    });
  }, [projects, searchQuery, filterSync]);

  // Statistics
  const toolsInProfileCount = tools.filter((t) => t.includeInProfile).length;
  const projectsInProfileCount = projects.filter((p) => p.includeInProfile).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white font-outfit">Tools & Projects Workspace</h1>
            <span className="badge badge-violet text-[10px] px-2 py-0.5 font-bold uppercase">Personal Records</span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Store software tools, links, repos, and notes in list view. Toggle items to display on your Candidature Profile.
          </p>
        </div>

        <button
          onClick={handleManualSave}
          disabled={saving}
          className="btn btn-primary flex items-center gap-2 self-start md:self-auto"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save All Changes'}
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-3.5 bg-slate-900/50 border-slate-800">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Saved Tools</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-extrabold text-white">{tools.length}</span>
            <span className="text-xs text-pink-400 font-medium">({toolsInProfileCount} in Profile)</span>
          </div>
        </div>

        <div className="card p-3.5 bg-slate-900/50 border-slate-800">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Saved Projects</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-extrabold text-white">{projects.length}</span>
            <span className="text-xs text-blue-400 font-medium">({projectsInProfileCount} in Profile)</span>
          </div>
        </div>

        <div className="card p-3.5 bg-slate-900/50 border-slate-800">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Profile Synced</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-extrabold text-indigo-400">{toolsInProfileCount + projectsInProfileCount}</span>
            <span className="text-xs text-slate-400 font-medium">Items</span>
          </div>
        </div>

        <div className="card p-3.5 bg-slate-900/50 border-slate-800">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Private Records</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-extrabold text-slate-300">
              {(tools.length - toolsInProfileCount) + (projects.length - projectsInProfileCount)}
            </span>
            <span className="text-xs text-slate-500 font-medium">Personal</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs & Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('tools')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'tools'
                ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench size={14} /> Tools ({tools.length})
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'projects'
                ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderGit2 size={14} /> Projects ({projects.length})
          </button>
        </div>

        {/* View Mode, Search & Action */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-900/80 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded ${viewMode === 'list' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="List View"
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded ${viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              title="Card View"
            >
              <LayoutGrid size={15} />
            </button>
          </div>

          <div className="relative flex-1 sm:w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search records..."
              className="input pl-8 py-1.5 text-xs w-full"
            />
          </div>

          <select
            value={filterSync}
            onChange={(e) => setFilterSync(e.target.value as 'all' | 'profile' | 'personal')}
            className="input py-1.5 px-2 text-xs"
          >
            <option value="all">All Records</option>
            <option value="profile">In Profile Only</option>
            <option value="personal">Personal Only</option>
          </select>

          <button
            type="button"
            onClick={activeTab === 'tools' ? addTool : addProject}
            className="btn btn-primary flex items-center gap-1.5 text-xs py-1.5 px-3"
          >
            <Plus size={14} /> Add {activeTab === 'tools' ? 'Tool' : 'Project'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'tools' ? (
        /* TOOLS SECTION */
        <div>
          {filteredTools.length === 0 ? (
            <div className="card p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto text-pink-400">
                <Wrench size={22} />
              </div>
              <h3 className="font-bold text-slate-200 text-sm font-outfit">No tools listed</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery || filterSync !== 'all'
                  ? 'No saved tools match your filter.'
                  : 'Add software tools and developer frameworks to your record.'}
              </p>
              <button onClick={addTool} className="btn btn-secondary text-xs inline-flex items-center gap-1.5">
                <Plus size={14} /> Add First Tool
              </button>
            </div>
          ) : viewMode === 'list' ? (
            /* LIST VIEW FOR TOOLS */
            <div className="card p-0 overflow-hidden border border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                    <tr>
                      <th className="py-3 px-4 w-1/4">Tool Name</th>
                      <th className="py-3 px-4 w-1/4">Documentation / Link</th>
                      <th className="py-3 px-4 w-1/3">Used For / Description</th>
                      <th className="py-3 px-4 text-center">Profile Sync</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {filteredTools.map((tool) => {
                      const realIndex = tools.findIndex((t) => (t.id && t.id === tool.id) || t === tool);
                      const isSynced = tool.includeInProfile ?? false;

                      return (
                        <tr key={tool.id || realIndex} className="hover:bg-slate-900/50 transition-colors group">
                          {/* Name */}
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={tool.name}
                              onChange={(e) => updateTool(realIndex, 'name', e.target.value)}
                              placeholder="e.g. Docker, PostgreSQL"
                              className="input w-full text-xs font-semibold py-1"
                            />
                          </td>

                          {/* Link */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="url"
                                value={tool.link ?? ''}
                                onChange={(e) => updateTool(realIndex, 'link', e.target.value)}
                                placeholder="https://..."
                                className="input w-full text-xs py-1"
                              />
                              {tool.link && (
                                <a
                                  href={tool.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-400 hover:text-pink-400 p-1.5 rounded bg-slate-800/80 hover:bg-slate-800 transition-colors flex-shrink-0"
                                  title="Open Link"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Used For */}
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={tool.usedFor ?? ''}
                              onChange={(e) => updateTool(realIndex, 'usedFor', e.target.value)}
                              placeholder="Usage notes..."
                              className="input w-full text-xs py-1"
                            />
                          </td>

                          {/* Profile Toggle */}
                          <td className="py-2.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => updateTool(realIndex, 'includeInProfile', !isSynced)}
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                                isSynced
                                  ? 'bg-pink-500/20 text-pink-300 border-pink-500/40 hover:bg-pink-500/30'
                                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
                              }`}
                              title="Toggle Profile Sync"
                            >
                              {isSynced ? <Eye size={12} className="text-pink-400" /> : <EyeOff size={12} />}
                              <span>{isSynced ? 'Synced' : 'Personal'}</span>
                            </button>
                          </td>

                          {/* Delete Action */}
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => deleteTool(realIndex)}
                              className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                              title="Delete Tool"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* GRID VIEW FOR TOOLS */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTools.map((tool) => {
                const realIndex = tools.findIndex((t) => (t.id && t.id === tool.id) || t === tool);
                const isSynced = tool.includeInProfile ?? false;

                return (
                  <div
                    key={tool.id || realIndex}
                    className={`card p-4 transition-all space-y-3 border ${
                      isSynced ? 'border-pink-500/30 bg-pink-950/10' : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Tool Name</label>
                          <input
                            type="text"
                            value={tool.name}
                            onChange={(e) => updateTool(realIndex, 'name', e.target.value)}
                            placeholder="e.g. Docker"
                            className="input w-full text-sm font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">URL / Link</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="url"
                              value={tool.link ?? ''}
                              onChange={(e) => updateTool(realIndex, 'link', e.target.value)}
                              placeholder="https://..."
                              className="input w-full text-xs"
                            />
                            {tool.link && (
                              <a
                                href={tool.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-400 hover:text-pink-400 p-1.5 bg-slate-800 rounded"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Used For</label>
                          <input
                            type="text"
                            value={tool.usedFor ?? ''}
                            onChange={(e) => updateTool(realIndex, 'usedFor', e.target.value)}
                            placeholder="Usage details..."
                            className="input w-full text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => updateTool(realIndex, 'includeInProfile', !isSynced)}
                          className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                            isSynced ? 'bg-pink-500/20 text-pink-300 border-pink-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {isSynced ? <Eye size={12} /> : <EyeOff size={12} />}
                          {isSynced ? 'Synced' : 'Personal'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTool(realIndex)}
                          className="text-slate-500 hover:text-rose-400 p-1.5"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* PROJECTS SECTION */
        <div>
          {filteredProjects.length === 0 ? (
            <div className="card p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                <FolderGit2 size={22} />
              </div>
              <h3 className="font-bold text-slate-200 text-sm font-outfit">No projects listed</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery || filterSync !== 'all'
                  ? 'No saved projects match your filter.'
                  : 'Add your GitHub repositories and side projects for easy personal access.'}
              </p>
              <button onClick={addProject} className="btn btn-secondary text-xs inline-flex items-center gap-1.5">
                <Plus size={14} /> Add First Project
              </button>
            </div>
          ) : viewMode === 'list' ? (
            /* LIST VIEW FOR PROJECTS */
            <div className="card p-0 overflow-hidden border border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 text-[10px]">
                    <tr>
                      <th className="py-3 px-4 w-1/4">Project Name</th>
                      <th className="py-3 px-4 w-1/4">GitHub / Repo Link</th>
                      <th className="py-3 px-4 w-1/3">Notes & Tech Details</th>
                      <th className="py-3 px-4 text-center">Profile Sync</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                    {filteredProjects.map((project) => {
                      const realIndex = projects.findIndex((p) => (p.id && p.id === project.id) || p === project);
                      const isSynced = project.includeInProfile ?? false;

                      return (
                        <tr key={project.id || realIndex} className="hover:bg-slate-900/50 transition-colors group">
                          {/* Name */}
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={project.name}
                              onChange={(e) => updateProject(realIndex, 'name', e.target.value)}
                              placeholder="e.g. MassMailer Engine"
                              className="input w-full text-xs font-semibold py-1"
                            />
                          </td>

                          {/* GitHub Link */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="url"
                                value={project.githubUrl ?? ''}
                                onChange={(e) => updateProject(realIndex, 'githubUrl', e.target.value)}
                                placeholder="https://github.com/..."
                                className="input w-full text-xs py-1"
                              />
                              {project.githubUrl && (
                                <a
                                  href={project.githubUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-400 hover:text-blue-400 p-1.5 rounded bg-slate-800/80 hover:bg-slate-800 transition-colors flex-shrink-0"
                                  title="Open Repository"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Notes */}
                          <td className="py-2.5 px-4">
                            <input
                              type="text"
                              value={project.notes ?? ''}
                              onChange={(e) => updateProject(realIndex, 'notes', e.target.value)}
                              placeholder="Architecture notes, stack details..."
                              className="input w-full text-xs py-1"
                            />
                          </td>

                          {/* Profile Toggle */}
                          <td className="py-2.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => updateProject(realIndex, 'includeInProfile', !isSynced)}
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                                isSynced
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                                  : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
                              }`}
                              title="Toggle Profile Sync"
                            >
                              {isSynced ? <Eye size={12} className="text-blue-400" /> : <EyeOff size={12} />}
                              <span>{isSynced ? 'Synced' : 'Personal'}</span>
                            </button>
                          </td>

                          {/* Delete Action */}
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => deleteProject(realIndex)}
                              className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                              title="Delete Project"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* GRID VIEW FOR PROJECTS */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProjects.map((project) => {
                const realIndex = projects.findIndex((p) => (p.id && p.id === project.id) || p === project);
                const isSynced = project.includeInProfile ?? false;

                return (
                  <div
                    key={project.id || realIndex}
                    className={`card p-4 transition-all space-y-3 border ${
                      isSynced ? 'border-blue-500/30 bg-blue-950/10' : 'border-slate-800 bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Project Name</label>
                          <input
                            type="text"
                            value={project.name}
                            onChange={(e) => updateProject(realIndex, 'name', e.target.value)}
                            placeholder="e.g. MassMailer Engine"
                            className="input w-full text-sm font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Repo URL</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="url"
                              value={project.githubUrl ?? ''}
                              onChange={(e) => updateProject(realIndex, 'githubUrl', e.target.value)}
                              placeholder="https://github.com/..."
                              className="input w-full text-xs"
                            />
                            {project.githubUrl && (
                              <a
                                href={project.githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-400 hover:text-blue-400 p-1.5 bg-slate-800 rounded"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">Notes</label>
                          <input
                            type="text"
                            value={project.notes ?? ''}
                            onChange={(e) => updateProject(realIndex, 'notes', e.target.value)}
                            placeholder="Project notes..."
                            className="input w-full text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          type="button"
                          onClick={() => updateProject(realIndex, 'includeInProfile', !isSynced)}
                          className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                            isSynced ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {isSynced ? <Eye size={12} /> : <EyeOff size={12} />}
                          {isSynced ? 'Synced' : 'Personal'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProject(realIndex)}
                          className="text-slate-500 hover:text-rose-400 p-1.5"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer Save Button */}
      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button
          onClick={handleManualSave}
          disabled={saving}
          className="btn btn-primary flex items-center gap-2"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}
