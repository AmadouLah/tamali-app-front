import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ApiConfigService } from '../../core/services/api-config.service';
import { ToastService } from '../../core/services/toast.service';
import { extractErrorMessage } from '../../core/utils/error.utils';
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
  private readonly toast = inject(ToastService);

  serviceRequestForm: FormGroup;
  loading = false;

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

    this.http.post(this.apiConfig.getServiceRequestsUrl(), this.serviceRequestForm.value).subscribe({
      next: () => {
        this.toast.success('Demande envoyée avec succès ! Nous vous contacterons sous peu.');
        this.loading = false;
        this.serviceRequestForm.reset();
      },
      error: (err) => {
        this.toast.error(extractErrorMessage(err, 'Erreur lors de l\'envoi de la demande. Veuillez réessayer.'));
        this.loading = false;
      }
    });
  }
}
