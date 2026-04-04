import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IndexedDbService } from './core/services/indexed-db.service';
import { InstantNotificationStreamService } from './core/services/instant-notification-stream.service';
import { WebPushRegistrationService } from './core/services/web-push-registration.service';
import { SyncService } from './core/services/sync.service';
import { NetworkService } from './core/services/network.service';
import { OfflineIndicatorComponent } from './shared/components/offline-indicator/offline-indicator.component';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, OfflineIndicatorComponent, ToastComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly dbService = inject(IndexedDbService);
  private readonly syncService = inject(SyncService);
  private readonly networkService = inject(NetworkService);
  private readonly instantNotificationStream = inject(InstantNotificationStreamService);
  private readonly webPushRegistration = inject(WebPushRegistrationService);

  async ngOnInit(): Promise<void> {
    await this.dbService.init();
    await this.dbService.clearExpiredCache();

    this.instantNotificationStream.startIfAuthenticated();
    this.webPushRegistration.tryRegister();

    if (this.networkService.isOnline) {
      this.syncService.syncPendingRequests();
    }
  }
}
