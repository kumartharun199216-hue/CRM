import React, { useState, useEffect } from 'react';
import {
  Lead,
  PipelineStage,
  User,
  LeadAssignmentHistory,
  LeadStageHistory,
  CommunicationLog,
  LeadTimelineItem
} from '../types';
import { api } from '../services/api';
import {
  X,
  Edit,
  Phone,
  MessageSquare,
  Mail,
  GraduationCap,
  DollarSign,
  Clock,
  History,
  Shield,
  Layers,
  ChevronRight,
  UserCheck,
  CheckCircle2,
  Activity,
  ArrowRightCircle,
  FileText,
  User as UserIcon,
  Tag,
  AlertCircle
} from 'lucide-react';

interface Lead360ModalProps {
  lead: Lead | null;
  isOpen: boolean;
  stages: PipelineStage[];
  users: User[];
  currentUser: User;
  onClose: () => void;
  onEditLead: (lead: Lead) => void;
  onCommunicate: (lead: Lead, channel: 'EMAIL' | 'WHATSAPP' | 'CALL') => void;
  onUpdateStage?: (leadId: number, newStageId: number) => Promise<void>;
  onAssignEmployee: (leadId: number, newEmployeeId: number) => Promise<void>;
  onChangeStage?: (lead: Lead) => void;
}

