import type { MenuItem } from '../../../shared/components/admin-sidebar/admin-sidebar.component';

export const BUSINESS_OWNER_MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard', icon: 'grid', route: '/dashboard/business' },
  { label: 'Ventes', icon: 'shopping-cart', route: '/dashboard/business/sales' },
  { label: 'Catégories', icon: 'folder', route: '/dashboard/business/categories' },
  { label: 'Produits', icon: 'bar-chart', route: '/dashboard/business/products' },
  { label: 'Stock', icon: 'archive', route: '/dashboard/business/stock' },
  { label: 'Mon entreprise', icon: 'briefcase', route: '/dashboard/business/company' },
  { label: 'Paramètres', icon: 'settings', route: '/dashboard/business/account' }
];
