import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserManagementPage } from '../components/UserManagementPage';
import { User, Team, PaginatedResponse, UserActionResponse } from '../types';
import { api } from '../services/api';

describe('Task 8 — Employee Administration and Account Status', () => {
  const adminUser: User = {
    id: 1,
    employee_id: 'EMP-0001',
    username: 'admin@skillmove.com',
    email: 'admin@skillmove.com',
    full_name: 'Super Admin',
    role: 'ADMIN',
    designation: 'System Administrator',
    department: 'Executive Operations',
    work_location: 'Bangalore HQ',
    team: 1,
    team_name: 'Alpha Admissions',
    is_active: true,
    account_status: 'ACTIVE',
    date_joined: '2026-01-01T00:00:00Z',
    date_of_joining: '2026-01-01',
  };

  const managerAlpha: User = {
    id: 2,
    employee_id: 'EMP-0002',
    username: 'manager.alpha@skillmove.com',
    email: 'manager.alpha@skillmove.com',
    full_name: 'Manager Alpha',
    role: 'MANAGER',
    designation: 'Admissions Manager',
    department: 'Admissions & Counselling',
    work_location: 'Bangalore HQ',
    team: 1,
    team_name: 'Alpha Admissions',
    is_active: true,
    account_status: 'ACTIVE',
    date_joined: '2026-01-02T00:00:00Z',
    date_of_joining: '2026-01-02',
  };

  const counsellorAlpha: User = {
    id: 10,
    employee_id: 'EMP-0010',
    username: 'counsellor.alpha@skillmove.com',
    email: 'counsellor.alpha@skillmove.com',
    mobile_number: '9876543210',
    full_name: 'Counsellor Alpha',
    role: 'SALES_EMPLOYEE',
    designation: 'Junior Counsellor',
    department: 'Admissions & Counselling',
    work_location: 'Bangalore HQ',
    team: 1,
    team_name: 'Alpha Admissions',
    reporting_manager_name: 'Manager Alpha',
    is_active: true,
    account_status: 'ACTIVE',
    date_joined: '2026-02-01T00:00:00Z',
    date_of_joining: '2026-02-01',
  };

  const counsellorBetaInactive: User = {
    id: 20,
    employee_id: 'EMP-0020',
    username: 'counsellor.beta@skillmove.com',
    email: 'counsellor.beta@skillmove.com',
    mobile_number: '9876543211',
    full_name: 'Counsellor Beta',
    role: 'SALES_EMPLOYEE',
    designation: 'Senior Counsellor',
    department: 'Admissions & Counselling',
    work_location: 'Mumbai Hub',
    team: 2,
    team_name: 'Beta Admissions',
    reporting_manager_name: 'Manager Beta',
    is_active: false,
    account_status: 'INACTIVE',
    date_joined: '2026-02-05T00:00:00Z',
    date_of_joining: '2026-02-05',
  };

  const sampleTeams: Team[] = [
    { id: 1, name: 'Alpha Admissions', members_count: 5, created_at: '', updated_at: '' },
    { id: 2, name: 'Beta Admissions', members_count: 4, created_at: '', updated_at: '' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    const mockPaginated: PaginatedResponse<User> = {
      count: 4,
      total_pages: 1,
      page: 1,
      page_size: 50,
      results: [adminUser, managerAlpha, counsellorAlpha, counsellorBetaInactive],
    };

    vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(mockPaginated);
    vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
    vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerAlpha, counsellorAlpha]);
  });

  describe('1. Role-Based Permissions & Table Actions Visibility', () => {
    it('Admin sees View Details, Edit, Deactivate/Activate, and Reset for employees', async () => {
      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      await waitFor(() => {
        expect(screen.getByText('Counsellor Alpha')).toBeInTheDocument();
      });

      // Counsellor Alpha (active)
      expect(document.getElementById('view-user-btn-10')).toBeInTheDocument();
      expect(document.getElementById('edit-user-btn-10')).toBeInTheDocument();
      expect(document.getElementById('toggle-status-btn-10')).toBeInTheDocument();
      expect(document.getElementById('toggle-status-btn-10')).toHaveTextContent('Deactivate');
      expect(document.getElementById('reset-user-btn-10')).toBeInTheDocument();

      // Counsellor Beta (inactive)
      expect(document.getElementById('view-user-btn-20')).toBeInTheDocument();
      expect(document.getElementById('edit-user-btn-20')).toBeInTheDocument();
      expect(document.getElementById('toggle-status-btn-20')).toBeInTheDocument();
      expect(document.getElementById('toggle-status-btn-20')).toHaveTextContent('Activate');

      // Admin viewing themselves: cannot deactivate self
      expect(document.getElementById('toggle-status-btn-1')).toBeNull();
    });

    it('Manager can manage only employees within their authorized team', async () => {
      render(<UserManagementPage currentUser={managerAlpha} teams={sampleTeams} />);

      await waitFor(() => {
        expect(screen.getByText('Counsellor Alpha')).toBeInTheDocument();
      });

      // Team Alpha employee (in-team): manager can edit and toggle status
      expect(document.getElementById('view-user-btn-10')).toBeInTheDocument();
      expect(document.getElementById('edit-user-btn-10')).toBeInTheDocument();
      expect(document.getElementById('toggle-status-btn-10')).toBeInTheDocument();

      // Team Beta employee (outside team): manager cannot edit or toggle status
      expect(document.getElementById('view-user-btn-20')).toBeInTheDocument();
      expect(document.getElementById('edit-user-btn-20')).toBeNull();
      expect(document.getElementById('toggle-status-btn-20')).toBeNull();
      expect(document.getElementById('reset-user-btn-20')).toBeNull();

      // Manager cannot edit or deactivate Admin or themselves
      expect(document.getElementById('edit-user-btn-1')).toBeNull();
      expect(document.getElementById('toggle-status-btn-1')).toBeNull();
      expect(document.getElementById('edit-user-btn-2')).toBeNull();
      expect(document.getElementById('toggle-status-btn-2')).toBeNull();
    });
  });

  describe('2. View Details Modal with Extended Information & Quick Actions', () => {
    it('opens Details modal displaying department, work location, joining date, and quick action buttons', async () => {
      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      await waitFor(() => {
        expect(screen.getByText('Counsellor Alpha')).toBeInTheDocument();
      });

      fireEvent.click(document.getElementById('view-user-btn-10')!);

      // Verify extended employee fields
      expect(screen.getAllByText('EMP-0010').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('counsellor.alpha@skillmove.com').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Junior Counsellor').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Alpha Admissions').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Manager Alpha').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Admissions & Counselling')).toBeInTheDocument();
      expect(screen.getByText('Bangalore HQ')).toBeInTheDocument();

      // Verify Quick Action buttons in details modal
      expect(document.getElementById('details-edit-user-btn')).toBeInTheDocument();
      expect(document.getElementById('details-toggle-status-btn')).toBeInTheDocument();
      expect(document.getElementById('details-reset-password-btn')).toBeInTheDocument();
    });
  });

  describe('3. Edit Details Workflow & Manager Role/Team Locking', () => {
    it('Admin can edit employee personal details, role, and team', async () => {
      const updateSpy = vi.spyOn(api, 'updateUser').mockResolvedValue({
        detail: 'User details updated successfully.',
        user: {
          ...counsellorAlpha,
          full_name: 'Counsellor Alpha Updated',
          designation: 'Lead Counsellor',
          team: 2,
          team_name: 'Beta Admissions',
        },
      });

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      await waitFor(() => {
        expect(screen.getByText('Counsellor Alpha')).toBeInTheDocument();
      });

      fireEvent.click(document.getElementById('edit-user-btn-10')!);

      // Edit modal should open
      expect(screen.getByRole('heading', { name: /edit employee details/i })).toBeInTheDocument();
      expect(document.getElementById('edit-user-role-select')).toBeInTheDocument();
      expect(document.getElementById('edit-user-team-select')).toBeInTheDocument();

      // Change full name and designation
      fireEvent.change(document.getElementById('edit-user-fullname-input')!, {
        target: { value: 'Counsellor Alpha Updated' },
      });
      fireEvent.change(document.getElementById('edit-user-designation-input')!, {
        target: { value: 'Lead Counsellor' },
      });

      fireEvent.click(document.getElementById('save-edit-user-btn')!);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          10,
          expect.objectContaining({
            full_name: 'Counsellor Alpha Updated',
            designation: 'Lead Counsellor',
          })
        );
      });
    });

    it('Manager has Role and Team inputs locked and read-only', async () => {
      render(<UserManagementPage currentUser={managerAlpha} teams={sampleTeams} />);

      await waitFor(() => {
        expect(screen.getByText('Counsellor Alpha')).toBeInTheDocument();
      });

      fireEvent.click(document.getElementById('edit-user-btn-10')!);

      expect(screen.getByRole('heading', { name: /edit employee details/i })).toBeInTheDocument();

      // Role and team selectors should NOT be editable selects for manager
      expect(document.getElementById('edit-user-role-select')).toBeNull();
      expect(document.getElementById('edit-user-team-select')).toBeNull();
      expect(screen.getByText(/counsellors within your team/i)).toBeInTheDocument();
    });
  });

  describe('4. Deactivate and Activate Account Dialogs & Lead Reassignment', () => {
    it('Deactivation dialog shows security warnings, session revocation notice, and optional lead reassignment', async () => {
      const deactSpy = vi.spyOn(api, 'deactivateUser').mockResolvedValue({
        detail: 'Account for counsellor.alpha@skillmove.com has been deactivated.',
        user: { ...counsellorAlpha, is_active: false, account_status: 'INACTIVE' },
        sessions_invalidated: true,
        reassigned_leads_count: 3,
      });

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      await waitFor(() => {
        expect(screen.getByText('Counsellor Alpha')).toBeInTheDocument();
      });

      // Click Deactivate
      fireEvent.click(document.getElementById('toggle-status-btn-10')!);

      // Verify modal contents
      expect(screen.getByRole('heading', { name: /deactivate employee account/i })).toBeInTheDocument();
      expect(screen.getByText(/immediate session revocation/i)).toBeInTheDocument();
      expect(screen.getByText(/data preservation/i)).toBeInTheDocument();

      // Check optional lead reassignment toggle
      const reassignCheckbox = document.getElementById('reassign-leads-checkbox') as HTMLInputElement;
      expect(reassignCheckbox).toBeInTheDocument();
      fireEvent.click(reassignCheckbox);

      // Wait for assignees to load
      await waitFor(() => {
        expect(screen.getByText(/transfer active leads to:/i)).toBeInTheDocument();
      });

      // Confirm deactivation
      fireEvent.click(document.getElementById('confirm-status-action-btn')!);

      await waitFor(() => {
        expect(deactSpy).toHaveBeenCalledWith(
          10,
          expect.objectContaining({
            reassign_leads_to: expect.any(Number),
          })
        );
      });
    });

    it('Activation dialog restores account access and refreshes user list', async () => {
      const actSpy = vi.spyOn(api, 'activateUser').mockResolvedValue({
        detail: 'Account for counsellor.beta@skillmove.com has been activated.',
        user: { ...counsellorBetaInactive, is_active: true, account_status: 'ACTIVE' },
      });

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      await waitFor(() => {
        expect(screen.getByText('Counsellor Beta')).toBeInTheDocument();
      });

      // Click Activate on Counsellor Beta
      fireEvent.click(document.getElementById('toggle-status-btn-20')!);

      expect(screen.getByRole('heading', { name: /activate employee account/i })).toBeInTheDocument();
      expect(screen.getByText(/account restoration/i)).toBeInTheDocument();

      fireEvent.click(document.getElementById('confirm-status-action-btn')!);

      await waitFor(() => {
        expect(actSpy).toHaveBeenCalledWith(20);
      });
    });
  });
});
