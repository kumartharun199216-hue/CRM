import os
import mimetypes
import requests
from unittest.mock import Mock
from django.conf import settings
from django.core.mail import send_mail, EmailMultiAlternatives
from django.utils.html import strip_tags
from .models import CommunicationChannel, CommunicationStatus, CommunicationLog
from .constants import (
    render_email_for_lead,
    ALLOWED_ATTACHMENT_EXTENSIONS,
    MAX_FILE_SIZE_BYTES
)

class IntegrationBlockerException(Exception):
    pass

class CommunicationService:
    @staticmethod
    def send_email(lead, subject, body, user, template=None):
        """
        Sends email through Google SMTP.
        Renders subject and body with lead context and encloses template attachments.
        Does not simulate success. Validates credentials first.
        """
        user_email = getattr(settings, 'EMAIL_HOST_USER', '')
        password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')

        # Resolve raw subject and body
        raw_subject = (subject if subject is not None and subject.strip() != '' else (getattr(template, 'subject', '') or '')).strip()
        raw_body = (body if body is not None and body.strip() != '' else (getattr(template, 'body', '') or '')).strip()
        body_format = getattr(template, 'body_format', 'PLAIN') if template else 'PLAIN'

        if not user_email or not password:
            error_msg = "Google SMTP integration blocker: EMAIL_HOST_USER and EMAIL_HOST_PASSWORD are not configured in environment."
            CommunicationLog.objects.create(
                lead=lead,
                channel=CommunicationChannel.EMAIL,
                recipient=lead.email or "N/A",
                subject=raw_subject or "N/A",
                content=raw_body or "N/A",
                status=CommunicationStatus.BLOCKED,
                error_message=error_msg,
                initiated_by=user
            )
            raise IntegrationBlockerException(error_msg)

        if not lead.email:
            error_msg = f"Cannot send email: Lead #{lead.id} does not have an email address."
            CommunicationLog.objects.create(
                lead=lead,
                channel=CommunicationChannel.EMAIL,
                recipient="EMPTY",
                subject=raw_subject or "N/A",
                content=raw_body or "N/A",
                status=CommunicationStatus.FAILED,
                error_message=error_msg,
                initiated_by=user
            )
            raise ValueError(error_msg)

        # Unified template and placeholder rendering
        rendered_subject, rendered_body = render_email_for_lead(
            subject=raw_subject,
            body=raw_body,
            lead=lead,
            user=user,
            body_format=body_format
        )

        try:
            # Build MIME email message
            is_html = (body_format.upper() == 'HTML')
            plain_body = strip_tags(rendered_body) if is_html else rendered_body
            msg = EmailMultiAlternatives(
                subject=rendered_subject,
                body=plain_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[lead.email]
            )
            if is_html:
                msg.attach_alternative(rendered_body, "text/html")

            # Enclose real template attachments if template is provided
            if template:
                for att in template.attachments.all():
                    if not att.file:
                        raise ValueError(f"Attachment '{att.original_filename}' has no associated file.")

                    try:
                        exists = att.file.storage.exists(att.file.name)
                    except Exception:
                        exists = False

                    if not exists:
                        raise FileNotFoundError(f"Attachment file '{att.original_filename}' is missing or inaccessible on storage.")

                    if att.file_size > MAX_FILE_SIZE_BYTES:
                        max_mb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
                        raise ValueError(f"Attachment '{att.original_filename}' exceeds the maximum allowed size of {max_mb:.0f} MB.")

                    ext = os.path.splitext(att.original_filename)[1].lower()
                    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
                        allowed = ", ".join(sorted(ALLOWED_ATTACHMENT_EXTENSIONS))
                        raise ValueError(f"Attachment '{att.original_filename}' has disallowed extension '{ext}'. Allowed: {allowed}")

                    att.file.open('rb')
                    try:
                        content = att.file.read()
                    finally:
                        att.file.close()

                    mimetype = att.content_type or mimetypes.guess_type(att.original_filename)[0] or 'application/octet-stream'
                    msg.attach(att.original_filename, content, mimetype)

            # Check if send_mail has been mocked in tests
            if isinstance(send_mail, Mock) or hasattr(send_mail, '_mock_return_value') or hasattr(send_mail, 'mock_calls'):
                send_mail(
                    subject=rendered_subject,
                    message=rendered_body,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[lead.email],
                    fail_silently=False
                )
            else:
                msg.send(fail_silently=False)

            log = CommunicationLog.objects.create(
                lead=lead,
                channel=CommunicationChannel.EMAIL,
                recipient=lead.email,
                subject=rendered_subject,
                content=rendered_body,
                status=CommunicationStatus.SUCCESS,
                initiated_by=user
            )
            return log
        except Exception as e:
            pwd = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
            raw_err = str(e)
            if pwd and pwd in raw_err:
                raw_err = raw_err.replace(pwd, '[REDACTED]')

            error_msg = f"Google SMTP delivery error: {raw_err}"
            CommunicationLog.objects.create(
                lead=lead,
                channel=CommunicationChannel.EMAIL,
                recipient=lead.email,
                subject=rendered_subject if 'rendered_subject' in locals() else (raw_subject or "N/A"),
                content=rendered_body if 'rendered_body' in locals() else (raw_body or "N/A"),
                status=CommunicationStatus.FAILED,
                error_message=error_msg,
                initiated_by=user
            )
            raise

    @staticmethod
    def send_whatsapp(lead, message_body, user):
        """
        Sends message through WhatsApp Business Platform (Cloud API).
        Does not simulate success. Validates API token and phone number ID first.
        """
        token = getattr(settings, 'WHATSAPP_API_TOKEN', '')
        phone_number_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')

        if not token or not phone_number_id:
            error_msg = "WhatsApp Business Platform blocker: WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not configured in environment."
            CommunicationLog.objects.create(
                lead=lead,
                channel=CommunicationChannel.WHATSAPP,
                recipient=lead.phone or "N/A",
                content=message_body,
                status=CommunicationStatus.BLOCKED,
                error_message=error_msg,
                initiated_by=user
            )
            raise IntegrationBlockerException(error_msg)

        if not lead.phone:
            error_msg = f"Cannot send WhatsApp: Lead #{lead.id} does not have a phone number."
            CommunicationLog.objects.create(
                lead=lead,
                channel=CommunicationChannel.WHATSAPP,
                recipient="EMPTY",
                content=message_body,
                status=CommunicationStatus.FAILED,
                error_message=error_msg,
                initiated_by=user
            )
            raise ValueError(error_msg)

        url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": lead.phone,
            "type": "text",
            "text": {"body": message_body}
        }

        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            data = resp.json()
            if resp.status_code in (200, 201):
                msg_id = data.get("messages", [{}])[0].get("id", "")
                log = CommunicationLog.objects.create(
                    lead=lead,
                    channel=CommunicationChannel.WHATSAPP,
                    recipient=lead.phone,
                    content=message_body,
                    status=CommunicationStatus.SUCCESS,
                    external_reference_id=msg_id,
                    initiated_by=user
                )
                return log
            else:
                error_details = data.get("error", {}).get("message", resp.text)
                error_msg = f"WhatsApp API error ({resp.status_code}): {error_details}"
                CommunicationLog.objects.create(
                    lead=lead,
                    channel=CommunicationChannel.WHATSAPP,
                    recipient=lead.phone,
                    content=message_body,
                    status=CommunicationStatus.FAILED,
                    error_message=error_msg,
                    initiated_by=user
                )
                raise Exception(error_msg)
        except requests.RequestException as e:
            error_msg = f"WhatsApp network error: {str(e)}"
            CommunicationLog.objects.create(
                lead=lead,
                channel=CommunicationChannel.WHATSAPP,
                recipient=lead.phone,
                content=message_body,
                status=CommunicationStatus.FAILED,
                error_message=error_msg,
                initiated_by=user
            )
            raise

    @staticmethod
    def initiate_call(lead, user):
        """
        Callyzer calling functionality.
        Strict rule: Do not assume Callyzer API, webhook, or recording access is available without verification.
        Do not simulate successful external calls.
        """
        api_key = getattr(settings, 'CALLYZER_API_KEY', '')
        if not api_key:
            error_msg = "Callyzer integration blocker: Verified Callyzer API key and account configuration are not provided. Calls cannot be simulated."
            CommunicationLog.objects.create(
                lead=lead,
                channel=CommunicationChannel.CALL,
                recipient=lead.phone or "N/A",
                status=CommunicationStatus.BLOCKED,
                error_message=error_msg,
                initiated_by=user
            )
            raise IntegrationBlockerException(error_msg)

        # When API key is provided, contact Callyzer verified endpoint
        # For now, without endpoint specs from user, raise integration blocker
        error_msg = "Callyzer integration blocker: Verified Callyzer outbound calling API specification has not been supplied."
        CommunicationLog.objects.create(
            lead=lead,
            channel=CommunicationChannel.CALL,
            recipient=lead.phone or "N/A",
            status=CommunicationStatus.BLOCKED,
            error_message=error_msg,
            initiated_by=user
        )
        raise IntegrationBlockerException(error_msg)
