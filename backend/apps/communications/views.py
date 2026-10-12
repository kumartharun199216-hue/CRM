import os
from rest_framework import generics, status, views, permissions
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.core.mail import send_mail
from django.http import FileResponse, Http404
from django.db.models import Q

from .models import CommunicationTemplate, TemplateAttachment, CommunicationLog, CommunicationChannel
from .serializers import (
    CommunicationTemplateSerializer,
    TemplateAttachmentSerializer,
    TemplatePreviewSerializer,
    AttachmentUploadSerializer,
    CommunicationLogSerializer,
    SendEmailSerializer,
    SendWhatsAppSerializer,
    InitiateCallSerializer,
    TestEmailSerializer
)
from .constants import (
    SUPPORTED_PLACEHOLDERS,
    SAMPLE_PREVIEW_DATA,
    ALLOWED_ATTACHMENT_EXTENSIONS,
    MAX_FILE_SIZE_BYTES,
    MAX_TOTAL_ATTACHMENTS_SIZE_BYTES,
    MAX_ATTACHMENTS_PER_TEMPLATE,
    validate_placeholders,
    render_preview
)
from .services import CommunicationService, IntegrationBlockerException
from apps.leads.models import Lead
from apps.authentication.permissions import (
    IsAdminOrManagerRole,
    IsAdminRole,
    CanAccessLead,
    CanManageTemplate,
    CanViewTemplate
)
from apps.authentication.models import UserRole
from apps.audit.models import AuditEvent


class CommunicationTemplateListCreateView(generics.ListCreateAPIView):
    """
    List templates visible to the user, or create a new template (Admins & Managers).
    """
    serializer_class = CommunicationTemplateSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), CanManageTemplate()]
        return [permissions.IsAuthenticated(), CanViewTemplate()]

    def get_queryset(self):
        user = self.request.user
        queryset = CommunicationTemplate.objects.select_related(
            'created_by', 'updated_by', 'team'
        ).prefetch_related('attachments')

        if user.is_superuser or user.role == UserRole.ADMIN:
            # Admins see all templates across organization
            pass
        elif user.role == UserRole.MANAGER:
            # Managers see team templates, unassigned global templates, and their own
            managed_team = getattr(user, 'managed_team', None) or user.team
            managed_team_id = managed_team.id if managed_team else None
            queryset = queryset.filter(
                Q(team_id=managed_team_id) | Q(team__isnull=True) | Q(created_by=user)
            )
        elif user.role == UserRole.SALES_EMPLOYEE:
            # Sales employees only see active templates assigned to their team or global
            user_team = user.team
            user_team_id = user_team.id if user_team else None
            queryset = queryset.filter(
                is_active=True
            ).filter(
                Q(team_id=user_team_id) | Q(team__isnull=True)
            )
        else:
            return CommunicationTemplate.objects.none()

        # Filtering
        channel = self.request.query_params.get('channel')
        if channel:
            queryset = queryset.filter(channel=channel)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None and is_active != '':
            if is_active.lower() in ['true', '1']:
                queryset = queryset.filter(is_active=True)
            elif is_active.lower() in ['false', '0']:
                queryset = queryset.filter(is_active=False)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(subject__icontains=search) | Q(description__icontains=search)
            )

        team_id = self.request.query_params.get('team')
        if team_id:
            queryset = queryset.filter(team_id=team_id)

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        extra_data = {
            'created_by': user,
            'updated_by': user
        }

        # If Manager, scope to their managed team if not set
        if user.role == UserRole.MANAGER and 'team' not in serializer.validated_data:
            managed_team = getattr(user, 'managed_team', None) or user.team
            extra_data['team'] = managed_team

        template = serializer.save(**extra_data)

        # Handle file uploads on template creation if any
        files = self.request.FILES.getlist('attachments') or self.request.FILES.getlist('files')
        if files:
            _save_attachments_to_template(template, files, user)

        AuditEvent.objects.create(
            event_type='TEMPLATE_CREATED',
            user=user,
            details={
                'template_id': template.id,
                'name': template.name,
                'channel': template.channel,
                'team_id': template.team_id
            }
        )


class CommunicationTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, or delete a communication template.
    """
    serializer_class = CommunicationTemplateSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [permissions.IsAuthenticated(), CanManageTemplate()]
        return [permissions.IsAuthenticated(), CanViewTemplate()]

    def get_queryset(self):
        user = self.request.user
        queryset = CommunicationTemplate.objects.select_related(
            'created_by', 'updated_by', 'team'
        ).prefetch_related('attachments')

        if user.is_superuser or user.role == UserRole.ADMIN:
            return queryset
        elif user.role == UserRole.MANAGER:
            managed_team = getattr(user, 'managed_team', None) or user.team
            managed_team_id = managed_team.id if managed_team else None
            return queryset.filter(
                Q(team_id=managed_team_id) | Q(team__isnull=True) | Q(created_by=user)
            )
        elif user.role == UserRole.SALES_EMPLOYEE:
            user_team = user.team
            user_team_id = user_team.id if user_team else None
            return queryset.filter(
                is_active=True
            ).filter(
                Q(team_id=user_team_id) | Q(team__isnull=True)
            )
        return CommunicationTemplate.objects.none()

    def perform_update(self, serializer):
        user = self.request.user
        template = serializer.save(updated_by=user)

        # Handle attachment uploads during update if provided
        files = self.request.FILES.getlist('attachments') or self.request.FILES.getlist('files')
        if files:
            _save_attachments_to_template(template, files, user)

        AuditEvent.objects.create(
            event_type='TEMPLATE_UPDATED',
            user=user,
            details={
                'template_id': template.id,
                'name': template.name,
                'channel': template.channel
            }
        )

    def perform_destroy(self, instance):
        user = self.request.user
        template_id = instance.id
        template_name = instance.name

        # Clean up all attachments safely from disk
        for attachment in instance.attachments.all():
            attachment.delete()

        instance.delete()

        AuditEvent.objects.create(
            event_type='TEMPLATE_DELETED',
            user=user,
            details={
                'template_id': template_id,
                'name': template_name
            }
        )


class TemplateToggleActiveView(views.APIView):
    """
    Toggle a template's active/inactive status.
    """
    permission_classes = [permissions.IsAuthenticated, CanManageTemplate]

    def patch(self, request, pk):
        template = get_object_or_404(CommunicationTemplate, pk=pk)
        self.check_object_permissions(request, template)

        template.is_active = not template.is_active
        template.updated_by = request.user
        template.save(update_fields=['is_active', 'updated_by', 'updated_at'])

        AuditEvent.objects.create(
            event_type='TEMPLATE_STATUS_CHANGED',
            user=request.user,
            details={
                'template_id': template.id,
                'name': template.name,
                'is_active': template.is_active
            }
        )

        serializer = CommunicationTemplateSerializer(template, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class TemplateAttachmentUploadView(views.APIView):
    """
    Upload one or more attachments to an existing template.
    """
    permission_classes = [permissions.IsAuthenticated, CanManageTemplate]

    def post(self, request, pk):
        template = get_object_or_404(CommunicationTemplate, pk=pk)
        self.check_object_permissions(request, template)

        files = request.FILES.getlist('attachments') or request.FILES.getlist('files')
        if not files and 'file' in request.FILES:
            files = [request.FILES['file']]

        if not files:
            return Response({'error': 'No file(s) provided.'}, status=status.HTTP_400_BAD_REQUEST)

        created_attachments = _save_attachments_to_template(template, files, request.user)
        template.updated_by = request.user
        template.save(update_fields=['updated_by', 'updated_at'])

        AuditEvent.objects.create(
            event_type='TEMPLATE_ATTACHMENT_UPLOADED',
            user=request.user,
            details={
                'template_id': template.id,
                'attachment_count': len(created_attachments),
                'files': [a.original_filename for a in created_attachments]
            }
        )

        serializer = TemplateAttachmentSerializer(created_attachments, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TemplateAttachmentDeleteView(views.APIView):
    """
    Remove an attachment from a template.
    """
    permission_classes = [permissions.IsAuthenticated, CanManageTemplate]

    def delete(self, request, pk=None, attachment_id=None):
        target_id = attachment_id or pk
        attachment = get_object_or_404(TemplateAttachment, pk=target_id)
        template = attachment.template

        # Check permissions against the parent template
        self.check_object_permissions(request, template)

        filename = attachment.original_filename
        attachment.delete()

        template.updated_by = request.user
        template.save(update_fields=['updated_by', 'updated_at'])

        AuditEvent.objects.create(
            event_type='TEMPLATE_ATTACHMENT_DELETED',
            user=request.user,
            details={
                'template_id': template.id,
                'attachment_id': target_id,
                'filename': filename
            }
        )

        return Response({'message': f"Attachment '{filename}' successfully removed."}, status=status.HTTP_200_OK)


class AttachmentDownloadView(views.APIView):
    """
    Securely download an attachment if the user is authorized to view the template.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        attachment = get_object_or_404(TemplateAttachment.objects.select_related('template'), pk=pk)
        template = attachment.template

        # Check visibility permission
        checker = CanViewTemplate()
        if not checker.has_object_permission(request, self, template):
            raise PermissionDenied("You do not have permission to access attachments for this template.")

        if not attachment.file or not os.path.exists(attachment.file.path):
            raise Http404("Attachment file does not exist on storage.")

        response = FileResponse(
            attachment.file.open('rb'),
            content_type=attachment.content_type or 'application/octet-stream'
        )
        response['Content-Disposition'] = f'attachment; filename="{attachment.original_filename}"'
        response['Content-Length'] = attachment.file_size
        return response


