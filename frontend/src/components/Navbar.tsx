import React from 'react';
import { User } from '../types';
import {
  Table2,
  Kanban,
  PlusCircle,
  FileSpreadsheet,
  Settings2,
  Clock,
  LogOut,
  Shield,
  Briefcase,
  UserCheck
} from 'lucide-react';

interface NavbarProps {
  user: User;
  activeView: 'spreadsheet' | 'kanban';
  onViewChange: (view: 'spreadsheet' | 'kanban') => void;
  onOpenCreateLead: () => void;
  onOpenReports: () => void;
  onOpenTemplates: () => void;
  onOpenStages: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeView,
  onViewChange,
  onOpenCreateLead,
  onOpenReports,
  onOpenTemplates,
  onOpenStages,
  onLogout,
}) => {
  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER';
  const canCreateLead = isAdmin || isManager;

  const getRoleBadge = () => {
    switch (user.role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-900/60 text-purple-300 border border-purple-700/50">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/50">
            <Briefcase className="w-3 h-3" /> Manager {user.team_name ? `(${user.team_name})` : ''}
          </span>
        );
      case 'SALES_EMPLOYEE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50">
            <UserCheck className="w-3 h-3" /> Sales Employee {user.team_name ? `(${user.team_name})` : ''}
          </span>
        );
    }
  };

  return (
    <header className="bg-white/95 dark:bg-[#111827]/90 border-b border-[#E2E8F0] dark:border-slate-800 backdrop-blur sticky top-0 z-30 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Logo and App Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            CRM
          </div>
          <div>
            <h1 className="text-base font-bold text-[#0F172A] dark:text-slate-100 tracking-tight m-0">Sales CRM</h1>
            <p className="text-xs text-[#64748B] dark:text-slate-400 m-0">Pipeline & Lead Operations</p>
          </div>
        </div>

        {/* View Switcher: Spreadsheet vs Kanban */}
        <div className="flex items-center bg-[#F1F5F9] dark:bg-slate-800/80 p-1 rounded-lg border border-[#E2E8F0] dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => onViewChange('spreadsheet')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeView === 'spreadsheet'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            Spreadsheet
          </button>
          <button
            type="button"
            onClick={() => onViewChange('kanban')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeView === 'kanban'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            Kanban
          </button>
        </div>

        {/* Actions & Role Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {canCreateLead && (
            <button
              type="button"
              onClick={onOpenCreateLead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-blue-600 text-white transition shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New Lead
            </button>
          )}

          {(isAdmin || isManager) && (
            <button
              type="button"
              onClick={onOpenTemplates}
              className="crm-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer"
              title="Communication Templates"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400" />
              Templates
            </button>
          )}

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={onOpenReports}
                className="crm-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer"
                title="Configure Scheduled Reports"
              >
                <Clock className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400" />
                Reports
              </button>
              <button
                type="button"
                onClick={onOpenStages}
                className="crm-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer"
                title="Configure Pipeline Stages"
              >
                <Settings2 className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400" />
                Stages
              </button>
            </>
          )}

          {/* User profile & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#E2E8F0] dark:border-slate-800">
            <div className="flex flex-col items-end">
              <span className="text-xs font-medium text-[#0F172A] dark:text-slate-200">{user.username}</span>
              {getRoleBadge()}
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 text-[#64748B] dark:text-slate-400 hover:text-red-500 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
