import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { AnnouncementService } from '../../../../core/services/announcement.service';
import { ToastService } from '../../../../core/services/toast.service';
import { extractErrorMessage } from '../../../../core/utils/error.utils';
import { GlassCardComponent } from '../../../../shared/components/glass-card/glass-card.component';
import { AdminSidebarComponent } from '../../../../shared/components/admin-sidebar/admin-sidebar.component';
import { ADMIN_MENU_ITEMS } from '../admin-menu.const';
import type { AnnouncementDto } from '../../../../core/services/announcement.service';

@Component({
  selector: 'app-announcements',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, GlassCardComponent, AdminSidebarComponent],
  templateUrl: './announcements.component.html',
  styleUrl: './announcements.component.css'
})
export class AnnouncementsComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly announcementService = inject(AnnouncementService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  menuItems = ADMIN_MENU_ITEMS;
  activeMenu = 'annonces';
  sidebarOpen = false;

  bannerForm!: FormGroup;
  emailForm!: FormGroup;
  current: AnnouncementDto | null = null;
  loadingBanner = false;
  loadingEmail = false;
  loadingCurrent = true;

  ngOnInit(): void {
    const user = this.authService.getUser();
    if (!user?.roles?.some(r => r.type === 'SUPER_ADMIN')) {
      this.router.navigate(['/auth/login']);
      return;
    }
    this.bannerForm = this.fb.group({
      message: ['', [Validators.required, Validators.maxLength(2000)]]
    });
    this.emailForm = this.fb.group({
      subject: ['', [Validators.required, Validators.maxLength(200)]],
      message: ['', [Validators.required, Validators.maxLength(5000)]]
    });
    this.loadCurrent();
  }

  private loadCurrent(): void {
    this.loadingCurrent = true;
    this.announcementService.getCurrent().subscribe({
      next: (a) => {
        this.current = a;
        if (a) this.bannerForm.patchValue({ message: a.message });
        this.loadingCurrent = false;
      },
      error: () => {
        this.loadingCurrent = false;
      }
    });
  }

  saveBanner(): void {
    if (this.bannerForm.invalid) return;
    this.loadingBanner = true;
    this.announcementService.setCurrent(this.bannerForm.value.message).subscribe({
      next: (a) => {
        this.current = a;
        this.toast.success('Message enregistré. Il s\'affichera sur la page de connexion et les tableaux de bord.');
        this.loadingBanner = false;
      },
      error: (err) => {
        this.toast.error(extractErrorMessage(err, 'Une erreur est survenue.'));
        this.loadingBanner = false;
      }
    });
  }

  clearBanner(): void {
    if (!confirm('Retirer le message affiché partout ?')) return;
    this.loadingBanner = true;
    this.announcementService.clearCurrent().subscribe({
      next: () => {
        this.current = null;
        this.bannerForm.patchValue({ message: '' });
        this.toast.success('Message retiré.');
        this.loadingBanner = false;
      },
      error: (err) => {
        this.toast.error(extractErrorMessage(err, 'Une erreur est survenue.'));
        this.loadingBanner = false;
      }
    });
  }

  sendBroadcastEmail(): void {
    if (this.emailForm.invalid) return;
    if (!confirm('Envoyer cet email à tous les utilisateurs actifs ?')) return;
    this.loadingEmail = true;
    this.announcementService.broadcastEmail(
      this.emailForm.value.subject,
      this.emailForm.value.message
    ).subscribe({
      next: () => {
        this.toast.success('Email envoyé à tous les utilisateurs.');
        this.loadingEmail = false;
      },
      error: (err) => {
        this.toast.error(extractErrorMessage(err, 'Une erreur est survenue.'));
        this.loadingEmail = false;
      }
    });
  }
}
