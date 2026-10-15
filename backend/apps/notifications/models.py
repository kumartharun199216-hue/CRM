import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class NotificationType(models.TextChoices):
    LEAD_ASSIGNED = 'LEAD_ASSIGNED', 'Lead Assigned'
    TASK_DUE = 'TASK_DUE', 'Follow-up Due'
    PAYMENT_DUE = 'PAYMENT_DUE', 'Payment Due'
    MEETING_SCHEDULED = 'MEETING_SCHEDULED', 'Meeting Scheduled'
    MISSED_CALL = 'MISSED_CALL', 'Missed Call Alert'
    STAGE_CHANGED = 'STAGE_CHANGED', 'Stage Changed'
    SYSTEM_ALERT = 'SYSTEM_ALERT', 'System Alert'
    GENERAL = 'GENERAL', 'General'


class NotificationPriority(models.TextChoices):
    LOW = 'LOW', 'Low'
    NORMAL = 'NORMAL', 'Normal'
    HIGH = 'HIGH', 'High'
    URGENT = 'URGENT', 'Urgent'


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True
    )
    type = models.CharField(
        max_length=40,
        choices=NotificationType.choices,
        default=NotificationType.GENERAL,
        db_index=True
    )
    priority = models.CharField(
        max_length=20,
        choices=NotificationPriority.choices,
        default=NotificationPriority.NORMAL,
        db_index=True
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    entity_type = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    entity_id = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    action_url = models.CharField(max_length=500, blank=True, null=True)
    read_at = models.DateTimeField(null=True, blank=True, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True, db_index=True)
    deduplication_key = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'read_at', '-created_at']),
            models.Index(fields=['recipient', 'archived_at', '-created_at']),
            models.Index(fields=['deduplication_key']),
        ]

    def __str__(self):
        return f"[{self.type} - {self.priority}] {self.title} -> {self.recipient.username}"

    @property
    def is_read(self) -> bool:
        return self.read_at is not None

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None

    def mark_as_read(self):
        if not self.read_at:
            self.read_at = timezone.now()
            self.save(update_fields=['read_at'])

    def archive(self):
        if not self.archived_at:
            self.archived_at = timezone.now()
            self.save(update_fields=['archived_at'])
