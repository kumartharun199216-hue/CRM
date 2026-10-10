import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';
import { ChangePasswordPage } from '../components/ChangePasswordPage';
import { PasswordResetModal } from '../components/PasswordResetModal';
import { AdminResetPasswordModal } from '../components/AdminResetPasswordModal';
import { UserManagementPage } from '../components/UserManagementPage';
import { api } from '../services/api';
import { User, PipelineStage, Team, PaginatedResponse } from '../types';

describe('TASK 7 — Secure Password Change and Reset Workflow', () => {
  const adminUser: User = {
    id: 1,
    employee_id: 'EMP-0001',
    username: 'admin@skillmove.com',
    email: 'admin@skillmove.com',
    full_name: 'Admin Director',
    role: 'ADMIN',
    team: 1,
    must_change_password: false,
    is_active: true,
    account_status: 'ACTIVE',
  };

  const managerUser: User = {
    id: 2,
    employee_id: 'EMP-0002',
    username: 'manager@skillmove.com',
    email: 'manager@skillmove.com',
    full_name: 'Admissions Manager',
    role: 'MANAGER',
    team: 1,
    team_name: 'North Admissions Team',
    must_change_password: false,
    is_active: true,
    account_status: 'ACTIVE',
  };

  const teamEmployee: User = {
    id: 10,
    employee_id: 'EMP-0010',
    username: 'counsellor.north@skillmove.in',
    email: 'counsellor.north@skillmove.in',
    full_name: 'North Counsellor',
    role: 'SALES_EMPLOYEE',
    team: 1,
    team_name: 'North Admissions Team',
    must_change_password: false,
    is_active: true,
    account_status: 'ACTIVE',
  };

  const otherTeamEmployee: User = {
    id: 20,
    employee_id: 'EMP-0020',
    username: 'counsellor.south@skillmove.in',
    email: 'counsellor.south@skillmove.in',
    full_name: 'South Counsellor',
    role: 'SALES_EMPLOYEE',
    team: 2,
    team_name: 'South Admissions Team',
    must_change_password: false,
    is_active: true,
    account_status: 'ACTIVE',
  };

  const sampleTeams: Team[] = [
    { id: 1, name: 'North Admissions Team', members_count: 5, created_at: '', updated_at: '' },
    { id: 2, name: 'South Admissions Team', members_count: 4, created_at: '', updated_at: '' },
  ];

  const sampleStages: PipelineStage[] = [
    { id: 1, name: 'Cold Calling', order: 1, is_active: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');

    vi.spyOn(api, 'getStages').mockResolvedValue(sampleStages);
    vi.spyOn(api, 'getLeads').mockResolvedValue([]);
    vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
    vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, teamEmployee, otherTeamEmployee]);
    vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 5 });
    vi.spyOn(api, 'getUnassignedCount').mockResolvedValue({ count: 0 });
  });

  describe('1. Change Password Page & Form Validation', () => {
    it('renders current password, new password, confirm new password, requirements, and controls', () => {
      const handlePasswordChanged = vi.fn();
      const handleCancel = vi.fn();

      render(
        <ChangePasswordPage
          user={adminUser}
          onPasswordChanged={handlePasswordChanged}
          onCancel={handleCancel}
          onLogout={vi.fn()}
        />
      );

      // Verify headings and fields
      expect(screen.getByRole('heading', { name: /change your password/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/current password/i, { selector: 'input' })).toBeInTheDocument();
      expect(screen.getByLabelText(/new permanent password/i, { selector: 'input' })).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm new password/i, { selector: 'input' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to crm/i })).toBeInTheDocument();

      // Verify requirement checklist
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/new password and confirmation match/i)).toBeInTheDocument();
    });

    it('toggles password visibility with show/hide buttons', () => {
      render(
        <ChangePasswordPage
          user={adminUser}
          onPasswordChanged={vi.fn()}
          onLogout={vi.fn()}
        />
      );

      const currentInput = screen.getByLabelText(/current password/i, { selector: 'input' });
      const toggleCurrentBtn = screen.getByLabelText(/show current password/i);

      expect(currentInput).toHaveAttribute('type', 'password');
      fireEvent.click(toggleCurrentBtn);
      expect(currentInput).toHaveAttribute('type', 'text');
      expect(screen.getByLabelText(/hide current password/i)).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText(/hide current password/i));
      expect(currentInput).toHaveAttribute('type', 'password');
    });

    it('validates password policy and mismatch before submission', async () => {
      render(
        <ChangePasswordPage
          user={adminUser}
          onPasswordChanged={vi.fn()}
          onLogout={vi.fn()}
        />
      );

      const currentInput = screen.getByLabelText(/current password/i, { selector: 'input' });
      const newInput = screen.getByLabelText(/new permanent password/i, { selector: 'input' });
      const confirmInput = screen.getByLabelText(/confirm new password/i, { selector: 'input' });
      const submitBtn = screen.getByRole('button', { name: /update password/i });

      // Password too short (< 8)
      fireEvent.change(currentInput, { target: { value: 'CurrentPass123' } });
      fireEvent.change(newInput, { target: { value: 'short' } });
      fireEvent.change(confirmInput, { target: { value: 'short' } });
      fireEvent.click(submitBtn);

      expect(await screen.findByText(/new password must be at least 8 characters long/i)).toBeInTheDocument();

      // Mismatched passwords
      fireEvent.change(newInput, { target: { value: 'SecureNewPassword123' } });
      fireEvent.change(confirmInput, { target: { value: 'DifferentPassword123' } });
      fireEvent.click(submitBtn);

      expect(await screen.findByText(/new password and confirmation do not match/i)).toBeInTheDocument();
    });

    it('submits valid change request and calls onPasswordChanged on success', async () => {
      const handlePasswordChanged = vi.fn();
      vi.spyOn(api, 'changePassword').mockResolvedValue({
        detail: 'Password changed successfully.',
        token: 'new_fresh_token_456',
        user: { ...adminUser, must_change_password: false },
      });

      render(
        <ChangePasswordPage
          user={adminUser}
          onPasswordChanged={handlePasswordChanged}
          onLogout={vi.fn()}
        />
      );

      fireEvent.change(screen.getByLabelText(/current password/i, { selector: 'input' }), { target: { value: 'OldPassword123!' } });
      fireEvent.change(screen.getByLabelText(/new permanent password/i, { selector: 'input' }), { target: { value: 'NewSecurePassword123!' } });
      fireEvent.change(screen.getByLabelText(/confirm new password/i, { selector: 'input' }), { target: { value: 'NewSecurePassword123!' } });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      await waitFor(() => {
        expect(api.changePassword).toHaveBeenCalledWith({
          old_password: 'OldPassword123!',
          new_password: 'NewSecurePassword123!',
          confirm_password: 'NewSecurePassword123!',
        });
        expect(handlePasswordChanged).toHaveBeenCalledWith(
          expect.objectContaining({ username: 'admin@skillmove.com' }),
          'new_fresh_token_456'
        );
      });
    });

    it('displays error message when current password is invalid', async () => {
      vi.spyOn(api, 'changePassword').mockRejectedValue(new Error('Current password is not correct.'));

      render(
        <ChangePasswordPage
          user={adminUser}
          onPasswordChanged={vi.fn()}
          onLogout={vi.fn()}
        />
      );

      fireEvent.change(screen.getByLabelText(/current password/i, { selector: 'input' }), { target: { value: 'WrongCurrentPassword' } });
      fireEvent.change(screen.getByLabelText(/new permanent password/i, { selector: 'input' }), { target: { value: 'NewSecurePassword123!' } });
      fireEvent.change(screen.getByLabelText(/confirm new password/i, { selector: 'input' }), { target: { value: 'NewSecurePassword123!' } });

      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      expect(await screen.findByText(/current password is not correct/i)).toBeInTheDocument();
    });
  });

  describe('2. Employee Self-Service Reset Request & Email Unavailable Alert', () => {
    it('reports email delivery is unavailable when outbound email service is not configured', async () => {
      vi.spyOn(api, 'requestPasswordReset').mockResolvedValue({
        detail: 'Password reset token generated.',
        email_sent: false,
        email_delivery: 'UNAVAILABLE',
        reset_token: 'raw_test_token_789',
        reset_url: 'http://localhost:5173/?token=raw_test_token_789',
        expires_in_minutes: 15,
        delivery_note: 'Outbound email delivery is not configured on this server.',
      });

      render(
        <PasswordResetModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      // Verify request form
      expect(screen.getByRole('heading', { name: /account recovery/i })).toBeInTheDocument();
      const identifierInput = screen.getByPlaceholderText(/rohit\.sharma@skillmove\.in/i);
      fireEvent.change(identifierInput, { target: { value: 'counsellor.north@skillmove.in' } });

      fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

      // Verify unconfigured email alert is displayed clearly
      await waitFor(() => {
        expect(screen.getByText(/email delivery unavailable/i)).toBeInTheDocument();
        expect(screen.getByText(/external smtp credentials are not configured in this environment/i)).toBeInTheDocument();
        expect(screen.getByText(/raw_test_token_789/i)).toBeInTheDocument();
      });

      // User can click "Proceed to Set Password" to proceed directly with token
      fireEvent.click(screen.getByRole('button', { name: /proceed to set password/i }));
      expect(await screen.findByRole('heading', { name: /set new password/i })).toBeInTheDocument();
    });

    it('confirms reset token and updates password', async () => {
      const handleSuccess = vi.fn();
      vi.spyOn(api, 'confirmPasswordReset').mockResolvedValue({
        detail: 'Password reset successfully completed.',
        token: 'new_session_token_999',
        user: teamEmployee,
      });

      render(
        <PasswordResetModal
          isOpen={true}
          initialToken="prefilled_token_abc"
          onClose={vi.fn()}
          onSuccess={handleSuccess}
        />
      );

      // Confirm step should be active
      expect(screen.getByRole('heading', { name: /set new password/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('prefilled_token_abc')).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText(/at least 8 characters/i), { target: { value: 'BrandNewSecurePass123!' } });
      fireEvent.change(screen.getByPlaceholderText(/re-enter new password/i), { target: { value: 'BrandNewSecurePass123!' } });

      fireEvent.click(screen.getByRole('button', { name: /reset password & sign in/i }));

      await waitFor(() => {
        expect(api.confirmPasswordReset).toHaveBeenCalledWith({
          token: 'prefilled_token_abc',
          new_password: 'BrandNewSecurePass123!',
          confirm_password: 'BrandNewSecurePass123!',
        });
        expect(handleSuccess).toHaveBeenCalledWith(teamEmployee, 'new_session_token_999');
      });
    });
  });

  describe('3. Admin and Manager Reset Actions & Authorization', () => {
    it('Admin sees Reset button for all employees in User Management', async () => {
      const paginatedUsers: PaginatedResponse<User> = {
        count: 2,
        total_pages: 1,
        page: 1,
        page_size: 50,
        results: [teamEmployee, otherTeamEmployee],
      };
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(paginatedUsers);

      render(
        <UserManagementPage
          currentUser={adminUser}
          teams={sampleTeams}
        />
      );

      // Wait for table to load
      await waitFor(() => {
        expect(screen.getByText('North Counsellor')).toBeInTheDocument();
      });

      // Admin can see reset button for both North Counsellor and South Counsellor
      expect(document.getElementById('reset-user-btn-10')).toBeInTheDocument();
      expect(document.getElementById('reset-user-btn-20')).toBeInTheDocument();
    });

    it('Manager sees Reset button ONLY for employees within their authorized team', async () => {
      const paginatedUsers: PaginatedResponse<User> = {
        count: 2,
        total_pages: 1,
        page: 1,
        page_size: 50,
        results: [teamEmployee, otherTeamEmployee],
      };
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(paginatedUsers);

      render(
        <UserManagementPage
          currentUser={managerUser}
          teams={sampleTeams}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('North Counsellor')).toBeInTheDocument();
      });

      // Manager of Team 1 can reset Team 1 employee (North Counsellor)
      expect(document.getElementById('reset-user-btn-10')).toBeInTheDocument();

      // Manager of Team 1 CANNOT reset Team 2 employee (South Counsellor)
      expect(document.getElementById('reset-user-btn-20')).not.toBeInTheDocument();
    });

    it('AdminResetPasswordModal warns about session invalidation, calls API, and reports email status', async () => {
      vi.spyOn(api, 'adminResetPassword').mockResolvedValue({
        detail: 'Password reset initiated for North Counsellor.',
        employee_name: 'North Counsellor',
        employee_id: 'EMP-0010',
        email: 'counsellor.north@skillmove.in',
        temporary_password: 'Gen@TempPass987',
        reset_token: 'admin_reset_token_xyz',
        reset_url: 'http://localhost:5173/?token=admin_reset_token_xyz',
        expires_in_seconds: 900,
        email_sent: false,
        email_delivery: 'UNAVAILABLE',
        sessions_invalidated: true,
        must_change_password: true,
      });

      render(
        <AdminResetPasswordModal
          user={teamEmployee}
          onClose={vi.fn()}
        />
      );

      // Confirmation step
      expect(screen.getByRole('heading', { name: /initiate secure password reset/i })).toBeInTheDocument();
      expect(screen.getByText(/Existing active user sessions and refresh tokens will be immediately invalidated/i)).toBeInTheDocument();
      expect(screen.getAllByText(/North Counsellor/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/EMP-0010/i)).toBeInTheDocument();

      // Click Confirm & Reset
      const confirmBtn = screen.getByRole('button', { name: /confirm & reset password/i });
      fireEvent.click(confirmBtn);

      // Verify API was called
      await waitFor(() => {
        expect(api.adminResetPassword).toHaveBeenCalledWith(teamEmployee.id);
      });

      // Credentials screen should appear
      expect(await screen.findByRole('heading', { name: /password reset successful/i })).toBeInTheDocument();
      expect(screen.getByText(/Gen@TempPass987/i)).toBeInTheDocument();
      expect(screen.getByText(/admin_reset_token_xyz/i)).toBeInTheDocument();

      // Email delivery unavailable report must be clearly visible
      expect(screen.getByText(/email delivery unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/outbound email service is not configured on this server\. no reset email was sent\./i)).toBeInTheDocument();

      // Action buttons
      expect(screen.getAllByRole('button', { name: /copy/i })[0]).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy full message/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
    });
  });
});
