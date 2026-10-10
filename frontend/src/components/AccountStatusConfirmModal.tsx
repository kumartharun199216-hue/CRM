import React, { useState, useEffect } from 'react';
import { User, Team } from '../types';
import { api } from '../services/api';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  UserX,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Info,
  Users,
  Shield,
  Briefcase,
  GraduationCap,
} from 'lucide-react';

interface AccountStatusConfirmModalProps {
  user: User;
  currentUser: User | null;
  teams: Team[];
  onClose: () => void;
  onSuccess: (updatedUser: User, message: string) => void;
}

export const AccountStatusConfirmModal: React.FC<AccountStatusConfirmModalProps> = ({
  user,
  currentUser,
  teams,
  onClose,
  onSuccess,
}) => {
  const isActive = user.is_active !== false && user.account_status !== 'INACTIVE';
  const isDeactivating = isActive;

  const isAdmin = currentUser?.role === 'ADMIN' || (currentUser as any)?.is_superuser;
  const isSelf = currentUser?.id === user.id;

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldReassignLeads, setShouldReassignLeads] = useState(false);
  const [eligibleAssignees, setEligibleAssignees] = useState<User[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | string>('');
  const [loadingAssignees, setLoadingAssignees] = useState(false);

  const employeeName =
    user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
  const employeeId = user.employee_id || `EMP-${String(user.id).padStart(4, '0')}`;
  const roleName =
    user.role === 'ADMIN'
      ? 'System Administrator'
      : user.role === 'MANAGER'
      ? 'Sales Manager'
      : 'Career Counsellor';

  // Fetch eligible active users for lead reassignment when deactivating
  useEffect(() => {
    if (isDeactivating) {
      let isMounted = true;
      setLoadingAssignees(true);
      api
        .getUsers(user.team ? { team: user.team } : undefined)
        .then((teamUsers) => {
          if (!isMounted) return;
          // Filter to active users excluding the user being deactivated
          const eligible = (teamUsers || []).filter(
            (u) => u.id !== user.id && u.is_active !== false && (u.role === 'SALES_EMPLOYEE' || u.role === 'MANAGER')
          );
          setEligibleAssignees(eligible);
          if (eligible.length > 0) {
            setSelectedAssigneeId(eligible[0].id);
          }
        })
        .catch(() => {
          // Non-fatal if lead assignee fetch fails
        })
        .finally(() => {
          if (isMounted) setLoadingAssignees(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isDeactivating, user.team, user.id]);

  const handleConfirm = async () => {
    if (isSelf && isDeactivating) {
      setError('You cannot deactivate your own account.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isDeactivating) {
        const payload = {
          reassign_leads_to:
            shouldReassignLeads && selectedAssigneeId
              ? Number(selectedAssigneeId)
              : undefined,
        };
        const res = await api.deactivateUser(user.id, payload);
        onSuccess(
          res.user,
          res.reassigned_leads_count
            ? `${res.detail} (${res.reassigned_leads_count} leads reassigned)`
            : res.detail
        );
      } else {
        const res = await api.activateUser(user.id);
        onSuccess(res.user, res.detail);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || `Failed to ${isDeactivating ? 'deactivate' : 'activate'} account.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      id="account-status-modal-overlay"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
        id="account-status-modal"
      >
        {/* Header Banner */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${
            isDeactivating
              ? 'bg-rose-50/80 border-rose-100 text-rose-900'
              : 'bg-emerald-50/80 border-emerald-100 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
                isDeactivating
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-emerald-100 text-emerald-600'
              }`}
            >
              {isDeactivating ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold">
                {isDeactivating ? 'Deactivate Employee Account' : 'Activate Employee Account'}
              </h2>
              <p className="text-xs opacity-80">
                {isDeactivating
                  ? 'Revoke access permissions and authenticate rights'
                  : 'Restore login access and lead assignment capabilities'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            id="close-status-modal-btn"
            className="w-8 h-8 rounded-lg hover:bg-black/5 flex items-center justify-center transition cursor-pointer text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Target User Info Summary */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                {employeeName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-xs text-slate-900">{employeeName}</div>
                <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                  <span>{employeeId}</span>
                  <span>•</span>
                  <span>{user.email}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-600 block">{roleName}</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in"
              id="status-action-error-banner"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Action Failed: </span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Self-Deactivation Warning */}
          {isSelf && isDeactivating && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Administrative Safeguard: </span>
                You cannot deactivate your own account. Another authorized administrator must make this change to prevent accidental lockout.
              </div>
            </div>
          )}

          {/* Deactivation Details & Safeguards */}
          {isDeactivating ? (
            <div className="space-y-3.5 text-xs text-slate-600">
              <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-semibold text-rose-900">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Security & Access Consequences</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1 text-[11px]">
                  <li>
                    <strong>Immediate Session Revocation:</strong> All current sessions, tokens, and active refresh tokens will be terminated immediately.
                  </li>
                  <li>
                    <strong>Login Restriction:</strong> The employee cannot authenticate into Skill Move CRM.
                  </li>
                  <li>
                    <strong>Data Preservation:</strong> No user records or lead histories are deleted. The account remains preserved for historical auditing.
                  </li>
                </ul>
              </div>

              {/* Optional Lead Reassignment Checkbox */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    id="reassign-leads-checkbox"
                    checked={shouldReassignLeads}
                    onChange={(e) => setShouldReassignLeads(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <div className="font-semibold text-slate-900 text-xs">
                      Reassign active leads owned by this employee
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Transfer all active leads currently assigned to {employeeName} to another active team counsellor.
                    </div>
                  </div>
                </label>

                {shouldReassignLeads && (
                  <div className="pl-6 pt-1 animate-in fade-in">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Transfer Active Leads To:
                    </label>
                    {loadingAssignees ? (
                      <div className="text-xs text-slate-500 italic py-1">Loading team members...</div>
                    ) : eligibleAssignees.length > 0 ? (
                      <select
                        id="reassign-leads-select"
                        value={selectedAssigneeId}
                        onChange={(e) => setSelectedAssigneeId(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                      >
                        {eligibleAssignees.map((assignee) => (
                          <option key={assignee.id} value={assignee.id}>
                            {assignee.full_name || assignee.username} ({assignee.role === 'MANAGER' ? 'Manager' : 'Counsellor'})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-2 bg-amber-50 text-amber-800 text-[11px] rounded-lg border border-amber-200">
                        No other active members found in this team. Leads will remain safely associated with this employee's historical record or can be reallocated later from the Unassigned Leads queue.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Activation Details */
            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-semibold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Account Restoration</span>
                </div>
                <p className="text-[11px] text-slate-700">
                  Activating <strong>{employeeName}</strong> will restore their access to Skill Move CRM.
                  They will be able to log in with their existing credentials, be assigned incoming leads, and view authorized team records.
                </p>
              </div>
            </div>
          )}

          {/* Audit Logging Note */}
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 px-1">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>This action and timestamp will be permanently logged in the CRM Audit Trail.</span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            id="cancel-status-action-btn"
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            id="confirm-status-action-btn"
            disabled={loading || (isSelf && isDeactivating)}
            className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isDeactivating
                ? 'bg-rose-600 hover:bg-rose-700 active:scale-98'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
            }`}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : isDeactivating ? (
              <>
                <UserX className="w-3.5 h-3.5" />
                <span>Confirm Deactivation</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                <span>Confirm Activation</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
