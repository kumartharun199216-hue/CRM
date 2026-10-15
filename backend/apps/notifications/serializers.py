from rest_framework import serializers
from .models import Notification, NotificationType, NotificationPriority


class NotificationSerializer(serializers.ModelSerializer):
    recipient_username = serializers.CharField(source='recipient.username', read_only=True)
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'recipient',
            'recipient_username',
            'recipient_name',
            'type',
            'priority',
            'title',
            'message',
            'entity_type',
            'entity_id',
            'action_url',
            'read_at',
            'archived_at',
            'deduplication_key',
            'expires_at',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class UnreadCountSerializer(serializers.Serializer):
    unread_count = serializers.IntegerField()


class MarkAllReadSerializer(serializers.Serializer):
    updated_count = serializers.IntegerField()


class BroadcastNotificationSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    message = serializers.CharField()
    type = serializers.ChoiceField(choices=NotificationType.choices, default=NotificationType.SYSTEM_ALERT)
    priority = serializers.ChoiceField(choices=NotificationPriority.choices, default=NotificationPriority.NORMAL)
    team_id = serializers.IntegerField(required=False, allow_null=True)
    action_url = serializers.CharField(max_length=500, required=False, allow_blank=True)
