from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

class Team(models.Model):
    name = models.CharField(max_length=150, unique=True)
    description = models.TextField(blank=True, default='', help_text='Team purpose or department description.')
    manager = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='managed_team',
        help_text='Each team has at most one designated Manager in the initial model.'
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text='Indicates whether team is active for new employee and lead assignments.'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()
        if self.manager and self.manager.role != 'MANAGER' and not self.manager.is_superuser:
            raise ValidationError({'manager': 'The designated manager must have the Manager role.'})
        if self.pk and not self.is_active:
            leads_count = self.leads.count()
            if leads_count > 0:
                raise ValidationError({
                    'is_active': (
                        f"Cannot deactivate team '{self.name}' because it contains {leads_count} lead(s). "
                        "Leads must be transferred or reassigned before deactivating the team."
                    )
                })

    def delete(self, *args, **kwargs):
        leads_count = self.leads.count()
        if leads_count > 0:
            raise ValidationError(
                f"Cannot delete team '{self.name}' because it contains {leads_count} associated lead(s). "
                "Leads must be reassigned or transferred before the team can be deleted."
            )
        members_count = self.members.count()
        if members_count > 0:
            raise ValidationError(
                f"Cannot delete team '{self.name}' because it has {members_count} assigned employee(s). "
                "Employees must be transferred or reassigned before the team can be deleted."
            )
        super().delete(*args, **kwargs)

    def __str__(self):
        manager_name = self.manager.username if self.manager else "No Manager"
        status_str = "Active" if self.is_active else "Inactive"
        return f"{self.name} (Manager: {manager_name}, {status_str})"
