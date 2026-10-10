from django.db import models, transaction
from django.conf import settings
from django.core.exceptions import ValidationError

class PipelineStage(models.Model):
    """
    Extensible database model for the 12 pipeline stages.
    """
    name = models.CharField(max_length=100, unique=True)
    order = models.PositiveSmallIntegerField(
        help_text="Order in pipeline (1-12)"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.order}. {self.name}"

class LeadIdSequence(models.Model):
    """
    Concurrency-safe sequence generator for allocating unique, padded Lead IDs (e.g. SM-LD-0001).
    Guarantees atomic allocation without counting table rows.
    """
    last_number = models.PositiveBigIntegerField(default=0)

    @classmethod
    def get_next_lead_id(cls):
        import time
        from django.db import OperationalError
        for attempt in range(15):
            try:
                with transaction.atomic():
                    seq, _ = cls.objects.select_for_update().get_or_create(id=1)
                    seq.last_number += 1
                    seq.save(update_fields=['last_number'])
                    return f"SM-LD-{seq.last_number:04d}"
            except OperationalError as exc:
                if 'locked' in str(exc).lower() and attempt < 14:
                    time.sleep(0.05 * (attempt + 1))
                    continue
                raise

class Lead(models.Model):
    # 1. Lead ID — generated automatically (e.g. SM-LD-0001)
    lead_id = models.CharField(
        max_length=32,
        unique=True,
        db_index=True,
        editable=False,
        blank=True,
        help_text="Automatically generated unique identifier"
    )

    # 2. Lead Name
    name = models.CharField(max_length=255, default='', blank=True)
    title = models.CharField(max_length=255, default='', blank=True)
    contact_name = models.CharField(max_length=255, default='', blank=True)

    # 3. Email
    email = models.EmailField()

    # 4. Degree / Qualification
    qualification = models.CharField(max_length=255, blank=True, default='')

    # 5. College / University
    college = models.CharField(max_length=255, blank=True, default='')

    # 6. Year of Passing (YOP)
    yop = models.CharField(max_length=50, blank=True, default='')

    # 7. Key Skills
    key_skills = models.TextField(blank=True, default='')

    # 8. Target Role
    target_role = models.CharField(max_length=255, blank=True, default='')

    # 9. Experience
    experience = models.CharField(max_length=100, blank=True, default='')

    # 10. Mobile Phone
    phone = models.CharField(max_length=50)

    # Optional legacy company field preserved
    company = models.CharField(max_length=255, blank=True, default='')

    # 11. Pipeline Stage
    stage = models.ForeignKey(
        PipelineStage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='leads'
    )

    # 12. Priority
    priority = models.CharField(max_length=50, blank=True, default='')

    # Source & Campaign Tag
    source = models.CharField(max_length=100, blank=True, default='')
    batch_tag = models.CharField(max_length=255, blank=True, default='')

    # 13. Status
    status = models.CharField(max_length=50, blank=True, default='')

    # 14. Estimated Revenue
    estimated_revenue = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    # 15. Placement Fee
    placement_fee = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    # 16. Career Counsellor
    career_counsellor = models.CharField(max_length=255, blank=True, default='')

    # 17. City / Location
    city = models.CharField(max_length=255, blank=True, default='')

    # 18. Next Follow-up
    next_follow_up = models.DateTimeField(null=True, blank=True)

    # 19. Assigned Sales Employee (nullable for unassigned queue)
    assigned_employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='assigned_leads',
        help_text="Sales Employee or Manager assigned to this lead. Null when lead is unassigned."
    )

    # 20. Team
    team = models.ForeignKey(
        'teams.Team',
        on_delete=models.PROTECT,
        related_name='leads',
        help_text="Team owning the lead"
    )

    # 21. Created By
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_leads'
    )

    # 22. Created At
    created_at = models.DateTimeField(auto_now_add=True)

    # 23. Updated At
    updated_at = models.DateTimeField(auto_now=True)

    # 24. Archived At (soft deletion support)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.lead_id:
            self.lead_id = LeadIdSequence.get_next_lead_id()

        # Synchronize name, title, contact_name
        if not self.name:
            self.name = self.title or self.contact_name or "New Lead"
        if not self.title:
            self.title = self.name
        if not self.contact_name:
            self.contact_name = self.name

        # Pipeline initialization rule: assign to initial configured stage if not assigned
        if not self.stage_id:
            initial_stage = PipelineStage.objects.filter(is_active=True).order_by('order').first()
            if initial_stage:
                self.stage = initial_stage

        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.assigned_employee_id:
            if self.assigned_employee.role not in ['SALES_EMPLOYEE', 'MANAGER']:
                raise ValidationError({
                    'assigned_employee': "Assigned user must have the Sales Employee or Manager role."
                })

            if self.assigned_employee.role == 'SALES_EMPLOYEE':
                if self.assigned_employee.team_id != self.team_id:
                    raise ValidationError({
                        'assigned_employee': f"Assigned employee '{self.assigned_employee.username}' does not belong to team '{self.team.name}'."
                    })
            elif self.assigned_employee.role == 'MANAGER':
                managed_team = getattr(self.assigned_employee, 'managed_team', None)
                authorized_team_id = managed_team.id if managed_team else self.assigned_employee.team_id
                if authorized_team_id != self.team_id:
                    raise ValidationError({
                        'assigned_employee': f"Manager '{self.assigned_employee.username}' does not manage team '{self.team.name}'."
                    })

    @property
    def is_unassigned(self):
        return self.assigned_employee_id is None

    def __str__(self):
        emp = self.assigned_employee.username if self.assigned_employee else "Unassigned"
        return f"{self.lead_id} - {self.name} ({self.team.name} - {emp})"

class LeadAssignmentHistory(models.Model):
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name='assignment_history'
    )
    from_team = models.ForeignKey(
        'teams.Team',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    to_team = models.ForeignKey(
        'teams.Team',
        on_delete=models.PROTECT,
        related_name='+'
    )
    from_employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    to_employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='+'
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='+'
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Lead {self.lead.lead_id}: {self.from_employee} -> {self.to_employee} by {self.changed_by}"

class LeadStageHistory(models.Model):
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name='stage_history'
    )
    from_stage = models.ForeignKey(
        PipelineStage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    to_stage = models.ForeignKey(
        PipelineStage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='+'
    )
    note = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Lead {self.lead.lead_id}: {self.from_stage} -> {self.to_stage} by {self.changed_by}"


class LeadImportBatch(models.Model):
    batch_id = models.CharField(max_length=64, unique=True, db_index=True)
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20)
    total_rows = models.IntegerField(default=0)
    valid_rows = models.IntegerField(default=0)
    imported_rows = models.IntegerField(default=0)
    rejected_rows = models.IntegerField(default=0)
    duplicate_rows = models.IntegerField(default=0)
    stage = models.ForeignKey(PipelineStage, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    assignment_mode = models.CharField(max_length=50)
    source = models.CharField(max_length=100, blank=True, default='')
    priority = models.CharField(max_length=50, blank=True, default='Medium')
    batch_note = models.TextField(blank=True, default='')
    distribution = models.JSONField(default=dict, blank=True)
    errors = models.JSONField(default=list, blank=True)
    imported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='import_batches')
    status = models.CharField(max_length=30, default='COMPLETED')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Import Batch {self.batch_id} ({self.file_name}) by {self.imported_by.username} - {self.imported_rows} leads"
