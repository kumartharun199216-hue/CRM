import React, { useMemo, useState, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  PaginationState,
  FilterFn,
} from '@tanstack/react-table';
import { Lead, PipelineStage, User } from '../types';
import {
  Search,
  Phone,
  Mail,
  MessageSquare,
  History,
  Edit,
  ArrowUpDown,
  GraduationCap,
  Calendar,
  IndianRupee,
  ScanEye,
  UserCheck,
  ArrowRightCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
  RotateCcw,
} from 'lucide-react';

interface SpreadsheetViewProps {
  leads: Lead[];
  stages: PipelineStage[];
  users?: User[];
  currentUser: User;
  selectedStageId?: number | null;
  initialCounsellorId?: number | string | null;
  quickFilter?: 'OVERDUE' | 'MISSING_FINANCIAL' | 'ACTIVE' | 'UNASSIGNED' | string | null;
  onClearQuickFilter?: () => void;
  onOpenLead: (lead: Lead) => void;
  onOpen360?: (lead: Lead) => void;
  onOpenHistory: (lead: Lead) => void;
  onCommunicate: (lead: Lead, channel: 'EMAIL' | 'WHATSAPP' | 'CALL') => void;
  onAssignLead?: (leadId: number, employeeId: number) => Promise<void>;
  onChangeStage?: (lead: Lead) => void;
  onOpenImport?: () => void;
  initialPageSize?: number;
  initialPageIndex?: number;
  initialSearch?: string;
  onPaginationChange?: (page: number, pageSize: number) => void;
  onSearchChange?: (search: string) => void;
  onStageChange?: (stage: string) => void;
}

const renderEmpty = () => <span className="text-[#94A3B8] dark:text-slate-500">—</span>;

export interface StageColorConfig {
  badge: string;
  dot: string;
}

