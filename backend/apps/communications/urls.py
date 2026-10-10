from django.urls import path
from .views import (
    CommunicationTemplateListCreateView,
    CommunicationTemplateDetailView,
    SendEmailView,
    SendWhatsAppView,
    InitiateCallView,
    CommunicationLogListView
)

urlpatterns = [
    path('templates/', CommunicationTemplateListCreateView.as_view(), name='template-list-create'),
    path('templates/<int:pk>/', CommunicationTemplateDetailView.as_view(), name='template-detail'),
    path('send-email/', SendEmailView.as_view(), name='send-email'),
    path('send-whatsapp/', SendWhatsAppView.as_view(), name='send-whatsapp'),
    path('initiate-call/', InitiateCallView.as_view(), name='initiate-call'),
    path('logs/', CommunicationLogListView.as_view(), name='communication-logs'),
]
