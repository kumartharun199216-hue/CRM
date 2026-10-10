export type UserRole = 'ADMIN' | 'MANAGER' | 'SALES_EMPLOYEE';

export type ViewType = 'dashboard' | 'spreadsheet' | 'kanban' | 'unassigned' | 'import' | 'users' | 'teams' | 'profile' | 'change-password' | 'not_found';

export interface UserUpdatePayload {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  mobile_number?: string;
  work_location?: string;
}

export interface ChangePasswordPayload {
  old_password?: string;
  current_password?: string;
  temporary_password?: string;
  new_password: string;
  confirm_password?: string;
}

export interface PasswordResetRequestPayload {
  identifier?: string;
  email?: string;
  username?: string;
}

export interface PasswordResetRequestResponse {
  detail: string;
  email_delivery: 'SENT' | 'UNAVAILABLE' | 'PENDING';
  email_sent: boolean;
  reset_token?: string;
  reset_url?: string;
  expires_in_minutes?: number;
  delivery_note?: string;
}

export interface PasswordResetConfirmPayload {
  token: string;
  new_password: string;
  confirm_password?: string;
}

export interface PasswordResetConfirmResponse {
  detail: string;
  token: string;
  user: User;
}

export interface AdminPasswordResetResponse {
  detail: string;
  employee_name?: string;
  full_name?: string;
  employee_id: string;
  username?: string;
  email: string;
  temporary_password?: string;
  reset_token?: string;
  reset_url?: string;
  email_delivery: 'SENT' | 'UNAVAILABLE' | 'PENDING';
  email_sent: boolean;
  delivery_note?: string;
  expires_in_seconds?: number;
  sessions_invalidated?: boolean;
  must_change_password?: boolean;
}

export interface User {
  id: number;
  employee_id?: string;
  username: string;
  email: string;
  mobile_number?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  full_name?: string;
  role: UserRole;
  designation?: string;
  department?: string;
  work_location?: string;
  date_of_joining?: string | null;
  must_change_password?: boolean;
  team?: number | null;
  team_name?: string;
  managed_team_id?: number | null;
  managed_team_name?: string;
  reporting_manager_id?: number | null;
  reporting_manager_name?: string;
  reporting_manager_email?: string;
  is_active?: boolean;
  account_status?: 'ACTIVE' | 'INACTIVE';
  temporary_password?: string;
  login_url?: string;
  date_joined?: string;
  last_login?: string | null;
}

export interface CreateUserPayload {
  full_name: string;
  email: string;
  mobile_number: string;
  role: UserRole;
  team?: number | null;
  designation?: string;
  reporting_manager?: number | null;
  department?: string;
  work_location?: string;
  date_of_joining?: string | null;
  password?: string;
}

export interface AdminUpdateUserPayload {
  full_name?: string;
  email?: string;
  mobile_number?: string;
  role?: UserRole;
  team?: number | null;
  designation?: string;
  department?: string;
  work_location?: string;
  date_of_joining?: string | null;
  reporting_manager_id?: number | null;
  is_active?: boolean;
  lead_transfer_action?: LeadTransferAction;
  reassign_leads_to?: number | null;
}

export interface DeactivateUserPayload {
  reassign_leads_to?: number | null;
}

export interface UserActionResponse {
  detail: string;
  user: User;
  sessions_invalidated?: boolean;
  reassigned_leads_count?: number;
}

export type LeadTransferAction =
  | 'TRANSFER_LEADS_TO_NEW_TEAM'
  | 'REASSIGN_LEADS_WITHIN_OLD_TEAM'
  | 'KEEP_LEADS_UNASSIGNED_IN_OLD_TEAM';

export interface TeamTransferPreviewResponse {
  user: {
    id: number;
    username: string;
    full_name: string;
    role: UserRole;
  };
  current_team: {
    id: number;
    name: string;
  } | null;
  target_team: {
    id: number;
    name: string;
  } | null;
  assigned_leads_count: number;
  leads_team_distribution: Record<string, number>;
  eligible_reassign_employees: Array<{
    id: number;
    username: string;
    full_name: string;
    role: UserRole;
  }>;
  supported_actions: Array<{
    action: LeadTransferAction;
    label: string;
    description: string;
  }>;
}

