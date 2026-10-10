from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.db import transaction
from django.db.models import ProtectedError
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Team
from .serializers import TeamSerializer
from apps.authentication.permissions import IsAdminRole
from apps.authentication.models import UserRole
from apps.audit.models import AuditEvent

class TeamListCreateView(generics.ListCreateAPIView):
    serializer_class = TeamSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminRole()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.role == UserRole.ADMIN:
            queryset = Team.objects.all().select_related('manager').prefetch_related('members')
        elif user.role == UserRole.MANAGER:
            # Manager sees their authorized team (even if inactive, for historical visibility)
            managed = getattr(user, 'managed_team', None)
            if managed:
                queryset = Team.objects.filter(id=managed.id).select_related('manager').prefetch_related('members')
            elif user.team_id:
                queryset = Team.objects.filter(id=user.team_id).select_related('manager').prefetch_related('members')
            else:
                return Team.objects.none()
        else:
            # Sales employee sees their team
            if user.team_id:
                queryset = Team.objects.filter(id=user.team_id).select_related('manager').prefetch_related('members')
            else:
                return Team.objects.none()

        # Optional query param filters for active / inactive teams
        active_param = self.request.query_params.get('is_active')
        active_only = self.request.query_params.get('active_only')
        if active_param is not None:
            if active_param.lower() in ['true', '1', 'yes']:
                queryset = queryset.filter(is_active=True)
            elif active_param.lower() in ['false', '0', 'no']:
                queryset = queryset.filter(is_active=False)
        elif active_only and active_only.lower() in ['true', '1', 'yes']:
            queryset = queryset.filter(is_active=True)

        return queryset

    def perform_create(self, serializer):
        with transaction.atomic():
            team = serializer.save()
            AuditEvent.objects.create(
                event_type='TEAM_CREATED',
                user=self.request.user,
                details={
                    'team_id': team.id,
                    'team_name': team.name,
                    'description': team.description,
                    'manager_id': team.manager_id,
                    'manager_username': team.manager.username if team.manager else None,
                    'is_active': team.is_active,
                }
            )

class TeamDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TeamSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsAdminRole()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.role == UserRole.ADMIN:
            return Team.objects.all()
        elif user.role == UserRole.MANAGER:
            managed = getattr(user, 'managed_team', None)
            if managed:
                return Team.objects.filter(id=managed.id)
            return Team.objects.filter(id=user.team_id) if user.team_id else Team.objects.none()
        else:
            return Team.objects.filter(id=user.team_id) if user.team_id else Team.objects.none()

    def perform_update(self, serializer):
        instance = serializer.instance
        old_name = instance.name
        old_description = instance.description
        old_manager = instance.manager
        old_is_active = instance.is_active

        with transaction.atomic():
            updated_team = serializer.save()

            # Record manager change event
            if old_manager != updated_team.manager:
                AuditEvent.objects.create(
                    event_type='TEAM_MANAGER_CHANGED',
                    user=self.request.user,
                    details={
                        'team_id': updated_team.id,
                        'team_name': updated_team.name,
                        'old_manager_id': old_manager.id if old_manager else None,
                        'old_manager_username': old_manager.username if old_manager else None,
                        'new_manager_id': updated_team.manager.id if updated_team.manager else None,
                        'new_manager_username': updated_team.manager.username if updated_team.manager else None,
                    }
                )

            # Record deactivation / activation event
            if old_is_active != updated_team.is_active:
                if not updated_team.is_active:
                    AuditEvent.objects.create(
                        event_type='TEAM_DEACTIVATED',
                        user=self.request.user,
                        details={
                            'team_id': updated_team.id,
                            'team_name': updated_team.name,
                            'previous_active': True,
                        }
                    )
                else:
                    AuditEvent.objects.create(
                        event_type='TEAM_ACTIVATED',
                        user=self.request.user,
                        details={
                            'team_id': updated_team.id,
                            'team_name': updated_team.name,
                            'previous_active': False,
                        }
                    )

            # Record general update event with specific field diffs
            changes = {}
            if old_name != updated_team.name:
                changes['name'] = {'old': old_name, 'new': updated_team.name}
            if old_description != updated_team.description:
                changes['description'] = {'old': old_description, 'new': updated_team.description}
            if old_is_active != updated_team.is_active:
                changes['is_active'] = {'old': old_is_active, 'new': updated_team.is_active}
            if old_manager != updated_team.manager:
                changes['manager'] = {
                    'old': old_manager.username if old_manager else None,
                    'new': updated_team.manager.username if updated_team.manager else None
                }

            AuditEvent.objects.create(
                event_type='TEAM_UPDATED',
                user=self.request.user,
                details={
                    'team_id': updated_team.id,
                    'team_name': updated_team.name,
                    'changes': changes,
                }
            )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        # 1. Lead relationship validation: prevent deletion if associated leads exist
        leads_count = instance.leads.count()
        if leads_count > 0:
            AuditEvent.objects.create(
                event_type='TEAM_DELETION_ATTEMPTED',
                user=request.user,
                details={
                    'team_id': instance.id,
                    'team_name': instance.name,
                    'reason': 'Team has associated leads',
                    'leads_count': leads_count
                }
            )
            return Response(
                {
                    'detail': f"Cannot delete team '{instance.name}' because it contains {leads_count} associated lead(s). Leads must be reassigned to another team before the team can be deleted.",
                    'leads_count': leads_count,
                    'code': 'TEAM_HAS_LEADS'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Employee membership validation: prevent deletion if assigned employees exist
        members_count = instance.members.count()
        if members_count > 0:
            AuditEvent.objects.create(
                event_type='TEAM_DELETION_ATTEMPTED',
                user=request.user,
                details={
                    'team_id': instance.id,
                    'team_name': instance.name,
                    'reason': 'Team has assigned employees',
                    'members_count': members_count
                }
            )
            return Response(
                {
                    'detail': f"Cannot delete team '{instance.name}' because it has {members_count} assigned employee(s). Employees must be transferred or reassigned before the team can be deleted.",
                    'members_count': members_count,
                    'code': 'TEAM_HAS_MEMBERS'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        team_id = instance.id
        team_name = instance.name

        # 3. Transactional deletion handling ProtectedError (e.g. historical LeadAssignmentHistory)
        try:
            with transaction.atomic():
                instance.delete()
        except ProtectedError as exc:
            AuditEvent.objects.create(
                event_type='TEAM_DELETION_ATTEMPTED',
                user=request.user,
                details={
                    'team_id': team_id,
                    'team_name': team_name,
                    'reason': 'Protected foreign key references prevent deletion',
                    'error': str(exc)
                }
            )
            return Response(
                {
                    'detail': f"Cannot delete team '{team_name}' because protected records reference it.",
                    'code': 'TEAM_PROTECTED'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        except DjangoValidationError as exc:
            AuditEvent.objects.create(
                event_type='TEAM_DELETION_ATTEMPTED',
                user=request.user,
                details={
                    'team_id': team_id,
                    'team_name': team_name,
                    'reason': str(exc)
                }
            )
            return Response(
                {
                    'detail': str(exc.message if hasattr(exc, 'message') else exc),
                    'code': 'TEAM_VALIDATION_ERROR'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        AuditEvent.objects.create(
            event_type='TEAM_DELETED',
            user=request.user,
            details={
                'team_id': team_id,
                'team_name': team_name
            }
        )
        return Response(
            {'detail': f"Team '{team_name}' has been successfully deleted."},
            status=status.HTTP_204_NO_CONTENT
        )
