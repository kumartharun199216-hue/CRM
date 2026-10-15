import { useState, useEffect, useCallback } from 'react';
import { User, Lead, PipelineStage, Team, ViewType } from './types';
import { api } from './services/api';
import { Sidebar } from './components/Sidebar';
import { SpreadsheetView } from './components/SpreadsheetView';
import { KanbanView } from './components/KanbanView';
import { RoleDashboard } from './components/RoleDashboard';
import { UnassignedLeadsView } from './components/UnassignedLeadsView';
import { Lead360Page } from './components/Lead360Page';
import { LeadModal } from './components/LeadModal';
import { AssignLeadModal } from './components/AssignLeadModal';
import { LeadHistoryModal } from './components/LeadHistoryModal';
import { CommunicationModal } from './components/CommunicationModal';
import { TemplatesModal } from './components/TemplatesModal';
import { ReportsModal } from './components/ReportsModal';
import { StageManagerModal } from './components/StageManagerModal';
import { ChangeStageModal } from './components/ChangeStageModal';
import { BulkImportModal } from './components/BulkImportModal';
import { BulkImportPage } from './components/BulkImportPage';
import { UserManagementPage } from './components/UserManagementPage';
import { TeamManagementPage } from './components/TeamManagementPage';
import { EmailTemplatesPage } from './components/EmailTemplatesPage';
import { CallHistoryPage } from './components/CallHistoryPage';
import { MyProfilePage } from './components/MyProfilePage';
import { LoginModal } from './components/LoginModal';
import { ChangePasswordPage } from './components/ChangePasswordPage';
import { PasswordResetModal } from './components/PasswordResetModal';
import { AlertCircle, RefreshCw, Table2, Kanban, PlusCircle, FileSpreadsheet, ShieldAlert, FileQuestion } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { TopNavigation } from './components/TopNavigation';
import { NotificationProvider } from './context/NotificationContext';
import { ToastContainer } from './components/ToastContainer';
import { NotificationsPage } from './components/NotificationsPage';

function parseUrlParams() {
  if (typeof window === 'undefined') {
    return {
      view: 'dashboard' as ViewType,
      stage: null,
      page: 1,
      pageSize: 50,
      search: '',
      lead360: null,
      isImport: false,
      resetToken: null,
    };
  }

  const pathname = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  // Check pathname for /leads/:leadId/360 or /leads/:leadId
  let pathnameLead360: string | null = null;
  const pathMatch = pathname.match(/^\/leads\/([^/]+)(?:\/360)?\/?$/i);
  if (pathMatch && pathMatch[1]) {
    pathnameLead360 = decodeURIComponent(pathMatch[1]);
  }

  const rawView = params.get('view');
  const validViews = [
    'dashboard',
    'spreadsheet',
    'kanban',
    'unassigned',
    'import',
    'users',
    'teams',
    'templates',
    'profile',
    'change-password',
    'lead360',
    'calls',
    'notifications',
  ];
  let view: ViewType = 'dashboard';
  const lead360 = pathnameLead360 || params.get('lead360') || null;

  if (pathnameLead360) {
    view = 'lead360';
  } else if (rawView) {
    if (validViews.includes(rawView)) {
      view = rawView as ViewType;
    } else {
      view = 'not_found';
    }
  } else if (lead360) {
    view = 'lead360';
  }

  const rawStage = params.get('stage');
  const stage = rawStage ? (rawStage === 'unassigned' || rawStage === 'null' ? null : Number(rawStage)) : null;

  const rawPage = params.get('page');
  const page = rawPage && !isNaN(Number(rawPage)) ? Math.max(1, Number(rawPage)) : 1;

  const rawPageSize = params.get('page_size');
  const pageSize = rawPageSize && [10, 25, 50, 100].includes(Number(rawPageSize)) ? Number(rawPageSize) : 50;

  const search = params.get('search') || '';
  const isImport = params.get('import') === 'true' || params.get('import') === '1';
  const resetToken = params.get('token') || params.get('reset_token') || null;

  const rawTab = params.get('tab');
  const validTabs = ['overview', 'info', 'timeline', 'communications', 'followup', 'history', 'financial'];
  const tab = rawTab && validTabs.includes(rawTab) ? rawTab : null;

  return { view, stage, page, pageSize, search, lead360, isImport, resetToken, tab };
}

