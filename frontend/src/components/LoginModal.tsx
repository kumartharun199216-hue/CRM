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
    <div className="fixed inset-0 z-50 bg-[#F8FAFC] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white p-7 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-xl relative overflow-hidden space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center font-bold text-white text-xl mx-auto shadow-md">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-black text-[#0F172A] tracking-tight">Skill Move</h2>
          <p className="text-xs text-[#64748B]">
            Admissions & Sales CRM Portal
          </p>
        </div>

        {/* Quick Role Selection Chips */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-center">
            Sign In As:
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill('admin@skillmove.com')}
              className={`p-2.5 rounded-xl border text-left text-xs transition flex flex-col items-center gap-1.5 cursor-pointer ${
                username === 'admin@skillmove.com'
                  ? 'bg-[#F3E8FF] border-[#7C3AED] text-[#7C3AED] ring-1 ring-[#7C3AED] font-semibold'
                  : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#EFF6FF]'
              }`}
            >
              <Shield className="w-4 h-4 text-[#7C3AED]" />
              <span className="font-semibold text-[11px]">Admin</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('manager@skillmove.com')}
              className={`p-2.5 rounded-xl border text-left text-xs transition flex flex-col items-center gap-1.5 cursor-pointer ${
                username === 'manager@skillmove.com'
                  ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB] ring-1 ring-[#2563EB] font-semibold'
                  : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#EFF6FF]'
              }`}
            >
              <Briefcase className="w-4 h-4 text-[#2563EB]" />
              <span className="font-semibold text-[11px]">Manager</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('counsellor@skillmove.com')}
              className={`p-2.5 rounded-xl border text-left text-xs transition flex flex-col items-center gap-1.5 cursor-pointer ${
                username === 'counsellor@skillmove.com'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500 font-semibold'
                  : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#EFF6FF]'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold text-[11px]">Counsellor</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#DC2626] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Email / Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="name@skillmove.com"
              className="w-full text-xs bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40 transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#0F172A]">Password</label>
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
                className="text-[11px] font-semibold text-[#2563EB] hover:underline cursor-pointer"
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
                className="w-full text-xs bg-white border border-[#E2E8F0] rounded-xl pl-3.5 pr-10 py-2.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/40 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] transition focus:outline-none cursor-pointer"
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

        <div className="text-center text-[11px] text-[#64748B]">
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
