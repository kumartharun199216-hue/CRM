from django.db import models
from django.conf import settings

class CommunicationChannel(models.TextChoices):
    EMAIL = 'EMAIL', 'Email'
    WHATSAPP = 'WHATSAPP', 'WhatsApp'
    CALL = 'CALL', 'Callyzer Call'

class CommunicationStatus(models.TextChoices):
    SUCCESS = 'SUCCESS', 'Success'
    FAILED = 'FAILED', 'Failed'
    BLOCKED = 'BLOCKED', 'Blocked (Unconfigured or Unverified)'

class CommunicationTemplate(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default='')
    channel = models.CharField(
        max_length=20,
        choices=[
            (CommunicationChannel.EMAIL, 'Email'),
            (CommunicationChannel.WHATSAPP, 'WhatsApp'),
        ],
        default=CommunicationChannel.EMAIL
    )
    subject = models.CharField(max_length=255, blank=True, help_text="Used for email templates")
    body = models.TextField()
    body_format = models.CharField(
        max_length=10,
        choices=[('PLAIN', 'Plain Text'), ('HTML', 'HTML')],
        default='PLAIN'
    )
    is_active = models.BooleanField(default=True)
    team = models.ForeignKey(
        'teams.Team',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='communication_templates',
        help_text="Null indicates organization-wide template (Admin only)"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='communication_templates'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_communication_templates'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        scope = f" [{self.team.name}]" if self.team else " [Organization-wide]"
        return f"[{self.get_channel_display()}]{scope} {self.name}"

    @property
    def attachments_count(self):
        return self.attachments.count()

class TemplateAttachment(models.Model):
    template = models.ForeignKey(
        CommunicationTemplate,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(upload_to='template_attachments/%Y/%m/')
    original_filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(help_text="File size in bytes")
    content_type = models.CharField(max_length=100, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_template_attachments'
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['uploaded_at']

    def __str__(self):
        return f"{self.original_filename} ({self.file_size_display})"

    @property
    def file_size_display(self):
        if self.file_size < 1024:
            return f"{self.file_size} B"
        elif self.file_size < 1024 * 1024:
            return f"{self.file_size / 1024:.1f} KB"
        else:
            return f"{self.file_size / (1024 * 1024):.1f} MB"

    def delete(self, *args, **kwargs):
        storage, path = self.file.storage, self.file.name
        super().delete(*args, **kwargs)
        if path and storage.exists(path):
            try:
                storage.delete(path)
            except Exception:
                pass

class CommunicationLog(models.Model):
    lead = models.ForeignKey(
        'leads.Lead',
        on_delete=models.CASCADE,
        related_name='communication_logs'
    )
    channel = models.CharField(max_length=20, choices=CommunicationChannel.choices)
    recipient = models.CharField(max_length=255)
    subject = models.CharField(max_length=255, blank=True)
    content = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=CommunicationStatus.choices)
    error_message = models.TextField(blank=True)
    external_reference_id = models.CharField(max_length=255, blank=True)
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='initiated_communications'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.channel} to {self.recipient} [{self.status}]"
