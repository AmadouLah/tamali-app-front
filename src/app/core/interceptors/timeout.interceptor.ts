import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { timeout } from 'rxjs';

/** Timeout 90s en prod pour gérer le cold start de Render */
const PRODUCTION_TIMEOUT_MS = 90_000;

export const timeoutInterceptor: HttpInterceptorFn = (req, next) => {
  if (environment.production && req.url.startsWith(environment.apiUrl)) {
    return next(req).pipe(timeout(PRODUCTION_TIMEOUT_MS));
  }
  return next(req);
};
