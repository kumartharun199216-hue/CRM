import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { Search, X, Check, Users, UserCheck, AlertCircle } from 'lucide-react';

interface SearchableEmployeeSelectProps {
  employees: User[];
  selectedEmployeeIds: number[];
  onChange: (selectedIds: number[]) => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  helperText?: string;
  error?: string | null;
}

export const SearchableEmployeeSelect: React.FC<SearchableEmployeeSelectProps> = ({
  employees,
  selectedEmployeeIds,
  onChange,
  disabled = false,
  loading = false,
  label = 'Assign Leads To',
  helperText = 'Select the employees who should receive the imported leads. Valid leads will be distributed as evenly as possible.',
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    const name = (emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username).toLowerCase();
    const email = (emp.email || '').toLowerCase();
    const query = searchTerm.toLowerCase().trim();
    return name.includes(query) || email.includes(query);
  });

  const selectedEmployees = employees.filter((emp) => selectedEmployeeIds.includes(emp.id));

  const handleToggleEmployee = (id: number) => {
    if (disabled) return;
    if (selectedEmployeeIds.includes(id)) {
      onChange(selectedEmployeeIds.filter((empId) => empId !== id));
    } else {
      onChange([...selectedEmployeeIds, id]);
    }
  };

  const handleRemoveChip = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedEmployeeIds.filter((empId) => empId !== id));
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const allFilteredIds = Array.from(new Set([...selectedEmployeeIds, ...filteredEmployees.map((e) => e.id)]));
    onChange(allFilteredIds);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange([]);
  };

  const getDisplayName = (emp: User) => {
    return emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.username;
  };

  return (
    <div className="space-y-1.5 w-full" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-[#0F172A]">
          {label}
          <span className="text-[#2563EB] ml-1">*</span>
        </label>
        {selectedEmployeeIds.length > 0 && !disabled && (
          <span className="text-[11px] font-medium text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-full border border-[#BFDBFE]">
            {selectedEmployeeIds.length} {selectedEmployeeIds.length === 1 ? 'employee' : 'employees'} selected
          </span>
        )}
      </div>

      {helperText && (
        <p className="text-[11px] text-[#64748B] m-0">{helperText}</p>
      )}

      {/* Main Select Box / Chip Container */}
      <div
        id="assign-leads-multi-select-container"
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setTimeout(() => searchInputRef.current?.focus(), 50);
          }
        }}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
            setTimeout(() => searchInputRef.current?.focus(), 50);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        className={`w-full min-h-[42px] px-2.5 py-1.5 bg-white border rounded-lg text-xs transition flex flex-wrap items-center gap-1.5 cursor-pointer relative ${
          disabled
            ? 'bg-[#F8FAFC] border-[#E2E8F0] opacity-60 cursor-not-allowed'
            : isOpen
            ? 'border-[#2563EB] ring-2 ring-[#2563EB]/15'
            : error
            ? 'border-[#DC2626] ring-1 ring-[#DC2626]/20'
            : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
        }`}
      >
        {/* Selected Chips */}
        {selectedEmployees.length > 0 ? (
          selectedEmployees.map((emp) => (
            <span
              key={emp.id}
              className="inline-flex items-center gap-1.5 px-2 py-0.75 bg-[#EFF6FF] text-[#1E3A8A] border border-[#BFDBFE] rounded-md text-[11px] font-medium shadow-2xs group"
            >
              <span className="w-4 h-4 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-[9px] font-bold">
                {getDisplayName(emp).charAt(0).toUpperCase()}
              </span>
              <span className="max-w-[130px] truncate">{getDisplayName(emp)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemoveChip(e, emp.id)}
                  className="text-[#64748B] hover:text-[#DC2626] rounded-full p-0.5 transition"
                  title={`Remove ${getDisplayName(emp)}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))
        ) : (
          <span className="text-[#94A3B8] text-xs px-1 select-none flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#94A3B8]" />
            {loading ? 'Loading eligible employees...' : 'Search and select employees to assign leads...'}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {selectedEmployeeIds.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] text-[#64748B] hover:text-[#DC2626] font-medium px-1.5 py-0.5 rounded hover:bg-[#FEF2F2] transition mr-1"
              title="Clear all selections"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="relative z-50">
          <div className="absolute top-1 left-0 right-0 bg-white border border-[#CBD5E1] rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 duration-150">
            {/* Search Header */}
            <div className="p-2 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center gap-2">
              <Search className="w-4 h-4 text-[#64748B] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search eligible employees by name or email..."
                className="w-full bg-transparent text-xs text-[#0F172A] placeholder-[#94A3B8] outline-none"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-[#64748B] hover:text-[#0F172A] p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Actions Bar */}
            <div className="px-3 py-1.5 bg-[#F1F5F9]/70 border-b border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#64748B]">
              <span>
                {filteredEmployees.length} {filteredEmployees.length === 1 ? 'employee' : 'employees'} available
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="font-medium text-[#2563EB] hover:text-[#1E3A8A] cursor-pointer"
                >
                  Select All
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="font-medium text-[#64748B] hover:text-[#DC2626] cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Employee List */}
            <div className="max-h-56 overflow-y-auto p-1 divide-y divide-[#F1F5F9]">
              {loading ? (
                <div className="p-4 text-center text-xs text-[#64748B]">
                  Loading eligible employees...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#64748B] space-y-1">
                  <UserCheck className="w-6 h-6 mx-auto text-[#94A3B8]" />
                  <p className="font-medium m-0">No eligible employees found</p>
                  <p className="text-[10px] text-[#94A3B8] m-0">
                    {searchTerm ? 'Try a different search query' : 'Ensure sales counsellors are active in this team'}
                  </p>
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = selectedEmployeeIds.includes(emp.id);
                  const displayName = getDisplayName(emp);
                  return (
                    <div
                      key={emp.id}
                      onClick={() => handleToggleEmployee(emp.id)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs transition ${
                        isSelected
                          ? 'bg-[#EFF6FF] text-[#1E3A8A] font-semibold'
                          : 'hover:bg-[#F8FAFC] text-[#0F172A]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isSelected
                              ? 'bg-[#2563EB] text-white shadow-xs'
                              : 'bg-[#E2E8F0] text-[#475569]'
                          }`}
                        >
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{displayName}</div>
                          <div className="text-[10px] text-[#64748B] truncate">
                            {emp.email || `@${emp.username}`}
                            {emp.team_name ? ` · Team: ${emp.team_name}` : ''}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition shrink-0 ${
                          isSelected
                            ? 'bg-[#2563EB] border-[#2563EB] text-white'
                            : 'border-[#CBD5E1] bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-[#DC2626] mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
