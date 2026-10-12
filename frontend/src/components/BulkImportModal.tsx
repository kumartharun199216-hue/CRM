import React, { useState, useEffect } from 'react';
import {
  User,
  PipelineStage,
  Team,
  ImportPreviewResponse,
  ImportValidateResponse,
  ImportConfirmResponse,
  AssignmentMode,
} from '../types';
import { api } from '../services/api';
import { normalizeCrmFieldKey } from './BulkImportPage';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Users,
  ShieldCheck,
  Check,
  RefreshCw,
  Info,
} from 'lucide-react';

interface BulkImportModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onImportComplete: () => void;
}

type Step = 'upload' | 'mapping' | 'assignment' | 'validate' | 'summary';

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onImportComplete,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview state from backend
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Column mapping: header -> crm_field_key
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Stages & Assignment options
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<number | ''>('');
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('ALL_ELIGIBLE');
  const [eligibleEmployees, setEligibleEmployees] = useState<User[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>('');

  // Validation response state
  const [validationResult, setValidationResult] = useState<ImportValidateResponse | null>(null);

  // Final summary state
  const [confirmResult, setConfirmResult] = useState<ImportConfirmResponse | null>(null);
  const [batchId] = useState<string>(() => 'batch_' + Math.random().toString(36).substring(2, 11));

  // Initialize data on modal open
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setFile(null);
      setError(null);
      setPreviewData(null);
      setColumnMapping({});
      setValidationResult(null);
      setConfirmResult(null);

      // Fetch active stages ordered by order
      api.getStages()
        .then((fetchedStages) => {
          const activeOrdered = (fetchedStages || [])
            .filter((s) => s.is_active && s.name.toLowerCase() !== 'all leads')
            .sort((a, b) => a.order - b.order);
          setStages(activeOrdered);
          if (activeOrdered.length > 0) {
            setSelectedStageId(activeOrdered[0].id);
          }
        })
        .catch(() => { });

      // Fetch teams if Admin
      if (currentUser.role === 'ADMIN') {
        api.getTeams().then(setTeams).catch(() => { });
      }

      // Fetch eligible sales employees based on role
      loadEligibleEmployees();
    }
  }, [isOpen]);

  const loadEligibleEmployees = (teamId?: number) => {
    const params: { role?: string; team?: number } = { role: 'SALES_EMPLOYEE' };
    if (currentUser.role === 'MANAGER') {
      const mgrTeam = currentUser.managed_team_id || currentUser.team;
      if (mgrTeam) params.team = mgrTeam;
    } else if (teamId) {
      params.team = teamId;
    }

    api.getUsers(params)
      .then((users) => {
        const validUsers = (users || []).filter(
          (u) => (u.team !== null && u.team !== undefined && u.team !== 0) || Boolean(u.team_name && u.team_name.trim() !== '')
        );
        setEligibleEmployees(validUsers);
        if (validUsers.length > 0) {
          setSelectedEmployeeId(validUsers[0].id);
          setSelectedEmployeeIds([validUsers[0].id]);
        } else {
          setSelectedEmployeeId('');
          setSelectedEmployeeIds([]);
        }
      })
      .catch(() => { });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      const ext = selected.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
        setError('Please select a valid CSV (.csv) or Excel (.xlsx, .xls) file.');
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleUploadAndPreview = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    if (selectedSheet) {
      formData.append('sheet_name', selectedSheet);
    }

    try {
      const res = await api.importPreview(formData);
      setPreviewData(res);
      setSelectedSheet(res.selected_sheet || (res.sheets && res.sheets[0]) || '');
      setColumnMapping(res.suggested_mapping || {});
      setStep('mapping');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to parse file preview.');
    } finally {
      setLoading(false);
    }
  };

  const handleSheetChange = async (sheet: string) => {
    if (!previewData || sheet === selectedSheet) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.importPreview({
        file_token: previewData.file_token,
        sheet_name: sheet,
      });
      setPreviewData(res);
      setSelectedSheet(sheet);
      setColumnMapping(res.suggested_mapping || {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to switch worksheet.');
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (header: string, crmField: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (!crmField) {
        delete next[header];
      } else {
        next[header] = crmField;
      }
      return next;
    });
  };

  // Check whether mandatory fields (name, email, phone) are mapped
  const nameHeaders = Object.entries(columnMapping).filter(([_, k]) => normalizeCrmFieldKey(k) === 'name');
  const emailHeaders = Object.entries(columnMapping).filter(([_, k]) => normalizeCrmFieldKey(k) === 'email');
  const phoneHeaders = Object.entries(columnMapping).filter(([_, k]) => normalizeCrmFieldKey(k) === 'phone');

  const isNameMapped = nameHeaders.length === 1;
  const isEmailMapped = emailHeaders.length === 1;
  const isPhoneMapped = phoneHeaders.length === 1;
  const hasDuplicateRequired = nameHeaders.length > 1 || emailHeaders.length > 1 || phoneHeaders.length > 1;
  const canProceedFromMapping = isNameMapped && isEmailMapped && isPhoneMapped && !hasDuplicateRequired;

  const handleValidate = async () => {
    if (!previewData) return;
    if (!selectedStageId) {
      setError('Please select a destination pipeline stage.');
      return;
    }

    if (assignmentMode === 'SINGLE' && !selectedEmployeeId) {
      setError('Please select an employee to assign all leads to.');
      return;
    }

    if (assignmentMode === 'SPLIT_SELECTED' && selectedEmployeeIds.length < 2) {
      setError('Please select at least 2 employees to split leads among.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      file_token: previewData.file_token,
      sheet_name: selectedSheet,
      column_mapping: columnMapping,
      stage_id: Number(selectedStageId),
      assignment_mode: assignmentMode,
      assigned_employees:
        assignmentMode === 'SINGLE'
          ? [Number(selectedEmployeeId)]
          : assignmentMode === 'SPLIT_SELECTED'
            ? selectedEmployeeIds
            : undefined,
      team_id: selectedTeamId ? Number(selectedTeamId) : undefined,
    };

    try {
      const res = await api.importValidate(payload);
      setValidationResult(res);
      setStep('validate');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Validation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !selectedStageId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.importConfirm({
        file_token: previewData.file_token,
        batch_id: batchId,
        sheet_name: selectedSheet,
        column_mapping: columnMapping,
        stage_id: Number(selectedStageId),
        assignment_mode: assignmentMode,
        assigned_employees:
          assignmentMode === 'SINGLE'
            ? [Number(selectedEmployeeId)]
            : assignmentMode === 'SPLIT_SELECTED'
              ? selectedEmployeeIds
              : undefined,
        team_id: selectedTeamId ? Number(selectedTeamId) : undefined,
      });

      setConfirmResult(res);
      setStep('summary');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    onImportComplete();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-fade-in">
      <div className="crm-card bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative">
        {/* Header */}
        <div className="p-4 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between bg-[#F8FAFC] dark:bg-[#111827]">
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
              Bulk Lead Import
            </h3>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Upload CSV or Excel spreadsheets, map columns, configure pipeline stage & employee distribution.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-100 hover:bg-[#EFF6FF] dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 py-2.5 bg-[#F1F5F9] dark:bg-slate-900/80 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between text-xs font-semibold">
          {[
            { key: 'upload', label: '1. File Upload' },
            { key: 'mapping', label: '2. Column Mapping' },
            { key: 'assignment', label: '3. Stage & Assignment' },
            { key: 'validate', label: '4. Validation & Preview' },
            { key: 'summary', label: '5. Summary' },
          ].map((s, idx) => {
            const stepOrder = ['upload', 'mapping', 'assignment', 'validate', 'summary'];
            const currentIdx = stepOrder.indexOf(step);
            const thisIdx = idx;
            const isCompleted = thisIdx < currentIdx;
            const isCurrent = thisIdx === currentIdx;

            return (
              <div
                key={s.key}
                className={`flex items-center gap-1.5 ${isCurrent
                    ? 'text-[#2563EB] dark:text-blue-400 font-bold'
                    : isCompleted
                      ? 'text-[#10B981] dark:text-emerald-400'
                      : 'text-[#94A3B8] dark:text-slate-500'
                  }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isCurrent
                      ? 'bg-[#2563EB] text-white shadow'
                      : isCompleted
                        ? 'bg-[#10B981] text-white'
                        : 'bg-[#CBD5E1] dark:bg-slate-700 text-white dark:text-slate-300'
                    }`}
                >
                  {isCompleted ? <Check className="w-3 h-3" /> : idx + 1}
                </div>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Body content based on active step */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto scrollbar-thin">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-[#DC2626] dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] dark:text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-[#CBD5E1] dark:border-slate-700 hover:border-[#2563EB] dark:hover:border-blue-500 rounded-2xl p-8 text-center bg-[#F8FAFC] dark:bg-slate-900/40 transition">
                <UploadCloud className="w-12 h-12 text-[#2563EB] dark:text-blue-400 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-[#0F172A] dark:text-slate-100 mb-1">
                  Select a CSV or Excel file to import
                </h4>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mb-4">
                  Supported formats: .csv, .xlsx, .xls (max 20MB, up to 10,000 rows).
                  Macros and formulas are neutralized safely.
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white text-xs font-semibold rounded-xl cursor-pointer hover:bg-[#1D4ED8] transition shadow-sm">
                  <span>Browse File</span>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                {file && (
                  <div className="mt-4 p-2.5 bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded-xl inline-flex items-center gap-2 text-xs font-medium text-[#0F172A] dark:text-slate-100">
                    <FileSpreadsheet className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
                    <span>{file.name}</span>
                    <span className="text-[#64748B] dark:text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              <div className="bg-[#EFF6FF] dark:bg-blue-950/30 border border-[#BFDBFE] dark:border-blue-900/50 rounded-xl p-3.5 text-xs text-[#1E40AF] dark:text-blue-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Source Data Preservation Rules:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Required fields: <strong>Lead Name</strong>, <strong>Email</strong>, and <strong>Mobile Phone</strong>.</li>
                    <li>Optional fields remain empty if absent from the spreadsheet; no dummy records or placeholder data will ever be fabricated.</li>
                    <li>Row-level validation checks are performed prior to database creation.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {step === 'mapping' && previewData && (
            <div className="space-y-4">
              {/* Sheet selector if Excel has multiple sheets */}
              {previewData.sheets && previewData.sheets.length > 1 && (
                <div className="flex items-center gap-2 bg-[#F8FAFC] dark:bg-slate-900/50 p-3 rounded-xl border border-[#E2E8F0] dark:border-slate-800">
                  <label className="text-xs font-semibold text-[#0F172A] dark:text-slate-200">Worksheet:</label>
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    disabled={loading}
                    className="text-xs border border-[#CBD5E1] dark:border-slate-700 rounded-lg px-2.5 py-1 bg-white dark:bg-[#111827] text-[#0F172A] dark:text-slate-100"
                  >
                    {previewData.sheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-[#64748B] dark:text-slate-400 ml-2">
                    {previewData.total_rows} total rows detected in this sheet.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A] dark:text-slate-100">Map Source Columns to CRM Lead Fields</h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Map each detected column header. Unmapped columns will be safely ignored.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${isNameMapped ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300'}`}>
                    Name {isNameMapped ? '✓' : '✗'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${isEmailMapped ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300'}`}>
                    Email {isEmailMapped ? '✓' : '✗'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${isPhoneMapped ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300'}`}>
                    Phone {isPhoneMapped ? '✓' : '✗'}
                  </span>
                </div>
              </div>

              {!canProceedFromMapping && (
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-[#92400E] dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#D97706] dark:text-amber-400" />
                  <span>Mandatory fields required before import: <strong>Lead Name</strong>, <strong>Email</strong>, and <strong>Mobile Phone</strong>.</span>
                </div>
              )}

              {/* Mapping Table */}
              <div className="border border-[#E2E8F0] dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8FAFC] dark:bg-slate-900/60 border-b border-[#E2E8F0] dark:border-slate-800 text-[#475569] dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Spreadsheet Column Header</th>
                      <th className="py-2.5 px-3">Sample Value</th>
                      <th className="py-2.5 px-3">Maps To CRM Lead Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                    {previewData.headers.map((header) => {
                      const sampleVal = previewData.sample_rows?.[0]?.[header] || '';
                      const currentMapped = columnMapping[header] || '';

                      return (
                        <tr key={header} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition">
                          <td className="py-2 px-3 font-semibold text-[#0F172A] dark:text-slate-200">{header}</td>
                          <td className="py-2 px-3 text-[#64748B] dark:text-slate-400 truncate max-w-xs">{String(sampleVal)}</td>
                          <td className="py-2 px-3">
                            <select
                              value={currentMapped}
                              onChange={(e) => handleMappingChange(header, e.target.value)}
                              className="w-full text-xs border border-[#CBD5E1] dark:border-slate-700 rounded-lg px-2.5 py-1 bg-white dark:bg-[#111827] text-[#0F172A] dark:text-slate-100 focus:border-[#2563EB] dark:focus:border-blue-500 focus:ring-1 focus:ring-[#2563EB]"
                            >
                              <option value="">-- Ignore this column --</option>
                              {previewData.supported_crm_fields.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label} {f.required ? '(Required)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: Stage & Assignment Configuration */}
          {step === 'assignment' && (
            <div className="space-y-6">
              {/* Destination Pipeline Stage */}
              <div className="p-4 bg-[#F8FAFC] dark:bg-slate-900/50 border border-[#E2E8F0] dark:border-slate-800 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-[#0F172A] dark:text-slate-100">
                  Destination Pipeline Stage *
                </label>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  All successfully imported leads in this batch will be initially placed in this pipeline stage.
                </p>
                <select
                  value={selectedStageId}
                  onChange={(e) => setSelectedStageId(Number(e.target.value))}
                  className="w-full max-w-md text-xs border border-[#CBD5E1] dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-[#111827] text-[#0F172A] dark:text-slate-100 font-medium"
                >
                  {stages.map((stg) => (
                    <option key={stg.id} value={stg.id}>
                      {stg.order}. {stg.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignment Mode Selection */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
                  Employee Assignment and Distribution Mode *
                </h4>

                {currentUser.role === 'ADMIN' && teams.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs font-semibold text-[#475569] dark:text-slate-300">Filter by Team (Optional):</label>
                    <select
                      value={selectedTeamId}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : '';
                        setSelectedTeamId(val);
                        loadEligibleEmployees(val ? Number(val) : undefined);
                      }}
                      className="text-xs border border-[#CBD5E1] dark:border-slate-700 rounded-lg px-2.5 py-1 bg-white dark:bg-[#111827] text-[#0F172A] dark:text-slate-100"
                    >
                      <option value="">All Teams (Global)</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Mode A */}
                  <div
                    onClick={() => setAssignmentMode('SINGLE')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${assignmentMode === 'SINGLE'
                        ? 'border-[#2563EB] dark:border-blue-500 bg-[#EFF6FF] dark:bg-blue-950/30 shadow-sm'
                        : 'border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#172033] hover:border-[#CBD5E1] dark:hover:border-slate-700'
                      }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#0F172A] dark:text-slate-100">Mode A</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${assignmentMode === 'SINGLE'
                              ? 'border-[#2563EB] bg-[#2563EB] text-white'
                              : 'border-[#CBD5E1] dark:border-slate-600'
                            }`}
                        >
                          {assignmentMode === 'SINGLE' && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                      <p className="text-xs font-medium text-[#1E293B] dark:text-slate-200">Assign all to one employee</p>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1">
                        Every imported lead will be assigned to a single selected Counsellor/Sales Employee.
                      </p>
                    </div>
                  </div>

                  {/* Mode B */}
                  <div
                    onClick={() => setAssignmentMode('SPLIT_SELECTED')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${assignmentMode === 'SPLIT_SELECTED'
                        ? 'border-[#2563EB] dark:border-blue-500 bg-[#EFF6FF] dark:bg-blue-950/30 shadow-sm'
                        : 'border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#172033] hover:border-[#CBD5E1] dark:hover:border-slate-700'
                      }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#0F172A] dark:text-slate-100">Mode B</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${assignmentMode === 'SPLIT_SELECTED'
                              ? 'border-[#2563EB] bg-[#2563EB] text-white'
                              : 'border-[#CBD5E1] dark:border-slate-600'
                            }`}
                        >
                          {assignmentMode === 'SPLIT_SELECTED' && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                      <p className="text-xs font-medium text-[#1E293B] dark:text-slate-200">Split among selected employees</p>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1">
                        Distributes leads evenly among 2 or more chosen Counsellors/Sales Employees.
                      </p>
                    </div>
                  </div>

                  {/* Mode C */}
                  <div
                    onClick={() => setAssignmentMode('ALL_ELIGIBLE')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${assignmentMode === 'ALL_ELIGIBLE'
                        ? 'border-[#2563EB] dark:border-blue-500 bg-[#EFF6FF] dark:bg-blue-950/30 shadow-sm'
                        : 'border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#172033] hover:border-[#CBD5E1] dark:hover:border-slate-700'
                      }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#0F172A] dark:text-slate-100">Mode C</span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${assignmentMode === 'ALL_ELIGIBLE'
                              ? 'border-[#2563EB] bg-[#2563EB] text-white'
                              : 'border-[#CBD5E1] dark:border-slate-600'
                            }`}
                        >
                          {assignmentMode === 'ALL_ELIGIBLE' && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                      <p className="text-xs font-medium text-[#1E293B] dark:text-slate-200">Split among all eligible employees</p>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1">
                        Automatically distributes leads evenly across all active employees in scope.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub-inputs based on mode */}
                {assignmentMode === 'SINGLE' && (
                  <div className="p-3 bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-slate-700 rounded-xl space-y-1">
                    <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">Select Employee:</label>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(Number(e.target.value))}
                      className="w-full max-w-sm text-xs border border-[#CBD5E1] dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-900 text-[#0F172A] dark:text-slate-100"
                    >
                      {eligibleEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name ? `${emp.first_name} ${emp.last_name || ''}` : emp.username} ({emp.team_name || 'No Team'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {assignmentMode === 'SPLIT_SELECTED' && (
                  <div className="p-3 bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-slate-700 rounded-xl space-y-2">
                    <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                      Select Employees to distribute among (selected: {selectedEmployeeIds.length}):
                    </label>
                    <div className="max-h-40 overflow-y-auto space-y-1 border border-[#E2E8F0] dark:border-slate-800 p-2 rounded-lg scrollbar-thin">
                      {eligibleEmployees.map((emp) => {
                        const checked = selectedEmployeeIds.includes(emp.id);
                        return (
                          <label
                            key={emp.id}
                            className="flex items-center gap-2 p-1 text-xs hover:bg-[#F8FAFC] dark:hover:bg-slate-800/50 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedEmployeeIds([...selectedEmployeeIds, emp.id]);
                                } else {
                                  setSelectedEmployeeIds(selectedEmployeeIds.filter((id) => id !== emp.id));
                                }
                              }}
                              className="rounded border-[#CBD5E1] dark:border-slate-700 dark:bg-slate-900 text-[#2563EB] focus:ring-[#2563EB]"
                            />
                            <span className="font-medium text-[#0F172A] dark:text-slate-200">
                              {emp.first_name ? `${emp.first_name} ${emp.last_name || ''}` : emp.username}
                            </span>
                            <span className="text-[#64748B] dark:text-slate-400 text-[11px]">({emp.team_name || 'No Team'})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {assignmentMode === 'ALL_ELIGIBLE' && (
                  <div className="p-3 bg-[#F8FAFC] dark:bg-slate-900/50 border border-[#E2E8F0] dark:border-slate-800 rounded-xl text-xs text-[#475569] dark:text-slate-300">
                    <p>
                      Distribution will target all <strong>{eligibleEmployees.length} active sales employees</strong> currently available in your authorized scope.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Validation & Preview */}
          {step === 'validate' && validationResult && (
            <div className="space-y-5">
              {/* Validation Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 bg-[#F8FAFC] dark:bg-slate-900/50 border border-[#E2E8F0] dark:border-slate-800 rounded-xl">
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 font-medium">Source Rows</p>
                  <p className="text-xl font-bold text-[#0F172A] dark:text-slate-100 mt-0.5">{validationResult.total_rows}</p>
                </div>
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Valid Leads</p>
                  <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">{validationResult.valid_count}</p>
                </div>
                <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl">
                  <p className="text-[11px] text-red-700 dark:text-red-400 font-medium">Invalid / Rejected</p>
                  <p className="text-xl font-bold text-red-800 dark:text-red-300 mt-0.5">{validationResult.invalid_count}</p>
                </div>
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Potential Duplicates</p>
                  <p className="text-xl font-bold text-amber-800 dark:text-amber-300 mt-0.5">{validationResult.duplicate_count}</p>
                </div>
              </div>

              {/* Planned Distribution Breakdown */}
              {Array.isArray(validationResult.distribution) && validationResult.distribution.length > 0 && (
                <div className="p-3.5 bg-[#F8FAFC] dark:bg-slate-900/50 border border-[#E2E8F0] dark:border-slate-800 rounded-xl space-y-2">
                  <h5 className="text-xs font-bold text-[#0F172A] dark:text-slate-100 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#2563EB] dark:text-blue-400" />
                    Planned Employee Distribution ({validationResult.distribution.length} employees)
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {validationResult.distribution.map((dist) => (
                      <div
                        key={dist.employee_id}
                        className="p-2 bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-slate-800 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#0F172A] dark:text-slate-200">{dist.employee_name || dist.username}</p>
                          <p className="text-[10px] text-[#64748B] dark:text-slate-400">{dist.team_name || 'No Team'}</p>
                        </div>
                        <span className="px-2 py-0.5 bg-[#EFF6FF] dark:bg-blue-950/40 text-[#2563EB] dark:text-blue-400 font-bold rounded-full">
                          {dist.count} leads
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Row-Level Validation Errors (if any) */}
              {validationResult.invalid_count > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-[#DC2626] dark:text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-[#DC2626] dark:text-red-400" />
                    Invalid Rows ({validationResult.invalid_count}) - Will Be Rejected
                  </h5>
                  <div className="max-h-48 overflow-y-auto border border-red-200 dark:border-red-900/60 rounded-xl overflow-hidden scrollbar-thin">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300 font-semibold border-b border-red-200 dark:border-red-900/60">
                        <tr>
                          <th className="py-2 px-3">Row #</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Validation Errors</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100 dark:divide-red-900/40 bg-white dark:bg-[#111827]">
                        {validationResult.row_validations
                          .filter((r) => !r.is_valid)
                          .map((rv) => (
                            <tr key={rv.row_number} className="hover:bg-red-50/50 dark:hover:bg-red-950/30">
                              <td className="py-1.5 px-3 font-mono font-bold text-[#0F172A] dark:text-slate-200">
                                #{rv.row_number}
                              </td>
                              <td className="py-1.5 px-3">
                                <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 rounded text-[10px] font-semibold">
                                  Invalid
                                </span>
                              </td>
                              <td className="py-1.5 px-3 text-[#DC2626] dark:text-red-400">
                                {rv.errors.join('; ')}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Confirmation Notice */}
              <div className="p-3 bg-[#EFF6FF] dark:bg-blue-950/30 border border-[#BFDBFE] dark:border-blue-900/50 rounded-xl text-xs text-[#1E40AF] dark:text-blue-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#2563EB] dark:text-blue-400" />
                <div>
                  <p className="font-semibold">Confirmation Required Before Database Write:</p>
                  <p className="text-[11px] text-[#1E3A8A] dark:text-blue-200 mt-0.5">
                    Clicking <strong>Confirm & Import Valid Leads</strong> will import {validationResult.valid_count} valid leads in an atomic database transaction. Any invalid rows ({validationResult.invalid_count}) will be safely rejected and reported in the final summary.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Summary */}
          {step === 'summary' && confirmResult && (
            <div className="space-y-6 text-center py-4">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-[#0F172A] dark:text-slate-100">Lead Import Batch Completed!</h4>
                <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1 font-mono">
                  Batch ID: {confirmResult.batch_id}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto text-left">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-center">
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">Imported</p>
                  <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">{confirmResult.imported_count}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-center">
                  <p className="text-[11px] text-red-700 dark:text-red-400 font-semibold">Rejected</p>
                  <p className="text-2xl font-bold text-red-800 dark:text-red-300">{confirmResult.rejected_count}</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-center">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">Duplicates</p>
                  <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">{confirmResult.duplicate_count}</p>
                </div>
              </div>

              {/* Employee Distribution Outcome */}
              <div className="max-w-md mx-auto p-3 bg-[#F8FAFC] dark:bg-slate-900/50 border border-[#E2E8F0] dark:border-slate-800 rounded-xl text-left">
                <p className="text-xs font-bold text-[#0F172A] dark:text-slate-100 mb-2">Assignment Distribution Outcome:</p>
                <div className="space-y-1">
                  {Object.entries(confirmResult.distribution || {}).map(([empName, count]) => (
                    <div key={empName} className="flex items-center justify-between text-xs py-1 border-b border-[#E2E8F0] dark:border-slate-800 last:border-0">
                      <span className="font-medium text-[#0F172A] dark:text-slate-200">{empName}</span>
                      <span className="font-bold text-[#2563EB] dark:text-blue-400">{count} leads</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#111827] flex items-center justify-between">
          <div>
            {step === 'mapping' && (
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#475569] dark:text-slate-300 hover:bg-[#E2E8F0] dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to File</span>
              </button>
            )}
            {step === 'assignment' && (
              <button
                type="button"
                onClick={() => setStep('mapping')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#475569] dark:text-slate-300 hover:bg-[#E2E8F0] dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Mapping</span>
              </button>
            )}
            {step === 'validate' && (
              <button
                type="button"
                onClick={() => setStep('assignment')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#475569] dark:text-slate-300 hover:bg-[#E2E8F0] dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Assignment</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step !== 'summary' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-slate-100 hover:bg-[#E2E8F0] dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>

                {step === 'upload' && (
                  <button
                    type="button"
                    disabled={!file || loading}
                    onClick={handleUploadAndPreview}
                    className="crm-btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    <span>{loading ? 'Analyzing...' : 'Next: Map Columns'}</span>
                  </button>
                )}

                {step === 'mapping' && (
                  <button
                    type="button"
                    disabled={!canProceedFromMapping || loading}
                    onClick={() => setStep('assignment')}
                    className="crm-btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <span>Next: Stage & Assignment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {step === 'assignment' && (
                  <button
                    type="button"
                    disabled={loading || !selectedStageId}
                    onClick={handleValidate}
                    className="crm-btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                    <span>{loading ? 'Validating...' : 'Validate Import Data'}</span>
                  </button>
                )}

                {step === 'validate' && validationResult && (
                  <button
                    type="button"
                    disabled={loading || validationResult.valid_count === 0}
                    onClick={handleConfirmImport}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{loading ? 'Writing to Database...' : 'Confirm & Import Valid Leads'}</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleDone}
                className="crm-btn-primary px-5 py-2 rounded-xl text-xs font-semibold text-white transition shadow-sm cursor-pointer"
              >
                Done & View Leads
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
