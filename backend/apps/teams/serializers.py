from rest_framework import serializers
from .models import Team
from apps.authentication.models import User, UserRole

class TeamSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source='manager.username', read_only=True)
    manager_full_name = serializers.SerializerMethodField()
    members_count = serializers.IntegerField(source='members.count', read_only=True)
    active_members_count = serializers.SerializerMethodField()
    leads_count = serializers.IntegerField(source='leads.count', read_only=True)

    class Meta:
        model = Team
        fields = [
            'id', 'name', 'description', 'manager', 'manager_name', 'manager_full_name',
            'is_active', 'members_count', 'active_members_count', 'leads_count',
            'created_at', 'updated_at'
        ]

    def get_manager_full_name(self, obj):
        if obj.manager:
            return obj.manager.full_name or obj.manager.username
        return None

    def get_active_members_count(self, obj):
        return obj.members.filter(is_active=True).count()

    def validate_name(self, value):
        cleaned = (value or '').strip()
        if not cleaned:
            raise serializers.ValidationError("Team name cannot be blank.")
        existing = Team.objects.filter(name__iexact=cleaned)
        if self.instance:
            existing = existing.exclude(id=self.instance.id)
        if existing.exists():
            raise serializers.ValidationError(f"A team with the name '{cleaned}' already exists.")
        return cleaned

    def validate_manager(self, value):
        if value:
            if value.role != UserRole.MANAGER and not value.is_superuser:
                raise serializers.ValidationError("Designated team manager must have the Manager role.")
            # Check if this manager is already managing another team
            existing = Team.objects.filter(manager=value)
            if self.instance:
                existing = existing.exclude(id=self.instance.id)
            if existing.exists():
                raise serializers.ValidationError(f"User {value.username} is already the manager of team '{existing.first().name}'.")
        return value

    def validate(self, attrs):
        # Default is_active safely if not explicitly provided in payload (avoids DRF multipart checkbox false-default)
        if 'is_active' not in self.initial_data:
            if not self.instance:
                attrs['is_active'] = True
            else:
                attrs['is_active'] = self.instance.is_active

        # Validate deactivation constraint
        if 'is_active' in attrs and attrs['is_active'] is False:
            if self.instance and self.instance.is_active:
                leads_count = self.instance.leads.count()
                if leads_count > 0:
                    raise serializers.ValidationError({
                        'is_active': (
                            f"Cannot deactivate team '{self.instance.name}' because it contains {leads_count} lead(s). "
                            "Leads must be reassigned or transferred before deactivating the team."
                        )
                    })
        return attrs

    def create(self, validated_data):
        team = super().create(validated_data)
        if team.manager and team.manager.team_id != team.id:
            team.manager.team = team
            team.manager.save(update_fields=['team'])
        return team

    def update(self, instance, validated_data):
        team = super().update(instance, validated_data)
        if team.manager and team.manager.team_id != team.id:
            team.manager.team = team
            team.manager.save(update_fields=['team'])
        return team

