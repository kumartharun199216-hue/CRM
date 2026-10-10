from django.urls import path
from .views import (
    LoginView,
    LogoutView,
    MeView,
    UserListCreateView,
    UserLookupView,
    UserDetailUpdateView,
    UserActivateView,
    UserDeactivateView,
    ChangePasswordView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    AdminPasswordResetView,
    UserTeamTransferPreviewView,
    UserTeamTransferView,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth-login'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
    path('me/', MeView.as_view(), name='auth-me'),
    path('profile/', MeView.as_view(), name='auth-profile'),
    path('users/', UserListCreateView.as_view(), name='auth-users'),
    path('users/lookup/', UserLookupView.as_view(), name='auth-user-lookup'),
    path('users/<int:user_id>/', UserDetailUpdateView.as_view(), name='auth-user-detail-update'),
    path('users/<int:user_id>/transfer-preview/', UserTeamTransferPreviewView.as_view(), name='auth-user-transfer-preview'),
    path('users/<int:user_id>/transfer-team/', UserTeamTransferView.as_view(), name='auth-user-transfer-team'),
    path('users/<int:user_id>/activate/', UserActivateView.as_view(), name='auth-user-activate'),
    path('users/<int:user_id>/deactivate/', UserDeactivateView.as_view(), name='auth-user-deactivate'),
    path('users/<int:user_id>/reset-password/', AdminPasswordResetView.as_view(), name='auth-admin-reset-password'),
    path('change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('password/change/', ChangePasswordView.as_view(), name='auth-password-change'),
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='auth-password-reset-request'),
    path('password/reset/request/', PasswordResetRequestView.as_view(), name='auth-password-reset-request-alt'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
    path('password/reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm-alt'),
]

