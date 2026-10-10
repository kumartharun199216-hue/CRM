from rest_framework import generics, status, views, permissions
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import CommunicationTemplate, CommunicationLog
from .serializers import (
    CommunicationTemplateSerializer,
    CommunicationLogSerializer,
    SendEmailSerializer,
    SendWhatsAppSerializer,
    InitiateCallSerializer
)
from .services import CommunicationService, IntegrationBlockerException
from apps.leads.models import Lead
from apps.authentication.permissions import IsAdminOrManagerRole, CanAccessLead
from apps.authentication.models import UserRole
from apps.audit.models import AuditEvent

class CommunicationTemplateListCreateView(generics.ListCreateAPIView):
    serializer_class = CommunicationTemplateSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            # Admins and Managers can create communication templates
            return [IsAdminOrManagerRole()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        channel = self.request.query_params.get('channel')
        queryset = CommunicationTemplate.objects.all()
        if channel:
            queryset = queryset.filter(channel=channel)
        return queryset

    def perform_create(self, serializer):
        template = serializer.save(created_by=self.request.user)
        AuditEvent.objects.create(
            event_type='TEMPLATE_CREATED',
            user=self.request.user,
            details={
                'template_id': template.id,
                'name': template.name,
                'channel': template.channel
            }
        )

class CommunicationTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = CommunicationTemplate.objects.all()
    serializer_class = CommunicationTemplateSerializer
    permission_classes = [IsAdminOrManagerRole]

class SendEmailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, CanAccessLead]

    def post(self, request):
        serializer = SendEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lead_id = serializer.validated_data['lead_id']
        lead = get_object_or_404(Lead, id=lead_id)

        # Check lead access permission
        self.check_object_permissions(request, lead)

        subject = serializer.validated_data['subject']
        body = serializer.validated_data['body']

        try:
            log = CommunicationService.send_email(lead, subject, body, request.user)
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={'lead_id': lead.id, 'channel': 'EMAIL', 'status': 'SUCCESS'}
            )
            return Response(CommunicationLogSerializer(log).data, status=status.HTTP_200_OK)
        except IntegrationBlockerException as e:
            AuditEvent.objects.create(
                event_type='COMMUNICATION_ATTEMPT',
                user=request.user,
                details={'lead_id': lead.id, 'channel': 'EMAIL', 'status': 'BLOCKED', 'reason': str(e)}
            )
            return Response({'error': str(e), 'blocker': True}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
