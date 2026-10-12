import React, { useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { LogIn, AlertCircle, Sparkles, Shield, Briefcase, GraduationCap, Eye, EyeOff } from 'lucide-react';
import { PasswordResetModal } from './PasswordResetModal';

interface LoginModalProps {
  onSuccess: (user: User, token: string) => void;
  onForgotPassword?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onSuccess, onForgotPassword }) => {
  const [username, setUsername] = useState('admin@skillmove.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInternalResetOpen, setIsInternalResetOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(username, password);
      localStorage.setItem('crm_token', res.token);
      onSuccess(res.user, res.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (roleEmail: string) => {
    setUsername(roleEmail);
    setPassword('ADmin@123');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F8FAFC] dark:bg-[#0B1120] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white dark:bg-[#172033] p-7 sm:p-8 rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-xl relative overflow-hidden space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center font-bold text-white text-xl mx-auto shadow-md">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-black text-[#0F172A] dark:text-slate-100 tracking-tight">Skill Move</h2>
          <p className="text-xs text-[#64748B] dark:text-slate-400">
            Admissions & Sales CRM Portal
          </p>
        </div>

        {/* Quick Role Selection Chips */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider text-center">
            Sign In As:
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('admin@skillmove.com')}
              className={`p-2.5 rounded-xl border text-left text-xs transition flex flex-col items-center gap-1.5 cursor-pointer ${
                username === 'admin@skillmove.com'
                  ? 'bg-[#F3E8FF] dark:bg-purple-950/40 border-[#7C3AED] dark:border-purple-600 text-[#7C3AED] dark:text-purple-300 ring-1 ring-[#7C3AED] font-semibold'
                  : 'bg-[#F8FAFC] dark:bg-slate-900/50 border-[#E2E8F0] dark:border-slate-800 text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-slate-800'
              }`}
            >
              <Shield className="w-4 h-4 text-[#7C3AED] dark:text-violet-400" />
              <span className="font-semibold text-[11px]">Admin</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('manager@skillmove.com')}
              className={`p-2.5 rounded-xl border text-left text-xs transition flex flex-col items-center gap-1.5 cursor-pointer ${
                username === 'manager@skillmove.com'
                  ? 'bg-[#EFF6FF] dark:bg-blue-950/40 border-[#2563EB] dark:border-blue-600 text-[#2563EB] dark:text-blue-300 ring-1 ring-[#2563EB] font-semibold'
                  : 'bg-[#F8FAFC] dark:bg-slate-900/50 border-[#E2E8F0] dark:border-slate-800 text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-slate-800'
              }`}
            >
              <Briefcase className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
              <span className="font-semibold text-[11px]">Manager</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('counsellor@skillmove.com')}
              className={`p-2.5 rounded-xl border text-left text-xs transition flex flex-col items-center gap-1.5 cursor-pointer ${
                username === 'counsellor@skillmove.com'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500 font-semibold'
                  : 'bg-[#F8FAFC] dark:bg-slate-900/50 border-[#E2E8F0] dark:border-slate-800 text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-slate-800'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-[11px]">Counsellor</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-[#DC2626] dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] dark:text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">Email / Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="name@skillmove.com"
              className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-blue-500 focus:ring-1 focus:ring-[#2563EB]/40 transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">Password</label>
              <button
                type="button"
                id="login-forgot-password-btn"
                onClick={() => {
                  if (onForgotPassword) {
                    onForgotPassword();
                  } else {
                    setIsInternalResetOpen(true);
                  }
                }}
                className="text-[11px] font-semibold text-[#2563EB] dark:text-blue-400 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-blue-500 focus:ring-1 focus:ring-[#2563EB]/40 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200 transition focus:outline-none cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="crm-btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold tracking-wide text-white transition disabled:opacity-50 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Signing in...' : 'Sign In to Skill Move'}
          </button>
        </form>

        <div className="text-center text-[11px] text-[#64748B] dark:text-slate-400">
          Sign in with your configured development credentials
        </div>

        {/* Self-service password reset modal */}
        <PasswordResetModal
          isOpen={isInternalResetOpen}
          onClose={() => setIsInternalResetOpen(false)}
          onSuccess={(user, token) => {
            setIsInternalResetOpen(false);
            localStorage.setItem('crm_token', token);
            onSuccess(user, token);
          }}
        />
      </div>
    </div>
  );
};
