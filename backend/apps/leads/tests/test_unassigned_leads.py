import pytest
import threading
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import Lead, PipelineStage, LeadAssignmentHistory, LeadIdSequence

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
class TestUnassignedLeads:
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

        # Admin
        self.admin = User.objects.create_superuser(
            username="admin_test",
            email="admin_test@skillmove.com",
            password="ADmin@123",
            role=UserRole.ADMIN
        )

        # Team 1 & Manager 1 & Employees
        self.team1 = Team.objects.create(name="Skill Move Admissions")
        self.manager1 = User.objects.create_user(
            username="manager1_test",
            email="manager1_test@skillmove.com",
            password="password123",
            role=UserRole.MANAGER,
            team=self.team1
        )
        self.team1.manager = self.manager1
        self.team1.save()

        self.counsellor1 = User.objects.create_user(
            username="counsellor1_test",
            email="counsellor1_test@skillmove.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team1
        )

        self.counsellor2 = User.objects.create_user(
            username="counsellor2_test",
            email="counsellor2_test@skillmove.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team1
        )

        # Team 2 & Manager 2 & Employee
        self.team2 = Team.objects.create(name="Enterprise Tech Admissions")
        self.manager2 = User.objects.create_user(
            username="manager2_test",
            email="manager2_test@skillmove.com",
            password="password123",
            role=UserRole.MANAGER,
            team=self.team2
        )
        self.team2.manager = self.manager2
        self.team2.save()

        self.counsellor_team2 = User.objects.create_user(
            username="counsellor_team2_test",
            email="counsellor_team2_test@skillmove.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team2
        )

        # Create unassigned leads: 2 in Team 1, 1 in Team 2
        self.lead_t1_a = Lead.objects.create(
            name="Aarav Student",
            email="aarav@student.com",
            phone="+91 98888 11111",
            qualification="B.Tech CS",
            college="PES University",
            team=self.team1,
            assigned_employee=None,
            stage=self.stage1,
            created_by=self.admin
        )

        self.lead_t1_b = Lead.objects.create(
            name="Bhavna Student",
            email="bhavna@student.com",
            phone="+91 98888 22222",
            qualification="MCA",
            college="RVCE",
            team=self.team1,
            assigned_employee=None,
            stage=self.stage2,
            created_by=self.admin
        )

        self.lead_t2_a = Lead.objects.create(
            name="Chetan Student",
            email="chetan@student.com",
            phone="+91 98888 33333",
            qualification="BCA",
            college="Christ University",
            team=self.team2,
            assigned_employee=None,
            stage=self.stage1,
            created_by=self.admin
        )

        # Also 1 assigned lead in Team 1
        self.lead_assigned = Lead.objects.create(
            name="Divya Assigned",
            email="divya@student.com",
            phone="+91 98888 44444",
            qualification="B.E",
            college="BMSCE",
            team=self.team1,
            assigned_employee=self.counsellor1,
            stage=self.stage1,
            created_by=self.admin
        )

    # 1. Admin sees all unassigned leads across all teams
    def test_admin_sees_all_unassigned_leads(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/leads/unassigned/')
        assert res.status_code == status.HTTP_200_OK
        ids = [item['id'] for item in res.data]
        assert self.lead_t1_a.id in ids
        assert self.lead_t1_b.id in ids
        assert self.lead_t2_a.id in ids
        assert self.lead_assigned.id not in ids
        assert len(ids) == 3

        count_res = self.client.get('/api/leads/unassigned-count/')
        assert count_res.status_code == status.HTTP_200_OK
        assert count_res.data['count'] == 3

    # 2. Manager sees only unassigned leads within the authorized team
    def test_manager_sees_only_unassigned_leads_within_authorized_team(self):
        self.client.force_authenticate(user=self.manager1)
        res = self.client.get('/api/leads/unassigned/')
        assert res.status_code == status.HTTP_200_OK
        ids = [item['id'] for item in res.data]
        assert self.lead_t1_a.id in ids
        assert self.lead_t1_b.id in ids
        assert self.lead_t2_a.id not in ids  # Belongs to team 2
        assert self.lead_assigned.id not in ids  # Assigned
        assert len(ids) == 2

        count_res = self.client.get('/api/leads/unassigned-count/')
        assert count_res.status_code == status.HTTP_200_OK
        assert count_res.data['count'] == 2

    # 3. Sales Employee/Counsellor cannot access the unassigned queue
    def test_sales_employee_cannot_access_unassigned_queue(self):
        self.client.force_authenticate(user=self.counsellor1)
        res = self.client.get('/api/leads/unassigned/')
        assert res.status_code == status.HTTP_403_FORBIDDEN

        count_res = self.client.get('/api/leads/unassigned-count/')
        assert count_res.status_code == status.HTTP_403_FORBIDDEN

        assign_res = self.client.post(f'/api/leads/{self.lead_t1_a.id}/assign/', {'employee_id': self.counsellor1.id})
        assert assign_res.status_code == status.HTTP_403_FORBIDDEN

    # 4. Admin can assign a lead to an eligible employee
    def test_admin_can_assign_lead_to_eligible_employee(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f'/api/leads/{self.lead_t1_a.id}/assign/', {
            'employee_id': self.counsellor1.id
        })
        assert res.status_code == status.HTTP_200_OK
        assert res.data['assigned_employee'] == self.counsellor1.id
        assert res.data['assigned_employee_name'] == self.counsellor1.username

        self.lead_t1_a.refresh_from_db()
        assert self.lead_t1_a.assigned_employee_id == self.counsellor1.id

    # 5. Admin can assign to a Manager if permitted by the owner model
    def test_admin_can_assign_to_manager(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f'/api/leads/{self.lead_t1_a.id}/assign/', {
            'employee_id': self.manager1.id,
            'team_id': self.team1.id
        })
        assert res.status_code == status.HTTP_200_OK
        assert res.data['assigned_employee'] == self.manager1.id

        self.lead_t1_a.refresh_from_db()
        assert self.lead_t1_a.assigned_employee_id == self.manager1.id

    # 6. Manager can assign a lead to an eligible employee within their team
    def test_manager_can_assign_lead_to_team_employee(self):
        self.client.force_authenticate(user=self.manager1)
        res = self.client.post(f'/api/leads/{self.lead_t1_a.id}/assign/', {
            'employee_id': self.counsellor2.id
        })
        assert res.status_code == status.HTTP_200_OK
        assert res.data['assigned_employee'] == self.counsellor2.id

        self.lead_t1_a.refresh_from_db()
        assert self.lead_t1_a.assigned_employee_id == self.counsellor2.id

    # 7. Manager can self-assign when supported by the owner model
    def test_manager_can_self_assign_lead(self):
        self.client.force_authenticate(user=self.manager1)
        res = self.client.post(f'/api/leads/{self.lead_t1_b.id}/assign/', {
            'employee_id': self.manager1.id
        })
        assert res.status_code == status.HTTP_200_OK
        assert res.data['assigned_employee'] == self.manager1.id

        self.lead_t1_b.refresh_from_db()
        assert self.lead_t1_b.assigned_employee_id == self.manager1.id

    # 8. Manager cannot assign another team's lead
    def test_manager_cannot_assign_another_teams_lead(self):
        self.client.force_authenticate(user=self.manager1)
        # lead_t2_a belongs to Team 2, manager1 is for Team 1
        res = self.client.post(f'/api/leads/{self.lead_t2_a.id}/assign/', {
            'employee_id': self.counsellor1.id
        })
        assert res.status_code == status.HTTP_403_FORBIDDEN

        # Also cannot assign own team's lead to an employee from another team
        res2 = self.client.post(f'/api/leads/{self.lead_t1_a.id}/assign/', {
            'employee_id': self.counsellor_team2.id
        })
        assert res2.status_code == status.HTTP_403_FORBIDDEN

    # 9. Successful assignment updates the lead without creating a duplicate
    def test_successful_assignment_updates_lead_without_duplicate(self):
        initial_lead_count = Lead.objects.count()
        lead_id = self.lead_t1_a.id
        generated_id = self.lead_t1_a.lead_id

        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f'/api/leads/{lead_id}/assign/', {
            'employee_id': self.counsellor1.id
        })
        assert res.status_code == status.HTTP_200_OK

        assert Lead.objects.count() == initial_lead_count
        updated = Lead.objects.get(id=lead_id)
        assert updated.lead_id == generated_id
        assert updated.assigned_employee_id == self.counsellor1.id
        assert updated.name == self.lead_t1_a.name

    # 10. Assignment history is recorded correctly
    def test_assignment_history_recorded_correctly(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(f'/api/leads/{self.lead_t1_a.id}/assign/', {
            'employee_id': self.counsellor1.id
        })
        assert res.status_code == status.HTTP_200_OK

        history = LeadAssignmentHistory.objects.filter(lead=self.lead_t1_a).order_by('-timestamp').first()
        assert history is not None
        assert history.from_employee is None  # Previously unassigned
        assert history.to_employee == self.counsellor1
        assert history.changed_by == self.admin
        assert history.to_team == self.team1

    # 11. Sidebar counts update after assignment
    def test_unassigned_counts_update_after_assignment(self):
        self.client.force_authenticate(user=self.manager1)
        before = self.client.get('/api/leads/unassigned-count/').data['count']
        assert before == 2

        self.client.post(f'/api/leads/{self.lead_t1_a.id}/assign/', {
            'employee_id': self.counsellor1.id
        })

        after = self.client.get('/api/leads/unassigned-count/').data['count']
        assert after == 1

        # Check unassigned queue excludes the assigned lead
        queue = self.client.get('/api/leads/unassigned/').data
        assert len(queue) == 1
        assert queue[0]['id'] == self.lead_t1_b.id

    # 12. Concurrent assignment attempts cannot create conflicting ownership
    def test_concurrent_assignment_cannot_create_conflicting_ownership(self):
        # Once lead is assigned, second assignment attempt on the unassigned queue returns 409 Conflict
        self.client.force_authenticate(user=self.manager1)
        res1 = self.client.post(f'/api/leads/{self.lead_t1_a.id}/assign/', {
            'employee_id': self.counsellor1.id
        })
        assert res1.status_code == status.HTTP_200_OK

        # Second attempt on same lead
        res2 = self.client.post(f'/api/leads/{self.lead_t1_a.id}/assign/', {
            'employee_id': self.counsellor2.id
        })
        assert res2.status_code == status.HTTP_409_CONFLICT
        assert "already been assigned" in res2.data['error']

        # Database state remains as counsellor1
        self.lead_t1_a.refresh_from_db()
        assert self.lead_t1_a.assigned_employee_id == self.counsellor1.id

    # 13. Existing lead visibility and creation rules continue to work
    def test_existing_lead_creation_and_visibility_rules_continue_to_work(self):
        self.client.force_authenticate(user=self.manager1)

        # Standard lead creation without assigned employee fails as before
        bad_lead_res = self.client.post('/api/leads/', {
            'name': 'Invalid Lead',
            'email': 'invalid@lead.com',
            'phone': '+91 99999 11111',
            'team': self.team1.id,
            # assigned_employee omitted
        })
        assert bad_lead_res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'assigned_employee' in bad_lead_res.data

        # Standard lead creation with assigned employee succeeds
        good_lead_res = self.client.post('/api/leads/', {
            'name': 'Valid Lead',
            'email': 'valid@lead.com',
            'phone': '+91 99999 22222',
            'team': self.team1.id,
            'assigned_employee': self.counsellor1.id
        })
        assert good_lead_res.status_code == status.HTTP_201_CREATED
        assert good_lead_res.data['assigned_employee'] == self.counsellor1.id

        # Counsellor visibility rule: counsellor1 only sees leads assigned to them
        self.client.force_authenticate(user=self.counsellor1)
        counsellor_leads = self.client.get('/api/leads/').data
        counsellor_lead_ids = [l['id'] for l in counsellor_leads]
        assert self.lead_assigned.id in counsellor_lead_ids
        assert self.lead_t1_a.id not in counsellor_lead_ids  # Not assigned to counsellor1 before
        assert self.lead_t1_b.id not in counsellor_lead_ids  # Unassigned lead is hidden from counsellor
