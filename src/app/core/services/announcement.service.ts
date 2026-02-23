import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';

export interface AnnouncementDto {
  id: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AnnouncementService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  getCurrent(): Observable<AnnouncementDto | null> {
    return this.http.get<AnnouncementDto>(this.apiConfig.getAnnouncementCurrentUrl(), { observe: 'response' }).pipe(
      map(res => (res.status === 204 || !res.body) ? null : res.body),
      catchError(() => of(null))
    );
  }

  setCurrent(message: string): Observable<AnnouncementDto> {
    return this.http.post<AnnouncementDto>(this.apiConfig.getSuperAdminAnnouncementsUrl(), { message });
  }

  clearCurrent(): Observable<void> {
    return this.http.delete<void>(`${this.apiConfig.getSuperAdminAnnouncementsUrl()}/current`, { observe: 'body' }).pipe(
      map(() => undefined)
    );
  }

  broadcastEmail(subject: string, message: string): Observable<void> {
    return this.http.post<void>(`${this.apiConfig.getSuperAdminAnnouncementsUrl()}/broadcast-email`, { subject, message });
  }
}
