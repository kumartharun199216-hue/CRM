import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BulkImportPage } from '../components/BulkImportPage';
import { api } from '../services/api';
import { User, PipelineStage, Team, ImportPreviewResponse, ImportValidateResponse } from '../types';

describe('Bulk Import Column Mapping Validation & Required Field Completion', () => {
  const adminUser: User = {
    id: 1,
    username: 'admin@skillmove.edu',
    email: 'admin@skillmove.edu',
    role: 'ADMIN',
  };

  const sampleStages: PipelineStage[] = [
    { id: 1, name: 'Cold Calling', order: 1, is_active: true },
    { id: 2, name: 'Contacted', order: 2, is_active: true },
  ];

  const sampleTeams: Team[] = [
    {
      id: 1,
      name: 'Skill Move Admissions',
      manager: 2,
      manager_name: 'manager@skillmove.edu',
      members_count: 2,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  const sampleCounsellors: User[] = [
    {
      id: 3,
      username: 'counsellor1@skillmove.edu',
      email: 'counsellor1@skillmove.edu',
      role: 'SALES_EMPLOYEE',
      team: 1,
      team_name: 'Skill Move Admissions',
    },
    {
      id: 4,
      username: 'counsellor2@skillmove.edu',
      email: 'counsellor2@skillmove.edu',
      role: 'SALES_EMPLOYEE',
      team: 1,
      team_name: 'Skill Move Admissions',
    },
  ];

  // Mock standard preview response with 3 headers: "Student Name", "Email", "Mobile Number"
  const excelPreviewResponse: ImportPreviewResponse = {
    file_token: 'token_excel_test_123',
    file_name: 'students_import_template.xlsx',
    file_type: 'xlsx',
    sheets: ['Admissions'],
    selected_sheet: 'Admissions',
    headers: ['Student Name', 'Email', 'Mobile Number', 'City'],
    total_rows: 2,
    sample_rows: [
      {
        'Student Name': 'Aarav Patel',
        'Email': 'student001@example.com',
        'Mobile Number': '1-202-555-1000',
        'City': 'Mumbai',
      },
      {
        'Student Name': 'Isha Verma',
        'Email': 'student002@example.com',
        'Mobile Number': '1-202-555-1001',
        'City': 'Delhi',
      },
    ],
    suggested_mapping: {
      'Student Name': 'name',
      'Email': 'email',
      'Mobile Number': 'phone',
      'City': 'city',
    },
    supported_crm_fields: [
      { key: 'name', label: 'Lead Name', required: true },
      { key: 'email', label: 'Email', required: true },
      { key: 'phone', label: 'Mobile Phone', required: true },
      { key: 'city', label: 'City / Location', required: false },
    ],
  };

  const mockValidateResponse: ImportValidateResponse = {
    file_token: 'token_excel_test_123',
    file_name: 'students_import_template.xlsx',
    total_rows: 2,
    valid_count: 2,
    invalid_count: 0,
    duplicate_count: 0,
    stage: { id: 1, name: 'Cold Calling' },
    assignment_mode: 'SELECTED',
    selected_employee_count: 2,
    distribution: [
      { employee_id: 3, employee_name: 'counsellor1', username: 'counsellor1', team_id: 1, team_name: 'Admissions', count: 1 },
      { employee_id: 4, employee_name: 'counsellor2', username: 'counsellor2', team_id: 1, team_name: 'Admissions', count: 1 },
    ],
    missing_mandatory: [],
    row_validations: [
      {
        row_number: 2,
        is_valid: true,
        is_duplicate: false,
        lead_name: 'Aarav Patel',
        email: 'student001@example.com',
        phone: '1-202-555-1000',
        errors: [],
        data: { name: 'Aarav Patel', email: 'student001@example.com', phone: '1-202-555-1000' },
      },
      {
        row_number: 3,
        is_valid: true,
        is_duplicate: false,
        lead_name: 'Isha Verma',
        email: 'student002@example.com',
        phone: '1-202-555-1001',
        errors: [],
        data: { name: 'Isha Verma', email: 'student002@example.com', phone: '1-202-555-1001' },
      },
    ],
    total_validation_rows: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'getUsers').mockResolvedValue(sampleCounsellors);
    vi.spyOn(api, 'importPreview').mockResolvedValue(excelPreviewResponse);
    vi.spyOn(api, 'importValidate').mockResolvedValue(mockValidateResponse);
  });

  const uploadTestFile = async (container: HTMLElement) => {
    const file = new File(['dummycontent'], 'students_import_template.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    await screen.findByText('Column Mapping');
  };

  it('1. Recognizes all three required mappings from supplied Excel format and displays 3 / 3 Required Fields Mapped with Validate button enabled', async () => {
    const { container } = render(
      <BulkImportPage
        currentUser={adminUser}
        stages={sampleStages}
        teams={sampleTeams}
        users={sampleCounsellors}
        onNavigateToPipeline={vi.fn()}
      />
    );

    await uploadTestFile(container);

    // Verify counter shows 3 / 3 Required Fields Mapped (NOT 2 / 3!)
    const badge = document.getElementById('required-fields-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('3 / 3 Required Fields Mapped');

    // Verify Validate & Preview Rows button is enabled
    const validateBtn = document.getElementById('validate-preview-rows-btn') as HTMLButtonElement;
    expect(validateBtn).toBeInTheDocument();
    expect(validateBtn).not.toBeDisabled();
  });

  it('2. Shows 2 / 3 Required Fields Mapped and disables Validate button when Email is unmapped', async () => {
    const { container } = render(
      <BulkImportPage
        currentUser={adminUser}
        stages={sampleStages}
        teams={sampleTeams}
        users={sampleCounsellors}
        onNavigateToPipeline={vi.fn()}
      />
    );

    await uploadTestFile(container);

    // Change Email dropdown to Skip/empty
    const emailSelect = screen.getByLabelText('Mapping for Email') as HTMLSelectElement;
    fireEvent.change(emailSelect, { target: { value: '' } });

    // Counter updates reactively to 2 / 3
    const badge = document.getElementById('required-fields-badge');
    expect(badge).toHaveTextContent('2 / 3 Required Fields Mapped');

    // Button is disabled
    const validateBtn = document.getElementById('validate-preview-rows-btn') as HTMLButtonElement;
    expect(validateBtn).toBeDisabled();
  });

  it('3. Shows 2 / 3 Required Fields Mapped and disables Validate button when Mobile Phone is unmapped', async () => {
    const { container } = render(
      <BulkImportPage
        currentUser={adminUser}
        stages={sampleStages}
        teams={sampleTeams}
        users={sampleCounsellors}
        onNavigateToPipeline={vi.fn()}
      />
    );

    await uploadTestFile(container);

    // Change Mobile Number dropdown to Skip/empty
    const phoneSelect = screen.getByLabelText('Mapping for Mobile Number') as HTMLSelectElement;
    fireEvent.change(phoneSelect, { target: { value: '' } });

    const badge = document.getElementById('required-fields-badge');
    expect(badge).toHaveTextContent('2 / 3 Required Fields Mapped');

    const validateBtn = document.getElementById('validate-preview-rows-btn') as HTMLButtonElement;
    expect(validateBtn).toBeDisabled();
  });

  it('4. Shows 2 / 3 Required Fields Mapped and disables Validate button when Lead Name is unmapped', async () => {
    const { container } = render(
      <BulkImportPage
        currentUser={adminUser}
        stages={sampleStages}
        teams={sampleTeams}
        users={sampleCounsellors}
        onNavigateToPipeline={vi.fn()}
      />
    );

    await uploadTestFile(container);

    // Change Student Name dropdown to Skip/empty
    const nameSelect = screen.getByLabelText('Mapping for Student Name') as HTMLSelectElement;
    fireEvent.change(nameSelect, { target: { value: '' } });

    const badge = document.getElementById('required-fields-badge');
    expect(badge).toHaveTextContent('2 / 3 Required Fields Mapped');

    const validateBtn = document.getElementById('validate-preview-rows-btn') as HTMLButtonElement;
    expect(validateBtn).toBeDisabled();
  });

  it('5. Immediate reactive recalculation: changing dropdown updates counter and restores enabled state immediately', async () => {
    const { container } = render(
      <BulkImportPage
        currentUser={adminUser}
        stages={sampleStages}
        teams={sampleTeams}
        users={sampleCounsellors}
        onNavigateToPipeline={vi.fn()}
      />
    );

    await uploadTestFile(container);
    const badge = document.getElementById('required-fields-badge');
    const validateBtn = document.getElementById('validate-preview-rows-btn') as HTMLButtonElement;
    const nameSelect = screen.getByLabelText('Mapping for Student Name') as HTMLSelectElement;

    // Clear name -> 2/3 and disabled
    fireEvent.change(nameSelect, { target: { value: '' } });
    expect(badge).toHaveTextContent('2 / 3 Required Fields Mapped');
    expect(validateBtn).toBeDisabled();

    // Map name back to Lead Name -> 3/3 and enabled immediately
    fireEvent.change(nameSelect, { target: { value: 'name' } });
    expect(badge).toHaveTextContent('3 / 3 Required Fields Mapped');
    expect(validateBtn).not.toBeDisabled();
  });

  it('6. Handles duplicate mapping of a required field: disables button and displays warning alert', async () => {
    const { container } = render(
      <BulkImportPage
        currentUser={adminUser}
        stages={sampleStages}
        teams={sampleTeams}
        users={sampleCounsellors}
        onNavigateToPipeline={vi.fn()}
      />
    );

    await uploadTestFile(container);

    // Map 'City' column to 'phone' as well (causing Mobile Phone to be mapped twice!)
    const citySelect = screen.getByLabelText('Mapping for City') as HTMLSelectElement;
    fireEvent.change(citySelect, { target: { value: 'phone' } });

    // Validate button is disabled due to duplicate conflict
    const validateBtn = document.getElementById('validate-preview-rows-btn') as HTMLButtonElement;
    expect(validateBtn).toBeDisabled();

    // Warning alert is displayed
    const alertBanner = document.getElementById('duplicate-mapping-alert');
    expect(alertBanner).toBeInTheDocument();
    expect(alertBanner).toHaveTextContent(/Duplicate column mapping detected/i);
    expect(alertBanner).toHaveTextContent(/Mobile Phone/i);

    // Resolving duplicate by setting City back to 'city' restores 3/3 and enabled state
    fireEvent.change(citySelect, { target: { value: 'city' } });
    expect(document.getElementById('duplicate-mapping-alert')).not.toBeInTheDocument();
    expect(validateBtn).not.toBeDisabled();
    expect(document.getElementById('required-fields-badge')).toHaveTextContent('3 / 3 Required Fields Mapped');
  });

  it('7. Clicking Validate & Preview Rows sends canonical field identifiers and displays preview table without Missing labels', async () => {
    const { container } = render(
      <BulkImportPage
        currentUser={adminUser}
        stages={sampleStages}
        teams={sampleTeams}
        users={sampleCounsellors}
        onNavigateToPipeline={vi.fn()}
      />
    );

    await uploadTestFile(container);

    // Select "Import as Unassigned Leads" so employee assignment check passes
    const unassignedCheckbox = document.getElementById('import-unassigned-checkbox') as HTMLInputElement;
    fireEvent.click(unassignedCheckbox);

    // Click Validate & Preview Rows button
    const validateBtn = document.getElementById('validate-preview-rows-btn') as HTMLButtonElement;
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(api.importValidate).toHaveBeenCalledWith(
        expect.objectContaining({
          column_mapping: {
            'Student Name': 'name',
            'Email': 'email',
            'Mobile Number': 'phone',
            'City': 'city',
          },
        })
      );
    });

    // Preview table displays Lead Name, Email, and Phone accurately
    expect(await screen.findByText('Validation Results & Data Preview')).toBeInTheDocument();
    expect(screen.getAllByText('Aarav Patel').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('student001@example.com').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('1-202-555-1000').length).toBeGreaterThanOrEqual(2);

    const tables = document.querySelectorAll('table');
    const previewTable = tables[tables.length - 1];
    expect(within(previewTable).queryByText('Missing')).not.toBeInTheDocument();
  });
});
