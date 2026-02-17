import { Component, Input, inject } from '@angular/core';
import { AuthService, UserDto } from '../../../core/services/auth.service';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  template: `
    @if (auth.getInitials(user); as initials) {
      <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-sm">
        {{ initials }}
      </div>
    } @else {
      <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
        </svg>
      </div>
    }
  `
})
export class UserAvatarComponent {
  readonly auth = inject(AuthService);

  @Input() user: UserDto | null = null;
}
