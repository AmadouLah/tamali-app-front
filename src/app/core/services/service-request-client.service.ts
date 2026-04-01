import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';

export interface ServiceRequestRequest {
  email: string;
  objective: string;
}

@Injectable({ providedIn: 'root' })
export class ServiceRequestClientService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  create(request: ServiceRequestRequest): Observable<unknown> {
    return this.http.post(this.apiConfig.getServiceRequestsUrl(), request);
  }
}

