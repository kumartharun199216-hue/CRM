import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table';
import { Lead, PipelineStage, User, Team } from '../types';
import {
  Search,
  Phone,
  Mail,
  MessageSquare,
  ArrowUpDown,
  GraduationCap,
  Calendar,
  DollarSign,
  ScanEye,
  UserCheck,
  UserX,
  RefreshCw,
  PlusCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface UnassignedLeadsViewProps {
  leads: Lead[];
  stages: PipelineStage[];
  teams: Team[];
  currentUser: User;
  loading?: boolean;
  onRefresh: () => void;
  onAssignLead: (lead: Lead) => void;
  onOpen360: (lead: Lead) => void;
  onCommunicate: (lead: Lead, channel: 'EMAIL' | 'WHATSAPP' | 'CALL') => void;
  onOpenCreateUnassigned?: () => void;
}

const renderEmpty = () => <span className="text-slate-600">—</span>;

export const UnassignedLeadsView: React.FC<UnassignedLeadsViewProps> = ({
  leads,
  stages,
  teams,
  currentUser,
  loading = false,
  onRefresh,
  onAssignLead,
  onOpen360,
  onCommunicate,
  onOpenCreateUnassigned,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');

  const isAdmin = currentUser.role === 'ADMIN';

  // Filter data according to selected filters
  const filteredData = useMemo(() => {
    return leads.filter((lead) => {
      // Stage filter
      if (stageFilter !== 'ALL') {
        if (stageFilter === 'NO_STAGE') {
          if (lead.stage !== null) return false;
        } else if (lead.stage?.toString() !== stageFilter) {
          return false;
        }
      }

      // Priority filter
      if (priorityFilter !== 'ALL' && lead.priority !== priorityFilter) {
        return false;
      }

      // Team filter (Admin only)
      if (isAdmin && teamFilter !== 'ALL' && lead.team?.toString() !== teamFilter) {
        return false;
      }

      return true;
    });
  }, [leads, stageFilter, priorityFilter, teamFilter, isAdmin]);

  const columns = useMemo<ColumnDef<Lead>[]>(
    () => [
      // 1. Lead ID
      {
        accessorKey: 'lead_id',
        header: ({ column }) => (
          <button
            type="button"
            className="flex items-center gap-1 font-semibold text-xs text-slate-300 hover:text-white"
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
              className="font-mono text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:underline block text-left"
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
            className="flex items-center gap-1 font-semibold text-xs text-slate-300 hover:text-white"
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
              className="font-semibold text-slate-100 hover:text-indigo-300 transition text-left truncate max-w-[170px] block"
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
            <div className="text-slate-400 text-xs font-mono truncate max-w-[160px]" title={val}>
              {val}
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 4. Mobile Phone
      {
        accessorKey: 'phone',
        header: 'Mobile Phone',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <span className="text-slate-300 text-xs font-mono">{val}</span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 5. Degree / Qualification
      {
        accessorKey: 'qualification',
        header: 'Degree / Qualification',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="flex items-center gap-1 text-slate-300 text-xs truncate max-w-[150px]" title={val}>
              <GraduationCap className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="truncate">{val}</span>
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 6. College / University
      {
        accessorKey: 'college',
        header: 'College / University',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="text-slate-300 text-xs truncate max-w-[160px]" title={val}>
              {val}
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 7. YOP
      {
        accessorKey: 'yop',
        header: 'YOP',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? <span className="text-slate-300 text-xs font-mono">{val}</span> : renderEmpty();
        },
      },
      // 8. Key Skills
      {
        accessorKey: 'key_skills',
        header: 'Key Skills',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="text-slate-300 text-xs truncate max-w-[160px]" title={val}>
              {val}
            </div>
          ) : (
            renderEmpty()
          );
        },
      },
      // 9. Target Role
      {
        accessorKey: 'target_role',
        header: 'Target Role',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <span className="linear-pill linear-pill-indigo text-[11px]">
              {val}
            </span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 10. Experience
      {
        accessorKey: 'experience',
        header: 'Experience',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? <span className="text-slate-300 text-xs">{val}</span> : renderEmpty();
        },
      },
      // 11. Pipeline Stage
      {
        accessorKey: 'stage_name',
        header: 'Pipeline Stage',
        cell: (info) => {
          const stageName = info.getValue<string | null>();
          return stageName ? (
            <span className="linear-pill linear-pill-purple text-[11px] whitespace-nowrap">
              {stageName}
            </span>
          ) : (
            <span className="linear-pill text-[11px] text-slate-500 bg-white/[0.03] border-white/[0.08]">
              No Stage
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
          if (!val) return renderEmpty();
          const p = val.toLowerCase();
          const pillClass = p === 'high' || p === 'urgent'
            ? 'linear-pill-amber'
            : p === 'medium'
            ? 'linear-pill-indigo'
            : 'linear-pill-cyan';
          return (
            <span className={`linear-pill ${pillClass} text-[11px]`}>
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
          return val ? <span className="text-slate-300 text-xs">{val}</span> : renderEmpty();
        },
      },
      // 14. Estimated Revenue
      {
        accessorKey: 'estimated_revenue',
        header: 'Estimated Revenue',
        cell: (info) => {
          const val = info.getValue<string | number | null>();
          return val !== null && val !== undefined && val !== '' ? (
            <span className="text-emerald-400 text-xs font-mono font-medium flex items-center">
              <DollarSign className="w-3 h-3 -mr-0.5 text-emerald-500" />
              {Number(val).toLocaleString()}
            </span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 15. Placement Fee
      {
        accessorKey: 'placement_fee',
        header: 'Placement Fee',
        cell: (info) => {
          const val = info.getValue<string | number | null>();
          return val !== null && val !== undefined && val !== '' ? (
            <span className="text-emerald-400 text-xs font-mono font-medium flex items-center">
              <DollarSign className="w-3 h-3 -mr-0.5 text-emerald-500" />
              {Number(val).toLocaleString()}
            </span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 16. Career Counsellor (displays empty/unassigned gracefully)
      {
        accessorKey: 'career_counsellor',
        header: 'Career Counsellor',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? (
            <div className="text-slate-300 text-xs truncate max-w-[130px]" title={val}>
              {val}
            </div>
          ) : (
            <span className="linear-pill linear-pill-amber text-[11px] inline-flex items-center gap-1 font-semibold">
              <UserX className="w-3 h-3 text-amber-400" />
              Unassigned
            </span>
          );
        },
      },
      // 17. City / Location
      {
        accessorKey: 'city',
        header: 'City / Location',
        cell: (info) => {
          const val = info.getValue<string>();
          return val ? <span className="text-slate-300 text-xs">{val}</span> : renderEmpty();
        },
      },
      // 18. Next Follow-up
      {
        accessorKey: 'next_follow_up',
        header: 'Next Follow-up',
        cell: (info) => {
          const val = info.getValue<string | null>();
          if (!val) return renderEmpty();
          try {
            const date = new Date(val);
            return (
              <div className="flex items-center gap-1 text-slate-300 text-xs whitespace-nowrap">
                <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                <span>
                  {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          } catch {
            return <span className="text-slate-300 text-xs">{val}</span>;
          }
        },
      },
      // 19. Team
      {
        accessorKey: 'team_name',
        header: 'Team',
        cell: (info) => {
          const lead = info.row.original;
          const val = info.getValue<string>() || teams.find((t) => t.id === lead.team)?.name;
          return val ? (
            <span className="text-xs text-slate-300 truncate max-w-[120px] block" title={val}>
              {val}
            </span>
          ) : (
            renderEmpty()
          );
        },
      },
      // 20. Fixed Actions Column
      {
        id: 'actions',
        header: () => <div className="text-right pr-2">Actions</div>,
        size: 190,
        cell: ({ row }) => {
          const lead = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              {/* Quick Connect Call / WhatsApp / Email */}
              <button
                type="button"
                onClick={() => onCommunicate(lead, 'CALL')}
                className="p-1.5 hover:bg-white/[0.08] text-slate-400 hover:text-emerald-400 rounded-lg transition"
                title="Call Student"
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onCommunicate(lead, 'WHATSAPP')}
                className="p-1.5 hover:bg-white/[0.08] text-slate-400 hover:text-emerald-400 rounded-lg transition"
                title="WhatsApp Student"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onCommunicate(lead, 'EMAIL')}
                className="p-1.5 hover:bg-white/[0.08] text-slate-400 hover:text-indigo-400 rounded-lg transition"
                title="Email Student"
              >
                <Mail className="w-3.5 h-3.5" />
              </button>

              {/* 360 View */}
              <button
                type="button"
                onClick={() => onOpen360(lead)}
                className="p-1.5 hover:bg-white/[0.08] text-slate-400 hover:text-purple-400 rounded-lg transition"
                title="Lead 360° View"
              >
                <ScanEye className="w-3.5 h-3.5" />
              </button>

              {/* Primary Assign Action Button */}
              <button
                type="button"
                onClick={() => onAssignLead(lead)}
                className="linear-btn-primary flex items-center gap-1 px-3 py-1 text-white rounded-lg text-[11px] font-semibold transition"
                title="Assign lead to employee or manager"
              >
                <UserCheck className="w-3 h-3" />
                <span>Assign</span>
              </button>
            </div>
          );
        },
      },
    ],
    [teams, onOpen360, onAssignLead, onCommunicate]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  return (
    <div className="space-y-4 font-sans">
      {/* Top Banner / Filter Toolbar */}
      <div className="crm-card p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3.5 relative overflow-hidden bg-white">
        {/* Subtle accent bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#2563EB] via-[#7C3AED] to-[#D97706] opacity-90" />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] flex items-center justify-center text-[#D97706] shadow-xs">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#0F172A] m-0 tracking-tight">
                  Unassigned Leads Queue
                </h3>
                <span className="crm-pill crm-pill-warning font-mono font-bold text-xs">
                  {filteredData.length} {filteredData.length === 1 ? 'Lead' : 'Leads'}
                </span>
              </div>
              <p className="text-xs text-[#64748B] m-0">
                Incoming student inquiries awaiting assignment to counsellors or managers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenCreateUnassigned && (
              <button
                type="button"
                onClick={onOpenCreateUnassigned}
                className="crm-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Add Unassigned Lead</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="crm-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
              title="Refresh queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-[#E2E8F0]">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="text"
              id="unassigned-search-input"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search unassigned leads..."
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition font-sans"
            />
          </div>

          {/* Pipeline Stage Filter */}
          <div>
            <select
              id="unassigned-stage-filter"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] transition font-sans cursor-pointer"
            >
              <option value="ALL">All Pipeline Stages</option>
              {stages.map((st) => (
                <option key={st.id} value={st.id.toString()}>
                  {st.name}
                </option>
              ))}
              <option value="NO_STAGE">No Stage Assigned</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              id="unassigned-priority-filter"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] transition font-sans cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>

          {/* Team Filter (Admin Only) */}
          {isAdmin && (
            <div>
              <select
                id="unassigned-team-filter"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB] transition font-sans cursor-pointer"
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
        </div>
      </div>

      {/* Main Table */}
      <div className="crm-card border border-[#E2E8F0] rounded-xl overflow-hidden shadow-xs bg-white">
        <div className="overflow-x-auto max-h-[620px] scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#F8FAFC] text-[#64748B] border-b border-[#E2E8F0] sticky top-0 z-20">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const isFixedActions = header.column.id === 'actions';
                    return (
                      <th
                        key={header.id}
                        className={`p-3 text-[11px] font-semibold tracking-wider uppercase select-none whitespace-nowrap ${
                          isFixedActions
                            ? 'sticky right-0 bg-[#F8FAFC] z-30 shadow-[-4px_0_8px_rgba(15,23,42,0.04)] border-l border-[#E2E8F0]'
                            : ''
                        }`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-[#F8FAFC] text-[#0F172A] group cursor-pointer transition-colors"
                    onClick={() => onOpen360(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isFixedActions = cell.column.id === 'actions';
                      return (
                        <td
                          key={cell.id}
                          className={`p-3 whitespace-nowrap ${
                            isFixedActions
                              ? 'sticky right-0 bg-white group-hover:bg-[#F8FAFC] z-10 shadow-[-4px_0_8px_rgba(15,23,42,0.04)] border-l border-[#E2E8F0]'
                              : ''
                          }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-[#64748B]">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#2563EB]">
                        <UserCheck className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <span className="text-sm font-semibold text-[#0F172A]">
                        No unassigned leads found
                      </span>
                      <p className="text-xs text-[#64748B] max-w-sm">
                        All student leads accessible to your account are currently assigned to active counsellors or managers.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B] bg-[#F8FAFC]">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="bg-white border border-[#CBD5E1] rounded px-2 py-1 text-[#0F172A] focus:outline-none focus:border-[#2563EB] cursor-pointer"
            >
              {[10, 25, 50, 100].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
            <span className="text-[#CBD5E1]">|</span>
            <span>
              Total: <strong className="text-[#0F172A] font-mono">{filteredData.length}</strong> leads
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>
              Page <strong className="text-[#0F172A] font-mono">{table.getState().pagination.pageIndex + 1}</strong> of{' '}
              <strong className="text-[#0F172A] font-mono">{Math.max(1, table.getPageCount())}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
