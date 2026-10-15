from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/teams/', include('apps.teams.urls')),
    path('api/leads/', include('apps.leads.urls')),
    path('api/communications/', include('apps.communications.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
]

