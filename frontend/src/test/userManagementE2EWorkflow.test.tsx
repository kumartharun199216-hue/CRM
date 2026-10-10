import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserManagementPage } from '../components/UserManagementPage';
import { ChangePasswordPage } from '../components/ChangePasswordPage';
import { MyProfilePage } from '../components/MyProfilePage';
import { User, Team, PaginatedResponse } from '../types';
import { api } from '../services/api';

describe('Task 9 — User Management E2E Workflow & Integration', () => {
  const adminUser: User = {
    id: 1,
    employee_id: 'EMP-0001',
    username: 'admin@skillmove.com',
    email: 'admin@skillmove.com',
    full_name: 'Aditya Admin',
    role: 'ADMIN',
    designation: 'Managing Director',
    department: 'Executive Operations',
    work_location: 'Bangalore HQ',
    team: 1,
    team_name: 'Alpha Admissions',
    is_active: true,
    account_status: 'ACTIVE',
    date_joined: '2026-01-01T00:00:00Z',
    date_of_joining: '2026-01-01',
    must_change_password: false,
  };

  const managerUser: User = {
    id: 2,
    employee_id: 'EMP-0002',
    username: 'manoj.manager@skillmove.com',
    email: 'manoj.manager@skillmove.com',
    full_name: 'Manoj Manager',
    role: 'MANAGER',
    designation: 'Admissions Manager',
    department: 'Admissions',
    work_location: 'Bangalore HQ',
    team: 1,
    team_name: 'Alpha Admissions',
    managed_team_id: 1,
    managed_team_name: 'Alpha Admissions',
    is_active: true,
    account_status: 'ACTIVE',
    date_joined: '2026-01-02T00:00:00Z',
    date_of_joining: '2026-01-02',
    must_change_password: false,
  };

  const newEmployee: User = {
    id: 15,
    employee_id: 'EMP-0015',
    username: 'aarav.sharma@skillmove.com',
    email: 'aarav.sharma@skillmove.com',
    mobile_number: '9876500015',
    full_name: 'Aarav Sharma',
    role: 'SALES_EMPLOYEE',
    designation: 'Senior Counsellor',
    department: 'Admissions & Counselling',
    work_location: 'Bangalore HQ',
    team: 1,
    team_name: 'Alpha Admissions',
    reporting_manager_name: 'Manoj Manager',
    is_active: true,
    account_status: 'ACTIVE',
    temporary_password: 'AaravTempPassword123!',
    login_url: 'http://localhost:5173/',
    date_joined: '2026-03-01T00:00:00Z',
    date_of_joining: '2026-03-01',
    must_change_password: true,
  };

  const sampleTeams: Team[] = [
    { id: 1, name: 'Alpha Admissions', members_count: 5, created_at: '', updated_at: '' },
    { id: 2, name: 'Beta Admissions', members_count: 4, created_at: '', updated_at: '' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    const mockPaginated: PaginatedResponse<User> = {
      count: 2,
      total_pages: 1,
      page: 1,
      page_size: 50,
      results: [adminUser, managerUser],
    };

    vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(mockPaginated);
    vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
    vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, newEmployee]);

    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  describe('Workflow Step 1 - 5: Admin creates employee & Onboarding message with credentials', () => {
    it('Admin opens User Management, creates an employee, sees temporary credentials and copies them', async () => {
      const createSpy = vi.spyOn(api, 'createUser').mockResolvedValue(newEmployee);

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      await waitFor(() => {
        expect(screen.getByText('Aditya Admin')).toBeInTheDocument();
      });

      // 1. Click Add Employee
      fireEvent.click(document.getElementById('add-employee-btn')!);

      // 2. Add User modal opens
      expect(screen.getByRole('heading', { name: /add new employee/i })).toBeInTheDocument();

      // Fill in required fields
      fireEvent.change(document.getElementById('user-full-name')!, {
        target: { value: 'Aarav Sharma' },
      });
      fireEvent.change(document.getElementById('user-email')!, {
        target: { value: 'aarav.sharma@skillmove.com' },
      });
      fireEvent.change(document.getElementById('user-mobile')!, {
        target: { value: '9876500015' },
      });

      // Submit employee creation
      fireEvent.click(document.getElementById('submit-create-user-btn')!);

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            full_name: 'Aarav Sharma',
            email: 'aarav.sharma@skillmove.com',
            mobile_number: '9876500015',
          })
        );
      });

      // 3. UserCreatedSuccessModal displays temporary password and copy buttons
      expect(await screen.findByRole('heading', { name: /employee account created/i })).toBeInTheDocument();
      expect(screen.getAllByText('EMP-0015').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('aarav.sharma@skillmove.com').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('AaravTempPassword123!')).toBeInTheDocument();

      // 4. Test Copy Temporary Password
      const copyPasswordBtn = document.getElementById('copy-temporary-password-footer-btn') || screen.getByRole('button', { name: /copy temporary password/i });
      fireEvent.click(copyPasswordBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('AaravTempPassword123!');

      // 5. Test Copy Login Message
      const copyMessageBtn = document.getElementById('copy-login-message-btn') || screen.getByRole('button', { name: /copy login message/i });
      fireEvent.click(copyMessageBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('AaravTempPassword123!'));
    });
  });

  describe('Workflow Step 6 - 8 & 10: First login password change enforcement', () => {
    it('Employee changes password successfully and unlocks CRM access', async () => {
      const handlePasswordChanged = vi.fn();
      const changeSpy = vi.spyOn(api, 'changePassword').mockResolvedValue({
        detail: 'Password changed successfully.',
        token: 'new_active_session_token_888',
        user: { ...newEmployee, must_change_password: false },
      });

      render(
        <ChangePasswordPage
          user={newEmployee}
          onPasswordChanged={handlePasswordChanged}
          onLogout={vi.fn()}
        />
      );

      // Verify change password form is present
      expect(screen.getByRole('heading', { name: /change temporary password/i })).toBeInTheDocument();
      expect(document.getElementById('current-password-input')).toBeInTheDocument();
      expect(document.getElementById('new-password-input')).toBeInTheDocument();
      expect(document.getElementById('confirm-password-input')).toBeInTheDocument();

      // Fill in current temporary password and new password
      fireEvent.change(document.getElementById('current-password-input')!, {
        target: { value: 'AaravTempPassword123!' },
      });
      fireEvent.change(document.getElementById('new-password-input')!, {
        target: { value: 'AaravPermanentPass#2026' },
      });
      fireEvent.change(document.getElementById('confirm-password-input')!, {
        target: { value: 'AaravPermanentPass#2026' },
      });

      // Submit
      fireEvent.click(document.getElementById('submit-change-password-btn')!);

      await waitFor(() => {
        expect(changeSpy).toHaveBeenCalledWith({
          old_password: 'AaravTempPassword123!',
          new_password: 'AaravPermanentPass#2026',
          confirm_password: 'AaravPermanentPass#2026',
        });
        expect(handlePasswordChanged).toHaveBeenCalledWith(
          expect.objectContaining({ email: 'aarav.sharma@skillmove.com', must_change_password: false }),
          'new_active_session_token_888'
        );
      });
    });
  });

  describe('Workflow Step 9: My Profile displays details and protects restricted fields', () => {
    it('Employee can update permitted contact details while role and team remain strictly read-only', async () => {
      const updateProfileSpy = vi.spyOn(api, 'updateProfile').mockResolvedValue({
        ...newEmployee,
        mobile_number: '9876509999',
        work_location: 'Bangalore South Campus',
      });

      render(<MyProfilePage currentUser={newEmployee} onProfileUpdated={vi.fn()} onNavigateToChangePassword={vi.fn()} />);

      // Verify display fields
      expect(screen.getAllByText('EMP-0015').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Aarav Sharma').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Alpha Admissions').length).toBeGreaterThanOrEqual(1);

      // Check that Role and Employee ID are non-editable text / badges
      expect(screen.getAllByText(/counsellor/i).length).toBeGreaterThanOrEqual(1);

      // Click Edit Profile
      fireEvent.click(screen.getByRole('button', { name: /edit profile/i }));

      // Mobile number is editable
      const mobileInput = screen.getByDisplayValue('9876500015');
      fireEvent.change(mobileInput, { target: { value: '9876509999' } });

      // Save Profile
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(updateProfileSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            mobile_number: '9876509999',
          })
        );
      });
    });
  });

  describe('Workflow Step 11 - 15: Administration, Boundaries, and Account Status', () => {
    it('Admin can edit employee and toggle active/inactive status with lead reassignment', async () => {
      const paginatedWithEmployee: PaginatedResponse<User> = {
        count: 3,
        total_pages: 1,
        page: 1,
        page_size: 50,
        results: [adminUser, managerUser, newEmployee],
      };
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(paginatedWithEmployee);

      const deactSpy = vi.spyOn(api, 'deactivateUser').mockResolvedValue({
        detail: 'Account for aarav.sharma@skillmove.com has been deactivated.',
        user: { ...newEmployee, is_active: false, account_status: 'INACTIVE' },
        sessions_invalidated: true,
        reassigned_leads_count: 2,
      });

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      await waitFor(() => {
        expect(screen.getByText('Aarav Sharma')).toBeInTheDocument();
      });

      // 1. Admin clicks Deactivate for Aarav
      fireEvent.click(document.getElementById('toggle-status-btn-15')!);

      // Confirmation modal opens
      expect(screen.getByRole('heading', { name: /deactivate employee account/i })).toBeInTheDocument();
      expect(screen.getByText(/immediate session revocation/i)).toBeInTheDocument();

      // Optional lead reassignment toggle
      const reassignToggle = document.getElementById('reassign-leads-checkbox') as HTMLInputElement;
      fireEvent.click(reassignToggle);

      // Wait for assignees to load
      await waitFor(() => {
        expect(screen.getByText(/transfer active leads to:/i)).toBeInTheDocument();
      });

      // Confirm deactivation
      fireEvent.click(document.getElementById('confirm-status-action-btn')!);

      await waitFor(() => {
        expect(deactSpy).toHaveBeenCalledWith(
          15,
          expect.objectContaining({
            reassign_leads_to: expect.any(Number),
          })
        );
      });
    });
  });
});
