# Generated manually for lead pipeline, student fields, and atomic lead_id generation
from django.db import migrations, models
import django.db.models.deletion


def backfill_and_seed_stages(apps, schema_editor):
    PipelineStage = apps.get_model('leads', 'PipelineStage')
    Lead = apps.get_model('leads', 'Lead')
    LeadIdSequence = apps.get_model('leads', 'LeadIdSequence')

    # Configure the 12 pipeline stages in exact order and spelling
    stages = [
        (1, "Cold Calling"),
        (2, "Not Connected"),
        (3, "New Lead"),
        (4, "Contacted"),
        (5, "Interested"),
        (6, "Prospect"),
        (7, "FollowUp"),
        (8, "Negotation"),
        (9, "pendingClosure"),
        (10, "Enrolled"),
        (11, "Not Interested"),
        (12, "Lost"),
    ]

    stage_map = {}
    for order, name in stages:
        stage, _ = PipelineStage.objects.update_or_create(
            name=name,
            defaults={'order': order, 'is_active': True}
        )
        stage_map[order] = stage

    # Ensure LeadIdSequence exists and backfill any leads missing lead_id
    seq, _ = LeadIdSequence.objects.get_or_create(id=1, defaults={'last_number': 0})
    counter = seq.last_number
    for lead in Lead.objects.all().order_by('id'):
        if not lead.lead_id:
            counter += 1
            lead.lead_id = f"SM-LD-{counter:04d}"
        if not lead.name:
            lead.name = lead.title or lead.contact_name or "New Lead"
        if not lead.stage:
            lead.stage = stage_map.get(1)
        lead.save()

    seq.last_number = max(seq.last_number, counter)
    seq.save()


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='LeadIdSequence',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('last_number', models.PositiveBigIntegerField(default=0)),
            ],
        ),
        migrations.AddField(
            model_name='lead',
            name='lead_id',
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='lead',
            name='qualification',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='lead',
            name='college',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='lead',
            name='yop',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='lead',
            name='key_skills',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='lead',
            name='target_role',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='lead',
            name='experience',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='lead',
            name='priority',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='lead',
            name='status',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='lead',
            name='estimated_revenue',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='placement_fee',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='career_counsellor',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='lead',
            name='city',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='lead',
            name='next_follow_up',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='lead',
            name='archived_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_and_seed_stages, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name='lead',
            name='lead_id',
            field=models.CharField(blank=True, db_index=True, editable=False, help_text='Automatically generated unique identifier', max_length=32, unique=True),
        ),
        migrations.AlterField(
            model_name='lead',
            name='email',
            field=models.EmailField(max_length=254),
        ),
        migrations.AlterField(
            model_name='lead',
            name='phone',
            field=models.CharField(max_length=50),
        ),
    ]
