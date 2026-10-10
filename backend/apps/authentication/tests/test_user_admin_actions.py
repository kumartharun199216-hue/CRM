import pytest
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import Lead, PipelineStage
from apps.audit.models import AuditEvent

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def teams_and_users(db):
    team_alpha = Team.objects.create(name="Alpha Admissions")
    team_beta = Team.objects.create(name="Beta Admissions")

    admin1 = User.objects.create_user(
        username="admin1@skillmove.com",
        email="admin1@skillmove.com",
        password="AdminPassword123!",
        role=UserRole.ADMIN,
        first_name="Admin",
        last_name="One",
        team=team_alpha,
        is_active=True,
    )
    admin2 = User.objects.create_user(
        username="admin2@skillmove.com",
        email="admin2@skillmove.com",
        password="AdminPassword123!",
        role=UserRole.ADMIN,
        first_name="Admin",
        last_name="Two",
        team=team_alpha,
        is_active=True,
    )

    manager_alpha = User.objects.create_user(
        username="manager.alpha@skillmove.com",
        email="manager.alpha@skillmove.com",
        password="ManagerPassword123!",
        role=UserRole.MANAGER,
        first_name="Manager",
        last_name="Alpha",
        team=team_alpha,
        is_active=True,
    )
    team_alpha.manager = manager_alpha
    team_alpha.save(update_fields=['manager'])

    manager_beta = User.objects.create_user(
        username="manager.beta@skillmove.com",
        email="manager.beta@skillmove.com",
        password="ManagerPassword123!",
        role=UserRole.MANAGER,
        first_name="Manager",
        last_name="Beta",
        team=team_beta,
        is_active=True,
    )
    team_beta.manager = manager_beta
    team_beta.save(update_fields=['manager'])

    counsellor_alpha = User.objects.create_user(
        username="counsellor.alpha@skillmove.com",
        email="counsellor.alpha@skillmove.com",
        password="CounsellorPassword123!",
        role=UserRole.SALES_EMPLOYEE,
        first_name="Counsellor",
        last_name="Alpha",
        team=team_alpha,
        mobile_number="9876543210",
        designation="Junior Counsellor",
        is_active=True,
    )

    counsellor_beta = User.objects.create_user(
        username="counsellor.beta@skillmove.com",
        email="counsellor.beta@skillmove.com",
        password="CounsellorPassword123!",
        role=UserRole.SALES_EMPLOYEE,
        first_name="Counsellor",
        last_name="Beta",
        team=team_beta,
        mobile_number="9876543211",
        designation="Senior Counsellor",
        is_active=True,
    )

    stage, _ = PipelineStage.objects.get_or_create(name="Cold Calling", defaults={'order': 1, 'is_active': True})
    lead1 = Lead.objects.create(
        name="Lead One",
        email="lead1@example.com",
        phone="9988776655",
        stage=stage,
        assigned_employee=counsellor_alpha,
        team=team_alpha,
        created_by=admin1,
    )

    return {
        'admin1': admin1,
        'admin2': admin2,
        'manager_alpha': manager_alpha,
        'manager_beta': manager_beta,
        'counsellor_alpha': counsellor_alpha,
        'counsellor_beta': counsellor_beta,
        'team_alpha': team_alpha,
        'team_beta': team_beta,
        'stage': stage,
        'lead1': lead1,
    }


