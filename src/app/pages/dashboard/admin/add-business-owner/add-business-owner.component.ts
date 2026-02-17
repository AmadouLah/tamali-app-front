import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { ApiConfigService } from '../../../../core/services/api-config.service';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';

interface CreateBusinessOwnerRequest {
  email: string;
}

@Component({
  selector: 'app-add-business-owner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GlassCardComponent],
  templateUrl: './add-business-owner.component.html',
  styleUrl: './add-business-owner.component.css'
})
export class AddBusinessOwnerComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly apiConfig = inject(ApiConfigService);

  form!: FormGroup;
  loading = false;
  error: string | null = null;
  success = false;

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading) {
      this.markFormGroupTouched(this.form);
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = false;

    const request: CreateBusinessOwnerRequest = {
      email: this.form.value.email.trim()
    };

    this.http.post(`${this.apiConfig.getUsersUrl()}/business-owner`, request).subscribe({
      next: () => {
        this.success = true;
        this.loading = false;
        this.form.reset();
        setTimeout(() => {
          this.router.navigate(['/dashboard/admin']);
        }, 2000);
      },
      error: (err) => {
        this.handleError(err);
      }
    });
  }

  private handleError(err: any): void {
    this.loading = false;
    this.error = err.error?.message || 'Une erreur est survenue lors de la création.';
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);
    if (!field || !field.errors || !field.touched) return '';

    if (field.errors['required']) return 'Ce champ est requis';
    if (field.errors['email']) return 'Email invalide';
    
    return '';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }
}
