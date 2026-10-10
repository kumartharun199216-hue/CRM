import pytest
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from django.contrib.auth.hashers import check_password
from apps.authentication.models import User, UserRole, EmployeeIdSequence, PasswordResetToken
from apps.teams.models import Team
from apps.leads.models import Lead, PipelineStage
from apps.audit.models import AuditEvent

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def setup_crm_environment(db):
    team_alpha = Team.objects.create(name="Alpha Team")
    team_beta = Team.objects.create(name="Beta Team")

    admin = User.objects.create_user(
        username="superadmin@skillmove.com",
        email="superadmin@skillmove.com",
        password="AdminSecurePassword123!",
        role=UserRole.ADMIN,
        first_name="Super",
        last_name="Admin",
        team=team_alpha,
        is_active=True,
        must_change_password=False,
    )

    manager_alpha = User.objects.create_user(
        username="manager.alpha@skillmove.com",
        email="manager.alpha@skillmove.com",
        password="ManagerSecurePassword123!",
        role=UserRole.MANAGER,
        first_name="Manager",
        last_name="Alpha",
        team=team_alpha,
        is_active=True,
        must_change_password=False,
    )
    team_alpha.manager = manager_alpha
    team_alpha.save(update_fields=['manager'])

    stage, _ = PipelineStage.objects.get_or_create(
        name="Discovery Call",
        defaults={'order': 1, 'is_active': True}
    )

    return {
        'admin': admin,
        'manager_alpha': manager_alpha,
        'team_alpha': team_alpha,
        'team_beta': team_beta,
        'stage': stage,
    }


