/**
 * Simple async Mutex implementation
 * Ensures only one operation can hold the lock at a time
 */

export class Mutex {
  private locked = false;
  private waitQueue: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    // Wait in queue
    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      // Pass lock to next waiter
      const next = this.waitQueue.shift();
      next?.();
    } else {
      this.locked = false;
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  isLocked(): boolean {
    return this.locked;
  }
}

/**
 * Per-entity mutex manager
 * Creates and manages mutexes for individual entities (matches, users, etc.)
 */
export class MutexManager<K = string> {
  private mutexes = new Map<K, Mutex>();

  get(key: K): Mutex {
    let mutex = this.mutexes.get(key);
    if (!mutex) {
      mutex = new Mutex();
      this.mutexes.set(key, mutex);
    }
    return mutex;
  }

  async withLock<T>(key: K, fn: () => Promise<T>): Promise<T> {
    return this.get(key).withLock(fn);
  }

  // Clean up mutex if no longer needed (optional, for memory management)
  delete(key: K): void {
    const mutex = this.mutexes.get(key);
    if (mutex && !mutex.isLocked()) {
      this.mutexes.delete(key);
    }
  }

  size(): number {
    return this.mutexes.size;
  }
}
