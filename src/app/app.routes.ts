import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/auth/login/login.component';
import { ServiceRequestComponent } from './pages/service-request/service-request.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AdminDashboardComponent } from './pages/dashboard/admin/admin-dashboard.component';
import { AddBusinessOwnerComponent } from './pages/dashboard/admin/add-business-owner/add-business-owner.component';
import { BusinessSectorsComponent } from './pages/dashboard/admin/business-sectors/business-sectors.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'auth/login',
    component: LoginComponent
  },
  {
    path: 'auth/change-password',
    loadComponent: () => import('./pages/auth/change-password/change-password.component').then(m => m.ChangePasswordComponent)
  },
  {
    path: 'business/setup',
    loadComponent: () => import('./pages/business/setup/setup.component').then(m => m.SetupComponent)
  },
  {
    path: 'service-request',
    component: ServiceRequestComponent
  },
  {
    path: 'dashboard',
    component: DashboardComponent
  },
  {
    path: 'dashboard/admin',
    component: AdminDashboardComponent
  },
  {
    path: 'dashboard/admin/add-business-owner',
    component: AddBusinessOwnerComponent
  },
  {
    path: 'dashboard/admin/business-sectors',
    component: BusinessSectorsComponent
  }
];
