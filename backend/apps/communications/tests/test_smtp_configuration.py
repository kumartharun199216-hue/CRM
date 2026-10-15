import os
import pytest
import smtplib
from unittest.mock import patch
from django.conf import settings
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import Lead
from apps.communications.models import CommunicationChannel, CommunicationLog, CommunicationStatus
from apps.audit.models import AuditEvent

@pytest.mark.django_db
class TestSMTPConfigurationAndEmailDelivery:
    def setup_method(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="admin_smtp",
            email="admin_smtp@skillmove.com",
            password="Password123!",
            role=UserRole.ADMIN
        )
        self.team = Team.objects.create(name="Enterprise Sales Team")
        self.manager = User.objects.create_user(
            username="manager_smtp",
            email="manager_smtp@skillmove.com",
            password="Password123!",
            role=UserRole.MANAGER,
            team=self.team
        )
        self.team.manager = self.manager
        self.team.save()

        self.employee = User.objects.create_user(
            username="employee_smtp",
            email="employee_smtp@skillmove.com",
            password="Password123!",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team
        )

        self.lead = Lead.objects.create(
            title="Lead for SMTP verification",
            contact_name="Verified Lead",
            email="lead_target@example.com",
            phone="+19876543210",
            team=self.team,
            assigned_employee=self.employee,
            created_by=self.manager
        )

    def test_smtp_settings_loading_and_types(self):
        # Verify both configured backend from environment and locmem test fixture compatibility
        assert os.environ.get("EMAIL_BACKEND") == "django.core.mail.backends.smtp.EmailBackend"
        assert settings.EMAIL_BACKEND in ("django.core.mail.backends.smtp.EmailBackend", "django.core.mail.backends.locmem.EmailBackend")
        assert settings.EMAIL_HOST == "smtp.gmail.com"
        assert isinstance(settings.EMAIL_PORT, int)
        assert settings.EMAIL_PORT == 587
        assert isinstance(settings.EMAIL_USE_TLS, bool)
        assert settings.EMAIL_USE_TLS is True
        assert isinstance(settings.EMAIL_USE_SSL, bool)
        assert settings.EMAIL_USE_SSL is False
        assert isinstance(settings.EMAIL_TIMEOUT, int)
        assert settings.EMAIL_TIMEOUT == 30
        assert settings.EMAIL_HOST_USER == "lasyalasya153@gmail.com"
        assert "lasyalasya153@gmail.com" in settings.DEFAULT_FROM_EMAIL
        assert bool(settings.EMAIL_HOST_PASSWORD) is True

    @patch('apps.communications.views.send_mail')
    def test_admin_test_email_success_with_mocked_backend(self, mock_send_mail):
        """Admin can send a test email; logs audit event and does not expose secrets."""
        mock_send_mail.return_value = 1
        self.client.force_authenticate(user=self.admin)

        response = self.client.post('/api/communications/test-email/', {
            'recipient': 'recipient@example.com'
        })

        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'success'
        assert response.data['delivered'] is True
        assert response.data['recipient'] == 'recipient@example.com'
        mock_send_mail.assert_called_once()

        # Verify audit log was created
        audit = AuditEvent.objects.filter(event_type='COMMUNICATION_ATTEMPT', user=self.admin).first()
        assert audit is not None
        assert audit.details['status'] == 'SUCCESS'
        assert audit.details['recipient'] == 'recipient@example.com'

    @override_settings(EMAIL_HOST_USER='', EMAIL_HOST_PASSWORD='')
    def test_admin_test_email_blocked_when_credentials_missing(self):
        """When credentials are not configured, endpoint returns 503 blocker."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/communications/test-email/', {
            'recipient': 'recipient@example.com'
        })
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.data['blocker'] is True
        assert response.data['delivered'] is False
        assert 'Google SMTP' in response.data['error']

    @patch('apps.communications.views.send_mail')
    def test_admin_test_email_smtp_connection_failure_handling(self, mock_send_mail):
        """Network/SMTP failure returns 502 with safe error without credential leakage."""
        mock_send_mail.side_effect = smtplib.SMTPConnectError(421, "Connection refused")
        self.client.force_authenticate(user=self.admin)

        response = self.client.post('/api/communications/test-email/', {
            'recipient': 'recipient@example.com'
        })

        assert response.status_code == status.HTTP_502_BAD_GATEWAY
        assert response.data['delivered'] is False
        assert "Google SMTP delivery failed" in response.data['error']

        # Verify audit record marked FAILED
        audit = AuditEvent.objects.filter(event_type='COMMUNICATION_ATTEMPT', user=self.admin).first()
        assert audit is not None
        assert audit.details['status'] == 'FAILED'

    def test_admin_only_access_to_test_email(self):
        """Only users with Admin role can trigger the test email endpoint."""
        # 1. Unauthenticated
        resp_unauth = self.client.post('/api/communications/test-email/', {
            'recipient': 'recipient@example.com'
        })
        assert resp_unauth.status_code == status.HTTP_401_UNAUTHORIZED

        # 2. Sales Employee
        self.client.force_authenticate(user=self.employee)
        resp_emp = self.client.post('/api/communications/test-email/', {
            'recipient': 'recipient@example.com'
        })
        assert resp_emp.status_code == status.HTTP_403_FORBIDDEN

        # 3. Manager
        self.client.force_authenticate(user=self.manager)
        resp_mgr = self.client.post('/api/communications/test-email/', {
            'recipient': 'recipient@example.com'
        })
        assert resp_mgr.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_test_email_validation(self):
        """Validates recipient format."""
        self.client.force_authenticate(user=self.admin)
        # Invalid email
        resp_invalid = self.client.post('/api/communications/test-email/', {
            'recipient': 'not-a-valid-email'
        })
        assert resp_invalid.status_code == status.HTTP_400_BAD_REQUEST

        # Missing recipient
        resp_missing = self.client.post('/api/communications/test-email/', {})
        assert resp_missing.status_code == status.HTTP_400_BAD_REQUEST

    @patch('apps.communications.services.send_mail')
    def test_lead_email_dispatch_preserves_communication_logging(self, mock_send_mail):
        """Lead email communication creates SUCCESS log in database."""
        mock_send_mail.return_value = 1
        self.client.force_authenticate(user=self.manager)

        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead.id,
            'subject': 'Welcome to Skill Move',
            'body': 'Glad to have you aboard.'
        })

        assert response.status_code == status.HTTP_200_OK
        log = CommunicationLog.objects.filter(lead=self.lead, channel=CommunicationChannel.EMAIL).first()
        assert log is not None
        assert log.status == CommunicationStatus.SUCCESS
        assert log.recipient == self.lead.email
        assert log.subject == 'Welcome to Skill Move'
        assert log.initiated_by == self.manager

    @patch('apps.communications.services.send_mail')
    def test_lead_email_dispatch_failure_logs_status_failed(self, mock_send_mail):
        """Lead email communication creates FAILED log in database on exception."""
        mock_send_mail.side_effect = Exception("SMTP timeout error")
        self.client.force_authenticate(user=self.manager)

        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead.id,
            'subject': 'Failure simulation',
            'body': 'Body text'
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        log = CommunicationLog.objects.filter(lead=self.lead, channel=CommunicationChannel.EMAIL).first()
        assert log is not None
        assert log.status == CommunicationStatus.FAILED
        assert "Google SMTP delivery error" in log.error_message
