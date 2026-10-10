import os
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from apps.authentication.models import User, UserRole
from apps.teams.models import Team


class Command(BaseCommand):
    help = "Idempotently provision or update development/test login credentials for Admin, Manager, and Counsellor."

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force provisioning even if DEBUG is False',
        )

    def handle(self, *args, **options):
        # Safety Guard: Ensure predictable test credentials are not seeded in production
        is_production = os.environ.get('ENVIRONMENT', '').lower() == 'production'
        if is_production and not options.get('force', False):
            raise CommandError("Refusing to seed development/test passwords in production environment.")

        # Ensure active admissions team exists
        team, _ = Team.objects.get_or_create(name="Skill Move Admissions")

        # 1. ADMIN: admin@skillmove.com / ADmin@123
        admin, _ = User.objects.get_or_create(
            username="admin@skillmove.com",
            defaults={"email": "admin@skillmove.com", "role": UserRole.ADMIN}
        )
        admin.email = "admin@skillmove.com"
        admin.role = UserRole.ADMIN
        admin.is_staff = True
        admin.is_superuser = True
        admin.set_password("ADmin@123")
        admin.save()
        self.stdout.write(self.style.SUCCESS("Provisioned Admin: admin@skillmove.com"))

        # 2. MANAGER: manager@skillmove.com / ADmin@123
        manager, _ = User.objects.get_or_create(
            username="manager@skillmove.com",
            defaults={"email": "manager@skillmove.com", "role": UserRole.MANAGER, "team": team}
        )
        manager.email = "manager@skillmove.com"
        manager.role = UserRole.MANAGER
        manager.is_staff = False
        manager.is_superuser = False
        manager.team = team
        manager.set_password("ADmin@123")
        manager.save()
        team.manager = manager
        team.save()
        self.stdout.write(self.style.SUCCESS("Provisioned Manager: manager@skillmove.com"))

        # 3. COUNSELLOR: counsellor@skillmove.com / ADmin@123 (SALES_EMPLOYEE role)
        # Note: also updates legacy spelling councellor@skillmove.com if present
        for username in ["counsellor@skillmove.com", "councellor@skillmove.com"]:
            counsellor, _ = User.objects.get_or_create(
                username=username,
                defaults={"email": username, "role": UserRole.SALES_EMPLOYEE, "team": team}
            )
            counsellor.email = username
            counsellor.role = UserRole.SALES_EMPLOYEE
            counsellor.is_staff = False
            counsellor.is_superuser = False
            counsellor.team = team
            counsellor.set_password("ADmin@123")
            counsellor.save()
            self.stdout.write(self.style.SUCCESS(f"Provisioned Counsellor: {username}"))

        self.stdout.write(self.style.SUCCESS("All development/test credentials provisioned successfully with hashed passwords."))