export interface TeamTransferPayload {
  new_team: number;
  lead_transfer_action?: LeadTransferAction;
  reassign_leads_to?: number | null;
}

export interface Team {
  id: number;
  name: string;
  description?: string;
  manager?: number | null;
  manager_name?: string;
  manager_full_name?: string;
  is_active?: boolean;
  members_count: number;
  active_members_count?: number;
  leads_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTeamPayload {
  name: string;
  description?: string;
  manager?: number | null;
  is_active?: boolean;
}

export interface UpdateTeamPayload {
  name?: string;
  description?: string;
  manager?: number | null;
  is_active?: boolean;
}

export interface PipelineStage {
  id: number;
  name: string;
  order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Lead {
  id: number;
  lead_id: string;
  name: string;
  title: string;
  contact_name: string;
  email: string;
  phone: string;
  qualification: string;
  college: string;
  yop: string;
  key_skills: string;
  target_role: string;
  experience: string;
  company: string;
  stage: number | null;
  stage_name: string | null;
  priority: string;
  status: string;
  estimated_revenue: string | number | null;
  placement_fee: string | number | null;
  career_counsellor: string;
  city: string;
  next_follow_up: string | null;
  team: number;
  team_name: string;
  assigned_employee: number | null;
  assigned_employee_name: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  last_stage_change?: {
    timestamp: string;
    changed_by: string;
    changed_by_name: string;
    from_stage_id: number | null;
    from_stage_name: string;
    to_stage_id: number | null;
    to_stage_name: string;
    note: string;
  } | null;
}

export interface LeadAssignmentHistory {
  id: number;
  lead: number;
  from_team: number | null;
  from_team_name: string | null;
  to_team: number;
  to_team_name: string;
  from_employee: number | null;
  from_employee_name: string | null;
  to_employee: number;
  to_employee_name: string;
  changed_by: number;
  changed_by_name: string;
  timestamp: string;
}

export interface LeadStageHistory {
  id: number;
  lead: number;
  from_stage: number | null;
  from_stage_name: string | null;
  to_stage: number | null;
  to_stage_name: string | null;
  changed_by: number;
  changed_by_name: string;
  note: string;
  timestamp: string;
}

export interface LeadTimelineItem {
  id: string;
  event_type: string;
  title: string;
  description: string;
  actor_name: string;
  actor_id?: number | null;
  timestamp: string;
  timestamp_display?: string;
  note?: string;
  before_value?: string | null;
  after_value?: string | null;
  outcome?: string | null;
  details?: Record<string, any>;
}

export interface LeadTimelineResponse {
  lead_id: number;
  lead_code: string;
  lead_name: string;
  current_stage_id: number | null;
  current_stage_name: string;
  count: number;
  timeline: LeadTimelineItem[];
}

export interface ChangeStagePayload {
  destination_stage_id: number;
  note: string;
  expected_current_stage_id?: number | null;
}

export interface CommunicationTemplate {
  id: number;
  name: string;
  channel: 'EMAIL' | 'WHATSAPP';
  subject?: string;
  body: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export interface CommunicationLog {
  id: number;
  lead: number;
  lead_title: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'CALL';
  recipient: string;
  subject?: string;
  content: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  error_message?: string;
  external_reference_id?: string;
  initiated_by_name: string;
  created_at: string;
}

export interface ReportSchedule {
  id: number;
  name: string;
  recipients: string[];
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  time_utc: string;
  is_active: boolean;
  last_run_at: string | null;
  created_by_name: string;
}

export interface AuditEvent {
  id: number;
  event_type: string;
  user: number | null;
  username: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface DashboardKPIs {
  total_leads: number;
  active_leads: number;
  created_in_period: number;
  enrolled_leads: number;
  lost_leads: number;
  unassigned_leads: number;
  assigned_leads: number;
  total_estimated_revenue: number;
  total_placement_fees: number;
  pending_followups: number;
  followups_today: number;
  followups_overdue: number;
}

export interface PipelineStageStat {
  id: number;
  name: string;
  order: number;
  count: number;
  percentage: number;
}

export interface TeamOverviewStat {
  team_id: number;
  team_name: string;
  manager_name: string;
  total_leads: number;
  assigned_leads: number;
  unassigned_leads: number;
  enrolled_leads: number;
  lost_leads: number;
  pending_followups: number;
  total_placement_fees: number;
}

export interface MemberPerformanceStat {
  id: number;
  name: string;
  username: string;
  team_name: string;
  assigned_leads: number;
  enrolled_leads: number;
  lost_leads: number;
  recorded_calls: number;
  recorded_messages: number;
  completed_followups: number;
  stage_summary: { stage_name: string; count: number }[];
}

export interface FollowupMonitoringItem {
  lead_id: number;
  lead_code: string;
  lead_name: string;
  phone: string;
  assigned_employee_name: string;
  due_date: string;
  stage_name: string;
  priority: string;
  is_overdue: boolean;
}

export interface RecentActivityItem {
  id: string | number;
  type: string;
  lead_id: number | null;
  lead_name: string;
  title: string;
  description: string;
  user: string;
  timestamp: string;
}

export interface DashboardStats {
  role: UserRole;
  days_filter?: number | null;
  kpis: DashboardKPIs;
  pipeline_overview: PipelineStageStat[];
  team_overview?: TeamOverviewStat[];
  member_performance?: MemberPerformanceStat[];
  followup_monitoring?: FollowupMonitoringItem[];
  recent_activity?: RecentActivityItem[];
}

export interface PaginatedResponse<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  page?: number;
  page_size?: number;
  total_pages: number;
  results: T[];
}

export type AssignmentMode = 'SINGLE' | 'SPLIT_SELECTED' | 'ALL_ELIGIBLE' | 'SELECTED' | 'UNASSIGNED' | 'ROUND_ROBIN';

export interface ImportPreviewResponse {
  file_token: string;
  file_name: string;
  file_type: string;
  sheets: string[];
  selected_sheet: string;
  headers: string[];
  total_rows: number;
  sample_rows: Record<string, any>[];
  suggested_mapping: Record<string, string>;
  supported_crm_fields: { key: string; label: string; required: boolean }[];
}

export interface ImportDistributionItem {
  employee_id: number;
  employee_name: string;
  username: string;
  team_id: number;
  team_name: string;
  count: number;
}

export interface ImportRowValidationItem {
  row_number: number;
  is_valid: boolean;
  is_duplicate: boolean;
  errors: string[];
  data: Record<string, any>;
  lead_name?: string;
  email?: string;
  phone?: string;
}

export interface ImportValidateResponse {
  file_token: string;
  file_name: string;
  total_rows: number;
  valid_count: number;
  invalid_count: number;
  duplicate_count: number;
  stage: { id: number; name: string };
  assignment_mode: AssignmentMode | string;
  selected_employee_count: number;
  distribution: ImportDistributionItem[];
  distribution_summary?: Record<string, number>;
  missing_mandatory: string[];
  row_validations: ImportRowValidationItem[];
  total_validation_rows: number;
}

export interface ImportConfirmPayload {
  file_token: string;
  batch_id?: string;
  sheet_name?: string;
  column_mapping: Record<string, string>;
  stage_id: number;
  assignment_mode: AssignmentMode | string;
  assigned_employees?: number[];
  team_id?: number;
  source?: string;
  default_priority?: string;
  batch_note?: string;
  is_unassigned?: boolean;
}

export interface ImportConfirmResponse {
  batch_id: string;
  file_name: string;
  imported_count: number;
  rejected_count: number;
  duplicate_count: number;
  stage_id: number;
  stage_name: string;
  assignment_mode: AssignmentMode | string;
  distribution: Record<string, number>;
  distribution_items?: ImportDistributionItem[];
  errors: { row_number: number; error: string }[];
  status: string;
  detail?: string;
}

export interface LeadImportBatchRecord {
  id: number;
  batch_id: string;
  file_name: string;
  file_type: string;
  total_rows: number;
  imported_count: number;
  rejected_count: number;
  duplicate_count: number;
  stage_id: number;
  stage_name: string;
  assignment_mode: AssignmentMode | string;
  source?: string;
  priority?: string;
  batch_note?: string;
  distribution_summary: Record<string, any>;
  errors_summary: any[];
  status: string;
  created_at: string;
  created_by_name: string;
}


