export class Coin {
  serial: number;
  cell: { i: number; j: number };

  constructor(serial: number, cell: { i: number; j: number }) {
    this.serial = serial;
    this.cell = cell;
  }

  toString(): string {
    return `Coin ${this.serial} at (${this.cell.i}, ${this.cell.j})`;
  }
}
