from django.db import models
from django.conf import settings

class AuditEvent(models.Model):
    EVENT_TYPES = [
        ('LEAD_CREATED', 'Lead Created'),
        ('LEAD_ASSIGNED', 'Lead Assigned'),
        ('LEAD_REASSIGNED', 'Lead Reassigned'),
        ('LEAD_STAGE_CHANGED', 'Lead Stage Changed'),
        ('LEAD_UPDATED', 'Lead Updated'),
        ('COMMUNICATION_ATTEMPT', 'Communication Attempt'),
        ('TEMPLATE_CREATED', 'Template Created'),
        ('REPORT_SCHEDULED', 'Report Scheduled'),
        ('PASSWORD_CHANGED', 'Password Changed'),
        ('PASSWORD_RESET_INITIATED', 'Password Reset Initiated'),
        ('PASSWORD_RESET_COMPLETED', 'Password Reset Completed'),
        ('USER_CREATED', 'User Created'),
        ('USER_UPDATED', 'User Details Updated'),
        ('ACCOUNT_ACTIVATED', 'Account Activated'),
        ('ACCOUNT_DEACTIVATED', 'Account Deactivated'),
        ('ACCOUNT_SUSPENDED', 'Account Suspended'),
        ('TEAM_CREATED', 'Team Created'),
        ('TEAM_UPDATED', 'Team Updated'),
        ('TEAM_MANAGER_CHANGED', 'Team Manager Changed'),
        ('TEAM_ACTIVATED', 'Team Activated'),
        ('TEAM_DEACTIVATED', 'Team Deactivated'),
        ('TEAM_DELETION_ATTEMPTED', 'Team Deletion Attempted'),
        ('TEAM_DELETED', 'Team Deleted'),
        ('EMPLOYEE_TEAM_TRANSFERRED', 'Employee Team Transferred'),
        ('LEAD_UNASSIGNED', 'Lead Unassigned'),
    ]

    event_type = models.CharField(max_length=50, choices=EVENT_TYPES)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_events'
    )
    details = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        user_str = self.user.username if self.user else "System"
        return f"[{self.timestamp.isoformat()}] {self.event_type} by {user_str}"
