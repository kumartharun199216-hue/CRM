import io
import csv
import openpyxl
import pytest
from unittest.mock import patch
from rest_framework.test import APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import Lead, PipelineStage, LeadAssignmentHistory, LeadStageHistory, LeadImportBatch

EXPECTED_STAGES = [
    (1, "Cold Calling"),
    (2, "Not Connected"),
    (3, "New Lead"),
    (4, "Contacted"),
    (5, "Interested"),
    (6, "Prospect"),
    (7, "FollowUp"),
    (8, "Negotation"),
    (9, "pendingClosure"),
    (10, "Enrolled"),
    (11, "Not Interested"),
    (12, "Lost"),
]

@pytest.mark.django_db(transaction=True)
class TestBulkLeadImportAndPagination:
    def setup_method(self):
        self.client = APIClient()

        # Seed 12 pipeline stages
        for order, name in EXPECTED_STAGES:
            PipelineStage.objects.update_or_create(
                order=order,
                defaults={'name': name, 'is_active': True}
            )

        self.stage1 = PipelineStage.objects.get(order=1)
        self.stage2 = PipelineStage.objects.get(order=2)
        self.stage3 = PipelineStage.objects.get(order=3)

        # Admin
        self.admin = User.objects.create_superuser(
            username="admin_import_test",
            email="admin_import@skillmove.com",
            password="password123",
            role=UserRole.ADMIN
        )

        # Team Alpha & Members
        self.team_alpha = Team.objects.create(name="Team Alpha")
        self.manager_alpha = User.objects.create_user(
            username="manager_alpha",
            email="manager_alpha@skillmove.com",
            password="password123",
            role=UserRole.MANAGER,
            team=self.team_alpha
        )
        self.team_alpha.manager = self.manager_alpha
        self.team_alpha.save()

        self.counsellor_a1 = User.objects.create_user(
            username="counsellor_a1",
            email="counsellor_a1@skillmove.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha
        )
        self.counsellor_a2 = User.objects.create_user(
            username="counsellor_a2",
            email="counsellor_a2@skillmove.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha
        )

        # Team Beta & Members
        self.team_beta = Team.objects.create(name="Team Beta")
        self.manager_beta = User.objects.create_user(
            username="manager_beta",
            email="manager_beta@skillmove.com",
            password="password123",
            role=UserRole.MANAGER,
            team=self.team_beta
        )
        self.team_beta.manager = self.manager_beta
        self.team_beta.save()

        self.counsellor_b1 = User.objects.create_user(
            username="counsellor_b1",
            email="counsellor_b1@skillmove.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_beta
        )

        # Inactive counsellor (must be excluded from distribution)
        self.inactive_counsellor = User.objects.create_user(
            username="inactive_counsellor",
            email="inactive@skillmove.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha,
            is_active=False
        )

    def _create_sample_csv_file(self, rows=None):
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(["Candidate Name", "Email Address", "Contact Number", "Degree", "College", "Key Skills"])
        if rows is None:
            rows = [
                ["Alice Smith", "alice.smith@example.com", "+919876543201", "B.Tech CSE", "IIT Delhi", "Python, React"],
                ["Bob Jones", "bob.jones@example.com", "+919876543202", "B.Sc Physics", "DU", "Data Analysis"],
                ["Charlie Brown", "charlie@example.com", "+919876543203", "BCA", "Amity", "Java, SQL"],
            ]
        for r in rows:
            writer.writerow(r)
        content = out.getvalue().encode('utf-8')
        return SimpleUploadedFile("candidates.csv", content, content_type="text/csv")

    def _create_sample_excel_file(self, sheet_names_and_data):
        wb = openpyxl.Workbook()
        default_sheet = True
        for sheet_name, rows in sheet_names_and_data.items():
            if default_sheet:
                ws = wb.active
                ws.title = sheet_name
                default_sheet = False
            else:
                ws = wb.create_sheet(title=sheet_name)
            for r in rows:
                ws.append(r)
        bio = io.BytesIO()
        wb.save(bio)
        wb.close()
        bio.seek(0)
        return SimpleUploadedFile("candidates.xlsx", bio.read(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    # 1. Preview CSV upload and header extraction
    def test_csv_import_preview(self):
        self.client.force_authenticate(user=self.admin)
        csv_file = self._create_sample_csv_file()
        response = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert 'file_token' in data
        assert data['file_name'] == 'candidates.csv'
        assert data['file_type'] == 'csv'
        assert 'headers' in data
        assert "Candidate Name" in data['headers']
        assert "Email Address" in data['headers']
        assert "Contact Number" in data['headers']
        assert data['total_rows'] == 3
        assert len(data['sample_rows']) == 3
        assert 'suggested_mapping' in data
        assert data['suggested_mapping'].get("Candidate Name") == "name"
        assert data['suggested_mapping'].get("Email Address") == "email"
        assert data['suggested_mapping'].get("Contact Number") == "phone"

    # 2. Excel (.xlsx) preview with multiple worksheets
    def test_excel_multiple_worksheets_preview(self):
        self.client.force_authenticate(user=self.admin)
        excel_data = {
            "MorningBatch": [
                ["Student Name", "Email", "Phone"],
                ["Diana Prince", "diana@example.com", "+919876543204"],
            ],
            "EveningBatch": [
                ["Full Name", "Contact Email", "Mobile"],
                ["Bruce Wayne", "bruce@example.com", "+919876543205"],
                ["Clark Kent", "clark@example.com", "+919876543206"],
            ]
        }
        excel_file = self._create_sample_excel_file(excel_data)
        response = self.client.post('/api/leads/import/preview/', {'file': excel_file}, format='multipart')

        assert response.status_code == status.HTTP_200_OK
        assert response.data['sheets'] == ["MorningBatch", "EveningBatch"]
        assert response.data['selected_sheet'] == "MorningBatch"
        assert response.data['total_rows'] == 1

        # Request specific sheet
        file_token = response.data['file_token']
        res2 = self.client.post('/api/leads/import/preview/', {
            'file_token': file_token,
            'sheet_name': 'EveningBatch'
        })
        assert res2.status_code == status.HTTP_200_OK
        assert res2.data['selected_sheet'] == 'EveningBatch'
        assert res2.data['total_rows'] == 2

    # 3. Mandatory field validation and reporting with exact row numbers
    def test_mandatory_field_validation_reporting(self):
        self.client.force_authenticate(user=self.admin)
        # Row 2: valid, Row 3: missing name, Row 4: missing email, Row 5: invalid email, Row 6: missing phone
        rows = [
            ["Valid Student", "valid@example.com", "+919876543210"],
            ["", "noname@example.com", "+919876543211"],
            ["No Email", "", "+919876543212"],
            ["Bad Email", "invalid-email-format", "+919876543213"],
            ["No Phone", "nophone@example.com", ""],
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')
        file_token = prev_res.data['file_token']

        val_res = self.client.post('/api/leads/import/validate/', {
            'file_token': file_token,
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'SINGLE',
            'assigned_employees': [self.counsellor_a1.id]
        }, format='json')

        assert val_res.status_code == status.HTTP_200_OK
        val_data = val_res.data
        assert val_data['total_rows'] == 5
        assert val_data['valid_count'] == 1
        assert val_data['invalid_count'] == 4

        errors_by_row = {
            item['row_number']: item['errors']
            for item in val_data['row_validations']
            if not item['is_valid']
        }
        # Spreadsheet row numbers (row 1 is header)
        assert 3 in errors_by_row  # row 3: missing name
        assert 4 in errors_by_row  # row 4: missing email
        assert 5 in errors_by_row  # row 5: invalid email format
        assert 6 in errors_by_row  # row 6: missing phone

    # 4. Duplicate lead detection (existing lead and within-file duplicate)
    def test_duplicate_lead_detection(self):
        # Create an existing lead in DB
        Lead.objects.create(
            name="Existing Lead",
            email="existing@example.com",
            phone="+919876543999",
            team=self.team_alpha,
            assigned_employee=self.counsellor_a1,
            stage=self.stage1,
            created_by=self.admin
        )

        self.client.force_authenticate(user=self.admin)
        rows = [
            ["Student A", "student_a@example.com", "+919876543220"],
            ["Student B Duplicate Existing", "existing@example.com", "+919876543221"],  # matches DB email
            ["Student C", "student_c@example.com", "+919876543222"],
            ["Student D File Duplicate", "student_a@example.com", "+919876543223"],   # matches Student A email in file
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        val_res = self.client.post('/api/leads/import/validate/', {
            'file_token': prev_res.data['file_token'],
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'SINGLE',
            'assigned_employees': [self.counsellor_a1.id]
        }, format='json')

        assert val_res.status_code == status.HTTP_200_OK
        assert val_res.data['duplicate_count'] == 2

    # 5. Empty optional fields preserved as empty (NO dummy data created)
    def test_empty_optional_fields_preserved_without_dummy_data(self):
        self.client.force_authenticate(user=self.admin)
        rows = [
            ["Clean Student", "clean@example.com", "+919876543301", "", "", ""],  # empty degree, college, skills
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-clean-test-1',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone',
                'Degree': 'qualification',
                'College': 'college',
                'Key Skills': 'key_skills'
            },
            'stage_id': self.stage2.id,
            'assignment_mode': 'SINGLE',
            'assigned_employees': [self.counsellor_a1.id]
        }, format='json')

        assert confirm_res.status_code == status.HTTP_201_CREATED
        assert confirm_res.data['imported_count'] == 1

        lead = Lead.objects.get(email="clean@example.com")
        assert lead.qualification == ""  # Not dummy filled
        assert lead.college == ""        # Not dummy filled
        assert lead.key_skills == ""     # Not dummy filled
        assert lead.experience == ""     # Not dummy filled
        assert lead.stage_id == self.stage2.id

    # 6. Assignment Mode A: Assign all leads to single employee
    def test_assignment_mode_a_single_employee(self):
        self.client.force_authenticate(user=self.admin)
        rows = [
            [f"Student {i}", f"student_{i}@example.com", f"+9198765433{i:02d}"]
            for i in range(5)
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-mode-a',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'SINGLE',
            'assigned_employees': [self.counsellor_a2.id]
        }, format='json')

        assert confirm_res.status_code == status.HTTP_201_CREATED
        assert confirm_res.data['imported_count'] == 5
        assert confirm_res.data['distribution'] == {self.counsellor_a2.username: 5}

        # Check all 5 leads assigned to counsellor_a2
        leads = Lead.objects.filter(email__startswith="student_")
        assert leads.count() == 5
        assert all(l.assigned_employee == self.counsellor_a2 for l in leads)
        assert all(l.team == self.team_alpha for l in leads)

    # 7. Assignment Mode B: Even distribution among selected employees (e.g. 101 leads among 4 employees -> 26, 25, 25, 25)
    def test_assignment_mode_b_even_distribution_101_leads_among_4_employees(self):
        # Create 2 extra counsellors to make 4 in total
        c3 = User.objects.create_user(username="counsellor_3", email="c3@skillmove.com", password="password123", role=UserRole.SALES_EMPLOYEE, team=self.team_alpha)
        c4 = User.objects.create_user(username="counsellor_4", email="c4@skillmove.com", password="password123", role=UserRole.SALES_EMPLOYEE, team=self.team_alpha)

        self.client.force_authenticate(user=self.admin)
        # Generate 101 valid leads
        rows = [
            [f"Candidate {i:03d}", f"candidate{i:03d}@example.com", f"+919876540{i:03d}"]
            for i in range(101)
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-101-leads',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage3.id,
            'assignment_mode': 'SELECTED',
            'assigned_employees': [self.counsellor_a1.id, self.counsellor_a2.id, c3.id, c4.id]
        }, format='json')

        assert confirm_res.status_code == status.HTTP_201_CREATED
        assert confirm_res.data['imported_count'] == 101

        dist = confirm_res.data['distribution']
        counts = list(dist.values())
        assert sum(counts) == 101
        assert sorted(counts) == [25, 25, 25, 26]

        # Verify DB counts for each employee
        assert Lead.objects.filter(assigned_employee=self.counsellor_a1).count() == 26
        assert Lead.objects.filter(assigned_employee=self.counsellor_a2).count() == 25
        assert Lead.objects.filter(assigned_employee=c3).count() == 25
        assert Lead.objects.filter(assigned_employee=c4).count() == 25

    # 8. Assignment Mode C: Automatic split among all eligible employees in authorized scope
    def test_assignment_mode_c_all_eligible_employees(self):
        self.client.force_authenticate(user=self.admin)
        rows = [
            [f"Auto Lead {i}", f"auto_lead_{i}@example.com", f"+919876541{i:02d}"]
            for i in range(6)
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        # Limit to Team Alpha (which has counsellor_a1 and counsellor_a2 active)
        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-mode-c',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'ALL_ELIGIBLE',
            'team_id': self.team_alpha.id
        }, format='json')

        assert confirm_res.status_code == status.HTTP_201_CREATED
        assert confirm_res.data['imported_count'] == 6
        # 6 distributed between counsellor_a1 and counsellor_a2 -> 3 each
        dist = confirm_res.data['distribution']
        assert dist[self.counsellor_a1.username] == 3
        assert dist[self.counsellor_a2.username] == 3

    # 9. Manager team scoping restriction (Manager Alpha cannot assign to Team Beta)
    def test_manager_cannot_assign_leads_to_other_team(self):
        self.client.force_authenticate(user=self.manager_alpha)
        rows = [["Test Lead", "mgr_lead@example.com", "+919876544001"]]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        # Manager Alpha attempts to assign to counsellor_b1 in Team Beta
        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-mgr-cross-team',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'SINGLE',
            'assigned_employees': [self.counsellor_b1.id]
        }, format='json')

        assert confirm_res.status_code == status.HTTP_400_BAD_REQUEST
        assert "unauthorized" in confirm_res.data['detail'].lower()

    # 10. Sales Employee cannot access import API (HTTP 403)
    def test_sales_employee_cannot_import_leads(self):
        self.client.force_authenticate(user=self.counsellor_a1)
        csv_file = self._create_sample_csv_file()
        response = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    # 11. Idempotency: Duplicate submission with same batch_id is rejected
    def test_idempotent_duplicate_batch_rejection(self):
        self.client.force_authenticate(user=self.admin)
        rows = [["Idem Lead", "idem@example.com", "+919876545001"]]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        payload = {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'unique-batch-id-12345',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'SINGLE',
            'assigned_employees': [self.counsellor_a1.id]
        }

        res1 = self.client.post('/api/leads/import/confirm/', payload, format='json')
        assert res1.status_code == status.HTTP_201_CREATED

        # Second attempt with same batch_id
        res2 = self.client.post('/api/leads/import/confirm/', payload, format='json')
        assert res2.status_code == status.HTTP_409_CONFLICT
        assert "already been processed" in res2.data['detail']

    # 12. Audit and history records created for bulk imported leads
    def test_audit_and_history_records_created(self):
        self.client.force_authenticate(user=self.admin)
        rows = [["Audit Lead", "audit_lead@example.com", "+919876546001"]]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-audit-check',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage3.id,
            'assignment_mode': 'SINGLE',
            'assigned_employees': [self.counsellor_a1.id]
        }, format='json')
        assert confirm_res.status_code == status.HTTP_201_CREATED

        lead = Lead.objects.get(email="audit_lead@example.com")
        # Assignment history exists
        assign_hist = LeadAssignmentHistory.objects.filter(lead=lead)
        assert assign_hist.count() == 1
        assert assign_hist.first().to_employee == self.counsellor_a1

        # Stage history exists
        stage_hist = LeadStageHistory.objects.filter(lead=lead)
        assert stage_hist.count() == 1
        assert stage_hist.first().to_stage == self.stage3
        assert "Initial bulk import" in stage_hist.first().note

        # Import batch record exists
        batch_record = LeadImportBatch.objects.filter(batch_id='batch-audit-check').first()
        assert batch_record is not None
        assert batch_record.imported_rows == 1

    # 13. Backend pagination: default 50, page_size options (10, 25, 50, 100), total pages
    def test_backend_pagination_default_50_and_options(self):
        self.client.force_authenticate(user=self.admin)
        # Create 60 leads
        for i in range(60):
            Lead.objects.create(
                name=f"Paginated Lead {i}",
                email=f"page_lead_{i}@example.com",
                phone=f"+91987655{i:04d}",
                stage=self.stage1,
                team=self.team_alpha,
                assigned_employee=self.counsellor_a1,
                created_by=self.admin
            )

        # Unpaginated request (no page param) returns list for backward compatibility
        res_unpaginated = self.client.get('/api/leads/')
        assert res_unpaginated.status_code == status.HTTP_200_OK
        assert isinstance(res_unpaginated.data, list)
        assert len(res_unpaginated.data) >= 60

        # Paginated request with page=1: default page size is 50
        res_p1 = self.client.get('/api/leads/?page=1')
        assert res_p1.status_code == status.HTTP_200_OK
        assert 'results' in res_p1.data
        assert 'count' in res_p1.data
        assert 'total_pages' in res_p1.data
        assert 'current_page' in res_p1.data
        assert res_p1.data['current_page'] == 1
        assert len(res_p1.data['results']) == 50
        assert res_p1.data['total_pages'] == 2

        # Page 2 has remaining 10 leads
        res_p2 = self.client.get('/api/leads/?page=2')
        assert res_p2.status_code == status.HTTP_200_OK
        assert res_p2.data['current_page'] == 2
        assert len(res_p2.data['results']) == 10

        # Page size option 25
        res_ps25 = self.client.get('/api/leads/?page=1&page_size=25')
        assert res_ps25.status_code == status.HTTP_200_OK
        assert len(res_ps25.data['results']) == 25
        assert res_ps25.data['total_pages'] == 3

        # Page size option 100
        res_ps100 = self.client.get('/api/leads/?page=1&page_size=100')
        assert res_ps100.status_code == status.HTTP_200_OK
        assert len(res_ps100.data['results']) == 60
        assert res_ps100.data['total_pages'] == 1

    def test_unassigned_queue_bulk_import(self):
        """Verifies explicit unassigned import pools leads into unassigned queue without employee assignments."""
        self.client.force_authenticate(user=self.manager_alpha)

        rows = [
            ["Unassigned Student 1", "unassigned1@example.com", "+919876500001"],
            ["Unassigned Student 2", "unassigned2@example.com", "+919876500002"],
            ["Unassigned Student 3", "unassigned3@example.com", "+919876500003"],
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')
        assert prev_res.status_code == status.HTTP_200_OK
        file_token = prev_res.data['file_token']

        val_res = self.client.post('/api/leads/import/validate/', {
            'file_token': file_token,
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'UNASSIGNED',
            'is_unassigned': True,
            'source': 'Campus Drive',
            'default_priority': 'HIGH',
            'batch_note': 'Campus Drive Unassigned Pool 2026'
        }, format='json')
        assert val_res.status_code == status.HTTP_200_OK
        assert val_res.data['valid_count'] == 3
        assert val_res.data['assignment_mode'] == 'UNASSIGNED'

        conf_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': file_token,
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'UNASSIGNED',
            'is_unassigned': True,
            'source': 'Campus Drive',
            'default_priority': 'HIGH',
            'batch_note': 'Campus Drive Unassigned Pool 2026'
        }, format='json')
        assert conf_res.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert conf_res.data['imported_count'] == 3

        created_leads = Lead.objects.filter(email__in=[r[1] for r in rows])
        assert created_leads.count() == 3
        for lead in created_leads:
            assert lead.assigned_employee is None
            assert lead.is_unassigned is True
            assert lead.team == self.team_alpha
            assert lead.stage == self.stage1
            assert lead.priority == 'HIGH'
            assert lead.source == 'Campus Drive'
            assert lead.batch_tag == 'Campus Drive Unassigned Pool 2026'

    def test_selected_employees_round_robin_distribution(self):
        """Verifies balanced round-robin distribution across chosen employees with max diff <= 1."""
        self.client.force_authenticate(user=self.admin)

        # 5 valid leads among 2 counsellors (expect 3 to first, 2 to second)
        rows = [
            [f"RR Student {i}", f"rr_student_{i}@example.com", f"+91987651000{i}"]
            for i in range(5)
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')
        file_token = prev_res.data['file_token']

        selected_emps = [self.counsellor_a1.id, self.counsellor_a2.id]
        conf_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': file_token,
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage2.id,
            'assignment_mode': 'SELECTED',
            'assigned_employees': selected_emps,
            'source': 'Job Portal',
            'default_priority': 'MEDIUM',
        }, format='json')
        assert conf_res.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert conf_res.data['imported_count'] == 5

        c1_count = Lead.objects.filter(assigned_employee=self.counsellor_a1, stage=self.stage2).count()
        c2_count = Lead.objects.filter(assigned_employee=self.counsellor_a2, stage=self.stage2).count()
        assert abs(c1_count - c2_count) <= 1
        assert c1_count + c2_count == 5

    def test_sample_template_download_endpoints(self):
        """Verifies sample Excel (.xlsx) and CSV (.csv) downloads."""
        self.client.force_authenticate(user=self.admin)

        # CSV format
        csv_res = self.client.get('/api/leads/import/sample/?format=csv')
        assert csv_res.status_code == status.HTTP_200_OK
        assert 'text/csv' in csv_res['Content-Type']
        assert 'leads_sample_template.csv' in csv_res['Content-Disposition']

        # Excel format
        xlsx_res = self.client.get('/api/leads/import/sample/?format=xlsx')
        assert xlsx_res.status_code == status.HTTP_200_OK
        assert 'openxmlformats' in xlsx_res['Content-Type']
        assert 'leads_sample_template.xlsx' in xlsx_res['Content-Disposition']

    def test_batch_detail_and_rejected_rows_download(self):
        """Verifies retrieving batch details and downloading rejected rows CSV."""
        self.client.force_authenticate(user=self.admin)

        # Import with 1 valid and 1 invalid row
        rows = [
            ["Good Student", "good@example.com", "+919876520001"],
            ["", "bad@example.com", ""],  # missing name and phone
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')
        file_token = prev_res.data['file_token']

        conf_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': file_token,
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'SINGLE',
            'assigned_employees': [self.counsellor_a1.id],
            'source': 'Website Leads',
            'batch_note': 'Test Batch Details'
        }, format='json')
        assert conf_res.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        batch_id_str = conf_res.data['batch_id']

        batch_obj = LeadImportBatch.objects.get(batch_id=batch_id_str)
        detail_res = self.client.get(f'/api/leads/import/batches/{batch_obj.id}/')
        assert detail_res.status_code == status.HTTP_200_OK
        assert detail_res.data['batch_id'] == batch_id_str
        assert detail_res.data['source'] == 'Website Leads'
        assert detail_res.data['batch_note'] == 'Test Batch Details'

        # Download rejected rows CSV
        rej_res = self.client.get(f'/api/leads/import/batches/{batch_obj.id}/rejected/')
        assert rej_res.status_code == status.HTTP_200_OK
        assert 'text/csv' in rej_res['Content-Type']
        assert 'rejected' in rej_res.content.decode()

    def test_security_sales_employee_blocked(self):
        """Verifies sales employee cannot perform bulk imports directly via API."""
        self.client.force_authenticate(user=self.counsellor_a1)

        prev_res = self.client.post('/api/leads/import/preview/', {}, format='multipart')
        assert prev_res.status_code == status.HTTP_403_FORBIDDEN

        val_res = self.client.post('/api/leads/import/validate/', {}, format='json')
        assert val_res.status_code == status.HTTP_403_FORBIDDEN

        conf_res = self.client.post('/api/leads/import/confirm/', {}, format='json')
        assert conf_res.status_code == status.HTTP_403_FORBIDDEN

    # =========================================================================
    # REGRESSION TESTS: Team Resolution & Import Integrity (12 Scenarios)
    # =========================================================================

    # Scenario 1: Importing 100 leads assigned to two employees in the same team
    def test_regression_1_import_100_leads_assigned_to_two_employees_same_team(self):
        self.client.force_authenticate(user=self.admin)
        rows = [
            [f"Student {i:03d}", f"student_{i:03d}@example.com", f"+91987654{i:04d}"]
            for i in range(100)
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')
        assert prev_res.status_code == status.HTTP_200_OK

        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-regression-100-leads',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'ROUND_ROBIN',
            'assigned_employees': [self.counsellor_a1.id, self.counsellor_a2.id],
            'source': 'Cold Calling / Raw Database'
        }, format='json')

        assert confirm_res.status_code == status.HTTP_201_CREATED
        assert confirm_res.data['imported_count'] == 100

        # Verify exactly 50 leads to each counsellor
        c1_leads = Lead.objects.filter(assigned_employee=self.counsellor_a1)
        c2_leads = Lead.objects.filter(assigned_employee=self.counsellor_a2)
        assert c1_leads.count() == 50
        assert c2_leads.count() == 50

    # Scenario 2: Correct team assignment for every imported lead
    def test_regression_2_correct_team_assignment_for_every_imported_lead(self):
        self.client.force_authenticate(user=self.admin)
        rows = [
            [f"TeamLead {i}", f"teamlead_{i}@example.com", f"+91987656{i:04d}"]
            for i in range(10)
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-regression-team-check',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'ROUND_ROBIN',
            'assigned_employees': [self.counsellor_a1.id, self.counsellor_a2.id],
        }, format='json')

        assert confirm_res.status_code == status.HTTP_201_CREATED
        leads = Lead.objects.filter(email__startswith="teamlead_")
        assert leads.count() == 10
        for lead in leads:
            assert lead.team is not None
            assert lead.team == self.team_alpha
            assert lead.team_id == lead.assigned_employee.team_id
            assign_hist = LeadAssignmentHistory.objects.filter(lead=lead).first()
            assert assign_hist is not None
            assert assign_hist.to_team == self.team_alpha

    # Scenario 3: Correct round-robin distribution (balanced with remainder)
    def test_regression_3_correct_round_robin_distribution(self):
        self.client.force_authenticate(user=self.admin)
        # 7 leads distributed across 2 counsellors -> 4 to first, 3 to second
        rows = [
            [f"RR Lead {i}", f"rr_lead_{i}@example.com", f"+91987657{i:04d}"]
            for i in range(7)
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-regression-rr-check',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'ROUND_ROBIN',
            'assigned_employees': [self.counsellor_a1.id, self.counsellor_a2.id],
        }, format='json')

        assert confirm_res.status_code == status.HTTP_201_CREATED
        dist = confirm_res.data['distribution']
        assert dist[self.counsellor_a1.username] == 4
        assert dist[self.counsellor_a2.username] == 3
        assert Lead.objects.filter(assigned_employee=self.counsellor_a1, email__startswith="rr_lead_").count() == 4
        assert Lead.objects.filter(assigned_employee=self.counsellor_a2, email__startswith="rr_lead_").count() == 3

    # Scenario 4: Admin importing leads across authorized teams
    def test_regression_4_admin_importing_leads_across_authorized_teams(self):
        self.client.force_authenticate(user=self.admin)
        rows = [
            [f"MultiTeam {i}", f"multiteam_{i}@example.com", f"+91987658{i:04d}"]
            for i in range(6)
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        # Admin selects counsellor_a1 (Team Alpha) and counsellor_b1 (Team Beta)
        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-regression-cross-team',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'SELECTED',
            'assigned_employees': [self.counsellor_a1.id, self.counsellor_b1.id],
        }, format='json')

        assert confirm_res.status_code == status.HTTP_201_CREATED
        assert confirm_res.data['imported_count'] == 6

        # Check that leads assigned to counsellor_a1 have team_alpha
        a1_leads = Lead.objects.filter(assigned_employee=self.counsellor_a1, email__startswith="multiteam_")
        assert a1_leads.count() == 3
        for l in a1_leads:
            assert l.team == self.team_alpha

        # Check that leads assigned to counsellor_b1 have team_beta
        b1_leads = Lead.objects.filter(assigned_employee=self.counsellor_b1, email__startswith="multiteam_")
        assert b1_leads.count() == 3
        for l in b1_leads:
            assert l.team == self.team_beta

    # Scenario 5: Manager importing leads within the Manager's authorized team
    def test_regression_5_manager_importing_within_authorized_team(self):
        self.client.force_authenticate(user=self.manager_alpha)
        rows = [
            [f"MgrScope {i}", f"mgrscope_{i}@example.com", f"+91987659{i:04d}"]
            for i in range(4)
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-regression-mgr-scope',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'SELECTED',
            'assigned_employees': [self.counsellor_a1.id, self.counsellor_a2.id],
        }, format='json')

        assert confirm_res.status_code == status.HTTP_201_CREATED
        leads = Lead.objects.filter(email__startswith="mgrscope_")
        assert leads.count() == 4
        for l in leads:
            assert l.team == self.team_alpha

    # Scenario 6: Rejection of unauthorized employee/team combinations
    def test_regression_6_rejection_of_unauthorized_employee_team_combinations(self):
        self.client.force_authenticate(user=self.manager_alpha)
        rows = [["Unauth Lead", "unauth_emp@example.com", "+919876600001"]]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        # Manager Alpha tries to assign leads to counsellor_b1 (Team Beta)
        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-regression-unauth-emp',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'SINGLE',
            'assigned_employees': [self.counsellor_b1.id],
        }, format='json')

        assert confirm_res.status_code == status.HTTP_400_BAD_REQUEST
        assert "authorized team" in confirm_res.data['detail'].lower() or "unauthorized" in confirm_res.data['detail'].lower()
        # Verify no leads created
        assert not Lead.objects.filter(email="unauth_emp@example.com").exists()

    # Scenario 7: Importing unassigned leads while still satisfying required team constraint
    def test_regression_7_importing_unassigned_leads_satisfies_required_team_constraint(self):
        self.client.force_authenticate(user=self.admin)
        rows = [
            [f"Unassigned Lead {i}", f"unassigned_team_{i}@example.com", f"+91987661{i:04d}"]
            for i in range(3)
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-regression-unassigned-team',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'UNASSIGNED',
            'is_unassigned': True,
            'team_id': self.team_beta.id
        }, format='json')

        assert confirm_res.status_code == status.HTTP_201_CREATED
        leads = Lead.objects.filter(email__startswith="unassigned_team_")
        assert leads.count() == 3
        for l in leads:
            assert l.team == self.team_beta
            assert l.assigned_employee is None
            assert l.is_unassigned is True

    # Scenario 8: Rejection of an employee without a valid team when a team is required
    def test_regression_8_rejection_of_employee_without_valid_team(self):
        # Create an employee without a team
        teamless_user = User.objects.create_user(
            username="teamless_worker",
            email="teamless@skillmove.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=None
        )

        self.client.force_authenticate(user=self.admin)
        rows = [["Teamless Student", "teamless_lead@example.com", "+919876620001"]]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-regression-teamless-emp',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'SINGLE',
            'assigned_employees': [teamless_user.id],
        }, format='json')

        assert confirm_res.status_code == status.HTTP_400_BAD_REQUEST
        assert "team" in confirm_res.data['detail'].lower()
        # Verify no leads created
        assert not Lead.objects.filter(email="teamless_lead@example.com").exists()

    # Scenario 9: Database transaction rollback on a genuine import failure
    def test_regression_9_database_transaction_rollback_on_failure(self):
        self.client.force_authenticate(user=self.admin)
        rows = [
            [f"Rollback Lead {i}", f"rollback_{i}@example.com", f"+91987663{i:04d}"]
            for i in range(5)
        ]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        initial_lead_count = Lead.objects.count()
        initial_history_count = LeadAssignmentHistory.objects.count()

        # Simulate unexpected database failure during transaction
        with patch.object(Lead, 'save', side_effect=RuntimeError("Simulated DB disk failure")):
            confirm_res = self.client.post('/api/leads/import/confirm/', {
                'file_token': prev_res.data['file_token'],
                'batch_id': 'batch-regression-rollback-test',
                'column_mapping': {
                    'Candidate Name': 'name',
                    'Email Address': 'email',
                    'Contact Number': 'phone'
                },
                'stage_id': self.stage1.id,
                'assignment_mode': 'SINGLE',
                'assigned_employees': [self.counsellor_a1.id],
            }, format='json')

            assert confirm_res.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            assert "No incomplete lead records were created" in confirm_res.data['detail']

        # Verify 100% rollback: no partial leads or histories exist
        assert Lead.objects.count() == initial_lead_count
        assert LeadAssignmentHistory.objects.count() == initial_history_count
        assert not LeadImportBatch.objects.filter(batch_id='batch-regression-rollback-test').exists()

    # Scenario 10: Safe retry behavior without duplicate leads or assignment history
    def test_regression_10_safe_retry_behavior_without_duplicates(self):
        self.client.force_authenticate(user=self.admin)
        rows = [["Retry Student", "retry_student@example.com", "+919876640001"]]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        payload = {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-regression-retry-test',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage1.id,
            'assignment_mode': 'SINGLE',
            'assigned_employees': [self.counsellor_a1.id],
        }

        # First request succeeds
        res1 = self.client.post('/api/leads/import/confirm/', payload, format='json')
        assert res1.status_code == status.HTTP_201_CREATED

        # Duplicate retry with same batch_id is rejected with 409 Conflict
        res2 = self.client.post('/api/leads/import/confirm/', payload, format='json')
        assert res2.status_code == status.HTTP_409_CONFLICT
        assert "already been processed" in res2.data['detail']

        # Verify only 1 lead and 1 assignment history exist
        leads = Lead.objects.filter(email="retry_student@example.com")
        assert leads.count() == 1
        assert LeadAssignmentHistory.objects.filter(lead=leads.first()).count() == 1

    # Scenario 11: Correct target pipeline stage and source
    def test_regression_11_correct_target_pipeline_stage_and_source(self):
        self.client.force_authenticate(user=self.admin)
        rows = [["StageSource Lead", "stagesource@example.com", "+919876650001"]]
        csv_file = self._create_sample_csv_file(rows=rows)
        prev_res = self.client.post('/api/leads/import/preview/', {'file': csv_file}, format='multipart')

        confirm_res = self.client.post('/api/leads/import/confirm/', {
            'file_token': prev_res.data['file_token'],
            'batch_id': 'batch-regression-stage-source',
            'column_mapping': {
                'Candidate Name': 'name',
                'Email Address': 'email',
                'Contact Number': 'phone'
            },
            'stage_id': self.stage2.id,
            'assignment_mode': 'SINGLE',
            'assigned_employees': [self.counsellor_a1.id],
            'source': 'Cold Calling / Raw Database',
            'default_priority': 'HIGH',
            'batch_note': 'Sprint 2026 Import'
        }, format='json')

        assert confirm_res.status_code == status.HTTP_201_CREATED
        lead = Lead.objects.get(email="stagesource@example.com")
        assert lead.stage == self.stage2
        assert lead.source == 'Cold Calling / Raw Database'
        assert lead.priority == 'HIGH'
        assert lead.batch_tag == 'Sprint 2026 Import'

        stage_hist = LeadStageHistory.objects.filter(lead=lead).first()
        assert stage_hist is not None
        assert stage_hist.to_stage == self.stage2

    # Scenario 12: Existing ordinary lead creation still works
    def test_regression_12_existing_ordinary_lead_creation_still_works(self):
        # Admin creates ordinary lead
        self.client.force_authenticate(user=self.admin)
        admin_lead_data = {
            'name': 'Ordinary Lead Admin',
            'email': 'ordinary_admin@example.com',
            'phone': '+919876660001',
            'team': self.team_alpha.id,
            'assigned_employee': self.counsellor_a1.id,
            'priority': 'Medium',
            'source': 'Manual Entry'
        }
        res_admin = self.client.post('/api/leads/', admin_lead_data, format='json')
        assert res_admin.status_code == status.HTTP_201_CREATED
        assert Lead.objects.filter(email='ordinary_admin@example.com').exists()

        # Manager Alpha creates ordinary lead for Team Alpha
        self.client.force_authenticate(user=self.manager_alpha)
        mgr_lead_data = {
            'name': 'Ordinary Lead Manager',
            'email': 'ordinary_mgr@example.com',
            'phone': '+919876660002',
            'team': self.team_alpha.id,
            'assigned_employee': self.counsellor_a2.id,
            'priority': 'High',
            'source': 'Manual Entry'
        }
        res_mgr = self.client.post('/api/leads/', mgr_lead_data, format='json')
        assert res_mgr.status_code == status.HTTP_201_CREATED
        assert Lead.objects.filter(email='ordinary_mgr@example.com').exists()

        # Manager Alpha cannot create lead for Team Beta
        invalid_mgr_data = {
            'name': 'Unauthorized Lead',
            'email': 'unauth_lead@example.com',
            'phone': '+919876660003',
            'team': self.team_beta.id,
            'assigned_employee': self.counsellor_b1.id,
        }
        res_unauth = self.client.post('/api/leads/', invalid_mgr_data, format='json')
        assert res_unauth.status_code == status.HTTP_400_BAD_REQUEST

