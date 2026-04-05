import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GlassCardComponent } from '../glass-card/glass-card.component';
import { WebPushRegistrationService } from '../../../core/services/web-push-registration.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-push-notifications-settings',
  standalone: true,
  imports: [CommonModule, GlassCardComponent],
  templateUrl: './push-notifications-settings.component.html'
})
export class PushNotificationsSettingsComponent implements OnInit {
  private readonly push = inject(WebPushRegistrationService);
  private readonly toast = inject(ToastService);

  loading = true;
  busy = false;
  toggleOn = false;
  state: 'unsupported' | 'denied' | 'inactive' | 'active' | null = null;
  serverConfigured = false;

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const s = await this.push.getPushSettingsState();
      this.state = s.kind;
      this.serverConfigured = s.serverPushConfigured;
      this.toggleOn = s.kind === 'active';
    } finally {
      this.loading = false;
    }
  }

  async onToggleClick(): Promise<void> {
    if (this.loading || this.busy || this.state === 'unsupported' || this.state === 'denied') return;
    const wantOn = !this.toggleOn;
    if (wantOn && !this.serverConfigured) {
      this.toast.error(
        'Les notifications push ne sont pas disponibles pour le moment (configuration serveur).'
      );
      return;
    }
    this.busy = true;
    try {
      if (wantOn) {
        const ok = await this.push.enableFromSettings();
        if (ok) {
          this.toast.success('Notifications activées sur cet appareil.');
        } else {
          this.toast.error(
            'Activation impossible. Vérifiez la connexion, utilisez le site en HTTPS (production) et réessayez.'
          );
        }
      } else {
        await this.push.disableFromSettings();
        this.toast.success('Notifications désactivées sur cet appareil.');
      }
    } finally {
      await this.refresh();
      this.busy = false;
    }
  }
}
