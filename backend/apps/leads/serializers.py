import re
from django.db import transaction
from django.core.validators import validate_email
from rest_framework import serializers
from .models import (
    PipelineStage,
    Lead,
    LeadAssignmentHistory,
    LeadStageHistory,
    LeadImportBatch,
    PreCloserFinancial,
    LeadFinancialHistory
)
from apps.teams.models import Team
from apps.authentication.models import User, UserRole
from apps.audit.models import AuditEvent


class PipelineStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PipelineStage
        fields = ['id', 'name', 'order', 'is_active', 'created_at', 'updated_at']

    def validate_order(self, value):
        if value < 1 or value > 20:
            raise serializers.ValidationError("Pipeline stage order must be between 1 and 20.")
        return value


class PreCloserFinancialSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.username', read_only=True)
    outstanding_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = PreCloserFinancial
        fields = [
            'id', 'lead', 'agreed_amount', 'amount_paid', 'outstanding_balance',
            'created_by', 'created_by_name', 'updated_by', 'updated_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'lead', 'outstanding_balance', 'created_by', 'created_by_name',
            'updated_by', 'updated_by_name', 'created_at', 'updated_at'
        ]

    def validate(self, attrs):
        agreed = attrs.get('agreed_amount')
        paid = attrs.get('amount_paid')
        from decimal import Decimal
        if agreed is not None and agreed < Decimal('0.00'):
            raise serializers.ValidationError({"agreed_amount": "Total agreed amount cannot be negative."})
        if paid is not None and paid < Decimal('0.00'):
            raise serializers.ValidationError({"amount_paid": "Amount paid cannot be negative."})
        if agreed is not None and paid is not None and paid > agreed:
            raise serializers.ValidationError({"amount_paid": "Amount paid cannot exceed the total agreed amount."})
        return attrs


class PreCloserFinancialUpdateSerializer(serializers.Serializer):
    agreed_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    payment_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    mode = serializers.ChoiceField(choices=['record_payment', 'set_totals'], default='record_payment', required=False)
    note = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        from decimal import Decimal
        agreed = attrs.get('agreed_amount')
        paid = attrs.get('amount_paid')
        payment = attrs.get('payment_amount')

        if agreed is None and paid is None and payment is None:
            raise serializers.ValidationError({"non_field_errors": ["Either payment_amount or agreed_amount/amount_paid must be provided."]})

        if agreed is not None and agreed < Decimal('0.00'):
            raise serializers.ValidationError({"agreed_amount": "Total agreed amount cannot be negative."})
        if paid is not None and paid < Decimal('0.00'):
            raise serializers.ValidationError({"amount_paid": "Amount paid cannot be negative."})
        if payment is not None and payment <= Decimal('0.00'):
            raise serializers.ValidationError({"payment_amount": "Payment amount received must be greater than zero."})
        if agreed is not None and paid is not None and paid > agreed:
            raise serializers.ValidationError({"amount_paid": "Amount paid cannot exceed the total agreed amount."})
        return attrs



class LeadFinancialHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.username', read_only=True)

    class Meta:
        model = LeadFinancialHistory
        fields = [
            'id', 'lead', 'financial_record', 'agreed_amount', 'amount_paid',
            'outstanding_balance', 'changed_by', 'changed_by_name', 'note', 'timestamp'
        ]
        read_only_fields = fields


class LeadAssignmentHistorySerializer(serializers.ModelSerializer):
    from_team_name = serializers.CharField(source='from_team.name', read_only=True)
    to_team_name = serializers.CharField(source='to_team.name', read_only=True)
    from_employee_name = serializers.CharField(source='from_employee.username', read_only=True)
    to_employee_name = serializers.CharField(source='to_employee.username', read_only=True)
    changed_by_name = serializers.CharField(source='changed_by.username', read_only=True)

    class Meta:
        model = LeadAssignmentHistory
        fields = [
            'id', 'lead', 'from_team', 'from_team_name', 'to_team', 'to_team_name',
            'from_employee', 'from_employee_name', 'to_employee', 'to_employee_name',
            'changed_by', 'changed_by_name', 'timestamp'
        ]


class LeadStageHistorySerializer(serializers.ModelSerializer):
    from_stage_name = serializers.CharField(source='from_stage.name', read_only=True)
    to_stage_name = serializers.CharField(source='to_stage.name', read_only=True)
    changed_by_name = serializers.CharField(source='changed_by.username', read_only=True)

    class Meta:
        model = LeadStageHistory
        fields = [
            'id', 'lead', 'from_stage', 'from_stage_name', 'to_stage', 'to_stage_name',
            'changed_by', 'changed_by_name', 'note', 'timestamp'
        ]


