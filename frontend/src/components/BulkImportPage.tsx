import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  User,
  PipelineStage,
  Team,
  ImportPreviewResponse,
  ImportValidateResponse,
  ImportConfirmResponse,
  LeadImportBatchRecord,
} from '../types';
import { api } from '../services/api';
import { SearchableEmployeeSelect } from './SearchableEmployeeSelect';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Users,
  Download,
  Eye,
  Layers,
  RefreshCw,
  FileCheck,
  FileWarning,
  Check,
  X,
  FileText,
  Calendar,
  Tag,
  Flag,
  HelpCircle,
} from 'lucide-react';

interface BulkImportPageProps {
  currentUser: User;
  stages: PipelineStage[];
  teams: Team[];
  users: User[];
  onNavigateToPipeline: (stageId?: number | null) => void;
  onRefreshCrmData?: () => void;
}

const DEFAULT_SOURCES = [
  'Cold Calling / Raw Database',
  'Campus Drive',
  'College Database',
  'Job Portal',
  'Website Leads',
  'Referral',
  'Other',
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export const REQUIRED_CRM_FIELDS = [
  {
    key: 'name',
    label: 'Lead Name',
    aliases: ['name', 'lead_name', 'leadname', 'student_name', 'studentname', 'candidate_name', 'candidatename', 'full_name', 'fullname'],
  },
  {
    key: 'email',
    label: 'Email',
    aliases: ['email', 'email_address', 'emailaddress', 'mail'],
  },
  {
    key: 'phone',
    label: 'Mobile Phone',
    aliases: ['phone', 'mobile', 'mobile_phone', 'mobilephone', 'mobile_number', 'mobilenumber', 'phone_number', 'phonenumber', 'contact_number'],
  },
] as const;

export function normalizeCrmFieldKey(rawKey: string): string {
  if (!rawKey) return '';
  const trimmed = rawKey.trim();
  const lower = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['name', 'leadname', 'studentname', 'candidatename', 'fullname'].includes(lower)) return 'name';
  if (['email', 'emailaddress', 'mail'].includes(lower)) return 'email';
  if (['phone', 'mobile', 'mobilephone', 'mobilenumber', 'phonenumber', 'contactnumber'].includes(lower)) return 'phone';
  return trimmed;
}

