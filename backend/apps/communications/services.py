import requests
from django.conf import settings
from django.core.mail import send_mail
from .models import CommunicationChannel, CommunicationStatus, CommunicationLog

class IntegrationBlockerException(Exception):
    pass

class CommunicationService:
    @staticmethod
    def send_email(lead, subject, body, user):
        """
        Sends email through Google SMTP.
        Does not simulate success. Validates credentials first.
        """
        user_email = getattr(settings, 'EMAIL_HOST_USER', '')
        password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')

        if not user_email or not password:
            error_msg = "Google SMTP integration blocker: EMAIL_HOST_USER and EMAIL_HOST_PASSWORD are not configured in environment."
            CommunicationLog.objects.create(
                lead=lead,
                channel=CommunicationChannel.EMAIL,
                recipient=lead.email or "N/A",
                subject=subject,
                content=body,
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
                subject=subject,
                content=body,
                status=CommunicationStatus.FAILED,
                error_message=error_msg,
                initiated_by=user
            )
            raise ValueError(error_msg)

        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[lead.email],
                fail_silently=False
            )
            log = CommunicationLog.objects.create(
                lead=lead,
                channel=CommunicationChannel.EMAIL,
                recipient=lead.email,
                subject=subject,
                content=body,
                status=CommunicationStatus.SUCCESS,
                initiated_by=user
            )
            return log
        except Exception as e:
            error_msg = f"Google SMTP delivery error: {str(e)}"
            CommunicationLog.objects.create(
                lead=lead,
                channel=CommunicationChannel.EMAIL,
                recipient=lead.email,
                subject=subject,
                content=body,
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
