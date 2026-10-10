from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

class ScheduleFrequency(models.TextChoices):
    DAILY = 'DAILY', 'Daily'
    WEEKLY = 'WEEKLY', 'Weekly'
    MONTHLY = 'MONTHLY', 'Monthly'

class ReportSchedule(models.Model):
    name = models.CharField(max_length=150)
    recipients = models.JSONField(
        default=list,
        help_text="List of recipient email addresses configured by Admin"
    )
    frequency = models.CharField(
        max_length=20,
        choices=ScheduleFrequency.choices,
        default=ScheduleFrequency.DAILY
    )
    time_utc = models.TimeField(
        default='09:00:00',
        help_text="Scheduled execution time in UTC"
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='report_schedules'
    )
    last_run_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def clean(self):
        super().clean()
        if not isinstance(self.recipients, list) or len(self.recipients) == 0:
            raise ValidationError({'recipients': 'At least one recipient email address must be configured.'})

    def __str__(self):
        return f"{self.name} ({self.get_frequency_display()}) - {len(self.recipients)} recipients"
