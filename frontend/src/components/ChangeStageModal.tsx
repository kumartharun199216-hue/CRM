import React, { useState, useEffect } from 'react';
import { Lead, PipelineStage } from '../types';
import { getStageStyle } from './SpreadsheetView';
import { api } from '../services/api';
import {
  X,
  Layers,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  FileText,
  Clock,
  User as UserIcon,
  IndianRupee
} from 'lucide-react';


interface ChangeStageModalProps {
  lead: Lead | null;
  isOpen: boolean;
  stages: PipelineStage[];
  onClose: () => void;
  onSuccess: (updatedLead: Lead) => void;
}

export const ChangeStageModal: React.FC<ChangeStageModalProps> = ({
  lead,
  isOpen,
  stages,
  onClose,
  onSuccess,
}) => {
  const [destinationStageId, setDestinationStageId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [agreedAmount, setAgreedAmount] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    destination_stage_id?: string;
    note?: string;
    agreed_amount?: string;
    amount_paid?: string;
  }>({});

  // Active stages sorted in configured pipeline order
  const activeStages = [...stages]
    .filter((s) => s.is_active)
    .sort((a, b) => a.order - b.order);

  const currentStageObj = lead?.stage
    ? stages.find((s) => s.id === lead.stage)
    : null;

  const selectedDestinationObj = activeStages.find(
    (s) => s.id.toString() === destinationStageId
  );

  const isPendingClosure = (
    selectedDestinationObj?.order === 9 ||
    selectedDestinationObj?.name.trim().toLowerCase().replace(/[\s\-_]/g, '') === 'pendingclosure'
  );

  // Live calculation of financial amounts
  const agreedNum = parseFloat(agreedAmount) || 0;
  const paidNum = parseFloat(amountPaid) || 0;
  const outstandingBalance = agreedNum - paidNum;

  useEffect(() => {
    if (isOpen && lead) {
      setNote('');
      setErrorMessage(null);
      setSuccessMessage(null);
      setFieldErrors({});

      // Preload existing financial data if present
      const existingFin = lead.pending_closure_financial || lead.pre_closer_financial;
      if (existingFin) {
        setAgreedAmount(existingFin.agreed_amount?.toString() || '');
        setAmountPaid(existingFin.amount_paid?.toString() || '');
      } else {
        setAgreedAmount('');
        setAmountPaid('');
      }

      // Pre-select first valid destination stage that is not the current stage
      const firstAvailable = activeStages.find((s) => s.id !== lead.stage);
      setDestinationStageId(firstAvailable ? firstAvailable.id.toString() : '');
    }
  }, [isOpen, lead]);

  if (!isOpen || !lead) return null;

  const validate = (): boolean => {
    const errors: {
      destination_stage_id?: string;
      note?: string;
      agreed_amount?: string;
      amount_paid?: string;
    } = {};

    if (!destinationStageId) {
      errors.destination_stage_id = 'Please select a destination pipeline stage.';
    } else if (Number(destinationStageId) === lead.stage) {
      errors.destination_stage_id = 'Destination stage cannot be the same as the current stage.';
    }

    if (!note.trim()) {
      errors.note = 'A note explaining the reason for the stage change is mandatory.';
    } else if (note.trim().length < 3) {
      errors.note = 'Note must be at least 3 characters.';
    }

    if (isPendingClosure) {
      if (!agreedAmount.trim()) {
        errors.agreed_amount = 'Total agreed amount is required for Pending Closure.';
      } else {
        const agreedVal = Number(agreedAmount);
        if (isNaN(agreedVal) || agreedVal < 0) {
          errors.agreed_amount = 'Total agreed amount must be a non-negative number.';
        }
      }

      if (!amountPaid.trim()) {
        errors.amount_paid = 'Amount paid is required for Pending Closure.';
      } else {
        const paidVal = Number(amountPaid);
        if (isNaN(paidVal) || paidVal < 0) {
          errors.amount_paid = 'Amount paid must be a non-negative number.';
        } else if (!errors.agreed_amount) {
          const agreedVal = Number(agreedAmount);
          if (paidVal > agreedVal) {
            errors.amount_paid = 'Amount paid cannot exceed the total agreed amount.';
          }
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    const destId = Number(destinationStageId);
    setIsSubmitting(true);

    try {
      const payload: {
        destination_stage_id: number;
        note: string;
        expected_current_stage_id?: number | null;
        agreed_amount?: string;
        amount_paid?: string;
      } = {
        destination_stage_id: destId,
        note: note.trim(),
        expected_current_stage_id: lead.stage,
      };

      if (isPendingClosure) {
        payload.agreed_amount = agreedAmount.trim();
        payload.amount_paid = amountPaid.trim();
      }

      const response = await api.changeLeadStage(lead.id, payload);


      setSuccessMessage(response.detail || 'Pipeline stage changed successfully.');

      setTimeout(() => {
        onSuccess(response.lead);
        onClose();
      }, 700);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to change stage.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto font-sans animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative text-[#0F172A] dark:text-[#F8FAFC]">
        {/* Top Accent Gradient Bar */}
        <div className="h-1 bg-gradient-to-r from-[#2563EB] via-[#7C3AED] to-[#1E3A8A]" />

        {/* Modal Header */}
        <div className="p-5 border-b border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white shadow-xs shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">Change Pipeline Stage</h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Update lead progression and record mandatory audit history</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] rounded-lg transition cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lead Context Summary Card */}
        <div className="px-5 pt-4">
          <div className="p-3.5 bg-gradient-to-br from-[#EFF6FF]/60 to-[#F5F3FF]/60 dark:from-[#111827] dark:to-[#172554]/40 border border-[#DBEAFE] dark:border-blue-900/40 rounded-xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-[#2563EB] dark:text-blue-400 bg-[#DBEAFE] dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                  {lead.lead_id}
                </span>
                <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                  {lead.name || lead.contact_name || 'Lead'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                <span className="truncate">{lead.email}</span>
                <span>•</span>
                <span className="font-mono">{lead.phone}</span>
              </div>
            </div>

            {/* Current Stage Badge */}
            <div className="text-right shrink-0">
              <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] uppercase font-bold tracking-wider block">Current Stage</span>
              {(() => {
                const curStyle = getStageStyle(currentStageObj?.name);
                return (
                  <span className={`inline-flex items-center gap-1.5 mt-0.5 px-2.5 py-1 font-semibold text-xs rounded-lg border shadow-xs ${curStyle.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${curStyle.dot}`} />
                    {currentStageObj ? `${currentStageObj.order}. ${currentStageObj.name}` : 'Unassigned'}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-[#FEF2F2] dark:bg-rose-950/30 border border-[#FECACA] dark:border-rose-900/50 rounded-xl flex items-start gap-2.5 text-[#DC2626] dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="p-3 bg-[#F0FDF4] dark:bg-emerald-950/40 border border-[#BBF7D0] dark:border-emerald-800 rounded-xl flex items-center gap-2.5 text-[#16A34A] dark:text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Stage Transition Visualizer */}
          <div className="flex items-center justify-center gap-3 p-3 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs">
            <div className="text-center">
              <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-medium block">From</span>
              {(() => {
                const fromStyle = getStageStyle(currentStageObj?.name);
                return (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded text-[11px] font-semibold border ${fromStyle.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${fromStyle.dot}`} />
                    {currentStageObj ? currentStageObj.name : 'Unassigned'}
                  </span>
                );
              })()}
            </div>
            <ArrowRight className="w-4 h-4 text-[#2563EB] dark:text-blue-400 shrink-0" />
            <div className="text-center">
              <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-medium block">To Destination</span>
              {selectedDestinationObj ? (
                (() => {
                  const toStyle = getStageStyle(selectedDestinationObj.name);
                  return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 mt-0.5 rounded text-[11px] font-semibold border ${toStyle.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${toStyle.dot}`} />
                      {selectedDestinationObj.name}
                    </span>
                  );
                })()
              ) : (
                <span className="text-xs text-[#94A3B8] dark:text-[#64748B] italic">Select below</span>
              )}
            </div>
          </div>

          {/* Destination Stage Select */}
          <div>
            <label htmlFor="destination-stage-select" className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1] mb-1.5">
              Destination Stage <span className="text-[#DC2626]">*</span>
            </label>
            <select
              id="destination-stage-select"
              value={destinationStageId}
              onChange={(e) => {
                setDestinationStageId(e.target.value);
                if (fieldErrors.destination_stage_id) {
                  setFieldErrors((prev) => ({ ...prev, destination_stage_id: undefined }));
                }
              }}
              disabled={isSubmitting}
              className={`w-full text-xs bg-[#F8FAFC] dark:bg-[#111827] border rounded-xl px-3 py-2.5 text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition cursor-pointer font-medium ${
                fieldErrors.destination_stage_id ? 'border-[#DC2626] bg-[#FEF2F2]/50 dark:bg-rose-950/20' : 'border-[#CBD5E1] dark:border-[#334155] focus:border-[#2563EB]'
              }`}
            >
              <option value="" disabled>-- Select New Pipeline Stage --</option>
              {activeStages.map((st) => {
                const isCurrent = st.id === lead.stage;
                return (
                  <option key={st.id} value={st.id} disabled={isCurrent}>
                    {st.order}. {st.name} {isCurrent ? '(Current Stage)' : ''}
                  </option>
                );
              })}
            </select>
            {fieldErrors.destination_stage_id && (
              <p className="text-[11px] text-[#DC2626] dark:text-rose-400 font-medium mt-1">
                {fieldErrors.destination_stage_id}
              </p>
            )}
          </div>

          {/* Dedicated Pending Closure Financial Fields */}
          {isPendingClosure && (
            <div className="p-4 bg-gradient-to-br from-[#EFF6FF] to-[#FAF5FF] dark:from-[#111827] dark:to-[#172033] border border-[#DDD6FE] dark:border-purple-900/50 rounded-xl space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white text-xs font-bold shadow-2xs">
                    ₹
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                      Pending Closure Financial Details
                    </h3>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      Enter agreed fees and student token payment (INR ₹)
                    </p>
                  </div>
                </div>
                <span className="text-[10px] bg-[#EDE9FE] dark:bg-purple-950/60 text-[#7C3AED] dark:text-purple-300 font-bold px-2 py-0.5 rounded-full border border-[#DDD6FE] dark:border-purple-800">
                  Pending Closure Mandatory
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Total Agreed Amount */}
                <div>
                  <label htmlFor="agreed-amount-input" className="block text-[11px] font-semibold text-[#0F172A] dark:text-[#CBD5E1] mb-1">
                    Total Agreed Amount (₹) <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">₹</span>
                    <input
                      id="agreed-amount-input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={agreedAmount}
                      onChange={(e) => {
                        setAgreedAmount(e.target.value);
                        if (fieldErrors.agreed_amount) {
                          setFieldErrors((prev) => ({ ...prev, agreed_amount: undefined }));
                        }
                      }}
                      disabled={isSubmitting}
                      placeholder="e.g. 50000"
                      className={`w-full text-xs bg-white dark:bg-[#111827] border rounded-lg pl-7 pr-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition ${
                        fieldErrors.agreed_amount ? 'border-[#DC2626] bg-[#FEF2F2]/40' : 'border-[#CBD5E1] dark:border-[#334155] focus:border-[#2563EB]'
                      }`}
                    />
                  </div>
                  {fieldErrors.agreed_amount && (
                    <p className="text-[10px] text-[#DC2626] dark:text-rose-400 font-medium mt-1">
                      {fieldErrors.agreed_amount}
                    </p>
                  )}
                </div>

                {/* Amount Paid */}
                <div>
                  <label htmlFor="amount-paid-input" className="block text-[11px] font-semibold text-[#0F172A] dark:text-[#CBD5E1] mb-1">
                    Amount Paid (₹) <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-[#64748B] dark:text-[#94A3B8]">₹</span>
                    <input
                      id="amount-paid-input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={amountPaid}
                      onChange={(e) => {
                        setAmountPaid(e.target.value);
                        if (fieldErrors.amount_paid) {
                          setFieldErrors((prev) => ({ ...prev, amount_paid: undefined }));
                        }
                      }}
                      disabled={isSubmitting}
                      placeholder="e.g. 15000"
                      className={`w-full text-xs bg-white dark:bg-[#111827] border rounded-lg pl-7 pr-3 py-2 text-[#0F172A] dark:text-[#F8FAFC] font-mono focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 transition ${
                        fieldErrors.amount_paid ? 'border-[#DC2626] bg-[#FEF2F2]/40' : 'border-[#CBD5E1] dark:border-[#334155] focus:border-[#7C3AED]'
                      }`}
                    />
                  </div>
                  {fieldErrors.amount_paid && (
                    <p className="text-[10px] text-[#DC2626] dark:text-rose-400 font-medium mt-1">
                      {fieldErrors.amount_paid}
                    </p>
                  )}
                </div>
              </div>

              {/* Automatically Calculated Outstanding Balance Summary Card */}
              <div className="p-3 bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-lg grid grid-cols-3 gap-2 text-center text-xs shadow-2xs">
                <div>
                  <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] block">Total Agreed</span>
                  <span className="font-bold font-mono text-[#0F172A] dark:text-[#F8FAFC]">
                    ₹ {agreedNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#16A34A] dark:text-emerald-400 block font-medium">Amount Paid</span>
                  <span className="font-bold font-mono text-[#16A34A] dark:text-emerald-400">
                    ₹ {paidNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#2563EB] dark:text-blue-400 block font-medium">Outstanding Balance</span>
                  <span className={`font-bold font-mono ${outstandingBalance < 0 ? 'text-[#DC2626] dark:text-rose-400' : 'text-[#2563EB] dark:text-blue-400'}`}>
                    ₹ {outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Reason / Change Note */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="stage-change-note" className="text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#7C3AED] dark:text-purple-400" />
                <span>Reason / Stage Change Note</span>
                <span className="text-[#DC2626]">*</span>
              </label>
              <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-mono">
                {note.length} characters
              </span>
            </div>
            <textarea
              id="stage-change-note"
              rows={3}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (fieldErrors.note) {
                  setFieldErrors((prev) => ({ ...prev, note: undefined }));
                }
              }}
              disabled={isSubmitting}
              placeholder="Provide a mandatory note explaining the rationale for this stage transition (e.g., student attended demo class and requested discount negotiation)..."
              className={`w-full text-xs bg-[#F8FAFC] dark:bg-[#111827] border rounded-xl p-3 text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 transition resize-none ${
                fieldErrors.note ? 'border-[#DC2626] bg-[#FEF2F2]/50 dark:bg-rose-950/20' : 'border-[#CBD5E1] dark:border-[#334155] focus:border-[#7C3AED]'
              }`}
            />
            {fieldErrors.note ? (
              <p className="text-[11px] text-[#DC2626] dark:text-rose-400 font-medium mt-1">
                {fieldErrors.note}
              </p>
            ) : (
              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-1">
                This note will be permanently recorded in the lead audit timeline and stage history.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#334155] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="crm-btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#2563EB] to-[#7C3AED] hover:from-[#1D4ED8] hover:to-[#6D28D9] rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Stage...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Stage Change</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
