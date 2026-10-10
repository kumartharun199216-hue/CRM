from rest_framework import generics, status, views, permissions
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from django.contrib.auth import update_session_auth_hash
from django.utils import timezone
from apps.audit.models import AuditEvent
from .models import User, UserRole, PasswordResetToken
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    UserProfileUpdateSerializer,
    UserAdminUpdateSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    AdminPasswordResetSerializer,
    UserLookupSerializer,
    generate_cryptographic_temporary_password,
)
from .permissions import IsAdminRole, IsAdminOrManagerRole, HasCompletedPasswordChange

def is_email_delivery_configured():
    from django.conf import settings
    host_user = getattr(settings, 'EMAIL_HOST_USER', '')
    host_pwd = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
    backend = getattr(settings, 'EMAIL_BACKEND', '')
    if not host_user or not host_pwd:
        return False
    if any(m in str(backend).lower() for m in ['dummy', 'locmem', 'console']):
        return False
    return True

class UserPagination(PageNumberPagination):
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

class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, _ = Token.objects.get_or_create(user=user)
        user_data = UserSerializer(user).data
        return Response({
            'token': token.key,
            'user': user_data
        }, status=status.HTTP_200_OK)

class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if hasattr(request, 'auth') and isinstance(request.auth, Token):
            request.auth.delete()
        elif request.user.is_authenticated:
            Token.objects.filter(user=request.user).delete()

        if hasattr(request, 'session'):
            request.session.flush()

        return Response({
            'detail': 'Logged out successfully.'
        }, status=status.HTTP_200_OK)

class ChangePasswordView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        new_password = serializer.validated_data['validated_new_password']
        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        # Invalidate old token and generate fresh token
        Token.objects.filter(user=user).delete()
        new_token = Token.objects.create(user=user)

        # Invalidate other sessions while maintaining current session
        update_session_auth_hash(request, user)

        # Record reset in audit log without storing tokens or passwords
        AuditEvent.objects.create(
            event_type='PASSWORD_CHANGED',
            user=user,
            details={
                'user_id': user.id,
                'username': user.username,
                'action': 'self_service_change',
            }
        )

        user_data = UserSerializer(user).data
        return Response({
            'detail': 'Password changed successfully. You may now access the CRM.',
            'token': new_token.key,
            'user': user_data
        }, status=status.HTTP_200_OK)

class PasswordResetRequestView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identifier = serializer.validated_data['clean_identifier']
        user = (
            User.objects.filter(email__iexact=identifier).first()
            or User.objects.filter(username__iexact=identifier).first()
        )

        email_configured = is_email_delivery_configured()
        email_sent = False

        if user and user.is_active:
            # Generate single-use, time-limited token (15 mins)
            raw_token, record = PasswordResetToken.create_token_for_user(user=user, validity_minutes=15)

            if email_configured:
                try:
                    from django.core.mail import send_mail
                    from django.conf import settings
                    reset_link = f"/?view=reset-password&token={raw_token}"
                    send_mail(
                        subject="Skill Move Sales CRM — Password Reset Request",
                        message=f"Hello {user.full_name},\n\nA password reset request was initiated for your CRM account.\nReset link: {reset_link}\nThis link expires in 15 minutes and can be used once.\n\nIf you did not request this, please notify your administrator immediately.",
                        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@skillmove.in'),
                        recipient_list=[user.email],
                        fail_silently=False
                    )
                    email_sent = True
                except Exception:
                    email_sent = False

            # Record reset initiation in audit log without storing tokens or passwords
            AuditEvent.objects.create(
                event_type='PASSWORD_RESET_INITIATED',
                user=user,
                details={
                    'user_id': user.id,
                    'username': user.username,
                    'initiated_by': 'self_service',
                    'email_delivery': 'SENT' if email_sent else 'UNAVAILABLE',
                }
            )

            if not email_configured or not email_sent:
                return Response({
                    'detail': 'Password reset token generated. Email delivery service is unavailable (SMTP not configured).',
                    'email_delivery': 'UNAVAILABLE',
                    'email_sent': False,
                    'reset_token': raw_token,
                    'reset_url': f"/?view=reset-password&token={raw_token}",
                    'expires_in_minutes': 15,
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'detail': f'A password reset link has been dispatched to {user.email}.',
                    'email_delivery': 'SENT',
                    'email_sent': True,
                    'expires_in_minutes': 15,
                }, status=status.HTTP_200_OK)

        return Response({
            'detail': 'If an account exists with the provided information, a password reset procedure has been initiated.',
            'email_delivery': 'UNAVAILABLE' if not email_configured else 'PENDING',
            'email_sent': False,
        }, status=status.HTTP_200_OK)

