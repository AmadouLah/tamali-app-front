import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkService } from '../../../core/services/network.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-offline-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offline-indicator.component.html',
  styleUrl: './offline-indicator.component.css'
})
export class OfflineIndicatorComponent {
  private readonly networkService = inject(NetworkService);
  readonly isOnline$: Observable<boolean> = this.networkService.onlineStatus;
  readonly offlineTooltip = 'Mode hors ligne – Les modifications seront synchronisées automatiquement';
}
