import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Lead,
  PipelineStage,
  User,
  Team,
  LeadAssignmentHistory,
  LeadStageHistory,
  CommunicationLog,
  LeadTimelineItem,
  PreCloserFinancial,
  LeadFinancialHistoryEntry,
  ChangeStagePayload
} from '../types';
import { getStageStyle } from './SpreadsheetView';
import { api } from '../services/api';
import {
  ArrowLeft,
  ChevronRight,
  User as UserIcon,
  Users,
  GraduationCap,
  Calendar,
  Clock,
  IndianRupee,
  Phone,
  Mail,
  MessageSquare,
  Activity,
  History,
  Edit3,
  Check,
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Send,
  UserCheck,
  Tag,
  MapPin,
  Briefcase,
  Layers,
  FileText,
  RefreshCw,
  Info,
  ExternalLink,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface Lead360PageProps {
  leadId: number | string;
  currentUser: User;
  stages: PipelineStage[];
  teams: Team[];
  users: User[];
  onBack: () => void;
  onCommunicate?: (lead: Lead, channel: 'EMAIL' | 'WHATSAPP' | 'CALL') => void;
  onLeadUpdated?: (lead: Lead) => void;
}

const formatINR = (val: number | string | null | undefined): string => {
  const num = Number(val || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num);
};

const formatIST = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

export const Lead360Page: React.FC<Lead360PageProps> = ({
  leadId,
  currentUser,
  stages,
  teams,
  users,
  onBack,
  onCommunicate,
  onLeadUpdated,
}) => {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<
    'overview' | 'info' | 'timeline' | 'communications' | 'followup' | 'history' | 'financial'
  >('overview');

  // Lead State
  const [lead, setLead] = useState<Lead | null>(null);
  const [loadingLead, setLoadingLead] = useState<boolean>(true);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadNotFound, setLeadNotFound] = useState<boolean>(false);
  const [leadForbidden, setLeadForbidden] = useState<boolean>(false);

  // Timeline State
  const [timeline, setTimeline] = useState<LeadTimelineItem[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState<boolean>(false);
  const [timelineFilter, setTimelineFilter] = useState<
    'ALL' | 'STAGE' | 'COMMUNICATION' | 'ASSIGNMENT' | 'FINANCIAL' | 'AUDIT'
  >('ALL');

  // Histories State
  const [stageHistory, setStageHistory] = useState<LeadStageHistory[]>([]);
  const [assignHistory, setAssignHistory] = useState<LeadAssignmentHistory[]>([]);
  const [loadingHistories, setLoadingHistories] = useState<boolean>(false);

  // Communications State
  const [commLogs, setCommLogs] = useState<CommunicationLog[]>([]);
  const [loadingCommLogs, setLoadingCommLogs] = useState<boolean>(false);
  const [commChannelFilter, setCommChannelFilter] = useState<'ALL' | 'EMAIL' | 'WHATSAPP' | 'CALL'>('ALL');

  // Financial State
  const [financialData, setFinancialData] = useState<PreCloserFinancial | null>(null);
  const [financialHistory, setFinancialHistory] = useState<LeadFinancialHistoryEntry[]>([]);
  const [loadingFinancial, setLoadingFinancial] = useState<boolean>(false);
  const [financialForm, setFinancialForm] = useState({ agreed_amount: '', amount_paid: '', note: '' });
  const [savingFinancial, setSavingFinancial] = useState(false);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const [financialSuccess, setFinancialSuccess] = useState<string | null>(null);

  // Edit Lead Information State
  const [isEditingInfo, setIsEditingInfo] = useState<boolean>(false);
  const [infoFormData, setInfoFormData] = useState<Record<string, any>>({});
  const [infoFormErrors, setInfoFormErrors] = useState<Record<string, string>>({});
  const [savingInfo, setSavingInfo] = useState<boolean>(false);
  const [saveInfoSuccess, setSaveInfoSuccess] = useState<string | null>(null);

  // Follow-Up Scheduling State
  const [followUpDateInput, setFollowUpDateInput] = useState<string>('');
  const [savingFollowUp, setSavingFollowUp] = useState<boolean>(false);
  const [followUpSuccess, setFollowUpSuccess] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  // Stage Transition Inline Form State
  const [isChangingStage, setIsChangingStage] = useState<boolean>(false);
  const [destStageId, setDestStageId] = useState<string>('');
  const [stageChangeNote, setStageChangeNote] = useState<string>('');
  const [stageFinancialAgreed, setStageFinancialAgreed] = useState<string>('');
  const [stageFinancialPaid, setStageFinancialPaid] = useState<string>('');
  const [savingStageChange, setSavingStageChange] = useState<boolean>(false);
  const [stageChangeError, setStageChangeError] = useState<string | null>(null);

  // Assignment Modal/Inline State
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [assignTargetUserId, setAssignTargetUserId] = useState<string>('');
  const [assignTargetTeamId, setAssignTargetTeamId] = useState<string>('');
  const [savingAssign, setSavingAssign] = useState<boolean>(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'ADMIN';
  const isManager = currentUser.role === 'MANAGER';
  const isCounsellor = currentUser.role === 'SALES_EMPLOYEE';

  // Role permissions on this lead
  const canReassign = isAdmin || (isManager && (currentUser.managed_team_id || currentUser.team) === lead?.team);
  const canEditLead = isAdmin ||
    (isManager && (currentUser.managed_team_id || currentUser.team) === lead?.team) ||
    (isCounsellor && lead?.assigned_employee === currentUser.id);

  // Canonical stages ordered 1-12
  const canonicalStages = useMemo(() => {
    return [...stages].sort((a, b) => a.order - b.order);
  }, [stages]);

  const isPendingClosure = useMemo(() => {
    if (!lead || !lead.stage) return false;
    const stageObj = stages.find((s) => s.id === lead.stage);
    if (!stageObj) return lead.stage_name === 'Pending Closure';
    return stageObj.order === 9 || stageObj.name.trim().toLowerCase().replace(/[\s-_]/g, '') === 'pendingclosure';
  }, [lead, stages]);

  // Keep onLeadUpdated ref current without triggering re-renders
  const onLeadUpdatedRef = useRef(onLeadUpdated);
  useEffect(() => {
    onLeadUpdatedRef.current = onLeadUpdated;
  }, [onLeadUpdated]);

  // Load Lead Data
  const fetchLeadDetails = useCallback(async () => {
    if (!leadId) {
      setLoadingLead(false);
      setLeadNotFound(true);
      return;
    }
    setLoadingLead(true);
    setLeadError(null);
    setLeadNotFound(false);
    setLeadForbidden(false);

    try {
      let fetchedLead: Lead;
      if (typeof leadId === 'number' || /^\d+$/.test(String(leadId))) {
        fetchedLead = await api.getLead(Number(leadId));
      } else {
        // String code e.g. SM-LD-0001
        const list = await api.getLeads({ search: String(leadId) });
        const exact = list.find((l) => l.lead_id === leadId || l.id.toString() === leadId);
        if (!exact) {
          setLeadNotFound(true);
          setLoadingLead(false);
          return;
        }
        fetchedLead = exact;
      }

      setLead(fetchedLead);
      // NOTE: Do NOT call onLeadUpdated on initial fetch. Calling it on read triggers
      // an infinite state update / re-render loop with parent components.

      // Prepopulate form data
      setInfoFormData({
        name: fetchedLead.name || '',
        email: fetchedLead.email || '',
        phone: fetchedLead.phone || '',
        qualification: fetchedLead.qualification || '',
        college: fetchedLead.college || '',
        yop: fetchedLead.yop || '',
        key_skills: fetchedLead.key_skills || '',
        target_role: fetchedLead.target_role || '',
        experience: fetchedLead.experience || '',
        city: fetchedLead.city || '',
        priority: fetchedLead.priority || 'Normal',
        status: fetchedLead.status || 'Active',
        source: fetchedLead.source || '',
      });

      // Follow-up input
      if (fetchedLead.next_follow_up) {
        try {
          const d = new Date(fetchedLead.next_follow_up);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const h = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          setFollowUpDateInput(`${y}-${m}-${day}T${h}:${min}`);
        } catch {
          setFollowUpDateInput('');
        }
      } else {
        setFollowUpDateInput('');
      }

      // Check financial record if present
      if (fetchedLead.pre_closer_financial) {
        setFinancialData(fetchedLead.pre_closer_financial);
        setFinancialForm({
          agreed_amount: String(fetchedLead.pre_closer_financial.agreed_amount || ''),
          amount_paid: String(fetchedLead.pre_closer_financial.amount_paid || ''),
          note: '',
        });
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to load lead';
      if (msg.includes('404') || msg.includes('not found') || msg.includes('Not found')) {
        setLeadNotFound(true);
      } else if (msg.includes('403') || msg.includes('permission') || msg.includes('Forbidden')) {
        setLeadForbidden(true);
      } else {
        setLeadError(msg);
      }
    } finally {
      setLoadingLead(false);
    }
  }, [leadId]);

  // Load Related Data: Timeline, Histories, Communications, Financials
  const fetchTimeline = useCallback(async (id: number) => {
    setLoadingTimeline(true);
    try {
      const res = await api.getLeadTimeline(id);
      setTimeline(res.timeline || []);
    } catch {
      // non-fatal
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  const fetchHistories = useCallback(async (id: number) => {
    setLoadingHistories(true);
    try {
      const [sh, ah] = await Promise.all([
        api.getStageHistory(id).catch(() => []),
        api.getAssignmentHistory(id).catch(() => []),
      ]);
      setStageHistory(sh);
      setAssignHistory(ah);
    } catch {
      // non-fatal
    } finally {
      setLoadingHistories(false);
    }
  }, []);

  const fetchCommunications = useCallback(async (id: number) => {
    setLoadingCommLogs(true);
    try {
      const logs = await api.getCommunicationLogs({ lead: id });
      setCommLogs(logs || []);
    } catch {
      // non-fatal
    } finally {
      setLoadingCommLogs(false);
    }
  }, []);

  const fetchFinancials = useCallback(async (id: number) => {
    setLoadingFinancial(true);
    try {
      const res = await api.getLeadFinancial(id);
      if (res && res.financial) {
        setFinancialData(res.financial);
        setFinancialHistory(res.history || []);
        setFinancialForm({
          agreed_amount: String(res.financial.agreed_amount || ''),
          amount_paid: String(res.financial.amount_paid || ''),
          note: '',
        });
      }
    } catch {
      // lead might not have a financial record yet
    } finally {
      setLoadingFinancial(false);
    }
  }, []);

  useEffect(() => {
    fetchLeadDetails();
  }, [fetchLeadDetails]);

  useEffect(() => {
    if (lead && lead.id) {
      fetchTimeline(lead.id);
      fetchHistories(lead.id);
      fetchCommunications(lead.id);
      fetchFinancials(lead.id);
    }
  }, [lead?.id, fetchTimeline, fetchHistories, fetchCommunications, fetchFinancials]);

  // Handle Save Lead Info
  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    // Frontend validation
    const errors: Record<string, string> = {};
    if (!infoFormData.name || !infoFormData.name.trim()) errors.name = 'Lead name is required.';
    if (!infoFormData.email || !infoFormData.email.trim()) errors.email = 'Email address is required.';
    if (!infoFormData.phone || !infoFormData.phone.trim()) errors.phone = 'Mobile number is required.';

    if (Object.keys(errors).length > 0) {
      setInfoFormErrors(errors);
      return;
    }

    setSavingInfo(true);
    setInfoFormErrors({});
    setSaveInfoSuccess(null);

    try {
      const updated = await api.updateLead(lead.id, infoFormData);
      setLead(updated);
      setIsEditingInfo(false);
      setSaveInfoSuccess('Lead details successfully saved.');
      setTimeout(() => setSaveInfoSuccess(null), 4000);
      onLeadUpdatedRef.current?.(updated);
      fetchTimeline(lead.id);
    } catch (err: any) {
      setInfoFormErrors({ general: err instanceof Error ? err.message : 'Failed to update lead information.' });
    } finally {
      setSavingInfo(false);
    }
  };

  // Handle Save Follow-Up Date
  const handleSaveFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    setSavingFollowUp(true);
    setFollowUpError(null);
    setFollowUpSuccess(null);

    try {
      let isoStr: string | null = null;
      if (followUpDateInput) {
        isoStr = new Date(followUpDateInput).toISOString();
      }
      const updated = await api.updateLead(lead.id, { next_follow_up: isoStr });
      setLead(updated);
      setFollowUpSuccess('Next follow-up timestamp successfully updated.');
      setTimeout(() => setFollowUpSuccess(null), 4000);
      onLeadUpdatedRef.current?.(updated);
      fetchTimeline(lead.id);
    } catch (err: any) {
      setFollowUpError(err instanceof Error ? err.message : 'Failed to save follow-up date.');
    } finally {
      setSavingFollowUp(false);
    }
  };

  // Handle Stage Change
  const handleExecuteStageChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !destStageId) return;

    const destStage = stages.find((s) => s.id === Number(destStageId));
    if (!destStage) return;

    const isDestPendingClosure =
      destStage.order === 9 || destStage.name.trim().toLowerCase().replace(/[\s-_]/g, '') === 'pendingclosure';

    if (isDestPendingClosure) {
      if (!stageFinancialAgreed || Number(stageFinancialAgreed) <= 0) {
        setStageChangeError('Total agreed amount is required for Pending Closure.');
        return;
      }
      if (stageFinancialPaid === '' || Number(stageFinancialPaid) < 0) {
        setStageChangeError('Amount paid must be 0 or greater for Pending Closure.');
        return;
      }
      if (Number(stageFinancialPaid) > Number(stageFinancialAgreed)) {
        setStageChangeError('Amount paid cannot exceed agreed amount.');
        return;
      }
    }

    if (!stageChangeNote || !stageChangeNote.trim()) {
      setStageChangeError('A note explaining the transition is mandatory.');
      return;
    }

    setSavingStageChange(true);
    setStageChangeError(null);

    try {
      const payload: ChangeStagePayload = {
        destination_stage_id: Number(destStageId),
        note: stageChangeNote.trim(),
        expected_current_stage_id: lead.stage,
      };

      if (isDestPendingClosure) {
        payload.agreed_amount = Number(stageFinancialAgreed);
        payload.amount_paid = Number(stageFinancialPaid);
      }

      const res = await api.changeLeadStage(lead.id, payload);
      setLead(res.lead);
      setIsChangingStage(false);
      setDestStageId('');
      setStageChangeNote('');
      setStageFinancialAgreed('');
      setStageFinancialPaid('');
      onLeadUpdatedRef.current?.(res.lead);
      fetchTimeline(lead.id);
      fetchHistories(lead.id);
      fetchFinancials(lead.id);
    } catch (err: any) {
      setStageChangeError(err instanceof Error ? err.message : 'Stage transition failed.');
    } finally {
      setSavingStageChange(false);
    }
  };

  // Handle Reassignment
  const handleExecuteAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead || !assignTargetUserId) return;

    setSavingAssign(true);
    setAssignError(null);

    try {
      const payload: { employee_id: number; team_id?: number } = {
        employee_id: Number(assignTargetUserId),
      };
      if (assignTargetTeamId) {
        payload.team_id = Number(assignTargetTeamId);
      }

      const updated = await api.assignLead(lead.id, payload);
      setLead(updated);
      setIsAssigning(false);
      setAssignTargetUserId('');
      setAssignTargetTeamId('');
      onLeadUpdatedRef.current?.(updated);
      fetchTimeline(lead.id);
      fetchHistories(lead.id);
    } catch (err: any) {
      setAssignError(err instanceof Error ? err.message : 'Assignment update failed.');
    } finally {
      setSavingAssign(false);
    }
  };

  // Handle Save Financials
  const handleSaveFinancials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    const agreed = Number(financialForm.agreed_amount);
    const paid = Number(financialForm.amount_paid);

    if (isNaN(agreed) || agreed < 0) {
      setFinancialError('Agreed amount must be a non-negative number.');
      return;
    }
    if (isNaN(paid) || paid < 0) {
      setFinancialError('Amount paid must be a non-negative number.');
      return;
    }
    if (paid > agreed) {
      setFinancialError('Amount paid cannot exceed total agreed amount.');
      return;
    }

    setSavingFinancial(true);
    setFinancialError(null);
    setFinancialSuccess(null);

    try {
      const res = await api.updateLeadFinancial(lead.id, {
        agreed_amount: agreed,
        amount_paid: paid,
        note: financialForm.note || 'Financial details updated from Lead 360 Workspace',
      });
      setFinancialData(res.financial);
      setFinancialHistory((prev) => [res.history_entry, ...prev]);
      setFinancialSuccess('Financial record successfully updated.');
      setTimeout(() => setFinancialSuccess(null), 4000);
      fetchTimeline(lead.id);
    } catch (err: any) {
      setFinancialError(err instanceof Error ? err.message : 'Failed to update financial details.');
    } finally {
      setSavingFinancial(false);
    }
  };

  // Filtered timeline
  const filteredTimeline = useMemo(() => {
    if (timelineFilter === 'ALL') return timeline;
    return timeline.filter((evt) => {
      if (timelineFilter === 'STAGE') return evt.event_type === 'LEAD_STAGE_CHANGED';
      if (timelineFilter === 'COMMUNICATION') return evt.event_type.startsWith('COMMUNICATION');
      if (timelineFilter === 'ASSIGNMENT') return evt.event_type === 'LEAD_ASSIGNED' || evt.event_type === 'LEAD_REASSIGNED';
      if (timelineFilter === 'FINANCIAL') return evt.event_type.includes('FINANCIAL');
      if (timelineFilter === 'AUDIT') return !evt.event_type.startsWith('COMMUNICATION') && !evt.event_type.includes('STAGE');
      return true;
    });
  }, [timeline, timelineFilter]);

  // Filtered communications
  const filteredCommunications = useMemo(() => {
    if (commChannelFilter === 'ALL') return commLogs;
    return commLogs.filter((c) => c.channel === commChannelFilter);
  }, [commLogs, commChannelFilter]);

  // Follow-up status determination
  const followUpStatus = useMemo(() => {
    if (!lead?.next_follow_up) return { label: 'Not Scheduled', color: 'slate' };
    const date = new Date(lead.next_follow_up);
    const now = new Date();
    if (date < now) {
      return { label: 'Overdue Action', color: 'red' };
    }
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
    if (isToday) {
      return { label: 'Due Today', color: 'blue' };
    }
    return { label: 'Scheduled Upcoming', color: 'emerald' };
  }, [lead?.next_follow_up]);

  // Loading skeleton
  if (loadingLead) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
        {/* Header skeleton */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="space-y-3">
            <div className="h-7 w-64 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-96 bg-slate-100 rounded animate-pulse" />
          </div>
          <div className="h-10 w-40 bg-slate-200 rounded-xl animate-pulse" />
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 p-4 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Not Found State
  if (leadNotFound) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4 font-sans mt-12">
        <div className="w-14 h-14 bg-red-50 text-red-600 border border-red-200 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Lead Record Not Found</h2>
        <p className="text-sm text-slate-600">
          The requested student lead (ID: <strong>{leadId}</strong>) does not exist in the database or may have been removed.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Leads
        </button>
      </div>
    );
  }

  // Unauthorized State
  if (leadForbidden) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4 font-sans mt-12">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
        <p className="text-sm text-slate-600">
          You are not authorized to view this lead record. Your role ({currentUser.role}) is scoped to your assigned leads or authorized team.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Authorized Leads
        </button>
      </div>
    );
  }

  // Generic Error State
  if (leadError || !lead) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4 font-sans mt-12">
        <div className="w-14 h-14 bg-red-50 text-red-600 border border-red-200 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Unable to Load Lead Workspace</h2>
        <p className="text-sm text-slate-600">{leadError || 'An unexpected error occurred while fetching lead records.'}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={fetchLeadDetails}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Leads
          </button>
        </div>
      </div>
    );
  }

  const displayName = lead.name || lead.title || lead.contact_name || 'Student Lead';
  const stageObj = stages.find((s) => s.id === lead.stage);

  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-[#0B1120] pb-16 font-sans">
      {/* =========================================================================
          PERSISTENT TOP HEADER & BREADCRUMBS
      ========================================================================= */}
      <div className="bg-white dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] sticky top-0 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
          {/* Breadcrumbs & Back Navigation */}
          <div className="flex items-center justify-between gap-3 text-xs text-[#64748B] dark:text-[#94A3B8] mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={onBack}
                className="hover:text-[#2563EB] dark:hover:text-[#60A5FA] font-medium transition cursor-pointer flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Leads
              </button>
              <ChevronRight className="w-3 h-3 text-[#CBD5E1] dark:text-[#64748B]" />
              <span className="text-[#334155] dark:text-[#CBD5E1] font-semibold">Lead 360 Workspace</span>
              <ChevronRight className="w-3 h-3 text-[#CBD5E1] dark:text-[#64748B]" />
              <span className="font-mono text-[#2563EB] dark:text-[#60A5FA] font-bold">{lead.lead_id || `#${lead.id}`}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#94A3B8] dark:text-[#64748B]">Created: {formatIST(lead.created_at)}</span>
            </div>
          </div>

          {/* Lead Header Title & Main Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-black text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">{displayName}</h1>
                  <span className="font-mono px-2 py-0.5 rounded text-[11px] font-bold bg-[#EFF6FF] dark:bg-[#172554] text-[#1D4ED8] dark:text-[#93C5FD] border border-[#BFDBFE] dark:border-[#1E40AF]">
                    {lead.lead_id || `#${lead.id}`}
                  </span>
                  {stageObj && (() => {
                    const stStyle = getStageStyle(stageObj.name);
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-xs ${stStyle.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stStyle.dot}`} />
                        {stageObj.order}. {stageObj.name}
                      </span>
                    );
                  })()}
                  {lead.priority && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        lead.priority.toLowerCase() === 'high' || lead.priority.toLowerCase() === 'urgent'
                          ? 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/40 text-[#DC2626] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#991B1B]'
                          : 'bg-slate-100 dark:bg-[#1E293B] text-slate-600 dark:text-[#CBD5E1]'
                      }`}
                    >
                      {lead.priority}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-[#94A3B8] dark:text-[#64748B]" />
                    <span>Counsellor:</span>{' '}
                    <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{lead.assigned_employee_name || 'Unassigned'}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-[#94A3B8] dark:text-[#64748B]" />
                    <span>Team:</span> <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{lead.team_name || '—'}</strong>
                  </span>
                  {lead.email && <span className="text-[#0F172A] dark:text-[#CBD5E1] font-medium">{lead.email}</span>}
                  {lead.phone && <span className="text-[#0F172A] dark:text-[#CBD5E1] font-medium">{lead.phone}</span>}
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {canEditLead && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('info');
                    setIsEditingInfo((prev) => !prev);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                    isEditingInfo
                      ? 'bg-[#EFF6FF] dark:bg-[#172554] border-[#BFDBFE] dark:border-[#1E40AF] text-[#2563EB] dark:text-[#60A5FA]'
                      : 'bg-white dark:bg-[#172033] border-[#E2E8F0] dark:border-[#334155] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] text-[#334155] dark:text-[#CBD5E1]'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
                  <span>{isEditingInfo ? 'Editing Mode' : 'Edit Lead'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsChangingStage((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] text-[#334155] dark:text-[#CBD5E1] transition cursor-pointer flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#A78BFA]" />
                <span>Change Stage</span>
              </button>

              {canReassign && (
                <button
                  type="button"
                  onClick={() => setIsAssigning((prev) => !prev)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] text-[#334155] dark:text-[#CBD5E1] transition cursor-pointer flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#0EA5E9] dark:text-[#38BDF8]" />
                  <span>Reassign</span>
                </button>
              )}

              {onCommunicate && lead.phone && (
                <button
                  type="button"
                  onClick={() => onCommunicate(lead, 'WHATSAPP')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F0FDF4] dark:bg-[#14532D]/40 border border-[#BBF7D0] dark:border-[#166534] hover:bg-[#DCFCE7] dark:hover:bg-[#14532D]/60 text-[#16A34A] dark:text-[#86EFAC] transition cursor-pointer flex items-center gap-1.5"
                  title="Send WhatsApp Message"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              )}

              {onCommunicate && lead.email && (
                <button
                  type="button"
                  onClick={() => onCommunicate(lead, 'EMAIL')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F5F3FF] dark:bg-[#3B0764]/40 border border-[#DDD6FE] dark:border-[#6D28D9] hover:bg-[#EDE9FE] dark:hover:bg-[#3B0764]/60 text-[#7C3AED] dark:text-[#C4B5FD] transition cursor-pointer flex items-center gap-1.5"
                  title="Send Email via Gmail SMTP"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Change Stage Drawer/Panel */}
        {isChangingStage && (
          <div className="bg-[#FAF5FF] dark:bg-[#1E1B4B]/50 border-t border-[#DDD6FE] dark:border-[#4338CA] p-4 text-xs transition">
            <div className="max-w-7xl mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#6D28D9] dark:text-[#C4B5FD] flex items-center gap-1.5">
                  <Layers className="w-4 h-4" /> Move Pipeline Stage
                </span>
                <button
                  type="button"
                  onClick={() => setIsChangingStage(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleExecuteStageChange} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1">Destination Stage *</label>
                    <select
                      value={destStageId}
                      onChange={(e) => setDestStageId(e.target.value)}
                      required
                      className="w-full bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                    >
                      <option value="">Select Target Stage</option>
                      {canonicalStages
                        .filter((s) => s.id !== lead.stage)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.order}. {s.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1">
                      Reason / Transition Note *
                    </label>
                    <input
                      type="text"
                      value={stageChangeNote}
                      onChange={(e) => setStageChangeNote(e.target.value)}
                      placeholder="Mandatory explanation for this stage transition..."
                      required
                      className="w-full bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                    />
                  </div>
                </div>

                {/* If destination is Pending Closure (Stage 9) require financial fields */}
                {destStageId &&
                  canonicalStages.find((s) => s.id === Number(destStageId))?.order === 9 && (
                    <div className="bg-[#EFF6FF] dark:bg-[#172554]/30 border border-[#BFDBFE] dark:border-[#1E40AF]/50 p-3 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-[#1E40AF] dark:text-[#93C5FD] mb-1">
                          Total Agreed Amount (INR) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={stageFinancialAgreed}
                          onChange={(e) => setStageFinancialAgreed(e.target.value)}
                          placeholder="e.g. 75000"
                          required
                          className="w-full bg-white dark:bg-[#111827] border border-[#93C5FD] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F8FAFC] font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#1E40AF] dark:text-[#93C5FD] mb-1">
                          Initial Amount Paid (INR) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={stageFinancialPaid}
                          onChange={(e) => setStageFinancialPaid(e.target.value)}
                          placeholder="e.g. 25000"
                          required
                          className="w-full bg-white dark:bg-[#111827] border border-[#93C5FD] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F8FAFC] font-semibold"
                        />
                      </div>
                    </div>
                  )}

                {stageChangeError && (
                  <div className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {stageChangeError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsChangingStage(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-[#94A3B8] hover:text-slate-800 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingStageChange}
                    className="px-4 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    {savingStageChange ? 'Updating...' : 'Confirm Stage Move'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reassign Drawer/Panel */}
        {isAssigning && (
          <div className="bg-[#F0F9FF] dark:bg-[#082F49]/40 border-t border-[#BAE6FD] dark:border-[#0369A1]/60 p-4 text-xs transition">
            <div className="max-w-7xl mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0369A1] dark:text-[#38BDF8] flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" /> Reassign Lead Counsellor / Team
                </span>
                <button type="button" onClick={() => setIsAssigning(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleExecuteAssign} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1">Target Counsellor *</label>
                    <select
                      value={assignTargetUserId}
                      onChange={(e) => setAssignTargetUserId(e.target.value)}
                      required
                      className="w-full bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#0284C7]"
                    >
                      <option value="">Select Active Employee</option>
                      {users
                        .filter((u) => {
                          if (isAdmin) return u.role === 'SALES_EMPLOYEE' || u.role === 'MANAGER';
                          const mgrTeam = currentUser.managed_team_id || currentUser.team;
                          return (u.role === 'SALES_EMPLOYEE' && u.team === mgrTeam) || u.id === currentUser.id;
                        })
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username} ({u.role})
                          </option>
                        ))}
                    </select>
                  </div>

                  {isAdmin && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-[#CBD5E1] mb-1">
                        Team (Admin Override)
                      </label>
                      <select
                        value={assignTargetTeamId}
                        onChange={(e) => setAssignTargetTeamId(e.target.value)}
                        className="w-full bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#0284C7]"
                      >
                        <option value="">Keep Existing / Default Team</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {assignError && (
                  <div className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {assignError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAssigning(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-[#94A3B8] hover:text-slate-800 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAssign}
                    className="px-4 py-1.5 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    {savingAssign ? 'Saving...' : 'Update Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* =========================================================================
            SECTION B: LEAD SUMMARY CARDS
        ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Pipeline Stage */}
          <div className="bg-white dark:bg-[#172033] p-4.5 rounded-2xl border border-[#E2E8F0] dark:border-[#334155] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Current Pipeline Stage</span>
              <Layers className="w-4 h-4 text-[#7C3AED] dark:text-[#A78BFA]" />
            </div>
            <div className="text-xl font-black text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
              {stageObj ? `${stageObj.order}. ${stageObj.name}` : 'Unassigned Stage'}
            </div>
            <div className="w-full bg-[#E2E8F0] dark:bg-[#334155] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#2563EB] to-[#7C3AED] h-full"
                style={{ width: `${Math.min(100, ((stageObj?.order || 1) / 12) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] block">
              Step {stageObj?.order || 1} of 12 canonical stages
            </span>
          </div>

          {/* Card 2: Ownership */}
          <div className="bg-white dark:bg-[#172033] p-4.5 rounded-2xl border border-[#E2E8F0] dark:border-[#334155] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Ownership &amp; Team</span>
              <Users className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
            </div>
            <div className="text-xl font-black text-[#0F172A] dark:text-[#F8FAFC] tracking-tight truncate">
              {lead.assigned_employee_name || 'Unassigned'}
            </div>
            <span className="text-[11px] font-semibold text-[#2563EB] dark:text-[#60A5FA] block truncate">{lead.team_name}</span>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] block">
              {canReassign ? 'Authorized to reassign' : 'Assigned scope'}
            </span>
          </div>

          {/* Card 3: Next Follow-Up */}
          <div
            className={`p-4.5 rounded-2xl border shadow-2xs space-y-2 ${
              followUpStatus.color === 'red'
                ? 'bg-[#FEF2F2] dark:bg-[#450A0A]/40 border-[#FECACA] dark:border-[#7F1D1D]'
                : followUpStatus.color === 'blue'
                ? 'bg-[#EFF6FF] dark:bg-[#1E293B] border-[#BFDBFE] dark:border-[#3B82F6]/50'
                : 'bg-white dark:bg-[#172033] border-[#E2E8F0] dark:border-[#334155]'
            }`}
          >
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Next Follow-Up</span>
              <Clock
                className={`w-4 h-4 ${
                  followUpStatus.color === 'red'
                    ? 'text-[#DC2626] dark:text-[#F87171]'
                    : followUpStatus.color === 'blue'
                    ? 'text-[#2563EB] dark:text-[#60A5FA]'
                    : 'text-[#64748B] dark:text-[#94A3B8]'
                }`}
              />
            </div>
            <div
              className={`text-lg font-black tracking-tight ${
                followUpStatus.color === 'red'
                  ? 'text-[#DC2626] dark:text-[#F87171]'
                  : followUpStatus.color === 'blue'
                  ? 'text-[#1E40AF] dark:text-[#93C5FD]'
                  : 'text-[#0F172A] dark:text-[#F8FAFC]'
              }`}
            >
              {lead.next_follow_up ? formatIST(lead.next_follow_up) : 'No Follow-Up Set'}
            </div>
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  followUpStatus.color === 'red'
                    ? 'bg-[#FEE2E2] dark:bg-[#7F1D1D]/50 text-[#991B1B] dark:text-[#FECACA]'
                    : followUpStatus.color === 'blue'
                    ? 'bg-[#DBEAFE] dark:bg-[#1E3A8A]/50 text-[#1E40AF] dark:text-[#BFDBFE]'
                    : 'bg-[#F1F5F9] dark:bg-[#334155] text-[#64748B] dark:text-[#CBD5E1]'
                }`}
              >
                {followUpStatus.label}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('followup')}
                className="text-[10px] text-[#2563EB] dark:text-[#60A5FA] hover:underline font-semibold cursor-pointer"
              >
                Manage
              </button>
            </div>
          </div>

          {/* Card 4: Financial Balance or Activity Summary */}
          {isPendingClosure || financialData ? (
            <div className="bg-[#FAF5FF] dark:bg-[#1E1B4B]/40 p-4.5 rounded-2xl border border-[#DDD6FE] dark:border-[#6D28D9]/40 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                  Outstanding Balance
                </span>
                <IndianRupee className="w-4 h-4 text-[#7C3AED] dark:text-[#A78BFA]" />
              </div>
              <div className="text-xl font-black text-[#7C3AED] dark:text-[#A78BFA] tracking-tight">
                {formatINR(financialData?.outstanding_balance || 0)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                <span>Agreed: {formatINR(financialData?.agreed_amount || 0)}</span>
                <span className="text-[#16A34A] dark:text-[#4ADE80] font-semibold">Paid: {formatINR(financialData?.amount_paid || 0)}</span>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#172033] p-4.5 rounded-2xl border border-[#E2E8F0] dark:border-[#334155] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Communication Activity</span>
                <Activity className="w-4 h-4 text-[#0EA5E9] dark:text-[#38BDF8]" />
              </div>
              <div className="text-xl font-black text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">{commLogs.length} Logged Events</div>
              <div className="flex items-center gap-2 text-[10px] text-[#64748B] dark:text-[#94A3B8] flex-wrap">
                <span>Emails: {commLogs.filter((c) => c.channel === 'EMAIL').length}</span>
                <span>•</span>
                <span>WhatsApp: {commLogs.filter((c) => c.channel === 'WHATSAPP').length}</span>
                <span>•</span>
                <span>Calls: {commLogs.filter((c) => c.channel === 'CALL').length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Global Success / Notice Banners */}
        {saveInfoSuccess && (
          <div className="bg-[#F0FDF4] dark:bg-[#052E16]/40 border border-[#BBF7D0] dark:border-[#166534] p-3 rounded-xl text-xs text-[#16A34A] dark:text-[#4ADE80] font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-[#4ADE80]" /> {saveInfoSuccess}
          </div>
        )}
        {followUpSuccess && (
          <div className="bg-[#F0FDF4] dark:bg-[#052E16]/40 border border-[#BBF7D0] dark:border-[#166534] p-3 rounded-xl text-xs text-[#16A34A] dark:text-[#4ADE80] font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-[#4ADE80]" /> {followUpSuccess}
          </div>
        )}
        {financialSuccess && (
          <div className="bg-[#F0FDF4] dark:bg-[#052E16]/40 border border-[#BBF7D0] dark:border-[#166534] p-3 rounded-xl text-xs text-[#16A34A] dark:text-[#4ADE80] font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-[#4ADE80]" /> {financialSuccess}
          </div>
        )}

        {/* Missing Financial Data Warning if in Pending Closure */}
        {isPendingClosure && !financialData && (
          <div className="bg-[#FFFBEB] dark:bg-[#451A03]/40 border border-[#FDE68A] dark:border-[#78350F] p-4 rounded-2xl text-xs text-[#92400E] dark:text-[#FDE68A] flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#D97706] dark:text-[#FBBF24] shrink-0" />
              <div>
                <strong className="font-bold">Pending Closure Financial Record Missing:</strong> This student lead is in
                stage 9 (Pending Closure) but lacks a formal `PreCloserFinancial` ledger record.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('financial')}
              className="px-3 py-1 bg-white dark:bg-[#172033] border border-[#FCD34D] dark:border-[#B45309] text-[#92400E] dark:text-[#FDE68A] hover:bg-[#FEF3C7] dark:hover:bg-[#78350F]/50 rounded-lg font-bold text-xs cursor-pointer shrink-0 transition"
            >
              Add Financial Details
            </button>
          </div>
        )}

        {/* =========================================================================
            SECTION C: TAB NAVIGATION
        ========================================================================= */}
        <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl shadow-xs overflow-hidden">
          <div className="flex items-center overflow-x-auto border-b border-[#E2E8F0] dark:border-[#334155] px-4 pt-2 gap-1 bg-[#F8FAFC] dark:bg-[#111827]">
            {[
              { id: 'overview', label: 'Overview', icon: FileText },
              { id: 'info', label: 'Lead Information', icon: UserIcon },
              { id: 'timeline', label: `Activity Timeline (${timeline.length})`, icon: Activity },
              { id: 'communications', label: `Communications (${commLogs.length})`, icon: MessageSquare },
              { id: 'followup', label: 'Follow-Ups', icon: Clock },
              { id: 'history', label: 'Stage & Assignment History', icon: History },
              {
                id: 'financial',
                label: isPendingClosure ? 'Pending Closure Financials' : 'Financials',
                icon: IndianRupee,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition cursor-pointer ${
                    isActive
                      ? 'border-[#2563EB] dark:border-[#60A5FA] text-[#2563EB] dark:text-[#60A5FA] bg-white dark:bg-[#172033] rounded-t-xl shadow-2xs'
                      : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {/* =====================================================================
                TAB 1: OVERVIEW
            ===================================================================== */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 12-Stage Visual Progression Tracker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8]">
                    <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide">
                      Pipeline Progression (12 Canonical Stages)
                    </span>
                    <span>
                      Current: <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{stageObj?.name || 'Unassigned'}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5 text-center">
                    {canonicalStages.map((st) => {
                      const isCurrent = st.id === lead.stage;
                      const isPassed = (stageObj?.order || 0) > st.order;
                      return (
                        <div
                          key={st.id}
                          className={`p-2 rounded-xl text-[10px] font-bold border transition ${
                            isCurrent
                              ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs'
                              : isPassed
                              ? 'bg-[#EFF6FF] dark:bg-[#1E293B] text-[#1E40AF] dark:text-[#93C5FD] border-[#BFDBFE] dark:border-[#3B82F6]/40'
                              : 'bg-[#F8FAFC] dark:bg-[#111827] text-[#94A3B8] dark:text-[#64748B] border-[#E2E8F0] dark:border-[#334155]'
                          }`}
                          title={`${st.order}. ${st.name}`}
                        >
                          <div className="text-[9px] opacity-75">#{st.order}</div>
                          <div className="truncate">{st.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Profile Grid Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Left Column: Academic & Target Profile */}
                  <div className="bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" /> Academic &amp; Professional Background
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Degree / Qualification:</span>
                        <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{lead.qualification || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">College / University:</span>
                        <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{lead.college || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Year of Passing (YOP):</span>
                        <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{lead.yop || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Experience:</span>
                        <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{lead.experience || '—'}</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Target Role:</span>
                        <strong className="text-[#2563EB] dark:text-[#60A5FA] font-bold">{lead.target_role || '—'}</strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Key Skills:</span>
                        <p className="text-[#334155] dark:text-[#CBD5E1] bg-white dark:bg-[#172033] p-2.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] mt-1 text-[11px]">
                          {lead.key_skills || 'No skills logged.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Contact & Lead Sourcing Details */}
                  <div className="bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-5 space-y-4">
                    <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-[#7C3AED] dark:text-[#A78BFA]" /> Contact &amp; CRM Attributes
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Email Address:</span>
                        <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{lead.email || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Phone Number:</span>
                        <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{lead.phone || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">City / Location:</span>
                        <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{lead.city || '—'}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Source Channel:</span>
                        <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{lead.source || 'Direct Intake'}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Lead Status:</span>
                        <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{lead.status || 'Active'}</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">Created By:</span>
                        <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{lead.created_by_name || 'System'}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Latest Interactions Preview */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide">
                      Recent Activity Stream
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('timeline')}
                      className="text-xs text-[#2563EB] dark:text-[#60A5FA] hover:underline font-semibold cursor-pointer"
                    >
                      View All {timeline.length} Events &rarr;
                    </button>
                  </div>
                  <div className="divide-y divide-[#E2E8F0] dark:divide-[#334155] border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-hidden">
                    {timeline.slice(0, 5).map((evt) => (
                      <div key={evt.id} className="p-3 bg-white dark:bg-[#172033] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition text-xs flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-[#2563EB] dark:bg-[#60A5FA]" />
                          <div>
                            <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">{evt.title}</span>
                            <span className="text-[#64748B] dark:text-[#94A3B8] block text-[11px]">{evt.description}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 text-[11px] text-[#94A3B8]">
                          <div>{evt.timestamp_display || formatIST(evt.timestamp)}</div>
                          <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">{evt.actor_name}</span>
                        </div>
                      </div>
                    ))}
                    {timeline.length === 0 && (
                      <div className="p-6 text-center text-xs text-[#94A3B8]">No activity records logged yet.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================================
                TAB 2: LEAD INFORMATION & EDITING
            ===================================================================== */}
            {activeTab === 'info' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Detailed Lead Profile</h3>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {isEditingInfo
                        ? 'Modify ordinary student lead parameters below. Click Save to persist updates.'
                        : 'Read-only profile view. Click Edit Lead above to modify fields.'}
                    </p>
                  </div>
                  {canEditLead && !isEditingInfo && (
                    <button
                      type="button"
                      onClick={() => setIsEditingInfo(true)}
                      className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Information
                    </button>
                  )}
                </div>

                {infoFormErrors.general && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                    <span>{infoFormErrors.general}</span>
                  </div>
                )}

                <form onSubmit={handleSaveInfo} className="space-y-6">
                  {/* Group 1: Identity & Contact */}
                  <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-5 bg-white dark:bg-[#172033] space-y-4">
                    <h4 className="text-xs font-bold text-[#2563EB] dark:text-[#60A5FA] uppercase tracking-wider">
                      1. Contact &amp; Identity
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">Full Name *</label>
                        {isEditingInfo ? (
                          <input
                            type="text"
                            value={infoFormData.name || ''}
                            onChange={(e) => setInfoFormData({ ...infoFormData, name: e.target.value })}
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:ring-1 focus:ring-[#2563EB]"
                            required
                          />
                        ) : (
                          <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC] py-1">{lead.name || '—'}</div>
                        )}
                        {infoFormErrors.name && <span className="text-[10px] text-red-600 dark:text-red-400">{infoFormErrors.name}</span>}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">Email Address *</label>
                        {isEditingInfo ? (
                          <input
                            type="email"
                            value={infoFormData.email || ''}
                            onChange={(e) => setInfoFormData({ ...infoFormData, email: e.target.value })}
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:ring-1 focus:ring-[#2563EB]"
                            required
                          />
                        ) : (
                          <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC] py-1">{lead.email || '—'}</div>
                        )}
                        {infoFormErrors.email && <span className="text-[10px] text-red-600 dark:text-red-400">{infoFormErrors.email}</span>}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">Mobile Phone *</label>
                        {isEditingInfo ? (
                          <input
                            type="text"
                            value={infoFormData.phone || ''}
                            onChange={(e) => setInfoFormData({ ...infoFormData, phone: e.target.value })}
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:ring-1 focus:ring-[#2563EB]"
                            required
                          />
                        ) : (
                          <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC] py-1">{lead.phone || '—'}</div>
                        )}
                        {infoFormErrors.phone && <span className="text-[10px] text-red-600 dark:text-red-400">{infoFormErrors.phone}</span>}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">City / Location</label>
                        {isEditingInfo ? (
                          <input
                            type="text"
                            value={infoFormData.city || ''}
                            onChange={(e) => setInfoFormData({ ...infoFormData, city: e.target.value })}
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                          />
                        ) : (
                          <div className="text-[#334155] dark:text-[#CBD5E1] py-1">{lead.city || '—'}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">Lead ID / Code</label>
                        <div className="font-mono text-[#2563EB] dark:text-[#60A5FA] font-bold py-1 bg-[#EFF6FF] dark:bg-[#1E293B] px-2.5 rounded border border-[#BFDBFE] dark:border-[#3B82F6]/40 inline-block">
                          {lead.lead_id || `#${lead.id}`}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">Source / Channel</label>
                        {isEditingInfo ? (
                          <input
                            type="text"
                            value={infoFormData.source || ''}
                            onChange={(e) => setInfoFormData({ ...infoFormData, source: e.target.value })}
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                          />
                        ) : (
                          <div className="text-[#334155] dark:text-[#CBD5E1] py-1">{lead.source || '—'}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Group 2: Academic & Career Profile */}
                  <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-5 bg-white dark:bg-[#172033] space-y-4">
                    <h4 className="text-xs font-bold text-[#7C3AED] dark:text-[#A78BFA] uppercase tracking-wider">
                      2. Academic &amp; Career Qualifications
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">Degree / Qualification</label>
                        {isEditingInfo ? (
                          <input
                            type="text"
                            value={infoFormData.qualification || ''}
                            onChange={(e) => setInfoFormData({ ...infoFormData, qualification: e.target.value })}
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                          />
                        ) : (
                          <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC] py-1">{lead.qualification || '—'}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">College / University</label>
                        {isEditingInfo ? (
                          <input
                            type="text"
                            value={infoFormData.college || ''}
                            onChange={(e) => setInfoFormData({ ...infoFormData, college: e.target.value })}
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                          />
                        ) : (
                          <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC] py-1">{lead.college || '—'}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">Year of Passing (YOP)</label>
                        {isEditingInfo ? (
                          <input
                            type="text"
                            value={infoFormData.yop || ''}
                            onChange={(e) => setInfoFormData({ ...infoFormData, yop: e.target.value })}
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                          />
                        ) : (
                          <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC] py-1">{lead.yop || '—'}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">Target Role</label>
                        {isEditingInfo ? (
                          <input
                            type="text"
                            value={infoFormData.target_role || ''}
                            onChange={(e) => setInfoFormData({ ...infoFormData, target_role: e.target.value })}
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                          />
                        ) : (
                          <div className="font-medium text-[#2563EB] dark:text-[#60A5FA] py-1">{lead.target_role || '—'}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">Experience</label>
                        {isEditingInfo ? (
                          <input
                            type="text"
                            value={infoFormData.experience || ''}
                            onChange={(e) => setInfoFormData({ ...infoFormData, experience: e.target.value })}
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                          />
                        ) : (
                          <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC] py-1">{lead.experience || '—'}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">Priority</label>
                        {isEditingInfo ? (
                          <select
                            value={infoFormData.priority || 'Normal'}
                            onChange={(e) => setInfoFormData({ ...infoFormData, priority: e.target.value })}
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                          >
                            <option value="Normal">Normal</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                          </select>
                        ) : (
                          <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC] py-1">{lead.priority || '—'}</div>
                        )}
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] mb-1">Key Skills</label>
                        {isEditingInfo ? (
                          <textarea
                            rows={3}
                            value={infoFormData.key_skills || ''}
                            onChange={(e) => setInfoFormData({ ...infoFormData, key_skills: e.target.value })}
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg p-2.5 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                          />
                        ) : (
                          <div className="p-3 bg-[#F8FAFC] dark:bg-[#111827] rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-[#334155] dark:text-[#CBD5E1]">
                            {lead.key_skills || 'No skills logged.'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Edit Form Submit / Cancel Controls */}
                  {isEditingInfo && (
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingInfo(false);
                          setInfoFormErrors({});
                        }}
                        className="px-4 py-2 border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs font-semibold text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-50 dark:hover:bg-[#1E293B] transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingInfo}
                        className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>{savingInfo ? 'Saving...' : 'Save Lead Changes'}</span>
                      </button>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* =====================================================================
                TAB 3: ACTIVITY TIMELINE
            ===================================================================== */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#334155] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Chronological Activity Stream</h3>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      Real audit events, stage updates, communications, and assignments.
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    {(['ALL', 'STAGE', 'COMMUNICATION', 'ASSIGNMENT', 'FINANCIAL', 'AUDIT'] as const).map((ft) => (
                      <button
                        key={ft}
                        type="button"
                        onClick={() => setTimelineFilter(ft)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                          timelineFilter === ft
                            ? 'bg-[#2563EB] text-white shadow-2xs'
                            : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                        }`}
                      >
                        {ft === 'ALL'
                          ? 'All Events'
                          : ft === 'STAGE'
                          ? 'Stages'
                          : ft === 'COMMUNICATION'
                          ? 'Communications'
                          : ft === 'ASSIGNMENT'
                          ? 'Assignments'
                          : ft === 'FINANCIAL'
                          ? 'Financials'
                          : 'System Audit'}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingTimeline ? (
                  <div className="p-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8] animate-pulse">Loading activity stream...</div>
                ) : (
                  <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-[#E2E8F0] dark:before:bg-[#334155] pt-2">
                    {filteredTimeline.map((item) => {
                      const isStage = item.event_type === 'LEAD_STAGE_CHANGED';
                      const isComm = item.event_type.startsWith('COMMUNICATION');
                      const isAssign = item.event_type.includes('ASSIGN');
                      const isFin = item.event_type.includes('FINANCIAL');

                      return (
                        <div key={item.id} className="relative flex items-start gap-4 pl-8 group">
                          {/* Dot / Badge Icon */}
                          <div
                            className={`absolute left-1.5 top-1 -translate-x-1/2 w-5 h-5 rounded-full border flex items-center justify-center ${
                              isStage
                                ? 'bg-[#7C3AED] border-[#7C3AED] text-white'
                                : isComm
                                ? 'bg-[#2563EB] border-[#2563EB] text-white'
                                : isAssign
                                ? 'bg-[#0EA5E9] border-[#0EA5E9] text-white'
                                : isFin
                                ? 'bg-[#16A34A] border-[#16A34A] text-white'
                                : 'bg-slate-400 dark:bg-slate-600 border-slate-400 dark:border-slate-600 text-white'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>

                          <div className="flex-1 bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-4 shadow-2xs space-y-1.5 hover:border-[#CBD5E1] dark:hover:border-[#475569] transition">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-bold text-xs text-[#0F172A] dark:text-[#F8FAFC]">{item.title}</span>
                              <span className="text-[11px] text-[#94A3B8]">
                                {item.timestamp_display || formatIST(item.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-[#334155] dark:text-[#CBD5E1]">{item.description}</p>
                            {item.note && (
                              <div className="text-[11px] bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] p-2 rounded-lg text-[#475569] dark:text-[#94A3B8] italic">
                                &quot;{item.note}&quot;
                              </div>
                            )}
                            <div className="text-[10px] text-[#94A3B8] pt-1">
                              Logged by: <strong className="text-[#64748B] dark:text-[#CBD5E1]">{item.actor_name}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {filteredTimeline.length === 0 && (
                      <div className="p-8 text-center text-xs text-[#94A3B8]">
                        No timeline records found for category: <strong>{timelineFilter}</strong>.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* =====================================================================
                TAB 4: COMMUNICATIONS
            ===================================================================== */}
            {activeTab === 'communications' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#334155] pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Communication Logs &amp; Dispatches</h3>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      History of calls, WhatsApp messages, and Gmail SMTP dispatches for this student.
                    </p>
                  </div>

                  {/* Channel Filter & Compose Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center bg-[#F1F5F9] dark:bg-[#111827] p-0.5 rounded-lg text-xs">
                      {(['ALL', 'EMAIL', 'WHATSAPP', 'CALL'] as const).map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setCommChannelFilter(ch)}
                          className={`px-3 py-1 rounded font-semibold transition cursor-pointer text-[11px] ${
                            commChannelFilter === ch ? 'bg-white dark:bg-[#1E293B] text-[#2563EB] dark:text-[#60A5FA] shadow-2xs' : 'text-[#64748B] dark:text-[#94A3B8]'
                          }`}
                        >
                          {ch}
                        </button>
                      ))}
                    </div>

                    {onCommunicate && (
                      <button
                        type="button"
                        onClick={() => onCommunicate(lead, 'EMAIL')}
                        className="px-3 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                      >
                        Compose Email
                      </button>
                    )}
                  </div>
                </div>

                {loadingCommLogs ? (
                  <div className="p-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8] animate-pulse">Loading communication logs...</div>
                ) : (
                  <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-hidden bg-white dark:bg-[#172033]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#94A3B8] font-bold">
                        <tr>
                          <th className="py-2.5 px-3">Date / Time (IST)</th>
                          <th className="py-2.5 px-3">Channel</th>
                          <th className="py-2.5 px-3">Recipient</th>
                          <th className="py-2.5 px-3">Subject / Message</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Initiated By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#334155] text-[#334155] dark:text-[#CBD5E1]">
                        {filteredCommunications.map((log) => (
                          <tr key={log.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/70 transition">
                            <td className="py-2.5 px-3 font-medium whitespace-nowrap">{formatIST(log.created_at)}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                  log.channel === 'EMAIL'
                                    ? 'bg-[#F5F3FF] dark:bg-[#2E1065]/50 text-[#7C3AED] dark:text-[#C4B5FD] border border-[#DDD6FE] dark:border-[#7C3AED]/30'
                                    : log.channel === 'WHATSAPP'
                                    ? 'bg-[#F0FDF4] dark:bg-[#052E16]/50 text-[#16A34A] dark:text-[#86EFAC] border border-[#BBF7D0] dark:border-[#16A34A]/30'
                                    : 'bg-[#EFF6FF] dark:bg-[#172554]/50 text-[#2563EB] dark:text-[#93C5FD] border border-[#BFDBFE] dark:border-[#2563EB]/30'
                                }`}
                              >
                                {log.channel}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">{log.recipient}</td>
                            <td className="py-2.5 px-3 max-w-xs truncate" title={log.subject || log.content}>
                              {log.subject || log.content || '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  log.status === 'SUCCESS'
                                    ? 'bg-[#F0FDF4] dark:bg-[#052E16]/60 text-[#16A34A] dark:text-[#86EFAC]'
                                    : log.status === 'FAILED'
                                    ? 'bg-[#FEF2F2] dark:bg-[#450A0A]/60 text-[#DC2626] dark:text-[#FCA5A5]'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#64748B] dark:text-[#94A3B8]">{log.initiated_by_name || 'System'}</td>
                          </tr>
                        ))}
                        {filteredCommunications.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-[#94A3B8]">
                              No {commChannelFilter !== 'ALL' ? commChannelFilter : ''} communication records logged for this lead.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="text-[11px] text-[#94A3B8] italic pt-1">
                  Note: Dispatched emails reflect Google SMTP transmission acceptance. WhatsApp logs reflect Meta Cloud
                  API reception. Telephony calls reflect logged attempt timestamps.
                </div>
              </div>
            )}

            {/* =====================================================================
                TAB 5: FOLLOW-UPS & NEXT ACTION
            ===================================================================== */}
            {activeTab === 'followup' && (
              <div className="space-y-6 max-w-xl">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Schedule Next Follow-Up</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Persist the scheduled next interaction timestamp for cadence tracking and operational alert queues.
                  </p>
                </div>

                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    followUpStatus.color === 'red'
                      ? 'bg-[#FEF2F2] dark:bg-[#450A0A]/40 border-[#FECACA] dark:border-[#7F1D1D]'
                      : followUpStatus.color === 'blue'
                      ? 'bg-[#EFF6FF] dark:bg-[#1E293B] border-[#BFDBFE] dark:border-[#3B82F6]/50'
                      : 'bg-[#F8FAFC] dark:bg-[#111827] border-[#E2E8F0] dark:border-[#334155]'
                  }`}
                >
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] block">
                      Current Cadence Status
                    </span>
                    <strong
                      className={`text-sm ${
                        followUpStatus.color === 'red'
                          ? 'text-[#DC2626] dark:text-[#F87171]'
                          : followUpStatus.color === 'blue'
                          ? 'text-[#1E40AF] dark:text-[#93C5FD]'
                          : 'text-[#0F172A] dark:text-[#F8FAFC]'
                      }`}
                    >
                      {followUpStatus.label}
                    </strong>
                    <span className="text-xs text-[#64748B] dark:text-[#94A3B8] block mt-0.5">
                      {lead.next_follow_up ? formatIST(lead.next_follow_up) : 'None scheduled'}
                    </span>
                  </div>
                  <Clock className="w-5 h-5 text-[#94A3B8]" />
                </div>

                {followUpError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                    <span>{followUpError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveFollowUp} className="space-y-4 bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] p-5 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-1">
                      Next Follow-Up Date &amp; Time (IST)
                    </label>
                    <input
                      type="datetime-local"
                      value={followUpDateInput}
                      onChange={(e) => setFollowUpDateInput(e.target.value)}
                      className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-2 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:ring-1 focus:ring-[#2563EB]"
                    />
                    <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1 block">
                      Leave empty to clear follow-up commitment.
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    {followUpDateInput && (
                      <button
                        type="button"
                        onClick={() => setFollowUpDateInput('')}
                        className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      >
                        Clear Date
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={savingFollowUp}
                      className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                    >
                      {savingFollowUp ? 'Saving...' : 'Update Follow-Up'}
                    </button>
                  </div>
                </form>

                <div className="text-[11px] text-[#94A3B8] italic">
                  Note: The Skill Move CRM stores scheduled follow-up timestamps on the `Lead.next_follow_up` entity.
                  Dedicated reminder or recurring task workflows are pending schema extensions.
                </div>
              </div>
            )}

            {/* =====================================================================
                TAB 6: STAGE & ASSIGNMENT HISTORY
            ===================================================================== */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                {/* Stage History */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#7C3AED] dark:text-[#A78BFA]" /> Pipeline Stage Transition Audit
                  </h3>
                  <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-hidden bg-white dark:bg-[#172033]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#94A3B8] font-bold">
                        <tr>
                          <th className="py-2.5 px-3">Date / Time (IST)</th>
                          <th className="py-2.5 px-3">From Stage</th>
                          <th className="py-2.5 px-3">To Stage</th>
                          <th className="py-2.5 px-3">Mandatory Note</th>
                          <th className="py-2.5 px-3">Changed By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#334155] text-[#334155] dark:text-[#CBD5E1]">
                        {stageHistory.map((sh) => (
                          <tr key={sh.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/70 transition">
                            <td className="py-2.5 px-3 whitespace-nowrap">{formatIST(sh.timestamp)}</td>
                            <td className="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8]">{sh.from_stage_name || 'Initial Creation'}</td>
                            <td className="py-2.5 px-3 font-bold text-[#7C3AED] dark:text-[#C4B5FD]">{sh.to_stage_name}</td>
                            <td className="py-2.5 px-3 max-w-sm truncate" title={sh.note}>
                              {sh.note || '—'}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{sh.changed_by_name}</td>
                          </tr>
                        ))}
                        {stageHistory.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-[#94A3B8]">
                              No stage history records logged.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Assignment History */}
                <div className="space-y-3 pt-4 border-t border-[#E2E8F0] dark:border-[#334155]">
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#0EA5E9] dark:text-[#38BDF8]" /> Ownership Transfer History
                  </h3>
                  <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-hidden bg-white dark:bg-[#172033]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#94A3B8] font-bold">
                        <tr>
                          <th className="py-2.5 px-3">Date / Time (IST)</th>
                          <th className="py-2.5 px-3">From Counsellor / Team</th>
                          <th className="py-2.5 px-3">To Counsellor / Team</th>
                          <th className="py-2.5 px-3">Changed By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#334155] text-[#334155] dark:text-[#CBD5E1]">
                        {assignHistory.map((ah) => (
                          <tr key={ah.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/70 transition">
                            <td className="py-2.5 px-3 whitespace-nowrap">{formatIST(ah.timestamp)}</td>
                            <td className="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8]">
                              {ah.from_employee_name || 'Unassigned'} ({ah.from_team_name || 'No Team'})
                            </td>
                            <td className="py-2.5 px-3 font-bold text-[#0EA5E9] dark:text-[#38BDF8]">
                              {ah.to_employee_name} ({ah.to_team_name})
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{ah.changed_by_name}</td>
                          </tr>
                        ))}
                        {assignHistory.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-[#94A3B8]">
                              No ownership transfers logged.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================================
                TAB 7: PENDING CLOSURE FINANCIALS
            ===================================================================== */}
            {activeTab === 'financial' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                    <IndianRupee className="w-4 h-4 text-[#7C3AED] dark:text-[#A78BFA]" /> Pending Closure Financial Workspace
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Authoritative financial oversight connected directly to `PreCloserFinancial` in INR (₹).
                  </p>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[#EFF6FF] dark:bg-[#1E293B] border border-[#BFDBFE] dark:border-[#3B82F6]/50 p-4 rounded-xl">
                    <span className="text-[11px] font-bold text-[#1E40AF] dark:text-[#93C5FD] uppercase tracking-wider block">
                      Total Agreed Value
                    </span>
                    <div className="text-xl font-black text-[#1E40AF] dark:text-[#93C5FD] mt-1">
                      {formatINR(financialData?.agreed_amount || 0)}
                    </div>
                    <span className="text-[10px] text-[#2563EB] dark:text-[#60A5FA]">Total course/program tuition</span>
                  </div>

                  <div className="bg-[#F0FDF4] dark:bg-[#052E16]/40 border border-[#BBF7D0] dark:border-[#166534] p-4 rounded-xl">
                    <span className="text-[11px] font-bold text-[#15803D] dark:text-[#86EFAC] uppercase tracking-wider block">
                      Amount Paid Recorded
                    </span>
                    <div className="text-xl font-black text-[#15803D] dark:text-[#86EFAC] mt-1">
                      {formatINR(financialData?.amount_paid || 0)}
                    </div>
                    <span className="text-[10px] text-[#16A34A] dark:text-[#4ADE80]">Confirmed collections</span>
                  </div>

                  <div className="bg-[#FEF2F2] dark:bg-[#450A0A]/40 border border-[#FECACA] dark:border-[#7F1D1D] p-4 rounded-xl">
                    <span className="text-[11px] font-bold text-[#B91C1C] dark:text-[#FCA5A5] uppercase tracking-wider block">
                      Outstanding Balance
                    </span>
                    <div className="text-xl font-black text-[#DC2626] dark:text-[#F87171] mt-1">
                      {formatINR(financialData?.outstanding_balance || 0)}
                    </div>
                    <span className="text-[10px] text-[#DC2626] dark:text-[#F87171]">Agreed Amount − Amount Paid</span>
                  </div>
                </div>

                {/* Financial Update Form (Authorized) */}
                {canEditLead && (
                  <div className="bg-white dark:bg-[#172033] border border-[#DDD6FE] dark:border-[#6D28D9]/40 rounded-xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-[#7C3AED] dark:text-[#A78BFA] uppercase tracking-wider">
                      Update Financial Figures
                    </h4>

                    {financialError && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs rounded-xl font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                        <span>{financialError}</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveFinancials} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-[#CBD5E1] mb-1">
                            Total Agreed Amount (₹) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={financialForm.agreed_amount}
                            onChange={(e) => setFinancialForm({ ...financialForm, agreed_amount: e.target.value })}
                            placeholder="e.g. 75000"
                            required
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-2 text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-[#CBD5E1] mb-1">
                            Amount Paid (₹) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={financialForm.amount_paid}
                            onChange={(e) => setFinancialForm({ ...financialForm, amount_paid: e.target.value })}
                            placeholder="e.g. 25000"
                            required
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-2 text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-700 dark:text-[#CBD5E1] mb-1">
                            Audit Note / Reason for Change
                          </label>
                          <input
                            type="text"
                            value={financialForm.note}
                            onChange={(e) => setFinancialForm({ ...financialForm, note: e.target.value })}
                            placeholder="e.g. Received 2nd installment of ₹25,000 via NEFT"
                            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-3 py-2 text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <button
                          type="submit"
                          disabled={savingFinancial}
                          className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                        >
                          {savingFinancial ? 'Saving...' : 'Save Financial Ledger Update'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Financial History Table */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide">
                    Financial Audit History ({financialHistory.length})
                  </h4>
                  <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-hidden bg-white dark:bg-[#172033]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#94A3B8] font-bold">
                        <tr>
                          <th className="py-2.5 px-3">Timestamp (IST)</th>
                          <th className="py-2.5 px-3 text-right">Agreed Value</th>
                          <th className="py-2.5 px-3 text-right">Amount Paid</th>
                          <th className="py-2.5 px-3 text-right">Outstanding</th>
                          <th className="py-2.5 px-3">Audit Note</th>
                          <th className="py-2.5 px-3">Actor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#334155] text-[#334155] dark:text-[#CBD5E1]">
                        {financialHistory.map((fh) => (
                          <tr key={fh.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/70 transition">
                            <td className="py-2.5 px-3 whitespace-nowrap">{formatIST(fh.timestamp)}</td>
                            <td className="py-2.5 px-3 text-right font-medium">{formatINR(fh.agreed_amount)}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-[#16A34A] dark:text-[#4ADE80]">
                              {formatINR(fh.amount_paid)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-[#DC2626] dark:text-[#F87171]">
                              {formatINR(fh.outstanding_balance)}
                            </td>
                            <td className="py-2.5 px-3 max-w-xs truncate" title={fh.note}>
                              {fh.note || '—'}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{fh.changed_by_name}</td>
                          </tr>
                        ))}
                        {financialHistory.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-[#94A3B8]">
                              No historical financial adjustments logged yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
