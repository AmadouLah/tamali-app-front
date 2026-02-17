import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

export interface CheckEmailRequest {
  email: string;
}

export interface EmailCheckResponse {
  exists: boolean;
  userId: string | null;
  email: string;
}

export interface PasswordLoginRequest {
  userId: string;
  password: string;
}

export interface RequestCodeRequest {
  email: string;
}

export interface ConfirmLoginRequest {
  userId: string;
  code: string;
}

export interface RoleDto {
  id: string;
  type: 'SUPER_ADMIN' | 'BUSINESS_OWNER';
}

export interface UserDto {
  id: string;
  firstname?: string;
  lastname?: string;
  email: string;
  enabled: boolean;
  businessId?: string;
  roles?: RoleDto[];
  mustChangePassword?: boolean;
}

export interface AuthResponse {
  token: string;
  user: UserDto;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly tokenKey = 'auth_token';
  private readonly userKey = 'auth_user';

  checkEmail(email: string): Observable<EmailCheckResponse> {
    return this.http.post<EmailCheckResponse>(`${this.apiConfig.getAuthUrl()}/check-email`, { email });
  }

  loginWithPassword(request: PasswordLoginRequest): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.apiConfig.getAuthUrl()}/login-password`, request);
  }

  requestLoginCode(email: string): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.apiConfig.getAuthUrl()}/request-code`, { email });
  }

  confirmLogin(request: ConfirmLoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiConfig.getAuthUrl()}/confirm-login`, request).pipe(
      tap(response => {
        this.setToken(response.token);
        this.setUser(response.user);
      })
    );
  }

  directLogin(email: string, password: string): Observable<AuthResponse | UserDto> {
    return this.http.post<AuthResponse | UserDto>(`${this.apiConfig.getAuthUrl()}/direct-login`, { email, password }).pipe(
      tap(response => {
        // Si c'est un AuthResponse, sauvegarder le token et l'utilisateur
        if ('token' in response) {
          this.setToken(response.token);
          this.setUser(response.user);
        }
      })
    );
  }

  changeTemporaryPassword(userId: string, currentPassword: string, newPassword: string): Observable<UserDto> {
    return this.http.post<UserDto>(`${this.apiConfig.getUsersUrl()}/${userId}/change-temporary-password`, {
      currentPassword,
      newPassword
    });
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUser(): UserDto | null {
    const userStr = localStorage.getItem(this.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  private setUser(user: UserDto): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }
}
