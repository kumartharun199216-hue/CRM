import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { App } from '../App';
import { Sidebar } from '../components/Sidebar';
import { TeamManagementPage } from '../components/TeamManagementPage';
import { api } from '../services/api';
import { User, Team, PipelineStage, Lead } from '../types';

describe('Skill Move Sales CRM — Phase 4: Team Management Interface', () => {
  const adminUser: User = {
    id: 1,
    username: 'admin@skillmove.edu',
    email: 'admin@skillmove.edu',
    full_name: 'System Admin',
    role: 'ADMIN',
  };

  const managerAlpha: User = {
    id: 2,
    username: 'manager_alpha',
    email: 'manager.alpha@skillmove.edu',
    full_name: 'Manager Alpha',
    role: 'MANAGER',
    team: 1,
    team_name: 'Admissions Alpha',
    managed_team_id: 1,
    managed_team_name: 'Admissions Alpha',
  };

  const managerUnassigned: User = {
    id: 3,
    username: 'manager_free',
    email: 'manager.free@skillmove.edu',
    full_name: 'Manager Free',
    role: 'MANAGER',
    team: null,
    managed_team_id: null,
  };

  const counsellorUser: User = {
    id: 4,
    username: 'counsellor_one',
    email: 'counsellor@skillmove.edu',
    full_name: 'Counsellor One',
    role: 'SALES_EMPLOYEE',
    team: 1,
    team_name: 'Admissions Alpha',
  };

  const sampleTeams: Team[] = [
    {
      id: 1,
      name: 'Admissions Alpha',
      description: 'Undergraduate admissions sales team',
      manager: 2,
      manager_name: 'manager_alpha',
      manager_full_name: 'Manager Alpha',
      is_active: true,
      members_count: 3,
      active_members_count: 2,
      leads_count: 5,
      created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-01T10:00:00Z',
    },
    {
      id: 2,
      name: 'Admissions Beta',
      description: 'Postgraduate sales team with historical leads',
      manager: null,
      is_active: false,
      members_count: 0,
      active_members_count: 0,
      leads_count: 2,
      created_at: '2026-10-02T10:00:00Z',
      updated_at: '2026-10-02T10:00:00Z',
    },
    {
      id: 3,
      name: 'Empty Team Deletable',
      description: 'Temporary empty team for testing deletion',
      manager: null,
      is_active: true,
      members_count: 0,
      active_members_count: 0,
      leads_count: 0,
      created_at: '2026-10-03T10:00:00Z',
      updated_at: '2026-10-03T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('crm_token', 'test-token');

    // Default API mocks
    vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);
    vi.spyOn(api, 'getTeams').mockResolvedValue([...sampleTeams]);
    vi.spyOn(api, 'getUsers').mockResolvedValue([managerAlpha, managerUnassigned, counsellorUser]);
    vi.spyOn(api, 'getStages').mockResolvedValue([
      { id: 1, name: 'Cold Calling', order: 1, is_active: true },
      { id: 2, name: 'Enrolled', order: 2, is_active: true },
    ]);
    vi.spyOn(api, 'getLeads').mockResolvedValue([]);
    vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 5, 2: 2 });
    vi.spyOn(api, 'getUnassignedCount').mockResolvedValue({ unassigned_count: 0 } as any);
  });

  describe('1. Navigation and Access Control', () => {
    it('renders "Teams" item in the sidebar for Admin users', () => {
      render(
        <Sidebar
          user={adminUser}
          activeView="dashboard"
          onViewChange={vi.fn()}
          onOpenReports={vi.fn()}
          onOpenStages={vi.fn()}
          onLogout={vi.fn()}
        />
      );

      const teamsNavItem = screen.getByRole('button', { name: /teams/i });
      expect(teamsNavItem).toBeInTheDocument();
      expect(teamsNavItem).toHaveAttribute('id', 'sidebar-teams-nav-item');
    });

    it('does NOT render "Teams" item in sidebar for Sales Employees', () => {
      render(
        <Sidebar
          user={counsellorUser}
          activeView="dashboard"
          onViewChange={vi.fn()}
          onOpenReports={vi.fn()}
          onOpenStages={vi.fn()}
          onLogout={vi.fn()}
        />
      );

      const teamsNavItem = screen.queryByRole('button', { name: /teams/i });
      expect(teamsNavItem).not.toBeInTheDocument();
    });

    it('does NOT render "Teams" item in sidebar for Managers', () => {
      render(
        <Sidebar
          user={managerAlpha}
          activeView="dashboard"
          onViewChange={vi.fn()}
          onOpenReports={vi.fn()}
          onOpenStages={vi.fn()}
          onLogout={vi.fn()}
        />
      );

      const teamsNavItem = screen.queryByRole('button', { name: /teams/i });
      expect(teamsNavItem).not.toBeInTheDocument();
    });

    it('clicking Teams item triggers onViewChange("teams")', () => {
      const handleViewChange = vi.fn();
      render(
        <Sidebar
          user={adminUser}
          activeView="dashboard"
          onViewChange={handleViewChange}
          onOpenReports={vi.fn()}
          onOpenStages={vi.fn()}
          onLogout={vi.fn()}
        />
      );

      const teamsNavItem = screen.getByRole('button', { name: /teams/i });
      fireEvent.click(teamsNavItem);
      expect(handleViewChange).toHaveBeenCalledWith('teams');
    });

    it('displays Access Restricted when non-admin accesses TeamManagementPage directly', () => {
      render(<TeamManagementPage currentUser={counsellorUser} />);
      expect(screen.getByText(/access restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/only authorized crm administrators have access/i)).toBeInTheDocument();
    });
  });

  describe('2. Team List & Metrics', () => {
    it('renders real teams from API with all required fields', async () => {
      render(<TeamManagementPage currentUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Admissions Alpha')).toBeInTheDocument();
      });

      // Verification of columns and rows
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();

      // Descriptions
      expect(screen.getByText('Undergraduate admissions sales team')).toBeInTheDocument();

      // Manager name
      expect(screen.getByText('Manager Alpha')).toBeInTheDocument();
      expect(screen.getAllByText('No Manager').length).toBeGreaterThanOrEqual(1);

      // Status pills
      expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/inactive/i).length).toBeGreaterThan(0);
    });

    it('displays aggregate metrics accurately based on teams data', async () => {
      render(<TeamManagementPage currentUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Admissions Alpha')).toBeInTheDocument();
      });

      // Total teams: 3
      expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Organization units')).toBeInTheDocument();
      // Total leads across teams: 5 + 2 + 0 = 7
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('filters teams by search query', async () => {
      render(<TeamManagementPage currentUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Admissions Alpha')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search teams by name/i);
      fireEvent.change(searchInput, { target: { value: 'Beta' } });

      expect(screen.queryByText('Admissions Alpha')).not.toBeInTheDocument();
      expect(screen.getByText('Admissions Beta')).toBeInTheDocument();
    });

    it('filters teams by status (Active / Inactive)', async () => {
      render(<TeamManagementPage currentUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Admissions Alpha')).toBeInTheDocument();
      });

      // Click Inactive filter
      const inactiveFilterBtn = screen.getByRole('button', { name: /inactive \(1\)/i });
      fireEvent.click(inactiveFilterBtn);

      expect(screen.queryByText('Admissions Alpha')).not.toBeInTheDocument();
      expect(screen.getByText('Admissions Beta')).toBeInTheDocument();
    });
  });

  describe('3. Create Team Workflow & Constraints', () => {
    it('opens Create Team modal and creates a new team successfully', async () => {
      const createSpy = vi.spyOn(api, 'createTeam').mockResolvedValue({
        id: 4,
        name: 'Admissions Gamma',
        description: 'New Gamma Team',
        manager: 3,
        manager_name: 'manager_free',
        manager_full_name: 'Manager Free',
        is_active: true,
        members_count: 0,
        active_members_count: 0,
        leads_count: 0,
        created_at: '2026-10-10T12:00:00Z',
        updated_at: '2026-10-10T12:00:00Z',
      });

      render(<TeamManagementPage currentUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Admissions Alpha')).toBeInTheDocument();
      });

      // Click Create Team
      const createBtn = document.getElementById('create-team-btn') as HTMLButtonElement;
      fireEvent.click(createBtn);

      expect(screen.getByText('Create New Team')).toBeInTheDocument();

      // Enter form data
      const nameInput = document.getElementById('create-team-name-input') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Admissions Gamma' } });

      const descInput = document.getElementById('create-team-desc-input') as HTMLTextAreaElement;
      fireEvent.change(descInput, { target: { value: 'New Gamma Team' } });

      // Select available manager
      const managerSelect = document.getElementById('create-team-manager-select') as HTMLSelectElement;
      fireEvent.change(managerSelect, { target: { value: '3' } });

      // Submit
      const submitBtn = document.getElementById('submit-create-team-btn') as HTMLButtonElement;
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith({
          name: 'Admissions Gamma',
          description: 'New Gamma Team',
          manager: 3,
          is_active: true,
        });
      });
    });

    it('shows duplicate team name error returned from backend API', async () => {
      vi.spyOn(api, 'createTeam').mockRejectedValue(
        new Error("A team with the name 'Admissions Alpha' already exists.")
      );

      render(<TeamManagementPage currentUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Admissions Alpha')).toBeInTheDocument();
      });

      fireEvent.click(document.getElementById('create-team-btn') as HTMLButtonElement);

      const nameInput = document.getElementById('create-team-name-input') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Admissions Alpha' } });

      const submitBtn = document.getElementById('submit-create-team-btn') as HTMLButtonElement;
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      });
    });

    it('displays warning when an already assigned manager is chosen in Create Team', async () => {
      render(<TeamManagementPage currentUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Admissions Alpha')).toBeInTheDocument();
      });

      fireEvent.click(document.getElementById('create-team-btn') as HTMLButtonElement);

      const managerSelect = document.getElementById('create-team-manager-select') as HTMLSelectElement;
      // Manager Alpha (id=2) already manages Admissions Alpha
      fireEvent.change(managerSelect, { target: { value: '2' } });

      expect(screen.getByText(/manager already assigned:/i)).toBeInTheDocument();
    });
  });

  describe('4. Edit Team Workflow & Deactivation Guards', () => {
    it('opens Edit Team modal with prefilled data and submits updates', async () => {
      const updateSpy = vi.spyOn(api, 'updateTeam').mockResolvedValue({
        ...sampleTeams[0],
        name: 'Admissions Alpha Renamed',
      });

      render(<TeamManagementPage currentUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Admissions Alpha')).toBeInTheDocument();
      });

      const editBtn = document.getElementById('edit-team-btn-1') as HTMLButtonElement;
      fireEvent.click(editBtn);

      expect(screen.getByText('Edit Team Configuration')).toBeInTheDocument();

      const nameInput = document.getElementById('edit-team-name-input') as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Admissions Alpha Renamed' } });

      const saveBtn = document.getElementById('submit-edit-team-btn') as HTMLButtonElement;
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(1, expect.objectContaining({
          name: 'Admissions Alpha Renamed',
        }));
      });
    });

    it('blocks deactivating a team with active leads and displays safeguard warning', async () => {
      render(<TeamManagementPage currentUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Admissions Alpha')).toBeInTheDocument();
      });

      const editBtn = document.getElementById('edit-team-btn-1') as HTMLButtonElement;
      fireEvent.click(editBtn);

      // Toggle status switch off (team 1 has 5 leads)
      const toggleBtn = document.getElementById('toggle-team-status-btn') as HTMLButtonElement;
      fireEvent.click(toggleBtn);

      // Safeguard warning appears
      expect(screen.getByText(/deactivation safeguard:/i)).toBeInTheDocument();
      expect(screen.getByText(/5 associated lead\(s\)/i)).toBeInTheDocument();

      // Submit button is disabled
      const saveBtn = document.getElementById('submit-edit-team-btn') as HTMLButtonElement;
      expect(saveBtn).toBeDisabled();
    });
  });

  describe('5. Team Details Inspection', () => {
    it('opens Team Details modal and fetches team members roster', async () => {
      const getUsersSpy = vi.spyOn(api, 'getUsers').mockResolvedValue([
        counsellorUser,
        managerAlpha,
      ]);

      render(<TeamManagementPage currentUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Admissions Alpha')).toBeInTheDocument();
      });

      const inspectBtn = document.getElementById('inspect-team-btn-1') as HTMLButtonElement;
      fireEvent.click(inspectBtn);

      await waitFor(() => {
        expect(screen.getByText('Team Members (2)')).toBeInTheDocument();
      });

      expect(getUsersSpy).toHaveBeenCalledWith({ team: 1 });
      expect(screen.getByText('Counsellor One')).toBeInTheDocument();
      expect(screen.getAllByText('Manager Alpha').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('6. Delete Safeguards vs Safe Deletion', () => {
    it('blocks deletion of team with leads and suggests deactivation', async () => {
      render(<TeamManagementPage currentUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Admissions Alpha')).toBeInTheDocument();
      });

      // Team 1 has 5 leads
      const deleteBtn = document.getElementById('delete-team-btn-1') as HTMLButtonElement;
      fireEvent.click(deleteBtn);

      expect(screen.getByText(/team deletion safeguard/i)).toBeInTheDocument();
      expect(screen.getByText(/deletion blocked: associated leads/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /edit team \(deactivate\)/i })).toBeInTheDocument();
    });

    it('allows safe deletion of an empty team (0 leads, 0 members)', async () => {
      const deleteSpy = vi.spyOn(api, 'deleteTeam').mockResolvedValue(undefined as any);

      render(<TeamManagementPage currentUser={adminUser} />);

      await waitFor(() => {
        expect(screen.getByText('Empty Team Deletable')).toBeInTheDocument();
      });

      // Team 3 has 0 leads and 0 members
      const deleteBtn = document.getElementById('delete-team-btn-3') as HTMLButtonElement;
      fireEvent.click(deleteBtn);

      expect(screen.getByText(/are you sure you want to permanently delete team/i)).toBeInTheDocument();

      const confirmBtn = document.getElementById('confirm-delete-team-btn') as HTMLButtonElement;
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(deleteSpy).toHaveBeenCalledWith(3);
      });
    });
  });
});
