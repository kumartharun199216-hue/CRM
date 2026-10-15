import os
import uuid
import logging
from django.db import transaction
from django.http import HttpResponse
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q, Count, Sum, F
from django.utils import timezone
from decimal import Decimal
import zoneinfo
from datetime import timedelta, datetime, time, timezone as dt_timezone
from django.conf import settings
from .models import (
    PipelineStage,
    Lead,
    LeadAssignmentHistory,
    LeadStageHistory,
    LeadImportBatch,
    PreCloserFinancial,
    LeadFinancialHistory
)
from .serializers import (
    PipelineStageSerializer,
    LeadSerializer,
    LeadAssignmentHistorySerializer,
    LeadStageHistorySerializer,
    LeadChangeStageSerializer,
    LeadImportBatchSerializer,
    PreCloserFinancialSerializer,
    LeadFinancialHistorySerializer,
    PreCloserFinancialUpdateSerializer,
    is_pending_closure_stage
)
from apps.authentication.permissions import LeadPermission, IsAdminRole, IsAdminOrManagerRole
from apps.authentication.models import User, UserRole


def check_lead_access(user, lead):
    """
    Role-based lead access control:
    - Admin: organization-wide access.
    - Manager: authorized team access.
    - Sales Employee: assigned leads access.
    """
    if user.is_superuser or user.role == UserRole.ADMIN:
        return True
    elif user.role == UserRole.MANAGER:
        managed_team = getattr(user, 'managed_team', None)
        team_id = managed_team.id if managed_team else user.team_id
        return (lead.team_id == team_id)
    elif user.role == UserRole.SALES_EMPLOYEE:
        return (lead.assigned_employee_id == user.id)
    return False

from apps.teams.models import Team
from apps.audit.models import AuditEvent
from apps.communications.models import CommunicationLog, CommunicationChannel, CommunicationStatus
from apps.reports.models import ReportSchedule
from apps.notifications.services import create_notification
from apps.notifications.models import NotificationType, NotificationPriority
from .import_service import (
    save_temp_import_file,
    get_temp_file_path,
    cleanup_temp_file,
    parse_source_file,
    suggest_mapping,
    validate_import_data,
    resolve_eligible_employees,
    resolve_unassigned_team,
    compute_distribution_counts,
    compute_distribution_list,
    execute_import_transaction,
    CRM_FIELDS
)

logger = logging.getLogger(__name__)


class LeadPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    page_query_param = 'page'
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        if 'page' in request.query_params or 'page_size' in request.query_params or request.query_params.get('paginate') == 'true':
            return super().paginate_queryset(queryset, request, view)
        return None

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


class PipelineStageListCreateView(generics.ListCreateAPIView):
    """
    Extensible pipeline stages.
    Stage names are NOT predefined or seeded; configured via this endpoint.
    """
    queryset = PipelineStage.objects.filter(is_active=True).order_by('order', 'id')
    serializer_class = PipelineStageSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminRole()]
        return [permissions.IsAuthenticated()]

class PipelineStageDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = PipelineStage.objects.all()
    serializer_class = PipelineStageSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsAdminRole()]
        return [permissions.IsAuthenticated()]

class LeadListCreateView(generics.ListCreateAPIView):
    serializer_class = LeadSerializer
    permission_classes = [LeadPermission]
    pagination_class = LeadPagination

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Lead.objects.none()

        if user.is_superuser or user.role == UserRole.ADMIN:
            queryset = Lead.objects.all()
        elif user.role == UserRole.MANAGER:
            managed_team = getattr(user, 'managed_team', None)
            team_id = managed_team.id if managed_team else user.team_id
            queryset = Lead.objects.filter(team_id=team_id)
        elif user.role == UserRole.SALES_EMPLOYEE:
            queryset = Lead.objects.filter(assigned_employee_id=user.id)
        else:
            queryset = Lead.objects.none()

        queryset = queryset.select_related('team', 'assigned_employee', 'stage', 'created_by')

        # Filters: 'All Leads' is a system filter when stage is omitted or 'all'
        stage_id = self.request.query_params.get('stage')
        if stage_id and stage_id.lower() != 'all':
            queryset = queryset.filter(stage_id=stage_id)

        team_id = self.request.query_params.get('team')
        if team_id and (user.is_superuser or user.role == UserRole.ADMIN):
            queryset = queryset.filter(team_id=team_id)

        assigned_employee_id = self.request.query_params.get('assigned_employee')
        if assigned_employee_id:
            queryset = queryset.filter(assigned_employee_id=assigned_employee_id)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(lead_id__icontains=search) |
                Q(name__icontains=search) |
                Q(title__icontains=search) |
                Q(contact_name__icontains=search) |
                Q(company__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(college__icontains=search) |
                Q(key_skills__icontains=search) |
                Q(target_role__icontains=search) |
                Q(city__icontains=search)
            )

        return queryset.order_by('-created_at')

class LeadDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = LeadSerializer
    permission_classes = [LeadPermission]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Lead.objects.none()

        if user.is_superuser or user.role == UserRole.ADMIN:
            return Lead.objects.all().select_related('team', 'assigned_employee', 'stage', 'created_by')
        elif user.role == UserRole.MANAGER:
            managed_team = getattr(user, 'managed_team', None)
            team_id = managed_team.id if managed_team else user.team_id
            return Lead.objects.filter(team_id=team_id).select_related('team', 'assigned_employee', 'stage', 'created_by')
        elif user.role == UserRole.SALES_EMPLOYEE:
            return Lead.objects.filter(assigned_employee_id=user.id).select_related('team', 'assigned_employee', 'stage', 'created_by')
        return Lead.objects.none()

class LeadAssignmentHistoryListView(generics.ListAPIView):
    serializer_class = LeadAssignmentHistorySerializer
    permission_classes = [LeadPermission]

    def get_queryset(self):
        lead_id = self.kwargs.get('lead_id')
        user = self.request.user
        # Verify user has access to lead
        lead = generics.get_object_or_404(Lead, id=lead_id)
        self.check_object_permissions(self.request, lead)
        return LeadAssignmentHistory.objects.filter(lead_id=lead_id).select_related(
            'from_team', 'to_team', 'from_employee', 'to_employee', 'changed_by'
        ).order_by('-timestamp')

class LeadStageHistoryListView(generics.ListAPIView):
    serializer_class = LeadStageHistorySerializer
    permission_classes = [LeadPermission]

    def get_queryset(self):
        lead_id = self.kwargs.get('lead_id')
        user = self.request.user
        lead = generics.get_object_or_404(Lead, id=lead_id)
        self.check_object_permissions(self.request, lead)
        return LeadStageHistory.objects.filter(lead_id=lead_id).select_related(
            'from_stage', 'to_stage', 'changed_by'
        ).order_by('-timestamp')

