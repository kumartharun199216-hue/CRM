import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, CommunicationTemplate, TemplateAttachment, TemplatePreviewResponse } from '../types';
import { api } from '../services/api';
import {
  Mail,
  Plus,
  Search,
  Paperclip,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  UploadCloud,
  X,
  Download,
  Building,
  UserCheck,
  Calendar,
  Sparkles,
  Info,
  Check,
  FileCheck,
  Layers,
  ArrowRight
} from 'lucide-react';

interface EmailTemplatesPageProps {
  currentUser: User;
}

const SUPPORTED_PLACEHOLDERS: { tag: string; label: string; desc: string }[] = [
  { tag: '{{lead_name}}', label: 'Lead Name', desc: 'Full contact name of candidate/student' },
  { tag: '{{lead_email}}', label: 'Lead Email', desc: 'Email address of candidate' },
  { tag: '{{lead_phone}}', label: 'Lead Phone', desc: 'Mobile phone number' },
  { tag: '{{employee_name}}', label: 'Counsellor Name', desc: 'Assigned employee or counsellor name' },
  { tag: '{{company_name}}', label: 'Company Name', desc: 'Skill Move Sales CRM' },
];

export const EmailTemplatesPage: React.FC<EmailTemplatesPageProps> = ({ currentUser }) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const isManager = currentUser.role === 'MANAGER';
  const canManage = isAdmin || isManager;

  // Template State
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Create / Edit Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formBodyFormat, setFormBodyFormat] = useState<'PLAIN' | 'HTML'>('PLAIN');
  const [formIsActive, setFormIsActive] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Focus tracking for placeholder insertion
  const [activeInput, setActiveInput] = useState<'subject' | 'body'>('body');
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<TemplatePreviewResponse | null>(null);
  const [previewTemplateName, setPreviewTemplateName] = useState('');
  const [previewTemplateAttachments, setPreviewTemplateAttachments] = useState<TemplateAttachment[]>([]);

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<CommunicationTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Attachment Delete Confirmation
  const [attachmentDeleteTarget, setAttachmentDeleteTarget] = useState<{ templateId: number; attachment: TemplateAttachment } | null>(null);
  const [isDeletingAttachment, setIsDeletingAttachment] = useState(false);

  // Load templates
  const fetchTemplates = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setErrorMessage(null);

    try {
      const data = await api.getTemplates({ channel: 'EMAIL' });
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to fetch email templates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      // Search matching
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tpl.name.toLowerCase().includes(q) ||
        (tpl.subject && tpl.subject.toLowerCase().includes(q)) ||
        (tpl.description && tpl.description.toLowerCase().includes(q));

      // Status matching
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && tpl.is_active) ||
        (statusFilter === 'inactive' && !tpl.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [templates, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = templates.length;
    const active = templates.filter((t) => t.is_active).length;
    const withAttachments = templates.filter((t) => t.attachments_count > 0).length;
    return { total, active, withAttachments };
  }, [templates]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormSubject('');
    setFormBody('');
    setFormBodyFormat('PLAIN');
    setFormIsActive(true);
    setSelectedFiles([]);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (template: CommunicationTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description || '');
    setFormSubject(template.subject || '');
    setFormBody(template.body || '');
    setFormBodyFormat(template.body_format || 'PLAIN');
    setFormIsActive(template.is_active);
    setSelectedFiles([]);
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Insert placeholder tag into active input/textarea
  const handleInsertPlaceholder = (tag: string) => {
    if (activeInput === 'subject') {
      const el = subjectInputRef.current;
      if (el) {
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const updated = formSubject.substring(0, start) + tag + formSubject.substring(end);
        setFormSubject(updated);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + tag.length, start + tag.length);
        }, 10);
      } else {
        setFormSubject((prev) => prev + ' ' + tag);
      }
    } else {
      const el = bodyTextareaRef.current;
      if (el) {
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || 0;
        const updated = formBody.substring(0, start) + tag + formBody.substring(end);
        setFormBody(updated);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + tag.length, start + tag.length);
        }, 10);
      } else {
        setFormBody((prev) => prev + ' ' + tag);
      }
    }
  };

  // File selection validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    addFilesWithValidation(files);
  };

  const addFilesWithValidation = (newFiles: File[]) => {
    setFormError(null);
    const allowedExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.png', '.jpg', '.jpeg', '.txt'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    const existingCount = (editingTemplate?.attachments?.length || 0) + selectedFiles.length;
    if (existingCount + newFiles.length > 10) {
      setFormError('A template can have at most 10 attachments.');
      return;
    }

    for (const f of newFiles) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      if (!allowedExts.includes(ext)) {
        setFormError(`File "${f.name}" has unsupported format. Allowed: ${allowedExts.join(', ')}`);
        return;
      }
      if (f.size > maxFileSize) {
        setFormError(`File "${f.name}" exceeds maximum 10MB limit.`);
        return;
      }
    }

    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Template Create / Edit
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Template Name is required.');
      return;
    }
    if (!formSubject.trim()) {
      setFormError('Email Subject line is required.');
      return;
    }
    if (!formBody.trim()) {
      setFormError('Email Body content is required.');
      return;
    }

    setFormSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', formName.trim());
      formData.append('description', formDescription.trim());
      formData.append('channel', 'EMAIL');
      formData.append('subject', formSubject.trim());
      formData.append('body', formBody.trim());
      formData.append('body_format', formBodyFormat);
      formData.append('is_active', String(formIsActive));

      // Append new files
      selectedFiles.forEach((file) => {
        formData.append('attachments', file);
      });

      if (editingTemplate) {
        await api.updateTemplate(editingTemplate.id, formData);
        setSuccessMessage(`Template "${formName}" updated successfully.`);
      } else {
        await api.createTemplate(formData);
        setSuccessMessage(`Template "${formName}" created successfully.`);
      }

      setIsFormModalOpen(false);
      await fetchTemplates();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save email template');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (template: CommunicationTemplate) => {
    try {
      const updated = await api.toggleTemplateActive(template.id);
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? updated : t)));
      setSuccessMessage(`Template "${template.name}" is now ${updated.is_active ? 'Active' : 'Inactive'}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to toggle status');
    }
  };

  // Delete Template
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      setSuccessMessage(`Template "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete existing attachment from template
  const handleConfirmDeleteAttachment = async () => {
    if (!attachmentDeleteTarget) return;
    setIsDeletingAttachment(true);
    try {
      await api.deleteTemplateAttachment(attachmentDeleteTarget.attachment.id);
      // Update local state if editing modal is open
      if (editingTemplate && editingTemplate.id === attachmentDeleteTarget.templateId) {
        setEditingTemplate((prev) =>
          prev
            ? {
                ...prev,
                attachments: prev.attachments.filter((a) => a.id !== attachmentDeleteTarget.attachment.id),
                attachments_count: Math.max(0, prev.attachments_count - 1),
              }
            : null
        );
      }
      // Refresh templates in list
      await fetchTemplates();
      setAttachmentDeleteTarget(null);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to remove attachment');
    } finally {
      setIsDeletingAttachment(false);
    }
  };

  // Live Template Preview
  const handleOpenPreview = async (template: CommunicationTemplate) => {
    setPreviewTemplateName(template.name);
    setPreviewTemplateAttachments(template.attachments || []);
    setPreviewModalOpen(true);
    setPreviewLoading(true);

    try {
      const result = await api.previewTemplate({
        template_id: template.id,
        subject: template.subject,
        body: template.body,
      });
      setPreviewData(result);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to preview template');
    } finally {
      setPreviewLoading(false);
    }
  };

  // In-form live preview
  const handleInFormPreview = async () => {
    if (!formSubject && !formBody) return;
    setPreviewTemplateName(formName || 'Draft Template');
    setPreviewTemplateAttachments(editingTemplate?.attachments || []);
    setPreviewModalOpen(true);
    setPreviewLoading(true);

    try {
      const result = await api.previewTemplate({
        subject: formSubject,
        body: formBody,
      });
      setPreviewData(result);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to generate draft preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0] dark:border-[#334155]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center text-white shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC] m-0">
                Email Template Management
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium m-0 mt-0.5">
                Standardize outreach messages, maintain attachments, and leverage safe allowlisted placeholders
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => fetchTemplates(true)}
            disabled={refreshing || loading}
            className="crm-btn-secondary px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
            title="Refresh Templates List"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] dark:text-[#60A5FA] ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {canManage && (
            <button
              type="button"
              id="btn-create-email-template"
              onClick={handleOpenCreate}
              className="crm-btn-primary px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs text-white bg-gradient-to-r from-[#2563EB] to-[#7C3AED] hover:from-[#1D4ED8] hover:to-[#6D28D9] transition-all"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Create Template</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="p-3.5 bg-[#FEF2F2] dark:bg-[#450A0A]/30 border border-[#FECACA] dark:border-[#991B1B]/40 rounded-xl text-xs text-[#DC2626] dark:text-[#FCA5A5] flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs text-[#DC2626] hover:text-[#991B1B] font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-[#ECFDF5] dark:bg-[#064E3B]/30 border border-[#A7F3D0] dark:border-[#047857]/40 rounded-xl text-xs text-[#065F46] dark:text-[#34D399] flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-[#065F46] hover:text-[#047857] font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Stats Chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="crm-card p-4 rounded-xl flex items-center justify-between border border-[#E2E8F0] dark:border-[#334155] shadow-xs bg-white dark:bg-[#172033]">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">Total Templates</span>
            <div className="text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">{stats.total}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] dark:bg-[#172554] border border-[#BFDBFE] dark:border-[#1E40AF] flex items-center justify-center text-[#2563EB] dark:text-[#60A5FA]">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="crm-card p-4 rounded-xl flex items-center justify-between border border-[#E2E8F0] dark:border-[#334155] shadow-xs bg-white dark:bg-[#172033]">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">Active for Outreach</span>
            <div className="text-2xl font-bold text-[#10B981] dark:text-[#34D399]">{stats.active}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/20 border border-[#A7F3D0] dark:border-[#047857]/40 flex items-center justify-center text-[#10B981] dark:text-[#34D399]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="crm-card p-4 rounded-xl flex items-center justify-between border border-[#E2E8F0] dark:border-[#334155] shadow-xs bg-white dark:bg-[#172033]">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">With Attachments</span>
            <div className="text-2xl font-bold text-[#7C3AED] dark:text-[#A78BFA]">{stats.withAttachments}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F5F3FF] dark:bg-[#4C1D95]/20 border border-[#DDD6FE] dark:border-[#7C3AED]/40 flex items-center justify-center text-[#7C3AED] dark:text-[#A78BFA]">
            <Paperclip className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="crm-card p-3.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#172033] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            id="template-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by name, subject, description..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#94A3B8] dark:placeholder-[#64748B] focus:outline-none focus:border-[#2563EB] focus:bg-white dark:focus:bg-[#111827] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">Status:</span>
          <div className="inline-flex rounded-lg border border-[#E2E8F0] dark:border-[#334155] p-0.5 bg-[#F8FAFC] dark:bg-[#111827] text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-[#172033] text-[#2563EB] dark:text-[#60A5FA] font-semibold shadow-2xs'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
              }`}
            >
              All ({templates.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-[#172033] text-[#10B981] dark:text-[#34D399] font-semibold shadow-2xs'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
              }`}
            >
              Active ({stats.active})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-white dark:bg-[#172033] text-[#DC2626] dark:text-[#F87171] font-semibold shadow-2xs'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
              }`}
            >
              Inactive ({templates.length - stats.active})
            </button>
          </div>
        </div>
      </div>

      {/* Templates Table Card */}
      <div className="crm-card border border-[#E2E8F0] dark:border-[#334155] rounded-xl overflow-hidden bg-white dark:bg-[#172033] shadow-xs">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 text-[#2563EB] dark:text-[#60A5FA] animate-spin mx-auto mb-2" />
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">Loading email templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#EFF6FF] dark:bg-[#172554] text-[#2563EB] dark:text-[#60A5FA] mx-auto flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">No Email Templates Found</h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'No templates match the current filter criteria. Try clearing search filters.'
                : 'Get started by creating your first reusable email template with custom placeholders and attachments.'}
            </p>
            {canManage && !searchQuery && statusFilter === 'all' && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="crm-btn-primary px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer text-white bg-[#2563EB]"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Template</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                  <th className="py-3 px-4">Template Name</th>
                  <th className="py-3 px-4">Subject Line</th>
                  <th className="py-3 px-4">Scope / Team</th>
                  <th className="py-3 px-4">Attachments</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                {filteredTemplates.map((template) => {
                  return (
                    <tr key={template.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/60 transition-colors group">
                      {/* Name & Description */}
                      <td className="py-3.5 px-4 font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5">
                            {template.name}
                            {template.body_format === 'HTML' && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1] border border-[#CBD5E1] dark:border-[#475569]">
                                HTML
                              </span>
                            )}
                          </span>
                          {template.description && (
                            <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] line-clamp-1 max-w-xs mt-0.5">
                              {template.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Subject */}
                      <td className="py-3.5 px-4 text-[#334155] dark:text-[#CBD5E1] max-w-xs">
                        <span className="font-mono text-[11px] text-[#2563EB] dark:text-[#60A5FA] bg-[#EFF6FF] dark:bg-[#172554] px-2 py-0.5 rounded border border-[#BFDBFE] dark:border-[#1E40AF] line-clamp-1">
                          {template.subject}
                        </span>
                      </td>

                      {/* Team / Scope */}
                      <td className="py-3.5 px-4 text-[#64748B] dark:text-[#94A3B8]">
                        {template.team_name ? (
                          <span className="crm-pill crm-pill-purple text-[10px]">
                            <Building className="w-3 h-3 text-[#7C3AED]" /> {template.team_name}
                          </span>
                        ) : (
                          <span className="crm-pill crm-pill-blue text-[10px]">
                            <Layers className="w-3 h-3 text-[#2563EB]" /> Organization-wide
                          </span>
                        )}
                      </td>

                      {/* Attachments */}
                      <td className="py-3.5 px-4">
                        {template.attachments_count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7C3AED] dark:text-[#A78BFA] bg-[#F5F3FF] dark:bg-[#4C1D95]/20 border border-[#DDD6FE] dark:border-[#7C3AED]/40 px-2.5 py-0.5 rounded-full">
                            <Paperclip className="w-3 h-3" />
                            {template.attachments_count} file{template.attachments_count > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#94A3B8] dark:text-[#64748B] italic">No files</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => canManage && handleToggleActive(template)}
                          disabled={!canManage}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition ${
                            template.is_active
                              ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/30 text-[#065F46] dark:text-[#34D399] border border-[#A7F3D0] dark:border-[#047857]/40'
                              : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#334155]'
                          } ${canManage ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                          title={canManage ? 'Click to toggle status' : undefined}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              template.is_active ? 'bg-[#10B981]' : 'bg-[#94A3B8]'
                            }`}
                          />
                          {template.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>

                      {/* Last Updated */}
                      <td className="py-3.5 px-4 text-[#64748B] dark:text-[#94A3B8] text-[11px]">
                        <div>{new Date(template.updated_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-[#94A3B8] dark:text-[#64748B]">
                          by {template.updated_by_name || template.created_by_name}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Live Preview Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(template)}
                            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition cursor-pointer"
                            title="Preview rendered template"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(template)}
                              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#7C3AED] hover:bg-[#F5F3FF] transition cursor-pointer"
                              title="Edit template details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Button */}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(template)}
                              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition cursor-pointer"
                              title="Delete template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="crm-card bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 px-6 border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between bg-gradient-to-r from-[#F8FAFC] to-[#EFF6FF] dark:from-[#111827] dark:to-[#172033]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white flex items-center justify-center shadow-xs">
                  {editingTemplate ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] m-0">
                    {editingTemplate ? `Edit Template: ${editingTemplate.name}` : 'Create New Email Template'}
                  </h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] m-0">
                    Reusable template for automated and manual counsellor email outreach
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] p-1 rounded-lg hover:bg-[#E2E8F0] dark:hover:bg-[#1E293B] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveTemplate} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-[#FEF2F2] dark:bg-rose-950/30 border border-[#FECACA] dark:border-rose-900/50 rounded-xl text-xs text-[#DC2626] dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Template Name & Format */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider">
                    Template Name <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Course Admission Welcome"
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] bg-[#F8FAFC] dark:bg-[#111827] focus:bg-white dark:focus:bg-[#111827] transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider">
                    Format
                  </label>
                  <select
                    value={formBodyFormat}
                    onChange={(e) => setFormBodyFormat(e.target.value as 'PLAIN' | 'HTML')}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] bg-[#F8FAFC] dark:bg-[#111827] focus:bg-white dark:focus:bg-[#111827] transition"
                  >
                    <option value="PLAIN">Plain Text</option>
                    <option value="HTML">HTML Email</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider">
                  Description <span className="text-[#94A3B8] dark:text-[#64748B] font-normal lowercase">(optional internal note)</span>
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Dispatched to prospective students upon reaching Contacted stage"
                  className="w-full px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-xs text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] bg-[#F8FAFC] dark:bg-[#111827] focus:bg-white dark:focus:bg-[#111827] transition"
                />
              </div>

              {/* Placeholder Guidance Bar */}
              <div className="p-3 bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#334155] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#475569] dark:text-[#CBD5E1] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" /> Safe Allowlisted Placeholders
                  </span>
                  <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">Click tag to insert into {activeInput}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SUPPORTED_PLACEHOLDERS.map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => handleInsertPlaceholder(item.tag)}
                      className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-white dark:bg-[#172033] text-[#2563EB] dark:text-blue-400 border border-[#BFDBFE] dark:border-blue-900/50 hover:bg-[#EFF6FF] dark:hover:bg-[#1E293B] hover:border-[#2563EB] transition cursor-pointer shadow-2xs"
                      title={item.desc}
                    >
                      {item.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Line */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider">
                    Email Subject <span className="text-[#DC2626]">*</span>
                  </label>
                  <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">Active field for placeholder insertion</span>
                </div>
                <input
                  ref={subjectInputRef}
                  type="text"
                  required
                  value={formSubject}
                  onFocus={() => setActiveInput('subject')}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="e.g. Welcome {{lead_name}} to {{company_name}}"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-xs font-mono text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] bg-[#F8FAFC] dark:bg-[#111827] focus:bg-white dark:focus:bg-[#111827] transition"
                />
              </div>

              {/* Email Body */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider">
                    Email Body Content <span className="text-[#DC2626]">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleInFormPreview}
                    className="text-[11px] text-[#2563EB] dark:text-blue-400 hover:text-[#1D4ED8] dark:hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" /> Live Preview Draft
                  </button>
                </div>
                <textarea
                  ref={bodyTextareaRef}
                  required
                  rows={6}
                  value={formBody}
                  onFocus={() => setActiveInput('body')}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Hi {{lead_name}},&#10;&#10;Thank you for connecting with {{company_name}}. Your dedicated career counsellor is {{employee_name}}...&#10;&#10;Best regards,&#10;Skill Move Admissions Team"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-xs font-sans text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] bg-[#F8FAFC] dark:bg-[#111827] focus:bg-white dark:focus:bg-[#111827] transition resize-y leading-relaxed"
                />
              </div>

              {/* Attachments Section */}
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0] dark:border-[#334155]">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#334155] dark:text-[#CBD5E1] uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-[#7C3AED]" /> Template Attachments
                  </label>
                  <span className="text-[10px] text-[#64748B] dark:text-[#94A3B8]">PDF, DOCX, XLSX, CSV, Images (Max 10MB each)</span>
                </div>

                {/* Existing attachments when editing */}
                {editingTemplate && editingTemplate.attachments && editingTemplate.attachments.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                      Attached Files ({editingTemplate.attachments.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {editingTemplate.attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827] text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileCheck className="w-4 h-4 text-[#10B981] shrink-0" />
                            <div className="truncate">
                              <p className="truncate font-medium text-[#0F172A] dark:text-[#F8FAFC] m-0 text-[11px]">
                                {att.original_filename}
                              </p>
                              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] m-0">{att.file_size_display}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <a
                              href={att.download_url}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-[#2563EB] dark:text-blue-400 hover:bg-[#EFF6FF] dark:hover:bg-[#1E293B] rounded transition"
                              title="Download attachment"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                setAttachmentDeleteTarget({ templateId: editingTemplate.id, attachment: att })
                              }
                              className="p-1 text-[#DC2626] dark:text-rose-400 hover:bg-[#FEF2F2] dark:hover:bg-rose-950/40 rounded transition cursor-pointer"
                              title="Delete attachment from template"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New files to upload */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    <span className="text-[10px] font-bold text-[#2563EB] dark:text-blue-400 uppercase tracking-wider">
                      New Files to Add ({selectedFiles.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg border border-[#BFDBFE] dark:border-blue-900/60 bg-[#EFF6FF] dark:bg-blue-950/30 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <UploadCloud className="w-4 h-4 text-[#2563EB] dark:text-blue-400 shrink-0" />
                            <div className="truncate">
                              <p className="truncate font-medium text-[#0F172A] dark:text-[#F8FAFC] m-0 text-[11px]">{file.name}</p>
                              <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] m-0">{formatFileSize(file.size)}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSelectedFile(idx)}
                            className="p-1 text-[#DC2626] dark:text-rose-400 hover:bg-[#FEE2E2] dark:hover:bg-rose-950/50 rounded transition cursor-pointer"
                            title="Remove file"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#CBD5E1] dark:border-[#334155] hover:border-[#2563EB] dark:hover:border-blue-500 rounded-xl p-4 text-center bg-[#F8FAFC] dark:bg-[#111827]/60 hover:bg-[#EFF6FF] dark:hover:bg-[#1E293B]/60 transition cursor-pointer group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt"
                  />
                  <UploadCloud className="w-6 h-6 text-[#64748B] dark:text-[#94A3B8] group-hover:text-[#2563EB] dark:group-hover:text-blue-400 mx-auto mb-1 transition" />
                  <p className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] group-hover:text-[#2563EB] dark:group-hover:text-blue-400 m-0">
                    Click to browse files or drag and drop attachments
                  </p>
                  <p className="text-[10px] text-[#94A3B8] dark:text-[#64748B] m-0 mt-0.5">
                    Templates can be saved without attachments or with up to 10 files
                  </p>
                </div>
              </div>

              {/* Active Toggle */}
              <div className="pt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 text-[#2563EB] rounded border-[#CBD5E1] dark:border-[#475569] dark:bg-[#111827] focus:ring-[#2563EB]"
                  />
                  <span>Activate template immediately for counselling outreach</span>
                </label>
              </div>

              {/* Modal Footer / Actions */}
              <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#334155] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={formSubmitting}
                  className="crm-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="btn-submit-template"
                  disabled={formSubmitting}
                  className="crm-btn-primary px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-white bg-gradient-to-r from-[#2563EB] to-[#7C3AED] disabled:opacity-50"
                >
                  {formSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingTemplate ? 'Update Template' : 'Save Template'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="crm-card bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 px-6 border-b border-[#E2E8F0] dark:border-[#334155] flex items-center justify-between bg-gradient-to-r from-[#EFF6FF] to-[#F5F3FF] dark:from-[#111827] dark:to-[#172033]">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] m-0">Rendered Email Preview</h3>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] m-0">{previewTemplateName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] p-1 rounded-lg hover:bg-[#E2E8F0] dark:hover:bg-[#1E293B] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {previewLoading ? (
                <div className="p-12 text-center">
                  <RefreshCw className="w-6 h-6 text-[#2563EB] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">Rendering preview with safe sample data...</p>
                </div>
              ) : previewData ? (
                <>
                  {/* Unresolved Placeholders Alert */}
                  {previewData.unresolved_placeholders.length > 0 && (
                    <div className="p-3 bg-[#FFFBEB] dark:bg-amber-950/30 border border-[#FDE68A] dark:border-amber-900/50 rounded-xl text-xs text-[#92400E] dark:text-amber-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Unresolved Placeholders Detected: </span>
                        <span>{previewData.unresolved_placeholders.join(', ')}.</span>
                        <p className="text-[11px] text-[#B45309] dark:text-amber-400 m-0 mt-0.5">
                          These placeholders will not be substituted automatically unless supplied during lead dispatch.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Mock Email Client Container */}
                  <div className="border border-[#CBD5E1] dark:border-[#334155] rounded-xl overflow-hidden shadow-xs">
                    {/* Email Headers */}
                    <div className="bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#334155] p-3 space-y-1.5 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#64748B] dark:text-[#94A3B8] w-14">From:</span>
                        <span className="text-[#0F172A] dark:text-[#F8FAFC]">Skill Move Admissions &lt;admissions@skillmove.com&gt;</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#64748B] dark:text-[#94A3B8] w-14">To:</span>
                        <span className="text-[#0F172A] dark:text-[#F8FAFC]">
                          {previewData.sample_data?.['{{lead_name}}'] || 'Rahul Sharma'} &lt;
                          {previewData.sample_data?.['{{lead_email}}'] || 'rahul.sharma@example.com'}&gt;
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#64748B] dark:text-[#94A3B8] w-14">Subject:</span>
                        <span className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">{previewData.subject}</span>
                      </div>
                    </div>

                    {/* Email Body */}
                    <div className="p-4 bg-white dark:bg-[#0F172A] min-h-[160px] whitespace-pre-wrap font-sans text-xs text-[#1E293B] dark:text-[#CBD5E1] leading-relaxed">
                      {previewData.body}
                    </div>

                    {/* Attachments Footer */}
                    {previewTemplateAttachments.length > 0 && (
                      <div className="bg-[#F8FAFC] dark:bg-[#111827] border-t border-[#E2E8F0] dark:border-[#334155] p-3">
                        <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider block mb-1.5">
                          Enclosed Attachments ({previewTemplateAttachments.length}):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {previewTemplateAttachments.map((att) => (
                            <span
                              key={att.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] text-[#334155] dark:text-[#CBD5E1] shadow-2xs"
                            >
                              <Paperclip className="w-3 h-3 text-[#7C3AED]" />
                              <span className="font-medium">{att.original_filename}</span>
                              <span className="text-[10px] text-[#94A3B8]">({att.file_size_display})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sample Values Applied Reference */}
                  <div className="p-3 bg-[#F1F5F9] dark:bg-[#111827] rounded-xl text-[11px] space-y-1">
                    <span className="font-bold text-[#475569] dark:text-[#CBD5E1]">Sample Values Substituted in Preview:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-[10px] text-[#64748B] dark:text-[#94A3B8]">
                      {Object.entries(previewData.sample_data || {}).map(([key, val]) => (
                        <div key={key}>
                          <span className="font-mono text-[#2563EB] dark:text-blue-400">{key}</span>: {val}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-3 px-6 border-t border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#111827] flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="crm-btn-primary px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer text-white bg-[#2563EB]"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE TEMPLATE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="crm-card bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-[#FEF2F2] dark:bg-rose-950/40 text-[#DC2626] dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">Delete Email Template</h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Are you sure you want to delete <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">"{deleteTarget.name}"</span>?
                All associated template attachments will also be permanently purged.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="crm-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ATTACHMENT CONFIRMATION MODAL */}
      {attachmentDeleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="crm-card bg-white dark:bg-[#172033] border border-[#E2E8F0] dark:border-[#334155] rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Remove Attachment</h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Remove "{attachmentDeleteTarget.attachment.original_filename}" from this template?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAttachmentDeleteTarget(null)}
                disabled={isDeletingAttachment}
                className="crm-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAttachment}
                disabled={isDeletingAttachment}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition cursor-pointer disabled:opacity-50"
              >
                {isDeletingAttachment ? 'Removing...' : 'Remove File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
