import React, { useState } from 'react';
import { api } from '../services/api';
import { User, PasswordResetRequestResponse } from '../types';
import {
  KeyRound,
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, token: string) => void;
  initialToken?: string | null;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialToken = null,
}) => {
  const [step, setStep] = useState<'REQUEST' | 'CONFIRM'>(initialToken ? 'CONFIRM' : 'REQUEST');

  // Request form state
  const [identifier, setIdentifier] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestResult, setRequestResult] = useState<PasswordResetRequestResponse | null>(null);

  // Confirm form state
  const [resetToken, setResetToken] = useState(initialToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Password policy live checks
  const isMinLength = newPassword.length >= 8;
  const isMatching = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please provide your username or email address.');
      return;
    }
    setError(null);
    setRequestLoading(true);

    try {
      const res = await api.requestPasswordReset({ identifier: identifier.trim() });
      setRequestResult(res);
      if (res.reset_token) {
        setResetToken(res.reset_token);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit reset request.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!resetToken.trim()) {
      setError('Reset token is required.');
      return;
    }

    if (!isMinLength) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setConfirmLoading(true);
    try {
      const res = await api.confirmPasswordReset({
        token: resetToken.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      localStorage.setItem('crm_token', res.token);
      onSuccess(res.user, res.token);
    } catch (err: any) {
      if (err.data && err.data.token) {
        setError(Array.isArray(err.data.token) ? err.data.token.join(' ') : String(err.data.token));
      } else if (err.data && err.data.new_password) {
        setError(Array.isArray(err.data.new_password) ? err.data.new_password.join(' ') : String(err.data.new_password));
      } else {
        setError(err.message || 'Failed to reset password. Please check your token.');
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCopy = (text: string, type: 'token' | 'url') => {
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#172033] rounded-2xl border border-[#E2E8F0] dark:border-slate-800 shadow-2xl relative overflow-hidden space-y-5">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] dark:border-slate-800 bg-gradient-to-r from-blue-50/80 to-white dark:from-blue-950/30 dark:to-[#172033] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white shadow-xs">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-slate-100">
                {step === 'REQUEST' ? 'Account Recovery' : 'Set New Password'}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                {step === 'REQUEST' ? 'Initiate a secure password reset' : 'Single-use token verification'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-slate-200 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
            id="close-reset-modal-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {error && (
            <div
              id="reset-modal-error"
              className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-[#DC2626] dark:text-red-400 flex items-center gap-2 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] dark:text-red-400" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {step === 'REQUEST' ? (
            /* STEP 1: Request Password Reset */
            !requestResult ? (
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Enter your registered username or email address. We will generate a secure, single-use, time-limited recovery procedure.
                </p>

                <div>
                  <label htmlFor="reset-identifier-input" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                    Username or Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      id="reset-identifier-input"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      placeholder="e.g. rohit.sharma@skillmove.in"
                      className="w-full text-xs bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('CONFIRM')}
                    className="text-xs text-[#2563EB] dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                  >
                    I already have a reset token
                  </button>

                  <button
                    type="submit"
                    id="request-reset-btn"
                    disabled={requestLoading}
                    className="crm-btn-primary px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {requestLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Request</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Request Result / Unconfigured Email Banner */
              <div className="space-y-4">
                {requestResult.email_delivery === 'UNAVAILABLE' ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Email Delivery Unavailable (SMTP Not Configured)</span>
                    </div>
                    <p className="text-amber-800 dark:text-amber-400 text-[11px] leading-relaxed">
                      Delivery is unavailable because external SMTP credentials are not configured in this environment. A secure single-use recovery token has been generated below:
                    </p>
                    {requestResult.reset_token && (
                      <div className="mt-2 p-2 bg-white dark:bg-[#111827] rounded-lg border border-amber-300 dark:border-amber-800 font-mono text-[11px] text-[#0F172A] dark:text-slate-200 flex items-center justify-between">
                        <span className="truncate mr-2">{requestResult.reset_token}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(requestResult.reset_token!, 'token')}
                          className="p-1 text-[#2563EB] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded shrink-0 cursor-pointer"
                          title="Copy Token"
                        >
                          {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-900 dark:text-emerald-300 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-medium leading-relaxed">
                      {requestResult.detail}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="crm-btn-secondary px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    id="proceed-to-reset-btn"
                    onClick={() => {
                      setStep('CONFIRM');
                    }}
                    className="crm-btn-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>Proceed to Set Password</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          ) : (
            /* STEP 2: Confirm Password Reset with Token */
            <form onSubmit={handleConfirmSubmit} id="reset-confirm-form" className="space-y-4">
              <div>
                <label htmlFor="reset-token-input" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                  Single-Use Reset Token <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    id="reset-token-input"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    required
                    placeholder="Paste single-use reset token..."
                    className="w-full text-xs font-mono bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reset-new-password-input" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    id="reset-new-password-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="At least 8 characters..."
                    className="w-full text-xs bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reset-confirm-password-input" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1.5">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="reset-confirm-password-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter new password..."
                    className="w-full text-xs bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Policy Live Checks */}
              <div className="p-3 bg-slate-50 dark:bg-[#111827]/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 text-[11px]">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  {isMinLength ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                  )}
                  <span className={isMinLength ? 'text-emerald-700 dark:text-emerald-400 font-medium' : ''}>
                    At least 8 characters long
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  {isMatching ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                  )}
                  <span className={isMatching ? 'text-emerald-700 dark:text-emerald-400 font-medium' : ''}>
                    Passwords match
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep('REQUEST')}
                  className="text-xs text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-slate-200 font-semibold cursor-pointer"
                >
                  ← Request another token
                </button>

                <button
                  type="submit"
                  id="submit-reset-confirm-btn"
                  disabled={confirmLoading}
                  className="crm-btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {confirmLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Reset Password & Sign In</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
export default PasswordResetModal;
