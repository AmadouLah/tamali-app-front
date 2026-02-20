import { Injectable } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface TamaliDB extends DBSchema {
  pendingRequests: {
    key: string;
    value: {
      id: string;
      method: string;
      url: string;
      body?: any;
      headers?: Record<string, string>;
      timestamp: number;
    };
    indexes: {
      timestamp: number;
    };
  };
  cache: {
    key: string;
    value: {
      key: string;
      data: any;
      timestamp: number;
      expiresAt: number;
    };
    indexes: {
      expiresAt: number;
    };
  };
  localSales: {
    key: string;
    value: {
      id: string;
      businessId: string;
      sale: Record<string, unknown>;
      requestId: string;
      timestamp: number;
      synced: boolean;
    };
    indexes: {
      businessId: string;
      timestamp: number;
      requestId: string;
    };
  };
  localStockMovements: {
    key: string;
    value: {
      id: string;
      productId: string;
      quantity: number;
      requestId: string;
      timestamp: number;
      synced: boolean;
    };
    indexes: {
      productId: string;
      timestamp: number;
      requestId: string;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class IndexedDbService {
  private db: IDBPDatabase<TamaliDB> | null = null;
  private readonly dbName = 'TamaliDB';
  private readonly dbVersion = 3;

  async init(): Promise<void> {
    if (!this.db) {
      this.db = await openDB<TamaliDB>(this.dbName, this.dbVersion, {
        upgrade(db, oldVersion) {
          if (!db.objectStoreNames.contains('pendingRequests')) {
            const pendingStore = db.createObjectStore('pendingRequests', { keyPath: 'id' });
            pendingStore.createIndex('timestamp', 'timestamp');
          }
          if (!db.objectStoreNames.contains('cache')) {
            const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
            cacheStore.createIndex('expiresAt', 'expiresAt');
          }
          if (!db.objectStoreNames.contains('localSales')) {
            const localSalesStore = db.createObjectStore('localSales', { keyPath: 'id' });
            localSalesStore.createIndex('businessId', 'businessId');
            localSalesStore.createIndex('timestamp', 'timestamp');
            localSalesStore.createIndex('requestId', 'requestId');
          } else if (oldVersion < 2) {
            // Migration depuis version 1: supprimer l'index 'synced' s'il existe
            const tx = db.transaction('localSales', 'readwrite');
            const localSalesStore = tx.objectStore('localSales') as any;
            try {
              // Vérifier si l'index existe en parcourant tous les index
              const indexNames = Array.from(localSalesStore.indexNames) as string[];
              if (indexNames.includes('synced')) {
                localSalesStore.deleteIndex('synced');
              }
            } catch (e) {
              // L'index n'existe peut-être pas, continuer
            }
          }
          if (!db.objectStoreNames.contains('localStockMovements')) {
            const stockMovementsStore = db.createObjectStore('localStockMovements', { keyPath: 'id' });
            stockMovementsStore.createIndex('productId', 'productId');
            stockMovementsStore.createIndex('timestamp', 'timestamp');
            stockMovementsStore.createIndex('requestId', 'requestId');
          }
        }
      });
    }
  }

  async addPendingRequest(request: {
    id: string;
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
  }): Promise<void> {
    await this.init();
    await this.db!.put('pendingRequests', {
      ...request,
      timestamp: Date.now()
    });
  }

  async getPendingRequests(): Promise<Array<{
    id: string;
    method: string;
    url: string;
    body?: any;
    headers?: Record<string, string>;
    timestamp: number;
  }>> {
    await this.init();
    return await this.db!.getAll('pendingRequests');
  }

  async removePendingRequest(id: string): Promise<void> {
    await this.init();
    await this.db!.delete('pendingRequests', id);
  }

  async clearPendingRequests(): Promise<void> {
    await this.init();
    await this.db!.clear('pendingRequests');
  }

  async setCache(key: string, data: any, ttl: number = 3600000): Promise<void> {
    await this.init();
    await this.db!.put('cache', {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    });
  }

  async getCache<T>(key: string): Promise<T | null> {
    await this.init();
    const cached = await this.db!.get('cache', key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      await this.removeCache(key);
      return null;
    }
    return cached.data as T;
  }

  async removeCache(key: string): Promise<void> {
    await this.init();
    await this.db!.delete('cache', key);
  }

  async clearExpiredCache(): Promise<void> {
    await this.init();
    const allCache = await this.db!.getAll('cache');
    const now = Date.now();
    
    for (const item of allCache) {
      if (item.expiresAt < now) {
        await this.db!.delete('cache', item.key);
      }
    }
  }

  async addLocalSale(sale: {
    id: string;
    businessId: string;
    sale: any;
    requestId: string;
  }): Promise<void> {
    await this.init();
    await this.db!.put('localSales', {
      ...sale,
      timestamp: Date.now(),
      synced: false
    });
  }

  async getLocalSales(businessId: string): Promise<Array<{
    id: string;
    businessId: string;
    sale: any;
    requestId: string;
    timestamp: number;
    synced: boolean;
  }>> {
    await this.init();
    const index = this.db!.transaction('localSales').store.index('businessId');
    return await index.getAll(businessId);
  }

  async markSaleAsSynced(requestId: string): Promise<void> {
    await this.init();
    const index = this.db!.transaction('localSales').store.index('requestId');
    const localSale = await index.get(requestId);
    if (localSale) {
      await this.db!.put('localSales', {
        ...localSale,
        synced: true
      });
    }
  }

  async removeLocalSale(id: string): Promise<void> {
    await this.init();
    await this.db!.delete('localSales', id);
  }

  async clearSyncedLocalSales(businessId: string): Promise<void> {
    await this.init();
    const index = this.db!.transaction('localSales').store.index('businessId');
    const sales = await index.getAll(businessId);
    
    for (const sale of sales) {
      if (sale.synced) {
        await this.db!.delete('localSales', sale.id);
      }
    }
  }

  async addLocalStockMovement(movement: {
    id: string;
    productId: string;
    quantity: number;
    requestId: string;
  }): Promise<void> {
    await this.init();
    await this.db!.put('localStockMovements', {
      ...movement,
      timestamp: Date.now(),
      synced: false
    });
  }

  async getLocalStockMovements(productId: string): Promise<Array<{
    id: string;
    productId: string;
    quantity: number;
    requestId: string;
    timestamp: number;
    synced: boolean;
  }>> {
    await this.init();
    const index = this.db!.transaction('localStockMovements').store.index('productId');
    return await index.getAll(productId);
  }

  async removeLocalStockMovement(id: string): Promise<void> {
    await this.init();
    await this.db!.delete('localStockMovements', id);
  }

  async removeLocalStockMovementsByRequestId(requestId: string): Promise<void> {
    await this.init();
    const index = this.db!.transaction('localStockMovements').store.index('requestId');
    const movements = await index.getAll(requestId);
    
    for (const movement of movements) {
      await this.db!.delete('localStockMovements', movement.id);
    }
  }

  async getAvailableStock(productId: string, currentStock: number): Promise<number> {
    await this.init();
    const movements = await this.getLocalStockMovements(productId);
    const pendingMovements = movements.filter(m => !m.synced);
    const totalReserved = pendingMovements.reduce((sum, m) => sum + m.quantity, 0);
    return Math.max(0, currentStock - totalReserved);
  }
}
