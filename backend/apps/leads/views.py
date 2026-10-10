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
from django.db.models import Q, Count, Sum
from django.utils import timezone
from datetime import timedelta
from .models import PipelineStage, Lead, LeadAssignmentHistory, LeadStageHistory, LeadImportBatch
from .serializers import (
    PipelineStageSerializer,
    LeadSerializer,
    LeadAssignmentHistorySerializer,
    LeadStageHistorySerializer,
    LeadChangeStageSerializer,
    LeadImportBatchSerializer
)
from apps.authentication.permissions import LeadPermission, IsAdminRole, IsAdminOrManagerRole
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.audit.models import AuditEvent
from apps.communications.models import CommunicationLog
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

        # Authorization scoping:
        # Admin: All leads
        # Manager: Only leads belonging to manager's authorized team
        # Sales Employee: Only leads assigned to this employee
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
                    'external_reference_id': comm.external_reference_id
                }
            })

        # 5. Audit events for this lead (exclude duplicates already captured above)
        audits = AuditEvent.objects.filter(
            Q(details__lead_id=lead.id) | Q(details__lead_id=str(lead.id))
        ).exclude(
            event_type__in=['LEAD_STAGE_CHANGED', 'LEAD_ASSIGNED', 'LEAD_REASSIGNED', 'LEAD_CREATED']
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

            return Response(LeadSerializer(lead, context={'request': request}).data, status=status.HTTP_200_OK)


class DashboardStatsView(APIView):
    """
    Role-scoped dashboard analytics aggregation.
    - Admin: organization-wide KPIs, full pipeline distribution, team performance overview, recent activity.
    - Manager: team-scoped KPIs, team pipeline distribution, team member performance matrix, follow-up monitoring, team activity.
    - Counsellor: personal KPIs, personal pipeline distribution, today's & overdue follow-ups, personal activity.
    Strictly enforces role-based access; never leaks data across scopes.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        period_days = request.query_params.get('days')
        try:
            days_int = int(period_days) if period_days else 30
        except ValueError:
            days_int = 30
        period_start = now - timedelta(days=days_int)

        # 1. Base Queryset by Role
        if user.is_superuser or user.role == UserRole.ADMIN:
            role = 'ADMIN'
            base_qs = Lead.objects.filter(archived_at__isnull=True)
            team_id = None
        elif user.role == UserRole.MANAGER:
            role = 'MANAGER'
            managed_team = getattr(user, 'managed_team', None)
            team_id = managed_team.id if managed_team else user.team_id
            base_qs = Lead.objects.filter(team_id=team_id, archived_at__isnull=True)
        elif user.role == UserRole.SALES_EMPLOYEE:
            role = 'SALES_EMPLOYEE'
            base_qs = Lead.objects.filter(assigned_employee_id=user.id, archived_at__isnull=True)
            team_id = user.team_id
        else:
            return Response({"error": "Unauthorized role"}, status=status.HTTP_403_FORBIDDEN)

        # Aggregated KPI Calculations
        total_leads = base_qs.count()
        active_leads = base_qs.exclude(status__iexact='Lost').exclude(stage__name__icontains='lost').count()
        created_in_period = base_qs.filter(created_at__gte=period_start).count()
        enrolled_leads = base_qs.filter(
            Q(stage__name__icontains='enrolled') | Q(status__iexact='enrolled') | Q(stage__order=10)
        ).count()
        lost_leads = base_qs.filter(
            Q(stage__name__icontains='lost') | Q(status__iexact='lost') | Q(stage__order=12)
        ).count()

        rev_aggregates = base_qs.aggregate(
            total_rev=Sum('estimated_revenue'),
            total_fees=Sum('placement_fee')
        )
        total_estimated_revenue = float(rev_aggregates['total_rev'] or 0)
        total_placement_fees = float(rev_aggregates['total_fees'] or 0)

        # Unassigned leads count
        if role == 'ADMIN':
            unassigned_count = Lead.objects.filter(assigned_employee__isnull=True, archived_at__isnull=True).count()
            assigned_count = Lead.objects.filter(assigned_employee__isnull=False, archived_at__isnull=True).count()
        elif role == 'MANAGER':
            unassigned_count = Lead.objects.filter(team_id=team_id, assigned_employee__isnull=True, archived_at__isnull=True).count()
            assigned_count = base_qs.filter(assigned_employee__isnull=False).count()
        else:
            unassigned_count = 0
            assigned_count = total_leads

        pending_followups = base_qs.filter(next_follow_up__isnull=False).count()
        followups_today = base_qs.filter(next_follow_up__gte=today_start, next_follow_up__lt=today_end).count()
        followups_overdue = base_qs.filter(next_follow_up__lt=now).count()

        kpis = {
            'total_leads': total_leads,
            'active_leads': active_leads,
            'created_in_period': created_in_period,
            'enrolled_leads': enrolled_leads,
            'lost_leads': lost_leads,
            'unassigned_leads': unassigned_count,
            'assigned_leads': assigned_count,
            'total_estimated_revenue': total_estimated_revenue,
            'total_placement_fees': total_placement_fees,
            'pending_followups': pending_followups,
            'followups_today': followups_today,
            'followups_overdue': followups_overdue,
        }

        # 2. Pipeline Stages Distribution
        stages = PipelineStage.objects.filter(is_active=True).order_by('order', 'id')
        stage_counts_qs = base_qs.values('stage_id').annotate(count=Count('id'))
        stage_counts_map = {item['stage_id']: item['count'] for item in stage_counts_qs}

        pipeline_overview = []
        for st in stages:
            count = stage_counts_map.get(st.id, 0)
            pct = round((count / total_leads * 100), 1) if total_leads > 0 else 0
            pipeline_overview.append({
                'id': st.id,
                'name': st.name,
                'order': st.order,
                'count': count,
                'percentage': pct,
            })

        # 3. Team Overview (Admin) & Member Performance (Manager/Admin)
        team_overview = []
        member_performance = []

        if role == 'ADMIN':
            teams = Team.objects.all().prefetch_related('members').select_related('manager')
            for t in teams:
                t_leads = Lead.objects.filter(team=t, archived_at__isnull=True)
                t_enrolled = t_leads.filter(Q(stage__name__icontains='enrolled') | Q(status__iexact='enrolled') | Q(stage__order=10)).count()
                t_lost = t_leads.filter(Q(stage__name__icontains='lost') | Q(status__iexact='lost') | Q(stage__order=12)).count()
                t_followups = t_leads.filter(next_follow_up__isnull=False).count()
                t_fees = float(t_leads.aggregate(Sum('placement_fee'))['placement_fee__sum'] or 0)
                t_rev = float(t_leads.aggregate(Sum('estimated_revenue'))['estimated_revenue__sum'] or 0)
                team_overview.append({
                    'id': t.id,
                    'team_id': t.id,
                    'name': t.name,
                    'team_name': t.name,
                    'manager_name': t.manager.username if t.manager else 'Unassigned',
                    'members_count': t.members.count(),
                    'total_leads': t_leads.count(),
                    'assigned_leads': t_leads.filter(assigned_employee__isnull=False).count(),
                    'unassigned_leads': t_leads.filter(assigned_employee__isnull=True).count(),
                    'enrolled_leads': t_enrolled,
                    'lost_leads': t_lost,
                    'pending_followups': t_followups,
                    'placement_fees': t_fees,
                    'total_placement_fees': t_fees,
                    'estimated_revenue': t_rev,
                    'total_estimated_revenue': t_rev,
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
                m_followups = m_leads.filter(next_follow_up__isnull=False).count()
                m_rev = float(m_leads.aggregate(Sum('estimated_revenue'))['estimated_revenue__sum'] or 0)
                m_fees = float(m_leads.aggregate(Sum('placement_fee'))['placement_fee__sum'] or 0)

                calls_count = CommunicationLog.objects.filter(initiated_by=member, channel='CALL').count()
                messages_count = CommunicationLog.objects.filter(initiated_by=member, channel__in=['WHATSAPP', 'EMAIL']).count()

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
                    'pending_followups': m_followups,
                    'completed_followups': calls_count + messages_count,
                    'pipeline_value': m_rev,
                    'placement_fees': m_fees,
                    'total_placement_fees': m_fees,
                    'recorded_calls': calls_count,
                    'recorded_messages': messages_count,
                    'conversion_rate': round((m_enrolled / m_leads.count() * 100), 1) if m_leads.count() > 0 else 0,
                })

        # 4. Follow-Up Monitoring List (Overdue & Upcoming)
        followup_leads_qs = base_qs.filter(next_follow_up__isnull=False).select_related(
            'assigned_employee', 'stage'
        ).order_by('next_follow_up')[:20]

        followup_list = []
        for lead in followup_leads_qs:
            is_overdue = bool(lead.next_follow_up and lead.next_follow_up < now)
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
            })

        # 5. Recent Activity Log (combining AuditEvent and CommunicationLog)
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

        comm_qs = CommunicationLog.objects.all().select_related('lead', 'initiated_by')
        if role == 'MANAGER':
            comm_qs = comm_qs.filter(lead__team_id=team_id)
        elif role == 'SALES_EMPLOYEE':
            comm_qs = comm_qs.filter(Q(initiated_by=user) | Q(lead__assigned_employee=user))

        for comm in comm_qs[:10]:
            recent_activity.append({
                'id': f"comm-{comm.id}",
                'type': f"COMM_{comm.channel}",
                'title': f"{comm.get_channel_display()} ({comm.status})",
                'description': f"{comm.get_channel_display()} to {comm.recipient} for {comm.lead.name or comm.lead.lead_id}",
                'actor': comm.initiated_by.username,
                'timestamp': comm.created_at.isoformat(),
            })

        recent_activity.sort(key=lambda x: x['timestamp'], reverse=True)
        recent_activity = recent_activity[:15]

        # 6. Response
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
            'current_date': now.strftime('%A, %B %d, %Y'),
            'kpis': kpis,
            'pipeline_overview': pipeline_overview,
            'team_overview': team_overview,
            'member_performance': member_performance,
            'followup_list': followup_list,
            'followup_monitoring': followup_list,
            'recent_activity': recent_activity,
        })

