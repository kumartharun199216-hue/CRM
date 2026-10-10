import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { App } from '../App';
import { Sidebar } from '../components/Sidebar';
import { UserManagementPage } from '../components/UserManagementPage';
import { api } from '../services/api';
import { User, Lead, PipelineStage, Team, PaginatedResponse } from '../types';

describe('Task 2 — User Management List and Navigation', () => {
  const adminUser: User = {
    id: 1,
    employee_id: 'EMP-0001',
    username: 'admin@skillmove.edu',
    email: 'admin@skillmove.edu',
    first_name: 'Super',
    last_name: 'Admin',
    full_name: 'Super Admin',
    role: 'ADMIN',
    designation: 'System Administrator',
    is_active: true,
    account_status: 'ACTIVE',
    date_joined: '2026-01-01T00:00:00Z',
  };

  const managerUser: User = {
    id: 2,
    employee_id: 'EMP-0002',
    username: 'manager@skillmove.edu',
    email: 'manager@skillmove.edu',
    first_name: 'Rajesh',
    last_name: 'Khanna',
    full_name: 'Rajesh Khanna',
    role: 'MANAGER',
    designation: 'Sales Manager',
    team: 1,
    team_name: 'Skill Move Admissions',
    managed_team_id: 1,
    managed_team_name: 'Skill Move Admissions',
    is_active: true,
    account_status: 'ACTIVE',
    date_joined: '2026-01-05T00:00:00Z',
  };

  const counsellorUser: User = {
    id: 3,
    employee_id: 'EMP-0003',
    username: 'counsellor@skillmove.edu',
    email: 'counsellor@skillmove.edu',
    first_name: 'Sneha',
    last_name: 'Rao',
    full_name: 'Sneha Rao',
    role: 'SALES_EMPLOYEE',
    designation: 'Career Counsellor',
    team: 1,
    team_name: 'Skill Move Admissions',
    reporting_manager_id: 2,
    reporting_manager_name: 'Rajesh Khanna',
    is_active: true,
    account_status: 'ACTIVE',
    mobile_number: '+91 98765 43210',
    date_joined: '2026-02-01T00:00:00Z',
  };

  const inactiveUser: User = {
    id: 4,
    employee_id: 'EMP-0004',
    username: 'inactive@skillmove.edu',
    email: 'inactive@skillmove.edu',
    first_name: 'Inactive',
    last_name: 'User',
    full_name: 'Inactive User',
    role: 'SALES_EMPLOYEE',
    designation: 'Career Counsellor',
    team: 1,
    team_name: 'Skill Move Admissions',
    reporting_manager_id: 2,
    reporting_manager_name: 'Rajesh Khanna',
    is_active: false,
    account_status: 'INACTIVE',
    mobile_number: '+91 98000 11111',
    date_joined: '2026-02-15T00:00:00Z',
  };

  const samplePaginatedUsers: PaginatedResponse<User> = {
    count: 4,
    total_pages: 1,
    page: 1,
    page_size: 50,
    next: null,
    previous: null,
    results: [adminUser, managerUser, counsellorUser, inactiveUser],
  };

  const sampleTeams: Team[] = [
    {
      id: 1,
      name: 'Skill Move Admissions',
      manager: 2,
      manager_name: 'manager@skillmove.edu',
      members_count: 3,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  // 1. SIDEBAR NAVIGATION
  describe('1. Sidebar Navigation and Dedicated Route', () => {
    it('renders Users item in left sidebar for Admin and Manager, but hides it from Sales Employee', () => {
      // Admin
      const { unmount: unmountAdmin } = render(
        <Sidebar
          user={adminUser}
          activeView="dashboard"
          onViewChange={vi.fn()}
          onOpenReports={vi.fn()}
          onOpenStages={vi.fn()}
          onLogout={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /^users$/i })).toBeInTheDocument();
      unmountAdmin();

      // Manager
      const { unmount: unmountManager } = render(
        <Sidebar
          user={managerUser}
          activeView="dashboard"
          onViewChange={vi.fn()}
          onOpenReports={vi.fn()}
          onOpenStages={vi.fn()}
          onLogout={vi.fn()}
        />
      );
      expect(screen.getByRole('button', { name: /^users$/i })).toBeInTheDocument();
      unmountManager();

      // Counsellor
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
      expect(screen.queryByRole('button', { name: /^users$/i })).not.toBeInTheDocument();
    });

    it('clicking Users in sidebar navigates to ?view=users and highlights the item', async () => {
      localStorage.setItem('crm_token', 'admin-token');
      vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);
      vi.spyOn(api, 'getLeads').mockResolvedValue([]);
      vi.spyOn(api, 'getStages').mockResolvedValue([]);
      vi.spyOn(api, 'getStageCounts').mockResolvedValue({});
      vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
      vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, counsellorUser]);
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(samplePaginatedUsers);

      render(<App />);
      expect(await screen.findByText('Executive Admin Dashboard')).toBeInTheDocument();

      const usersBtn = document.getElementById('sidebar-users-nav-item')!;
      fireEvent.click(usersBtn);

      // Verify User Management page opens
      expect(await screen.findByRole('heading', { name: /^User Management$/i })).toBeInTheDocument();
      expect(window.location.search).toContain('view=users');

      // Verify active button class
      expect(usersBtn).toHaveClass('bg-[#2563EB]');
    });

    it('sales employee navigating to ?view=users is presented with Access Restricted 403 screen', async () => {
      localStorage.setItem('crm_token', 'counsellor-token');
      window.history.replaceState({}, '', '/?view=users');

      vi.spyOn(api, 'getMe').mockResolvedValue(counsellorUser);
      vi.spyOn(api, 'getLeads').mockResolvedValue([]);
      vi.spyOn(api, 'getStages').mockResolvedValue([]);
      vi.spyOn(api, 'getStageCounts').mockResolvedValue({});
      vi.spyOn(api, 'getTeams').mockResolvedValue([]);
      vi.spyOn(api, 'getUsers').mockResolvedValue([]);

      render(<App />);

      expect(await screen.findByText(/Access Restricted \(403\)/i)).toBeInTheDocument();
      expect(screen.getByText(/User Management/i)).toBeInTheDocument();
      expect(screen.queryByRole('table', { name: /employees/i })).not.toBeInTheDocument();
    });
  });

  // 2. EMPLOYEE TABLE AND COLUMNS
  describe('2. Responsive Employee Table and Column Requirements', () => {
    it('renders all required employee columns and values', async () => {
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(samplePaginatedUsers);

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      expect(await screen.findByText('User Management')).toBeInTheDocument();

      // Check table headers
      expect(screen.getByText('Employee ID')).toBeInTheDocument();
      expect(screen.getByText('Full Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Mobile Number')).toBeInTheDocument();
      expect(screen.getByText('Role')).toBeInTheDocument();
      expect(screen.getByText('Designation')).toBeInTheDocument();
      expect(screen.getByText('Team')).toBeInTheDocument();
      expect(screen.getByText('Reporting Manager')).toBeInTheDocument();
      expect(screen.getByText('Account Status')).toBeInTheDocument();
      expect(screen.getByText('Date Created')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();

      // Check employee record values
      expect(screen.getByText('EMP-0001')).toBeInTheDocument();
      expect(screen.getByText('Super Admin')).toBeInTheDocument();
      expect(screen.getByText('admin@skillmove.edu')).toBeInTheDocument();
      expect(screen.getByText('System Administrator')).toBeInTheDocument();

      expect(screen.getByText('EMP-0003')).toBeInTheDocument();
      expect(screen.getByText('Sneha Rao')).toBeInTheDocument();
      expect(screen.getByText('counsellor@skillmove.edu')).toBeInTheDocument();
      expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
      expect(screen.getAllByText('Career Counsellor').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Skill Move Admissions').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Rajesh Khanna').length).toBeGreaterThan(0);

      // Account Status badges
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(3);
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });

    it('clicking Details button opens Employee Profile overview modal', async () => {
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(samplePaginatedUsers);

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);
      expect(await screen.findByText('Sneha Rao')).toBeInTheDocument();

      const detailsBtn = document.getElementById('view-user-btn-3')!;
      fireEvent.click(detailsBtn);

      // Modal appears
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getAllByText('counsellor@skillmove.edu').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('+91 98765 43210').length).toBeGreaterThanOrEqual(1);

      // Close modal
      const closeBtn = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeBtn);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // 3. SEARCH, FILTERS AND PAGINATION
  describe('3. Search, Filters and Pagination', () => {
    it('searches by name, email, phone, or employee ID and calls API with debounced param', async () => {
      const getPaginatedSpy = vi.spyOn(api, 'getUsersPaginated').mockResolvedValue({
        count: 1,
        total_pages: 1,
        page: 1,
        page_size: 50,
        next: null,
        previous: null,
        results: [counsellorUser],
      });

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      const searchInput = screen.getByPlaceholderText(/search by employee name/i);
      fireEvent.change(searchInput, { target: { value: 'Sneha' } });

      await waitFor(() => {
        expect(getPaginatedSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Sneha',
            page: 1,
          })
        );
      });
    });

    it('filters by role and team', async () => {
      const getPaginatedSpy = vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(samplePaginatedUsers);

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      const roleSelect = screen.getByLabelText(/role:/i);
      fireEvent.change(roleSelect, { target: { value: 'MANAGER' } });

      await waitFor(() => {
        expect(getPaginatedSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'MANAGER',
          })
        );
      });

      const teamSelect = screen.getByLabelText(/team:/i);
      fireEvent.change(teamSelect, { target: { value: '1' } });

      await waitFor(() => {
        expect(getPaginatedSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            team: '1',
          })
        );
      });
    });

    it('filters by account status (active/inactive)', async () => {
      const getPaginatedSpy = vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(samplePaginatedUsers);

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      const statusSelect = screen.getByLabelText(/status:/i);
      fireEvent.change(statusSelect, { target: { value: 'inactive' } });

      await waitFor(() => {
        expect(getPaginatedSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'inactive',
          })
        );
      });
    });

    it('handles pagination next and previous controls', async () => {
      const getPaginatedSpy = vi.spyOn(api, 'getUsersPaginated').mockResolvedValue({
        count: 100,
        total_pages: 2,
        page: 1,
        page_size: 50,
        next: '/api/auth/users/?page=2',
        previous: null,
        results: [adminUser, managerUser],
      });

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();

      const nextBtn = document.getElementById('users-next-page-btn')!;
      fireEvent.click(nextBtn);

      await waitFor(() => {
        expect(getPaginatedSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
          })
        );
      });
    });

    it('renders empty state when no employees match filters', async () => {
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue({
        count: 0,
        total_pages: 1,
        page: 1,
        page_size: 50,
        next: null,
        previous: null,
        results: [],
      });

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      expect(await screen.findByText('No employees found')).toBeInTheDocument();
      expect(screen.getByText(/no employee records matched your active search/i)).toBeInTheDocument();
    });

    it('renders error banner with retry option on API failure', async () => {
      vi.spyOn(api, 'getUsersPaginated').mockRejectedValueOnce(new Error('Database timeout error'));

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      expect(await screen.findByText('Database timeout error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  // 4. EMPLOYEE CREATION WORKFLOW AND ROLE POLICIES
  describe('4. Employee Account Creation Workflow and Permissions', () => {
    it('renders Add Employee button for Admin and Manager, but hides it for Sales Employee', async () => {
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(samplePaginatedUsers);

      // Admin
      const { unmount: unmountAdmin } = render(
        <UserManagementPage currentUser={adminUser} teams={sampleTeams} />
      );
      expect(await screen.findByRole('button', { name: /add employee/i })).toBeInTheDocument();
      unmountAdmin();

      // Manager
      const { unmount: unmountManager } = render(
        <UserManagementPage currentUser={managerUser} teams={sampleTeams} />
      );
      expect(await screen.findByRole('button', { name: /add employee/i })).toBeInTheDocument();
      unmountManager();

      // Sales Employee
      render(<UserManagementPage currentUser={counsellorUser} teams={sampleTeams} />);
      expect(screen.queryByRole('button', { name: /add employee/i })).not.toBeInTheDocument();
    });

    it('clicking Add Employee opens modal with form fields and system-managed banner', async () => {
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(samplePaginatedUsers);

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      const addBtn = await screen.findByRole('button', { name: /add employee/i });
      fireEvent.click(addBtn);

      // Verify modal is displayed
      const modal = await screen.findByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(within(modal).getByRole('heading', { name: /add new employee/i })).toBeInTheDocument();
      expect(within(modal).getByText(/system managed setup/i)).toBeInTheDocument();

      // Verify fields inside modal
      expect(within(modal).getByLabelText(/full name/i)).toBeInTheDocument();
      expect(within(modal).getByLabelText(/email address/i)).toBeInTheDocument();
      expect(within(modal).getByLabelText(/mobile number/i)).toBeInTheDocument();
      expect(within(modal).getByLabelText(/^role/i)).toBeInTheDocument();
      expect(within(modal).getByLabelText(/^team/i)).toBeInTheDocument();
      expect(within(modal).getByLabelText(/designation/i)).toBeInTheDocument();
      expect(within(modal).getByLabelText(/department/i)).toBeInTheDocument();
      expect(within(modal).getByLabelText(/work location/i)).toBeInTheDocument();
      expect(within(modal).getByLabelText(/date of joining/i)).toBeInTheDocument();

      // Close modal
      const cancelBtn = within(modal).getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtn);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('validates required fields on submission and shows inline errors', async () => {
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(samplePaginatedUsers);

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      const addBtn = await screen.findByRole('button', { name: /add employee/i });
      fireEvent.click(addBtn);

      const submitBtn = screen.getByRole('button', { name: /create account/i });
      fireEvent.click(submitBtn);

      // Required field validation messages
      expect(await screen.findByText('Full Name is required.')).toBeInTheDocument();
      expect(screen.getByText('Email Address is required.')).toBeInTheDocument();
      expect(screen.getByText('Mobile Number is required.')).toBeInTheDocument();
    });

    it('successfully submits employee form, calls api.createUser, closes modal and displays success toast', async () => {
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(samplePaginatedUsers);
      const createUserSpy = vi.spyOn(api, 'createUser').mockResolvedValue({
        id: 5,
        employee_id: 'EMP-0005',
        username: 'aarav.patel',
        email: 'aarav.patel@skillmove.in',
        full_name: 'Aarav Patel',
        first_name: 'Aarav',
        last_name: 'Patel',
        role: 'SALES_EMPLOYEE',
        designation: 'Senior Counsellor',
        team: 1,
        team_name: 'Skill Move Admissions',
        is_active: true,
        account_status: 'ACTIVE',
        date_joined: '2026-10-10T00:00:00Z',
      });

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      const addBtn = await screen.findByRole('button', { name: /add employee/i });
      fireEvent.click(addBtn);

      // Fill in required fields
      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Aarav Patel' } });
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'aarav.patel@skillmove.in' } });
      fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+91 98765 11223' } });
      fireEvent.change(screen.getByLabelText(/designation/i), { target: { value: 'Senior Counsellor' } });

      const submitBtn = screen.getByRole('button', { name: /create account/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createUserSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            full_name: 'Aarav Patel',
            email: 'aarav.patel@skillmove.in',
            mobile_number: '+91 98765 11223',
            role: 'SALES_EMPLOYEE',
            designation: 'Senior Counsellor',
          })
        );
      });

      // Success modal opens
      const successModal = await screen.findByRole('dialog');
      expect(within(successModal).getByRole('heading', { name: /account created successfully/i })).toBeInTheDocument();
      expect(within(successModal).getAllByText(/EMP-0005/i).length).toBeGreaterThan(0);

      // Closing success modal clears credentials from state
      const closeSuccessBtn = document.getElementById('close-success-panel-btn')!;
      fireEvent.click(closeSuccessBtn);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('locks role and team to authorized values when opened by Manager', async () => {
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(samplePaginatedUsers);

      render(<UserManagementPage currentUser={managerUser} teams={sampleTeams} />);

      const addBtn = await screen.findByRole('button', { name: /add employee/i });
      fireEvent.click(addBtn);

      const modal = await screen.findByRole('dialog');

      // In Manager mode, role is fixed to Career Counsellor
      expect(within(modal).getByText('Career Counsellor')).toBeInTheDocument();
      expect(within(modal).getByText('Authorized')).toBeInTheDocument();

      // Team is locked to manager's authorized team
      expect(within(modal).getByText('Skill Move Admissions')).toBeInTheDocument();
      expect(within(modal).getByText('Locked')).toBeInTheDocument();
    });
  });

  // 5. TASK 4 — SECURE ONBOARDING CREDENTIALS & SUCCESS PANEL
  describe('5. Secure Employee Onboarding Credentials Panel', () => {
    it('displays Success Panel with all employee details, temporary password and personalized template', async () => {
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(samplePaginatedUsers);
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const newUserResponse: User = {
        id: 5,
        employee_id: 'EMP-0005',
        username: 'aarav.patel',
        email: 'aarav.patel@skillmove.in',
        mobile_number: '+91 98765 11223',
        full_name: 'Aarav Patel',
        first_name: 'Aarav',
        last_name: 'Patel',
        role: 'SALES_EMPLOYEE',
        designation: 'Senior Counsellor',
        team: 1,
        team_name: 'Skill Move Admissions',
        is_active: true,
        account_status: 'ACTIVE',
        temporary_password: 'T3mp!SecurePass',
        login_url: 'http://localhost:5173/',
        date_joined: '2026-10-10T00:00:00Z',
      };

      vi.spyOn(api, 'createUser').mockResolvedValue(newUserResponse);

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      const addBtn = await screen.findByRole('button', { name: /add employee/i });
      fireEvent.click(addBtn);

      const modal = await screen.findByRole('dialog');

      // Fill in required fields
      fireEvent.change(within(modal).getByLabelText(/full name/i), { target: { value: 'Aarav Patel' } });
      fireEvent.change(within(modal).getByLabelText(/email address/i), { target: { value: 'aarav.patel@skillmove.in' } });
      fireEvent.change(within(modal).getByLabelText(/mobile number/i), { target: { value: '+91 98765 11223' } });
      fireEvent.change(within(modal).getByLabelText(/team/i), { target: { value: '1' } });

      const submitBtn = within(modal).getByRole('button', { name: /create account/i });
      fireEvent.click(submitBtn);

      // Success Panel Dialog appears
      const successHeading = await screen.findByRole('heading', { name: /account created successfully/i });
      expect(successHeading).toBeInTheDocument();
      const successModal = screen.getByRole('dialog');

      // Check all 8 required fields
      expect(within(successModal).getAllByText('Aarav Patel').length).toBeGreaterThan(0);
      expect(within(successModal).getAllByText('EMP-0005').length).toBeGreaterThan(0);
      expect(within(successModal).getAllByText('aarav.patel@skillmove.in').length).toBeGreaterThan(0);
      expect(within(successModal).getAllByText('+91 98765 11223').length).toBeGreaterThan(0);
      expect(within(successModal).getAllByText('Career Counsellor').length).toBeGreaterThan(0);
      expect(within(successModal).getAllByText('Skill Move Admissions').length).toBeGreaterThan(0);
      expect(within(successModal).getAllByText('http://localhost:5173/').length).toBeGreaterThan(0);
      expect(within(successModal).getAllByText('T3mp!SecurePass').length).toBeGreaterThan(0);

      // Check personalized onboarding template message
      const templateEl = within(successModal).getByText(/welcome to skill move sales crm!/i);
      expect(templateEl).toBeInTheDocument();
      expect(templateEl.textContent).toContain('Hello Aarav Patel,');
      expect(templateEl.textContent).toContain('Employee ID: EMP-0005');
      expect(templateEl.textContent).toContain('Login URL: http://localhost:5173/');
      expect(templateEl.textContent).toContain('Email: aarav.patel@skillmove.in');
      expect(templateEl.textContent).toContain('Temporary Password: T3mp!SecurePass');
      expect(templateEl.textContent).toContain('Please log in and change your temporary password immediately.');

      // Test Copy Login Message
      const copyMsgBtn = document.getElementById('copy-login-message-btn')!;
      fireEvent.click(copyMsgBtn);
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('Hello Aarav Patel,'));
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('Temporary Password: T3mp!SecurePass'));

      // Test Copy Email
      const copyEmailBtn = document.getElementById('copy-email-btn')!;
      fireEvent.click(copyEmailBtn);
      expect(writeTextMock).toHaveBeenCalledWith('aarav.patel@skillmove.in');

      // Test Copy Temporary Password
      const copyPwdBtn = document.getElementById('copy-temporary-password-btn')!;
      fireEvent.click(copyPwdBtn);
      expect(writeTextMock).toHaveBeenCalledWith('T3mp!SecurePass');

      // Test Close clears modal and temporary credentials
      const closeBtn = document.getElementById('close-success-panel-btn')!;
      fireEvent.click(closeBtn);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not display success panel when account creation fails', async () => {
      vi.spyOn(api, 'getUsersPaginated').mockResolvedValue(samplePaginatedUsers);
      vi.spyOn(api, 'createUser').mockRejectedValue(new Error('Email already registered in CRM'));

      render(<UserManagementPage currentUser={adminUser} teams={sampleTeams} />);

      const addBtn = await screen.findByRole('button', { name: /add employee/i });
      fireEvent.click(addBtn);

      const modal = await screen.findByRole('dialog');

      fireEvent.change(within(modal).getByLabelText(/full name/i), { target: { value: 'Duplicate User' } });
      fireEvent.change(within(modal).getByLabelText(/email address/i), { target: { value: 'dup@skillmove.in' } });
      fireEvent.change(within(modal).getByLabelText(/mobile number/i), { target: { value: '+91 98765 99999' } });
      fireEvent.change(within(modal).getByLabelText(/team/i), { target: { value: '1' } });

      const submitBtn = within(modal).getByRole('button', { name: /create account/i });
      fireEvent.click(submitBtn);

      // Form remains open and displays error banner
      expect((await screen.findAllByText('Email already registered in CRM')).length).toBeGreaterThan(0);
      // Success modal is NOT displayed
      expect(screen.queryByRole('heading', { name: /account created successfully/i })).not.toBeInTheDocument();
    });
  });
});
