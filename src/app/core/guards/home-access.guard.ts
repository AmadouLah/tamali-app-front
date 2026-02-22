import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard empêchant les associés et propriétaires connectés d'accéder à l'accueil.
 * Ils sont redirigés vers leur dashboard. Le super admin conserve l'accès.
 */
export const homeAccessGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.getUser();

  if (auth.canAccessHomePage(user)) return true;
  return router.createUrlTree(['/dashboard']);
};
