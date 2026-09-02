export class OverflowError extends Error {
  readonly maxRows: number;
  readonly selected: number;

  constructor(maxRows: number, selected: number) {
    super(
      `Este template suporta até ${maxRows} procedimentos. Foram selecionados ${selected}.`,
    );
    this.name = "OverflowError";
    this.maxRows = maxRows;
    this.selected = selected;
  }
}

export function assertProcedureOverflow(selected: number, maxRows: number | null): void {
  if (maxRows === null) return;
  if (selected > maxRows) {
    throw new OverflowError(maxRows, selected);
  }
}

export function maxRowsFromRepeaters(repeaters: { maxRows: number }[]): number | null {
  if (repeaters.length === 0) return null;
  return Math.max(...repeaters.map((r) => r.maxRows));
}
