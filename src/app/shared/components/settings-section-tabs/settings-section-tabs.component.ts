import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-settings-section-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-section-tabs.component.html'
})
export class SettingsSectionTabsComponent {
  @Input({ required: true }) tabs!: { id: string; label: string }[];
  @Input({ required: true }) activeId!: string;
  @Output() activeIdChange = new EventEmitter<string>();

  pick(id: string): void {
    if (id !== this.activeId) this.activeIdChange.emit(id);
  }
}
