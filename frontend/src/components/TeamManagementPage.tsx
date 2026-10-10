import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Team, CreateTeamPayload, UpdateTeamPayload } from '../types';
import { api } from '../services/api';
import {
  Building,
  Users,
  Search,
  RefreshCw,
  PlusCircle,
  Edit3,
  Trash2,
  Eye,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  X,
  FileSpreadsheet,
  AlertTriangle,
  UserCheck,
  UserX,
  Check,
  Clock,
  Shield,
  Briefcase,
  ChevronRight,
  Info,
  Power,
} from 'lucide-react';

interface TeamManagementPageProps {
  currentUser: User | null;
  onRefreshData?: () => void;
}

export const TeamManagementPage: React.FC<TeamManagementPageProps> = ({
  currentUser,
  onRefreshData,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN' || (currentUser as any)?.is_superuser;

  // Teams & Loading State
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Managers List for Form Selectors
  const [managers, setManagers] = useState<User[]>([]);
  const [loadingManagers, setLoadingManagers] = useState<boolean>(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [teamForEdit, setTeamForEdit] = useState<Team | null>(null);
  const [teamForDetails, setTeamForDetails] = useState<Team | null>(null);
  const [teamForDelete, setTeamForDelete] = useState<Team | null>(null);

  // Notifications
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Fetch Teams
  const fetchTeams = useCallback(async (isSilent = false) => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      // Backend returns all teams for admin by default
      const data = await api.getTeams();
      setTeams(data);
    } catch (err: any) {
      console.error('Failed to load teams:', err);
      setError(err?.message || 'Failed to load teams. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  // Fetch Eligible Managers
  const fetchManagers = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingManagers(true);
    try {
      const data = await api.getUsers({ role: 'MANAGER' });
      setManagers(data);
    } catch (err) {
      console.error('Failed to load managers:', err);
    } finally {
      setLoadingManagers(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchTeams();
    fetchManagers();
  }, [fetchTeams, fetchManagers]);

  // Client-side Filtered Teams
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      // Status Filter
      if (statusFilter === 'ACTIVE' && !team.is_active) return false;
      if (statusFilter === 'INACTIVE' && team.is_active) return false;

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = team.name.toLowerCase().includes(query);
        const matchesDesc = (team.description || '').toLowerCase().includes(query);
        const matchesMgrUsername = (team.manager_name || '').toLowerCase().includes(query);
        const matchesMgrFull = (team.manager_full_name || '').toLowerCase().includes(query);
        const matchesId = String(team.id) === query;

        return matchesName || matchesDesc || matchesMgrUsername || matchesMgrFull || matchesId;
      }

      return true;
    });
  }, [teams, statusFilter, searchQuery]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = teams.length;
    const active = teams.filter((t) => t.is_active).length;
    const inactive = total - active;
    const totalLeads = teams.reduce((acc, t) => acc + (t.leads_count || 0), 0);
    const totalEmployees = teams.reduce((acc, t) => acc + (t.members_count || 0), 0);
    return { total, active, inactive, totalLeads, totalEmployees };
  }, [teams]);

  // Non-Admin Access Denied
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="crm-card p-8 text-center bg-white border border-[#E2E8F0] shadow-sm">
          <div className="w-14 h-14 bg-[#FEF2F2] text-[#DC2626] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#FECACA]">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-[#0F172A] mb-2">Access Restricted</h2>
          <p className="text-sm text-[#64748B] max-w-md mx-auto mb-6">
            Only authorized CRM Administrators have access to organization-wide team configuration and team management.
          </p>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                window.location.href = '/?view=dashboard';
              }}
              className="crm-btn-primary px-4 py-2 text-xs font-semibold rounded-lg"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          role="alert"
          aria-live="polite"
          className={`flex items-center justify-between p-4 rounded-xl border shadow-md transition-all ${
            notification.type === 'success'
              ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
          }`}
        >
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0" />
            )}
            <p className="text-sm font-semibold">{notification.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building className="w-6 h-6 text-[#7C3AED]" />
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Team Management</h1>
            <span className="crm-pill crm-pill-purple ml-2">Admin Control</span>
          </div>
          <p className="text-xs text-[#64748B]">
            Configure sales and admissions teams, assign designated managers, and monitor employee and lead distributions.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="refresh-teams-btn"
            onClick={() => {
              fetchTeams(true);
              fetchManagers();
              onRefreshData?.();
            }}
            disabled={loading || refreshing}
            className="crm-btn-secondary px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh Teams Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#2563EB]' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            id="create-team-btn"
            onClick={() => setIsCreateModalOpen(true)}
            className="crm-btn-primary px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Team</span>
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="crm-card p-4 relative overflow-hidden bg-white border border-[#E2E8F0]">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Total Teams</div>
          <div className="text-2xl font-bold text-[#0F172A]">{metrics.total}</div>
          <div className="text-[11px] text-[#64748B] mt-1 flex items-center gap-1">
            <Building className="w-3 h-3 text-[#7C3AED]" /> Organization units
          </div>
        </div>

        <div className="crm-card p-4 relative overflow-hidden bg-white border border-[#E2E8F0]">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Active Teams</div>
          <div className="text-2xl font-bold text-[#16A34A]">{metrics.active}</div>
          <div className="text-[11px] text-[#16A34A] mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Available for assignment
          </div>
        </div>

        <div className="crm-card p-4 relative overflow-hidden bg-white border border-[#E2E8F0]">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Inactive Teams</div>
          <div className="text-2xl font-bold text-[#64748B]">{metrics.inactive}</div>
          <div className="text-[11px] text-[#64748B] mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Preserved historical
          </div>
        </div>

        <div className="crm-card p-4 relative overflow-hidden bg-white border border-[#E2E8F0]">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Total Leads</div>
          <div className="text-2xl font-bold text-[#2563EB]">{metrics.totalLeads}</div>
          <div className="text-[11px] text-[#2563EB] mt-1 flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3" /> Protected in teams
          </div>
        </div>

        <div className="crm-card p-4 relative overflow-hidden bg-white border border-[#E2E8F0]">
          <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Total Employees</div>
          <div className="text-2xl font-bold text-[#7C3AED]">{metrics.totalEmployees}</div>
          <div className="text-[11px] text-[#7C3AED] mt-1 flex items-center gap-1">
            <Users className="w-3 h-3" /> Across all teams
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="crm-card p-4 bg-white border border-[#E2E8F0] flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="team-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams by name, description, or manager..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#64748B]">Status:</span>
            <div className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 text-xs">
              <button
                type="button"
                id="filter-status-all"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-[#2563EB] shadow-xs font-semibold'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                All ({teams.length})
              </button>
              <button
                type="button"
                id="filter-status-active"
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-white text-[#16A34A] shadow-xs font-semibold'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Active ({metrics.active})
              </button>
              <button
                type="button"
                id="filter-status-inactive"
                onClick={() => setStatusFilter('INACTIVE')}
                className={`px-3 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  statusFilter === 'INACTIVE'
                    ? 'bg-white text-[#64748B] shadow-xs font-semibold'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Inactive ({metrics.inactive})
              </button>
            </div>
          </div>

          {(searchQuery || statusFilter !== 'ALL') && (
            <button
              type="button"
              id="clear-team-filters-btn"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
              className="text-xs text-[#2563EB] hover:underline font-semibold cursor-pointer shrink-0"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-center justify-between text-[#991B1B]">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-[#DC2626]" />
            <span className="text-xs font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchTeams()}
            className="text-xs font-bold underline hover:no-underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Teams Table */}
      <div className="crm-card bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Team Name</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Designated Manager</th>
                <th className="py-3 px-4 text-center">Employees</th>
                <th className="py-3 px-4 text-center">Active</th>
                <th className="py-3 px-4 text-center">Leads</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#64748B]">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB]" />
                      <span>Loading teams from server...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#64748B]">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Building className="w-8 h-8 mx-auto text-[#CBD5E1]" />
                      <p className="font-semibold text-sm text-[#0F172A]">No teams found</p>
                      <p className="text-xs text-[#64748B]">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'Try adjusting your search query or status filter.'
                          : 'Get started by creating your first organizational team.'}
                      </p>
                      {!searchQuery && statusFilter === 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setIsCreateModalOpen(true)}
                          className="crm-btn-primary px-3 py-1.5 text-xs font-semibold rounded-lg mt-2 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Create First Team</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTeams.map((team) => {
                  const hasLeads = (team.leads_count || 0) > 0;
                  const hasMembers = (team.members_count || 0) > 0;
                  const isProtectedFromDelete = hasLeads || hasMembers;

                  return (
                    <tr
                      key={team.id}
                      className="hover:bg-[#F8FAFC] transition-colors group cursor-default"
                      id={`team-row-${team.id}`}
                    >
                      {/* ID */}
                      <td className="py-3 px-4 font-mono text-[11px] text-[#64748B]">
                        #{team.id}
                      </td>

                      {/* Team Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${team.is_active ? 'bg-[#16A34A]' : 'bg-[#94A3B8]'}`} />
                          <span className="font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                            {team.name}
                          </span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 max-w-xs truncate text-[#64748B]" title={team.description || ''}>
                        {team.description ? (
                          <span className="truncate">{team.description}</span>
                        ) : (
                          <span className="text-[#CBD5E1] italic">—</span>
                        )}
                      </td>

                      {/* Designated Manager */}
                      <td className="py-3 px-4">
                        {team.manager ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] flex items-center justify-center font-bold text-[10px]">
                              {(team.manager_full_name || team.manager_name || 'M')[0].toUpperCase()}
                            </div>
                            <div className="leading-tight">
                              <div className="font-semibold text-[#0F172A]">
                                {team.manager_full_name || team.manager_name}
                              </div>
                              <div className="text-[10px] text-[#64748B]">
                                @{team.manager_name}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
                            No Manager
                          </span>
                        )}
                      </td>

                      {/* Total Employees */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold text-[#0F172A]">
                          {team.members_count || 0}
                        </span>
                      </td>

                      {/* Active Employees */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-semibold ${
                            (team.active_members_count || 0) > 0 ? 'text-[#16A34A]' : 'text-[#64748B]'
                          }`}
                        >
                          {team.active_members_count || 0}
                        </span>
                      </td>

                      {/* Total Leads */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            hasLeads
                              ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                              : 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]'
                          }`}
                        >
                          {team.leads_count || 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {team.is_active ? (
                          <span className="crm-pill crm-pill-green inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                            Active
                          </span>
                        ) : (
                          <span className="crm-pill crm-pill-gray inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3 px-4 text-[#64748B] text-[11px] whitespace-nowrap">
                        {team.created_at ? new Date(team.created_at).toLocaleDateString() : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Inspect Details */}
                          <button
                            type="button"
                            id={`inspect-team-btn-${team.id}`}
                            onClick={() => setTeamForDetails(team)}
                            className="p-1.5 text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition-colors cursor-pointer"
                            title="Inspect Team Details & Members"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Team */}
                          <button
                            type="button"
                            id={`edit-team-btn-${team.id}`}
                            onClick={() => setTeamForEdit(team)}
                            className="p-1.5 text-[#64748B] hover:text-[#7C3AED] hover:bg-[#F3E8FF] rounded-lg transition-colors cursor-pointer"
                            title="Edit Team Configuration"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Safeguard / Action */}
                          <button
                            type="button"
                            id={`delete-team-btn-${team.id}`}
                            onClick={() => setTeamForDelete(team)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isProtectedFromDelete
                                ? 'text-[#D97706] hover:bg-[#FFFBEB] hover:text-[#B45309]'
                                : 'text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2]'
                            }`}
                            title={
                              hasLeads
                                ? `Protected: Team has ${team.leads_count} lead(s). Cannot delete.`
                                : hasMembers
                                ? `Protected: Team has ${team.members_count} member(s). Cannot delete.`
                                : 'Delete Team'
                            }
                          >
                            {isProtectedFromDelete ? (
                              <ShieldAlert className="w-3.5 h-3.5" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] text-[11px] text-[#64748B] flex items-center justify-between">
          <span>
            Showing <strong className="text-[#0F172A]">{filteredTeams.length}</strong> of{' '}
            <strong className="text-[#0F172A]">{teams.length}</strong> teams
          </span>
          <span className="flex items-center gap-1 text-[#64748B]">
            <Info className="w-3.5 h-3.5 text-[#2563EB]" />
            Deactivate historical teams with leads rather than deleting them.
          </span>
        </div>
      </div>

      {/* Modals */}
      {/* 1. Create Team Modal */}
      {isCreateModalOpen && (
        <CreateTeamModal
          isOpen={isCreateModalOpen}
          managers={managers}
          existingTeams={teams}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(createdTeam) => {
            setIsCreateModalOpen(false);
            showNotification('success', `Team "${createdTeam.name}" created successfully.`);
            fetchTeams(true);
            fetchManagers();
            onRefreshData?.();
          }}
        />
      )}

      {/* 2. Edit Team Modal */}
      {teamForEdit && (
        <EditTeamModal
          isOpen={Boolean(teamForEdit)}
          team={teamForEdit}
          managers={managers}
          existingTeams={teams}
          onClose={() => setTeamForEdit(null)}
          onSuccess={(updatedTeam) => {
            setTeamForEdit(null);
            showNotification('success', `Team "${updatedTeam.name}" updated successfully.`);
            fetchTeams(true);
            fetchManagers();
            onRefreshData?.();
          }}
        />
      )}

      {/* 3. Team Details Modal */}
      {teamForDetails && (
        <TeamDetailsModal
          isOpen={Boolean(teamForDetails)}
          team={teamForDetails}
          onClose={() => setTeamForDetails(null)}
          onEdit={() => {
            const t = teamForDetails;
            setTeamForDetails(null);
            setTeamForEdit(t);
          }}
        />
      )}

      {/* 4. Delete Safeguard & Action Modal */}
      {teamForDelete && (
        <TeamDeleteSafeguardModal
          isOpen={Boolean(teamForDelete)}
          team={teamForDelete}
          onClose={() => setTeamForDelete(null)}
          onOpenEditToDeactivate={() => {
            const t = teamForDelete;
            setTeamForDelete(null);
            setTeamForEdit(t);
          }}
          onSuccess={() => {
            const deletedName = teamForDelete.name;
            setTeamForDelete(null);
            showNotification('success', `Team "${deletedName}" has been safely deleted.`);
            fetchTeams(true);
            fetchManagers();
            onRefreshData?.();
          }}
        />
      )}
    </div>
  );
};

// =========================================================================
// SUBCOMPONENTS / MODALS
// =========================================================================

/**
 * Create Team Modal
 */
interface CreateTeamModalProps {
  isOpen: boolean;
  managers: User[];
  existingTeams: Team[];
  onClose: () => void;
  onSuccess: (team: Team) => void;
}

const CreateTeamModal: React.FC<CreateTeamModalProps> = ({
  isOpen,
  managers,
  existingTeams,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [managerId, setManagerId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Selected manager conflict analysis
  const selectedManager = managers.find((m) => String(m.id) === managerId);
  const managerCurrentTeamName = selectedManager?.managed_team_name;
  const isManagerConflicted = Boolean(selectedManager && selectedManager.managed_team_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Team name is required.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const payload: CreateTeamPayload = {
      name: name.trim(),
      description: description.trim(),
      manager: managerId ? Number(managerId) : null,
      is_active: true,
    };

    try {
      const created = await api.createTeam(payload);
      onSuccess(created);
    } catch (err: any) {
      console.error('Failed to create team:', err);
      setErrorMessage(err?.message || 'Failed to create team.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="crm-card bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-[#E2E8F0] animate-in fade-in-50 zoom-in-95">
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-[#7C3AED]" />
            <h2 className="text-base font-bold text-[#0F172A]">Create New Team</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#991B1B] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Team Name */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#0F172A]">
              Team Name <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              id="create-team-name-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="e.g., Admissions North, Executive MBA Sales"
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#0F172A]">
              Description <span className="text-[#64748B] font-normal">(Optional)</span>
            </label>
            <textarea
              id="create-team-desc-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of department responsibility or sales region..."
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>

          {/* Designated Manager */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#0F172A]">
              Designated Team Manager <span className="text-[#64748B] font-normal">(Optional)</span>
            </label>
            <select
              id="create-team-manager-select"
              value={managerId}
              onChange={(e) => {
                setManagerId(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            >
              <option value="">No Manager (Unassigned)</option>
              {managers.map((mgr) => {
                const manages = mgr.managed_team_name;
                return (
                  <option key={mgr.id} value={mgr.id}>
                    {mgr.full_name || mgr.username} ({mgr.email})
                    {manages ? ` — Currently manages "${manages}"` : ' — Available'}
                  </option>
                );
              })}
            </select>

            {/* Manager Conflict Warning */}
            {isManagerConflicted && (
              <div className="p-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-[#92400E] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#D97706]" />
                <div>
                  <span className="font-bold">Manager already assigned:</span>{' '}
                  {selectedManager?.full_name || selectedManager?.username} currently manages{' '}
                  <strong>"{managerCurrentTeamName}"</strong>. Assigning them here will transfer their management role.
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="crm-btn-secondary px-4 py-2 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-create-team-btn"
              disabled={loading || !name.trim()}
              className="crm-btn-primary px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Team</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Edit Team Modal
 */
interface EditTeamModalProps {
  isOpen: boolean;
  team: Team;
  managers: User[];
  existingTeams: Team[];
  onClose: () => void;
  onSuccess: (team: Team) => void;
}

const EditTeamModal: React.FC<EditTeamModalProps> = ({
  isOpen,
  team,
  managers,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState<string>(team.name);
  const [description, setDescription] = useState<string>(team.description || '');
  const [managerId, setManagerId] = useState<string>(team.manager ? String(team.manager) : '');
  const [isActive, setIsActive] = useState<boolean>(team.is_active ?? true);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedManager = managers.find((m) => String(m.id) === managerId);
  const isManagerDifferentTeam =
    selectedManager &&
    selectedManager.managed_team_id &&
    selectedManager.managed_team_id !== team.id;

  const leadsCount = team.leads_count || 0;
  const isDeactivatingWithLeads = !isActive && team.is_active && leadsCount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Team name cannot be blank.');
      return;
    }

    if (isDeactivatingWithLeads) {
      setErrorMessage(
        `Cannot deactivate team "${team.name}" because it contains ${leadsCount} lead(s). All leads must be reassigned before deactivating this team.`
      );
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const payload: UpdateTeamPayload = {
      name: name.trim(),
      description: description.trim(),
      manager: managerId ? Number(managerId) : null,
      is_active: isActive,
    };

    try {
      const updated = await api.updateTeam(team.id, payload);
      onSuccess(updated);
    } catch (err: any) {
      console.error('Failed to update team:', err);
      setErrorMessage(err?.message || 'Failed to update team configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="crm-card bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-[#E2E8F0] animate-in fade-in-50 zoom-in-95">
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#2563EB]" />
            <h2 className="text-base font-bold text-[#0F172A]">Edit Team Configuration</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#991B1B] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Team Name */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#0F172A]">
              Team Name <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              id="edit-team-name-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#0F172A]">Description</label>
            <textarea
              id="edit-team-desc-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>

          {/* Manager */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-[#0F172A]">Designated Team Manager</label>
            <select
              id="edit-team-manager-select"
              value={managerId}
              onChange={(e) => {
                setManagerId(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            >
              <option value="">No Manager (Unassigned)</option>
              {managers.map((mgr) => {
                const isCurrent = mgr.id === team.manager;
                const managesOther = mgr.managed_team_name && mgr.managed_team_id !== team.id;
                return (
                  <option key={mgr.id} value={mgr.id}>
                    {mgr.full_name || mgr.username} ({mgr.email})
                    {isCurrent
                      ? ' — Current Manager'
                      : managesOther
                      ? ` — Manages "${mgr.managed_team_name}"`
                      : ' — Available'}
                  </option>
                );
              })}
            </select>

            {isManagerDifferentTeam && (
              <div className="p-2.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-[#92400E] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#D97706]" />
                <div>
                  <strong>Warning:</strong> {selectedManager?.full_name || selectedManager?.username} already manages{' '}
                  "{selectedManager?.managed_team_name}". One manager can manage at most one team.
                </div>
              </div>
            )}
          </div>

          {/* Status Toggle */}
          <div className="space-y-1.5 pt-2 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between">
              <div>
                <label className="block font-semibold text-[#0F172A]">Team Status</label>
                <p className="text-[11px] text-[#64748B]">
                  Inactive teams are hidden from new employee onboarding and lead assignment options.
                </p>
              </div>
              <button
                type="button"
                id="toggle-team-status-btn"
                onClick={() => {
                  setIsActive(!isActive);
                  if (errorMessage) setErrorMessage(null);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isActive ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'
                }`}
                role="switch"
                aria-checked={isActive}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isActive ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Deactivation Safeguard Notice */}
            {isDeactivatingWithLeads && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#991B1B] flex items-start gap-2 mt-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#DC2626]" />
                <div>
                  <strong>Deactivation Safeguard:</strong> This team has <strong>{leadsCount} associated lead(s)</strong>.
                  Backend data integrity blocks deactivating teams containing active leads. You must reassign all leads first.
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="crm-btn-secondary px-4 py-2 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-edit-team-btn"
              disabled={loading || !name.trim() || isDeactivatingWithLeads}
              className="crm-btn-primary px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Team Details Modal (Inspect Members & Metrics)
 */
interface TeamDetailsModalProps {
  isOpen: boolean;
  team: Team;
  onClose: () => void;
  onEdit: () => void;
}

const TeamDetailsModal: React.FC<TeamDetailsModalProps> = ({
  isOpen,
  team,
  onClose,
  onEdit,
}) => {
  const [members, setMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(true);
  const [memberError, setMemberError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingMembers(true);
    setMemberError(null);

    api
      .getUsers({ team: team.id })
      .then((users) => {
        setMembers(users);
      })
      .catch((err) => {
        console.error('Failed to load team members:', err);
        setMemberError('Unable to load employee members for this team.');
      })
      .finally(() => {
        setLoadingMembers(false);
      });
  }, [isOpen, team.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="crm-card bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-[#E2E8F0] animate-in fade-in-50 zoom-in-95 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <Building className="w-5 h-5 text-[#7C3AED]" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#0F172A]">{team.name}</h2>
                <span className="font-mono text-[10px] text-[#64748B]">#{team.id}</span>
                {team.is_active ? (
                  <span className="crm-pill crm-pill-green text-[10px]">Active</span>
                ) : (
                  <span className="crm-pill crm-pill-gray text-[10px]">Inactive</span>
                )}
              </div>
              <p className="text-[11px] text-[#64748B]">
                Created on {team.created_at ? new Date(team.created_at).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="crm-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto text-xs">
          {/* Description */}
          {team.description && (
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
              <span className="font-bold text-[#0F172A] block mb-1">Description:</span>
              <p className="text-[#64748B] leading-relaxed">{team.description}</p>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg text-center">
              <div className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider">Associated Leads</div>
              <div className="text-xl font-bold text-[#1E3A8A] mt-0.5">{team.leads_count || 0}</div>
            </div>
            <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg text-center">
              <div className="text-[10px] font-bold text-[#16A34A] uppercase tracking-wider">Total Members</div>
              <div className="text-xl font-bold text-[#14532D] mt-0.5">{team.members_count || 0}</div>
            </div>
            <div className="p-3 bg-[#F3E8FF] border border-[#E9D5FF] rounded-lg text-center">
              <div className="text-[10px] font-bold text-[#7C3AED] uppercase tracking-wider">Active Members</div>
              <div className="text-xl font-bold text-[#581C87] mt-0.5">{team.active_members_count || 0}</div>
            </div>
          </div>

          {/* Designated Manager Box */}
          <div className="border border-[#E2E8F0] rounded-xl p-3.5 bg-white">
            <span className="font-bold text-[#0F172A] block mb-2">Team Manager</span>
            {team.manager ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#2563EB] flex items-center justify-center font-bold text-sm">
                  {(team.manager_full_name || team.manager_name || 'M')[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-sm text-[#0F172A]">
                    {team.manager_full_name || team.manager_name}
                  </div>
                  <div className="text-[#64748B]">@{team.manager_name}</div>
                </div>
              </div>
            ) : (
              <div className="text-[#64748B] italic flex items-center gap-2">
                <Info className="w-4 h-4 text-[#94A3B8]" />
                No designated manager currently assigned to this team.
              </div>
            )}
          </div>

          {/* Members Roster */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2563EB]" />
                Team Members ({members.length})
              </span>
            </div>

            {loadingMembers ? (
              <div className="p-6 text-center text-[#64748B]">
                <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB] mx-auto mb-2" />
                Loading team members...
              </div>
            ) : memberError ? (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#991B1B]">
                {memberError}
              </div>
            ) : members.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-[#E2E8F0] rounded-xl text-[#64748B]">
                No employee members are currently assigned to this team.
              </div>
            ) : (
              <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#64748B] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Employee ID</th>
                      <th className="py-2.5 px-3">Contact</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {members.map((member) => (
                      <tr key={member.id} className="hover:bg-[#F8FAFC]">
                        <td className="py-2.5 px-3 font-semibold text-[#0F172A]">
                          {member.full_name || member.name || member.username}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`crm-pill text-[10px] ${
                              member.role === 'MANAGER'
                                ? 'crm-pill-blue'
                                : 'crm-pill-gray'
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#64748B]">
                          {member.employee_id || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B]">
                          <div>{member.email}</div>
                          {member.mobile_number && (
                            <div className="text-[10px]">{member.mobile_number}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {member.is_active ? (
                            <span className="text-[#16A34A] font-semibold">Active</span>
                          ) : (
                            <span className="text-[#94A3B8]">Inactive</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="crm-btn-secondary px-4 py-2 rounded-lg font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Team Delete Safeguard & Confirmation Modal
 */
interface TeamDeleteSafeguardModalProps {
  isOpen: boolean;
  team: Team;
  onClose: () => void;
  onOpenEditToDeactivate: () => void;
  onSuccess: () => void;
}

const TeamDeleteSafeguardModal: React.FC<TeamDeleteSafeguardModalProps> = ({
  isOpen,
  team,
  onClose,
  onOpenEditToDeactivate,
  onSuccess,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const leadsCount = team.leads_count || 0;
  const membersCount = team.members_count || 0;
  const hasLeads = leadsCount > 0;
  const hasMembers = membersCount > 0;
  const isBlocked = hasLeads || hasMembers;

  const handleConfirmDelete = async () => {
    if (isBlocked) return;

    setLoading(true);
    setError(null);
    try {
      await api.deleteTeam(team.id);
      onSuccess();
    } catch (err: any) {
      console.error('Failed to delete team:', err);
      setError(err?.message || 'Failed to delete team.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="crm-card bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-[#E2E8F0] animate-in fade-in-50 zoom-in-95">
        <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            {isBlocked ? (
              <ShieldAlert className="w-5 h-5 text-[#D97706]" />
            ) : (
              <Trash2 className="w-5 h-5 text-[#DC2626]" />
            )}
            <h2 className="text-base font-bold text-[#0F172A]">
              {isBlocked ? 'Team Deletion Safeguard' : 'Delete Team'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748B] hover:text-[#0F172A] p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[#991B1B] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Blocked Case 1: Team has Leads */}
          {hasLeads ? (
            <div className="space-y-3">
              <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[#92400E] space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-[#B45309]">
                  <AlertTriangle className="w-4 h-4" />
                  Deletion Blocked: Associated Leads
                </div>
                <p className="leading-relaxed">
                  Team <strong>"{team.name}"</strong> cannot be deleted because it is associated with{' '}
                  <strong className="text-[#B45309]">{leadsCount} lead(s)</strong>.
                </p>
                <p className="text-[11px] text-[#78350F]">
                  Under CRM integrity rules, leads cannot be deleted or orphaned when a team is removed. All lead relationships and historical records are strictly protected.
                </p>
              </div>

              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
                <span className="font-bold text-[#0F172A] block">Recommended Action:</span>
                <ul className="list-disc pl-4 space-y-1 text-[#64748B]">
                  <li>
                    <strong>Deactivate the team</strong>: Inactive teams preserve all historical leads and audit logs while being excluded from future assignments.
                  </li>
                  <li>
                    <strong>Reassign leads first</strong>: If you must remove this team completely, reassign all {leadsCount} lead(s) to another active team in the Leads view.
                  </li>
                </ul>
              </div>
            </div>
          ) : hasMembers ? (
            /* Blocked Case 2: Team has Members */
            <div className="space-y-3">
              <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[#92400E] space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-[#B45309]">
                  <Users className="w-4 h-4" />
                  Deletion Blocked: Assigned Members
                </div>
                <p className="leading-relaxed">
                  Team <strong>"{team.name}"</strong> has{' '}
                  <strong className="text-[#B45309]">{membersCount} employee member(s)</strong> assigned to it.
                </p>
                <p className="text-[11px] text-[#78350F]">
                  Employees cannot be silently orphaned. Please transfer or reassign all employee members to another team before deleting this team.
                </p>
              </div>
            </div>
          ) : (
            /* Allowed Case: Empty team (0 leads, 0 members) */
            <div className="space-y-2">
              <p className="text-sm text-[#0F172A] leading-relaxed">
                Are you sure you want to permanently delete team <strong>"{team.name}"</strong>?
              </p>
              <p className="text-[#64748B]">
                This team has 0 leads and 0 assigned members. Deletion is safe and will remove the team record while creating an audit log entry.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
            {isBlocked ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="crm-btn-secondary px-4 py-2 rounded-lg font-semibold"
                >
                  Close
                </button>
                {hasLeads && (
                  <button
                    type="button"
                    onClick={onOpenEditToDeactivate}
                    className="crm-btn-primary px-4 py-2 rounded-lg font-semibold flex items-center gap-1.5"
                  >
                    <span>Edit Team (Deactivate)</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="crm-btn-secondary px-4 py-2 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirm-delete-team-btn"
                  onClick={handleConfirmDelete}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Delete Team</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
