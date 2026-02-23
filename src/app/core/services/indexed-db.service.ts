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
      /** Numéro de reçu : temporaire (TEMP-...) hors ligne, puis officiel (INV-...) après sync */
      receiptNumber?: string;
      /** ID serveur après synchronisation */
      serverId?: string;
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
      type: string;
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
  localProducts: {
    key: string;
    value: {
      id: string;
      businessId: string;
      product: Record<string, unknown>;
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
  localEntities: {
    key: string;
    value: {
      id: string;
      entityType: string;
      businessId: string;
      entityId: string;
      entity: Record<string, unknown>;
      operation: string;
      requestId: string;
      timestamp: number;
      synced: boolean;
    };
    indexes: {
      entityType: string;
      businessId: string;
      entityId: string;
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
  private readonly dbVersion = 5;

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
          if (!db.objectStoreNames.contains('localProducts')) {
            const localProductsStore = db.createObjectStore('localProducts', { keyPath: 'id' });
            localProductsStore.createIndex('businessId', 'businessId');
            localProductsStore.createIndex('timestamp', 'timestamp');
            localProductsStore.createIndex('requestId', 'requestId');
          }
          if (!db.objectStoreNames.contains('localEntities')) {
            const localEntitiesStore = db.createObjectStore('localEntities', { keyPath: 'id' });
            localEntitiesStore.createIndex('entityType', 'entityType');
            localEntitiesStore.createIndex('businessId', 'businessId');
            localEntitiesStore.createIndex('entityId', 'entityId');
            localEntitiesStore.createIndex('timestamp', 'timestamp');
            localEntitiesStore.createIndex('requestId', 'requestId');
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
    receiptNumber: string;
  }): Promise<void> {
    await this.init();
    await this.db!.put('localSales', {
      ...sale,
      timestamp: Date.now(),
      synced: false,
      receiptNumber: sale.receiptNumber
    });
  }

  /** Met à jour la vente locale après sync : même entrée, statut SYNCED + serverId + numéro officiel. */
  async updateLocalSaleAfterSync(localId: string, payload: { serverId: string; receiptNumber: string }): Promise<void> {
    await this.init();
    const record = await this.db!.get('localSales', localId);
    if (!record) return;
    await this.db!.put('localSales', {
      ...record,
      synced: true,
      serverId: payload.serverId,
      receiptNumber: payload.receiptNumber
    });
  }

  async getLocalSales(businessId: string): Promise<Array<{
    id: string;
    businessId: string;
    sale: any;
    requestId: string;
    timestamp: number;
    synced: boolean;
    receiptNumber?: string;
    serverId?: string;
  }>> {
    await this.init();
    const index = this.db!.transaction('localSales').store.index('businessId');
    return await index.getAll(businessId);
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
    type: string;
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
    type: string;
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
    
    // Calculer l'impact des mouvements locaux sur le stock disponible
    // IN : augmente le stock (quantité positive)
    // OUT/SALE : diminue le stock (quantité négative)
    const stockDelta = pendingMovements.reduce((sum, m) => {
      if (m.type === 'IN') {
        return sum + m.quantity; // Réapprovisionnement : augmente le stock
      } else {
        return sum - m.quantity; // Sortie/Vente : diminue le stock
      }
    }, 0);
    
    return Math.max(0, currentStock + stockDelta);
  }

  async addLocalProduct(product: {
    id: string;
    businessId: string;
    product: Record<string, unknown>;
    requestId: string;
  }): Promise<void> {
    await this.init();
    await this.db!.put('localProducts', {
      ...product,
      timestamp: Date.now(),
      synced: false
    });
  }

  async getLocalProducts(businessId: string): Promise<Array<{
    id: string;
    businessId: string;
    product: Record<string, unknown>;
    requestId: string;
    timestamp: number;
    synced: boolean;
  }>> {
    await this.init();
    const index = this.db!.transaction('localProducts').store.index('businessId');
    return await index.getAll(businessId);
  }

  async removeLocalProduct(id: string): Promise<void> {
    await this.init();
    await this.db!.delete('localProducts', id);
  }

  async removeLocalProductByRequestId(requestId: string): Promise<void> {
    await this.init();
    const index = this.db!.transaction('localProducts').store.index('requestId');
    const products = await index.getAll(requestId);
    
    for (const product of products) {
      await this.db!.delete('localProducts', product.id);
    }
  }

  async addLocalEntity(entity: {
    id: string;
    entityType: string;
    businessId: string;
    entityId: string;
    entity: Record<string, unknown>;
    operation: string;
    requestId: string;
  }): Promise<void> {
    await this.init();
    await this.db!.put('localEntities', {
      ...entity,
      timestamp: Date.now(),
      synced: false
    });
  }

  async getLocalEntities(entityType: string, businessId: string): Promise<Array<{
    id: string;
    entityType: string;
    businessId: string;
    entityId: string;
    entity: Record<string, unknown>;
    operation: string;
    requestId: string;
    timestamp: number;
    synced: boolean;
  }>> {
    await this.init();
    const typeIndex = this.db!.transaction('localEntities').store.index('entityType');
    const allByType = await typeIndex.getAll(entityType);
    // Si businessId est vide, retourner toutes les entités de ce type non synchronisées
    if (!businessId) {
      return allByType.filter(e => !e.synced);
    }
    return allByType.filter(e => e.businessId === businessId && !e.synced);
  }

  async getLocalEntityByRequestId(requestId: string): Promise<{
    id: string;
    entityType: string;
    businessId: string;
    entityId: string;
    entity: Record<string, unknown>;
    operation: string;
    requestId: string;
    timestamp: number;
    synced: boolean;
  } | null> {
    await this.init();
    const index = this.db!.transaction('localEntities').store.index('requestId');
    const entities = await index.getAll(requestId);
    return entities.length > 0 ? entities[0] : null;
  }

  async removeLocalEntityByRequestId(requestId: string): Promise<void> {
    await this.init();
    const index = this.db!.transaction('localEntities').store.index('requestId');
    const entities = await index.getAll(requestId);
    
    for (const entity of entities) {
      await this.db!.delete('localEntities', entity.id);
    }
  }

  async removeLocalEntity(id: string): Promise<void> {
    await this.init();
    await this.db!.delete('localEntities', id);
  }
}
