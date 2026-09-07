// src/storage/LocalStorageProvider.ts - Safe Storage Implementation with in-memory fallback
import { StorageProvider } from './StorageProvider';

export class LocalStorageProvider implements StorageProvider {
  private memoryFallback = new Map<string, string>();

  private isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isAvailable()) {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
      const val = this.memoryFallback.get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (this.isAvailable()) {
        window.localStorage.setItem(key, serialized);
      } else {
        this.memoryFallback.set(key, serialized);
      }
    } catch (err) {
      console.warn('Storage set failed:', err);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      if (this.isAvailable()) {
        window.localStorage.removeItem(key);
      }
      this.memoryFallback.delete(key);
    } catch {}
  }

  async clear(): Promise<void> {
    try {
      if (this.isAvailable()) {
        window.localStorage.clear();
      }
      this.memoryFallback.clear();
    } catch {}
  }
}

export const defaultStorage = new LocalStorageProvider();
