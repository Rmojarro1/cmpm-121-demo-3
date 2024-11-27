import { MyCache } from "./MyCache.ts";
import { Coin } from "./Coin.ts";
import { CacheBounds } from "./CacheBounds.ts";
import { Cell } from "./Cell.ts";

export class CacheMemento {
  static toMemento(cache: MyCache): string {
    const mementoData = {
      position: cache.position,
      coins: cache.coins
        .filter((coin) => coin)
        .map((coin) => ({
          serial: coin.serial,
          cell: coin.cell,
        })),
    };
    return JSON.stringify(mementoData);
  }

  static fromMemento(memento: string, bounds: CacheBounds): MyCache {
    const parsed = JSON.parse(memento);
    const cache = new MyCache(parsed.position as Cell, bounds);
    cache.coins = parsed.coins.map(
      (coinData: { serial: number; cell: Cell }) =>
        new Coin(coinData.serial, coinData.cell),
    );
    return cache;
  }
}
