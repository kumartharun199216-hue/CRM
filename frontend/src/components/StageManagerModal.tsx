import React, { useState } from 'react';
import { PipelineStage } from '../types';
import { api } from '../services/api';
import { X, Plus, Settings2, AlertCircle } from 'lucide-react';

interface StageManagerModalProps {
  stages: PipelineStage[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const StageManagerModal: React.FC<StageManagerModalProps> = ({
  stages,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [order, setOrder] = useState<number>(stages.length + 1);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (order < 1 || order > 12) {
      setError('Stage order must be between 1 and 12.');
      return;
    }

    try {
      await api.createStage({ name, order });
      setName('');
      setOrder(stages.length + 2);
      setIsCreating(false);
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create stage.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="crm-card bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh] relative">
        {/* Header */}
        <div className="p-4 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between bg-[#F8FAFC] dark:bg-[#111827]">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
              Pipeline Stage Configuration
            </h3>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Extensible 12-stage configuration (names are provided per administrator setup)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-100 hover:bg-[#EFF6FF] dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto scrollbar-thin">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-[#DC2626] dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] dark:text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {!isCreating && stages.length < 12 && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="crm-btn-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Pipeline Stage ({stages.length}/12)</span>
            </button>
          )}

          {isCreating && (
            <form onSubmit={handleCreate} className="p-4 crm-card border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/50 rounded-xl space-y-3">
              <h4 className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">New Stage</h4>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[#0F172A] dark:text-slate-200 mb-1">Stage Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Enter stage name..."
                    className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-700 rounded-xl px-3 py-1.5 text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F172A] dark:text-slate-200 mb-1">Order (1-12) *</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={order}
                    onChange={(e) => setOrder(Number(e.target.value))}
                    required
                    className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-700 rounded-xl px-3 py-1.5 text-[#0F172A] dark:text-slate-100 font-mono focus:outline-none focus:border-[#2563EB] dark:focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="crm-btn-secondary px-3 py-1.5 rounded-xl text-xs font-medium text-[#0F172A] dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary px-4 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                >
                  Save Stage
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">
              Configured Stages ({stages.length}/12)
            </h4>

            {stages.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-slate-400 italic">
                No stages currently configured. Per requirements, stage names are not assumed or hardcoded.
              </p>
            ) : (
              <div className="space-y-1.5">
                {stages.map((st) => (
                  <div
                    key={st.id}
                    className="p-3 crm-card border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900/50 rounded-xl flex items-center justify-between text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#EFF6FF] dark:bg-blue-950/40 border border-[#BFDBFE] dark:border-blue-900/50 text-[11px] font-mono font-bold text-[#2563EB] dark:text-blue-400 flex items-center justify-center">
                        {st.order}
                      </span>
                      <span className="font-semibold text-[#0F172A] dark:text-slate-200">{st.name}</span>
                    </div>
                    <span className="crm-pill crm-pill-success text-[10px] font-mono">Active</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#111827] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="crm-btn-secondary px-3.5 py-1.5 rounded-xl text-xs font-medium text-[#0F172A] dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