@pytest.mark.django_db
class TestUserManagementEndToEndWorkflow:
    def test_complete_onboarding_to_login_to_password_change_journey(self, api_client, setup_crm_environment):
        admin = setup_crm_environment['admin']
        team_alpha = setup_crm_environment['team_alpha']
        stage = setup_crm_environment['stage']

        # 1. Admin logs in and opens User Management
        api_client.force_authenticate(user=admin)
        list_res = api_client.get('/api/auth/users/')
        assert list_res.status_code == 200

        # 2. Admin creates a new employee account
        create_res = api_client.post('/api/auth/users/', {
            'full_name': 'Aarav Sharma',
            'email': 'aarav.sharma@skillmove.com',
            'mobile_number': '9876500001',
            'role': 'SALES_EMPLOYEE',
            'team': team_alpha.id,
            'designation': 'Senior Admissions Counsellor',
            'department': 'Admissions',
            'work_location': 'Bangalore HQ',
            'date_of_joining': '2026-03-01',
        })
        assert create_res.status_code == 201
        created_data = create_res.data

        # 3. Backend generates unique Employee ID and temporary password
        assert 'employee_id' in created_data
        assert created_data['employee_id'].startswith('EMP-')
        emp_id = created_data['employee_id']

        assert 'temporary_password' in created_data
        temp_password = created_data['temporary_password']
        assert len(temp_password) >= 12
        assert created_data['must_change_password'] is True

        user_id = created_data['id']
        aarav_user = User.objects.get(id=user_id)

        # 4. Security Check: Plaintext password is NEVER stored in database
        assert aarav_user.password != temp_password
        assert check_password(temp_password, aarav_user.password)

        # 5. Security Check: Temporary password is NEVER exposed in list or detail APIs
        detail_res = api_client.get(f'/api/auth/users/{user_id}/')
        assert detail_res.status_code == 200
        assert 'temporary_password' not in detail_res.data

        user_list_res = api_client.get('/api/auth/users/')
        for u in user_list_res.data:
            assert 'temporary_password' not in u

        # 6. Security Check: AuditEvent does not leak plaintext password
        audit_event = AuditEvent.objects.filter(event_type='USER_CREATED', details__user_id=user_id).first()
        assert audit_event is not None
        assert temp_password not in str(audit_event.details)

        # 7. Employee logs in with the temporary password
        api_client.logout()
        login_res = api_client.post('/api/auth/login/', {
            'username': 'aarav.sharma@skillmove.com',
            'password': temp_password,
        })
        assert login_res.status_code == 200
        emp_token = login_res.data['token']
        assert login_res.data['user']['must_change_password'] is True

        # 8. Employee cannot bypass restriction through direct API calls to protected CRM endpoints
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {emp_token}')

        leads_blocked_res = api_client.get('/api/leads/')
        assert leads_blocked_res.status_code == 403
        assert 'password change required' in leads_blocked_res.content.decode().lower()

        dash_blocked_res = api_client.get('/api/leads/dashboard-stats/')
        assert dash_blocked_res.status_code == 403

        # 9. Employee CAN access My Profile (/api/auth/me/) while restricted
        profile_res = api_client.get('/api/auth/me/')
        assert profile_res.status_code == 200
        assert profile_res.data['email'] == 'aarav.sharma@skillmove.com'

        # Employee updates permitted details (e.g. mobile number, work location)
        update_profile_res = api_client.patch('/api/auth/me/', {
            'mobile_number': '9876509999',
            'work_location': 'Bangalore South Campus',
        })
        assert update_profile_res.status_code == 200
        aarav_user.refresh_from_db()
        assert aarav_user.mobile_number == '9876509999'

        # Employee CANNOT update protected fields (role, team, employee_id) via profile
        tamper_res = api_client.patch('/api/auth/me/', {
            'role': 'ADMIN',
            'employee_id': 'EMP-9999',
        })
        assert tamper_res.status_code == 400
        aarav_user.refresh_from_db()
        assert aarav_user.role == UserRole.SALES_EMPLOYEE
        assert aarav_user.employee_id == emp_id

        # 10. Employee changes temporary password to permanent password
        new_permanent_pass = 'AaravPermanentPass2026!'
        change_res = api_client.post('/api/auth/change-password/', {
            'current_password': temp_password,
            'new_password': new_permanent_pass,
            'confirm_password': new_permanent_pass,
        })
        assert change_res.status_code == 200
        new_token = change_res.data['token']
        aarav_user.refresh_from_db()
        assert aarav_user.must_change_password is False

        # CRM access is now fully unlocked
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {new_token}')
        leads_open_res = api_client.get('/api/leads/')
        assert leads_open_res.status_code == 200

        # Verify Audit Log recorded PASSWORD_CHANGED without secrets
        pw_audit = AuditEvent.objects.filter(event_type='PASSWORD_CHANGED', user=aarav_user).first()
        assert pw_audit is not None
        assert new_permanent_pass not in str(pw_audit.details)
        assert temp_password not in str(pw_audit.details)

        # 11. Assign a lead to Aarav to verify lead preservation on deactivation
        lead1 = Lead.objects.create(
            name="Priya Patel",
            email="priya@example.com",
            phone="9123456780",
            stage=stage,
            team=team_alpha,
            assigned_employee=aarav_user,
            created_by=admin,
        )

        # 12. Admin deactivates Aarav's account
        admin_token, _ = Token.objects.get_or_create(user=admin)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {admin_token.key}')
        deact_res = api_client.post(f'/api/auth/users/{aarav_user.id}/deactivate/')
        assert deact_res.status_code == 200
        aarav_user.refresh_from_db()
        assert aarav_user.is_active is False

        # 13. Active session tokens are immediately deleted
        assert not Token.objects.filter(user=aarav_user).exists()

        # 14. Lead record is preserved and still associated with Aarav
        lead1.refresh_from_db()
        assert lead1.assigned_employee_id == aarav_user.id

        # 15. Deactivated account cannot authenticate
        api_client.logout()
        deact_login_res = api_client.post('/api/auth/login/', {
            'username': 'aarav.sharma@skillmove.com',
            'password': new_permanent_pass,
        })
        assert deact_login_res.status_code == 400
        assert 'disabled' in str(deact_login_res.data).lower()

    def test_manager_boundaries_and_sales_employee_restrictions(self, api_client, setup_crm_environment):
        admin = setup_crm_environment['admin']
        manager_alpha = setup_crm_environment['manager_alpha']
        team_alpha = setup_crm_environment['team_alpha']
        team_beta = setup_crm_environment['team_beta']

        # Manager can create Sales Employee in team Alpha
        api_client.force_authenticate(user=manager_alpha)
        mgr_create_res = api_client.post('/api/auth/users/', {
            'full_name': 'Alpha Counsellor',
            'email': 'alpha.counsellor@skillmove.com',
            'mobile_number': '9876500002',
            'role': 'SALES_EMPLOYEE',
            'team': team_alpha.id,
        })
        assert mgr_create_res.status_code == 201
        alpha_emp_id = mgr_create_res.data['id']

        # Manager CANNOT create Admin account
        mgr_admin_res = api_client.post('/api/auth/users/', {
            'full_name': 'Rogue Admin',
            'email': 'rogue.admin@skillmove.com',
            'mobile_number': '9876500003',
            'role': 'ADMIN',
            'team': team_alpha.id,
        })
        assert mgr_admin_res.status_code == 400

        # Manager CANNOT create user in team Beta
        mgr_beta_res = api_client.post('/api/auth/users/', {
            'full_name': 'Beta Counsellor',
            'email': 'beta.counsellor@skillmove.com',
            'mobile_number': '9876500004',
            'role': 'SALES_EMPLOYEE',
            'team': team_beta.id,
        })
        assert mgr_beta_res.status_code == 400

        # Create user in team Beta by Admin for cross-team test
        api_client.force_authenticate(user=admin)
        beta_emp_res = api_client.post('/api/auth/users/', {
            'full_name': 'Beta Employee',
            'email': 'beta.emp@skillmove.com',
            'mobile_number': '9876500005',
            'role': 'SALES_EMPLOYEE',
            'team': team_beta.id,
        })
        beta_emp_id = beta_emp_res.data['id']

        # Manager Alpha CANNOT edit or deactivate Beta Employee
        api_client.force_authenticate(user=manager_alpha)
        cross_edit_res = api_client.patch(f'/api/auth/users/{beta_emp_id}/', {'designation': 'Hacked'})
        assert cross_edit_res.status_code in [403, 404]

        cross_deact_res = api_client.post(f'/api/auth/users/{beta_emp_id}/deactivate/')
        assert cross_deact_res.status_code in [403, 404]

        # Sales Employee cannot access any administrative user management endpoint
        sales_emp = User.objects.get(id=alpha_emp_id)
        api_client.force_authenticate(user=sales_emp)

        assert api_client.get('/api/auth/users/').status_code == 403
        assert api_client.post('/api/auth/users/', {'full_name': 'X'}).status_code == 403
        assert api_client.patch(f'/api/auth/users/{beta_emp_id}/', {}).status_code == 403
        assert api_client.post(f'/api/auth/users/{beta_emp_id}/activate/').status_code == 403
        assert api_client.post(f'/api/auth/users/{beta_emp_id}/deactivate/').status_code == 403

    def test_database_constraints_and_duplicate_handling(self, api_client, setup_crm_environment):
        admin = setup_crm_environment['admin']
        team_alpha = setup_crm_environment['team_alpha']
        api_client.force_authenticate(user=admin)

        # 1. Create first user
        res1 = api_client.post('/api/auth/users/', {
            'full_name': 'Original User',
            'email': 'unique.user@skillmove.com',
            'mobile_number': '9876500010',
            'role': 'SALES_EMPLOYEE',
            'team': team_alpha.id,
        })
        assert res1.status_code == 201

        # 2. Duplicate email rejected
        res_dup_email = api_client.post('/api/auth/users/', {
            'full_name': 'Duplicate Email',
            'email': 'unique.user@skillmove.com',
            'mobile_number': '9876500011',
            'role': 'SALES_EMPLOYEE',
            'team': team_alpha.id,
        })
        assert res_dup_email.status_code == 400
        assert 'already in use' in str(res_dup_email.data).lower() or 'exists' in str(res_dup_email.data).lower()

        # 3. Duplicate mobile rejected
        res_dup_mobile = api_client.post('/api/auth/users/', {
            'full_name': 'Duplicate Mobile',
            'email': 'unique.user2@skillmove.com',
            'mobile_number': '9876500010',
            'role': 'SALES_EMPLOYEE',
            'team': team_alpha.id,
        })
        assert res_dup_mobile.status_code == 400
        assert 'mobile' in str(res_dup_mobile.data).lower()

        # 4. Employee ID sequence allocates monotonically unique IDs
        id1 = EmployeeIdSequence.get_next_employee_id()
        id2 = EmployeeIdSequence.get_next_employee_id()
        assert id1 != id2
        assert id1.startswith('EMP-')
        assert id2.startswith('EMP-')
