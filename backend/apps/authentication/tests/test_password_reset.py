import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from apps.authentication.models import User, UserRole, PasswordResetToken
from apps.audit.models import AuditEvent
from apps.teams.models import Team

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def alpha_team(db):
    return Team.objects.create(name="Alpha Sales Team")

@pytest.fixture
def beta_team(db):
    return Team.objects.create(name="Beta Sales Team")

@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        username="admin1",
        email="admin1@skillmove.in",
        password="AdminPassword@123",
        role=UserRole.ADMIN,
        employee_id="EMP-0001"
    )

@pytest.fixture
def manager_alpha(db, alpha_team):
    mgr = User.objects.create_user(
        username="mgr_alpha",
        email="mgr_alpha@skillmove.in",
        password="ManagerPassword@123",
        role=UserRole.MANAGER,
        team=alpha_team,
        employee_id="EMP-0010"
    )
    alpha_team.manager = mgr
    alpha_team.save()
    return mgr

@pytest.fixture
def counsellor_alpha(db, alpha_team, manager_alpha):
    return User.objects.create_user(
        username="counsellor_alpha",
        email="counsellor_alpha@skillmove.in",
        password="InitialPassword@123",
        role=UserRole.SALES_EMPLOYEE,
        team=alpha_team,
        reporting_manager=manager_alpha,
        employee_id="EMP-0042"
    )

@pytest.fixture
def counsellor_beta(db, beta_team):
    return User.objects.create_user(
        username="counsellor_beta",
        email="counsellor_beta@skillmove.in",
        password="InitialPassword@123",
        role=UserRole.SALES_EMPLOYEE,
        team=beta_team,
        employee_id="EMP-0043"
    )