export const getStageStyle = (stageName: string | null | undefined): StageColorConfig => {
  if (!stageName) {
    return {
      badge: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/90 dark:text-slate-300 dark:border-slate-700',
      dot: 'bg-slate-400 dark:bg-slate-500',
    };
  }

  const s = stageName.toLowerCase().trim();

  // 1. Won / Enrolled / Admission / Converted / Closed Won
  if (s.includes('enrolled') || s.includes('won') || s.includes('admission') || s.includes('converted') || s.includes('closed won')) {
    return {
      badge: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700/80',
      dot: 'bg-emerald-500 dark:bg-emerald-400',
    };
  }

  // 2. Pending Closure / Negotiation / Pre-closer / Closer
  if (s.includes('pending closure') || s.includes('negotiat') || s.includes('closer') || s.includes('closing')) {
    return {
      badge: 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-700/80',
      dot: 'bg-purple-500 dark:bg-purple-400',
    };
  }

  // 3. Cold Calling / Intake / Prospect / New Lead / Fresh
  if (s.includes('cold call') || s.includes('intake') || s.includes('new lead') || s.includes('prospect') || s.includes('fresh')) {
    return {
      badge: 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-700/80',
      dot: 'bg-sky-500 dark:bg-sky-400',
    };
  }

  // 4. Follow Up / Call Scheduled / Contacted / Callback
  if (s.includes('follow') || s.includes('contact') || s.includes('callback') || s.includes('call sched')) {
    return {
      badge: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/80',
      dot: 'bg-amber-500 dark:bg-amber-400',
    };
  }

  // 5. Counseling / Pitch / Demo / Meeting / Assessment / Interview
  if (s.includes('counsel') || s.includes('demo') || s.includes('pitch') || s.includes('meet') || s.includes('interview') || s.includes('assess')) {
    return {
      badge: 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-700/80',
      dot: 'bg-indigo-500 dark:bg-indigo-400',
    };
  }

  // 6. Lost / Dropped / Not Interested / Disqualified / Junk / Reject
  if (s.includes('lost') || s.includes('drop') || s.includes('not interest') || s.includes('disqual') || s.includes('junk') || s.includes('reject')) {
    return {
      badge: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700/80',
      dot: 'bg-rose-500 dark:bg-rose-400',
    };
  }

  // 7. Not Connected / Unreachable / Switch Off / Busy / RNR
  if (s.includes('not connect') || s.includes('unreach') || s.includes('switch off') || s.includes('busy') || s.includes('rnr') || s.includes('no answer')) {
    return {
      badge: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700',
      dot: 'bg-slate-400 dark:bg-slate-500',
    };
  }

  // 8. Dynamic hash palette for custom user-created pipeline stages
  const palettes = [
    { badge: 'bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-700/80', dot: 'bg-teal-500 dark:bg-teal-400' },
    { badge: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-700/80', dot: 'bg-blue-500 dark:bg-blue-400' },
    { badge: 'bg-cyan-50 text-cyan-800 border-cyan-300 dark:bg-cyan-950/70 dark:text-cyan-300 dark:border-cyan-700/80', dot: 'bg-cyan-500 dark:bg-cyan-400' },
    { badge: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-300 dark:bg-fuchsia-950/70 dark:text-fuchsia-300 dark:border-fuchsia-700/80', dot: 'bg-fuchsia-500 dark:bg-fuchsia-400' },
    { badge: 'bg-orange-50 text-orange-900 border-orange-300 dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-700/80', dot: 'bg-orange-500 dark:bg-orange-400' },
  ];
  let hash = 0;
  for (let i = 0; i < stageName.length; i++) {
    hash = (hash << 5) - hash + stageName.charCodeAt(i);
    hash |= 0;
  }
  return palettes[Math.abs(hash) % palettes.length];
};

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
  leads,
  stages,
  users = [],
  currentUser,
  selectedStageId,
  initialCounsellorId,
  quickFilter = null,
  onClearQuickFilter,
  onOpenLead,
  onOpen360 = () => {},
  onOpenHistory,
  onCommunicate,
  onAssignLead,
  onChangeStage,
  onOpenImport,
  initialPageSize = 50,
  initialPageIndex = 1,
  initialSearch = '',
  onPaginationChange,
  onSearchChange,
  onStageChange,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState(initialSearch);
  const [stageFilter, setStageFilter] = useState<string>(
    selectedStageId ? selectedStageId.toString() : 'ALL'
  );
  const [counsellorFilter, setCounsellorFilter] = useState<string>(
    initialCounsellorId ? initialCounsellorId.toString() : 'ALL'
  );
  const [quickFilterState, setQuickFilterState] = useState<string | null>(
    quickFilter || null
  );
  const [assigningLeadId, setAssigningLeadId] = useState<number | null>(null);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: initialPageIndex > 0 ? initialPageIndex - 1 : 0,
    pageSize: [10, 25, 50, 100].includes(initialPageSize) ? initialPageSize : 50,
  });

  useEffect(() => {
    if (selectedStageId !== undefined) {
      setStageFilter(selectedStageId === null ? 'ALL' : selectedStageId.toString());
    }
  }, [selectedStageId]);

  useEffect(() => {
    if (initialCounsellorId !== undefined && initialCounsellorId !== null) {
      setCounsellorFilter(initialCounsellorId.toString());
    }
  }, [initialCounsellorId]);

  useEffect(() => {
    if (quickFilter !== undefined) {
      setQuickFilterState(quickFilter);
    }
  }, [quickFilter]);

  useEffect(() => {
    if (initialSearch !== undefined && initialSearch !== globalFilter) {
      setGlobalFilter(initialSearch);
    }
  }, [initialSearch]);

  const isAdmin = currentUser.role === 'ADMIN';
  const isManager = currentUser.role === 'MANAGER';
  const canEditOrReassign = (lead: Lead) => {
    if (isAdmin) return true;
    if (isManager) {
      const authorizedTeamId = currentUser.managed_team_id || currentUser.team;
      return lead.team === authorizedTeamId;
    }
    return lead.assigned_employee === currentUser.id;
  };

  const handleAssignChange = async (leadId: number, newEmpId: number) => {
    if (!onAssignLead || !newEmpId) return;
    setAssigningLeadId(leadId);
    try {
      await onAssignLead(leadId, newEmpId);
    } finally {
      setAssigningLeadId(null);
    }
  };

  // Filter available counsellors / sales employees for counsellor filter dropdown
  const salesEmployees = useMemo(() => {
    return users.filter((u) => {
      if (u.role !== 'SALES_EMPLOYEE' && u.role !== 'MANAGER') return false;
      if (isAdmin) return true;
      const authorizedTeamId = currentUser.managed_team_id || currentUser.team;
      return u.team === authorizedTeamId;
    });
  }, [users, isAdmin, currentUser]);

  // Stage & Counsellor Filtered Data
  const filteredData = useMemo(() => {
    let result = leads;

    // Quick filter drill-downs
    if (quickFilterState === 'OVERDUE') {
      const now = new Date();
      result = result.filter((l) => {
        if (!l.next_follow_up) return false;
        try {
          return new Date(l.next_follow_up) < now;
        } catch {
          return false;
        }
      });
    } else if (quickFilterState === 'MISSING_FINANCIAL') {
      result = result.filter((l) => {
        const isPending =
          l.stage_name === 'Pending Closure' ||
          stages.some((s) => s.id === l.stage && s.name === 'Pending Closure');
        return isPending && !l.pre_closer_financial && !l.pending_closure_financial;
      });
    } else if (quickFilterState === 'ACTIVE') {
      result = result.filter((l) => {
        const sName = (l.stage_name || '').toLowerCase();
        return !sName.includes('lost') && !sName.includes('enrolled');
      });
    } else if (quickFilterState === 'UNASSIGNED') {
      result = result.filter((l) => !l.assigned_employee);
    }

    // Stage filter
    if (stageFilter === 'UNASSIGNED') {
      result = result.filter((l) => !l.stage);
    } else if (stageFilter !== 'ALL') {
      result = result.filter((l) => l.stage?.toString() === stageFilter);
    }

    // Counsellor / Employee filter
    if (counsellorFilter === 'UNASSIGNED') {
      result = result.filter((l) => !l.assigned_employee);
    } else if (counsellorFilter !== 'ALL') {
      result = result.filter((l) => l.assigned_employee?.toString() === counsellorFilter);
    }

    return result;
  }, [leads, stages, stageFilter, counsellorFilter, quickFilterState]);

  const hasActiveFilters =
    (globalFilter && globalFilter.trim() !== '') ||
    stageFilter !== 'ALL' ||
    counsellorFilter !== 'ALL' ||
    Boolean(quickFilterState);

  const handleResetFilters = () => {
    setGlobalFilter('');
    setStageFilter('ALL');
    setCounsellorFilter('ALL');
    setQuickFilterState(null);
    onClearQuickFilter?.();
    onSearchChange?.('');
    onStageChange?.('ALL');
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  // Comprehensive custom search filter across all relevant lead fields
  const globalFilterFn: FilterFn<Lead> = (row, _columnId, filterValue) => {
    if (!filterValue) return true;
    const search = String(filterValue).toLowerCase().trim();
    const lead = row.original;
    const searchableFields = [
      lead.lead_id,
      lead.name,
      lead.title,
      lead.contact_name,
      lead.email,
      lead.phone,
      lead.qualification,
      lead.college,
      lead.yop,
      lead.key_skills,
      lead.target_role,
      lead.experience,
      lead.stage_name,
      lead.priority,
      lead.status,
      lead.assigned_employee_name,
      lead.career_counsellor,
      lead.city,
    ];
    return searchableFields.some(
      (field) => field && String(field).toLowerCase().includes(search)
    );
  };

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      // 1. Lead ID
      {
        accessorKey: 'lead_id',
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold text-xs text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Lead ID
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: (info) => {
          const lead = info.row.original;
          const val = info.getValue<string>();
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen360(lead);
              }}
              className="font-mono text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:text-[#1D4ED8] dark:hover:text-[#93C5FD] hover:underline block text-left cursor-pointer"
              title="Open Lead 360° View"
            >
              {val || `#${lead.id}`}
            </button>
          );
        },
      },
      // 2. Student Name
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold text-xs text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Student Name
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        cell: (info) => {
          const lead = info.row.original;
          const displayName = info.getValue<string>() || lead.title || lead.contact_name;
          return displayName ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen360(lead);
              }}
              className="font-semibold text-[#0F172A] dark:text-slate-100 hover:text-[#2563EB] dark:hover:text-[#60A5FA] transition text-left truncate max-w-[180px] block cursor-pointer"
              title={`${displayName} - Click for 360° View`}
            >
              {displayName}
            </button>
          ) : (
            renderEmpty()
          );
        },
      },
      // 3. Mobile Phone
      {
        accessorKey: 'phone',
        header: 'Mobile Phone',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <span className="text-[#0F172A] dark:text-slate-200 text-xs font-mono">{val}</span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 4. Email
      {
        accessorKey: 'email',
        header: 'Email',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="text-[#475569] dark:text-slate-300 text-xs font-mono truncate max-w-[160px]" title={val}>
              {val}
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 5. Pipeline Stage (with Pending Closure financial indicator if agreement exists)
      {
        accessorKey: 'stage_name',
        header: 'Pipeline Stage',
        cell: (info) => {
          const lead = info.row.original;
          const stageName = info.getValue<string | null>();
          const hasFinancialAgreement = Boolean(
            lead.pending_closure_financial || lead.pre_closer_financial
          );
          const stageStyle = getStageStyle(stageName);

          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap shadow-xs ${stageStyle.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stageStyle.dot}`} />
                {stageName || 'Unassigned'}
              </span>

              {hasFinancialAgreement && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen360(lead);
                  }}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FAF5FF] dark:bg-purple-950/70 text-[#7C3AED] dark:text-purple-300 border border-[#DDD6FE] dark:border-purple-700/80 hover:bg-[#EDE9FE] dark:hover:bg-purple-900/60 transition cursor-pointer shrink-0 shadow-xs"
                  title="Financial agreement recorded. Click to view full details in Lead 360°"
                >
                  <IndianRupee className="w-2.5 h-2.5 text-[#7C3AED] dark:text-purple-300" />
                  <span>Financials</span>
                </button>
              )}
            </div>
          );
        },
      },
      // 6. Degree / Qualification
      {
        accessorKey: 'qualification',
        header: 'Degree / Qualification',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="flex items-center gap-1 text-[#0F172A] dark:text-slate-200 text-xs truncate max-w-[150px]" title={val}>
              <GraduationCap className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 shrink-0" />
              <span className="truncate">{val}</span>
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 7. College / University
      {
        accessorKey: 'college',
        header: 'College / University',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="text-[#0F172A] dark:text-slate-200 text-xs truncate max-w-[160px]" title={val}>
              {val}
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 8. Year of Passing (YOP)
      {
        accessorKey: 'yop',
        header: 'YOP',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? <span className="text-[#64748B] dark:text-slate-300 text-xs font-mono">{val}</span> : renderEmpty();
        },
      },
      // 9. Key Skills
      {
        accessorKey: 'key_skills',
        header: 'Key Skills',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="text-[#0F172A] dark:text-slate-200 text-xs truncate max-w-[160px]" title={val}>
              {val}
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 10. Target Role
      {
        accessorKey: 'target_role',
        header: 'Target Role',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF6FF] dark:bg-blue-950/50 text-[#2563EB] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-800/70">
              {val}
            </span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 11. Experience
      {
        accessorKey: 'experience',
        header: 'Experience',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? <span className="text-[#0F172A] dark:text-slate-200 text-xs">{val}</span> : renderEmpty();
        },
      },
      // 12. Priority
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: (info) => {
          const val = info.getValue<string>();
          if (!val) return renderEmpty();
          const low = val.toLowerCase();
          const isHigh = low === 'high' || low === 'urgent';
          const isMed = low === 'medium' || low === 'mid';
          const badgeClass = isHigh
            ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/70'
            : isMed
            ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70'
            : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700';
          return (
            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${badgeClass}`}>
              {val}
            </span>
          );
        },
      },
      // 13. Status
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? <span className="text-[#0F172A] dark:text-slate-200 text-xs">{val}</span> : renderEmpty();
        },
      },
      // 14. Assigned To (Interactive Assignment for Admin/Manager)
      {
        accessorKey: 'assigned_employee_name',
        header: 'Assigned To',
        cell: ({ row }) => {
          const lead = row.original;
          const canAssign =
            isAdmin || (isManager && (currentUser.managed_team_id || currentUser.team) === lead.team);

          if (canAssign && onAssignLead && users.length > 0) {
            // Filter eligible employees for this lead's team
            const teamEmployees = users.filter((u) => {
              if (u.role !== 'SALES_EMPLOYEE') return false;
              if (isAdmin) return !lead.team || u.team === lead.team;
              const authorizedTeamId = currentUser.managed_team_id || currentUser.team;
              return u.team === authorizedTeamId;
            });

            return (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <select
                  value={lead.assigned_employee || ''}
                  onChange={(e) => handleAssignChange(lead.id, Number(e.target.value))}
                  disabled={assigningLeadId === lead.id}
                  className="text-xs bg-white dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded px-2 py-1 text-[#2563EB] dark:text-blue-400 font-medium focus:outline-none focus:border-[#2563EB] dark:focus:border-blue-400 max-w-[150px] truncate disabled:opacity-50 cursor-pointer"
                  title="Assign lead to employee"
                >
                  <option value="">Select Employee</option>
                  {teamEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.username}
                    </option>
                  ))}
                </select>
                {assigningLeadId === lead.id && (
                  <span className="text-[10px] text-[#2563EB] dark:text-blue-400 animate-pulse">Saving...</span>
                )}
              </div>
            );
          }

          const empName = lead.assigned_employee_name || lead.career_counsellor;
          return empName ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF6FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-300 border border-[#BFDBFE] dark:border-blue-800/70">
              <UserCheck className="w-3 h-3 text-[#2563EB] dark:text-blue-400" />
              {empName}
            </span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 15. Career Counsellor
      {
        accessorKey: 'career_counsellor',
        header: 'Career Counsellor',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="text-[#0F172A] dark:text-slate-200 text-xs truncate max-w-[130px]" title={val}>
              {val}
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 16. City / Location
      {
        accessorKey: 'city',
        header: 'City / Location',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? <span className="text-[#0F172A] dark:text-slate-200 text-xs">{val}</span> : renderEmpty();
        },
      },
      // 17. Next Follow-up
      {
        accessorKey: 'next_follow_up',
        header: 'Next Follow-up',
        cell: (info) => {
          const val = info.getValue<string | null>();
          if (!val) return renderEmpty();
          try {
            const date = new Date(val);
            return (
              <div className="flex items-center gap-1 text-[#0F172A] dark:text-slate-200 text-xs whitespace-nowrap">
                <Calendar className="w-3 h-3 text-[#64748B] dark:text-slate-400 shrink-0" />
                <span>
                  {date.toLocaleDateString()}{' '}
                  {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          } catch {
            return <span className="text-[#0F172A] dark:text-slate-200 text-xs">{val}</span>;
          }
        },
      },
      // 18. Quick Connect (Fixed column 2nd from right)
      {
        id: 'quick_connect',
        header: 'Quick Connect',
        size: 120,
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => onCommunicate(lead, 'CALL')}
                className="p-1 hover:bg-[#EFF6FF] dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400 hover:text-[#2563EB] dark:hover:text-[#60A5FA] rounded transition cursor-pointer"
                title="Initiate Call (Callyzer)"
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onCommunicate(lead, 'WHATSAPP')}
                className="p-1 hover:bg-[#EFF6FF] dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400 hover:text-[#16A34A] dark:hover:text-[#4ADE80] rounded transition cursor-pointer"
                title="Send WhatsApp Message"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onCommunicate(lead, 'EMAIL')}
                className="p-1 hover:bg-[#EFF6FF] dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400 hover:text-[#7C3AED] dark:hover:text-[#C084FC] rounded transition cursor-pointer"
                title="Send Email (Google SMTP)"
              >
                <Mail className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        },
      },
      // 19. Actions (Fixed column on far right)
      {
        id: 'actions',
        header: 'Actions',
        size: 185,
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {/* Lead 360 View Button */}
              <button
                type="button"
                onClick={() => onOpen360(lead)}
                className="px-2 py-1 bg-[#EFF6FF] hover:bg-[#DBEAFE] dark:bg-blue-950/60 dark:hover:bg-blue-900/60 border border-[#BFDBFE] dark:border-blue-800/80 text-[#2563EB] dark:text-blue-300 rounded text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer shrink-0"
                title="Lead 360° View (All details, history, timeline, financials)"
              >
                <ScanEye className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-300" />
                <span>360°</span>
              </button>

              {/* Change Stage Button */}
              {canEditOrReassign(lead) && onChangeStage && (
                <button
                  type="button"
                  onClick={() => onChangeStage(lead)}
                  className="px-2 py-1 bg-[#F5F3FF] hover:bg-[#EDE9FE] dark:bg-purple-950/60 dark:hover:bg-purple-900/60 border border-[#DDD6FE] dark:border-purple-800/80 text-[#7C3AED] dark:text-purple-300 rounded text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer shrink-0"
                  title="Change Pipeline Stage (with mandatory reason note)"
                >
                  <ArrowRightCircle className="w-3.5 h-3.5 text-[#7C3AED] dark:text-purple-300" />
                  <span>Stage</span>
                </button>
              )}

              {/* Edit Lead Button */}
              {canEditOrReassign(lead) && (
                <button
                  type="button"
                  onClick={() => onOpenLead(lead)}
                  className="p-1 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400 hover:text-[#2563EB] dark:hover:text-[#60A5FA] rounded transition cursor-pointer shrink-0"
                  title="Edit Complete Lead Details"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              )}

              {/* History Button */}
              <button
                type="button"
                onClick={() => onOpenHistory(lead)}
                className="p-1 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-400 hover:text-[#7C3AED] dark:hover:text-[#C084FC] rounded transition cursor-pointer shrink-0"
                title="View Assignment & Stage History"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        },
      },
    ],
    [
      currentUser,
      users,
      isAdmin,
      isManager,
      assigningLeadId,
      onCommunicate,
      onOpen360,
      onOpenHistory,
      onOpenLead,
      onAssignLead,
      onChangeStage,
    ]
  );

  const handleStageChange = (val: string) => {
    setStageFilter(val);
    onStageChange?.(val);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const handleCounsellorChange = (val: string) => {
    setCounsellorFilter(val);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const table = useReactTable({
    data: filteredData,
    columns,
    globalFilterFn,
    state: {
      sorting,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: (val) => {
      setGlobalFilter(val);
      onSearchChange?.(typeof val === 'string' ? val : '');
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    onPaginationChange: (updater) => {
      setPagination((old) => {
        const next = typeof updater === 'function' ? updater(old) : updater;
        onPaginationChange?.(next.pageIndex + 1, next.pageSize);
        return next;
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4 font-sans">
      {/* Quick Filter Active Banner from Drill-down */}
      {quickFilterState && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl text-xs text-[#1E40AF] shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold">Active Drill-down Filter:</span>
            <span className="px-2.5 py-0.5 bg-[#DBEAFE] text-[#1E40AF] border border-[#93C5FD] rounded-full font-semibold">
              {quickFilterState === 'OVERDUE' && 'Overdue Follow-ups'}
              {quickFilterState === 'MISSING_FINANCIAL' && 'Pending Closure Leads Missing Financial Records'}
              {quickFilterState === 'ACTIVE' && 'Active Pipeline Leads (Excluding Lost & Enrolled)'}
              {quickFilterState === 'UNASSIGNED' && 'Unassigned Leads'}
              {!['OVERDUE', 'MISSING_FINANCIAL', 'ACTIVE', 'UNASSIGNED'].includes(quickFilterState) &&
                `Quick Filter: ${quickFilterState}`}
            </span>
            <span className="text-[11px] text-[#3B82F6]">
              Showing {filteredData.length} matching lead{filteredData.length === 1 ? '' : 's'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuickFilterState(null);
              onClearQuickFilter?.();
            }}
            className="flex items-center gap-1 text-xs text-[#2563EB] hover:text-[#1D4ED8] font-bold cursor-pointer transition ml-2"
          >
            <X className="w-3.5 h-3.5" /> Clear Filter
          </button>
        </div>
      )}

      {/* Top Filter and Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#172033] p-3.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B] dark:text-[#94A3B8]" />
            <input
              type="text"
              value={globalFilter ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setGlobalFilter(val);
                onSearchChange?.(val);
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
              }}
              placeholder="Search leads by ID, name, email, skills, phone..."
              aria-label="Search leads"
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-lg text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition font-sans"
            />
            {globalFilter && (
              <button
                type="button"
                onClick={() => {
                  setGlobalFilter('');
                  onSearchChange?.('');
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                }}
                className="absolute right-2.5 top-2.5 text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Stage & Counsellor Filters + Import Button */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Stage Filter */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="spreadsheet-stage-filter" className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
              Stage:
            </label>
            <select
              id="spreadsheet-stage-filter"
              value={stageFilter}
              onChange={(e) => handleStageChange(e.target.value)}
              className="text-xs bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition font-sans cursor-pointer max-w-[180px] truncate"
            >
              <option value="ALL">All Leads ({leads.length})</option>
              <option value="UNASSIGNED">Unassigned Stage</option>
              {stages.map((st) => (
                <option key={st.id} value={st.id.toString()}>
                  {st.order}. {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* Counsellor Filter (for Admin and Manager) */}
          {(isAdmin || isManager) && salesEmployees.length > 0 && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="spreadsheet-counsellor-filter" className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
                Counsellor:
              </label>
              <select
                id="spreadsheet-counsellor-filter"
                value={counsellorFilter}
                onChange={(e) => handleCounsellorChange(e.target.value)}
                className="text-xs bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-lg px-2.5 py-1.5 text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] dark:focus:border-[#60A5FA] transition font-sans cursor-pointer max-w-[160px] truncate"
              >
                <option value="ALL">All Counsellors</option>
                <option value="UNASSIGNED">Unassigned</option>
                {salesEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id.toString()}>
                    {emp.username}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-[#64748B] dark:text-[#94A3B8] hover:text-[#2563EB] dark:hover:text-[#60A5FA] flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] hover:border-[#BFDBFE] bg-white dark:bg-[#172033] transition cursor-pointer"
              title="Reset search and filters"
            >
              <RotateCcw className="w-3 h-3 text-[#64748B] dark:text-[#94A3B8]" />
              <span>Reset</span>
            </button>
          )}

          {/* Bulk Import Leads Button */}
          {(isAdmin || isManager) && onOpenImport && (
            <button
              type="button"
              id="spreadsheet-import-leads-btn"
              onClick={onOpenImport}
              className="crm-btn-primary px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Bulk Import Leads from CSV/Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              <span>Import Leads</span>
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Table with Horizontal Scrolling & Sticky Action Columns */}
      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#172033] shadow-xs max-w-full relative">
        <table className="min-w-max w-full text-left border-collapse text-xs font-sans">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827]">
                {headerGroup.headers.map((header) => {
                  const isQuickConnect = header.id === 'quick_connect';
                  const isActions = header.id === 'actions';
                  const stickyStyle = isActions
                    ? 'sticky right-0 z-30 bg-[#F8FAFC] dark:bg-[#111827] border-l border-[#E2E8F0] dark:border-[#334155] min-w-[185px] w-[185px]'
                    : isQuickConnect
                    ? 'sticky right-[185px] z-30 bg-[#F8FAFC] dark:bg-[#111827] border-l border-[#E2E8F0] dark:border-[#334155] shadow-[-4px_0_8px_rgba(15,23,42,0.04)] min-w-[120px] w-[120px]'
                    : '';

                  return (
                    <th
                      key={header.id}
                      className={`p-3 font-semibold text-[#64748B] dark:text-[#CBD5E1] border-r border-[#E2E8F0] dark:border-[#334155] last:border-r-0 whitespace-nowrap tracking-wider text-[11px] ${stickyStyle}`}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-16 px-4">
                  <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                    <div className="w-10 h-10 rounded-full bg-[#EFF6FF] dark:bg-blue-950/60 border border-[#BFDBFE] dark:border-blue-800/80 flex items-center justify-center text-[#2563EB] dark:text-blue-300">
                      <Search className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">No lead records found</h4>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                        {hasActiveFilters
                          ? 'No leads match your active filters or search criteria. Try modifying your search or reset filters.'
                          : 'No student leads available in the selected view.'}
                      </p>
                    </div>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="px-3 py-1.5 bg-[#EFF6FF] hover:bg-[#DBEAFE] dark:bg-blue-950/60 dark:hover:bg-blue-900/60 border border-[#BFDBFE] dark:border-blue-800/80 text-[#2563EB] dark:text-blue-300 text-xs font-semibold rounded-lg transition cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onOpen360(row.original)}
                  className="border-b border-[#E2E8F0] dark:border-[#273449] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition-colors group cursor-pointer"
                  title="Click to open Lead 360 Workspace"
                >
                  {row.getVisibleCells().map((cell) => {
                    const isQuickConnect = cell.column.id === 'quick_connect';
                    const isActions = cell.column.id === 'actions';
                    const stickyStyle = isActions
                      ? 'sticky right-0 z-20 bg-white dark:bg-[#172033] group-hover:bg-[#F8FAFC] dark:group-hover:bg-[#1E293B] border-l border-[#E2E8F0] dark:border-[#334155] min-w-[185px] w-[185px] transition-colors'
                      : isQuickConnect
                      ? 'sticky right-[185px] z-20 bg-white dark:bg-[#172033] group-hover:bg-[#F8FAFC] dark:group-hover:bg-[#1E293B] border-l border-[#E2E8F0] dark:border-[#334155] shadow-[-4px_0_8px_rgba(15,23,42,0.04)] min-w-[120px] w-[120px] transition-colors'
                      : '';

                    return (
                      <td
                        key={cell.id}
                        className={`p-3 border-r border-[#E2E8F0] dark:border-[#334155] last:border-r-0 text-[#0F172A] dark:text-[#F8FAFC] align-middle whitespace-nowrap ${stickyStyle}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-xl shadow-xs text-xs text-[#64748B] dark:text-[#94A3B8] font-sans">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label htmlFor="page-size-selector" className="font-medium text-[#475569] dark:text-[#CBD5E1]">
              Rows per page:
            </label>
            <select
              id="page-size-selector"
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                table.setPageSize(newSize);
                onPaginationChange?.(1, newSize);
              }}
              className="px-2.5 py-1 bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              {[10, 25, 50, 100].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[#CBD5E1] dark:text-[#334155]">|</span>

          <span className="font-medium text-[#475569] dark:text-[#CBD5E1]">
            Showing{' '}
            <strong className="text-[#0F172A] dark:text-[#F8FAFC]">
              {filteredData.length === 0
                ? 0
                : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            </strong>
            -
            <strong className="text-[#0F172A] dark:text-[#F8FAFC]">
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                filteredData.length
              )}
            </strong>{' '}
            of <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{filteredData.length}</strong> leads
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-medium text-[#475569] dark:text-[#CBD5E1]">
            Page{' '}
            <strong className="text-[#0F172A] dark:text-[#F8FAFC]">
              {table.getPageCount() === 0 ? 0 : table.getState().pagination.pageIndex + 1}
            </strong>{' '}
            of <strong className="text-[#0F172A] dark:text-[#F8FAFC]">{table.getPageCount() || 1}</strong>
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              id="pagination-prev-btn"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#172033] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 font-medium"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <button
              type="button"
              id="pagination-next-btn"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white dark:bg-[#172033] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 font-medium"
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
