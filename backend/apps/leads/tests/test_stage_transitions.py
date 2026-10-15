import pytest
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import Lead, PipelineStage, LeadStageHistory, LeadAssignmentHistory
from apps.audit.models import AuditEvent
from apps.communications.models import CommunicationLog, CommunicationChannel, CommunicationStatus

EXPECTED_STAGES = [
    (1, "Cold Calling"),
    (2, "Not Connected"),
    (3, "New Lead"),
    (4, "Contacted"),
    (5, "Interested"),
    (6, "Prospect"),
    (7, "FollowUp"),
    (8, "Negotation"),
    (9, "Pending Closure"),
    (10, "Enrolled"),
    (11, "Not Interested"),
    (12, "Lost"),
]


@pytest.mark.django_db(transaction=True)
class TestLeadStageTransitionsAndTimeline:
    def setup_method(self):
        self.client = APIClient()

        # Seed pipeline stages
        for order, name in EXPECTED_STAGES:
            PipelineStage.objects.update_or_create(
                order=order,
                defaults={'name': name, 'is_active': True}
            )

        self.stage1 = PipelineStage.objects.get(order=1)
        self.stage2 = PipelineStage.objects.get(order=2)
        self.stage3 = PipelineStage.objects.get(order=3)
        self.stage_enrolled = PipelineStage.objects.get(order=10)
        self.stage_lost = PipelineStage.objects.get(order=12)

        # Admin
        self.admin = User.objects.create_superuser(
            username="admin_stage_test",
            email="admin_stage_test@skillmove.com",
            password="password123",
            role=UserRole.ADMIN
        )

        # Team A & Manager A & Counsellor A
        self.team_a = Team.objects.create(name="Team Alpha")
        self.manager_a = User.objects.create_user(
            username="manager_a",
            email="manager_a@skillmove.com",
            password="password123",
            role=UserRole.MANAGER,
            team=self.team_a
        )
        self.team_a.manager = self.manager_a
        self.team_a.save()

        self.counsellor_a = User.objects.create_user(
            username="counsellor_a",
            email="counsellor_a@skillmove.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_a
        )

        # Team B & Manager B & Counsellor B
        self.team_b = Team.objects.create(name="Team Beta")
        self.manager_b = User.objects.create_user(
            username="manager_b",
            email="manager_b@skillmove.com",
            password="password123",
            role=UserRole.MANAGER,
            team=self.team_b
        )
        self.team_b.manager = self.manager_b
        self.team_b.save()

        self.counsellor_b = User.objects.create_user(
            username="counsellor_b",
            email="counsellor_b@skillmove.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_b
        )

        # Create a lead assigned to Counsellor A in Team A
        self.lead_a = Lead.objects.create(
            name="Alice Candidate",
            email="alice@example.com",
            phone="+919876543210",
            team=self.team_a,
            assigned_employee=self.counsellor_a,
            stage=self.stage1,
            created_by=self.manager_a
        )

    # 1. Valid stage change by Admin
    def test_admin_can_change_stage_with_note(self):
        self.client.force_authenticate(user=self.admin)
        url = f"/api/leads/{self.lead_a.id}/change-stage/"
        response = self.client.post(url, {
            "destination_stage_id": self.stage2.id,
            "note": "Candidate attended initial introduction call.",
            "expected_current_stage_id": self.stage1.id
        })
        assert response.status_code == status.HTTP_200_OK
        assert response.data["detail"] == f"Stage successfully changed to {self.stage2.name}."

        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage2.id

        # Verify LeadStageHistory record
        history = LeadStageHistory.objects.filter(lead=self.lead_a).order_by('-timestamp').first()
        assert history is not None
        assert history.from_stage_id == self.stage1.id
        assert history.to_stage_id == self.stage2.id
        assert history.changed_by == self.admin
        assert history.note == "Candidate attended initial introduction call."

    # 2. Valid stage change by Assigned Counsellor
    def test_assigned_counsellor_can_change_stage(self):
        self.client.force_authenticate(user=self.counsellor_a)
        url = f"/api/leads/{self.lead_a.id}/change-stage/"
        response = self.client.post(url, {
            "destination_stage_id": self.stage3.id,
            "note": "Spoke on phone, candidate requested syllabus."
        })
        assert response.status_code == status.HTTP_200_OK
        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage3.id

    # 3. Valid stage change by Team Manager
    def test_manager_can_change_stage_for_team_lead(self):
        self.client.force_authenticate(user=self.manager_a)
        url = f"/api/leads/{self.lead_a.id}/change-stage/"
        response = self.client.post(url, {
            "destination_stage_id": self.stage4.id if hasattr(self, 'stage4') else self.stage3.id,
            "note": "Manager reviewed and moved stage."
        })
        assert response.status_code == status.HTTP_200_OK

    # 4. Cross-counsellor restriction (Counsellor B cannot change Counsellor A's lead)
    def test_unauthorized_counsellor_cannot_change_stage(self):
        self.client.force_authenticate(user=self.counsellor_b)
        url = f"/api/leads/{self.lead_a.id}/change-stage/"
        response = self.client.post(url, {
            "destination_stage_id": self.stage2.id,
            "note": "Attempting unauthorized stage change."
        })
        assert response.status_code == status.HTTP_403_FORBIDDEN
        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage1.id

    # 5. Cross-team restriction (Manager B cannot change Team A's lead)
    def test_unauthorized_manager_cannot_change_other_team_lead_stage(self):
        self.client.force_authenticate(user=self.manager_b)
        url = f"/api/leads/{self.lead_a.id}/change-stage/"
        response = self.client.post(url, {
            "destination_stage_id": self.stage2.id,
            "note": "Manager B cross-team change attempt."
        })
        assert response.status_code == status.HTTP_403_FORBIDDEN

    # 6. Rejection of missing note
    def test_missing_note_rejected(self):
        self.client.force_authenticate(user=self.admin)
        url = f"/api/leads/{self.lead_a.id}/change-stage/"
        response = self.client.post(url, {
            "destination_stage_id": self.stage2.id
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "note" in response.data

    # 7. Rejection of whitespace-only note
    def test_whitespace_note_rejected(self):
        self.client.force_authenticate(user=self.admin)
        url = f"/api/leads/{self.lead_a.id}/change-stage/"
        response = self.client.post(url, {
            "destination_stage_id": self.stage2.id,
            "note": "    \t \n   "
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "note" in response.data

    # 8. Rejection of no-op (destination == current stage)
    def test_noop_stage_change_rejected(self):
        self.client.force_authenticate(user=self.admin)
        url = f"/api/leads/{self.lead_a.id}/change-stage/"
        response = self.client.post(url, {
            "destination_stage_id": self.stage1.id,
            "note": "Same stage change attempt."
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "destination_stage_id" in response.data
        # Ensure no stage history was created
        assert LeadStageHistory.objects.filter(note="Same stage change attempt.").count() == 0

    # 9. Rejection of nonexistent or inactive stage
    def test_nonexistent_or_inactive_stage_rejected(self):
        self.client.force_authenticate(user=self.admin)
        url = f"/api/leads/{self.lead_a.id}/change-stage/"

        # Nonexistent
        response = self.client.post(url, {
            "destination_stage_id": 99999,
            "note": "Valid note"
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # Inactive
        inactive_stage = PipelineStage.objects.create(name="Archived Stage", order=99, is_active=False)
        response2 = self.client.post(url, {
            "destination_stage_id": inactive_stage.id,
            "note": "Valid note"
        })
        assert response2.status_code == status.HTTP_400_BAD_REQUEST

    # 10. Concurrency conflict detection
    def test_concurrency_conflict_detected(self):
        self.client.force_authenticate(user=self.admin)
        url = f"/api/leads/{self.lead_a.id}/change-stage/"
        # Expected stage is stage2, but lead is currently at stage1
        response = self.client.post(url, {
            "destination_stage_id": self.stage3.id,
            "note": "Concurrent change",
            "expected_current_stage_id": self.stage2.id
        })
        assert response.status_code == status.HTTP_409_CONFLICT
        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage1.id

    # 11. Preservation of stage history over multiple transitions
    def test_preservation_of_all_stage_history_records(self):
        self.client.force_authenticate(user=self.admin)
        url = f"/api/leads/{self.lead_a.id}/change-stage/"

        # Change 1: 1 -> 2
        res1 = self.client.post(url, {
            "destination_stage_id": self.stage2.id,
            "note": "Transition 1 note"
        })
        assert res1.status_code == status.HTTP_200_OK

        # Change 2: 2 -> 3
        res2 = self.client.post(url, {
            "destination_stage_id": self.stage3.id,
            "note": "Transition 2 note"
        })
        assert res2.status_code == status.HTTP_200_OK

        # Change 3: 3 -> Enrolled
        res3 = self.client.post(url, {
            "destination_stage_id": self.stage_enrolled.id,
            "note": "Transition 3 note: Student enrolled successfully"
        })
        assert res3.status_code == status.HTTP_200_OK

        # Check history endpoint
        hist_url = f"/api/leads/{self.lead_a.id}/stage-history/"
        hist_res = self.client.get(hist_url)
        assert hist_res.status_code == status.HTTP_200_OK

        records = hist_res.data if isinstance(hist_res.data, list) else hist_res.data.get('results', [])
        assert len(records) >= 3
        notes = [r['note'] for r in records]
        assert "Transition 1 note" in notes
        assert "Transition 2 note" in notes
        assert "Transition 3 note: Student enrolled successfully" in notes

    # 12. Complete Lead Timeline aggregation & ordering
    def test_complete_timeline_aggregation(self):
        # 1. Lead has stage change
        self.client.force_authenticate(user=self.admin)
        self.client.post(f"/api/leads/{self.lead_a.id}/change-stage/", {
            "destination_stage_id": self.stage2.id,
            "note": "Timeline test stage change note"
        })

        # 2. Add communication log
        CommunicationLog.objects.create(
            lead=self.lead_a,
            channel=CommunicationChannel.CALL,
            recipient=self.lead_a.phone,
            subject="",
            content="Discussed course curriculum on phone.",
            status=CommunicationStatus.SUCCESS,
            initiated_by=self.counsellor_a
        )

        # 3. Add reassignment history
        LeadAssignmentHistory.objects.create(
            lead=self.lead_a,
            from_team=self.team_a,
            to_team=self.team_a,
            from_employee=self.counsellor_a,
            to_employee=self.manager_a,
            changed_by=self.admin
        )

        # Request timeline as assigned counsellor
        self.client.force_authenticate(user=self.counsellor_a)
        timeline_url = f"/api/leads/{self.lead_a.id}/timeline/"
        response = self.client.get(timeline_url)
        assert response.status_code == status.HTTP_200_OK

        data = response.data
        assert "timeline" in data
        timeline = data["timeline"]
        assert len(timeline) >= 4  # creation + stage change + comm + reassignment

        # Ensure timeline is chronologically ordered descending (newest first)
        timestamps = [item['timestamp'] for item in timeline]
        assert timestamps == sorted(timestamps, reverse=True)

        # Verify event types present
        event_types = [item['event_type'] for item in timeline]
        assert "LEAD_CREATED" in event_types
        assert "STAGE_CHANGED" in event_types
        assert "COMMUNICATION_CALL" in event_types
        assert "LEAD_REASSIGNED" in event_types

        # Verify note is included in stage change event
        stage_event = next(item for item in timeline if item['event_type'] == 'STAGE_CHANGED')
        assert stage_event['note'] == "Timeline test stage change note"
        assert stage_event['actor_name'] == self.admin.username

    # 13. Timeline authorization check (Counsellor B cannot access Counsellor A's timeline)
    def test_unauthorized_user_cannot_access_timeline(self):
        self.client.force_authenticate(user=self.counsellor_b)
        timeline_url = f"/api/leads/{self.lead_a.id}/timeline/"
        response = self.client.get(timeline_url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    # 14. LeadSerializer contains last_stage_change for Lead 360 overview
    def test_lead_serializer_contains_last_stage_change(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(f"/api/leads/{self.lead_a.id}/change-stage/", {
            "destination_stage_id": self.stage2.id,
            "note": "Lead 360 test note"
        })

        detail_res = self.client.get(f"/api/leads/{self.lead_a.id}/")
        assert detail_res.status_code == status.HTTP_200_OK
        lead_data = detail_res.data
        assert "last_stage_change" in lead_data
        assert lead_data["last_stage_change"] is not None
        assert lead_data["last_stage_change"]["note"] == "Lead 360 test note"
        assert lead_data["last_stage_change"]["to_stage_name"] == self.stage2.name
