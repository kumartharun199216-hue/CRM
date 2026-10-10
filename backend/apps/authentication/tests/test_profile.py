import pytest
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from apps.authentication.models import User, UserRole
from apps.teams.models import Team

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def sales_team(db):
    return Team.objects.create(name="Alpha Sales")

@pytest.fixture
def manager_user(db, sales_team):
    mgr = User.objects.create_user(
        username="manager1",
        email="manager1@example.com",
        first_name="Alice",
        last_name="Manager",
        role=UserRole.MANAGER,
        designation="Senior Sales Manager",
        department="Admissions",
        work_location="Headquarters",
        employee_id="EMP-0010"
    )
    sales_team.manager = mgr
    sales_team.save()
    return mgr

@pytest.fixture
def employee_user(db, sales_team, manager_user):
    user = User.objects.create_user(
        username="counsellor1",
        email="counsellor1@example.com",
        first_name="Bob",
        last_name="Counsellor",
        mobile_number="9876543210",
        role=UserRole.SALES_EMPLOYEE,
        team=sales_team,
        reporting_manager=manager_user,
        designation="Admissions Specialist",
        department="Admissions",
        work_location="Building B",
        employee_id="EMP-0042"
    )
    return user

@pytest.fixture
def employee_token(employee_user):
    token, _ = Token.objects.get_or_create(user=employee_user)
    return token

@pytest.mark.django_db
class TestUserProfile:

    def test_unauthorized_profile_access(self, api_client):
        """Unauthenticated requests must be rejected with 401 Unauthorized."""
        res_me = api_client.get('/api/auth/me/')
        assert res_me.status_code == 401

        res_profile = api_client.get('/api/auth/profile/')
        assert res_profile.status_code == 401

        res_patch = api_client.patch('/api/auth/me/', {'full_name': 'Hacker'})
        assert res_patch.status_code == 401

        res_put = api_client.put('/api/auth/profile/', {'full_name': 'Hacker'})
        assert res_put.status_code == 401

    def test_view_profile_display_fields(self, api_client, employee_user, employee_token):
        """Authenticated employee can view all 13 required profile display fields."""
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {employee_token.key}')
        res = api_client.get('/api/auth/me/')

        assert res.status_code == 200
        data = res.data

        # 1. Employee ID
        assert data['employee_id'] == 'EMP-0042'
        # 2. Full Name
        assert data['full_name'] == 'Bob Counsellor'
        # 3. Email
        assert data['email'] == 'counsellor1@example.com'
        # 4. Mobile Number
        assert data['mobile_number'] == '9876543210'
        # 5. Role
        assert data['role'] == UserRole.SALES_EMPLOYEE
        # 6. Designation
        assert data['designation'] == 'Admissions Specialist'
        # 7. Team
        assert data['team'] == employee_user.team.id
        assert data['team_name'] == 'Alpha Sales'
        # 8. Reporting Manager
        assert data['reporting_manager_id'] == employee_user.reporting_manager.id
        assert data['reporting_manager_name'] == 'Alice Manager'
        assert data['reporting_manager_email'] == 'manager1@example.com'
        # 9. Department
        assert data['department'] == 'Admissions'
        # 10. Work Location
        assert data['work_location'] == 'Building B'
        # 11. Date of Joining
        assert 'date_of_joining' in data
        # 12. Account Status
        assert data['account_status'] == 'ACTIVE'
        assert data['is_active'] is True
        # 13. Date Created
        assert 'date_joined' in data

    def test_view_profile_via_profile_alias(self, api_client, employee_token):
        """GET /api/auth/profile/ acts as an alias to /api/auth/me/."""
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {employee_token.key}')
        res = api_client.get('/api/auth/profile/')
        assert res.status_code == 200
        assert res.data['full_name'] == 'Bob Counsellor'

    def test_update_permitted_fields(self, api_client, employee_user, employee_token):
        """Employee can successfully update Full Name, Mobile Number, and Work Location."""
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {employee_token.key}')

        update_payload = {
            'full_name': 'Robert Senior Counsellor',
            'mobile_number': '+91 9123456780',
            'work_location': 'Campus North Wing'
        }
        res = api_client.patch('/api/auth/me/', update_payload)
        assert res.status_code == 200

        data = res.data
        assert data['full_name'] == 'Robert Senior Counsellor'
        assert data['first_name'] == 'Robert'
        assert data['last_name'] == 'Senior Counsellor'
        assert data['mobile_number'] == '+919123456780'
        assert data['work_location'] == 'Campus North Wing'

        # Verify persistence in database and across subsequent requests
        employee_user.refresh_from_db()
        assert employee_user.first_name == 'Robert'
        assert employee_user.last_name == 'Senior Counsellor'
        assert employee_user.mobile_number == '+919123456780'
        assert employee_user.work_location == 'Campus North Wing'

        # Second request to verify persistence
        res2 = api_client.get('/api/auth/profile/')
        assert res2.status_code == 200
        assert res2.data['full_name'] == 'Robert Senior Counsellor'
        assert res2.data['mobile_number'] == '+919123456780'
        assert res2.data['work_location'] == 'Campus North Wing'

    def test_duplicate_mobile_number_rejected(self, api_client, employee_user, employee_token, manager_user):
        """Attempting to set a mobile number already in use by another user is rejected."""
        manager_user.mobile_number = "9998887776"
        manager_user.save()

        api_client.credentials(HTTP_AUTHORIZATION=f'Token {employee_token.key}')
        res = api_client.patch('/api/auth/me/', {'mobile_number': '9998887776'})
        assert res.status_code == 400
        assert 'mobile_number' in res.data

    def test_reject_role_tampering(self, api_client, employee_token):
        """Employees cannot change their own role."""
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {employee_token.key}')
        res = api_client.patch('/api/auth/me/', {'role': UserRole.ADMIN})
        assert res.status_code == 400
        assert 'role' in res.data
        assert 'restricted' in str(res.data['role'])

    def test_reject_team_tampering(self, api_client, employee_token, db):
        """Employees cannot change their own team assignment."""
        other_team = Team.objects.create(name="Beta Team")
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {employee_token.key}')
        res = api_client.patch('/api/auth/me/', {'team': other_team.id})
        assert res.status_code == 400
        assert 'team' in res.data or 'team_id' in res.data

    def test_reject_employee_id_tampering(self, api_client, employee_token):
        """Employees cannot change their employee ID."""
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {employee_token.key}')
        res = api_client.patch('/api/auth/me/', {'employee_id': 'EMP-9999'})
        assert res.status_code == 400
        assert 'employee_id' in res.data

    def test_reject_account_status_tampering(self, api_client, employee_token):
        """Employees cannot alter account status or is_active."""
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {employee_token.key}')
        res = api_client.patch('/api/auth/me/', {'is_active': False})
        assert res.status_code == 400
        assert 'is_active' in res.data

    def test_reject_reporting_manager_tampering(self, api_client, employee_token, db):
        """Employees cannot alter their reporting manager."""
        other_mgr = User.objects.create_user(username="other_mgr", email="other@example.com")
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {employee_token.key}')
        res = api_client.patch('/api/auth/me/', {'reporting_manager': other_mgr.id})
        assert res.status_code == 400
        assert 'reporting_manager' in res.data

    def test_reject_email_tampering(self, api_client, employee_token):
        """Email changes are prohibited without following formal verification flow."""
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {employee_token.key}')
        res = api_client.patch('/api/auth/me/', {'email': 'hacked_email@example.com'})
        assert res.status_code == 400
        assert 'email' in res.data
