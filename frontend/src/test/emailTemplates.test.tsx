import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { EmailTemplatesPage } from '../components/EmailTemplatesPage';
import { Sidebar } from '../components/Sidebar';
import { api } from '../services/api';
import { User, CommunicationTemplate } from '../types';

describe('Skill Move Sales CRM — Email Template Management Interface', () => {
  const adminUser: User = {
    id: 1,
    username: 'admin_test',
    email: 'admin@skillmove.com',
    full_name: 'Admin User',
    role: 'ADMIN',
  };

  const managerUser: User = {
    id: 2,
    username: 'manager_test',
    email: 'manager@skillmove.com',
    full_name: 'Manager User',
    role: 'MANAGER',
    team: 1,
    team_name: 'Admissions Alpha',
  };

  const employeeUser: User = {
    id: 3,
    username: 'counsellor_test',
    email: 'counsellor@skillmove.com',
    full_name: 'Sales Counsellor',
    role: 'SALES_EMPLOYEE',
    team: 1,
    team_name: 'Admissions Alpha',
  };

  const mockTemplates: CommunicationTemplate[] = [
    {
      id: 101,
      name: 'Welcome Course Guide',
      description: 'Introductory brochure for new student inquiries',
      channel: 'EMAIL',
      subject: 'Welcome to Skill Move {{lead_name}}',
      body: 'Hi {{lead_name}}, your counsellor is {{employee_name}} from {{company_name}}.',
      body_format: 'PLAIN',
      is_active: true,
      team: null,
      team_name: null,
      created_by: 1,
      created_by_name: 'admin_test',
      updated_by: 1,
      updated_by_name: 'admin_test',
      attachments_count: 1,
      attachments: [
        {
          id: 501,
          template: 101,
          original_filename: 'course_syllabus.pdf',
          file_size: 1048576,
          file_size_display: '1.0 MB',
          content_type: 'application/pdf',
          download_url: '/api/communications/attachments/501/download/',
          uploaded_by: 1,
          uploaded_by_name: 'admin_test',
          uploaded_at: '2026-10-10T10:00:00Z',
        },
      ],
      created_at: '2026-10-10T10:00:00Z',
      updated_at: '2026-10-10T10:00:00Z',
    },
    {
      id: 102,
      name: 'Fee Structure Followup',
      description: 'Breakdown of tuition and financing options',
      channel: 'EMAIL',
      subject: 'Fee Structure for {{lead_name}}',
      body: 'Dear {{lead_name}}, here are the financial details.',
      body_format: 'PLAIN',
      is_active: false,
      team: 1,
      team_name: 'Admissions Alpha',
      created_by: 2,
      created_by_name: 'manager_test',
      updated_by: 2,
      updated_by_name: 'manager_test',
      attachments_count: 0,
      attachments: [],
      created_at: '2026-10-10T11:00:00Z',
      updated_at: '2026-10-10T11:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'getTemplates').mockResolvedValue(mockTemplates);
    vi.spyOn(api, 'previewTemplate').mockResolvedValue({
      subject: 'Welcome to Skill Move Rahul Sharma',
      body: 'Hi Rahul Sharma, your counsellor is Priya Patel from Skill Move Sales CRM.',
      unresolved_placeholders: [],
      available_placeholders: {
        '{{lead_name}}': 'Lead / Contact Full Name',
        '{{employee_name}}': 'Assigned Counsellor Name',
        '{{company_name}}': 'Skill Move Sales CRM',
      },
      sample_data: {
        '{{lead_name}}': 'Rahul Sharma',
        '{{employee_name}}': 'Priya Patel',
        '{{company_name}}': 'Skill Move Sales CRM',
      },
    });
  });

  it('renders template list with names, subjects, attachment indicators, and active badges', async () => {
    render(<EmailTemplatesPage currentUser={adminUser} />);

    expect(screen.getByText('Email Template Management')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Welcome Course Guide')).toBeInTheDocument();
      expect(screen.getByText('Fee Structure Followup')).toBeInTheDocument();
    });

    // Check attachment indicators
    expect(screen.getByText('1 file')).toBeInTheDocument();
    expect(screen.getByText('No files')).toBeInTheDocument();

    // Check statuses
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('filters templates by search query', async () => {
    render(<EmailTemplatesPage currentUser={adminUser} />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Course Guide')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search templates by name/i);
    fireEvent.change(searchInput, { target: { value: 'Tuition' } });

    await waitFor(() => {
      expect(screen.getByText('Fee Structure Followup')).toBeInTheDocument();
      expect(screen.queryByText('Welcome Course Guide')).not.toBeInTheDocument();
    });
  });

  it('opens create modal with allowlisted placeholder insertion pills', async () => {
    render(<EmailTemplatesPage currentUser={adminUser} />);

    await waitFor(() => {
      expect(screen.getByText('Create Template')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Template'));

    expect(screen.getByText('Create New Email Template')).toBeInTheDocument();
    expect(screen.getByText('Safe Allowlisted Placeholders')).toBeInTheDocument();

    // Click placeholder pill to insert
    const leadNamePill = screen.getByRole('button', { name: '{{lead_name}}' });
    expect(leadNamePill).toBeInTheDocument();
    fireEvent.click(leadNamePill);

    const bodyTextarea = screen.getByPlaceholderText(/best regards/i);
    expect(bodyTextarea).toHaveValue(' {{lead_name}}');
  });

  it('opens preview modal and displays rendered sample values', async () => {
    render(<EmailTemplatesPage currentUser={adminUser} />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Course Guide')).toBeInTheDocument();
    });

    const previewButtons = screen.getAllByTitle('Preview rendered template');
    fireEvent.click(previewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Rendered Email Preview')).toBeInTheDocument();
      expect(screen.getByText('Welcome to Skill Move Rahul Sharma')).toBeInTheDocument();
      expect(screen.getByText(/your counsellor is Priya Patel/i)).toBeInTheDocument();
    });
  });

  it('toggles template active status when clicked by authorized Admin', async () => {
    const toggleSpy = vi.spyOn(api, 'toggleTemplateActive').mockResolvedValue({
      ...mockTemplates[0],
      is_active: false,
    });

    render(<EmailTemplatesPage currentUser={adminUser} />);

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    const activeToggle = screen.getByText('Active');
    fireEvent.click(activeToggle);

    await waitFor(() => {
      expect(toggleSpy).toHaveBeenCalledWith(101);
    });
  });

  it('renders Email Templates navigation item in Sidebar for Admin and Manager, but not for Sales Employee', () => {
    const onViewChange = vi.fn();

    // Admin sidebar
    const { unmount: unmountAdmin } = render(
      <Sidebar
        user={adminUser}
        activeView="dashboard"
        onViewChange={onViewChange}
        onOpenReports={vi.fn()}
        onOpenStages={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /email templates/i })).toBeInTheDocument();
    unmountAdmin();

    // Manager sidebar
    const { unmount: unmountManager } = render(
      <Sidebar
        user={managerUser}
        activeView="dashboard"
        onViewChange={onViewChange}
        onOpenReports={vi.fn()}
        onOpenStages={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /email templates/i })).toBeInTheDocument();
    unmountManager();

    // Sales employee sidebar
    render(
      <Sidebar
        user={employeeUser}
        activeView="dashboard"
        onViewChange={onViewChange}
        onOpenReports={vi.fn()}
        onOpenStages={vi.fn()}
        onLogout={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /email templates/i })).not.toBeInTheDocument();
  });
});
