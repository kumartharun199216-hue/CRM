import React, { useState } from 'react';
import { User } from '../types';
import {
  CheckCircle2,
  Copy,
  Check,
  X,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Building,
  Shield,
  Briefcase,
  GraduationCap,
  Globe,
  ExternalLink,
} from 'lucide-react';

interface UserCreatedSuccessModalProps {
  user: User;
  onClose: () => void;
}

export const UserCreatedSuccessModal: React.FC<UserCreatedSuccessModalProps> = ({
  user,
  onClose,
}) => {
  const [showPassword, setShowPassword] = useState(true);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const employeeName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const employeeId = user.employee_id || `EMP-${String(user.id).padStart(4, '0')}`;
  const employeeEmail = user.email;
  const mobileNumber = user.mobile_number || '—';
  const roleName = user.role === 'ADMIN' ? 'Admin' : user.role === 'MANAGER' ? 'Manager' : 'Career Counsellor';
  const teamName = user.team_name || 'Skill Move Admissions';
  
  // Configured CRM Login URL
  const loginUrl = user.login_url || (typeof window !== 'undefined' ? `${window.location.origin}/` : 'http://localhost:5173/');
  const tempPassword = user.temporary_password || '********';

  // Exact personalized message template specified in prompt
  const personalizedMessage = `Welcome to Skill Move Sales CRM!

Hello ${employeeName},

Your employee account has been created successfully.

Employee ID: ${employeeId}

Login URL: ${loginUrl}

Email: ${employeeEmail}

Temporary Password: ${tempPassword}

Please log in and change your temporary password immediately. Do not share your credentials with anyone.

If you experience login issues, contact your Admin or Manager.

Thank you,
Skill Move Sales CRM Team`;

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      // Fallback
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="created-user-success-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="bg-white dark:bg-[#172033] rounded-2xl shadow-2xl border border-[#E2E8F0] dark:border-slate-800 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between bg-linear-to-r from-emerald-50 via-teal-50/40 to-white dark:from-emerald-950/40 dark:via-slate-900/50 dark:to-[#172033]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 id="created-user-success-title" className="text-base font-bold text-[#0F172A] dark:text-slate-100">
                Employee Account Created Successfully
              </h2>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                Temporary onboarding credentials have been securely generated.
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-success-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 text-xs text-[#0F172A] dark:text-slate-100 max-h-[75vh] overflow-y-auto">
          {/* Security Alert Notice */}
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold text-amber-950 dark:text-amber-100">First-Login Password Change Required: </span>
              This temporary password is displayed <span className="font-semibold underline">only once</span> in this dialog and is never saved in plaintext. Copy the onboarding message or credentials before closing.
            </div>
          </div>

          {/* Key Details Card */}
          <div className="bg-[#F8FAFC] dark:bg-slate-900/50 border border-[#E2E8F0] dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Employee Name */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">Employee Name</p>
                <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100 mt-0.5">{employeeName}</p>
              </div>

              {/* Employee ID */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">Employee ID</p>
                <p className="text-xs font-mono font-bold text-[#2563EB] dark:text-blue-400 mt-0.5 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/50 inline-block">
                  {employeeId}
                </p>
              </div>

              {/* Email */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">Email Address</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200 truncate" title={employeeEmail}>
                    {employeeEmail}
                  </span>
                </div>
              </div>

              {/* Mobile Number */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">Mobile Number</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs font-mono text-slate-800 dark:text-slate-200">{mobileNumber}</span>
                </div>
              </div>

              {/* Role */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">Role</p>
                <div className="mt-0.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-900/50">
                    {roleName}
                  </span>
                </div>
              </div>

              {/* Team */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">Team</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{teamName}</span>
                </div>
              </div>

              {/* Login URL */}
              <div className="sm:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">Configured CRM Login URL</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a
                    href={loginUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-[#2563EB] dark:text-blue-400 hover:underline flex items-center gap-1 truncate"
                  >
                    <span>{loginUrl}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              </div>
            </div>

            {/* Temporary Password Highlight Box */}
            <div className="mt-4 pt-3.5 border-t border-[#E2E8F0] dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Temporary Password</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-slate-700 rounded-lg shadow-2xs">
                <span className="font-mono text-sm font-bold tracking-wider text-emerald-700 dark:text-emerald-400 select-all">
                  {showPassword ? tempPassword : '•'.repeat(Math.min(tempPassword.length, 12))}
                </span>
                <button
                  type="button"
                  id="copy-temporary-password-btn"
                  onClick={() => copyToClipboard(tempPassword, 'password')}
                  className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-md transition flex items-center gap-1 cursor-pointer"
                >
                  {copiedType === 'password' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Copy Password</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Personalized Message Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                Personalized Onboarding Message Template
              </span>
              <button
                type="button"
                id="copy-login-message-btn"
                onClick={() => copyToClipboard(personalizedMessage, 'message')}
                className="text-[11px] font-semibold text-[#2563EB] dark:text-blue-400 hover:text-[#1D4ED8] flex items-center gap-1 cursor-pointer"
              >
                {copiedType === 'message' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Message Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Login Message</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-slate-900 dark:bg-black/60 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all border border-slate-800 dark:border-slate-700">
              {personalizedMessage}
            </pre>
          </div>
        </div>

        {/* Modal Action Buttons Footer */}
        <div className="px-6 py-4 bg-[#F8FAFC] dark:bg-[#111827] border-t border-[#E2E8F0] dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="copy-email-btn"
              onClick={() => copyToClipboard(employeeEmail, 'email')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              {copiedType === 'email' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400">Email Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Copy Email</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="copy-temporary-password-footer-btn"
              onClick={() => copyToClipboard(tempPassword, 'password')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              {copiedType === 'password' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400">Password Copied!</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Copy Temporary Password</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              id="copy-login-message-footer-btn"
              onClick={() => copyToClipboard(personalizedMessage, 'message')}
              className="px-3.5 py-1.5 text-xs font-semibold text-[#2563EB] dark:text-blue-400 bg-[#EFF6FF] dark:bg-blue-950/40 hover:bg-[#DBEAFE] dark:hover:bg-blue-900/50 border border-[#BFDBFE] dark:border-blue-900/50 rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              {copiedType === 'message' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">Message Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
                  <span>Copy Login Message</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="close-success-panel-btn"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition shadow-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
