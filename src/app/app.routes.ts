import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'auth/login',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent)
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
    loadComponent: () => import('./pages/service-request/service-request.component').then(m => m.ServiceRequestComponent)
  },
  { path: 'dashboard', component: DashboardComponent },
  {
    path: 'dashboard/business',
    loadComponent: () => import('./pages/dashboard/business/business-dashboard.component').then(m => m.BusinessDashboardComponent)
  },
  {
    path: 'dashboard/business/sales',
    loadComponent: () => import('./pages/dashboard/business/sales/business-sales.component').then(m => m.BusinessSalesComponent)
  },
  {
    path: 'dashboard/business/products',
    loadComponent: () => import('./pages/dashboard/business/products/business-products.component').then(m => m.BusinessProductsComponent)
  },
  {
    path: 'dashboard/business/stock',
    loadComponent: () => import('./pages/dashboard/business/stock/business-stock.component').then(m => m.BusinessStockComponent)
  },
  {
    path: 'dashboard/business/account',
    loadComponent: () => import('./pages/dashboard/business/account/business-account.component').then(m => m.BusinessAccountComponent)
  },
  {
    path: 'dashboard/business/company',
    loadComponent: () => import('./pages/dashboard/business/company/business-company.component').then(m => m.BusinessCompanyComponent)
  },
  {
    path: 'dashboard/admin',
    loadComponent: () => import('./pages/dashboard/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent)
  },
  {
    path: 'dashboard/admin/add-business-owner',
    loadComponent: () => import('./pages/dashboard/admin/add-business-owner/add-business-owner.component').then(m => m.AddBusinessOwnerComponent)
  },
  {
    path: 'dashboard/admin/business-sectors',
    loadComponent: () => import('./pages/dashboard/admin/business-sectors/business-sectors.component').then(m => m.BusinessSectorsComponent)
  },
  {
    path: 'dashboard/admin/account',
    loadComponent: () => import('./pages/dashboard/admin/account/account.component').then(m => m.AccountComponent)
  }
];
