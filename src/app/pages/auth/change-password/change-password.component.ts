import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { ApiConfigService } from '../../../core/services/api-config.service';
import { GlassCardComponent } from '../../../shared/components/glass-card/glass-card.component';

interface ChangeTemporaryPasswordRequest {
  currentPassword: string;
  newPassword: string;
}

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GlassCardComponent],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css'
})
export class ChangePasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly apiConfig = inject(ApiConfigService);

  form!: FormGroup;
  loading = false;
  error: string | null = null;
  userId: string | null = null;

  ngOnInit(): void {
    this.initForm();
    // Récupérer l'userId depuis les query params ou depuis le localStorage
    this.route.queryParams.subscribe(params => {
      this.userId = params['userId'] || this.authService.getUser()?.id || null;
      if (!this.userId) {
        this.error = 'Identifiant utilisateur manquant.';
      }
    });
  }

  private initForm(): void {
    this.form = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(form: FormGroup): { [key: string]: boolean } | null {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    
    if (!newPassword || !confirmPassword) return null;
    
    return newPassword.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading || !this.userId) {
      this.markFormGroupTouched(this.form);
      return;
    }

    this.loading = true;
    this.error = null;

    const request: ChangeTemporaryPasswordRequest = {
      currentPassword: this.form.value.currentPassword,
      newPassword: this.form.value.newPassword
    };

    this.authService.changeTemporaryPassword(
      this.userId!,
      request.currentPassword,
      request.newPassword
    ).pipe(
      finalize(() => {
        this.loading = false;
      })
    ).subscribe({
      next: (updatedUser) => {
        // Vérifier que l'utilisateur a bien été retourné avec toutes les informations
        if (!updatedUser || !updatedUser.id) {
          this.error = 'Erreur lors de la mise à jour. Veuillez réessayer.';
          return;
        }

        // Vérifier que les rôles sont présents
        if (!updatedUser.roles || updatedUser.roles.length === 0) {
          this.error = 'Erreur : informations utilisateur incomplètes. Veuillez réessayer.';
          return;
        }

        // Utiliser la méthode centralisée pour déterminer la redirection
        const shouldRedirect = this.authService.shouldRedirectToSetup(updatedUser);
        
        // Navigation immédiate avec window.location si nécessaire pour forcer la navigation
        if (shouldRedirect) {
          // Rediriger vers le setup pour créer l'entreprise
          this.router.navigate(['/business/setup'], { 
            queryParams: { userId: updatedUser.id },
            replaceUrl: true 
          }).catch(() => {
            // En cas d'échec, utiliser window.location comme fallback
            window.location.href = `/business/setup?userId=${updatedUser.id}`;
          });
        } else {
          // Rediriger vers le dashboard
          this.router.navigate(['/dashboard'], { 
            replaceUrl: true 
          }).catch(() => {
            // En cas d'échec, utiliser window.location comme fallback
            window.location.href = '/dashboard';
          });
        }
      },
      error: (err) => {
        this.handleError(err);
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    if (field.errors['required']) return 'Ce champ est requis';
    if (field.errors['minlength']) return `Minimum ${field.errors['minlength'].requiredLength} caractères`;

    return '';
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  private handleError(error: any): void {
    // Le loading est déjà géré par finalize, pas besoin de le remettre à false ici
    if (error.error?.message) {
      this.error = error.error.message;
    } else if (error.message) {
      this.error = error.message;
    } else {
      this.error = 'Une erreur est survenue lors du changement de mot de passe.';
    }
  }
}
