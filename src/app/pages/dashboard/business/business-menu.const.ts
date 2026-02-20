import type { MenuItem } from '../../../shared/components/admin-sidebar/admin-sidebar.component';
import type { UserDto } from '../../../core/services/auth.service';

const ALL_MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard', icon: 'grid', route: '/dashboard/business' },
  { label: 'Ventes', icon: 'shopping-cart', route: '/dashboard/business/sales' },
  { label: 'Catégories', icon: 'folder', route: '/dashboard/business/categories' },
  { label: 'Produits', icon: 'bar-chart', route: '/dashboard/business/products' },
  { label: 'Stock', icon: 'archive', route: '/dashboard/business/stock' },
  { label: 'Mon entreprise', icon: 'briefcase', route: '/dashboard/business/company' },
  { label: 'Paramètres', icon: 'settings', route: '/dashboard/business/account' },
  { label: 'Profil', icon: 'user', route: '/dashboard/business/profile' }
];

const ASSOCIATE_HIDDEN_ROUTES = ['/dashboard/business/categories', '/dashboard/business/company', '/dashboard/business/account'];

export const BUSINESS_OWNER_MENU_ITEMS: MenuItem[] = ALL_MENU_ITEMS;

export function getBusinessMenuItems(user: UserDto | null): MenuItem[] {
  const isAssociate = user?.roles?.some(r => r.type === 'BUSINESS_ASSOCIATE') ?? false;
  if (!isAssociate) return ALL_MENU_ITEMS;
  return ALL_MENU_ITEMS.filter(item => !ASSOCIATE_HIDDEN_ROUTES.includes(item.route ?? ''));
}
