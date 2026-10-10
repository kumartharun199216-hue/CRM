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
  DollarSign,
  ScanEye,
  UserCheck,
  ArrowRightCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';

interface SpreadsheetViewProps {
  leads: Lead[];
  stages: PipelineStage[];
  users?: User[];
  currentUser: User;
  selectedStageId?: number | null;
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

const renderEmpty = () => <span className="text-[#94A3B8]">—</span>;

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
  leads,
  stages,
  users = [],
  currentUser,
  selectedStageId,
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

  // "All Leads" is a system view/filter that displays all leads user is authorized to access
  const filteredData = useMemo(() => {
    if (stageFilter === 'ALL') return leads;
    if (stageFilter === 'UNASSIGNED') return leads.filter((l) => !l.stage);
    return leads.filter((l) => l.stage?.toString() === stageFilter);
  }, [leads, stageFilter]);

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      // 1. Lead ID
      {
        accessorKey: 'lead_id',
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold text-xs text-[#64748B] hover:text-[#0F172A] cursor-pointer"
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
              className="font-mono text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] hover:underline block text-left cursor-pointer"
              title="Open Lead 360° View"
            >
              {val || `#${lead.id}`}
            </button>
          );
        },
      },
      // 2. Lead Name
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold text-xs text-[#64748B] hover:text-[#0F172A] cursor-pointer"
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
              className="font-semibold text-[#0F172A] hover:text-[#2563EB] transition text-left truncate max-w-[180px] block cursor-pointer"
              title={`${displayName} - Click for 360° View`}
            >
              {displayName}
            </button>
          ) : (
            renderEmpty()
          );
        },
      },
      // 3. Email
      {
        accessorKey: 'email',
        header: 'Email',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="text-[#64748B] text-xs font-mono truncate max-w-[160px]" title={val}>
              {val}
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 4. Degree / Qualification
      {
        accessorKey: 'qualification',
        header: 'Degree / Qualification',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="flex items-center gap-1 text-[#0F172A] text-xs truncate max-w-[150px]" title={val}>
              <GraduationCap className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
              <span className="truncate">{val}</span>
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 5. College / University
      {
        accessorKey: 'college',
        header: 'College / University',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="text-[#0F172A] text-xs truncate max-w-[160px]" title={val}>
              {val}
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 6. YOP
      {
        accessorKey: 'yop',
        header: 'YOP',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? <span className="text-[#64748B] text-xs font-mono">{val}</span> : renderEmpty();
        },
      },
      // 7. Key Skills
      {
        accessorKey: 'key_skills',
        header: 'Key Skills',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="text-[#0F172A] text-xs truncate max-w-[160px]" title={val}>
              {val}
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 8. Target Role
      {
        accessorKey: 'target_role',
        header: 'Target Role',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              {val}
            </span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 9. Experience
      {
        accessorKey: 'experience',
        header: 'Experience',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? <span className="text-[#0F172A] text-xs">{val}</span> : renderEmpty();
        },
      },
      // 10. Mobile Phone
      {
        accessorKey: 'phone',
        header: 'Mobile Phone',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <span className="text-[#0F172A] text-xs font-mono">{val}</span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 11. Pipeline Stage
      {
        accessorKey: 'stage_name',
        header: 'Pipeline Stage',
        cell: (info) => {
          const stageName = info.getValue<string | null>();
          return stageName ? (
            <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] whitespace-nowrap">
              {stageName}
            </span>
          ) : (
            <span className="inline-block px-2 py-0.5 rounded text-[11px] text-[#64748B] bg-[#F1F5F9] border border-[#E2E8F0]">
              Unassigned
            </span>
          );
        },
      },
      // 12. Priority
      {
        accessorKey: 'priority',
        header: 'Priority',
        cell: (info) => {
          const val = info.getValue<string>();
          const isHigh = val?.toLowerCase() === 'high';
          return val ? (
            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
              isHigh ? 'crm-pill-warning' : 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]'
            }`}>
              {val}
            </span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 13. Status
      {
        accessorKey: 'status',
        header: 'Status',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? <span className="text-[#0F172A] text-xs">{val}</span> : renderEmpty();
        },
      },
      // 14. Assigned To (Interactive Assignment for Admin/Manager)
      {
        accessorKey: 'assigned_employee_name',
        header: 'Assigned To',
        cell: ({ row }) => {
          const lead = row.original;
          const canAssign = isAdmin || (isManager && (currentUser.managed_team_id || currentUser.team) === lead.team);

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
                  className="text-xs bg-white border border-[#CBD5E1] rounded px-2 py-1 text-[#2563EB] font-medium focus:outline-none focus:border-[#2563EB] max-w-[150px] truncate disabled:opacity-50 cursor-pointer"
                  title="Assign lead to employee"
                >
                  {teamEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.username}
                    </option>
                  ))}
                </select>
                {assigningLeadId === lead.id && (
                  <span className="text-[10px] text-[#2563EB] animate-pulse">Saving...</span>
                )}
              </div>
            );
          }

          const empName = lead.assigned_employee_name || lead.career_counsellor;
          return empName ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              <UserCheck className="w-3 h-3 text-[#2563EB]" />
              {empName}
            </span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 15. Estimated Revenue
      {
        accessorKey: 'estimated_revenue',
        header: 'Estimated Revenue',
        cell: (info) => {
          const val = info.getValue<string | number | null>();
          return val !== null && val !== undefined && val !== '' ? (
            <span className="text-[#0F172A] text-xs font-mono font-medium flex items-center">
              <DollarSign className="w-3 h-3 -mr-0.5 text-[#64748B]" />
              {Number(val).toLocaleString()}
            </span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 16. Placement Fee
      {
        accessorKey: 'placement_fee',
        header: 'Placement Fee',
        cell: (info) => {
          const val = info.getValue<string | number | null>();
          return val !== null && val !== undefined && val !== '' ? (
            <span className="text-[#16A34A] text-xs font-mono font-semibold flex items-center">
              <DollarSign className="w-3 h-3 -mr-0.5 text-[#16A34A]" />
              {Number(val).toLocaleString()}
            </span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 17. Career Counsellor
      {
        accessorKey: 'career_counsellor',
        header: 'Career Counsellor',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="text-[#0F172A] text-xs truncate max-w-[130px]" title={val}>
              {val}
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 18. City / Location
      {
        accessorKey: 'city',
        header: 'City / Location',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? <span className="text-[#0F172A] text-xs">{val}</span> : renderEmpty();
        },
      },
      // 19. Next Follow-up
      {
        accessorKey: 'next_follow_up',
        header: 'Next Follow-up',
        cell: (info) => {
          const val = info.getValue<string | null>();
          if (!val) return renderEmpty();
          try {
            const date = new Date(val);
            return (
              <div className="flex items-center gap-1 text-[#0F172A] text-xs whitespace-nowrap">
                <Calendar className="w-3 h-3 text-[#64748B] shrink-0" />
                <span>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            );
          } catch {
            return <span className="text-[#0F172A] text-xs">{val}</span>;
          }
        },
      },
      // 20. Quick Connect (Fixed column 2nd from right)
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
                className="p-1 hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#2563EB] rounded transition cursor-pointer"
                title="Initiate Call (Callyzer)"
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onCommunicate(lead, 'WHATSAPP')}
                className="p-1 hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#16A34A] rounded transition cursor-pointer"
                title="Send WhatsApp Message"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onCommunicate(lead, 'EMAIL')}
                className="p-1 hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#7C3AED] rounded transition cursor-pointer"
                title="Send Email (Google SMTP)"
              >
                <Mail className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        },
      },
      // 21. Actions (Fixed column on far right)
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
                className="px-2 py-1 bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[#2563EB] rounded text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer shrink-0"
                title="Lead 360° View (All details, history, timeline)"
              >
                <ScanEye className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>360°</span>
              </button>

              {/* Change Stage Button */}
              {canEditOrReassign(lead) && onChangeStage && (
                <button
                  type="button"
                  onClick={() => onChangeStage(lead)}
                  className="px-2 py-1 bg-[#F5F3FF] hover:bg-[#EDE9FE] border border-[#DDD6FE] text-[#7C3AED] rounded text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer shrink-0"
                  title="Change Pipeline Stage (with mandatory reason note)"
                >
                  <ArrowRightCircle className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>Stage</span>
                </button>
              )}

              {/* Edit Lead Button */}
              {canEditOrReassign(lead) && (
                <button
                  type="button"
                  onClick={() => onOpenLead(lead)}
                  className="p-1 hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#2563EB] rounded transition cursor-pointer shrink-0"
                  title="Edit Complete Lead Details"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              )}

              {/* History Button */}
              <button
                type="button"
                onClick={() => onOpenHistory(lead)}
                className="p-1 hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#7C3AED] rounded transition cursor-pointer shrink-0"
                title="View Assignment & Stage History"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        },
      },
    ],
    [currentUser, users, isAdmin, isManager, assigningLeadId, onCommunicate, onOpen360, onOpenHistory, onOpenLead, onAssignLead, onChangeStage]
  );

  const handleStageChange = (val: string) => {
    setStageFilter(val);
    onStageChange?.(val);
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  const table = useReactTable({
    data: filteredData,
    columns,
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
      {/* Top Filter and Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
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
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition font-sans"
            />
          </div>
        </div>

        {/* Stage Filter & Import Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B] font-medium">View:</span>
            <select
              value={stageFilter}
              onChange={(e) => handleStageChange(e.target.value)}
              className="text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[#0F172A] focus:outline-none focus:border-[#2563EB] transition font-sans cursor-pointer"
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

      {/* Spreadsheet Table with Horizontal Scrolling & Fixed Last 2 Columns */}
      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-xs max-w-full relative">
        <table className="min-w-max w-full text-left border-collapse text-xs font-sans">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                {headerGroup.headers.map((header) => {
                  const isQuickConnect = header.id === 'quick_connect';
                  const isActions = header.id === 'actions';
                  const stickyStyle = isActions
                    ? 'sticky right-0 z-30 bg-[#F8FAFC] border-l border-[#E2E8F0] min-w-[185px] w-[185px]'
                    : isQuickConnect
                    ? 'sticky right-[185px] z-30 bg-[#F8FAFC] border-l border-[#E2E8F0] shadow-[-4px_0_8px_rgba(15,23,42,0.04)] min-w-[120px] w-[120px]'
                    : '';

                  return (
                    <th
                      key={header.id}
                      className={`p-3 font-semibold text-[#64748B] border-r border-[#E2E8F0] last:border-r-0 whitespace-nowrap tracking-wider text-[11px] ${stickyStyle}`}
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
                <td colSpan={columns.length} className="text-center py-12 text-[#64748B] text-xs">
                  No lead records found matching the current criteria.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onDoubleClick={() => onOpenLead(row.original)}
                  className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                  title="Double-click to edit lead details"
                >
                  {row.getVisibleCells().map((cell) => {
                    const isQuickConnect = cell.column.id === 'quick_connect';
                    const isActions = cell.column.id === 'actions';
                    const stickyStyle = isActions
                      ? 'sticky right-0 z-20 bg-white group-hover:bg-[#F8FAFC] border-l border-[#E2E8F0] min-w-[185px] w-[185px] transition-colors'
                      : isQuickConnect
                      ? 'sticky right-[185px] z-20 bg-white group-hover:bg-[#F8FAFC] border-l border-[#E2E8F0] shadow-[-4px_0_8px_rgba(15,23,42,0.04)] min-w-[120px] w-[120px] transition-colors'
                      : '';

                    return (
                      <td
                        key={cell.id}
                        className={`p-3 border-r border-[#E2E8F0] last:border-r-0 text-[#0F172A] align-middle whitespace-nowrap ${stickyStyle}`}
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
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-[#E2E8F0] rounded-xl shadow-xs text-xs text-[#64748B] font-sans">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-[#475569]">Rows per page:</span>
            <select
              id="page-size-selector"
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                table.setPageSize(newSize);
                onPaginationChange?.(1, newSize);
              }}
              className="px-2.5 py-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              {[10, 25, 50, 100].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[#CBD5E1]">|</span>

          <span className="font-medium text-[#475569]">
            Showing{' '}
            <strong className="text-[#0F172A]">
              {filteredData.length === 0
                ? 0
                : table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
            </strong>
            -
            <strong className="text-[#0F172A]">
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                filteredData.length
              )}
            </strong>{' '}
            of <strong className="text-[#0F172A]">{filteredData.length}</strong> leads
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-medium text-[#475569]">
            Page <strong className="text-[#0F172A]">{table.getPageCount() === 0 ? 0 : table.getState().pagination.pageIndex + 1}</strong> of{' '}
            <strong className="text-[#0F172A]">{table.getPageCount() || 1}</strong>
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              id="pagination-prev-btn"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 font-medium"
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
              className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer flex items-center gap-1 font-medium"
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

