from django.core.management.base import BaseCommand
from decimal import Decimal
from apps.authentication.models import User
from apps.teams.models import Team
from apps.leads.models import PipelineStage, Lead

class Command(BaseCommand):
    help = "Seed realistic unassigned student leads for intake and assignment workflows"

    def handle(self, *args, **options):
        team1 = Team.objects.filter(name="Skill Move Admissions").first() or Team.objects.first()
        if not team1:
            team1 = Team.objects.create(name="Skill Move Admissions")

        # Second team for cross-team isolation tests
        team2, _ = Team.objects.get_or_create(name="Enterprise Tech Admissions")

        admin = User.objects.filter(email='admin@skillmove.com').first() or User.objects.filter(is_superuser=True).first()

        stages = {s.name: s for s in PipelineStage.objects.all()}
        cold_calling = stages.get("Cold Calling") or PipelineStage.objects.first()
        new_lead_stage = stages.get("New Lead") or cold_calling

        unassigned_students = [
            {
                "name": "Devendra Varma",
                "email": "devendra.varma@example.com",
                "phone": "+91 98860 11223",
                "qualification": "B.Tech Computer Science & AI",
                "college": "PES University, Bangalore",
                "yop": "2025",
                "key_skills": "Python, Machine Learning, PyTorch, SQL",
                "target_role": "AI / ML Engineer",
                "experience": "Fresher",
                "team": team1,
                "stage": new_lead_stage,
                "priority": "High",
                "status": "New",
                "city": "Bangalore",
                "estimated_revenue": Decimal("75000.00"),
                "placement_fee": Decimal("22500.00"),
            },
            {
                "name": "Kavya Nambiar",
                "email": "kavya.nambiar@example.com",
                "phone": "+91 97410 44556",
                "qualification": "B.E Electronics & Communication",
                "college": "Ramaiah Institute of Technology",
                "yop": "2024",
                "key_skills": "React.js, TypeScript, Next.js, Tailwind CSS",
                "target_role": "Frontend Developer",
                "experience": "6 Months Internship",
                "team": team1,
                "stage": cold_calling,
                "priority": "High",
                "status": "Active",
                "city": "Mysore",
                "estimated_revenue": Decimal("65000.00"),
                "placement_fee": Decimal("19500.00"),
            },
            {
                "name": "Siddharth Rao",
                "email": "siddharth.rao@example.com",
                "phone": "+91 99001 77889",
                "qualification": "BCA - Computer Applications",
                "college": "Christ University, Bangalore",
                "yop": "2025",
                "key_skills": "Java, Spring Boot, Microservices, Docker",
                "target_role": "Full Stack Developer",
                "experience": "Fresher",
                "team": team1,
                "stage": new_lead_stage,
                "priority": "Medium",
                "status": "New",
                "city": "Bangalore",
                "estimated_revenue": Decimal("60000.00"),
                "placement_fee": Decimal("18000.00"),
            },
            {
                "name": "Ananya Sen",
                "email": "ananya.sen@example.com",
                "phone": "+91 98112 33445",
                "qualification": "MCA - Computer Science",
                "college": "Jadavpur University, Kolkata",
                "yop": "2024",
                "key_skills": "Python, Django, PostgreSQL, AWS",
                "target_role": "Backend Engineer",
                "experience": "1 Year Experience",
                "team": team2,  # Belongs to Team 2 for cross-team permission testing!
                "stage": cold_calling,
                "priority": "High",
                "status": "Active",
                "city": "Kolkata",
                "estimated_revenue": Decimal("80000.00"),
                "placement_fee": Decimal("24000.00"),
            },
        ]

        created_count = 0
        for s in unassigned_students:
            lead, created = Lead.objects.get_or_create(
                email=s["email"],
                defaults={
                    "name": s["name"],
                    "title": s["name"],
                    "contact_name": s["name"],
                    "phone": s["phone"],
                    "qualification": s["qualification"],
                    "college": s["college"],
                    "yop": s["yop"],
                    "key_skills": s["key_skills"],
                    "target_role": s["target_role"],
                    "experience": s["experience"],
                    "stage": s["stage"],
                    "team": s["team"],
                    "assigned_employee": None,  # explicitly unassigned!
                    "priority": s["priority"],
                    "status": s["status"],
                    "city": s["city"],
                    "estimated_revenue": s["estimated_revenue"],
                    "placement_fee": s["placement_fee"],
                    "created_by": admin,
                }
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created unassigned lead: {lead.lead_id} ({lead.name}) - Team: {lead.team.name}"))
            else:
                # If already exists, ensure it is unassigned if needed
                if lead.assigned_employee is not None:
                    lead.assigned_employee = None
                    lead.save()
                    self.stdout.write(f"Updated lead to unassigned: {lead.lead_id} ({lead.name})")

        self.stdout.write(self.style.SUCCESS(f"Seeding completed. Total created: {created_count}"))
