import hashlib
import secrets
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.exceptions import ValidationError

class UserRole(models.TextChoices):
    ADMIN = 'ADMIN', 'Admin'
    MANAGER = 'MANAGER', 'Manager'
    SALES_EMPLOYEE = 'SALES_EMPLOYEE', 'Sales Employee'

class EmployeeIdSequence(models.Model):
    """
    Concurrency-safe sequence generator for allocating unique, padded Employee IDs (e.g. EMP-0001).
    Guarantees atomic allocation without race conditions.
    """
    last_number = models.PositiveBigIntegerField(default=0)

    @classmethod
    def get_next_employee_id(cls):
        import time
        from django.db import transaction, OperationalError
        for attempt in range(15):
            try:
                with transaction.atomic():
                    seq, _ = cls.objects.select_for_update().get_or_create(id=1)
                    if seq.last_number == 0:
                        # Find highest existing EMP-XXXX or user id to ensure no conflicts
                        max_num = 0
                        for u in User.objects.all():
                            if u.employee_id and u.employee_id.startswith('EMP-'):
                                part = u.employee_id.replace('EMP-', '')
                                if part.isdigit():
                                    max_num = max(max_num, int(part))
                            max_num = max(max_num, u.id or 0)
                        seq.last_number = max_num

                    seq.last_number += 1
                    while User.objects.filter(employee_id=f"EMP-{seq.last_number:04d}").exists():
                        seq.last_number += 1

                    seq.save(update_fields=['last_number'])
                    return f"EMP-{seq.last_number:04d}"
            except OperationalError as exc:
                if 'locked' in str(exc).lower() and attempt < 14:
                    time.sleep(0.05 * (attempt + 1))
                    continue
                raise

    def __str__(self):
        return f"EmployeeIdSequence(last={self.last_number})"

class User(AbstractUser):
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.SALES_EMPLOYEE
    )
    team = models.ForeignKey(
        'teams.Team',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='members',
        help_text='The single team this employee belongs to'
    )
    employee_id = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        unique=True,
        help_text='Unique Employee ID (e.g. EMP-0001)'
    )
    mobile_number = models.CharField(
        max_length=30,
        blank=True,
        default='',
        help_text='Employee mobile / contact number'
    )
    designation = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='Employee designation / job title'
    )
    department = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='Employee department (e.g. Admissions, Sales, Operations)'
    )
    work_location = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='Work location or office branch'
    )
    date_of_joining = models.DateField(
        null=True,
        blank=True,
        help_text='Date of joining the organization'
    )
    must_change_password = models.BooleanField(
        default=False,
        help_text='Require user to change password on first login'
    )
    reporting_manager = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='direct_reports',
        help_text='Direct reporting manager'
    )

    @property
    def display_employee_id(self):
        if self.employee_id:
            return self.employee_id
        return f"EMP-{self.id:04d}"

    @property
    def full_name(self):
        name = f"{self.first_name} {self.last_name}".strip()
        return name or self.username

    @property
    def display_designation(self):
        if self.designation:
            return self.designation
        if self.role == UserRole.ADMIN or self.is_superuser:
            return "System Administrator"
        elif self.role == UserRole.MANAGER:
            return "Sales Manager"
        elif self.role == UserRole.SALES_EMPLOYEE:
            return "Career Counsellor"
        return "Employee"

    @property
    def effective_reporting_manager(self):
        if self.reporting_manager:
            return self.reporting_manager
        if self.role == UserRole.SALES_EMPLOYEE and self.team and self.team.manager:
            return self.team.manager
        return None

    def is_admin_user(self):
        return self.role == UserRole.ADMIN or self.is_superuser

    def is_manager_user(self):
        return self.role == UserRole.MANAGER

    def is_sales_employee(self):
        return self.role == UserRole.SALES_EMPLOYEE

    def clean(self):
        super().clean()
        if self.role == UserRole.SALES_EMPLOYEE and not self.is_superuser:
            # Sales employees must belong to exactly one team when actively participating in CRM
            pass

    def save(self, *args, **kwargs):
        if not self.employee_id:
            self.employee_id = EmployeeIdSequence.get_next_employee_id()
        if not self.reporting_manager and self.role == UserRole.SALES_EMPLOYEE and self.team and self.team.manager:
            self.reporting_manager = self.team.manager
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

class PasswordResetToken(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    token_hash = models.CharField(max_length=64, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='initiated_resets'
    )

    class Meta:
        ordering = ['-created_at']

    @classmethod
    def create_token_for_user(cls, user, created_by=None, validity_minutes=15):
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        expires_at = timezone.now() + timedelta(minutes=validity_minutes)
        record = cls.objects.create(
            user=user,
            token_hash=token_hash,
            expires_at=expires_at,
            created_by=created_by
        )
        return raw_token, record

    @classmethod
    def verify_token(cls, raw_token):
        if not raw_token or not isinstance(raw_token, str):
            return None, "Invalid reset token."
        token_hash = hashlib.sha256(raw_token.strip().encode('utf-8')).hexdigest()
        record = cls.objects.filter(token_hash=token_hash).select_related('user').first()
        if not record:
            return None, "Invalid password reset token."
        if record.is_used:
            return None, "This password reset token has already been used."
        if timezone.now() > record.expires_at:
            return None, "This password reset token has expired."
        if not record.user.is_active:
            return None, "The user account associated with this token is inactive."
        return record, None

    def __str__(self):
        return f"PasswordResetToken(user={self.user.username}, used={self.is_used})"
