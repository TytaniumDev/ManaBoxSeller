/**
 * A small Map-like cache (has/get/set) that is also saved to localStorage,
 * so answers survive page reloads. Entries older than `maxAgeMs` are dropped
 * when the cache loads. If storage is unavailable (private browsing, blocked
 * site data), it quietly works as an in-memory cache.
 */
export class StoredCache {
  /**
   * @param {string} storageKey
   * @param {number} maxAgeMs
   * @param {Pick<Storage, 'getItem' | 'setItem'>} [storage] injectable for tests
   */
  constructor(storageKey, maxAgeMs, storage = globalThis.localStorage) {
    this.storageKey = storageKey;
    this.storage = storage;
    this.saveQueued = false;
    /** @type {Map<string, { at: number, value: unknown }>} */
    this.entries = new Map();

    const now = Date.now();
    for (const [key, entry] of Object.entries(this.#load())) {
      if (now - entry.at < maxAgeMs) this.entries.set(key, entry);
    }
  }

  /** @param {string} key */
  has(key) {
    return this.entries.has(key);
  }

  /** @param {string} key */
  get(key) {
    return this.entries.get(key)?.value;
  }

  /**
   * @param {string} key
   * @param {unknown} value must be JSON-serialisable
   */
  set(key, value) {
    this.entries.set(key, { at: Date.now(), value });
    // Many keys are usually set in a row; write once after they're done.
    if (!this.saveQueued) {
      this.saveQueued = true;
      queueMicrotask(() => {
        this.saveQueued = false;
        this.#save();
      });
    }
    return this;
  }

  #load() {
    try {
      return JSON.parse(this.storage?.getItem(this.storageKey) ?? '{}');
    } catch {
      return {};
    }
  }

  #save() {
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(Object.fromEntries(this.entries)));
    } catch {
      // Storage full or blocked: keep working from memory.
    }
  }
}
