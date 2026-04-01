import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type StoredUser = { id?: string; roles?: Array<{ type?: string }> } | null;

function getStoredUser(): StoredUser {
  const raw = localStorage.getItem('auth_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const authHeadersInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const token = localStorage.getItem('auth_token');
  const user = getStoredUser();
  const role = user?.roles?.[0]?.type;
  const userId = user?.id;

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (userId) headers['X-User-Id'] = userId;
  if (role) headers['X-User-Role'] = role;

  if (Object.keys(headers).length === 0) return next(req);
  return next(req.clone({ setHeaders: headers }));
};