@pytest.mark.django_db
class TestSecurePasswordChangeAndReset:

    # 1. Change Password Page Tests
    def test_change_password_success_and_session_invalidation(self, api_client, counsellor_alpha):
        """User can change password with valid current password; old session token is invalidated."""
        old_token = Token.objects.create(user=counsellor_alpha)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {old_token.key}')

        payload = {
            'old_password': 'InitialPassword@123',
            'new_password': 'BrandNewPassword@2026',
            'confirm_password': 'BrandNewPassword@2026',
        }
        res = api_client.post('/api/auth/change-password/', payload)
        assert res.status_code == 200
        assert 'token' in res.data
        new_token_key = res.data['token']

        # Old token must be invalidated (deleted)
        assert not Token.objects.filter(key=old_token.key).exists()
        assert Token.objects.filter(key=new_token_key).exists()

        # Database password updated
        counsellor_alpha.refresh_from_db()
        assert counsellor_alpha.check_password('BrandNewPassword@2026')
        assert not counsellor_alpha.check_password('InitialPassword@123')

        # Audit log entry must exist without storing tokens or passwords
        audit = AuditEvent.objects.filter(event_type='PASSWORD_CHANGED', user=counsellor_alpha).first()
        assert audit is not None
        assert 'password' not in str(audit.details)
        assert 'BrandNewPassword' not in str(audit.details)

    def test_change_password_invalid_current_password(self, api_client, counsellor_alpha):
        """Rejects change password attempt if current password is wrong."""
        token = Token.objects.create(user=counsellor_alpha)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        payload = {
            'old_password': 'WrongOldPassword@999',
            'new_password': 'BrandNewPassword@2026',
            'confirm_password': 'BrandNewPassword@2026',
        }
        res = api_client.post('/api/auth/change-password/', payload)
        assert res.status_code == 400
        assert 'old_password' in res.data

    def test_change_password_same_as_current_rejected(self, api_client, counsellor_alpha):
        """Rejects attempt to set new password to the same as current password."""
        token = Token.objects.create(user=counsellor_alpha)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        payload = {
            'old_password': 'InitialPassword@123',
            'new_password': 'InitialPassword@123',
            'confirm_password': 'InitialPassword@123',
        }
        res = api_client.post('/api/auth/change-password/', payload)
        assert res.status_code == 400
        assert 'new_password' in res.data

    def test_change_password_confirmation_mismatch(self, api_client, counsellor_alpha):
        """Rejects password change if new password and confirmation mismatch."""
        token = Token.objects.create(user=counsellor_alpha)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        payload = {
            'old_password': 'InitialPassword@123',
            'new_password': 'BrandNewPassword@2026',
            'confirm_password': 'DifferentPassword@2026',
        }
        res = api_client.post('/api/auth/change-password/', payload)
        assert res.status_code == 400
        assert 'confirm_password' in res.data

    # 2. Employee Reset Request Tests
    def test_employee_reset_request_unconfigured_email_reporting(self, api_client, counsellor_alpha):
        """
        When email is not configured, clearly reports that delivery is unavailable.
        Does not falsely claim email was sent.
        """
        res = api_client.post('/api/auth/password-reset/request/', {
            'identifier': counsellor_alpha.email
        })
        assert res.status_code == 200
        assert res.data['email_delivery'] == 'UNAVAILABLE'
        assert res.data['email_sent'] is False
        assert 'reset_token' in res.data
        assert 'reset_url' in res.data

        # Audit log recorded without storing tokens or passwords
        audit = AuditEvent.objects.filter(event_type='PASSWORD_RESET_INITIATED', user=counsellor_alpha).first()
        assert audit is not None
        assert 'token' not in str(audit.details)
        assert 'password' not in str(audit.details)

    def test_employee_reset_confirm_success_and_token_invalidation(self, api_client, counsellor_alpha):
        """Employee successfully resets password with valid token; token is consumed and sessions invalidated."""
        old_token = Token.objects.create(user=counsellor_alpha)
        raw_token, rec = PasswordResetToken.create_token_for_user(counsellor_alpha, validity_minutes=15)

        confirm_payload = {
            'token': raw_token,
            'new_password': 'ResetPassword@Success1',
            'confirm_password': 'ResetPassword@Success1'
        }
        res = api_client.post('/api/auth/password-reset/confirm/', confirm_payload)
        assert res.status_code == 200
        assert 'token' in res.data

        # Token record marked as used
        rec.refresh_from_db()
        assert rec.is_used is True
        assert rec.used_at is not None

        # Old auth token invalidated
        assert not Token.objects.filter(key=old_token.key).exists()

        # New password verified
        counsellor_alpha.refresh_from_db()
        assert counsellor_alpha.check_password('ResetPassword@Success1')

        # Audit log recorded
        audit = AuditEvent.objects.filter(event_type='PASSWORD_RESET_COMPLETED', user=counsellor_alpha).first()
        assert audit is not None
        assert 'password' not in str(audit.details)

    def test_employee_reset_confirm_expired_token_rejected(self, api_client, counsellor_alpha):
        """Expired reset tokens must be rejected."""
        raw_token, rec = PasswordResetToken.create_token_for_user(counsellor_alpha, validity_minutes=-10)

        confirm_payload = {
            'token': raw_token,
            'new_password': 'ResetPassword@Success1',
            'confirm_password': 'ResetPassword@Success1'
        }
        res = api_client.post('/api/auth/password-reset/confirm/', confirm_payload)
        assert res.status_code == 400
        assert 'token' in res.data
        assert 'expired' in str(res.data['token'])

    def test_employee_reset_confirm_reused_token_rejected(self, api_client, counsellor_alpha):
        """Tokens can only be used once; reused tokens must be rejected."""
        raw_token, rec = PasswordResetToken.create_token_for_user(counsellor_alpha, validity_minutes=15)

        confirm_payload = {
            'token': raw_token,
            'new_password': 'FirstResetPassword@123',
            'confirm_password': 'FirstResetPassword@123'
        }
        # First use
        res1 = api_client.post('/api/auth/password-reset/confirm/', confirm_payload)
        assert res1.status_code == 200

        # Attempt reuse
        confirm_payload['new_password'] = 'SecondResetPassword@456'
        confirm_payload['confirm_password'] = 'SecondResetPassword@456'
        res2 = api_client.post('/api/auth/password-reset/confirm/', confirm_payload)
        assert res2.status_code == 400
        assert 'token' in res2.data
        assert 'already been used' in str(res2.data['token'])

    # 3. Admin & Manager Reset Actions Tests
    def test_admin_reset_action_authorized(self, api_client, admin_user, counsellor_alpha):
        """Admin can initiate reset for authorized users; generates temporary password and invalidates sessions."""
        admin_token = Token.objects.create(user=admin_user)
        counsellor_old_token = Token.objects.create(user=counsellor_alpha)

        api_client.credentials(HTTP_AUTHORIZATION=f'Token {admin_token.key}')
        res = api_client.post(f'/api/auth/users/{counsellor_alpha.id}/reset-password/')
        assert res.status_code == 200
        assert res.data['email_delivery'] == 'UNAVAILABLE'
        assert res.data['email_sent'] is False
        assert 'temporary_password' in res.data
        assert 'reset_token' in res.data

        # Old session token of counsellor invalidated
        assert not Token.objects.filter(key=counsellor_old_token.key).exists()

        # Temporary password can be used by employee to log in
        counsellor_alpha.refresh_from_db()
        assert counsellor_alpha.must_change_password is True
        assert counsellor_alpha.check_password(res.data['temporary_password'])

    def test_manager_reset_action_authorized_team_employee(self, api_client, manager_alpha, counsellor_alpha):
        """Manager can initiate reset for employees within their authorized team."""
        manager_token = Token.objects.create(user=manager_alpha)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {manager_token.key}')

        res = api_client.post(f'/api/auth/users/{counsellor_alpha.id}/reset-password/')
        assert res.status_code == 200
        assert 'temporary_password' in res.data
        assert counsellor_alpha.full_name in res.data['employee_name']

    def test_manager_reset_action_unauthorized_other_team(self, api_client, manager_alpha, counsellor_beta):
        """Manager cannot initiate reset for employees outside their authorized team (403 Forbidden)."""
        manager_token = Token.objects.create(user=manager_alpha)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {manager_token.key}')

        res = api_client.post(f'/api/auth/users/{counsellor_beta.id}/reset-password/')
        assert res.status_code == 403
        assert 'authorized team' in str(res.data['detail'])

    def test_manager_reset_action_unauthorized_admin_user(self, api_client, manager_alpha, admin_user):
        """Manager cannot initiate reset for Admin accounts (403 Forbidden)."""
        manager_token = Token.objects.create(user=manager_alpha)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {manager_token.key}')

        res = api_client.post(f'/api/auth/users/{admin_user.id}/reset-password/')
        assert res.status_code == 403

    def test_sales_employee_cannot_initiate_reset_for_others(self, api_client, counsellor_alpha, counsellor_beta):
        """Sales employees cannot initiate resets for other users (403 Forbidden)."""
        token = Token.objects.create(user=counsellor_alpha)
        api_client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        res = api_client.post(f'/api/auth/users/{counsellor_beta.id}/reset-password/')
        assert res.status_code == 403
