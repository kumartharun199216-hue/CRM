from django.http import JsonResponse
from rest_framework.authtoken.models import Token

class EnforcePasswordChangeMiddleware:
    """
    Enforces the temporary-password change requirement across all CRM endpoints.
    Users marked with must_change_password=True are restricted from accessing
    protected CRM resources (leads, teams, communications, reports, etc.) until
    they complete their password change.

    Only necessary auth operations (change-password, logout, me, login) are permitted.
    """
    EXEMPT_PATHS = [
        '/api/auth/login/',
        '/api/auth/logout/',
        '/api/auth/me/',
        '/api/auth/profile/',
        '/api/auth/change-password/',
        '/api/auth/password/change/',
        '/api/auth/password-reset/',
        '/api/auth/password/reset/',
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        # If not an API route or matches an exempt auth path, proceed
        if not path.startswith('/api/') or any(path.startswith(exempt) for exempt in self.EXEMPT_PATHS):
            return self.get_response(request)

        # 1. Check Session Authentication (request.user)
        user = getattr(request, 'user', None)
        if user and user.is_authenticated and getattr(user, 'must_change_password', False):
            return JsonResponse({
                'detail': 'Password change required. You must change your temporary password before accessing CRM resources.',
                'code': 'password_change_required'
            }, status=403)

        # 2. Check Token Authentication (Authorization: Token <key>)
        auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header and auth_header.startswith('Token '):
            token_key = auth_header[6:].strip()
            token = Token.objects.filter(key=token_key).select_related('user').first()
            if token and token.user and token.user.is_active and getattr(token.user, 'must_change_password', False):
                return JsonResponse({
                    'detail': 'Password change required. You must change your temporary password before accessing CRM resources.',
                    'code': 'password_change_required'
                }, status=403)

        return self.get_response(request)
