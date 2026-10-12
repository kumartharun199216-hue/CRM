import pytest
from decimal import Decimal
from unittest.mock import patch
from rest_framework.test import APIClient
from rest_framework import status
from django.db.models import Q
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import (
    Lead,
    PipelineStage,
    PreCloserFinancial,
    LeadFinancialHistory,
    LeadStageHistory
)
from apps.audit.models import AuditEvent

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
class TestPendingClosureFinancialWorkflow:
    def setup_method(self):
        self.client = APIClient()

        # Seed pipeline stages
        for order, name in EXPECTED_STAGES:
            PipelineStage.objects.update_or_create(
                order=order,
                defaults={'name': name, 'is_active': True}
            )

        self.stage_initial = PipelineStage.objects.get(order=1)
        self.stage_contacted = PipelineStage.objects.get(order=4)
        self.stage_pending_closure = PipelineStage.objects.get(order=9)
        self.stage_enrolled = PipelineStage.objects.get(name="Enrolled")

        # Admin
        self.admin = User.objects.create_superuser(
            username="admin_fin_test",
            email="admin_fin_test@skillmove.com",
            password="password123",
            role=UserRole.ADMIN
        )

        # Team Alpha & Manager A & Counsellor A
        self.team_alpha = Team.objects.create(name="Alpha Sales Team")
        self.manager_a = User.objects.create_user(
            username="manager_fin_a",
            email="manager_fin_a@skillmove.com",
            password="password123",
            role=UserRole.MANAGER,
            team=self.team_alpha
        )
        self.team_alpha.manager = self.manager_a
        self.team_alpha.save()

        self.counsellor_a = User.objects.create_user(
            username="counsellor_fin_a",
            email="counsellor_fin_a@skillmove.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha
        )

        # Team Beta & Manager B & Counsellor B
        self.team_beta = Team.objects.create(name="Beta Sales Team")
        self.manager_b = User.objects.create_user(
            username="manager_fin_b",
            email="manager_fin_b@skillmove.com",
            password="password123",
            role=UserRole.MANAGER,
            team=self.team_beta
        )
        self.team_beta.manager = self.manager_b
        self.team_beta.save()

        self.counsellor_b = User.objects.create_user(
            username="counsellor_fin_b",
            email="counsellor_fin_b@skillmove.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_beta
        )

        # Lead Alpha assigned to counsellor_a in team_alpha
        self.lead_a = Lead.objects.create(
            name="Rohan Sharma",
            email="rohan@example.com",
            phone="+919876543210",
            team=self.team_alpha,
            assigned_employee=self.counsellor_a,
            stage=self.stage_initial,
            created_by=self.manager_a
        )

    # 1. Transition to Pending Closure with valid financial data.
    def test_transition_to_pending_closure_with_valid_financial_data(self):
        self.client.force_authenticate(user=self.counsellor_a)
        response = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Agreed on Full Stack course with initial token advance.",
                "agreed_amount": "50000.00",
                "amount_paid": "15000.00"
            },
            format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage_pending_closure.id

        # Verify PreCloserFinancial record
        fin = PreCloserFinancial.objects.get(lead=self.lead_a)
        assert fin.agreed_amount == Decimal("50000.00")
        assert fin.amount_paid == Decimal("15000.00")
        assert fin.outstanding_balance == Decimal("35000.00")
        assert fin.created_by == self.counsellor_a
        assert fin.updated_by == self.counsellor_a

        # Verify financial history record
        histories = LeadFinancialHistory.objects.filter(lead=self.lead_a)
        assert histories.count() == 1
        h = histories.first()
        assert h.agreed_amount == Decimal("50000.00")
        assert h.amount_paid == Decimal("15000.00")
        assert h.outstanding_balance == Decimal("35000.00")
        assert h.changed_by == self.counsellor_a
        assert "token advance" in h.note

        # Verify timeline includes financial update
        timeline_res = self.client.get(f"/api/leads/{self.lead_a.id}/timeline/")
        assert timeline_res.status_code == status.HTTP_200_OK
        fin_events = [e for e in timeline_res.data["timeline"] if e["event_type"] == "LEAD_FINANCIAL_UPDATED"]
        assert len(fin_events) == 1
        assert "50,000.00" in fin_events[0]["description"]

    # 2. Transition to Pending Closure with missing financial data.
    def test_transition_to_pending_closure_with_missing_financial_data(self):
        self.client.force_authenticate(user=self.counsellor_a)
        response = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Moving without financial info."
            },
            format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "agreed_amount" in response.data or "amount_paid" in response.data

        # Original stage must be preserved
        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage_initial.id
        assert not PreCloserFinancial.objects.filter(lead=self.lead_a).exists()

    # 3. Transition to Pending Closure with negative amounts.
    def test_transition_to_pending_closure_with_negative_amounts(self):
        self.client.force_authenticate(user=self.counsellor_a)
        response = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Testing negative amounts",
                "agreed_amount": "-50000.00",
                "amount_paid": "10000.00"
            },
            format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "agreed_amount" in response.data

        response_neg_paid = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Testing negative paid amount",
                "agreed_amount": "50000.00",
                "amount_paid": "-500.00"
            },
            format="json"
        )
        assert response_neg_paid.status_code == status.HTTP_400_BAD_REQUEST
        assert "amount_paid" in response_neg_paid.data

        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage_initial.id

    # 4. Amount paid greater than agreed amount.
    def test_transition_to_pending_closure_paid_greater_than_agreed(self):
        self.client.force_authenticate(user=self.counsellor_a)
        response = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Overpayment test",
                "agreed_amount": "30000.00",
                "amount_paid": "35000.00"
            },
            format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "amount_paid" in response.data

        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage_initial.id

    # 5. Ordinary-stage lead creation without financial fields.
    def test_ordinary_stage_lead_creation_without_financial_fields(self):
        self.client.force_authenticate(user=self.manager_a)
        payload = {
            "name": "Pooja Patel",
            "email": "pooja@example.com",
            "phone": "+919811122233",
            "team": self.team_alpha.id,
            "assigned_employee": self.counsellor_a.id,
            "stage": self.stage_initial.id
        }
        response = self.client.post("/api/leads/", payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        new_lead_id = response.data["id"]
        new_lead = Lead.objects.get(id=new_lead_id)
        assert not hasattr(new_lead, "pre_closer_financial") or new_lead.pre_closer_financial is None
        assert response.data.get("pre_closer_financial") is None

    # 6. Ordinary-stage changes without financial fields.
    def test_ordinary_stage_changes_without_financial_fields(self):
        self.client.force_authenticate(user=self.counsellor_a)
        response = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_contacted.id,
                "note": "Lead contacted successfully."
            },
            format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage_contacted.id

    # 7. Editing an existing Pending Closure financial record.
    def test_editing_existing_pending_closure_financial_record(self):
        # Move to Pending Closure first
        self.client.force_authenticate(user=self.counsellor_a)
        res1 = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Initial Pending Closure agreement",
                "agreed_amount": "40000.00",
                "amount_paid": "10000.00"
            },
            format="json"
        )
        assert res1.status_code == status.HTTP_200_OK

        # Counsellor or Manager updates the payment amount
        res_update = self.client.put(
            f"/api/leads/{self.lead_a.id}/financial/",
            {
                "agreed_amount": "40000.00",
                "amount_paid": "25000.00",
                "note": "Second instalment of 15k received via bank transfer."
            },
            format="json"
        )
        assert res_update.status_code == status.HTTP_200_OK
        assert res_update.data["financial"]["agreed_amount"] == "40000.00"
        assert res_update.data["financial"]["amount_paid"] == "25000.00"
        assert res_update.data["financial"]["outstanding_balance"] == "15000.00"

        # Check financial history has 2 records
        history = LeadFinancialHistory.objects.filter(lead=self.lead_a).order_by("timestamp")
        assert history.count() == 2
        assert history[0].amount_paid == Decimal("10000.00")
        assert history[1].amount_paid == Decimal("25000.00")
        assert history[1].outstanding_balance == Decimal("15000.00")
        assert "Second instalment" in history[1].note

    # 8. Re-entering Pending Closure without creating duplicate financial records.
    def test_reentering_pending_closure_without_duplicate_records(self):
        self.client.force_authenticate(user=self.counsellor_a)

        # 1. Enter Pending Closure
        self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Moving to Pending Closure",
                "agreed_amount": "60000.00",
                "amount_paid": "20000.00"
            },
            format="json"
        )
        assert PreCloserFinancial.objects.filter(lead=self.lead_a).count() == 1

        # 2. Move out to Contacted
        self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_contacted.id,
                "note": "Student requested follow up next month."
            },
            format="json"
        )
        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage_contacted.id
        assert PreCloserFinancial.objects.filter(lead=self.lead_a).count() == 1

        # 3. Move back to Pending Closure with renegotiated price
        res_reentry = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Renegotiated and finalized at 55000 with 30000 paid",
                "agreed_amount": "55000.00",
                "amount_paid": "30000.00"
            },
            format="json"
        )
        assert res_reentry.status_code == status.HTTP_200_OK

        # Must still only have exactly 1 PreCloserFinancial record (no duplicates)
        assert PreCloserFinancial.objects.filter(lead=self.lead_a).count() == 1
        fin = PreCloserFinancial.objects.get(lead=self.lead_a)
        assert fin.agreed_amount == Decimal("55000.00")
        assert fin.amount_paid == Decimal("30000.00")
        assert fin.outstanding_balance == Decimal("25000.00")

        # History must contain both transitions
        assert LeadFinancialHistory.objects.filter(lead=self.lead_a).count() == 2

    # 9. Failed financial validation leaves original stage unchanged.
    def test_failed_financial_validation_leaves_stage_unchanged(self):
        self.client.force_authenticate(user=self.counsellor_a)
        initial_stage_id = self.lead_a.stage_id

        res = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Invalid amounts test",
                "agreed_amount": "10000.00",
                "amount_paid": "20000.00"  # Invalid: paid > agreed
            },
            format="json"
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == initial_stage_id
        assert not PreCloserFinancial.objects.filter(lead=self.lead_a).exists()

    # 10. Failed database operations roll back combined transition.
    def test_failed_db_operation_rolls_back_combined_transition(self):
        self.client.force_authenticate(user=self.counsellor_a)
        initial_stage_id = self.lead_a.stage_id

        with patch("apps.leads.models.LeadFinancialHistory.objects.create", side_effect=RuntimeError("Simulated DB Crash")):
            with pytest.raises(RuntimeError):
                self.client.post(
                    f"/api/leads/{self.lead_a.id}/change-stage/",
                    {
                        "destination_stage_id": self.stage_pending_closure.id,
                        "note": "Testing transaction atomicity",
                        "agreed_amount": "50000.00",
                        "amount_paid": "10000.00"
                    },
                    format="json"
                )

        self.lead_a.refresh_from_db()
        # Atomic rollback: Stage remains initial, no financial record created
        assert self.lead_a.stage_id == initial_stage_id
        assert not PreCloserFinancial.objects.filter(lead=self.lead_a).exists()

    # 11. Mandatory stage-change notes remain enforced.
    def test_mandatory_stage_change_notes_enforced(self):
        self.client.force_authenticate(user=self.counsellor_a)
        response = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "   ",
                "agreed_amount": "50000.00",
                "amount_paid": "10000.00"
            },
            format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "note" in response.data

        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage_initial.id

    # 12. Admin, Manager, and Sales Employee permissions.
    def test_role_based_permissions_for_pending_closure(self):
        # Admin can transition lead_a
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Admin moving lead to Pending Closure",
                "agreed_amount": "60000.00",
                "amount_paid": "20000.00"
            },
            format="json"
        )
        assert res_admin.status_code == status.HTTP_200_OK

        # Manager A (managing lead_a's team) can update financial info
        self.client.force_authenticate(user=self.manager_a)
        res_mgr = self.client.put(
            f"/api/leads/{self.lead_a.id}/financial/",
            {
                "agreed_amount": "60000.00",
                "amount_paid": "30000.00",
                "note": "Manager approved discount & received additional 10k"
            },
            format="json"
        )
        assert res_mgr.status_code == status.HTTP_200_OK

        # Counsellor A (assigned to lead_a) can view and update
        self.client.force_authenticate(user=self.counsellor_a)
        res_counsellor_get = self.client.get(f"/api/leads/{self.lead_a.id}/financial/")
        assert res_counsellor_get.status_code == status.HTTP_200_OK
        assert res_counsellor_get.data["financial"]["amount_paid"] == "30000.00"

    # 13. Cross-team and unauthorized lead access.
    def test_cross_team_unauthorized_access_rejected(self):
        # Counsellor B from Team Beta attempts to change stage of lead_a (Team Alpha)
        self.client.force_authenticate(user=self.counsellor_b)
        res1 = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Cross-team tampering",
                "agreed_amount": "50000.00",
                "amount_paid": "10000.00"
            },
            format="json"
        )
        assert res1.status_code == status.HTTP_403_FORBIDDEN

        # Manager B from Team Beta attempts to update financial record of lead_a
        self.client.force_authenticate(user=self.manager_b)
        res2 = self.client.put(
            f"/api/leads/{self.lead_a.id}/financial/",
            {
                "agreed_amount": "50000.00",
                "amount_paid": "10000.00",
                "note": "Unauthorized manager edit"
            },
            format="json"
        )
        assert res2.status_code == status.HTTP_403_FORBIDDEN

        # Manager B attempts GET financial
        res3 = self.client.get(f"/api/leads/{self.lead_a.id}/financial/")
        assert res3.status_code == status.HTTP_403_FORBIDDEN

    # 14. Financial history records actor, timestamp, and changed values.
    def test_financial_history_audit_trail(self):
        # 1. Counsellor moves to Pending Closure
        self.client.force_authenticate(user=self.counsellor_a)
        self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Initial entry by counsellor",
                "agreed_amount": "70000.00",
                "amount_paid": "20000.00"
            },
            format="json"
        )

        # 2. Manager updates amounts
        self.client.force_authenticate(user=self.manager_a)
        self.client.put(
            f"/api/leads/{self.lead_a.id}/financial/",
            {
                "agreed_amount": "70000.00",
                "amount_paid": "35000.00",
                "note": "Manager recorded 15000 balance payment"
            },
            format="json"
        )

        history = LeadFinancialHistory.objects.filter(lead=self.lead_a).order_by("timestamp")
        assert history.count() == 2

        entry1 = history[0]
        assert entry1.changed_by == self.counsellor_a
        assert entry1.agreed_amount == Decimal("70000.00")
        assert entry1.amount_paid == Decimal("20000.00")
        assert entry1.outstanding_balance == Decimal("50000.00")
        assert entry1.note == "Initial entry by counsellor"
        assert entry1.timestamp is not None

        entry2 = history[1]
        assert entry2.changed_by == self.manager_a
        assert entry2.agreed_amount == Decimal("70000.00")
        assert entry2.amount_paid == Decimal("35000.00")
        assert entry2.outstanding_balance == Decimal("35000.00")
        assert entry2.note == "Manager recorded 15000 balance payment"
        assert entry2.timestamp >= entry1.timestamp

    # 15. No duplicate Pending Closure stage is created.
    def test_no_duplicate_pending_closure_stage_created(self):
        # Verify that Pending Closure is unique and single stage at order 9
        pending_stages = PipelineStage.objects.filter(
            Q(order=9) | Q(name__iexact="Pending Closure") | Q(name__iexact="pendingClosure")
        )
        assert pending_stages.count() == 1
        st = pending_stages.first()
        assert st.order == 9
        assert st.name in ["Pending Closure", "pendingClosure"]
        assert st.is_active is True

        # Verify total pipeline count is exactly 12
        assert PipelineStage.objects.filter(is_active=True).count() == 12

    # 16. Normal lead creation does not require financial data
    def test_normal_lead_creation_does_not_require_financial_fields(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/leads/",
            {
                "name": "Standard Student",
                "email": "standard.student@example.com",
                "phone": "+919876543210",
                "team": self.team_alpha.id,
                "assigned_employee": self.counsellor_a.id,
                "stage": self.stage_initial.id,
                "qualification": "B.Com",
                "college": "City College",
            },
            format="json"
        )
        assert res.status_code == status.HTTP_201_CREATED
        lead_id = res.data["id"]
        lead = Lead.objects.get(id=lead_id)
        assert lead.name == "Standard Student"
        assert not hasattr(lead, "pre_closer_financial") or lead.pre_closer_financial is None
        assert res.data.get("pending_closure_financial") is None

    # 17. Normal lead editing does not require financial data
    def test_normal_lead_editing_does_not_require_financial_fields(self):
        self.client.force_authenticate(user=self.counsellor_a)
        res = self.client.patch(
            f"/api/leads/{self.lead_a.id}/",
            {
                "qualification": "B.Sc Physics",
                "priority": "High",
                "city": "Mumbai",
            },
            format="json"
        )
        assert res.status_code == status.HTTP_200_OK
        self.lead_a.refresh_from_db()
        assert self.lead_a.qualification == "B.Sc Physics"
        assert self.lead_a.priority == "High"
        assert self.lead_a.city == "Mumbai"

    # 18. Financial details are preserved and accessible through Pending Closure
    def test_pending_closure_financial_record_persisted_and_returned_in_lead_serializer(self):
        self.client.force_authenticate(user=self.counsellor_a)
        # Move lead to Pending Closure with financial details
        res = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_pending_closure.id,
                "note": "Deal ready for closure",
                "agreed_amount": "55000.00",
                "amount_paid": "25000.00"
            },
            format="json"
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["lead"]["stage"] == self.stage_pending_closure.id
        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage_pending_closure.id

        # Fetch lead via standard endpoint - financial data is serialized for authorized views
        detail_res = self.client.get(f"/api/leads/{self.lead_a.id}/")
        assert detail_res.status_code == status.HTTP_200_OK
        fin_data = detail_res.data.get("pending_closure_financial")
        assert fin_data is not None
        assert Decimal(str(fin_data["agreed_amount"])) == Decimal("55000.00")
        assert Decimal(str(fin_data["amount_paid"])) == Decimal("25000.00")
        assert Decimal(str(fin_data["outstanding_balance"])) == Decimal("30000.00")

    # 19. Ordinary stages do not require financial details
    def test_ordinary_stages_do_not_require_financial_details(self):
        self.client.force_authenticate(user=self.counsellor_a)
        res = self.client.post(
            f"/api/leads/{self.lead_a.id}/change-stage/",
            {
                "destination_stage_id": self.stage_contacted.id,
                "note": "Contact established with student"
            },
            format="json"
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.data["lead"]["stage"] == self.stage_contacted.id
        self.lead_a.refresh_from_db()
        assert self.lead_a.stage_id == self.stage_contacted.id


