import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Lead360Page } from '../components/Lead360Page';
import { api } from '../services/api';
import { User, Lead, PipelineStage, Team, PreCloserFinancial, LeadTimelineResponse } from '../types';

describe('Lead 360 Full-Page Workspace Component', () => {
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
    team_name: 'Admissions Alpha',
    managed_team_id: 1,
    managed_team_name: 'Admissions Alpha',
  };

  const counsellorUser: User = {
    id: 3,
    username: 'counsellor@skillmove.com',
    email: 'counsellor@skillmove.com',
    role: 'SALES_EMPLOYEE',
    team: 1,
    team_name: 'Admissions Alpha',
  };

  const teams: Team[] = [
    {
      id: 1,
      name: 'Admissions Alpha',
      members_count: 3,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  const users: User[] = [adminUser, managerUser, counsellorUser];

  const canonical12Stages: PipelineStage[] = [
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

  const mockLead: Lead = {
    id: 101,
    lead_id: 'SM-LD-0101',
    name: 'Rohit Verma',
    title: 'Rohit Verma',
    contact_name: 'Rohit Verma',
    email: 'rohit.verma@example.com',
    phone: '+919876543210',
    qualification: 'B.Tech CSE',
    college: 'IIT Roorkee',
    yop: '2024',
    key_skills: 'Python, React, PostgreSQL',
    target_role: 'Full Stack Engineer',
    experience: 'Fresher',
    company: 'Self-employed',
    stage: 4,
    stage_name: 'Contacted',
    priority: 'High',
    status: 'In Progress',
    estimated_revenue: '50000.00',
    placement_fee: '15000.00',
    career_counsellor: 'counsellor@skillmove.com',
    city: 'New Delhi',
    source: 'Website Form',
    next_follow_up: '2026-10-20T10:00:00Z',
    team: 1,
    team_name: 'Admissions Alpha',
    assigned_employee: 3,
    assigned_employee_name: 'counsellor@skillmove.com',
    created_by: 1,
    created_by_name: 'admin@skillmove.com',
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-05T14:30:00Z',
    archived_at: null,
  };

  const mockFinancial: PreCloserFinancial = {
    id: 50,
    lead: 101,
    agreed_amount: '75000.00',
    amount_paid: '25000.00',
    outstanding_balance: '50000.00',
    created_by: 1,
    created_by_name: 'admin@skillmove.com',
    created_at: '2026-10-06T10:00:00Z',
    updated_at: '2026-10-06T10:00:00Z',
  };

  const mockTimelineResponse: LeadTimelineResponse = {
    lead_id: 101,
    lead_code: 'SM-LD-0101',
    lead_name: 'Rohit Verma',
    current_stage_id: 4,
    current_stage_name: 'Contacted',
    count: 1,
    timeline: [
      {
        id: 'evt-1',
        event_type: 'LEAD_CREATED',
        title: 'Lead Created',
        description: 'Lead was registered in CRM',
        timestamp: '2026-10-01T09:00:00Z',
        actor_id: 1,
        actor_name: 'admin@skillmove.com',
        details: {},
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(api, 'getLead').mockResolvedValue(mockLead);
    vi.spyOn(api, 'getLeadTimeline').mockResolvedValue(mockTimelineResponse);
    vi.spyOn(api, 'getStageHistory').mockResolvedValue([
      {
        id: 1,
        lead: 101,
        from_stage: 1,
        from_stage_name: 'Cold Calling',
        to_stage: 4,
        to_stage_name: 'Contacted',
        changed_by: 1,
        changed_by_name: 'admin@skillmove.com',
        timestamp: '2026-10-02T10:00:00Z',
        note: 'Candidate responded to contact email',
      },
    ]);
    vi.spyOn(api, 'getAssignmentHistory').mockResolvedValue([
      {
        id: 1,
        lead: 101,
        from_team: null,
        from_team_name: null,
        to_team: 1,
        to_team_name: 'Admissions Alpha',
        from_employee: null,
        from_employee_name: null,
        to_employee: 3,
        to_employee_name: 'counsellor@skillmove.com',
        changed_by: 1,
        changed_by_name: 'admin@skillmove.com',
        timestamp: '2026-10-01T09:05:00Z',
      },
    ]);
    vi.spyOn(api, 'getCommunicationLogs').mockResolvedValue([
      {
        id: 1,
        lead: 101,
        lead_title: 'Rohit Verma',
        channel: 'EMAIL',
        recipient: 'rohit.verma@example.com',
        subject: 'Skill Move Curriculum Overview',
        content: 'Attached curriculum details',
        status: 'SUCCESS',
        initiated_by_name: 'counsellor@skillmove.com',
        created_at: '2026-10-03T11:00:00Z',
      },
      {
        id: 2,
        lead: 101,
        lead_title: 'Rohit Verma',
        channel: 'WHATSAPP',
        recipient: '+919876543210',
        content: 'Hi Rohit, thank you for your interest.',
        status: 'FAILED',
        error_message: 'Recipient phone number unreachable',
        initiated_by_name: 'counsellor@skillmove.com',
        created_at: '2026-10-04T12:00:00Z',
      },
    ]);
    vi.spyOn(api, 'getLeadFinancial').mockResolvedValue({
      financial: mockFinancial,
      history: [
        {
          id: 1,
          lead: 101,
          financial_record: 50,
          changed_by: 1,
          changed_by_name: 'admin@skillmove.com',
          timestamp: '2026-10-06T10:00:00Z',
          agreed_amount: '75000.00',
          amount_paid: '25000.00',
          outstanding_balance: '50000.00',
          note: 'Initial deposit received via bank NEFT',
        },
      ],
    });
  });

  it('renders lead full-page workspace with breadcrumbs, stage badge, and summary cards', async () => {
    const handleBack = vi.fn();

    render(
      <Lead360Page
        leadId={101}
        currentUser={adminUser}
        stages={canonical12Stages}
        teams={teams}
        users={users}
        onBack={handleBack}
      />
    );

    // Initial loading or loaded content
    await waitFor(() => {
      expect(screen.getByText('SM-LD-0101')).toBeInTheDocument();
    });

    expect(screen.getByText('Rohit Verma')).toBeInTheDocument();
    expect(screen.getByText(/Lead 360 Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Back to Leads/i)).toBeInTheDocument();

    // Summary cards
    expect(screen.getByText(/Current Pipeline Stage/i)).toBeInTheDocument();
    expect(screen.getByText(/Assigned Counsellor/i)).toBeInTheDocument();
    expect(screen.getByText(/Next Follow-Up/i)).toBeInTheDocument();
  });

  it('supports back navigation through the onBack prop', async () => {
    const handleBack = vi.fn();

    render(
      <Lead360Page
        leadId={101}
        currentUser={adminUser}
        stages={canonical12Stages}
        teams={teams}
        users={users}
        onBack={handleBack}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('SM-LD-0101')).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: /Back to Leads/i });
    fireEvent.click(backButton);

    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('navigates between all workspace tabs cleanly', async () => {
    render(
      <Lead360Page
        leadId={101}
        currentUser={adminUser}
        stages={canonical12Stages}
        teams={teams}
        users={users}
        onBack={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('SM-LD-0101')).toBeInTheDocument();
    });

    // 1. Lead Information Tab
    const infoTab = screen.getByRole('button', { name: /Lead Information/i });
    fireEvent.click(infoTab);
    expect(screen.getByText(/Academic & Career Background/i)).toBeInTheDocument();
    expect(screen.getByText('IIT Roorkee')).toBeInTheDocument();

    // 2. Activity Timeline Tab
    const timelineTab = screen.getByRole('button', { name: /Activity Timeline/i });
    fireEvent.click(timelineTab);
    expect(screen.getByText(/Unified chronological activity stream/i)).toBeInTheDocument();

    // 3. Communications Tab
    const commsTab = screen.getByRole('button', { name: /Communications/i });
    fireEvent.click(commsTab);
    expect(screen.getByText(/Skill Move Curriculum Overview/i)).toBeInTheDocument();
    expect(screen.getByText(/Recipient phone unreachable/i)).toBeInTheDocument();

    // 4. Follow-Ups Tab
    const followUpsTab = screen.getByRole('button', { name: /Follow-Ups/i });
    fireEvent.click(followUpsTab);
    expect(screen.getByText(/Update Next Follow-Up Schedule/i)).toBeInTheDocument();

    // 5. Stage & Assignment History Tab
    const historyTab = screen.getByRole('button', { name: /Stage & Assignment History/i });
    fireEvent.click(historyTab);
    expect(screen.getByText(/Pipeline Stage Transition Log/i)).toBeInTheDocument();
    expect(screen.getByText(/Candidate responded to contact email/i)).toBeInTheDocument();
    expect(screen.getByText(/Admissions Alpha/i)).toBeInTheDocument();

    // 6. Financials Tab
    const finTab = screen.getByRole('button', { name: /Financials/i });
    fireEvent.click(finTab);
    expect(screen.getByText(/Total Agreed Amount/i)).toBeInTheDocument();
    expect(screen.getByText(/₹75,000.00/i)).toBeInTheDocument();
    expect(screen.getByText(/₹25,000.00/i)).toBeInTheDocument();
    expect(screen.getByText(/₹50,000.00/i)).toBeInTheDocument();
  });

  it('validates and saves lead details in Lead Information tab', async () => {
    const updateSpy = vi.spyOn(api, 'updateLead').mockResolvedValue({
      ...mockLead,
      name: 'Rohit Verma (Updated)',
      qualification: 'M.Tech CSE',
    });

    render(
      <Lead360Page
        leadId={101}
        currentUser={adminUser}
        stages={canonical12Stages}
        teams={teams}
        users={users}
        onBack={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('SM-LD-0101')).toBeInTheDocument();
    });

    // Go to Lead Information tab
    fireEvent.click(screen.getByRole('button', { name: /Lead Information/i }));

    // Click Edit Details button
    const editBtn = screen.getByRole('button', { name: /Edit Details/i });
    fireEvent.click(editBtn);

    // Change Name
    const nameInput = screen.getByLabelText(/Full Name/i);
    fireEvent.change(nameInput, { target: { value: 'Rohit Verma (Updated)' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          name: 'Rohit Verma (Updated)',
        })
      );
    });

    expect(await screen.findByText(/Lead details successfully saved/i)).toBeInTheDocument();
  });

  it('validates and updates Pending Closure financial record safely', async () => {
    const updateFinSpy = vi.spyOn(api, 'updateLeadFinancial').mockResolvedValue({
      detail: 'Financial updated',
      financial: {
        ...mockFinancial,
        amount_paid: '40000.00',
        outstanding_balance: '35000.00',
      },
      history_entry: {
        id: 2,
        lead: 101,
        financial_record: 50,
        changed_by: 1,
        changed_by_name: 'admin@skillmove.com',
        timestamp: '2026-10-10T12:00:00Z',
        agreed_amount: '75000.00',
        amount_paid: '40000.00',
        outstanding_balance: '35000.00',
        note: 'Second installment received',
      },
    });

    render(
      <Lead360Page
        leadId={101}
        currentUser={adminUser}
        stages={canonical12Stages}
        teams={teams}
        users={users}
        onBack={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('SM-LD-0101')).toBeInTheDocument();
    });

    // Go to Financials Tab
    fireEvent.click(screen.getByRole('button', { name: /Financials/i }));

    // Test rejection when amount_paid > agreed_amount
    const agreedInput = screen.getByLabelText(/Total Agreed Amount/i);
    const paidInput = screen.getByLabelText(/Amount Paid to Date/i);
    const saveFinBtn = screen.getByRole('button', { name: /Save Financial Record/i });

    fireEvent.change(agreedInput, { target: { value: '50000' } });
    fireEvent.change(paidInput, { target: { value: '60000' } });
    fireEvent.click(saveFinBtn);

    expect(
      await screen.findByText(/Amount paid cannot exceed total agreed amount/i)
    ).toBeInTheDocument();
    expect(updateFinSpy).not.toHaveBeenCalled();

    // Now set valid values
    fireEvent.change(agreedInput, { target: { value: '75000' } });
    fireEvent.change(paidInput, { target: { value: '40000' } });
    fireEvent.click(saveFinBtn);

    await waitFor(() => {
      expect(updateFinSpy).toHaveBeenCalledWith(
        101,
        expect.objectContaining({
          agreed_amount: 75000,
          amount_paid: 40000,
        })
      );
    });

    expect(await screen.findByText(/Financial record successfully updated/i)).toBeInTheDocument();
  });

  it('displays a warning if lead is in Pending Closure but financial record is missing', async () => {
    const pcLeadWithoutFinancial: Lead = {
      ...mockLead,
      stage: 9,
      stage_name: 'Pending Closure',
    };
    vi.spyOn(api, 'getLead').mockResolvedValue(pcLeadWithoutFinancial);
    vi.spyOn(api, 'getLeadFinancial').mockResolvedValue({
      financial: null as any,
      history: [],
    });

    render(
      <Lead360Page
        leadId={101}
        currentUser={adminUser}
        stages={canonical12Stages}
        teams={teams}
        users={users}
        onBack={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('SM-LD-0101')).toBeInTheDocument();
    });

    // Go to Financials Tab
    fireEvent.click(screen.getByRole('button', { name: /Financials/i }));

    expect(
      screen.getByText(/Financial Information Missing for Pending Closure Lead/i)
    ).toBeInTheDocument();
  });

  it('displays not found error state when lead does not exist', async () => {
    vi.spyOn(api, 'getLead').mockRejectedValue(new Error('Lead with ID 999 not found.'));

    render(
      <Lead360Page
        leadId={999}
        currentUser={adminUser}
        stages={canonical12Stages}
        teams={teams}
        users={users}
        onBack={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Lead Record Not Found/i)).toBeInTheDocument();
    });
  });
});
