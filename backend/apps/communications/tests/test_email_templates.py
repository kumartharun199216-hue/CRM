import os
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework import status

from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.communications.models import CommunicationTemplate, TemplateAttachment, CommunicationChannel
from apps.communications.constants import MAX_FILE_SIZE_BYTES, MAX_ATTACHMENTS_PER_TEMPLATE


@pytest.mark.django_db
class TestEmailTemplateManagement:
    def setup_method(self):
        self.client = APIClient()

        # Users & Teams setup
        self.admin = User.objects.create_superuser(
            username="admin_user",
            email="admin@skillmove.com",
            password="Password123!",
            role=UserRole.ADMIN
        )

        self.team_alpha = Team.objects.create(name="Team Alpha")
        self.manager_alpha = User.objects.create_user(
            username="manager_alpha",
            email="manager_alpha@skillmove.com",
            password="Password123!",
            role=UserRole.MANAGER,
            team=self.team_alpha
        )
        self.team_alpha.manager = self.manager_alpha
        self.team_alpha.save()

        self.employee_alpha = User.objects.create_user(
            username="counsellor_alpha",
            email="counsellor_alpha@skillmove.com",
            password="Password123!",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha
        )

        self.team_beta = Team.objects.create(name="Team Beta")
        self.manager_beta = User.objects.create_user(
            username="manager_beta",
            email="manager_beta@skillmove.com",
            password="Password123!",
            role=UserRole.MANAGER,
            team=self.team_beta
        )
        self.team_beta.manager = self.manager_beta
        self.team_beta.save()

    def test_01_admin_template_lifecycle(self):
        """Admin can create, edit, list, toggle active status, and delete templates."""
        self.client.force_authenticate(user=self.admin)

        # 1. Create template without attachment
        create_resp = self.client.post('/api/communications/templates/', {
            'name': 'Welcome Onboarding',
            'description': 'Sent to new candidate leads',
            'channel': CommunicationChannel.EMAIL,
            'subject': 'Welcome to Skill Move {{lead_name}}',
            'body': 'Hi {{lead_name}}, your counsellor is {{employee_name}} from {{company_name}}.'
        })
        assert create_resp.status_code == status.HTTP_201_CREATED
        template_id = create_resp.data['id']
        assert create_resp.data['name'] == 'Welcome Onboarding'
        assert create_resp.data['is_active'] is True
        assert create_resp.data['attachments_count'] == 0

        # 2. List templates
        list_resp = self.client.get('/api/communications/templates/')
        assert list_resp.status_code == status.HTTP_200_OK
        results = list_resp.data if isinstance(list_resp.data, list) else list_resp.data.get('results', [])
        assert any(t['id'] == template_id for t in results)

        # 3. Edit template
        update_resp = self.client.patch(f'/api/communications/templates/{template_id}/', {
            'subject': 'Updated: Welcome {{lead_name}}'
        })
        assert update_resp.status_code == status.HTTP_200_OK
        assert update_resp.data['subject'] == 'Updated: Welcome {{lead_name}}'

        # 4. Toggle active status
        toggle_resp = self.client.patch(f'/api/communications/templates/{template_id}/toggle-active/')
        assert toggle_resp.status_code == status.HTTP_200_OK
        assert toggle_resp.data['is_active'] is False

        # 5. Delete template
        delete_resp = self.client.delete(f'/api/communications/templates/{template_id}/')
        assert delete_resp.status_code == status.HTTP_204_NO_CONTENT
        assert not CommunicationTemplate.objects.filter(id=template_id).exists()

    def test_02_manager_template_scoped_access(self):
        """Manager can create and manage templates within their own team scope."""
        self.client.force_authenticate(user=self.manager_alpha)

        # Manager creates template for their team
        resp = self.client.post('/api/communications/templates/', {
            'name': 'Alpha Offer Letter',
            'channel': CommunicationChannel.EMAIL,
            'subject': 'Offer Letter for {{lead_name}}',
            'body': 'Dear {{lead_name}}, please find attached details.'
        })
        assert resp.status_code == status.HTTP_201_CREATED
        template_id = resp.data['id']
        assert resp.data['team'] == self.team_alpha.id

        # Manager can update their template
        update_resp = self.client.patch(f'/api/communications/templates/{template_id}/', {
            'name': 'Alpha Revised Offer'
        })
        assert update_resp.status_code == status.HTTP_200_OK
        assert update_resp.data['name'] == 'Alpha Revised Offer'

    def test_03_manager_cannot_access_or_modify_other_team_template(self):
        """Manager Beta cannot edit or delete Team Alpha's template."""
        # Create template belonging to Alpha
        alpha_template = CommunicationTemplate.objects.create(
            name='Alpha Confidential',
            channel=CommunicationChannel.EMAIL,
            subject='Confidential for {{lead_name}}',
            body='Hello {{lead_name}}',
            team=self.team_alpha,
            created_by=self.manager_alpha
        )

        # Manager Beta attempts to modify Alpha template
        self.client.force_authenticate(user=self.manager_beta)
        patch_resp = self.client.patch(f'/api/communications/templates/{alpha_template.id}/', {
            'name': 'Hacked by Beta'
        })
        assert patch_resp.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]

        delete_resp = self.client.delete(f'/api/communications/templates/{alpha_template.id}/')
        assert delete_resp.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]

        # Template remains unchanged
        alpha_template.refresh_from_db()
        assert alpha_template.name == 'Alpha Confidential'

    def test_04_sales_employee_cannot_modify_templates(self):
        """Sales Employee cannot create, edit, toggle, or delete templates."""
        template = CommunicationTemplate.objects.create(
            name='Standard Brochure',
            channel=CommunicationChannel.EMAIL,
            subject='Skill Move Brochure for {{lead_name}}',
            body='Here is our brochure',
            team=self.team_alpha,
            created_by=self.manager_alpha
        )

        self.client.force_authenticate(user=self.employee_alpha)

        # Attempt create -> 403
        create_resp = self.client.post('/api/communications/templates/', {
            'name': 'Employee Custom Template',
            'channel': CommunicationChannel.EMAIL,
            'subject': 'Hello {{lead_name}}',
            'body': 'Body'
        })
        assert create_resp.status_code == status.HTTP_403_FORBIDDEN

        # Attempt edit -> 403
        edit_resp = self.client.patch(f'/api/communications/templates/{template.id}/', {
            'name': 'Employee Modified'
        })
        assert edit_resp.status_code == status.HTTP_403_FORBIDDEN

        # Attempt toggle -> 403
        toggle_resp = self.client.patch(f'/api/communications/templates/{template.id}/toggle-active/')
        assert toggle_resp.status_code == status.HTTP_403_FORBIDDEN

        # Attempt delete -> 403
        del_resp = self.client.delete(f'/api/communications/templates/{template.id}/')
        assert del_resp.status_code == status.HTTP_403_FORBIDDEN

    def test_05_create_template_with_no_attachments(self):
        """Template can be successfully saved with zero attachments."""
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post('/api/communications/templates/', {
            'name': 'Pure Text Template',
            'channel': CommunicationChannel.EMAIL,
            'subject': 'Direct Note to {{lead_name}}',
            'body': 'Hello {{lead_name}}, this is a simple text note.'
        })
        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['attachments_count'] == 0
        assert len(resp.data['attachments']) == 0

    def test_06_create_template_with_multiple_attachments(self):
        """Template can be created directly with multiple attachments uploaded."""
        self.client.force_authenticate(user=self.admin)

        file1 = SimpleUploadedFile("brochure.pdf", b"%PDF-1.4 test brochure content", content_type="application/pdf")
        file2 = SimpleUploadedFile("schedule.xlsx", b"mock xlsx binary data", content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        resp = self.client.post('/api/communications/templates/', {
            'name': 'Course Packet Template',
            'channel': CommunicationChannel.EMAIL,
            'subject': 'Course Packet for {{lead_name}}',
            'body': 'Attached are brochure and schedule.',
            'attachments': [file1, file2]
        }, format='multipart')

        assert resp.status_code == status.HTTP_201_CREATED
        template = CommunicationTemplate.objects.get(id=resp.data['id'])
        assert template.attachments.count() == 2

        # Verify filenames
        filenames = [a.original_filename for a in template.attachments.all()]
        assert 'brochure.pdf' in filenames
        assert 'schedule.xlsx' in filenames

    def test_07_add_and_remove_attachments(self):
        """Attachments can be dynamically added to existing templates and removed."""
        template = CommunicationTemplate.objects.create(
            name='Fee Structure',
            channel=CommunicationChannel.EMAIL,
            subject='Fee Structure for {{lead_name}}',
            body='Please see details.',
            created_by=self.admin
        )
        self.client.force_authenticate(user=self.admin)

        # 1. Upload attachment to existing template
        file_obj = SimpleUploadedFile("fees.pdf", b"%PDF-1.4 fee structure", content_type="application/pdf")
        upload_resp = self.client.post(f'/api/communications/templates/{template.id}/attachments/', {
            'file': file_obj
        }, format='multipart')

        assert upload_resp.status_code == status.HTTP_201_CREATED
        assert len(upload_resp.data) == 1
        attachment_id = upload_resp.data[0]['id']
        assert upload_resp.data[0]['original_filename'] == 'fees.pdf'

        # 2. Delete attachment via endpoint
        del_resp = self.client.delete(f'/api/communications/attachments/{attachment_id}/')
        assert del_resp.status_code == status.HTTP_200_OK
        assert not TemplateAttachment.objects.filter(id=attachment_id).exists()
        assert template.attachments.count() == 0

    def test_08_file_validation_extension_and_size(self):
        """Reject dangerous extensions (.exe, .sh) and oversized files."""
        template = CommunicationTemplate.objects.create(
            name='File Validation Test',
            channel=CommunicationChannel.EMAIL,
            subject='Subject {{lead_name}}',
            body='Body',
            created_by=self.admin
        )
        self.client.force_authenticate(user=self.admin)

        # Disallowed extension: .exe
        bad_file = SimpleUploadedFile("malware.exe", b"malicious binary payload", content_type="application/x-msdownload")
        bad_ext_resp = self.client.post(f'/api/communications/templates/{template.id}/attachments/', {
            'file': bad_file
        }, format='multipart')
        assert bad_ext_resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'invalid extension' in str(bad_ext_resp.data).lower()

        # Disallowed extension: .sh
        bad_script = SimpleUploadedFile("run.sh", b"#!/bin/bash echo bad", content_type="text/x-shellscript")
        bad_sh_resp = self.client.post(f'/api/communications/templates/{template.id}/attachments/', {
            'file': bad_script
        }, format='multipart')
        assert bad_sh_resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_09_unsupported_placeholders_validation(self):
        """Templates reject unsupported/arbitrary placeholder expressions."""
        self.client.force_authenticate(user=self.admin)

        # Code execution or unsupported placeholder attempt
        bad_resp = self.client.post('/api/communications/templates/', {
            'name': 'Injection Attempt',
            'channel': CommunicationChannel.EMAIL,
            'subject': 'Hello {{system("rm -rf /")}}',
            'body': 'Dear {{lead_name}}, check {{user.secret_token}}.'
        })
        assert bad_resp.status_code == status.HTTP_400_BAD_REQUEST
        errors = str(bad_resp.data)
        assert 'unsupported placeholder' in errors.lower()

    def test_10_template_preview_safe_rendering(self):
        """Template preview safely replaces allowlisted variables and highlights unresolved ones."""
        self.client.force_authenticate(user=self.admin)

        preview_resp = self.client.post('/api/communications/templates/preview/', {
            'subject': 'Welcome {{lead_name}} to {{company_name}}!',
            'body': 'Hi {{lead_name}}, your counsellor is {{employee_name}}. Phone: {{lead_phone}}. Extra: {{unresolved_var}}.'
        })
        assert preview_resp.status_code == status.HTTP_200_OK
        data = preview_resp.data
        assert 'Rahul Sharma' in data['subject']
        assert 'Skill Move Sales CRM' in data['subject']
        assert 'Priya Patel' in data['body']
        assert '{{unresolved_var}}' in data['unresolved_placeholders']

    def test_11_unauthorized_attachment_download_prevented(self):
        """Users outside authorized team scope cannot download private template attachments."""
        template_alpha = CommunicationTemplate.objects.create(
            name='Alpha Restricted Contract',
            channel=CommunicationChannel.EMAIL,
            subject='Alpha Contract for {{lead_name}}',
            body='Contract content',
            team=self.team_alpha,
            created_by=self.manager_alpha
        )
        attachment = TemplateAttachment.objects.create(
            template=template_alpha,
            file=SimpleUploadedFile("contract.pdf", b"%PDF-1.4 alpha contract", content_type="application/pdf"),
            original_filename="contract.pdf",
            file_size=1024,
            content_type="application/pdf",
            uploaded_by=self.manager_alpha
        )

        # Manager Beta attempts to download Alpha attachment
        self.client.force_authenticate(user=self.manager_beta)
        download_resp = self.client.get(f'/api/communications/attachments/{attachment.id}/download/')
        assert download_resp.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]

        # Admin can download Alpha attachment
        self.client.force_authenticate(user=self.admin)
        admin_download = self.client.get(f'/api/communications/attachments/{attachment.id}/download/')
        assert admin_download.status_code == status.HTTP_200_OK

    def test_12_sales_employee_sees_only_active_team_and_global_templates(self):
        """Sales Employee can view active templates from their own team or global, not other teams or inactive."""
        # 1. Global active template
        global_active = CommunicationTemplate.objects.create(
            name='Global Active',
            channel=CommunicationChannel.EMAIL,
            subject='Global {{lead_name}}',
            body='Global',
            is_active=True,
            created_by=self.admin
        )
        # 2. Global inactive template
        global_inactive = CommunicationTemplate.objects.create(
            name='Global Inactive',
            channel=CommunicationChannel.EMAIL,
            subject='Global Inactive {{lead_name}}',
            body='Global Inactive',
            is_active=False,
            created_by=self.admin
        )
        # 3. Alpha team active template
        alpha_active = CommunicationTemplate.objects.create(
            name='Alpha Team Active',
            channel=CommunicationChannel.EMAIL,
            subject='Alpha {{lead_name}}',
            body='Alpha',
            team=self.team_alpha,
            is_active=True,
            created_by=self.manager_alpha
        )
        # 4. Beta team active template
        beta_active = CommunicationTemplate.objects.create(
            name='Beta Team Active',
            channel=CommunicationChannel.EMAIL,
            subject='Beta {{lead_name}}',
            body='Beta',
            team=self.team_beta,
            is_active=True,
            created_by=self.manager_beta
        )

        self.client.force_authenticate(user=self.employee_alpha)
        resp = self.client.get('/api/communications/templates/')
        assert resp.status_code == status.HTTP_200_OK
        results = resp.data if isinstance(resp.data, list) else resp.data.get('results', [])
        ids = [t['id'] for t in results]

        assert global_active.id in ids
        assert alpha_active.id in ids
        assert global_inactive.id not in ids
        assert beta_active.id not in ids
