import type { MenuItem } from '../../../shared/components/admin-sidebar/admin-sidebar.component';

export const ADMIN_MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard', icon: 'grid', route: '/dashboard/admin' },
  { label: 'Notifications instantanées', icon: 'bell', route: '/dashboard/admin/instant-notifications' },
  { label: 'Annonces', icon: 'megaphone', route: '/dashboard/admin/announcements' },
  { label: 'Ajouter Propriétaire', icon: 'user-plus', route: '/dashboard/admin/add-business-owner' },
  { label: 'Réinitialiser MDP', icon: 'key', route: '/dashboard/admin/users' },
  { label: 'Secteurs d\'activité', icon: 'briefcase', route: '/dashboard/admin/business-sectors' },
  { label: 'Mon Compte', icon: 'user', route: '/dashboard/admin/account' }
];