class PasswordResetConfirmView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        record = serializer.validated_data['token_record']
        user = record.user
        new_password = serializer.validated_data['validated_new_password']

        # Update password and clear temp password flag
        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        # Mark token as used immediately
        record.is_used = True
        record.used_at = timezone.now()
        record.save(update_fields=['is_used', 'used_at'])

        # Invalidate all relevant existing sessions/tokens
        Token.objects.filter(user=user).delete()
        new_token = Token.objects.create(user=user)

        # Record completion in audit log without storing tokens or passwords
        AuditEvent.objects.create(
            event_type='PASSWORD_RESET_COMPLETED',
            user=user,
            details={
                'user_id': user.id,
                'username': user.username,
                'action': 'token_reset_completed',
            }
        )

        return Response({
            'detail': 'Password has been successfully reset. You may now access the CRM.',
            'token': new_token.key,
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)

class AdminPasswordResetView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def post(self, request, user_id):
        from django.shortcuts import get_object_or_404

        target_user = get_object_or_404(User, id=user_id)

        # Enforce Manager permissions:
        # - Manager may initiate resets only for employees within their authorized team.
        # - Neither role may retrieve an existing password.
        if request.user.role == UserRole.MANAGER:
            # Check if target is a sales employee in manager's team
            is_member = (
                target_user.team_id == request.user.team_id
                or (getattr(request.user, 'managed_team', None) and target_user.team_id == request.user.managed_team.id)
            )
            if not is_member or target_user.role != UserRole.SALES_EMPLOYEE:
                return Response({
                    'detail': 'Managers may initiate resets only for employees within their authorized team.'
                }, status=status.HTTP_403_FORBIDDEN)

        # Generate unique temporary password and single-use reset token
        temp_password = generate_cryptographic_temporary_password(12)
        target_user.set_password(temp_password)
        target_user.must_change_password = True
        target_user.save()

        # Invalidate existing sessions and auth tokens for the target user
        Token.objects.filter(user=target_user).delete()

        # Create single-use time-limited reset token
        raw_token, token_rec = PasswordResetToken.create_token_for_user(
            user=target_user,
            created_by=request.user,
            validity_minutes=60
        )

        email_configured = is_email_delivery_configured()

        # Record reset initiation in audit log without storing tokens or passwords
        AuditEvent.objects.create(
            event_type='PASSWORD_RESET_INITIATED',
            user=request.user,
            details={
                'initiated_by_user_id': request.user.id,
                'initiated_by': request.user.username,
                'target_user_id': target_user.id,
                'target_username': target_user.username,
                'email_delivery': 'UNAVAILABLE' if not email_configured else 'PENDING',
            }
        )

        return Response({
            'detail': 'Password reset credentials generated successfully.',
            'employee_name': target_user.full_name,
            'employee_id': target_user.display_employee_id,
            'email': target_user.email,
            'temporary_password': temp_password,
            'reset_token': raw_token,
            'reset_url': f"/?view=reset-password&token={raw_token}",
            'email_delivery': 'UNAVAILABLE' if not email_configured else 'SENT',
            'email_sent': False,
            'delivery_note': (
                'Email delivery service is unavailable (SMTP credentials not configured). '
                'Please convey the temporary password or reset link directly to the employee.'
                if not email_configured else 'Reset link sent to employee email.'
            )
        }, status=status.HTTP_200_OK)

class MeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(
            instance=request.user,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()
        return Response(UserSerializer(updated_user).data, status=status.HTTP_200_OK)

    def put(self, request):
        return self.patch(request)

class UserListCreateView(generics.ListCreateAPIView):
    serializer_class = UserSerializer
    pagination_class = UserPagination

    def get_permissions(self):
        return [IsAdminOrManagerRole()]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        read_serializer = UserSerializer(user)
        response_data = dict(read_serializer.data)
        temp_pwd = getattr(user, '_temporary_password', None)
        if temp_pwd:
            response_data['temporary_password'] = temp_pwd
        response_data['login_url'] = request.build_absolute_uri('/')

        # Record employee account creation in audit log without storing password secrets
        AuditEvent.objects.create(
            event_type='USER_CREATED',
            user=request.user if request.user.is_authenticated else None,
            details={
                'user_id': user.id,
                'username': user.username,
                'employee_id': user.display_employee_id,
                'role': user.role,
                'team_id': user.team_id,
                'action': 'user_created',
            }
        )

        return Response(response_data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.role == UserRole.ADMIN:
            queryset = User.objects.all().select_related('team', 'managed_team', 'team__manager')
        elif user.role == UserRole.MANAGER:
            # Manager sees themselves and employees in their authorized team
            managed_team = getattr(user, 'managed_team', None)
            team_id = managed_team.id if managed_team else user.team_id
            queryset = User.objects.filter(Q(team_id=team_id) | Q(id=user.id)).select_related('team', 'managed_team', 'team__manager')
        else:
            # Sales Employee / Counsellor is denied by IsAdminOrManagerRole; fallback to empty
            queryset = User.objects.none()

        # Handle Account Status filtering
        status_param = self.request.query_params.get('status')
        is_active_param = self.request.query_params.get('is_active')
        is_paginated_call = 'page' in self.request.query_params or 'page_size' in self.request.query_params or self.request.query_params.get('paginate') == 'true'

        if status_param:
            st = status_param.strip().lower()
            if st == 'active':
                queryset = queryset.filter(is_active=True)
            elif st == 'inactive':
                queryset = queryset.filter(is_active=False)
            # if 'all', do not filter by is_active
        elif is_active_param is not None:
            if is_active_param.lower() in ['true', '1']:
                queryset = queryset.filter(is_active=True)
            elif is_active_param.lower() in ['false', '0']:
                queryset = queryset.filter(is_active=False)
        else:
            # Default behavior:
            # If not a paginated user management call, default to active users (preserves dropdowns)
            # If it is a paginated call, show all users by default unless filtered
            if not is_paginated_call:
                queryset = queryset.filter(is_active=True)

        # Role filter
        role = self.request.query_params.get('role')
        if role and role.upper() != 'ALL':
            queryset = queryset.filter(role=role)

        # Team filter
        team_id = self.request.query_params.get('team')
        if team_id and str(team_id).upper() != 'ALL':
            queryset = queryset.filter(team_id=team_id)

        # Search filter (name, email, mobile_number, employee_id)
        search = self.request.query_params.get('search', '').strip()
        if search:
            q_filter = (
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(mobile_number__icontains=search) |
                Q(employee_id__icontains=search)
            )
            # Support searching by EMP-XXXX or numerical ID
            if search.upper().startswith('EMP-'):
                num_part = search[4:].lstrip('0')
                if num_part.isdigit():
                    q_filter |= Q(id=int(num_part))
            elif search.isdigit():
                q_filter |= Q(id=int(search))

            queryset = queryset.filter(q_filter)

        return queryset.order_by('id')

class UserLookupView(generics.ListAPIView):
    """
    Scoped, minimal user directory lookup endpoint for dropdowns, lead forms, and filter bars.
    Exposes only basic identification and team display fields (no sensitive personal or account details).

    Scoping rules:
    - Admins: Access active users organization-wide. Supports ?team= and ?role= filtering.
    - Managers: Access active users within their authorized team (and self). Supports ?role= filtering.
    - Sales Employees: Access active users within their own assigned team (and self).
      Cannot access or discover users from other teams.
    """
    serializer_class = UserLookupSerializer
    permission_classes = [permissions.IsAuthenticated, HasCompletedPasswordChange]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return User.objects.none()

        base_qs = User.objects.filter(is_active=True).select_related('team')

        if user.is_superuser or user.role == UserRole.ADMIN:
            queryset = base_qs
            team_id = self.request.query_params.get('team')
            if team_id:
                queryset = queryset.filter(team_id=team_id)
            role_param = self.request.query_params.get('role')
            if role_param:
                queryset = queryset.filter(role=role_param)
            return queryset.order_by('first_name', 'last_name', 'username')

        elif user.role == UserRole.MANAGER:
            managed_team = getattr(user, 'managed_team', None)
            team_id = managed_team.id if managed_team else user.team_id
            queryset = base_qs.filter(Q(team_id=team_id) | Q(id=user.id))
            role_param = self.request.query_params.get('role')
            if role_param:
                queryset = queryset.filter(role=role_param)
            return queryset.order_by('first_name', 'last_name', 'username')

        elif user.role == UserRole.SALES_EMPLOYEE:
            if user.team_id:
                queryset = base_qs.filter(Q(team_id=user.team_id) | Q(id=user.id))
            else:
                queryset = base_qs.filter(id=user.id)
            role_param = self.request.query_params.get('role')
            if role_param:
                queryset = queryset.filter(role=role_param)
            return queryset.order_by('first_name', 'last_name', 'username')

        return User.objects.none()

class UserDetailUpdateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def _get_target_user(self, request, user_id):
        from rest_framework.exceptions import PermissionDenied
        from django.shortcuts import get_object_or_404
        target = get_object_or_404(User, id=user_id)
        actor = request.user

        if actor.is_superuser or actor.role == UserRole.ADMIN:
            return target

        if actor.role == UserRole.MANAGER:
            managed_team = getattr(actor, 'managed_team', None)
            manager_team_id = managed_team.id if managed_team else actor.team_id
            if target.id == actor.id:
                return target
            if target.role == UserRole.SALES_EMPLOYEE and target.team_id == manager_team_id:
                return target
            raise PermissionDenied("Managers can manage only Sales Employees within their authorized team.")

        raise PermissionDenied("You do not have permission to view or manage employee records.")

    def get(self, request, user_id):
        target = self._get_target_user(request, user_id)
        serializer = UserSerializer(target)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, user_id):
        target = self._get_target_user(request, user_id)
        serializer = UserAdminUpdateSerializer(
            instance=target,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(UserSerializer(updated).data, status=status.HTTP_200_OK)

    def put(self, request, user_id):
        return self.patch(request, user_id)

    def delete(self, request, user_id):
        """
        Business Rule: Do not permanently delete users merely to deactivate accounts.
        Preserves lead assignment and historical records.
        """
        from rest_framework.exceptions import ValidationError
        target = self._get_target_user(request, user_id)
        actor = request.user

        if target.id == actor.id:
            raise ValidationError({"detail": "Administrators and managers cannot deactivate or delete their own account."})

        if target.role == UserRole.ADMIN and target.is_active:
            if User.objects.filter(role=UserRole.ADMIN, is_active=True).count() <= 1:
                raise ValidationError({"detail": "Cannot deactivate the last active administrator account."})

        target.is_active = False
        target.save(update_fields=['is_active'])
        Token.objects.filter(user=target).delete()

        AuditEvent.objects.create(
            event_type='ACCOUNT_DEACTIVATED',
            user=actor,
            details={
                'target_user_id': target.id,
                'target_username': target.username,
                'target_employee_id': target.display_employee_id,
                'action': 'account_deactivated_via_delete',
                'sessions_invalidated': True,
            }
        )

        return Response({
            "detail": "Direct database deletion is prohibited to preserve historical records and audit logs. The account has been securely deactivated.",
            "user": UserSerializer(target).data
        }, status=status.HTTP_200_OK)

class UserActivateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def post(self, request, user_id):
        from rest_framework.exceptions import PermissionDenied
        from django.shortcuts import get_object_or_404
        target = get_object_or_404(User, id=user_id)
        actor = request.user

        if not (actor.is_superuser or actor.role == UserRole.ADMIN):
            if actor.role == UserRole.MANAGER:
                managed_team = getattr(actor, 'managed_team', None)
                manager_team_id = managed_team.id if managed_team else actor.team_id
                if target.role != UserRole.SALES_EMPLOYEE or target.team_id != manager_team_id:
                    raise PermissionDenied("Managers can activate only Sales Employees within their authorized team.")
            else:
                raise PermissionDenied("You do not have permission to activate employee accounts.")

        target.is_active = True
        target.save(update_fields=['is_active'])

        AuditEvent.objects.create(
            event_type='ACCOUNT_ACTIVATED',
            user=actor,
            details={
                'target_user_id': target.id,
                'target_username': target.username,
                'target_employee_id': target.display_employee_id,
                'action': 'account_activated',
            }
        )

        return Response({
            "detail": f"Account for {target.full_name} has been successfully activated.",
            "user": UserSerializer(target).data
        }, status=status.HTTP_200_OK)

class UserDeactivateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerRole]

    def post(self, request, user_id):
        from rest_framework.exceptions import PermissionDenied, ValidationError
        from django.shortcuts import get_object_or_404
        from apps.leads.models import Lead

        target = get_object_or_404(User, id=user_id)
        actor = request.user

        # Safety rule: Cannot deactivate self
        if target.id == actor.id:
            raise ValidationError({"detail": "Administrators and managers cannot deactivate their own account."})

        if not (actor.is_superuser or actor.role == UserRole.ADMIN):
            if actor.role == UserRole.MANAGER:
                managed_team = getattr(actor, 'managed_team', None)
                manager_team_id = managed_team.id if managed_team else actor.team_id
                if target.role != UserRole.SALES_EMPLOYEE or target.team_id != manager_team_id:
                    raise PermissionDenied("Managers can deactivate only Sales Employees within their authorized team.")
            else:
                raise PermissionDenied("You do not have permission to deactivate employee accounts.")
        else:
            # Safety rule: Cannot deactivate the last active administrator
            if target.role == UserRole.ADMIN and target.is_active:
                if User.objects.filter(role=UserRole.ADMIN, is_active=True).count() <= 1:
                    raise ValidationError({"detail": "Cannot deactivate the last active administrator account."})

        # Optional lead reassignment
        reassign_to_id = request.data.get('reassign_leads_to')
        reassigned_count = 0
        if reassign_to_id:
            reassign_to = get_object_or_404(User, id=reassign_to_id)
            if not reassign_to.is_active:
                raise ValidationError({"reassign_leads_to": "Cannot reassign leads to an inactive employee."})
            if actor.role == UserRole.MANAGER and not actor.is_superuser:
                managed_team = getattr(actor, 'managed_team', None)
                manager_team_id = managed_team.id if managed_team else actor.team_id
                if reassign_to.team_id != manager_team_id:
                    raise PermissionDenied("Managers can reassign leads only to active employees within their authorized team.")

            active_leads = Lead.objects.filter(assigned_employee=target)
            reassigned_count = active_leads.count()
            if reassigned_count > 0:
                active_leads.update(assigned_employee=reassign_to)
                AuditEvent.objects.create(
                    event_type='LEAD_REASSIGNED',
                    user=actor,
                    details={
                        'action': 'bulk_reassign_on_deactivation',
                        'from_employee_id': target.id,
                        'to_employee_id': reassign_to.id,
                        'leads_count': reassigned_count,
                    }
                )

        target.is_active = False
        target.save(update_fields=['is_active'])

        # Invalidate active auth tokens immediately
        Token.objects.filter(user=target).delete()

        AuditEvent.objects.create(
            event_type='ACCOUNT_DEACTIVATED',
            user=actor,
            details={
                'target_user_id': target.id,
                'target_username': target.username,
                'target_employee_id': target.display_employee_id,
                'action': 'account_deactivated',
                'sessions_invalidated': True,
                'leads_reassigned_count': reassigned_count,
            }
        )

        return Response({
            "detail": f"Account for {target.full_name} has been deactivated.",
            "user": UserSerializer(target).data,
            "sessions_invalidated": True,
            "leads_reassigned_count": reassigned_count
        }, status=status.HTTP_200_OK)

class UserTeamTransferPreviewView(views.APIView):
    """
    Read-only inspection endpoint to preview the impact of transferring an employee to another team.
    Restricted to Admins.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def get(self, request, user_id):
        from django.shortcuts import get_object_or_404
        from apps.leads.models import Lead
        from apps.teams.models import Team

        target = get_object_or_404(User, id=user_id)
        current_team = target.team

        # Optional new_team query param
        target_team = None
        new_team_id = request.query_params.get('new_team')
        if new_team_id:
            target_team = Team.objects.filter(id=new_team_id).first()

        assigned_leads = Lead.objects.filter(assigned_employee=target).select_related('team')
        assigned_leads_count = assigned_leads.count()

        distribution = {}
        for l in assigned_leads:
            t_name = l.team.name if l.team else "No Team"
            distribution[t_name] = distribution.get(t_name, 0) + 1

        # Eligible colleagues for reassignment within current team
        eligible_reassign = []
        if current_team:
            colleagues = User.objects.filter(
                team=current_team,
                is_active=True,
                role=UserRole.SALES_EMPLOYEE
            ).exclude(id=target.id).order_by('first_name', 'last_name')
            for c in colleagues:
                eligible_reassign.append({
                    'id': c.id,
                    'username': c.username,
                    'full_name': c.full_name,
                    'role': c.role,
                })

        return Response({
            'user': {
                'id': target.id,
                'username': target.username,
                'full_name': target.full_name,
                'role': target.role,
            },
            'current_team': {
                'id': current_team.id,
                'name': current_team.name,
            } if current_team else None,
            'target_team': {
                'id': target_team.id,
                'name': target_team.name,
            } if target_team else None,
            'assigned_leads_count': assigned_leads_count,
            'leads_team_distribution': distribution,
            'eligible_reassign_employees': eligible_reassign,
            'supported_actions': [
                {
                    'action': 'TRANSFER_LEADS_TO_NEW_TEAM',
                    'label': 'Transfer leads to new team',
                    'description': 'Moves all currently assigned leads to the new team alongside the employee.',
                },
                {
                    'action': 'REASSIGN_LEADS_WITHIN_OLD_TEAM',
                    'label': 'Keep leads in old team and reassign',
                    'description': 'Leads stay in the current team and are reassigned to an active colleague.',
                },
                {
                    'action': 'KEEP_LEADS_UNASSIGNED_IN_OLD_TEAM',
                    'label': 'Keep leads in old team as unassigned',
                    'description': 'Leads stay in the current team and move to the team unassigned intake queue.',
                },
            ] if assigned_leads_count > 0 else [],
        }, status=status.HTTP_200_OK)

class UserTeamTransferView(views.APIView):
    """
    Explicit, authorized endpoint for executing an employee team transfer.
    Restricted to Admins.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    def post(self, request, user_id):
        from django.shortcuts import get_object_or_404
        from rest_framework.exceptions import ValidationError

        target = get_object_or_404(User, id=user_id)
        new_team_id = request.data.get('new_team')
        if not new_team_id:
            raise ValidationError({'new_team': 'Target team is required.'})

        payload = {'team': new_team_id}
        if 'lead_transfer_action' in request.data:
            payload['lead_transfer_action'] = request.data.get('lead_transfer_action')
        if 'reassign_leads_to' in request.data:
            payload['reassign_leads_to'] = request.data.get('reassign_leads_to')

        serializer = UserAdminUpdateSerializer(
            instance=target,
            data=payload,
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()

        return Response({
            'detail': f"Successfully transferred employee {updated.full_name} to {updated.team.name if updated.team else 'new team'}.",
            'user': UserSerializer(updated).data,
        }, status=status.HTTP_200_OK)
