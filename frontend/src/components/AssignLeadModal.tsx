import React, { useState, useEffect } from 'react';
import { Lead, Team, User } from '../types';
import { api } from '../services/api';
import {
  X,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Briefcase
} from 'lucide-react';

interface AssignLeadModalProps {
  lead: Lead | null;
  isOpen: boolean;
  users: User[];
  teams: Team[];
  currentUser: User;
  onClose: () => void;
  onAssignSuccess: (assignedLead: Lead) => Promise<void> | void;
}

export const AssignLeadModal: React.FC<AssignLeadModalProps> = ({
  lead,
  isOpen,
  users,
  teams,
  currentUser,
  onClose,
  onAssignSuccess,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const isManager = currentUser.role === 'MANAGER';
  const authorizedTeamId = currentUser.managed_team_id || currentUser.team;

  // Selected team & employee state
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selection when modal opens
  useEffect(() => {
    if (lead) {
      setError(null);
      setIsConfirming(false);
      const initialTeamId = lead.team || (isManager ? authorizedTeamId : teams[0]?.id) || '';
      setSelectedTeamId(initialTeamId);
      setSelectedUserId('');
    }
  }, [lead, isManager, authorizedTeamId, teams]);

  if (!isOpen || !lead) return null;

  // Eligible teams
  const eligibleTeams = isAdmin
    ? teams
    : teams.filter((t) => t.id === authorizedTeamId);

  // Active target users
  // For Admin: active sales employees in the selected team + active managers
  // For Manager: active sales employees in their authorized team + self (Manager)
  const eligibleUsers = users.filter((u) => {
    if (isManager) {
      if (u.id === currentUser.id) return true; // Manager self-assignment option
      if (u.role === 'SALES_EMPLOYEE' && u.team === authorizedTeamId) return true;
      return false;
    }
    if (isAdmin) {
      if (u.role === 'MANAGER') return true;
      if (u.role === 'SALES_EMPLOYEE') {
        if (!selectedTeamId) return true;
        return u.team === Number(selectedTeamId);
      }
      return false;
    }
    return false;
  });

  const selectedTargetUser = users.find((u) => u.id === Number(selectedUserId));
  const selectedTargetTeam = teams.find((t) => t.id === Number(selectedTeamId)) || teams.find((t) => t.id === lead.team);

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Please select an eligible employee or manager to assign this lead to.');
      return;
    }
    setError(null);
    setIsConfirming(true);
  };

  const handleExecuteAssignment = async () => {
    if (!lead || !selectedUserId) return;
    setLoading(true);
    setError(null);

    try {
      const payload: { employee_id: number; team_id?: number } = {
        employee_id: Number(selectedUserId),
      };
      if (selectedTeamId) {
        payload.team_id = Number(selectedTeamId);
      }

      const updatedLead = await api.assignLead(lead.id, payload);
      await onAssignSuccess(updatedLead);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign lead';
      setError(msg);
      setIsConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  const displayName = lead.name || lead.title || lead.contact_name || 'Student Lead';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs font-sans">
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] relative text-[#0F172A]">
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#2563EB] via-[#7C3AED] to-[#1E3A8A] opacity-90" />

        {/* Header */}
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] pt-4.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB] shadow-xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] leading-tight">
                Assign Lead: {lead.lead_id || `#${lead.id}`}
              </h3>
              <p className="text-[11px] text-[#64748B] m-0">
                Allocate this unassigned student lead to an eligible counsellor or manager
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#DC2626] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Assignment Error</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Student Lead Essential Details Card */}
          <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
              <span className="text-xs font-bold text-[#0F172A]">{displayName}</span>
              <span className="crm-pill crm-pill-blue font-mono text-[11px] font-semibold">
                {lead.lead_id || `#${lead.id}`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <span className="text-[10px] text-[#64748B] block font-medium">Email</span>
                <span className="text-[#0F172A] truncate block font-mono text-[11px]">
                  {lead.email || '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block font-medium">Mobile Phone</span>
                <span className="text-[#0F172A] font-mono text-[11px] block">
                  {lead.phone || '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block font-medium">Pipeline Stage</span>
                <span className="text-[#2563EB] font-medium text-[11px] block">
                  {lead.stage_name || 'Unassigned'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block font-medium">Degree / Qualification</span>
                <span className="text-[#0F172A] truncate block text-[11px]">
                  {lead.qualification || '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block font-medium">College / University</span>
                <span className="text-[#0F172A] truncate block text-[11px]">
                  {lead.college || '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block font-medium">Team Context</span>
                <span className="text-[#0F172A] truncate block text-[11px]">
                  {lead.team_name || (teams.find((t) => t.id === lead.team)?.name ?? '—')}
                </span>
              </div>
            </div>

            {(lead.key_skills || lead.target_role || lead.experience) && (
              <div className="pt-2 border-t border-[#E2E8F0] flex flex-wrap gap-2 text-[11px]">
                {lead.target_role && (
                  <span className="px-2 py-0.5 bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A]">
                    Role: <strong className="text-[#0F172A]">{lead.target_role}</strong>
                  </span>
                )}
                {lead.experience && (
                  <span className="px-2 py-0.5 bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A]">
                    Exp: <strong className="text-[#0F172A]">{lead.experience}</strong>
                  </span>
                )}
                {lead.key_skills && (
                  <span className="px-2 py-0.5 bg-white border border-[#CBD5E1] rounded-lg text-[#0F172A] truncate max-w-xs">
                    Skills: <strong className="text-[#0F172A]">{lead.key_skills}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {!isConfirming ? (
            /* Step 1: Target Selection Form */
            <form onSubmit={handleProceedToConfirm} className="space-y-4 pt-1">
              {isAdmin && (
                <div>
                  <label htmlFor="assign-team-select" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Target Team
                  </label>
                  <select
                    id="assign-team-select"
                    value={selectedTeamId}
                    onChange={(e) => {
                      const newTeamId = Number(e.target.value) || '';
                      setSelectedTeamId(newTeamId);
                      setSelectedUserId('');
                    }}
                    className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] transition cursor-pointer"
                  >
                    {eligibleTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#64748B] mt-1">
                    Admins can reallocate the lead across teams if needed.
                  </p>
                </div>
              )}

              {isManager && (
                <div className="p-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg text-xs text-[#1E3A8A] flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#2563EB] shrink-0" />
                  <div>
                    <span className="text-[11px] text-[#64748B] block">Authorized Team</span>
                    <span className="font-semibold text-[#0F172A]">
                      {teams.find((t) => t.id === authorizedTeamId)?.name || 'Admissions Team'}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="assign-target-select" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Select Assignee <span className="text-[#DC2626]">*</span>
                </label>
                <select
                  id="assign-target-select"
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value ? Number(e.target.value) : '');
                    setError(null);
                  }}
                  required
                  className="w-full bg-white border border-[#CBD5E1] rounded-lg px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] transition cursor-pointer"
                >
                  <option value="">-- Choose an eligible assignee --</option>

                  {/* Manager self-assignment option */}
                  {isManager && (
                    <optgroup label="Self-Assignment">
                      <option value={currentUser.id}>
                        ★ {currentUser.username} (Myself - Admissions Manager)
                      </option>
                    </optgroup>
                  )}

                  {/* Sales Employees / Counsellors */}
                  <optgroup label="Sales Employees / Counsellors">
                    {eligibleUsers
                      .filter((u) => u.role === 'SALES_EMPLOYEE')
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.username} ({u.team_name || 'Team member'})
                        </option>
                      ))}
                  </optgroup>

                  {/* Managers (for Admin assignment) */}
                  {isAdmin && (
                    <optgroup label="Managers">
                      {eligibleUsers
                        .filter((u) => u.role === 'MANAGER')
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.username} (Manager - {u.team_name || 'All Teams'})
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>

                <p className="text-[10px] text-[#64748B] mt-1">
                  {isManager
                    ? 'You can assign this lead to active counsellors in your team, or assign it directly to yourself.'
                    : 'Select an active counsellor or manager to take ownership of this lead.'}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={onClose}
                  className="crm-btn-secondary px-3.5 py-2 text-xs font-medium rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="proceed-assign-btn"
                  disabled={!selectedUserId}
                  className="crm-btn-primary flex items-center gap-1.5 px-4 py-2 text-white text-xs font-semibold rounded-lg transition cursor-pointer shadow-xs"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Review & Confirm</span>
                </button>
              </div>
            </form>
          ) : (
            /* Step 2: Confirmation Review */
            <div className="space-y-4 pt-1">
              <div className="p-4 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl space-y-2 text-[#1E3A8A]">
                <div className="flex items-center gap-2 text-[#2563EB] font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
                  <span>Confirm Lead Assignment</span>
                </div>
                <p className="text-xs text-[#0F172A]">
                  Are you sure you want to assign student lead{' '}
                  <strong className="text-[#0F172A]">{displayName}</strong> ({lead.lead_id || `#${lead.id}`}) to:
                </p>
                <div className="bg-white border border-[#BFDBFE] p-3 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Assignee:</span>
                    <span className="font-bold text-[#0F172A] font-mono">
                      {selectedTargetUser?.username} {selectedTargetUser?.id === currentUser.id ? '(You)' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Role:</span>
                    <span className="text-[#0F172A]">
                      {selectedTargetUser?.role === 'MANAGER' ? 'Admissions Manager' : 'Career Counsellor'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Team:</span>
                    <span className="text-[#0F172A]">
                      {selectedTargetTeam?.name || '—'}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[#64748B]">
                  This lead will be removed from the unassigned queue and logged to the assignment audit history.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setIsConfirming(false)}
                  disabled={loading}
                  className="crm-btn-secondary px-3.5 py-2 text-xs font-medium rounded-lg cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  id="confirm-assign-btn"
                  onClick={handleExecuteAssignment}
                  disabled={loading}
                  className="crm-btn-primary flex items-center gap-1.5 px-4 py-2 text-white text-xs font-semibold rounded-lg transition cursor-pointer shadow-xs"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Confirm & Assign</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
