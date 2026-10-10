from rest_framework import generics, permissions
from .models import AuditEvent
from .serializers import AuditEventSerializer
from apps.authentication.permissions import IsAdminOrManagerRole
from apps.authentication.models import UserRole

class AuditEventListView(generics.ListAPIView):
    serializer_class = AuditEventSerializer
    permission_classes = [IsAdminOrManagerRole]

    def get_queryset(self):
        user = self.request.user
        queryset = AuditEvent.objects.all().select_related('user')
        if not (user.is_superuser or user.role == UserRole.ADMIN):
            # Manager only sees events initiated by users in their team or their leads
            managed = getattr(user, 'managed_team', None)
            team_id = managed.id if managed else user.team_id
            queryset = queryset.filter(user__team_id=team_id)

        event_type = self.request.query_params.get('event_type')
        if event_type:
            queryset = queryset.filter(event_type=event_type)

        return queryset.order_by('-timestamp')
