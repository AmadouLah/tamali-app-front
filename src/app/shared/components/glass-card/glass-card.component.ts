import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-glass-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './glass-card.component.html',
  styleUrl: './glass-card.component.css'
})
export class GlassCardComponent {
  @Input() variant: 'default' | 'strong' | 'subtle' = 'default';
  @Input() hoverEffect: boolean = true;
  @Input() class: string = '';
}
