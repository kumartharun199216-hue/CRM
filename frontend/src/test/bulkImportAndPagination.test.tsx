import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkImportModal } from '../components/BulkImportModal';
import { SpreadsheetView } from '../components/SpreadsheetView';
import { App } from '../App';
import { api } from '../services/api';
import { User, Lead, PipelineStage, ImportPreviewResponse, ImportValidateResponse, ImportConfirmResponse } from '../types';

vi.mock('../services/api', () => ({
  api: {
    getMe: vi.fn().mockResolvedValue({ id: 1, username: 'admin@skillmove.com', role: 'ADMIN' }),
    getStages: vi.fn().mockResolvedValue([]),
    getStageCounts: vi.fn().mockResolvedValue({}),
    getTeams: vi.fn().mockResolvedValue([]),
    getUsers: vi.fn().mockResolvedValue([]),
    getLeads: vi.fn().mockResolvedValue([]),
    getUnassignedLeads: vi.fn().mockResolvedValue([]),
    getUnassignedCount: vi.fn().mockResolvedValue({ count: 0 }),
    importPreview: vi.fn().mockResolvedValue({}),
    importValidate: vi.fn().mockResolvedValue({}),
    importConfirm: vi.fn().mockResolvedValue({}),
    getImportBatches: vi.fn().mockResolvedValue([]),
    getDashboardStats: vi.fn().mockResolvedValue({}),
    getLeadTimeline: vi.fn().mockResolvedValue({ timeline: [], count: 0 }),
    getStageHistory: vi.fn().mockResolvedValue([]),
    getAssignmentHistory: vi.fn().mockResolvedValue([]),
    getCommunicationLogs: vi.fn().mockResolvedValue([]),
    getReportSchedules: vi.fn().mockResolvedValue([]),
    getTemplates: vi.fn().mockResolvedValue([]),
    getAuditEvents: vi.fn().mockResolvedValue([]),
  },
}));

