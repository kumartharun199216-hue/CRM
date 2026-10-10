from rest_framework import serializers
from .models import AuditEvent

class AuditEventSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = AuditEvent
        fields = ['id', 'event_type', 'user', 'username', 'details', 'timestamp']
        read_only_fields = fields
