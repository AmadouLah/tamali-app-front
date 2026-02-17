import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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

  serviceRequestForm: FormGroup;
  loading = false;
  success = false;
  error: string | null = null;
  private readonly apiUrl = 'http://localhost:9999/api/service-requests';

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

    this.http.post(this.apiUrl, this.serviceRequestForm.value).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
        this.serviceRequestForm.reset();
        setTimeout(() => {
          this.success = false;
        }, 5000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de l\'envoi de la demande. Veuillez réessayer.';
        this.loading = false;
      }
    });
  }
}
