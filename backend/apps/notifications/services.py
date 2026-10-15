import logging
from typing import Iterable, Optional
from django.utils import timezone
from apps.authentication.models import User, UserRole
from .models import Notification, NotificationType, NotificationPriority

logger = logging.getLogger(__name__)


def create_notification(
    recipient: User,
    type: str,
    title: str,
    message: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action_url: Optional[str] = None,
    priority: str = NotificationPriority.NORMAL,
    deduplication_key: Optional[str] = None,
    expires_at=None,
) -> Optional[Notification]:
    """
    Creates and saves a Notification for the specified recipient.
    Guarantees deduplication if deduplication_key is provided.
    """
    if not recipient or not recipient.is_active:
        return None

    if deduplication_key:
        existing = Notification.objects.filter(
            recipient=recipient,
            deduplication_key=deduplication_key
        ).first()
        if existing:
            return existing

    try:
        notification = Notification.objects.create(
            recipient=recipient,
            type=type,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
            action_url=action_url,
            priority=priority,
            deduplication_key=deduplication_key,
            expires_at=expires_at,
        )
        return notification
    except Exception as exc:
        logger.error(f"Failed to create notification for {recipient.username}: {exc}", exc_info=True)
        return None


def notify_users(
    recipients: Iterable[User],
    type: str,
    title: str,
    message: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action_url: Optional[str] = None,
    priority: str = NotificationPriority.NORMAL,
    deduplication_key_prefix: Optional[str] = None,
    expires_at=None,
) -> list[Notification]:
    """
    Sends notification to multiple recipients safely.
    """
    created_notifications = []
    for user in recipients:
        dedup = f"{deduplication_key_prefix}_{user.id}" if deduplication_key_prefix else None
        notif = create_notification(
            recipient=user,
            type=type,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
            action_url=action_url,
            priority=priority,
            deduplication_key=dedup,
            expires_at=expires_at,
        )
        if notif:
            created_notifications.append(notif)
    return created_notifications


def notify_team(
    team,
    type: str,
    title: str,
    message: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action_url: Optional[str] = None,
    priority: str = NotificationPriority.NORMAL,
) -> list[Notification]:
    """
    Sends notification to all active members of a team.
    """
    if not team:
        return []
    recipients = list(team.members.filter(is_active=True))
    if team.manager and team.manager.is_active and team.manager not in recipients:
        recipients.append(team.manager)
    return notify_users(
        recipients=recipients,
        type=type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
        action_url=action_url,
        priority=priority,
    )


def notify_admins(
    type: str,
    title: str,
    message: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    action_url: Optional[str] = None,
    priority: str = NotificationPriority.NORMAL,
) -> list[Notification]:
    """
    Sends notification to all active Admins.
    """
    admins = User.objects.filter(is_active=True, role=UserRole.ADMIN)
    return notify_users(
        recipients=admins,
        type=type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
        action_url=action_url,
        priority=priority,
    )
