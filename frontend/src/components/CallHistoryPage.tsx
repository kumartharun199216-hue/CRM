import React, { useState, useEffect, useMemo } from 'react';
import { User, CommunicationLog, Lead } from '../types';
import { api } from '../services/api';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  RefreshCw,
  Search,
  Filter,
  UserCheck,
  UserX,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Download,
  SlidersHorizontal,
  X,
  History,
  FileSpreadsheet
} from 'lucide-react';

interface CallHistoryPageProps {
  currentUser: User;
  users?: User[];
  onOpen360?: (lead: Lead) => void;
  onOpenCreateLeadWithNumber?: (phoneNumber: string) => void;
}

export const CallHistoryPage: React.FC<CallHistoryPageProps> = ({
  currentUser,
  users = [],
  onOpen360,
  onOpenCreateLeadWithNumber,
}) => {
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [counselorsList, setCounselorsList] = useState<User[]>(users);

  // Load counselors list if not passed from parent
  useEffect(() => {
    if (users && users.length > 0) {
      setCounselorsList(users);
    } else {
      api.getUsers()
        .then((res: any) => {
          const list = Array.isArray(res) ? res : res?.results || [];
          setCounselorsList(list);
        })
        .catch(() => {
          api.getUserLookup().then(setCounselorsList).catch(() => {});
        });
    }
  }, [users]);

  // Historical Sync Modal state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncDays, setSyncDays] = useState<string>('30');
  const [customSyncStart, setCustomSyncStart] = useState<string>('');
  const [customSyncEnd, setCustomSyncEnd] = useState<string>('');

  // Primary filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('ALL');
  const [selectedCallType, setSelectedCallType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedMatchFilter, setSelectedMatchFilter] = useState<'ALL' | 'MATCHED' | 'UNMATCHED'>('ALL');

  // Advanced filters
  const [selectedDatePreset, setSelectedDatePreset] = useState<string>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<string>('ALL');
  const [selectedRecording, setSelectedRecording] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('NEWEST');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const data = await api.getCommunicationLogs({ channel: 'CALL' });
      setLogs(data || []);
    } catch (err: any) {
      console.error('Failed to load call history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  const handleSyncSubmit = async (params?: { days?: number; start_date?: string; end_date?: string }) => {
    setSyncing(true);
    setSyncFeedback(null);
    setShowSyncModal(false);
    try {
      const res = await api.syncCallyzerCalls(params);
      const r = res?.result;
      setSyncFeedback({
        type: 'success',
        message: `Callyzer call history synced successfully! Total fetched: ${r?.total_fetched ?? 0}, Synced: ${r?.synced_count ?? 0}, Unmatched: ${r?.unmatched_count ?? 0}`,
      });
      await fetchCalls();
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Failed to synchronize calls from Callyzer.',
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncFeedback(null), 10000);
    }
  };

  // Check how many filters are active
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedEmployee !== 'ALL') count++;
    if (selectedCallType !== 'ALL') count++;
    if (selectedStatus !== 'ALL') count++;
    if (selectedMatchFilter !== 'ALL') count++;
    if (selectedDatePreset !== 'ALL') count++;
    if (selectedDuration !== 'ALL') count++;
    if (selectedRecording !== 'ALL') count++;
    if (sortBy !== 'NEWEST') count++;
    return count;
  }, [
    searchQuery,
    selectedEmployee,
    selectedCallType,
    selectedStatus,
    selectedMatchFilter,
    selectedDatePreset,
    selectedDuration,
    selectedRecording,
    sortBy,
  ]);

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedEmployee('ALL');
    setSelectedCallType('ALL');
    setSelectedStatus('ALL');
    setSelectedMatchFilter('ALL');
    setSelectedDatePreset('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedDuration('ALL');
    setSelectedRecording('ALL');
    setSortBy('NEWEST');
    setCurrentPage(1);
  };

  // Filtered and Sorted Logs
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const filtered = logs.filter((log) => {
      // 1. Channel check
      if (log.channel !== 'CALL') return false;

      // 2. Match filter (Linked vs Unmatched)
      if (selectedMatchFilter === 'MATCHED' && !log.lead) return false;
      if (selectedMatchFilter === 'UNMATCHED' && Boolean(log.lead)) return false;

      // 3. Call type filter
      if (selectedCallType !== 'ALL') {
        const ct = (log.call_type || '').toLowerCase();
        if (selectedCallType.toLowerCase() !== ct) return false;
      }

      // 4. Status filter
      if (selectedStatus !== 'ALL') {
        if (log.status !== selectedStatus) return false;
      }

      // 5. Employee filter
      if (selectedEmployee !== 'ALL') {
        const selectedUserObj = counselorsList.find((u) => String(u.id) === selectedEmployee);
        const targetUsername = (selectedUserObj?.username || '').toLowerCase();
        const targetFullName = (selectedUserObj?.full_name || `${selectedUserObj?.first_name || ''} ${selectedUserObj?.last_name || ''}`).trim().toLowerCase();
        const targetCleanPhone = (selectedUserObj?.mobile_number || '').replace(/\D/g, '').slice(-10);

        const empId = log.initiated_by;
        const empName = (log.initiated_by_name || '').toLowerCase();
        const empMobile = (log.initiated_by_mobile || '').replace(/\D/g, '').slice(-10);
        const logContent = (log.content || '').toLowerCase();

        const matchId = empId && String(empId) === selectedEmployee;
        const matchUsername = targetUsername && (empName === targetUsername || empName.includes(targetUsername));
        const matchFullName = targetFullName && (empName === targetFullName || empName.includes(targetFullName));
        const matchPhone = targetCleanPhone && (
          (empMobile && empMobile.includes(targetCleanPhone)) ||
          logContent.includes(targetCleanPhone)
        );

        if (!matchId && !matchUsername && !matchFullName && !matchPhone) return false;
      }

      // 6. Date Range filter
      const callTimeStr = log.call_datetime || log.created_at;
      if (callTimeStr && selectedDatePreset !== 'ALL') {
        const logDate = new Date(callTimeStr);
        const logDateYMD = logDate.toISOString().slice(0, 10);

        if (selectedDatePreset === 'TODAY' && logDateYMD !== todayStr) return false;
        if (selectedDatePreset === 'YESTERDAY' && logDateYMD !== yesterdayStr) return false;
        if (selectedDatePreset === 'LAST_7' && logDate < sevenDaysAgo) return false;
        if (selectedDatePreset === 'LAST_30' && logDate < thirtyDaysAgo) return false;
        if (selectedDatePreset === 'LAST_90' && logDate < ninetyDaysAgo) return false;
        if (selectedDatePreset === 'THIS_MONTH' && !logDateYMD.startsWith(currentYearMonth)) return false;

        if (selectedDatePreset === 'CUSTOM') {
          if (customStartDate && logDateYMD < customStartDate) return false;
          if (customEndDate && logDateYMD > customEndDate) return false;
        }
      }

      // 7. Duration filter
      const dur = Number(log.call_duration || 0);
      if (selectedDuration === 'CONNECTED' && dur <= 0) return false;
      if (selectedDuration === 'SHORT' && (dur <= 0 || dur > 30)) return false;
      if (selectedDuration === 'MEDIUM' && (dur <= 30 || dur > 120)) return false;
      if (selectedDuration === 'LONG' && (dur <= 120 || dur > 300)) return false;
      if (selectedDuration === 'VERY_LONG' && dur <= 300) return false;
      if (selectedDuration === 'ZERO' && dur > 0) return false;

      // 8. Audio Recording filter
      const hasRec = Boolean(log.call_recording_url && log.call_recording_url.trim().length > 0);
      if (selectedRecording === 'WITH_RECORDING' && !hasRec) return false;
      if (selectedRecording === 'NO_RECORDING' && hasRec) return false;

      // 9. Search query (recipient phone, lead name, external id, note, counselor)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const recipient = (log.recipient || '').toLowerCase();
        const leadTitle = (log.lead_title || '').toLowerCase();
        const leadContact = (log.lead_contact_name || '').toLowerCase();
        const extId = (log.external_reference_id || '').toLowerCase();
        const content = (log.content || '').toLowerCase();
        const empName = (log.initiated_by_name || '').toLowerCase();
        const empMobile = (log.initiated_by_mobile || '').toLowerCase();

        const match =
          recipient.includes(q) ||
          leadTitle.includes(q) ||
          leadContact.includes(q) ||
          extId.includes(q) ||
          content.includes(q) ||
          empName.includes(q) ||
          empMobile.includes(q);

        if (!match) return false;
      }

      return true;
    });

    // Sorting
    return filtered.sort((a, b) => {
      const timeA = new Date(a.call_datetime || a.created_at).getTime();
      const timeB = new Date(b.call_datetime || b.created_at).getTime();
      const durA = Number(a.call_duration || 0);
      const durB = Number(b.call_duration || 0);

      if (sortBy === 'OLDEST') return timeA - timeB;
      if (sortBy === 'LONGEST') return durB - durA;
      if (sortBy === 'SHORTEST') return durA - durB;
      return timeB - timeA; // NEWEST
    });
  }, [
    logs,
    selectedMatchFilter,
    selectedCallType,
    selectedStatus,
    selectedEmployee,
    selectedDatePreset,
    customStartDate,
    customEndDate,
    selectedDuration,
    selectedRecording,
    searchQuery,
    sortBy,
  ]);

  // Aggregate Metrics based on active filtered logs
  const metrics = useMemo(() => {
    const totalCalls = filteredLogs.length;
    let totalSeconds = 0;
    let completedCount = 0;
    let missedCount = 0;
    let rejectedCount = 0;
    let unmatchedCount = 0;
    let recordedCount = 0;

    filteredLogs.forEach((l) => {
      const dur = Number(l.call_duration || 0);
      totalSeconds += dur;
      if (l.status === 'SUCCESS' || dur > 0) completedCount++;
      if (l.status === 'MISSED' || (l.call_type || '').toLowerCase().includes('missed')) missedCount++;
      if (l.status === 'REJECTED' || (l.call_type || '').toLowerCase().includes('rejected')) rejectedCount++;
      if (!l.lead) unmatchedCount++;
      if (l.call_recording_url && l.call_recording_url.trim().length > 0) recordedCount++;
    });

    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m ${totalSeconds % 60}s`;

    return {
      totalCalls,
      totalSeconds,
      durationText,
      completedCount,
      missedCount,
      rejectedCount,
      unmatchedCount,
      recordedCount,
    };
  }, [filteredLogs]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = [
      'Call Date & Time',
      'Counselor / Employee',
      'Counselor Mobile',
      'Customer Number',
      'Linked Lead Name',
      'Call Direction',
      'Status',
      'Duration (Seconds)',
      'Recording URL',
      'Details / Note',
      'External Call ID',
    ];

    const rows = filteredLogs.map((l) => [
      `"${l.call_datetime || l.created_at || ''}"`,
      `"${l.initiated_by_name || 'Counselor SIM'}"`,
      `"${l.initiated_by_mobile || ''}"`,
      `"${l.recipient || ''}"`,
      `"${l.lead_title || l.lead_contact_name || (l.lead ? `Lead #${l.lead}` : 'Unmatched')}"`,
      `"${l.call_type || 'Outgoing'}"`,
      `"${l.status || 'SUCCESS'}"`,
      l.call_duration || 0,
      `"${l.call_recording_url || ''}"`,
      `"${(l.content || '').replace(/"/g, '""')}"`,
      `"${l.external_reference_id || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `call_history_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination slice
  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Format seconds to human friendly
  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Format date display
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const renderCallTypeBadge = (callType?: string) => {
    const ct = (callType || 'Outgoing').toLowerCase();
    if (ct.includes('missed')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900">
          <PhoneMissed className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          Missed
        </span>
      );
    }
    if (ct.includes('rejected')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900">
          <PhoneOff className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          Rejected
        </span>
      );
    }
    if (ct.includes('incoming')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900">
          <PhoneIncoming className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          Incoming
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900">
        <PhoneOutgoing className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
        Outgoing
      </span>
    );
  };

  const renderStatusBadge = (status?: string, duration?: number) => {
    if (status === 'SUCCESS' || (duration && duration > 0)) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          Connected
        </span>
      );
    }
    if (status === 'QUEUED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          Queued on Handset
        </span>
      );
    }
    if (status === 'MISSED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
          <PhoneMissed className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          Missed
        </span>
      );
    }
    if (status === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300">
          <PhoneOff className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        No Answer
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0] dark:border-[#334155]">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shrink-0">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
                Callyzer Call History & Analytics
              </h1>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium mt-0.5">
                Complete multi-day synchronized telephony logs, recordings, counselor performance, and advanced analytics.
              </p>
            </div>
          </div>
        </div>

        {/* Sync and Actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Quick Sync (Last 7 Days) */}
          <button
            type="button"
            id="callyzer-sync-btn"
            onClick={() => handleSyncSubmit({ days: 7 })}
            disabled={syncing}
            className="crm-btn-primary px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            title="Fetch recent 7 days call records from Callyzer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Synchronizing…' : 'Sync Recent (7d)'}</span>
          </button>

          {/* Historical Sync Dialog Opener */}
          <button
            type="button"
            onClick={() => setShowSyncModal(true)}
            disabled={syncing}
            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            title="Choose previous days or custom date range to pull past records from Callyzer"
          >
            <History className="w-3.5 h-3.5" />
            <span>Historical Sync…</span>
          </button>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="crm-btn-secondary px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            title="Export filtered call history to CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Refresh List */}
          <button
            type="button"
            onClick={fetchCalls}
            disabled={loading}
            className="crm-btn-secondary px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Refresh local list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Sync Feedback Toast Banner */}
      {syncFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{syncFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="text-xs font-bold hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-3.5 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
            Total Calls
          </div>
          <div className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-1 font-mono">
            {metrics.totalCalls}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Matching active filters
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-3.5 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
            Total Talk Time
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
            {metrics.durationText}
          </div>
          <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-medium mt-0.5">
            {metrics.totalSeconds} total seconds
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-3.5 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
            Answered
          </div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
            {metrics.completedCount}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            {metrics.totalCalls > 0 ? Math.round((metrics.completedCount / metrics.totalCalls) * 100) : 0}% connect rate
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-3.5 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
            Missed Calls
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
            {metrics.missedCount}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            Requires follow-up
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-3.5 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
            Rejected
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1 font-mono">
            {metrics.rejectedCount}
          </div>
          <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
            Declined on SIM
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-3.5 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wide">
            With Audio
          </div>
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1 font-mono">
            {metrics.recordedCount}
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
            Playable recordings
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] p-4 rounded-xl shadow-2xs space-y-3">
        {/* Row 1: Primary Search and Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              id="call-history-search-input"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search phone number, lead name, counselor, notes, ID..."
              className="w-full pl-9 pr-3 py-2 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>

          {/* Filter by Employee / Counselor */}
          <div>
            <select
              id="call-history-employee-filter"
              value={selectedEmployee}
              onChange={(e) => {
                setSelectedEmployee(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
            >
              <option value="ALL">All Counselors / Employees</option>
              {counselorsList.map((u) => {
                const displayName = (u.full_name || `${u.first_name || ''} ${u.last_name || ''}`).trim() || u.username;
                return (
                  <option key={u.id} value={String(u.id)}>
                    {displayName} {u.mobile_number ? `(${u.mobile_number})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filter by Call Direction */}
          <div>
            <select
              id="call-history-call-type-filter"
              value={selectedCallType}
              onChange={(e) => {
                setSelectedCallType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
            >
              <option value="ALL">All Directions</option>
              <option value="Outgoing">Outgoing Calls</option>
              <option value="Incoming">Incoming Calls</option>
              <option value="Missed">Missed Calls</option>
              <option value="Rejected">Rejected Calls</option>
            </select>
          </div>

          {/* Toggle Advanced Filters + Reset */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-[#2563EB] dark:text-[#60A5FA]'
                  : 'bg-[#F8FAFC] dark:bg-[#0F172A] border-[#CBD5E1] dark:border-[#334155] text-[#0F172A] dark:text-[#F8FAFC]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#2563EB] text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-2.5 py-2 text-xs font-semibold text-[#DC2626] hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition cursor-pointer"
                title="Reset all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#334155] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 animate-in fade-in duration-150">
            {/* Date Range Preset */}
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                Call Date Range
              </label>
              <select
                value={selectedDatePreset}
                onChange={(e) => {
                  setSelectedDatePreset(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today</option>
                <option value="YESTERDAY">Yesterday</option>
                <option value="LAST_7">Last 7 Days</option>
                <option value="LAST_30">Last 30 Days (Past Month)</option>
                <option value="LAST_90">Last 90 Days (Past 3 Months)</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="CUSTOM">Custom Date Range…</option>
              </select>
            </div>

            {/* Custom Date Pickers (if CUSTOM selected) */}
            {selectedDatePreset === 'CUSTOM' ? (
              <div className="md:col-span-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-2 py-1.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-2 py-1.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
              </div>
            ) : (
              /* Outcome / Status */
              <div>
                <label className="block text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                  Call Outcome
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-1.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="SUCCESS">Connected / Answered</option>
                  <option value="MISSED">Missed</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="FAILED">Failed / No Answer</option>
                  <option value="QUEUED">Queued on Handset</option>
                </select>
              </div>
            )}

            {/* Duration Range */}
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                Call Duration
              </label>
              <select
                value={selectedDuration}
                onChange={(e) => {
                  setSelectedDuration(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
              >
                <option value="ALL">Any Duration</option>
                <option value="CONNECTED">Connected Only (&gt; 0s)</option>
                <option value="SHORT">Short (&le; 30s)</option>
                <option value="MEDIUM">Medium (30s – 2m)</option>
                <option value="LONG">Long (2m – 5m)</option>
                <option value="VERY_LONG">Detailed (&gt; 5m)</option>
                <option value="ZERO">Unanswered (0s)</option>
              </select>
            </div>

            {/* Audio Recording Filter */}
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                Audio Recording
              </label>
              <select
                value={selectedRecording}
                onChange={(e) => {
                  setSelectedRecording(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
              >
                <option value="ALL">All Records</option>
                <option value="WITH_RECORDING">With Audio Recording</option>
                <option value="NO_RECORDING">No Recording</option>
              </select>
            </div>

            {/* Lead Linkage & Sort By */}
            <div>
              <label className="block text-[10px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                Sort Order
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
              >
                <option value="NEWEST">Newest Calls First</option>
                <option value="OLDEST">Oldest Calls First</option>
                <option value="LONGEST">Longest Duration First</option>
                <option value="SHORTEST">Shortest Duration First</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Historical Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] dark:border-[#334155]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Historical Call Sync
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Ingest past call records and audio from Callyzer
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-2">
                  Select History Window to Synchronize:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Past 7 Days', value: '7' },
                    { label: 'Past 30 Days (1 Month)', value: '30' },
                    { label: 'Past 60 Days (2 Months)', value: '60' },
                    { label: 'Past 90 Days (3 Months)', value: '90' },
                    { label: 'Past 180 Days (6 Months)', value: '180' },
                    { label: 'Custom Date Range', value: 'CUSTOM' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSyncDays(opt.value)}
                      className={`p-2.5 rounded-xl border text-left font-medium transition cursor-pointer ${
                        syncDays === opt.value
                          ? 'border-[#2563EB] bg-blue-50/70 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#60A5FA] font-bold'
                          : 'border-[#CBD5E1] dark:border-[#334155] hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] text-[#0F172A] dark:text-[#F8FAFC]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {syncDays === 'CUSTOM' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                      Start Date:
                    </label>
                    <input
                      type="date"
                      value={customSyncStart}
                      onChange={(e) => setCustomSyncStart(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] mb-1">
                      End Date:
                    </label>
                    <input
                      type="date"
                      value={customSyncEnd}
                      onChange={(e) => setCustomSyncEnd(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC]"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                <strong>Tip for Live Accounts:</strong> To pull past months of real calls, verify that your CRM is connected to the Callyzer Production API (<code>https://api.callyzer.co/api/v2.1</code>) rather than the Sandbox mock.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#E2E8F0] dark:border-[#334155]">
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="crm-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={syncing || (syncDays === 'CUSTOM' && (!customSyncStart || !customSyncEnd))}
                onClick={() => {
                  if (syncDays === 'CUSTOM') {
                    handleSyncSubmit({ start_date: customSyncStart, end_date: customSyncEnd });
                  } else {
                    handleSyncSubmit({ days: Number(syncDays) });
                  }
                }}
                className="crm-btn-primary px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>Start Historical Sync</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Records Table */}
      <div className="bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] rounded-xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#64748B] dark:text-[#94A3B8]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#2563EB]" />
            <p className="text-xs font-medium">Loading call records from database…</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-[#64748B] dark:text-[#94A3B8]">
            <PhoneMissed className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">No call records found</p>
            <p className="text-xs mt-1">
              Try adjusting your date range / search filters, or click "Historical Sync" to pull past months from Callyzer.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]/50 text-[#64748B] dark:text-[#94A3B8] font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Counselor / Employee</th>
                  <th className="py-3 px-4">Customer / Lead Number</th>
                  <th className="py-3 px-4">Direction & Type</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Actual Call Time</th>
                  <th className="py-3 px-4">Audio Recording</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                {paginatedLogs.map((log) => {
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[#F8FAFC] dark:hover:bg-[#172033]/60 transition-colors"
                    >
                      {/* Counselor / Employee */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-[#2563EB] dark:text-[#60A5FA] flex items-center justify-center font-bold text-xs shrink-0">
                            {(log.initiated_by_name || 'U')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                              {log.initiated_by_name || 'Counselor SIM'}
                            </div>
                            <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-mono">
                              {log.initiated_by_mobile || 'SIM registered'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Customer / Lead Number */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="flex items-center gap-1.5 font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            <span>{log.recipient}</span>
                            {log.tel_url && (
                              <a
                                href={log.tel_url}
                                className="text-[#2563EB] hover:text-[#1D4ED8] p-0.5 rounded transition"
                                title={`Direct dial ${log.recipient}`}
                              >
                                <Phone className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          {log.lead ? (
                            <div className="mt-0.5 flex items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                <UserCheck className="w-2.5 h-2.5" />
                                {log.lead_title || `Lead #${log.lead}`}
                              </span>
                            </div>
                          ) : (
                            <div className="mt-0.5">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                <UserX className="w-2.5 h-2.5" />
                                Unmatched SIM
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Direction & Type */}
                      <td className="py-3.5 px-4">
                        {renderCallTypeBadge(log.call_type)}
                      </td>

                      {/* Outcome */}
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(log.status, log.call_duration)}
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4">
                        <span className={`font-mono font-semibold text-xs ${
                          Number(log.call_duration || 0) > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-[#64748B] dark:text-[#94A3B8]'
                        }`}>
                          {formatDuration(log.call_duration)}
                        </span>
                      </td>

                      {/* Call Time */}
                      <td className="py-3.5 px-4 text-[#0F172A] dark:text-[#F8FAFC] font-mono text-[11px]">
                        <div className="font-medium">
                          {formatDateTime(log.call_datetime || log.created_at)}
                        </div>
                        {log.synced_at && (
                          <div className="text-[9px] text-[#94A3B8] dark:text-[#64748B]">
                            Synced: {new Date(log.synced_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Audio Recording */}
                      <td className="py-3.5 px-4">
                        {log.call_recording_url ? (
                          <div className="flex items-center gap-2">
                            <audio
                              controls
                              preload="none"
                              src={log.call_recording_url}
                              className="h-7 w-44 rounded"
                            >
                              Your browser does not support audio playback.
                            </audio>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#94A3B8] dark:text-[#64748B] italic">
                            No recording
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {log.lead && onOpen360 ? (
                          <button
                            type="button"
                            onClick={() => {
                              onOpen360({
                                id: log.lead!,
                                title: log.lead_title || '',
                                phone: log.recipient,
                              } as Lead);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#2563EB] hover:text-white hover:bg-[#2563EB] border border-[#BFDBFE] dark:border-[#1E40AF] rounded-md transition cursor-pointer"
                            title="Open Lead 360 Workspace"
                          >
                            <span>Lead 360</span>
                          </button>
                        ) : !log.lead && onOpenCreateLeadWithNumber ? (
                          <button
                            type="button"
                            onClick={() => onOpenCreateLeadWithNumber(log.recipient)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md transition cursor-pointer"
                            title="Register new Lead for this caller"
                          >
                            <span>Create Lead</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#94A3B8] font-mono">
                            {log.external_reference_id ? log.external_reference_id.slice(0, 8) + '…' : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredLogs.length > 0 && (
          <div className="py-3 px-4 border-t border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A]/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <div className="flex items-center gap-2">
              <span>Showing</span>
              <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                {Math.min(filteredLogs.length, (currentPage - 1) * pageSize + 1)}–
                {Math.min(filteredLogs.length, currentPage * pageSize)}
              </span>
              <span>of</span>
              <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{filteredLogs.length}</span>
              <span>records</span>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="ml-2 px-2 py-1 bg-white dark:bg-[#1E293B] border border-[#CBD5E1] dark:border-[#334155] rounded text-xs text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-[#F8FAFC] disabled:opacity-30 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-mono font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-[#F8FAFC] disabled:opacity-30 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
