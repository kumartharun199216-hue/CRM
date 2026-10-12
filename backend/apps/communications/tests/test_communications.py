import pytest
from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import Lead
from apps.communications.models import CommunicationTemplate, CommunicationChannel, CommunicationLog, CommunicationStatus

@pytest.mark.django_db
class TestCommunications:
    def setup_method(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="admin_comm",
            email="admin@test.com",
            password="password123",
            role=UserRole.ADMIN
        )
        self.team = Team.objects.create(name="Support Team")
        self.manager = User.objects.create_user(
            username="manager_comm",
            email="mgr@test.com",
            password="password123",
            role=UserRole.MANAGER,
            team=self.team
        )
        self.team.manager = self.manager
        self.team.save()

        self.employee = User.objects.create_user(
            username="employee_comm",
            email="emp@test.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team
        )
        self.lead = Lead.objects.create(
            title="Communication Target Lead",
            contact_name="Alice Smith",
            email="alice@example.com",
            phone="+15550192834",
            team=self.team,
            assigned_employee=self.employee,
            created_by=self.manager
        )

    def test_manager_can_create_template(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post('/api/communications/templates/', {
            'name': 'Follow-up Email Template',
            'channel': CommunicationChannel.EMAIL,
            'subject': 'Following up on our conversation',
            'body': 'Hi {{name}}, just checking in.'
        })
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'Follow-up Email Template'

    def test_sales_employee_cannot_create_template(self):
        self.client.force_authenticate(user=self.employee)
        response = self.client.post('/api/communications/templates/', {
            'name': 'Forbidden Template',
            'channel': CommunicationChannel.EMAIL,
            'subject': 'Hello',
            'body': 'Content'
        })
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @override_settings(EMAIL_HOST_USER='', EMAIL_HOST_PASSWORD='')
    def test_send_email_blocked_without_smtp_credentials(self):
        # Strict rule: Do not simulate successful external calls, messages, emails.
        # When SMTP credentials are not set, it must return a blocker status (503).
        self.client.force_authenticate(user=self.manager)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead.id,
            'subject': 'Test Subject',
            'body': 'Test Body'
        })
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert 'blocker' in response.data
        assert 'Google SMTP' in response.data['error']

        # Verify communication log recorded the blocked attempt
        log = CommunicationLog.objects.filter(lead=self.lead, channel=CommunicationChannel.EMAIL).first()
        assert log is not None
        assert log.status == CommunicationStatus.BLOCKED

    def test_send_whatsapp_blocked_without_credentials(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post('/api/communications/send-whatsapp/', {
            'lead_id': self.lead.id,
            'message': 'Hello via WhatsApp'
        })
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert 'blocker' in response.data
        assert 'WhatsApp Business Platform' in response.data['error']

    def test_initiate_call_blocked_without_verified_callyzer(self):
        self.client.force_authenticate(user=self.employee)
        response = self.client.post('/api/communications/initiate-call/', {
            'lead_id': self.lead.id
        })
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert 'blocker' in response.data
        assert 'Callyzer' in response.data['error']
