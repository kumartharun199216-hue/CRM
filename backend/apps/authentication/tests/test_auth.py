import pytest
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import User, UserRole
from apps.teams.models import Team

@pytest.mark.django_db
class TestAuthentication:
    def setup_method(self):
        self.client = APIClient()
        self.team = Team.objects.create(name="North Team")
        self.admin = User.objects.create_superuser(
            username="admin_user",
            email="admin@test.com",
            password="adminpassword123",
            role=UserRole.ADMIN
        )
        self.manager = User.objects.create_user(
            username="manager_user",
            email="manager@test.com",
            password="managerpassword123",
            role=UserRole.MANAGER,
            team=self.team
        )
        self.team.manager = self.manager
        self.team.save()

        self.employee = User.objects.create_user(
            username="employee_user",
            email="employee@test.com",
            password="employeepassword123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team
        )

    def test_login_success(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'admin_user',
            'password': 'adminpassword123'
        })
        assert response.status_code == status.HTTP_200_OK
        assert 'token' in response.data
        assert response.data['user']['role'] == UserRole.ADMIN

    def test_login_invalid_password(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'admin_user',
            'password': 'wrongpassword'
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_me_endpoint(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.get('/api/auth/me/')
        assert response.status_code == status.HTTP_200_OK
        assert response.data['username'] == 'manager_user'
        assert response.data['role'] == UserRole.MANAGER
        assert response.data['team_name'] == 'North Team'

    def test_sales_employee_creation_requires_team(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/auth/users/', {
            'username': 'new_emp',
            'password': 'securepassword123',
            'role': UserRole.SALES_EMPLOYEE
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'team' in response.data

    def test_sales_employee_cannot_create_users(self):
        self.client.force_authenticate(user=self.employee)
        response = self.client.post('/api/auth/users/', {
            'username': 'new_emp2',
            'password': 'securepassword123',
            'role': UserRole.SALES_EMPLOYEE,
            'team': self.team.id
        })
        assert response.status_code == status.HTTP_403_FORBIDDEN
