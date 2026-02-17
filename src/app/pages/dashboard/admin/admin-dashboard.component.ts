import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { GlassCardComponent } from '../../../shared/components/glass-card/glass-card.component';

export interface ServiceRequestDto {
  id: string;
  email: string;
  objective: string;
  processed: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, GlassCardComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  serviceRequests: ServiceRequestDto[] = [];
  loading = false;
  error: string | null = null;
  private readonly apiUrl = 'http://localhost:9999/api/service-requests';

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (!user || !user.roles?.some(r => r.type === 'SUPER_ADMIN')) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.loadServiceRequests();
  }

  loadServiceRequests(): void {
    this.loading = true;
    this.error = null;
    this.http.get<ServiceRequestDto[]>(this.apiUrl).subscribe({
      next: (requests) => {
        this.serviceRequests = requests;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des demandes.';
        this.loading = false;
      }
    });
  }

  markAsProcessed(id: string): void {
    this.http.patch<ServiceRequestDto>(`${this.apiUrl}/${id}/process`, {}).subscribe({
      next: () => {
        this.loadServiceRequests();
      },
      error: () => {
        this.error = 'Erreur lors du traitement de la demande.';
      }
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
