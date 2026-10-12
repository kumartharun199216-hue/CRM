import os
import pytest
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework import status

from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import Lead
from apps.communications.models import (
    CommunicationTemplate,
    TemplateAttachment,
    CommunicationLog,
    CommunicationStatus,
    CommunicationChannel
)

@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    EMAIL_HOST_USER='lasyalasya153@gmail.com',
    EMAIL_HOST_PASSWORD='testpassword123',
    DEFAULT_FROM_EMAIL='Skill Move CRM <lasyalasya153@gmail.com>',
    CRM_COMPANY_NAME='Skill Move Sales CRM'
)
class TestEmailDeliveryAndRendering(APITestCase):
    def setUp(self):

        # Admin
        self.admin = User.objects.create_superuser(
            username="admin_delivery",
            email="admin_delivery@skillmove.com",
            password="Password123!",
            role=UserRole.ADMIN
        )

        # Team A
        self.team_a = Team.objects.create(name="Alpha Sales Team")
        self.manager_a = User.objects.create_user(
            username="manager_a",
            email="manager_a@skillmove.com",
            password="Password123!",
            first_name="Priya",
            last_name="Patel",
            role=UserRole.MANAGER,
            team=self.team_a
        )
        self.team_a.manager = self.manager_a
        self.team_a.save()

        self.employee_a = User.objects.create_user(
            username="employee_a",
            email="employee_a@skillmove.com",
            password="Password123!",
            first_name="Arjun",
            last_name="Mehta",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_a
        )

        # Team B
        self.team_b = Team.objects.create(name="Beta Sales Team")
        self.manager_b = User.objects.create_user(
            username="manager_b",
            email="manager_b@skillmove.com",
            password="Password123!",
            role=UserRole.MANAGER,
            team=self.team_b
        )
        self.team_b.manager = self.manager_b
        self.team_b.save()

        self.employee_b = User.objects.create_user(
            username="employee_b",
            email="employee_b@skillmove.com",
            password="Password123!",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_b
        )

        # Lead for employee A
        self.lead_a = Lead.objects.create(
            title="Rahul Sharma Inquiry",
            name="Rahul Sharma",
            contact_name="Rahul Sharma",
            email="rahul.sharma@example.com",
            phone="+919876543210",
            team=self.team_a,
            assigned_employee=self.employee_a,
            created_by=self.manager_a
        )

        # Lead for employee B
        self.lead_b = Lead.objects.create(
            title="Sneha Rao Inquiry",
            name="Sneha Rao",
            contact_name="Sneha Rao",
            email="sneha.rao@example.com",
            phone="+919876543211",
            team=self.team_b,
            assigned_employee=self.employee_b,
            created_by=self.manager_b
        )

        mail.outbox.clear()

    # =========================================================================
    # 1. PLACEHOLDER RENDERING TESTS
    # =========================================================================

    def test_all_placeholders_substituted_in_real_sent_email(self):
        """
        Verify lead_name, lead_email, lead_phone, employee_name, company_name
        are fully replaced with real database values in outgoing email message.
        """
        template = CommunicationTemplate.objects.create(
            name="Welcome Intro",
            channel=CommunicationChannel.EMAIL,
            subject="Welcome to {{company_name}}, {{lead_name}}!",
            body=(
                "Dear {{lead_name}},\n\n"
                "Thank you for contacting {{company_name}}. "
                "Your assigned counsellor is {{employee_name}}.\n"
                "We have your email on file as {{lead_email}} and phone as {{lead_phone}}.\n\n"
                "Regards,\n{{employee_name}}"
            ),
            body_format="PLAIN",
            team=self.team_a,
            created_by=self.manager_a
        )

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead_a.id,
            'template_id': template.id,
        })

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1

        sent_msg = mail.outbox[0]
        assert sent_msg.to == [self.lead_a.email]

        # Check subject
        assert sent_msg.subject == "Welcome to Skill Move Sales CRM, Rahul Sharma!"
        assert "{{company_name}}" not in sent_msg.subject
        assert "{{lead_name}}" not in sent_msg.subject

        # Check body
        expected_emp = "Arjun Mehta"
        assert f"Dear Rahul Sharma," in sent_msg.body
        assert f"Thank you for contacting Skill Move Sales CRM." in sent_msg.body
        assert f"Your assigned counsellor is {expected_emp}." in sent_msg.body
        assert f"email on file as {self.lead_a.email}" in sent_msg.body
        assert f"phone as {self.lead_a.phone}" in sent_msg.body
        assert f"Regards,\n{expected_emp}" in sent_msg.body

        # Confirm no raw placeholder tokens leaked
        assert "{{" not in sent_msg.body
        assert "}}" not in sent_msg.body

    def test_alias_placeholders_name_email_phone_substituted(self):
        """Verify {{name}}, {{email}}, and {{phone}} aliases are rendered."""
        template = CommunicationTemplate.objects.create(
            name="Short Note",
            channel=CommunicationChannel.EMAIL,
            subject="Hello {{name}}",
            body="Hi {{name}}, we will reach you at {{email}} and {{phone}}.",
            body_format="PLAIN",
            team=self.team_a,
            created_by=self.manager_a
        )

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead_a.id,
            'template_id': template.id,
        })

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.subject == "Hello Rahul Sharma"
        assert msg.body == "Hi Rahul Sharma, we will reach you at rahul.sharma@example.com and +919876543210."

    def test_html_email_values_are_escaped_appropriately(self):
        """Untrusted lead values containing HTML entities are properly escaped in HTML body."""
        # Create lead with characters that must be escaped
        unsafe_lead = Lead.objects.create(
            title="Unsafe Lead",
            name="Vikram <script>alert('xss')</script> & Sons",
            email="vikram@example.com",
            phone="+919876543219",
            team=self.team_a,
            assigned_employee=self.employee_a,
            created_by=self.manager_a
        )

        template = CommunicationTemplate.objects.create(
            name="HTML Welcome",
            channel=CommunicationChannel.EMAIL,
            subject="Welcome {{lead_name}}",
            body="<h1>Hello {{lead_name}}</h1><p>Welcome to our platform.</p>",
            body_format="HTML",
            team=self.team_a,
            created_by=self.manager_a
        )

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': unsafe_lead.id,
            'template_id': template.id,
        })

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]

        # Subject must be plain text (no HTML entity conversion)
        assert msg.subject == "Welcome Vikram <script>alert('xss')</script> & Sons"

        # HTML body alternative must have escaped entities
        html_alternatives = [content for content, mimetype in msg.alternatives if mimetype == 'text/html']
        assert len(html_alternatives) == 1
        html_content = html_alternatives[0]
        assert "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt; &amp; Sons" in html_content
        assert "<script>" not in html_content

    def test_missing_required_placeholder_value_returns_clear_error(self):
        """If template contains {{lead_phone}} but lead has no phone number, returns 400 validation error."""
        lead_no_phone = Lead.objects.create(
            title="No Phone Lead",
            name="Anita Roy",
            email="anita@example.com",
            phone="",
            team=self.team_a,
            assigned_employee=self.employee_a,
            created_by=self.manager_a
        )

        template = CommunicationTemplate.objects.create(
            name="Phone Verification",
            channel=CommunicationChannel.EMAIL,
            subject="Confirm your number",
            body="Hello {{lead_name}}, please confirm {{lead_phone}}.",
            body_format="PLAIN",
            team=self.team_a,
            created_by=self.manager_a
        )

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': lead_no_phone.id,
            'template_id': template.id,
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "lead_phone" in str(response.data)
        assert len(mail.outbox) == 0

    def test_unsupported_placeholder_does_not_leak_into_sent_email(self):
        """Unsupported or unresolved placeholders return a validation error and do not dispatch."""
        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead_a.id,
            'subject': "Confidential {{unknown_var}}",
            'body': "Hello {{lead_name}}, your code is {{unsupported_token}}."
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Unsupported placeholder" in str(response.data)
        assert len(mail.outbox) == 0

    # =========================================================================
    # 2. ATTACHMENT DELIVERY TESTS
    # =========================================================================

    def test_template_without_attachments_sends_successfully(self):
        """A template without attachments delivers successfully with 0 attachments attached."""
        template = CommunicationTemplate.objects.create(
            name="Plain Notice",
            channel=CommunicationChannel.EMAIL,
            subject="Notice for {{lead_name}}",
            body="Hello {{lead_name}}, this is a notice.",
            body_format="PLAIN",
            team=self.team_a,
            created_by=self.manager_a
        )

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead_a.id,
            'template_id': template.id,
        })

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert len(msg.attachments) == 0

    def test_template_with_single_pdf_attaches_actual_file_bytes(self):
        """A template with 1 PDF attachment attaches the real binary bytes to the outgoing MIME message."""
        template = CommunicationTemplate.objects.create(
            name="Offer Letter Template",
            channel=CommunicationChannel.EMAIL,
            subject="Offer Letter for {{lead_name}}",
            body="Dear {{lead_name}}, please find attached your offer.",
            body_format="PLAIN",
            team=self.team_a,
            created_by=self.manager_a
        )

        pdf_bytes = b"%PDF-1.4\n%real pdf binary content test 12345\n%%EOF"
        pdf_file = SimpleUploadedFile("SkillMove_Offer.pdf", pdf_bytes, content_type="application/pdf")

        att = TemplateAttachment.objects.create(
            template=template,
            file=pdf_file,
            original_filename="SkillMove_Offer.pdf",
            file_size=len(pdf_bytes),
            content_type="application/pdf",
            uploaded_by=self.manager_a
        )

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead_a.id,
            'template_id': template.id,
        })

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]

        # Validate MIME attachment
        assert len(msg.attachments) == 1
        filename, content, mimetype = msg.attachments[0]
        assert filename == "SkillMove_Offer.pdf"
        assert content == pdf_bytes
        assert mimetype == "application/pdf"

        # Clean up storage
        att.delete()

    def test_template_with_multiple_attachments_includes_all_files(self):
        """A template with multiple attachments includes all files with correct filenames and MIME types."""
        template = CommunicationTemplate.objects.create(
            name="Package Template",
            channel=CommunicationChannel.EMAIL,
            subject="Course Enrolment Package",
            body="Hello {{lead_name}}, please review the enclosed documents.",
            body_format="PLAIN",
            team=self.team_a,
            created_by=self.manager_a
        )

        pdf_bytes = b"%PDF-1.4 Brochure content"
        png_bytes = b"\x89PNG\r\n\x1a\nFake PNG bytes"

        att1 = TemplateAttachment.objects.create(
            template=template,
            file=SimpleUploadedFile("Brochure.pdf", pdf_bytes, content_type="application/pdf"),
            original_filename="Brochure.pdf",
            file_size=len(pdf_bytes),
            content_type="application/pdf",
            uploaded_by=self.manager_a
        )
        att2 = TemplateAttachment.objects.create(
            template=template,
            file=SimpleUploadedFile("Logo.png", png_bytes, content_type="image/png"),
            original_filename="Logo.png",
            file_size=len(png_bytes),
            content_type="image/png",
            uploaded_by=self.manager_a
        )

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead_a.id,
            'template_id': template.id,
        })

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]

        assert len(msg.attachments) == 2
        filenames = [att[0] for att in msg.attachments]
        contents = [att[1] for att in msg.attachments]
        mimetypes = [att[2] for att in msg.attachments]

        assert "Brochure.pdf" in filenames
        assert "Logo.png" in filenames
        assert pdf_bytes in contents
        assert png_bytes in contents
        assert "application/pdf" in mimetypes
        assert "image/png" in mimetypes

        # Clean up
        att1.delete()
        att2.delete()

    def test_deleted_attachments_are_excluded_from_future_sends(self):
        """When an attachment is removed from a template, future sends do not include it."""
        template = CommunicationTemplate.objects.create(
            name="Dynamic Attachments Template",
            channel=CommunicationChannel.EMAIL,
            subject="Updates for {{lead_name}}",
            body="Hello {{lead_name}}, please find files.",
            body_format="PLAIN",
            team=self.team_a,
            created_by=self.manager_a
        )

        pdf_bytes = b"%PDF-1.4 file 1"
        txt_bytes = b"Text file 2"

        att_pdf = TemplateAttachment.objects.create(
            template=template,
            file=SimpleUploadedFile("doc1.pdf", pdf_bytes, content_type="application/pdf"),
            original_filename="doc1.pdf",
            file_size=len(pdf_bytes),
            content_type="application/pdf",
            uploaded_by=self.manager_a
        )
        att_txt = TemplateAttachment.objects.create(
            template=template,
            file=SimpleUploadedFile("doc2.txt", txt_bytes, content_type="text/plain"),
            original_filename="doc2.txt",
            file_size=len(txt_bytes),
            content_type="text/plain",
            uploaded_by=self.manager_a
        )

        # Delete the text file attachment
        att_txt.delete()

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead_a.id,
            'template_id': template.id,
        })

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]

        # Only doc1.pdf should be present
        assert len(msg.attachments) == 1
        assert msg.attachments[0][0] == "doc1.pdf"
        assert msg.attachments[0][1] == pdf_bytes

        att_pdf.delete()

    def test_missing_stored_file_produces_safe_error(self):
        """If storage file is missing on disk, return safe error without stack traces."""
        template = CommunicationTemplate.objects.create(
            name="Corrupted Attachment Template",
            channel=CommunicationChannel.EMAIL,
            subject="Corrupt file test",
            body="Hello {{lead_name}}",
            body_format="PLAIN",
            team=self.team_a,
            created_by=self.manager_a
        )

        att = TemplateAttachment.objects.create(
            template=template,
            file=SimpleUploadedFile("missing.pdf", b"test", content_type="application/pdf"),
            original_filename="missing.pdf",
            file_size=4,
            content_type="application/pdf",
            uploaded_by=self.manager_a
        )
        # Physically delete the file from storage while keeping DB record
        if att.file and att.file.storage.exists(att.file.name):
            att.file.storage.delete(att.file.name)

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead_a.id,
            'template_id': template.id,
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "missing or inaccessible" in response.data.get("error", "")
        assert len(mail.outbox) == 0

        # Check log marked FAILED
        log = CommunicationLog.objects.filter(lead=self.lead_a).first()
        assert log is not None
        assert log.status == CommunicationStatus.FAILED

        att.delete()

    # =========================================================================
    # 3. AUTHORIZATION & ACCESS CONTROL TESTS
    # =========================================================================

    def test_sales_employee_cannot_send_other_teams_restricted_template(self):
        """Sales Employee in Team A cannot send a template restricted to Team B."""
        template_b = CommunicationTemplate.objects.create(
            name="Team B Internal Template",
            channel=CommunicationChannel.EMAIL,
            subject="Team B Confidential",
            body="Hello {{lead_name}}",
            team=self.team_b,
            created_by=self.manager_b
        )

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead_a.id,
            'template_id': template_b.id,
        })

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert len(mail.outbox) == 0

    def test_sales_employee_cannot_send_email_to_another_employees_lead(self):
        """Sales Employee in Team A cannot send an email to a lead assigned to Employee in Team B."""
        template_a = CommunicationTemplate.objects.create(
            name="Team A Template",
            channel=CommunicationChannel.EMAIL,
            subject="Team A Notice",
            body="Hello {{lead_name}}",
            team=self.team_a,
            created_by=self.manager_a
        )

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead_b.id,  # Lead belongs to Team B / Employee B
            'template_id': template_a.id,
        })

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert len(mail.outbox) == 0

    def test_inactive_template_cannot_be_sent_by_sales_employee(self):
        """Sales Employee cannot send an inactive template."""
        inactive_template = CommunicationTemplate.objects.create(
            name="Old Template",
            channel=CommunicationChannel.EMAIL,
            subject="Old subject",
            body="Hello {{lead_name}}",
            is_active=False,
            team=self.team_a,
            created_by=self.manager_a
        )

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead_a.id,
            'template_id': inactive_template.id,
        })

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert len(mail.outbox) == 0

    def test_custom_edited_body_with_template_still_resolves_placeholders_and_attachments(self):
        """
        When user selects template with attachments and modifies body in compose box,
        placeholders in edited text are rendered and attachments are delivered.
        """
        template = CommunicationTemplate.objects.create(
            name="Base Template",
            channel=CommunicationChannel.EMAIL,
            subject="Base Subject {{lead_name}}",
            body="Standard body.",
            team=self.team_a,
            created_by=self.manager_a
        )
        pdf_bytes = b"%PDF-1.4 Custom edited content"
        att = TemplateAttachment.objects.create(
            template=template,
            file=SimpleUploadedFile("custom.pdf", pdf_bytes, content_type="application/pdf"),
            original_filename="custom.pdf",
            file_size=len(pdf_bytes),
            content_type="application/pdf",
            uploaded_by=self.manager_a
        )

        self.client.force_authenticate(user=self.employee_a)
        response = self.client.post('/api/communications/send-email/', {
            'lead_id': self.lead_a.id,
            'template_id': template.id,
            'subject': "Personalized for {{lead_name}}",
            'body': "Hello {{lead_name}}, this is customized by {{employee_name}}."
        })

        assert response.status_code == status.HTTP_200_OK
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]

        assert msg.subject == "Personalized for Rahul Sharma"
        assert msg.body == "Hello Rahul Sharma, this is customized by Arjun Mehta."
        assert len(msg.attachments) == 1
        assert msg.attachments[0][0] == "custom.pdf"
        assert msg.attachments[0][1] == pdf_bytes

        att.delete()