export const Lead360Modal: React.FC<Lead360ModalProps> = ({
  lead,
  isOpen,
  stages,
  users,
  currentUser,
  onClose,
  onEditLead,
  onCommunicate,
  onUpdateStage,
  onAssignEmployee,
  onChangeStage,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'timeline' | 'stageHistory' | 'assignHistory' | 'communications'>('profile');
  const [stageHistory, setStageHistory] = useState<LeadStageHistory[]>([]);
  const [assignHistory, setAssignHistory] = useState<LeadAssignmentHistory[]>([]);
  const [commLogs, setCommLogs] = useState<CommunicationLog[]>([]);
  const [timeline, setTimeline] = useState<LeadTimelineItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [updatingAssign, setUpdatingAssign] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<'ALL' | 'STAGE' | 'COMMUNICATION' | 'ASSIGNMENT' | 'FINANCIAL'>('ALL');

  const isAdmin = currentUser.role === 'ADMIN';
  const isManager = currentUser.role === 'MANAGER';
  const isCounsellor = currentUser.role === 'SALES_EMPLOYEE';

  // Authorization scoping for modifying actions
  const canAssign = isAdmin || (isManager && (currentUser.managed_team_id || currentUser.team) === lead?.team);
  const canChangeStage = isAdmin ||
    (isManager && (currentUser.managed_team_id || currentUser.team) === lead?.team) ||
    (isCounsellor && lead?.assigned_employee === currentUser.id);

  // Eligible sales employees for assignment
  const eligibleEmployees = users.filter((u) => {
    if (u.role !== 'SALES_EMPLOYEE') return false;
    if (isAdmin) {
      return !lead || u.team === lead.team;
    }
    if (isManager) {
      const authorizedTeamId = currentUser.managed_team_id || currentUser.team;
      return u.team === authorizedTeamId;
    }
    return false;
  });

  const loadData = () => {
    if (!lead) return;
    setLoadingHistory(true);
    setLoadingTimeline(true);
    setActionSuccess(null);

    Promise.all([
      api.getStageHistory(lead.id).catch(() => [] as LeadStageHistory[]),
      api.getAssignmentHistory(lead.id).catch(() => [] as LeadAssignmentHistory[]),
      api.getCommunicationLogs({ lead: lead.id }).catch(() => [] as CommunicationLog[]),
      api.getLeadTimeline(lead.id).catch(() => ({ timeline: [] as LeadTimelineItem[] })),
    ])
      .then(([stagesRes, assignRes, commRes, timelineRes]) => {
        setStageHistory(stagesRes);
        setAssignHistory(assignRes);
        setCommLogs(commRes);
        setTimeline(timelineRes.timeline || []);
      })
      .finally(() => {
        setLoadingHistory(false);
        setLoadingTimeline(false);
      });
  };

  useEffect(() => {
    if (isOpen && lead) {
      loadData();
    }
  }, [isOpen, lead?.id, lead?.stage, lead?.updated_at]);

  if (!isOpen || !lead) return null;

  const currentStageObj = stages.find((s) => s.id === lead.stage);

  // Most recent stage change information
  const latestStageChange = stageHistory.length > 0 ? stageHistory[0] : null;
  const recentStageDate = lead.last_stage_change?.timestamp || latestStageChange?.timestamp;
  const recentStageBy = lead.last_stage_change?.changed_by_name || latestStageChange?.changed_by_name;
  const recentStageNote = lead.last_stage_change?.note || latestStageChange?.note;

  const handleAssignSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEmpId = Number(e.target.value);
    if (!newEmpId || newEmpId === lead.assigned_employee) return;
    setUpdatingAssign(true);
    setActionSuccess(null);
    try {
      await onAssignEmployee(lead.id, newEmpId);
      const updatedAssigns = await api.getAssignmentHistory(lead.id);
      setAssignHistory(updatedAssigns);
      setActionSuccess('Student assigned to employee successfully');
      loadData();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch {
      // handled in parent
    } finally {
      setUpdatingAssign(false);
    }
  };

  // Filtered timeline items
  const filteredTimeline = timeline.filter((item) => {
    if (timelineFilter === 'ALL') return true;
    if (timelineFilter === 'STAGE') return item.event_type === 'STAGE_CHANGED';
    if (timelineFilter === 'COMMUNICATION') return item.event_type.startsWith('COMMUNICATION_');
    if (timelineFilter === 'ASSIGNMENT') return item.event_type === 'LEAD_ASSIGNED' || item.event_type === 'LEAD_REASSIGNED';
    if (timelineFilter === 'FINANCIAL') return item.event_type === 'LEAD_FINANCIAL_UPDATED';
    return true;
  });


  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto font-sans">
      <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-slate-800 rounded-xl w-full max-w-4xl shadow-xl flex flex-col max-h-[92vh] overflow-hidden relative text-[#0F172A] dark:text-slate-100">
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#2563EB] via-[#7C3AED] to-[#1E3A8A] opacity-90" />

        {/* Header Bar */}
        <div className="p-5 border-b border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0F172A] flex items-start justify-between gap-4 pt-5.5">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white font-bold text-lg shadow-xs shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-[#0F172A] dark:text-slate-100 tracking-tight">{lead.name}</h2>
                <span className="crm-pill crm-pill-blue font-mono text-xs font-semibold">
                  {lead.lead_id}
                </span>
                {currentStageObj && (
                  <span className="crm-pill crm-pill-purple text-xs font-medium">
                    Stage {currentStageObj.order}: {currentStageObj.name}
                  </span>
                )}
                {lead.priority && (
                  <span
                    className={`crm-pill text-[11px] font-semibold ${
                      lead.priority.toLowerCase() === 'high' || lead.priority.toLowerCase() === 'urgent'
                        ? 'crm-pill-warning'
                        : 'crm-pill-blue'
                    }`}
                  >
                    {lead.priority} Priority
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-[#64748B] dark:text-slate-400 mt-1.5 flex-wrap">
                <span>{lead.email}</span>
                <span className="text-[#CBD5E1] dark:text-slate-600">•</span>
                <span className="font-mono">{lead.phone}</span>
                {lead.city && (
                  <>
                    <span className="text-[#CBD5E1] dark:text-slate-600">•</span>
                    <span>{lead.city}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Change Stage Button in Header if authorized */}
            {canChangeStage && onChangeStage && (
              <button
                type="button"
                onClick={() => onChangeStage(lead)}
                className="px-3 py-1.5 rounded-lg bg-[#F5F3FF] dark:bg-purple-950/40 hover:bg-[#EDE9FE] dark:hover:bg-purple-900/50 border border-[#DDD6FE] dark:border-purple-800/60 text-[#7C3AED] dark:text-purple-300 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Change Lead Stage with mandatory reason note"
              >
                <ArrowRightCircle className="w-3.5 h-3.5 text-[#7C3AED] dark:text-purple-400" />
                <span>Change Stage</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onEditLead(lead);
              }}
              className="crm-btn-primary px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Edit complete lead details"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit Lead</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-slate-200 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action feedback toast */}
        {actionSuccess && (
          <div className="bg-[#DCFCE7] dark:bg-emerald-950/40 border-b border-[#BBF7D0] dark:border-emerald-800/60 text-[#16A34A] dark:text-emerald-400 px-4 py-2 text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Quick Connect & Action Bar */}
        <div className="bg-white dark:bg-[#111827] px-5 py-3 border-b border-[#E2E8F0] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Quick Communication Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#64748B] dark:text-slate-400 font-medium">Quick Connect:</span>
            <button
              type="button"
              onClick={() => onCommunicate(lead, 'CALL')}
              className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/40 hover:bg-[#DBEAFE] dark:hover:bg-blue-900/50 text-[#2563EB] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-800/60 transition flex items-center gap-1 cursor-pointer font-medium"
            >
              <Phone className="w-3 h-3 text-[#2563EB] dark:text-blue-400" />
              <span>Call (Callyzer)</span>
            </button>
            <button
              type="button"
              onClick={() => onCommunicate(lead, 'WHATSAPP')}
              className="px-2.5 py-1 rounded-lg bg-[#DCFCE7] dark:bg-emerald-950/40 hover:bg-[#BBF7D0] dark:hover:bg-emerald-900/50 text-[#16A34A] dark:text-emerald-300 border border-[#BBF7D0] dark:border-emerald-800/60 transition flex items-center gap-1 cursor-pointer font-medium"
            >
              <MessageSquare className="w-3 h-3 text-[#16A34A] dark:text-emerald-400" />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => onCommunicate(lead, 'EMAIL')}
              className="px-2.5 py-1 rounded-lg bg-[#F3E8FF] dark:bg-purple-950/40 hover:bg-[#E9D5FF] dark:hover:bg-purple-900/50 text-[#7C3AED] dark:text-purple-300 border border-[#E9D5FF] dark:border-purple-800/60 transition flex items-center gap-1 cursor-pointer font-medium"
            >
              <Mail className="w-3 h-3 text-[#7C3AED] dark:text-purple-400" />
              <span>Email</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Change Stage Action */}
            {canChangeStage && onChangeStage && (
              <button
                type="button"
                onClick={() => onChangeStage(lead)}
                className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#2563EB] to-[#7C3AED] hover:from-[#1D4ED8] hover:to-[#6D28D9] text-white transition flex items-center gap-1.5 cursor-pointer font-semibold shadow-2xs"
                title="Change Pipeline Stage"
              >
                <ArrowRightCircle className="w-3 h-3 text-white" />
                <span>Change Stage</span>
              </button>
            )}

            {/* Quick Assignment for Admin/Manager */}
            {canAssign && (
              <div className="flex items-center gap-2">
                <span className="text-[#64748B] dark:text-slate-400 font-medium flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" /> Assigned:
                </span>
                <select
                  value={lead.assigned_employee || ''}
                  onChange={handleAssignSelect}
                  disabled={updatingAssign}
                  className="text-xs bg-[#F8FAFC] dark:bg-[#172033] border border-[#CBD5E1] dark:border-slate-700 rounded-lg px-2 py-1 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#2563EB] disabled:opacity-50 cursor-pointer"
                >
                  <option value="" disabled>-- Assign Lead --</option>
                  {eligibleEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.username}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0F172A] px-5 gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-[#2563EB] dark:border-blue-400 text-[#2563EB] dark:text-blue-400'
                : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            Student 360° Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'border-[#2563EB] dark:border-blue-400 text-[#2563EB] dark:text-blue-400'
                : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
            <span>Activity Timeline ({timeline.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stageHistory')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'stageHistory'
                ? 'border-[#7C3AED] dark:border-purple-400 text-[#7C3AED] dark:text-purple-400'
                : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#7C3AED] dark:text-purple-400" />
            <span>Stage History ({stageHistory.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assignHistory')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'assignHistory'
                ? 'border-[#D97706] dark:border-amber-400 text-[#D97706] dark:text-amber-400'
                : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[#D97706] dark:text-amber-400" />
            <span>Assignment History ({assignHistory.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('communications')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'communications'
                ? 'border-[#16A34A] dark:border-emerald-400 text-[#16A34A] dark:text-emerald-400'
                : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#16A34A] dark:text-emerald-400" />
            <span>Communications ({commLogs.length})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs scrollbar-thin">
          {/* TAB 1: Student 360° Profile */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Stage Information Card (Requirement 5.B) */}
              <div className="crm-card p-4 rounded-xl border border-[#DDD6FE] dark:border-purple-900/50 bg-gradient-to-br from-[#FAF5FF] to-white dark:from-purple-950/20 dark:to-[#172033] space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[#EDE9FE] dark:border-purple-900/40 pb-2">
                  <div className="flex items-center gap-2 text-[#7C3AED] dark:text-purple-300 font-semibold text-sm">
                    <Layers className="w-4 h-4 text-[#7C3AED] dark:text-purple-400" />
                    <span>Pipeline Stage & Transition Overview</span>
                  </div>
                  {canChangeStage && onChangeStage && (
                    <button
                      type="button"
                      onClick={() => onChangeStage(lead)}
                      className="px-2.5 py-1 bg-white dark:bg-[#111827] hover:bg-[#F5F3FF] dark:hover:bg-purple-950/50 border border-[#DDD6FE] dark:border-purple-800/60 text-[#7C3AED] dark:text-purple-300 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowRightCircle className="w-3.5 h-3.5 text-[#7C3AED] dark:text-purple-400" />
                      <span>Change Stage</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Current Stage</span>
                    <span className="inline-block px-2.5 py-0.5 rounded-lg bg-[#7C3AED]/10 dark:bg-purple-950/50 text-[#7C3AED] dark:text-purple-300 font-bold text-xs border border-[#DDD6FE] dark:border-purple-800/60">
                      {currentStageObj ? `${currentStageObj.order}. ${currentStageObj.name}` : 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Date of Last Transition</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium font-mono">
                      {recentStageDate ? new Date(recentStageDate).toLocaleString() : 'Initial stage upon creation'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Changed By</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium">
                      {recentStageBy || lead.created_by_name || 'System'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Status</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium">{lead.status || 'Active'}</span>
                  </div>
                </div>

                {/* Most recent stage-change note */}
                <div className="p-3 bg-white dark:bg-[#111827] border border-[#EDE9FE] dark:border-slate-800 rounded-lg">
                  <span className="text-[11px] text-[#64748B] dark:text-slate-400 font-semibold flex items-center gap-1 mb-1">
                    <FileText className="w-3.5 h-3.5 text-[#7C3AED] dark:text-purple-400" />
                    <span>Most Recent Stage Note</span>
                  </span>
                  <p className="text-xs text-[#334155] dark:text-slate-300 italic">
                    {recentStageNote
                      ? `"${recentStageNote}"`
                      : 'Initial stage assigned at lead creation. No change notes recorded yet.'}
                  </p>
                </div>
              </div>

              {/* Academic & Student Details Grid */}
              <div className="crm-card p-4 rounded-xl border border-[#E2E8F0] dark:border-slate-800 space-y-3 bg-[#F8FAFC] dark:bg-[#111827]/60">
                <div className="flex items-center gap-2 text-[#0F172A] dark:text-slate-200 font-semibold text-sm border-b border-[#E2E8F0] dark:border-slate-800 pb-2">
                  <GraduationCap className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
                  <span>Academic & Career Profile</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Degree / Qualification</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium">{lead.qualification || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">College / University</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium">{lead.college || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Year of Passing (YOP)</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium font-mono">{lead.yop || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Target Role</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium">{lead.target_role || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Prior Experience</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium">{lead.experience || 'Fresher'}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Key Skills</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium">{lead.key_skills || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Commercial & Admissions Forecast */}
              <div className="crm-card p-4 rounded-xl border border-[#E2E8F0] dark:border-slate-800 space-y-3 bg-[#F8FAFC] dark:bg-[#111827]/60">
                <div className="flex items-center gap-2 text-[#0F172A] dark:text-slate-200 font-semibold text-sm border-b border-[#E2E8F0] dark:border-slate-800 pb-2">
                  <DollarSign className="w-4 h-4 text-[#16A34A] dark:text-emerald-400" />
                  <span>Financial & Follow-up Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Estimated Revenue</span>
                    <span className="text-[#2563EB] dark:text-blue-400 font-mono font-semibold text-sm">
                      {lead.estimated_revenue !== null && lead.estimated_revenue !== undefined
                        ? `₹ ${Number(lead.estimated_revenue).toLocaleString()}`
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Placement Fee</span>
                    <span className="text-[#16A34A] dark:text-emerald-400 font-mono font-semibold text-sm">
                      {lead.placement_fee !== null && lead.placement_fee !== undefined
                        ? `₹ ${Number(lead.placement_fee).toLocaleString()}`
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Priority</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium">{lead.priority || 'Normal'}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Next Follow-Up</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium">
                      {lead.next_follow_up
                        ? new Date(lead.next_follow_up).toLocaleString()
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dedicated Pending Closure Financial Card (if record exists) */}
              {(lead.pending_closure_financial || lead.pre_closer_financial) && (() => {
                const fin = (lead.pending_closure_financial || lead.pre_closer_financial)!;
                return (
                  <div className="crm-card p-4 rounded-xl border border-[#DDD6FE] dark:border-purple-900/50 bg-gradient-to-br from-[#EFF6FF]/70 to-[#FAF5FF]/70 dark:from-blue-950/20 dark:to-purple-950/20 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#DDD6FE] dark:border-purple-900/40 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white text-xs font-bold shadow-2xs">
                          ₹
                        </div>
                        <span className="text-[#0F172A] dark:text-slate-100 font-bold text-sm">
                          Pending Closure Financial Agreement
                        </span>
                      </div>
                      <span className="text-[10px] bg-[#EDE9FE] dark:bg-purple-950/60 text-[#7C3AED] dark:text-purple-300 font-bold px-2 py-0.5 rounded-full border border-[#DDD6FE] dark:border-purple-800/60">
                        Locked Deal
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-800 rounded-lg">
                        <span className="text-[#64748B] dark:text-slate-400 block text-[10px] font-semibold uppercase tracking-wider mb-0.5">
                          Total Agreed Amount
                        </span>
                        <span className="text-base font-bold font-mono text-[#0F172A] dark:text-slate-100">
                          ₹ {Number(fin.agreed_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="p-3 bg-white dark:bg-[#111827] border border-[#BBF7D0] dark:border-emerald-900/50 rounded-lg">
                        <span className="text-[#16A34A] dark:text-emerald-400 block text-[10px] font-semibold uppercase tracking-wider mb-0.5">
                          Amount Paid
                        </span>
                        <span className="text-base font-bold font-mono text-[#16A34A] dark:text-emerald-400">
                          ₹ {Number(fin.amount_paid).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="p-3 bg-white dark:bg-[#111827] border border-[#BFDBFE] dark:border-blue-900/50 rounded-lg">
                        <span className="text-[#2563EB] dark:text-blue-400 block text-[10px] font-semibold uppercase tracking-wider mb-0.5">
                          Outstanding Balance
                        </span>
                        <span className="text-base font-bold font-mono text-[#2563EB] dark:text-blue-400">
                          ₹ {Number(fin.outstanding_balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-slate-400 pt-1">
                      <span>
                        Recorded by: <strong className="text-[#334155] dark:text-slate-200">{fin.updated_by_name || fin.created_by_name || 'Staff'}</strong>
                      </span>
                      {fin.updated_at && (
                        <span className="font-mono">
                          Last updated: {new Date(fin.updated_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}


              {/* Ownership & Accountability */}
              <div className="crm-card p-4 rounded-xl border border-[#E2E8F0] dark:border-slate-800 space-y-3 bg-[#F8FAFC] dark:bg-[#111827]/60">
                <div className="flex items-center gap-2 text-[#0F172A] dark:text-slate-200 font-semibold text-sm border-b border-[#E2E8F0] dark:border-slate-800 pb-2">
                  <Shield className="w-4 h-4 text-[#D97706] dark:text-amber-400" />
                  <span>Ownership & Team Accountability</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Assigned Counsellor</span>
                    <span className="text-[#2563EB] dark:text-blue-400 font-medium font-mono">
                      {lead.assigned_employee_name || lead.career_counsellor || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Admissions Team</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium">{lead.team_name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Created By</span>
                    <span className="text-[#0F172A] dark:text-slate-200 font-medium">
                      {lead.created_by_name || 'System Admin'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] dark:text-slate-400 block text-[11px] mb-0.5">Created Date</span>
                    <span className="text-[#64748B] dark:text-slate-400 font-mono">
                      {lead.created_at ? new Date(lead.created_at).toLocaleString() : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Complete Activity Timeline (Requirement 4 & 5.C) */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">Complete Activity Timeline</h3>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                    Persisted, chronological event log ordered newest first
                  </p>
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1.5 bg-[#F1F5F9] dark:bg-[#111827] p-1 rounded-lg border border-transparent dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setTimelineFilter('ALL')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                      timelineFilter === 'ALL'
                        ? 'bg-white dark:bg-slate-800 text-[#2563EB] dark:text-blue-400 shadow-2xs'
                        : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
                    }`}
                  >
                    All ({timeline.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineFilter('STAGE')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                      timelineFilter === 'STAGE'
                        ? 'bg-white dark:bg-slate-800 text-[#7C3AED] dark:text-purple-400 shadow-2xs'
                        : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
                    }`}
                  >
                    Stages ({timeline.filter((i) => i.event_type === 'STAGE_CHANGED').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineFilter('COMMUNICATION')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                      timelineFilter === 'COMMUNICATION'
                        ? 'bg-white dark:bg-slate-800 text-[#16A34A] dark:text-emerald-400 shadow-2xs'
                        : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
                    }`}
                  >
                    Communications ({timeline.filter((i) => i.event_type.startsWith('COMMUNICATION_')).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineFilter('ASSIGNMENT')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                      timelineFilter === 'ASSIGNMENT'
                        ? 'bg-white dark:bg-slate-800 text-[#D97706] dark:text-amber-400 shadow-2xs'
                        : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
                    }`}
                  >
                    Assignments ({timeline.filter((i) => i.event_type === 'LEAD_ASSIGNED' || i.event_type === 'LEAD_REASSIGNED').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimelineFilter('FINANCIAL')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                      timelineFilter === 'FINANCIAL'
                        ? 'bg-white dark:bg-slate-800 text-[#059669] dark:text-emerald-400 shadow-2xs'
                        : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
                    }`}
                  >
                    Financial ({timeline.filter((i) => i.event_type === 'LEAD_FINANCIAL_UPDATED').length})
                  </button>
                </div>
              </div>

              {loadingTimeline ? (
                <div className="py-12 text-center text-[#64748B] dark:text-slate-400 animate-pulse">Loading activity timeline...</div>
              ) : filteredTimeline.length === 0 ? (
                <div className="py-12 text-center text-[#64748B] dark:text-slate-400 border border-dashed border-[#CBD5E1] dark:border-slate-800 rounded-xl bg-[#F8FAFC] dark:bg-[#111827]/40">
                  No activities found for this filter.
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E2E8F0] dark:before:bg-slate-700">
                  {filteredTimeline.map((item) => {
                    const isFinancial = item.event_type === 'LEAD_FINANCIAL_UPDATED';
                    const isStage = item.event_type === 'STAGE_CHANGED';
                    const isAssign = item.event_type === 'LEAD_ASSIGNED' || item.event_type === 'LEAD_REASSIGNED';
                    const isCall = item.event_type === 'COMMUNICATION_CALL';
                    const isWhatsApp = item.event_type === 'COMMUNICATION_WHATSAPP';
                    const isEmail = item.event_type === 'COMMUNICATION_EMAIL';
                    const isCreated = item.event_type === 'LEAD_CREATED';

                    return (
                      <div key={item.id} className="relative group">
                        {/* Dot on timeline */}
                        <div
                          className={`absolute -left-6 top-2.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#172033] shadow-2xs ${
                            isFinancial
                              ? 'bg-[#10B981]'
                              : isStage
                              ? 'bg-[#7C3AED]'
                              : isAssign
                              ? 'bg-[#D97706]'
                              : isCall || isWhatsApp
                              ? 'bg-[#16A34A]'
                              : isEmail
                              ? 'bg-[#2563EB]'
                              : 'bg-[#64748B]'
                          }`}
                        />

                        {/* Card */}
                        <div className="p-3.5 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-800 rounded-xl hover:border-[#CBD5E1] dark:hover:border-slate-700 transition-all space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              {/* Event Badge */}
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase ${
                                  isFinancial
                                    ? 'bg-[#ECFDF5] dark:bg-emerald-950/40 text-[#059669] dark:text-emerald-400 border border-[#A7F3D0] dark:border-emerald-900/50'
                                    : isStage
                                    ? 'bg-[#F3E8FF] dark:bg-purple-950/40 text-[#7C3AED] dark:text-purple-300 border border-[#E9D5FF] dark:border-purple-900/50'
                                    : isAssign
                                    ? 'bg-[#FEF3C7] dark:bg-amber-950/40 text-[#D97706] dark:text-amber-300 border border-[#FDE68A] dark:border-amber-900/50'
                                    : isCall || isWhatsApp
                                    ? 'bg-[#DCFCE7] dark:bg-emerald-950/40 text-[#16A34A] dark:text-emerald-400 border border-[#BBF7D0] dark:border-emerald-900/50'
                                    : isEmail
                                    ? 'bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 border border-[#BFDBFE] dark:border-blue-900/50'
                                    : 'bg-[#F1F5F9] dark:bg-slate-800 text-[#64748B] dark:text-slate-400 border border-[#E2E8F0] dark:border-slate-700'
                                }`}
                              >
                                {isFinancial ? 'FINANCIAL' : item.event_type.replace('COMMUNICATION_', '')}
                              </span>

                              <span className="font-semibold text-xs text-[#0F172A] dark:text-slate-100">
                                {item.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-slate-400 font-mono">
                              <span>{item.timestamp_display || new Date(item.timestamp).toLocaleString()}</span>
                            </div>
                          </div>

                          <p className="text-xs text-[#475569] dark:text-slate-300">{item.description}</p>

                          {/* Stage Transition Note Callout */}
                          {item.note && (
                            <div className="p-2.5 bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-slate-800 rounded-lg text-xs">
                              <span className="text-[10px] text-[#7C3AED] dark:text-purple-400 font-semibold block uppercase tracking-wider mb-0.5">
                                Reason / Note
                              </span>
                              <p className="text-[#0F172A] dark:text-slate-200 italic">"{item.note}"</p>
                            </div>
                          )}

                          {/* Before & After Values */}
                          {(item.before_value || item.after_value) && (
                            <div className="flex items-center gap-2 text-[11px] text-[#64748B] dark:text-slate-400 pt-1">
                              <span className="px-1.5 py-0.5 bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-slate-800 rounded font-medium text-[#64748B] dark:text-slate-300">
                                {item.before_value || 'None'}
                              </span>
                              <ChevronRight className="w-3 h-3 text-[#94A3B8] dark:text-slate-500" />
                              <span className="px-1.5 py-0.5 bg-[#EFF6FF] dark:bg-blue-950/50 border border-[#BFDBFE] dark:border-blue-900/60 text-[#2563EB] dark:text-blue-300 rounded font-semibold">
                                {item.after_value}
                              </span>
                            </div>
                          )}

                          {/* Performed by footer */}
                          <div className="pt-1 border-t border-[#E2E8F0]/70 dark:border-slate-800 flex items-center justify-between text-[11px] text-[#64748B] dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <UserIcon className="w-3 h-3 text-[#94A3B8] dark:text-slate-500" />
                              <span>Action by: <strong className="text-[#334155] dark:text-slate-200">{item.actor_name}</strong></span>
                            </span>
                            {item.outcome && (
                              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white dark:bg-[#172033] border border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-slate-200">
                                Status: {item.outcome}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Stage Progression History (Requirement 5.D) */}
          {activeTab === 'stageHistory' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">Stage Progression History</h3>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                    Complete history of previous stages, destination stages, actors, and mandatory notes
                  </p>
                </div>
                {canChangeStage && onChangeStage && (
                  <button
                    type="button"
                    onClick={() => onChangeStage(lead)}
                    className="px-3 py-1.5 bg-gradient-to-r from-[#2563EB] to-[#7C3AED] hover:from-[#1D4ED8] hover:to-[#6D28D9] text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5 text-white" />
                    <span>Change Stage</span>
                  </button>
                )}
              </div>

              {loadingHistory ? (
                <div className="py-8 text-center text-[#64748B] dark:text-slate-400 animate-pulse">Loading stage timeline...</div>
              ) : stageHistory.length === 0 ? (
                <div className="py-8 text-center text-[#64748B] dark:text-slate-400 border border-dashed border-[#CBD5E1] dark:border-slate-800 rounded-xl bg-[#F8FAFC] dark:bg-[#111827]/40">
                  No previous stage changes recorded for this student. Currently in stage: {currentStageObj?.name || 'Initial'}.
                </div>
              ) : (
                <div className="space-y-3">
                  {stageHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-800 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#172033] border border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-slate-200 font-medium text-xs">
                            {item.from_stage_name || 'Initial Intake'}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400" />
                          <span className="crm-pill crm-pill-purple font-semibold text-xs">
                            {item.to_stage_name}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] text-[#64748B] dark:text-slate-400 font-mono">
                            {new Date(item.timestamp).toLocaleString()}
                          </div>
                          <div className="text-[10px] text-[#64748B] dark:text-slate-400">Changed by: <strong className="text-[#334155] dark:text-slate-200">{item.changed_by_name}</strong></div>
                        </div>
                      </div>

                      {/* Mandatory Change Note */}
                      <div className="p-2.5 bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-slate-800 rounded-lg">
                        <span className="text-[10px] text-[#7C3AED] dark:text-purple-400 font-semibold block uppercase tracking-wider mb-0.5">
                          Mandatory Stage Note
                        </span>
                        <p className="text-xs text-[#0F172A] dark:text-slate-200 italic">
                          {item.note ? `"${item.note}"` : 'No note recorded.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Assignment History */}
          {activeTab === 'assignHistory' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">Ownership & Assignment History</h3>
              {loadingHistory ? (
                <div className="py-8 text-center text-[#64748B] dark:text-slate-400 animate-pulse">Loading assignment records...</div>
              ) : assignHistory.length === 0 ? (
                <div className="py-8 text-center text-[#64748B] dark:text-slate-400 border border-dashed border-[#CBD5E1] dark:border-slate-800 rounded-xl bg-[#F8FAFC] dark:bg-[#111827]/40">
                  Initial assignment: {lead.assigned_employee_name || 'Unassigned'} ({lead.team_name || 'No Team'}). No reassignment events.
                </div>
              ) : (
                <div className="space-y-3">
                  {assignHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-800 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#64748B] dark:text-slate-400 font-mono">{item.from_employee_name || 'Unassigned'}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400" />
                          <span className="text-[#2563EB] dark:text-blue-400 font-mono font-semibold">{item.to_employee_name}</span>
                        </div>
                        <div className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                          Team: {item.to_team_name} {item.from_team_name && item.from_team_name !== item.to_team_name ? `(from ${item.from_team_name})` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-[#64748B] dark:text-slate-400 font-mono">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[#64748B] dark:text-slate-400">Authorized by: {item.changed_by_name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Communications */}
          {activeTab === 'communications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-[#0F172A] dark:text-slate-100">Communication Timeline (Calls, WhatsApp, Emails)</h3>
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onCommunicate(lead, 'CALL')}
                    className="px-2.5 py-1 crm-btn-secondary rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Phone className="w-3 h-3 text-[#16A34A] dark:text-emerald-400" /> Log Call
                  </button>
                  <button
                    type="button"
                    onClick={() => onCommunicate(lead, 'WHATSAPP')}
                    className="px-2.5 py-1 crm-btn-secondary rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquare className="w-3 h-3 text-[#16A34A] dark:text-emerald-400" /> WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => onCommunicate(lead, 'EMAIL')}
                    className="px-2.5 py-1 crm-btn-secondary rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Mail className="w-3 h-3 text-[#2563EB] dark:text-blue-400" /> Send Email
                  </button>
                </div>
              </div>

              {loadingHistory ? (
                <div className="py-8 text-center text-[#64748B] dark:text-slate-400 animate-pulse">Loading communications...</div>
              ) : commLogs.length === 0 ? (
                <div className="py-8 text-center text-[#64748B] dark:text-slate-400 border border-dashed border-[#CBD5E1] dark:border-slate-800 rounded-xl bg-[#F8FAFC] dark:bg-[#111827]/40">
                  No interactions recorded yet. Use the buttons above to initiate call, WhatsApp, or email.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {commLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-800 rounded-xl flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-white dark:bg-[#172033] border border-[#CBD5E1] dark:border-slate-700 text-[#0F172A] dark:text-slate-200 mt-0.5">
                          {log.channel === 'CALL' && <Phone className="w-3.5 h-3.5 text-[#16A34A] dark:text-emerald-400" />}
                          {log.channel === 'WHATSAPP' && <MessageSquare className="w-3.5 h-3.5 text-[#16A34A] dark:text-emerald-400" />}
                          {log.channel === 'EMAIL' && <Mail className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#0F172A] dark:text-slate-200 uppercase text-[11px]">{log.channel}</span>
                            <span className="crm-pill font-mono text-[10px]">
                              {log.status}
                            </span>
                            <span className="text-[#64748B] dark:text-slate-400 text-[10px]">
                              To: {log.recipient}
                            </span>
                          </div>
                          {log.subject && <div className="text-[#0F172A] dark:text-slate-100 font-medium text-xs mt-1">{log.subject}</div>}
                          {log.content && <p className="text-[#64748B] dark:text-slate-300 text-xs mt-0.5">{log.content}</p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-[#64748B] dark:text-slate-400 font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-[#64748B] dark:text-slate-400">By: {log.initiated_by_name || 'Agent'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0F172A] flex items-center justify-between text-xs text-[#64748B] dark:text-slate-400">
          <span>Lead 360° Comprehensive Profile & Activity Timeline</span>
          <button
            type="button"
            onClick={onClose}
            className="crm-btn-secondary px-4 py-1.5 rounded-lg transition font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
