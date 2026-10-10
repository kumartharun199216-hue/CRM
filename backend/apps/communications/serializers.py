from rest_framework import serializers
from .models import CommunicationTemplate, CommunicationLog, CommunicationChannel
from apps.leads.models import Lead

class CommunicationTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = CommunicationTemplate
        fields = [
            'id', 'name', 'channel', 'subject', 'body',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        channel = attrs.get('channel')
        subject = attrs.get('subject')
        if channel == CommunicationChannel.EMAIL and not subject and not (self.instance and self.instance.subject):
            raise serializers.ValidationError({"subject": "Email templates require a subject line."})
        return attrs

class CommunicationLogSerializer(serializers.ModelSerializer):
    initiated_by_name = serializers.CharField(source='initiated_by.username', read_only=True)
    lead_title = serializers.CharField(source='lead.title', read_only=True)

    class Meta:
        model = CommunicationLog
        fields = [
            'id', 'lead', 'lead_title', 'channel', 'recipient', 'subject',
            'content', 'status', 'error_message', 'external_reference_id',
            'initiated_by', 'initiated_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'status', 'error_message', 'external_reference_id', 'initiated_by', 'created_at']

class SendEmailSerializer(serializers.Serializer):
    lead_id = serializers.IntegerField(required=True)
    subject = serializers.CharField(required=True, max_length=255)
    body = serializers.CharField(required=True)

class SendWhatsAppSerializer(serializers.Serializer):
    lead_id = serializers.IntegerField(required=True)
    message = serializers.CharField(required=True)

class InitiateCallSerializer(serializers.Serializer):
    lead_id = serializers.IntegerField(required=True)
