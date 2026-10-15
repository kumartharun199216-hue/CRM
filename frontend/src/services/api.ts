import {
  User,
  Team,
  CreateTeamPayload,
  UpdateTeamPayload,
  PipelineStage,
  Lead,
  LeadAssignmentHistory,
  LeadStageHistory,
  CommunicationTemplate,
  TemplateAttachment,
  TemplatePreviewResponse,
  CommunicationLog,
  ReportSchedule,
  AuditEvent,
  DashboardStats,
  LeadTimelineResponse,
  ChangeStagePayload,
  PreCloserFinancial,
  LeadFinancialHistoryEntry,
  PaginatedResponse,

  ImportPreviewResponse,
  ImportValidateResponse,
  ImportConfirmPayload,
  ImportConfirmResponse,
  LeadImportBatchRecord,
  CreateUserPayload,
  AdminUpdateUserPayload,
  DeactivateUserPayload,
  UserActionResponse,
  ChangePasswordPayload,
  UserUpdatePayload,
  PasswordResetRequestPayload,
  PasswordResetRequestResponse,
  PasswordResetConfirmPayload,
  PasswordResetConfirmResponse,
  AdminPasswordResetResponse,
  LeadTransferAction,
  TeamTransferPreviewResponse,
  TeamTransferPayload,
  Notification,
  UnreadCountResponse,
  MarkAllReadResponse,
  NotificationListParams,
} from '../types';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('crm_token');
  return token ? { Authorization: `Token ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    ...((options.headers as Record<string, string>) || {}),
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data.detail) errorDetail = data.detail;
      else if (data.error) errorDetail = data.error;
      else if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
        errorDetail = data.non_field_errors.join(', ');
      } else if (typeof data === 'object') {
        errorDetail = Object.entries(data)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join(' | ');
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  getMe: () => request<User>('/auth/me/'),
  getProfile: () => request<User>('/auth/me/'),
  updateProfile: (data: UserUpdatePayload) =>
    request<User>('/auth/me/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  changePassword: (data: ChangePasswordPayload) =>
    request<{ detail: string; token: string; user: User }>('/auth/change-password/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  requestPasswordReset: (data: PasswordResetRequestPayload) =>
    request<PasswordResetRequestResponse>('/auth/password-reset/request/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  confirmPasswordReset: (data: PasswordResetConfirmPayload) =>
    request<PasswordResetConfirmResponse>('/auth/password-reset/confirm/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  adminResetPassword: (userId: number) =>
    request<AdminPasswordResetResponse>(`/auth/users/${userId}/reset-password/`, {
      method: 'POST',
    }),
  logout: () =>
    request<{ detail: string }>('/auth/logout/', {
      method: 'POST',
    }),
  getUsers: (params?: { role?: string; team?: number }) => {
    const q = new URLSearchParams();
    if (params?.role) q.append('role', params.role);
    if (params?.team) q.append('team', params.team.toString());
    return request<User[]>(`/auth/users/?${q.toString()}`);
  },
  getUserLookup: (params?: { role?: string; team?: number }) => {
    const q = new URLSearchParams();
    if (params?.role) q.append('role', params.role);
    if (params?.team) q.append('team', params.team.toString());
    return request<User[]>(`/auth/users/lookup/?${q.toString()}`);
  },
  getUsersPaginated: (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    role?: string;
    team?: number | string;
    status?: string;
  }) => {
    const q = new URLSearchParams();
    q.append('paginate', 'true');
    if (params?.page) q.append('page', params.page.toString());
    if (params?.page_size) q.append('page_size', params.page_size.toString());
    if (params?.search) q.append('search', params.search);
    if (params?.role && params.role !== 'ALL') q.append('role', params.role);
    if (params?.team && params.team !== 'ALL') q.append('team', params.team.toString());
    if (params?.status && params.status !== 'ALL') q.append('status', params.status);
    return request<PaginatedResponse<User>>(`/auth/users/?${q.toString()}`);
  },
  createUser: (data: CreateUserPayload) =>
    request<User>('/auth/users/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getUserById: (userId: number) =>
    request<User>(`/auth/users/${userId}/`),
  updateUser: (userId: number, data: AdminUpdateUserPayload) =>
    request<UserActionResponse>(`/auth/users/${userId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  activateUser: (userId: number) =>
    request<UserActionResponse>(`/auth/users/${userId}/activate/`, {
      method: 'POST',
    }),
  deactivateUser: (userId: number, payload?: DeactivateUserPayload) =>
    request<UserActionResponse>(`/auth/users/${userId}/deactivate/`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
  getTeamTransferPreview: (userId: number, newTeamId?: number) => {
    const q = newTeamId ? `?new_team=${newTeamId}` : '';
    return request<TeamTransferPreviewResponse>(`/auth/users/${userId}/transfer-preview/${q}`);
  },
  transferEmployeeTeam: (userId: number, payload: TeamTransferPayload) =>
    request<{ detail: string; user: User }>(`/auth/users/${userId}/transfer-team/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Teams
  getTeams: (params?: { is_active?: boolean | string }) => {
    const q = new URLSearchParams();
    if (params?.is_active !== undefined && params.is_active !== 'ALL') {
      q.append('is_active', String(params.is_active));
    }
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return request<Team[]>(`/teams/${queryStr}`);
  },
  getTeamById: (teamId: number) => request<Team>(`/teams/${teamId}/`),
  createTeam: (data: CreateTeamPayload) =>
    request<Team>('/teams/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTeam: (teamId: number, data: UpdateTeamPayload) =>
    request<Team>(`/teams/${teamId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTeam: (teamId: number) =>
    request<void>(`/teams/${teamId}/`, {
      method: 'DELETE',
    }),

  // Pipeline Stages
  getStages: () => request<PipelineStage[]>('/leads/stages/'),
  getStageCounts: () => request<Record<number, number>>('/leads/stage-counts/'),
  createStage: (data: { name: string; order: number }) =>
    request<PipelineStage>('/leads/stages/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getLeads: (params?: {
    stage?: number;
    team?: number;
    assigned_employee?: number;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.stage) q.append('stage', params.stage.toString());
    if (params?.team) q.append('team', params.team.toString());
    if (params?.assigned_employee) q.append('assigned_employee', params.assigned_employee.toString());
    if (params?.search) q.append('search', params.search);
    return request<Lead[]>(`/leads/?${q.toString()}`);
  },
  getPaginatedLeads: (params?: {
    stage?: number;
    team?: number;
    assigned_employee?: number;
    search?: string;
    page?: number;
    page_size?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.stage) q.append('stage', params.stage.toString());
    if (params?.team) q.append('team', params.team.toString());
    if (params?.assigned_employee) q.append('assigned_employee', params.assigned_employee.toString());
    if (params?.search) q.append('search', params.search);
    q.append('page', (params?.page || 1).toString());
    q.append('page_size', (params?.page_size || 50).toString());
    return request<PaginatedResponse<Lead>>(`/leads/?${q.toString()}`);
  },
  getLead: (id: number | string) => request<Lead>(`/leads/${id}/`),

  // Bulk Import
  importPreview: (data: FormData | { file_token: string; sheet_name?: string }) => {
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      return request<ImportPreviewResponse>('/leads/import/preview/', {
        method: 'POST',
        body: data,
      });
    }
    return request<ImportPreviewResponse>('/leads/import/preview/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  importValidate: (data: {
    file_token: string;
    sheet_name?: string;
    column_mapping: Record<string, string>;
    stage_id: number;
    assignment_mode: string;
    assigned_employees?: number[];
    team_id?: number;
    source?: string;
    default_priority?: string;
    batch_note?: string;
    is_unassigned?: boolean;
  }) =>
    request<ImportValidateResponse>('/leads/import/validate/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  importConfirm: (data: ImportConfirmPayload) =>
    request<ImportConfirmResponse>('/leads/import/confirm/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getImportBatches: () => request<LeadImportBatchRecord[]>('/leads/import/batches/'),
  getImportBatch: (id: number) => request<LeadImportBatchRecord>(`/leads/import/batches/${id}/`),
  downloadSampleFile: async (format: 'xlsx' | 'csv') => {
    const token = localStorage.getItem('crm_token');
    const headers: Record<string, string> = token ? { Authorization: `Token ${token}` } : {};
    const res = await fetch(`${API_BASE}/leads/import/sample/?format=${format}`, { headers });
    if (!res.ok) throw new Error('Failed to download sample file');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_sample_template.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  downloadBatchRejectedRows: async (batchId: number, filename?: string) => {
    const token = localStorage.getItem('crm_token');
    const headers: Record<string, string> = token ? { Authorization: `Token ${token}` } : {};
    const res = await fetch(`${API_BASE}/leads/import/batches/${batchId}/rejected/`, { headers });
    if (!res.ok) throw new Error('Failed to download rejected rows');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `import_batch_${batchId}_rejected_rows.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  getUnassignedLeads: (params?: { search?: string; stage?: number | string; priority?: string; status?: string; team?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.stage) q.append('stage', params.stage.toString());
    if (params?.priority) q.append('priority', params.priority);
    if (params?.status) q.append('status', params.status);
    if (params?.team) q.append('team', params.team.toString());
    return request<Lead[]>(`/leads/unassigned/?${q.toString()}`);
  },
  getUnassignedCount: () => request<{ count: number }>('/leads/unassigned-count/'),
  assignLead: (leadId: number, data: { employee_id: number; team_id?: number }) =>
    request<Lead>(`/leads/${leadId}/assign/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createUnassignedLead: (data: Partial<Lead>) =>
    request<Lead>('/leads/unassigned/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createLead: (data: Partial<Lead>) =>
    request<Lead>('/leads/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateLead: (id: number, data: Partial<Lead>) =>
    request<Lead>(`/leads/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getAssignmentHistory: (leadId: number) =>
    request<LeadAssignmentHistory[]>(`/leads/${leadId}/assignment-history/`),
  getStageHistory: (leadId: number) =>
    request<LeadStageHistory[]>(`/leads/${leadId}/stage-history/`),
  changeLeadStage: (leadId: number, data: ChangeStagePayload) =>
    request<{ detail: string; lead: Lead; stage_history: LeadStageHistory }>(`/leads/${leadId}/change-stage/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLeadFinancial: (leadId: number) =>
    request<{ financial: PreCloserFinancial; history: LeadFinancialHistoryEntry[] }>(`/leads/${leadId}/financial/`),
  updateLeadFinancial: (
    leadId: number,
    data: {
      agreed_amount?: string | number;
      amount_paid?: string | number;
      payment_amount?: string | number;
      mode?: 'record_payment' | 'set_totals';
      note?: string;
    }
  ) =>
    request<{ detail: string; financial: PreCloserFinancial; history_entry: LeadFinancialHistoryEntry }>(
      `/leads/${leadId}/financial/`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    ),
  getLeadTimeline: (leadId: number) =>

    request<LeadTimelineResponse>(`/leads/${leadId}/timeline/`),

  // Communications & Templates
  getTemplates: (params?: { channel?: string; search?: string; is_active?: boolean; team?: number }) => {
    const q = new URLSearchParams();
    if (params?.channel) q.append('channel', params.channel);
    if (params?.search) q.append('search', params.search);
    if (params?.is_active !== undefined) q.append('is_active', String(params.is_active));
    if (params?.team !== undefined) q.append('team', params.team.toString());
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return request<CommunicationTemplate[]>(`/communications/templates/${queryStr}`);
  },
  getTemplate: (id: number) =>
    request<CommunicationTemplate>(`/communications/templates/${id}/`),
  createTemplate: (data: FormData | Partial<CommunicationTemplate>) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return request<CommunicationTemplate>('/communications/templates/', {
      method: 'POST',
      body: isFormData ? data : JSON.stringify(data),
    });
  },
  updateTemplate: (id: number, data: FormData | Partial<CommunicationTemplate>) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return request<CommunicationTemplate>(`/communications/templates/${id}/`, {
      method: 'PATCH',
      body: isFormData ? data : JSON.stringify(data),
    });
  },
  deleteTemplate: (id: number) =>
    request<{ detail?: string }>(`/communications/templates/${id}/`, {
      method: 'DELETE',
    }),
  toggleTemplateActive: (id: number) =>
    request<CommunicationTemplate>(`/communications/templates/${id}/toggle-active/`, {
      method: 'PATCH',
    }),
  uploadTemplateAttachments: (templateId: number, formData: FormData) =>
    request<TemplateAttachment[]>(`/communications/templates/${templateId}/attachments/`, {
      method: 'POST',
      body: formData,
    }),
  deleteTemplateAttachment: (attachmentId: number) =>
    request<{ message?: string }>(`/communications/attachments/${attachmentId}/`, {
      method: 'DELETE',
    }),
  previewTemplate: (data: { template_id?: number; lead_id?: number; subject?: string; body?: string; sample_data?: Record<string, string> }) =>
    request<TemplatePreviewResponse>('/communications/templates/preview/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  downloadAttachmentUrl: (attachmentId: number) =>
    `${API_BASE}/communications/attachments/${attachmentId}/download/`,
  sendEmail: (data: { lead_id: number; subject?: string; body?: string; template_id?: number }) =>
    request<CommunicationLog>('/communications/send-email/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sendWhatsApp: (data: { lead_id: number; message: string }) =>
    request<CommunicationLog>('/communications/send-whatsapp/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  initiateCall: (data: { lead_id: number }) =>
    request<CommunicationLog>('/communications/initiate-call/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  syncCallyzerCalls: (data?: { days?: number; start_date?: string; end_date?: string; call_from?: number | string; call_to?: number | string }) =>
    request<{ status: string; result: { total_fetched: number; synced_count: number; unmatched_count: number } }>('/communications/callyzer/sync/', {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  getCommunicationLogs: (params?: {
    lead?: number;
    channel?: string;
    unmatched?: boolean;
    employee?: number | string;
    phone?: string;
    search?: string;
    status?: string;
    call_type?: string;
    start_date?: string;
    end_date?: string;
    min_duration?: number;
    max_duration?: number;
    has_recording?: string;
    sort_by?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.lead) q.append('lead', params.lead.toString());
    if (params?.channel) q.append('channel', params.channel);
    if (params?.unmatched) q.append('unmatched', 'true');
    if (params?.employee) q.append('employee', params.employee.toString());
    if (params?.phone) q.append('phone', params.phone);
    if (params?.search) q.append('search', params.search);
    if (params?.status) q.append('status', params.status);
    if (params?.call_type) q.append('call_type', params.call_type);
    if (params?.start_date) q.append('start_date', params.start_date);
    if (params?.end_date) q.append('end_date', params.end_date);
    if (params?.min_duration !== undefined) q.append('min_duration', params.min_duration.toString());
    if (params?.max_duration !== undefined) q.append('max_duration', params.max_duration.toString());
    if (params?.has_recording) q.append('has_recording', params.has_recording);
    if (params?.sort_by) q.append('sort_by', params.sort_by);
    return request<CommunicationLog[]>(`/communications/logs/?${q.toString()}`);
  },

  // Reports
  getReportSchedules: () => request<ReportSchedule[]>('/reports/schedules/'),
  createReportSchedule: (data: { name: string; recipients: string[]; frequency: string; time_utc: string }) =>
    request<ReportSchedule>('/reports/schedules/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  triggerReportRun: () =>
    request<{ message: string; task_id?: string; results?: unknown }>('/reports/run/', {
      method: 'POST',
    }),

  // Audit Events
  getAuditEvents: () => request<AuditEvent[]>('/audit/events/'),

  // Dashboard Aggregation
  getDashboardStats: (
    params?:
      | number
      | {
        preset?: string;
        days?: number;
        start_date?: string;
        end_date?: string;
        team_id?: number | string | null;
        employee_id?: number | string | null;
        stage_id?: number | string | null;
        source?: string | null;
        channel?: string | null;
        search?: string;
      }
  ) => {
    const q = new URLSearchParams();
    if (typeof params === 'number') {
      q.append('days', params.toString());
    } else if (params && typeof params === 'object') {
      if (params.preset) q.append('preset', params.preset);
      if (params.days !== undefined) q.append('days', params.days.toString());
      if (params.start_date) q.append('start_date', params.start_date);
      if (params.end_date) q.append('end_date', params.end_date);
      if (params.team_id !== undefined && params.team_id !== null && params.team_id !== 'ALL') {
        q.append('team_id', params.team_id.toString());
      }
      if (params.employee_id !== undefined && params.employee_id !== null && params.employee_id !== 'ALL') {
        q.append('employee_id', params.employee_id.toString());
      }
      if (params.stage_id !== undefined && params.stage_id !== null && params.stage_id !== 'ALL') {
        q.append('stage_id', params.stage_id.toString());
      }
      if (params.source && params.source !== 'ALL') q.append('source', params.source);
      if (params.channel && params.channel !== 'ALL') q.append('channel', params.channel);
      if (params.search && params.search.trim()) q.append('search', params.search.trim());
    }
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<DashboardStats>(`/leads/dashboard-stats/${qs}`);
  },

  // Notifications
  getNotifications: (params?: NotificationListParams) => {
    const q = new URLSearchParams();
    if (params) {
      if (params.page !== undefined) q.append('page', params.page.toString());
      if (params.page_size !== undefined) q.append('page_size', params.page_size.toString());
      if (params.unread_only !== undefined) q.append('unread_only', params.unread_only.toString());
      if (params.type) q.append('type', params.type);
      if (params.priority) q.append('priority', params.priority);
      if (params.archived) q.append('archived', params.archived);
      if (params.ordering) q.append('ordering', params.ordering);
    }
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<PaginatedResponse<Notification>>(`/notifications/${qs}`);
  },

  getUnreadCount: () => request<UnreadCountResponse>('/notifications/unread-count/'),

  getNotification: (id: string) => request<Notification>(`/notifications/${id}/`),

  markNotificationRead: (id: string) =>
    request<Notification>(`/notifications/${id}/read/`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  markAllNotificationsRead: () =>
    request<MarkAllReadResponse>('/notifications/read-all/', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  archiveNotification: (id: string) =>
    request<Notification>(`/notifications/${id}/archive/`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

