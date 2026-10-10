import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChangeStageModal } from '../components/ChangeStageModal';
import { SpreadsheetView } from '../components/SpreadsheetView';
import { Lead360Modal } from '../components/Lead360Modal';
import { api } from '../services/api';
import { User, Lead, PipelineStage, LeadStageHistory, LeadTimelineResponse } from '../types';

describe('Lead Stage Transitions, Audit Timeline and 360° Lead Overview', () => {
  const adminUser: User = {
    id: 1,
    username: 'admin@skillmove.com',
    email: 'admin@skillmove.com',
    role: 'ADMIN',
  };

  const managerUser: User = {
    id: 2,
    username: 'manager@skillmove.com',
    email: 'manager@skillmove.com',
    role: 'MANAGER',
    team: 1,
    team_name: 'Skill Move Admissions',
    managed_team_id: 1,
    managed_team_name: 'Skill Move Admissions',
  };

  const counsellorUser: User = {
    id: 3,
    username: 'counsellor@skillmove.com',
    email: 'counsellor@skillmove.com',
    role: 'SALES_EMPLOYEE',
    team: 1,
    team_name: 'Skill Move Admissions',
  };

  const otherCounsellorUser: User = {
    id: 4,
    username: 'other@skillmove.com',
    email: 'other@skillmove.com',
    role: 'SALES_EMPLOYEE',
    team: 2,
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

  const sampleLead: Lead = {
    id: 101,
    lead_id: 'SM-LD-0101',
    name: 'Aakash Sharma',
    title: 'Aakash Sharma',
    contact_name: 'Aakash Sharma',
    email: 'aakash@example.com',
    phone: '+919876543210',
    qualification: 'B.Tech CSE',
    college: 'IIT Delhi',
    yop: '2024',
    key_skills: 'Python, SQL',
    target_role: 'Data Engineer',
    experience: 'Fresher',
    company: '',
    stage: 1,
    stage_name: 'Cold Calling',
    priority: 'High',
    status: 'In Progress',
    estimated_revenue: '45000',
    placement_fee: '15000',
    career_counsellor: 'counsellor@skillmove.com',
    city: 'New Delhi',
    next_follow_up: '2026-10-15T10:00:00Z',
    team: 1,
    team_name: 'Skill Move Admissions',
    assigned_employee: 3,
    assigned_employee_name: 'counsellor@skillmove.com',
    created_by: 1,
    created_by_name: 'admin@skillmove.com',
    created_at: '2026-10-01T09:00:00Z',
    updated_at: '2026-10-05T14:30:00Z',
    archived_at: null,
    last_stage_change: {
      timestamp: '2026-10-05T14:30:00Z',
      changed_by: 'admin@skillmove.com',
      changed_by_name: 'Admin User',
      from_stage_id: null,
      from_stage_name: 'Initial',
      to_stage_id: 1,
      to_stage_name: 'Cold Calling',
      note: 'Initial stage assigned after campaign intake',
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. ChangeStageModal tests
  describe('ChangeStageModal', () => {
    it('renders lead ID, lead name, and current stage', () => {
      render(
        <ChangeStageModal
          lead={sampleLead}
          isOpen={true}
          stages={sample12Stages}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByText('SM-LD-0101')).toBeInTheDocument();
      expect(screen.getByText('Aakash Sharma')).toBeInTheDocument();
      expect(screen.getByText('1. Cold Calling')).toBeInTheDocument();
    });

    it('populates destination stage dropdown in pipeline order without hardcoding', () => {
      render(
        <ChangeStageModal
          lead={sampleLead}
          isOpen={true}
          stages={sample12Stages}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      const select = screen.getByLabelText(/Destination Stage/i) as HTMLSelectElement;
      expect(select).toBeInTheDocument();
      // Should have 1 placeholder + 12 stages
      expect(select.options.length).toBe(13);
      expect(select.options[1].text).toContain('1. Cold Calling');
      expect(select.options[2].text).toContain('2. Not Connected');
      expect(select.options[10].text).toContain('10. Enrolled');
    });

    it('validates mandatory note and displays error when missing or whitespace', async () => {
      render(
        <ChangeStageModal
          lead={sampleLead}
          isOpen={true}
          stages={sample12Stages}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      const confirmBtn = screen.getByRole('button', { name: /Confirm Stage Change/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/A note explaining the reason for the stage change is mandatory/i)).toBeInTheDocument();
      });

      // Whitespace note
      const textarea = screen.getByPlaceholderText(/Provide a mandatory note explaining the rationale/i);
      fireEvent.change(textarea, { target: { value: '    \n   ' } });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/A note explaining the reason for the stage change is mandatory/i)).toBeInTheDocument();
      });
    });

    it('calls api.changeLeadStage with destination stage, note, and expected current stage', async () => {
      const mockChangeLeadStage = vi.spyOn(api, 'changeLeadStage').mockResolvedValue({
        detail: 'Stage successfully changed to Not Connected.',
        lead: { ...sampleLead, stage: 2, stage_name: 'Not Connected' },
        stage_history: {
          id: 50,
          lead: 101,
          from_stage: 1,
          from_stage_name: 'Cold Calling',
          to_stage: 2,
          to_stage_name: 'Not Connected',
          changed_by: 1,
          changed_by_name: 'admin@skillmove.com',
          note: 'Called twice, candidate did not pick up phone.',
          timestamp: '2026-10-09T12:00:00Z',
        },
      });

      const onSuccess = vi.fn();
      render(
        <ChangeStageModal
          lead={sampleLead}
          isOpen={true}
          stages={sample12Stages}
          onClose={vi.fn()}
          onSuccess={onSuccess}
        />
      );

      const select = screen.getByLabelText(/Destination Stage/i);
      fireEvent.change(select, { target: { value: '2' } });

      const textarea = screen.getByPlaceholderText(/Provide a mandatory note explaining the rationale/i);
      fireEvent.change(textarea, { target: { value: 'Called twice, candidate did not pick up phone.' } });

      const confirmBtn = screen.getByRole('button', { name: /Confirm Stage Change/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockChangeLeadStage).toHaveBeenCalledWith(101, {
          destination_stage_id: 2,
          note: 'Called twice, candidate did not pick up phone.',
          expected_current_stage_id: 1,
        });
      });
    });
  });

  // 2. SpreadsheetView tests
  describe('SpreadsheetView Change Stage Action', () => {
    it('displays Change Stage action button for authorized Admin', () => {
      const onChangeStage = vi.fn();
      render(
        <SpreadsheetView
          leads={[sampleLead]}
          stages={sample12Stages}
          currentUser={adminUser}
          onOpenLead={vi.fn()}
          onOpenHistory={vi.fn()}
          onCommunicate={vi.fn()}
          onChangeStage={onChangeStage}
        />
      );

      const stageBtn = screen.getByTitle(/Change Pipeline Stage/i);
      expect(stageBtn).toBeInTheDocument();
      fireEvent.click(stageBtn);
      expect(onChangeStage).toHaveBeenCalledWith(sampleLead);
    });

    it('displays Change Stage button for assigned Counsellor', () => {
      const onChangeStage = vi.fn();
      render(
        <SpreadsheetView
          leads={[sampleLead]}
          stages={sample12Stages}
          currentUser={counsellorUser}
          onOpenLead={vi.fn()}
          onOpenHistory={vi.fn()}
          onCommunicate={vi.fn()}
          onChangeStage={onChangeStage}
        />
      );

      const stageBtn = screen.getByTitle(/Change Pipeline Stage/i);
      expect(stageBtn).toBeInTheDocument();
    });

    it('does NOT display Change Stage button for unauthorized cross-team Counsellor', () => {
      render(
        <SpreadsheetView
          leads={[sampleLead]}
          stages={sample12Stages}
          currentUser={otherCounsellorUser}
          onOpenLead={vi.fn()}
          onOpenHistory={vi.fn()}
          onCommunicate={vi.fn()}
          onChangeStage={vi.fn()}
        />
      );

      const stageBtn = screen.queryByTitle(/Change Pipeline Stage/i);
      expect(stageBtn).not.toBeInTheDocument();
    });
  });

  // 3. Lead360Modal tests
  describe('Lead360Modal Stage Information & Activity Timeline', () => {
    it('displays stage information including date, changed by, and most recent note', async () => {
      vi.spyOn(api, 'getStageHistory').mockResolvedValue([]);
      vi.spyOn(api, 'getAssignmentHistory').mockResolvedValue([]);
      vi.spyOn(api, 'getCommunicationLogs').mockResolvedValue([]);
      vi.spyOn(api, 'getLeadTimeline').mockResolvedValue({
        lead_id: 101,
        lead_code: 'SM-LD-0101',
        lead_name: 'Aakash Sharma',
        current_stage_id: 1,
        current_stage_name: 'Cold Calling',
        count: 0,
        timeline: [],
      });

      render(
        <Lead360Modal
          lead={sampleLead}
          isOpen={true}
          stages={sample12Stages}
          users={[adminUser, counsellorUser]}
          currentUser={adminUser}
          onClose={vi.fn()}
          onEditLead={vi.fn()}
          onCommunicate={vi.fn()}
          onAssignEmployee={vi.fn()}
          onChangeStage={vi.fn()}
        />
      );

      expect(screen.getByText(/Pipeline Stage & Transition Overview/i)).toBeInTheDocument();
      expect(screen.getByText('Initial stage assigned after campaign intake', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    it('renders Activity Timeline tab and displays chronological timeline events', async () => {
      vi.spyOn(api, 'getStageHistory').mockResolvedValue([]);
      vi.spyOn(api, 'getAssignmentHistory').mockResolvedValue([]);
      vi.spyOn(api, 'getCommunicationLogs').mockResolvedValue([]);
      vi.spyOn(api, 'getLeadTimeline').mockResolvedValue({
        lead_id: 101,
        lead_code: 'SM-LD-0101',
        lead_name: 'Aakash Sharma',
        current_stage_id: 2,
        current_stage_name: 'Not Connected',
        count: 2,
        timeline: [
          {
            id: 'stage-1',
            event_type: 'STAGE_CHANGED',
            title: 'Stage changed to Not Connected',
            description: 'Moved from Cold Calling to Not Connected',
            actor_name: 'Admin User',
            timestamp: '2026-10-09T10:00:00Z',
            timestamp_display: 'Oct 09, 2026 10:00 AM',
            note: 'Phone rang with no answer',
            before_value: 'Cold Calling',
            after_value: 'Not Connected',
          },
          {
            id: 'lead-created-101',
            event_type: 'LEAD_CREATED',
            title: 'Lead Created',
            description: 'Lead registered in system',
            actor_name: 'Admin User',
            timestamp: '2026-10-01T09:00:00Z',
            timestamp_display: 'Oct 01, 2026 09:00 AM',
          },
        ],
      });

      render(
        <Lead360Modal
          lead={sampleLead}
          isOpen={true}
          stages={sample12Stages}
          users={[adminUser, counsellorUser]}
          currentUser={adminUser}
          onClose={vi.fn()}
          onEditLead={vi.fn()}
          onCommunicate={vi.fn()}
          onAssignEmployee={vi.fn()}
          onChangeStage={vi.fn()}
        />
      );

      // Click Activity Timeline tab
      const timelineTab = screen.getByRole('button', { name: /Activity Timeline/i });
      fireEvent.click(timelineTab);

      await waitFor(() => {
        expect(screen.getByText('Stage changed to Not Connected')).toBeInTheDocument();
        expect(screen.getByText('Phone rang with no answer', { exact: false })).toBeInTheDocument();
        expect(screen.getByText('Lead Created')).toBeInTheDocument();
      });
    });

    it('renders Stage History tab displaying previous stage, destination stage, changed by, and mandatory note', async () => {
      vi.spyOn(api, 'getStageHistory').mockResolvedValue([
        {
          id: 1,
          lead: 101,
          from_stage: 1,
          from_stage_name: 'Cold Calling',
          to_stage: 2,
          to_stage_name: 'Not Connected',
          changed_by: 1,
          changed_by_name: 'Admin User',
          note: 'Called morning batch candidate, line busy.',
          timestamp: '2026-10-09T11:00:00Z',
        },
      ]);
      vi.spyOn(api, 'getAssignmentHistory').mockResolvedValue([]);
      vi.spyOn(api, 'getCommunicationLogs').mockResolvedValue([]);
      vi.spyOn(api, 'getLeadTimeline').mockResolvedValue({
        lead_id: 101,
        lead_code: 'SM-LD-0101',
        lead_name: 'Aakash Sharma',
        current_stage_id: 2,
        current_stage_name: 'Not Connected',
        count: 1,
        timeline: [],
      });

      render(
        <Lead360Modal
          lead={sampleLead}
          isOpen={true}
          stages={sample12Stages}
          users={[adminUser, counsellorUser]}
          currentUser={adminUser}
          onClose={vi.fn()}
          onEditLead={vi.fn()}
          onCommunicate={vi.fn()}
          onAssignEmployee={vi.fn()}
          onChangeStage={vi.fn()}
        />
      );

      const stageHistoryTab = screen.getByRole('button', { name: /Stage History/i });
      fireEvent.click(stageHistoryTab);

      await waitFor(() => {
        expect(screen.getByText('Cold Calling')).toBeInTheDocument();
        expect(screen.getByText('Not Connected')).toBeInTheDocument();
        expect(screen.getByText('Admin User')).toBeInTheDocument();
        expect(screen.getByText('Called morning batch candidate, line busy.', { exact: false })).toBeInTheDocument();
      });
    });
  });
});
