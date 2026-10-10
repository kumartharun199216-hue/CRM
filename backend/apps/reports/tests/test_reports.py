import pytest
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.reports.models import ReportSchedule, ScheduleFrequency

@pytest.mark.django_db
class TestReports:
    def setup_method(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="admin_reports",
            email="admin@test.com",
            password="password123",
            role=UserRole.ADMIN
        )
        self.team = Team.objects.create(name="Analytics Team")
        self.manager = User.objects.create_user(
            username="manager_reports",
            email="mgr@test.com",
            password="password123",
            role=UserRole.MANAGER,
            team=self.team
        )
        self.team.manager = self.manager
        self.team.save()

    def test_admin_can_configure_report_schedule(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/reports/schedules/', {
            'name': 'Weekly Leadership Summary',
            'recipients': ['stakeholder1@example.com', 'stakeholder2@example.com'],
            'frequency': ScheduleFrequency.WEEKLY,
            'time_utc': '08:00:00'
        }, format='json')
        assert response.status_code == status.HTTP_201_CREATED
        assert len(response.data['recipients']) == 2

    def test_manager_cannot_configure_report_schedule(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post('/api/reports/schedules/', {
            'name': 'Manager Report',
            'recipients': ['me@example.com'],
            'frequency': ScheduleFrequency.DAILY
        }, format='json')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_report_schedule_requires_valid_recipients(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/reports/schedules/', {
            'name': 'Invalid Report',
            'recipients': [],
            'frequency': ScheduleFrequency.DAILY
        }, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
