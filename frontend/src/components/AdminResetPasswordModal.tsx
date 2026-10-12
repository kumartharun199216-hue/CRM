import React, { useState } from 'react';
import { User, AdminPasswordResetResponse } from '../types';
import { api } from '../services/api';
import {
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  X,
  Eye,
  EyeOff,
  Mail,
  Shield,
  Briefcase,
  GraduationCap,
  ExternalLink,
  ShieldAlert,
  Info,
} from 'lucide-react';

interface AdminResetPasswordModalProps {
  user: User;
  onClose: () => void;
  onSuccess?: (res: AdminPasswordResetResponse) => void;
}

export const AdminResetPasswordModal: React.FC<AdminResetPasswordModalProps> = ({
  user,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminPasswordResetResponse | null>(null);
  const [showPassword, setShowPassword] = useState(true);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const employeeName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const employeeId = user.employee_id || `EMP-${String(user.id).padStart(4, '0')}`;
  const roleName = user.role === 'ADMIN' ? 'Admin' : user.role === 'MANAGER' ? 'Manager' : 'Career Counsellor';

  const handleConfirmReset = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminResetPassword(user.id);
      setResult(res);
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initiate password reset.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  const fullResetMessage = result
    ? `Skill Move Sales CRM — Password Reset Notification

Hello ${result.full_name || employeeName},

Your account password has been reset by an administrator/manager.

Employee ID: ${result.employee_id || employeeId}
Email: ${result.email || user.email}

Temporary Password: ${result.temporary_password || 'N/A'}
Reset / Login Link: ${result.reset_url || (typeof window !== 'undefined' ? `${window.location.origin}/?token=${result.reset_token}` : '')}

Notice: You will be required to choose a new password upon logging in. Please do not share these credentials with anyone.

Skill Move Admissions & Sales Team`
    : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-reset-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#172033] rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-slate-800 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className={`px-6 py-5 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between ${
          result ? 'bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white dark:from-emerald-950/40 dark:via-slate-900/50 dark:to-[#172033]' : 'bg-gradient-to-r from-amber-50 via-orange-50/30 to-white dark:from-amber-950/40 dark:via-slate-900/50 dark:to-[#172033]'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-xs ${
              result ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
            }`}>
              {result ? <CheckCircle2 className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
            </div>
            <div>
              <h2 id="admin-reset-password-title" className="text-base font-bold text-[#0F172A] dark:text-slate-100">
                {result ? 'Password Reset Successful' : 'Initiate Secure Password Reset'}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                {result ? 'New temporary credentials generated' : `Authorize credential reset for ${employeeName}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            /* Confirmation State */
            <div className="space-y-4">
              {/* Employee Summary Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  Target Employee Details
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px]">Full Name:</span>
                    <span className="font-semibold text-[#0F172A] dark:text-slate-200">{employeeName}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px]">Employee ID:</span>
                    <span className="font-mono font-semibold text-[#2563EB] dark:text-blue-400">{employeeId}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px]">Email Address:</span>
                    <span className="font-medium text-[#0F172A] dark:text-slate-200">{user.email}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px]">Role:</span>
                    <span className="inline-flex items-center gap-1 font-medium text-[#0F172A] dark:text-slate-200">
                      {user.role === 'ADMIN' ? (
                        <Shield className="w-3.5 h-3.5 text-[#7C3AED] dark:text-violet-400" />
                      ) : user.role === 'MANAGER' ? (
                        <Briefcase className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
                      ) : (
                        <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      {roleName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning Notice */}
              <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Important Security Considerations</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed pl-1">
                  <li>Existing active user sessions and refresh tokens will be immediately invalidated.</li>
                  <li>A single-use, cryptographically secure temporary password and reset token will be created.</li>
                  <li>The employee will be required to change their password on next login.</li>
                  <li>Neither administrators nor managers can ever view or retrieve current passwords.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirm-admin-reset-btn"
                  onClick={handleConfirmReset}
                  disabled={loading}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  {loading ? 'Initiating Reset...' : 'Confirm & Reset Password'}
                </button>
              </div>
            </div>
          ) : (
            /* Result State (Credentials & Status) */
            <div className="space-y-4">
              {/* Email Delivery Status Banner */}
              {result.email_delivery === 'UNAVAILABLE' || !result.email_sent ? (
                <div
                  id="email-unavailable-notice"
                  className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-900 dark:text-amber-200 flex items-start gap-3"
                >
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-xs text-amber-950 dark:text-amber-200">
                      Email Delivery Unavailable
                    </div>
                    <div className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                      Outbound email service is not configured on this server. No reset email was sent.
                      Please securely copy and provide the temporary credentials or reset link directly to the employee.
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  id="email-sent-notice"
                  className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-emerald-900 dark:text-emerald-200 flex items-start gap-3"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-xs text-emerald-950 dark:text-emerald-200">
                      Reset Email Dispatched
                    </div>
                    <div className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                      A secure password reset email with the activation link has been sent to {result.email}.
                    </div>
                  </div>
                </div>
              )}

              {/* Temporary Password Box */}
              {result.temporary_password && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      Temporary Password (One-Time)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[11px] font-medium text-[#2563EB] dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 font-mono text-sm font-bold bg-white dark:bg-[#111827] px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-slate-100 tracking-wider select-all overflow-x-auto">
                      {showPassword ? result.temporary_password : '••••••••••••••••'}
                    </div>
                    <button
                      type="button"
                      id="copy-temp-password-btn"
                      onClick={() => copyToClipboard(result.temporary_password || '', 'password')}
                      className="px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#0F172A] dark:text-slate-100 font-semibold text-xs rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                    >
                      {copiedType === 'password' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Direct Reset Link */}
              {result.reset_url && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 block">
                    Secure Reset Link (15 Minute Expiry)
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 font-mono text-xs bg-white dark:bg-[#111827] px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[#0F172A] dark:text-slate-100 truncate select-all">
                      {result.reset_url}
                    </div>
                    <button
                      type="button"
                      id="copy-reset-link-btn"
                      onClick={() => copyToClipboard(result.reset_url || '', 'link')}
                      className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#0F172A] dark:text-slate-100 font-semibold text-xs rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                    >
                      {copiedType === 'link' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Security Invalidation Badge */}
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-blue-900 dark:text-blue-300 flex items-center gap-2.5 text-[11px]">
                <Shield className="w-4 h-4 text-[#2563EB] dark:text-blue-400 shrink-0" />
                <span>
                  Previous sessions invalidated. User must set a permanent password upon login.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 gap-2">
                <button
                  type="button"
                  id="copy-all-reset-details-btn"
                  onClick={() => copyToClipboard(fullResetMessage, 'all')}
                  className="px-3.5 py-2 text-xs font-semibold text-[#2563EB] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 border border-[#BFDBFE] dark:border-blue-900/50 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedType === 'all' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied All</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Full Message</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="close-reset-modal-btn"
                  onClick={onClose}
                  className="crm-btn-primary px-5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
