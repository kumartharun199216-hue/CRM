from django.core.management.base import BaseCommand
from apps.communications.services import CommunicationService

class Command(BaseCommand):
    help = "Synchronizes complete call history from Callyzer Sandbox/Production API"

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=7, help="Number of past days to query")

    def handle(self, *args, **options):
        self.stdout.write("Starting Callyzer call history synchronization...")
        try:
            res = CommunicationService.sync_callyzer_call_history()
            self.stdout.write(self.style.SUCCESS(
                f"Sync completed successfully! Total fetched: {res['total_fetched']}, "
                f"Synced: {res['synced_count']}, Unmatched: {res['unmatched_count']}"
            ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Sync failed: {str(e)}"))
