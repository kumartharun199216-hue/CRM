from rest_framework import permissions

class HasCompletedPasswordChange(permissions.BasePermission):
    message = "Password change required. You must change your temporary password before accessing CRM resources."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return True
        return not getattr(request.user, 'must_change_password', False)

class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated and getattr(request.user, 'must_change_password', False):
            return False
        return bool(request.user and request.user.is_authenticated and (request.user.role == 'ADMIN' or request.user.is_superuser))

class IsManagerRole(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated and getattr(request.user, 'must_change_password', False):
            return False
        return bool(request.user and request.user.is_authenticated and request.user.role == 'MANAGER')

class IsAdminOrManagerRole(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated and getattr(request.user, 'must_change_password', False):
            return False
        return bool(
            request.user and request.user.is_authenticated and
            (request.user.role in ['ADMIN', 'MANAGER'] or request.user.is_superuser)
        )

class LeadPermission(permissions.BasePermission):
    """
    Lead visibility & modification rules:
    - Admins: Access all leads. Create leads. Assign/reassign across teams.
    - Managers: Access leads for authorized team. Create leads for authorized team. Assign/reassign within authorized team.
    - Sales Employees: Access assigned leads. Cannot create, assign, or reassign leads.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if getattr(request.user, 'must_change_password', False):
            return False
        
        # Only Admins and Managers can create leads
        if request.method == 'POST':
            return request.user.role in ['ADMIN', 'MANAGER'] or request.user.is_superuser

        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_superuser or user.role == 'ADMIN':
            return True

        if user.role == 'MANAGER':
            # Manager can access leads belonging to their authorized team
            # Authorized team is the team where user is manager
            managed_team = getattr(user, 'managed_team', None)
            if managed_team and obj.team_id == managed_team.id:
                return True
            # Also if manager's user.team matches
            if user.team_id and obj.team_id == user.team_id:
                return True
            return False

        if user.role == 'SALES_EMPLOYEE':
            # Sales employees can access their assigned leads
            if obj.assigned_employee_id == user.id:
                # Sales Employees cannot assign, reassign, or delete
                if request.method in ['DELETE']:
                    return False
                return True
            return False

        return False

class CanAccessLead(permissions.BasePermission):
    """
    Checks if a user has access to a specific lead object (Admins -> all, Manager -> team, Sales -> assigned)
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if getattr(request.user, 'must_change_password', False):
            return False
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_superuser or user.role == 'ADMIN':
            return True

        if user.role == 'MANAGER':
            managed_team = getattr(user, 'managed_team', None)
            if managed_team and obj.team_id == managed_team.id:
                return True
            if user.team_id and obj.team_id == user.team_id:
                return True
            return False

        if user.role == 'SALES_EMPLOYEE':
            return obj.assigned_employee_id == user.id

        return False

