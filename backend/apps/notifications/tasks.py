import logging
from datetime import timedelta
from django.utils import timezone
from celery import shared_task
from apps.leads.models import Lead
from .models import NotificationType, NotificationPriority, Notification
from .services import create_notification

logger = logging.getLogger(__name__)


@shared_task(name='apps.notifications.tasks.check_upcoming_followups_task')
def check_upcoming_followups_task():
    """
    Periodic task to scan for leads with upcoming or recently overdue follow-ups,
    and alert the assigned employee/counsellor with high-priority in-app notifications.
    """
    now = timezone.now()
    window_ahead = now + timedelta(minutes=30)
    window_past = now - timedelta(hours=24)

    # Leads with follow_ups in [now - 24h, now + 30m]
    leads_to_notify = Lead.objects.filter(
        assigned_employee__isnull=False,
        next_follow_up__isnull=False,
        next_follow_up__gte=window_past,
        next_follow_up__lte=window_ahead,
    ).select_related('assigned_employee', 'stage')

    count_created = 0
    for lead in leads_to_notify:
        user = lead.assigned_employee
        if not user or not user.is_active:
            continue

        follow_up_time = lead.next_follow_up
        follow_str = follow_up_time.strftime('%Y%m%d_%H%M')
        dedup_key = f"followup_alert_{lead.id}_{follow_str}"

        is_overdue = follow_up_time < now
        if is_overdue:
            title = f"Overdue Follow-up: {lead.name or lead.lead_id}"
            message = (
                f"Scheduled consultation with {lead.name or 'lead'} ({lead.phone}) "
                f"was due at {follow_up_time.strftime('%I:%M %p')}. Please update status."
            )
            priority = NotificationPriority.URGENT
        else:
            diff_mins = max(1, int((follow_up_time - now).total_seconds() / 60))
            title = f"Follow-up in {diff_mins}m: {lead.name or lead.lead_id}"
            message = (
                f"Scheduled follow-up with {lead.name or 'lead'} ({lead.phone}) "
                f"is approaching at {follow_up_time.strftime('%I:%M %p')}."
            )
            priority = NotificationPriority.HIGH

        notif = create_notification(
            recipient=user,
            type=NotificationType.TASK_DUE,
            title=title,
            message=message,
            entity_type='lead',
            entity_id=lead.lead_id,
            action_url=f"/?view=lead360&lead360={lead.lead_id}",
            priority=priority,
            deduplication_key=dedup_key,
        )
        if notif:
            count_created += 1

    # Cleanup any old notifications expired past 30 days
    cutoff = now - timedelta(days=30)
    Notification.objects.filter(created_at__lt=cutoff, archived_at__isnull=False).delete()

    logger.info(f"Follow-up check completed. Created {count_created} new follow-up notifications.")
    return f"Created {count_created} notifications."
