import { MyCache } from "./MyCache.ts";
import { Cell } from "./Cell.ts";

export class CacheManager {
  private caches: Map<string, MyCache> = new Map();

  addCache(cache: MyCache): void {
    const key = `${cache.position.i},${cache.position.j}`;
    this.caches.set(key, cache);
  }

  getCache(position: Cell): MyCache | undefined {
    return this.caches.get(`${position.i},${position.j}`);
  }

  getAllCaches(): MyCache[] {
    return Array.from(this.caches.values());
  }

  removeCache(position: Cell): void {
    this.caches.delete(`${position.i},${position.j}`);
  }
}
