import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { OfflineHttpService } from './offline-http.service';
import { ApiConfigService } from './api-config.service';
import type {
  SaleDto,
  StockMovementDto,
  BusinessActivityEntryDto
} from '../models/product.model';

export type ExportFormat = 'CSV' | 'EXCEL' | 'PDF';
export type ExportPeriod =
  | 'ALL'
  | 'TODAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'SIX_MONTHS'
  | 'ONE_YEAR'
  | 'CUSTOM';

@Injectable({
  providedIn: 'root'
})
export class BusinessExportService {
  private readonly offlineHttp = inject(OfflineHttpService);
  private readonly apiConfig = inject(ApiConfigService);

  private buildPeriodQuery(period: ExportPeriod, custom?: { from?: Date | null; to?: Date | null }): string {
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;

    switch (period) {
      case 'ALL':
        break;
      case 'TODAY':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        to = now;
        break;
      case 'THIS_WEEK': {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        from = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
        to = now;
        break;
      }
      case 'THIS_MONTH':
        from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        to = now;
        break;
      case 'SIX_MONTHS':
        from = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
        to = now;
        break;
      case 'ONE_YEAR':
        from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 0, 0, 0, 0);
        to = now;
        break;
      case 'CUSTOM':
        from = custom?.from ?? null;
        to = custom?.to ?? null;
        break;
    }

    const params: string[] = [];
    if (from) params.push(`from=${from.toISOString()}`);
    if (to) params.push(`to=${to.toISOString()}`);
    return params.length ? `?${params.join('&')}` : '';
  }

  getSalesExport(
    businessId: string,
    period: ExportPeriod,
    custom?: { from?: Date | null; to?: Date | null }
  ): Observable<SaleDto[]> {
    const url = this.apiConfig.getBusinessSalesExportUrl(businessId) + this.buildPeriodQuery(period, custom);
    return this.offlineHttp.get<SaleDto[] | { message: string }>(url).pipe(
      map(body => (Array.isArray(body) ? body : []))
    );
  }

  getStockMovementsExport(
    businessId: string,
    period: ExportPeriod,
    custom?: { from?: Date | null; to?: Date | null }
  ): Observable<StockMovementDto[]> {
    const url = this.apiConfig.getStockMovementsExportUrl(businessId) + this.buildPeriodQuery(period, custom);
    return this.offlineHttp.get<StockMovementDto[] | { message: string }>(url).pipe(
      map(body => (Array.isArray(body) ? body : []))
    );
  }

  getActivityLogExport(
    businessId: string,
    period: ExportPeriod,
    custom?: { from?: Date | null; to?: Date | null }
  ): Observable<BusinessActivityEntryDto[]> {
    const url = this.apiConfig.getActivityLogExportUrl(businessId) + this.buildPeriodQuery(period, custom);
    return this.offlineHttp.get<BusinessActivityEntryDto[] | { message: string }>(url).pipe(
      map(body => (Array.isArray(body) ? body : []))
    );
  }
}

