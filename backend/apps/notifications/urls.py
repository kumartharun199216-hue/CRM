from django.urls import path
from .views import (
    NotificationListView,
    UnreadCountView,
    NotificationDetailView,
    MarkNotificationReadView,
    MarkAllReadView,
    ArchiveNotificationView,
    BroadcastNotificationView,
)

app_name = 'notifications'

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('unread-count/', UnreadCountView.as_view(), name='unread-count'),
    path('read-all/', MarkAllReadView.as_view(), name='mark-all-read'),
    path('broadcast/', BroadcastNotificationView.as_view(), name='broadcast'),
    path('<uuid:pk>/', NotificationDetailView.as_view(), name='notification-detail'),
    path('<uuid:pk>/read/', MarkNotificationReadView.as_view(), name='mark-read'),
    path('<uuid:pk>/archive/', ArchiveNotificationView.as_view(), name='mark-archive'),
]
