// safe-storage.ts
// Universal storage adapter that safely wraps localStorage and falls back to an
// in-memory store if localStorage is blocked (e.g., cross-origin iframes, private browsing).

class MemoryStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

class SafeStorage implements Storage {
  private fallback: MemoryStorage = new MemoryStorage();

  private isLocalStorageAvailable(): boolean {
    try {
      if (typeof window === "undefined" || !window.localStorage) return false;
      const testKey = "__mugla_storage_probe__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  get length(): number {
    try {
      if (this.isLocalStorageAvailable()) return window.localStorage.length;
    } catch {
      // fallback
    }
    return this.fallback.length;
  }

  clear(): void {
    try {
      if (this.isLocalStorageAvailable()) {
        window.localStorage.clear();
      }
    } catch {
      // ignore
    }
    this.fallback.clear();
  }

  getItem(key: string): string | null {
    try {
      if (this.isLocalStorageAvailable()) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // ignore security / access errors
    }
    return this.fallback.getItem(key);
  }

  key(index: number): string | null {
    try {
      if (this.isLocalStorageAvailable()) {
        return window.localStorage.key(index);
      }
    } catch {
      // ignore
    }
    return this.fallback.key(index);
  }

  removeItem(key: string): void {
    try {
      if (this.isLocalStorageAvailable()) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
    this.fallback.removeItem(key);
  }

  setItem(key: string, value: string): void {
    const strVal = String(value);
    try {
      if (this.isLocalStorageAvailable()) {
        window.localStorage.setItem(key, strVal);
      }
    } catch {
      // ignore quota or security error
    }
    this.fallback.setItem(key, strVal);
  }
}

export const safeStorage = new SafeStorage();
export default safeStorage;
