import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def create_pre_closer_stage(apps, schema_editor):
    PipelineStage = apps.get_model('leads', 'PipelineStage')
    if not PipelineStage.objects.filter(name='Pre-Closer').exists():
        max_order = PipelineStage.objects.aggregate(models.Max('order'))['order__max'] or 12
        PipelineStage.objects.create(
            name='Pre-Closer',
            order=max_order + 1,
            is_active=True
        )


def remove_pre_closer_stage(apps, schema_editor):
    PipelineStage = apps.get_model('leads', 'PipelineStage')
    PipelineStage.objects.filter(name='Pre-Closer').delete()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('leads', '0006_lead_batch_tag_lead_source_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='PreCloserFinancial',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('agreed_amount', models.DecimalField(decimal_places=2, help_text='Total agreed course/deal amount in INR', max_digits=12)),
                ('amount_paid', models.DecimalField(decimal_places=2, help_text='Initial or total amount paid in INR', max_digits=12)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='created_financial_records', to=settings.AUTH_USER_MODEL)),
                ('lead', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='pre_closer_financial', to='leads.lead')),
                ('updated_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='updated_financial_records', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='LeadFinancialHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('agreed_amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('amount_paid', models.DecimalField(decimal_places=2, max_digits=12)),
                ('outstanding_balance', models.DecimalField(decimal_places=2, max_digits=12)),
                ('note', models.TextField(blank=True, default='')),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('changed_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='+', to=settings.AUTH_USER_MODEL)),
                ('financial_record', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='history', to='leads.precloserfinancial')),
                ('lead', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='financial_history', to='leads.lead')),
            ],
            options={
                'ordering': ['-timestamp'],
            },
        ),
        migrations.RunPython(create_pre_closer_stage, remove_pre_closer_stage),
    ]
