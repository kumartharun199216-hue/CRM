from celery import shared_task
import logging
from apps.communications.services import CommunicationService

logger = logging.getLogger(__name__)

@shared_task
def sync_callyzer_call_history_task():
    """
    Periodic Celery task to synchronize Callyzer call history incrementally.
    Runs every 5 minutes in background.
    """
    logger.info("Starting background Callyzer call history sync task...")
    try:
        res = CommunicationService.sync_callyzer_call_history()
        logger.info(f"Callyzer call sync finished: {res}")
        return res
    except Exception as e:
        logger.error(f"Callyzer call sync task error: {str(e)}")
        return {"error": str(e)}
