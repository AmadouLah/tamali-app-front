import type { MenuItem } from '../../../shared/components/admin-sidebar/admin-sidebar.component';

export const BUSINESS_OWNER_MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard', icon: 'grid', route: '/dashboard/business' },
  { label: 'Ventes', icon: 'shopping-cart', route: '/dashboard/business' },
  { label: 'Mon entreprise', icon: 'briefcase', route: '/dashboard/business/company' },
  { label: 'Paramètres', icon: 'settings', route: '/dashboard/business/account' }
];
