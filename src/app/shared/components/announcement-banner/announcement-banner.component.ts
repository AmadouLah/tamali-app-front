import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

const STORAGE_KEY = 'tamali_dismissed_announcement_id';

export interface AnnouncementModel {
  id: string;
  message: string;
}

@Component({
  selector: 'app-announcement-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './announcement-banner.component.html',
  styleUrl: './announcement-banner.component.css'
})
export class AnnouncementBannerComponent {
  @Input() announcement: AnnouncementModel | null = null;
  @Output() closed = new EventEmitter<void>();

  get visible(): boolean {
    if (!this.announcement?.id) return false;
    return this.getDismissedId() !== this.announcement.id;
  }

  close(): void {
    if (this.announcement?.id) {
      try {
        localStorage.setItem(STORAGE_KEY, this.announcement.id);
      } catch {}
      this.closed.emit();
    }
  }

  private getDismissedId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
