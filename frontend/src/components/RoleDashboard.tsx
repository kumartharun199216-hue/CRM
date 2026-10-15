import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  User,
  Lead,
  PipelineStage,
  Team,
  DashboardStats,
  DashboardFiltersState,
  OutstandingLeadRow,
  FollowupQueueItem,
} from '../types';
import { getStageStyle } from './SpreadsheetView';
import { api } from '../services/api';
import {
  Users,
  GraduationCap,
  TrendingUp,
  Award,
  Layers,
  Phone,
  MessageSquare,
  Mail,
  Clock,
  Briefcase,
  Shield,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Search,
  IndianRupee,
  Activity,
  Server,
  ChevronRight,
  X,
  RefreshCw,
} from 'lucide-react';

interface RoleDashboardProps {
  currentUser: User;
  leads: Lead[];
  stages: PipelineStage[];
  teams: Team[];
  users: User[];
  onSelectStage: (stageId: number | null) => void;
  onOpenLead: (lead: Lead) => void;
  onOpen360: (lead: Lead) => void;
  onCommunicate: (lead: Lead, channel: 'EMAIL' | 'WHATSAPP' | 'CALL') => void;
  onViewAllLeads: () => void;
  onOpenCreateLead?: () => void;
  onOpenUnassignedLeads?: () => void;
  onOpenReports?: () => void;
  onOpenStages?: () => void;
  onOpenAssignLead?: (lead: Lead) => void;
  onDrillDownEmployee?: (employeeId: number) => void;
  onDrillDownQuickFilter?: (filterKey: string, stageId?: number | null) => void;
}