class TemplatePreviewView(views.APIView):
    """
    Generate preview for a template with safe sample or custom placeholder data.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk=None):
        subject = request.data.get('subject', '')
        body = request.data.get('body', '')
        sample_data = request.data.get('sample_data') or SAMPLE_PREVIEW_DATA
        lead_id = request.data.get('lead_id')

        template_id = pk or request.data.get('template_id')
        template = None
        if template_id:
            template = get_object_or_404(CommunicationTemplate, pk=template_id)
            checker = CanViewTemplate()
            if not checker.has_object_permission(request, self, template):
                raise PermissionDenied("You do not have permission to preview this template.")
            if not subject:
                subject = template.subject
            if not body:
                body = template.body

        lead = None
        if lead_id:
            lead = get_object_or_404(Lead, id=lead_id)
            if not CanAccessLead().has_object_permission(request, self, lead):
                raise PermissionDenied("You do not have permission to access this lead.")

        body_format = getattr(template, 'body_format', 'PLAIN') if template else 'PLAIN'

        # Safe placeholder rendering
        preview_result = render_preview(
            subject_or_text=subject,
            body=body,
            custom_data=sample_data,
            lead=lead,
            user=request.user,
            body_format=body_format
        )

        return Response({
            'subject': preview_result['subject'],
            'body': preview_result['body'],
            'unresolved_placeholders': preview_result['unresolved_placeholders'],
            'available_placeholders': SUPPORTED_PLACEHOLDERS,
            'sample_data': preview_result.get('context_used', sample_data)
        }, status=status.HTTP_200_OK)


def _save_attachments_to_template(template, files, user):
    """
    Helper to validate and attach multiple files to a template.
    """
    current_count = template.attachments.count()
    if current_count + len(files) > MAX_ATTACHMENTS_PER_TEMPLATE:
        raise ValidationError({
            'attachments': f"Exceeded maximum attachments limit ({MAX_ATTACHMENTS_PER_TEMPLATE}). "
                           f"Template currently has {current_count} attachments; attempting to add {len(files)}."
        })

    current_total_size = sum(a.file_size for a in template.attachments.all())
    new_files_size = sum(f.size for f in files)
    if current_total_size + new_files_size > MAX_TOTAL_ATTACHMENTS_SIZE_BYTES:
        max_total_mb = MAX_TOTAL_ATTACHMENTS_SIZE_BYTES / (1024 * 1024)
        raise ValidationError({
            'attachments': f"Total attachment size exceeds maximum allowed of {max_total_mb:.0f} MB."
        })

    created_attachments = []
    for f in files:
        ext = os.path.splitext(f.name)[1].lower()
        if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
            allowed = ", ".join(sorted(ALLOWED_ATTACHMENT_EXTENSIONS))
            raise ValidationError({
                'attachments': f"File '{f.name}' has invalid extension '{ext}'. Allowed: {allowed}"
            })

        if f.size > MAX_FILE_SIZE_BYTES:
            max_mb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
            raise ValidationError({
                'attachments': f"File '{f.name}' ({f.size / (1024 * 1024):.1f} MB) exceeds maximum allowed size of {max_mb:.0f} MB."
            })

        attachment = TemplateAttachment.objects.create(
            template=template,
            file=f,
            original_filename=f.name,
            file_size=f.size,
            content_type=getattr(f, 'content_type', 'application/octet-stream') or 'application/octet-stream',
            uploaded_by=user
        )
        created_attachments.append(attachment)

    return created_attachments


class SendEmailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, CanAccessLead]

    def post(self, request):
        serializer = SendEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lead_id = serializer.validated_data['lead_id']
        lead = get_object_or_404(Lead, id=lead_id)

        # Check lead access permission
        self.check_object_permissions(request, lead)

        template_id = serializer.validated_data.get('template_id')
        template = None
        if template_id:
            template = get_object_or_404(
                CommunicationTemplate.objects.prefetch_related('attachments'),
                id=template_id
            )
            # Check template visibility & usage permission
            template_checker = CanViewTemplate()
            if not template_checker.has_object_permission(request, self, template):
                raise PermissionDenied("You do not have permission to access or send this template.")

        subject = serializer.validated_data.get('subject', '')
        body = serializer.validated_data.get('body', '')

        try:
            log = CommunicationService.send_email(
                lead=lead,
                subject=subject,
                body=body,
                user=request.user,
                template=template
            )
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={
                    'lead_id': lead.id,
                    'channel': 'EMAIL',
                    'status': 'SUCCESS',
                    'template_id': template.id if template else None
                }
            )
            return Response(CommunicationLogSerializer(log).data, status=status.HTTP_200_OK)
        except IntegrationBlockerException as e:
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={'lead_id': lead.id, 'channel': 'EMAIL', 'status': 'BLOCKED', 'reason': str(e)}
            )
            return Response({'error': str(e), 'blocker': True}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValidationError as e:
            error_msg = e.detail if hasattr(e, 'detail') else str(e)
            return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AdminTestEmailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request):
        serializer = TestEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        recipient = serializer.validated_data['recipient']

        user_email = getattr(settings, 'EMAIL_HOST_USER', '')
        password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')

        if not user_email or not password:
            error_msg = "Google SMTP integration blocker: EMAIL_HOST_USER and EMAIL_HOST_PASSWORD are not configured in environment."
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={'channel': 'EMAIL', 'status': 'BLOCKED', 'reason': error_msg, 'recipient': recipient}
            )
            return Response({'error': error_msg, 'blocker': True, 'delivered': False}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        subject = "[Skill Move CRM] SMTP Verification Test Email"
        body = (
            "This is an automated verification email dispatched from Skill Move Sales CRM.\n\n"
            "If you have received this message, the Google SMTP configuration has been successfully "
            "established and operationalized on the CRM backend.\n\n"
            f"Sender: {settings.DEFAULT_FROM_EMAIL}\n"
            f"Recipient: {recipient}\n"
        )

        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=False
            )
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={'channel': 'EMAIL', 'status': 'SUCCESS', 'recipient': recipient}
            )
            return Response({
                'status': 'success',
                'message': 'Test email dispatched successfully via Gmail SMTP.',
                'delivered': True,
                'recipient': recipient
            }, status=status.HTTP_200_OK)
        except Exception as e:
            error_msg = "Google SMTP delivery failed: Unable to connect or authenticate with SMTP server."
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={'channel': 'EMAIL', 'status': 'FAILED', 'reason': str(e), 'recipient': recipient}
            )
            return Response({
                'error': error_msg,
                'delivered': False,
                'details': str(e) if settings.DEBUG else None
            }, status=status.HTTP_502_BAD_GATEWAY)


class SendWhatsAppView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, CanAccessLead]

    def post(self, request):
        serializer = SendWhatsAppSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lead_id = serializer.validated_data['lead_id']
        lead = get_object_or_404(Lead, id=lead_id)

        self.check_object_permissions(request, lead)

        message = serializer.validated_data['message']

        try:
            log = CommunicationService.send_whatsapp(lead, message, request.user)
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={'lead_id': lead.id, 'channel': 'WHATSAPP', 'status': 'SUCCESS'}
            )
            return Response(CommunicationLogSerializer(log).data, status=status.HTTP_200_OK)
        except IntegrationBlockerException as e:
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={'lead_id': lead.id, 'channel': 'WHATSAPP', 'status': 'BLOCKED', 'reason': str(e)}
            )
            return Response({'error': str(e), 'blocker': True}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class InitiateCallView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, CanAccessLead]

    def post(self, request):
        serializer = InitiateCallSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lead_id = serializer.validated_data['lead_id']
        lead = get_object_or_404(Lead, id=lead_id)

        self.check_object_permissions(request, lead)

        try:
            log = CommunicationService.initiate_call(lead, request.user)
            return Response(CommunicationLogSerializer(log).data, status=status.HTTP_200_OK)
        except IntegrationBlockerException as e:
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={'lead_id': lead.id, 'channel': 'CALL', 'status': 'BLOCKED', 'reason': str(e)}
            )
            return Response({'error': str(e), 'blocker': True}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class CommunicationLogListView(generics.ListAPIView):
    serializer_class = CommunicationLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = CommunicationLog.objects.all()

        if user.is_superuser or user.role == UserRole.ADMIN:
            pass
        elif user.role == UserRole.MANAGER:
            managed_team = getattr(user, 'managed_team', None)
            team_id = managed_team.id if managed_team else user.team_id
            queryset = queryset.filter(lead__team_id=team_id)
        elif user.role == UserRole.SALES_EMPLOYEE:
            queryset = queryset.filter(lead__assigned_employee_id=user.id)
        else:
            return CommunicationLog.objects.none()

        lead_id = self.request.query_params.get('lead')
        if lead_id:
            queryset = queryset.filter(lead_id=lead_id)

        channel = self.request.query_params.get('channel')
        if channel:
            queryset = queryset.filter(channel=channel)

        return queryset.select_related('lead', 'initiated_by').order_by('-created_at')
