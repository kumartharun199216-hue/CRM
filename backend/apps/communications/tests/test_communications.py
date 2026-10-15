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

    @override_settings(CALLYZER_API_KEY='')
    def test_initiate_call_blocked_without_verified_callyzer(self):
        self.client.force_authenticate(user=self.employee)
        response = self.client.post('/api/communications/initiate-call/', {
            'lead_id': self.lead.id
        })
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert 'blocker' in response.data
        assert 'Callyzer' in response.data['error']

    @override_settings(CALLYZER_API_KEY='test-key', CALLYZER_BASE_URL='https://sandbox.api.callyzer.co/api/v2.1')
    def test_initiate_call_success_with_callyzer(self, monkeypatch):
        class MockResponse:
            status_code = 200
            def json(self):
                return {"result": {"id": "callyzer-lead-123"}, "message": "Success"}

        import requests
        monkeypatch.setattr(requests, 'post', lambda *args, **kwargs: MockResponse())

        self.client.force_authenticate(user=self.employee)
        response = self.client.post('/api/communications/initiate-call/', {
            'lead_id': self.lead.id
        })
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'QUEUED'
        assert response.data['external_reference_id'] == 'callyzer-lead-123'
        assert 'tel_url' in response.data
        assert response.data['tel_url'].startswith('tel:')

    def test_callyzer_webhook_ingests_call_log(self):
        payload = [
            {
                "emp_name": "Test Employee",
                "emp_number": "91-9999999999",
                "call_logs": [
                    {
                        "id": "call-log-rec-999",
                        "client_name": "Test Client",
                        "client_number": self.lead.phone,
                        "duration": "45",
                        "call_type": "Outgoing",
                        "call_date": "2026-10-13",
                        "call_time": "14:30:00",
                        "note": "Spoke about course syllabus",
                        "call_recording_url": "https://media.callyzer.co/audio/call999.mp3"
                    }
                ]
            }
        ]
        response = self.client.post('/api/communications/callyzer/webhook/', payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['processed_logs'] == 1

        log = CommunicationLog.objects.filter(external_reference_id="call-log-rec-999").first()
        assert log is not None
        assert log.call_duration == 45
        assert log.call_type == "Outgoing"
        assert log.call_recording_url == "https://media.callyzer.co/audio/call999.mp3"
        assert log.status == CommunicationStatus.SUCCESS
        assert "Spoke about course syllabus" in log.content

    def test_callyzer_webhook_ingests_missed_and_rejected_calls(self):
        payload = [
            {
                "emp_name": "Test Employee",
                "emp_number": "91-9999999999",
                "call_logs": [
                    {
                        "id": "call-missed-1",
                        "client_name": "Test Client",
                        "client_number": self.lead.phone,
                        "duration": "0",
                        "call_type": "Missed",
                        "call_date": "2026-10-13",
                        "call_time": "15:00:00"
                    },
                    {
                        "id": "call-rejected-2",
                        "client_name": "Test Client",
                        "client_number": self.lead.phone,
                        "duration": "0",
                        "call_type": "Rejected",
                        "call_date": "2026-10-13",
                        "call_time": "15:05:00"
                    }
                ]
            }
        ]
        response = self.client.post('/api/communications/callyzer/webhook/', payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['processed_logs'] == 2

        missed_log = CommunicationLog.objects.filter(external_reference_id="call-missed-1").first()
        assert missed_log is not None
        assert missed_log.status == CommunicationStatus.MISSED

        rejected_log = CommunicationLog.objects.filter(external_reference_id="call-rejected-2").first()
        assert rejected_log is not None
        assert rejected_log.status == CommunicationStatus.REJECTED

    @override_settings(CALLYZER_API_KEY='test-key', CALLYZER_BASE_URL='https://sandbox.api.callyzer.co/api/v2.1')
    def test_sync_callyzer_call_history_service_mocked(self, monkeypatch):
        import time
        monkeypatch.setattr(time, 'sleep', lambda s: None)
        lead_phone = self.lead.phone

        class MockResponse:
            status_code = 200
            def json(self):
                return {
                    "result": [
                        {
                            "id": "hist-call-101",
                            "emp_name": "Deepa",
                            "emp_number": "7993173335",
                            "client_name": "Alice Smith",
                            "client_number": lead_phone,
                            "call_type": "Outgoing",
                            "duration": 65,
                            "call_recording_url": "https://media.callyzer.co/audio/hist101.mp3",
                            "call_date": "2026-10-13",
                            "call_time": "15:00:00",
                            "note": "Course enrollment confirmed"
                        },
                        {
                            "id": "hist-call-102",
                            "emp_name": "Unknown",
                            "emp_number": "9876543210",
                            "client_name": "Unmatched Person",
                            "client_number": "+919988776655",
                            "call_type": "Incoming",
                            "duration": 30,
                            "call_recording_url": None,
                            "call_date": "2026-10-13",
                            "call_time": "15:05:00"
                        }
                    ]
                }

        import requests
        monkeypatch.setattr(requests, 'post', lambda *args, **kwargs: MockResponse())

        from apps.communications.services import CommunicationService
        result = CommunicationService.sync_callyzer_call_history()

        assert result['total_fetched'] == 2
        assert result['synced_count'] == 2
        assert result['unmatched_count'] == 1

        matched_log = CommunicationLog.objects.filter(external_reference_id="hist-call-101").first()
        assert matched_log is not None
        assert matched_log.lead == self.lead
        assert matched_log.call_duration == 65
        assert matched_log.status == CommunicationStatus.SUCCESS
        assert matched_log.provider_source == "CALLYZER"

        unmatched_log = CommunicationLog.objects.filter(external_reference_id="hist-call-102").first()
        assert unmatched_log is not None
        assert unmatched_log.lead is None
        assert unmatched_log.call_duration == 30

    @override_settings(CALLYZER_API_KEY='test-key', CALLYZER_BASE_URL='https://sandbox.api.callyzer.co/api/v2.1')
    def test_sync_callyzer_deduplication(self, monkeypatch):
        import time
        monkeypatch.setattr(time, 'sleep', lambda s: None)
        lead_phone = self.lead.phone

        class MockResponse:
            status_code = 200
            def json(self):
                return {
                    "result": [
                        {
                            "id": "hist-call-dup-1",
                            "emp_name": "Emp",
                            "emp_number": "1234567890",
                            "client_name": "Alice Smith",
                            "client_number": lead_phone,
                            "call_type": "Outgoing",
                            "duration": 50,
                            "call_date": "2026-10-13",
                            "call_time": "15:10:00"
                        }
                    ]
                }

        import requests
        monkeypatch.setattr(requests, 'post', lambda *args, **kwargs: MockResponse())

        from apps.communications.services import CommunicationService
        CommunicationService.sync_callyzer_call_history()
        count_first = CommunicationLog.objects.filter(external_reference_id="hist-call-dup-1").count()
        assert count_first == 1

        # Second sync must not create a duplicate
        CommunicationService.sync_callyzer_call_history()
        count_second = CommunicationLog.objects.filter(external_reference_id="hist-call-dup-1").count()
        assert count_second == 1

    @override_settings(CALLYZER_API_KEY='test-key', CALLYZER_BASE_URL='https://sandbox.api.callyzer.co/api/v2.1')
    def test_callyzer_sync_view_endpoint(self, monkeypatch):
        import time
        monkeypatch.setattr(time, 'sleep', lambda s: None)

        class MockResponse:
            status_code = 200
            def json(self):
                return {
                    "result": []
                }

        import requests
        monkeypatch.setattr(requests, 'post', lambda *args, **kwargs: MockResponse())

        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/communications/callyzer/sync/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['status'] == 'success'
        assert response.data['result']['synced_count'] == 0
