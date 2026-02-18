import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ApiConfigService } from '../../core/services/api-config.service';
import { GlassCardComponent } from '../../shared/components/glass-card/glass-card.component';

@Component({
  selector: 'app-service-request',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GlassCardComponent],
  templateUrl: './service-request.component.html',
  styleUrl: './service-request.component.css'
})
export class ServiceRequestComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly apiConfig = inject(ApiConfigService);

  serviceRequestForm: FormGroup;
  loading = false;
  success = false;
  error: string | null = null;

  constructor() {
    this.serviceRequestForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      objective: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]]
    });
  }

  onSubmit(): void {
    if (this.serviceRequestForm.invalid) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = false;

    this.http.post(this.apiConfig.getServiceRequestsUrl(), this.serviceRequestForm.value).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
        this.serviceRequestForm.reset();
        setTimeout(() => {
          this.success = false;
        }, 5000);
      },
      error: (err) => {
        console.error('Erreur lors de l\'envoi de la demande:', err);
        // Gérer différents formats de réponse d'erreur
        let errorMessage = 'Erreur lors de l\'envoi de la demande. Veuillez réessayer.';
        
        if (err.error) {
          // Format ErrorResponse du backend
          if (err.error.message) {
            errorMessage = err.error.message;
          } else if (err.error.errors && Array.isArray(err.error.errors) && err.error.errors.length > 0) {
            // Erreurs de validation multiples
            errorMessage = err.error.errors.join(', ');
          } else if (typeof err.error === 'string') {
            errorMessage = err.error;
          }
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        this.error = errorMessage;
        this.loading = false;
      }
    });
  }
}
