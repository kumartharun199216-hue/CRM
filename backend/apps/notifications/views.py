import logging
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from apps.authentication.permissions import HasCompletedPasswordChange, IsAdminOrManagerRole
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from .models import Notification, NotificationType, NotificationPriority
from .serializers import (
    NotificationSerializer,
    UnreadCountSerializer,
    MarkAllReadSerializer,
    BroadcastNotificationSerializer,
)
from .services import notify_users

logger = logging.getLogger(__name__)


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    page_query_param = 'page'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'total_pages': self.page.paginator.num_pages,
            'current_page': self.page.number,
            'page_size': self.get_page_size(self.request),
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data
        })


class NotificationListView(generics.ListAPIView):
    """
    List user notifications with comprehensive filtering.
    """
    serializer_class = NotificationSerializer
    pagination_class = NotificationPagination
    permission_classes = [permissions.IsAuthenticated, HasCompletedPasswordChange]

    def get_queryset(self):
        user = self.request.user
        queryset = Notification.objects.filter(recipient=user)

        # Filter by unread status
        unread_only = self.request.query_params.get('unread_only')
        if unread_only and unread_only.lower() in ('true', '1'):
            queryset = queryset.filter(read_at__isnull=True)

        # Filter by archive status: 'active' (default), 'archived', 'all'
        archived = self.request.query_params.get('archived', 'active').lower()
        if archived == 'active':
            queryset = queryset.filter(archived_at__isnull=True)
        elif archived == 'archived':
            queryset = queryset.filter(archived_at__isnull=False)
        # 'all' does not filter by archived_at

        # Filter by type
        notif_type = self.request.query_params.get('type')
        if notif_type and notif_type != 'ALL':
            queryset = queryset.filter(type=notif_type)

        # Filter by priority
        priority = self.request.query_params.get('priority')
        if priority and priority != 'ALL':
            queryset = queryset.filter(priority=priority)

        # Search term in title or message or entity_id
        search = self.request.query_params.get('search')
        if search and search.strip():
            term = search.strip()
            queryset = queryset.filter(
                Q(title__icontains=term) |
                Q(message__icontains=term) |
                Q(entity_id__icontains=term)
            )

        # Ordering
        ordering = self.request.query_params.get('ordering', '-created_at')
        if ordering in ['-created_at', 'created_at', '-priority', 'priority']:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('-created_at')

        return queryset


class UnreadCountView(APIView):
    """
    Lightweight, fast endpoint for polling unread notification count.
    """
    permission_classes = [permissions.IsAuthenticated, HasCompletedPasswordChange]

    def get(self, request):
        count = Notification.objects.filter(
            recipient=request.user,
            read_at__isnull=True,
            archived_at__isnull=True
        ).count()
        return Response({'unread_count': count}, status=status.HTTP_200_OK)


class NotificationDetailView(generics.RetrieveAPIView):
    """
    Retrieve single notification detail.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated, HasCompletedPasswordChange]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)


class MarkNotificationReadView(APIView):
    """
    Marks a specific notification as read.
    """
    permission_classes = [permissions.IsAuthenticated, HasCompletedPasswordChange]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, recipient=request.user)
            notification.mark_as_read()
            serializer = NotificationSerializer(notification)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)


class MarkAllReadView(APIView):
    """
    Marks all unread notifications of the user as read.
    """
    permission_classes = [permissions.IsAuthenticated, HasCompletedPasswordChange]

    def post(self, request):
        updated_count = Notification.objects.filter(
            recipient=request.user,
            read_at__isnull=True,
            archived_at__isnull=True
        ).update(read_at=timezone.now())

        return Response({'updated_count': updated_count}, status=status.HTTP_200_OK)


class ArchiveNotificationView(APIView):
    """
    Archives a specific notification.
    """
    permission_classes = [permissions.IsAuthenticated, HasCompletedPasswordChange]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, recipient=request.user)
            notification.archive()
            serializer = NotificationSerializer(notification)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)


class BroadcastNotificationView(APIView):
    """
    Admin or Manager endpoint to broadcast an announcement/alert.
    """
    permission_classes = [permissions.IsAuthenticated, HasCompletedPasswordChange, IsAdminOrManagerRole]

    def post(self, request):
        serializer = BroadcastNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        team_id = data.get('team_id')

        if team_id:
            try:
                team = Team.objects.get(pk=team_id)
                recipients = list(team.members.filter(is_active=True))
                if team.manager and team.manager.is_active and team.manager not in recipients:
                    recipients.append(team.manager)
            except Team.DoesNotExist:
                return Response({'error': f'Team with ID {team_id} does not exist.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            # Broadcast to all active users
            recipients = list(User.objects.filter(is_active=True))

        created = notify_users(
            recipients=recipients,
            type=data.get('type', NotificationType.SYSTEM_ALERT),
            title=data.get('title'),
            message=data.get('message'),
            action_url=data.get('action_url') or None,
            priority=data.get('priority', NotificationPriority.NORMAL),
        )

        return Response({
            'detail': f'Broadcast sent successfully to {len(created)} recipients.',
            'recipients_count': len(created),
        }, status=status.HTTP_201_CREATED)
