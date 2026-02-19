import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type { BusinessSectorDto } from '../models/business.model';

/** Store partagé des secteurs d'activité : source unique pour les noms (synchro immédiate après modification par admin). */
@Injectable({ providedIn: 'root' })
export class BusinessSectorStoreService {
  private readonly sectorsSubject = new BehaviorSubject<BusinessSectorDto[]>([]);

  setSectors(list: BusinessSectorDto[]): void {
    this.sectorsSubject.next(list);
  }

  updateSector(id: string, name: string, description?: string, active?: boolean): void {
    const list = this.sectorsSubject.value;
    const i = list.findIndex(s => s.id === id);
    if (i < 0) return;
    const next = [...list];
    next[i] = { ...next[i], name, ...(description !== undefined ? { description } : {}), ...(active !== undefined ? { active } : {}) };
    this.sectorsSubject.next(next);
  }

  getSectorName(sectorId: string | undefined): string {
    if (!sectorId) return '';
    return this.sectorsSubject.value.find(s => s.id === sectorId)?.name ?? '';
  }

  get sectors(): BusinessSectorDto[] {
    return this.sectorsSubject.value;
  }

  get sectors$(): BehaviorSubject<BusinessSectorDto[]> {
    return this.sectorsSubject;
  }
}
