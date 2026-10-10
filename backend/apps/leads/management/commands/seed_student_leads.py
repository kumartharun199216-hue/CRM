from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal
from apps.authentication.models import User
from apps.teams.models import Team
from apps.leads.models import PipelineStage, Lead

class Command(BaseCommand):
    help = "Seed realistic test data for student leads across pipeline stages"

    def handle(self, *args, **options):
        # 1. Ensure team exists
        team = Team.objects.first()
        if not team:
            team = Team.objects.create(name="Skill Move Admissions")

        # 2. Get counsellor (sales employee)
        counsellor = User.objects.filter(email__in=['counsellor@skillmove.com', 'councellor@skillmove.com']).first()
        if not counsellor:
            counsellor = User.objects.filter(role='SALES_EMPLOYEE', team=team).first()

        if not counsellor:
            self.stdout.write(self.style.ERROR("No sales employee/counsellor found to assign leads to."))
            return

        if counsellor.team_id != team.id:
            counsellor.team = team
            counsellor.save()

        # 3. Get admin creator
        admin = User.objects.filter(email='admin@skillmove.com').first() or User.objects.filter(is_superuser=True).first() or counsellor

        # 4. Map stages
        stages_by_name = {s.name: s for s in PipelineStage.objects.all()}

        students_data = [
            {
                "name": "Aarav Sharma",
                "email": "aarav.sharma@example.com",
                "phone": "+91 98765 43210",
                "qualification": "B.Tech Computer Science",
                "college": "National Institute of Technology, Trichy",
                "yop": "2024",
                "key_skills": "Java, Spring Boot, MySQL, REST APIs",
                "target_role": "Java Backend Developer",
                "experience": "Fresher",
                "stage": "Cold Calling",
                "priority": "High",
                "status": "Active",
                "city": "Bangalore",
                "estimated_revenue": Decimal("60000.00"),
                "placement_fee": Decimal("18000.00"),
            },
            {
                "name": "Priya Patel",
                "email": "priya.patel@example.com",
                "phone": "+91 98451 23456",
                "qualification": "B.E Information Science",
                "college": "BMS College of Engineering, Bangalore",
                "yop": "2025",
                "key_skills": "Python, Django, PostgreSQL, Git",
                "target_role": "Python Developer",
                "experience": "Fresher",
                "stage": "Cold Calling",
                "priority": "Medium",
                "status": "Active",
                "city": "Bangalore",
                "estimated_revenue": Decimal("55000.00"),
                "placement_fee": Decimal("16500.00"),
            },
            {
                "name": "Rohan Mehta",
                "email": "rohan.mehta@example.com",
                "phone": "+91 97654 32109",
                "qualification": "MCA",
                "college": "Pune University",
                "yop": "2023",
                "key_skills": "React, JavaScript, TypeScript, Tailwind CSS",
                "target_role": "Frontend Engineer",
                "experience": "1 Year",
                "stage": "Not Connected",
                "priority": "Low",
                "status": "Pending",
                "city": "Pune",
                "estimated_revenue": Decimal("50000.00"),
                "placement_fee": Decimal("15000.00"),
            },
            {
                "name": "Ananya Deshmukh",
                "email": "ananya.deshmukh@example.com",
                "phone": "+91 91234 56780",
                "qualification": "B.Tech AI & Data Science",
                "college": "COEP Technological University, Pune",
                "yop": "2024",
                "key_skills": "Python, Pandas, NumPy, Machine Learning, Power BI",
                "target_role": "Data Analyst",
                "experience": "Fresher",
                "stage": "New Lead",
                "priority": "High",
                "status": "Active",
                "city": "Pune",
                "estimated_revenue": Decimal("70000.00"),
                "placement_fee": Decimal("21000.00"),
            },
            {
                "name": "Siddharth Nair",
                "email": "siddharth.nair@example.com",
                "phone": "+91 94471 98765",
                "qualification": "B.Tech Computer Engineering",
                "college": "Vellore Institute of Technology (VIT)",
                "yop": "2024",
                "key_skills": "Node.js, Express, MongoDB, React, Docker",
                "target_role": "Full Stack Developer",
                "experience": "Fresher",
                "stage": "New Lead",
                "priority": "High",
                "status": "Active",
                "city": "Chennai",
                "estimated_revenue": Decimal("65000.00"),
                "placement_fee": Decimal("19500.00"),
            },
            {
                "name": "Sneha Rao",
                "email": "sneha.rao@example.com",
                "phone": "+91 98200 45678",
                "qualification": "B.Sc Computer Science",
                "college": "St. Xavier's College, Mumbai",
                "yop": "2024",
                "key_skills": "SQL, Python, Excel, Tableau, Statistics",
                "target_role": "Business Intelligence Associate",
                "experience": "Fresher",
                "stage": "Contacted",
                "priority": "Medium",
                "status": "Active",
                "city": "Mumbai",
                "estimated_revenue": Decimal("48000.00"),
                "placement_fee": Decimal("14400.00"),
            },
            {
                "name": "Kavya Iyer",
                "email": "kavya.iyer@example.com",
                "phone": "+91 98450 78901",
                "qualification": "B.E Electronics and Communication",
                "college": "RV College of Engineering, Bangalore",
                "yop": "2024",
                "key_skills": "Embedded C, IoT, Python, Linux",
                "target_role": "Embedded Software Engineer",
                "experience": "Fresher",
                "stage": "Interested",
                "priority": "High",
                "status": "Active",
                "city": "Bangalore",
                "estimated_revenue": Decimal("75000.00"),
                "placement_fee": Decimal("22500.00"),
            },
            {
                "name": "Vikram Malhotra",
                "email": "vikram.malhotra@example.com",
                "phone": "+91 99100 23456",
                "qualification": "B.Tech IT",
                "college": "Delhi Technological University (DTU)",
                "yop": "2023",
                "key_skills": "AWS, Docker, Kubernetes, CI/CD, Terraform",
                "target_role": "Cloud / DevOps Engineer",
                "experience": "1 Year",
                "stage": "Interested",
                "priority": "High",
                "status": "Active",
                "city": "Delhi",
                "estimated_revenue": Decimal("80000.00"),
                "placement_fee": Decimal("24000.00"),
            },
            {
                "name": "Meera Joshi",
                "email": "meera.joshi@example.com",
                "phone": "+91 97640 12389",
                "qualification": "BCA",
                "college": "Symbiosis College, Pune",
                "yop": "2024",
                "key_skills": "React, Redux, Next.js, TypeScript",
                "target_role": "React Developer",
                "experience": "6 Months Internship",
                "stage": "Prospect",
                "priority": "High",
                "status": "Active",
                "city": "Pune",
                "estimated_revenue": Decimal("52000.00"),
                "placement_fee": Decimal("15600.00"),
            },
            {
                "name": "Arjun Reddy",
                "email": "arjun.reddy@example.com",
                "phone": "+91 94901 23456",
                "qualification": "B.Tech Electrical & Electronics",
                "college": "Osmania University, Hyderabad",
                "yop": "2024",
                "key_skills": "Java, Core Java, DSA, MySQL",
                "target_role": "Software Development Engineer",
                "experience": "Fresher",
                "stage": "FollowUp",
                "priority": "Medium",
                "status": "Active",
                "city": "Hyderabad",
                "estimated_revenue": Decimal("58000.00"),
                "placement_fee": Decimal("17400.00"),
            },
            {
                "name": "Rhea Kapoor",
                "email": "rhea.kapoor@example.com",
                "phone": "+91 98110 98765",
                "qualification": "MCA",
                "college": "Amity University, Noida",
                "yop": "2023",
                "key_skills": "C#, .NET Core, SQL Server, Microservices",
                "target_role": ".NET Developer",
                "experience": "1.5 Years",
                "stage": "Negotation",
                "priority": "High",
                "status": "Active",
                "city": "Noida",
                "estimated_revenue": Decimal("72000.00"),
                "placement_fee": Decimal("21600.00"),
            },
            {
                "name": "Karthik Sundaram",
                "email": "karthik.s@example.com",
                "phone": "+91 98401 54321",
                "qualification": "B.Tech Computer Science",
                "college": "SRM Institute of Science and Technology, Chennai",
                "yop": "2024",
                "key_skills": "Python, Flask, React, MongoDB",
                "target_role": "Full Stack Associate",
                "experience": "Fresher",
                "stage": "pendingClosure",
                "priority": "High",
                "status": "Active",
                "city": "Chennai",
                "estimated_revenue": Decimal("60000.00"),
                "placement_fee": Decimal("18000.00"),
            },
            {
                "name": "Pooja Hegde",
                "email": "pooja.hegde@example.com",
                "phone": "+91 98455 67890",
                "qualification": "B.E Computer Science",
                "college": "PES University, Bangalore",
                "yop": "2024",
                "key_skills": "Data Analytics, Python, Tableau, Machine Learning",
                "target_role": "Data Analyst Associate",
                "experience": "Fresher",
                "stage": "Enrolled",
                "priority": "High",
                "status": "Converted",
                "city": "Bangalore",
                "estimated_revenue": Decimal("65000.00"),
                "placement_fee": Decimal("19500.00"),
            },
            {
                "name": "Rahul Chawla",
                "email": "rahul.chawla@example.com",
                "phone": "+91 98721 34567",
                "qualification": "B.Tech IT",
                "college": "Thapar Institute of Engineering, Patiala",
                "yop": "2024",
                "key_skills": "MERN Stack, Express, React, Node.js",
                "target_role": "Junior Web Developer",
                "experience": "Fresher",
                "stage": "Enrolled",
                "priority": "High",
                "status": "Converted",
                "city": "Chandigarh",
                "estimated_revenue": Decimal("62000.00"),
                "placement_fee": Decimal("18600.00"),
            },
            {
                "name": "Divya Krishnan",
                "email": "divya.krishnan@example.com",
                "phone": "+91 98409 87654",
                "qualification": "B.Sc Mathematics",
                "college": "Madras Christian College",
                "yop": "2023",
                "key_skills": "Basic Excel, Statistics",
                "target_role": "Data Entry / Analytics",
                "experience": "Fresher",
                "stage": "Not Interested",
                "priority": "Low",
                "status": "Inactive",
                "city": "Chennai",
                "estimated_revenue": Decimal("35000.00"),
                "placement_fee": Decimal("10000.00"),
            },
            {
                "name": "Manish Gupta",
                "email": "manish.gupta@example.com",
                "phone": "+91 99370 12345",
                "qualification": "B.Tech Mechanical",
                "college": "KIIT, Bhubaneswar",
                "yop": "2023",
                "key_skills": "AutoCAD, Python basics",
                "target_role": "Mechanical Design Engineer",
                "experience": "1 Year",
                "stage": "Lost",
                "priority": "Low",
                "status": "Closed",
                "city": "Bhubaneswar",
                "estimated_revenue": Decimal("40000.00"),
                "placement_fee": Decimal("12000.00"),
            }
        ]

        created_count = 0
        with transaction.atomic():
            for item in students_data:
                lead, created = Lead.objects.get_or_create(
                    email=item["email"],
                    defaults={
                        "name": item["name"],
                        "title": item["name"],
                        "contact_name": item["name"],
                        "phone": item["phone"],
                        "qualification": item["qualification"],
                        "college": item["college"],
                        "yop": item["yop"],
                        "key_skills": item["key_skills"],
                        "target_role": item["target_role"],
                        "experience": item["experience"],
                        "stage": stages_by_name.get(item["stage"]),
                        "priority": item["priority"],
                        "status": item["status"],
                        "city": item["city"],
                        "estimated_revenue": item["estimated_revenue"],
                        "placement_fee": item["placement_fee"],
                        "career_counsellor": counsellor.username,
                        "assigned_employee": counsellor,
                        "team": team,
                        "created_by": admin,
                    }
                )
                if created:
                    created_count += 1
                else:
                    # Update fields
                    lead.name = item["name"]
                    lead.title = item["name"]
                    lead.contact_name = item["name"]
                    lead.phone = item["phone"]
                    lead.qualification = item["qualification"]
                    lead.college = item["college"]
                    lead.yop = item["yop"]
                    lead.key_skills = item["key_skills"]
                    lead.target_role = item["target_role"]
                    lead.experience = item["experience"]
                    lead.stage = stages_by_name.get(item["stage"])
                    lead.priority = item["priority"]
                    lead.status = item["status"]
                    lead.city = item["city"]
                    lead.estimated_revenue = item["estimated_revenue"]
                    lead.placement_fee = item["placement_fee"]
                    lead.career_counsellor = counsellor.username
                    lead.assigned_employee = counsellor
                    lead.team = team
                    lead.save()

        self.stdout.write(self.style.SUCCESS(f"Successfully seeded student test leads. Created: {created_count}, Total leads: {Lead.objects.count()}"))
