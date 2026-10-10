from rest_framework import serializers
from .models import ReportSchedule

class ReportScheduleSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = ReportSchedule
        fields = [
            'id', 'name', 'recipients', 'frequency', 'time_utc',
            'is_active', 'last_run_at', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'last_run_at', 'created_at', 'updated_at']

    def validate_recipients(self, value):
        if not isinstance(value, list) or len(value) == 0:
            raise serializers.ValidationError("At least one recipient email address must be configured.")
        for email in value:
            if not isinstance(email, str) or '@' not in email:
                raise serializers.ValidationError(f"Invalid email address: {email}")
        return value
