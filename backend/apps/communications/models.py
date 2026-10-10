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
    channel = models.CharField(
        max_length=20,
        choices=[
            (CommunicationChannel.EMAIL, 'Email'),
            (CommunicationChannel.WHATSAPP, 'WhatsApp'),
        ]
    )
    subject = models.CharField(max_length=255, blank=True, help_text="Used for email templates")
    body = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='communication_templates'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.get_channel_display()}] {self.name}"

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
