import re
import secrets
import string
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.db import transaction
from .models import User, UserRole, PasswordResetToken

def generate_cryptographic_temporary_password(length=12):
    """
    Generates a cryptographically secure random temporary password containing
    uppercase, lowercase, digits, and special characters.
    """
    specials = "!@#$%&*"
    chars = string.ascii_letters + string.digits + specials
    while True:
        password = ''.join(secrets.choice(chars) for _ in range(length))
        if (any(c.islower() for c in password)
            and any(c.isupper() for c in password)
            and any(c.isdigit() for c in password)
            and any(c in specials for c in password)):
            return password

class UserSerializer(serializers.ModelSerializer):
    employee_id = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    designation = serializers.SerializerMethodField()
    team_name = serializers.SerializerMethodField()
    managed_team_id = serializers.SerializerMethodField()
    managed_team_name = serializers.SerializerMethodField()
    reporting_manager_id = serializers.SerializerMethodField()
    reporting_manager_name = serializers.SerializerMethodField()
    reporting_manager_email = serializers.SerializerMethodField()
    account_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'employee_id', 'username', 'email', 'mobile_number',
            'first_name', 'last_name', 'full_name',
            'role', 'designation', 'department', 'work_location',
            'team', 'team_name', 'managed_team_id', 'managed_team_name',
            'reporting_manager_id', 'reporting_manager_name', 'reporting_manager_email',
            'date_of_joining', 'must_change_password',
            'is_active', 'account_status',
            'date_joined', 'last_login'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']

    def get_employee_id(self, obj):
        return obj.display_employee_id

    def get_full_name(self, obj):
        return obj.full_name

    def get_designation(self, obj):
        return obj.display_designation

    def get_reporting_manager_id(self, obj):
        mgr = obj.effective_reporting_manager
        return mgr.id if mgr else None

    def get_reporting_manager_name(self, obj):
        mgr = obj.effective_reporting_manager
        if mgr:
            return mgr.full_name
        if obj.role == UserRole.ADMIN or obj.is_superuser:
            return "Executive Leadership"
        elif obj.role == UserRole.MANAGER:
            return "Head of Admissions"
        return "Unassigned"

    def get_reporting_manager_email(self, obj):
        mgr = obj.effective_reporting_manager
        return mgr.email if mgr else ""

    def get_team_name(self, obj):
        return obj.team.name if obj.team else None

    def get_managed_team_id(self, obj):
        managed = getattr(obj, 'managed_team', None)
        return managed.id if managed else None

    def get_managed_team_name(self, obj):
        managed = getattr(obj, 'managed_team', None)
        return managed.name if managed else None

    def get_account_status(self, obj):
        return "ACTIVE" if obj.is_active else "INACTIVE"

class UserLookupSerializer(serializers.ModelSerializer):
    """
    Minimal, non-sensitive serializer for employee/user lookup dropdowns and displays.
    Exposes only basic identification and team membership fields.
    """
    employee_id = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    team_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'employee_id', 'username', 'full_name',
            'role', 'team', 'team_name'
        ]
        read_only_fields = fields

    def get_employee_id(self, obj):
        return obj.display_employee_id

    def get_full_name(self, obj):
        return obj.full_name

    def get_team_name(self, obj):
        return obj.team.name if obj.team else None

class UserCreateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    mobile_number = serializers.CharField(required=False, allow_blank=True)
    role = serializers.CharField(required=False, allow_blank=True)
    full_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=8)
    reporting_manager = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True
    )
    date_of_joining = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'password', 'email', 'mobile_number',
            'first_name', 'last_name', 'full_name',
            'role', 'designation', 'team',
            'reporting_manager', 'department', 'work_location',
            'date_of_joining', 'employee_id'
        ]
        read_only_fields = ['id', 'employee_id']
        extra_kwargs = {
            'username': {'required': False},
            'email': {'required': False},
        }

    def to_internal_value(self, data):
        # normalize empty string foreign keys and dates to None
        if isinstance(data, dict):
            data = data.copy()
            for key in ['date_of_joining', 'reporting_manager', 'team']:
                if data.get(key) == '':
                    data[key] = None
        return super().to_internal_value(data)

    def validate(self, attrs):
        request = self.context.get('request')
        creator = request.user if request and request.user.is_authenticated else None
        errors = {}

        # 1. Full name parsing / first_name validation
        full_name = attrs.get('full_name', '').strip()
        first_name = attrs.get('first_name', '').strip()

        if full_name:
            parts = full_name.split(' ', 1)
            attrs['first_name'] = parts[0]
            attrs['last_name'] = parts[1] if len(parts) > 1 else ''
        elif not first_name:
            errors['full_name'] = "Full Name is required."

        # 2. Email Address
        email = attrs.get('email', '').strip().lower()
        if not email:
            errors['email'] = "Email address is required."
        elif User.objects.filter(email__iexact=email).exists():
            errors['email'] = "A user account with this email address already exists."
        else:
            attrs['email'] = email

        # 3. Mobile Number
        mobile = attrs.get('mobile_number', '').strip()
        if not mobile:
            errors['mobile_number'] = "Mobile number is required."
        else:
            digits_only = re.sub(r'\D', '', mobile)
            if len(digits_only) < 7 or len(digits_only) > 15:
                errors['mobile_number'] = "Enter a valid mobile phone number (7 to 15 digits)."
            elif User.objects.filter(mobile_number=mobile).exists():
                errors['mobile_number'] = "An employee with this mobile number already exists."
            else:
                attrs['mobile_number'] = mobile

        # 4. Username handling & uniqueness
        username = attrs.get('username', '').strip()
        if not username:
            if email:
                base_username = re.sub(r'[^a-zA-Z0-9._-]', '', email.split('@')[0].lower()) or 'emp'
            else:
                base_username = 'emp'
            candidate = base_username
            counter = 1
            while User.objects.filter(username__iexact=candidate).exists():
                candidate = f"{base_username}_{counter}"
                counter += 1
            attrs['username'] = candidate
        else:
            if User.objects.filter(username__iexact=username).exists():
                errors['username'] = "A user with this username already exists."

        # 5. Role and Team authorization policy
        role = attrs.get('role', UserRole.SALES_EMPLOYEE)
        team = attrs.get('team')

        if creator:
            if creator.role == UserRole.SALES_EMPLOYEE:
                raise serializers.PermissionDenied("Sales employees/counsellors are not authorized to create accounts.")

            elif creator.role == UserRole.MANAGER:
                # Manager cannot create Admin or Manager accounts
                if role != UserRole.SALES_EMPLOYEE:
                    errors['role'] = "Managers can only create Sales Employees/Counsellors. You cannot create Admin or Manager accounts."

                # Manager's authorized team
                authorized_team = getattr(creator, 'managed_team', None) or creator.team
                if not authorized_team:
                    errors['team'] = "You are not designated as manager of any team."
                elif team and team.id != authorized_team.id:
                    errors['team'] = f"Managers can only assign employees to their authorized team ({authorized_team.name})."
                else:
                    attrs['team'] = authorized_team

                # Reporting Manager restriction for Manager: must be self
                rep_mgr = attrs.get('reporting_manager')
                if rep_mgr and rep_mgr.id != creator.id:
                    errors['reporting_manager'] = "Reporting manager for your team members must be yourself."
                else:
                    attrs['reporting_manager'] = creator

            elif creator.role == UserRole.ADMIN or creator.is_superuser:
                if role == UserRole.SALES_EMPLOYEE and not team:
                    errors['team'] = "Each Sales Employee belongs to exactly one team at a time."
        else:
            if role == UserRole.SALES_EMPLOYEE and not team:
                errors['team'] = "Each Sales Employee belongs to exactly one team at a time."

        # Inactive team check
        if team and not team.is_active:
            errors['team'] = f"Cannot assign an employee to an inactive team ('{team.name}')."

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            password = validated_data.pop('password', None)
            validated_data.pop('full_name', None)

            if not password:
                temporary_password = generate_cryptographic_temporary_password(12)
            else:
                temporary_password = password

            user = User(**validated_data)
            user.set_password(temporary_password)
            user.is_active = True
            user.must_change_password = True
            user.save()
            # Stash temporary password on instance in memory ONLY (never persisted to db or model fields)
            user._temporary_password = temporary_password
            return user

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        user = authenticate(username=username, password=password)
        if not user:
            # Check by email
            user_by_email = User.objects.filter(email__iexact=username).first()
            if user_by_email and user_by_email.check_password(password):
                user = user_by_email

        if not user:
            raise serializers.ValidationError('Invalid username or password.')
        if not user.is_active:
            raise serializers.ValidationError('User account is disabled.')
        attrs['user'] = user
        return attrs

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=False, write_only=True, allow_blank=True)
    current_password = serializers.CharField(required=False, write_only=True, allow_blank=True)
    temporary_password = serializers.CharField(required=False, write_only=True, allow_blank=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=False, write_only=True, allow_blank=True)

    def validate(self, attrs):
        user = self.context.get('request').user if self.context.get('request') else None
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        old_pwd = attrs.get('old_password') or attrs.get('current_password') or attrs.get('temporary_password')
        if not old_pwd:
            raise serializers.ValidationError({'old_password': "Current or temporary password is required."})

        if not user.check_password(old_pwd):
            raise serializers.ValidationError({'old_password': "The current / temporary password entered is incorrect."})

        new_pwd = attrs.get('new_password')
        if not new_pwd:
            raise serializers.ValidationError({'new_password': "New password is required."})

        if old_pwd == new_pwd:
            raise serializers.ValidationError({'new_password': "The new password cannot be the same as your temporary password."})

        confirm_pwd = attrs.get('confirm_password')
        if confirm_pwd and new_pwd != confirm_pwd:
            raise serializers.ValidationError({'confirm_password': "Passwords do not match."})

        # Validate using Django's configured password validators (length, common, numeric, etc.)
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(new_pwd, user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'new_password': list(exc.messages)})

        attrs['validated_new_password'] = new_pwd
        return attrs

class UserProfileUpdateSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(required=False, allow_blank=True)
    mobile_number = serializers.CharField(required=False, allow_blank=True)
    work_location = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['full_name', 'first_name', 'last_name', 'mobile_number', 'work_location']

    def validate(self, attrs):
        user = self.instance
        initial = self.initial_data

        # Explicitly protect and reject attempts to alter protected fields
        protected_rules = {
            'role': (lambda u: u.role, "Changing 'role' is restricted. Role permissions cannot be altered in personal profile."),
            'team': (lambda u: u.team_id, "Changing 'team' assignment is restricted. Team permissions cannot be altered in personal profile."),
            'team_id': (lambda u: u.team_id, "Changing 'team_id' assignment is restricted. Team permissions cannot be altered in personal profile."),
            'employee_id': (lambda u: u.employee_id or u.display_employee_id, "Changing 'employee_id' is restricted. Employee ID is a permanent identifier."),
            'is_active': (lambda u: u.is_active, "Changing 'is_active' account status is restricted."),
            'account_status': (lambda u: "ACTIVE" if u.is_active else "INACTIVE", "Changing 'account_status' is restricted."),
            'reporting_manager': (lambda u: u.reporting_manager_id, "Changing 'reporting_manager' is restricted. Reporting structure cannot be altered in personal profile."),
            'reporting_manager_id': (lambda u: u.reporting_manager_id, "Changing 'reporting_manager_id' is restricted. Reporting structure cannot be altered in personal profile."),
            'email': (lambda u: u.email, "Changing 'email' is restricted. Email changes must follow the authorized verification and security policy."),
            'date_joined': (lambda u: str(u.date_joined), "Changing 'date_joined' is restricted."),
            'date_of_joining': (lambda u: str(u.date_of_joining) if u.date_of_joining else None, "Changing 'date_of_joining' is restricted."),
            'designation': (lambda u: u.designation or u.display_designation, "Changing 'designation' is restricted. Official designations are managed by HR."),
            'department': (lambda u: u.department, "Changing 'department' is restricted. Department allocation is managed by HR."),
            'is_staff': (lambda u: u.is_staff, "Changing administrative status is restricted."),
            'is_superuser': (lambda u: u.is_superuser, "Changing superuser status is restricted."),
            'must_change_password': (lambda u: u.must_change_password, "Changing password status is restricted."),
        }

        for field, (getter, err_msg) in protected_rules.items():
            if field in initial:
                submitted_val = initial[field]
                current_val = getter(user)
                submitted_str = str(submitted_val).strip() if submitted_val is not None else ""
                current_str = str(current_val).strip() if current_val is not None else ""
                if submitted_str != current_str:
                    raise serializers.ValidationError({field: err_msg})

        # Validate mobile_number
        if 'mobile_number' in attrs:
            raw_mobile = attrs['mobile_number'].strip()
            if raw_mobile:
                cleaned_mobile = re.sub(r'[\s\-\(\)]', '', raw_mobile)
                digits_only = re.sub(r'\D', '', raw_mobile)
                if not (7 <= len(digits_only) <= 15):
                    raise serializers.ValidationError({
                        'mobile_number': 'Enter a valid mobile phone number (7 to 15 digits).'
                    })
                # Check uniqueness excluding current user
                existing = User.objects.exclude(pk=user.pk).filter(mobile_number=cleaned_mobile).exists()
                if not existing and raw_mobile != cleaned_mobile:
                    existing = User.objects.exclude(pk=user.pk).filter(mobile_number=raw_mobile).exists()
                if existing:
                    raise serializers.ValidationError({
                        'mobile_number': 'An account with this mobile number already exists.'
                    })
                attrs['mobile_number'] = cleaned_mobile
            else:
                attrs['mobile_number'] = ''

        # Handle full_name splitting
        if 'full_name' in attrs:
            full_name = attrs.pop('full_name').strip()
            if not full_name:
                raise serializers.ValidationError({'full_name': 'Full name cannot be empty.'})
            parts = full_name.split(maxsplit=1)
            attrs['first_name'] = parts[0]
            attrs['last_name'] = parts[1] if len(parts) > 1 else ''

        if 'work_location' in attrs:
            attrs['work_location'] = attrs['work_location'].strip()

        return attrs

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class PasswordResetRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        ident = attrs.get('identifier') or attrs.get('email') or attrs.get('username')
        if not ident or not ident.strip():
            raise serializers.ValidationError({
                'identifier': 'Please provide your account username or registered email address.'
            })
        attrs['clean_identifier'] = ident.strip()
        return attrs