const formatINR = (val: number | null | undefined): string => {
  const num = Number(val || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

export const RoleDashboard: React.FC<RoleDashboardProps> = ({
  currentUser,
  leads,
  stages,
  teams,
  users,
  onSelectStage,
  onOpenLead,
  onOpen360,
  onCommunicate,
  onViewAllLeads,
  onOpenCreateLead,
  onOpenUnassignedLeads,
  onOpenReports,
  onOpenStages,
  onDrillDownEmployee,
  onDrillDownQuickFilter,
}) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const isManager = currentUser.role === 'MANAGER';
  const isCounsellor = currentUser.role === 'SALES_EMPLOYEE';

  // Filter State
  const [filterPreset, setFilterPreset] = useState<string>('30d');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);

  const [selectedTeamId, setSelectedTeamId] = useState<string>('ALL');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ALL');
  const [selectedStageId, setSelectedStageId] = useState<string>('ALL');
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Performance Tab State (Admin only: 'teams' vs 'members')
  const [adminPerformanceTab, setAdminPerformanceTab] = useState<'members' | 'teams'>('members');
  const [commChannelTab, setCommChannelTab] = useState<'ALL' | 'CALL' | 'EMAIL' | 'WHATSAPP'>('ALL');
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');

  // Server Stats State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Dashboard Stats from Backend
  const fetchStats = useCallback(
    async (overrideFilters?: DashboardFiltersState) => {
      try {
        setLoadingStats(true);
        setStatsError(null);

        // Date validation for custom range
        const p = overrideFilters?.preset ?? filterPreset;
        const sd = overrideFilters?.start_date ?? (p === 'custom' ? startDate : undefined);
        const ed = overrideFilters?.end_date ?? (p === 'custom' ? endDate : undefined);

        if (p === 'custom' && sd && ed && sd > ed) {
          setDateValidationError('Start date cannot be after end date.');
          setLoadingStats(false);
          return;
        } else {
          setDateValidationError(null);
        }

        const queryPayload = {
          preset: p,
          start_date: sd || undefined,
          end_date: ed || undefined,
          team_id: overrideFilters?.team_id ?? (selectedTeamId !== 'ALL' ? selectedTeamId : undefined),
          employee_id: overrideFilters?.employee_id ?? (selectedEmployeeId !== 'ALL' ? selectedEmployeeId : undefined),
          stage_id: overrideFilters?.stage_id ?? (selectedStageId !== 'ALL' ? selectedStageId : undefined),
          source: overrideFilters?.source ?? (selectedSource !== 'ALL' ? selectedSource : undefined),
          channel: overrideFilters?.channel ?? (selectedChannel !== 'ALL' ? selectedChannel : undefined),
          search: overrideFilters?.search ?? (debouncedSearch.trim() || undefined),
        };

        const res = await api.getDashboardStats(queryPayload);
        setStats(res);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch dashboard statistics';
        setStatsError(msg);
      } finally {
        setLoadingStats(false);
      }
    },
    [
      filterPreset,
      startDate,
      endDate,
      selectedTeamId,
      selectedEmployeeId,
      selectedStageId,
      selectedSource,
      selectedChannel,
      debouncedSearch,
    ]
  );

  // Fetch on filter changes
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Handlers for Filter Actions
  const handleResetFilters = () => {
    setFilterPreset('30d');
    setStartDate('');
    setEndDate('');
    setDateValidationError(null);
    setSelectedTeamId('ALL');
    setSelectedEmployeeId('ALL');
    setSelectedStageId('ALL');
    setSelectedSource('ALL');
    setSelectedChannel('ALL');
    setSearchQuery('');
    setDebouncedSearch('');
  };

  const hasActiveFilters =
    filterPreset !== '30d' ||
    selectedTeamId !== 'ALL' ||
    selectedEmployeeId !== 'ALL' ||
    selectedStageId !== 'ALL' ||
    selectedSource !== 'ALL' ||
    selectedChannel !== 'ALL' ||
    debouncedSearch.trim() !== '' ||
    Boolean(startDate) ||
    Boolean(endDate);

  // Available employees dynamically filtered by team selection
  const permittedEmployees = useMemo(() => {
    return users.filter((u) => {
      if (u.role !== 'SALES_EMPLOYEE' && u.role !== 'MANAGER') return false;
      if (isAdmin) {
        if (selectedTeamId !== 'ALL') {
          return u.team?.toString() === selectedTeamId;
        }
        return true;
      }
      if (isManager) {
        const authorizedTeamId = currentUser.managed_team_id || currentUser.team;
        return u.team === authorizedTeamId;
      }
      return u.id === currentUser.id;
    });
  }, [users, isAdmin, isManager, selectedTeamId, currentUser]);

  // When team changes, reset employee selection if employee not in selected team
  useEffect(() => {
    if (selectedTeamId !== 'ALL' && selectedEmployeeId !== 'ALL') {
      const match = permittedEmployees.find((e) => e.id.toString() === selectedEmployeeId);
      if (!match) {
        setSelectedEmployeeId('ALL');
      }
    }
  }, [selectedTeamId, selectedEmployeeId, permittedEmployees]);

  // Local fallback calculations from leads prop if API is loading or offline
  const authorizedLeads = useMemo(() => {
    if (isAdmin) return leads;
    if (isManager) {
      const authorizedTeamId = currentUser.managed_team_id || currentUser.team;
      return leads.filter((l) => l.team === authorizedTeamId);
    }
    return leads.filter((l) => l.assigned_employee === currentUser.id);
  }, [leads, isAdmin, isManager, currentUser]);

  const localKPIs = useMemo(() => {
    const total = authorizedLeads.length;
    const enrolled = authorizedLeads.filter(
      (l) => l.stage_name?.toLowerCase().includes('enrolled') || l.stage === 10
    ).length;
    const lost = authorizedLeads.filter(
      (l) => l.stage_name?.toLowerCase().includes('lost') || l.status?.toLowerCase() === 'lost' || l.stage === 12
    ).length;
    const pcLeads = authorizedLeads.filter(
      (l) => l.stage === 9 || l.stage_name?.toLowerCase().includes('pending closure')
    ).length;
    const active = total - lost;
    const activePipeline = total - lost - enrolled;
    const unassigned = authorizedLeads.filter((l) => !l.assigned_employee).length;
    const assigned = total - unassigned;
    const estRev = authorizedLeads.reduce((acc, l) => acc + (Number(l.estimated_revenue) || 0), 0);
    const placementFees = authorizedLeads.reduce((acc, l) => acc + (Number(l.placement_fee) || 0), 0);

    const now = new Date();
    const followups = authorizedLeads.filter((l) => Boolean(l.next_follow_up));
    const followupsOverdue = followups.filter((l) => l.next_follow_up && new Date(l.next_follow_up) < now).length;
    const followupsToday = followups.filter((l) => {
      if (!l.next_follow_up) return false;
      const d = new Date(l.next_follow_up);
      return d.toDateString() === now.toDateString();
    }).length;
    const next7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const followupsNext7 = followups.filter((l) => {
      if (!l.next_follow_up) return false;
      const d = new Date(l.next_follow_up);
      return d > now && d <= next7d;
    }).length;

    return {
      total_leads: total,
      active_leads: active,
      active_pipeline_leads: activePipeline,
      new_leads_in_period: total,
      created_in_period: total,
      enrolled_leads: enrolled,
      lost_leads: lost,
      pending_closure_leads: pcLeads,
      unassigned_leads: unassigned,
      assigned_leads: assigned,
      total_estimated_revenue: estRev,
      total_placement_fees: placementFees,
      pending_followups: followups.length,
      followups_today: followupsToday,
      followups_overdue: followupsOverdue,
      followups_next_7_days: followupsNext7,
    };
  }, [authorizedLeads]);

  const kpis = stats?.kpis || localKPIs;

  // Canonical 12 Stages pipeline distribution
  const canonicalStages = useMemo(() => {
    if (stats?.pipeline_overview && stats.pipeline_overview.length > 0) {
      return stats.pipeline_overview;
    }
    const sorted = [...stages].sort((a, b) => a.order - b.order);
    const total = authorizedLeads.length;
    return sorted.map((st) => {
      const count = authorizedLeads.filter((l) => l.stage === st.id).length;
      const pct = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
      return {
        id: st.id,
        name: st.name,
        order: st.order,
        count,
        percentage: pct,
        entries_in_period: 0,
        is_pending_closure: st.order === 9 || st.name.toLowerCase() === 'pending closure',
        is_enrolled: st.order === 10 || st.name.toLowerCase().includes('enrolled'),
      };
    });
  }, [stats, stages, authorizedLeads]);

  // Pending Closure Financial Overview
  const financials = stats?.pending_closure_financials;
  const commsActivity = stats?.communications_activity;
  const followupQueue = stats?.followup_queue;
  const attentionReq = stats?.attention_required;
  const systemHealth = stats?.system_health;

  // Safe handler for opening lead from row
  const handleOpenLeadByCodeOrId = (leadId: number) => {
    const matched = leads.find((l) => l.id === leadId);
    if (matched) {
      onOpen360(matched);
    } else {
      onOpen360({ id: leadId } as Lead);
    }
  };

  const userDisplayName = currentUser.first_name
    ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim()
    : currentUser.username;

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* =========================================================================
          PAGE HEADER & ROLE INDICATOR
      ========================================================================= */}
      <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] p-6 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {isAdmin && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F5F3FF] dark:bg-[#3B0764] text-[#7C3AED] dark:text-[#D8B4FE] border border-[#DDD6FE] dark:border-[#6D28D9]">
                <Shield className="w-3.5 h-3.5" /> Executive Admin Portal
              </span>
            )}
            {isManager && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EFF6FF] dark:bg-[#172554] text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF]">
                <Briefcase className="w-3.5 h-3.5" /> Admissions Manager Portal
              </span>
            )}
            {isCounsellor && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EFF6FF] dark:bg-[#172554] text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF]">
                <GraduationCap className="w-3.5 h-3.5" /> Career Counsellor Workspace
              </span>
            )}

            {isManager && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F8FAFC] dark:bg-[#1E293B] text-[#334155] dark:text-[#CBD5E1] border border-[#E2E8F0] dark:border-[#334155]">
                Team: {currentUser.managed_team_name || currentUser.team_name || 'Admissions Team'}
              </span>
            )}

            <span className="text-xs text-[#64748B] dark:text-[#94A3B8] flex items-center gap-1 font-medium ml-1">
              <Calendar className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
              {stats?.current_date ||
                new Date().toLocaleDateString('en-IN', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
              (Asia/Kolkata)
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
            Operational Control Centre — Welcome, {userDisplayName}
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 max-w-3xl leading-relaxed">
            {isAdmin &&
              'Live organization-wide control centre for leads, Pending Closure financials, multi-channel communications, follow-ups, and team performance.'}
            {isManager &&
              `Authorized admissions oversight and counsellor cadence monitoring for ${currentUser.managed_team_name || 'your designated team'}.`}
            {isCounsellor &&
              'Personal admissions workflow: manage assigned leads, pending follow-ups, and recorded student interactions.'}
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="btn-refresh-dashboard"
            onClick={() => fetchStats()}
            disabled={loadingStats}
            className="p-2 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1] rounded-lg transition text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin text-[#2563EB]' : ''}`} />
            <span>Refresh</span>
          </button>

          {onOpenCreateLead && (
            <button
              type="button"
              id="btn-dashboard-new-lead"
              onClick={onOpenCreateLead}
              className="px-3.5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>+ New Lead</span>
            </button>
          )}

          <button
            type="button"
            id="btn-dashboard-view-leads"
            onClick={onViewAllLeads}
            className="px-3.5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <span>{isCounsellor ? 'My Leads' : 'All Leads'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          GLOBAL SEARCH & FILTER BAR
      ========================================================================= */}
      <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-[#F1F5F9] dark:border-[#273449] pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
            <h2 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider">
              Global Filter &amp; Investigation Toolbar
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                id="btn-dashboard-reset-filters"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-[#DC2626] hover:text-[#B91C1C] flex items-center gap-1 px-2.5 py-1 rounded bg-[#FEF2F2] border border-[#FEE2E2] transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset Filters
              </button>
            )}
            <button
              type="button"
              id="btn-dashboard-apply-filters"
              onClick={() => fetchStats()}
              className="text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] flex items-center gap-1 px-3 py-1 rounded-lg transition cursor-pointer"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1 text-xs">
          {/* 1. Date Preset */}
          <div>
            <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1] mb-1">Date Preset</label>
            <select
              id="filter-date-preset"
              value={filterPreset}
              onChange={(e) => setFilterPreset(e.target.value)}
              className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* 2. Team Filter (Admin only, Manager locked, Sales hidden) */}
          {isAdmin && (
            <div>
              <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1] mb-1">Team Scope</label>
              <select
                id="filter-team-id"
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              >
                <option value="ALL">All Teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id.toString()}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isManager && (
            <div>
              <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1] mb-1">Team Scope</label>
              <div className="w-full bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-[#475569] dark:text-[#CBD5E1] font-medium truncate">
                {currentUser.managed_team_name || currentUser.team_name || 'My Authorized Team'}
              </div>
            </div>
          )}

          {/* 3. Employee Filter (Admin & Manager) */}
          {!isCounsellor && (
            <div>
              <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1] mb-1">Counsellor / Employee</label>
              <select
                id="filter-employee-id"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              >
                <option value="ALL">All Permitted Counsellors</option>
                {permittedEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id.toString()}>
                    {emp.first_name ? `${emp.first_name} ${emp.last_name || ''}`.trim() : emp.username}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Lead Stage Filter (Canonical 12 stages) */}
          <div>
            <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1] mb-1">Pipeline Stage</label>
            <select
              id="filter-stage-id"
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            >
              <option value="ALL">All Stages</option>
              <option value="UNASSIGNED">Unassigned Stage</option>
              {canonicalStages.map((st) => (
                <option key={st.id} value={st.id.toString()}>
                  #{st.order} — {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Lead Source Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1] mb-1">Lead Source</label>
            <select
              id="filter-source"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            >
              <option value="ALL">All Sources</option>
              <option value="Meta">Meta (Facebook/Instagram)</option>
              <option value="Website">Website</option>
              <option value="Bulk Import">Bulk Import</option>
              <option value="Walk-in">Walk-in</option>
              <option value="Referral">Referral</option>
              <option value="Google Ads">Google Ads</option>
            </select>
          </div>

          {/* 6. Communication Channel Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1] mb-1">Comm Channel</label>
            <select
              id="filter-channel"
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            >
              <option value="ALL">All Channels</option>
              <option value="CALL">Calls Only</option>
              <option value="EMAIL">Email Only</option>
              <option value="WHATSAPP">WhatsApp Only</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Row (visible only when 'custom' selected) */}
        {filterPreset === 'custom' && (
          <div className="bg-[#EFF6FF] dark:bg-[#172554]/40 border border-[#BFDBFE] dark:border-[#1E40AF] p-3 rounded-xl flex flex-wrap items-center gap-4 text-xs">
            <span className="font-semibold text-[#1E40AF] dark:text-[#60A5FA] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" /> Custom Date Range:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-[#334155] dark:text-[#CBD5E1] font-medium">Start Date:</label>
              <input
                type="date"
                id="input-custom-start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white dark:bg-[#111827] border border-[#94A3B8] dark:border-[#334155] rounded px-2.5 py-1 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[#334155] dark:text-[#CBD5E1] font-medium">End Date:</label>
              <input
                type="date"
                id="input-custom-end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white dark:bg-[#111827] border border-[#94A3B8] dark:border-[#334155] rounded px-2.5 py-1 text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>
            {dateValidationError && (
              <span className="text-xs font-semibold text-[#DC2626] flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {dateValidationError}
              </span>
            )}
          </div>
        )}

        {/* Search Input Toolbar */}
        <div className="flex items-center gap-3 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] dark:text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="dashboard-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads by name, lead code (#123), phone, email, or assigned employee..."
              className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-xl pl-9 pr-8 py-2 text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] dark:hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#F1F5F9]">
            <span className="text-[11px] font-semibold text-[#64748B]">Active:</span>
            {filterPreset !== '30d' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
                Period: {filterPreset === 'custom' ? `${startDate} to ${endDate}` : filterPreset}
                <button type="button" onClick={() => setFilterPreset('30d')} className="hover:opacity-75">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedTeamId !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]">
                Team: {teams.find((t) => t.id.toString() === selectedTeamId)?.name || selectedTeamId}
                <button type="button" onClick={() => setSelectedTeamId('ALL')} className="hover:opacity-75">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedEmployeeId !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">
                Counsellor:{' '}
                {permittedEmployees.find((e) => e.id.toString() === selectedEmployeeId)?.username ||
                  selectedEmployeeId}
                <button type="button" onClick={() => setSelectedEmployeeId('ALL')} className="hover:opacity-75">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedStageId !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
                Stage: {canonicalStages.find((s) => s.id.toString() === selectedStageId)?.name || selectedStageId}
                <button type="button" onClick={() => setSelectedStageId('ALL')} className="hover:opacity-75">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedSource !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F8FAFC] text-[#334155] border border-[#CBD5E1]">
                Source: {selectedSource}
                <button type="button" onClick={() => setSelectedSource('ALL')} className="hover:opacity-75">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedChannel !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F8FAFC] text-[#334155] border border-[#CBD5E1]">
                Channel: {selectedChannel}
                <button type="button" onClick={() => setSelectedChannel('ALL')} className="hover:opacity-75">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {debouncedSearch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#F8FAFC] text-[#0F172A] border border-[#94A3B8]">
                Query: &quot;{debouncedSearch}&quot;
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setDebouncedSearch('');
                  }}
                  className="hover:opacity-75"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Stats Error Alert with Retry */}
      {statsError && (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] p-4 rounded-xl flex items-center justify-between gap-3 text-xs text-[#991B1B]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
            <span>
              Unable to load live dashboard statistics: <strong>{statsError}</strong>. Displaying local cache.
            </span>
          </div>
          <button
            type="button"
            onClick={() => fetchStats()}
            className="px-3 py-1 bg-white border border-[#FCA5A5] hover:bg-[#FEE2E2] rounded text-xs font-semibold text-[#DC2626] transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* =========================================================================
          SECTION 1: EXECUTIVE SUMMARY KPI CARDS
      ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wide">
              Section 1 — Executive Summary
            </h2>
          </div>
          <span className="text-[11px] text-[#64748B]">Click any card to drill down into records</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Card 1: Total Leads */}
          <div
            id="kpi-total-leads"
            onClick={onViewAllLeads}
            className="crm-kpi-card p-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#172033] hover:border-[#2563EB] dark:hover:border-[#60A5FA] hover:shadow-sm transition cursor-pointer group"
            title="Total authorized student leads under active filters"
          >
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition">
                {isCounsellor ? 'My Assigned Students' : isManager ? 'Team Student Leads' : 'Total Student Leads'}
              </span>
              <Users className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
            </div>
            <div className="text-2xl font-black text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">{kpis.total_leads}</div>
            <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1 flex items-center justify-between">
              <span>Authorized scope</span>
              <ArrowRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition text-[#2563EB] dark:text-[#60A5FA]" />
            </div>
          </div>

          {/* Card 2: New in Period */}
          <div
            id="kpi-new-leads"
            onClick={onViewAllLeads}
            className="crm-kpi-card p-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#172033] hover:border-[#2563EB] dark:hover:border-[#60A5FA] hover:shadow-sm transition cursor-pointer group"
            title="Leads created during the active date range"
          >
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition">
                New In Period
              </span>
              <TrendingUp className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
            </div>
            <div className="text-2xl font-black text-[#2563EB] dark:text-[#60A5FA] tracking-tight">
              {kpis.new_leads_in_period ?? kpis.created_in_period}
            </div>
            <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1">Period-specific creations</div>
          </div>

          {/* Card 3: Active Pipeline Leads */}
          <div
            id="kpi-active-leads"
            onClick={() => {
              if (onDrillDownQuickFilter) onDrillDownQuickFilter('ACTIVE');
              else onViewAllLeads();
            }}
            className="crm-kpi-card p-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#172033] hover:border-[#2563EB] dark:hover:border-[#60A5FA] hover:shadow-sm transition cursor-pointer group"
            title="Leads currently in pipeline excluding terminal stages (Lost and Enrolled)"
          >
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition">
                Active Pipeline
              </span>
              <Activity className="w-3.5 h-3.5 text-[#0EA5E9]" />
            </div>
            <div className="text-2xl font-black text-[#0EA5E9] tracking-tight">
              {kpis.active_pipeline_leads ?? kpis.active_leads}
            </div>
            <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1">Excludes Lost &amp; Enrolled</div>
          </div>

          {/* Card 4: Unassigned Leads */}
          <div
            id="kpi-unassigned-leads"
            onClick={() => {
              if (onOpenUnassignedLeads) onOpenUnassignedLeads();
              else onViewAllLeads();
            }}
            className="crm-kpi-card p-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#172033] hover:border-[#F59E0B] hover:shadow-sm transition cursor-pointer group"
            title="Leads without an assigned career counsellor"
          >
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider group-hover:text-[#F59E0B] transition">
                Unassigned
              </span>
              <AlertCircle className="w-3.5 h-3.5 text-[#F59E0B]" />
            </div>
            <div className="text-2xl font-black text-[#F59E0B] tracking-tight">{kpis.unassigned_leads}</div>
            <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1">Needs counsellor assignment</div>
          </div>

          {/* Card 5: Pending Closure */}
          <div
            id="kpi-pending-closure"
            onClick={() => {
              const pcStage = canonicalStages.find((s) => s.is_pending_closure);
              if (pcStage) onSelectStage(pcStage.id);
              else onViewAllLeads();
            }}
            className="crm-kpi-card p-4 rounded-xl border border-[#DDD6FE] dark:border-[#6D28D9] bg-[#FBFBFE] dark:bg-[#3B0764]/20 hover:border-[#7C3AED] dark:hover:border-[#A855F7] hover:shadow-sm transition cursor-pointer group"
            title="Leads in stage 9: Pending Closure awaiting enrolment completion"
          >
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#7C3AED] dark:text-[#D8B4FE]">
                Pending Closure
              </span>
              <Award className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#D8B4FE]" />
            </div>
            <div className="text-2xl font-black text-[#7C3AED] dark:text-[#D8B4FE] tracking-tight">
              {kpis.pending_closure_leads ??
                canonicalStages.find((s) => s.is_pending_closure)?.count ??
                0}
            </div>
            <div className="text-[10px] text-[#7C3AED] dark:text-[#D8B4FE] mt-1 font-medium">Stage 9 Workflow</div>
          </div>

          {/* Card 6: Enrolled */}
          <div
            id="kpi-enrolled-leads"
            onClick={() => {
              const enrolledStage = canonicalStages.find((s) => s.is_enrolled);
              if (enrolledStage) onSelectStage(enrolledStage.id);
              else onViewAllLeads();
            }}
            className="crm-kpi-card p-4 rounded-xl border border-[#BBF7D0] dark:border-[#166534] bg-[#F0FDF4] dark:bg-[#14532D]/20 hover:border-[#16A34A] dark:hover:border-[#22C55E] hover:shadow-sm transition cursor-pointer group"
            title="Successfully enrolled students (Stage 10)"
          >
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#16A34A] dark:text-[#86EFAC]">
                Enrolled
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] dark:text-[#86EFAC]" />
            </div>
            <div className="text-2xl font-black text-[#16A34A] dark:text-[#86EFAC] tracking-tight">{kpis.enrolled_leads}</div>
            <div className="text-[10px] text-[#16A34A] dark:text-[#86EFAC] mt-1 font-medium">Admissions Won</div>
          </div>

          {/* Card 7: Lost */}
          <div
            id="kpi-lost-leads"
            onClick={() => {
              const lostStage = canonicalStages.find((s) => s.order === 12);
              if (lostStage) onSelectStage(lostStage.id);
              else onViewAllLeads();
            }}
            className="crm-kpi-card p-4 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#172033] hover:border-[#64748B] hover:shadow-sm transition cursor-pointer group"
            title="Lost student leads (Stage 12)"
          >
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">Lost</span>
              <XCircle className="w-3.5 h-3.5 text-[#94A3B8]" />
            </div>
            <div className="text-2xl font-black text-[#64748B] dark:text-[#94A3B8] tracking-tight">{kpis.lost_leads}</div>
            <div className="text-[10px] text-[#94A3B8] mt-1">Terminal stage</div>
          </div>

          {/* Card 8: Overdue Follow-ups */}
          <div
            id="kpi-overdue-followups"
            onClick={() => {
              if (onDrillDownQuickFilter) onDrillDownQuickFilter('OVERDUE');
              else onViewAllLeads();
            }}
            className="crm-kpi-card p-4 rounded-xl border border-[#FECACA] dark:border-[#991B1B] bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 hover:border-[#DC2626] hover:shadow-sm transition cursor-pointer group"
            title="Leads with follow-up timestamps prior to current moment"
          >
            <div className="flex items-center justify-between text-[#64748B] dark:text-[#94A3B8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#DC2626] dark:text-[#F87171]">
                Overdue Action
              </span>
              <Clock className="w-3.5 h-3.5 text-[#DC2626] dark:text-[#F87171]" />
            </div>
            <div className="text-2xl font-black text-[#DC2626] dark:text-[#F87171] tracking-tight">{kpis.followups_overdue}</div>
            <div className="text-[10px] text-[#DC2626] dark:text-[#F87171] mt-1 font-semibold">Immediate attention</div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: PENDING CLOSURE FINANCIAL CONTROL CENTRE
      ========================================================================= */}
      <div className="bg-white dark:bg-[#172033] border border-[#DDD6FE] dark:border-[#334155] rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#F5F3FF] dark:border-[#1E293B] pb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] dark:bg-[#7C3AED]/20 border border-[#DDD6FE] dark:border-[#7C3AED]/40 flex items-center justify-center text-[#7C3AED] dark:text-[#A78BFA]">
              <IndianRupee className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide">
                Section 2 — Pending Closure Financial Control Centre
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                Authoritative financial oversight connected directly to PreCloserFinancial records (INR).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const pcStage = canonicalStages.find((s) => s.is_pending_closure);
                if (pcStage) onSelectStage(pcStage.id);
                else onViewAllLeads();
              }}
              className="text-xs font-semibold text-[#7C3AED] dark:text-[#A78BFA] hover:text-[#6D28D9] dark:hover:text-[#C4B5FD] flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F5F3FF] dark:bg-[#7C3AED]/20 border border-[#DDD6FE] dark:border-[#7C3AED]/30 transition cursor-pointer"
            >
              <span>View All Pending Closure Leads</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Data Integrity Alert Banner (if historical leads lack PreCloserFinancial) */}
        {financials && financials.missing_financial_count > 0 && (
          <div className="bg-[#FFFBEB] dark:bg-[#78350F]/20 border border-[#FDE68A] dark:border-[#92400E] p-4 rounded-xl flex items-center justify-between gap-3 text-xs text-[#92400E] dark:text-[#FDE68A]">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#D97706] dark:text-[#F59E0B] shrink-0" />
              <div>
                <span className="font-bold">Data Integrity Notice:</span>{' '}
                <strong>{financials.missing_financial_count} lead(s)</strong> currently in stage Pending Closure
                lack formal financial records because they were seeded or moved prior to workflow enforcement.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onDrillDownQuickFilter) {
                  const pcStage = canonicalStages.find((s) => s.is_pending_closure);
                  onDrillDownQuickFilter('MISSING_FINANCIAL', pcStage ? pcStage.id : null);
                } else {
                  onViewAllLeads();
                }
              }}
              className="px-3 py-1 rounded bg-white dark:bg-[#111827] border border-[#FCD34D] dark:border-[#78350F] hover:bg-[#FEF3C7] dark:hover:bg-[#1E293B] text-[#92400E] dark:text-[#FDE68A] font-semibold text-xs whitespace-nowrap cursor-pointer transition"
            >
              Filter Affected Leads
            </button>
          </div>
        )}

        {/* Financial KPI Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] p-4 rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block mb-1">
              Eligible Leads
            </span>
            <div className="text-xl font-black text-[#0F172A] dark:text-[#F8FAFC]">{financials?.leads_count ?? 0}</div>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1 block">In Pending Closure stage</span>
          </div>

          <div className="bg-[#EFF6FF] dark:bg-[#172554]/30 border border-[#BFDBFE] dark:border-[#1E40AF]/50 p-4 rounded-xl">
            <span className="text-[11px] font-semibold text-[#1E40AF] dark:text-[#93C5FD] uppercase tracking-wider block mb-1">
              Total Agreed Value
            </span>
            <div className="text-xl font-black text-[#1E40AF] dark:text-[#60A5FA]">
              {formatINR(financials?.total_agreed_amount ?? 0)}
            </div>
            <span className="text-[10px] text-[#2563EB] dark:text-[#93C5FD] mt-1 block">Sum of agreed tuition</span>
          </div>

          <div className="bg-[#F0FDF4] dark:bg-[#14532D]/30 border border-[#BBF7D0] dark:border-[#166534]/50 p-4 rounded-xl">
            <span className="text-[11px] font-semibold text-[#15803D] dark:text-[#86EFAC] uppercase tracking-wider block mb-1">
              Total Amount Paid
            </span>
            <div className="text-xl font-black text-[#15803D] dark:text-[#4ADE80]">
              {formatINR(financials?.total_amount_paid ?? 0)}
            </div>
            <span className="text-[10px] text-[#16A34A] dark:text-[#86EFAC] mt-1 block">Recorded collections to date</span>
          </div>

          <div className="bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#991B1B]/50 p-4 rounded-xl">
            <span className="text-[11px] font-semibold text-[#B91C1C] dark:text-[#FCA5A5] uppercase tracking-wider block mb-1">
              Total Outstanding Balance
            </span>
            <div className="text-xl font-black text-[#DC2626] dark:text-[#F87171]">
              {formatINR(financials?.total_outstanding_balance ?? 0)}
            </div>
            <span className="text-[10px] text-[#DC2626] dark:text-[#F87171] mt-1 block">Agreed Amount − Amount Paid</span>
          </div>

          <div className="bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] p-4 rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block mb-1">
              Missing Financial Records
            </span>
            <div
              className={`text-xl font-black ${
                (financials?.missing_financial_count ?? 0) > 0 ? 'text-[#D97706] dark:text-[#F59E0B]' : 'text-[#16A34A] dark:text-[#4ADE80]'
              }`}
            >
              {financials?.missing_financial_count ?? 0}
            </div>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1 block">
              {(financials?.missing_financial_count ?? 0) > 0 ? 'Requires attention' : '100% compliant'}
            </span>
          </div>
        </div>

        {/* Detailed Table of Leads with Outstanding Balances or Missing Financials */}
        <div>
          <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider mb-2">
            Top Leads with Outstanding Balances or Incomplete Records
          </h3>
          <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#94A3B8] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Lead Code / Name</th>
                    <th className="py-2.5 px-3">Assigned Counsellor</th>
                    <th className="py-2.5 px-3">Team</th>
                    <th className="py-2.5 px-3 text-right">Agreed Value</th>
                    <th className="py-2.5 px-3 text-right">Amount Paid</th>
                    <th className="py-2.5 px-3 text-right">Outstanding Balance</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B] text-[#334155] dark:text-[#CBD5E1]">
                  {financials && financials.outstanding_leads_table.length > 0 ? (
                    financials.outstanding_leads_table.map((row: OutstandingLeadRow) => (
                      <tr key={row.lead_id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/60 transition">
                        <td className="py-2.5 px-3 font-medium">
                          <button
                            type="button"
                            onClick={() => handleOpenLeadByCodeOrId(row.lead_id)}
                            className="text-[#2563EB] dark:text-[#60A5FA] hover:underline font-semibold cursor-pointer text-left"
                          >
                            {row.name}
                          </button>
                          <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block">{row.lead_code}</span>
                        </td>
                        <td className="py-2.5 px-3 text-[#475569] dark:text-[#CBD5E1]">{row.assigned_employee_name}</td>
                        <td className="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8]">{row.team_name}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                          {row.is_missing_financial ? '—' : formatINR(row.agreed_amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-[#16A34A] dark:text-[#4ADE80]">
                          {row.is_missing_financial ? '—' : formatINR(row.amount_paid)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#DC2626] dark:text-[#F87171]">
                          {row.is_missing_financial ? '—' : formatINR(row.outstanding_balance)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {row.is_missing_financial ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3C7] dark:bg-[#78350F]/40 text-[#92400E] dark:text-[#FDE68A] border border-[#FDE68A] dark:border-[#92400E]">
                              Missing Financials
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EFF6FF] dark:bg-[#172554]/60 text-[#1E40AF] dark:text-[#93C5FD] border border-[#BFDBFE] dark:border-[#1E40AF]">
                              Pending Balance
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenLeadByCodeOrId(row.lead_id)}
                            className="px-2.5 py-1 text-[11px] rounded font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition cursor-pointer"
                          >
                            Open Lead
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-[#94A3B8] dark:text-[#64748B]">
                        No Pending Closure leads with outstanding balances found under active filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: PIPELINE OVERVIEW (CANONICAL 12 STAGES)
      ========================================================================= */}
      <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] dark:border-[#1E293B] pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide">
              12-Stage Admissions Pipeline Funnel
            </h2>
          </div>
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">Click any stage to filter spreadsheet leads</span>
        </div>

        {/* 12 Stages Visual Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {canonicalStages.map((st) => {
            const isPC = st.is_pending_closure;
            const isEnrolled = st.is_enrolled;

            return (
              <div
                key={st.id}
                id={`pipeline-stage-${st.id}`}
                onClick={() => onSelectStage(st.id)}
                className={`p-3.5 rounded-xl border transition cursor-pointer group ${
                  isPC
                    ? 'border-[#DDD6FE] dark:border-[#6D28D9] bg-[#FBFBFE] dark:bg-[#3B0764]/20 hover:border-[#7C3AED] dark:hover:border-[#A855F7]'
                    : isEnrolled
                    ? 'border-[#BBF7D0] dark:border-[#166534] bg-[#F0FDF4] dark:bg-[#14532D]/20 hover:border-[#16A34A] dark:hover:border-[#22C55E]'
                    : 'border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#111827] hover:border-[#2563EB] dark:hover:border-[#60A5FA]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isPC
                          ? 'bg-[#7C3AED] text-white'
                          : isEnrolled
                          ? 'bg-[#16A34A] text-white'
                          : 'bg-[#E2E8F0] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1]'
                      }`}
                    >
                      #{st.order}
                    </span>
                    <span
                      className={`text-xs font-bold truncate ${
                        isPC ? 'text-[#7C3AED] dark:text-[#C4B5FD]' : isEnrolled ? 'text-[#16A34A] dark:text-[#86EFAC]' : 'text-[#0F172A] dark:text-[#F8FAFC]'
                      }`}
                    >
                      {st.name}
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] dark:text-[#64748B] group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition shrink-0" />
                </div>

                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-lg font-black text-[#0F172A] dark:text-[#F8FAFC]">{st.count} leads</span>
                  <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">{st.percentage}%</span>
                </div>

                {/* Funnel Progress Bar */}
                <div className="w-full bg-[#F1F5F9] dark:bg-[#1E293B] rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isPC ? 'bg-[#7C3AED]' : isEnrolled ? 'bg-[#16A34A]' : 'bg-[#2563EB]'
                    }`}
                    style={{ width: `${Math.min(st.percentage, 100)}%` }}
                  />
                </div>

                {st.entries_in_period !== undefined && st.entries_in_period > 0 && (
                  <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1.5 flex items-center justify-between">
                    <span>Period entries:</span>
                    <span className="font-semibold text-[#2563EB] dark:text-[#60A5FA]">+{st.entries_in_period}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          SECTION 4: COMMUNICATIONS ACTIVITY & GATEWAY HEALTH
      ========================================================================= */}
      <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] dark:border-[#1E293B] pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide">
              Section 4 — Communications Activity &amp; Gateway Dispatch
            </h2>
          </div>
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">Granular activity by communication channel</span>
        </div>

        {/* Channel Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Calls Card */}
          <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#111827]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" /> Outbound Calls (Callyzer)
              </span>
              <span className="text-[10px] font-semibold bg-[#EFF6FF] dark:bg-[#172554] text-[#1E40AF] dark:text-[#93C5FD] px-2 py-0.5 rounded">
                Attempts Only
              </span>
            </div>
            <div className="text-2xl font-black text-[#0F172A] dark:text-[#F8FAFC]">{commsActivity?.calls.attempts ?? 0}</div>
            <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-2 space-y-0.5">
              <div className="flex justify-between">
                <span>Blocked (Pending API Spec):</span>
                <span className="font-semibold text-[#DC2626] dark:text-[#F87171]">{commsActivity?.calls.blocked ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Failed Attempts:</span>
                <span className="font-semibold text-[#DC2626] dark:text-[#F87171]">{commsActivity?.calls.failed ?? 0}</span>
              </div>
            </div>
            <div className="text-[10px] text-[#94A3B8] dark:text-[#64748B] italic mt-2 border-t border-[#E2E8F0] dark:border-[#1E293B] pt-1.5">
              Connected call outcomes are not recorded by current mock integration.
            </div>
          </div>

          {/* Email Card */}
          <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#111827]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-[#7C3AED] dark:text-[#A78BFA]" /> Email (Google SMTP)
              </span>
              <span className="text-[10px] font-semibold bg-[#F5F3FF] dark:bg-[#3B0764]/40 text-[#7C3AED] dark:text-[#C4B5FD] px-2 py-0.5 rounded">
                Gateway Dispatches
              </span>
            </div>
            <div className="text-2xl font-black text-[#0F172A] dark:text-[#F8FAFC]">{commsActivity?.email.attempts ?? 0}</div>
            <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-2 space-y-0.5">
              <div className="flex justify-between">
                <span>Accepted by Google SMTP:</span>
                <span className="font-semibold text-[#16A34A] dark:text-[#4ADE80]">{commsActivity?.email.accepted ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Failures:</span>
                <span className="font-semibold text-[#DC2626] dark:text-[#F87171]">{commsActivity?.email.failed ?? 0}</span>
              </div>
            </div>
            <div className="text-[10px] text-[#94A3B8] dark:text-[#64748B] italic mt-2 border-t border-[#E2E8F0] dark:border-[#1E293B] pt-1.5">
              SMTP acceptance does not prove inbox delivery or email opens.
            </div>
          </div>

          {/* WhatsApp Card */}
          <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-4 bg-[#F8FAFC] dark:bg-[#111827]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-[#16A34A] dark:text-[#4ADE80]" /> WhatsApp (Meta Cloud API)
              </span>
              <span className="text-[10px] font-semibold bg-[#F0FDF4] dark:bg-[#14532D]/40 text-[#15803D] dark:text-[#86EFAC] px-2 py-0.5 rounded">
                API Dispatches
              </span>
            </div>
            <div className="text-2xl font-black text-[#0F172A] dark:text-[#F8FAFC]">{commsActivity?.whatsapp.attempts ?? 0}</div>
            <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-2 space-y-0.5">
              <div className="flex justify-between">
                <span>Accepted by Meta API:</span>
                <span className="font-semibold text-[#16A34A] dark:text-[#4ADE80]">{commsActivity?.whatsapp.accepted ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Failed Dispatches:</span>
                <span className="font-semibold text-[#DC2626] dark:text-[#F87171]">{commsActivity?.whatsapp.failed ?? 0}</span>
              </div>
            </div>
            <div className="text-[10px] text-[#94A3B8] dark:text-[#64748B] italic mt-2 border-t border-[#E2E8F0] dark:border-[#1E293B] pt-1.5">
              Meta API acceptance does not guarantee device receipt or reading.
            </div>
          </div>
        </div>

        {/* Filterable Communication Activity Table */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider">
              Recent Communication Dispatches
            </h3>
            <div className="flex items-center bg-[#F1F5F9] dark:bg-[#111827] rounded-lg p-0.5 text-xs">
              {(['ALL', 'CALL', 'EMAIL', 'WHATSAPP'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setCommChannelTab(ch)}
                  className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer text-[11px] ${
                    commChannelTab === ch ? 'bg-white dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs' : 'text-[#64748B] dark:text-[#94A3B8]'
                  }`}
                >
                  {ch === 'ALL' ? 'All Channels' : ch}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#94A3B8] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Date / Time (UTC)</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3">Lead</th>
                    <th className="py-2.5 px-3">Initiated By</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Details / Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B] text-[#334155] dark:text-[#CBD5E1]">
                  {commsActivity &&
                  commsActivity.recent_logs.filter(
                    (l) => commChannelTab === 'ALL' || l.channel === commChannelTab
                  ).length > 0 ? (
                    commsActivity.recent_logs
                      .filter((l) => commChannelTab === 'ALL' || l.channel === commChannelTab)
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/60 transition">
                          <td className="py-2 px-3 text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2 px-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            <span className="flex items-center gap-1.5">
                              {log.channel === 'CALL' && <Phone className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />}
                              {log.channel === 'EMAIL' && <Mail className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#A78BFA]" />}
                              {log.channel === 'WHATSAPP' && (
                                <MessageSquare className="w-3.5 h-3.5 text-[#16A34A] dark:text-[#4ADE80]" />
                              )}
                              {log.channel}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[#475569] dark:text-[#CBD5E1] truncate max-w-[150px]">{log.recipient}</td>
                          <td className="py-2 px-3 font-medium">
                            {log.lead_id ? (
                              <button
                                type="button"
                                onClick={() => handleOpenLeadByCodeOrId(log.lead_id as number)}
                                className="text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer"
                              >
                                {log.lead_name || log.lead_code}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2 px-3 text-[#64748B] dark:text-[#94A3B8]">{log.initiated_by_name}</td>
                          <td className="py-2 px-3 text-center">
                            {log.status === 'SUCCESS' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F0FDF4] dark:bg-[#14532D]/40 text-[#15803D] dark:text-[#86EFAC] border border-[#BBF7D0] dark:border-[#166534]">
                                Accepted
                              </span>
                            )}
                            {log.status === 'FAILED' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF2F2] dark:bg-[#7F1D1D]/40 text-[#B91C1C] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#991B1B]">
                                Failed
                              </span>
                            )}
                            {log.status === 'BLOCKED' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[#B45309] dark:text-[#FDE68A] border border-[#FDE68A] dark:border-[#92400E]">
                                Blocked
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[#64748B] dark:text-[#94A3B8] text-[11px] truncate max-w-[200px]">
                            {log.error_message || '—'}
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-[#94A3B8] dark:text-[#64748B]">
                        No communication dispatches recorded for this channel.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 5: FOLLOW-UPS & TODAY'S ACTION QUEUE
      ========================================================================= */}
      <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] dark:border-[#1E293B] pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide">
              Section 5 — Follow-Ups &amp; Action Queue
            </h2>
          </div>
          <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">Timezone: Asia/Kolkata (IST)</span>
        </div>

        {/* Followup Queue Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#EFF6FF] dark:bg-[#172554]/30 border border-[#BFDBFE] dark:border-[#1E40AF]/50 p-3 rounded-xl">
            <span className="text-[11px] font-semibold text-[#1E40AF] dark:text-[#93C5FD] uppercase tracking-wider block">
              Due Today
            </span>
            <div className="text-xl font-black text-[#1E40AF] dark:text-[#60A5FA] mt-1">
              {followupQueue?.due_today ?? kpis.followups_today}
            </div>
          </div>
          <div className="bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#991B1B]/50 p-3 rounded-xl">
            <span className="text-[11px] font-semibold text-[#B91C1C] dark:text-[#FCA5A5] uppercase tracking-wider block">
              Overdue
            </span>
            <div className="text-xl font-black text-[#DC2626] dark:text-[#F87171] mt-1">
              {followupQueue?.overdue ?? kpis.followups_overdue}
            </div>
          </div>
          <div className="bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] p-3 rounded-xl">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block">
              Next 7 Days
            </span>
            <div className="text-xl font-black text-[#0F172A] dark:text-[#F8FAFC] mt-1">
              {followupQueue?.next_7_days ?? kpis.followups_next_7_days ?? 0}
            </div>
          </div>
          <div className="bg-[#FFFBEB] dark:bg-[#78350F]/20 border border-[#FDE68A] dark:border-[#92400E]/50 p-3 rounded-xl">
            <span className="text-[11px] font-semibold text-[#B45309] dark:text-[#FDE68A] uppercase tracking-wider block">
              Active Without Follow-Up
            </span>
            <div className="text-xl font-black text-[#D97706] dark:text-[#F59E0B] mt-1">
              {followupQueue?.no_followup_scheduled ?? 0}
            </div>
          </div>
        </div>

        {/* Action Table */}
        <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#94A3B8] font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Lead Code / Name</th>
                  <th className="py-2.5 px-3">Current Stage</th>
                  <th className="py-2.5 px-3">Assigned Counsellor</th>
                  <th className="py-2.5 px-3">Follow-Up Time (IST)</th>
                  <th className="py-2.5 px-3 text-center">Priority</th>
                  <th className="py-2.5 px-3 text-center">Cadence Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B] text-[#334155] dark:text-[#CBD5E1]">
                {followupQueue && followupQueue.action_table.length > 0 ? (
                  followupQueue.action_table.map((item: FollowupQueueItem) => (
                    <tr key={item.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/60 transition">
                      <td className="py-2.5 px-3 font-medium">
                        <button
                          type="button"
                          onClick={() => handleOpenLeadByCodeOrId(item.lead_id)}
                          className="text-[#2563EB] dark:text-[#60A5FA] hover:underline font-semibold cursor-pointer text-left"
                        >
                          {item.name || item.lead_name}
                        </button>
                        <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] block">{item.lead_code}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        {(() => {
                          const stStyle = getStageStyle(item.stage_name);
                          return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border shadow-xs ${stStyle.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stStyle.dot}`} />
                              {item.stage_name}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8]">{item.assigned_employee_name}</td>
                      <td className="py-2.5 px-3 text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap">
                        {item.due_date
                          ? new Date(item.due_date).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.priority === 'High'
                              ? 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/40 text-[#DC2626] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#991B1B]'
                              : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1]'
                          }`}
                        >
                          {item.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.is_overdue ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF2F2] dark:bg-[#7F1D1D]/40 text-[#DC2626] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#991B1B]">
                            Overdue
                          </span>
                        ) : item.is_today ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EFF6FF] dark:bg-[#172554]/60 text-[#1E40AF] dark:text-[#93C5FD] border border-[#BFDBFE] dark:border-[#1E40AF]">
                            Due Today
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F0FDF4] dark:bg-[#14532D]/40 text-[#16A34A] dark:text-[#86EFAC] border border-[#BBF7D0] dark:border-[#166534]">
                            Upcoming
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {item.phone && (
                            <button
                              type="button"
                              onClick={() => {
                                const leadObj = leads.find((l) => l.id === item.lead_id);
                                if (leadObj) onCommunicate(leadObj, 'CALL');
                              }}
                              className="p-1 rounded bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] hover:bg-[#EFF6FF] dark:hover:bg-[#172554] hover:text-[#2563EB] dark:hover:text-[#60A5FA] text-[#64748B] dark:text-[#94A3B8] transition cursor-pointer"
                              title="Call Lead"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {item.email && (
                            <button
                              type="button"
                              onClick={() => {
                                const leadObj = leads.find((l) => l.id === item.lead_id);
                                if (leadObj) onCommunicate(leadObj, 'EMAIL');
                              }}
                              className="p-1 rounded bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] hover:bg-[#F5F3FF] dark:hover:bg-[#3B0764]/40 hover:text-[#7C3AED] dark:hover:text-[#A78BFA] text-[#64748B] dark:text-[#94A3B8] transition cursor-pointer"
                              title="Email Lead"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenLeadByCodeOrId(item.lead_id)}
                            className="px-2.5 py-1 text-[11px] rounded font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition cursor-pointer"
                          >
                            Open
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[#94A3B8] dark:text-[#64748B]">
                      No scheduled follow-up leads in queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-[11px] text-[#94A3B8] dark:text-[#64748B] italic">
          Note: Dedicated follow-up completion tracking and reminder models are pending schema implementation.
          Logged communications are preserved as independent audit logs.
        </div>
      </div>

      {/* =========================================================================
          SECTION 6: ATTENTION REQUIRED OPERATIONAL RADAR
      ========================================================================= */}
      <div className="bg-white dark:bg-[#172033] border border-[#FCA5A5] dark:border-[#991B1B]/60 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#FEE2E2] dark:border-[#7F1D1D]/40 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#DC2626] dark:text-[#F87171]" />
            <h2 className="text-sm font-bold text-[#991B1B] dark:text-[#FCA5A5] uppercase tracking-wide">
              Section 6 — Attention Required &amp; Operational Risks
            </h2>
          </div>
          <span className="text-xs text-[#DC2626] dark:text-[#F87171] font-medium">Items requiring active management</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Risk 1 */}
          <div
            onClick={() => {
              if (onDrillDownQuickFilter) onDrillDownQuickFilter('OVERDUE');
              else onViewAllLeads();
            }}
            className="p-3 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#991B1B]/50 rounded-xl cursor-pointer hover:shadow-xs transition"
          >
            <span className="text-[10px] font-bold text-[#991B1B] dark:text-[#FCA5A5] uppercase block">Overdue Action</span>
            <div className="text-xl font-black text-[#DC2626] dark:text-[#F87171] mt-1">
              {attentionReq?.overdue_followups ?? kpis.followups_overdue}
            </div>
            <span className="text-[10px] text-[#991B1B] dark:text-[#FCA5A5]">Past follow-up date</span>
          </div>

          {/* Risk 2 */}
          <div
            onClick={() => {
              if (onOpenUnassignedLeads) onOpenUnassignedLeads();
              else onViewAllLeads();
            }}
            className="p-3 bg-[#FFFBEB] dark:bg-[#78350F]/30 border border-[#FDE68A] dark:border-[#92400E]/50 rounded-xl cursor-pointer hover:shadow-xs transition"
          >
            <span className="text-[10px] font-bold text-[#92400E] dark:text-[#FDE68A] uppercase block">Unassigned</span>
            <div className="text-xl font-black text-[#D97706] dark:text-[#FBBF24] mt-1">
              {attentionReq?.unassigned_leads ?? kpis.unassigned_leads}
            </div>
            <span className="text-[10px] text-[#92400E] dark:text-[#FDE68A]">No counsellor</span>
          </div>

          {/* Risk 3 */}
          <div
            onClick={onViewAllLeads}
            className="p-3 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl cursor-pointer hover:shadow-xs transition"
          >
            <span className="text-[10px] font-bold text-[#475569] dark:text-[#CBD5E1] uppercase block">Stale Activity</span>
            <div className="text-xl font-black text-[#0F172A] dark:text-[#F8FAFC] mt-1">{attentionReq?.stale_leads ?? 0}</div>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">No comms in 7d+</span>
          </div>

          {/* Risk 4 */}
          <div
            onClick={onViewAllLeads}
            className="p-3 bg-[#FFFBEB] dark:bg-[#78350F]/30 border border-[#FDE68A] dark:border-[#92400E]/50 rounded-xl cursor-pointer hover:shadow-xs transition"
          >
            <span className="text-[10px] font-bold text-[#92400E] dark:text-[#FDE68A] uppercase block">No Next Followup</span>
            <div className="text-xl font-black text-[#D97706] dark:text-[#FBBF24] mt-1">
              {attentionReq?.no_next_followup ?? 0}
            </div>
            <span className="text-[10px] text-[#92400E] dark:text-[#FDE68A]">Active leads unscheduled</span>
          </div>

          {/* Risk 5 */}
          <div
            onClick={() => {
              if (onDrillDownQuickFilter) {
                const pcStage = canonicalStages.find((s) => s.is_pending_closure);
                onDrillDownQuickFilter('MISSING_FINANCIAL', pcStage ? pcStage.id : null);
              } else {
                onViewAllLeads();
              }
            }}
            className="p-3 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#991B1B]/50 rounded-xl cursor-pointer hover:shadow-xs transition"
          >
            <span className="text-[10px] font-bold text-[#991B1B] dark:text-[#FCA5A5] uppercase block">Missing Fin Record</span>
            <div className="text-xl font-black text-[#DC2626] dark:text-[#F87171] mt-1">
              {attentionReq?.missing_financials ?? financials?.missing_financial_count ?? 0}
            </div>
            <span className="text-[10px] text-[#991B1B] dark:text-[#FCA5A5]">PC incomplete</span>
          </div>

          {/* Risk 6 */}
          <div
            onClick={() => {
              const pcStage = canonicalStages.find((s) => s.is_pending_closure);
              if (pcStage) onSelectStage(pcStage.id);
              else onViewAllLeads();
            }}
            className="p-3 bg-[#F5F3FF] dark:bg-[#3B0764]/20 border border-[#DDD6FE] dark:border-[#6D28D9]/50 rounded-xl cursor-pointer hover:shadow-xs transition"
          >
            <span className="text-[10px] font-bold text-[#7C3AED] dark:text-[#D8B4FE] uppercase block">Pending Balances</span>
            <div className="text-xl font-black text-[#7C3AED] dark:text-[#D8B4FE] mt-1">
              {attentionReq?.outstanding_balances ?? 0}
            </div>
            <span className="text-[10px] text-[#7C3AED] dark:text-[#D8B4FE]">Balance &gt; 0</span>
          </div>

          {/* Risk 7 */}
          <div
            onClick={() => setCommChannelTab('ALL')}
            className="p-3 bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#991B1B]/50 rounded-xl cursor-pointer hover:shadow-xs transition"
          >
            <span className="text-[10px] font-bold text-[#991B1B] dark:text-[#FCA5A5] uppercase block">Failed Comms</span>
            <div className="text-xl font-black text-[#DC2626] dark:text-[#F87171] mt-1">
              {attentionReq?.failed_communications ?? 0}
            </div>
            <span className="text-[10px] text-[#991B1B] dark:text-[#FCA5A5]">Dispatch errors</span>
          </div>

          {/* Risk 8 */}
          <div
            onClick={onViewAllLeads}
            className="p-3 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl cursor-pointer hover:shadow-xs transition"
          >
            <span className="text-[10px] font-bold text-[#475569] dark:text-[#CBD5E1] uppercase block">Inactive Users</span>
            <div className="text-xl font-black text-[#475569] dark:text-[#CBD5E1] mt-1">
              {attentionReq?.inactive_user_leads ?? 0}
            </div>
            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">Assigned to inactive</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 7: TEAM & EMPLOYEE PERFORMANCE
      ========================================================================= */}
      <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] dark:border-[#1E293B] pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
            <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide">
              {isManager
                ? 'My Team Counsellors Performance'
                : isAdmin
                ? 'Organization & Counsellor Performance'
                : 'My Counsellor Workload'}
            </h2>
          </div>

          {/* Admin Toggle between Teams & Members */}
          {isAdmin && (
            <div className="flex items-center bg-[#F1F5F9] dark:bg-[#111827] rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setAdminPerformanceTab('members')}
                className={`px-3 py-1 rounded font-semibold transition cursor-pointer ${
                  adminPerformanceTab === 'members'
                    ? 'bg-white dark:bg-[#1E293B] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                }`}
              >
                Counsellor Matrix
              </button>
              <button
                type="button"
                onClick={() => setAdminPerformanceTab('teams')}
                className={`px-3 py-1 rounded font-semibold transition cursor-pointer ${
                  adminPerformanceTab === 'teams'
                    ? 'bg-white dark:bg-[#1E293B] text-[#2563EB] dark:text-[#60A5FA] shadow-xs'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                }`}
              >
                Team Comparison
              </button>
            </div>
          )}
        </div>

        {/* Search for employees */}
        <div className="max-w-xs">
          <input
            type="text"
            value={memberSearchQuery}
            onChange={(e) => setMemberSearchQuery(e.target.value)}
            placeholder="Search counsellors by name..."
            className="w-full bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>

        {/* Member Performance Table */}
        {(!isAdmin || adminPerformanceTab === 'members') && (
          <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#94A3B8] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Counsellor Name</th>
                    <th className="py-2.5 px-3">Team</th>
                    <th className="py-2.5 px-3 text-right">Assigned</th>
                    <th className="py-2.5 px-3 text-right">Enrolled</th>
                    <th className="py-2.5 px-3 text-right">Lost</th>
                    <th className="py-2.5 px-3 text-right">Pending Closure</th>
                    <th className="py-2.5 px-3 text-right">Follow-ups</th>
                    <th className="py-2.5 px-3 text-right">Calls Logged</th>
                    <th className="py-2.5 px-3 text-right">Emails</th>
                    <th className="py-2.5 px-3 text-right">WhatsApp</th>
                    <th className="py-2.5 px-3 text-right">Agreed Value</th>
                    <th className="py-2.5 px-3 text-right">Outstanding Bal</th>
                    <th className="py-2.5 px-3 text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B] text-[#334155] dark:text-[#CBD5E1]">
                  {stats?.member_performance &&
                  stats.member_performance.filter((m) =>
                    memberSearchQuery ? m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) : true
                  ).length > 0 ? (
                    stats.member_performance
                      .filter((m) =>
                        memberSearchQuery ? m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) : true
                      )
                      .map((mem) => (
                        <tr key={mem.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/60 transition">
                          <td className="py-2.5 px-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            <button
                              type="button"
                              onClick={() => {
                                if (onDrillDownEmployee) onDrillDownEmployee(mem.id);
                                else onViewAllLeads();
                              }}
                              className="text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer text-left"
                            >
                              {mem.name}
                            </button>
                            <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] block font-normal">{mem.email}</span>
                          </td>
                          <td className="py-2.5 px-3 text-[#64748B] dark:text-[#94A3B8]">{mem.team_name || '—'}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                            {mem.assigned_leads}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-[#16A34A] dark:text-[#4ADE80]">
                            {mem.enrolled_leads}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#94A3B8] dark:text-[#64748B]">{mem.lost_leads}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-[#7C3AED] dark:text-[#C4B5FD]">
                            {mem.pending_closure_leads ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-right text-[#0F172A] dark:text-[#F8FAFC]">{mem.pending_followups}</td>
                          <td className="py-2.5 px-3 text-right text-[#475569] dark:text-[#CBD5E1]">{mem.recorded_calls}</td>
                          <td className="py-2.5 px-3 text-right text-[#475569] dark:text-[#CBD5E1]">{mem.emails_attempted ?? 0}</td>
                          <td className="py-2.5 px-3 text-right text-[#475569] dark:text-[#CBD5E1]">{mem.whatsapp_attempted ?? 0}</td>
                          <td className="py-2.5 px-3 text-right font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                            {formatINR(mem.total_agreed_amount ?? 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#DC2626] dark:text-[#F87171]">
                            {formatINR(mem.total_outstanding_balance ?? 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-[#2563EB] dark:text-[#60A5FA]">
                            {mem.conversion_rate ?? 0}%
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={13} className="py-6 text-center text-[#94A3B8] dark:text-[#64748B]">
                        No counsellors found under active filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Team Overview Table (Admin only) */}
        {isAdmin && adminPerformanceTab === 'teams' && (
          <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#94A3B8] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Team Name</th>
                    <th className="py-2.5 px-3">Manager</th>
                    <th className="py-2.5 px-3 text-right">Members</th>
                    <th className="py-2.5 px-3 text-right">Total Leads</th>
                    <th className="py-2.5 px-3 text-right">Assigned</th>
                    <th className="py-2.5 px-3 text-right">Enrolled</th>
                    <th className="py-2.5 px-3 text-right">Lost</th>
                    <th className="py-2.5 px-3 text-right">Pending Closure</th>
                    <th className="py-2.5 px-3 text-right">Follow-ups</th>
                    <th className="py-2.5 px-3 text-right">Agreed Value</th>
                    <th className="py-2.5 px-3 text-right">Outstanding Bal</th>
                    <th className="py-2.5 px-3 text-right">Conversion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B] text-[#334155] dark:text-[#CBD5E1]">
                  {stats?.team_overview && stats.team_overview.length > 0 ? (
                    stats.team_overview.map((team) => (
                      <tr key={team.team_id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/60 transition">
                        <td className="py-2.5 px-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{team.team_name}</td>
                        <td className="py-2.5 px-3 text-[#475569] dark:text-[#CBD5E1]">{team.manager_name}</td>
                        <td className="py-2.5 px-3 text-right text-[#64748B] dark:text-[#94A3B8]">{team.members_count ?? 0}</td>
                        <td className="py-2.5 px-3 text-right font-black text-[#0F172A] dark:text-[#F8FAFC]">{team.total_leads}</td>
                        <td className="py-2.5 px-3 text-right text-[#475569] dark:text-[#CBD5E1]">{team.assigned_leads}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#16A34A] dark:text-[#4ADE80]">{team.enrolled_leads}</td>
                        <td className="py-2.5 px-3 text-right text-[#94A3B8] dark:text-[#64748B]">{team.lost_leads}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#7C3AED] dark:text-[#C4B5FD]">
                          {team.pending_closure_leads ?? 0}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#0F172A] dark:text-[#F8FAFC]">{team.pending_followups}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                          {formatINR(team.total_agreed_amount ?? 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-[#DC2626] dark:text-[#F87171]">
                          {formatINR(team.total_outstanding_balance ?? 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#2563EB] dark:text-[#60A5FA]">
                          {team.conversion_rate ?? 0}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={12} className="py-6 text-center text-[#94A3B8] dark:text-[#64748B]">
                        No teams registered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-[11px] text-[#94A3B8] dark:text-[#64748B] italic">
          Conversion Rate Formula: (Enrolled Leads / Total Assigned Leads) × 100. Workloads and metrics respect role-based data isolation.
        </div>
      </div>

      {/* =========================================================================
          SECTION 8: RECENT ACTIVITY & ADMIN SYSTEM HEALTH
      ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed (2 Cols) */}
        <div
          className={`bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl p-6 shadow-xs space-y-4 ${
            isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#F1F5F9] dark:border-[#1E293B] pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide">
                Recent CRM Events &amp; Activity
              </h2>
            </div>
            <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">Audited mutations &amp; interactions</span>
          </div>

          <div className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B] max-h-96 overflow-y-auto pr-1">
            {stats?.recent_activity && stats.recent_activity.length > 0 ? (
              stats.recent_activity.map((act) => (
                <div key={act.id} className="py-2.5 flex items-start gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-[#2563EB] dark:bg-[#60A5FA] mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">{act.title}</span>
                      <span className="text-[10px] text-[#94A3B8] dark:text-[#64748B] whitespace-nowrap">
                        {new Date(act.timestamp).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5 truncate">{act.description}</p>
                    <span className="text-[10px] text-[#94A3B8] dark:text-[#64748B] mt-0.5 block">
                      By {act.actor || act.user || 'System'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-[#94A3B8] dark:text-[#64748B] text-xs">No recent activity recorded.</div>
            )}
          </div>
        </div>

        {/* Admin System & Integration Health (Admin only, 1 Col) */}
        {isAdmin && systemHealth && (
          <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] dark:border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#7C3AED] dark:text-[#A78BFA]" />
                <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wide">
                  System Health (Admin)
                </h2>
              </div>
              <span className="text-[10px] font-semibold text-[#16A34A] dark:text-[#86EFAC] bg-[#F0FDF4] dark:bg-[#14532D]/40 px-2 py-0.5 rounded border border-[#BBF7D0] dark:border-[#166534]">
                Live Status
              </span>
            </div>

            <div className="space-y-3 text-xs">
              {/* Google SMTP */}
              <div className="p-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#A78BFA]" /> Google SMTP Delivery
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      systemHealth.email_smtp.is_ready
                        ? 'bg-[#F0FDF4] dark:bg-[#14532D]/40 text-[#15803D] dark:text-[#86EFAC]'
                        : 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/40 text-[#B91C1C] dark:text-[#FCA5A5]'
                    }`}
                  >
                    {systemHealth.email_smtp.status}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  {systemHealth.email_smtp.host}:{systemHealth.email_smtp.port}
                </div>
                <div className="text-[10px] text-[#94A3B8] dark:text-[#64748B] mt-1">{systemHealth.email_smtp.note}</div>
              </div>

              {/* WhatsApp Cloud API */}
              <div className="p-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#16A34A] dark:text-[#4ADE80]" /> Meta Cloud WhatsApp
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      systemHealth.whatsapp.is_ready
                        ? 'bg-[#F0FDF4] dark:bg-[#14532D]/40 text-[#15803D] dark:text-[#86EFAC]'
                        : 'bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[#B45309] dark:text-[#FDE68A]'
                    }`}
                  >
                    {systemHealth.whatsapp.status}
                  </span>
                </div>
                <div className="text-[10px] text-[#94A3B8] dark:text-[#64748B]">{systemHealth.whatsapp.note}</div>
              </div>

              {/* Callyzer Integration */}
              <div className="p-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" /> Callyzer Calling
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[#B45309] dark:text-[#FDE68A]">
                    {systemHealth.callyzer.status}
                  </span>
                </div>
                <div className="text-[10px] text-[#94A3B8] dark:text-[#64748B]">{systemHealth.callyzer.note}</div>
              </div>

              {/* Reports Scheduler */}
              <div className="p-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Scheduled Reports</span>
                  <span className="text-[10px] text-[#16A34A] dark:text-[#86EFAC] font-semibold">
                    {systemHealth.reports_scheduler.status}
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Active Schedules: {systemHealth.reports_scheduler.active_schedules_count}
                </div>
                <div className="text-[10px] text-[#94A3B8] dark:text-[#64748B] mt-0.5">
                  Last run:{' '}
                  {systemHealth.reports_scheduler.last_run_at
                    ? new Date(systemHealth.reports_scheduler.last_run_at).toLocaleString('en-IN')
                    : 'Never executed yet'}
                </div>
              </div>

              {/* Data Integrity Summary */}
              <div className="p-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827]">
                <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1">Data Integrity Monitor</span>
                <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] space-y-0.5">
                  <div className="flex justify-between">
                    <span>PC Missing Financials:</span>
                    <span
                      className={`font-semibold ${
                        systemHealth.data_integrity.pending_closure_missing_financials > 0
                          ? 'text-[#DC2626] dark:text-[#F87171]'
                          : 'text-[#16A34A] dark:text-[#4ADE80]'
                      }`}
                    >
                      {systemHealth.data_integrity.pending_closure_missing_financials}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Unassigned Queue:</span>
                    <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                      {systemHealth.data_integrity.unassigned_leads}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Inactive User Assignments:</span>
                    <span
                      className={`font-semibold ${
                        systemHealth.data_integrity.inactive_user_assignments > 0
                          ? 'text-[#DC2626] dark:text-[#F87171]'
                          : 'text-[#16A34A] dark:text-[#4ADE80]'
                      }`}
                    >
                      {systemHealth.data_integrity.inactive_user_assignments}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
