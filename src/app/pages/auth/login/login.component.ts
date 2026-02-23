import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AnnouncementService } from '../../../core/services/announcement.service';
import { GlassCardComponent } from '../../../shared/components/glass-card/glass-card.component';
import { AnnouncementBannerComponent } from '../../../shared/components/announcement-banner/announcement-banner.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GlassCardComponent, AnnouncementBannerComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly announcementService = inject(AnnouncementService);

  loginForm: FormGroup;
  passwordForm: FormGroup;
  codeForm: FormGroup;
  step: 'email' | 'password' | 'code' = 'email';
  loading = false;
  error: string | null = null;
  userId: string | null = null;
  userEmail: string | null = null;
  resendCooldown = 0;
  resendAttempts = 0;
  maxResendAttempts = 3;
  private resendTimer: any = null;
  mustChangePassword = false;
  currentAnnouncement: { id: string; message: string } | null = null;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.passwordForm = this.fb.group({
      password: ['', [Validators.required]]
    });

    this.codeForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });

    // La vérification automatique est gérée dans onCodeInput pour éviter les doubles appels
    this.announcementService.getCurrent().subscribe(a => { this.currentAnnouncement = a; });
  }

  onAnnouncementClosed(): void {
    this.currentAnnouncement = null;
  }

  onSubmitEmail(): void {
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.userEmail = this.loginForm.value.email;

    this.authService.checkEmail(this.loginForm.value.email).subscribe({
      next: (response) => {
        if (response.exists && response.userId) {
          this.userId = response.userId;
          this.step = 'password';
        } else {
          this.error = 'Aucun compte trouvé avec cet email.';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la vérification de l\'email.';
        this.loading = false;
      }
    });
  }

  onSubmitPassword(): void {
    if (this.passwordForm.invalid || !this.userEmail) {
      return;
    }

    this.loading = true;
    this.error = null;

    // Utiliser directLogin pour détecter mustChangePassword
    this.authService.directLogin(this.userEmail, this.passwordForm.value.password).subscribe({
      next: (response) => {
        // Si mustChangePassword est true, rediriger vers la page de changement
        if ('mustChangePassword' in response && response.mustChangePassword) {
          this.router.navigate(['/auth/change-password'], {
            queryParams: { userId: response.id }
          });
          return;
        }
        
        // Sinon, si c'est un AuthResponse, l'utilisateur est connecté
        if ('token' in response) {
          const user = response.user;
          // Utiliser la méthode centralisée pour déterminer la redirection
          if (this.authService.shouldRedirectToSetup(user)) {
            this.router.navigate(['/business/setup'], {
              queryParams: { userId: user.id }
            });
          } else {
            this.router.navigate(['/dashboard']);
          }
          return;
        }

        // Sinon, continuer avec le flux OTP normal
        if ('id' in response) {
          this.userId = response.id;
          this.userEmail = response.email;
          this.step = 'code';
          this.resendAttempts = 0;
          this.startResendCooldown();
        }
        this.loading = false;
      },
      error: (err) => {
        // Si l'erreur indique qu'il faut changer le mot de passe
        if (err.error?.message?.includes('changer votre mot de passe')) {
          // Essayer avec loginWithPassword pour obtenir l'userId
          if (this.userId) {
            this.authService.loginWithPassword({
              userId: this.userId,
              password: this.passwordForm.value.password
            }).subscribe({
              next: (user) => {
                if (user.mustChangePassword) {
                  this.router.navigate(['/auth/change-password'], {
                    queryParams: { userId: user.id }
                  });
                }
              },
              error: () => {
                this.error = err.error?.message || 'Mot de passe incorrect.';
                this.loading = false;
              }
            });
          } else {
            this.error = err.error?.message || 'Vous devez changer votre mot de passe temporaire.';
            this.loading = false;
          }
        } else {
          this.error = err.error?.message || 'Mot de passe incorrect.';
          this.loading = false;
        }
      }
    });
  }

  verifyCode(): void {
    if (this.codeForm.invalid || !this.userId || this.loading) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.authService.confirmLogin({
      userId: this.userId!,
      code: this.codeForm.value.code
    }).subscribe({
      next: (response) => {
        const user = response.user;
        // Utiliser la méthode centralisée pour déterminer la redirection
        if (this.authService.shouldRedirectToSetup(user)) {
          this.router.navigate(['/business/setup'], {
            queryParams: { userId: user.id }
          });
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Code invalide ou expiré.';
        this.codeForm.patchValue({ code: '' });
        this.loading = false;
      }
    });
  }

  resendCode(): void {
    if (this.resendCooldown > 0 || this.resendAttempts >= this.maxResendAttempts || !this.userEmail) {
      return;
    }

    this.loading = true;
    this.error = null;

    this.authService.requestLoginCode(this.userEmail).subscribe({
      next: () => {
        this.resendAttempts++;
        this.startResendCooldown();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de l\'envoi du code.';
        this.loading = false;
      }
    });
  }

  startResendCooldown(): void {
    this.resendCooldown = 30;
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
    }
    this.resendTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.resendTimer);
        this.resendTimer = null;
      }
    }, 1000);
  }

  onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    this.codeForm.patchValue({ code: value }, { emitEvent: false });
    // Déclencher manuellement la vérification si 6 chiffres
    if (value.length === 6) {
      setTimeout(() => this.verifyCode(), 100);
    }
  }

  ngOnDestroy(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
    }
  }

  backToEmail(): void {
    this.step = 'email';
    this.passwordForm.reset();
    this.error = null;
  }
}
