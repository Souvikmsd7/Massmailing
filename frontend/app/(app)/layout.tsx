'use client';

import { AuthProvider } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex">
        <Sidebar />
        <main className="main-content flex-1">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
