import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.db import transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import Lead, PipelineStage
from apps.audit.models import AuditEvent

@pytest.mark.django_db(transaction=True)
class TestTeamBackendIntegrity:
    def setup_method(self):
        self.client = APIClient()

        # Pipeline stages
        self.stage_new, _ = PipelineStage.objects.get_or_create(
            order=1, defaults={'name': 'Cold Calling', 'is_active': True}
        )

        # Admin User
        self.admin = User.objects.create_superuser(
            username="admin_integ",
            email="admin.integ@skillmove.com",
            first_name="Admin",
            last_name="Integrity",
            password="AdminPassword123!",
            role=UserRole.ADMIN,
            mobile_number="+919811000001",
            employee_id="EMP-T001"
        )

        # Managers
        self.manager_alpha = User.objects.create_user(
            username="mgr_integ_alpha",
            email="mgr.alpha@skillmove.com",
            first_name="Manager",
            last_name="Alpha",
            password="MgrPassword123!",
            role=UserRole.MANAGER,
            mobile_number="+919811000002",
            employee_id="EMP-T002"
        )
        self.manager_beta = User.objects.create_user(
            username="mgr_integ_beta",
            email="mgr.beta@skillmove.com",
            first_name="Manager",
            last_name="Beta",
            password="MgrPassword123!",
            role=UserRole.MANAGER,
            mobile_number="+919811000003",
            employee_id="EMP-T003"
        )

        # Sales Employees
        self.sales_emp = User.objects.create_user(
            username="sales_integ_1",
            email="sales.1@skillmove.com",
            first_name="Sales",
            last_name="One",
            password="EmpPassword123!",
            role=UserRole.SALES_EMPLOYEE,
            mobile_number="+919811000004",
            employee_id="EMP-T004"
        )

        # Teams
        self.team_alpha = Team.objects.create(
            name="Alpha Admissions Integ",
            description="Alpha team for undergraduate sales.",
            manager=self.manager_alpha,
            is_active=True
        )
        self.manager_alpha.team = self.team_alpha
        self.manager_alpha.save(update_fields=['team'])

        self.sales_emp.team = self.team_alpha
        self.sales_emp.save(update_fields=['team'])

    def test_duplicate_team_names_rejected(self):
        """Cannot create a team with an exact or case-insensitive duplicate name."""
        self.client.force_authenticate(user=self.admin)

        # Exact duplicate
        res1 = self.client.post('/api/teams/', {
            'name': 'Alpha Admissions Integ',
            'description': 'Duplicate team'
        })
        assert res1.status_code == status.HTTP_400_BAD_REQUEST
        assert 'name' in res1.data

        # Case-insensitive duplicate
        res2 = self.client.post('/api/teams/', {
            'name': 'alpha admissions integ',
            'description': 'Lower case duplicate'
        })
        assert res2.status_code == status.HTTP_400_BAD_REQUEST
        assert 'name' in res2.data

    def test_invalid_manager_rejected(self):
        """Designated manager must have MANAGER role and cannot manage multiple teams."""
        self.client.force_authenticate(user=self.admin)

        # 1. Sales Employee cannot be manager
        res1 = self.client.post('/api/teams/', {
            'name': 'Beta Admissions Integ',
            'manager': self.sales_emp.id
        })
        assert res1.status_code == status.HTTP_400_BAD_REQUEST
        assert 'manager' in str(res1.data)

        # 2. Manager already managing another team cannot manage second team
        res2 = self.client.post('/api/teams/', {
            'name': 'Beta Admissions Integ',
            'manager': self.manager_alpha.id
        })
        assert res2.status_code == status.HTTP_400_BAD_REQUEST
        assert 'already exists' in str(res2.data) or 'already the manager' in str(res2.data)

    def test_manager_and_employee_cannot_create_or_edit_team(self):
        """Managers and Sales Employees cannot create, edit, or delete teams."""
        # Sales Employee
        self.client.force_authenticate(user=self.sales_emp)
        assert self.client.post('/api/teams/', {'name': 'New Team'}).status_code == status.HTTP_403_FORBIDDEN
        assert self.client.patch(f'/api/teams/{self.team_alpha.id}/', {'name': 'New'}).status_code == status.HTTP_403_FORBIDDEN
        assert self.client.delete(f'/api/teams/{self.team_alpha.id}/').status_code == status.HTTP_403_FORBIDDEN

        # Manager
        self.client.force_authenticate(user=self.manager_alpha)
        assert self.client.post('/api/teams/', {'name': 'New Team'}).status_code == status.HTTP_403_FORBIDDEN
        assert self.client.patch(f'/api/teams/{self.team_alpha.id}/', {'name': 'New'}).status_code == status.HTTP_403_FORBIDDEN
        assert self.client.delete(f'/api/teams/{self.team_alpha.id}/').status_code == status.HTTP_403_FORBIDDEN

    def test_protected_team_deletion_with_leads_prevented(self):
        """A team with associated leads cannot be deleted, returns 400 and logs audit event."""
        # Create lead associated with team_alpha
        lead = Lead.objects.create(
            name="John Doe",
            email="john@example.com",
            phone="+919800112233",
            team=self.team_alpha,
            assigned_employee=self.sales_emp,
            stage=self.stage_new,
            created_by=self.admin
        )

        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f'/api/teams/{self.team_alpha.id}/')

        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data['code'] == 'TEAM_HAS_LEADS'
        assert 'leads must be reassigned' in str(res.data['detail']).lower()

        # Verify team and lead still exist intact
        assert Team.objects.filter(id=self.team_alpha.id).exists()
        assert Lead.objects.filter(id=lead.id).exists()

        # Verify audit event
        audit = AuditEvent.objects.filter(
            event_type='TEAM_DELETION_ATTEMPTED',
            details__team_id=self.team_alpha.id
        ).latest('timestamp')
        assert audit.details['reason'] == 'Team has associated leads'

    def test_team_deletion_with_members_prevented(self):
        """A team with employee members cannot be deleted, returns 400 and logs audit event."""
        # team_alpha has sales_emp as a member, but 0 leads
        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f'/api/teams/{self.team_alpha.id}/')

        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.data['code'] == 'TEAM_HAS_MEMBERS'
        assert 'assigned employee(s)' in str(res.data['detail'])

        assert Team.objects.filter(id=self.team_alpha.id).exists()
        assert User.objects.filter(id=self.sales_emp.id, team=self.team_alpha).exists()

        audit = AuditEvent.objects.filter(
            event_type='TEAM_DELETION_ATTEMPTED',
            details__team_id=self.team_alpha.id
        ).latest('timestamp')
        assert audit.details['reason'] == 'Team has assigned employees'

    def test_safe_deletion_of_empty_team(self):
        """An empty team with 0 leads and 0 members deletes cleanly with HTTP 204."""
        empty_team = Team.objects.create(name="Empty Team Integ")
        team_id = empty_team.id

        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f'/api/teams/{team_id}/')

        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert not Team.objects.filter(id=team_id).exists()

        audit = AuditEvent.objects.filter(
            event_type='TEAM_DELETED',
            details__team_id=team_id
        ).latest('timestamp')
        assert audit.details['team_name'] == 'Empty Team Integ'

    def test_team_audit_logging_full_lifecycle(self):
        """Verifies audit events for team creation, update, manager change, deactivation, and activation."""
        self.client.force_authenticate(user=self.admin)

        # 1. Create team
        res_create = self.client.post('/api/teams/', {
            'name': 'Lifecycle Team',
            'description': 'Lifecycle testing team',
            'manager': self.manager_beta.id
        })
        assert res_create.status_code == status.HTTP_201_CREATED
        new_team_id = res_create.data['id']

        audit_create = AuditEvent.objects.filter(
            event_type='TEAM_CREATED',
            details__team_id=new_team_id
        ).latest('timestamp')
        assert audit_create.details['team_name'] == 'Lifecycle Team'
        assert audit_create.details['manager_id'] == self.manager_beta.id

        # 2. Update team details (name, description)
        res_update = self.client.patch(f'/api/teams/{new_team_id}/', {
            'name': 'Lifecycle Team Renamed',
            'description': 'Updated description'
        })
        assert res_update.status_code == status.HTTP_200_OK

        audit_update = AuditEvent.objects.filter(
            event_type='TEAM_UPDATED',
            details__team_id=new_team_id
        ).latest('timestamp')
        assert 'name' in audit_update.details['changes']

        # 3. Disassociate / change manager
        res_mgr = self.client.patch(f'/api/teams/{new_team_id}/', {
            'manager': None
        }, format='json')
        assert res_mgr.status_code == status.HTTP_200_OK

        audit_mgr = AuditEvent.objects.filter(
            event_type='TEAM_MANAGER_CHANGED',
            details__team_id=new_team_id
        ).latest('timestamp')
        assert audit_mgr.details['old_manager_id'] == self.manager_beta.id
        assert audit_mgr.details['new_manager_id'] is None

        # 4. Deactivate team
        res_deact = self.client.patch(f'/api/teams/{new_team_id}/', {
            'is_active': False
        }, format='json')
        assert res_deact.status_code == status.HTTP_200_OK

        audit_deact = AuditEvent.objects.filter(
            event_type='TEAM_DEACTIVATED',
            details__team_id=new_team_id
        ).latest('timestamp')
        assert audit_deact.details['previous_active'] is True

        # 5. Reactivate team
        res_act = self.client.patch(f'/api/teams/{new_team_id}/', {
            'is_active': True
        }, format='json')
        assert res_act.status_code == status.HTTP_200_OK

        audit_act = AuditEvent.objects.filter(
            event_type='TEAM_ACTIVATED',
            details__team_id=new_team_id
        ).latest('timestamp')
        assert audit_act.details['previous_active'] is False

    def test_deactivate_team_with_leads_rejected(self):
        """Setting is_active=False on a team with leads is blocked with HTTP 400."""
        Lead.objects.create(
            name="Lead With Team",
            email="lead.team@example.com",
            phone="+919811223344",
            team=self.team_alpha,
            assigned_employee=self.sales_emp,
            stage=self.stage_new,
            created_by=self.admin
        )

        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(f'/api/teams/{self.team_alpha.id}/', {
            'is_active': False
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'is_active' in str(res.data)
        assert 'cannot deactivate team' in str(res.data).lower()

        self.team_alpha.refresh_from_db()
        assert self.team_alpha.is_active is True

    def test_inactive_team_excluded_from_employee_assignment(self):
        """Inactive teams cannot be assigned to new or existing employees."""
        inactive_team = Team.objects.create(name="Inactive Team", is_active=False)

        self.client.force_authenticate(user=self.admin)

        # 1. Creating employee on inactive team fails
        res_create = self.client.post('/api/auth/users/', {
            'full_name': 'Inactive Member',
            'email': 'inactive.member@skillmove.com',
            'mobile_number': '+919876543210',
            'role': UserRole.SALES_EMPLOYEE,
            'team': inactive_team.id
        })
        assert res_create.status_code == status.HTTP_400_BAD_REQUEST
        assert 'team' in res_create.data
        assert 'inactive' in str(res_create.data['team']).lower()

        # 2. Updating employee to inactive team fails
        res_update = self.client.patch(f'/api/auth/users/{self.sales_emp.id}/', {
            'team': inactive_team.id
        })
        assert res_update.status_code == status.HTTP_400_BAD_REQUEST
        assert 'team' in res_update.data
        assert 'inactive' in str(res_update.data['team']).lower()

        # 3. Transferring employee to inactive team fails
        res_transfer = self.client.post(f'/api/auth/users/{self.sales_emp.id}/transfer-team/', {
            'new_team': inactive_team.id
        })
        assert res_transfer.status_code == status.HTTP_400_BAD_REQUEST

    def test_inactive_team_excluded_from_lead_assignment(self):
        """Inactive teams cannot be assigned during lead creation or updates."""
        inactive_team = Team.objects.create(name="Inactive Lead Team", is_active=False)

        self.client.force_authenticate(user=self.admin)

        # 1. Creating lead on inactive team fails
        res_create = self.client.post('/api/leads/', {
            'name': 'Test Lead Inactive',
            'email': 'inactive.lead@example.com',
            'phone': '+919877112233',
            'team': inactive_team.id,
            'assigned_employee': self.sales_emp.id
        })
        assert res_create.status_code == status.HTTP_400_BAD_REQUEST
        assert 'team' in res_create.data
        assert 'inactive' in str(res_create.data['team']).lower()

        # 2. Moving existing lead to inactive team fails
        active_lead = Lead.objects.create(
            name="Active Lead",
            email="active.lead@example.com",
            phone="+919877112244",
            team=self.team_alpha,
            assigned_employee=self.sales_emp,
            stage=self.stage_new,
            created_by=self.admin
        )
        res_update = self.client.patch(f'/api/leads/{active_lead.id}/', {
            'team': inactive_team.id
        })
        assert res_update.status_code == status.HTTP_400_BAD_REQUEST
        assert 'team' in res_update.data
        assert 'inactive' in str(res_update.data['team']).lower()

    def test_historical_inactive_team_visibility_and_query_filters(self):
        """Admin can see active/inactive teams; query filters work; historical records preserved."""
        inactive_team = Team.objects.create(name="Historical Inactive Team", is_active=False)

        self.client.force_authenticate(user=self.admin)

        # All teams
        res_all = self.client.get('/api/teams/')
        assert res_all.status_code == status.HTTP_200_OK
        all_ids = [t['id'] for t in res_all.data]
        assert self.team_alpha.id in all_ids
        assert inactive_team.id in all_ids

        # Active only filter
        res_active = self.client.get('/api/teams/?is_active=true')
        assert res_active.status_code == status.HTTP_200_OK
        active_ids = [t['id'] for t in res_active.data]
        assert self.team_alpha.id in active_ids
        assert inactive_team.id not in active_ids

        # Inactive only filter
        res_inactive = self.client.get('/api/teams/?is_active=false')
        assert res_inactive.status_code == status.HTTP_200_OK
        inactive_ids = [t['id'] for t in res_inactive.data]
        assert inactive_team.id in inactive_ids
        assert self.team_alpha.id not in inactive_ids

        # Retrieve specific inactive team by ID (historical lookup)
        res_detail = self.client.get(f'/api/teams/{inactive_team.id}/')
        assert res_detail.status_code == status.HTTP_200_OK
        assert res_detail.data['name'] == 'Historical Inactive Team'
        assert res_detail.data['is_active'] is False
