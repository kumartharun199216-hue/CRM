import pytest
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from apps.authentication.models import User, UserRole
from apps.teams.models import Team

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def sample_team(db):
    return Team.objects.create(name="Skill Move Admissions")

@pytest.fixture
def onboarding_employee(db, sample_team):
    """
    Simulates newly onboarded employee with a temporary password and must_change_password=True
    """
    user = User.objects.create_user(
        username="onboarding_user",
        email="onboard@skillmove.com",
        password="Temp@Password123!",
        role=UserRole.SALES_EMPLOYEE,
        team=sample_team,
        must_change_password=True,
    )
    return user

@pytest.fixture
def existing_manager(db, sample_team):
    """
    Existing manager who has already changed password (must_change_password=False)
    """
    user = User.objects.create_user(
        username="existing_mgr",
        email="mgr@skillmove.com",
        password="ManagerPermanent#2026",
        role=UserRole.MANAGER,
        team=sample_team,
        must_change_password=False,
    )
    return user

@pytest.fixture
def existing_admin(db):
    """
    Existing admin who has already changed password (must_change_password=False)
    """
    user = User.objects.create_user(
        username="existing_adm",
        email="adm@skillmove.com",
        password="AdminPermanent#2026",
        role=UserRole.ADMIN,
        must_change_password=False,
    )
    return user

@pytest.mark.django_db
class TestPasswordChangeEnforcement:
    def test_first_login_returns_must_change_password_flag(self, api_client, onboarding_employee):
        res = api_client.post('/api/auth/login/', {
            'username': 'onboard@skillmove.com',
            'password': 'Temp@Password123!',
        })
        assert res.status_code == status.HTTP_200_OK
        assert 'token' in res.data
        assert res.data['user']['must_change_password'] is True

    def test_restricted_user_cannot_access_protected_crm_resources(self, api_client, onboarding_employee):
        token, _ = Token.objects.get_or_create(user=onboarding_employee)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        # Attempt to access leads
        res_leads = api_client.get('/api/leads/')
        assert res_leads.status_code == status.HTTP_403_FORBIDDEN
        assert 'Password change required' in str(res_leads.content)

        # Attempt to access teams
        res_teams = api_client.get('/api/teams/')
        assert res_teams.status_code == status.HTTP_403_FORBIDDEN

        # Attempt to access user list
        res_users = api_client.get('/api/auth/users/')
        assert res_users.status_code == status.HTTP_403_FORBIDDEN

    def test_restricted_user_can_access_exempt_auth_endpoints(self, api_client, onboarding_employee):
        token, _ = Token.objects.get_or_create(user=onboarding_employee)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        # /api/auth/me/ is allowed
        res_me = api_client.get('/api/auth/me/')
        assert res_me.status_code == status.HTTP_200_OK
        assert res_me.data['must_change_password'] is True

        # /api/auth/logout/ is allowed
        res_logout = api_client.post('/api/auth/logout/')
        assert res_logout.status_code == status.HTTP_200_OK

        # Token was deleted by logout
        assert not Token.objects.filter(key=token.key).exists()

    def test_password_change_validates_current_password(self, api_client, onboarding_employee):
        token, _ = Token.objects.get_or_create(user=onboarding_employee)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        res = api_client.post('/api/auth/change-password/', {
            'old_password': 'WrongCurrentPassword',
            'new_password': 'NewSecurePass@2026',
            'confirm_password': 'NewSecurePass@2026',
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'incorrect' in str(res.data)

    def test_password_change_rejects_reusing_temporary_password(self, api_client, onboarding_employee):
        token, _ = Token.objects.get_or_create(user=onboarding_employee)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        res = api_client.post('/api/auth/change-password/', {
            'old_password': 'Temp@Password123!',
            'new_password': 'Temp@Password123!',
            'confirm_password': 'Temp@Password123!',
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'same as your temporary password' in str(res.data)

    def test_password_change_rejects_mismatched_confirmation(self, api_client, onboarding_employee):
        token, _ = Token.objects.get_or_create(user=onboarding_employee)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        res = api_client.post('/api/auth/change-password/', {
            'old_password': 'Temp@Password123!',
            'new_password': 'NewSecurePass@2026',
            'confirm_password': 'DifferentPass@2026',
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Passwords do not match' in str(res.data)

    def test_password_change_enforces_password_validators(self, api_client, onboarding_employee):
        token, _ = Token.objects.get_or_create(user=onboarding_employee)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        # Too short (< 8 chars)
        res_short = api_client.post('/api/auth/change-password/', {
            'old_password': 'Temp@Password123!',
            'new_password': 'short',
            'confirm_password': 'short',
        })
        assert res_short.status_code == status.HTTP_400_BAD_REQUEST

    def test_successful_password_change_clears_flag_rotates_token_and_grants_access(
        self, api_client, onboarding_employee
    ):
        old_token, _ = Token.objects.get_or_create(user=onboarding_employee)
        old_token_key = old_token.key
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {old_token_key}')

        # Change password
        res = api_client.post('/api/auth/change-password/', {
            'old_password': 'Temp@Password123!',
            'new_password': 'PermanentSecure#2026Pass',
            'confirm_password': 'PermanentSecure#2026Pass',
        })
        assert res.status_code == status.HTTP_200_OK
        assert 'token' in res.data
        new_token_key = res.data['token']
        assert new_token_key != old_token_key
        assert res.data['user']['must_change_password'] is False

        # Old token is invalidated
        assert not Token.objects.filter(key=old_token_key).exists()

        # Database state is updated
        onboarding_employee.refresh_from_db()
        assert onboarding_employee.must_change_password is False

        # Verify new password can authenticate
        authenticated_user = authenticate(
            username=onboarding_employee.username,
            password='PermanentSecure#2026Pass'
        )
        assert authenticated_user is not None
        assert authenticated_user.id == onboarding_employee.id

        # Verify old temporary password no longer works
        failed_auth = authenticate(
            username=onboarding_employee.username,
            password='Temp@Password123!'
        )
        assert failed_auth is None

        # Protected API access with new token is now granted!
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {new_token_key}')
        res_leads = api_client.get('/api/leads/')
        assert res_leads.status_code == status.HTTP_200_OK

        res_teams = api_client.get('/api/teams/')
        assert res_teams.status_code == status.HTTP_200_OK

    def test_existing_admin_and_manager_unaffected(self, api_client, existing_admin, existing_manager):
        # Admin login and access
        res_adm_login = api_client.post('/api/auth/login/', {
            'username': 'adm@skillmove.com',
            'password': 'AdminPermanent#2026',
        })
        assert res_adm_login.status_code == status.HTTP_200_OK
        assert res_adm_login.data['user']['must_change_password'] is False

        adm_token = res_adm_login.data['token']
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {adm_token}')
        res_adm_leads = api_client.get('/api/leads/')
        assert res_adm_leads.status_code == status.HTTP_200_OK

        # Manager login and access
        res_mgr_login = api_client.post('/api/auth/login/', {
            'username': 'mgr@skillmove.com',
            'password': 'ManagerPermanent#2026',
        })
        assert res_mgr_login.status_code == status.HTTP_200_OK
        assert res_mgr_login.data['user']['must_change_password'] is False

        mgr_token = res_mgr_login.data['token']
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {mgr_token}')
        res_mgr_leads = api_client.get('/api/leads/')
        assert res_mgr_leads.status_code == status.HTTP_200_OK
