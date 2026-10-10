import React, { useState, useEffect } from 'react';
import { User, PipelineStage, ViewType } from '../types';
import {
  Settings2,
  Clock,
  LogOut,
  Shield,
  Briefcase,
  GraduationCap,
  Sparkles,
  ChevronDown,
  Layers,
  LayoutDashboard,
  UserX,
  FileSpreadsheet,
  Users,
  UserCircle,
  Building,
} from 'lucide-react';

interface SidebarProps {
  user: User;
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  stages?: PipelineStage[];
  stageCounts?: Record<number, number>;
  countsLoading?: boolean;
  unassignedCount?: number;
  unassignedCountLoading?: boolean;
  selectedStageId?: number | null;
  onSelectStage?: (stageId: number | null) => void;
  onOpenCreateLead?: () => void;
  onOpenReports: () => void;
  onOpenTemplates?: () => void;
  onOpenStages: () => void;
  onLogout: () => void;
}

const DEFAULT_12_STAGES: PipelineStage[] = [
  { id: 1, name: 'Cold Calling', order: 1, is_active: true },
  { id: 2, name: 'Not Connected', order: 2, is_active: true },
  { id: 3, name: 'New Lead', order: 3, is_active: true },
  { id: 4, name: 'Contacted', order: 4, is_active: true },
  { id: 5, name: 'Interested', order: 5, is_active: true },
  { id: 6, name: 'Prospect', order: 6, is_active: true },
  { id: 7, name: 'FollowUp', order: 7, is_active: true },
  { id: 8, name: 'Negotation', order: 8, is_active: true },
  { id: 9, name: 'pendingClosure', order: 9, is_active: true },
  { id: 10, name: 'Enrolled', order: 10, is_active: true },
  { id: 11, name: 'Not Interested', order: 11, is_active: true },
  { id: 12, name: 'Lost', order: 12, is_active: true },
];

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeView,
  onViewChange,
  stages = [],
  stageCounts = {},
  countsLoading = false,
  unassignedCount = 0,
  unassignedCountLoading = false,
  selectedStageId = null,
  onSelectStage,
  onOpenReports,
  onOpenStages,
  onLogout,
}) => {
  const isPipelineActive = activeView === 'spreadsheet' || activeView === 'kanban';
  const [isPipelineExpanded, setIsPipelineExpanded] = useState(Boolean(selectedStageId));

  // Automatically expand the pipeline submenu whenever a specific stage subroute is active
  useEffect(() => {
    if (selectedStageId !== null && selectedStageId !== undefined) {
      setIsPipelineExpanded(true);
    }
  }, [selectedStageId]);

  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER';
  const canViewUnassigned = isAdmin || isManager;
  const canImport = isAdmin || isManager;
  const canViewUsers = isAdmin || isManager;

  const activeStages = stages && stages.length > 0
    ? [...stages].filter((s) => s.is_active).sort((a, b) => a.order - b.order)
    : DEFAULT_12_STAGES;

  const getRoleBadge = () => {
    switch (user.role) {
      case 'ADMIN':
        return (
          <span className="crm-pill crm-pill-purple">
            <Shield className="w-3 h-3 text-[#7C3AED]" /> Admin
          </span>
        );
      case 'MANAGER':
        return (
          <span className="crm-pill crm-pill-blue">
            <Briefcase className="w-3 h-3 text-[#2563EB]" /> Manager
          </span>
        );
      case 'SALES_EMPLOYEE':
        return (
          <span className="crm-pill bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            <GraduationCap className="w-3 h-3 text-[#2563EB]" /> Counsellor
          </span>
        );
    }
  };

  const handleTogglePipeline = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPipelineExpanded((prev) => !prev);
  };

  const handleKeyDownPipeline = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsPipelineExpanded((prev) => !prev);
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-[#E2E8F0] flex flex-col justify-between shrink-0 select-none min-h-screen sticky top-0 h-screen font-sans">
      {/* Top Branding */}
      <div className="overflow-y-auto">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#1E3A8A] flex items-center justify-center text-white shadow-sm shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold tracking-tight leading-tight m-0 truncate text-[#1E3A8A]">
              Skill Move
            </h1>
            <p className="text-[11px] font-medium text-[#64748B] m-0 truncate tracking-wide">
              Admissions & Sales CRM
            </p>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="p-3 space-y-5">
          {/* Views Section */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              Views
            </div>
            <button
              type="button"
              id="sidebar-dashboard-nav-item"
              onClick={() => {
                onViewChange('dashboard');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'dashboard'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>
                {user.role === 'ADMIN' ? 'Admin Dashboard' : user.role === 'MANAGER' ? 'Manager Dashboard' : 'My Dashboard'}
              </span>
            </button>

            {canViewUnassigned && (
              <button
                type="button"
                id="unassigned-leads-nav-item"
                onClick={() => {
                  onViewChange('unassigned');
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeView === 'unassigned'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserX className={`w-4 h-4 shrink-0 ${activeView === 'unassigned' ? 'text-white' : 'text-[#D97706]'}`} />
                  <span className="truncate">Unassigned Leads</span>
                </div>
                <span
                  id="unassigned-count-badge"
                  className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] shrink-0 transition-all ${
                    activeView === 'unassigned'
                      ? 'bg-white/20 text-white font-bold'
                      : (unassignedCount ?? 0) > 0
                      ? 'crm-pill-warning font-bold'
                      : 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]'
                  }`}
                >
                  {unassignedCountLoading ? '…' : (unassignedCount ?? 0)}
                </span>
              </button>
            )}

            {canImport && (
              <button
                type="button"
                id="sidebar-import-nav-item"
                onClick={() => {
                  onViewChange('import');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeView === 'import'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeView === 'import' ? 'text-white' : 'text-[#2563EB]'}`} />
                <span className="truncate">Import Leads</span>
              </button>
            )}

            {/* Users */}
            {canViewUsers && (
              <button
                type="button"
                id="sidebar-users-nav-item"
                onClick={() => {
                  onViewChange('users');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeView === 'users'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                <Users className={`w-4 h-4 shrink-0 ${activeView === 'users' ? 'text-white' : 'text-[#2563EB]'}`} />
                <span className="truncate">Users</span>
              </button>
            )}

            {/* Teams (Admin Only) */}
            {isAdmin && (
              <button
                type="button"
                id="sidebar-teams-nav-item"
                onClick={() => {
                  onViewChange('teams');
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeView === 'teams'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                <Building className={`w-4 h-4 shrink-0 ${activeView === 'teams' ? 'text-white' : 'text-[#7C3AED]'}`} />
                <span className="truncate">Teams</span>
              </button>
            )}

            {/* My Profile */}
            <button
              type="button"
              id="sidebar-profile-nav-item"
              onClick={() => {
                onViewChange('profile');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'profile'
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}
            >
              <UserCircle className={`w-4 h-4 shrink-0 ${activeView === 'profile' ? 'text-white' : 'text-[#2563EB]'}`} />
              <span className="truncate">My Profile</span>
            </button>
          </div>

          {/* Pipeline Stages Section with Expand/Collapse and Live Lead Counts */}
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              Pipeline
            </div>
            <button
              type="button"
              id="pipeline-stages-trigger"
              onClick={handleTogglePipeline}
              onKeyDown={handleKeyDownPipeline}
              aria-expanded={isPipelineExpanded}
              aria-controls="pipeline-stages-submenu"
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isPipelineActive
                  ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Layers className="w-4 h-4 text-[#2563EB] shrink-0" />
                <span className="truncate">Pipeline Stages ({activeStages.length})</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#64748B] transition-transform duration-200 shrink-0 ${
                  isPipelineExpanded ? 'rotate-180 text-[#2563EB]' : ''
                }`}
              />
            </button>

            {/* Submenu with smooth CSS animation */}
            <div
              id="pipeline-stages-submenu"
              role="region"
              aria-labelledby="pipeline-stages-trigger"
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                isPipelineExpanded ? 'max-h-[600px] opacity-100 mt-1' : 'max-h-0 opacity-0 pointer-events-none'
              }`}
            >
              <div className="pl-3 pr-1 py-1 space-y-0.5 border-l border-[#E2E8F0] ml-4">
                <button
                  type="button"
                  id="pipeline-all-stages-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectStage?.(null);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] transition text-left group cursor-pointer ${
                    isPipelineActive && selectedStageId === null
                      ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold border border-[#BFDBFE]'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                  }`}
                >
                  <span className="truncate mr-2 font-medium">All Pipeline Stages</span>
                  <span className="px-1.5 py-0.2 rounded-md font-mono text-[10px] bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] shrink-0">
                    {countsLoading ? '…' : Object.values(stageCounts).reduce((a, b) => a + b, 0)}
                  </span>
                </button>

                {activeStages.map((st) => {
                  const count = stageCounts[st.id] ?? 0;
                  const isSelected = isPipelineActive && selectedStageId === st.id;

                  return (
                    <button
                      key={st.id}
                      type="button"
                      id={`pipeline-stage-btn-${st.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectStage?.(st.id);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] transition text-left group cursor-pointer ${
                        isSelected
                          ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold border border-[#BFDBFE]'
                          : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      <span className="truncate mr-2">{st.name}</span>
                      <span className="px-1.5 py-0.2 rounded-md font-mono text-[10px] bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] shrink-0">
                        {countsLoading ? '…' : count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Admin Management Section */}
          {isAdmin && (
            <div className="space-y-1">
              <div className="px-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                Administration
              </div>
              <button
                type="button"
                onClick={onOpenReports}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition cursor-pointer"
              >
                <Clock className="w-4 h-4 text-[#7C3AED] shrink-0" />
                <span>Scheduled Reports</span>
              </button>
              <button
                type="button"
                onClick={onOpenStages}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition cursor-pointer"
              >
                <Settings2 className="w-4 h-4 text-[#64748B] shrink-0" />
                <span>Configure Stages</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Profile and Sign Out Card */}
      <div className="p-3 border-t border-[#E2E8F0] bg-[#F8FAFC] shrink-0">
        <div
          id="sidebar-user-profile-card"
          onClick={() => onViewChange('profile')}
          title="Click to view My Profile"
          className={`p-3 bg-white rounded-lg space-y-2.5 border transition cursor-pointer hover:border-[#2563EB]/40 hover:shadow-xs group ${
            activeView === 'profile' ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20 bg-[#EFF6FF]/20' : 'border-[#E2E8F0]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#0F172A] group-hover:text-[#2563EB] transition-colors truncate">
                {user.full_name || user.email || user.username}
              </div>
              <div className="text-[10px] text-[#64748B] truncate flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-[#475569]">{user.employee_id || `EMP-${String(user.id).padStart(4, '0')}`}</span>
                {user.team_name && <span>• {user.team_name}</span>}
              </div>
            </div>
            <button
              type="button"
              id="sidebar-logout-btn"
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
              className="p-1.5 text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-md transition shrink-0 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
            {getRoleBadge()}
            <span className="text-[10px] text-[#64748B] font-mono">v1.2</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