@pytest.mark.django_db
class TestEmployeeAdministration:

    def test_view_details_admin_can_view_any_employee(self, api_client, teams_and_users):
        admin = teams_and_users['admin1']
        counsellor = teams_and_users['counsellor_beta']
        api_client.force_authenticate(user=admin)

        res = api_client.get(f'/api/auth/users/{counsellor.id}/')
        assert res.status_code == 200
        assert res.data['email'] == counsellor.email
        assert res.data['account_status'] == 'ACTIVE'

    def test_view_details_manager_within_team_authorized(self, api_client, teams_and_users):
        mgr = teams_and_users['manager_alpha']
        counsellor_alpha = teams_and_users['counsellor_alpha']
        api_client.force_authenticate(user=mgr)

        res = api_client.get(f'/api/auth/users/{counsellor_alpha.id}/')
        assert res.status_code == 200
        assert res.data['email'] == counsellor_alpha.email

    def test_view_details_manager_outside_team_rejected(self, api_client, teams_and_users):
        mgr = teams_and_users['manager_alpha']
        counsellor_beta = teams_and_users['counsellor_beta']
        api_client.force_authenticate(user=mgr)

        res = api_client.get(f'/api/auth/users/{counsellor_beta.id}/')
        assert res.status_code == 403

    def test_view_details_counsellor_cannot_view_others(self, api_client, teams_and_users):
        counsellor_alpha = teams_and_users['counsellor_alpha']
        counsellor_beta = teams_and_users['counsellor_beta']
        api_client.force_authenticate(user=counsellor_alpha)

        res = api_client.get(f'/api/auth/users/{counsellor_beta.id}/')
        assert res.status_code == 403

    def test_edit_details_admin_can_update_fields_and_audit_logged(self, api_client, teams_and_users):
        admin = teams_and_users['admin1']
        counsellor = teams_and_users['counsellor_alpha']
        team_beta = teams_and_users['team_beta']
        api_client.force_authenticate(user=admin)

        res = api_client.patch(f'/api/auth/users/{counsellor.id}/', {
            'full_name': 'Alpha Star Performer',
            'designation': 'Team Lead Counsellor',
            'team': team_beta.id,
        })
        assert res.status_code == 200
        counsellor.refresh_from_db()
        assert counsellor.first_name == 'Alpha'
        assert counsellor.last_name == 'Star Performer'
        assert counsellor.designation == 'Team Lead Counsellor'
        assert counsellor.team_id == team_beta.id

        # Verify audit event
        audit = AuditEvent.objects.filter(event_type='USER_UPDATED', user=admin).first()
        assert audit is not None
        assert audit.details['target_user_id'] == counsellor.id

    def test_edit_details_manager_can_update_assigned_sales_employee(self, api_client, teams_and_users):
        mgr = teams_and_users['manager_alpha']
        counsellor = teams_and_users['counsellor_alpha']
        api_client.force_authenticate(user=mgr)

        res = api_client.patch(f'/api/auth/users/{counsellor.id}/', {
            'designation': 'Senior Admissions Associate',
            'mobile_number': '9111223344',
        })
        assert res.status_code == 200
        counsellor.refresh_from_db()
        assert counsellor.designation == 'Senior Admissions Associate'
        assert counsellor.mobile_number == '9111223344'

    def test_edit_details_manager_cannot_promote_to_admin_or_manager(self, api_client, teams_and_users):
        mgr = teams_and_users['manager_alpha']
        counsellor = teams_and_users['counsellor_alpha']
        api_client.force_authenticate(user=mgr)

        res = api_client.patch(f'/api/auth/users/{counsellor.id}/', {
            'role': UserRole.ADMIN,
        })
        assert res.status_code == 403

        res2 = api_client.patch(f'/api/auth/users/{counsellor.id}/', {
            'role': UserRole.MANAGER,
        })
        assert res2.status_code == 403

    def test_edit_details_manager_cannot_reassign_employee_to_other_team(self, api_client, teams_and_users):
        mgr = teams_and_users['manager_alpha']
        counsellor = teams_and_users['counsellor_alpha']
        team_beta = teams_and_users['team_beta']
        api_client.force_authenticate(user=mgr)

        res = api_client.patch(f'/api/auth/users/{counsellor.id}/', {
            'team': team_beta.id,
        })
        assert res.status_code == 403

    def test_edit_details_manager_cannot_edit_other_manager_or_admin(self, api_client, teams_and_users):
        mgr_alpha = teams_and_users['manager_alpha']
        mgr_beta = teams_and_users['manager_beta']
        admin = teams_and_users['admin1']
        api_client.force_authenticate(user=mgr_alpha)

        res = api_client.patch(f'/api/auth/users/{mgr_beta.id}/', {'designation': 'Hacked'})
        assert res.status_code == 403

        res_admin = api_client.patch(f'/api/auth/users/{admin.id}/', {'designation': 'Hacked'})
        assert res_admin.status_code == 403

    def test_deactivate_and_activate_account_workflow(self, api_client, teams_and_users):
        admin = teams_and_users['admin1']
        counsellor = teams_and_users['counsellor_alpha']
        token = Token.objects.create(user=counsellor)
        api_client.force_authenticate(user=admin)

        # Deactivate
        deact_res = api_client.post(f'/api/auth/users/{counsellor.id}/deactivate/')
        assert deact_res.status_code == 200
        assert deact_res.data['sessions_invalidated'] is True
        counsellor.refresh_from_db()
        assert counsellor.is_active is False

        # Verify active session token was deleted
        assert not Token.objects.filter(user=counsellor).exists()

        # Verify Audit Log
        deact_audit = AuditEvent.objects.filter(event_type='ACCOUNT_DEACTIVATED', user=admin).first()
        assert deact_audit is not None
        assert deact_audit.details['target_user_id'] == counsellor.id

        # Verify authentication fails after deactivation
        api_client.logout()
        login_res = api_client.post('/api/auth/login/', {
            'username': counsellor.email,
            'password': 'CounsellorPassword123!',
        })
        assert login_res.status_code == 400
        assert 'disabled' in str(login_res.data).lower()

        # Activate again
        api_client.force_authenticate(user=admin)
        act_res = api_client.post(f'/api/auth/users/{counsellor.id}/activate/')
        assert act_res.status_code == 200
        counsellor.refresh_from_db()
        assert counsellor.is_active is True

        act_audit = AuditEvent.objects.filter(event_type='ACCOUNT_ACTIVATED', user=admin).first()
        assert act_audit is not None
        assert act_audit.details['target_user_id'] == counsellor.id

    def test_deactivate_preserves_lead_assignment_and_historical_records(self, api_client, teams_and_users):
        admin = teams_and_users['admin1']
        counsellor = teams_and_users['counsellor_alpha']
        lead = teams_and_users['lead1']
        api_client.force_authenticate(user=admin)

        # Deactivate without reassigning
        res = api_client.post(f'/api/auth/users/{counsellor.id}/deactivate/')
        assert res.status_code == 200

        # Lead record is preserved and still linked to counsellor
        lead.refresh_from_db()
        assert lead.assigned_employee_id == counsellor.id
        assert lead.name == "Lead One"

    def test_deactivate_with_optional_lead_reassignment(self, api_client, teams_and_users):
        mgr = teams_and_users['manager_alpha']
        counsellor_alpha = teams_and_users['counsellor_alpha']
        counsellor_replacement = User.objects.create_user(
            username="replacement@skillmove.com",
            email="replacement@skillmove.com",
            password="Password123!",
            role=UserRole.SALES_EMPLOYEE,
            team=teams_and_users['team_alpha'],
            is_active=True
        )
        lead = teams_and_users['lead1']
        api_client.force_authenticate(user=mgr)

        res = api_client.post(f'/api/auth/users/{counsellor_alpha.id}/deactivate/', {
            'reassign_leads_to': counsellor_replacement.id
        })
        assert res.status_code == 200
        assert res.data['leads_reassigned_count'] == 1

        lead.refresh_from_db()
        assert lead.assigned_employee_id == counsellor_replacement.id

        reassign_audit = AuditEvent.objects.filter(event_type='LEAD_REASSIGNED', user=mgr).first()
        assert reassign_audit is not None
        assert reassign_audit.details['to_employee_id'] == counsellor_replacement.id

    def test_admin_cannot_deactivate_self_or_last_active_admin(self, api_client, teams_and_users):
        admin1 = teams_and_users['admin1']
        admin2 = teams_and_users['admin2']
        api_client.force_authenticate(user=admin1)

        # 1. Admin cannot deactivate themselves
        res_self = api_client.post(f'/api/auth/users/{admin1.id}/deactivate/')
        assert res_self.status_code == 400
        assert 'cannot deactivate' in str(res_self.data).lower()

        # 2. Deactivate admin2 (leaves admin1 as the only active admin)
        res_admin2 = api_client.post(f'/api/auth/users/{admin2.id}/deactivate/')
        assert res_admin2.status_code == 200

        # Now admin1 is the sole active admin. Deactivating admin1 by any means is prohibited.
        api_client.force_authenticate(user=admin1)
        res_last = api_client.patch(f'/api/auth/users/{admin1.id}/', {'is_active': False})
        assert res_last.status_code == 400

    def test_delete_endpoint_safely_deactivates_and_prohibits_hard_deletion(self, api_client, teams_and_users):
        admin = teams_and_users['admin1']
        counsellor = teams_and_users['counsellor_beta']
        api_client.force_authenticate(user=admin)

        res = api_client.delete(f'/api/auth/users/{counsellor.id}/')
        assert res.status_code == 200
        assert 'prohibited' in res.data['detail'].lower()

        # Ensure user still exists in DB as inactive
        assert User.objects.filter(id=counsellor.id).exists()
        counsellor.refresh_from_db()
        assert counsellor.is_active is False
