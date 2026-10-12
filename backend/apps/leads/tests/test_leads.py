import pytest
import concurrent.futures
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import Lead, PipelineStage, LeadIdSequence, LeadAssignmentHistory, LeadStageHistory

EXPECTED_STAGES = [
    (1, "Cold Calling"),
    (2, "Not Connected"),
    (3, "New Lead"),
    (4, "Contacted"),
    (5, "Interested"),
    (6, "Prospect"),
    (7, "FollowUp"),
    (8, "Negotation"),
    (9, "Pending Closure"),
    (10, "Enrolled"),
    (11, "Not Interested"),
    (12, "Lost"),
]


@pytest.mark.django_db(transaction=True)
class TestLeads:
    def setup_method(self):
        self.client = APIClient()

        # Seed the 12 pipeline stages per strict specification
        for order, name in EXPECTED_STAGES:
            PipelineStage.objects.update_or_create(
                order=order,
                defaults={'name': name, 'is_active': True}
            )

        self.stage1 = PipelineStage.objects.get(order=1)
        self.stage2 = PipelineStage.objects.get(order=2)

        # Admin user
        self.admin = User.objects.create_superuser(
            username="superadmin",
            email="admin@crm.local",
            password="adminpassword123",
            role=UserRole.ADMIN
        )

        # Team A
        self.team_a = Team.objects.create(name="Team Alpha")
        self.manager_a = User.objects.create_user(
            username="manager_a",
            email="manager_a@crm.local",
            password="password123",
            role=UserRole.MANAGER,
            team=self.team_a
        )
        self.team_a.manager = self.manager_a
        self.team_a.save()

        self.employee_a1 = User.objects.create_user(
            username="emp_a1",
            email="emp_a1@crm.local",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_a
        )
        self.employee_a2 = User.objects.create_user(
            username="emp_a2",
            email="emp_a2@crm.local",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_a
        )

        # Team B
        self.team_b = Team.objects.create(name="Team Beta")
        self.manager_b = User.objects.create_user(
            username="manager_b",
            email="manager_b@crm.local",
            password="password123",
            role=UserRole.MANAGER,
            team=self.team_b
        )
        self.team_b.manager = self.manager_b
        self.team_b.save()

        self.employee_b1 = User.objects.create_user(
            username="emp_b1",
            email="emp_b1@crm.local",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_b
        )

    # 1. Automatic unique ID generation & formatting tests
    def test_automatic_unique_id_generation(self):
        self.client.force_authenticate(user=self.admin)
        res1 = self.client.post('/api/leads/', {
            'name': 'Student One',
            'email': 's1@example.com',
            'phone': '+1234567890',
            'team': self.team_a.id,
            'assigned_employee': self.employee_a1.id
        })
        assert res1.status_code == status.HTTP_201_CREATED
        assert res1.data['lead_id'] == 'SM-LD-0001'

        res2 = self.client.post('/api/leads/', {
            'name': 'Student Two',
            'email': 's2@example.com',
            'phone': '+1234567891',
            'team': self.team_a.id,
            'assigned_employee': self.employee_a1.id,
            'lead_id': 'MANUAL-FORBIDDEN-ID'  # Should be ignored and read-only
        })
        assert res2.status_code == status.HTTP_201_CREATED
        assert res2.data['lead_id'] == 'SM-LD-0002'

        # Test expansion beyond 9999 without truncation
        seq = LeadIdSequence.objects.get(id=1)
        seq.last_number = 9999
        seq.save()

        res3 = self.client.post('/api/leads/', {
            'name': 'Student 10000',
            'email': 's10000@example.com',
            'phone': '+1234567892',
            'team': self.team_a.id,
            'assigned_employee': self.employee_a1.id
        })
        assert res3.status_code == status.HTTP_201_CREATED
        assert res3.data['lead_id'] == 'SM-LD-10000'

    # 2. Concurrent lead creation atomic ID allocation
    def test_concurrent_lead_creation_id_safety(self):
        from django.db import connection
        allocated_ids = []
        def allocate_id():
            try:
                return LeadIdSequence.get_next_lead_id()
            finally:
                connection.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(allocate_id) for _ in range(15)]
            for future in concurrent.futures.as_completed(futures):
                allocated_ids.append(future.result())

        assert len(allocated_ids) == 15
        # Guarantee uniqueness across all concurrently allocated IDs
        assert len(set(allocated_ids)) == 15
        for lid in allocated_ids:
            assert lid.startswith('SM-LD-')

    # 3. Required-field validation (Name, Email, Mobile Phone)
    def test_required_field_validation(self):
        self.client.force_authenticate(user=self.admin)

        # Missing name
        res = self.client.post('/api/leads/', {
            'email': 'test@example.com',
            'phone': '+1234567890',
            'team': self.team_a.id,
            'assigned_employee': self.employee_a1.id
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'name' in res.data

        # Missing email
        res = self.client.post('/api/leads/', {
            'name': 'Test Student',
            'phone': '+1234567890',
            'team': self.team_a.id,
            'assigned_employee': self.employee_a1.id
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in res.data

        # Missing phone
        res = self.client.post('/api/leads/', {
            'name': 'Test Student',
            'email': 'test@example.com',
            'team': self.team_a.id,
            'assigned_employee': self.employee_a1.id
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'phone' in res.data

    # 4. Creation with all optional fields empty
    def test_creation_with_all_optional_fields_empty(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post('/api/leads/', {
            'name': 'Minimal Lead',
            'email': 'minimal@example.com',
            'phone': '+19876543210',
            'team': self.team_a.id,
            'assigned_employee': self.employee_a1.id
        })
        assert res.status_code == status.HTTP_201_CREATED
        lead_data = res.data
        assert lead_data['qualification'] == ''
        assert lead_data['college'] == ''
        assert lead_data['yop'] == ''
        assert lead_data['key_skills'] == ''
        assert lead_data['target_role'] == ''
        assert lead_data['experience'] == ''
        assert lead_data['priority'] == ''
        assert lead_data['status'] == ''
        assert lead_data['estimated_revenue'] is None
        assert lead_data['placement_fee'] is None
        assert lead_data['career_counsellor'] == ''
        assert lead_data['city'] == ''
        assert lead_data['next_follow_up'] is None
        # Auto-assigned stage 1 rule
        assert lead_data['stage'] == self.stage1.id
        assert lead_data['stage_name'] == 'Cold Calling'

    # 5. Valid email validation
    def test_valid_email_validation(self):
        self.client.force_authenticate(user=self.admin)
        # Invalid email format
        res_invalid = self.client.post('/api/leads/', {
            'name': 'Invalid Email Lead',
            'email': 'invalid-email-address',
            'phone': '+1234567890',
            'team': self.team_a.id,
            'assigned_employee': self.employee_a1.id
        })
        assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST
        assert 'email' in res_invalid.data

        # Valid email format
        res_valid = self.client.post('/api/leads/', {
            'name': 'Valid Email Lead',
            'email': 'valid.student@domain.org',
            'phone': '+1234567890',
            'team': self.team_a.id,
            'assigned_employee': self.employee_a1.id
        })
        assert res_valid.status_code == status.HTTP_201_CREATED

    # 6. Pipeline configuration and stage ordering
    def test_pipeline_configuration_and_stage_ordering(self):
        stages = list(PipelineStage.objects.filter(is_active=True).order_by('order').values_list('order', 'name'))
        assert stages == EXPECTED_STAGES

    # 7. All Leads view behavior
    def test_all_leads_view_behavior(self):
        lead1 = Lead.objects.create(
            name="Lead in Cold Calling",
            email="lead1@crm.local",
            phone="+1234567890",
            team=self.team_a,
            assigned_employee=self.employee_a1,
            stage=self.stage1,
            created_by=self.admin
        )
        lead2 = Lead.objects.create(
            name="Lead in Not Connected",
            email="lead2@crm.local",
            phone="+1234567891",
            team=self.team_a,
            assigned_employee=self.employee_a1,
            stage=self.stage2,
            created_by=self.admin
        )

        self.client.force_authenticate(user=self.admin)
        # All leads without stage param
        res_all = self.client.get('/api/leads/')
        assert res_all.status_code == status.HTTP_200_OK
        assert len(res_all.data) == 2

        # All leads with stage=all param
        res_all_param = self.client.get('/api/leads/?stage=all')
        assert res_all_param.status_code == status.HTTP_200_OK
        assert len(res_all_param.data) == 2

        # Filter by specific stage 1
        res_stage1 = self.client.get(f'/api/leads/?stage={self.stage1.id}')
        assert res_stage1.status_code == status.HTTP_200_OK
        assert len(res_stage1.data) == 1
        assert res_stage1.data[0]['id'] == lead1.id

    # 8. Spreadsheet and Kanban consistency
    def test_spreadsheet_and_kanban_consistency(self):
        lead = Lead.objects.create(
            name="Consistent Lead",
            email="consistent@crm.local",
            phone="+1234567890",
            team=self.team_a,
            assigned_employee=self.employee_a1,
            stage=self.stage1,
            created_by=self.admin
        )
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/leads/')
        assert res.status_code == status.HTTP_200_OK
        # Single record returned matches both spreadsheet and kanban requirements
        record = res.data[0]
        assert record['lead_id'] == lead.lead_id
        assert record['name'] == 'Consistent Lead'
        assert record['stage'] == self.stage1.id

    # 9. Team / owner consistency
    def test_assigned_employee_must_belong_to_lead_team(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/leads/', {
            'name': 'Mismatched Deal',
            'email': 'mismatch@example.com',
            'phone': '+1234567890',
            'team': self.team_a.id,
            'assigned_employee': self.employee_b1.id
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'assigned_employee' in response.data

    # 10. Admin, Manager and Sales Employee authorization
    def test_manager_can_create_lead_for_own_team(self):
        self.client.force_authenticate(user=self.manager_a)
        response = self.client.post('/api/leads/', {
            'name': 'Alpha Enterprise Deal',
            'email': 'john@example.com',
            'phone': '+1234567890',
            'team': self.team_a.id,
            'assigned_employee': self.employee_a1.id,
            'stage': self.stage1.id
        })
        assert response.status_code == status.HTTP_201_CREATED
        lead_id = response.data['id']

        history = LeadAssignmentHistory.objects.filter(lead_id=lead_id)
        assert history.count() == 1
        assert history.first().to_employee == self.employee_a1
        assert history.first().to_team == self.team_a

    def test_sales_employee_cannot_create_leads(self):
        self.client.force_authenticate(user=self.employee_a1)
        response = self.client.post('/api/leads/', {
            'name': 'Forbidden Employee Deal',
            'email': 'emp@example.com',
            'phone': '+1234567890',
            'team': self.team_a.id,
            'assigned_employee': self.employee_a1.id
        })
        assert response.status_code == status.HTTP_403_FORBIDDEN

    # 11. Manager restrictions across teams
    def test_manager_cannot_create_lead_for_other_team(self):
        self.client.force_authenticate(user=self.manager_a)
        response = self.client.post('/api/leads/', {
            'name': 'Unauthorized Deal',
            'email': 'unauth@example.com',
            'phone': '+1234567890',
            'team': self.team_b.id,
            'assigned_employee': self.employee_b1.id
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_manager_reassign_within_authorized_team(self):
        lead = Lead.objects.create(
            name="Lead for Reassignment",
            email="reassign@example.com",
            phone="+1234567890",
            team=self.team_a,
            assigned_employee=self.employee_a1,
            created_by=self.admin
        )

        self.client.force_authenticate(user=self.manager_a)
        response = self.client.patch(f'/api/leads/{lead.id}/', {
            'assigned_employee': self.employee_a2.id
        })
        assert response.status_code == status.HTTP_200_OK
        assert response.data['assigned_employee'] == self.employee_a2.id

        # Manager A CANNOT reassign to an employee in Team B
        response_invalid = self.client.patch(f'/api/leads/{lead.id}/', {
            'assigned_employee': self.employee_b1.id
        })
        assert response_invalid.status_code == status.HTTP_400_BAD_REQUEST

    def test_sales_employee_cannot_reassign_leads(self):
        lead = Lead.objects.create(
            name="Emp Lead",
            email="emp@example.com",
            phone="+1234567890",
            team=self.team_a,
            assigned_employee=self.employee_a1,
            created_by=self.admin
        )
        self.client.force_authenticate(user=self.employee_a1)
        response = self.client.patch(f'/api/leads/{lead.id}/', {
            'assigned_employee': self.employee_a2.id
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    # 12. Data preservation and stage history
    def test_pipeline_stage_change_preserves_history(self):
        lead = Lead.objects.create(
            name="Pipeline Lead",
            email="history@example.com",
            phone="+1234567890",
            team=self.team_a,
            assigned_employee=self.employee_a1,
            stage=self.stage1,
            created_by=self.admin
        )

        self.client.force_authenticate(user=self.manager_a)
        response = self.client.patch(f'/api/leads/{lead.id}/', {
            'stage': self.stage2.id
        })
        assert response.status_code == status.HTTP_200_OK

        history = LeadStageHistory.objects.filter(lead=lead).order_by('-timestamp')
        assert history.count() == 1
        assert history.first().from_stage == self.stage1
        assert history.first().to_stage == self.stage2

    # 13. Pipeline lead counts visibility across Admin, Manager, and Sales Employee
    def test_pipeline_stage_counts_visibility_and_scoping(self):
        from django.utils import timezone

        # Lead in Team A, emp A1, stage 1
        lead_a1_st1 = Lead.objects.create(
            name="Lead A1 Stage 1",
            email="la1@test.com",
            phone="+1234567890",
            team=self.team_a,
            assigned_employee=self.employee_a1,
            stage=self.stage1,
            created_by=self.admin
        )
        # Lead in Team A, emp A2, stage 1
        lead_a2_st1 = Lead.objects.create(
            name="Lead A2 Stage 1",
            email="la2@test.com",
            phone="+1234567891",
            team=self.team_a,
            assigned_employee=self.employee_a2,
            stage=self.stage1,
            created_by=self.admin
        )
        # Lead in Team B, emp B1, stage 1
        lead_b1_st1 = Lead.objects.create(
            name="Lead B1 Stage 1",
            email="lb1@test.com",
            phone="+1234567892",
            team=self.team_b,
            assigned_employee=self.employee_b1,
            stage=self.stage1,
            created_by=self.admin
        )
        # Lead in Team A, emp A1, stage 2
        lead_a1_st2 = Lead.objects.create(
            name="Lead A1 Stage 2",
            email="la1st2@test.com",
            phone="+1234567893",
            team=self.team_a,
            assigned_employee=self.employee_a1,
            stage=self.stage2,
            created_by=self.admin
        )
        # Archived Lead in Team A, emp A1, stage 1 (Must be excluded)
        Lead.objects.create(
            name="Archived Lead",
            email="archived@test.com",
            phone="+1234567894",
            team=self.team_a,
            assigned_employee=self.employee_a1,
            stage=self.stage1,
            archived_at=timezone.now(),
            created_by=self.admin
        )

        # 1. Admin visibility: all active accessible leads across all teams
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.get('/api/leads/stage-counts/')
        assert res_admin.status_code == status.HTTP_200_OK
        # stage1 has 3 active leads (lead_a1_st1, lead_a2_st1, lead_b1_st1); archived lead excluded
        assert res_admin.data[self.stage1.id] == 3
        # stage2 has 1 active lead
        assert res_admin.data[self.stage2.id] == 1

        # 2. Manager A visibility: only Team A leads
        self.client.force_authenticate(user=self.manager_a)
        res_mgr = self.client.get('/api/leads/stage-counts/')
        assert res_mgr.status_code == status.HTTP_200_OK
        # Team A has 2 active leads in stage1 (lead_a1_st1, lead_a2_st1); Team B lead NOT leaked
        assert res_mgr.data[self.stage1.id] == 2
        assert res_mgr.data[self.stage2.id] == 1

        # 3. Sales Employee A1 visibility: only assigned leads
        self.client.force_authenticate(user=self.employee_a1)
        res_emp = self.client.get('/api/leads/stage-counts/')
        assert res_emp.status_code == status.HTTP_200_OK
        # Employee A1 has 1 active lead in stage1 and 1 in stage2
        assert res_emp.data[self.stage1.id] == 1
        assert res_emp.data[self.stage2.id] == 1

        # Stage with zero leads is omitted or returns 0
        stage12 = PipelineStage.objects.get(order=12)
        assert res_admin.data.get(stage12.id, 0) == 0

    # 14. Lead stage change updates counts dynamically
    def test_pipeline_stage_counts_update_after_stage_change(self):
        lead = Lead.objects.create(
            name="Moving Lead",
            email="moving@test.com",
            phone="+1234567890",
            team=self.team_a,
            assigned_employee=self.employee_a1,
            stage=self.stage1,
            created_by=self.admin
        )
        self.client.force_authenticate(user=self.admin)
        res1 = self.client.get('/api/leads/stage-counts/')
        assert res1.data.get(self.stage1.id) == 1
        assert res1.data.get(self.stage2.id, 0) == 0

        # Move lead to stage 2
        self.client.patch(f'/api/leads/{lead.id}/', {'stage': self.stage2.id})
        res2 = self.client.get('/api/leads/stage-counts/')
        assert res2.data.get(self.stage1.id, 0) == 0
        assert res2.data.get(self.stage2.id) == 1

    # 15. Development/Test accounts provisioning, authentication & password hashing
    def test_dev_accounts_authentication_and_password_hashing(self):
        from django.core.management import call_command
        # Run provisioning command
        call_command('provision_dev_users')

        # Test Admin authentication
        admin_user = User.objects.get(username="admin@skillmove.com")
        assert admin_user.is_staff is True
        assert admin_user.is_superuser is True
        assert admin_user.role == UserRole.ADMIN
        assert admin_user.password.startswith(('pbkdf2_', 'argon2', 'bcrypt'))
        assert "ADmin@123" not in admin_user.password  # Must be hashed, never plaintext

        res_login_admin = self.client.post('/api/auth/login/', {
            'username': 'admin@skillmove.com',
            'password': 'ADmin@123'
        })
        assert res_login_admin.status_code == status.HTTP_200_OK
        assert 'token' in res_login_admin.data

        # Test Manager authentication & permissions
        manager_user = User.objects.get(username="manager@skillmove.com")
        assert manager_user.is_staff is False
        assert manager_user.is_superuser is False
        assert manager_user.role == UserRole.MANAGER
        assert manager_user.password.startswith(('pbkdf2_', 'argon2', 'bcrypt'))
        assert "ADmin@123" not in manager_user.password

        res_login_mgr = self.client.post('/api/auth/login/', {
            'username': 'manager@skillmove.com',
            'password': 'ADmin@123'
        })
        assert res_login_mgr.status_code == status.HTTP_200_OK

        # Test Counsellor authentication & permissions
        counsellor_user = User.objects.get(username="counsellor@skillmove.com")
        assert counsellor_user.is_staff is False
        assert counsellor_user.is_superuser is False
        assert counsellor_user.role == UserRole.SALES_EMPLOYEE
        assert counsellor_user.password.startswith(('pbkdf2_', 'argon2', 'bcrypt'))
        assert "ADmin@123" not in counsellor_user.password

        res_login_counsellor = self.client.post('/api/auth/login/', {
            'username': 'counsellor@skillmove.com',
            'password': 'ADmin@123'
        })
        assert res_login_counsellor.status_code == status.HTTP_200_OK

