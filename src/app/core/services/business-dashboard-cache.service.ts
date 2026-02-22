import { Injectable } from '@angular/core';
import type { SaleDto, ProductDto } from '../models/product.model';

export interface CachedDashboardData {
  sales: SaleDto[];
  products: ProductDto[];
  business: Record<string, unknown> | null;
}

@Injectable({ providedIn: 'root' })
export class BusinessDashboardCacheService {
  private readonly cache = new Map<string, CachedDashboardData>();

  get(businessId: string): CachedDashboardData | null {
    return this.cache.get(businessId) ?? null;
  }

  set(businessId: string, data: CachedDashboardData): void {
    this.cache.set(businessId, data);
  }
}
