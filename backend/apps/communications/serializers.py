import os
from rest_framework import serializers
from .models import CommunicationTemplate, TemplateAttachment, CommunicationLog, CommunicationChannel
from .constants import (
    SUPPORTED_PLACEHOLDERS,
    ALLOWED_ATTACHMENT_EXTENSIONS,
    MAX_FILE_SIZE_BYTES,
    MAX_ATTACHMENTS_PER_TEMPLATE,
    validate_placeholders,
    render_preview
)
from apps.leads.models import Lead

class TemplateAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.username', read_only=True)
    download_url = serializers.SerializerMethodField()
    file_size_display = serializers.CharField(read_only=True)

    class Meta:
        model = TemplateAttachment
        fields = [
            'id', 'template', 'original_filename', 'file_size',
            'file_size_display', 'content_type', 'download_url',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at'
        ]
        read_only_fields = ['id', 'template', 'original_filename', 'file_size', 'content_type', 'download_url', 'uploaded_by', 'uploaded_at']

    def get_download_url(self, obj):
        request = self.context.get('request')
        relative_url = f"/api/communications/attachments/{obj.id}/download/"
        return request.build_absolute_uri(relative_url) if request else relative_url

class CommunicationTemplateSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(default=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.username', read_only=True)
    team_name = serializers.CharField(source='team.name', read_only=True)
    attachments = TemplateAttachmentSerializer(many=True, read_only=True)
    attachments_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = CommunicationTemplate
        fields = [
            'id', 'name', 'description', 'channel', 'subject', 'body',
            'body_format', 'is_active', 'team', 'team_name',
            'created_by', 'created_by_name', 'updated_by', 'updated_by_name',
            'attachments_count', 'attachments', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_by_name', 'updated_by', 'updated_by_name', 'attachments_count', 'attachments', 'created_at', 'updated_at']

    def validate(self, attrs):
        channel = attrs.get('channel', getattr(self.instance, 'channel', CommunicationChannel.EMAIL))
        subject = attrs.get('subject', getattr(self.instance, 'subject', ''))
        body = attrs.get('body', getattr(self.instance, 'body', ''))

        # Subject required for email templates
        if channel == CommunicationChannel.EMAIL:
            if not subject or not subject.strip():
                raise serializers.ValidationError({"subject": "Email templates require a subject line."})

        # Validate placeholders in subject
        if subject:
            invalid_subject_placeholders = validate_placeholders(subject)
            if invalid_subject_placeholders:
                raise serializers.ValidationError({
                    "subject": f"Unsupported placeholders found in subject: {', '.join(invalid_subject_placeholders)}. Supported placeholders: {', '.join(SUPPORTED_PLACEHOLDERS.keys())}"
                })

        # Validate placeholders in body
        if body:
            invalid_body_placeholders = validate_placeholders(body)
            if invalid_body_placeholders:
                raise serializers.ValidationError({
                    "body": f"Unsupported placeholders found in body: {', '.join(invalid_body_placeholders)}. Supported placeholders: {', '.join(SUPPORTED_PLACEHOLDERS.keys())}"
                })

        # Role & team scoping check
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            user = request.user
            if user.role == 'MANAGER':
                managed_team = getattr(user, 'managed_team', None) or user.team
                requested_team = attrs.get('team')
                if requested_team and requested_team != managed_team:
                    raise serializers.ValidationError({"team": "Managers can only create or assign templates for their own team."})
                if not self.instance and not requested_team:
                    attrs['team'] = managed_team

        return attrs

class TemplatePreviewSerializer(serializers.Serializer):
    template_id = serializers.IntegerField(required=False, allow_null=True)
    lead_id = serializers.IntegerField(required=False, allow_null=True)
    subject = serializers.CharField(required=False, allow_blank=True)
    body = serializers.CharField(required=False, allow_blank=True)
    sample_data = serializers.DictField(required=False, default=dict)

class AttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)

    def validate_file(self, value):
        filename = value.name
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
            allowed = ", ".join(sorted(ALLOWED_ATTACHMENT_EXTENSIONS))
            raise serializers.ValidationError(
                f"File extension '{ext}' is not permitted. Allowed extensions: {allowed}."
            )

        if value.size > MAX_FILE_SIZE_BYTES:
            max_mb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
            raise serializers.ValidationError(
                f"File size ({value.size / (1024 * 1024):.1f} MB) exceeds maximum allowed size of {max_mb:.0f} MB."
            )

        return value

class CommunicationLogSerializer(serializers.ModelSerializer):
    initiated_by_name = serializers.SerializerMethodField()
    initiated_by_mobile = serializers.CharField(source='initiated_by.mobile_number', read_only=True)
    lead_title = serializers.CharField(source='lead.title', read_only=True)
    lead_contact_name = serializers.CharField(source='lead.contact_name', read_only=True)
    lead_phone = serializers.CharField(source='lead.phone', read_only=True)
    tel_url = serializers.SerializerMethodField()

    class Meta:
        model = CommunicationLog
        fields = [
            'id', 'lead', 'lead_title', 'lead_contact_name', 'lead_phone',
            'channel', 'recipient', 'subject',
            'content', 'status', 'error_message', 'external_reference_id',
            'call_duration', 'call_recording_url', 'call_type', 'tel_url',
            'synced_at', 'call_datetime', 'provider_source',
            'initiated_by', 'initiated_by_name', 'initiated_by_mobile', 'created_at'
        ]
        read_only_fields = [
            'id', 'status', 'error_message', 'external_reference_id',
            'call_duration', 'call_recording_url', 'call_type', 'tel_url',
            'synced_at', 'call_datetime', 'provider_source',
            'initiated_by', 'created_at'
        ]

    def get_initiated_by_name(self, obj):
        if not obj.initiated_by:
            return None
        full = f"{obj.initiated_by.first_name} {obj.initiated_by.last_name}".strip()
        return full if full else obj.initiated_by.username

    def get_tel_url(self, obj):
        if obj.recipient:
            clean = ''.join(c for c in obj.recipient if c.isdigit() or c == '+')
            return f"tel:{clean}"
        return None

class SendEmailSerializer(serializers.Serializer):
    lead_id = serializers.IntegerField(required=True)
    template_id = serializers.IntegerField(required=False, allow_null=True)
    subject = serializers.CharField(required=False, allow_blank=True, max_length=255)
    body = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        template_id = attrs.get('template_id')
        subject = (attrs.get('subject') or '').strip()
        body = (attrs.get('body') or '').strip()

        if not template_id:
            if not subject:
                raise serializers.ValidationError({"subject": "Subject is required when no template is selected."})
            if not body:
                raise serializers.ValidationError({"body": "Message body is required when no template is selected."})
        return attrs

class SendWhatsAppSerializer(serializers.Serializer):
    lead_id = serializers.IntegerField(required=True)
    message = serializers.CharField(required=True)

class InitiateCallSerializer(serializers.Serializer):
    lead_id = serializers.IntegerField(required=True)

class TestEmailSerializer(serializers.Serializer):
    recipient = serializers.EmailField(required=True)
