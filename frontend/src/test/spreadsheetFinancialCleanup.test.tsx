import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SpreadsheetView } from '../components/SpreadsheetView';
import { LeadModal } from '../components/LeadModal';
import { User, Lead, PipelineStage, Team } from '../types';

describe('Spreadsheet View UI Improvements and Financial Cleanup', () => {
  const adminUser: User = {
    id: 1,
    username: 'admin_user',
    email: 'admin@skillmove.com',
    role: 'ADMIN',
  };

  const managerUser: User = {
    id: 2,
    username: 'manager_user',
    email: 'manager@skillmove.com',
    role: 'MANAGER',
    team: 1,
    team_name: 'Admissions Team Alpha',
    managed_team_id: 1,
  };

  const counsellorA: User = {
    id: 3,
    username: 'counsellor_a',
    email: 'counsellor.a@skillmove.com',
    role: 'SALES_EMPLOYEE',
    team: 1,
    team_name: 'Admissions Team Alpha',
  };

  const counsellorB: User = {
    id: 4,
    username: 'counsellor_b',
    email: 'counsellor.b@skillmove.com',
    role: 'SALES_EMPLOYEE',
    team: 1,
    team_name: 'Admissions Team Alpha',
  };

  const sampleTeam: Team = {
    id: 1,
    name: 'Admissions Team Alpha',
    members_count: 5,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  };

  const sampleStages: PipelineStage[] = [
    { id: 1, name: 'Cold Calling', order: 1, is_active: true },
    { id: 2, name: 'Not Connected', order: 2, is_active: true },
    { id: 3, name: 'New Lead', order: 3, is_active: true },
    { id: 4, name: 'Contacted', order: 4, is_active: true },
    { id: 5, name: 'Interested', order: 5, is_active: true },
    { id: 6, name: 'Prospect', order: 6, is_active: true },
    { id: 7, name: 'FollowUp', order: 7, is_active: true },
    { id: 8, name: 'Negotation', order: 8, is_active: true },
    { id: 9, name: 'Pending Closure', order: 9, is_active: true },
    { id: 10, name: 'Enrolled', order: 10, is_active: true },
    { id: 11, name: 'Not Interested', order: 11, is_active: true },
    { id: 12, name: 'Lost', order: 12, is_active: true },
  ];

  const standardLead: Lead = {
    id: 101,
    lead_id: 'SM-LD-0101',
    name: 'Priya Sharma',
    title: 'Priya Sharma',
    contact_name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+919876543210',
    qualification: 'B.Tech IT',
    college: 'Delhi Technical University',
    yop: '2025',
    key_skills: 'Python, React, SQL',
    target_role: 'Full Stack Developer',
    experience: 'Fresher',
    company: '',
    priority: 'High',
    status: 'Active',
    estimated_revenue: '45000.00',
    placement_fee: '15000.00',
    career_counsellor: 'counsellor_a',
    city: 'New Delhi',
    next_follow_up: null,
    team: 1,
    team_name: 'Admissions Team Alpha',
    assigned_employee: 3,
    assigned_employee_name: 'counsellor_a',
    created_by: 1,
    created_by_name: 'admin',
    stage: 4,
    stage_name: 'Contacted',
    archived_at: null,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
  };

  const pendingClosureLead: Lead = {
    id: 102,
    lead_id: 'SM-LD-0102',
    name: 'Rahul Varma',
    title: 'Rahul Varma',
    contact_name: 'Rahul Varma',
    email: 'rahul.varma@example.com',
    phone: '+919876543211',
    qualification: 'MCA',
    college: 'Pune Institute of Tech',
    yop: '2024',
    key_skills: 'Java, Spring, AWS',
    target_role: 'Backend Engineer',
    experience: '1 Year',
    company: '',
    priority: 'Urgent',
    status: 'In Progress',
    estimated_revenue: '60000.00',
    placement_fee: '20000.00',
    career_counsellor: 'counsellor_b',
    city: 'Pune',
    next_follow_up: null,
    team: 1,
    team_name: 'Admissions Team Alpha',
    assigned_employee: 4,
    assigned_employee_name: 'counsellor_b',
    created_by: 1,
    created_by_name: 'admin',
    stage: 9,
    stage_name: 'Pending Closure',
    archived_at: null,
    pending_closure_financial: {
      agreed_amount: '60000.00',
      amount_paid: '30000.00',
      outstanding_balance: '30000.00',
      updated_at: '2026-10-02T12:00:00Z',
    },
    created_at: '2026-10-02T10:00:00Z',
    updated_at: '2026-10-02T12:00:00Z',
  };

  // 1. Standard spreadsheet columns do not display financial fields
  it('does NOT display financial fields in standard spreadsheet columns', () => {
    render(
      <SpreadsheetView
        leads={[standardLead, pendingClosureLead]}
        stages={sampleStages}
        users={[adminUser, managerUser, counsellorA, counsellorB]}
        currentUser={adminUser}
        onOpenLead={vi.fn()}
        onOpenHistory={vi.fn()}
        onCommunicate={vi.fn()}
      />
    );

    // Verify lead basic info is visible
    expect(screen.getByText('SM-LD-0101')).toBeInTheDocument();
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getByText('SM-LD-0102')).toBeInTheDocument();
    expect(screen.getByText('Rahul Varma')).toBeInTheDocument();

    // Verify financial column headers do NOT exist
    expect(screen.queryByText('Estimated Revenue')).not.toBeInTheDocument();
    expect(screen.queryByText('Placement Fee')).not.toBeInTheDocument();
    expect(screen.queryByText('Endowment Fee')).not.toBeInTheDocument();
    expect(screen.queryByText('Agreed Amount')).not.toBeInTheDocument();
    expect(screen.queryByText('Price')).not.toBeInTheDocument();
    expect(screen.queryByText('Amount Paid')).not.toBeInTheDocument();
    expect(screen.queryByText('Outstanding Balance')).not.toBeInTheDocument();

    // Verify Pending Closure lead displays the dedicated indicator badge pointing to Lead 360
    expect(screen.getByText('Financials')).toBeInTheDocument();
  });

  // 2. Normal lead creation does not require financial data
  it('allows creating a normal lead without requesting financial data in LeadModal', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <LeadModal
        lead={null}
        isOpen={true}
        teams={[sampleTeam]}
        users={[adminUser, managerUser, counsellorA, counsellorB]}
        stages={sampleStages}
        currentUser={adminUser}
        onClose={onClose}
        onSave={onSave}
      />
    );

    // Verify financial fields are NOT in the form
    expect(screen.queryByLabelText(/Estimated Revenue/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Placement Fee/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Endowment/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Agreed Amount/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Amount Paid/i)).not.toBeInTheDocument();

    // Fill mandatory normal fields
    fireEvent.change(screen.getByPlaceholderText(/Student Full Name/i), {
      target: { value: 'Aarav Patel' },
    });
    fireEvent.change(screen.getByPlaceholderText(/student@example.com/i), {
      target: { value: 'aarav.patel@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/\+91 98765 43210/i), {
      target: { value: '+919988776655' },
    });

    // Select assigned counsellor
    const employeeSelect = screen.getByDisplayValue('Select Sales Employee');
    fireEvent.change(employeeSelect, { target: { value: '3' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0];
    expect(payload.name).toBe('Aarav Patel');
    expect(payload.email).toBe('aarav.patel@example.com');
    expect(payload.phone).toBe('+919988776655');
    expect(payload.assigned_employee).toBe(3);
    // Verified: No financial requirement was requested or mandatory
    expect(payload.agreed_amount).toBeUndefined();
    expect(payload.amount_paid).toBeUndefined();
  });

  // 3. Normal lead editing does not request financial data and preserves existing fields
  it('allows editing normal lead fields without requesting financial inputs', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <LeadModal
        lead={standardLead}
        isOpen={true}
        teams={[sampleTeam]}
        users={[adminUser, managerUser, counsellorA, counsellorB]}
        stages={sampleStages}
        currentUser={counsellorA}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    // Verify financial input fields are NOT present
    expect(screen.queryByLabelText(/Estimated Revenue/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Placement Fee/i)).not.toBeInTheDocument();

    // Edit city
    const cityInput = screen.getByDisplayValue('New Delhi');
    fireEvent.change(cityInput, { target: { value: 'Noida' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    const payload = onSave.mock.calls[0][0];
    expect(payload.city).toBe('Noida');
    // Preserves existing lead financial amounts on server without wiping or asking
    expect(payload.estimated_revenue).toBe(standardLead.estimated_revenue);
    expect(payload.placement_fee).toBe(standardLead.placement_fee);
  });

  // 4. Search and filtering work together and reset page index
  it('filters leads by search query and resets page', () => {
    const onSearchChange = vi.fn();
    render(
      <SpreadsheetView
        leads={[standardLead, pendingClosureLead]}
        stages={sampleStages}
        users={[adminUser, managerUser, counsellorA, counsellorB]}
        currentUser={adminUser}
        onOpenLead={vi.fn()}
        onOpenHistory={vi.fn()}
        onCommunicate={vi.fn()}
        onSearchChange={onSearchChange}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search leads by ID, name/i);
    fireEvent.change(searchInput, { target: { value: 'Rahul' } });

    expect(onSearchChange).toHaveBeenCalledWith('Rahul');
    expect(screen.getByText('Rahul Varma')).toBeInTheDocument();
    expect(screen.queryByText('Priya Sharma')).not.toBeInTheDocument();
  });

  // 5. Stage filter filters leads and resets page
  it('filters leads by selected pipeline stage', () => {
    render(
      <SpreadsheetView
        leads={[standardLead, pendingClosureLead]}
        stages={sampleStages}
        users={[adminUser, managerUser, counsellorA, counsellorB]}
        currentUser={adminUser}
        onOpenLead={vi.fn()}
        onOpenHistory={vi.fn()}
        onCommunicate={vi.fn()}
      />
    );

    const stageSelect = document.getElementById('spreadsheet-stage-filter') as HTMLSelectElement;
    expect(stageSelect).toBeInTheDocument();

    // Select Contacted stage (id: 4)
    fireEvent.change(stageSelect, { target: { value: '4' } });

    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.queryByText('Rahul Varma')).not.toBeInTheDocument();
  });

  // 6. Counsellor filter filters leads for Admin/Manager
  it('filters leads by assigned counsellor for Admin/Manager', () => {
    render(
      <SpreadsheetView
        leads={[standardLead, pendingClosureLead]}
        stages={sampleStages}
        users={[adminUser, managerUser, counsellorA, counsellorB]}
        currentUser={adminUser}
        onOpenLead={vi.fn()}
        onOpenHistory={vi.fn()}
        onCommunicate={vi.fn()}
      />
    );

    const counsellorSelect = document.getElementById('spreadsheet-counsellor-filter') as HTMLSelectElement;
    expect(counsellorSelect).toBeInTheDocument();

    // Filter by counsellor_b (id: 4)
    fireEvent.change(counsellorSelect, { target: { value: '4' } });

    expect(screen.getByText('Rahul Varma')).toBeInTheDocument();
    expect(screen.queryByText('Priya Sharma')).not.toBeInTheDocument();
  });

  // 7. Reset filters button clears all filters
  it('clears all active filters when Reset button is clicked', () => {
    render(
      <SpreadsheetView
        leads={[standardLead, pendingClosureLead]}
        stages={sampleStages}
        users={[adminUser, managerUser, counsellorA, counsellorB]}
        currentUser={adminUser}
        onOpenLead={vi.fn()}
        onOpenHistory={vi.fn()}
        onCommunicate={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search leads by ID, name/i);
    fireEvent.change(searchInput, { target: { value: 'Rahul' } });

    // Reset button appears
    const resetBtn = screen.getByTitle('Reset search and filters');
    expect(resetBtn).toBeInTheDocument();
    fireEvent.click(resetBtn);

    // Both leads now visible again
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getByText('Rahul Varma')).toBeInTheDocument();
  });

  // 8. Empty state renders when search yields no matches
  it('renders helpful empty state when no leads match search criteria', () => {
    render(
      <SpreadsheetView
        leads={[standardLead, pendingClosureLead]}
        stages={sampleStages}
        users={[adminUser, managerUser, counsellorA, counsellorB]}
        currentUser={adminUser}
        onOpenLead={vi.fn()}
        onOpenHistory={vi.fn()}
        onCommunicate={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search leads by ID, name/i);
    fireEvent.change(searchInput, { target: { value: 'Nonexistent Candidate' } });

    expect(screen.getByText('No lead records found')).toBeInTheDocument();
    expect(screen.getByText(/No leads match your active filters or search criteria/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset All Filters/i })).toBeInTheDocument();
  });

  // 9. Supported page size options: 10, 25, 50, 100 with default 50
  it('supports pagination page sizes 10, 25, 50, 100 with default 50', () => {
    render(
      <SpreadsheetView
        leads={[standardLead, pendingClosureLead]}
        stages={sampleStages}
        users={[adminUser, managerUser, counsellorA, counsellorB]}
        currentUser={adminUser}
        onOpenLead={vi.fn()}
        onOpenHistory={vi.fn()}
        onCommunicate={vi.fn()}
      />
    );

    const pageSizeSelect = document.getElementById('page-size-selector') as HTMLSelectElement;
    expect(pageSizeSelect).toBeInTheDocument();
    expect(pageSizeSelect.value).toBe('50');

    const options = Array.from(pageSizeSelect.options).map((o) => o.value);
    expect(options).toEqual(['10', '25', '50', '100']);
  });

  // 10. Role-based row actions
  it('displays role-authorized actions for assigned counsellor and disables for cross-team user', () => {
    const onChangeStage = vi.fn();
    const otherCounsellor: User = {
      id: 99,
      username: 'other_counsellor',
      email: 'other@skillmove.com',
      role: 'SALES_EMPLOYEE',
      team: 2,
    };

    // Render for counsellorA (assigned to standardLead)
    const { rerender } = render(
      <SpreadsheetView
        leads={[standardLead]}
        stages={sampleStages}
        users={[adminUser, managerUser, counsellorA]}
        currentUser={counsellorA}
        onOpenLead={vi.fn()}
        onOpenHistory={vi.fn()}
        onCommunicate={vi.fn()}
        onChangeStage={onChangeStage}
      />
    );

    expect(screen.getByTitle(/Change Pipeline Stage/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Edit Complete Lead Details/i)).toBeInTheDocument();

    // Rerender for cross-team otherCounsellor
    rerender(
      <SpreadsheetView
        leads={[standardLead]}
        stages={sampleStages}
        users={[adminUser, managerUser, counsellorA]}
        currentUser={otherCounsellor}
        onOpenLead={vi.fn()}
        onOpenHistory={vi.fn()}
        onCommunicate={vi.fn()}
        onChangeStage={onChangeStage}
      />
    );

    // Stage and Edit buttons are not permitted for unauthorized cross-team counsellor
    expect(screen.queryByTitle(/Change Pipeline Stage/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Edit Complete Lead Details/i)).not.toBeInTheDocument();
    // 360 and History remain accessible
    expect(screen.getByRole('button', { name: /360°/i })).toBeInTheDocument();
    expect(screen.getByTitle(/View Assignment & Stage History/i)).toBeInTheDocument();
  });
});
