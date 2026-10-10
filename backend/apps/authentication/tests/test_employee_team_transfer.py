import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.db import transaction
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import Lead, PipelineStage, LeadAssignmentHistory
from apps.audit.models import AuditEvent

@pytest.mark.django_db(transaction=True)
class TestEmployeeTeamTransfer:
    def setup_method(self):
        self.client = APIClient()

        # Pipeline stages
        self.stage_new, _ = PipelineStage.objects.get_or_create(order=1, defaults={'name': 'New Lead', 'is_active': True})
        self.stage_contacted, _ = PipelineStage.objects.get_or_create(order=2, defaults={'name': 'Contacted', 'is_active': True})

        # Teams
        self.team_alpha = Team.objects.create(name="Team Alpha Admissions")
        self.team_beta = Team.objects.create(name="Team Beta Admissions")

        # Admin
        self.admin = User.objects.create_superuser(
            username="admin_user",
            email="admin@skillmove.com",
            first_name="Admin",
            last_name="User",
            password="AdminPassword123!",
            role=UserRole.ADMIN,
            mobile_number="+919800000001",
            employee_id="EMP-0001"
        )

        # Managers
        self.manager_alpha = User.objects.create_user(
            username="mgr_alpha",
            email="manager.alpha@skillmove.com",
            first_name="Manager",
            last_name="Alpha",
            password="MgrPassword123!",
            role=UserRole.MANAGER,
            team=self.team_alpha,
            mobile_number="+919800000002",
            employee_id="EMP-0002"
        )
        self.team_alpha.manager = self.manager_alpha
        self.team_alpha.save()

        self.manager_beta = User.objects.create_user(
            username="mgr_beta",
            email="manager.beta@skillmove.com",
            first_name="Manager",
            last_name="Beta",
            password="MgrPassword123!",
            role=UserRole.MANAGER,
            team=self.team_beta,
            mobile_number="+919800000003",
            employee_id="EMP-0003"
        )
        self.team_beta.manager = self.manager_beta
        self.team_beta.save()

        # Sales Employees in Team Alpha
        self.emp_transfer = User.objects.create_user(
            username="emp_transferring",
            email="transfer@skillmove.com",
            first_name="Transfer",
            last_name="Employee",
            password="EmpPassword123!",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha,
            mobile_number="+919800000010",
            employee_id="EMP-0010"
        )

        self.emp_colleague_alpha = User.objects.create_user(
            username="emp_colleague",
            email="colleague@skillmove.com",
            first_name="Colleague",
            last_name="Alpha",
            password="EmpPassword123!",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha,
            mobile_number="+919800000011",
            employee_id="EMP-0011"
        )

        self.emp_inactive_alpha = User.objects.create_user(
            username="emp_inactive",
            email="inactive@skillmove.com",
            first_name="Inactive",
            last_name="Alpha",
            password="EmpPassword123!",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha,
            mobile_number="+919800000012",
            employee_id="EMP-0012",
            is_active=False
        )

        # Sales Employee in Team Beta
        self.emp_beta = User.objects.create_user(
            username="emp_beta_counsellor",
            email="beta.counsellor@skillmove.com",
            first_name="Beta",
            last_name="Counsellor",
            password="EmpPassword123!",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_beta,
            mobile_number="+919800000020",
            employee_id="EMP-0020"
        )

        # Create Leads assigned to emp_transfer in Team Alpha
        self.lead_1 = Lead.objects.create(
            name="Alice Smith",
            email="alice@example.com",
            phone="+919100000001",
            team=self.team_alpha,
            assigned_employee=self.emp_transfer,
            stage=self.stage_new,
            created_by=self.admin
        )
        self.lead_2 = Lead.objects.create(
            name="Bob Jones",
            email="bob@example.com",
            phone="+919100000002",
            team=self.team_alpha,
            assigned_employee=self.emp_transfer,
            stage=self.stage_contacted,
            created_by=self.admin
        )

    def test_transfer_preview_by_admin(self):
        """Admin can preview transfer with lead counts and eligible colleagues."""
        self.client.force_authenticate(user=self.admin)
        url = f"/api/auth/users/{self.emp_transfer.id}/transfer-preview/?new_team={self.team_beta.id}"
        response = self.client.get(url)

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert data['user']['id'] == self.emp_transfer.id
        assert data['current_team']['id'] == self.team_alpha.id
        assert data['target_team']['id'] == self.team_beta.id
        assert data['assigned_leads_count'] == 2
        assert data['leads_team_distribution'][self.team_alpha.name] == 2
        
        # Only active colleagues in current team should be eligible for reassignment
        eligible_ids = [e['id'] for e in data['eligible_reassign_employees']]
        assert self.emp_colleague_alpha.id in eligible_ids
        assert self.emp_inactive_alpha.id not in eligible_ids
        assert self.emp_transfer.id not in eligible_ids
        assert self.emp_beta.id not in eligible_ids

        # Supported actions should be listed
        action_names = [a['action'] for a in data['supported_actions']]
        assert 'TRANSFER_LEADS_TO_NEW_TEAM' in action_names
        assert 'REASSIGN_LEADS_WITHIN_OLD_TEAM' in action_names
        assert 'KEEP_LEADS_UNASSIGNED_IN_OLD_TEAM' in action_names

    def test_transfer_preview_forbidden_for_non_admin(self):
        """Managers and Sales Employees cannot access the transfer preview."""
        self.client.force_authenticate(user=self.manager_alpha)
        url = f"/api/auth/users/{self.emp_transfer.id}/transfer-preview/"
        response = self.client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

        self.client.force_authenticate(user=self.emp_transfer)
        response = self.client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_silent_transfer_rejected_when_leads_assigned(self):
        """Directly changing team without explicit lead action fails validation."""
        self.client.force_authenticate(user=self.admin)
        url = f"/api/auth/users/{self.emp_transfer.id}/"
        response = self.client.patch(url, {'team': self.team_beta.id}, format='json')

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'lead_transfer_action' in response.data
        
        # Invariants preserved: no changes made
        self.emp_transfer.refresh_from_db()
        assert self.emp_transfer.team == self.team_alpha

    def test_transfer_leads_to_new_team(self):
        """Admin moves employee and all their assigned leads to Team Beta."""
        self.client.force_authenticate(user=self.admin)
        url = f"/api/auth/users/{self.emp_transfer.id}/transfer-team/"
        payload = {
            'new_team': self.team_beta.id,
            'lead_transfer_action': 'TRANSFER_LEADS_TO_NEW_TEAM'
        }
        response = self.client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_200_OK

        # Verify employee is in Team Beta
        self.emp_transfer.refresh_from_db()
        assert self.emp_transfer.team == self.team_beta

        # Verify all assigned leads moved to Team Beta
        self.lead_1.refresh_from_db()
        self.lead_2.refresh_from_db()
        assert self.lead_1.team == self.team_beta
        assert self.lead_1.assigned_employee == self.emp_transfer
        assert self.lead_2.team == self.team_beta
        assert self.lead_2.assigned_employee == self.emp_transfer

        # Invariant: lead.team == assigned_employee.team
        assert self.lead_1.team == self.lead_1.assigned_employee.team
        assert self.lead_2.team == self.lead_2.assigned_employee.team

        # Verify assignment history recorded for each lead
        history_1 = LeadAssignmentHistory.objects.filter(lead=self.lead_1).latest('timestamp')
        assert history_1.from_team == self.team_alpha
        assert history_1.to_team == self.team_beta
        assert history_1.from_employee == self.emp_transfer
        assert history_1.to_employee == self.emp_transfer
        assert history_1.changed_by == self.admin

        # Verify AuditEvent recorded
        audit = AuditEvent.objects.filter(event_type='EMPLOYEE_TEAM_TRANSFERRED').latest('timestamp')
        assert audit.details['target_user_id'] == self.emp_transfer.id
        assert audit.details['from_team_id'] == self.team_alpha.id
        assert audit.details['to_team_id'] == self.team_beta.id
        assert audit.details['lead_transfer_action'] == 'TRANSFER_LEADS_TO_NEW_TEAM'
        assert audit.details['affected_leads_count'] == 2

    def test_reassign_leads_within_old_team(self):
        """Admin moves employee to Team Beta and reassigns leads to an Alpha colleague."""
        self.client.force_authenticate(user=self.admin)
        url = f"/api/auth/users/{self.emp_transfer.id}/transfer-team/"
        payload = {
            'new_team': self.team_beta.id,
            'lead_transfer_action': 'REASSIGN_LEADS_WITHIN_OLD_TEAM',
            'reassign_leads_to': self.emp_colleague_alpha.id
        }
        response = self.client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_200_OK

        # Verify employee is in Team Beta
        self.emp_transfer.refresh_from_db()
        assert self.emp_transfer.team == self.team_beta

        # Verify leads stayed in Team Alpha and reassigned to colleague
        self.lead_1.refresh_from_db()
        self.lead_2.refresh_from_db()
        assert self.lead_1.team == self.team_alpha
        assert self.lead_1.assigned_employee == self.emp_colleague_alpha
        assert self.lead_2.team == self.team_alpha
        assert self.lead_2.assigned_employee == self.emp_colleague_alpha

        # Invariant: lead.team == assigned_employee.team
        assert self.lead_1.team == self.lead_1.assigned_employee.team
        assert self.lead_2.team == self.lead_2.assigned_employee.team

        # Verify assignment history
        history_1 = LeadAssignmentHistory.objects.filter(lead=self.lead_1).latest('timestamp')
        assert history_1.from_team == self.team_alpha
        assert history_1.to_team == self.team_alpha
        assert history_1.from_employee == self.emp_transfer
        assert history_1.to_employee == self.emp_colleague_alpha

    def test_keep_leads_unassigned_in_old_team(self):
        """Admin moves employee to Team Beta and leaves leads unassigned in Team Alpha."""
        self.client.force_authenticate(user=self.admin)
        url = f"/api/auth/users/{self.emp_transfer.id}/transfer-team/"
        payload = {
            'new_team': self.team_beta.id,
            'lead_transfer_action': 'KEEP_LEADS_UNASSIGNED_IN_OLD_TEAM'
        }
        response = self.client.post(url, payload, format='json')

        assert response.status_code == status.HTTP_200_OK

        # Verify employee is in Team Beta
        self.emp_transfer.refresh_from_db()
        assert self.emp_transfer.team == self.team_beta

        # Verify leads remain in Team Alpha and are unassigned
        self.lead_1.refresh_from_db()
        self.lead_2.refresh_from_db()
        assert self.lead_1.team == self.team_alpha
        assert self.lead_1.assigned_employee is None
        assert self.lead_2.team == self.team_alpha
        assert self.lead_2.assigned_employee is None

        # Verify unassignment AuditEvent
        assert AuditEvent.objects.filter(
            event_type='LEAD_UNASSIGNED',
            details__lead_id=self.lead_1.id
        ).exists()

    def test_invalid_reassign_target_validations(self):
        """Validation rejects inactive employee, outside team employee, or self."""
        self.client.force_authenticate(user=self.admin)
        url = f"/api/auth/users/{self.emp_transfer.id}/transfer-team/"

        # 1. Inactive employee
        payload = {
            'new_team': self.team_beta.id,
            'lead_transfer_action': 'REASSIGN_LEADS_WITHIN_OLD_TEAM',
            'reassign_leads_to': self.emp_inactive_alpha.id
        }
        res = self.client.post(url, payload, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'inactive' in str(res.data)

        # 2. Outside team employee (emp_beta)
        payload['reassign_leads_to'] = self.emp_beta.id
        res = self.client.post(url, payload, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'current team' in str(res.data)

        # 3. Transferring employee themselves
        payload['reassign_leads_to'] = self.emp_transfer.id
        res = self.client.post(url, payload, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_manager_transfer_disassociates_old_team_manager(self):
        """Transferring a manager disassociates them as the manager of their old team."""
        self.client.force_authenticate(user=self.admin)
        url = f"/api/auth/users/{self.manager_alpha.id}/transfer-team/"
        payload = {
            'new_team': self.team_beta.id
        }
        res = self.client.post(url, payload, format='json')
        assert res.status_code == status.HTTP_200_OK, res.data

        self.team_alpha.refresh_from_db()
        assert self.team_alpha.manager is None
        self.manager_alpha.refresh_from_db()
        assert self.manager_alpha.team == self.team_beta

    def test_role_specific_visibility_after_transfer(self):
        """
        Verify manager visibility updates appropriately:
        - Alpha manager sees leads initially.
        - After TRANSFER_LEADS_TO_NEW_TEAM, Alpha manager loses visibility, Beta manager gains it.
        """
        # Manager Alpha can see lead_1 initially
        self.client.force_authenticate(user=self.manager_alpha)
        res = self.client.get('/api/leads/')
        assert res.status_code == status.HTTP_200_OK
        lead_ids = [l['id'] for l in res.data]
        assert self.lead_1.id in lead_ids

        # Manager Beta cannot see lead_1 initially
        self.client.force_authenticate(user=self.manager_beta)
        res = self.client.get('/api/leads/')
        lead_ids = [l['id'] for l in res.data]
        assert self.lead_1.id not in lead_ids

        # Admin executes transfer with TRANSFER_LEADS_TO_NEW_TEAM
        self.client.force_authenticate(user=self.admin)
        url = f"/api/auth/users/{self.emp_transfer.id}/transfer-team/"
        self.client.post(url, {
            'new_team': self.team_beta.id,
            'lead_transfer_action': 'TRANSFER_LEADS_TO_NEW_TEAM'
        }, format='json')

        # Now Manager Alpha cannot see lead_1
        self.client.force_authenticate(user=self.manager_alpha)
        res = self.client.get('/api/leads/')
        lead_ids = [l['id'] for l in res.data]
        assert self.lead_1.id not in lead_ids

        # And Manager Beta can see lead_1
        self.client.force_authenticate(user=self.manager_beta)
        res = self.client.get('/api/leads/')
        lead_ids = [l['id'] for l in res.data]
        assert self.lead_1.id in lead_ids

    def test_ordinary_lead_edits_preserved(self):
        """Ordinary lead edits (e.g. changing phone, name) remain fully functional."""
        self.client.force_authenticate(user=self.admin)
        url = f"/api/leads/{self.lead_1.id}/"
        res = self.client.patch(url, {
            'name': 'Alice Smith Updated',
            'phone': '+919999988888'
        }, format='json')
        assert res.status_code == status.HTTP_200_OK
        self.lead_1.refresh_from_db()
        assert self.lead_1.name == 'Alice Smith Updated'
        assert self.lead_1.phone == '+919999988888'
