import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta
from apps.authentication.models import User, UserRole
from apps.teams.models import Team
from apps.leads.models import PipelineStage, Lead, PreCloserFinancial
from apps.communications.models import CommunicationLog, CommunicationChannel, CommunicationStatus

@pytest.fixture
def client():
    return APIClient()

@pytest.fixture
def setup_dashboard_data(db):
    team_a = Team.objects.create(name="Admissions Team A")
    team_b = Team.objects.create(name="Admissions Team B")

    admin = User.objects.create_user(
        username="admin@skillmove.com",
        email="admin@skillmove.com",
        password="password123",
        role=UserRole.ADMIN
    )

    manager_a = User.objects.create_user(
        username="manager_a@skillmove.com",
        email="manager_a@skillmove.com",
        password="password123",
        role=UserRole.MANAGER,
        team=team_a
    )
    team_a.manager = manager_a
    team_a.save()

    counsellor_a1 = User.objects.create_user(
        username="counsellor_a1@skillmove.com",
        email="counsellor_a1@skillmove.com",
        password="password123",
        role=UserRole.SALES_EMPLOYEE,
        team=team_a
    )

    counsellor_b1 = User.objects.create_user(
        username="counsellor_b1@skillmove.com",
        email="counsellor_b1@skillmove.com",
        password="password123",
        role=UserRole.SALES_EMPLOYEE,
        team=team_b
    )

    s1, _ = PipelineStage.objects.get_or_create(name="Cold Calling", defaults={"order": 1, "is_active": True})
    s10, _ = PipelineStage.objects.get_or_create(name="Enrolled", defaults={"order": 10, "is_active": True})
    s12, _ = PipelineStage.objects.get_or_create(name="Lost", defaults={"order": 12, "is_active": True})

    now = timezone.now()

    # Lead 1: Team A, assigned to counsellor_a1, Enrolled
    l1 = Lead.objects.create(
        name="Student 1",
        email="s1@test.com",
        phone="+1234567890",
        stage=s10,
        status="Enrolled",
        team=team_a,
        assigned_employee=counsellor_a1,
        created_by=manager_a,
        estimated_revenue=20000,
        placement_fee=2000,
        next_follow_up=now + timedelta(days=2)
    )

    # Lead 2: Team A, assigned to counsellor_a1, Active & overdue followup
    l2 = Lead.objects.create(
        name="Student 2",
        email="s2@test.com",
        phone="+1234567891",
        stage=s1,
        status="Active",
        team=team_a,
        assigned_employee=counsellor_a1,
        created_by=manager_a,
        estimated_revenue=15000,
        placement_fee=1500,
        next_follow_up=now - timedelta(hours=3)
    )

    # Lead 3: Team A, unassigned
    l3 = Lead.objects.create(
        name="Student 3 Unassigned",
        email="s3@test.com",
        phone="+1234567892",
        stage=s1,
        status="New",
        team=team_a,
        assigned_employee=None,
        created_by=manager_a,
        estimated_revenue=10000,
        placement_fee=1000
    )

    # Lead 4: Team B, assigned to counsellor_b1, Lost
    l4 = Lead.objects.create(
        name="Student 4 Team B",
        email="s4@test.com",
        phone="+1234567893",
        stage=s12,
        status="Lost",
        team=team_b,
        assigned_employee=counsellor_b1,
        created_by=admin,
        estimated_revenue=12000,
        placement_fee=1200
    )

    # Lead 5: Team B, unassigned
    l5 = Lead.objects.create(
        name="Student 5 Team B Unassigned",
        email="s5@test.com",
        phone="+1234567894",
        stage=s1,
        status="New",
        team=team_b,
        assigned_employee=None,
        created_by=admin
    )

    # Communication log
    CommunicationLog.objects.create(
        lead=l1,
        channel=CommunicationChannel.CALL,
        recipient=l1.phone,
        status=CommunicationStatus.SUCCESS,
        initiated_by=counsellor_a1
    )

    return {
        'admin': admin,
        'manager_a': manager_a,
        'counsellor_a1': counsellor_a1,
        'counsellor_b1': counsellor_b1,
        'team_a': team_a,
        'team_b': team_b,
        'stages': [s1, s10, s12],
        'leads': [l1, l2, l3, l4, l5]
    }

