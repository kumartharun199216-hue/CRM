from rest_framework import generics, views, status, permissions
from rest_framework.response import Response
from .models import ReportSchedule
from .serializers import ReportScheduleSerializer
from .tasks import execute_scheduled_reports
from apps.authentication.permissions import IsAdminRole
from apps.audit.models import AuditEvent

class ReportScheduleListCreateView(generics.ListCreateAPIView):
    """
    Admins configure report recipients and schedules.
    """
    queryset = ReportSchedule.objects.all().order_by('-created_at')
    serializer_class = ReportScheduleSerializer
    permission_classes = [IsAdminRole]

    def perform_create(self, serializer):
        schedule = serializer.save(created_by=self.request.user)
        AuditEvent.objects.create(
            event_type='REPORT_SCHEDULED',
            user=self.request.user,
            details={
                'schedule_id': schedule.id,
                'name': schedule.name,
                'recipients': schedule.recipients,
                'frequency': schedule.frequency
            }
        )

class ReportScheduleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ReportSchedule.objects.all()
    serializer_class = ReportScheduleSerializer
    permission_classes = [IsAdminRole]

class TriggerReportRunView(views.APIView):
    """
    Manually triggers execution of the scheduled report delivery task via Celery.
    """
    permission_classes = [IsAdminRole]

    def post(self, request):
        try:
            # Attempt async celery dispatch, or run synchronously if broker is not running
            task = execute_scheduled_reports.delay()
            task_id = task.id
        except Exception:
            # Fallback to direct synchronous execution if Celery daemon is not active locally
            results = execute_scheduled_reports()
            return Response({
                'message': 'Report task executed synchronously (Celery broker not connected).',
                'results': results
            }, status=status.HTTP_200_OK)

        return Response({
            'message': 'Scheduled report execution queued via Celery.',
            'task_id': task_id
        }, status=status.HTTP_202_ACCEPTED)
