import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';
import { Sidebar } from '../components/Sidebar';
import { api } from '../services/api';
import { User, Lead, PipelineStage, Team } from '../types';

describe('Sidebar Navigation and Routing Architecture', () => {
  const adminUser: User = {
    id: 1,
    username: 'admin@skillmove.edu',
    email: 'admin@skillmove.edu',
    role: 'ADMIN',
  };

  const managerUser: User = {
    id: 2,
    username: 'manager@skillmove.edu',
    email: 'manager@skillmove.edu',
    role: 'MANAGER',
    team: 1,
    team_name: 'Skill Move Admissions',
    managed_team_id: 1,
    managed_team_name: 'Skill Move Admissions',
  };

  const counsellorUser: User = {
    id: 3,
    username: 'counsellor@skillmove.edu',
    email: 'counsellor@skillmove.edu',
    role: 'SALES_EMPLOYEE',
    team: 1,
    team_name: 'Skill Move Admissions',
  };

  const sample12Stages: PipelineStage[] = [
    { id: 1, name: 'Cold Calling', order: 1, is_active: true },
    { id: 2, name: 'Not Connected', order: 2, is_active: true },
    { id: 3, name: 'New Lead', order: 3, is_active: true },
    { id: 4, name: 'Contacted', order: 4, is_active: true },
    { id: 5, name: 'Interested', order: 5, is_active: true },
    { id: 6, name: 'Prospect', order: 6, is_active: true },
    { id: 7, name: 'FollowUp', order: 7, is_active: true },
    { id: 8, name: 'Negotation', order: 8, is_active: true },
    { id: 9, name: 'pendingClosure', order: 9, is_active: true },
    { id: 10, name: 'Enrolled', order: 10, is_active: true },
    { id: 11, name: 'Not Interested', order: 11, is_active: true },
    { id: 12, name: 'Lost', order: 12, is_active: true },
  ];

  const sampleLeads: Lead[] = [
    {
      id: 1,
      lead_id: 'SM-LD-0001',
      name: 'Aakash Sharma',
      title: 'Aakash Sharma',
      contact_name: 'Aakash Sharma',
      email: 'aakash@example.com',
      phone: '+919876543210',
      qualification: 'B.Tech CS',
      college: 'Delhi Technological University',
      yop: '2025',
      key_skills: 'Python, React',
      target_role: 'Full Stack',
      experience: 'Fresher',
      company: '',
      stage: 1,
      stage_name: 'Cold Calling',
      priority: 'High',
      status: 'Active',
      estimated_revenue: 50000,
      placement_fee: 5000,
      career_counsellor: 'counsellor@skillmove.edu',
      city: 'Delhi',
      next_follow_up: '2026-10-10T10:00:00Z',
      assigned_employee: 3,
      assigned_employee_name: 'counsellor@skillmove.edu',
      team: 1,
      team_name: 'Skill Move Admissions',
      created_by: 1,
      created_by_name: 'admin@skillmove.edu',
      created_at: '2026-10-09T08:00:00Z',
      updated_at: '2026-10-09T08:00:00Z',
      archived_at: null,
    },
    {
      id: 2,
      lead_id: 'SM-LD-0002',
      name: 'Priya Patel',
      title: 'Priya Patel',
      contact_name: 'Priya Patel',
      email: 'priya@example.com',
      phone: '+919812345678',
      qualification: 'B.E IT',
      college: 'PICT Pune',
      yop: '2024',
      key_skills: 'Java, Spring',
      target_role: 'Backend',
      experience: '1 year',
      company: 'Tech Corp',
      stage: 5,
      stage_name: 'Interested',
      priority: 'Medium',
      status: 'Active',
      estimated_revenue: 60000,
      placement_fee: 6000,
      career_counsellor: 'counsellor@skillmove.edu',
      city: 'Pune',
      next_follow_up: '2026-10-12T14:00:00Z',
      assigned_employee: 3,
      assigned_employee_name: 'counsellor@skillmove.edu',
      team: 1,
      team_name: 'Skill Move Admissions',
      created_by: 1,
      created_by_name: 'admin@skillmove.edu',
      created_at: '2026-10-09T08:30:00Z',
      updated_at: '2026-10-09T08:30:00Z',
      archived_at: null,
    },
  ];

  const sampleTeams: Team[] = [
    {
      id: 1,
      name: 'Skill Move Admissions',
      manager: 2,
      manager_name: 'manager@skillmove.edu',
      members_count: 2,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  // 1. MAIN NAVIGATION TESTS
  describe('1. Main Sidebar Navigation Items', () => {
    it('Dashboard navigation item opens Dashboard without stage filter', async () => {
      localStorage.setItem('crm_token', 'admin-token');
      vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);
      vi.spyOn(api, 'getLeads').mockResolvedValue(sampleLeads);
      vi.spyOn(api, 'getStages').mockResolvedValue(sample12Stages);
      vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 1, 5: 1 });
      vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
      vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, counsellorUser]);

      render(<App />);
      expect(await screen.findByText('Executive Admin Dashboard')).toBeInTheDocument();

      const dashboardBtn = screen.getByRole('button', { name: /Admin Dashboard/i });
      expect(dashboardBtn).toHaveClass('bg-[#2563EB]'); // Active highlight
    });

    it('Pipeline Stages header toggles expansion without navigating or altering the page', async () => {
      localStorage.setItem('crm_token', 'admin-token');
      vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);
      vi.spyOn(api, 'getLeads').mockResolvedValue(sampleLeads);
      vi.spyOn(api, 'getStages').mockResolvedValue(sample12Stages);
      vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 1, 5: 1 });
      vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
      vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, counsellorUser]);

      render(<App />);
      expect(await screen.findByText('Executive Admin Dashboard')).toBeInTheDocument();

      const pipelineTrigger = screen.getByRole('button', { name: /Pipeline Stages \(12\)/i });
      expect(pipelineTrigger).toHaveAttribute('aria-expanded', 'false');

      // Click trigger
      fireEvent.click(pipelineTrigger);

      // Submenu expanded
      expect(pipelineTrigger).toHaveAttribute('aria-expanded', 'true');
      // Still on Executive Admin Dashboard, NOT redirected to All Leads!
      expect(screen.getByText('Executive Admin Dashboard')).toBeInTheDocument();
      expect(window.location.search).toBe('');
    });

    it('Import Leads navigation item opens Bulk Import Leads page without redirecting to All Leads', async () => {
      localStorage.setItem('crm_token', 'admin-token');
      vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);
      vi.spyOn(api, 'getLeads').mockResolvedValue(sampleLeads);
      vi.spyOn(api, 'getStages').mockResolvedValue(sample12Stages);
      vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 1, 5: 1 });
      vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
      vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, counsellorUser]);

      render(<App />);
      expect(await screen.findByText('Executive Admin Dashboard')).toBeInTheDocument();

      const importBtn = document.getElementById('sidebar-import-nav-item')!;
      fireEvent.click(importBtn);

      // Verify Bulk Import Page opens
      expect(await screen.findByRole('heading', { name: /Bulk Import Leads/i })).toBeInTheDocument();
      expect(window.location.search).toContain('view=import');

      // Active state highlight: Import Leads is active, Dashboard is NOT
      expect(importBtn).toHaveClass('bg-[#2563EB]');
      const dashboardBtn = document.getElementById('sidebar-dashboard-nav-item')!;
      expect(dashboardBtn).not.toHaveClass('bg-[#2563EB]');
    });

    it('Unassigned Leads navigation item opens Unassigned Leads page', async () => {
      localStorage.setItem('crm_token', 'admin-token');
      vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);
      vi.spyOn(api, 'getLeads').mockResolvedValue(sampleLeads);
      vi.spyOn(api, 'getStages').mockResolvedValue(sample12Stages);
      vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 1, 5: 1 });
      vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
      vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, counsellorUser]);
      vi.spyOn(api, 'getUnassignedLeads').mockResolvedValue([]);

      render(<App />);
      expect(await screen.findByText('Executive Admin Dashboard')).toBeInTheDocument();

      const unassignedBtn = document.getElementById('unassigned-leads-nav-item')!;
      fireEvent.click(unassignedBtn);

      expect((await screen.findAllByText('Unassigned Leads Queue')).length).toBeGreaterThan(0);
      expect(window.location.search).toContain('view=unassigned');
    });
  });

  // 2. PIPELINE SUBMENU NAVIGATION TESTS
  describe('2. Pipeline Submenu Navigation', () => {
    it('All Pipeline Stages submenu item navigates to All Leads view without filter', async () => {
      localStorage.setItem('crm_token', 'admin-token');
      vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);
      vi.spyOn(api, 'getLeads').mockResolvedValue(sampleLeads);
      vi.spyOn(api, 'getStages').mockResolvedValue(sample12Stages);
      vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 1, 5: 1 });
      vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
      vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, counsellorUser]);

      render(<App />);
      expect(await screen.findByText('Executive Admin Dashboard')).toBeInTheDocument();

      // Expand Pipeline
      const pipelineTrigger = document.getElementById('pipeline-stages-trigger')!;
      fireEvent.click(pipelineTrigger);

      // Click All Pipeline Stages
      const allStagesBtn = document.getElementById('pipeline-all-stages-btn')!;
      fireEvent.click(allStagesBtn);

      // Verify spreadsheet view opens
      expect(await screen.findByText('SM-LD-0001')).toBeInTheDocument();
      expect(screen.getByText('SM-LD-0002')).toBeInTheDocument();
      expect(window.location.search).toContain('view=spreadsheet');
      expect(window.location.search).not.toContain('stage=');
    });

    it('Clicking Cold Calling stage submenu item navigates directly to filtered view', async () => {
      localStorage.setItem('crm_token', 'admin-token');
      vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);
      vi.spyOn(api, 'getLeads').mockResolvedValue(sampleLeads);
      vi.spyOn(api, 'getStages').mockResolvedValue(sample12Stages);
      vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 1, 5: 1 });
      vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
      vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, counsellorUser]);

      render(<App />);
      expect(await screen.findByText('Executive Admin Dashboard')).toBeInTheDocument();

      // Expand pipeline
      fireEvent.click(document.getElementById('pipeline-stages-trigger')!);

      // Click Cold Calling (stage 1)
      const coldCallingBtn = document.getElementById('pipeline-stage-btn-1')!;
      fireEvent.click(coldCallingBtn);

      // Verify filtered view: Cold Calling Pipeline heading appears
      expect(await screen.findByText('Cold Calling Pipeline')).toBeInTheDocument();
      expect(window.location.search).toContain('view=spreadsheet');
      expect(window.location.search).toContain('stage=1');

      // Lead in stage 1 is shown, lead in stage 5 is filtered out
      expect(screen.getByText('Aakash Sharma')).toBeInTheDocument();
      expect(screen.queryByText('Priya Patel')).not.toBeInTheDocument();

      // Active highlighting: Cold Calling is active, All Pipeline Stages is NOT active
      expect(coldCallingBtn).toHaveClass('bg-[#EFF6FF]');
      const allStagesBtn = document.getElementById('pipeline-all-stages-btn')!;
      expect(allStagesBtn).not.toHaveClass('bg-[#EFF6FF]');
    });

    it('Clicking stage submenu item from Import Leads view switches directly to pipeline filtered view', async () => {
      localStorage.setItem('crm_token', 'admin-token');
      window.history.replaceState({}, '', '/?view=import');
      vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);
      vi.spyOn(api, 'getLeads').mockResolvedValue(sampleLeads);
      vi.spyOn(api, 'getStages').mockResolvedValue(sample12Stages);
      vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 1, 5: 1 });
      vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
      vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, counsellorUser]);

      render(<App />);
      expect(await screen.findByRole('heading', { name: /Bulk Import Leads/i })).toBeInTheDocument();

      // Expand pipeline from Import Leads
      fireEvent.click(document.getElementById('pipeline-stages-trigger')!);

      // Click Interested stage (stage 5)
      const interestedBtn = document.getElementById('pipeline-stage-btn-5')!;
      fireEvent.click(interestedBtn);

      // Directly switches from Import Leads to Interested Pipeline!
      expect(await screen.findByText('Interested Pipeline')).toBeInTheDocument();
      expect(window.location.search).toContain('view=spreadsheet');
      expect(window.location.search).toContain('stage=5');
      expect(screen.getByText('Priya Patel')).toBeInTheDocument();
      expect(screen.queryByText('Aakash Sharma')).not.toBeInTheDocument();
    });
  });

  // 3. BROWSER NAVIGATION & POPSTATE TESTS
  describe('3. Browser Navigation and Popstate', () => {
    it('navigates via browser back and forward popstate events correctly', async () => {
      localStorage.setItem('crm_token', 'admin-token');
      vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);
      vi.spyOn(api, 'getLeads').mockResolvedValue(sampleLeads);
      vi.spyOn(api, 'getStages').mockResolvedValue(sample12Stages);
      vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 1, 5: 1 });
      vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
      vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, counsellorUser]);

      render(<App />);
      expect(await screen.findByText('Executive Admin Dashboard')).toBeInTheDocument();

      // Navigate to Import Leads
      fireEvent.click(document.getElementById('sidebar-import-nav-item')!);
      expect(await screen.findByRole('heading', { name: /Bulk Import Leads/i })).toBeInTheDocument();

      // Simulate Browser Back to Dashboard
      window.history.pushState({}, '', '/');
      fireEvent(window, new PopStateEvent('popstate'));

      expect(await screen.findByText('Executive Admin Dashboard')).toBeInTheDocument();

      // Simulate Browser Forward to Import
      window.history.pushState({}, '', '/?view=import');
      fireEvent(window, new PopStateEvent('popstate'));

      expect(await screen.findByRole('heading', { name: /Bulk Import Leads/i })).toBeInTheDocument();
    });

    it('renders clean 404 Page Not Found view when unknown view is requested in URL', async () => {
      localStorage.setItem('crm_token', 'admin-token');
      window.history.replaceState({}, '', '/?view=nonexistent_page');
      vi.spyOn(api, 'getMe').mockResolvedValue(adminUser);
      vi.spyOn(api, 'getLeads').mockResolvedValue(sampleLeads);
      vi.spyOn(api, 'getStages').mockResolvedValue(sample12Stages);
      vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 1, 5: 1 });
      vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
      vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, counsellorUser]);

      render(<App />);

      // Shows 404 screen instead of silently defaulting or opening All Leads
      expect(await screen.findByText(/Page Not Found \(404\)/i)).toBeInTheDocument();
      expect(screen.getByText(/The requested CRM navigation destination or route does not exist/i)).toBeInTheDocument();

      // Click Return to Dashboard button
      const backBtn = screen.getByRole('button', { name: /Return to Dashboard/i });
      fireEvent.click(backBtn);

      expect(await screen.findByText('Executive Admin Dashboard')).toBeInTheDocument();
    });
  });

  // 4. ROLE-BASED ACCESS CONTROL TESTS
  describe('4. Role-based Navigation Protection', () => {
    it('hides Unassigned Leads and Import Leads from Sales Employee sidebar', () => {
      render(
        <Sidebar
          user={counsellorUser}
          activeView="dashboard"
          onViewChange={vi.fn()}
          stages={sample12Stages}
          onOpenReports={vi.fn()}
          onOpenStages={vi.fn()}
          onLogout={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /Unassigned Leads/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Import Leads/i })).not.toBeInTheDocument();
    });

    it('displays 403 Access Restricted screen when Sales Employee navigates directly to ?view=import', async () => {
      localStorage.setItem('crm_token', 'counsellor-token');
      window.history.replaceState({}, '', '/?view=import');
      vi.spyOn(api, 'getMe').mockResolvedValue(counsellorUser);
      vi.spyOn(api, 'getLeads').mockResolvedValue(sampleLeads);
      vi.spyOn(api, 'getStages').mockResolvedValue(sample12Stages);
      vi.spyOn(api, 'getStageCounts').mockResolvedValue({ 1: 1, 5: 1 });
      vi.spyOn(api, 'getTeams').mockResolvedValue(sampleTeams);
      vi.spyOn(api, 'getUsers').mockResolvedValue([adminUser, managerUser, counsellorUser]);

      render(<App />);

      expect(await screen.findByText(/Access Restricted \(403\)/i)).toBeInTheDocument();
      expect(screen.getByText(/You do not have administrative authorization/i)).toBeInTheDocument();

      // Return to My Dashboard
      fireEvent.click(screen.getByRole('button', { name: /Return to My Dashboard/i }));
      expect(await screen.findByText('Career Counsellor Dashboard')).toBeInTheDocument();
    });
  });
});
