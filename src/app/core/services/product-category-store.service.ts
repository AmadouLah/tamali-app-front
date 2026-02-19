import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type { ProductCategoryDto } from '../models/product.model';

/** Store partagé des catégories produit : source unique pour les noms (synchro immédiate après renommage). */
@Injectable({ providedIn: 'root' })
export class ProductCategoryStoreService {
  private readonly categoriesSubject = new BehaviorSubject<ProductCategoryDto[]>([]);

  setCategories(_businessId: string, list: ProductCategoryDto[]): void {
    this.categoriesSubject.next(list);
  }

  updateCategory(id: string, name: string): void {
    const list = this.categoriesSubject.value;
    const i = list.findIndex(c => c.id === id);
    if (i < 0) return;
    const next = [...list];
    next[i] = { ...next[i], name };
    this.categoriesSubject.next(next);
  }

  removeCategory(id: string): void {
    const list = this.categoriesSubject.value;
    const next = list.filter(c => c.id !== id);
    this.categoriesSubject.next(next);
  }

  getCategoryName(categoryId: string | undefined): string {
    if (!categoryId) return '';
    return this.categoriesSubject.value.find(c => c.id === categoryId)?.name ?? '';
  }

  get categories(): ProductCategoryDto[] {
    return this.categoriesSubject.value;
  }

  get categories$(): BehaviorSubject<ProductCategoryDto[]> {
    return this.categoriesSubject;
  }
}
