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
  CommunicationLog,
  ReportSchedule,
  AuditEvent,
  DashboardStats,
  LeadTimelineResponse,
  ChangeStagePayload,
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
  getLeadTimeline: (leadId: number) =>
    request<LeadTimelineResponse>(`/leads/${leadId}/timeline/`),

  // Communications
  getTemplates: (channel?: string) => {
    const q = channel ? `?channel=${channel}` : '';
    return request<CommunicationTemplate[]>(`/communications/templates/${q}`);
  },
  createTemplate: (data: { name: string; channel: string; subject?: string; body: string }) =>
    request<CommunicationTemplate>('/communications/templates/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sendEmail: (data: { lead_id: number; subject: string; body: string }) =>
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
  getCommunicationLogs: (params?: { lead?: number; channel?: string }) => {
    const q = new URLSearchParams();
    if (params?.lead) q.append('lead', params.lead.toString());
    if (params?.channel) q.append('channel', params.channel);
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
  getDashboardStats: (days?: number) => {
    const q = new URLSearchParams();
    if (days !== undefined) q.append('days', days.toString());
    return request<DashboardStats>(`/leads/dashboard-stats/?${q.toString()}`);
  },
};

