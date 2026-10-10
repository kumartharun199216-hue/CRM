import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';
import { SpreadsheetView } from '../components/SpreadsheetView';
import { KanbanView } from '../components/KanbanView';
import { RoleDashboard } from '../components/RoleDashboard';
import { UnassignedLeadsView } from '../components/UnassignedLeadsView';
import { AssignLeadModal } from '../components/AssignLeadModal';
import { App } from '../App';
import { api } from '../services/api';
import { User, Lead, PipelineStage, Team } from '../types';

describe('Skill Move CRM Frontend Components', () => {
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
    team: 1,
    team_name: 'Skill Move Admissions',
    managed_team_id: 1,
    managed_team_name: 'Skill Move Admissions',
  };

  const counsellorUser: User = {
    id: 3,
    username: 'counsellor@skillmove.com',
    email: 'counsellor@skillmove.com',
    role: 'SALES_EMPLOYEE',
    team: 1,
    team_name: 'Skill Move Admissions',
  };

  const sample12Stages: PipelineStage[] = [
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

  const sampleStageCounts: Record<number, number> = {
    1: 24,
    2: 11,
    3: 38,
    4: 17,
    5: 12,
    6: 9,
    7: 6,
    8: 4,
    9: 3,
    10: 15,
    11: 8,
    12: 0, // zero-count stage
  };

  const sampleLeads: Lead[] = [
    {
      id: 101,
      lead_id: 'SM-LD-0001',
      name: 'Alex Johnson',
      title: 'Alex Johnson',
      contact_name: 'Alex Johnson',
      email: 'alex@skillmove.edu',
      phone: '+1234567890',
      qualification: 'B.Tech Computer Science',
      college: 'State University',
      yop: '2025',
      key_skills: 'Python, React, TypeScript',
      target_role: 'Software Engineer',
      experience: 'Fresher',
      company: '',
      team: 1,
      team_name: 'Skill Move Admissions',
      assigned_employee: 3,
      assigned_employee_name: 'counsellor@skillmove.com',
      stage: 1,
      stage_name: 'Cold Calling',
      priority: 'High',
      status: 'Active',
      estimated_revenue: 15000,
      placement_fee: 1500,
      career_counsellor: 'Dr. Sarah',
      city: 'Bangalore',
      next_follow_up: new Date().toISOString(),
      created_by: 2,
      created_by_name: 'manager@skillmove.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null,
    },
  ];

  it('renders Admin sidebar with Skill Move branding, Dashboard, Reports and Configure Stages without Spreadsheet/Kanban/Lead Management menu items', () => {
    render(
      <Sidebar
        user={adminUser}
        activeView="spreadsheet"
        onViewChange={vi.fn()}
        stages={sample12Stages}
        stageCounts={sampleStageCounts}
        onOpenCreateLead={vi.fn()}
        onOpenReports={vi.fn()}
        onOpenTemplates={vi.fn()}
        onOpenStages={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Skill Move')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Scheduled Reports')).toBeInTheDocument();
    expect(screen.getByText('Configure Stages')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Stages (12)')).toBeInTheDocument();

    // Spreadsheet View, Kanban Pipeline, and New Lead / Templates must NOT be in the sidebar menu
    expect(screen.queryByRole('button', { name: /^Spreadsheet View$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Kanban Pipeline$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new lead$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /templates$/i })).not.toBeInTheDocument();
  });

  it('renders Manager sidebar with Skill Move branding and Dashboard without Admin permissions or removed menu items', () => {
    render(
      <Sidebar
        user={managerUser}
        activeView="spreadsheet"
        onViewChange={vi.fn()}
        stages={sample12Stages}
        stageCounts={sampleStageCounts}
        onOpenCreateLead={vi.fn()}
        onOpenReports={vi.fn()}
        onOpenTemplates={vi.fn()}
        onOpenStages={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Skill Move')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('Manager Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Stages (12)')).toBeInTheDocument();

    // Manager does not have admin permissions or removed menu buttons
    expect(screen.queryByRole('button', { name: /^Spreadsheet View$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Kanban Pipeline$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new lead$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /templates$/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Scheduled Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Configure Stages')).not.toBeInTheDocument();
  });

  it('renders Counsellor sidebar without New Lead or Admin permissions', () => {
    render(
      <Sidebar
        user={counsellorUser}
        activeView="spreadsheet"
        onViewChange={vi.fn()}
        stages={sample12Stages}
        stageCounts={sampleStageCounts}
        onOpenCreateLead={vi.fn()}
        onOpenReports={vi.fn()}
        onOpenTemplates={vi.fn()}
        onOpenStages={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Skill Move')).toBeInTheDocument();
    expect(screen.getByText('Counsellor')).toBeInTheDocument();
    expect(screen.getByText('My Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Stages (12)')).toBeInTheDocument();

    // Counsellor cannot access admin tools or removed menu items
    expect(screen.queryByRole('button', { name: /^Spreadsheet View$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Kanban Pipeline$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new lead$/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Scheduled Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Configure Stages')).not.toBeInTheDocument();
  });

  it('expands pipeline submenu when clicked and displays all 12 stages in configured order with lead counts', () => {
    render(
      <Sidebar
        user={adminUser}
        activeView="spreadsheet"
        onViewChange={vi.fn()}
        stages={sample12Stages}
        stageCounts={sampleStageCounts}
        onOpenCreateLead={vi.fn()}
        onOpenReports={vi.fn()}
        onOpenTemplates={vi.fn()}
        onOpenStages={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const pipelineButton = screen.getByRole('button', { name: /Pipeline Stages \(12\)/i });
    expect(pipelineButton).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    fireEvent.click(pipelineButton);
    expect(pipelineButton).toHaveAttribute('aria-expanded', 'true');

    const submenu = screen.getByRole('region', { name: /pipeline stages/i });

    // Verify all 12 stages appear in the submenu
    const expectedStages = [
      'Cold Calling',
      'Not Connected',
      'New Lead',
      'Contacted',
      'Interested',
      'Prospect',
      'FollowUp',
      'Negotation',
      'pendingClosure',
      'Enrolled',
      'Not Interested',
      'Lost',
    ];

    expectedStages.forEach((stageName) => {
      expect(within(submenu).getByText(stageName)).toBeInTheDocument();
    });

    // Verify lead counts are rendered beside stage names
    expect(within(submenu).getByText('24')).toBeInTheDocument(); // Cold Calling count
    expect(within(submenu).getByText('11')).toBeInTheDocument(); // Not Connected count
    expect(within(submenu).getByText('38')).toBeInTheDocument(); // New Lead count
    expect(within(submenu).getByText('0')).toBeInTheDocument();  // Lost (zero count)
    expect(within(submenu).getByText('All Pipeline Stages')).toBeInTheDocument();
    expect(within(submenu).getByText('147')).toBeInTheDocument(); // Total sum of stage counts
  });

  it('collapses pipeline submenu when clicked again', () => {
    render(
      <Sidebar
        user={counsellorUser}
        activeView="spreadsheet"
        onViewChange={vi.fn()}
        stages={sample12Stages}
        stageCounts={sampleStageCounts}
        onOpenCreateLead={vi.fn()}
        onOpenReports={vi.fn()}
        onOpenTemplates={vi.fn()}
        onOpenStages={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const pipelineButton = screen.getByRole('button', { name: /Pipeline Stages \(12\)/i });

    // Expand
    fireEvent.click(pipelineButton);
    expect(pipelineButton).toHaveAttribute('aria-expanded', 'true');

    // Collapse again
    fireEvent.click(pipelineButton);
    expect(pipelineButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders Spreadsheet table with TanStack Table and lead records', () => {
    const onOpen360 = vi.fn();
    const onAssignLead = vi.fn();

    render(
      <SpreadsheetView
        leads={sampleLeads}
        stages={sample12Stages}
        users={[adminUser, managerUser, counsellorUser]}
        currentUser={adminUser}
        onOpenLead={vi.fn()}
        onOpen360={onOpen360}
        onOpenHistory={vi.fn()}
        onCommunicate={vi.fn()}
        onAssignLead={onAssignLead}
      />
    );

    expect(screen.getByText('SM-LD-0001')).toBeInTheDocument();
    expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
    expect(screen.getByText('B.Tech Computer Science')).toBeInTheDocument();
    expect(screen.getByText('State University')).toBeInTheDocument();
    expect(screen.getByText('Cold Calling')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('All Leads (1)')).toBeInTheDocument();

    // Verify Lead 360 view button exists and is clickable
    const btn360 = screen.getByRole('button', { name: /360°/i });
    expect(btn360).toBeInTheDocument();
    fireEvent.click(btn360);
    expect(onOpen360).toHaveBeenCalledWith(sampleLeads[0]);

    // Verify Quick Connect buttons exist in the fixed column
    expect(screen.getByTitle(/Initiate Call \(Callyzer\)/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Send WhatsApp Message/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Send Email \(Google SMTP\)/i)).toBeInTheDocument();
  });

  it('renders RoleDashboard with responsive role-tailored metrics', () => {
    // 1. Admin Dashboard
    const { unmount: unmountAdmin } = render(
      <RoleDashboard
        currentUser={adminUser}
        leads={sampleLeads}
        stages={sample12Stages}
        teams={[{ id: 1, name: 'Skill Move Admissions', members_count: 2, created_at: '', updated_at: '' }]}
        users={[adminUser, managerUser, counsellorUser]}
        onSelectStage={vi.fn()}
        onOpenLead={vi.fn()}
        onOpen360={vi.fn()}
        onCommunicate={vi.fn()}
        onViewAllLeads={vi.fn()}
      />
    );

    expect(screen.getByText(/Executive Admin Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Student Leads/i)).toBeInTheDocument();
    expect(screen.getByText(/12-Stage Admissions Pipeline Funnel/i)).toBeInTheDocument();
    unmountAdmin();

    // 2. Manager Dashboard
    const { unmount: unmountManager } = render(
      <RoleDashboard
        currentUser={managerUser}
        leads={sampleLeads}
        stages={sample12Stages}
        teams={[{ id: 1, name: 'Skill Move Admissions', members_count: 2, created_at: '', updated_at: '' }]}
        users={[adminUser, managerUser, counsellorUser]}
        onSelectStage={vi.fn()}
        onOpenLead={vi.fn()}
        onOpen360={vi.fn()}
        onCommunicate={vi.fn()}
        onViewAllLeads={vi.fn()}
      />
    );

    expect(screen.getByText(/Admissions Manager Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Team Student Leads/i)).toBeInTheDocument();
    expect(screen.getByText(/My Team Counsellors Performance/i)).toBeInTheDocument();
    unmountManager();

    // 3. Counsellor Dashboard
    render(
      <RoleDashboard
        currentUser={counsellorUser}
        leads={sampleLeads}
        stages={sample12Stages}
        teams={[{ id: 1, name: 'Skill Move Admissions', members_count: 2, created_at: '', updated_at: '' }]}
        users={[adminUser, managerUser, counsellorUser]}
        onSelectStage={vi.fn()}
        onOpenLead={vi.fn()}
        onOpen360={vi.fn()}
        onCommunicate={vi.fn()}
        onViewAllLeads={vi.fn()}
      />
    );

    expect(screen.getByText(/Career Counsellor Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/My Assigned Students/i)).toBeInTheDocument();
  });

  it('renders horizontal top menu with Templates, New Lead, and Pipeline Stages Spreadsheet/Kanban switcher in App', async () => {
    localStorage.setItem('crm_token', 'test-admin-token');
    vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);
    vi.spyOn(api, 'getLeads').mockResolvedValue(sampleLeads);
    vi.spyOn(api, 'getStages').mockResolvedValue(sample12Stages);
    vi.spyOn(api, 'getStageCounts').mockResolvedValue(sampleStageCounts);
    vi.spyOn(api, 'getTeams').mockResolvedValue([]);
    vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, counsellorUser]);

    render(<App />);

    // Wait for Dashboard to render
    expect(await screen.findByText('Executive Admin Dashboard')).toBeInTheDocument();

    // Verify right side horizontal menu contains Templates, New Lead, and Refresh
    const templatesBtn = screen.getByRole('button', { name: /templates/i });
    const newLeadBtn = screen.getByTitle('Add New Student Lead');
    const refreshBtn = screen.getByRole('button', { name: /refresh/i });

    expect(templatesBtn).toBeInTheDocument();
    expect(newLeadBtn).toBeInTheDocument();
    expect(refreshBtn).toBeInTheDocument();

    // In Dashboard, the spreadsheet/kanban view toggle is not in the header
    expect(screen.queryByRole('button', { name: /^spreadsheet view$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^kanban pipeline$/i })).not.toBeInTheDocument();

    // Expand Pipeline in the sidebar and click All Pipeline Stages
    const pipelineTrigger = screen.getByRole('button', { name: /pipeline stages \(12\)/i });
    fireEvent.click(pipelineTrigger);

    const allStagesBtn = screen.getByRole('button', { name: /all pipeline stages/i });
    fireEvent.click(allStagesBtn);

    // Now in the pipeline stages main area, the view switcher appears
    const spreadsheetToggle = await screen.findByRole('button', { name: /^spreadsheet view$/i });
    const kanbanToggle = screen.getByRole('button', { name: /^kanban pipeline$/i });
    expect(spreadsheetToggle).toBeInTheDocument();
    expect(kanbanToggle).toBeInTheDocument();

    // Toggle to Kanban Pipeline
    fireEvent.click(kanbanToggle);
    expect(screen.getAllByText('Cold Calling').length).toBeGreaterThanOrEqual(2);

    // Toggle back to Spreadsheet View
    fireEvent.click(spreadsheetToggle);
    expect(screen.getByText('SM-LD-0001')).toBeInTheDocument();
  });

  const sampleUnassignedLead: Lead = {
    id: 102,
    lead_id: 'SM-LD-0017',
    name: 'Rohit Sharma',
    title: 'Rohit Sharma',
    contact_name: 'Rohit Sharma',
    email: 'rohit@skillmove.edu',
    phone: '+919876543210',
    qualification: 'B.Tech IT',
    college: 'IIT Madras',
    yop: '2024',
    key_skills: 'Python, Django, React',
    target_role: 'Full Stack Developer',
    experience: 'Fresher',
    company: '',
    team: 1,
    team_name: 'Skill Move Admissions',
    assigned_employee: null,
    assigned_employee_name: null,
    stage: 3,
    stage_name: 'New Lead',
    priority: 'High',
    status: 'Active',
    estimated_revenue: 25000,
    placement_fee: 2500,
    career_counsellor: '',
    city: 'Chennai',
    next_follow_up: new Date().toISOString(),
    created_by: 2,
    created_by_name: 'manager@skillmove.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
  };

  it('renders Unassigned Leads item with live database count badge for Admin and Manager, but hides it from Counsellor', () => {
    // 1. Admin test
    const { unmount: unmountAdmin } = render(
      <Sidebar
        user={adminUser}
        activeView="dashboard"
        onViewChange={vi.fn()}
        unassignedCount={4}
        stages={sample12Stages}
        onOpenReports={vi.fn()}
        onOpenStages={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.getByText('Unassigned Leads')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    unmountAdmin();

    // 2. Manager test
    const { unmount: unmountManager } = render(
      <Sidebar
        user={managerUser}
        activeView="dashboard"
        onViewChange={vi.fn()}
        unassignedCount={2}
        stages={sample12Stages}
        onOpenReports={vi.fn()}
        onOpenStages={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.getByText('Unassigned Leads')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    unmountManager();

    // 3. Counsellor / Sales Employee test
    render(
      <Sidebar
        user={counsellorUser}
        activeView="dashboard"
        onViewChange={vi.fn()}
        unassignedCount={0}
        stages={sample12Stages}
        onOpenReports={vi.fn()}
        onOpenStages={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.queryByText('Unassigned Leads')).not.toBeInTheDocument();
  });

  it('navigates to unassigned view when Admin clicks Unassigned Leads sidebar item', () => {
    const handleViewChange = vi.fn();
    render(
      <Sidebar
        user={adminUser}
        activeView="dashboard"
        onViewChange={handleViewChange}
        unassignedCount={4}
        stages={sample12Stages}
        onOpenReports={vi.fn()}
        onOpenStages={vi.fn()}
        onLogout={vi.fn()}
      />
    );

    const unassignedBtn = screen.getByRole('button', { name: /unassigned leads/i });
    fireEvent.click(unassignedBtn);
    expect(handleViewChange).toHaveBeenCalledWith('unassigned');
  });

  it('renders UnassignedLeadsView with all student fields, graceful empty indicators, and Assign action', () => {
    const handleAssign = vi.fn();
    const handle360 = vi.fn();
    const handleComm = vi.fn();

    render(
      <UnassignedLeadsView
        leads={[sampleUnassignedLead]}
        stages={sample12Stages}
        teams={[{ id: 1, name: 'Skill Move Admissions', members_count: 2, created_at: '', updated_at: '' }]}
        currentUser={adminUser}
        onRefresh={vi.fn()}
        onAssignLead={handleAssign}
        onOpen360={handle360}
        onCommunicate={handleComm}
      />
    );

    // Verify fields
    expect(screen.getByText('SM-LD-0017')).toBeInTheDocument();
    expect(screen.getByText('Rohit Sharma')).toBeInTheDocument();
    expect(screen.getByText('rohit@skillmove.edu')).toBeInTheDocument();
    expect(screen.getByText('+919876543210')).toBeInTheDocument();
    expect(screen.getByText('B.Tech IT')).toBeInTheDocument();
    expect(screen.getByText('IIT Madras')).toBeInTheDocument();
    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getByText('Python, Django, React')).toBeInTheDocument();
    expect(screen.getByText('Full Stack Developer')).toBeInTheDocument();
    expect(screen.getByText('Fresher')).toBeInTheDocument();
    expect(screen.getAllByText('New Lead').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Chennai')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();

    // Verify Assign button exists and triggers callback
    const assignBtn = screen.getByRole('button', { name: /assign/i });
    expect(assignBtn).toBeInTheDocument();
    fireEvent.click(assignBtn);
    expect(handleAssign).toHaveBeenCalledWith(sampleUnassignedLead);
  });

  it('renders AssignLeadModal with Manager self-assignment option and two-step confirmation before saving', async () => {
    const handleAssignSuccess = vi.fn();
    vi.spyOn(api, 'assignLead').mockResolvedValue({
      ...sampleUnassignedLead,
      assigned_employee: managerUser.id,
      assigned_employee_name: managerUser.username,
    });

    render(
      <AssignLeadModal
        lead={sampleUnassignedLead}
        isOpen={true}
        users={[adminUser, managerUser, counsellorUser]}
        teams={[{ id: 1, name: 'Skill Move Admissions', members_count: 2, created_at: '', updated_at: '' }]}
        currentUser={managerUser}
        onClose={vi.fn()}
        onAssignSuccess={handleAssignSuccess}
      />
    );

    // Identifying details
    expect(screen.getByText(/Assign Lead: SM-LD-0017/i)).toBeInTheDocument();
    expect(screen.getByText('Rohit Sharma')).toBeInTheDocument();
    expect(screen.getByText('IIT Madras')).toBeInTheDocument();

    // Manager sees self-assignment option
    const selectElem = screen.getByRole('combobox');
    expect(selectElem).toBeInTheDocument();

    // Select self-assignment (Manager)
    fireEvent.change(selectElem, { target: { value: managerUser.id.toString() } });

    // Step 1: Click Review & Confirm
    const reviewBtn = screen.getByRole('button', { name: /review & confirm/i });
    fireEvent.click(reviewBtn);

    // Step 2: Confirmation banner appears
    expect(screen.getByText(/Confirm Lead Assignment/i)).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to assign student lead/i)).toBeInTheDocument();

    // Confirm & Assign
    const confirmBtn = screen.getByRole('button', { name: /confirm & assign/i });
    fireEvent.click(confirmBtn);

    await vi.waitFor(() => {
      expect(api.assignLead).toHaveBeenCalledWith(102, { employee_id: managerUser.id, team_id: 1 });
      expect(handleAssignSuccess).toHaveBeenCalled();
    });
  });

  it('handles 409 Conflict error in AssignLeadModal when lead was already assigned concurrently', async () => {
    vi.spyOn(api, 'assignLead').mockRejectedValue(new Error('This lead has already been assigned by another user.'));

    render(
      <AssignLeadModal
        lead={sampleUnassignedLead}
        isOpen={true}
        users={[adminUser, managerUser, counsellorUser]}
        teams={[{ id: 1, name: 'Skill Move Admissions', members_count: 2, created_at: '', updated_at: '' }]}
        currentUser={adminUser}
        onClose={vi.fn()}
        onAssignSuccess={vi.fn()}
      />
    );

    // Select assignee
    const selectElem = screen.getByRole('combobox', { name: /select assignee/i });
    fireEvent.change(selectElem, { target: { value: counsellorUser.id.toString() } });

    // Review & Confirm
    fireEvent.click(screen.getByRole('button', { name: /review & confirm/i }));

    // Confirm & Assign
    fireEvent.click(screen.getByRole('button', { name: /confirm & assign/i }));

    // Error is displayed clearly
    expect(await screen.findByText('Assignment Error')).toBeInTheDocument();
    expect(screen.getByText(/This lead has already been assigned by another user/i)).toBeInTheDocument();
  });
});

