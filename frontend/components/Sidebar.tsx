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
  Mail,
  Zap,
  BookOpen,
  BarChart3
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campaigns', icon: Send },
  { href: '/campaigns/new', label: 'New Campaign', icon: PenSquare },
  { href: '/templates', label: 'Templates', icon: BookOpen },
  { href: '/hr-contacts', label: 'HR Contacts', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="p-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm gradient-text">MassMailer</p>
            <p className="text-[10px] text-[var(--text-muted)]">Recruiter Outreach</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${active ? 'active' : ''}`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 px-2 py-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.name || 'User'}</p>
            <p className="text-[10px] text-[var(--text-muted)] truncate">{user?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="sidebar-item w-full text-[var(--danger)] hover:bg-red-500/10"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