export const BulkImportPage: React.FC<BulkImportPageProps> = ({
  currentUser,
  stages,
  teams,
  users: _allUsers,
  onNavigateToPipeline,
  onRefreshCrmData,
}) => {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'import' | 'history'>('import');

  // Step 1: Configuration state
  const activeStages = useMemo(() => {
    return (stages || [])
      .filter((s) => s.is_active && s.name.toLowerCase() !== 'all leads')
      .sort((a, b) => a.order - b.order);
  }, [stages]);

  const [selectedStageId, setSelectedStageId] = useState<number>(() => {
    const coldCalling = activeStages.find((s) => s.name.toLowerCase().includes('cold calling'));
    return coldCalling ? coldCalling.id : (activeStages[0]?.id || 1);
  });

  const [sourceType, setSourceType] = useState<string>('Cold Calling / Raw Database');
  const [customSource, setCustomSource] = useState<string>('');
  const [priority, setPriority] = useState<string>('MEDIUM');
  const [batchNote, setBatchNote] = useState<string>('');

  // Step 1: Employee Assignment state
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>(() => {
    if (currentUser.role === 'MANAGER') {
      return currentUser.managed_team_id || currentUser.team || '';
    }
    return '';
  });

  const [eligibleEmployees, setEligibleEmployees] = useState<User[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [isUnassigned, setIsUnassigned] = useState<boolean>(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  // Step 2: File Upload state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Column Mapping state
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Step 4: Validation state
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ImportValidateResponse | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'VALID' | 'INVALID' | 'DUPLICATE'>('ALL');
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [previewPage, setPreviewPage] = useState<number>(1);
  const PREVIEW_PAGE_SIZE = 10;

  // Step 5: Import confirmation & progress
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgressStep, setImportProgressStep] = useState<string>('');
  const [confirmResult, setConfirmResult] = useState<ImportConfirmResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Import History state
  const [historyBatches, setHistoryBatches] = useState<LeadImportBatchRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<LeadImportBatchRecord | null>(null);

  // Load eligible employees
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const params: { role?: string; team?: number } = { role: 'SALES_EMPLOYEE' };
        if (currentUser.role === 'MANAGER') {
          const mgrTeam = currentUser.managed_team_id || currentUser.team;
          if (mgrTeam) params.team = mgrTeam;
        } else if (selectedTeamId) {
          params.team = selectedTeamId as number;
        }

        const users = await api.getUsers(params);
        const validUsers = (users || []).filter(
          (u) => (u.team !== null && u.team !== undefined && u.team !== 0) || Boolean(u.team_name && u.team_name.trim() !== '')
        );
        setEligibleEmployees(validUsers);
      } catch (err: unknown) {
        console.error('Failed to load eligible employees:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, [currentUser, selectedTeamId]);

  // Update default stage when active stages load
  useEffect(() => {
    if (activeStages.length > 0 && !selectedStageId) {
      const coldCalling = activeStages.find((s) => s.name.toLowerCase().includes('cold calling'));
      setSelectedStageId(coldCalling ? coldCalling.id : activeStages[0].id);
    }
  }, [activeStages, selectedStageId]);

  // Load Import History when switching to history tab
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const batches = await api.getImportBatches();
      setHistoryBatches(batches || []);
    } catch (err: unknown) {
      console.error('Failed to load import batches:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Helper for sample download
  const handleDownloadSample = async (format: 'xlsx' | 'csv') => {
    try {
      await api.downloadSampleFile(format);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to download sample file');
    }
  };

  // File handling
  const handleFileSelect = async (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      setPreviewError('Unsupported file format. Please upload a valid .xlsx, .xls, or .csv file.');
      return;
    }

    setFile(selectedFile);
    setPreviewError(null);
    setLoadingPreview(true);
    setValidationResult(null);
    setConfirmResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const preview = await api.importPreview(formData);
      setPreviewData(preview);
      setSelectedSheet(preview.selected_sheet || preview.sheets?.[0] || '');
      setColumnMapping(preview.suggested_mapping || {});
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to parse file');
      setFile(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSheetChange = async (sheetName: string) => {
    if (!previewData?.file_token) return;
    setSelectedSheet(sheetName);
    setLoadingPreview(true);
    try {
      const preview = await api.importPreview({
        file_token: previewData.file_token,
        sheet_name: sheetName,
      });
      setPreviewData(preview);
      setColumnMapping(preview.suggested_mapping || {});
      setValidationResult(null);
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to switch sheet');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Compute distribution breakdown (from validation result or mathematically)
  const distributionBreakdown = useMemo(() => {
    if (isUnassigned) {
      return {
        summaryText: 'Unassigned Queue Pool',
        detailText: 'Valid leads will be placed in the Unassigned Leads queue for triage.',
        items: [] as { name: string; count: number }[],
      };
    }

    if (selectedEmployeeIds.length === 0) {
      return {
        summaryText: 'No employees selected',
        detailText: 'Please select eligible employees or check "Import as Unassigned Leads".',
        items: [] as { name: string; count: number }[],
      };
    }

    // Selected employees
    const selectedEmps = eligibleEmployees.filter((e) => selectedEmployeeIds.includes(e.id));
    const empCount = selectedEmps.length;

    if (!validationResult) {
      return {
        summaryText: `${empCount} ${empCount === 1 ? 'employee' : 'employees'} selected`,
        detailText: 'Upload and validate your file to calculate exact lead allocation.',
        items: selectedEmps.map((e) => ({
          name: e.name || e.first_name || e.username,
          count: 0,
        })),
      };
    }

    const validCount = validationResult.valid_count;

    // If backend provided structured distribution
    if (validationResult.distribution && Array.isArray(validationResult.distribution) && validationResult.distribution.length > 0) {
      const items = validationResult.distribution.map((d) => ({
        name: d.employee_name || d.username,
        count: d.count,
      }));
      return {
        summaryText: `${validCount} valid leads · ${empCount} employees selected`,
        detailText: items.map((i) => `${i.name}: ${i.count}`).join(' · '),
        items,
      };
    }

    // Fallback mathematical round-robin calculation
    const base = Math.floor(validCount / empCount);
    const rem = validCount % empCount;
    const items = selectedEmps.map((e, idx) => ({
      name: e.name || e.first_name || e.username,
      count: base + (idx < rem ? 1 : 0),
    }));

    return {
      summaryText: `${validCount} valid leads · ${empCount} employees selected`,
      detailText: items.map((i) => `${i.name}: ${i.count}`).join(' · '),
      items,
    };
  }, [isUnassigned, selectedEmployeeIds, eligibleEmployees, validationResult]);

  // Validation execution
  const handleValidateRows = async () => {
    if (!previewData?.file_token) {
      setPreviewError('Please upload a file first.');
      return;
    }

    if (!isUnassigned && selectedEmployeeIds.length === 0) {
      setAssignmentError('Please select at least one employee or choose "Import as Unassigned Leads".');
      return;
    }
    setAssignmentError(null);

    // Check mandatory fields and duplicate mappings
    if (!isMappingComplete) {
      if (duplicateList.length > 0) {
        const dupDescriptions = duplicateList.map((d) => `"${d.label}" is mapped to multiple columns (${d.headers.join(', ')})`).join('; ');
        setPreviewError(`Duplicate column mapping detected: ${dupDescriptions}. Each CRM field must be mapped to at most one column.`);
      } else {
        setPreviewError(`Missing required column mappings: ${missingRequiredLabels.join(', ')}`);
      }
      return;
    }

    setIsValidating(true);
    setPreviewError(null);

    const actualSource = sourceType === 'Other' && customSource.trim() ? customSource.trim() : sourceType;

    // Canonical column mapping payload
    const canonicalMapping: Record<string, string> = {};
    for (const [header, rawCrmKey] of Object.entries(columnMapping)) {
      if (rawCrmKey && rawCrmKey.trim() !== '') {
        canonicalMapping[header] = normalizeCrmFieldKey(rawCrmKey);
      }
    }

    try {
      const res = await api.importValidate({
        file_token: previewData.file_token,
        sheet_name: selectedSheet,
        column_mapping: canonicalMapping,
        stage_id: selectedStageId,
        assignment_mode: isUnassigned ? 'UNASSIGNED' : 'SELECTED',
        assigned_employees: isUnassigned ? [] : selectedEmployeeIds,
        team_id: selectedTeamId ? Number(selectedTeamId) : undefined,
        source: actualSource,
        default_priority: priority,
        batch_note: batchNote.trim(),
        is_unassigned: isUnassigned,
      });

      setValidationResult(res);
      setPreviewPage(1);
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  // Import execution
  const handleExecuteImport = async () => {
    if (!previewData?.file_token || !validationResult) return;
    if (validationResult.valid_count === 0) {
      setImportError('No valid leads available to import.');
      return;
    }

    if (!isUnassigned && selectedEmployeeIds.length === 0) {
      setAssignmentError('Please select at least one employee or choose "Import as Unassigned Leads".');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    // Sequential UI progress
    setImportProgressStep('Validating allocation plan and team scopes...');
    await new Promise((r) => setTimeout(r, 200));

    setImportProgressStep('Checking duplicate records against database...');
    await new Promise((r) => setTimeout(r, 250));

    setImportProgressStep('Creating lead records in pipeline...');

    const actualSource = sourceType === 'Other' && customSource.trim() ? customSource.trim() : sourceType;

    // Canonical column mapping payload
    const canonicalMapping: Record<string, string> = {};
    for (const [header, rawCrmKey] of Object.entries(columnMapping)) {
      if (rawCrmKey && rawCrmKey.trim() !== '') {
        canonicalMapping[header] = normalizeCrmFieldKey(rawCrmKey);
      }
    }

    try {
      const res = await api.importConfirm({
        file_token: previewData.file_token,
        sheet_name: selectedSheet,
        column_mapping: canonicalMapping,
        stage_id: selectedStageId,
        assignment_mode: isUnassigned ? 'UNASSIGNED' : 'SELECTED',
        assigned_employees: isUnassigned ? [] : selectedEmployeeIds,
        team_id: selectedTeamId ? Number(selectedTeamId) : undefined,
        source: actualSource,
        default_priority: priority,
        batch_note: batchNote.trim(),
        is_unassigned: isUnassigned,
      });

      setImportProgressStep('Finalizing assignment histories and audit events...');
      await new Promise((r) => setTimeout(r, 200));

      setConfirmResult(res);
      onRefreshCrmData?.();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  // Reset import workflow
  const handleResetImport = () => {
    setFile(null);
    setPreviewData(null);
    setValidationResult(null);
    setConfirmResult(null);
    setPreviewError(null);
    setImportError(null);
    setAssignmentError(null);
    setBatchNote('');
  };

  // Filtered rows for Step 4 Preview Table
  const filteredPreviewRows = useMemo(() => {
    if (!validationResult?.row_validations) return [];
    return validationResult.row_validations.filter((row) => {
      if (previewFilter === 'VALID' && (!row.is_valid || row.is_duplicate)) return false;
      if (previewFilter === 'INVALID' && row.is_valid) return false;
      if (previewFilter === 'DUPLICATE' && !row.is_duplicate) return false;

      if (previewSearch.trim()) {
        const query = previewSearch.toLowerCase();
        const dataValues = Object.values(row.data || {}).join(' ').toLowerCase();
        return dataValues.includes(query);
      }
      return true;
    });
  }, [validationResult, previewFilter, previewSearch]);

  const paginatedPreviewRows = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE;
    return filteredPreviewRows.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [filteredPreviewRows, previewPage]);

  const totalPreviewPages = Math.ceil(filteredPreviewRows.length / PREVIEW_PAGE_SIZE) || 1;

  // Filtered history batches
  const filteredBatches = useMemo(() => {
    if (!historySearch.trim()) return historyBatches;
    const q = historySearch.toLowerCase();
    return historyBatches.filter(
      (b) =>
        b.batch_id.toLowerCase().includes(q) ||
        b.file_name.toLowerCase().includes(q) ||
        b.created_by_name?.toLowerCase().includes(q) ||
        b.stage_name?.toLowerCase().includes(q)
    );
  }, [historyBatches, historySearch]);

  // Check required mappings & duplicate mappings
  const {
    mappedCount,
    isMappingComplete,
    duplicateList,
    missingRequiredLabels,
    fieldToHeadersMap,
  } = useMemo(() => {
    const fieldMap: Record<string, string[]> = {};

    for (const [header, rawCrmKey] of Object.entries(columnMapping)) {
      if (rawCrmKey && rawCrmKey.trim() !== '') {
        const canonicalKey = normalizeCrmFieldKey(rawCrmKey);
        if (!fieldMap[canonicalKey]) {
          fieldMap[canonicalKey] = [];
        }
        fieldMap[canonicalKey].push(header);
      }
    }

    // Check duplicates across all mapped fields (both required and optional)
    const duplicates: { field: string; label: string; headers: string[] }[] = [];
    for (const [fieldKey, headers] of Object.entries(fieldMap)) {
      if (headers.length > 1) {
        const fieldMeta = previewData?.supported_crm_fields?.find(
          (f) => normalizeCrmFieldKey(f.key) === fieldKey
        );
        const label = fieldMeta?.label || (
          fieldKey === 'name' ? 'Lead Name' : fieldKey === 'email' ? 'Email' : fieldKey === 'phone' ? 'Mobile Phone' : fieldKey
        );
        duplicates.push({ field: fieldKey, label, headers });
      }
    }

    // Evaluate each required field:
    // A required field is counted as mapped only when a spreadsheet column is assigned to that field
    // and there is no ambiguity (exactly one column assigned).
    let count = 0;
    const missing: string[] = [];

    for (const rf of REQUIRED_CRM_FIELDS) {
      const assigned = fieldMap[rf.key] || [];
      if (assigned.length === 1) {
        count++;
      } else if (assigned.length === 0) {
        missing.push(rf.label);
      }
    }

    // All three required fields mapped correctly and zero duplicate mappings across any CRM field
    const isComplete = count === 3 && duplicates.length === 0;

    return {
      mappedCount: count,
      isMappingComplete: isComplete,
      duplicateList: duplicates,
      missingRequiredLabels: missing,
      fieldToHeadersMap: fieldMap,
    };
  }, [columnMapping, previewData]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* Top Banner / Header */}
      <div className="bg-white dark:bg-[#172033] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white shadow-sm shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight m-0">
                Bulk Import Leads
              </h1>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium m-0 mt-0.5">
                Import lead databases, campus drive lists, or job portal spreadsheets directly into your CRM pipeline with controlled team assignment.
              </p>
            </div>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleDownloadSample('xlsx')}
            className="crm-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-2xs hover:border-[#2563EB]/40"
            title="Download sample formatted Excel template (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
            <span>Download Sample Excel</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadSample('csv')}
            className="crm-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-2xs hover:border-[#2563EB]/40"
            title="Download sample formatted CSV template (.csv)"
          >
            <Download className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
            <span>Download Sample CSV</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToPipeline(selectedStageId)}
            className="crm-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-2xs text-[#2563EB] dark:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#172554]/40"
            title="View Leads in CRM Pipeline"
          >
            <Layers className="w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
            <span>View Pipeline</span>
          </button>
        </div>
      </div>

      {/* Workspace Tabs: New Import vs Import History */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] dark:border-[#334155] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'import'
              ? 'bg-[#2563EB] text-white shadow-xs'
              : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-white dark:hover:bg-[#172033]'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>New Lead Import</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-[#2563EB] text-white shadow-xs'
              : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:bg-white dark:hover:bg-[#172033]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Import Batches & History</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: NEW IMPORT WIZARD */}
      {/* ======================================================== */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* STEP 1: IMPORT CONFIGURATION & EMPLOYEE ASSIGNMENT */}
          <div className="bg-white dark:bg-[#172033] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-[#F1F5F9] dark:border-[#334155] pb-4">
              <span className="w-7 h-7 rounded-lg bg-[#EFF6FF] dark:bg-[#172554] text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF] flex items-center justify-center text-xs font-bold shrink-0">
                1
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] m-0">
                  Target Pipeline & Team Assignment
                </h2>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] m-0">
                  Configure where the leads will land in your admissions funnel and assign counsellors.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Target Pipeline Stage */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  Target Pipeline Stage <span className="text-[#2563EB]">*</span>
                </label>
                <select
                  id="import-stage-select"
                  value={selectedStageId}
                  onChange={(e) => setSelectedStageId(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-lg text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition"
                >
                  {activeStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.order}. {stage.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] m-0">
                  Defaults to Cold Calling or initial stage.
                </p>
              </div>

              {/* Lead / Database Source */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  Lead / Database Source <span className="text-[#2563EB]">*</span>
                </label>
                <select
                  id="import-source-select"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full h-10 px-3 bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-lg text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition"
                >
                  {DEFAULT_SOURCES.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
                {sourceType === 'Other' && (
                  <input
                    type="text"
                    value={customSource}
                    onChange={(e) => setCustomSource(e.target.value)}
                    placeholder="Enter custom source name..."
                    className="w-full h-9 px-3 bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] mt-1"
                  />
                )}
              </div>

              {/* Default Priority */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  Default Priority <span className="text-[#2563EB]">*</span>
                </label>
                <select
                  id="import-priority-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full h-10 px-3 bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-lg text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] m-0">
                  Applied when row does not specify priority.
                </p>
              </div>

              {/* Optional Team Scope (For Admin) */}
              {currentUser.role === 'ADMIN' && teams.length > 0 && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    Filter Team Scope (Optional)
                  </label>
                  <select
                    id="import-team-select"
                    value={selectedTeamId}
                    onChange={(e) => {
                      setSelectedTeamId(e.target.value ? Number(e.target.value) : '');
                      setSelectedEmployeeIds([]);
                    }}
                    className="w-full h-10 px-3 bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-lg text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition"
                  >
                    <option value="">All Organization Teams</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] m-0">
                    Filter counsellors belonging to a specific team.
                  </p>
                </div>
              )}
            </div>

            {/* Batch Note / Campaign Tag */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>Batch Note / Campaign Tag (Optional)</span>
              </label>
              <input
                id="import-batch-note-input"
                type="text"
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
                placeholder="e.g. Pune University 2026 CS Batch - Uncalled Campus Drive Raw Data"
                className="w-full h-10 px-3.5 bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-lg text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition placeholder-[#94A3B8] dark:placeholder-[#64748B]"
              />
              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] m-0">
                Helps you identify and track this specific import batch in history and reports.
              </p>
            </div>

            {/* EMPLOYEE ASSIGNMENT SECTION */}
            <div className="p-4 bg-[#F8FAFC] dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-[#334155] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] uppercase tracking-wider m-0">
                    Employee Lead Assignment
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] m-0 mt-0.5">
                    Valid leads are distributed deterministically and evenly across selected counsellors.
                  </p>
                </div>

                {/* Import as Unassigned Leads Checkbox */}
                <label className="flex items-center gap-2.5 p-2 bg-white dark:bg-[#172033] rounded-lg border border-[#CBD5E1] dark:border-[#334155] shadow-2xs cursor-pointer hover:border-[#2563EB] transition select-none">
                  <input
                    id="import-unassigned-checkbox"
                    type="checkbox"
                    checked={isUnassigned}
                    onChange={(e) => {
                      setIsUnassigned(e.target.checked);
                      if (e.target.checked) {
                        setAssignmentError(null);
                      }
                    }}
                    className="w-4 h-4 text-[#2563EB] rounded border-[#CBD5E1] dark:border-[#475569] focus:ring-[#2563EB]"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Import as Unassigned Leads</span>
                    <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8] block">Pool into unassigned triage queue</span>
                  </div>
                </label>
              </div>

              {/* Searchable Multi-Select Employee Dropdown (Replaces the 4 cards) */}
              {!isUnassigned && (
                <div className="space-y-3">
                  <SearchableEmployeeSelect
                    employees={eligibleEmployees}
                    selectedEmployeeIds={selectedEmployeeIds}
                    onChange={(ids) => {
                      setSelectedEmployeeIds(ids);
                      if (ids.length > 0) setAssignmentError(null);
                    }}
                    disabled={isUnassigned}
                    loading={loadingEmployees}
                    error={assignmentError}
                  />
                </div>
              )}

              {/* Distribution Summary Card */}
              <div className="p-3 bg-white dark:bg-[#172033] rounded-lg border border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                      isUnassigned
                        ? 'bg-[#FEF3C7] dark:bg-[#78350F]/30 text-[#D97706] dark:text-[#FBBF24]'
                        : selectedEmployeeIds.length > 0
                        ? 'bg-[#EFF6FF] dark:bg-[#172554] text-[#2563EB] dark:text-[#60A5FA]'
                        : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#94A3B8] dark:text-[#64748B]'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                      {distributionBreakdown.summaryText}
                    </div>
                    <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                      {distributionBreakdown.detailText}
                    </div>
                  </div>
                </div>

                {/* Per-Employee Preview Chips if analyzed */}
                {distributionBreakdown.items.length > 0 && (
                  <div className="hidden lg:flex items-center gap-1.5 shrink-0 flex-wrap max-w-md justify-end">
                    {distributionBreakdown.items.map((item, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-[#EFF6FF] dark:bg-[#172554] border border-[#BFDBFE] dark:border-[#1E40AF] text-[#1E3A8A] dark:text-[#93C5FD] rounded-md text-[10px] font-medium"
                      >
                        {item.name}: <strong className="font-bold">{item.count}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STEP 2: EXCEL / CSV FILE UPLOAD */}
          <div className="bg-white dark:bg-[#172033] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] dark:border-[#334155] pb-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[#EFF6FF] dark:bg-[#172554] text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF] flex items-center justify-center text-xs font-bold shrink-0">
                  2
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] m-0">
                    Upload Excel Sheet (.xlsx / .xls) or CSV (.csv) File
                  </h2>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] m-0">
                    Click to select or drag and drop your lead Excel or CSV file.
                  </p>
                </div>
              </div>

              {file && (
                <button
                  type="button"
                  onClick={handleResetImport}
                  className="text-xs text-[#DC2626] dark:text-[#F87171] hover:bg-[#FEF2F2] dark:hover:bg-[#450A0A]/40 px-2.5 py-1 rounded-md font-medium transition cursor-pointer"
                >
                  Clear File
                </button>
              )}
            </div>

            {/* Drag & Drop Area */}
            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-[#2563EB] bg-[#EFF6FF]/60 dark:bg-[#172554]/40'
                    : 'border-[#CBD5E1] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827] hover:border-[#2563EB]/60 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#172033] shadow-xs border border-[#E2E8F0] dark:border-[#334155] flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA]">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Click to select or drag and drop your lead file
                  </div>
                  <div className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                    Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv) up to 25MB
                  </div>
                </div>
                <button
                  type="button"
                  className="crm-btn-primary px-4 py-2 rounded-lg text-xs font-semibold shadow-xs"
                >
                  Browse Files
                </button>
              </div>
            ) : (
              <div className="p-4 bg-[#EFF6FF]/50 dark:bg-[#172554]/30 border border-[#BFDBFE] dark:border-[#1E40AF]/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#172033] border border-[#BFDBFE] dark:border-[#1E40AF] flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA] shadow-2xs shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                      {file.name}
                    </div>
                    <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] flex items-center gap-2">
                      <span>{(file.size / 1024).toFixed(1)} KB</span>
                      {previewData && (
                        <>
                          <span>·</span>
                          <span className="font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                            {previewData.total_rows} rows parsed
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Sheet Selector if multiple sheets */}
                  {previewData?.sheets && previewData.sheets.length > 1 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[#64748B] dark:text-[#94A3B8] font-medium">Sheet:</span>
                      <select
                        value={selectedSheet}
                        onChange={(e) => handleSheetChange(e.target.value)}
                        className="h-8 px-2 bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-md text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC]"
                      >
                        {previewData.sheets.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="crm-btn-secondary px-3 py-1.5 rounded-lg text-xs font-medium"
                  >
                    Replace File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {loadingPreview && (
              <div className="p-3 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl flex items-center gap-2.5 text-xs text-[#2563EB] dark:text-[#60A5FA]">
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>Parsing spreadsheet headers and analyzing rows...</span>
              </div>
            )}

            {previewError && (
              <div className="p-3 bg-[#FEF2F2] dark:bg-[#450A0A]/30 border border-[#FECACA] dark:border-[#991B1B]/40 rounded-xl text-xs text-[#DC2626] dark:text-[#FCA5A5] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{previewError}</span>
              </div>
            )}
          </div>

          {/* STEP 3: COLUMN MAPPING */}
          {previewData && (
            <div className="bg-white dark:bg-[#172033] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F5F9] dark:border-[#334155] pb-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-[#EFF6FF] dark:bg-[#172554] text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF] flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] m-0">
                      Column Mapping
                    </h2>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] m-0">
                      Map headers from your spreadsheet to the corresponding CRM student lead fields.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    id="required-fields-badge"
                    className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                      isMappingComplete
                        ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/30 text-[#059669] dark:text-[#34D399] border-[#A7F3D0] dark:border-[#047857]/50'
                        : 'bg-[#FFFBEB] dark:bg-[#78350F]/30 text-[#D97706] dark:text-[#FBBF24] border-[#FDE68A] dark:border-[#78350F]/50'
                    }`}
                  >
                    {isMappingComplete ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {mappedCount} / 3 Required Fields Mapped
                    </span>
                  </span>
                </div>
              </div>

              {/* Duplicate mapping warning alert */}
              {duplicateList.length > 0 && (
                <div id="duplicate-mapping-alert" className="p-3 bg-[#FEF2F2] dark:bg-[#450A0A]/30 border border-[#FECACA] dark:border-[#991B1B]/40 rounded-xl text-xs text-[#DC2626] dark:text-[#FCA5A5] flex items-center gap-2 shadow-2xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#DC2626] dark:text-[#F87171]" />
                  <span>
                    Duplicate column mapping detected: {duplicateList.map((d) => `"${d.label}" is mapped to multiple columns (${d.headers.join(', ')})`).join('; ')}. Each CRM field must be mapped to at most one spreadsheet column.
                  </span>
                </div>
              )}

              {/* Mapped Fields Grid / Table */}
              <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8] font-semibold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Spreadsheet Header</th>
                      <th className="p-3">Sample Value</th>
                      <th className="p-3">Mapped CRM Lead Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#334155]">
                    {previewData.headers.map((header) => {
                      const sampleVal = previewData.sample_rows?.[0]?.[header];
                      const currentMappedKey = columnMapping[header] || '';
                      const canonicalKey = normalizeCrmFieldKey(currentMappedKey);
                      const isDuplicate = Boolean(canonicalKey && (fieldToHeadersMap[canonicalKey]?.length || 0) > 1);

                      return (
                        <tr key={header} className={`hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/60 transition-colors ${isDuplicate ? 'bg-[#FEF2F2]/20 dark:bg-[#450A0A]/20' : ''}`}>
                          <td className="p-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            {header}
                          </td>
                          <td className="p-3 text-[#64748B] dark:text-[#94A3B8] max-w-[200px] truncate">
                            {sampleVal !== undefined && sampleVal !== null && sampleVal !== ''
                              ? String(sampleVal)
                              : <span className="text-[#94A3B8] dark:text-[#64748B] italic">(empty)</span>}
                          </td>
                          <td className="p-3">
                            <div className="space-y-1">
                              <select
                                aria-label={`Mapping for ${header}`}
                                value={currentMappedKey}
                                onChange={(e) => {
                                  const newMapping = { ...columnMapping };
                                  if (e.target.value) {
                                    newMapping[header] = e.target.value;
                                  } else {
                                    delete newMapping[header];
                                  }
                                  setColumnMapping(newMapping);
                                  setValidationResult(null); // Invalidate previous validation
                                }}
                                className={`h-8 px-2.5 bg-white dark:bg-[#111827] border rounded-lg text-xs font-medium focus:outline-none focus:border-[#2563EB] ${
                                  isDuplicate
                                    ? 'border-[#FCA5A5] dark:border-[#DC2626] text-[#DC2626] dark:text-[#F87171] font-semibold bg-[#FEF2F2]/40 dark:bg-[#450A0A]/30'
                                    : currentMappedKey
                                    ? 'border-[#BFDBFE] dark:border-[#1E40AF] text-[#1E3A8A] dark:text-[#93C5FD] font-semibold bg-[#EFF6FF]/30 dark:bg-[#172554]/40'
                                    : 'border-[#CBD5E1] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]'
                                }`}
                              >
                                <option value="">-- Do Not Import / Skip --</option>
                                {previewData.supported_crm_fields.map((f) => (
                                  <option key={f.key} value={f.key}>
                                    {f.label} {f.required ? '*' : ''}
                                  </option>
                                ))}
                              </select>
                              {isDuplicate && (
                                <div className="text-[11px] text-[#DC2626] dark:text-[#F87171] font-medium flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  <span>Duplicate: mapped to multiple columns</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Button to Validate Rows */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  id="validate-preview-rows-btn"
                  onClick={handleValidateRows}
                  disabled={isValidating || !isMappingComplete}
                  className="crm-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isValidating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating Rows & Detecting Duplicates...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>Validate & Preview Rows</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: VALIDATION SUMMARY & DATA PREVIEW */}
          {validationResult && (
            <div className="bg-white dark:bg-[#172033] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F5F9] dark:border-[#334155] pb-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-[#EFF6FF] dark:bg-[#172554] text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF] flex items-center justify-center text-xs font-bold shrink-0">
                    4
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] m-0">
                      Validation Results & Data Preview
                    </h2>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] m-0">
                      Authoritative backend row validation, duplicate check, and per-counsellor allocations.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadSample('csv')}
                    className="crm-btn-secondary px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
                    title="Download validation results"
                  >
                    <Download className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
                    <span>Download Report</span>
                  </button>
                </div>
              </div>

              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl">
                  <div className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                    Total Rows
                  </div>
                  <div className="text-2xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] mt-1 font-mono">
                    {validationResult.total_rows}
                  </div>
                  <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">Parsed from spreadsheet</div>
                </div>

                <div className="p-4 bg-[#ECFDF5] dark:bg-[#064E3B]/20 border border-[#A7F3D0] dark:border-[#047857]/40 rounded-xl">
                  <div className="text-[11px] font-semibold text-[#059669] dark:text-[#34D399] uppercase tracking-wider">
                    Valid Leads
                  </div>
                  <div className="text-2xl font-extrabold text-[#059669] dark:text-[#34D399] mt-1 font-mono">
                    {validationResult.valid_count}
                  </div>
                  <div className="text-[10px] text-[#059669] dark:text-[#34D399] mt-0.5">Ready for import</div>
                </div>

                <div className="p-4 bg-[#FFFBEB] dark:bg-[#78350F]/20 border border-[#FDE68A] dark:border-[#78350F]/40 rounded-xl">
                  <div className="text-[11px] font-semibold text-[#D97706] dark:text-[#FBBF24] uppercase tracking-wider">
                    Duplicate Leads
                  </div>
                  <div className="text-2xl font-extrabold text-[#D97706] dark:text-[#FBBF24] mt-1 font-mono">
                    {validationResult.duplicate_count}
                  </div>
                  <div className="text-[10px] text-[#D97706] dark:text-[#FBBF24] mt-0.5">Matched by email/phone</div>
                </div>

                <div className="p-4 bg-[#FEF2F2] dark:bg-[#450A0A]/20 border border-[#FECACA] dark:border-[#991B1B]/40 rounded-xl">
                  <div className="text-[11px] font-semibold text-[#DC2626] dark:text-[#F87171] uppercase tracking-wider">
                    Invalid Rows
                  </div>
                  <div className="text-2xl font-extrabold text-[#DC2626] dark:text-[#F87171] mt-1 font-mono">
                    {validationResult.invalid_count}
                  </div>
                  <div className="text-[10px] text-[#DC2626] dark:text-[#F87171] mt-0.5">Missing phone/name/email</div>
                </div>
              </div>

              {/* Per-Employee Round-Robin Allocation Preview */}
              {!isUnassigned && distributionBreakdown.items.length > 0 && (
                <div className="p-4 bg-[#EFF6FF]/60 dark:bg-[#172554]/30 border border-[#BFDBFE] dark:border-[#1E40AF]/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1E3A8A] dark:text-[#93C5FD]">
                      Balanced Round-Robin Allocation Preview:
                    </span>
                    <span className="text-[11px] font-mono text-[#2563EB] dark:text-[#60A5FA]">
                      Max difference: ≤ 1 lead
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {distributionBreakdown.items.map((emp, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white dark:bg-[#111827] border border-[#BFDBFE] dark:border-[#1E40AF]/40 rounded-lg text-center shadow-2xs"
                      >
                        <div className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">{emp.name}</div>
                        <div className="text-base font-extrabold text-[#2563EB] dark:text-[#60A5FA] font-mono mt-0.5">
                          {emp.count} <span className="text-[10px] font-normal text-[#64748B] dark:text-[#94A3B8]">leads</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter & Search Bar for Rows */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 bg-[#F1F5F9] dark:bg-[#111827] p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewFilter('ALL');
                      setPreviewPage(1);
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                      previewFilter === 'ALL'
                        ? 'bg-white dark:bg-[#172033] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                    }`}
                  >
                    All ({validationResult.row_validations?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewFilter('VALID');
                      setPreviewPage(1);
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                      previewFilter === 'VALID'
                        ? 'bg-white dark:bg-[#172033] text-[#059669] dark:text-[#34D399] shadow-xs'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#059669] dark:hover:text-[#34D399]'
                    }`}
                  >
                    Valid Only ({validationResult.valid_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewFilter('DUPLICATE');
                      setPreviewPage(1);
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                      previewFilter === 'DUPLICATE'
                        ? 'bg-white dark:bg-[#172033] text-[#D97706] dark:text-[#FBBF24] shadow-xs'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#D97706] dark:hover:text-[#FBBF24]'
                    }`}
                  >
                    Duplicates ({validationResult.duplicate_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewFilter('INVALID');
                      setPreviewPage(1);
                    }}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                      previewFilter === 'INVALID'
                        ? 'bg-white dark:bg-[#172033] text-[#DC2626] dark:text-[#F87171] shadow-xs'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#DC2626] dark:hover:text-[#F87171]'
                    }`}
                  >
                    Invalid Only ({validationResult.invalid_count})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => {
                      setPreviewSearch(e.target.value);
                      setPreviewPage(1);
                    }}
                    placeholder="Search preview rows..."
                    className="h-8 px-2.5 bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] w-48"
                  />
                </div>
              </div>

              {/* Rows Table */}
              <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8] font-semibold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-16">Row #</th>
                      <th className="p-3">Lead Name</th>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Mobile Phone</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Validation Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#334155]">
                    {paginatedPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                          No rows match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      paginatedPreviewRows.map((row) => (
                        <tr
                          key={row.row_number}
                          className={`hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/60 transition-colors ${
                            !row.is_valid
                              ? 'bg-[#FEF2F2]/30 dark:bg-[#450A0A]/20'
                              : row.is_duplicate
                              ? 'bg-[#FFFBEB]/30 dark:bg-[#78350F]/20'
                              : ''
                          }`}
                        >
                          <td className="p-3 font-mono text-[#64748B] dark:text-[#94A3B8]">#{row.row_number}</td>
                          <td className="p-3 font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            {row.lead_name || row.data?.name || row.data?.lead_name || <span className="text-[#DC2626] dark:text-[#F87171] italic">Missing</span>}
                          </td>
                          <td className="p-3 text-[#475569] dark:text-[#CBD5E1]">
                            {row.email || row.data?.email || <span className="text-[#DC2626] dark:text-[#F87171] italic">Missing</span>}
                          </td>
                          <td className="p-3 text-[#475569] dark:text-[#CBD5E1]">
                            {row.phone || row.data?.phone || <span className="text-[#DC2626] dark:text-[#F87171] italic">Missing</span>}
                          </td>
                          <td className="p-3">
                            {!row.is_valid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF2F2] dark:bg-[#450A0A]/40 text-[#DC2626] dark:text-[#F87171] border border-[#FECACA] dark:border-[#991B1B]/40">
                                <X className="w-3 h-3 stroke-[3]" /> Invalid
                              </span>
                            ) : row.is_duplicate ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[#D97706] dark:text-[#FBBF24] border border-[#FDE68A] dark:border-[#78350F]/50">
                                <AlertTriangle className="w-3 h-3" /> Duplicate
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#059669] dark:text-[#34D399] border border-[#A7F3D0] dark:border-[#047857]/50">
                                <Check className="w-3 h-3 stroke-[3]" /> Valid
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                            {row.errors && row.errors.length > 0 ? (
                              <span className="text-[#DC2626] dark:text-[#F87171] font-medium">
                                {row.errors.join('; ')}
                              </span>
                            ) : row.is_duplicate ? (
                              <span className="text-[#D97706] dark:text-[#FBBF24]">
                                Record already exists in database
                              </span>
                            ) : (
                              <span className="text-[#059669] dark:text-[#34D399]">
                                Passed all validation rules
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              {totalPreviewPages > 1 && (
                <div className="flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8]">
                  <span>
                    Showing {(previewPage - 1) * PREVIEW_PAGE_SIZE + 1} to{' '}
                    {Math.min(previewPage * PREVIEW_PAGE_SIZE, filteredPreviewRows.length)} of{' '}
                    {filteredPreviewRows.length} rows
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      disabled={previewPage === 1}
                      className="crm-btn-secondary px-3 py-1 rounded-md disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="font-mono">
                      {previewPage} / {totalPreviewPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                      disabled={previewPage === totalPreviewPages}
                      className="crm-btn-secondary px-3 py-1 rounded-md disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: CONFIRMATION & EXECUTION */}
          {validationResult && !confirmResult && (
            <div className="bg-white dark:bg-[#172033] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs space-y-6">
              <div className="flex items-center gap-3 border-b border-[#F1F5F9] dark:border-[#334155] pb-4">
                <span className="w-7 h-7 rounded-lg bg-[#EFF6FF] dark:bg-[#172554] text-[#2563EB] dark:text-[#60A5FA] border border-[#BFDBFE] dark:border-[#1E40AF] flex items-center justify-center text-xs font-bold shrink-0">
                  5
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] m-0">
                    Import Confirmation Summary
                  </h2>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] m-0">
                    Review your parameters before executing the bulk import transaction.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-[#F8FAFC] dark:bg-[#111827] rounded-xl border border-[#E2E8F0] dark:border-[#334155] text-xs">
                <div>
                  <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">File</div>
                  <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 truncate">{file?.name}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">Target Pipeline</div>
                  <div className="font-bold text-[#2563EB] dark:text-[#60A5FA] mt-0.5 truncate">
                    {activeStages.find((s) => s.id === selectedStageId)?.name || 'Cold Calling'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">Source & Priority</div>
                  <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 truncate">
                    {sourceType} · {priority}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">Allocation Target</div>
                  <div className="font-bold text-[#0F172A] dark:text-[#F8FAFC] mt-0.5 truncate">
                    {isUnassigned ? 'Unassigned Leads Pool' : `${selectedEmployeeIds.length} Counsellors (Round Robin)`}
                  </div>
                </div>
              </div>

              {importError && (
                <div className="p-3.5 bg-[#FEF2F2] dark:bg-[#450A0A]/30 border border-[#FECACA] dark:border-[#991B1B]/40 rounded-xl text-xs text-[#DC2626] dark:text-[#FCA5A5] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Progress UI if running */}
              {isImporting && (
                <div className="p-4 bg-[#EFF6FF] dark:bg-[#172554]/30 border border-[#BFDBFE] dark:border-[#1E40AF]/40 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#1E3A8A] dark:text-[#93C5FD] flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB] dark:text-[#60A5FA]" />
                      Importing Leads...
                    </span>
                    <span className="text-[11px] font-mono text-[#2563EB] dark:text-[#60A5FA]">
                      Database Transaction in Progress
                    </span>
                  </div>
                  <div className="w-full bg-white dark:bg-[#111827] h-2 rounded-full overflow-hidden border border-[#BFDBFE] dark:border-[#1E40AF]/40">
                    <div className="bg-[#2563EB] h-full w-2/3 animate-pulse rounded-full" />
                  </div>
                  <div className="text-[11px] text-[#2563EB] dark:text-[#60A5FA] font-medium">
                    {importProgressStep}
                  </div>
                </div>
              )}

              {/* Final Confirm Button */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResetImport}
                  disabled={isImporting}
                  className="crm-btn-secondary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancel & Reset
                </button>

                <button
                  type="button"
                  id="confirm-bulk-import-btn"
                  onClick={handleExecuteImport}
                  disabled={isImporting || validationResult.valid_count === 0}
                  className="crm-btn-primary px-6 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Import {validationResult.valid_count} Valid {validationResult.valid_count === 1 ? 'Lead' : 'Leads'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* IMPORT SUCCESS / COMPLETION BANNER */}
          {confirmResult && (
            <div className="bg-white dark:bg-[#172033] rounded-2xl border border-[#A7F3D0] dark:border-[#047857]/40 p-6 shadow-xs space-y-6 animate-in fade-in-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/30 border border-[#A7F3D0] dark:border-[#047857]/40 flex items-center justify-center text-[#059669] dark:text-[#34D399] shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#059669] dark:text-[#34D399] m-0">
                    Bulk Import Completed Successfully
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] m-0 mt-0.5">
                    Batch <code className="font-mono text-[#0F172A] dark:text-[#F8FAFC]">{confirmResult.batch_id}</code> was processed with real-time assignment logging.
                  </p>
                </div>
              </div>

              {/* Result Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-center">
                  <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase">Leads Created</div>
                  <div className="text-2xl font-extrabold text-[#059669] dark:text-[#34D399] font-mono mt-1">
                    {confirmResult.imported_count}
                  </div>
                </div>

                <div className="p-4 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-center">
                  <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase">Duplicates Skipped</div>
                  <div className="text-2xl font-extrabold text-[#D97706] dark:text-[#FBBF24] font-mono mt-1">
                    {confirmResult.duplicate_count}
                  </div>
                </div>

                <div className="p-4 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-center">
                  <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase">Rejected / Failed</div>
                  <div className="text-2xl font-extrabold text-[#DC2626] dark:text-[#F87171] font-mono mt-1">
                    {confirmResult.rejected_count}
                  </div>
                </div>

                <div className="p-4 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-center">
                  <div className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase">Pipeline Stage</div>
                  <div className="text-sm font-extrabold text-[#2563EB] dark:text-[#60A5FA] mt-2 truncate">
                    {confirmResult.stage_name}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetImport}
                  className="crm-btn-secondary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Import Another File
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="crm-btn-secondary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#64748B] dark:text-[#94A3B8]" />
                    <span>View in History</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigateToPipeline(confirmResult.stage_id)}
                    className="crm-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Layers className="w-4 h-4" />
                    <span>View Leads in Pipeline</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: IMPORT HISTORY & AUDIT LOGS */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-[#172033] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F1F5F9] dark:border-[#334155] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] m-0">
                Import Batch History & Audits
              </h2>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] m-0">
                Review past file imports, round-robin assignments, and download rejected row records.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search batches by ID or file..."
                className="h-8 px-3 bg-[#F8FAFC] dark:bg-[#111827] border border-[#CBD5E1] dark:border-[#334155] rounded-lg text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] w-56 placeholder-[#94A3B8] dark:placeholder-[#64748B]"
              />

              <button
                type="button"
                onClick={loadHistory}
                disabled={loadingHistory}
                className="crm-btn-secondary p-2 rounded-lg text-xs"
                title="Refresh batch list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {loadingHistory ? (
            <div className="p-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8] space-y-2">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[#2563EB] dark:text-[#60A5FA]" />
              <p>Loading import batches...</p>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8] space-y-2">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-[#94A3B8] dark:text-[#64748B]" />
              <p className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">No import batches recorded yet</p>
              <p className="text-[11px] text-[#94A3B8] dark:text-[#64748B]">
                Imports initiated by authorized team members will be tracked here with full audit history.
              </p>
            </div>
          ) : (
            <div className="border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8] font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Batch ID</th>
                    <th className="p-3">File Name</th>
                    <th className="p-3">Imported By</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Target Stage</th>
                    <th className="p-3">Total Rows</th>
                    <th className="p-3">Created</th>
                    <th className="p-3">Duplicates</th>
                    <th className="p-3">Rejected</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#334155]">
                  {filteredBatches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/60 transition-colors">
                      <td className="p-3 font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                        {batch.batch_id}
                      </td>
                      <td className="p-3 font-medium text-[#0F172A] dark:text-[#F8FAFC] max-w-[150px] truncate" title={batch.file_name}>
                        {batch.file_name}
                      </td>
                      <td className="p-3 text-[#475569] dark:text-[#CBD5E1]">{batch.created_by_name}</td>
                      <td className="p-3 text-[#64748B] dark:text-[#94A3B8] whitespace-nowrap">
                        {new Date(batch.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3">
                        <span className="crm-pill crm-pill-blue font-medium">
                          {batch.stage_name}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[#0F172A] dark:text-[#F8FAFC] font-bold">{batch.total_rows}</td>
                      <td className="p-3 font-mono text-[#059669] dark:text-[#34D399] font-bold">
                        {batch.imported_count}
                      </td>
                      <td className="p-3 font-mono text-[#D97706] dark:text-[#FBBF24] font-bold">
                        {batch.duplicate_count}
                      </td>
                      <td className="p-3 font-mono text-[#DC2626] dark:text-[#F87171] font-bold">
                        {batch.rejected_count}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            batch.status === 'COMPLETED'
                              ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/40 text-[#059669] dark:text-[#34D399] border border-[#A7F3D0] dark:border-[#047857]/50'
                              : batch.status === 'COMPLETED_WITH_ERRORS'
                              ? 'bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[#D97706] dark:text-[#FBBF24] border border-[#FDE68A] dark:border-[#78350F]/50'
                              : 'bg-[#FEF2F2] dark:bg-[#450A0A]/40 text-[#DC2626] dark:text-[#F87171] border border-[#FECACA] dark:border-[#991B1B]/40'
                          }`}
                        >
                          {batch.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedBatchDetails(batch)}
                            className="p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#2563EB] dark:hover:text-[#60A5FA] hover:bg-[#EFF6FF] dark:hover:bg-[#172554]/40 rounded-md transition"
                            title="View Batch Details & Allocation Breakdown"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {batch.rejected_count > 0 && (
                            <button
                              type="button"
                              onClick={() => api.downloadBatchRejectedRows(batch.id)}
                              className="p-1.5 text-[#64748B] dark:text-[#94A3B8] hover:text-[#DC2626] dark:hover:text-[#F87171] hover:bg-[#FEF2F2] dark:hover:bg-[#450A0A]/40 rounded-md transition"
                              title="Download Rejected Rows CSV"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* BATCH DETAILS MODAL */}
      {selectedBatchDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="crm-card bg-white dark:bg-[#172033] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in-50">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] dark:border-[#334155] pb-3">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-[#2563EB] dark:text-[#60A5FA]" />
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] m-0">
                    Import Batch: {selectedBatchDetails.batch_id}
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] m-0">
                    {selectedBatchDetails.file_name} · Processed on{' '}
                    {new Date(selectedBatchDetails.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatchDetails(null)}
                className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedBatchDetails.batch_note && (
              <div className="p-3 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl text-xs space-y-1">
                <div className="font-semibold text-[#64748B] dark:text-[#94A3B8] text-[10px] uppercase">
                  Batch Tag / Note
                </div>
                <div className="font-medium text-[#0F172A] dark:text-[#F8FAFC]">{selectedBatchDetails.batch_note}</div>
              </div>
            )}

            {/* Distribution Summary */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Employee Allocation Summary:
              </div>
              {selectedBatchDetails.distribution_summary &&
              Object.keys(selectedBatchDetails.distribution_summary).length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedBatchDetails.distribution_summary).map(([name, count]) => (
                    <div
                      key={name}
                      className="p-2.5 bg-[#EFF6FF] dark:bg-[#172554]/40 border border-[#BFDBFE] dark:border-[#1E40AF]/40 rounded-lg flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-[#1E3A8A] dark:text-[#93C5FD] truncate">{name}</span>
                      <span className="font-extrabold font-mono text-[#2563EB] dark:text-[#60A5FA]">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#64748B] dark:text-[#94A3B8] italic">
                  {selectedBatchDetails.assignment_mode === 'UNASSIGNED'
                    ? 'Imported directly into Unassigned Leads pool.'
                    : 'No individual allocation details stored.'}
                </div>
              )}
            </div>

            {/* Error Summary */}
            {selectedBatchDetails.errors_summary && selectedBatchDetails.errors_summary.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#DC2626] dark:text-[#F87171]">
                  Errors / Rejections ({selectedBatchDetails.errors_summary.length}):
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-[#FEF2F2] dark:bg-[#450A0A]/30 border border-[#FECACA] dark:border-[#991B1B]/40 rounded-lg text-xs">
                  {selectedBatchDetails.errors_summary.map((err, idx) => (
                    <div key={idx} className="text-[#DC2626] dark:text-[#FCA5A5]">
                      Row {err.row_number}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9] dark:border-[#334155]">
              {selectedBatchDetails.rejected_count > 0 ? (
                <button
                  type="button"
                  onClick={() => api.downloadBatchRejectedRows(selectedBatchDetails.id)}
                  className="crm-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-[#DC2626] dark:text-[#F87171]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Rejected Rows CSV</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setSelectedBatchDetails(null)}
                className="crm-btn-secondary px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
