from celery import shared_task
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from .models import ReportSchedule
from apps.leads.models import Lead
from apps.teams.models import Team

@shared_task
def execute_scheduled_reports():
    """
    Celery task to run recurring scheduled reports configured by Admins.
    Delivers reports via Google SMTP.
    """
    now = timezone.now()
    active_schedules = ReportSchedule.objects.filter(is_active=True)
    results = []

    # Calculate actual statistics without inventing arbitrary report types
    total_leads = Lead.objects.count()
    teams = Team.objects.all()
    team_breakdown = "\n".join([f"- {t.name}: {t.leads.count()} leads" for t in teams])

    report_subject = f"[CRM Report] Scheduled CRM Status Summary - {now.strftime('%Y-%m-%d')}"
    report_body = (
        f"CRM Scheduled Report\n"
        f"Generated at: {now.isoformat()}\n\n"
        f"Summary:\n"
        f"- Total Leads: {total_leads}\n"
        f"- Total Teams: {teams.count()}\n\n"
        f"Team Breakdown:\n{team_breakdown if team_breakdown else '- No teams registered'}\n\n"
        f"This is an automated report delivered per administrator schedule."
    )

    user_email = getattr(settings, 'EMAIL_HOST_USER', '')
    password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')

    for schedule in active_schedules:
        if not user_email or not password:
            results.append({
                "schedule_id": schedule.id,
                "status": "BLOCKED",
                "reason": "Google SMTP credentials not configured in environment"
            })
            continue

        try:
            send_mail(
                subject=report_subject,
                message=report_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=schedule.recipients,
                fail_silently=False
            )
            schedule.last_run_at = now
            schedule.save(update_fields=['last_run_at'])
            results.append({
                "schedule_id": schedule.id,
                "status": "SENT",
                "recipients_count": len(schedule.recipients)
            })
        except Exception as e:
            results.append({
                "schedule_id": schedule.id,
                "status": "FAILED",
                "error": str(e)
            })

    return results
