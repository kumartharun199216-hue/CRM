import React, { useState, useEffect, useCallback } from 'react';
import { User, Team, UserRole, PaginatedResponse } from '../types';
import { api } from '../services/api';
import {
  Users,
  UserCheck,
  UserX,
  Search,
  RefreshCw,
  Filter,
  X,
  Shield,
  Briefcase,
  GraduationCap,
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ShieldAlert,
  Building,
  MoreVertical,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  UserPlus,
  KeyRound,
  Edit3,
  MapPin,
} from 'lucide-react';
import { CreateUserModal } from './CreateUserModal';
import { UserCreatedSuccessModal } from './UserCreatedSuccessModal';
import { AdminResetPasswordModal } from './AdminResetPasswordModal';
import { EditUserModal } from './EditUserModal';
import { AccountStatusConfirmModal } from './AccountStatusConfirmModal';

interface UserManagementPageProps {
  currentUser: User | null;
  teams: Team[];
  onRefreshData?: () => void;
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({
  currentUser,
  teams = [],
  onRefreshData,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN' || (currentUser as any)?.is_superuser;
  const isManager = currentUser?.role === 'MANAGER';
  const isSalesEmployee = currentUser?.role === 'SALES_EMPLOYEE';

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Action States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createdUserForModal, setCreatedUserForModal] = useState<User | null>(null);
  const [userForReset, setUserForReset] = useState<User | null>(null);
  const [userForEdit, setUserForEdit] = useState<User | null>(null);
  const [userForStatusChange, setUserForStatusChange] = useState<User | null>(null);
  const [actionSuccessNotification, setActionSuccessNotification] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{
    show: boolean;
    name: string;
    employeeId: string;
  } | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Summary Metrics
  const [metrics, setMetrics] = useState<{
    total: number;
    active: number;
    inactive: number;
    teamsCount: number;
  }>({
    total: 0,
    active: 0,
    inactive: 0,
    teamsCount: 0,
  });

  // Selected User for View Modal
  const [selectedUserForView, setSelectedUserForView] = useState<User | null>(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch users from real backend API
  const fetchUsers = useCallback(async () => {
    if (isSalesEmployee) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response: PaginatedResponse<User> = await api.getUsersPaginated({
        page: currentPage,
        page_size: pageSize,
        search: debouncedSearch,
        role: roleFilter !== 'ALL' ? roleFilter : undefined,
        team: teamFilter !== 'ALL' ? teamFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });

      setUsers(response.results || []);
      setTotalCount(response.count || 0);
      setTotalPages(response.total_pages || 1);

      // Compute or update overview metrics based on current results and organization
      const activeCount = (response.results || []).filter((u) => u.is_active !== false).length;
      const inactiveCount = (response.results || []).filter((u) => u.is_active === false).length;
      const uniqueTeams = new Set((response.results || []).map((u) => u.team).filter(Boolean)).size;

      setMetrics((prev) => ({
        total: response.count || (response.results || []).length,
        active: statusFilter === 'inactive' ? 0 : activeCount,
        inactive: statusFilter === 'active' ? 0 : inactiveCount,
        teamsCount: uniqueTeams || teams.length,
      }));
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch users. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, roleFilter, teamFilter, statusFilter, isSalesEmployee, teams.length]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset filters handler
  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setRoleFilter('ALL');
    setTeamFilter('ALL');
    setStatusFilter('ALL');
    setCurrentPage(1);
  };

  // Check if current user can reset password for target employee
  const canResetUser = (emp: User) => {
    if (isAdmin) return true;
    if (isManager) {
      if (emp.role !== 'SALES_EMPLOYEE') return false;
      const managerTeamId = currentUser?.team || (currentUser as any)?.team_id || (currentUser as any)?.managed_team?.id;
      const empTeamId = emp.team || (emp as any)?.team_id;
      return Boolean(managerTeamId && empTeamId && Number(managerTeamId) === Number(empTeamId));
    }
    return false;
  };

  // Check if current user can manage/edit target employee
  const canManageUser = (emp: User) => {
    if (isAdmin) return true;
    if (isManager) {
      if (emp.role !== 'SALES_EMPLOYEE') return false;
      const managerTeamId = currentUser?.team || (currentUser as any)?.team_id || (currentUser as any)?.managed_team?.id;
      const empTeamId = emp.team || (emp as any)?.team_id;
      return Boolean(managerTeamId && empTeamId && Number(managerTeamId) === Number(empTeamId));
    }
    return false;
  };

  // Check if current user can toggle status (activate/deactivate)
  const canToggleStatus = (emp: User) => {
    if (!canManageUser(emp)) return false;
    // Disallow self-deactivation
    if (currentUser?.id === emp.id) return false;
    return true;
  };

  // Helper for role pill badge
  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F3E8FF] text-[#7C3AED] border border-[#DDD6FE]">
            <Shield className="w-3 h-3 text-[#7C3AED]" /> Admin
          </span>
        );
      case 'MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
            <Briefcase className="w-3 h-3 text-[#2563EB]" /> Manager
          </span>
        );
      case 'SALES_EMPLOYEE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
            <GraduationCap className="w-3 h-3 text-[#16A34A]" /> Counsellor
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {role}
          </span>
        );
    }
  };

  // Helper for status badge
  const renderStatusBadge = (user: User) => {
    const isActive = user.is_active !== false && user.account_status !== 'INACTIVE';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          isActive
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}
        />
        {isActive ? 'Active' : 'Inactive'}
      </span>
    );
  };

  // Helper to format ISO date
  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  // Helper for initials
  const getInitials = (user: User) => {
    const name = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
    const parts = name.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name[0] || 'U').toUpperCase();
  };

  // Access Denied screen for Sales Employees
  if (isSalesEmployee) {
    return (
      <div className="flex-1 p-8 bg-[#F8FAFC] flex items-center justify-center min-h-[500px]">
        <div className="max-w-md w-full bg-white rounded-xl shadow-xs border border-[#E2E8F0] p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#0F172A] mb-2">Access Restricted</h2>
          <p className="text-sm text-[#64748B] mb-6">
            User administration and employee directory access is restricted to Administrators and Team Managers. If you require access, please contact your CRM administrator.
          </p>
          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 font-mono">
            Role: Counsellor ({currentUser?.username})
          </div>
        </div>
      </div>
    );
  }

  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC] overflow-y-auto">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E2E8F0] px-6 py-5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-[#2563EB] flex items-center justify-center shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
                  User Management
                </h1>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {isAdmin
                    ? 'Organization-wide employee directory, role permissions, and team allocations'
                    : `Team management directory for ${currentUser?.team_name || 'authorized team'}`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              id="refresh-users-btn"
              onClick={() => {
                fetchUsers();
                onRefreshData?.();
              }}
              disabled={loading}
              className="px-3 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-60"
              title="Refresh Users"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#64748B] ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {(isAdmin || isManager) && (
              <button
                type="button"
                id="add-employee-btn"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Add New Employee"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Employee</span>
              </button>
            )}
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-5">
          <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Total Staff</p>
              <p className="text-xl font-bold text-[#0F172A] mt-0.5">{totalCount}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Active Accounts</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">
                {users.filter((u) => u.is_active !== false).length}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Inactive / Suspended</p>
              <p className="text-xl font-bold text-rose-600 mt-0.5">
                {users.filter((u) => u.is_active === false).length}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Teams Active</p>
              <p className="text-xl font-bold text-purple-600 mt-0.5">{teams.length || 1}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-6 space-y-4 max-w-7xl w-full mx-auto">
        {/* Success Creation Notification Banner */}
        {successToast && (
          <div
            id="user-created-success-toast"
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center justify-between shadow-2xs animate-in fade-in"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-900">
                  Employee Account Created Successfully
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  <span className="font-semibold">{successToast.name}</span> has been allocated Employee ID{' '}
                  <span className="font-mono font-bold">{successToast.employeeId}</span> with Active status.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessToast(null)}
              className="p-1 text-emerald-600 hover:text-emerald-800 rounded-md cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* Search & Filters Card */}
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                id="users-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by employee name, email, mobile number, or employee ID..."
                className="w-full pl-9 pr-8 py-2 text-xs font-medium text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#94A3B8] hover:text-[#0F172A] rounded-md"
                  title="Clear Search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Role Filter */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="user-role-filter" className="text-[11px] font-semibold text-[#64748B] shrink-0">
                  Role:
                </label>
                <select
                  id="user-role-filter"
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] cursor-pointer"
                >
                  <option value="ALL">All Roles</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="SALES_EMPLOYEE">Career Counsellor</option>
                </select>
              </div>

              {/* Team Filter */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="user-team-filter" className="text-[11px] font-semibold text-[#64748B] shrink-0">
                  Team:
                </label>
                <select
                  id="user-team-filter"
                  value={teamFilter}
                  onChange={(e) => {
                    setTeamFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] cursor-pointer"
                >
                  <option value="ALL">All Teams</option>
                  {teams.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Status Filter */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="user-status-filter" className="text-[11px] font-semibold text-[#64748B] shrink-0">
                  Status:
                </label>
                <select
                  id="user-status-filter"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="user-page-size" className="text-[11px] font-semibold text-[#64748B] shrink-0">
                  Rows:
                </label>
                <select
                  id="user-page-size"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1.5 text-xs font-medium text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] cursor-pointer"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>

              {/* Reset Filters */}
              {(searchQuery || roleFilter !== 'ALL' || teamFilter !== 'ALL' || statusFilter !== 'ALL') && (
                <button
                  type="button"
                  id="reset-users-filters-btn"
                  onClick={handleResetFilters}
                  className="px-2.5 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-rose-50 rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Success Banner */}
        {actionSuccessNotification && (
          <div
            id="admin-action-success-banner"
            className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center justify-between shadow-2xs animate-in fade-in"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold">{actionSuccessNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionSuccessNotification(null)}
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer p-1 rounded-md hover:bg-emerald-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="text-xs font-medium">{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchUsers}
              className="text-xs font-bold text-rose-700 underline hover:text-rose-900 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Responsive Employee Table Card */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="employees-table">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                  <th className="py-3 px-4 min-w-[110px]">Employee ID</th>
                  <th className="py-3 px-4 min-w-[200px]">Full Name</th>
                  <th className="py-3 px-4 min-w-[190px]">Email</th>
                  <th className="py-3 px-4 min-w-[140px]">Mobile Number</th>
                  <th className="py-3 px-4 min-w-[120px]">Role</th>
                  <th className="py-3 px-4 min-w-[150px]">Designation</th>
                  <th className="py-3 px-4 min-w-[150px]">Team</th>
                  <th className="py-3 px-4 min-w-[170px]">Reporting Manager</th>
                  <th className="py-3 px-4 min-w-[110px]">Account Status</th>
                  <th className="py-3 px-4 min-w-[120px]">Date Created</th>
                  <th className="py-3 px-4 text-center min-w-[200px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs text-[#0F172A]">
                {loading ? (
                  // Loading State Skeleton
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={`skeleton-${idx}`} className="animate-pulse">
                      <td className="py-3 px-4">
                        <div className="h-4 bg-slate-100 rounded-md w-16" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
                          <div className="space-y-1">
                            <div className="h-3.5 bg-slate-100 rounded-md w-28" />
                            <div className="h-2.5 bg-slate-100 rounded-md w-20" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-3.5 bg-slate-100 rounded-md w-36" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-3.5 bg-slate-100 rounded-md w-24" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-5 bg-slate-100 rounded-full w-20" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-3.5 bg-slate-100 rounded-md w-24" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-3.5 bg-slate-100 rounded-md w-24" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-3.5 bg-slate-100 rounded-md w-28" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-5 bg-slate-100 rounded-full w-16" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="h-3.5 bg-slate-100 rounded-md w-20" />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="h-6 bg-slate-100 rounded-md w-12 mx-auto" />
                      </td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  // Empty State
                  <tr>
                    <td colSpan={11} className="py-12 text-center">
                      <div className="max-w-sm mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                          <Users className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">No employees found</p>
                          <p className="text-xs text-[#64748B] mt-0.5">
                            No employee records matched your active search query or filter selections.
                          </p>
                        </div>
                        {(searchQuery || roleFilter !== 'ALL' || teamFilter !== 'ALL' || statusFilter !== 'ALL') && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="px-3 py-1.5 text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] rounded-lg transition cursor-pointer"
                          >
                            Clear All Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Real Employee Records
                  users.map((emp) => {
                    const empName = emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username;
                    return (
                      <tr
                        key={emp.id}
                        className="hover:bg-[#F8FAFC] transition-colors group cursor-default"
                        id={`employee-row-${emp.id}`}
                      >
                        {/* 1. Employee ID */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-[#2563EB]">
                          <span className="px-2 py-0.5 bg-[#EFF6FF] rounded text-[11px] border border-[#BFDBFE]">
                            {emp.employee_id || `EMP-${String(emp.id).padStart(4, '0')}`}
                          </span>
                        </td>

                        {/* 2. Full Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-linear-to-tr from-[#2563EB] to-[#60A5FA] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                              {getInitials(emp)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-[#0F172A] truncate hover:text-[#2563EB] transition">
                                {empName}
                              </div>
                              <div className="text-[11px] text-[#64748B] truncate font-mono">
                                @{emp.username}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Email */}
                        <td className="py-3.5 px-4">
                          <a
                            href={`mailto:${emp.email}`}
                            className="text-[#2563EB] hover:underline flex items-center gap-1.5 truncate max-w-[190px]"
                            title={emp.email}
                          >
                            <Mail className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                            <span className="truncate">{emp.email || '—'}</span>
                          </a>
                        </td>

                        {/* 4. Mobile Number */}
                        <td className="py-3.5 px-4 text-[#0F172A] font-mono text-[11px]">
                          {emp.mobile_number ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-[#64748B] shrink-0" />
                              <span>{emp.mobile_number}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* 5. Role */}
                        <td className="py-3.5 px-4">{renderRoleBadge(emp.role)}</td>

                        {/* 6. Designation */}
                        <td className="py-3.5 px-4 text-[#0F172A] font-medium">
                          {emp.designation || (
                            emp.role === 'ADMIN'
                              ? 'System Administrator'
                              : emp.role === 'MANAGER'
                              ? 'Sales Manager'
                              : 'Career Counsellor'
                          )}
                        </td>

                        {/* 7. Team */}
                        <td className="py-3.5 px-4">
                          {emp.team_name ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0]">
                              <Building className="w-3 h-3 text-[#64748B]" />
                              {emp.team_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No Team</span>
                          )}
                        </td>

                        {/* 8. Reporting Manager */}
                        <td className="py-3.5 px-4 text-[#0F172A] text-xs">
                          {emp.reporting_manager_name ? (
                            <span className="font-medium text-[#334155]">
                              {emp.reporting_manager_name}
                            </span>
                          ) : emp.role === 'ADMIN' ? (
                            <span className="text-[#64748B] italic">Executive</span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>

                        {/* 9. Account Status */}
                        <td className="py-3.5 px-4">{renderStatusBadge(emp)}</td>

                        {/* 10. Date Created */}
                        <td className="py-3.5 px-4 text-[#64748B] font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-[#94A3B8] shrink-0" />
                            <span>{formatDate(emp.date_joined)}</span>
                          </div>
                        </td>

                        {/* 11. Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => setSelectedUserForView(emp)}
                              id={`view-user-btn-${emp.id}`}
                              className="px-2 py-1 text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] rounded-md transition shadow-2xs cursor-pointer"
                              title="View Employee Profile"
                            >
                              Details
                            </button>

                            {/* Edit Details */}
                            {canManageUser(emp) && (
                              <button
                                type="button"
                                onClick={() => setUserForEdit(emp)}
                                id={`edit-user-btn-${emp.id}`}
                                className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition shadow-2xs cursor-pointer flex items-center gap-1"
                                title={`Edit Details for ${emp.first_name || emp.username}`}
                              >
                                <Edit3 className="w-3 h-3 text-slate-500" />
                                <span>Edit</span>
                              </button>
                            )}

                            {/* Activate / Deactivate Account Status */}
                            {canToggleStatus(emp) && (
                              <button
                                type="button"
                                onClick={() => setUserForStatusChange(emp)}
                                id={`toggle-status-btn-${emp.id}`}
                                className={`px-2 py-1 text-xs font-semibold rounded-md transition shadow-2xs cursor-pointer flex items-center gap-1 border ${
                                  emp.is_active !== false && emp.account_status !== 'INACTIVE'
                                    ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200'
                                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                                }`}
                                title={
                                  emp.is_active !== false && emp.account_status !== 'INACTIVE'
                                    ? `Deactivate ${emp.first_name || emp.username}'s Account`
                                    : `Activate ${emp.first_name || emp.username}'s Account`
                                }
                              >
                                {emp.is_active !== false && emp.account_status !== 'INACTIVE' ? (
                                  <>
                                    <UserX className="w-3 h-3 text-rose-600" />
                                    <span>Deactivate</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3 h-3 text-emerald-600" />
                                    <span>Activate</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Reset Password */}
                            {canResetUser(emp) && (
                              <button
                                type="button"
                                onClick={() => setUserForReset(emp)}
                                id={`reset-user-btn-${emp.id}`}
                                className="px-2 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition shadow-2xs cursor-pointer flex items-center gap-1"
                                title={`Reset Password for ${emp.first_name || emp.username}`}
                              >
                                <KeyRound className="w-3 h-3 text-amber-600" />
                                <span>Reset</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-5 py-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748B]">
            <div>
              Showing <span className="font-semibold text-[#0F172A]">{startRecord}</span> to{' '}
              <span className="font-semibold text-[#0F172A]">{endRecord}</span> of{' '}
              <span className="font-semibold text-[#0F172A]">{totalCount}</span> employees
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="users-prev-page-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="px-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <div className="px-3 py-1 font-mono text-xs font-semibold text-[#0F172A] bg-white border border-[#CBD5E1] rounded-lg">
                Page {currentPage} of {totalPages}
              </div>

              <button
                type="button"
                id="users-next-page-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="px-2.5 py-1.5 bg-white border border-[#CBD5E1] rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer font-medium"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Employee Quick Details Modal */}
      {selectedUserForView && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[#2563EB] to-[#60A5FA] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {getInitials(selectedUserForView)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    {selectedUserForView.full_name || selectedUserForView.username}
                  </h3>
                  <p className="text-xs text-[#64748B] font-mono">
                    {selectedUserForView.employee_id || `EMP-${String(selectedUserForView.id).padStart(4, '0')}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForView(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Role</span>
                  <div>{renderRoleBadge(selectedUserForView.role)}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Account Status</span>
                  <div>{renderStatusBadge(selectedUserForView)}</div>
                </div>
              </div>

              <div className="space-y-2.5 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Username</span>
                  <span className="font-mono text-slate-800 font-semibold">{selectedUserForView.username}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Email</span>
                  <span className="font-mono text-blue-600 font-semibold">{selectedUserForView.email || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Mobile Number</span>
                  <span className="font-mono text-slate-800">{selectedUserForView.mobile_number || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Designation</span>
                  <span className="text-slate-800 font-medium">{selectedUserForView.designation || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Assigned Team</span>
                  <span className="text-slate-800 font-medium">{selectedUserForView.team_name || 'No Team Assigned'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Reporting Manager</span>
                  <span className="text-slate-800 font-medium">{selectedUserForView.reporting_manager_name || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Department</span>
                  <span className="text-slate-800 font-medium">{selectedUserForView.department || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Work Location</span>
                  <span className="text-slate-800 font-medium">{selectedUserForView.work_location || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Date of Joining</span>
                  <span className="font-mono text-slate-700">{formatDate(selectedUserForView.date_of_joining || undefined)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Member Since</span>
                  <span className="font-mono text-slate-600">{formatDate(selectedUserForView.date_joined)}</span>
                </div>
              </div>
            </div>

            {/* Footer with Quick Action buttons */}
            <div className="px-6 py-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {canManageUser(selectedUserForView) && (
                  <button
                    type="button"
                    id="details-edit-user-btn"
                    onClick={() => {
                      const target = selectedUserForView;
                      setSelectedUserForView(null);
                      setUserForEdit(target);
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                    title="Edit Employee Information"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Edit Details</span>
                  </button>
                )}

                {canToggleStatus(selectedUserForView) && (
                  <button
                    type="button"
                    id="details-toggle-status-btn"
                    onClick={() => {
                      const target = selectedUserForView;
                      setSelectedUserForView(null);
                      setUserForStatusChange(target);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5 border ${
                      selectedUserForView.is_active !== false && selectedUserForView.account_status !== 'INACTIVE'
                        ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border-rose-200'
                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                    }`}
                  >
                    {selectedUserForView.is_active !== false && selectedUserForView.account_status !== 'INACTIVE' ? (
                      <>
                        <UserX className="w-3.5 h-3.5 text-rose-600" />
                        <span>Deactivate Account</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Activate Account</span>
                      </>
                    )}
                  </button>
                )}

                {canResetUser(selectedUserForView) && (
                  <button
                    type="button"
                    id="details-reset-password-btn"
                    onClick={() => {
                      const target = selectedUserForView;
                      setSelectedUserForView(null);
                      setUserForReset(target);
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                    title="Reset Employee Password"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    <span>Reset Password</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedUserForView(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition shadow-2xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <CreateUserModal
          currentUser={currentUser}
          teams={teams}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(newUser) => {
            setIsCreateModalOpen(false);
            setCreatedUserForModal(newUser);
            setSuccessToast({
              show: true,
              name: newUser.full_name || newUser.username,
              employeeId: newUser.employee_id || `EMP-${newUser.id}`,
            });
            fetchUsers();
            onRefreshData?.();
          }}
        />
      )}

      {/* Onboarding Credentials Success Modal */}
      {createdUserForModal && (
        <UserCreatedSuccessModal
          user={createdUserForModal}
          onClose={() => setCreatedUserForModal(null)}
        />
      )}

      {/* Admin / Manager Password Reset Modal */}
      {userForReset && (
        <AdminResetPasswordModal
          user={userForReset}
          onClose={() => setUserForReset(null)}
          onSuccess={() => {
            fetchUsers();
          }}
        />
      )}

      {/* Edit User Modal */}
      {userForEdit && (
        <EditUserModal
          user={userForEdit}
          currentUser={currentUser}
          teams={teams}
          onClose={() => setUserForEdit(null)}
          onSuccess={(updatedUser) => {
            setUserForEdit(null);
            setActionSuccessNotification(
              `Employee details for ${updatedUser.full_name || updatedUser.username} updated successfully.`
            );
            fetchUsers();
            onRefreshData?.();
          }}
        />
      )}

      {/* Account Status Confirm Modal (Activate / Deactivate) */}
      {userForStatusChange && (
        <AccountStatusConfirmModal
          user={userForStatusChange}
          currentUser={currentUser}
          teams={teams}
          onClose={() => setUserForStatusChange(null)}
          onSuccess={(updatedUser, message) => {
            setUserForStatusChange(null);
            setActionSuccessNotification(
              message || `Account status updated for ${updatedUser.full_name || updatedUser.username}.`
            );
            fetchUsers();
            onRefreshData?.();
          }}
        />
      )}
    </div>
  );
};
