import React, { useState, useEffect } from 'react';
import { ReportSchedule } from '../types';
import { api } from '../services/api';
import { X, Plus, Clock, Play, AlertCircle, CheckCircle2, Users } from 'lucide-react';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({ isOpen, onClose }) => {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [name, setName] = useState('');
  const [recipientsInput, setRecipientsInput] = useState('');
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [timeUtc, setTimeUtc] = useState('09:00:00');

  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const loadSchedules = () => {
    setLoading(true);
    api.getReportSchedules()
      .then(setSchedules)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to fetch schedules'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      loadSchedules();
      setIsCreating(false);
      setError(null);
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const recipientList = recipientsInput
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    if (recipientList.length === 0) {
      setError('Please provide at least one recipient email.');
      return;
    }

    try {
      await api.createReportSchedule({
        name,
        recipients: recipientList,
        frequency,
        time_utc: timeUtc,
      });
      setName('');
      setRecipientsInput('');
      setIsCreating(false);
      loadSchedules();
      setStatusMsg('Report schedule configured successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
    }
  };

  const handleTriggerRun = async () => {
    setTriggering(true);
    setStatusMsg(null);
    setError(null);
    try {
      const res = await api.triggerReportRun();
      setStatusMsg(res.message);
      loadSchedules();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to trigger report execution');
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="crm-card bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] relative">
        {/* Header */}
        <div className="p-4 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between bg-[#F8FAFC] dark:bg-[#111827]">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#7C3AED] dark:text-violet-400" />
              Scheduled CRM Reporting (Admin)
            </h3>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Configure recipients and recurring delivery schedules via Celery background tasks
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

          {statusMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-[#16A34A] dark:text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16A34A] dark:text-emerald-400" />
              <span>{statusMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            {!isCreating && (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="crm-btn-primary flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Configure New Schedule
              </button>
            )}

            <button
              type="button"
              onClick={handleTriggerRun}
              disabled={triggering}
              className="crm-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#0F172A] dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700 transition disabled:opacity-50 cursor-pointer"
              title="Execute recurring task via Celery now"
            >
              <Play className="w-3.5 h-3.5 text-[#16A34A] dark:text-emerald-400" />
              {triggering ? 'Executing...' : 'Trigger Scheduled Task Now'}
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleCreate} className="p-4 crm-card border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-900/50 rounded-xl space-y-3">
              <h4 className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">Configure Report Schedule</h4>

              <div>
                <label className="block text-xs font-medium text-[#0F172A] dark:text-slate-200 mb-1">Schedule Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Executive Weekly CRM Status"
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-700 rounded-xl px-3 py-2 text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#0F172A] dark:text-slate-200 mb-1">
                  Recipient Emails (comma-separated) *
                </label>
                <input
                  type="text"
                  value={recipientsInput}
                  onChange={(e) => setRecipientsInput(e.target.value)}
                  required
                  placeholder="executive@company.com, head-sales@company.com"
                  className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-700 rounded-xl px-3 py-2 text-[#0F172A] dark:text-slate-100 placeholder-[#94A3B8] dark:placeholder-slate-500 focus:outline-none focus:border-[#2563EB] dark:focus:border-blue-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#0F172A] dark:text-slate-200 mb-1">Frequency *</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as 'DAILY' | 'WEEKLY' | 'MONTHLY')}
                    className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-700 rounded-xl px-3 py-2 text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#2563EB] dark:focus:border-blue-500 transition"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#0F172A] dark:text-slate-200 mb-1">Execution Time (UTC)</label>
                  <input
                    type="time"
                    step="1"
                    value={timeUtc}
                    onChange={(e) => setTimeUtc(e.target.value)}
                    className="w-full text-xs bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-slate-700 rounded-xl px-3 py-2 text-[#0F172A] dark:text-slate-100 font-mono focus:outline-none focus:border-[#2563EB] dark:focus:border-blue-500 transition"
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
                  Save Schedule
                </button>
              </div>
            </form>
          )}

          {/* Schedules list */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[#0F172A] dark:text-slate-100">Active Report Schedules</h4>
            {loading ? (
              <p className="text-xs text-[#64748B] dark:text-slate-400">Loading schedules...</p>
            ) : schedules.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-slate-400 italic">No report schedules configured yet.</p>
            ) : (
              schedules.map((sch) => (
                <div key={sch.id} className="p-3.5 crm-card border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-slate-900/50 rounded-xl space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F172A] dark:text-slate-100">{sch.name}</span>
                    <span className="crm-pill crm-pill-purple font-mono text-[10px]">
                      {sch.frequency} at {sch.time_utc} UTC
                    </span>
                  </div>

                  <div className="text-[11px] text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 shrink-0" />
                    <span>Recipients: <strong className="text-[#0F172A] dark:text-slate-200 font-mono">{sch.recipients.join(', ')}</strong></span>
                  </div>

                  <div className="text-[10px] text-[#64748B] dark:text-slate-400 flex justify-between pt-1">
                    <span>Configured by: {sch.created_by_name}</span>
                    <span>Last run: {sch.last_run_at ? new Date(sch.last_run_at).toLocaleString() : 'Never'}</span>
                  </div>
                </div>
              ))
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
