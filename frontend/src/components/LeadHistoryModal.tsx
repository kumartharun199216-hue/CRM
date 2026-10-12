import React, { useEffect, useState } from 'react';
import { Lead, LeadAssignmentHistory, LeadStageHistory } from '../types';
import { api } from '../services/api';
import { X, UserCheck, GitCommit, Clock, ArrowRight, AlertCircle } from 'lucide-react';

interface LeadHistoryModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LeadHistoryModal: React.FC<LeadHistoryModalProps> = ({ lead, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'assignment' | 'stage'>('assignment');
  const [assignmentHistory, setAssignmentHistory] = useState<LeadAssignmentHistory[]>([]);
  const [stageHistory, setStageHistory] = useState<LeadStageHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lead && isOpen) {
      setLoading(true);
      setError(null);
      Promise.all([
        api.getAssignmentHistory(lead.id),
        api.getStageHistory(lead.id),
      ])
        .then(([assignments, stages]) => {
          setAssignmentHistory(assignments);
          setStageHistory(stages);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to fetch history.');
        })
        .finally(() => setLoading(false));
    }
  }, [lead, isOpen]);

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
      <div className="crm-card bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] relative">
        {/* Header */}
        <div className="p-4 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between bg-[#F8FAFC] dark:bg-[#0F172A]">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
              <span>Lead History</span>
              <span className="text-xs font-mono text-[#2563EB] dark:text-blue-400 font-semibold">{lead.lead_id || `#${lead.id}`} - {lead.title || lead.name}</span>
            </h3>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Audit log of ownership, assignments, and pipeline progression
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] dark:text-slate-400 dark:hover:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0F172A] px-4">
          <button
            type="button"
            onClick={() => setActiveTab('assignment')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'assignment'
                ? 'border-[#2563EB] dark:border-blue-400 text-[#2563EB] dark:text-blue-400'
                : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Assignment History ({assignmentHistory.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stage')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === 'stage'
                ? 'border-[#7C3AED] dark:border-purple-400 text-[#7C3AED] dark:text-purple-400'
                : 'border-transparent text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-200'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            Stage Changes ({stageHistory.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3 scrollbar-thin dark:bg-[#172033]">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-[#DC2626] dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] dark:text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-[#64748B] dark:text-slate-400 animate-pulse">
              Loading audit history...
            </div>
          ) : activeTab === 'assignment' ? (
            assignmentHistory.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#64748B] dark:text-slate-400">
                No assignment changes recorded yet.
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E2E8F0] dark:before:bg-slate-700">
                {assignmentHistory.map((item) => (
                  <div key={item.id} className="relative text-xs space-y-1">
                    <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#2563EB] ring-4 ring-white dark:ring-[#172033]" />
                    <div className="flex items-center justify-between text-[#64748B] dark:text-slate-400 text-[11px]">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-[#64748B] dark:text-slate-400" />
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                      <span>By: <strong className="text-[#0F172A] dark:text-slate-200 font-semibold">{item.changed_by_name}</strong></span>
                    </div>
                    <div className="p-3 crm-card border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#111827] rounded-xl flex items-center justify-between gap-2 shadow-xs">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="text-[#64748B] dark:text-slate-400">
                          {item.from_employee_name ? (
                            <span>{item.from_employee_name} ({item.from_team_name})</span>
                          ) : (
                            <span className="italic text-[#94A3B8] dark:text-slate-500">Initial Creation</span>
                          )}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] dark:text-slate-500 shrink-0" />
                        <div className="font-semibold text-[#2563EB] dark:text-blue-400 font-mono">
                          {item.to_employee_name} ({item.to_team_name})
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : stageHistory.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#64748B] dark:text-slate-400">
              No pipeline stage changes recorded yet.
            </div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E2E8F0] dark:before:bg-slate-700">
              {stageHistory.map((item) => (
                <div key={item.id} className="relative text-xs space-y-1">
                  <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-[#7C3AED] ring-4 ring-white dark:ring-[#172033]" />
                  <div className="flex items-center justify-between text-[#64748B] dark:text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-[#64748B] dark:text-slate-400" />
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                    <span>By: <strong className="text-[#0F172A] dark:text-slate-200 font-semibold">{item.changed_by_name}</strong></span>
                  </div>
                  <div className="p-3 crm-card border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#111827] rounded-xl flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2 flex-1">
                      <div className="text-[#64748B] dark:text-slate-400">
                        {item.from_stage_name || <span className="italic text-[#94A3B8] dark:text-slate-500">Unassigned</span>}
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] dark:text-slate-500 shrink-0" />
                      <div className="font-semibold text-[#7C3AED] dark:text-purple-400">
                        {item.to_stage_name || 'Unassigned'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0F172A] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="crm-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
