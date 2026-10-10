import pytest
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import Lead, PipelineStage, LeadAssignmentHistory

@pytest.mark.django_db(transaction=True)
class TestLeadEditAndAuthorization:
    def setup_method(self):
        self.client = APIClient()

        # Pipeline stages
        self.stage_new, _ = PipelineStage.objects.get_or_create(order=1, defaults={'name': 'New Lead', 'is_active': True})
        self.stage_contacted, _ = PipelineStage.objects.get_or_create(order=2, defaults={'name': 'Contacted', 'is_active': True})

        # Teams
        self.team_alpha = Team.objects.create(name="Alpha Admissions")
        self.team_beta = Team.objects.create(name="Beta Admissions")

        # Admin
        self.admin = User.objects.create_superuser(
            username="org_admin",
            email="admin@skillmove.com",
            first_name="Super",
            last_name="Admin",
            password="AdminPassword123!",
            role=UserRole.ADMIN,
            mobile_number="+919800000001",
            employee_id="EMP-0001"
        )

        # Managers
        self.manager_alpha = User.objects.create_user(
            username="mgr_alpha",
            email="manager.alpha@skillmove.com",
            first_name="Aman",
            last_name="Verma",
            password="MgrPassword123!",
            role=UserRole.MANAGER,
            team=self.team_alpha,
            mobile_number="+919800000002",
            employee_id="EMP-0002"
        )
        self.team_alpha.manager = self.manager_alpha
        self.team_alpha.save()

        self.manager_beta = User.objects.create_user(
            username="mgr_beta",
            email="manager.beta@skillmove.com",
            first_name="Bhavna",
            last_name="Roy",
            password="MgrPassword123!",
            role=UserRole.MANAGER,
            team=self.team_beta,
            mobile_number="+919800000003",
            employee_id="EMP-0003"
        )
        self.team_beta.manager = self.manager_beta
        self.team_beta.save()

        # Sales Employees
        self.emp_alpha_1 = User.objects.create_user(
            username="counsellor_a1",
            email="counsellor.a1@skillmove.com",
            first_name="Chirag",
            last_name="Sharma",
            password="EmpPassword123!",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha,
            mobile_number="+919800000004",
            employee_id="EMP-0004"
        )

        self.emp_alpha_2 = User.objects.create_user(
            username="counsellor_a2",
            email="counsellor.a2@skillmove.com",
            first_name="Deepak",
            last_name="Joshi",
            password="EmpPassword123!",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha,
            mobile_number="+919800000005",
            employee_id="EMP-0005"
        )

        self.emp_beta_1 = User.objects.create_user(
            username="counsellor_b1",
            email="counsellor.b1@skillmove.com",
            first_name="Esha",
            last_name="Gupta",
            password="EmpPassword123!",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_beta,
            mobile_number="+919800000006",
            employee_id="EMP-0006"
        )

        # Authorized Lead in Team Alpha assigned to emp_alpha_1
        self.lead_alpha = Lead.objects.create(
            name="Rohan Mehra",
            title="Rohan Mehra",
            contact_name="Rohan Mehra",
            email="rohan.mehra@example.com",
            phone="+919876543210",
            qualification="B.Tech",
            college="Delhi University",
            yop="2023",
            key_skills="Java, Spring",
            target_role="Java Developer",
            experience="1 Year",
            priority="HIGH",
            status="NEW",
            city="Delhi",
            team=self.team_alpha,
            assigned_employee=self.emp_alpha_1,
            stage=self.stage_new,
            created_by=self.manager_alpha
        )
        LeadAssignmentHistory.objects.create(
            lead=self.lead_alpha,
            from_team=None,
            to_team=self.team_alpha,
            from_employee=None,
            to_employee=self.emp_alpha_1,
            changed_by=self.manager_alpha
        )

    # 1. Sales Employee edits an authorized lead's ordinary fields
    def test_sales_employee_edits_authorized_lead_ordinary_fields(self):
        self.client.force_authenticate(user=self.emp_alpha_1)
        payload = {
            "name": "Rohan Mehra Updated",
            "email": "rohan.updated@example.com",
            "phone": "+919876543299",
            "qualification": "M.Tech Software Engineering",
            "college": "IIT Delhi",
            "yop": "2024",
            "key_skills": "Python, Django, React",
            "target_role": "Full Stack Engineer",
            "experience": "2 Years",
            "priority": "URGENT",
            "city": "Noida",
        }
        response = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", payload, format="json")
        assert response.status_code == status.HTTP_200_OK

        self.lead_alpha.refresh_from_db()
        assert self.lead_alpha.name == "Rohan Mehra Updated"
        assert self.lead_alpha.email == "rohan.updated@example.com"
        assert self.lead_alpha.phone == "+919876543299"
        assert self.lead_alpha.qualification == "M.Tech Software Engineering"
        assert self.lead_alpha.college == "IIT Delhi"
        assert self.lead_alpha.key_skills == "Python, Django, React"
        assert self.lead_alpha.target_role == "Full Stack Engineer"
        assert self.lead_alpha.priority == "URGENT"
        assert self.lead_alpha.city == "Noida"
        # Ownership must remain unchanged
        assert self.lead_alpha.team == self.team_alpha
        assert self.lead_alpha.assigned_employee == self.emp_alpha_1

    # 2. An unchanged assignment is preserved
    def test_unchanged_assignment_is_preserved_when_fields_omitted_or_resubmitted(self):
        self.client.force_authenticate(user=self.emp_alpha_1)

        # 2a. Omitted assignment fields
        res1 = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {"city": "Gurugram"}, format="json")
        assert res1.status_code == status.HTTP_200_OK
        self.lead_alpha.refresh_from_db()
        assert self.lead_alpha.city == "Gurugram"
        assert self.lead_alpha.team == self.team_alpha
        assert self.lead_alpha.assigned_employee == self.emp_alpha_1

        # 2b. Explicit resubmission of unchanged valid assignment
        res2 = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {
            "city": "Faridabad",
            "team": self.team_alpha.id,
            "assigned_employee": self.emp_alpha_1.id
        }, format="json")
        assert res2.status_code == status.HTTP_200_OK
        self.lead_alpha.refresh_from_db()
        assert self.lead_alpha.city == "Faridabad"
        assert self.lead_alpha.team == self.team_alpha
        assert self.lead_alpha.assigned_employee == self.emp_alpha_1

        # Verify no bogus assignment history was recorded for ordinary edits
        assert LeadAssignmentHistory.objects.filter(lead=self.lead_alpha).count() == 1

    # 3. A user cannot edit a lead outside their scope
    def test_user_cannot_edit_lead_outside_their_scope(self):
        # 3a. Sales Employee from another team (emp_beta_1)
        self.client.force_authenticate(user=self.emp_beta_1)
        res_beta = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {"name": "Hacked Lead"}, format="json")
        assert res_beta.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN]

        # 3b. Sales Employee from same team but not assigned (emp_alpha_2)
        self.client.force_authenticate(user=self.emp_alpha_2)
        res_alpha2 = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {"name": "Hacked Lead 2"}, format="json")
        assert res_alpha2.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN]

        # 3c. Manager from another team (manager_beta)
        self.client.force_authenticate(user=self.manager_beta)
        res_mgr_beta = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {"name": "Hacked Lead 3"}, format="json")
        assert res_mgr_beta.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN]

        # Confirm DB state completely untouched
        self.lead_alpha.refresh_from_db()
        assert self.lead_alpha.name == "Rohan Mehra"

    # 4. Manager edits a lead within their team
    def test_manager_edits_lead_within_team_and_reassigns(self):
        self.client.force_authenticate(user=self.manager_alpha)

        # 4a. Edit ordinary fields
        res1 = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {
            "priority": "LOW",
            "experience": "3 Years"
        }, format="json")
        assert res1.status_code == status.HTTP_200_OK

        # 4b. Reassign within authorized team (emp_alpha_1 -> emp_alpha_2)
        res2 = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {
            "assigned_employee": self.emp_alpha_2.id
        }, format="json")
        assert res2.status_code == status.HTTP_200_OK

        self.lead_alpha.refresh_from_db()
        assert self.lead_alpha.priority == "LOW"
        assert self.lead_alpha.experience == "3 Years"
        assert self.lead_alpha.assigned_employee == self.emp_alpha_2

        # Verify assignment history recorded reassignment
        latest_history = LeadAssignmentHistory.objects.filter(lead=self.lead_alpha).order_by('-timestamp').first()
        assert latest_history.from_employee == self.emp_alpha_1
        assert latest_history.to_employee == self.emp_alpha_2
        assert latest_history.changed_by == self.manager_alpha

    # 5. Manager cannot reassign a lead to an unauthorized team
    def test_manager_cannot_reassign_to_unauthorized_team_or_external_employee(self):
        self.client.force_authenticate(user=self.manager_alpha)

        # 5a. Attempt to reassign lead to Team Beta
        res1 = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {
            "team": self.team_beta.id
        }, format="json")
        assert res1.status_code == status.HTTP_400_BAD_REQUEST
        assert "team" in res1.data

        # 5b. Attempt to assign lead to an employee in Team Beta
        res2 = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {
            "assigned_employee": self.emp_beta_1.id
        }, format="json")
        assert res2.status_code == status.HTTP_400_BAD_REQUEST
        assert "assigned_employee" in res2.data

        # Verify DB remained unchanged
        self.lead_alpha.refresh_from_db()
        assert self.lead_alpha.team == self.team_alpha
        assert self.lead_alpha.assigned_employee == self.emp_alpha_1

    # 6. Admin can perform authorized edits
    def test_admin_can_perform_authorized_edits_across_teams(self):
        self.client.force_authenticate(user=self.admin)

        # Admin can reassign lead to Team Beta and employee_beta_1
        res = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {
            "team": self.team_beta.id,
            "assigned_employee": self.emp_beta_1.id,
            "city": "Bengaluru"
        }, format="json")
        assert res.status_code == status.HTTP_200_OK

        self.lead_alpha.refresh_from_db()
        assert self.lead_alpha.team == self.team_beta
        assert self.lead_alpha.assigned_employee == self.emp_beta_1
        assert self.lead_alpha.city == "Bengaluru"

    # 7. The user lookup does not expose unrelated users
    def test_user_lookup_does_not_expose_unrelated_users_or_sensitive_fields(self):
        # 7a. Sales Employee lookup
        self.client.force_authenticate(user=self.emp_alpha_1)
        res_emp = self.client.get("/api/auth/users/lookup/")
        assert res_emp.status_code == status.HTTP_200_OK
        data_emp = res_emp.data
        emp_ids = [u['id'] for u in data_emp]

        # Only Team Alpha members (mgr_alpha, emp_alpha_1, emp_alpha_2)
        assert self.emp_alpha_1.id in emp_ids
        assert self.emp_alpha_2.id in emp_ids
        # Must NOT expose Team Beta users or Org Admin
        assert self.emp_beta_1.id not in emp_ids
        assert self.manager_beta.id not in emp_ids
        assert self.admin.id not in emp_ids

        # Ensure NO sensitive fields leaked in lookup
        first_user = data_emp[0]
        assert 'id' in first_user
        assert 'employee_id' in first_user
        assert 'username' in first_user
        assert 'full_name' in first_user
        assert 'role' in first_user
        assert 'team' in first_user
        assert 'team_name' in first_user

        assert 'email' not in first_user
        assert 'mobile_number' not in first_user
        assert 'date_joined' not in first_user
        assert 'last_login' not in first_user
        assert 'account_status' not in first_user
        assert 'reporting_manager_id' not in first_user

        # 7b. Full user directory /api/auth/users/ remains strictly 403 Forbidden for Sales Employee
        res_forbidden = self.client.get("/api/auth/users/")
        assert res_forbidden.status_code == status.HTTP_403_FORBIDDEN

        # 7c. Manager lookup sees only authorized team
        self.client.force_authenticate(user=self.manager_alpha)
        res_mgr = self.client.get("/api/auth/users/lookup/")
        assert res_mgr.status_code == status.HTTP_200_OK
        mgr_ids = [u['id'] for u in res_mgr.data]
        assert self.manager_alpha.id in mgr_ids
        assert self.emp_alpha_1.id in mgr_ids
        assert self.emp_beta_1.id not in mgr_ids

    # 8. A failed update leaves the record unchanged
    def test_failed_update_leaves_record_unchanged(self):
        self.client.force_authenticate(user=self.emp_alpha_1)

        # Sales Employee attempts unauthorized reassignment alongside field update
        res = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {
            "name": "Tampered Name",
            "assigned_employee": self.emp_alpha_2.id
        }, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST

        # Atomic rollback verification: neither name nor assigned_employee changed
        self.lead_alpha.refresh_from_db()
        assert self.lead_alpha.name == "Rohan Mehra"
        assert self.lead_alpha.assigned_employee == self.emp_alpha_1

        # Attempt invalid phone
        res_phone = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {
            "name": "Another Tampered Name",
            "phone": "invalid-phone"
        }, format="json")
        assert res_phone.status_code == status.HTTP_400_BAD_REQUEST
        self.lead_alpha.refresh_from_db()
        assert self.lead_alpha.name == "Rohan Mehra"
        assert self.lead_alpha.phone == "+919876543210"

    # 9. Assignment history remains correct
    def test_assignment_history_remains_correct_and_not_polluted(self):
        # Initial history count
        initial_history_count = LeadAssignmentHistory.objects.filter(lead=self.lead_alpha).count()
        assert initial_history_count == 1

        # Ordinary edit by assigned sales employee
        self.client.force_authenticate(user=self.emp_alpha_1)
        res1 = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {
            "city": "Pune",
            "target_role": "Backend Architect"
        }, format="json")
        assert res1.status_code == status.HTTP_200_OK

        # History count must NOT increase
        assert LeadAssignmentHistory.objects.filter(lead=self.lead_alpha).count() == 1

        # Authorized reassignment by Manager
        self.client.force_authenticate(user=self.manager_alpha)
        res2 = self.client.patch(f"/api/leads/{self.lead_alpha.id}/", {
            "assigned_employee": self.emp_alpha_2.id
        }, format="json")
        assert res2.status_code == status.HTTP_200_OK

        # History count must be exactly 2
        histories = list(LeadAssignmentHistory.objects.filter(lead=self.lead_alpha).order_by('timestamp'))
        assert len(histories) == 2
        latest = histories[1]
        assert latest.from_team == self.team_alpha
        assert latest.to_team == self.team_alpha
        assert latest.from_employee == self.emp_alpha_1
        assert latest.to_employee == self.emp_alpha_2
        assert latest.changed_by == self.manager_alpha
