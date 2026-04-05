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

  loading = false;
  busy = false;
  toggleOn = false;
  state: 'unsupported' | 'denied' | 'inactive' | 'active' = 'inactive';
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
    } catch {
      this.state = 'inactive';
      this.serverConfigured = false;
      this.toggleOn = false;
    } finally {
      this.loading = false;
    }
  }

  async onToggleClick(): Promise<void> {
    if (this.loading || this.busy || this.state === 'unsupported' || this.state === 'denied') return;
    const wantOn = !this.toggleOn;
    if (wantOn && !this.serverConfigured) {
      this.toast.error('Les notifications ne sont pas disponibles pour le moment. Merci de réessayer plus tard.');
      return;
    }
    this.busy = true;
    try {
      if (wantOn) {
        const ok = await this.push.enableFromSettings();
        if (ok) {
          this.toast.success('Notifications activées pour cet appareil.');
        } else {
          this.toast.error('Activation impossible. Vérifiez votre connexion internet et réessayez.');
        }
      } else {
        await this.push.disableFromSettings();
        this.toast.success('Notifications désactivées pour cet appareil.');
      }
    } finally {
      await this.refresh();
      this.busy = false;
    }
  }
}
