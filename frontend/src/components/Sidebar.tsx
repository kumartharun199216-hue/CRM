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
  Mail,
  PhoneCall,
  Bell,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
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
  { id: 9, name: 'Pending Closure', order: 9, is_active: true },
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
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { unreadCount } = useNotifications();
  const isPipelineActive = activeView === 'spreadsheet' || activeView === 'kanban';
  const [isPipelineExpanded, setIsPipelineExpanded] = useState(Boolean(selectedStageId));
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed((prev) => !prev));

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
  const canManageTemplates = isAdmin || isManager;

  const activeStages = stages && stages.length > 0
    ? [...stages].filter((s) => s.is_active).sort((a, b) => a.order - b.order)
    : DEFAULT_12_STAGES;

  const getRoleBadge = () => {
    switch (user.role) {
      case 'ADMIN':
        return (
          <span className="crm-pill crm-pill-purple">
            <Shield className="w-3 h-3 text-[#7C3AED] dark:text-[#D8B4FE]" /> Admin
          </span>
        );
      case 'MANAGER':
        return (
          <span className="crm-pill crm-pill-blue">
            <Briefcase className="w-3 h-3 text-[#2563EB] dark:text-[#60A5FA]" /> Manager
          </span>
        );
      case 'SALES_EMPLOYEE':
        return (
          <span className="crm-pill bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] dark:bg-[#172554] dark:text-[#60A5FA] dark:border-[#1E40AF]">
            <GraduationCap className="w-3 h-3 text-[#2563EB] dark:text-[#60A5FA]" /> Counsellor
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
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close navigation overlay"
          onClick={onCloseMobile}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') onCloseMobile?.();
          }}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden transition-opacity cursor-pointer"
        />
      )}

      {/* Main Sidebar Shell */}
      <aside
        className={`fixed md:sticky top-0 h-screen z-50 md:z-20 bg-white dark:bg-[#0B1120] border-r border-[#E2E8F0] dark:border-[#334155] flex flex-col justify-between shrink-0 select-none font-sans transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'
          } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
      >
        {/* Top Branding & Collapse Button */}
        <div className="overflow-y-auto flex-1">
          <div className="p-4 border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-white shadow-sm shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 animate-in fade-in duration-200">
                  <h1 className="text-base font-extrabold tracking-tight leading-tight m-0 truncate text-[#0F172A] dark:text-[#F8FAFC]">
                    Skill Move
                  </h1>
                  <p className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8] m-0 truncate tracking-wide">
                    Sales CRM
                  </p>
                </div>
              )}
            </div>

            {/* Collapse / Expand Toggle Button (Desktop) */}
            <button
              type="button"
              id="sidebar-collapse-toggle-btn"
              onClick={toggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:flex w-7 h-7 rounded-lg items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors cursor-pointer"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Menu */}
          <div className="p-3 space-y-5">
            {/* Main Views Section */}
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                  Views
                </div>
              )}

              {/* Dashboard */}
              <button
                type="button"
                id="sidebar-dashboard-nav-item"
                onClick={() => {
                  onViewChange('dashboard');
                  onCloseMobile?.();
                }}
                title={isCollapsed ? 'Dashboard' : undefined}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
                  } py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeView === 'dashboard'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                  }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                {!isCollapsed && (
                  <span className="truncate">
                    {user.role === 'ADMIN' ? 'Admin Dashboard' : user.role === 'MANAGER' ? 'Manager Dashboard' : 'My Dashboard'}
                  </span>
                )}
              </button>

              {/* Unassigned Leads */}
              {canViewUnassigned && (
                <button
                  type="button"
                  id="unassigned-leads-nav-item"
                  onClick={() => {
                    onViewChange('unassigned');
                    onCloseMobile?.();
                  }}
                  title={isCollapsed ? 'Unassigned Leads' : undefined}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2 relative' : 'justify-between px-3'
                    } py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeView === 'unassigned'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserX className={`w-4 h-4 shrink-0 ${activeView === 'unassigned' ? 'text-white' : 'text-[#D97706]'}`} />
                    {!isCollapsed && <span className="truncate">Unassigned Leads</span>}
                  </div>
                  {!isCollapsed ? (
                    <span
                      id="unassigned-count-badge"
                      className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] shrink-0 transition-all ${activeView === 'unassigned'
                          ? 'bg-white/20 text-white font-bold'
                          : (unassignedCount ?? 0) > 0
                            ? 'crm-pill-warning font-bold'
                            : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#334155]'
                        }`}
                    >
                      {unassignedCountLoading ? '…' : (unassignedCount ?? 0)}
                    </span>
                  ) : (unassignedCount ?? 0) > 0 ? (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#D97706]" />
                  ) : null}
                </button>
              )}

              {/* Call History (Callyzer Telephony) */}
              <button
                type="button"
                id="sidebar-call-history-nav-item"
                onClick={() => {
                  onViewChange('calls');
                  onCloseMobile?.();
                }}
                title={isCollapsed ? 'Call History' : undefined}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
                  } py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeView === 'calls'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                  }`}
              >
                <PhoneCall className={`w-4 h-4 shrink-0 ${activeView === 'calls' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
                {!isCollapsed && <span className="truncate">Call History</span>}
              </button>

              {/* Notifications Center */}
              <button
                type="button"
                id="sidebar-notifications-nav-item"
                onClick={() => {
                  onViewChange('notifications');
                  onCloseMobile?.();
                }}
                title={isCollapsed ? (unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications') : undefined}
                className={`w-full flex items-center relative ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                  } py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeView === 'notifications'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Bell className={`w-4 h-4 shrink-0 ${activeView === 'notifications' ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
                  {!isCollapsed && <span className="truncate">Notifications</span>}
                </div>
                {!isCollapsed && unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#DC2626] text-white leading-none flex items-center justify-center min-w-[18px] h-[18px]">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {isCollapsed && unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DC2626]" />
                )}
              </button>

              {/* Bulk Import Leads */}
              {canImport && (
                <button
                  type="button"
                  id="sidebar-import-nav-item"
                  onClick={() => {
                    onViewChange('import');
                    onCloseMobile?.();
                  }}
                  title={isCollapsed ? 'Import Leads' : undefined}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
                    } py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeView === 'import'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                    }`}
                >
                  <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeView === 'import' ? 'text-white' : 'text-[#2563EB]'}`} />
                  {!isCollapsed && <span className="truncate">Import Leads</span>}
                </button>
              )}

              {/* Users */}
              {canViewUsers && (
                <button
                  type="button"
                  id="sidebar-users-nav-item"
                  onClick={() => {
                    onViewChange('users');
                    onCloseMobile?.();
                  }}
                  title={isCollapsed ? 'Users' : undefined}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
                    } py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeView === 'users'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                    }`}
                >
                  <Users className={`w-4 h-4 shrink-0 ${activeView === 'users' ? 'text-white' : 'text-[#2563EB]'}`} />
                  {!isCollapsed && <span className="truncate">Users</span>}
                </button>
              )}

              {/* Teams (Admin Only) */}
              {isAdmin && (
                <button
                  type="button"
                  id="sidebar-teams-nav-item"
                  onClick={() => {
                    onViewChange('teams');
                    onCloseMobile?.();
                  }}
                  title={isCollapsed ? 'Teams' : undefined}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
                    } py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeView === 'teams'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                    }`}
                >
                  <Building className={`w-4 h-4 shrink-0 ${activeView === 'teams' ? 'text-white' : 'text-[#7C3AED]'}`} />
                  {!isCollapsed && <span className="truncate">Teams</span>}
                </button>
              )}

              {/* Email Templates */}
              {canManageTemplates && (
                <button
                  type="button"
                  id="sidebar-templates-nav-item"
                  onClick={() => {
                    onViewChange('templates');
                    onCloseMobile?.();
                  }}
                  title={isCollapsed ? 'Email Templates' : undefined}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
                    } py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeView === 'templates'
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                    }`}
                >
                  <Mail className={`w-4 h-4 shrink-0 ${activeView === 'templates' ? 'text-white' : 'text-[#2563EB]'}`} />
                  {!isCollapsed && <span className="truncate">Email Templates</span>}
                </button>
              )}

              {/* My Profile */}
              <button
                type="button"
                id="sidebar-profile-nav-item"
                onClick={() => {
                  onViewChange('profile');
                  onCloseMobile?.();
                }}
                title={isCollapsed ? 'My Profile' : undefined}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
                  } py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeView === 'profile'
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                  }`}
              >
                <UserCircle className={`w-4 h-4 shrink-0 ${activeView === 'profile' ? 'text-white' : 'text-[#2563EB]'}`} />
                {!isCollapsed && <span className="truncate">My Profile</span>}
              </button>
            </div>

            {/* Pipeline Stages Section */}
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                  Pipeline
                </div>
              )}
              <button
                type="button"
                id="pipeline-stages-trigger"
                onClick={handleTogglePipeline}
                onKeyDown={handleKeyDownPipeline}
                aria-expanded={isPipelineExpanded}
                aria-controls="pipeline-stages-submenu"
                title={isCollapsed ? `Pipeline Stages (${activeStages.length})` : undefined}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                  } py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${isPipelineActive
                    ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] dark:bg-[#172554] dark:text-[#60A5FA] dark:border-[#1E40AF]'
                    : 'text-[#475569] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Layers className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
                  {!isCollapsed && <span className="truncate">Pipeline Stages ({activeStages.length})</span>}
                </div>
                {!isCollapsed && (
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8] transition-transform duration-200 shrink-0 ${isPipelineExpanded ? 'rotate-180 text-[#2563EB] dark:text-[#60A5FA]' : ''
                      }`}
                  />
                )}
              </button>

              {/* Submenu with Smooth Transition */}
              {!isCollapsed && (
                <div
                  id="pipeline-stages-submenu"
                  role="region"
                  aria-labelledby="pipeline-stages-trigger"
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${isPipelineExpanded ? 'max-h-[600px] opacity-100 mt-1' : 'max-h-0 opacity-0 pointer-events-none'
                    }`}
                >
                  <div className="pl-3 pr-1 py-1 space-y-0.5 border-l border-[#E2E8F0] dark:border-[#334155] ml-4">
                    <button
                      type="button"
                      id="pipeline-all-stages-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelectStage?.(null);
                        onCloseMobile?.();
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] transition text-left group cursor-pointer ${isPipelineActive && selectedStageId === null
                          ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold border border-[#BFDBFE] dark:bg-[#172554] dark:text-[#60A5FA] dark:border-[#1E40AF]'
                          : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                        }`}
                    >
                      <span className="truncate mr-2 font-medium">All Pipeline Stages</span>
                      <span className="px-1.5 py-0.2 rounded-md font-mono text-[10px] bg-[#F1F5F9] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#334155] shrink-0">
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
                            onCloseMobile?.();
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] transition text-left group cursor-pointer ${isSelected
                              ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold border border-[#BFDBFE] dark:bg-[#172554] dark:text-[#60A5FA] dark:border-[#1E40AF]'
                              : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                            }`}
                        >
                          <span className="truncate mr-2">{st.name}</span>
                          <span className="px-1.5 py-0.2 rounded-md font-mono text-[10px] bg-[#F1F5F9] dark:bg-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#334155] shrink-0">
                            {countsLoading ? '…' : count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Admin Tools Section */}
            {isAdmin && !isCollapsed && (
              <div className="space-y-1">
                <div className="px-3 text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                  Administration
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onOpenReports();
                    onCloseMobile?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-[#7C3AED] dark:text-[#D8B4FE] shrink-0" />
                  <span>Scheduled Reports</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenStages();
                    onCloseMobile?.();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition cursor-pointer"
                >
                  <Settings2 className="w-4 h-4 text-[#64748B] dark:text-[#94A3B8] shrink-0" />
                  <span>Configure Stages</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Profile and Sign Out Card */}
        <div className="p-3 border-t border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827] shrink-0">
          {!isCollapsed ? (
            <div
              id="sidebar-user-profile-card"
              onClick={() => {
                onViewChange('profile');
                onCloseMobile?.();
              }}
              title="Click to view My Profile"
              className={`p-3 bg-white dark:bg-[#172033] rounded-lg space-y-2.5 border transition cursor-pointer hover:border-[#2563EB]/40 dark:hover:border-[#60A5FA]/40 hover:shadow-xs group ${activeView === 'profile'
                  ? 'border-[#2563EB] ring-2 ring-[#2563EB]/20 bg-[#EFF6FF]/20 dark:border-[#60A5FA] dark:bg-[#172554]/30'
                  : 'border-[#E2E8F0] dark:border-[#334155]'
                }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] transition-colors truncate">
                    {user.full_name || user.email || user.username}
                  </div>
                  <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] truncate flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[#475569] dark:text-[#CBD5E1]">
                      {user.employee_id || `EMP-${String(user.id).padStart(4, '0')}`}
                    </span>
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
                  className="p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#DC2626] dark:hover:text-[#EF4444] hover:bg-[#FEF2F2] dark:hover:bg-[#7F1D1D]/30 rounded-md transition shrink-0 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0] dark:border-[#273449]">
                {getRoleBadge()}
                <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-mono">v1.2</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                id="sidebar-user-profile-card"
                onClick={() => onViewChange('profile')}
                title={user.full_name || user.username}
                className="w-10 h-10 rounded-lg bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] text-white flex items-center justify-center font-bold text-xs shadow-xs cursor-pointer"
              >
                {(user.full_name || user.username).slice(0, 2).toUpperCase()}
              </button>
              <button
                type="button"
                id="sidebar-logout-btn"
                onClick={onLogout}
                className="p-2 text-[#64748B] dark:text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#7F1D1D]/30 rounded-md transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