@pytest.mark.django_db
class TestDashboardStats:
    def test_unauthenticated_request_rejected(self, client):
        url = reverse('dashboard-stats')
        res = client.get(url)
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_admin_dashboard_stats_scope_and_metrics(self, client, setup_dashboard_data):
        admin = setup_dashboard_data['admin']
        client.force_authenticate(user=admin)
        url = reverse('dashboard-stats')
        res = client.get(url)

        assert res.status_code == status.HTTP_200_OK
        data = res.data
        assert data['role'] == 'ADMIN'
        kpis = data['kpis']

        # Total leads across all teams: 5
        assert kpis['total_leads'] == 5
        # Active leads: exclude Lost (lead 4 is lost -> 4 active)
        assert kpis['active_leads'] == 4
        # Enrolled leads: 1
        assert kpis['enrolled_leads'] == 1
        # Lost leads: 1
        assert kpis['lost_leads'] == 1
        # Unassigned leads: 2 (lead 3 in Team A, lead 5 in Team B)
        assert kpis['unassigned_leads'] == 2
        # Revenue and Placement fee calculations
        assert kpis['total_estimated_revenue'] == 20000 + 15000 + 10000 + 12000
        assert kpis['total_placement_fees'] == 2000 + 1500 + 1000 + 1200
        # Overdue follow-ups: lead 2 is overdue
        assert kpis['followups_overdue'] >= 1

        # Team overview present for admin
        assert len(data['team_overview']) == 2
        # Pipeline overview contains configured active stages (all 12 seeded stages)
        assert len(data['pipeline_overview']) == PipelineStage.objects.filter(is_active=True).count()

    def test_manager_dashboard_stats_scoped_to_team(self, client, setup_dashboard_data):
        manager_a = setup_dashboard_data['manager_a']
        client.force_authenticate(user=manager_a)
        url = reverse('dashboard-stats')
        res = client.get(url)

        assert res.status_code == status.HTTP_200_OK
        data = res.data
        assert data['role'] == 'MANAGER'
        kpis = data['kpis']

        # Team A has 3 leads total (l1, l2, l3)
        assert kpis['total_leads'] == 3
        # Unassigned in Team A: 1 (lead 3)
        assert kpis['unassigned_leads'] == 1
        # Assigned in Team A: 2 (lead 1, lead 2)
        assert kpis['assigned_leads'] == 2
        # Enrolled in Team A: 1 (lead 1)
        assert kpis['enrolled_leads'] == 1
        # Lost in Team A: 0
        assert kpis['lost_leads'] == 0
        # Pending follow-ups in Team A: 2 (l1, l2)
        assert kpis['pending_followups'] == 2

        # Member performance is scoped to Team A members
        team_members = [m['username'] for m in data['member_performance']]
        assert 'counsellor_a1@skillmove.com' in team_members
        assert 'counsellor_b1@skillmove.com' not in team_members

    def test_counsellor_dashboard_stats_scoped_to_own_leads(self, client, setup_dashboard_data):
        counsellor_a1 = setup_dashboard_data['counsellor_a1']
        client.force_authenticate(user=counsellor_a1)
        url = reverse('dashboard-stats')
        res = client.get(url)

        assert res.status_code == status.HTTP_200_OK
        data = res.data
        assert data['role'] == 'SALES_EMPLOYEE'
        kpis = data['kpis']

        # Counsellor A1 has 2 assigned leads (l1, l2)
        assert kpis['total_leads'] == 2
        assert kpis['active_leads'] == 2
        assert kpis['enrolled_leads'] == 1
        assert kpis['lost_leads'] == 0
        assert kpis['followups_overdue'] == 1

        # Followup list contains only Counsellor A1's leads
        for f in data['followup_list']:
            assert f['assigned_employee_name'] == 'counsellor_a1@skillmove.com'

    def test_invalid_date_range_validation(self, client, setup_dashboard_data):
        admin = setup_dashboard_data['admin']
        client.force_authenticate(user=admin)
        url = reverse('dashboard-stats')

        # Start date after end date should return 400 Bad Request
        res = client.get(f"{url}?start_date=2026-10-20&end_date=2026-10-10")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "Start date cannot be after end date" in res.data['error']

    def test_pending_closure_financials_and_missing_records(self, client, setup_dashboard_data):
        admin = setup_dashboard_data['admin']
        team_a = setup_dashboard_data['team_a']
        client.force_authenticate(user=admin)

        s_pc, _ = PipelineStage.objects.get_or_create(
            name="Pending Closure",
            defaults={"order": 9, "is_active": True}
        )

        # Create PC lead 1 with verified financial record
        lead_pc1 = Lead.objects.create(
            name="PC Student 1",
            email="pc1@test.com",
            stage=s_pc,
            status="Active",
            team=team_a,
            assigned_employee=setup_dashboard_data['counsellor_a1'],
            created_by=admin
        )
        PreCloserFinancial.objects.create(
            lead=lead_pc1,
            agreed_amount=50000.00,
            amount_paid=20000.00,
            created_by=admin,
            updated_by=admin
        )

        # Create PC lead 2 WITHOUT financial record (to trigger missing financial integrity alert)
        lead_pc2 = Lead.objects.create(
            name="PC Student 2 Missing Fin",
            email="pc2@test.com",
            stage=s_pc,
            status="Active",
            team=team_a,
            assigned_employee=setup_dashboard_data['counsellor_a1'],
            created_by=admin
        )

        url = reverse('dashboard-stats')
        res = client.get(url)
        assert res.status_code == status.HTTP_200_OK

        fin = res.data['pending_closure_financials']
        assert fin['leads_count'] >= 2
        assert fin['total_agreed_amount'] >= 50000.00
        assert fin['total_amount_paid'] >= 20000.00
        assert fin['total_outstanding_balance'] >= 30000.00
        assert fin['missing_financial_count'] >= 1

        # Check table contents
        table = fin['outstanding_leads_table']
        missing_rows = [r for r in table if r['lead_id'] == lead_pc2.id]
        assert len(missing_rows) == 1
        assert missing_rows[0]['is_missing_financial'] is True

    def test_admin_filter_by_team_and_employee(self, client, setup_dashboard_data):
        admin = setup_dashboard_data['admin']
        team_a = setup_dashboard_data['team_a']
        counsellor_a1 = setup_dashboard_data['counsellor_a1']
        client.force_authenticate(user=admin)

        url = reverse('dashboard-stats')
        # Filter by Team A
        res_team = client.get(f"{url}?team_id={team_a.id}")
        assert res_team.status_code == status.HTTP_200_OK
        # Team A leads
        assert res_team.data['kpis']['total_leads'] == 3

        # Filter by Counsellor A1
        res_emp = client.get(f"{url}?employee_id={counsellor_a1.id}")
        assert res_emp.status_code == status.HTTP_200_OK
        assert res_emp.data['kpis']['total_leads'] == 2

    def test_manager_cannot_bypass_team_isolation(self, client, setup_dashboard_data):
        manager_a = setup_dashboard_data['manager_a']
        team_b = setup_dashboard_data['team_b']
        client.force_authenticate(user=manager_a)

        url = reverse('dashboard-stats')
        # Manager A attempts to request Team B's data
        res = client.get(f"{url}?team_id={team_b.id}")
        assert res.status_code == status.HTTP_200_OK
        # Must still return Team A's leads (3), never Team B
        assert res.data['kpis']['total_leads'] == 3

    def test_communications_breakdown_and_metadata(self, client, setup_dashboard_data):
        admin = setup_dashboard_data['admin']
        l1 = setup_dashboard_data['leads'][0]
        client.force_authenticate(user=admin)

        # Create additional logs: Email success and WhatsApp failed
        CommunicationLog.objects.create(
            lead=l1,
            channel=CommunicationChannel.EMAIL,
            recipient="s1@test.com",
            status=CommunicationStatus.SUCCESS,
            initiated_by=admin
        )
        CommunicationLog.objects.create(
            lead=l1,
            channel=CommunicationChannel.WHATSAPP,
            recipient="+1234567890",
            status=CommunicationStatus.FAILED,
            error_message="Recipient phone invalid",
            initiated_by=admin
        )

        url = reverse('dashboard-stats')
        res = client.get(url)
        assert res.status_code == status.HTTP_200_OK

        comms = res.data['communications_activity']
        assert comms['calls']['attempts'] >= 1
        assert comms['email']['accepted'] >= 1
        assert comms['whatsapp']['failed'] >= 1
        # Verify provider honesty metadata
        assert "SMTP gateway accepted" in comms['metadata']['email_note']
        assert "Meta Cloud API" in comms['metadata']['whatsapp_note']

    def test_attention_required_and_system_health(self, client, setup_dashboard_data):
        admin = setup_dashboard_data['admin']
        client.force_authenticate(user=admin)

        url = reverse('dashboard-stats')
        res = client.get(url)
        assert res.status_code == status.HTTP_200_OK

        attention = res.data['attention_required']
        assert attention['overdue_followups'] >= 1
        assert attention['unassigned_leads'] >= 2

        # Admin system health must exist and must not expose sensitive secrets
        health = res.data['system_health']
        assert health is not None
        assert 'email_smtp' in health
        assert 'whatsapp' in health
        assert 'callyzer' in health
        assert 'password' not in str(health).lower()
        assert 'token' not in health['whatsapp']
