import pytest
from rest_framework.test import APIClient
from rest_framework import status
from apps.authentication.models import User, UserRole
from apps.teams.models import Team

@pytest.mark.django_db
class TestTeams:
    def setup_method(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            username="admin1",
            email="admin1@test.com",
            password="password123",
            role=UserRole.ADMIN
        )
        self.manager1 = User.objects.create_user(
            username="mgr1",
            email="mgr1@test.com",
            password="password123",
            role=UserRole.MANAGER
        )
        self.manager2 = User.objects.create_user(
            username="mgr2",
            email="mgr2@test.com",
            password="password123",
            role=UserRole.MANAGER
        )
        self.team1 = Team.objects.create(name="Alpha Team", manager=self.manager1)
        self.manager1.team = self.team1
        self.manager1.save()

        self.employee1 = User.objects.create_user(
            username="emp1",
            email="emp1@test.com",
            password="password123",
            role=UserRole.SALES_EMPLOYEE,
            team=self.team1
        )

    def test_admin_can_create_team(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/teams/', {
            'name': 'Beta Team',
            'manager': self.manager2.id
        })
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data['name'] == 'Beta Team'

    def test_team_manager_must_have_manager_role(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/teams/', {
            'name': 'Gamma Team',
            'manager': self.employee1.id
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_one_manager_per_team_constraint(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/teams/', {
            'name': 'Delta Team',
            'manager': self.manager1.id  # manager1 is already manager of Alpha Team
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_sales_employee_cannot_create_team(self):
        self.client.force_authenticate(user=self.employee1)
        response = self.client.post('/api/teams/', {
            'name': 'Unauthorized Team'
        })
        assert response.status_code == status.HTTP_403_FORBIDDEN