def is_pending_closure_stage(stage):
    if not stage:
        return False
    if getattr(stage, 'order', None) == 9:
        return True
    name_clean = stage.name.strip().lower().replace(' ', '').replace('-', '').replace('_', '')
    return name_clean == 'pendingclosure'


class LeadChangeStageSerializer(serializers.Serializer):
    destination_stage_id = serializers.IntegerField(required=True)
    note = serializers.CharField(required=True, allow_blank=False)
    expected_current_stage_id = serializers.IntegerField(required=False, allow_null=True)
    agreed_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True
    )
    amount_paid = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
        allow_null=True
    )

    def validate_note(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("A note explaining the stage change is required.")
        return value.strip()

    def validate(self, attrs):
        dest_stage_id = attrs.get('destination_stage_id')
        dest_stage = PipelineStage.objects.filter(id=dest_stage_id, is_active=True).first()
        if not dest_stage:
            raise serializers.ValidationError({
                "destination_stage_id": "Selected destination stage does not exist or is inactive."
            })

        # Check if destination stage is Pending Closure
        if is_pending_closure_stage(dest_stage):
            agreed = attrs.get('agreed_amount')
            paid = attrs.get('amount_paid')

            if agreed is None:
                raise serializers.ValidationError({
                    "agreed_amount": "Total agreed amount is required when transitioning to Pending Closure."
                })
            if paid is None:
                raise serializers.ValidationError({
                    "amount_paid": "Amount paid is required when transitioning to Pending Closure."
                })

            from decimal import Decimal
            if agreed < Decimal('0.00'):
                raise serializers.ValidationError({
                    "agreed_amount": "Total agreed amount cannot be negative."
                })
            if paid < Decimal('0.00'):
                raise serializers.ValidationError({
                    "amount_paid": "Amount paid cannot be negative."
                })
            if paid > agreed:
                raise serializers.ValidationError({
                    "amount_paid": "Amount paid cannot exceed the total agreed amount."
                })

        return attrs



class LeadImportBatchSerializer(serializers.ModelSerializer):
    imported_by_name = serializers.CharField(source='imported_by.username', read_only=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)

    class Meta:
        model = LeadImportBatch
        fields = [
            'id', 'batch_id', 'file_name', 'file_type', 'total_rows', 'valid_rows',
            'imported_rows', 'rejected_rows', 'duplicate_rows', 'stage', 'stage_name',
            'assignment_mode', 'source', 'priority', 'batch_note', 'distribution', 'errors',
            'imported_by', 'imported_by_name', 'status', 'created_at'
        ]


class LeadSerializer(serializers.ModelSerializer):
    lead_id = serializers.CharField(read_only=True)
    name = serializers.CharField(required=False, allow_blank=True)
    title = serializers.CharField(required=False, allow_blank=True)
    contact_name = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=True, allow_blank=False)
    phone = serializers.CharField(required=True, allow_blank=False)

    qualification = serializers.CharField(required=False, allow_blank=True, default='')
    college = serializers.CharField(required=False, allow_blank=True, default='')
    yop = serializers.CharField(required=False, allow_blank=True, default='')
    key_skills = serializers.CharField(required=False, allow_blank=True, default='')
    target_role = serializers.CharField(required=False, allow_blank=True, default='')
    experience = serializers.CharField(required=False, allow_blank=True, default='')
    priority = serializers.CharField(required=False, allow_blank=True, default='')
    status = serializers.CharField(required=False, allow_blank=True, default='')
    estimated_revenue = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    placement_fee = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, allow_null=True)
    career_counsellor = serializers.CharField(required=False, allow_blank=True, default='')
    city = serializers.CharField(required=False, allow_blank=True, default='')
    next_follow_up = serializers.DateTimeField(required=False, allow_null=True)
    archived_at = serializers.DateTimeField(required=False, allow_null=True)

    team_name = serializers.CharField(source='team.name', read_only=True)
    assigned_employee = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True
    )
    assigned_employee_name = serializers.SerializerMethodField()
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    last_stage_change = serializers.SerializerMethodField()
    pre_closer_financial = PreCloserFinancialSerializer(read_only=True)
    pending_closure_financial = PreCloserFinancialSerializer(source='pre_closer_financial', read_only=True)

    def get_assigned_employee_name(self, obj):
        return obj.assigned_employee.username if obj.assigned_employee else None

    def get_last_stage_change(self, obj):
        last = obj.stage_history.order_by('-timestamp').select_related('from_stage', 'to_stage', 'changed_by').first()
        if last:
            return {
                'timestamp': last.timestamp.isoformat(),
                'changed_by': last.changed_by.username,
                'changed_by_name': last.changed_by.get_full_name() or last.changed_by.username,
                'from_stage_id': last.from_stage_id,
                'from_stage_name': last.from_stage.name if last.from_stage else 'Unassigned',
                'to_stage_id': last.to_stage_id,
                'to_stage_name': last.to_stage.name if last.to_stage else 'Unassigned',
                'note': last.note,
            }
        return None

    class Meta:
        model = Lead
        fields = [
            'id', 'lead_id', 'name', 'title', 'contact_name', 'email',
            'qualification', 'college', 'yop', 'key_skills', 'target_role', 'experience',
            'phone', 'company', 'stage', 'stage_name',
            'priority', 'source', 'batch_tag', 'status', 'estimated_revenue', 'placement_fee',
            'career_counsellor', 'city', 'next_follow_up',
            'assigned_employee', 'assigned_employee_name',
            'team', 'team_name',
            'created_by', 'created_by_name',
            'created_at', 'updated_at', 'archived_at',
            'last_stage_change',
            'pre_closer_financial',
            'pending_closure_financial'
        ]
        read_only_fields = ['id', 'lead_id', 'created_by', 'created_at', 'updated_at', 'last_stage_change', 'pre_closer_financial', 'pending_closure_financial']

        extra_kwargs = {
            'team': {'required': False},
            'assigned_employee': {'required': False},
        }

    def validate_email(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Email is required.")
        val = value.strip()
        validate_email(val)
        return val

    def validate_phone(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Mobile Phone is required.")
        val = value.strip()
        # Accept valid phone format with optional leading '+', digits, and common separators
        if not re.match(r'^\+?[0-9\s\-\(\)\.]{7,25}$', val):
            raise serializers.ValidationError("Phone number must contain between 7 and 15 digits with valid phone formatting.")
        digits = re.sub(r'\D', '', val)
        if len(digits) < 7 or len(digits) > 15:
            raise serializers.ValidationError("Phone number must contain between 7 and 15 digits.")
        return val

    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user if request else None

        # Determine instance vs creation
        is_create = self.instance is None
        team = attrs.get('team', self.instance.team if self.instance else None)
        assigned_employee = attrs.get('assigned_employee', self.instance.assigned_employee if self.instance else None)

        if is_create:
            # 1. Mandatory Lead Name check
            lead_name = (attrs.get('name') or attrs.get('title') or attrs.get('contact_name') or '').strip()
            if not lead_name:
                raise serializers.ValidationError({"name": "Lead Name is required."})
            attrs['name'] = lead_name
            attrs['title'] = lead_name
            attrs['contact_name'] = lead_name

            # 2. Mandatory Email check
            email = (attrs.get('email') or '').strip()
            if not email:
                raise serializers.ValidationError({"email": "Email is required."})

            # 3. Mandatory Mobile Phone check
            phone = (attrs.get('phone') or '').strip()
            if not phone:
                raise serializers.ValidationError({"phone": "Mobile Phone is required."})

            # 4. Role authorization for lead creation
            if not user or (user.role not in [UserRole.ADMIN, UserRole.MANAGER] and not user.is_superuser):
                raise serializers.ValidationError("Only Admins and Managers can create leads.")

            if not team:
                raise serializers.ValidationError({"team": "Team is required when creating a lead."})

            if team and not team.is_active:
                raise serializers.ValidationError({"team": f"Cannot create or assign leads to an inactive team ('{team.name}')."})

            # Managers can create leads only for their authorized team
            if user.role == UserRole.MANAGER and not user.is_superuser:
                managed_team = getattr(user, 'managed_team', None)
                authorized_team_id = managed_team.id if managed_team else user.team_id
                if team.id != authorized_team_id:
                    raise serializers.ValidationError({"team": "Managers can create leads only for their authorized team."})

            # Check if this lead is permitted to be unassigned
            allow_unassigned = self.context.get('allow_unassigned', False) or attrs.pop('is_unassigned', False) or attrs.pop('allow_unassigned', False)

            if not allow_unassigned:
                # Every ordinary lead must have a valid assigned Sales Employee at creation
                if not assigned_employee:
                    raise serializers.ValidationError({"assigned_employee": "Every lead must have a valid assigned Sales Employee at creation."})

                if assigned_employee.role not in [UserRole.SALES_EMPLOYEE, UserRole.MANAGER]:
                    raise serializers.ValidationError({"assigned_employee": "Assigned user must have the Sales Employee or Manager role."})

                # The assigned employee must belong to or manage the lead's team
                if assigned_employee.role == UserRole.SALES_EMPLOYEE and assigned_employee.team_id != team.id:
                    raise serializers.ValidationError({"assigned_employee": f"The assigned employee must belong to the lead's team ({team.name})."})
                elif assigned_employee.role == UserRole.MANAGER:
                    mgr_team_id = getattr(assigned_employee, 'managed_team_id', None) or assigned_employee.team_id
                    if mgr_team_id != team.id:
                        raise serializers.ValidationError({"assigned_employee": f"Manager '{assigned_employee.username}' does not manage team ({team.name})."})
            else:
                # Unassigned lead intake workflow: team is required, assigned_employee is optional
                if assigned_employee:
                    if assigned_employee.role not in [UserRole.SALES_EMPLOYEE, UserRole.MANAGER]:
                        raise serializers.ValidationError({"assigned_employee": "Assigned user must have the Sales Employee or Manager role."})
                    if assigned_employee.role == UserRole.SALES_EMPLOYEE and assigned_employee.team_id != team.id:
                        raise serializers.ValidationError({"assigned_employee": f"The assigned employee must belong to the lead's team ({team.name})."})
                    elif assigned_employee.role == UserRole.MANAGER:
                        mgr_team_id = getattr(assigned_employee, 'managed_team_id', None) or assigned_employee.team_id
                        if mgr_team_id != team.id:
                            raise serializers.ValidationError({"assigned_employee": f"Manager '{assigned_employee.username}' does not manage team ({team.name})."})

            # Pipeline stage initialization rule if omitted
            if not attrs.get('stage'):
                initial_stage = PipelineStage.objects.filter(is_active=True).order_by('order').first()
                if initial_stage:
                    attrs['stage'] = initial_stage

        else:
            # Update operation
            if 'name' in attrs:
                new_name = (attrs.get('name') or '').strip()
                if new_name:
                    attrs['title'] = new_name
                    attrs['contact_name'] = new_name

            team_changed = ('team' in attrs and attrs['team'] != self.instance.team)
            assignment_changed = ('assigned_employee' in attrs and attrs['assigned_employee'] != self.instance.assigned_employee)

            if team_changed and attrs.get('team') and not attrs['team'].is_active:
                raise serializers.ValidationError({"team": f"Cannot move leads to an inactive team ('{attrs['team'].name}')."})

            # Sales Employees:
            if user.role == UserRole.SALES_EMPLOYEE:
                if team_changed:
                    raise serializers.ValidationError({"team": "Sales Employees cannot reassign leads across teams."})
                if assignment_changed:
                    raise serializers.ValidationError({"assigned_employee": "Sales Employees cannot reassign leads."})

            # Managers:
            elif user.role == UserRole.MANAGER and not user.is_superuser:
                managed_team = getattr(user, 'managed_team', None)
                authorized_team_id = managed_team.id if managed_team else user.team_id

                if team_changed:
                    if attrs['team'].id != authorized_team_id:
                        raise serializers.ValidationError({"team": "Managers cannot reassign leads to another team."})

                if assignment_changed:
                    if attrs['assigned_employee'] is not None:
                        new_employee = attrs['assigned_employee']
                        if new_employee.id == user.id:
                            # Manager self-assignment is permitted within their authorized team
                            pass
                        else:
                            if new_employee.team_id != authorized_team_id:
                                raise serializers.ValidationError({"assigned_employee": "Managers can assign and reassign leads only within their authorized team."})
                            if new_employee.role != UserRole.SALES_EMPLOYEE:
                                raise serializers.ValidationError({"assigned_employee": "Assigned user must have the Sales Employee role."})
                    else:
                        allow_unassigned = self.context.get('allow_unassigned', False) or attrs.pop('is_unassigned', False) or attrs.pop('allow_unassigned', False)
                        if not allow_unassigned:
                            raise serializers.ValidationError({"assigned_employee": "Lead assignment cannot be cleared."})

            # Admins:
            elif user.role == UserRole.ADMIN or user.is_superuser:
                target_team = attrs.get('team', self.instance.team)
                if assignment_changed:
                    if attrs['assigned_employee'] is not None:
                        new_employee = attrs['assigned_employee']
                        if new_employee.role == UserRole.SALES_EMPLOYEE:
                            if new_employee.team_id != target_team.id:
                                raise serializers.ValidationError({"assigned_employee": f"Assigned employee must belong to the lead's team ({target_team.name})."})
                        elif new_employee.role == UserRole.MANAGER:
                            mgr_team_id = getattr(new_employee, 'managed_team_id', None) or new_employee.team_id
                            if mgr_team_id != target_team.id:
                                raise serializers.ValidationError({"assigned_employee": f"Manager '{new_employee.username}' does not manage team ({target_team.name})."})
                        else:
                            raise serializers.ValidationError({"assigned_employee": "Assigned user must have the Sales Employee or Manager role."})
                    else:
                        allow_unassigned = self.context.get('allow_unassigned', False) or attrs.pop('is_unassigned', False) or attrs.pop('allow_unassigned', False)
                        if not allow_unassigned:
                            raise serializers.ValidationError({"assigned_employee": "Lead assignment cannot be cleared."})
                elif team_changed:
                    curr_employee = self.instance.assigned_employee
                    if curr_employee and curr_employee.role == UserRole.SALES_EMPLOYEE and curr_employee.team_id != target_team.id:
                        raise serializers.ValidationError({"assigned_employee": f"Assigned employee must belong to the lead's team ({target_team.name})."})

        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user
        validated_data['created_by'] = user

        with transaction.atomic():
            lead = super().create(validated_data)

            # Record initial assignment history only if an employee was assigned
            if lead.assigned_employee:
                LeadAssignmentHistory.objects.create(
                    lead=lead,
                    from_team=None,
                    to_team=lead.team,
                    from_employee=None,
                    to_employee=lead.assigned_employee,
                    changed_by=user
                )

            # If initial stage is set, record stage history
            if lead.stage:
                LeadStageHistory.objects.create(
                    lead=lead,
                    from_stage=None,
                    to_stage=lead.stage,
                    changed_by=user
                )

            AuditEvent.objects.create(
                event_type='LEAD_CREATED',
                user=user,
                details={
                    'lead_id': lead.id,
                    'generated_lead_id': lead.lead_id,
                    'name': lead.name,
                    'team_id': lead.team_id,
                    'assigned_employee_id': lead.assigned_employee_id,
                    'stage_id': lead.stage_id,
                    'is_unassigned': lead.assigned_employee_id is None
                }
            )

            return lead

    def update(self, instance, validated_data):
        request = self.context.get('request')
        user = request.user

        prev_team = instance.team
        prev_employee = instance.assigned_employee
        prev_stage = instance.stage

        new_team = validated_data.get('team', prev_team)
        new_employee = validated_data.get('assigned_employee', prev_employee)
        new_stage = validated_data.get('stage', prev_stage)

        with transaction.atomic():
            lead = super().update(instance, validated_data)

            # Check if assignment changed
            if prev_team != new_team or prev_employee != new_employee:
                if new_employee is not None:
                    LeadAssignmentHistory.objects.create(
                        lead=lead,
                        from_team=prev_team,
                        to_team=new_team,
                        from_employee=prev_employee,
                        to_employee=new_employee,
                        changed_by=user
                    )
                AuditEvent.objects.create(
                    event_type='LEAD_ASSIGNED' if prev_employee is None else 'LEAD_REASSIGNED',
                    user=user,
                    details={
                        'lead_id': lead.id,
                        'from_team_id': prev_team.id if prev_team else None,
                        'to_team_id': new_team.id,
                        'from_employee_id': prev_employee.id if prev_employee else None,
                        'to_employee_id': new_employee.id if new_employee else None
                    }
                )

            # Check if stage changed
            if prev_stage != new_stage:
                LeadStageHistory.objects.create(
                    lead=lead,
                    from_stage=prev_stage,
                    to_stage=new_stage,
                    changed_by=user
                )
                AuditEvent.objects.create(
                    event_type='LEAD_STAGE_CHANGED',
                    user=user,
                    details={
                        'lead_id': lead.id,
                        'from_stage_id': prev_stage.id if prev_stage else None,
                        'to_stage_id': new_stage.id if new_stage else None
                    }
                )

            return lead
