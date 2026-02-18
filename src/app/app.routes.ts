import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/auth/login/login.component';
import { ServiceRequestComponent } from './pages/service-request/service-request.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AdminDashboardComponent } from './pages/dashboard/admin/admin-dashboard.component';
import { AddBusinessOwnerComponent } from './pages/dashboard/admin/add-business-owner/add-business-owner.component';
import { BusinessSectorsComponent } from './pages/dashboard/admin/business-sectors/business-sectors.component';
import { AccountComponent } from './pages/dashboard/admin/account/account.component';
import { ChangePasswordComponent } from './pages/auth/change-password/change-password.component';
import { SetupComponent } from './pages/business/setup/setup.component';
import { BusinessDashboardComponent } from './pages/dashboard/business/business-dashboard.component';
import { BusinessAccountComponent } from './pages/dashboard/business/account/business-account.component';
import { BusinessCompanyComponent } from './pages/dashboard/business/company/business-company.component';
import { BusinessSalesComponent } from './pages/dashboard/business/sales/business-sales.component';
import { BusinessProductsComponent } from './pages/dashboard/business/products/business-products.component';
import { BusinessStockComponent } from './pages/dashboard/business/stock/business-stock.component';

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
    component: ChangePasswordComponent
  },
  {
    path: 'business/setup',
    component: SetupComponent
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
    path: 'dashboard/business',
    component: BusinessDashboardComponent
  },
  {
    path: 'dashboard/business/sales',
    component: BusinessSalesComponent
  },
  {
    path: 'dashboard/business/products',
    component: BusinessProductsComponent
  },
  {
    path: 'dashboard/business/stock',
    component: BusinessStockComponent
  },
  {
    path: 'dashboard/business/account',
    component: BusinessAccountComponent
  },
  {
    path: 'dashboard/business/company',
    component: BusinessCompanyComponent
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
  },
  {
    path: 'dashboard/admin/account',
    component: AccountComponent
  }
];
