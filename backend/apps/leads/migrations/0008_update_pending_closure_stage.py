from django.db import migrations, models


def update_pending_closure_stage(apps, schema_editor):
    PipelineStage = apps.get_model('leads', 'PipelineStage')
    Lead = apps.get_model('leads', 'Lead')
    LeadStageHistory = apps.get_model('leads', 'LeadStageHistory')

    # 1. Locate or ensure stage order 9 is named 'Pending Closure'
    stage_9 = PipelineStage.objects.filter(
        models.Q(order=9) | models.Q(name__iexact='pendingClosure') | models.Q(name__iexact='Pending Closure')
    ).first()

    if stage_9:
        stage_9.name = 'Pending Closure'
        stage_9.order = 9
        stage_9.is_active = True
        stage_9.save()
    else:
        stage_9 = PipelineStage.objects.create(
            name='Pending Closure',
            order=9,
            is_active=True
        )

    # 2. If 'Pre-Closer' stage exists (e.g. order 13 from prompt 02), migrate leads and histories to stage_9
    pre_closer_stages = PipelineStage.objects.filter(name__iexact='Pre-Closer')
    for pcs in pre_closer_stages:
        if pcs.id != stage_9.id:
            Lead.objects.filter(stage=pcs).update(stage=stage_9)
            LeadStageHistory.objects.filter(to_stage=pcs).update(to_stage=stage_9)
            LeadStageHistory.objects.filter(from_stage=pcs).update(from_stage=stage_9)
            pcs.delete()


def reverse_pending_closure_stage(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0007_precloser_stage_and_financial'),
    ]

    operations = [
        migrations.RunPython(update_pending_closure_stage, reverse_pending_closure_stage),
    ]
