import pytest
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import User, UserRole, EmployeeIdSequence
from apps.teams.models import Team

@pytest.mark.django_db
class TestUserCreate:
    def setup_method(self):
        self.client = APIClient()
        self.team_alpha = Team.objects.create(name="Team Alpha")
        self.team_beta = Team.objects.create(name="Team Beta")

        self.admin = User.objects.create_superuser(
            username="admin_test",
            email="admin@skillmove.in",
            password="adminpassword123",
            role=UserRole.ADMIN,
            employee_id="EMP-0001",
            mobile_number="+919876543210"
        )

        self.manager = User.objects.create_user(
            username="manager_test",
            email="manager@skillmove.in",
            password="managerpassword123",
            role=UserRole.MANAGER,
            team=self.team_alpha,
            employee_id="EMP-0002",
            mobile_number="+919876543211"
        )
        self.team_alpha.manager = self.manager
        self.team_alpha.save()

        self.counsellor = User.objects.create_user(
            username="counsellor_test",
            email="counsellor@skillmove.in",
            password="counsellorpassword123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha,
            employee_id="EMP-0003",
            mobile_number="+919876543212"
        )

    # 1. ADMIN USER CREATION
    def test_admin_can_create_manager(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "full_name": "Rohan Sharma",
            "email": "rohan.sharma@skillmove.in",
            "mobile_number": "+919876543220",
            "role": "MANAGER",
            "designation": "Regional Admissions Manager",
            "department": "Admissions",
            "work_location": "Bangalore HQ",
            "date_of_joining": "2026-10-10",
        }
        response = self.client.post("/api/auth/users/", payload)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.data
        assert data["email"] == "rohan.sharma@skillmove.in"
        assert data["full_name"] == "Rohan Sharma"
        assert data["first_name"] == "Rohan"
        assert data["last_name"] == "Sharma"
        assert data["role"] == "MANAGER"
        assert data["designation"] == "Regional Admissions Manager"
        assert data["department"] == "Admissions"
        assert data["work_location"] == "Bangalore HQ"
        assert data["employee_id"].startswith("EMP-")
        assert data["account_status"] == "ACTIVE"
        assert data["must_change_password"] is True

    def test_admin_can_create_sales_employee_with_team(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "full_name": "Priya Nair",
            "email": "priya.nair@skillmove.in",
            "mobile_number": "+919876543221",
            "role": "SALES_EMPLOYEE",
            "team": self.team_alpha.id,
            "designation": "Academic Counsellor",
        }
        response = self.client.post("/api/auth/users/", payload)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.data
        assert data["full_name"] == "Priya Nair"
        assert data["role"] == "SALES_EMPLOYEE"
        assert data["team"] == self.team_alpha.id
        assert data["team_name"] == "Team Alpha"
        assert data["reporting_manager_name"] == self.manager.full_name

    def test_admin_creating_sales_employee_requires_team(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "full_name": "Ananya Joshi",
            "email": "ananya.joshi@skillmove.in",
            "mobile_number": "+919876543222",
            "role": "SALES_EMPLOYEE",
            # No team provided
        }
        response = self.client.post("/api/auth/users/", payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "team" in response.data

    # 2. MANAGER USER CREATION & RESTRICTIONS
    def test_manager_can_create_sales_employee_in_their_team(self):
        self.client.force_authenticate(user=self.manager)
        payload = {
            "full_name": "Kavita Verma",
            "email": "kavita.verma@skillmove.in",
            "mobile_number": "+919876543223",
            "role": "SALES_EMPLOYEE",
            "team": self.team_alpha.id,
            "designation": "Inside Sales Specialist",
        }
        response = self.client.post("/api/auth/users/", payload)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.data
        assert data["full_name"] == "Kavita Verma"
        assert data["team"] == self.team_alpha.id
        assert data["reporting_manager_id"] == self.manager.id

    def test_manager_cannot_create_admin(self):
        self.client.force_authenticate(user=self.manager)
        payload = {
            "full_name": "Fake Admin",
            "email": "fake.admin@skillmove.in",
            "mobile_number": "+919876543224",
            "role": "ADMIN",
        }
        response = self.client.post("/api/auth/users/", payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "role" in response.data
        assert "Managers can only create Sales Employees" in str(response.data["role"])

    def test_manager_cannot_create_manager(self):
        self.client.force_authenticate(user=self.manager)
        payload = {
            "full_name": "Fake Manager",
            "email": "fake.manager@skillmove.in",
            "mobile_number": "+919876543225",
            "role": "MANAGER",
            "team": self.team_alpha.id,
        }
        response = self.client.post("/api/auth/users/", payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "role" in response.data

    def test_manager_cannot_assign_to_other_team(self):
        self.client.force_authenticate(user=self.manager)
        payload = {
            "full_name": "Unauthorized Team Emp",
            "email": "other.team@skillmove.in",
            "mobile_number": "+919876543226",
            "role": "SALES_EMPLOYEE",
            "team": self.team_beta.id,  # Other team!
        }
        response = self.client.post("/api/auth/users/", payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "team" in response.data
        assert "authorized team" in str(response.data["team"])

    # 3. SALES EMPLOYEE FORBIDDEN
    def test_sales_employee_cannot_create_users(self):
        self.client.force_authenticate(user=self.counsellor)
        payload = {
            "full_name": "Unauthorized Creation",
            "email": "unauth@skillmove.in",
            "mobile_number": "+919876543227",
            "role": "SALES_EMPLOYEE",
            "team": self.team_alpha.id,
        }
        response = self.client.post("/api/auth/users/", payload)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    # 4. DUPLICATE & FIELD VALIDATION
    def test_duplicate_email_rejected(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "full_name": "Duplicate Email User",
            "email": "admin@skillmove.in",  # Existing email
            "mobile_number": "+919876543228",
            "role": "MANAGER",
        }
        response = self.client.post("/api/auth/users/", payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "email" in response.data
        assert "already exists" in str(response.data["email"])

    def test_duplicate_mobile_rejected(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "full_name": "Duplicate Mobile User",
            "email": "unique.email@skillmove.in",
            "mobile_number": "+919876543210",  # Admin's mobile number
            "role": "MANAGER",
        }
        response = self.client.post("/api/auth/users/", payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "mobile_number" in response.data
        assert "already exists" in str(response.data["mobile_number"])

    def test_invalid_mobile_format_rejected(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "full_name": "Bad Phone User",
            "email": "badphone@skillmove.in",
            "mobile_number": "123",  # Too short
            "role": "MANAGER",
        }
        response = self.client.post("/api/auth/users/", payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "mobile_number" in response.data

    def test_required_fields_validation(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post("/api/auth/users/", {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "full_name" in response.data
        assert "email" in response.data
        assert "mobile_number" in response.data

    # 5. SERVER GENERATED EMPLOYEE ID
    def test_consecutive_employee_ids_are_unique_and_sequential(self):
        self.client.force_authenticate(user=self.admin)
        res1 = self.client.post("/api/auth/users/", {
            "full_name": "Seq User 1",
            "email": "seq1@skillmove.in",
            "mobile_number": "+919876543291",
            "role": "MANAGER",
        })
        assert res1.status_code == status.HTTP_201_CREATED
        emp_id_1 = res1.data["employee_id"]

        res2 = self.client.post("/api/auth/users/", {
            "full_name": "Seq User 2",
            "email": "seq2@skillmove.in",
            "mobile_number": "+919876543292",
            "role": "MANAGER",
        })
        assert res2.status_code == status.HTTP_201_CREATED
        emp_id_2 = res2.data["employee_id"]

        assert emp_id_1 != emp_id_2
        num1 = int(emp_id_1.replace("EMP-", ""))
        num2 = int(emp_id_2.replace("EMP-", ""))
        assert num2 == num1 + 1

    # 6. TASK 4 — SECURE TEMPORARY PASSWORD & CREDENTIALS
    def test_temporary_password_generated_and_returned_only_in_creation_response(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "full_name": "Karan Malhotra",
            "email": "karan.m@skillmove.in",
            "mobile_number": "+919876543301",
            "role": "MANAGER",
        }
        res = self.client.post("/api/auth/users/", payload)
        assert res.status_code == status.HTTP_201_CREATED
        data = res.data

        # 1. Returned in immediate creation response
        assert "temporary_password" in data
        temp_pwd = data["temporary_password"]
        assert len(temp_pwd) >= 12
        assert any(c.isupper() for c in temp_pwd)
        assert any(c.islower() for c in temp_pwd)
        assert any(c.isdigit() for c in temp_pwd)
        assert any(c in "!@#$%&*" for c in temp_pwd)
        assert data["must_change_password"] is True
        assert "login_url" in data

        # 2. Check database model has only the hashed password
        created_user = User.objects.get(email="karan.m@skillmove.in")
        assert created_user.password != temp_pwd
        assert (created_user.password.startswith("pbkdf2_sha256$") or
                created_user.password.startswith("argon2") or
                "pbkdf2" in created_user.password)
        assert created_user.check_password(temp_pwd) is True
        assert created_user.must_change_password is True

        # 3. Plaintext password is NEVER exposed in employee listing API
        list_res = self.client.get("/api/auth/users/?paginate=true")
        assert list_res.status_code == status.HTTP_200_OK
        results = list_res.data["results"]
        user_in_list = next((u for u in results if u["email"] == "karan.m@skillmove.in"), None)
        assert user_in_list is not None
        assert "temporary_password" not in user_in_list
        assert "password" not in user_in_list

        # 4. Plaintext password is NEVER exposed in me endpoint
        self.client.force_authenticate(user=created_user)
        me_res = self.client.get("/api/auth/me/")
        assert me_res.status_code == status.HTTP_200_OK
        assert "temporary_password" not in me_res.data
        assert "password" not in me_res.data

    def test_temporary_passwords_are_unpredictable_and_different(self):
        self.client.force_authenticate(user=self.admin)
        res1 = self.client.post("/api/auth/users/", {
            "full_name": "Random User 1",
            "email": "random1@skillmove.in",
            "mobile_number": "+919876543302",
            "role": "MANAGER",
        })
        res2 = self.client.post("/api/auth/users/", {
            "full_name": "Random User 2",
            "email": "random2@skillmove.in",
            "mobile_number": "+919876543303",
            "role": "MANAGER",
        })
        assert res1.status_code == status.HTTP_201_CREATED
        assert res2.status_code == status.HTTP_201_CREATED

        pwd1 = res1.data["temporary_password"]
        pwd2 = res2.data["temporary_password"]
        assert pwd1 != pwd2
