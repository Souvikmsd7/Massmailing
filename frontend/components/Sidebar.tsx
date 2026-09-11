'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard,
  Send,
  Users,
  PenSquare,
  Settings,
  LogOut,
  Zap,
  BookOpen,
  BarChart3,
  Sparkles
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campaigns', icon: Send },
  { href: '/campaigns/new', label: 'New Campaign', icon: PenSquare },
  { href: '/templates', label: 'Templates', icon: BookOpen },
  { href: '/hr-contacts', label: 'HR Directory', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar shadow-2xl">
      {/* Brand Header */}
      <div className="p-5 border-b border-[var(--border)] bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-600 to-cyan-400 p-[1px] shadow-lg shadow-violet-500/20">
            <div className="w-full h-full bg-[#0a0a0f] rounded-[11px] flex items-center justify-center">
              <Zap size={18} className="text-violet-400 fill-violet-400/20" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-extrabold text-base tracking-tight gradient-text font-outfit">MassMailer</p>
              <span className="badge badge-violet text-[9px] px-1.5 py-0.5 font-bold uppercase">Pro</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Recruiter Outreach</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 flex flex-col gap-1.5 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 pt-2 pb-1">Main Menu</p>
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item group ${active ? 'active' : ''}`}
            >
              <Icon size={17} className={`transition-transform duration-200 group-hover:scale-110 ${active ? 'text-violet-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info & Footer */}
      <div className="p-3 border-t border-[var(--border)] bg-slate-950/60">
        <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl bg-slate-900/50 border border-slate-800/80">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-500 flex items-center justify-center text-xs font-bold text-white shadow-md">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'User'}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="sidebar-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 justify-center border border-transparent hover:border-red-500/20"
        >
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
