import uuid
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from .models import Notification, NotificationType, NotificationPriority
from .services import create_notification, notify_users


class NotificationTests(TestCase):
    def setUp(self):
        self.team = Team.objects.create(name="Admissions Team A")
        self.user = User.objects.create_user(
            username="counsellor1@skillmove.com",
            email="counsellor1@skillmove.com",
            password="Password@123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team,
        )
        self.manager = User.objects.create_user(
            username="manager1@skillmove.com",
            email="manager1@skillmove.com",
            password="Password@123",
            role=UserRole.MANAGER,
            team=self.team,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_notification_and_deduplication(self):
        n1 = create_notification(
            recipient=self.user,
            type=NotificationType.LEAD_ASSIGNED,
            title="Lead Assigned: SM-LD-0001",
            message="New lead assigned",
            entity_type="lead",
            entity_id="SM-LD-0001",
            priority=NotificationPriority.HIGH,
            deduplication_key="lead_assign_SM-LD-0001_1",
        )
        self.assertIsNotNone(n1)
        self.assertEqual(Notification.objects.filter(recipient=self.user).count(), 1)

        # Attempt to create duplicate with same key
        n2 = create_notification(
            recipient=self.user,
            type=NotificationType.LEAD_ASSIGNED,
            title="Lead Assigned: SM-LD-0001",
            message="New lead assigned duplicate attempt",
            deduplication_key="lead_assign_SM-LD-0001_1",
        )
        self.assertEqual(n1.id, n2.id)
        self.assertEqual(Notification.objects.filter(recipient=self.user).count(), 1)

    def test_unread_count_endpoint(self):
        create_notification(
            recipient=self.user,
            type=NotificationType.TASK_DUE,
            title="Follow-up Due",
            message="Test follow-up",
        )
        create_notification(
            recipient=self.user,
            type=NotificationType.SYSTEM_ALERT,
            title="System Alert",
            message="Maintenance tonight",
        )

        response = self.client.get('/api/notifications/unread-count/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['unread_count'], 2)

    def test_mark_single_read(self):
        notif = create_notification(
            recipient=self.user,
            type=NotificationType.LEAD_ASSIGNED,
            title="New Lead",
            message="Details here",
        )
        self.assertIsNone(notif.read_at)

        response = self.client.post(f'/api/notifications/{notif.id}/read/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertIsNotNone(notif.read_at)

    def test_mark_all_read(self):
        create_notification(recipient=self.user, type=NotificationType.TASK_DUE, title="1", message="1")
        create_notification(recipient=self.user, type=NotificationType.TASK_DUE, title="2", message="2")

        response = self.client.post('/api/notifications/read-all/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['updated_count'], 2)

        count_resp = self.client.get('/api/notifications/unread-count/')
        self.assertEqual(count_resp.data['unread_count'], 0)

    def test_archive_notification(self):
        notif = create_notification(
            recipient=self.user,
            type=NotificationType.GENERAL,
            title="Welcome",
            message="Welcome to CRM",
        )
        response = self.client.post(f'/api/notifications/{notif.id}/archive/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertIsNotNone(notif.archived_at)

        # Active list should now exclude archived by default
        list_resp = self.client.get('/api/notifications/')
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(list_resp.data['count'], 0)

        # Archived filter should show it
        archived_resp = self.client.get('/api/notifications/?archived=archived')
        self.assertEqual(archived_resp.data['count'], 1)
