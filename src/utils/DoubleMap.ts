/**
 * The DoubleMap is a Map that contains both forward and reverse mappings between keys and values.
 * This allows the DoubleMap to easily provide a list of unique values,
 * because each value in the internal forwardMap will be a key in the reverseMap.
 * The reported size of a DoubleMap is the number of unique values,
 * which is the number of keys in the reverseMap.
 *
 * Note that because DoubleMap.values() returns the keys from reverseMap,
 * it may contain fewer elements than the other functions: keys(), entries(), forEach(), and the for-of iterator.
 */
export class DoubleMap<K, V> implements Map<K, V> {
  private forwardMap: Map<K, V>;
  private reverseMap: Map<V, Set<K>>;

  constructor() {
    this.forwardMap = new Map();
    this.reverseMap = new Map();
  }

  set(key: K, value: V): this {
    if (this.forwardMap.get(key) === value) {
      return this;
    }
    this.delete(key);
    this.forwardMap.set(key, value);
    if (this.reverseMap.has(value)) {
      this.reverseMap.get(value).add(key);
    } else {
      this.reverseMap.set(value, new Set([key]));
    }
    return this;
  }

  delete(key: K): boolean {
    if (this.forwardMap.has(key)) {
      const currentValue = this.forwardMap.get(key);
      const currentKeys = this.reverseMap.get(currentValue);
      currentKeys.delete(key);
      if (currentKeys.size === 0) {
        this.reverseMap.delete(currentValue);
      }
      this.forwardMap.delete(key);
      return true;
    } else {
      return false;
    }
  }

  get(key: K): V {
    return this.forwardMap.get(key);
  }

  get size(): number {
    return this.reverseMap.size;
  }

  clear(): void {
    this.forwardMap.clear();
    this.reverseMap.clear();
  }

  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
    this.forwardMap.forEach(callbackfn, thisArg);
  }

  has(key: K): boolean {
    return this.forwardMap.has(key);
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }

  entries(): IterableIterator<[K, V]> {
    return this.forwardMap.entries();
  }

  keys(): IterableIterator<K> {
    return this.forwardMap.keys();
  }

  values(): IterableIterator<V> {
    return this.reverseMap.keys();
  }

  [Symbol.toStringTag]: string;
}
