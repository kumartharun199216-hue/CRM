from django.urls import path
from .views import ReportScheduleListCreateView, ReportScheduleDetailView, TriggerReportRunView

urlpatterns = [
    path('schedules/', ReportScheduleListCreateView.as_view(), name='report-schedule-list-create'),
    path('schedules/<int:pk>/', ReportScheduleDetailView.as_view(), name='report-schedule-detail'),
    path('run/', TriggerReportRunView.as_view(), name='report-trigger-run'),
]
