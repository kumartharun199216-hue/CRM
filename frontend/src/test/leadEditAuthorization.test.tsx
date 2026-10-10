import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { LeadModal } from '../components/LeadModal';
import { Lead, Team, User, PipelineStage } from '../types';
import { api } from '../services/api';

describe('Lead Edit & Authorization Frontend Workflow', () => {
  const salesEmployee: User = {
    id: 4,
    username: 'counsellor_a1',
    full_name: 'Chirag Sharma',
    email: 'counsellor.a1@skillmove.com',
    role: 'SALES_EMPLOYEE',
    team: 1,
    team_name: 'Alpha Admissions',
  };

  const managerUser: User = {
    id: 2,
    username: 'mgr_alpha',
    full_name: 'Aman Verma',
    email: 'manager.alpha@skillmove.com',
    role: 'MANAGER',
    team: 1,
    team_name: 'Alpha Admissions',
    managed_team_id: 1,
  };

  const sampleTeam: Team = {
    id: 1,
    name: 'Alpha Admissions',
    members_count: 3,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const sampleStages: PipelineStage[] = [
    { id: 1, name: 'New Lead', order: 1, is_active: true },
    { id: 2, name: 'Contacted', order: 2, is_active: true },
  ];

  const sampleLead: Lead = {
    id: 10,
    lead_id: 'SM-LD-0010',
    name: 'Rohan Mehra',
    title: 'Rohan Mehra',
    contact_name: 'Rohan Mehra',
    email: 'rohan.mehra@example.com',
    phone: '+919876543210',
    qualification: 'B.Tech',
    college: 'Delhi University',
    yop: '2023',
    key_skills: 'Java, Spring',
    target_role: 'Java Developer',
    experience: '1 Year',
    company: '',
    stage: 1,
    stage_name: 'New Lead',
    priority: 'HIGH',
    status: 'NEW',
    estimated_revenue: '50000',
    placement_fee: '15000',
    career_counsellor: 'Chirag Sharma',
    city: 'Delhi',
    next_follow_up: null,
    team: 1,
    team_name: 'Alpha Admissions',
    assigned_employee: 4,
    assigned_employee_name: 'counsellor_a1',
    created_by: 2,
    created_by_name: 'mgr_alpha',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    archived_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows Sales Employee to edit ordinary fields without team-mismatch validation error', async () => {
    const onSaveMock = vi.fn().mockResolvedValue(undefined);
    const onCloseMock = vi.fn();

    // Render LeadModal for sales employee with empty users array (simulating restricted lookup)
    render(
      <LeadModal
        lead={sampleLead}
        isOpen={true}
        teams={[sampleTeam]}
        users={[]}
        stages={sampleStages}
        currentUser={salesEmployee}
        onClose={onCloseMock}
        onSave={onSaveMock}
      />
    );

    // Verify modal rendered with lead information
    expect(screen.getByDisplayValue('Rohan Mehra')).toBeInTheDocument();
    expect(screen.getByDisplayValue('rohan.mehra@example.com')).toBeInTheDocument();

    // Assigned employee and team are read-only for Sales Employee
    expect(screen.getByText('Alpha Admissions')).toBeInTheDocument();
    expect(screen.getByText('counsellor_a1')).toBeInTheDocument();

    // Edit ordinary fields: qualification and priority
    const qualificationInput = screen.getByDisplayValue('B.Tech');
    fireEvent.change(qualificationInput, { target: { value: 'M.Tech Software Engineering' } });

    // Submit form
    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Must NOT display "The assigned employee must belong to the lead's team."
      expect(screen.queryByText(/The assigned employee must belong to the lead/i)).not.toBeInTheDocument();
      expect(onSaveMock).toHaveBeenCalledTimes(1);
    });

    // Check payload passed to onSave
    const savedData = onSaveMock.mock.calls[0][0];
    expect(savedData.qualification).toBe('M.Tech Software Engineering');
    expect(savedData.team).toBe(1);
    expect(savedData.assigned_employee).toBe(4);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('preserves lead assignment and team when fields are unchanged', async () => {
    const onSaveMock = vi.fn().mockResolvedValue(undefined);

    render(
      <LeadModal
        lead={sampleLead}
        isOpen={true}
        teams={[sampleTeam]}
        users={[salesEmployee]}
        stages={sampleStages}
        currentUser={salesEmployee}
        onClose={vi.fn()}
        onSave={onSaveMock}
      />
    );

    // Edit city
    const cityInput = screen.getByDisplayValue('Delhi');
    fireEvent.change(cityInput, { target: { value: 'Gurugram' } });

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalledTimes(1);
    });

    const savedData = onSaveMock.mock.calls[0][0];
    expect(savedData.city).toBe('Gurugram');
    expect(savedData.team).toBe(sampleLead.team);
    expect(savedData.assigned_employee).toBe(sampleLead.assigned_employee);
  });

  it('validates that newly reassigned employee belongs to team when Manager modifies assignment', async () => {
    const otherTeamEmployee: User = {
      id: 6,
      username: 'counsellor_b1',
      full_name: 'Esha Gupta',
      email: 'counsellor.b1@skillmove.com',
      role: 'SALES_EMPLOYEE',
      team: 2, // belongs to Beta Admissions, not Alpha
      team_name: 'Beta Admissions',
    };

    const onSaveMock = vi.fn().mockResolvedValue(undefined);

    render(
      <LeadModal
        lead={sampleLead}
        isOpen={true}
        teams={[sampleTeam]}
        users={[salesEmployee, otherTeamEmployee]}
        stages={sampleStages}
        currentUser={managerUser}
        onClose={vi.fn()}
        onSave={onSaveMock}
      />
    );

    // Manager has select dropdown for Assigned Sales Employee containing only team employees
    const selectOption = screen.getByText('Select Sales Employee');
    const employeeSelect = selectOption.closest('select')!;
    expect(employeeSelect).toBeInTheDocument();

    // Team Alpha employee Chirag Sharma is available in the dropdown
    expect(screen.getByText('Chirag Sharma')).toBeInTheDocument();
    // Team Beta employee Esha Gupta (counsellor_b1) is NOT available in the dropdown
    expect(screen.queryByText('Esha Gupta')).not.toBeInTheDocument();
    expect(screen.queryByText('counsellor_b1')).not.toBeInTheDocument();
  });

  it('api.getUserLookup queries the scoped lookup endpoint', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [salesEmployee],
    } as Response);

    const result = await api.getUserLookup({ team: 1 });
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/users/lookup/?team=1',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].username).toBe('counsellor_a1');
  });
});
