'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Zap, Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#07070c]">
      {/* Dynamic Ambient Background Orbs */}
      <div className="fixed top-1/4 left-1/3 w-96 h-96 rounded-full bg-violet-600/15 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/3 w-96 h-96 rounded-full bg-cyan-500/15 blur-[120px] pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(#8b5cf6_1px,transparent_1px)] [background-size:32px_32px] opacity-15 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-600 to-cyan-400 p-[1.5px] shadow-2xl shadow-violet-500/30 mb-4">
            <div className="w-full h-full bg-[#0a0a0f] rounded-[14px] flex items-center justify-center">
              <Zap size={32} className="text-violet-400 fill-violet-400/20" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold mb-1 font-outfit tracking-tight">
            <span className="gradient-text">MassMailer</span>
          </h1>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
            Recruiter Outreach & Intelligence
          </p>
        </div>

        {/* Glass Card */}
        <div className="card p-8 shadow-2xl shadow-violet-950/40 border-violet-500/25 bg-slate-950/80 backdrop-blur-2xl">
          <h2 className="text-xl font-bold text-slate-100 mb-1 font-outfit">Welcome back</h2>
          <p className="text-slate-400 text-xs mb-6">Enter your authorized credentials to access the platform</p>

          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs mb-5 animate-fadeIn">
              <AlertCircle size={16} className="flex-shrink-0 text-red-400" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="form-group">
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@massmailer.local"
                  required
                  autoComplete="email"
                  className="input pl-10 text-sm"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="input pl-10 pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg w-full justify-center mt-2 shadow-lg shadow-violet-500/25"
            >
              {loading ? (
                <>
                  <span className="spinner border-white border-t-transparent" style={{ width: 16, height: 16 }} />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-400">
              Default Credentials: <code className="text-violet-400 font-mono">admin@massmailer.local</code> / <code className="text-violet-400 font-mono">Admin@1234</code>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500 mt-6">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Encrypted JWT session & isolated outreach queue</span>
        </div>
      </div>
    </div>
  );
}