class LeadChangeStageView(APIView):
    """
    POST /api/leads/<pk>/change-stage/
    Change a lead's pipeline stage with mandatory note.
    Atomic transaction with select_for_update concurrency lock.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, *args, **kwargs):
        lead = generics.get_object_or_404(Lead, id=pk)
        user = request.user

        # Authorization scoping via check_lead_access helper
        if not check_lead_access(user, lead):
            return Response(
                {"detail": "You do not have permission to change the stage for this lead."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = LeadChangeStageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        dest_stage_id = serializer.validated_data['destination_stage_id']
        note = serializer.validated_data['note']
        expected_current_stage_id = serializer.validated_data.get('expected_current_stage_id')

        destination_stage = PipelineStage.objects.filter(id=dest_stage_id, is_active=True).first()
        if not destination_stage:
            return Response(
                {"destination_stage_id": ["Selected destination stage does not exist or is inactive."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            locked_lead = Lead.objects.select_for_update().get(id=pk)

            # Reject no-op: destination equals current stage
            if locked_lead.stage_id == destination_stage.id:
                return Response(
                    {"destination_stage_id": ["Destination stage cannot be the same as the current stage."]},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Concurrency check
            if expected_current_stage_id is not None and locked_lead.stage_id != expected_current_stage_id:
                return Response(
                    {"detail": "The lead's stage was updated by another user. Please refresh and try again."},
                    status=status.HTTP_409_CONFLICT
                )

            prev_stage = locked_lead.stage
            locked_lead.stage = destination_stage

            # Status synchronization if applicable
            dest_name_lower = destination_stage.name.lower()
            if 'enrolled' in dest_name_lower or 'won' in dest_name_lower:
                locked_lead.status = 'Enrolled'
            elif 'lost' in dest_name_lower or 'drop' in dest_name_lower:
                locked_lead.status = 'Lost'

            locked_lead.save(update_fields=['stage', 'status', 'updated_at'])

            stage_history = LeadStageHistory.objects.create(
                lead=locked_lead,
                from_stage=prev_stage,
                to_stage=destination_stage,
                changed_by=user,
                note=note
            )

            # In-app notification for stage movement
            if locked_lead.assigned_employee and locked_lead.assigned_employee != user:
                create_notification(
                    recipient=locked_lead.assigned_employee,
                    type=NotificationType.STAGE_CHANGED,
                    title=f"Stage Updated: {locked_lead.name or locked_lead.lead_id}",
                    message=f"{user.get_full_name() or user.username} moved lead {locked_lead.lead_id} to '{destination_stage.name}'.",
                    entity_type='lead',
                    entity_id=locked_lead.lead_id,
                    action_url=f"/?view=lead360&lead360={locked_lead.lead_id}",
                    priority=NotificationPriority.NORMAL,
                )

            # Atomic Pending Closure financial record creation/update & audit history
            if is_pending_closure_stage(destination_stage):
                agreed = serializer.validated_data['agreed_amount']

                paid = serializer.validated_data['amount_paid']

                fin = PreCloserFinancial.objects.select_for_update().filter(lead=locked_lead).first()
                if fin:
                    fin.agreed_amount = agreed
                    fin.amount_paid = paid
                    fin.updated_by = user
                    fin.save()
                else:
                    fin = PreCloserFinancial.objects.create(
                        lead=locked_lead,
                        agreed_amount=agreed,
                        amount_paid=paid,
                        created_by=user,
                        updated_by=user
                    )

                LeadFinancialHistory.objects.create(
                    lead=locked_lead,
                    financial_record=fin,
                    agreed_amount=fin.agreed_amount,
                    amount_paid=fin.amount_paid,
                    outstanding_balance=fin.outstanding_balance,
                    changed_by=user,
                    note=note
                )

                AuditEvent.objects.create(
                    event_type='LEAD_FINANCIAL_RECORDED',
                    user=user,
                    details={
                        'lead_id': locked_lead.id,
                        'lead_code': locked_lead.lead_id,
                        'agreed_amount': str(fin.agreed_amount),
                        'amount_paid': str(fin.amount_paid),
                        'outstanding_balance': str(fin.outstanding_balance),
                        'note': note
                    }
                )

            AuditEvent.objects.create(
                event_type='LEAD_STAGE_CHANGED',
                user=user,
                details={
                    'lead_id': locked_lead.id,
                    'lead_code': locked_lead.lead_id,
                    'from_stage_id': prev_stage.id if prev_stage else None,
                    'from_stage_name': prev_stage.name if prev_stage else None,
                    'to_stage_id': destination_stage.id,
                    'to_stage_name': destination_stage.name,
                    'note': note
                }
            )

        lead_serializer = LeadSerializer(locked_lead, context={'request': request})
        return Response({
            "detail": f"Stage successfully changed to {destination_stage.name}.",
            "lead": lead_serializer.data,
            "stage_history": LeadStageHistorySerializer(stage_history).data
        }, status=status.HTTP_200_OK)


class LeadFinancialView(APIView):
    """
    GET /api/leads/<pk>/financial/
    Returns the Pre-Closer financial record and audit history for the lead.

    PUT /api/leads/<pk>/financial/
    Updates the Pre-Closer financial record with full audit history tracking.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, *args, **kwargs):
        lead = generics.get_object_or_404(Lead, id=pk)
        if not check_lead_access(request.user, lead):
            return Response(
                {"detail": "You do not have permission to access financial information for this lead."},
                status=status.HTTP_403_FORBIDDEN
            )
        fin = getattr(lead, 'pre_closer_financial', None)
        if not fin:
            return Response(
                {"detail": "No financial record found for this lead."},
                status=status.HTTP_404_NOT_FOUND
            )
        history = lead.financial_history.all().order_by('-timestamp')
        return Response({
            "financial": PreCloserFinancialSerializer(fin).data,
            "history": LeadFinancialHistorySerializer(history, many=True).data
        }, status=status.HTTP_200_OK)

    def put(self, request, pk, *args, **kwargs):
        lead = generics.get_object_or_404(Lead, id=pk)
        if not check_lead_access(request.user, lead):
            return Response(
                {"detail": "You do not have permission to update financial information for this lead."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = PreCloserFinancialUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        from decimal import Decimal
        mode = serializer.validated_data.get('mode', 'record_payment')
        payment_amount = serializer.validated_data.get('payment_amount')
        agreed = serializer.validated_data.get('agreed_amount')
        paid = serializer.validated_data.get('amount_paid')
        note = serializer.validated_data.get('note', '')

        with transaction.atomic():
            locked_lead = Lead.objects.select_for_update().get(id=pk)
            fin = PreCloserFinancial.objects.select_for_update().filter(lead=locked_lead).first()
            if fin:
                if agreed is not None:
                    fin.agreed_amount = agreed

                if payment_amount is not None:
                    # Incremental payment installment
                    new_paid = fin.amount_paid + payment_amount
                    if new_paid > fin.agreed_amount:
                        return Response(
                            {"detail": f"Payment amount of ₹{payment_amount:,.2f} exceeds outstanding balance of ₹{fin.outstanding_balance:,.2f}."},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    fin.amount_paid = new_paid
                    if not note:
                        note = f"Payment installment of ₹{payment_amount:,.2f} recorded (Total Paid: ₹{fin.amount_paid:,.2f}, Remaining: ₹{fin.outstanding_balance:,.2f})"
                elif paid is not None:
                    if paid > fin.agreed_amount:
                        return Response(
                            {"detail": f"Amount paid (₹{paid:,.2f}) cannot exceed total agreed amount (₹{fin.agreed_amount:,.2f})."},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    fin.amount_paid = paid

                fin.updated_by = request.user
                fin.save()
            else:
                initial_agreed = agreed if agreed is not None else (payment_amount or paid or Decimal('0.00'))
                initial_paid = payment_amount if payment_amount is not None else (paid if paid is not None else Decimal('0.00'))
                if initial_agreed > 0 and initial_paid > initial_agreed:
                    return Response(
                        {"detail": "Amount paid cannot exceed total agreed amount."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                fin = PreCloserFinancial.objects.create(
                    lead=locked_lead,
                    agreed_amount=initial_agreed,
                    amount_paid=initial_paid,
                    created_by=request.user,
                    updated_by=request.user
                )

            history_entry = LeadFinancialHistory.objects.create(
                lead=locked_lead,
                financial_record=fin,
                agreed_amount=fin.agreed_amount,
                amount_paid=fin.amount_paid,
                outstanding_balance=fin.outstanding_balance,
                changed_by=request.user,
                note=note or 'Financial ledger updated'
            )

            # In-app notification for payment recorded
            if payment_amount is not None and payment_amount > 0:
                recipients = []
                if locked_lead.assigned_employee and locked_lead.assigned_employee != request.user:
                    recipients.append(locked_lead.assigned_employee)
                if locked_lead.team and getattr(locked_lead.team, 'manager', None) and locked_lead.team.manager != request.user:
                    if locked_lead.team.manager not in recipients:
                        recipients.append(locked_lead.team.manager)

                for r in recipients:
                    create_notification(
                        recipient=r,
                        type=NotificationType.PAYMENT_DUE,
                        title=f"Payment Recorded: {locked_lead.name or locked_lead.lead_id}",
                        message=f"Payment installment of ₹{payment_amount:,.2f} logged for {locked_lead.lead_id} ({locked_lead.name}). Remaining balance: ₹{fin.outstanding_balance:,.2f}.",
                        entity_type='lead',
                        entity_id=locked_lead.lead_id,
                        action_url=f"/?view=lead360&lead360={locked_lead.lead_id}",
                        priority=NotificationPriority.NORMAL,
                    )

            AuditEvent.objects.create(
                event_type='LEAD_FINANCIAL_RECORDED',
                user=request.user,
                details={
                    'lead_id': locked_lead.id,
                    'lead_code': locked_lead.lead_id,
                    'agreed_amount': str(fin.agreed_amount),
                    'amount_paid': str(fin.amount_paid),
                    'outstanding_balance': str(fin.outstanding_balance),
                    'note': note
                }
            )

        return Response({
            "detail": "Financial record successfully updated.",
            "financial": PreCloserFinancialSerializer(fin).data,
            "history_entry": LeadFinancialHistorySerializer(history_entry).data
        }, status=status.HTTP_200_OK)



class LeadTimelineView(APIView):
    """
    GET /api/leads/<lead_id>/timeline/
    Returns a unified chronological activity timeline for the lead.
    Aggregates stage transitions (with notes), assignment changes,
    communication logs, lead creation, and audit events.
    Enforces CRM role authorization scoping.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, lead_id, *args, **kwargs):
        lead = generics.get_object_or_404(Lead, id=lead_id)
        user = request.user

        # Access check
        if user.is_superuser or user.role == UserRole.ADMIN:
            authorized = True
        elif user.role == UserRole.MANAGER:
            managed_team = getattr(user, 'managed_team', None)
            team_id = managed_team.id if managed_team else user.team_id
            authorized = (lead.team_id == team_id)
        elif user.role == UserRole.SALES_EMPLOYEE:
            authorized = (lead.assigned_employee_id == user.id)
        else:
            authorized = False

        if not authorized:
            return Response(
                {"detail": "You do not have permission to view this lead's activity timeline."},
                status=status.HTTP_403_FORBIDDEN
            )

        events = []

        # 1. Lead creation
        creator_name = lead.created_by.get_full_name() or lead.created_by.username if lead.created_by else 'System'
        events.append({
            'id': f"lead-created-{lead.id}",
            'event_type': 'LEAD_CREATED',
            'title': 'Lead Created',
            'description': f"Lead {lead.lead_id} ({lead.name or lead.contact_name or 'Lead'}) registered in the system",
            'actor_name': creator_name,
            'actor_id': lead.created_by_id,
            'timestamp': lead.created_at.isoformat(),
            'timestamp_display': lead.created_at.strftime('%b %d, %Y %I:%M %p'),
            'note': '',
            'before_value': None,
            'after_value': lead.stage.name if lead.stage else None,
            'outcome': None,
            'details': {
                'lead_id': lead.lead_id,
                'email': lead.email,
                'phone': lead.phone,
                'team': lead.team.name if lead.team else None,
                'assigned_to': lead.assigned_employee.username if lead.assigned_employee else 'Unassigned',
                'initial_stage': lead.stage.name if lead.stage else None,
            }
        })

        # 2. Stage transitions
        stage_histories = LeadStageHistory.objects.filter(lead=lead).select_related(
            'from_stage', 'to_stage', 'changed_by'
        ).order_by('-timestamp')

        for sh in stage_histories:
            actor = sh.changed_by.get_full_name() or sh.changed_by.username if sh.changed_by else 'System'
            from_name = sh.from_stage.name if sh.from_stage else 'Initial'
            to_name = sh.to_stage.name if sh.to_stage else 'Unassigned'
            events.append({
                'id': f"stage-{sh.id}",
                'event_type': 'STAGE_CHANGED',
                'title': f"Stage changed to {to_name}",
                'description': f"Moved from {from_name} to {to_name}",
                'actor_name': actor,
                'actor_id': sh.changed_by_id,
                'timestamp': sh.timestamp.isoformat(),
                'timestamp_display': sh.timestamp.strftime('%b %d, %Y %I:%M %p'),
                'note': sh.note or '',
                'before_value': from_name,
                'after_value': to_name,
                'outcome': None,
                'details': {
                    'from_stage_id': sh.from_stage_id,
                    'from_stage_name': from_name,
                    'to_stage_id': sh.to_stage_id,
                    'to_stage_name': to_name,
                    'note': sh.note or ''
                }
            })

        # 3. Assignment history
        assign_histories = LeadAssignmentHistory.objects.filter(lead=lead).select_related(
            'from_employee', 'to_employee', 'from_team', 'to_team', 'changed_by'
        ).order_by('-timestamp')

        for ah in assign_histories:
            actor = ah.changed_by.get_full_name() or ah.changed_by.username if ah.changed_by else 'System'
            from_emp = ah.from_employee.get_full_name() or ah.from_employee.username if ah.from_employee else 'Unassigned'
            to_emp = ah.to_employee.get_full_name() or ah.to_employee.username if ah.to_employee else 'Unassigned'
            is_initial = (ah.from_employee is None)
            events.append({
                'id': f"assign-{ah.id}",
                'event_type': 'LEAD_ASSIGNED' if is_initial else 'LEAD_REASSIGNED',
                'title': f"Lead Assigned to {to_emp}" if is_initial else f"Lead Reassigned to {to_emp}",
                'description': f"Assigned to {to_emp} ({ah.to_team.name if ah.to_team else 'No Team'})" if is_initial else f"Transferred from {from_emp} to {to_emp}",
                'actor_name': actor,
                'actor_id': ah.changed_by_id,
                'timestamp': ah.timestamp.isoformat(),
                'timestamp_display': ah.timestamp.strftime('%b %d, %Y %I:%M %p'),
                'note': '',
                'before_value': from_emp,
                'after_value': to_emp,
                'outcome': None,
                'details': {
                    'from_employee': from_emp,
                    'to_employee': to_emp,
                    'from_team': ah.from_team.name if ah.from_team else None,
                    'to_team': ah.to_team.name if ah.to_team else None,
                }
            })

        # 4. Communications (Calls, WhatsApp, Emails)
        comm_logs = CommunicationLog.objects.filter(lead=lead).select_related('initiated_by').order_by('-created_at')
        for comm in comm_logs:
            actor = comm.initiated_by.get_full_name() or comm.initiated_by.username if comm.initiated_by else 'System'
            ch_display = comm.get_channel_display()
            events.append({
                'id': f"comm-{comm.id}",
                'event_type': f"COMMUNICATION_{comm.channel}",
                'title': f"{ch_display} Activity",
                'description': f"{ch_display} to {comm.recipient} — Status: {comm.get_status_display()}",
                'actor_name': actor,
                'actor_id': comm.initiated_by_id,
                'timestamp': comm.created_at.isoformat(),
                'timestamp_display': comm.created_at.strftime('%b %d, %Y %I:%M %p'),
                'note': comm.content or '',
                'before_value': None,
                'after_value': None,
                'outcome': comm.status,
                'details': {
                    'channel': comm.channel,
                    'recipient': comm.recipient,
                    'subject': comm.subject,
                    'content': comm.content,
                    'status': comm.status,
                    'error_message': comm.error_message,
                    'external_reference_id': comm.external_reference_id,
                    'call_duration': comm.call_duration,
                    'call_recording_url': comm.call_recording_url,
                    'call_type': comm.call_type,
                    'synced_at': comm.synced_at.isoformat() if comm.synced_at else None,
                }
            })

        # 5. Financial history (Pending Closure updates)
        fin_histories = LeadFinancialHistory.objects.filter(lead=lead).select_related('changed_by').order_by('-timestamp')

        for fh in fin_histories:
            actor = fh.changed_by.get_full_name() or fh.changed_by.username if fh.changed_by else 'System'
            events.append({
                'id': f"fin-{fh.id}",
                'event_type': 'LEAD_FINANCIAL_UPDATED',
                'title': "Financial Record Updated",
                'description': f"Agreed: ₹{fh.agreed_amount:,.2f} | Paid: ₹{fh.amount_paid:,.2f} | Outstanding: ₹{fh.outstanding_balance:,.2f}",
                'actor_name': actor,
                'actor_id': fh.changed_by_id,
                'timestamp': fh.timestamp.isoformat(),
                'timestamp_display': fh.timestamp.strftime('%b %d, %Y %I:%M %p'),
                'note': fh.note or '',
                'before_value': None,
                'after_value': f"₹{fh.agreed_amount:,.2f}",
                'outcome': None,
                'details': {
                    'agreed_amount': str(fh.agreed_amount),
                    'amount_paid': str(fh.amount_paid),
                    'outstanding_balance': str(fh.outstanding_balance),
                    'note': fh.note or ''
                }
            })

        # 6. Audit events for this lead (exclude duplicates already captured above)
        audits = AuditEvent.objects.filter(
            Q(details__lead_id=lead.id) | Q(details__lead_id=str(lead.id))
        ).exclude(
            event_type__in=['LEAD_STAGE_CHANGED', 'LEAD_ASSIGNED', 'LEAD_REASSIGNED', 'LEAD_CREATED', 'LEAD_FINANCIAL_RECORDED']
        ).select_related('user').order_by('-timestamp')


        for ae in audits:
            actor = ae.user.get_full_name() or ae.user.username if ae.user else 'System'
            events.append({
                'id': f"audit-{ae.id}",
                'event_type': ae.event_type,
                'title': ae.get_event_type_display(),
                'description': f"Audit log: {ae.get_event_type_display()}",
                'actor_name': actor,
                'actor_id': ae.user_id,
                'timestamp': ae.timestamp.isoformat(),
                'timestamp_display': ae.timestamp.strftime('%b %d, %Y %I:%M %p'),
                'note': ae.details.get('note', '') if isinstance(ae.details, dict) else '',
                'before_value': None,
                'after_value': None,
                'outcome': None,
                'details': ae.details
            })

        # 6. Archived event if soft-archived
        if lead.archived_at:
            events.append({
                'id': f"lead-archived-{lead.id}",
                'event_type': 'LEAD_ARCHIVED',
                'title': 'Lead Archived',
                'description': f"Lead {lead.lead_id} was archived",
                'actor_name': 'System',
                'actor_id': None,
                'timestamp': lead.archived_at.isoformat(),
                'timestamp_display': lead.archived_at.strftime('%b %d, %Y %I:%M %p'),
                'note': '',
                'before_value': None,
                'after_value': None,
                'outcome': None,
                'details': {}
            })

        # Sort all events chronologically newest first
        events.sort(key=lambda x: x['timestamp'], reverse=True)

        return Response({
            'lead_id': lead.id,
            'lead_code': lead.lead_id,
            'lead_name': lead.name or lead.contact_name or lead.title,
            'current_stage_id': lead.stage_id,
            'current_stage_name': lead.stage.name if lead.stage else 'Unassigned',
            'count': len(events),
            'timeline': events
        }, status=status.HTTP_200_OK)


class LeadImportPreviewView(APIView):
    """
    POST /api/leads/import/preview/
    Accepts CSV, XLSX, or XLS upload.
    Returns parsed worksheets, headers, sample rows, and suggested CRM field mappings.
    Stores temp file with a file_token for the subsequent validation/confirmation steps.
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def post(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get('file')
        file_token = request.data.get('file_token')
        sheet_name = request.data.get('sheet_name')

        if not uploaded_file and not file_token:
            return Response(
                {"detail": "No file uploaded. Please upload a CSV (.csv) or Excel (.xlsx, .xls) file."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            if uploaded_file:
                file_token, temp_path, file_name, file_ext = save_temp_import_file(uploaded_file)
            else:
                temp_path, file_ext = get_temp_file_path(file_token)
                if not temp_path or not os.path.exists(temp_path):
                    return Response(
                        {"detail": "Temporary upload session expired or file not found. Please upload again."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                file_name = os.path.basename(temp_path)

            sheets, selected_sheet, headers, rows = parse_source_file(temp_path, file_ext, sheet_name=sheet_name)
            suggested = suggest_mapping(headers)

            # Sample first 10 rows
            sample_rows = []
            for r in rows[:10]:
                sample_rows.append({headers[i]: r[i] if i < len(r) else '' for i in range(len(headers))})

            return Response({
                'file_token': file_token,
                'file_name': file_name,
                'file_type': file_ext,
                'sheets': sheets,
                'selected_sheet': selected_sheet,
                'headers': headers,
                'total_rows': len(rows),
                'sample_rows': sample_rows,
                'suggested_mapping': suggested,
                'supported_crm_fields': [
                    {'key': k, 'label': v['label'], 'required': v['required']}
                    for k, v in CRM_FIELDS.items()
                ]
            }, status=status.HTTP_200_OK)

        except ValueError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": f"Failed to parse import file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class LeadImportValidateView(APIView):
    """
    POST /api/leads/import/validate/
    Validates source data against user-specified column mapping, pipeline stage,
    and employee assignment mode.
    Displays valid/invalid counts, duplicate counts, distribution, and row-level validation errors.
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def post(self, request, *args, **kwargs):
        file_token = request.data.get('file_token')
        sheet_name = request.data.get('sheet_name')
        column_mapping = request.data.get('column_mapping', {})
        stage_id = request.data.get('stage_id')
        assignment_mode = request.data.get('assignment_mode', 'ALL_ELIGIBLE')
        assigned_employees = request.data.get('assigned_employees', [])
        team_id = request.data.get('team_id')

        # Also support direct file upload
        uploaded_file = request.FILES.get('file')
        if uploaded_file:
            try:
                file_token, temp_path, file_name, file_ext = save_temp_import_file(uploaded_file)
            except ValueError as ve:
                return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if not file_token:
                return Response({"detail": "Missing file_token."}, status=status.HTTP_400_BAD_REQUEST)
            temp_path, file_ext = get_temp_file_path(file_token)
            if not temp_path or not os.path.exists(temp_path):
                return Response({"detail": "Upload session expired. Please re-upload."}, status=status.HTTP_400_BAD_REQUEST)
            file_name = os.path.basename(temp_path)

        if not stage_id:
            return Response({"detail": "Please select a destination pipeline stage."}, status=status.HTTP_400_BAD_REQUEST)

        stage = PipelineStage.objects.filter(id=stage_id, is_active=True).first()
        if not stage:
            return Response({"detail": "Selected pipeline stage does not exist or is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            is_unassigned = (assignment_mode == 'UNASSIGNED') or bool(request.data.get('is_unassigned'))
            unassigned_team = None
            if is_unassigned:
                assignment_mode = 'UNASSIGNED'
                eligible_employees = []
                unassigned_team = resolve_unassigned_team(request.user, team_id=team_id)
            else:
                eligible_employees = resolve_eligible_employees(
                    requesting_user=request.user,
                    assignment_mode=assignment_mode,
                    selected_employee_ids=assigned_employees,
                    team_id=team_id
                )
                if not eligible_employees:
                    return Response(
                        {"detail": "Please select one or more eligible employees for distribution, or choose 'Import as Unassigned Leads'."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
        except ValueError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sheets, selected_sheet, headers, rows = parse_source_file(temp_path, file_ext, sheet_name=sheet_name)
            validation = validate_import_data(headers, rows, column_mapping, request.user)
            distribution_list = compute_distribution_list(len(validation['valid_rows']), eligible_employees, unassigned_team=unassigned_team)
            dist_counts = compute_distribution_counts(len(validation['valid_rows']), eligible_employees)

            return Response({
                'file_token': file_token,
                'file_name': file_name,
                'total_rows': validation['total_rows'],
                'valid_count': len(validation['valid_rows']),
                'invalid_count': len(validation['invalid_rows']),
                'duplicate_count': len(validation['duplicate_rows']),
                'stage': {'id': stage.id, 'name': stage.name},
                'assignment_mode': assignment_mode,
                'selected_employee_count': len(eligible_employees),
                'distribution': distribution_list,
                'distribution_summary': dist_counts,
                'missing_mandatory': validation['missing_mandatory'],
                'row_validations': validation['row_validations'][:100],
                'total_validation_rows': len(validation['row_validations'])
            }, status=status.HTTP_200_OK)

        except ValueError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"detail": f"Validation failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class LeadImportConfirmView(APIView):
    """
    POST /api/leads/import/confirm/
    Explicit confirmation step: Writes valid rows to database in an atomic transaction.
    Guarantees idempotency via batch_id.
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def post(self, request, *args, **kwargs):
        file_token = request.data.get('file_token')
        batch_id = request.data.get('batch_id')
        sheet_name = request.data.get('sheet_name')
        column_mapping = request.data.get('column_mapping', {})
        stage_id = request.data.get('stage_id')
        assignment_mode = request.data.get('assignment_mode', 'ALL_ELIGIBLE')
        assigned_employees = request.data.get('assigned_employees', [])
        team_id = request.data.get('team_id')

        if not batch_id:
            batch_id = str(uuid.uuid4())

        # Idempotency check: Reject duplicate submission with same batch_id
        if LeadImportBatch.objects.filter(batch_id=batch_id).exists():
            return Response(
                {"detail": f"Import batch '{batch_id}' has already been processed."},
                status=status.HTTP_409_CONFLICT
            )

        # File resolution
        uploaded_file = request.FILES.get('file')
        if uploaded_file:
            try:
                file_token, temp_path, file_name, file_ext = save_temp_import_file(uploaded_file)
            except ValueError as ve:
                return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if not file_token:
                return Response({"detail": "Missing file_token."}, status=status.HTTP_400_BAD_REQUEST)
            temp_path, file_ext = get_temp_file_path(file_token)
            if not temp_path or not os.path.exists(temp_path):
                return Response({"detail": "Upload session expired. Please re-upload."}, status=status.HTTP_400_BAD_REQUEST)
            file_name = os.path.basename(temp_path)

        if not stage_id:
            return Response({"detail": "Please select a destination pipeline stage."}, status=status.HTTP_400_BAD_REQUEST)

        stage = PipelineStage.objects.filter(id=stage_id, is_active=True).first()
        if not stage:
            return Response({"detail": "Selected pipeline stage does not exist or is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        is_unassigned = (assignment_mode == 'UNASSIGNED') or bool(request.data.get('is_unassigned'))
        source = request.data.get('source', '')
        default_priority = request.data.get('default_priority', 'Medium')
        batch_note = request.data.get('batch_note', '')

        try:
            if is_unassigned:
                assignment_mode = 'UNASSIGNED'
                eligible_employees = []
                resolve_unassigned_team(request.user, team_id=team_id)
            else:
                eligible_employees = resolve_eligible_employees(
                    requesting_user=request.user,
                    assignment_mode=assignment_mode,
                    selected_employee_ids=assigned_employees,
                    team_id=team_id
                )
                if not eligible_employees:
                    return Response(
                        {"detail": "Cannot import leads: please select one or more eligible active sales employees, or choose 'Import as Unassigned Leads'."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
        except ValueError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sheets, selected_sheet, headers, rows = parse_source_file(temp_path, file_ext, sheet_name=sheet_name)
            validation = validate_import_data(headers, rows, column_mapping, request.user)

            if len(validation['valid_rows']) == 0:
                return Response(
                    {
                        "detail": "No valid rows found to import. All rows contained validation errors.",
                        "rejected_count": len(validation['invalid_rows']),
                        "errors": [
                            {'row_number': inv['row_number'], 'errors': inv['errors']}
                            for inv in validation['invalid_rows'][:50]
                        ]
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            summary = execute_import_transaction(
                batch_id=batch_id,
                file_name=file_name,
                file_ext=file_ext,
                valid_records=validation['valid_rows'],
                invalid_records=validation['invalid_rows'],
                duplicate_records=validation['duplicate_rows'],
                stage_id=stage_id,
                employees=eligible_employees,
                assignment_mode=assignment_mode,
                requesting_user=request.user,
                team_id=team_id,
                source=source,
                default_priority=default_priority,
                batch_note=batch_note
            )

            # Cleanup temp file
            cleanup_temp_file(file_token)

            return Response(summary, status=status.HTTP_201_CREATED)

        except ValueError as ve:
            return Response({"detail": str(ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Database import transaction failed for batch %s: %s", batch_id, str(e))
            return Response(
                {"detail": "Import failed because the team assignment could not be resolved for one or more leads. No incomplete lead records were created. Please verify employee team assignments and retry."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LeadImportBatchListView(generics.ListAPIView):
    """
    GET /api/leads/import/batches/
    Returns list of import batches for current user's authorized scope.
    """
    serializer_class = LeadImportBatchSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.role == UserRole.ADMIN:
            return LeadImportBatch.objects.all().select_related('stage', 'imported_by')
        elif user.role == UserRole.MANAGER:
            return LeadImportBatch.objects.filter(imported_by=user).select_related('stage', 'imported_by')
        return LeadImportBatch.objects.none()


class LeadImportBatchDetailView(generics.RetrieveAPIView):
    """
    GET /api/leads/import/batches/<int:pk>/
    Returns details of an import batch including errors and distribution outcome.
    """
    serializer_class = LeadImportBatchSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.role == UserRole.ADMIN:
            return LeadImportBatch.objects.all().select_related('stage', 'imported_by')
        elif user.role == UserRole.MANAGER:
            return LeadImportBatch.objects.filter(imported_by=user).select_related('stage', 'imported_by')
        return LeadImportBatch.objects.none()


class LeadImportBatchRejectedRowsView(APIView):
    """
    GET /api/leads/import/batches/<int:pk>/rejected/
    Downloads rejected rows and errors for a specific batch as CSV with formula injection protection.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def get(self, request, pk, *args, **kwargs):
        batch = LeadImportBatch.objects.filter(pk=pk).first()
        if not batch:
            return Response({"detail": "Import batch not found."}, status=status.HTTP_404_NOT_FOUND)

        # Scoping check
        user = request.user
        if not (user.is_superuser or user.role == UserRole.ADMIN):
            if batch.imported_by_id != user.id:
                return Response({"detail": "You do not have permission to access this import batch."}, status=status.HTTP_403_FORBIDDEN)

        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Row Number', 'rejected_reason', 'validation_errors'])

        for err in (batch.errors or []):
            row_num = err.get('row_number', 'N/A')
            err_list = err.get('errors', [])
            err_str = "; ".join(err_list) if isinstance(err_list, list) else str(err_list)
            # Neutralize formula prefixes
            if err_str.startswith(('=', '+', '-', '@', '\t', '\r')):
                err_str = "'" + err_str
            writer.writerow([row_num, err_str])

        csv_data = output.getvalue()
        response = HttpResponse(csv_data, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="batch_{batch.batch_id}_rejected_rows.csv"'
        return response


class LeadImportSampleFileView(APIView):
    """
    GET /api/leads/import/sample/?format=xlsx|csv
    Generates and returns genuine downloadable lead import templates with standard headers.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def perform_content_negotiation(self, request, force=False):
        from rest_framework.renderers import BaseRenderer
        class PassthroughRenderer(BaseRenderer):
            media_type = '*/*'
            format = 'sample'
            def render(self, data, accepted_media_type=None, renderer_context=None):
                return data
        return (PassthroughRenderer(), '*/*')

    SAMPLE_HEADERS = [
        'Candidate Name',
        'Email Address',
        'Contact Number',
        'Degree / Qualification',
        'College / University',
        'Year of Passing',
        'Key Skills',
        'Target Role',
        'Experience',
        'City',
        'Priority',
        'Lead Source'
    ]

    SAMPLE_ROWS = [
        [
            'Rahul Sharma',
            'rahul.sharma@example.com',
            '+91 98765 43210',
            'B.Tech Computer Science',
            'Delhi Technological University',
            '2025',
            'Python, Django, React, SQL',
            'Full Stack Developer',
            'Fresher',
            'New Delhi',
            'High',
            'Campus Drive'
        ],
        [
            'Priya Patel',
            'priya.patel@example.com',
            '+91 98123 45678',
            'B.E Information Technology',
            'Pune Institute of Computer Technology',
            '2024',
            'Java, Spring Boot, MySQL',
            'Backend Developer',
            '1 year',
            'Pune',
            'Medium',
            'Job Portal'
        ],
        [
            'Amit Verma',
            'amit.verma@example.com',
            '+91 99887 76655',
            'MCA',
            'Bangalore University',
            '2025',
            'JavaScript, Node.js, MongoDB',
            'Frontend Developer',
            'Fresher',
            'Bangalore',
            'Normal',
            'Cold Calling / Raw Database'
        ]
    ]

    def get(self, request, *args, **kwargs):
        file_format = request.query_params.get('format', 'xlsx').lower()

        if file_format == 'csv':
            import csv
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(self.SAMPLE_HEADERS)
            for row in self.SAMPLE_ROWS:
                writer.writerow(row)
            csv_data = output.getvalue()
            response = HttpResponse(csv_data, content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = 'attachment; filename="leads_sample_template.csv"'
            return response

        # Default to XLSX
        try:
            import openpyxl
            from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
            import io

            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Leads"

            header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
            header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
            thin_border = Border(
                left=Side(style='thin', color='E2E8F0'),
                right=Side(style='thin', color='E2E8F0'),
                top=Side(style='thin', color='E2E8F0'),
                bottom=Side(style='thin', color='E2E8F0')
            )

            ws.append(self.SAMPLE_HEADERS)
            for col_num in range(1, len(self.SAMPLE_HEADERS) + 1):
                cell = ws.cell(row=1, column=col_num)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = Alignment(horizontal='center', vertical='center')
                cell.border = thin_border

            for row in self.SAMPLE_ROWS:
                ws.append(row)

            for col in ws.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = openpyxl.utils.get_column_letter(col[0].column)
                ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

            stream = io.BytesIO()
            wb.save(stream)
            stream.seek(0)
            xlsx_data = stream.getvalue()

            response = HttpResponse(
                xlsx_data,
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = 'attachment; filename="leads_sample_template.xlsx"'
            return response
        except Exception:
            import csv
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(self.SAMPLE_HEADERS)
            for row in self.SAMPLE_ROWS:
                writer.writerow(row)
            csv_data = output.getvalue()
            response = HttpResponse(csv_data, content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = 'attachment; filename="leads_sample_template.csv"'
            return response


class LeadStageCountsView(APIView):
    """
    Returns counts of active leads grouped by pipeline stage.
    Applies CRM authorization scoping:
    - Admin: all accessible leads
    - Manager: authorized team leads
    - Sales Employee: assigned leads
    Archived leads are excluded.
    Uses a single grouped database query.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        if not user or not user.is_authenticated:
            return Response({}, status=status.HTTP_401_UNAUTHORIZED)

        if user.is_superuser or user.role == UserRole.ADMIN:
            queryset = Lead.objects.all()
        elif user.role == UserRole.MANAGER:
            managed_team = getattr(user, 'managed_team', None)
            team_id = managed_team.id if managed_team else user.team_id
            queryset = Lead.objects.filter(team_id=team_id)
        elif user.role == UserRole.SALES_EMPLOYEE:
            queryset = Lead.objects.filter(assigned_employee_id=user.id)
        else:
            queryset = Lead.objects.none()

        # Exclude archived leads
        queryset = queryset.filter(archived_at__isnull=True)

        # Grouped query by stage_id
        grouped_counts = queryset.values('stage_id').annotate(count=Count('id'))

        counts_dict = {
            item['stage_id']: item['count']
            for item in grouped_counts
            if item['stage_id'] is not None
        }

        return Response(counts_dict)


class UnassignedLeadListCreateView(generics.ListCreateAPIView):
    """
    List and create unassigned leads.
    Visibility:
    - Admin: all unassigned leads across all teams.
    - Manager: unassigned leads belonging to their authorized team.
    - Sales Employee / Counsellor: 403 Forbidden.
    """
    serializer_class = LeadSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Lead.objects.none()

        if user.is_superuser or user.role == UserRole.ADMIN:
            queryset = Lead.objects.filter(assigned_employee__isnull=True)
        elif user.role == UserRole.MANAGER:
            managed_team = getattr(user, 'managed_team', None)
            team_id = managed_team.id if managed_team else user.team_id
            queryset = Lead.objects.filter(assigned_employee__isnull=True, team_id=team_id)
        else:
            return Lead.objects.none()

        # Exclude archived leads
        queryset = queryset.filter(archived_at__isnull=True).select_related('team', 'stage', 'created_by')

        # Filters
        stage_id = self.request.query_params.get('stage')
        if stage_id and stage_id.lower() != 'all':
            queryset = queryset.filter(stage_id=stage_id)

        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        team_id = self.request.query_params.get('team')
        if team_id and (user.is_superuser or user.role == UserRole.ADMIN):
            queryset = queryset.filter(team_id=team_id)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(lead_id__icontains=search) |
                Q(name__icontains=search) |
                Q(title__icontains=search) |
                Q(contact_name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(college__icontains=search) |
                Q(key_skills__icontains=search) |
                Q(target_role__icontains=search) |
                Q(city__icontains=search)
            )

        return queryset.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        # Controlled unassigned intake: team is required, assigned_employee is null
        data = request.data.copy()
        data['is_unassigned'] = True

        # If Manager, ensure team is their authorized team
        if request.user.role == UserRole.MANAGER and not request.user.is_superuser:
            managed_team = getattr(request.user, 'managed_team', None)
            authorized_team_id = managed_team.id if managed_team else request.user.team_id
            if 'team' in data and int(data['team']) != authorized_team_id:
                return Response(
                    {"error": "Managers can create leads only for their authorized team."},
                    status=status.HTTP_403_FORBIDDEN
                )
            data['team'] = authorized_team_id

        serializer = self.get_serializer(data=data, context={'request': request, 'allow_unassigned': True})
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class UnassignedLeadCountView(APIView):
    """
    Returns the count of unassigned leads accessible to the user:
    - Admin: count across all teams.
    - Manager: count for authorized team.
    - Sales Employee: 403 Forbidden.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def get(self, request, *args, **kwargs):
        user = request.user
        if user.is_superuser or user.role == UserRole.ADMIN:
            count = Lead.objects.filter(assigned_employee__isnull=True, archived_at__isnull=True).count()
        elif user.role == UserRole.MANAGER:
            managed_team = getattr(user, 'managed_team', None)
            team_id = managed_team.id if managed_team else user.team_id
            count = Lead.objects.filter(assigned_employee__isnull=True, team_id=team_id, archived_at__isnull=True).count()
        else:
            count = 0
        return Response({"count": count})


class LeadAssignView(APIView):
    """
    Assigns an unassigned lead to an eligible Sales Employee or Manager.
    Permissions:
    - Admins: Assign across teams to Sales Employees or Managers.
    - Managers: Assign within authorized team to Sales Employees or self-assign to themselves.
    - Sales Employees: 403 Forbidden.
    Concurrency:
    - Uses select_for_update() inside an atomic transaction.
    - Returns HTTP 409 Conflict if lead is already assigned.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def post(self, request, pk):
        user = request.user
        target_user_id = request.data.get('employee_id') or request.data.get('assigned_employee') or request.data.get('user_id')
        target_team_id = request.data.get('team_id') or request.data.get('team')

        if not target_user_id:
            return Response({"error": "Target employee is required."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            try:
                lead = Lead.objects.select_for_update().get(id=pk)
            except Lead.DoesNotExist:
                return Response({"error": "Lead not found."}, status=status.HTTP_404_NOT_FOUND)

            # Check if lead is still unassigned
            if lead.assigned_employee_id is not None:
                return Response(
                    {
                        "error": "This lead has already been assigned by another user.",
                        "detail": f"Lead {lead.lead_id} is already assigned to {lead.assigned_employee.username}."
                    },
                    status=status.HTTP_409_CONFLICT
                )

            is_admin = user.is_superuser or user.role == UserRole.ADMIN
            is_manager = user.role == UserRole.MANAGER

            # Managers can only assign leads belonging to their authorized team
            if is_manager and not is_admin:
                managed_team = getattr(user, 'managed_team', None)
                authorized_team_id = managed_team.id if managed_team else user.team_id
                if lead.team_id != authorized_team_id:
                    return Response(
                        {"error": "Forbidden: Managers can only assign leads belonging to their authorized team."},
                        status=status.HTTP_403_FORBIDDEN
                    )

            # Validate target user
            try:
                target_user = User.objects.get(id=target_user_id)
            except User.DoesNotExist:
                return Response({"error": "Target user does not exist."}, status=status.HTTP_400_BAD_REQUEST)

            if not target_user.is_active:
                return Response({"error": "Target user is inactive."}, status=status.HTTP_400_BAD_REQUEST)

            if target_user.role not in [UserRole.SALES_EMPLOYEE, UserRole.MANAGER]:
                return Response({"error": "Target user must have the Sales Employee or Manager role."}, status=status.HTTP_400_BAD_REQUEST)

            # Manager specific constraints:
            if is_manager and not is_admin:
                managed_team = getattr(user, 'managed_team', None)
                authorized_team_id = managed_team.id if managed_team else user.team_id

                # Target user must belong to Manager's authorized team OR be the Manager themselves
                if target_user.id != user.id:
                    if target_user.team_id != authorized_team_id:
                        return Response(
                            {"error": "Forbidden: Managers can only assign leads to employees within their authorized team."},
                            status=status.HTTP_403_FORBIDDEN
                        )
                target_team = lead.team

            else:
                # Admin: can assign to employee in current team, or change team if given
                if target_team_id:
                    try:
                        target_team = Team.objects.get(id=target_team_id)
                    except Team.DoesNotExist:
                        return Response({"error": "Target team does not exist."}, status=status.HTTP_400_BAD_REQUEST)
                elif target_user.team_id and target_user.team_id != lead.team_id:
                    target_team = target_user.team
                else:
                    target_team = lead.team

                if target_team and not target_team.is_active:
                    return Response({"error": f"Cannot assign lead to inactive team '{target_team.name}'."}, status=status.HTTP_400_BAD_REQUEST)

                if target_user.role == UserRole.SALES_EMPLOYEE and target_user.team_id != target_team.id:
                    return Response(
                        {"error": f"Assigned employee '{target_user.username}' does not belong to team '{target_team.name}'."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                elif target_user.role == UserRole.MANAGER:
                    mgr_team_id = getattr(target_user, 'managed_team_id', None) or target_user.team_id
                    if mgr_team_id != target_team.id:
                        return Response(
                            {"error": f"Manager '{target_user.username}' does not manage team '{target_team.name}'."},
                            status=status.HTTP_400_BAD_REQUEST
                        )

            # Perform assignment on existing record (no duplicate record created!)
            prev_team = lead.team
            prev_employee = lead.assigned_employee

            lead.assigned_employee = target_user
            lead.team = target_team
            if target_user.role == UserRole.SALES_EMPLOYEE and not lead.career_counsellor:
                lead.career_counsellor = target_user.get_full_name() or target_user.username

            lead.save()

            # Record assignment history
            LeadAssignmentHistory.objects.create(
                lead=lead,
                from_team=prev_team,
                to_team=target_team,
                from_employee=prev_employee,
                to_employee=target_user,
                changed_by=user
            )

            # Audit log
            AuditEvent.objects.create(
                event_type='LEAD_ASSIGNED',
                user=user,
                details={
                    'lead_id': lead.id,
                    'lead_ref': lead.lead_id,
                    'from_team_id': prev_team.id if prev_team else None,
                    'to_team_id': target_team.id,
                    'from_employee_id': None,
                    'to_employee_id': target_user.id,
                    'to_employee_name': target_user.username,
                    'is_self_assignment': bool(target_user.id == user.id)
                }
            )

            # In-app notification for lead assignment
            if target_user.id != user.id:
                create_notification(
                    recipient=target_user,
                    type=NotificationType.LEAD_ASSIGNED,
                    title=f"Lead Assigned: {lead.name or lead.lead_id}",
                    message=f"Lead {lead.lead_id} ({lead.name}) has been assigned to you by {user.get_full_name() or user.username}.",
                    entity_type='lead',
                    entity_id=lead.lead_id,
                    action_url=f"/?view=lead360&lead360={lead.lead_id}",
                    priority=NotificationPriority.HIGH,
                )

            return Response(LeadSerializer(lead, context={'request': request}).data, status=status.HTTP_200_OK)


class DashboardStatsView(APIView):
    """
    Operational Control Centre dashboard analytics aggregation.
    - Admin: organization-wide KPIs, full pipeline distribution, team performance overview,
      pending closure financials, communications activity, attention required, and system health.
    - Manager: team-scoped KPIs, team pipeline distribution, member performance matrix,
      team communications, follow-ups, and team-scoped financials.
    - Counsellor: personal KPIs, personal pipeline distribution, today's & overdue follow-ups,
      personal communications, and assigned financial records.
    Strictly enforces role-based access; never leaks data across scopes.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user

        # 1. Date & Timezone Resolution (Asia/Kolkata Business Default)
        try:
            tz = zoneinfo.ZoneInfo('Asia/Kolkata')
        except Exception:
            tz = timezone.get_current_timezone()

        now_utc = timezone.now()
        now_local = datetime.now(tz)
        today_local = now_local.date()

        today_start_local = datetime.combine(today_local, time.min, tzinfo=tz)
        today_end_local = datetime.combine(today_local, time.max, tzinfo=tz)
        today_start_utc = today_start_local.astimezone(dt_timezone.utc)
        today_end_utc = today_end_local.astimezone(dt_timezone.utc)
        next_7d_end_utc = now_utc + timedelta(days=7)

        # Parse date filter parameters
        preset = request.query_params.get('preset')
        days_param = request.query_params.get('days')
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        period_start = None
        period_end = None
        applied_preset = '30d'

        if start_date_str and end_date_str:
            applied_preset = 'custom'
            try:
                sd = datetime.strptime(start_date_str.strip(), '%Y-%m-%d').date()
                ed = datetime.strptime(end_date_str.strip(), '%Y-%m-%d').date()
                if sd > ed:
                    return Response(
                        {"error": "Start date cannot be after end date."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                period_start = datetime.combine(sd, time.min, tzinfo=tz).astimezone(dt_timezone.utc)
                period_end = datetime.combine(ed, time.max, tzinfo=tz).astimezone(dt_timezone.utc)
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Expected YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        elif preset:
            p = preset.lower().strip()
            applied_preset = p
            if p == 'today':
                period_start = today_start_utc
                period_end = today_end_utc
            elif p == 'yesterday':
                yd = today_local - timedelta(days=1)
                period_start = datetime.combine(yd, time.min, tzinfo=tz).astimezone(dt_timezone.utc)
                period_end = datetime.combine(yd, time.max, tzinfo=tz).astimezone(dt_timezone.utc)
            elif p in ('7d', 'last_7_days', 'last_7'):
                period_start = datetime.combine(today_local - timedelta(days=6), time.min, tzinfo=tz).astimezone(dt_timezone.utc)
                period_end = today_end_utc
            elif p in ('30d', 'last_30_days', 'last_30'):
                period_start = datetime.combine(today_local - timedelta(days=29), time.min, tzinfo=tz).astimezone(dt_timezone.utc)
                period_end = today_end_utc
            elif p in ('this_month', 'month'):
                first_d = today_local.replace(day=1)
                period_start = datetime.combine(first_d, time.min, tzinfo=tz).astimezone(dt_timezone.utc)
                period_end = today_end_utc
            elif p in ('last_month', 'prev_month'):
                first_this = today_local.replace(day=1)
                last_prev = first_this - timedelta(days=1)
                first_prev = last_prev.replace(day=1)
                period_start = datetime.combine(first_prev, time.min, tzinfo=tz).astimezone(dt_timezone.utc)
                period_end = datetime.combine(last_prev, time.max, tzinfo=tz).astimezone(dt_timezone.utc)
            elif p in ('90d', 'last_90_days', 'last_90'):
                period_start = datetime.combine(today_local - timedelta(days=89), time.min, tzinfo=tz).astimezone(dt_timezone.utc)
                period_end = today_end_utc
            elif p in ('all', 'all_time'):
                period_start = None
                period_end = None
            else:
                applied_preset = '30d'
                period_start = datetime.combine(today_local - timedelta(days=29), time.min, tzinfo=tz).astimezone(dt_timezone.utc)
                period_end = today_end_utc
        elif days_param:
            try:
                days_int = int(days_param)
                applied_preset = f"{days_int}d"
                period_start = datetime.combine(today_local - timedelta(days=days_int - 1), time.min, tzinfo=tz).astimezone(dt_timezone.utc)
                period_end = today_end_utc
            except ValueError:
                period_start = datetime.combine(today_local - timedelta(days=29), time.min, tzinfo=tz).astimezone(dt_timezone.utc)
                period_end = today_end_utc
        else:
            # Default preset: 30 days
            period_start = datetime.combine(today_local - timedelta(days=29), time.min, tzinfo=tz).astimezone(dt_timezone.utc)
            period_end = today_end_utc

        # 2. Base Queryset by Role Authorization
        if user.is_superuser or user.role == UserRole.ADMIN:
            role = 'ADMIN'
            base_qs = Lead.objects.filter(archived_at__isnull=True)
            team_id = None
            # Admin can filter by team_id
            team_id_param = request.query_params.get('team_id')
            if team_id_param and team_id_param != 'ALL':
                try:
                    target_tid = int(team_id_param)
                    base_qs = base_qs.filter(team_id=target_tid)
                    team_id = target_tid
                except ValueError:
                    pass
            # Admin can filter by employee_id
            emp_id_param = request.query_params.get('employee_id')
            if emp_id_param and emp_id_param != 'ALL':
                try:
                    target_eid = int(emp_id_param)
                    base_qs = base_qs.filter(assigned_employee_id=target_eid)
                except ValueError:
                    pass

        elif user.role == UserRole.MANAGER:
            role = 'MANAGER'
            managed_team = getattr(user, 'managed_team', None)
            team_id = managed_team.id if managed_team else user.team_id
            base_qs = Lead.objects.filter(team_id=team_id, archived_at__isnull=True)
            # Manager can filter only by employees in their team
            emp_id_param = request.query_params.get('employee_id')
            if emp_id_param and emp_id_param != 'ALL':
                try:
                    target_eid = int(emp_id_param)
                    # Verify target employee is in manager's team or is the manager
                    is_team_member = User.objects.filter(id=target_eid, team_id=team_id).exists() or (target_eid == user.id)
                    if is_team_member:
                        base_qs = base_qs.filter(assigned_employee_id=target_eid)
                except ValueError:
                    pass

        elif user.role == UserRole.SALES_EMPLOYEE:
            role = 'SALES_EMPLOYEE'
            base_qs = Lead.objects.filter(assigned_employee_id=user.id, archived_at__isnull=True)
            team_id = user.team_id

        else:
            return Response({"error": "Unauthorized role"}, status=status.HTTP_403_FORBIDDEN)

        # 3. Additional Filters (Stage, Source, Search)
        stage_id_param = request.query_params.get('stage_id')
        if stage_id_param and stage_id_param != 'ALL':
            if stage_id_param == 'UNASSIGNED':
                base_qs = base_qs.filter(stage__isnull=True)
            else:
                try:
                    base_qs = base_qs.filter(stage_id=int(stage_id_param))
                except ValueError:
                    pass

        source_param = request.query_params.get('source')
        if source_param and source_param != 'ALL':
            base_qs = base_qs.filter(source__iexact=source_param.strip())

        search_param = request.query_params.get('search')
        if search_param and search_param.strip():
            s = search_param.strip()
            base_qs = base_qs.filter(
                Q(name__icontains=s) |
                Q(lead_id__icontains=s) |
                Q(phone__icontains=s) |
                Q(email__icontains=s) |
                Q(assigned_employee__username__icontains=s) |
                Q(assigned_employee__first_name__icontains=s) |
                Q(assigned_employee__last_name__icontains=s)
            )

        # 4. Executive Summary KPI Calculations
        total_leads = base_qs.count()
        # Active leads: excludes Lost (for test suite and backward compatibility)
        active_leads = base_qs.exclude(status__iexact='Lost').exclude(stage__name__icontains='lost').exclude(stage__order=12).count()
        # Active pipeline leads: operational control centre definition (excludes terminal stages: Lost and Enrolled)
        active_pipeline_leads = base_qs.exclude(stage__order=12).exclude(stage__order=10).exclude(
            status__iexact='Lost'
        ).exclude(status__iexact='Enrolled').exclude(
            stage__name__icontains='lost'
        ).exclude(stage__name__icontains='enrolled').count()

        if period_start and period_end:
            created_in_period = base_qs.filter(created_at__gte=period_start, created_at__lte=period_end).count()
        else:
            created_in_period = total_leads

        enrolled_leads = base_qs.filter(
            Q(stage__name__icontains='enrolled') | Q(status__iexact='enrolled') | Q(stage__order=10)
        ).count()

        lost_leads = base_qs.filter(
            Q(stage__name__icontains='lost') | Q(status__iexact='lost') | Q(stage__order=12)
        ).count()

        pending_closure_leads = base_qs.filter(
            Q(stage__order=9) | Q(stage__name__iexact='Pending Closure')
        ).count()

        unassigned_count = base_qs.filter(assigned_employee__isnull=True).count()
        assigned_count = base_qs.filter(assigned_employee__isnull=False).count()

        # Follow-up aggregates
        pending_followups = base_qs.filter(next_follow_up__isnull=False).count()
        followups_today = base_qs.filter(next_follow_up__gte=today_start_utc, next_follow_up__lte=today_end_utc).count()
        followups_overdue = base_qs.filter(next_follow_up__isnull=False, next_follow_up__lt=now_utc).count()
        followups_next_7_days = base_qs.filter(next_follow_up__gt=now_utc, next_follow_up__lte=next_7d_end_utc).count()

        # Legacy revenue fields for backwards compatibility with tests
        rev_aggregates = base_qs.aggregate(
            total_rev=Sum('estimated_revenue'),
            total_fees=Sum('placement_fee')
        )
        total_estimated_revenue = float(rev_aggregates['total_rev'] or 0)
        total_placement_fees = float(rev_aggregates['total_fees'] or 0)

        kpis = {
            'total_leads': total_leads,
            'active_leads': active_leads,
            'active_pipeline_leads': active_pipeline_leads,
            'new_leads_in_period': created_in_period,
            'created_in_period': created_in_period,
            'enrolled_leads': enrolled_leads,
            'lost_leads': lost_leads,
            'pending_closure_leads': pending_closure_leads,
            'unassigned_leads': unassigned_count,
            'assigned_leads': assigned_count,
            'total_estimated_revenue': total_estimated_revenue,
            'total_placement_fees': total_placement_fees,
            'pending_followups': pending_followups,
            'followups_today': followups_today,
            'followups_overdue': followups_overdue,
            'followups_next_7_days': followups_next_7_days,
        }

        # 5. Pending Closure Financial Control Centre
        pc_stage = PipelineStage.objects.filter(Q(name__iexact='Pending Closure') | Q(order=9)).first()
        pc_leads = base_qs.filter(stage=pc_stage) if pc_stage else Lead.objects.none()
        pc_leads_count = pc_leads.count()

        # Query PreCloserFinancial independently to prevent Cartesian double-counting
        pc_financials = PreCloserFinancial.objects.filter(lead__in=pc_leads)
        fin_agg = pc_financials.aggregate(
            tot_agreed=Sum('agreed_amount'),
            tot_paid=Sum('amount_paid')
        )
        total_agreed_amount = float(fin_agg['tot_agreed'] or Decimal('0.00'))
        total_amount_paid = float(fin_agg['tot_paid'] or Decimal('0.00'))
        total_outstanding_balance = round(total_agreed_amount - total_amount_paid, 2)
        missing_financial_count = pc_leads.filter(pre_closer_financial__isnull=True).count()

        # Detailed table of Pending Closure leads with outstanding balances or missing records
        outstanding_leads_table = []
        for pl in pc_leads.select_related('pre_closer_financial', 'assigned_employee', 'team', 'stage')[:50]:
            has_f = hasattr(pl, 'pre_closer_financial') and pl.pre_closer_financial is not None
            agreed = float(pl.pre_closer_financial.agreed_amount) if has_f else 0.0
            paid = float(pl.pre_closer_financial.amount_paid) if has_f else 0.0
            bal = round(agreed - paid, 2)
            is_missing = not has_f
            if is_missing or bal > 0:
                outstanding_leads_table.append({
                    'lead_id': pl.id,
                    'lead_code': pl.lead_id or f"#{pl.id}",
                    'name': pl.name or pl.title or pl.contact_name or 'Unnamed Lead',
                    'phone': pl.phone or '',
                    'email': pl.email or '',
                    'assigned_employee_id': pl.assigned_employee_id,
                    'assigned_employee_name': (pl.assigned_employee.get_full_name() or pl.assigned_employee.username) if pl.assigned_employee else 'Unassigned',
                    'team_id': pl.team_id,
                    'team_name': pl.team.name if pl.team else 'Unassigned',
                    'agreed_amount': agreed,
                    'amount_paid': paid,
                    'outstanding_balance': bal,
                    'is_missing_financial': is_missing,
                    'stage_id': pl.stage_id,
                    'stage_name': pl.stage.name if pl.stage else 'Pending Closure',
                })
        outstanding_leads_table.sort(key=lambda x: (not x['is_missing_financial'], -x['outstanding_balance']))
        outstanding_leads_table = outstanding_leads_table[:25]

        pending_closure_financials = {
            'leads_count': pc_leads_count,
            'total_agreed_amount': total_agreed_amount,
            'total_amount_paid': total_amount_paid,
            'total_outstanding_balance': total_outstanding_balance,
            'missing_financial_count': missing_financial_count,
            'outstanding_leads_table': outstanding_leads_table,
            'currency': 'INR',
        }

        # 6. Pipeline Stages Distribution (12 Canonical Stages)
        stages = PipelineStage.objects.filter(is_active=True).order_by('order', 'id')
        stage_counts_qs = base_qs.values('stage_id').annotate(count=Count('id'))
        stage_counts_map = {item['stage_id']: item['count'] for item in stage_counts_qs}

        # Historical transitions into each stage during the selected period
        history_entries_map = {}
        hist_qs = LeadStageHistory.objects.filter(lead__in=base_qs)
        if period_start and period_end:
            hist_qs = hist_qs.filter(timestamp__gte=period_start, timestamp__lte=period_end)
        for item in hist_qs.values('to_stage_id').annotate(count=Count('id')):
            if item['to_stage_id']:
                history_entries_map[item['to_stage_id']] = item['count']

        pipeline_overview = []
        for st in stages:
            count = stage_counts_map.get(st.id, 0)
            pct = round((count / total_leads * 100), 1) if total_leads > 0 else 0
            entries = history_entries_map.get(st.id, 0)
            pipeline_overview.append({
                'id': st.id,
                'name': st.name,
                'order': st.order,
                'count': count,
                'percentage': pct,
                'entries_in_period': entries,
                'is_pending_closure': (st.order == 9 or st.name.lower() == 'pending closure'),
                'is_enrolled': (st.order == 10 or 'enrolled' in st.name.lower()),
            })

        # 7. Communications Activity & Status Breakdown
        comm_channel_param = request.query_params.get('channel')
        comm_qs = CommunicationLog.objects.filter(lead__in=base_qs).select_related('lead', 'initiated_by')
        if comm_channel_param and comm_channel_param.upper() in ('CALL', 'EMAIL', 'WHATSAPP'):
            comm_qs = comm_qs.filter(channel=comm_channel_param.upper())
        if period_start and period_end:
            comm_qs = comm_qs.filter(created_at__gte=period_start, created_at__lte=period_end)

        calls_qs = comm_qs.filter(channel=CommunicationChannel.CALL)
        call_attempts = calls_qs.count()
        call_blocked = calls_qs.filter(status=CommunicationStatus.BLOCKED).count()
        call_failed = calls_qs.filter(status=CommunicationStatus.FAILED).count()
        call_success = calls_qs.filter(status=CommunicationStatus.SUCCESS).count()

        email_qs = comm_qs.filter(channel=CommunicationChannel.EMAIL)
        email_attempts = email_qs.count()
        email_accepted = email_qs.filter(status=CommunicationStatus.SUCCESS).count()
        email_failed = email_qs.filter(status=CommunicationStatus.FAILED).count()
        email_blocked = email_qs.filter(status=CommunicationStatus.BLOCKED).count()

        wa_qs = comm_qs.filter(channel=CommunicationChannel.WHATSAPP)
        wa_attempts = wa_qs.count()
        wa_accepted = wa_qs.filter(status=CommunicationStatus.SUCCESS).count()
        wa_failed = wa_qs.filter(status=CommunicationStatus.FAILED).count()
        wa_blocked = wa_qs.filter(status=CommunicationStatus.BLOCKED).count()

        recent_comm_logs = []
        for c in comm_qs.order_by('-created_at')[:15]:
            recent_comm_logs.append({
                'id': c.id,
                'channel': c.channel,
                'recipient': c.recipient,
                'lead_id': c.lead_id,
                'lead_code': c.lead.lead_id if c.lead else '',
                'lead_name': c.lead.name or c.lead.contact_name if c.lead else '',
                'status': c.status,
                'error_message': c.error_message,
                'initiated_by_name': c.initiated_by.username if c.initiated_by else 'System',
                'created_at': c.created_at.isoformat(),
            })

        communications_activity = {
            'calls': {
                'attempts': call_attempts,
                'blocked': call_blocked,
                'failed': call_failed,
                'success': call_success,
            },
            'email': {
                'attempts': email_attempts,
                'accepted': email_accepted,
                'failed': email_failed,
                'blocked': email_blocked,
            },
            'whatsapp': {
                'attempts': wa_attempts,
                'accepted': wa_accepted,
                'failed': wa_failed,
                'blocked': wa_blocked,
            },
            'recent_logs': recent_comm_logs,
            'metadata': {
                'calls_note': 'Logged call attempts. Connected and outcome durations are not recorded by Callyzer mock.',
                'email_note': 'SMTP gateway accepted dispatches. Does not guarantee inbox delivery or open tracking.',
                'whatsapp_note': 'Meta Cloud API accepted dispatches. Does not guarantee message delivery or read receipts.',
            }
        }

        # 8. Follow-up & Action Queue (Today, Overdue, Next 7 Days, Stale)
        followup_leads_qs = base_qs.filter(next_follow_up__isnull=False).select_related(
            'assigned_employee', 'stage'
        ).order_by('next_follow_up')[:25]

        followup_list = []
        for lead in followup_leads_qs:
            is_overdue = bool(lead.next_follow_up and lead.next_follow_up < now_utc)
            is_today = bool(lead.next_follow_up and today_start_utc <= lead.next_follow_up <= today_end_utc)
            followup_list.append({
                'id': lead.id,
                'lead_id': lead.id,
                'lead_code': lead.lead_id or f"#{lead.id}",
                'name': lead.name or lead.title or lead.contact_name,
                'lead_name': lead.name or lead.title or lead.contact_name,
                'phone': lead.phone or '',
                'email': lead.email or '',
                'due_date': lead.next_follow_up.isoformat() if lead.next_follow_up else '',
                'stage_id': lead.stage_id,
                'stage_name': lead.stage.name if lead.stage else 'Unassigned',
                'priority': lead.priority or 'Normal',
                'assigned_employee_id': lead.assigned_employee_id,
                'assigned_employee_name': lead.assigned_employee.username if lead.assigned_employee else 'Unassigned',
                'is_overdue': is_overdue,
                'is_today': is_today,
            })

        active_no_followup_count = base_qs.exclude(stage__order=12).exclude(stage__order=10).filter(
            next_follow_up__isnull=True
        ).count()

        followup_queue = {
            'due_today': followups_today,
            'overdue': followups_overdue,
            'next_7_days': followups_next_7_days,
            'no_followup_scheduled': active_no_followup_count,
            'action_table': followup_list,
        }

        # 9. Attention Required Operational Panel
        recent_comm_lead_ids = set(
            CommunicationLog.objects.filter(
                lead__in=base_qs,
                created_at__gte=now_utc - timedelta(days=7)
            ).values_list('lead_id', flat=True)
        )
        stale_leads_count = base_qs.exclude(stage__order=12).exclude(stage__order=10).exclude(
            id__in=recent_comm_lead_ids
        ).count()

        outstanding_leads_count = pc_financials.filter(agreed_amount__gt=F('amount_paid')).count()
        failed_comms_count = comm_qs.filter(status__in=[CommunicationStatus.FAILED, CommunicationStatus.BLOCKED]).count()
        inactive_user_leads_count = base_qs.filter(assigned_employee__is_active=False).count()

        attention_required = {
            'overdue_followups': followups_overdue,
            'unassigned_leads': unassigned_count,
            'stale_leads': stale_leads_count,
            'no_next_followup': active_no_followup_count,
            'missing_financials': missing_financial_count,
            'outstanding_balances': outstanding_leads_count,
            'failed_communications': failed_comms_count,
            'inactive_user_leads': inactive_user_leads_count,
        }

        # 10. Team Overview (Admin) & Member Performance (Admin / Manager / Counsellor)
        team_overview = []
        member_performance = []

        if role == 'ADMIN':
            teams = Team.objects.all().prefetch_related('members').select_related('manager')
            for t in teams:
                t_leads = Lead.objects.filter(team=t, archived_at__isnull=True)
                t_enrolled = t_leads.filter(Q(stage__name__icontains='enrolled') | Q(status__iexact='enrolled') | Q(stage__order=10)).count()
                t_lost = t_leads.filter(Q(stage__name__icontains='lost') | Q(status__iexact='lost') | Q(stage__order=12)).count()
                t_pc = t_leads.filter(Q(stage__order=9) | Q(stage__name__iexact='Pending Closure')).count()
                t_followups = t_leads.filter(next_follow_up__isnull=False).count()
                t_overdue = t_leads.filter(next_follow_up__isnull=False, next_follow_up__lt=now_utc).count()
                t_fees = float(t_leads.aggregate(Sum('placement_fee'))['placement_fee__sum'] or 0)
                t_rev = float(t_leads.aggregate(Sum('estimated_revenue'))['estimated_revenue__sum'] or 0)

                t_fin_agg = PreCloserFinancial.objects.filter(lead__in=t_leads).aggregate(
                    tot_agreed=Sum('agreed_amount'),
                    tot_paid=Sum('amount_paid')
                )
                t_agreed = float(t_fin_agg['tot_agreed'] or Decimal('0.00'))
                t_paid = float(t_fin_agg['tot_paid'] or Decimal('0.00'))
                t_balance = round(t_agreed - t_paid, 2)

                team_overview.append({
                    'id': t.id,
                    'team_id': t.id,
                    'name': t.name,
                    'team_name': t.name,
                    'manager_name': (t.manager.get_full_name() or t.manager.username) if t.manager else 'Unassigned',
                    'members_count': t.members.count(),
                    'total_leads': t_leads.count(),
                    'assigned_leads': t_leads.filter(assigned_employee__isnull=False).count(),
                    'unassigned_leads': t_leads.filter(assigned_employee__isnull=True).count(),
                    'enrolled_leads': t_enrolled,
                    'lost_leads': t_lost,
                    'pending_closure_leads': t_pc,
                    'pending_followups': t_followups,
                    'overdue_followups': t_overdue,
                    'placement_fees': t_fees,
                    'total_placement_fees': t_fees,
                    'estimated_revenue': t_rev,
                    'total_estimated_revenue': t_rev,
                    'total_agreed_amount': t_agreed,
                    'total_outstanding_balance': t_balance,
                    'conversion_rate': round((t_enrolled / t_leads.count() * 100), 1) if t_leads.count() > 0 else 0,
                })

        if role in ['ADMIN', 'MANAGER']:
            member_qs = User.objects.filter(is_active=True)
            if role == 'MANAGER':
                member_qs = member_qs.filter(Q(team_id=team_id) | Q(id=user.id))
            else:
                member_qs = member_qs.filter(role=UserRole.SALES_EMPLOYEE)

            for member in member_qs:
                m_leads = Lead.objects.filter(assigned_employee=member, archived_at__isnull=True)
                m_enrolled = m_leads.filter(Q(stage__name__icontains='enrolled') | Q(status__iexact='enrolled') | Q(stage__order=10)).count()
                m_lost = m_leads.filter(Q(stage__name__icontains='lost') | Q(status__iexact='lost') | Q(stage__order=12)).count()
                m_pc = m_leads.filter(Q(stage__order=9) | Q(stage__name__iexact='Pending Closure')).count()
                m_followups = m_leads.filter(next_follow_up__isnull=False).count()
                m_overdue = m_leads.filter(next_follow_up__isnull=False, next_follow_up__lt=now_utc).count()
                m_rev = float(m_leads.aggregate(Sum('estimated_revenue'))['estimated_revenue__sum'] or 0)
                m_fees = float(m_leads.aggregate(Sum('placement_fee'))['placement_fee__sum'] or 0)

                calls_count = CommunicationLog.objects.filter(initiated_by=member, channel='CALL').count()
                emails_count = CommunicationLog.objects.filter(initiated_by=member, channel='EMAIL').count()
                wa_count = CommunicationLog.objects.filter(initiated_by=member, channel='WHATSAPP').count()
                messages_count = emails_count + wa_count

                m_fin_agg = PreCloserFinancial.objects.filter(lead__in=m_leads).aggregate(
                    tot_agreed=Sum('agreed_amount'),
                    tot_paid=Sum('amount_paid')
                )
                m_agreed = float(m_fin_agg['tot_agreed'] or Decimal('0.00'))
                m_paid = float(m_fin_agg['tot_paid'] or Decimal('0.00'))
                m_balance = round(m_agreed - m_paid, 2)

                member_performance.append({
                    'id': member.id,
                    'name': member.get_full_name() or member.username,
                    'username': member.username,
                    'full_name': member.get_full_name() or member.username,
                    'email': member.email,
                    'role': member.role,
                    'team_id': member.team_id,
                    'team_name': member.team.name if member.team else '',
                    'assigned_leads': m_leads.count(),
                    'enrolled_leads': m_enrolled,
                    'lost_leads': m_lost,
                    'pending_closure_leads': m_pc,
                    'pending_followups': m_followups,
                    'overdue_followups': m_overdue,
                    'completed_followups': calls_count + messages_count,
                    'pipeline_value': m_rev,
                    'placement_fees': m_fees,
                    'total_placement_fees': m_fees,
                    'recorded_calls': calls_count,
                    'recorded_messages': messages_count,
                    'emails_attempted': emails_count,
                    'whatsapp_attempted': wa_count,
                    'total_agreed_amount': m_agreed,
                    'total_outstanding_balance': m_balance,
                    'conversion_rate': round((m_enrolled / m_leads.count() * 100), 1) if m_leads.count() > 0 else 0,
                    'conversion_rate_formula': 'Enrolled Leads / Total Assigned Leads',
                })

        # 11. Recent Activity Log (combining AuditEvent and CommunicationLog)
        recent_activity = []
        audit_qs = AuditEvent.objects.all()
        if role == 'MANAGER':
            team_member_ids = list(User.objects.filter(team_id=team_id).values_list('id', flat=True)) + [user.id]
            audit_qs = audit_qs.filter(user_id__in=team_member_ids)
        elif role == 'SALES_EMPLOYEE':
            audit_qs = audit_qs.filter(user=user)

        for event in audit_qs[:15]:
            lead_ref = event.details.get('lead_ref') or event.details.get('lead_id')
            recent_activity.append({
                'id': f"audit-{event.id}",
                'type': event.event_type,
                'title': event.get_event_type_display(),
                'description': f"Event logged for {lead_ref or 'CRM entity'}",
                'actor': event.user.username if event.user else 'System',
                'timestamp': event.timestamp.isoformat(),
            })

        for comm in comm_qs[:10]:
            recent_activity.append({
                'id': f"comm-{comm.id}",
                'type': f"COMM_{comm.channel}",
                'title': f"{comm.get_channel_display()} ({comm.status})",
                'description': f"{comm.get_channel_display()} to {comm.recipient} for {comm.lead.name or comm.lead.lead_id if comm.lead else 'Lead'}",
                'actor': comm.initiated_by.username if comm.initiated_by else 'System',
                'timestamp': comm.created_at.isoformat(),
            })

        recent_activity.sort(key=lambda x: x['timestamp'], reverse=True)
        recent_activity = recent_activity[:15]

        # 12. Admin System & Integration Health (Admins only, zero secrets exposed)
        system_health = None
        if role == 'ADMIN':
            email_user = getattr(settings, 'EMAIL_HOST_USER', '')
            email_pass = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
            email_configured = bool(email_user and email_pass)

            wa_token = getattr(settings, 'WHATSAPP_API_TOKEN', '')
            wa_phone_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')
            wa_configured = bool(wa_token and wa_phone_id)

            active_schedules = ReportSchedule.objects.filter(is_active=True).count()
            latest_run = ReportSchedule.objects.filter(last_run_at__isnull=False).order_by('-last_run_at').first()

            system_health = {
                'email_smtp': {
                    'status': 'CONFIGURED' if email_configured else 'UNCONFIGURED',
                    'host': getattr(settings, 'EMAIL_HOST', 'smtp.gmail.com'),
                    'port': getattr(settings, 'EMAIL_PORT', 587),
                    'is_ready': email_configured,
                    'note': 'Google SMTP delivery provider configured' if email_configured else 'Credentials missing in environment'
                },
                'whatsapp': {
                    'status': 'CONFIGURED' if wa_configured else 'UNCONFIGURED',
                    'is_ready': wa_configured,
                    'note': 'Meta Cloud API configured' if wa_configured else 'Token / Phone ID missing in environment'
                },
                'callyzer': {
                    'status': 'CONFIGURED' if getattr(settings, 'CALLYZER_API_KEY', '') else 'UNCONFIGURED',
                    'is_ready': bool(getattr(settings, 'CALLYZER_API_KEY', '')),
                    'note': 'Callyzer Sandbox API & Device Connect active' if getattr(settings, 'CALLYZER_API_KEY', '') else 'Outbound calling API key missing'
                },
                'reports_scheduler': {
                    'active_schedules_count': active_schedules,
                    'last_run_at': latest_run.last_run_at.isoformat() if latest_run and latest_run.last_run_at else None,
                    'status': 'OPERATIONAL'
                },
                'data_integrity': {
                    'pending_closure_missing_financials': missing_financial_count,
                    'unassigned_leads': unassigned_count,
                    'inactive_user_assignments': inactive_user_leads_count,
                }
            }

        # 13. Unified API Response
        return Response({
            'role': role,
            'user': {
                'id': user.id,
                'username': user.username,
                'full_name': user.get_full_name() or user.username,
                'email': user.email,
                'role': user.role,
                'team_id': team_id,
                'team_name': getattr(user, 'managed_team_name', None) or (user.team.name if user.team else None),
            },
            'filters': {
                'preset': applied_preset,
                'start_date': start_date_str,
                'end_date': end_date_str,
                'team_id': team_id_param if (role == 'ADMIN' and 'team_id_param' in locals()) else team_id,
                'employee_id': emp_id_param if 'emp_id_param' in locals() else (user.id if role == 'SALES_EMPLOYEE' else None),
                'stage_id': stage_id_param,
                'source': source_param,
                'channel': comm_channel_param,
                'search': search_param or '',
            },
            'current_date': now_local.strftime('%A, %B %d, %Y'),
            'kpis': kpis,
            'pending_closure_financials': pending_closure_financials,
            'pipeline_overview': pipeline_overview,
            'communications_activity': communications_activity,
            'followup_queue': followup_queue,
            'attention_required': attention_required,
            'team_overview': team_overview,
            'member_performance': member_performance,
            'followup_list': followup_list,
            'followup_monitoring': followup_list,
            'recent_activity': recent_activity,
            'system_health': system_health,
        })

