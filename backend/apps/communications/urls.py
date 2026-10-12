from django.urls import path
from .views import (
    CommunicationTemplateListCreateView,
    CommunicationTemplateDetailView,
    TemplateToggleActiveView,
    TemplateAttachmentUploadView,
    TemplateAttachmentDeleteView,
    AttachmentDownloadView,
    TemplatePreviewView,
    SendEmailView,
    AdminTestEmailView,
    SendWhatsAppView,
    InitiateCallView,
    CommunicationLogListView
)

urlpatterns = [
    # Template management endpoints
    path('templates/', CommunicationTemplateListCreateView.as_view(), name='template-list-create'),
    path('templates/<int:pk>/', CommunicationTemplateDetailView.as_view(), name='template-detail'),
    path('templates/<int:pk>/toggle-active/', TemplateToggleActiveView.as_view(), name='template-toggle-active'),
    path('templates/<int:pk>/attachments/', TemplateAttachmentUploadView.as_view(), name='template-attachment-upload'),
    path('templates/<int:template_id>/attachments/<int:attachment_id>/', TemplateAttachmentDeleteView.as_view(), name='template-attachment-delete-nested'),
    path('templates/<int:pk>/preview/', TemplatePreviewView.as_view(), name='template-instance-preview'),
    path('templates/preview/', TemplatePreviewView.as_view(), name='template-preview'),

    # Direct attachment endpoints
    path('attachments/<int:pk>/', TemplateAttachmentDeleteView.as_view(), name='attachment-delete'),
    path('attachments/<int:pk>/download/', AttachmentDownloadView.as_view(), name='attachment-download'),

    # Existing communication endpoints
    path('send-email/', SendEmailView.as_view(), name='send-email'),
    path('test-email/', AdminTestEmailView.as_view(), name='admin-test-email'),
    path('send-whatsapp/', SendWhatsAppView.as_view(), name='send-whatsapp'),
    path('initiate-call/', InitiateCallView.as_view(), name='initiate-call'),
    path('logs/', CommunicationLogListView.as_view(), name='communication-logs'),
]
