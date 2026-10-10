import pytest
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import User, UserRole
from apps.teams.models import Team

@pytest.mark.django_db
class TestUserListingAndPermissions:
    def setup_method(self):
        self.client = APIClient()

        # Teams
        self.team_alpha = Team.objects.create(name="Alpha Admissions")
        self.team_beta = Team.objects.create(name="Beta Admissions")

        # Admin
        self.admin = User.objects.create_superuser(
            username="org_admin",
            email="admin@skillmove.com",
            first_name="Super",
            last_name="Admin",
            password="adminpassword123",
            role=UserRole.ADMIN,
            mobile_number="+919800000001",
            employee_id="EMP-0001",
            designation="Executive Director"
        )

        # Managers
        self.manager_alpha = User.objects.create_user(
            username="mgr_alpha",
            email="manager.alpha@skillmove.com",
            first_name="Aman",
            last_name="Verma",
            password="mgrpassword123",
            role=UserRole.MANAGER,
            team=self.team_alpha,
            mobile_number="+919800000002",
            employee_id="EMP-0002",
            designation="Senior Admissions Manager"
        )
        self.team_alpha.manager = self.manager_alpha
        self.team_alpha.save()

        self.manager_beta = User.objects.create_user(
            username="mgr_beta",
            email="manager.beta@skillmove.com",
            first_name="Bhavna",
            last_name="Roy",
            password="mgrpassword123",
            role=UserRole.MANAGER,
            team=self.team_beta,
            mobile_number="+919800000003",
            employee_id="EMP-0003",
            designation="Admissions Manager"
        )
        self.team_beta.manager = self.manager_beta
        self.team_beta.save()

        # Sales Employees
        self.emp_alpha_active = User.objects.create_user(
            username="emp_alpha_1",
            email="counsellor1@skillmove.com",
            first_name="Chirag",
            last_name="Gupta",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha,
            mobile_number="+919800000004",
            employee_id="EMP-0004",
            designation="Career Counsellor",
            is_active=True
        )

        self.emp_alpha_inactive = User.objects.create_user(
            username="emp_alpha_2",
            email="counsellor2@skillmove.com",
            first_name="Deepak",
            last_name="Kumar",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_alpha,
            mobile_number="+919800000005",
            employee_id="EMP-0005",
            designation="Junior Counsellor",
            is_active=False
        )

        self.emp_beta_active = User.objects.create_user(
            username="emp_beta_1",
            email="counsellor3@skillmove.com",
            first_name="Ekta",
            last_name="Sharma",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team_beta,
            mobile_number="+919800000006",
            employee_id="EMP-0006",
            designation="Career Counsellor",
            is_active=True
        )

    def test_admin_can_view_all_users_paginated(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/auth/users/?paginate=true&page=1&page_size=10')
        assert response.status_code == status.HTTP_200_OK
        data = response.data
        assert 'results' in data
        assert data['count'] == 6
        assert data['total_pages'] == 1
        assert data['current_page'] == 1
        assert len(data['results']) == 6

        # Check required fields in serialized response
        first_user = data['results'][0]
        assert 'employee_id' in first_user
        assert 'full_name' in first_user
        assert 'email' in first_user
        assert 'mobile_number' in first_user
        assert 'role' in first_user
        assert 'designation' in first_user
        assert 'team' in first_user
        assert 'team_name' in first_user
        assert 'reporting_manager_name' in first_user
        assert 'account_status' in first_user
        assert 'date_joined' in first_user

    def test_manager_sees_only_own_team_and_self(self):
        self.client.force_authenticate(user=self.manager_alpha)
        response = self.client.get('/api/auth/users/?paginate=true&status=all')
        assert response.status_code == status.HTTP_200_OK
        results = response.data['results']
        user_ids = [u['id'] for u in results]

        # Should include manager_alpha, emp_alpha_active, emp_alpha_inactive
        assert self.manager_alpha.id in user_ids
        assert self.emp_alpha_active.id in user_ids
        assert self.emp_alpha_inactive.id in user_ids

        # Should NOT include manager_beta, emp_beta_active, admin
        assert self.manager_beta.id not in user_ids
        assert self.emp_beta_active.id not in user_ids
        assert self.admin.id not in user_ids

    def test_sales_employee_forbidden_from_users_list(self):
        self.client.force_authenticate(user=self.emp_alpha_active)
        response = self.client.get('/api/auth/users/')
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_search_by_name(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/auth/users/?paginate=true&search=Chirag')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['username'] == 'emp_alpha_1'

    def test_search_by_email(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/auth/users/?paginate=true&search=counsellor3@skillmove.com')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['username'] == 'emp_beta_1'

    def test_search_by_mobile_number(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/auth/users/?paginate=true&search=9800000005')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['username'] == 'emp_alpha_2'

    def test_search_by_employee_id(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/auth/users/?paginate=true&search=EMP-0004')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 1
        assert response.data['results'][0]['employee_id'] == 'EMP-0004'

    def test_filter_by_role(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/auth/users/?paginate=true&role=MANAGER')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 2
        roles = [u['role'] for u in response.data['results']]
        assert all(r == 'MANAGER' for r in roles)

    def test_filter_by_team(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f'/api/auth/users/?paginate=true&team={self.team_beta.id}')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['count'] == 2
        usernames = [u['username'] for u in response.data['results']]
        assert 'mgr_beta' in usernames
        assert 'emp_beta_1' in usernames

    def test_filter_by_account_status(self):
        self.client.force_authenticate(user=self.admin)
        # Active only
        res_active = self.client.get('/api/auth/users/?paginate=true&status=active')
        assert res_active.status_code == status.HTTP_200_OK
        assert res_active.data['count'] == 5
        assert all(u['is_active'] is True for u in res_active.data['results'])

        # Inactive only
        res_inactive = self.client.get('/api/auth/users/?paginate=true&status=inactive')
        assert res_inactive.status_code == status.HTTP_200_OK
        assert res_inactive.data['count'] == 1
        assert res_inactive.data['results'][0]['username'] == 'emp_alpha_2'
        assert res_inactive.data['results'][0]['account_status'] == 'INACTIVE'
