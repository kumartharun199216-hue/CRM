import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { App } from '../App';
import { api } from '../services/api';
import { User, PipelineStage } from '../types';

describe('TASK 5 — First-Login Password Change Enforcement', () => {
  const temporaryEmployee: User = {
    id: 10,
    employee_id: 'EMP-0010',
    username: 'rohit.sharma',
    email: 'rohit.sharma@skillmove.in',
    full_name: 'Rohit Sharma',
    role: 'SALES_EMPLOYEE',
    designation: 'Career Counsellor',
    team: 1,
    team_name: 'Skill Move Admissions',
    must_change_password: true,
    is_active: true,
    account_status: 'ACTIVE',
  };

  const permanentEmployee: User = {
    ...temporaryEmployee,
    must_change_password: false,
  };

  const adminUser: User = {
    id: 1,
    employee_id: 'EMP-0001',
    username: 'admin@skillmove.com',
    email: 'admin@skillmove.com',
    full_name: 'Admin Director',
    role: 'ADMIN',
    must_change_password: false,
    is_active: true,
    account_status: 'ACTIVE',
  };

  const sampleStages: PipelineStage[] = [
    { id: 1, name: 'Cold Calling', order: 1, is_active: true },
    { id: 2, name: 'Hot Lead', order: 2, is_active: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');

    vi.spyOn(api, 'getStages').mockResolvedValue(sampleStages);
    vi.spyOn(api, 'getLeads').mockResolvedValue([]);
    vi.spyOn(api, 'getTeams').mockResolvedValue([]);
    vi.spyOn(api, 'getUsers').mockResolvedValue([]);
    vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 5, 2: 3 });
    vi.spyOn(api, 'getUnassignedCount').mockResolvedValue({ count: 0 });
    vi.spyOn(api, 'getUnassignedLeads').mockResolvedValue([]);
  });

  it('1. Detects temporary-password on login and redirects to dedicated Change Password page', async () => {
    vi.spyOn(api, 'login').mockResolvedValue({
      token: 'temp_token_123',
      user: temporaryEmployee,
    });

    render(<App />);

    // Initially on Login Modal
    expect(await screen.findByRole('heading', { name: /skill move/i })).toBeInTheDocument();

    const usernameInput = screen.getByPlaceholderText(/name@skillmove.com/i);
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(usernameInput, { target: { value: 'rohit.sharma@skillmove.in' } });
    fireEvent.change(passwordInput, { target: { value: 'Temp@Password123!' } });
    fireEvent.click(submitBtn);

    // Redirected to Change Temporary Password page
    expect(await screen.findByRole('heading', { name: /change temporary password/i })).toBeInTheDocument();
    expect(screen.getByText(/first-login security requirement/i)).toBeInTheDocument();
    expect(screen.getByText(/Rohit Sharma/i)).toBeInTheDocument();
    expect(screen.getByText(/EMP-0010/i)).toBeInTheDocument();
    expect(screen.getByText(/rohit.sharma@skillmove.in/i)).toBeInTheDocument();

    // Protected Sidebar and pipeline views must NOT be rendered
    expect(screen.queryByText(/Admissions Pipeline/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /spreadsheet/i })).not.toBeInTheDocument();
  });

  it('2. Prevents access to protected CRM routes (e.g. ?view=spreadsheet) while restriction is active', async () => {
    localStorage.setItem('crm_token', 'temp_token_123');
    window.history.replaceState({}, '', '/?view=spreadsheet');

    vi.spyOn(api, 'getMe').mockResolvedValue(temporaryEmployee);
    const getLeadsSpy = vi.spyOn(api, 'getLeads');

    render(<App />);

    // Renders Change Password page even though URL requested ?view=spreadsheet
    expect(await screen.findByRole('heading', { name: /change temporary password/i })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/Pipeline Stages/i)).not.toBeInTheDocument();

    // Data fetching for protected leads is blocked while restricted
    expect(getLeadsSpy).not.toHaveBeenCalled();
  });

  it('3. Preserves restriction across page refresh and browser restart', async () => {
    localStorage.setItem('crm_token', 'existing_temp_token');
    vi.spyOn(api, 'getMe').mockResolvedValue(temporaryEmployee);

    render(<App />);

    // Automatically loads user session and enforces password change
    expect(await screen.findByRole('heading', { name: /change temporary password/i })).toBeInTheDocument();
    expect(screen.getByText(/Action Required/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/temporary \/ current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new permanent password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
  });

  it('4. Validates new password: checks minimum length, mismatch, and temporary password reuse', async () => {
    localStorage.setItem('crm_token', 'temp_token_123');
    vi.spyOn(api, 'getMe').mockResolvedValue(temporaryEmployee);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /change temporary password/i })).toBeInTheDocument();

    const currentInput = screen.getByLabelText(/temporary \/ current password/i);
    const newInput = screen.getByLabelText(/new permanent password/i);
    const confirmInput = screen.getByLabelText(/confirm new password/i);
    const submitBtn = screen.getByRole('button', { name: /save password & enter crm/i });

    // Test rejection when new password matches current temporary password
    fireEvent.change(currentInput, { target: { value: 'Temp@Password123!' } });
    fireEvent.change(newInput, { target: { value: 'Temp@Password123!' } });
    fireEvent.change(confirmInput, { target: { value: 'Temp@Password123!' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/cannot be the same as your temporary password/i)).toBeInTheDocument();

    // Test rejection when passwords don't match
    fireEvent.change(newInput, { target: { value: 'Permanent#Pass2026' } });
    fireEvent.change(confirmInput, { target: { value: 'Mismatched#Pass2026' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();

    // Test rejection when too short
    fireEvent.change(newInput, { target: { value: 'short' } });
    fireEvent.change(confirmInput, { target: { value: 'short' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('New password must be at least 8 characters long.')).toBeInTheDocument();
  });

  it('5. Permits only password change and logout operations; logout clears credentials', async () => {
    localStorage.setItem('crm_token', 'temp_token_123');
    vi.spyOn(api, 'getMe').mockResolvedValue(temporaryEmployee);
    const logoutSpy = vi.spyOn(api, 'logout').mockResolvedValue({ detail: 'Logged out successfully.' });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /change temporary password/i })).toBeInTheDocument();

    // Click Sign Out button
    const logoutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalled();
      expect(localStorage.getItem('crm_token')).toBeNull();
    });

    // Returned to Login Modal
    expect(await screen.findByRole('heading', { name: /skill move/i })).toBeInTheDocument();
  });

  it('6. Successful password change updates token, clears restriction, and loads CRM', async () => {
    localStorage.setItem('crm_token', 'temp_token_123');
    vi.spyOn(api, 'getMe').mockResolvedValue(temporaryEmployee);

    const changePasswordSpy = vi.spyOn(api, 'changePassword').mockResolvedValue({
      detail: 'Password changed successfully.',
      token: 'fresh_permanent_token_456',
      user: permanentEmployee,
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: /change temporary password/i })).toBeInTheDocument();

    const currentInput = screen.getByLabelText(/temporary \/ current password/i);
    const newInput = screen.getByLabelText(/new permanent password/i);
    const confirmInput = screen.getByLabelText(/confirm new password/i);
    const submitBtn = screen.getByRole('button', { name: /save password & enter crm/i });

    fireEvent.change(currentInput, { target: { value: 'Temp@Password123!' } });
    fireEvent.change(newInput, { target: { value: 'PermanentSecure#2026' } });
    fireEvent.change(confirmInput, { target: { value: 'PermanentSecure#2026' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(changePasswordSpy).toHaveBeenCalledWith({
        old_password: 'Temp@Password123!',
        new_password: 'PermanentSecure#2026',
        confirm_password: 'PermanentSecure#2026',
      });
      // Token is updated with rotated permanent token
      expect(localStorage.getItem('crm_token')).toBe('fresh_permanent_token_456');
    });

    // CRM Dashboard is now accessible!
    expect(await screen.findByText(/Career Counsellor Dashboard/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /change temporary password/i })).not.toBeInTheDocument();
  });

  it('7. Employees with permanent password and existing Admin/Manager log in normally without restriction', async () => {
    // Permanent employee login
    vi.spyOn(api, 'login').mockResolvedValue({
      token: 'perm_token_789',
      user: permanentEmployee,
    });

    render(<App />);

    const usernameInput = screen.getByPlaceholderText(/name@skillmove.com/i);
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(usernameInput, { target: { value: 'rohit.sharma@skillmove.in' } });
    fireEvent.change(passwordInput, { target: { value: 'PermanentSecure#2026' } });
    fireEvent.click(submitBtn);

    // Directly renders Counsellor Dashboard without showing Change Password page
    expect(await screen.findByText(/Career Counsellor Dashboard/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /change temporary password/i })).not.toBeInTheDocument();
  });

  it('8. Existing Admin logs in normally with full administrative access', async () => {
    localStorage.setItem('crm_token', 'admin_token_001');
    vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);

    render(<App />);

    // Directly enters Executive Admin Dashboard with administrative sidebar controls
    expect(await screen.findByText(/Executive Admin Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /change temporary password/i })).not.toBeInTheDocument();
  });
});
