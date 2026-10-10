import React, { useState, useEffect } from 'react';
import { Lead, PipelineStage } from '../types';
import { api } from '../services/api';
import {
  X,
  Layers,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  FileText,
  Clock,
  User as UserIcon
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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ destination_stage_id?: string; note?: string }>({});

  // Active stages sorted in configured pipeline order
  const activeStages = [...stages]
    .filter((s) => s.is_active)
    .sort((a, b) => a.order - b.order);

  const currentStageObj = lead?.stage
    ? stages.find((s) => s.id === lead.stage)
    : null;

  useEffect(() => {
    if (isOpen && lead) {
      setNote('');
      setErrorMessage(null);
      setSuccessMessage(null);
      setFieldErrors({});

      // Pre-select first valid destination stage that is not the current stage
      const firstAvailable = activeStages.find((s) => s.id !== lead.stage);
      setDestinationStageId(firstAvailable ? firstAvailable.id.toString() : '');
    }
  }, [isOpen, lead]);

  if (!isOpen || !lead) return null;

  const validate = (): boolean => {
    const errors: { destination_stage_id?: string; note?: string } = {};

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
      const response = await api.changeLeadStage(lead.id, {
        destination_stage_id: destId,
        note: note.trim(),
        expected_current_stage_id: lead.stage,
      });

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

  const selectedDestinationObj = activeStages.find(
    (s) => s.id.toString() === destinationStageId
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto font-sans animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative text-[#0F172A]">
        {/* Top Accent Gradient Bar */}
        <div className="h-1 bg-gradient-to-r from-[#2563EB] via-[#7C3AED] to-[#1E3A8A]" />

        {/* Modal Header */}
        <div className="p-5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white shadow-xs shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight">Change Pipeline Stage</h2>
              <p className="text-xs text-[#64748B]">Update lead progression and record mandatory audit history</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lead Context Summary Card */}
        <div className="px-5 pt-4">
          <div className="p-3.5 bg-gradient-to-br from-[#EFF6FF]/60 to-[#F5F3FF]/60 border border-[#DBEAFE] rounded-xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-[#2563EB] bg-[#DBEAFE] px-2 py-0.5 rounded-md">
                  {lead.lead_id}
                </span>
                <span className="text-xs font-semibold text-[#0F172A] truncate">
                  {lead.name || lead.contact_name || 'Lead'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#64748B]">
                <span className="truncate">{lead.email}</span>
                <span>•</span>
                <span className="font-mono">{lead.phone}</span>
              </div>
            </div>

            {/* Current Stage Badge */}
            <div className="text-right shrink-0">
              <span className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider block">Current Stage</span>
              <span className="inline-block mt-0.5 px-2.5 py-1 bg-white border border-[#CBD5E1] text-[#0F172A] font-semibold text-xs rounded-lg shadow-2xs">
                {currentStageObj ? `${currentStageObj.order}. ${currentStageObj.name}` : 'Unassigned'}
              </span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl flex items-start gap-2.5 text-[#DC2626] text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl flex items-center gap-2.5 text-[#16A34A] text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Stage Transition Visualizer */}
          <div className="flex items-center justify-center gap-3 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs">
            <div className="text-center">
              <span className="text-[10px] text-[#64748B] font-medium block">From</span>
              <span className="font-semibold text-[#64748B]">
                {currentStageObj ? currentStageObj.name : 'Unassigned'}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-[#2563EB] shrink-0" />
            <div className="text-center">
              <span className="text-[10px] text-[#7C3AED] font-medium block">To Destination</span>
              <span className="font-bold text-[#7C3AED]">
                {selectedDestinationObj ? selectedDestinationObj.name : 'Select below'}
              </span>
            </div>
          </div>

          {/* Destination Stage Select */}
          <div>
            <label htmlFor="destination-stage-select" className="block text-xs font-semibold text-[#0F172A] mb-1.5">
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
              className={`w-full text-xs bg-[#F8FAFC] border rounded-xl px-3 py-2.5 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition cursor-pointer font-medium ${
                fieldErrors.destination_stage_id ? 'border-[#DC2626] bg-[#FEF2F2]/50' : 'border-[#CBD5E1] focus:border-[#2563EB]'
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
              <p className="text-[11px] text-[#DC2626] font-medium mt-1">
                {fieldErrors.destination_stage_id}
              </p>
            )}
          </div>

          {/* Reason / Change Note */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="stage-change-note" className="text-xs font-semibold text-[#0F172A] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>Reason / Stage Change Note</span>
                <span className="text-[#DC2626]">*</span>
              </label>
              <span className="text-[10px] text-[#64748B] font-mono">
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
              className={`w-full text-xs bg-[#F8FAFC] border rounded-xl p-3 text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 transition resize-none ${
                fieldErrors.note ? 'border-[#DC2626] bg-[#FEF2F2]/50' : 'border-[#CBD5E1] focus:border-[#7C3AED]'
              }`}
            />
            {fieldErrors.note ? (
              <p className="text-[11px] text-[#DC2626] font-medium mt-1">
                {fieldErrors.note}
              </p>
            ) : (
              <p className="text-[10px] text-[#64748B] mt-1">
                This note will be permanently recorded in the lead audit timeline and stage history.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-xl border border-[#CBD5E1] transition cursor-pointer disabled:opacity-50"
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
