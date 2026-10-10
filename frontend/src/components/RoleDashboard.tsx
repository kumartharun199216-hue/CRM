import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Lead, PipelineStage, Team, DashboardStats } from '../types';
import { api } from '../services/api';
import {
  Users,
  GraduationCap,
  TrendingUp,
  DollarSign,
  Award,
  Layers,
  Phone,
  MessageSquare,
  Mail,
  Clock,
  Briefcase,
  Shield,
  ArrowRight,
  ScanEye,
  UserCheck,
  AlertCircle,
  Calendar,
  Filter,
  CheckCircle2,
  XCircle,
  UserPlus,
  FileText,
  Activity,
  UserX,
  ExternalLink,
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
}

export const RoleDashboard: React.FC<RoleDashboardProps> = ({
  currentUser,
  leads,
  stages,
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
}) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const isManager = currentUser.role === 'MANAGER';
  const isCounsellor = currentUser.role === 'SALES_EMPLOYEE';

  const [dateFilterDays, setDateFilterDays] = useState<number | undefined>(undefined);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fetchStats = useCallback(async (days?: number) => {
    try {
      setLoadingStats(true);
      setStatsError(null);
      const res = await api.getDashboardStats(days);
      setStats(res);
    } catch (err: unknown) {
      // In test environments or offline, gracefully keep fallback
      const msg = err instanceof Error ? err.message : 'Failed to fetch dashboard statistics';
      setStatsError(msg);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(dateFilterDays);
  }, [dateFilterDays, fetchStats]);

  const userDisplayName = currentUser.first_name
    ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim()
    : currentUser.username;

  // Fallback local calculations from props if stats endpoint hasn't resolved
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
    const active = total - lost;
    const unassigned = authorizedLeads.filter((l) => !l.assigned_employee).length;
    const assigned = total - unassigned;
    const estRev = authorizedLeads.reduce((acc, l) => acc + (Number(l.estimated_revenue) || 0), 0);
    const placementFees = authorizedLeads.reduce((acc, l) => acc + (Number(l.placement_fee) || 0), 0);

    const now = new Date();
    const followups = authorizedLeads.filter((l) => !!l.next_follow_up);
    const followupsOverdue = followups.filter((l) => l.next_follow_up && new Date(l.next_follow_up) < now).length;
    const followupsToday = followups.filter((l) => {
      if (!l.next_follow_up) return false;
      const d = new Date(l.next_follow_up);
      return d.toDateString() === now.toDateString();
    }).length;

    return {
      total_leads: total,
      active_leads: active,
      created_in_period: total,
      enrolled_leads: enrolled,
      lost_leads: lost,
      unassigned_leads: unassigned,
      assigned_leads: assigned,
      total_estimated_revenue: estRev,
      total_placement_fees: placementFees,
      pending_followups: followups.length,
      followups_today: followupsToday,
      followups_overdue: followupsOverdue,
    };
  }, [authorizedLeads]);

  // Combined KPIs (Server-aggregated with local fallback)
  const kpis = stats?.kpis || localKPIs;

  // Pipeline distribution across configured stages
  const pipelineDistribution = useMemo(() => {
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
      };
    });
  }, [stats, stages, authorizedLeads]);

  // Counsellor stats fallback for team member table
  const fallbackMemberStats = useMemo(() => {
    const salesEmployees = users.filter((u) => {
      if (u.role !== 'SALES_EMPLOYEE') return false;
      if (isAdmin) return true;
      if (isManager) {
        const authorizedTeamId = currentUser.managed_team_id || currentUser.team;
        return u.team === authorizedTeamId;
      }
      return false;
    });

    return salesEmployees.map((emp) => {
      const empLeads = leads.filter((l) => l.assigned_employee === emp.id);
      const empEnrolled = empLeads.filter(
        (l) => l.stage_name?.toLowerCase().includes('enrolled') || l.stage === 10
      );
      const empLost = empLeads.filter(
        (l) => l.stage_name?.toLowerCase().includes('lost') || l.stage === 12
      );

      return {
        id: emp.id,
        name: emp.first_name ? `${emp.first_name} ${emp.last_name || ''}`.trim() : emp.username,
        username: emp.username,
        team_name: emp.team_name || 'Assigned Team',
        assigned_leads: empLeads.length,
        enrolled_leads: empEnrolled.length,
        lost_leads: empLost.length,
        recorded_calls: 0,
        recorded_messages: 0,
        completed_followups: 0,
        stage_summary: [],
      };
    });
  }, [users, leads, isAdmin, isManager, currentUser]);

  const memberPerformance = stats?.member_performance || fallbackMemberStats;

  // Urgent / Priority action items
  const actionItems = useMemo(() => {
    return authorizedLeads
      .filter((l) => l.priority?.toLowerCase() === 'high' || l.stage_name?.toLowerCase().includes('followup'))
      .slice(0, 8);
  }, [authorizedLeads]);

  return (
    <div className="space-y-6 font-sans">
      {/* A. Page Header */}
      <div className="crm-card p-6 border border-[#E2E8F0] bg-white rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {isAdmin && (
              <span className="crm-pill crm-pill-purple">
                <Shield className="w-3.5 h-3.5 text-[#7C3AED]" /> Executive Admin Portal
              </span>
            )}
            {isManager && (
              <span className="crm-pill crm-pill-blue">
                <Briefcase className="w-3.5 h-3.5 text-[#2563EB]" /> Admissions Manager Portal
              </span>
            )}
            {isCounsellor && (
              <span className="crm-pill crm-pill-blue">
                <GraduationCap className="w-3.5 h-3.5 text-[#2563EB]" /> Career Counsellor Workspace
              </span>
            )}

            {isManager && (
              <span className="crm-pill bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE] font-medium">
                Team: {currentUser.managed_team_name || currentUser.team_name || 'Admissions Team'}
              </span>
            )}

            <span className="text-xs text-[#64748B] flex items-center gap-1 font-medium ml-1">
              <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            Welcome, {userDisplayName}
          </h1>
          <p className="text-xs text-[#64748B] mt-1 max-w-2xl leading-relaxed">
            {isAdmin && 'Real-time admissions pipeline metrics, team workload, and conversion tracking across all branches.'}
            {isManager && `Monitoring lead distribution, team counsellors, and follow-ups for ${currentUser.managed_team_name || 'your authorized team'}.`}
            {isCounsellor && 'Review your assigned student pipeline, overdue reminders, and record interactions.'}
          </p>
        </div>

        {/* Date Filter Controls & Prominent Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {(isAdmin || isManager) && (
            <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-1 text-xs">
              <span className="px-2 py-1 text-[#64748B] flex items-center gap-1 font-medium">
                <Filter className="w-3 h-3" /> Period:
              </span>
              {[
                { label: 'All Time', val: undefined },
                { label: '7D', val: 7 },
                { label: '30D', val: 30 },
                { label: '90D', val: 90 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => setDateFilterDays(btn.val)}
                  className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                    dateFilterDays === btn.val
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#EFF6FF]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}

          {isCounsellor && (
            <button
              type="button"
              onClick={onViewAllLeads}
              className="crm-btn-primary px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span>My Leads</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {!isCounsellor && (
            <button
              type="button"
              onClick={onViewAllLeads}
              className="crm-btn-primary px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span>All Leads ({kpis.total_leads})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* B. KPI CARDS SECTION (ROLE-SPECIFIC)                          */}
      {/* ============================================================== */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
          {/* 1. Total Leads */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Total Student Leads</span>
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#0F172A]">{kpis.total_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">All recorded leads</div>
          </div>

          {/* 2. Active Leads */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Active Leads</span>
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#2563EB]">{kpis.active_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">In progression</div>
          </div>

          {/* 3. Created in Period */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Period Inflow</span>
              <div className="w-7 h-7 rounded-lg bg-[#F3E8FF] border border-[#E9D5FF] flex items-center justify-center text-[#7C3AED]">
                <Calendar className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#7C3AED]">{kpis.created_in_period}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">
              {dateFilterDays ? `Last ${dateFilterDays} days` : 'Total created'}
            </div>
          </div>

          {/* 4. Enrolled Leads */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Enrolled Leads</span>
              <div className="w-7 h-7 rounded-lg bg-[#DCFCE7] border border-[#BBF7D0] flex items-center justify-center text-[#16A34A]">
                <Award className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#16A34A]">{kpis.enrolled_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">Successfully placed</div>
          </div>

          {/* 5. Lost Leads */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Lost Leads</span>
              <div className="w-7 h-7 rounded-lg bg-[#FEE2E2] border border-[#FECACA] flex items-center justify-center text-[#DC2626]">
                <XCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#DC2626]">{kpis.lost_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">Archived or closed</div>
          </div>

          {/* 6. Unassigned Leads */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Unassigned Leads</span>
              <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center text-[#D97706]">
                <UserX className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#D97706]">{kpis.unassigned_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">Needs assignment</div>
          </div>

          {/* 7. Total Placement Fees / Revenue */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Placement Fees</span>
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-lg font-bold text-[#0F172A] truncate" title={`₹ ${Number(kpis.total_placement_fees || 0).toLocaleString()}`}>
              ₹ {Number(kpis.total_placement_fees || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-[#64748B] mt-1 font-medium truncate" title={`Pipeline: ₹ ${Number(kpis.total_estimated_revenue || 0).toLocaleString()}`}>
              Est. Rev: ₹ {Number(kpis.total_estimated_revenue || 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {isManager && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* 1. Total Leads in Team */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Team Student Leads</span>
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#0F172A]">{kpis.total_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">In your team</div>
          </div>

          {/* 2. Unassigned Leads in Team */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Team Unassigned</span>
              <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center text-[#D97706]">
                <UserX className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#D97706]">{kpis.unassigned_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">Ready to allocate</div>
          </div>

          {/* 3. Assigned to Team Members */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Assigned Leads</span>
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#2563EB]">{kpis.assigned_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">With counsellors</div>
          </div>

          {/* 4. Enrolled Leads */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Team Enrolled</span>
              <div className="w-7 h-7 rounded-lg bg-[#DCFCE7] border border-[#BBF7D0] flex items-center justify-center text-[#16A34A]">
                <Award className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#16A34A]">{kpis.enrolled_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">Placed students</div>
          </div>

          {/* 5. Lost Leads */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Team Lost</span>
              <div className="w-7 h-7 rounded-lg bg-[#FEE2E2] border border-[#FECACA] flex items-center justify-center text-[#DC2626]">
                <XCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#DC2626]">{kpis.lost_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">Inactive/Lost</div>
          </div>

          {/* 6. Pending Follow-ups */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Pending Follow-ups</span>
              <div className="w-7 h-7 rounded-lg bg-[#F3E8FF] border border-[#E9D5FF] flex items-center justify-center text-[#7C3AED]">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#7C3AED]">{kpis.pending_followups}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">Scheduled team actions</div>
          </div>
        </div>
      )}

      {isCounsellor && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* 1. My Total Assigned Leads */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>My Assigned Students</span>
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#0F172A]">{kpis.total_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">Total assigned</div>
          </div>

          {/* 2. My Active Leads */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>My Active Leads</span>
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#2563EB]">{kpis.active_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">In counseling</div>
          </div>

          {/* 3. Follow-ups Due Today */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Due Today</span>
              <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center text-[#D97706]">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#D97706]">{kpis.followups_today}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">Follow-ups today</div>
          </div>

          {/* 4. Overdue Follow-ups */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>Overdue Follow-ups</span>
              <div className="w-7 h-7 rounded-lg bg-[#FEE2E2] border border-[#FECACA] flex items-center justify-center text-[#DC2626]">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#DC2626]">{kpis.followups_overdue}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">Urgent action needed</div>
          </div>

          {/* 5. My Enrolled Leads */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>My Enrolled</span>
              <div className="w-7 h-7 rounded-lg bg-[#DCFCE7] border border-[#BBF7D0] flex items-center justify-center text-[#16A34A]">
                <Award className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#16A34A]">{kpis.enrolled_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">Successful admissions</div>
          </div>

          {/* 6. My Lost Leads */}
          <div className="crm-card crm-card-interactive p-4 border border-[#E2E8F0] relative overflow-hidden group">
            <div className="flex items-center justify-between text-[#64748B] text-xs font-medium mb-1">
              <span>My Lost</span>
              <div className="w-7 h-7 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#64748B]">
                <XCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold text-[#64748B]">{kpis.lost_leads}</div>
            <div className="text-[11px] text-[#64748B] mt-1 font-medium">Closed profiles</div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* QUICK ACTIONS BAR                                              */}
      {/* ============================================================== */}
      <div className="crm-card p-4 border border-[#E2E8F0] bg-[#FFFFFF] rounded-xl flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Quick Actions:</span>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {(isAdmin || isManager) && onOpenCreateLead && (
            <button
              type="button"
              onClick={onOpenCreateLead}
              className="crm-btn-primary px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Lead</span>
            </button>
          )}

          {(isAdmin || isManager) && onOpenUnassignedLeads && (
            <button
              type="button"
              onClick={onOpenUnassignedLeads}
              className="crm-btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer hover:bg-[#F3E8FF] hover:border-[#E9D5FF] hover:text-[#7C3AED]"
            >
              <UserX className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Unassigned Leads ({kpis.unassigned_leads})</span>
            </button>
          )}

          {isManager && onOpenUnassignedLeads && (
            <button
              type="button"
              onClick={onOpenUnassignedLeads}
              className="crm-btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer hover:bg-[#EFF6FF] hover:border-[#BFDBFE] hover:text-[#2563EB]"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Assign Leads</span>
            </button>
          )}

          {isAdmin && onOpenStages && (
            <button
              type="button"
              onClick={onOpenStages}
              className="crm-btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Pipeline Stages</span>
            </button>
          )}

          {isAdmin && onOpenReports && (
            <button
              type="button"
              onClick={onOpenReports}
              className="crm-btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Scheduled Reports</span>
            </button>
          )}

          {isCounsellor && (
            <button
              type="button"
              onClick={onViewAllLeads}
              className="crm-btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>My Lead Spreadsheet</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* C. PIPELINE STAGES & MAIN SECTIONS                             */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Pipeline Funnel & Team Overview / Tables */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pipeline Overview Card */}
          <div className="crm-card rounded-xl p-5 border border-[#E2E8F0] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-sm font-bold text-[#0F172A]">
                  {isAdmin && '12-Stage Admissions Pipeline Funnel'}
                  {isManager && 'Team Admissions Pipeline Funnel'}
                  {isCounsellor && 'My Admissions Pipeline Funnel'}
                </h3>
              </div>
              <span className="text-xs text-[#64748B]">Click any stage to filter lead list</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {pipelineDistribution.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectStage(item.id)}
                  className="p-3 rounded-lg bg-[#FFFFFF] hover:bg-[#EFF6FF] border border-[#E2E8F0] hover:border-[#BFDBFE] transition-all flex items-center justify-between group text-left cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 mr-2">
                    <span className="w-5 h-5 rounded-full bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#2563EB] group-hover:text-white flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors">
                      {item.order}
                    </span>
                    <span className="text-xs text-[#0F172A] group-hover:text-[#2563EB] font-medium truncate">
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden hidden sm:block border border-[#E2E8F0]">
                      <div
                        className="h-full bg-gradient-to-r from-[#2563EB] to-[#7C3AED] rounded-full transition-all"
                        style={{ width: `${Math.min(100, (item.percentage || 0) * 2)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#E2E8F0]">
                      {item.count}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* D. Admin Team Performance Overview */}
          {isAdmin && (
            <div className="crm-card rounded-xl p-5 border border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">Admissions Team Performance Overview</h3>
                </div>
                <span className="text-xs text-[#64748B]">Real-time team aggregations</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B] bg-[#F8FAFC]">
                      <th className="py-2.5 px-3 font-semibold">Team Name</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Assigned Leads</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Enrolled</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Lost</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Pending Follow-ups</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Placement Fees</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {stats?.team_overview && stats.team_overview.length > 0 ? (
                      stats.team_overview.map((team: any) => (
                        <tr key={team.team_id || team.id} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#0F172A]">{team.team_name || team.name}</div>
                            <div className="text-[11px] text-[#64748B]">Manager: {team.manager_name || 'Unassigned'}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-[#2563EB]">
                            {team.assigned_leads ?? team.total_leads ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-[#16A34A]">
                            {team.enrolled_leads ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-[#DC2626]">
                            {team.lost_leads ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-[#7C3AED]">
                            {team.pending_followups ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-[#0F172A]">
                            ₹ {Number(team.total_placement_fees ?? team.placement_fees ?? 0).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[#64748B]">
                          No team performance data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* D. Manager Team Member Performance Table */}
          {(isManager || isAdmin) && (
            <div className="crm-card rounded-xl p-5 border border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#7C3AED]" />
                  <h3 className="text-sm font-bold text-[#0F172A]">
                    {isManager ? 'My Team Counsellors Performance' : 'Individual Counsellor Workload'}
                  </h3>
                </div>
                <span className="text-xs text-[#64748B]">{memberPerformance.length} members</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#64748B] bg-[#F8FAFC]">
                      <th className="py-2.5 px-3 font-semibold">Counsellor</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Assigned Leads</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Enrolled</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Lost</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Calls</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Messages</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Completed Follow-ups</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {memberPerformance.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-[#64748B]">
                          No counsellors configured in this team yet.
                        </td>
                      </tr>
                    ) : (
                      memberPerformance.map((stat: any) => (
                        <tr key={stat.id} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-[#0F172A]">{stat.name || stat.full_name || stat.username}</div>
                            <div className="text-[11px] text-[#64748B]">{stat.username || stat.email}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-[#2563EB]">
                            {stat.assigned_leads ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-[#16A34A]">
                            {stat.enrolled_leads ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-[#DC2626]">
                            {stat.lost_leads ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-center text-[#0F172A]">
                            {stat.recorded_calls ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-center text-[#0F172A]">
                            {stat.recorded_messages ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-[#7C3AED]">
                            {stat.completed_followups ?? 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Counsellor Guidance Card */}
          {isCounsellor && (
            <div className="crm-card rounded-xl p-5 border border-[#E2E8F0] space-y-3 bg-[#FFFFFF]">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-sm font-bold text-[#0F172A]">Admissions Guidance & Priority Rules</h3>
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Connect with new and assigned leads within 2 hours of assignment. Ensure follow-up notes are recorded after every interaction. For urgent cases, use the quick communication actions on the right panel to initiate WhatsApp templates or direct Callyzer phone calls.
              </p>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Follow-up Monitoring & Activity Feed */}
        <div className="space-y-6">
          {/* Follow-up Monitoring / Action Queue */}
          <div className="crm-card rounded-xl p-5 border border-[#E2E8F0] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D97706]" />
                <h3 className="text-sm font-bold text-[#0F172A]">
                  {isCounsellor ? "Today's Follow-ups" : "Follow-up Monitoring"}
                </h3>
              </div>
              <span className="crm-pill crm-pill-warning">
                {stats?.followup_monitoring ? stats.followup_monitoring.length : actionItems.length} items
              </span>
            </div>

            {/* Display list of follow-ups */}
            {stats?.followup_monitoring && stats.followup_monitoring.length > 0 ? (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {stats.followup_monitoring.map((item) => (
                  <div
                    key={item.lead_id}
                    className={`p-3 rounded-lg border transition-colors ${
                      item.is_overdue
                        ? 'bg-[#FEF2F2] border-[#FECACA]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#BFDBFE]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-xs text-[#0F172A] truncate">
                          {item.lead_name}
                        </div>
                        <div className="text-[11px] text-[#64748B] truncate">
                          Assigned: {item.assigned_employee_name}
                        </div>
                      </div>
                      {item.is_overdue ? (
                        <span className="crm-pill crm-pill-error text-[10px]">Overdue</span>
                      ) : (
                        <span className="crm-pill crm-pill-blue text-[10px]">Upcoming</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#E2E8F0] text-[11px]">
                      <span className="text-[#64748B] font-medium">
                        Due: {item.due_date ? new Date(item.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No due date'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const lead = leads.find((l) => l.id === item.lead_id);
                            if (lead) onOpen360(lead);
                          }}
                          className="px-2 py-0.5 text-[10px] font-semibold bg-[#FFFFFF] border border-[#CBD5E1] hover:border-[#2563EB] hover:text-[#2563EB] rounded cursor-pointer transition"
                        >
                          Open 360°
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : actionItems.length > 0 ? (
              <div className="space-y-2.5">
                {actionItems.map((lead) => (
                  <div
                    key={lead.id}
                    className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#BFDBFE] space-y-2 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpen360(lead)}
                          className="font-bold text-[#0F172A] hover:text-[#2563EB] text-xs truncate block text-left transition-colors cursor-pointer"
                          title="Open Lead 360° View"
                        >
                          {lead.name}
                        </button>
                        <div className="text-[11px] text-[#64748B] truncate">
                          {lead.qualification || lead.target_role || lead.email}
                        </div>
                      </div>
                      <span className="crm-pill crm-pill-blue shrink-0">
                        {lead.lead_id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0] text-[11px]">
                      <span className="text-[#64748B] truncate max-w-[120px]">
                        {lead.stage_name || 'Unassigned'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onCommunicate(lead, 'CALL')}
                          className="p-1 hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#2563EB] rounded transition cursor-pointer"
                          title="Call student"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCommunicate(lead, 'WHATSAPP')}
                          className="p-1 hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#16A34A] rounded transition cursor-pointer"
                          title="WhatsApp student"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onCommunicate(lead, 'EMAIL')}
                          className="p-1 hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#7C3AED] rounded transition cursor-pointer"
                          title="Email student"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpen360(lead)}
                          className="p-1 hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#2563EB] rounded transition cursor-pointer"
                          title="Open 360 View"
                        >
                          <ScanEye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-[#64748B] text-xs">
                No overdue or pending follow-ups. All actions are currently up to date!
              </div>
            )}
          </div>

          {/* Recent CRM Activities */}
          <div className="crm-card rounded-xl p-5 border border-[#E2E8F0] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#7C3AED]" />
                <h3 className="text-sm font-bold text-[#0F172A]">Recent Activity</h3>
              </div>
              <span className="text-xs text-[#64748B]">Audit log</span>
            </div>

            {stats?.recent_activity && stats.recent_activity.length > 0 ? (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {stats.recent_activity.map((act) => (
                  <div key={act.id} className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-semibold text-[#0F172A]">{act.title}</span>
                      <span className="text-[10px] text-[#64748B]">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[#64748B] text-[11px] leading-snug">{act.description}</p>
                    <div className="mt-1 text-[10px] text-[#2563EB] font-medium flex items-center justify-between">
                      <span>By: {act.user}</span>
                      {act.lead_name && <span>Student: {act.lead_name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-[#64748B] text-xs">
                No recent activity records found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
