import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import {
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
  Lock,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

interface ChangePasswordPageProps {
  user: User;
  onPasswordChanged: (updatedUser: User, newToken: string) => void;
  onLogout: () => void;
  onCancel?: () => void;
}

export const ChangePasswordPage: React.FC<ChangePasswordPageProps> = ({
  user,
  onPasswordChanged,
  onLogout,
  onCancel,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Password policy live checks
  const isMinLength = newPassword.length >= 8;
  const isDifferentFromCurrent = newPassword.length > 0 && currentPassword.length > 0 && newPassword !== currentPassword;
  const isMatching = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword.trim()) {
      setError('Please enter your current or temporary password.');
      return;
    }

    if (!isMinLength) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('The new password cannot be the same as your temporary password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.changePassword({
        old_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      onPasswordChanged(res.user, res.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change password. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    setLoggingOut(true);
    try {
      await api.logout().catch(() => {});
    } finally {
      onLogout();
    }
  };

  const roleLabel =
    user.role === 'ADMIN'
      ? 'System Administrator'
      : user.role === 'MANAGER'
      ? 'Sales Manager'
      : 'Career Counsellor';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-lg space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* CRM Branding */}
        <div className="text-center space-y-2">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white mx-auto shadow-md">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
            Skill Move Sales CRM
          </h1>
          <p className="text-xs text-[#64748B] font-medium">
            Enterprise Admissions & Counsellor Management Platform
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl overflow-hidden">
          {/* Header Banner */}
          <div className="px-6 py-5 border-b border-[#E2E8F0] bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs ${
                user.must_change_password ? 'bg-amber-500' : 'bg-[#2563EB]'
              }`}>
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">
                  {user.must_change_password ? 'Change Temporary Password' : 'Change Your Password'}
                </h2>
                <p className="text-xs text-[#64748B]">
                  {user.must_change_password ? 'First-login security requirement' : 'Secure your account credentials'}
                </p>
              </div>
            </div>
            {user.must_change_password ? (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                <span>Action Required</span>
              </div>
            ) : onCancel ? (
              <button
                type="button"
                id="cancel-change-password-btn"
                onClick={onCancel}
                className="text-xs font-semibold text-[#64748B] hover:text-[#0F172A] bg-white border border-[#CBD5E1] px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
              >
                Back to CRM
              </button>
            ) : null}
          </div>

          <div className="p-6 space-y-5">
            {/* Warning / Notice Banner */}
            {user.must_change_password ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-amber-950">
                    Password Change Required on First Login:
                  </span>{' '}
                  <span>
                    Your employee account was created with a temporary password. You must set a permanent password before accessing leads, pipelines, and CRM modules.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl text-[#1E3A8A] text-xs flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-[#1E3A8A]">
                    Account Security & Session Management:
                  </span>{' '}
                  <span>
                    Choose a strong, unique password. Updating your password will invalidate other active login sessions across devices according to our security policy.
                  </span>
                </div>
              </div>
            )}

            {/* Employee Profile Preview Chip */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                  Logged in as
                </p>
                <p className="font-bold text-[#0F172A] mt-0.5">
                  {user.full_name || user.username}
                </p>
                <p className="text-[11px] text-[#64748B]">{user.email}</p>
              </div>
              <div className="text-right">
                {user.employee_id && (
                  <span className="inline-block font-mono text-[11px] font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 mb-1">
                    {user.employee_id}
                  </span>
                )}
                <p className="text-[11px] font-semibold text-[#475569]">{roleLabel}</p>
                {user.team_name && (
                  <p className="text-[10px] text-[#64748B]">{user.team_name}</p>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div
                id="change-password-error"
                className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#DC2626] flex items-center gap-2 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626]" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Password Change Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current / Temporary Password */}
              <div>
                <label
                  htmlFor="current-password-input"
                  className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                >
                  Temporary / Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="current-password-input"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter your temporary password"
                    className="w-full text-xs bg-white border border-[#CBD5E1] rounded-xl pl-3.5 pr-10 py-2.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label
                  htmlFor="new-password-input"
                  className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                >
                  New Permanent Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="new-password-input"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="At least 8 characters (letters, numbers, symbols)"
                    className="w-full text-xs bg-white border border-[#CBD5E1] rounded-xl pl-3.5 pr-10 py-2.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label
                  htmlFor="confirm-password-input"
                  className="block text-xs font-semibold text-[#0F172A] mb-1.5"
                >
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="confirm-password-input"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter your new permanent password"
                    className="w-full text-xs bg-white border border-[#CBD5E1] rounded-xl pl-3.5 pr-10 py-2.5 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Policy Live Requirements Checklist */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px]">
                <p className="font-semibold text-slate-700 mb-1">Password Requirements:</p>
                <div className="flex items-center gap-2 text-slate-600">
                  {isMinLength ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className={isMinLength ? 'text-emerald-700 font-medium' : ''}>
                    At least 8 characters long
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  {isDifferentFromCurrent ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className={isDifferentFromCurrent ? 'text-emerald-700 font-medium' : ''}>
                    Different from your temporary password
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  {isMatching ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className={isMatching ? 'text-emerald-700 font-medium' : ''}>
                    New password and confirmation match
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="submit-change-password-btn"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{loading ? 'Updating Password...' : user.must_change_password ? 'Save Password & Enter CRM' : 'Update Password'}</span>
                {!loading && <ArrowRight className="w-4 h-4 ml-0.5" />}
              </button>
            </form>
          </div>

          {/* Footer with Logout Option */}
          <div className="px-6 py-4 bg-slate-50 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
            <span>Need to sign in as another user?</span>
            <button
              type="button"
              id="logout-change-password-btn"
              onClick={handleLogoutClick}
              disabled={loggingOut}
              className="text-[#DC2626] hover:text-[#B91C1C] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