class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=False, write_only=True, allow_blank=True)

    def validate(self, attrs):
        token = attrs.get('token')
        record, err = PasswordResetToken.verify_token(token)
        if not record:
            raise serializers.ValidationError({'token': err})

        new_pwd = attrs.get('new_password')
        if not new_pwd:
            raise serializers.ValidationError({'new_password': 'New password is required.'})

        confirm_pwd = attrs.get('confirm_password')
        if confirm_pwd and new_pwd != confirm_pwd:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})

        # Validate against Django's password validators
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(new_pwd, user=record.user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'new_password': list(exc.messages)})

        attrs['token_record'] = record
        attrs['validated_new_password'] = new_pwd
        return attrs

class AdminPasswordResetSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(
        choices=['TEMPORARY_PASSWORD', 'RESET_LINK', 'BOTH'],
        default='TEMPORARY_PASSWORD'
    )

class UserAdminUpdateSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(required=False, allow_blank=True)
    role = serializers.CharField(required=False)
    account_status = serializers.CharField(required=False, write_only=True)
    lead_transfer_action = serializers.CharField(required=False, write_only=True, allow_blank=True, allow_null=True)
    reassign_leads_to = serializers.IntegerField(required=False, write_only=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            'full_name', 'first_name', 'last_name', 'email', 'mobile_number',
            'role', 'designation', 'department', 'work_location',
            'team', 'reporting_manager', 'date_of_joining',
            'is_active', 'account_status',
            'lead_transfer_action', 'reassign_leads_to',
        ]

    def validate(self, attrs):
        from rest_framework.exceptions import PermissionDenied
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            raise PermissionDenied("Authentication required.")

        actor = request.user
        target_user = self.instance

        # Handle account_status mapping to is_active if supplied
        if 'account_status' in attrs:
            st = attrs.pop('account_status').strip().upper()
            if st in ['ACTIVE', 'ENABLED']:
                attrs['is_active'] = True
            elif st in ['INACTIVE', 'DISABLED', 'SUSPENDED']:
                attrs['is_active'] = False

        # Employees cannot update users
        if not (actor.is_superuser or actor.role in [UserRole.ADMIN, UserRole.MANAGER]):
            raise PermissionDenied("You do not have administrative permission to modify employee accounts.")

        # Manager boundary checks
        if actor.role == UserRole.MANAGER and not actor.is_superuser:
            # Cannot manage Admins or other Managers
            if target_user.role != UserRole.SALES_EMPLOYEE:
                raise PermissionDenied("Managers can manage only Sales Employees.")

            # Must be in manager's team
            managed_team = getattr(actor, 'managed_team', None)
            manager_team_id = managed_team.id if managed_team else actor.team_id
            if target_user.team_id != manager_team_id:
                raise PermissionDenied("Managers can manage only employees within their authorized team.")

            # Cannot promote to Admin or Manager
            if 'role' in attrs and attrs['role'] != UserRole.SALES_EMPLOYEE:
                raise PermissionDenied("Managers cannot grant Admin or Manager roles.")

            # Cannot reassign to another team
            if 'team' in attrs:
                new_team = attrs['team']
                new_team_id = new_team.id if new_team else None
                if new_team_id != manager_team_id:
                    raise PermissionDenied("Managers cannot reassign employees to other teams.")

        # Team transfer verification for Admin
        if (actor.is_superuser or actor.role == UserRole.ADMIN) and 'team' in attrs:
            new_team = attrs['team']
            if new_team and not new_team.is_active and new_team != target_user.team:
                raise serializers.ValidationError({'team': f"Cannot assign an employee to an inactive team ('{new_team.name}')."})

            if new_team != target_user.team:
                from apps.leads.models import Lead
                assigned_leads_count = Lead.objects.filter(assigned_employee=target_user).count()
                if assigned_leads_count > 0:
                    action = attrs.get('lead_transfer_action')
                    if not action:
                        old_team_name = target_user.team.name if target_user.team else 'current team'
                        raise serializers.ValidationError({
                            'lead_transfer_action': (
                                f"Employee has {assigned_leads_count} assigned lead(s) in '{old_team_name}'. "
                                "An explicit lead transfer action is required: 'TRANSFER_LEADS_TO_NEW_TEAM', "
                                "'REASSIGN_LEADS_WITHIN_OLD_TEAM', or 'KEEP_LEADS_UNASSIGNED_IN_OLD_TEAM'."
                            )
                        })
                    valid_actions = [
                        'TRANSFER_LEADS_TO_NEW_TEAM',
                        'REASSIGN_LEADS_WITHIN_OLD_TEAM',
                        'KEEP_LEADS_UNASSIGNED_IN_OLD_TEAM'
                    ]
                    if action not in valid_actions:
                        raise serializers.ValidationError({
                            'lead_transfer_action': f"Invalid action '{action}'. Must be one of: {', '.join(valid_actions)}."
                        })

                    if action == 'REASSIGN_LEADS_WITHIN_OLD_TEAM':
                        reassign_to_id = attrs.get('reassign_leads_to')
                        if not reassign_to_id:
                            raise serializers.ValidationError({
                                'reassign_leads_to': "Target employee ID ('reassign_leads_to') is required when action is 'REASSIGN_LEADS_WITHIN_OLD_TEAM'."
                            })
                        reassign_user = User.objects.filter(id=reassign_to_id).first()
                        if not reassign_user:
                            raise serializers.ValidationError({
                                'reassign_leads_to': "Target employee not found."
                            })
                        if not reassign_user.is_active:
                            raise serializers.ValidationError({
                                'reassign_leads_to': "Cannot reassign leads to an inactive employee."
                            })
                        if reassign_user.id == target_user.id:
                            raise serializers.ValidationError({
                                'reassign_leads_to': "Cannot reassign leads to the transferring employee."
                            })
                        if target_user.team_id and reassign_user.team_id != target_user.team_id:
                            raise serializers.ValidationError({
                                'reassign_leads_to': f"Target employee must belong to the employee's current team ({target_user.team.name})."
                            })

        # Safety checks for Admin deactivation
        if 'is_active' in attrs and attrs['is_active'] is False:
            if target_user.id == actor.id:
                raise serializers.ValidationError({'is_active': "Administrators cannot deactivate their own account."})
            if target_user.role == UserRole.ADMIN and target_user.is_active:
                active_admins = User.objects.filter(role=UserRole.ADMIN, is_active=True).count()
                if active_admins <= 1:
                    raise serializers.ValidationError({'is_active': "Cannot deactivate the last active administrator account."})

        # Safety checks for Admin role removal
        if 'role' in attrs and attrs['role'] != UserRole.ADMIN and target_user.role == UserRole.ADMIN:
            if target_user.id == actor.id:
                active_admins = User.objects.filter(role=UserRole.ADMIN, is_active=True).count()
                if active_admins <= 1:
                    raise serializers.ValidationError({'role': "Cannot demote the last active administrator account."})

        # Validate mobile number
        if 'mobile_number' in attrs and attrs['mobile_number']:
            raw_mobile = attrs['mobile_number'].strip()
            digits = re.sub(r'\D', '', raw_mobile)
            if not (7 <= len(digits) <= 15):
                raise serializers.ValidationError({'mobile_number': "Enter a valid mobile phone number (7 to 15 digits)."})
            cleaned = re.sub(r'[\s\-\(\)]', '', raw_mobile)
            existing = User.objects.exclude(pk=target_user.pk).filter(mobile_number=cleaned).exists()
            if existing:
                raise serializers.ValidationError({'mobile_number': "Another employee with this mobile number already exists."})
            attrs['mobile_number'] = cleaned

        # Validate email
        if 'email' in attrs and attrs['email']:
            clean_email = attrs['email'].strip().lower()
            existing_email = User.objects.exclude(pk=target_user.pk).filter(email__iexact=clean_email).exists()
            if existing_email:
                raise serializers.ValidationError({'email': "Another user with this email address already exists."})
            attrs['email'] = clean_email

        # Handle full_name splitting
        if 'full_name' in attrs:
            name_parts = attrs.pop('full_name').strip().split(None, 1)
            attrs['first_name'] = name_parts[0] if name_parts else ''
            attrs['last_name'] = name_parts[1] if len(name_parts) > 1 else ''

        return attrs

    def update(self, instance, validated_data):
        from rest_framework.authtoken.models import Token
        from apps.audit.models import AuditEvent
        from apps.leads.models import Lead, LeadAssignmentHistory
        from django.utils import timezone

        request = self.context.get('request')
        actor = request.user if request else None

        lead_transfer_action = validated_data.pop('lead_transfer_action', None)
        reassign_to_id = validated_data.pop('reassign_leads_to', None)

        old_team = instance.team
        new_team = validated_data.get('team', old_team)
        team_changed = ('team' in validated_data and new_team != old_team)

        with transaction.atomic():
            # Track changes for audit logging
            changes = {}
            for field, new_val in validated_data.items():
                old_val = getattr(instance, field, None)
                if old_val != new_val:
                    changes[field] = {
                        'old': str(old_val) if old_val is not None else None,
                        'new': str(new_val) if new_val is not None else None,
                    }

            is_active_was = instance.is_active
            updated_instance = super().update(instance, validated_data)
            is_active_now = updated_instance.is_active

            # If team changed and employee was manager of old_team, disassociate manager from old team
            if team_changed and old_team:
                managed = getattr(instance, 'managed_team', None)
                if managed and managed.id == old_team.id:
                    old_team.manager = None
                    old_team.save(update_fields=['manager'])

            # If team changed and employee has assigned leads, execute lead transfer action
            if team_changed:
                assigned_leads = list(Lead.objects.filter(assigned_employee=instance))
                if assigned_leads:
                    if lead_transfer_action == 'TRANSFER_LEADS_TO_NEW_TEAM':
                        for lead in assigned_leads:
                            lead.team = new_team
                            lead.save(update_fields=['team'])
                            LeadAssignmentHistory.objects.create(
                                lead=lead,
                                from_team=old_team,
                                to_team=new_team,
                                from_employee=instance,
                                to_employee=instance,
                                changed_by=actor
                            )
                            AuditEvent.objects.create(
                                event_type='LEAD_REASSIGNED',
                                user=actor,
                                details={
                                    'lead_id': lead.id,
                                    'action': 'employee_team_transfer_leads_moved',
                                    'from_team_id': old_team.id if old_team else None,
                                    'to_team_id': new_team.id if new_team else None,
                                    'assigned_employee_id': instance.id,
                                }
                            )

                    elif lead_transfer_action == 'REASSIGN_LEADS_WITHIN_OLD_TEAM':
                        reassign_to = User.objects.get(id=reassign_to_id)
                        for lead in assigned_leads:
                            lead.assigned_employee = reassign_to
                            lead.save(update_fields=['assigned_employee'])
                            LeadAssignmentHistory.objects.create(
                                lead=lead,
                                from_team=old_team,
                                to_team=old_team,
                                from_employee=instance,
                                to_employee=reassign_to,
                                changed_by=actor
                            )
                            AuditEvent.objects.create(
                                event_type='LEAD_REASSIGNED',
                                user=actor,
                                details={
                                    'lead_id': lead.id,
                                    'action': 'employee_team_transfer_leads_reassigned',
                                    'from_employee_id': instance.id,
                                    'to_employee_id': reassign_to.id,
                                    'team_id': old_team.id if old_team else None,
                                }
                            )

                    elif lead_transfer_action == 'KEEP_LEADS_UNASSIGNED_IN_OLD_TEAM':
                        for lead in assigned_leads:
                            lead.assigned_employee = None
                            lead.save(update_fields=['assigned_employee'])
                            AuditEvent.objects.create(
                                event_type='LEAD_UNASSIGNED',
                                user=actor,
                                details={
                                    'lead_id': lead.id,
                                    'action': 'employee_team_transfer_leads_unassigned',
                                    'from_employee_id': instance.id,
                                    'team_id': old_team.id if old_team else None,
                                }
                            )

                    AuditEvent.objects.create(
                        event_type='EMPLOYEE_TEAM_TRANSFERRED',
                        user=actor,
                        details={
                            'target_user_id': instance.id,
                            'target_username': instance.username,
                            'target_employee_id': instance.display_employee_id,
                            'from_team_id': old_team.id if old_team else None,
                            'from_team_name': old_team.name if old_team else None,
                            'to_team_id': new_team.id if new_team else None,
                            'to_team_name': new_team.name if new_team else None,
                            'lead_transfer_action': lead_transfer_action,
                            'affected_leads_count': len(assigned_leads),
                            'timestamp': timezone.now().isoformat(),
                        }
                    )

            # Deactivation handling: invalidate sessions & audit log
            if is_active_was and not is_active_now:
                Token.objects.filter(user=updated_instance).delete()
                AuditEvent.objects.create(
                    event_type='ACCOUNT_DEACTIVATED',
                    user=actor,
                    details={
                        'target_user_id': updated_instance.id,
                        'target_username': updated_instance.username,
                        'target_employee_id': updated_instance.display_employee_id,
                        'action': 'account_deactivated',
                        'sessions_invalidated': True,
                    }
                )
            elif not is_active_was and is_active_now:
                AuditEvent.objects.create(
                    event_type='ACCOUNT_ACTIVATED',
                    user=actor,
                    details={
                        'target_user_id': updated_instance.id,
                        'target_username': updated_instance.username,
                        'target_employee_id': updated_instance.display_employee_id,
                        'action': 'account_activated',
                    }
                )

            # General user update audit event
            if changes and (is_active_was == is_active_now) and not team_changed:
                AuditEvent.objects.create(
                    event_type='USER_UPDATED',
                    user=actor,
                    details={
                        'target_user_id': updated_instance.id,
                        'target_username': updated_instance.username,
                        'target_employee_id': updated_instance.display_employee_id,
                        'changes': changes,
                    }
                )

            return updated_instance

