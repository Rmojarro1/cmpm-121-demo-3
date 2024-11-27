import { Coin } from "./Coin.ts";
import { CacheBounds } from "./CacheBounds.ts";
import { Cell } from "./Cell.ts";

export class MyCache {
  coins: Coin[];
  position: Cell;
  bounds: CacheBounds;

  constructor(position: Cell, bounds: CacheBounds) {
    this.position = position;
    this.bounds = bounds;
    this.coins = [];
  }

  addCoin(coin: Coin): void {
    this.coins.push(coin);
  }

  removeCoin(coin: Coin): boolean {
    const index = this.coins.findIndex((c) =>
      c.serial === coin.serial &&
      c.cell.i === coin.cell.i &&
      c.cell.j === coin.cell.j
    );
    if (index >= 0) {
      this.coins.splice(index, 1);
      return true;
    }
    return false;
  }

  coinCount(): number {
    return this.coins.length;
  }

  positionToString(): string {
    return `${this.position.i},${this.position.j}`;
  }
}
