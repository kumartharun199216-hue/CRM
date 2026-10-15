import os
from rest_framework import generics, status, views, permissions
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from django.db.models import Q

from .models import CommunicationTemplate, TemplateAttachment, CommunicationLog, CommunicationChannel, CommunicationStatus
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
            log_data = CommunicationLogSerializer(log).data
            clean_digits = ''.join(c for c in (lead.phone or '') if c.isdigit() or c == '+')
            log_data['tel_url'] = f"tel:{clean_digits}" if clean_digits else None
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={'lead_id': lead.id, 'channel': 'CALL', 'status': 'SUCCESS', 'recipient': lead.phone}
            )
            return Response(log_data, status=status.HTTP_200_OK)
        except IntegrationBlockerException as e:
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={'lead_id': lead.id, 'channel': 'CALL', 'status': 'BLOCKED', 'reason': str(e)}
            )
            return Response({'error': str(e), 'blocker': True}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={'lead_id': lead.id, 'channel': 'CALL', 'status': 'FAILED', 'reason': str(e)}
            )
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CallyzerWebhookView(views.APIView):
    """
    Receives incoming call event webhooks from Callyzer.
    Matches phone numbers to CRM leads, records call duration,
    call recordings, and creates audit records.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        secret = getattr(settings, 'CALLYZER_WEBHOOK_SECRET', '')
        if secret:
            from django.utils.crypto import constant_time_compare
            header_secret = request.headers.get('X-Callyzer-Secret') or request.query_params.get('secret') or ''
            if not constant_time_compare(header_secret, secret):
                return Response({'error': 'Invalid webhook secret'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        if not data:
            return Response({'status': 'ignored', 'message': 'Empty payload'}, status=status.HTTP_200_OK)

        records = data if isinstance(data, list) else [data]
        processed_count = 0

        for employee_record in records:
            if not isinstance(employee_record, dict):
                continue

            emp_number = str(employee_record.get('emp_number') or '').strip()
            call_logs = employee_record.get('call_logs', [])
            if not isinstance(call_logs, list):
                continue

            matching_user = None
            if emp_number:
                from apps.authentication.models import User
                clean_emp = ''.join(c for c in emp_number if c.isdigit())
                if clean_emp:
                    search_emp = clean_emp[-10:] if len(clean_emp) >= 10 else clean_emp
                    matching_user = User.objects.filter(mobile_number__icontains=search_emp).first()

            for call_item in call_logs:
                if not isinstance(call_item, dict):
                    continue

                client_number = str(call_item.get('client_number') or '').strip()
                call_id = str(call_item.get('id') or '').strip()
                try:
                    duration = int(float(call_item.get('duration') or 0))
                except (ValueError, TypeError):
                    duration = 0
                call_type = str(call_item.get('call_type') or 'Outgoing').strip()
                recording_url = str(call_item.get('call_recording_url') or '').strip()
                note = str(call_item.get('note') or '').strip()
                call_date = str(call_item.get('call_date') or '')
                call_time = str(call_item.get('call_time') or '')

                clean_client = ''.join(c for c in client_number if c.isdigit())
                lead = None
                if clean_client:
                    search_digits = clean_client[-10:] if len(clean_client) >= 10 else clean_client
                    lead = Lead.objects.filter(phone__icontains=search_digits).first()

                call_type_lower = call_type.lower()
                if duration > 0:
                    call_status = CommunicationStatus.SUCCESS
                elif 'missed' in call_type_lower:
                    call_status = CommunicationStatus.MISSED
                elif 'rejected' in call_type_lower:
                    call_status = CommunicationStatus.REJECTED
                else:
                    call_status = CommunicationStatus.FAILED

                acting_user = matching_user
                if not acting_user and lead:
                    acting_user = getattr(lead, 'assigned_employee', None) or getattr(lead, 'created_by', None)

                existing_log = CommunicationLog.objects.filter(
                    external_reference_id=call_id
                ).first() if call_id else None

                callyzer_lead_ref = str(call_item.get('lead_id') or '').strip()
                if not existing_log and callyzer_lead_ref and lead:
                    existing_log = CommunicationLog.objects.filter(
                        lead=lead,
                        external_reference_id=callyzer_lead_ref,
                        status=CommunicationStatus.QUEUED
                    ).first()

                content_text = f"{call_type} call ({duration}s)"
                if note:
                    content_text += f": {note}"
                if call_date and call_time:
                    content_text += f" at {call_date} {call_time}"

                sync_dt = timezone.now()

                actual_call_dt = None
                if call_date:
                    try:
                        combined = f"{call_date} {call_time}".strip() if call_time else call_date
                        for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%d-%m-%Y %H:%M:%S', '%d-%m-%Y %H:%M', '%Y-%m-%d', '%d-%m-%Y'):
                            try:
                                parsed = datetime.datetime.strptime(combined, fmt)
                                actual_call_dt = timezone.make_aware(parsed, timezone.get_current_timezone()) if timezone.is_naive(parsed) else parsed
                                break
                            except ValueError:
                                continue
                    except Exception:
                        pass
                if not actual_call_dt:
                    actual_call_dt = sync_dt

                if existing_log:
                    existing_log.external_reference_id = call_id
                    existing_log.call_duration = duration
                    existing_log.call_recording_url = recording_url
                    existing_log.call_type = call_type
                    existing_log.content = content_text
                    existing_log.status = call_status
                    existing_log.synced_at = sync_dt
                    existing_log.call_datetime = actual_call_dt
                    existing_log.provider_source = 'CALLYZER'
                    if lead and not existing_log.lead:
                        existing_log.lead = lead
                    if acting_user and not existing_log.initiated_by:
                        existing_log.initiated_by = acting_user
                    existing_log.save()
                else:
                    CommunicationLog.objects.create(
                        lead=lead,
                        channel=CommunicationChannel.CALL,
                        recipient=client_number or (lead.phone if lead else 'Unknown'),
                        status=call_status,
                        content=content_text,
                        external_reference_id=call_id,
                        call_duration=duration,
                        call_recording_url=recording_url,
                        call_type=call_type,
                        initiated_by=acting_user,
                        synced_at=sync_dt,
                        call_datetime=actual_call_dt,
                        provider_source='CALLYZER'
                    )

                if acting_user:
                    AuditEvent.objects.create(
                        event_type='COMMUNICATION_ATTEMPT',
                        user=acting_user,
                        details={
                            'lead_id': lead.id if lead else None,
                            'channel': 'CALL',
                            'call_type': call_type,
                            'duration': duration,
                            'recording_url': recording_url,
                            'callyzer_id': call_id,
                            'source': 'CALLYZER_WEBHOOK'
                        }
                    )
                processed_count += 1

        return Response({'status': 'success', 'processed_logs': processed_count}, status=status.HTTP_200_OK)


class CallyzerSyncView(views.APIView):
    """
    POST /api/communications/callyzer/sync/
    Triggers incremental or historical synchronization of call history from Callyzer Sandbox/Production API.
    Available to authenticated agents and administrators.
    Supports parameters:
    - days: number of days back (e.g. 7, 30, 60, 90, 180)
    - start_date, end_date: custom date strings ('YYYY-MM-DD')
    - call_from, call_to: Unix timestamps
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            days = request.data.get('days') if isinstance(request.data, dict) else None
            start_date = request.data.get('start_date') if isinstance(request.data, dict) else None
            end_date = request.data.get('end_date') if isinstance(request.data, dict) else None
            call_from = request.data.get('call_from') if isinstance(request.data, dict) else None
            call_to = request.data.get('call_to') if isinstance(request.data, dict) else None

            res = CommunicationService.sync_callyzer_call_history(
                call_from=call_from,
                call_to=call_to,
                days=days,
                start_date=start_date,
                end_date=end_date
            )
            return Response({'status': 'success', 'result': res}, status=status.HTTP_200_OK)
        except IntegrationBlockerException as e:
            return Response({'error': str(e), 'blocker': True}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CommunicationLogListView(generics.ListAPIView):
    serializer_class = CommunicationLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = CommunicationLog.objects.all()

        from apps.authentication.models import UserRole
        if user.is_superuser or user.role == UserRole.ADMIN:
            pass
        elif user.role == UserRole.MANAGER:
            managed_team = getattr(user, 'managed_team', None)
            team_id = managed_team.id if managed_team else user.team_id
            queryset = queryset.filter(Q(lead__team_id=team_id) | Q(initiated_by__team_id=team_id))
        elif user.role == UserRole.SALES_EMPLOYEE:
            queryset = queryset.filter(Q(lead__assigned_employee_id=user.id) | Q(initiated_by=user))
        else:
            return CommunicationLog.objects.none()

        unmatched = self.request.query_params.get('unmatched')
        if unmatched and unmatched.lower() in ('true', '1'):
            queryset = queryset.filter(lead__isnull=True)
        else:
            lead_id = self.request.query_params.get('lead')
            if lead_id:
                queryset = queryset.filter(lead_id=lead_id)

        channel = self.request.query_params.get('channel')
        if channel:
            queryset = queryset.filter(channel=channel)

        employee = self.request.query_params.get('employee')
        if employee and employee != 'ALL':
            if str(employee).isdigit():
                queryset = queryset.filter(initiated_by_id=int(employee))
            else:
                queryset = queryset.filter(initiated_by__username__icontains=str(employee))

        phone = self.request.query_params.get('phone')
        if phone:
            clean_phone = ''.join(c for c in phone if c.isdigit())
            if clean_phone:
                search_digits = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone
                queryset = queryset.filter(recipient__icontains=search_digits)
            else:
                queryset = queryset.filter(recipient__icontains=phone)

        call_type = self.request.query_params.get('call_type')
        if call_type and call_type != 'ALL':
            queryset = queryset.filter(call_type__iexact=call_type)

        call_status = self.request.query_params.get('status')
        if call_status and call_status != 'ALL':
            queryset = queryset.filter(status__iexact=call_status)

        # Advanced Date Filtering (start_date / end_date against call_datetime or created_at)
        start_date = self.request.query_params.get('start_date')
        if start_date:
            queryset = queryset.filter(
                Q(call_datetime__date__gte=start_date) |
                Q(call_datetime__isnull=True, created_at__date__gte=start_date)
            )

        end_date = self.request.query_params.get('end_date')
        if end_date:
            queryset = queryset.filter(
                Q(call_datetime__date__lte=end_date) |
                Q(call_datetime__isnull=True, created_at__date__lte=end_date)
            )

        # Duration range filtering
        min_duration = self.request.query_params.get('min_duration')
        if min_duration is not None and str(min_duration).isdigit():
            queryset = queryset.filter(call_duration__gte=int(min_duration))

        max_duration = self.request.query_params.get('max_duration')
        if max_duration is not None and str(max_duration).isdigit():
            queryset = queryset.filter(call_duration__lte=int(max_duration))

        # Audio recording filter
        has_recording = self.request.query_params.get('has_recording')
        if has_recording is not None and has_recording != 'ALL':
            if has_recording.lower() in ('true', '1', 'yes'):
                queryset = queryset.exclude(call_recording_url='').exclude(call_recording_url__isnull=True)
            elif has_recording.lower() in ('false', '0', 'no'):
                queryset = queryset.filter(Q(call_recording_url='') | Q(call_recording_url__isnull=True))

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(recipient__icontains=search) |
                Q(lead__contact_name__icontains=search) |
                Q(lead__title__icontains=search) |
                Q(content__icontains=search) |
                Q(external_reference_id__icontains=search) |
                Q(initiated_by__username__icontains=search)
            )

        # Ordering / Sorting
        sort_by = self.request.query_params.get('sort_by') or self.request.query_params.get('ordering')
        if sort_by == 'oldest':
            order_cols = ['call_datetime', 'created_at']
        elif sort_by == 'duration_desc':
            order_cols = ['-call_duration', '-call_datetime', '-created_at']
        elif sort_by == 'duration_asc':
            order_cols = ['call_duration', '-call_datetime', '-created_at']
        else:
            order_cols = ['-call_datetime', '-created_at']

        return queryset.select_related('lead', 'initiated_by').order_by(*order_cols)
