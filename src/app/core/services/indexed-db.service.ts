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
}

@Injectable({
  providedIn: 'root'
})
export class IndexedDbService {
  private db: IDBPDatabase<TamaliDB> | null = null;
  private readonly dbName = 'TamaliDB';
  private readonly dbVersion = 1;

  async init(): Promise<void> {
    if (!this.db) {
      this.db = await openDB<TamaliDB>(this.dbName, this.dbVersion, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('pendingRequests')) {
            const pendingStore = db.createObjectStore('pendingRequests', { keyPath: 'id' });
            pendingStore.createIndex('timestamp', 'timestamp');
          }
          if (!db.objectStoreNames.contains('cache')) {
            const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
            cacheStore.createIndex('expiresAt', 'expiresAt');
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
}
