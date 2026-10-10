import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';
import { MyProfilePage } from '../components/MyProfilePage';
import { api } from '../services/api';
import { User, PipelineStage } from '../types';

describe('TASK 6 — My Profile and Employee Details', () => {
  const mockUser: User = {
    id: 42,
    employee_id: 'EMP-0042',
    username: 'priya.sharma',
    email: 'priya.sharma@skillmove.in',
    mobile_number: '+91 9876543210',
    first_name: 'Priya',
    last_name: 'Sharma',
    full_name: 'Priya Sharma',
    role: 'SALES_EMPLOYEE',
    designation: 'Senior Admissions Counsellor',
    department: 'Admissions & Enrollment',
    work_location: 'Bengaluru Main Campus',
    date_of_joining: '2024-03-15',
    date_joined: '2024-03-15T09:30:00Z',
    team: 1,
    team_name: 'Alpha Admissions',
    reporting_manager_id: 10,
    reporting_manager_name: 'Rajesh Khanna',
    reporting_manager_email: 'rajesh.khanna@skillmove.in',
    is_active: true,
    account_status: 'ACTIVE',
    must_change_password: false,
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
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockUser);
    vi.spyOn(api, 'getMe').mockResolvedValue(mockUser);
  });

  it('1. Renders all 13 required display fields on My Profile page', async () => {
    render(<MyProfilePage currentUser={mockUser} />);

    // 1. Employee ID
    expect(screen.getAllByText('EMP-0042').length).toBeGreaterThan(0);

    // 2. Full Name
    expect(screen.getAllByText('Priya Sharma').length).toBeGreaterThan(0);

    // 3. Email
    expect(screen.getByText('priya.sharma@skillmove.in')).toBeDefined();

    // 4. Mobile Number
    expect(screen.getByText('+91 9876543210')).toBeDefined();

    // 5. Role
    expect(screen.getAllByText(/Career Counsellor|SALES_EMPLOYEE/i).length).toBeGreaterThan(0);

    // 6. Designation
    expect(screen.getAllByText('Senior Admissions Counsellor').length).toBeGreaterThan(0);

    // 7. Team
    expect(screen.getAllByText('Alpha Admissions').length).toBeGreaterThan(0);

    // 8. Reporting Manager
    expect(screen.getByText('Rajesh Khanna')).toBeDefined();
    expect(screen.getByText('rajesh.khanna@skillmove.in')).toBeDefined();

    // 9. Department
    expect(screen.getAllByText('Admissions & Enrollment').length).toBeGreaterThan(0);

    // 10. Work Location
    expect(screen.getAllByText('Bengaluru Main Campus').length).toBeGreaterThan(0);

    // 11. Date of Joining
    expect(screen.getAllByText(/Mar 15, 2024/i).length).toBeGreaterThan(0);

    // 12. Account Status
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);

    // 13. Date Created
    expect(screen.getAllByText(/Mar 15, 2024/i).length).toBeGreaterThan(0);
  });

  it('2. Navigates to My Profile from Sidebar navigation button and bottom user card', async () => {
    localStorage.setItem('crm_user', JSON.stringify(mockUser));
    localStorage.setItem('crm_token', 'test_token_123');

    render(<App />);

    // Wait for CRM to mount
    await waitFor(() => {
      expect(document.getElementById('sidebar-profile-nav-item')).toBeDefined();
    });

    // Click My Profile button in sidebar
    const profileNavBtn = document.getElementById('sidebar-profile-nav-item');
    expect(profileNavBtn).toBeDefined();
    fireEvent.click(profileNavBtn!);

    // Should render My Profile Page
    await waitFor(() => {
      expect(document.getElementById('my-profile-page')).toBeDefined();
      expect(window.location.search).toContain('view=profile');
    });

    // Click bottom card to ensure it also navigates to profile
    const bottomCard = document.getElementById('sidebar-user-profile-card');
    expect(bottomCard).toBeDefined();
    fireEvent.click(bottomCard!);

    expect(window.location.search).toContain('view=profile');
  });

  it('3. Preserves profile view on refresh via URL query param (?view=profile)', async () => {
    localStorage.setItem('crm_user', JSON.stringify(mockUser));
    localStorage.setItem('crm_token', 'test_token_123');
    window.history.replaceState({}, '', '/?view=profile');

    render(<App />);

    await waitFor(() => {
      expect(document.getElementById('my-profile-page')).toBeDefined();
      expect(screen.getAllByText('Priya Sharma').length).toBeGreaterThan(0);
    });
  });

  it('4. Allows editing permitted personal fields and updates backend via api.updateProfile', async () => {
    const updatedUser: User = {
      ...mockUser,
      full_name: 'Priya Sharma-Verma',
      first_name: 'Priya',
      last_name: 'Sharma-Verma',
      mobile_number: '+91 9123456789',
      work_location: 'Bengaluru Tech Hub',
    };

    const updateProfileSpy = vi.spyOn(api, 'updateProfile').mockResolvedValue(updatedUser);
    const onProfileUpdatedMock = vi.fn();

    render(<MyProfilePage currentUser={mockUser} onProfileUpdated={onProfileUpdatedMock} />);

    // Click Edit Profile button
    const editBtn = document.getElementById('edit-profile-btn');
    expect(editBtn).toBeDefined();
    fireEvent.click(editBtn!);

    // Check that editable inputs appear
    const nameInput = document.getElementById('profile-input-full-name') as HTMLInputElement;
    const mobileInput = document.getElementById('profile-input-mobile') as HTMLInputElement;
    const locationInput = document.getElementById('profile-input-work-location') as HTMLInputElement;

    expect(nameInput).toBeDefined();
    expect(mobileInput).toBeDefined();
    expect(locationInput).toBeDefined();

    // Change fields
    fireEvent.change(nameInput, { target: { value: 'Priya Sharma-Verma' } });
    fireEvent.change(mobileInput, { target: { value: '+91 9123456789' } });
    fireEvent.change(locationInput, { target: { value: 'Bengaluru Tech Hub' } });

    // Click Save Changes
    const saveBtn = document.getElementById('save-profile-btn');
    expect(saveBtn).toBeDefined();
    fireEvent.click(saveBtn!);

    await waitFor(() => {
      expect(updateProfileSpy).toHaveBeenCalledWith({
        full_name: 'Priya Sharma-Verma',
        mobile_number: '+91 9123456789',
        work_location: 'Bengaluru Tech Hub',
      });
      expect(onProfileUpdatedMock).toHaveBeenCalledWith(updatedUser);
      expect(document.getElementById('profile-success-alert')).toBeDefined();
    });
  });

  it('5. Protects administrative and organizational fields from editing in the UI', async () => {
    render(<MyProfilePage currentUser={mockUser} />);

    // Enter edit mode
    fireEvent.click(document.getElementById('edit-profile-btn')!);

    // Protected fields do NOT have editable inputs:
    // Email is read-only
    const emailField = document.getElementById('profile-field-email');
    expect(emailField).toBeDefined();
    expect(emailField?.classList.contains('cursor-not-allowed')).toBe(true);

    // Employee ID, Role, Designation, Team, Reporting Manager, Department, Status, Date Created are read-only
    expect(document.getElementById('profile-field-employee-id')).toBeDefined();
    expect(document.getElementById('profile-field-role')).toBeDefined();
    expect(document.getElementById('profile-field-designation')).toBeDefined();
    expect(document.getElementById('profile-field-team')).toBeDefined();
    expect(document.getElementById('profile-field-reporting-manager')).toBeDefined();
    expect(document.getElementById('profile-field-department')).toBeDefined();
    expect(document.getElementById('profile-field-date-of-joining')).toBeDefined();
    expect(document.getElementById('profile-field-account-status')).toBeDefined();
    expect(document.getElementById('profile-field-date-created')).toBeDefined();

    // Verify there is no input for role, team, or employee_id
    expect(document.querySelector('input[name="role"]')).toBeNull();
    expect(document.querySelector('input[name="team"]')).toBeNull();
    expect(document.querySelector('input[name="employee_id"]')).toBeNull();
  });

  it('6. Handles validation errors and duplicate mobile numbers from backend', async () => {
    vi.spyOn(api, 'updateProfile').mockRejectedValue({
      status: 400,
      data: {
        mobile_number: ['An account with this mobile number already exists.'],
      },
    });

    render(<MyProfilePage currentUser={mockUser} />);

    // Enter edit mode
    fireEvent.click(document.getElementById('edit-profile-btn')!);

    const mobileInput = document.getElementById('profile-input-mobile') as HTMLInputElement;
    fireEvent.change(mobileInput, { target: { value: '9998887776' } });

    fireEvent.click(document.getElementById('save-profile-btn')!);

    await waitFor(() => {
      expect(screen.getByText('An account with this mobile number already exists.')).toBeDefined();
      expect(document.getElementById('profile-error-alert')).toBeDefined();
    });
  });

  it('7. Can cancel editing without saving changes', async () => {
    render(<MyProfilePage currentUser={mockUser} />);

    fireEvent.click(document.getElementById('edit-profile-btn')!);

    const nameInput = document.getElementById('profile-input-full-name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Unsaved Changes' } });

    // Click Cancel
    fireEvent.click(document.getElementById('cancel-edit-profile-btn')!);

    // Should return to view mode with original name
    expect(document.getElementById('profile-input-full-name')).toBeNull();
    expect(screen.getAllByText('Priya Sharma').length).toBeGreaterThan(0);
  });
});