describe('Bulk Lead Import, Employee Distribution, Pagination and Page Refresh', () => {
  const adminUser: User = {
    id: 1,
    username: 'admin@skillmove.com',
    email: 'admin@skillmove.com',
    role: 'ADMIN',
  };

  const managerUser: User = {
    id: 2,
    username: 'manager@skillmove.com',
    email: 'manager@skillmove.com',
    role: 'MANAGER',
    team: 10,
    team_name: 'Admissions Team Alpha',
    managed_team_id: 10,
    managed_team_name: 'Admissions Team Alpha',
  };

  const stages: PipelineStage[] = [
    { id: 1, name: 'Cold Calling', order: 1, is_active: true },
    { id: 2, name: 'Not Connected', order: 2, is_active: true },
    { id: 3, name: 'New Lead', order: 3, is_active: true },
    { id: 4, name: 'Contacted', order: 4, is_active: true },
    { id: 5, name: 'Interested', order: 5, is_active: true },
    { id: 6, name: 'Prospect', order: 6, is_active: true },
    { id: 7, name: 'FollowUp', order: 7, is_active: true },
    { id: 8, name: 'Negotation', order: 8, is_active: true },
    { id: 9, name: 'pendingClosure', order: 9, is_active: true },
    { id: 10, name: 'Enrolled', order: 10, is_active: true },
    { id: 11, name: 'Not Interested', order: 11, is_active: true },
    { id: 12, name: 'Lost', order: 12, is_active: true },
  ];

  const salesUsers: User[] = [
    { id: 101, username: 'sales1@skillmove.com', first_name: 'Alice', email: 'alice@skillmove.com', role: 'SALES_EMPLOYEE', team: 10, team_name: 'Alpha' },
    { id: 102, username: 'sales2@skillmove.com', first_name: 'Bob', email: 'bob@skillmove.com', role: 'SALES_EMPLOYEE', team: 10, team_name: 'Alpha' },
    { id: 103, username: 'sales3@skillmove.com', first_name: 'Charlie', email: 'charlie@skillmove.com', role: 'SALES_EMPLOYEE', team: 20, team_name: 'Beta' },
  ];

  // Generate 120 sample leads for pagination test
  const sample120Leads: Lead[] = Array.from({ length: 120 }, (_, idx) => ({
    id: idx + 1,
    lead_id: `SM-2026-${String(idx + 1).padStart(4, '0')}`,
    name: `Student Candidate ${idx + 1}`,
    title: `Candidate ${idx + 1}`,
    contact_name: `Student Candidate ${idx + 1}`,
    email: `student${idx + 1}@example.com`,
    phone: `+91987654${String(idx).padStart(4, '0')}`,
    qualification: 'B.Tech CS',
    college: 'Delhi Technical University',
    yop: '2025',
    key_skills: 'Python, React',
    target_role: 'Full Stack Engineer',
    experience: '1 year',
    experience_years: 1,
    company: 'Tech Corp',
    priority: idx % 3 === 0 ? 'High' : 'Normal',
    status: 'In Progress',
    estimated_revenue: '50000.00',
    placement_fee: '15000.00',
    career_counsellor: 'Alice',
    city: 'Bangalore',
    next_follow_up: null,
    stage: ((idx % 12) + 1),
    stage_name: stages[idx % 12].name,
    team: 10,
    team_name: 'Alpha',
    assigned_employee: 101,
    assigned_employee_name: 'Alice',
    created_by: 1,
    created_by_name: 'Admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('crm_token', 'test-token');
    window.history.replaceState({}, '', '/');
    vi.mocked(api.getStages).mockResolvedValue(stages);
    vi.mocked(api.getTeams).mockResolvedValue([]);
    vi.mocked(api.getUsers).mockResolvedValue(salesUsers);
  });

  describe('Bulk Import Modal Workflow', () => {
    it('renders file upload step with format restrictions and source data preservation notice', async () => {
      render(
        <BulkImportModal
          isOpen={true}
          currentUser={adminUser}
          onClose={() => {}}
          onImportComplete={() => {}}
        />
      );

      expect(screen.getByText('Bulk Lead Import')).toBeInTheDocument();
      expect(screen.getByText(/Select a CSV or Excel file to import/i)).toBeInTheDocument();
      expect(screen.getByText(/Source Data Preservation Rules/i)).toBeInTheDocument();
      expect(screen.getByText(/Required fields:/i)).toBeInTheDocument();
    });

    it('handles file preview, sheet selection, column mapping, stage selection and assignment modes', async () => {
      const previewMock: ImportPreviewResponse = {
        file_token: 'token_abc123',
        file_name: 'students_batch.xlsx',
        file_type: 'xlsx',
        sheets: ['BatchA', 'BatchB'],
        selected_sheet: 'BatchA',
        headers: ['Candidate Name', 'Student Email', 'Mobile', 'Degree'],
        total_rows: 101,
        sample_rows: [{ 'Candidate Name': 'Raj Kumar', 'Student Email': 'raj@example.com', 'Mobile': '9876543210', 'Degree': 'B.Sc' }],
        suggested_mapping: {
          'Candidate Name': 'name',
          'Student Email': 'email',
          'Mobile': 'phone',
        },
        supported_crm_fields: [
          { key: 'name', label: 'Lead Name', required: true },
          { key: 'email', label: 'Email', required: true },
          { key: 'phone', label: 'Mobile Phone', required: true },
          { key: 'qualification', label: 'Degree / Qualification', required: false },
        ],
      };
      vi.mocked(api.importPreview).mockResolvedValue(previewMock);

      render(
        <BulkImportModal
          isOpen={true}
          currentUser={adminUser}
          onClose={() => {}}
          onImportComplete={() => {}}
        />
      );

      // Upload a fake file
      const file = new File(['dummy content'], 'students_batch.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      const nextBtn = screen.getByText(/Next: Map Columns/i);
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(api.importPreview).toHaveBeenCalled();
        expect(screen.getByText(/Map Source Columns to CRM Lead Fields/i)).toBeInTheDocument();
      });

      // Worksheet selection is displayed when multiple sheets exist
      expect(screen.getByText(/Worksheet:/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('BatchA')).toBeInTheDocument();

      // Proceed to Step 3: Stage & Assignment
      const stageBtn = screen.getByText(/Next: Stage & Assignment/i);
      fireEvent.click(stageBtn);

      await waitFor(() => {
        expect(screen.getByText(/Destination Pipeline Stage/i)).toBeInTheDocument();
        expect(screen.getByText(/Mode A/i)).toBeInTheDocument();
        expect(screen.getByText(/Mode B/i)).toBeInTheDocument();
        expect(screen.getByText(/Mode C/i)).toBeInTheDocument();
      });

      // Mode B: Even split distribution among selected employees
      const validateMock: ImportValidateResponse = {
        file_token: 'token_abc123',
        file_name: 'students_batch.xlsx',
        total_rows: 101,
        valid_count: 101,
        invalid_count: 0,
        duplicate_count: 0,
        stage: { id: 3, name: 'New Lead' },
        assignment_mode: 'ALL_ELIGIBLE',
        selected_employee_count: 2,
        distribution: [
          { employee_id: 101, employee_name: 'Alice', username: 'sales1', team_id: 10, team_name: 'Alpha', count: 51 },
          { employee_id: 102, employee_name: 'Bob', username: 'sales2', team_id: 10, team_name: 'Alpha', count: 50 },
        ],
        missing_mandatory: [],
        row_validations: [],
        total_validation_rows: 101,
      };
      vi.mocked(api.importValidate).mockResolvedValue(validateMock);

      const validateBtn = screen.getByText(/Validate Import Data/i);
      fireEvent.click(validateBtn);

      await waitFor(() => {
        expect(api.importValidate).toHaveBeenCalled();
        expect(screen.getByText('Planned Employee Distribution (2 employees)')).toBeInTheDocument();
        expect(screen.getByText('51 leads')).toBeInTheDocument();
        expect(screen.getByText('50 leads')).toBeInTheDocument();
      });

      // Confirmation step
      const confirmMock: ImportConfirmResponse = {
        batch_id: 'batch_test_123',
        file_name: 'students_batch.xlsx',
        imported_count: 101,
        rejected_count: 0,
        duplicate_count: 0,
        stage_id: 3,
        stage_name: 'New Lead',
        assignment_mode: 'ALL_ELIGIBLE',
        distribution: { 'Alice': 51, 'Bob': 50 },
        errors: [],
        status: 'COMPLETED',
      };
      vi.mocked(api.importConfirm).mockResolvedValue(confirmMock);

      const confirmBtn = screen.getByRole('button', { name: /Confirm & Import Valid Leads/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(api.importConfirm).toHaveBeenCalled();
        expect(screen.getByText('Lead Import Batch Completed!')).toBeInTheDocument();
        expect(screen.getByText('101')).toBeInTheDocument();
        expect(screen.getByText('Done & View Leads')).toBeInTheDocument();
      });
    });
  });

  describe('Pagination — Default 50 Rows', () => {
    it('defaults to page size 50 and renders options 10, 25, 50, 100', async () => {
      render(
        <SpreadsheetView
          leads={sample120Leads}
          stages={stages}
          users={salesUsers}
          currentUser={adminUser}
          onOpenLead={() => {}}
          onOpenHistory={() => {}}
          onCommunicate={() => {}}
        />
      );

      // Check rows per page dropdown default
      const select = document.getElementById('page-size-selector') as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      expect(select.value).toBe('50');

      // Check available options
      const options = Array.from(select.options).map((opt) => opt.value);
      expect(options).toEqual(['10', '25', '50', '100']);

      // Check showing text
      expect(screen.getByText('Rows per page:')).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('of') && content.includes('leads'))).toBeInTheDocument();

      // Check Page 1 of 3
      expect(document.body.textContent).toContain('Page 1 of 3');
      expect(document.body.textContent).toContain('120 leads');

      // Previous button should be disabled on first page
      const prevBtn = document.getElementById('pagination-prev-btn') as HTMLButtonElement;
      expect(prevBtn).toBeDisabled();

      // Next button should be enabled
      const nextBtn = document.getElementById('pagination-next-btn') as HTMLButtonElement;
      expect(nextBtn).toBeEnabled();

      // Click Next
      fireEvent.click(nextBtn);

      // Now on page 2 (showing 51-100)
      expect(prevBtn).toBeEnabled();
    });

    it('changes visible rows when changing page size to 10', async () => {
      render(
        <SpreadsheetView
          leads={sample120Leads}
          stages={stages}
          users={salesUsers}
          currentUser={adminUser}
          onOpenLead={() => {}}
          onOpenHistory={() => {}}
          onCommunicate={() => {}}
        />
      );

      const select = document.getElementById('page-size-selector') as HTMLSelectElement;
      fireEvent.change(select, { target: { value: '10' } });

      expect(select.value).toBe('10');
      // Total pages for 120 leads with page size 10 is 12
      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('resets page to 1 when search or stage filter changes', async () => {
      render(
        <SpreadsheetView
          leads={sample120Leads}
          stages={stages}
          users={salesUsers}
          currentUser={adminUser}
          onOpenLead={() => {}}
          onOpenHistory={() => {}}
          onCommunicate={() => {}}
        />
      );

      const nextBtn = document.getElementById('pagination-next-btn') as HTMLButtonElement;
      fireEvent.click(nextBtn); // Now on page 2

      // Type in search box
      const searchInput = screen.getByPlaceholderText(/Search leads by ID, name/i);
      fireEvent.change(searchInput, { target: { value: 'Candidate 10' } });

      // Prev button should be disabled again (reset to page 1)
      const prevBtn = document.getElementById('pagination-prev-btn') as HTMLButtonElement;
      expect(prevBtn).toBeDisabled();
    });
  });

  describe('Page Refresh and Route State Preservation', () => {
    it('restores spreadsheet view, stage filter and page size from URL query parameters on refresh', async () => {
      // Simulate page refresh on ?view=spreadsheet&stage=3&page_size=25
      window.history.replaceState({}, '', '/?view=spreadsheet&stage=3&page_size=25');

      vi.mocked(api.getMe).mockResolvedValue(adminUser);
      vi.mocked(api.getStages).mockResolvedValue(stages);
      vi.mocked(api.getTeams).mockResolvedValue([]);
      vi.mocked(api.getUsers).mockResolvedValue(salesUsers);
      vi.mocked(api.getStageCounts).mockResolvedValue({});
      vi.mocked(api.getUnassignedCount).mockResolvedValue({ count: 0 });
      vi.mocked(api.getLeads).mockResolvedValue(sample120Leads);

      render(<App />);

      await waitFor(() => {
        expect(api.getMe).toHaveBeenCalled();
        // The spreadsheet view is rendered (not redirected to dashboard!)
        expect(document.getElementById('view-toggle-spreadsheet')).toHaveClass('crm-btn-primary');
        // Top menu contains Bulk Import button
        expect(document.getElementById('top-menu-import-leads-btn')).toBeInTheDocument();
      });
    });

    it('restores Lead 360 overview modal if requested by URL query param ?lead360=1', async () => {
      window.history.replaceState({}, '', '/?view=spreadsheet&lead360=1');

      vi.mocked(api.getMe).mockResolvedValue(adminUser);
      vi.mocked(api.getStages).mockResolvedValue(stages);
      vi.mocked(api.getTeams).mockResolvedValue([]);
      vi.mocked(api.getUsers).mockResolvedValue(salesUsers);
      vi.mocked(api.getStageCounts).mockResolvedValue({});
      vi.mocked(api.getUnassignedCount).mockResolvedValue({ count: 0 });
      vi.mocked(api.getLeads).mockResolvedValue(sample120Leads);
      vi.mocked(api.getLeadTimeline).mockResolvedValue({
        lead_id: 1,
        lead_code: 'SM-2026-0001',
        lead_name: 'Student Candidate 1',
        current_stage_id: 1,
        current_stage_name: 'Cold Calling',
        count: 0,
        timeline: [],
      });
      vi.mocked(api.getStageHistory).mockResolvedValue([]);
      vi.mocked(api.getAssignmentHistory).mockResolvedValue([]);
      vi.mocked(api.getCommunicationLogs).mockResolvedValue([]);

      render(<App />);

      await waitFor(() => {
        // Modal for 360 overview opens automatically from URL
        expect(screen.getByRole('heading', { name: 'Student Candidate 1' })).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });
});