export function App() {
  const initialParams = parseUrlParams();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeView, setActiveView] = useState<ViewType>(initialParams.view);
  const [resetTokenFromUrl, setResetTokenFromUrl] = useState<string | null>(initialParams.resetToken ?? null);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(Boolean(initialParams.resetToken));
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Application Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [stageCounts, setStageCounts] = useState<Record<number, number>>({});
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [unassignedLeads, setUnassignedLeads] = useState<Lead[]>([]);
  const [unassignedCount, setUnassignedCount] = useState<number>(0);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [loadingUnassignedCount, setLoadingUnassignedCount] = useState(false);
  const [selectedStageFilter, setSelectedStageFilter] = useState<number | null>(initialParams.stage);
  const [selectedCounsellorFilter, setSelectedCounsellorFilter] = useState<number | string | null>(null);
  const [selectedQuickFilter, setSelectedQuickFilter] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<ViewType>('spreadsheet');
  const [activeLead360Id, setActiveLead360Id] = useState<string | number | null>(initialParams.lead360);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pagination & Search state
  const [currentPage, setCurrentPage] = useState<number>(initialParams.page);
  const [pageSize, setPageSize] = useState<number>(initialParams.pageSize);
  const [searchQuery, setSearchQuery] = useState<string>(initialParams.search);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(initialParams.isImport);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLeadForEdit, setSelectedLeadForEdit] = useState<Lead | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedLeadForAssign, setSelectedLeadForAssign] = useState<Lead | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedLeadForHistory, setSelectedLeadForHistory] = useState<Lead | null>(null);

  const [isCommModalOpen, setIsCommModalOpen] = useState(false);
  const [selectedLeadForComm, setSelectedLeadForComm] = useState<Lead | null>(null);
  const [commChannel, setCommChannel] = useState<'EMAIL' | 'WHATSAPP' | 'CALL'>('EMAIL');

  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [isStagesModalOpen, setIsStagesModalOpen] = useState(false);

  const [isChangeStageModalOpen, setIsChangeStageModalOpen] = useState(false);
  const [selectedLeadForChangeStage, setSelectedLeadForChangeStage] = useState<Lead | null>(null);

  // Update browser URL query string and pathname without page reload
  const updateUrl = useCallback(
    (
      updates: {
        view?: ViewType;
        stage?: number | null;
        page?: number;
        pageSize?: number;
        search?: string;
        lead360?: number | string | null;
        isImport?: boolean;
        tab?: string | null;
      },
      pushHistory: boolean = false
    ) => {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);

      if (updates.view !== undefined) {
        if (updates.view === 'lead360' && updates.lead360) {
          url.pathname = `/leads/${updates.lead360}/360`;
          url.searchParams.set('view', 'lead360');
          url.searchParams.set('lead360', updates.lead360.toString());
          if (updates.tab) {
            url.searchParams.set('tab', updates.tab);
          }
        } else if (updates.view !== 'dashboard' && updates.view !== 'not_found') {
          url.pathname = '/';
          url.searchParams.set('view', updates.view);
          url.searchParams.delete('lead360');
          url.searchParams.delete('tab');
        } else if (updates.view === 'not_found') {
          url.pathname = '/';
          if (!url.searchParams.has('view')) {
            url.searchParams.set('view', 'unknown');
          }
          url.searchParams.delete('lead360');
          url.searchParams.delete('tab');
        } else {
          url.pathname = '/';
          url.searchParams.delete('view');
          url.searchParams.delete('lead360');
          url.searchParams.delete('tab');
        }
      }

      if (updates.stage !== undefined) {
        if (updates.stage !== null) {
          url.searchParams.set('stage', updates.stage.toString());
        } else {
          url.searchParams.delete('stage');
        }
      }

      if (updates.page !== undefined) {
        if (updates.page > 1) {
          url.searchParams.set('page', updates.page.toString());
        } else {
          url.searchParams.delete('page');
        }
      }

      if (updates.pageSize !== undefined) {
        if (updates.pageSize !== 50) {
          url.searchParams.set('page_size', updates.pageSize.toString());
        } else {
          url.searchParams.delete('page_size');
        }
      }

      if (updates.search !== undefined) {
        if (updates.search.trim()) {
          url.searchParams.set('search', updates.search.trim());
        } else {
          url.searchParams.delete('search');
        }
      }

      if (updates.lead360 !== undefined) {
        if (updates.lead360) {
          url.searchParams.set('lead360', updates.lead360.toString());
        } else {
          url.searchParams.delete('lead360');
        }
      }

      if (updates.isImport !== undefined) {
        if (updates.isImport) {
          url.searchParams.set('import', 'true');
        } else {
          url.searchParams.delete('import');
        }
      }

      if (updates.tab !== undefined) {
        if (updates.tab && updates.tab !== 'overview') {
          url.searchParams.set('tab', updates.tab);
        } else {
          url.searchParams.delete('tab');
        }
      }

      if (pushHistory) {
        window.history.pushState({}, '', url.toString());
      } else {
        window.history.replaceState({}, '', url.toString());
      }
    },
    []
  );

  // Check auth session
  useEffect(() => {
    const token = localStorage.getItem('crm_token');
    if (!token) {
      setLoadingAuth(false);
      return;
    }

    api.getMe()
      .then((user) => {
        setCurrentUser(user);
        if (user.must_change_password) {
          setActiveView('change-password');
          updateUrl({ view: 'change-password' }, false);
        }
      })
      .catch(() => {
        localStorage.removeItem('crm_token');
        setCurrentUser(null);
      })
      .finally(() => setLoadingAuth(false));
  }, [updateUrl]);

  // Fetch CRM data
  const fetchData = useCallback(async () => {
    if (!currentUser || currentUser.must_change_password) return;
    setLoadingData(true);
    setLoadingCounts(true);
    setErrorMessage(null);

    const canAccessUnassigned = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER';
    if (canAccessUnassigned) {
      setLoadingUnassignedCount(true);
    }

    try {
      const fetchUsersPromise = (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER')
        ? api.getUsers().catch(() => api.getUserLookup().catch(() => [] as User[]))
        : api.getUserLookup().catch(() => [] as User[]);

      const [fetchedLeads, fetchedStages, fetchedTeams, fetchedUsers, fetchedCounts, unassignedCountRes] = await Promise.all([
        api.getLeads(),
        api.getStages(),
        api.getTeams().catch(() => [] as Team[]),
        fetchUsersPromise,
        api.getStageCounts().catch(() => ({} as Record<number, number>)),
        canAccessUnassigned ? api.getUnassignedCount().catch(() => ({ count: 0 })) : Promise.resolve({ count: 0 }),
      ]);

      setLeads(fetchedLeads);
      setStages(fetchedStages);
      setTeams(fetchedTeams);
      setUsers(fetchedUsers);
      setStageCounts(fetchedCounts);
      if (canAccessUnassigned && unassignedCountRes) {
        setUnassignedCount(unassignedCountRes.count);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load CRM data');
    } finally {
      setLoadingData(false);
      setLoadingCounts(false);
      setLoadingUnassignedCount(false);
    }
  }, [currentUser]);

  // Fetch Unassigned Queue
  const fetchUnassignedQueue = useCallback(async () => {
    if (!currentUser || currentUser.must_change_password || (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER')) {
      return;
    }
    setLoadingUnassigned(true);
    setLoadingUnassignedCount(true);
    try {
      const [fetchedQueue, countData] = await Promise.all([
        api.getUnassignedLeads(),
        api.getUnassignedCount(),
      ]);
      setUnassignedLeads(fetchedQueue);
      setUnassignedCount(countData.count);
    } catch (err: unknown) {
      console.error('Failed to fetch unassigned queue:', err);
    } finally {
      setLoadingUnassigned(false);
      setLoadingUnassignedCount(false);
    }
  }, [currentUser]);

  // Sync state from popstate (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseUrlParams();
      setActiveView(parsed.view);
      setSelectedStageFilter(parsed.stage);
      setCurrentPage(parsed.page);
      setPageSize(parsed.pageSize);
      setSearchQuery(parsed.search);
      setIsImportModalOpen(parsed.isImport);
      setActiveLead360Id(parsed.lead360);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Authorization validation for import modal
  useEffect(() => {
    if (currentUser) {
      const canAccessAdminModules = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER';
      if (isImportModalOpen && !canAccessAdminModules) {
        setIsImportModalOpen(false);
        updateUrl({ isImport: false });
      }
    }
  }, [currentUser, isImportModalOpen, updateUrl]);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

  useEffect(() => {
    if (currentUser && activeView === 'unassigned') {
      fetchUnassignedQueue();
    }
  }, [currentUser, activeView, fetchUnassignedQueue]);

  const handleLogout = () => {
    localStorage.removeItem('crm_token');
    setCurrentUser(null);
    setLeads([]);
    setStages([]);
    setTeams([]);
    setUsers([]);
    setUnassignedLeads([]);
    setUnassignedCount(0);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleSaveLead = async (data: Partial<Lead>) => {
    if (selectedLeadForEdit) {
      await api.updateLead(selectedLeadForEdit.id, data);
    } else {
      await api.createLead(data);
    }
    await fetchData();
  };

  const handleUpdateLeadStage = async (leadId: number, newStageId: number | null) => {
    try {
      await api.updateLead(leadId, { stage: newStageId });
      await fetchData();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update pipeline stage');
    }
  };

  const handleOpenLead = (lead: Lead) => {
    handleOpen360(lead);
  };

  const handleOpen360 = useCallback((leadOrId: Lead | string | number) => {
    setPreviousView((prev) => (prev !== 'lead360' ? prev : 'spreadsheet'));
    const id = typeof leadOrId === 'object' && leadOrId !== null ? leadOrId.id : leadOrId;
    setActiveLead360Id(id);
    setActiveView('lead360');
    updateUrl({ view: 'lead360', lead360: id }, true);
  }, [updateUrl]);

  const handleLeadUpdated = useCallback((updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }, []);

  const handleBackFrom360 = useCallback(() => {
    const returnView = previousView && previousView !== 'lead360' ? previousView : 'spreadsheet';
    setActiveView(returnView);
    setActiveLead360Id(null);
    updateUrl({ view: returnView, lead360: null, tab: null }, true);
  }, [previousView, updateUrl]);

  const handleAssignLead = async (leadId: number, employeeId: number) => {
    try {
      await api.updateLead(leadId, { assigned_employee: employeeId });
      await fetchData();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reassign student lead');
    }
  };

  const handleOpenHistory = (lead: Lead) => {
    setSelectedLeadForHistory(lead);
    setIsHistoryModalOpen(true);
  };

  const handleCommunicate = (lead: Lead, channel: 'EMAIL' | 'WHATSAPP' | 'CALL') => {
    setSelectedLeadForComm(lead);
    setCommChannel(channel);
    setIsCommModalOpen(true);
  };

  const handleOpenChangeStage = (lead: Lead) => {
    setSelectedLeadForChangeStage(lead);
    setIsChangeStageModalOpen(true);
  };

  const handleStageChangeSuccess = async (updatedLead: Lead) => {
    // 1. Update lead in active leads list
    setLeads((prev) => prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)));


    // 3. Refresh pipeline stage counts
    try {
      const counts = await api.getStageCounts();
      setStageCounts(counts);

      if (currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER') {
        const unassignedRes = await api.getUnassignedCount();
        setUnassignedCount(unassignedRes.count);
      }
    } catch {
      // non-fatal
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-xs text-slate-400 font-medium animate-pulse">Initializing Skill Move CRM...</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <ThemeProvider>
        <LoginModal
          onSuccess={(user) => {
            setCurrentUser(user);
            if (user.must_change_password) {
              setActiveView('change-password');
              updateUrl({ view: 'change-password' }, true);
            }
          }}
          onForgotPassword={() => setIsResetModalOpen(true)}
        />
        <PasswordResetModal
          isOpen={isResetModalOpen}
          initialToken={resetTokenFromUrl}
          onClose={() => {
            setIsResetModalOpen(false);
            setResetTokenFromUrl(null);
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.delete('token');
              url.searchParams.delete('reset_token');
              window.history.replaceState({}, '', url.toString());
            }
          }}
          onSuccess={(user, token) => {
            setIsResetModalOpen(false);
            setResetTokenFromUrl(null);
            localStorage.setItem('crm_token', token);
            setCurrentUser(user);
            setActiveView('dashboard');
            updateUrl({ view: 'dashboard' }, true);
          }}
        />
      </ThemeProvider>
    );
  }

  if (currentUser.must_change_password) {
    return (
      <ThemeProvider>
        <ChangePasswordPage
          user={currentUser}
          onPasswordChanged={(updatedUser, newToken) => {
            localStorage.setItem('crm_token', newToken);
            setCurrentUser(updatedUser);
            setActiveView('dashboard');
            updateUrl({ view: 'dashboard' }, true);
          }}
          onLogout={handleLogout}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <NotificationProvider isAuthenticated={Boolean(currentUser)}>
        <ToastContainer
          onNavigate={(url) => {
            if (url.startsWith('/?view=')) {
              const parsed = new URLSearchParams(url.replace('/?', ''));
              const v = parsed.get('view') as ViewType;
              const l360 = parsed.get('lead360');
              if (l360) {
                handleOpen360(l360);
              } else if (v) {
                setActiveView(v);
                updateUrl({ view: v }, true);
              }
            } else {
              window.location.href = url;
            }
          }}
        />
        <div className="min-h-screen bg-[#F5F7FB] dark:bg-[#0B1120] text-[#0F172A] dark:text-[#F8FAFC] flex font-sans transition-colors duration-200">
          {/* Left-Side Navigation Menu */}
          <Sidebar
          user={currentUser}
          activeView={activeView}
          onViewChange={(view) => {
            setActiveView(view);
            setSelectedStageFilter(null);
            setCurrentPage(1);
            updateUrl({ view, stage: null, page: 1 }, true);
          }}
          stages={stages}
          stageCounts={stageCounts}
          countsLoading={loadingCounts}
          unassignedCount={unassignedCount}
          unassignedCountLoading={loadingUnassignedCount}
          selectedStageId={selectedStageFilter}
          onSelectStage={(stageId) => {
            setSelectedStageFilter(stageId);
            setCurrentPage(1);
            const targetView: ViewType = activeView === 'kanban' ? 'kanban' : 'spreadsheet';
            setActiveView(targetView);
            updateUrl({ view: targetView, stage: stageId, page: 1 }, true);
          }}
          onOpenCreateLead={() => {
            setSelectedLeadForEdit(null);
            setIsLeadModalOpen(true);
          }}
          onOpenReports={() => setIsReportsModalOpen(true)}
          onOpenTemplates={() => setIsTemplatesModalOpen(true)}
          onOpenStages={() => setIsStagesModalOpen(true)}
          onLogout={handleLogout}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Area on Right */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto bg-[#F8FAFC] dark:bg-[#0F172A] transition-colors duration-200">
          {/* Global Top Navigation Bar */}
          <TopNavigation
            user={currentUser}
            onViewChange={(view) => {
              setActiveView(view);
              setSelectedStageFilter(null);
              setCurrentPage(1);
              updateUrl({ view, stage: null, page: 1 }, true);
            }}
            onLogout={handleLogout}
            searchQuery={searchQuery}
            onSearchChange={(newSearch) => {
              setSearchQuery(newSearch);
              setCurrentPage(1);
              updateUrl({ search: newSearch, page: 1 });
            }}
            onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          />

          <main className={activeView === 'lead360' ? "w-full min-h-full" : "p-4 sm:p-6 space-y-6 max-w-7xl w-full mx-auto"}>
            {errorMessage && (
              <div className="p-3.5 bg-[#FEF2F2] dark:bg-[#7F1D1D]/20 border border-[#FECACA] dark:border-[#991B1B] rounded-xl text-xs text-[#DC2626] dark:text-[#FCA5A5] flex items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#DC2626] dark:text-[#FCA5A5] shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchData}
                  className="text-xs text-[#DC2626] dark:text-[#FCA5A5] underline hover:no-underline font-medium cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Horizontal Top Menu / Header Bar */}
            {activeView !== 'import' && activeView !== 'users' && activeView !== 'teams' && activeView !== 'templates' && activeView !== 'profile' && activeView !== 'not_found' && activeView !== 'lead360' && activeView !== 'calls' && !(currentUser.role === 'SALES_EMPLOYEE' && activeView === 'unassigned') && (
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] dark:border-[#334155] pb-4">
                {/* Left & Center: Title + Pipeline View Switcher (Spreadsheet vs Kanban) */}
                <div className="flex flex-wrap items-center gap-4 min-w-0">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC] m-0">
                        {activeView === 'dashboard'
                          ? `${currentUser.role === 'ADMIN' ? 'Executive Admin' : currentUser.role === 'MANAGER' ? 'Admissions Manager' : 'Career Counsellor'} Dashboard`
                          : activeView === 'unassigned'
                            ? 'Unassigned Leads Queue'
                            : selectedStageFilter
                              ? `${stages.find((s) => s.id === selectedStageFilter)?.name || 'Stage'} Pipeline`
                              : 'Pipeline Stages'}
                      </h2>
                      {selectedStageFilter && activeView !== 'dashboard' && activeView !== 'unassigned' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStageFilter(null);
                            setCurrentPage(1);
                            updateUrl({ stage: null, page: 1 }, true);
                          }}
                          className="text-[11px] font-medium text-[#2563EB] hover:text-[#1E3A8A] bg-[#EFF6FF] border border-[#BFDBFE] dark:bg-[#172554] dark:border-[#1E40AF] dark:text-[#60A5FA] px-2.5 py-0.5 rounded-full transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          title="Clear stage filter and view all stages"
                        >
                          <span>All Stages</span>
                          <span className="text-[#64748B] dark:text-[#94A3B8] font-bold hover:text-[#0F172A] dark:hover:text-white">×</span>
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium m-0 truncate mt-0.5">
                      {activeView === 'dashboard'
                        ? 'Role-tailored metrics, pipeline progression, team performance, and prioritized student follow-ups'
                        : activeView === 'unassigned'
                          ? 'Incoming student inquiries awaiting assignment to counsellors or managers'
                          : selectedStageFilter
                            ? `Showing student leads in the "${stages.find((s) => s.id === selectedStageFilter)?.name}" stage`
                            : '12-stage admissions pipeline, student operations, and stage transitions'}
                    </p>
                  </div>

                  {/* Pipeline Stages View Switcher: Spreadsheet View vs Kanban Pipeline */}
                  {activeView !== 'dashboard' && activeView !== 'unassigned' && (
                    <div className="flex items-center bg-white dark:bg-[#172033] p-1 rounded-lg border border-[#E2E8F0] dark:border-[#334155] shadow-xs">
                      <button
                        type="button"
                        id="view-toggle-spreadsheet"
                        onClick={() => {
                          setActiveView('spreadsheet');
                          updateUrl({ view: 'spreadsheet' }, true);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${activeView === 'spreadsheet'
                          ? 'crm-btn-primary'
                          : 'text-[#64748B] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                          }`}
                      >
                        <Table2 className="w-3.5 h-3.5" />
                        <span>Spreadsheet View</span>
                      </button>
                      <button
                        type="button"
                        id="view-toggle-kanban"
                        onClick={() => {
                          setActiveView('kanban');
                          updateUrl({ view: 'kanban' }, true);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${activeView === 'kanban'
                          ? 'crm-btn-primary'
                          : 'text-[#64748B] dark:text-[#CBD5E1] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]'
                          }`}
                      >
                        <Kanban className="w-3.5 h-3.5" />
                        <span>Kanban Pipeline</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Side: Horizontal Top Menu Actions: Import Leads, Templates, New Lead, and Refresh */}
                <div className="flex items-center gap-2.5">
                  {(currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') && (
                    <button
                      type="button"
                      id="top-menu-import-leads-btn"
                      onClick={() => {
                        setActiveView('import');
                        setSelectedStageFilter(null);
                        updateUrl({ view: 'import', stage: null }, true);
                      }}
                      className="crm-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Bulk Import Leads from CSV or Excel"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Import Leads</span>
                    </button>
                  )}

                  {(currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') && (
                    <button
                      type="button"
                      id="top-menu-templates-btn"
                      onClick={() => setIsTemplatesModalOpen(true)}
                      className="crm-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      title="Communication Templates"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
                      <span>Templates</span>
                    </button>
                  )}

                  {(currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') && (
                    <button
                      type="button"
                      id="top-menu-new-lead-btn"
                      onClick={() => {
                        setSelectedLeadForEdit(null);
                        setIsLeadModalOpen(true);
                      }}
                      className="crm-btn-primary px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Add New Student Lead"
                    >
                      <PlusCircle className="w-4 h-4 text-white" />
                      <span>New Lead</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      fetchData();
                      if (activeView === 'unassigned') {
                        fetchUnassignedQueue();
                      }
                    }}
                    disabled={loadingData || loadingUnassigned}
                    className="crm-btn-secondary px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Refresh lead records"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${(loadingData || loadingUnassigned) ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            )}

            {/* Active View Render */}
            {((currentUser.role === 'SALES_EMPLOYEE' && (activeView === 'unassigned' || activeView === 'import' || activeView === 'users' || activeView === 'teams' || activeView === 'templates')) ||
              (currentUser.role === 'MANAGER' && activeView === 'teams')) ? (
              <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-12 text-center shadow-xs">
                <div className="w-12 h-12 rounded-full bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 text-[#DC2626] dark:text-[#F87171] mx-auto flex items-center justify-center mb-4">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-2">Access Restricted (403)</h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto mb-6">
                  You do not have administrative authorization to access the {activeView === 'import' ? 'Bulk Lead Import' : activeView === 'users' ? 'User Management' : activeView === 'teams' ? 'Team Management' : activeView === 'templates' ? 'Email Template Management' : 'Unassigned Leads Queue'} module.
                </p>
                <button
                  type="button"
                  id="btn-access-denied-dashboard"
                  onClick={() => {
                    setActiveView('dashboard');
                    setSelectedStageFilter(null);
                    updateUrl({ view: 'dashboard', stage: null }, true);
                  }}
                  className="crm-btn-primary px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Return to My Dashboard
                </button>
              </div>
            ) : activeView === 'not_found' ? (
              <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-12 text-center shadow-xs">
                <div className="w-12 h-12 rounded-full bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] mx-auto flex items-center justify-center mb-4">
                  <FileQuestion className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-2">Page Not Found (404)</h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto mb-6">
                  The requested CRM navigation destination or route does not exist.
                </p>
                <button
                  type="button"
                  id="btn-not-found-dashboard"
                  onClick={() => {
                    setActiveView('dashboard');
                    setSelectedStageFilter(null);
                    updateUrl({ view: 'dashboard', stage: null }, true);
                  }}
                  className="crm-btn-primary px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : activeView === 'dashboard' ? (
              <RoleDashboard
                currentUser={currentUser}
                leads={leads}
                stages={stages}
                teams={teams}
                users={users}
                onSelectStage={(stageId) => {
                  setSelectedStageFilter(stageId);
                  setSelectedQuickFilter(null);
                  setSelectedCounsellorFilter(null);
                  setActiveView('spreadsheet');
                  setCurrentPage(1);
                  updateUrl({ view: 'spreadsheet', stage: stageId, page: 1 }, true);
                }}
                onOpenLead={handleOpenLead}
                onOpen360={handleOpen360}
                onCommunicate={handleCommunicate}
                onViewAllLeads={() => {
                  setSelectedStageFilter(null);
                  setSelectedQuickFilter(null);
                  setSelectedCounsellorFilter(null);
                  setActiveView('spreadsheet');
                  setCurrentPage(1);
                  updateUrl({ view: 'spreadsheet', stage: null, page: 1 }, true);
                }}
                onDrillDownEmployee={(employeeId) => {
                  setSelectedCounsellorFilter(employeeId);
                  setSelectedQuickFilter(null);
                  setSelectedStageFilter(null);
                  setActiveView('spreadsheet');
                  setCurrentPage(1);
                  updateUrl({ view: 'spreadsheet', stage: null, page: 1 }, true);
                }}
                onDrillDownQuickFilter={(filterKey, stageId) => {
                  setSelectedQuickFilter(filterKey);
                  setSelectedStageFilter(stageId !== undefined ? stageId : null);
                  setSelectedCounsellorFilter(null);
                  setActiveView('spreadsheet');
                  setCurrentPage(1);
                  updateUrl({ view: 'spreadsheet', stage: stageId !== undefined ? stageId : null, page: 1 }, true);
                }}
                onOpenCreateLead={() => {
                  setSelectedLeadForEdit(null);
                  setIsLeadModalOpen(true);
                }}
                onOpenUnassignedLeads={() => {
                  setActiveView('unassigned');
                  setSelectedStageFilter(null);
                  setSelectedQuickFilter(null);
                  setSelectedCounsellorFilter(null);
                  updateUrl({ view: 'unassigned', stage: null }, true);
                }}
                onOpenReports={() => setIsReportsModalOpen(true)}
                onOpenStages={() => setIsStagesModalOpen(true)}
                onOpenAssignLead={(lead) => {
                  setSelectedLeadForAssign(lead);
                  setIsAssignModalOpen(true);
                }}
              />
            ) : activeView === 'unassigned' ? (
              <UnassignedLeadsView
                leads={unassignedLeads}
                stages={stages}
                teams={teams}
                currentUser={currentUser}
                loading={loadingUnassigned}
                onRefresh={fetchUnassignedQueue}
                onAssignLead={(lead) => {
                  setSelectedLeadForAssign(lead);
                  setIsAssignModalOpen(true);
                }}
                onOpen360={handleOpen360}
                onCommunicate={handleCommunicate}
                onOpenCreateUnassigned={() => {
                  setSelectedLeadForEdit(null);
                  setIsLeadModalOpen(true);
                }}
              />
            ) : activeView === 'import' ? (
              <BulkImportPage
                currentUser={currentUser}
                stages={stages}
                teams={teams}
                users={users}
                onNavigateToPipeline={(stageId) => {
                  setSelectedStageFilter(stageId ?? null);
                  setActiveView('spreadsheet');
                  setCurrentPage(1);
                  updateUrl({ view: 'spreadsheet', stage: stageId ?? null, page: 1 }, true);
                }}
                onRefreshCrmData={async () => {
                  await Promise.all([fetchData(), fetchUnassignedQueue()]);
                }}
              />
            ) : activeView === 'users' ? (
              <UserManagementPage
                currentUser={currentUser}
                teams={teams}
                onRefreshData={async () => {
                  await Promise.all([fetchData(), fetchUnassignedQueue()]);
                }}
              />
            ) : activeView === 'teams' ? (
              <TeamManagementPage
                currentUser={currentUser}
                onRefreshData={async () => {
                  await Promise.all([fetchData(), fetchUnassignedQueue()]);
                }}
              />
            ) : activeView === 'templates' ? (
              <EmailTemplatesPage
                currentUser={currentUser}
              />
            ) : activeView === 'calls' ? (
              <CallHistoryPage
                currentUser={currentUser}
                users={users}
                onOpen360={handleOpen360}
                onOpenCreateLeadWithNumber={(phoneNum) => {
                  setSelectedLeadForEdit({ phone: phoneNum } as any);
                  setIsLeadModalOpen(true);
                }}
              />
            ) : activeView === 'notifications' ? (
              <NotificationsPage
                onNavigate={(url) => {
                  if (url.startsWith('/?view=')) {
                    const parsed = new URLSearchParams(url.replace('/?', ''));
                    const v = parsed.get('view') as ViewType;
                    const l360 = parsed.get('lead360');
                    if (l360) {
                      handleOpen360(l360);
                    } else if (v) {
                      setActiveView(v);
                      updateUrl({ view: v }, true);
                    }
                  } else {
                    window.location.href = url;
                  }
                }}
                onViewChange={(v) => {
                  setActiveView(v);
                  updateUrl({ view: v }, true);
                }}
              />
            ) : activeView === 'profile' ? (
              <MyProfilePage
                currentUser={currentUser}
                onProfileUpdated={(updatedUser) => {
                  setCurrentUser(updatedUser);
                }}
                onNavigateToChangePassword={() => {
                  setActiveView('change-password');
                  updateUrl({ view: 'change-password' }, true);
                }}
              />
            ) : activeView === 'change-password' ? (
              <ChangePasswordPage
                user={currentUser}
                onPasswordChanged={(updatedUser, newToken) => {
                  localStorage.setItem('crm_token', newToken);
                  setCurrentUser(updatedUser);
                  setActiveView('profile');
                  updateUrl({ view: 'profile' }, true);
                }}
                onCancel={() => {
                  setActiveView('profile');
                  updateUrl({ view: 'profile' }, true);
                }}
                onLogout={handleLogout}
              />
            ) : activeView === 'lead360' ? (
              <Lead360Page
                leadId={activeLead360Id || ''}
                currentUser={currentUser}
                stages={stages}
                teams={teams}
                users={users}
                onBack={handleBackFrom360}
                onCommunicate={handleCommunicate}
                onLeadUpdated={handleLeadUpdated}
                initialTab={(initialParams.tab as any) || undefined}
              />
            ) : activeView === 'spreadsheet' ? (
              <SpreadsheetView
                leads={leads}
                stages={stages}
                users={users}
                currentUser={currentUser}
                selectedStageId={selectedStageFilter}
                initialCounsellorId={selectedCounsellorFilter}
                quickFilter={selectedQuickFilter}
                onClearQuickFilter={() => setSelectedQuickFilter(null)}
                onOpenLead={handleOpenLead}
                onOpen360={handleOpen360}
                onOpenHistory={handleOpenHistory}
                onCommunicate={handleCommunicate}
                onAssignLead={handleAssignLead}
                onChangeStage={handleOpenChangeStage}
                onOpenImport={() => {
                  setActiveView('import');
                  setSelectedStageFilter(null);
                  updateUrl({ view: 'import', stage: null }, true);
                }}
                initialPageSize={pageSize}
                initialPageIndex={currentPage}
                initialSearch={searchQuery}
                onPaginationChange={(newPage, newPageSize) => {
                  setCurrentPage(newPage);
                  setPageSize(newPageSize);
                  updateUrl({ page: newPage, pageSize: newPageSize });
                }}
                onSearchChange={(newSearch) => {
                  setSearchQuery(newSearch);
                  setCurrentPage(1);
                  updateUrl({ search: newSearch, page: 1 });
                }}
                onStageChange={(newStage) => {
                  const stageVal = newStage === 'ALL' || newStage === 'UNASSIGNED' ? null : Number(newStage);
                  setSelectedStageFilter(stageVal);
                  setCurrentPage(1);
                  updateUrl({ stage: stageVal, page: 1 }, true);
                }}
              />
            ) : (
              <KanbanView
                leads={leads}
                stages={stages}
                currentUser={currentUser}
                onUpdateLeadStage={handleUpdateLeadStage}
                onOpenLead={handleOpenLead}
                onOpenHistory={handleOpenHistory}
                onCommunicate={handleCommunicate}
                onOpenStageManager={() => setIsStagesModalOpen(true)}
              />
            )}
          </main>
        </div>

        {/* Modals */}
        <BulkImportModal
          isOpen={isImportModalOpen}
          currentUser={currentUser}
          onClose={() => {
            setIsImportModalOpen(false);
            updateUrl({ isImport: false });
          }}
          onImportComplete={async () => {
            await Promise.all([fetchData(), fetchUnassignedQueue()]);
          }}
        />

        <AssignLeadModal
          lead={selectedLeadForAssign}
          isOpen={isAssignModalOpen}
          users={users}
          teams={teams}
          currentUser={currentUser}
          onClose={() => {
            setIsAssignModalOpen(false);
            setSelectedLeadForAssign(null);
          }}
          onAssignSuccess={async () => {
            await Promise.all([
              fetchUnassignedQueue(),
              fetchData(),
            ]);
          }}
        />

        <LeadModal
          lead={selectedLeadForEdit}
          isOpen={isLeadModalOpen}
          teams={teams}
          users={users}
          stages={stages}
          currentUser={currentUser}
          onClose={() => setIsLeadModalOpen(false)}
          onSave={handleSaveLead}
        />


        <LeadHistoryModal
          lead={selectedLeadForHistory}
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
        />

        <CommunicationModal
          lead={selectedLeadForComm}
          initialChannel={commChannel}
          isOpen={isCommModalOpen}
          onClose={() => setIsCommModalOpen(false)}
        />

        <TemplatesModal
          isOpen={isTemplatesModalOpen}
          currentUser={currentUser}
          onClose={() => setIsTemplatesModalOpen(false)}
        />

        <ReportsModal
          isOpen={isReportsModalOpen}
          onClose={() => setIsReportsModalOpen(false)}
        />

        <StageManagerModal
          stages={stages}
          isOpen={isStagesModalOpen}
          onClose={() => setIsStagesModalOpen(false)}
          onRefresh={fetchData}
        />

        <ChangeStageModal
          lead={selectedLeadForChangeStage}
          isOpen={isChangeStageModalOpen}
          stages={stages}
          onClose={() => {
            setIsChangeStageModalOpen(false);
            setSelectedLeadForChangeStage(null);
          }}
          onSuccess={handleStageChangeSuccess}
        />
      </div>
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
