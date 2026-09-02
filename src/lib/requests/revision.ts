export class RequestChangedError extends Error {
  readonly code = "REQUEST_CHANGED";

  constructor() {
    super("A guia foi alterada desde o último salvamento. Recarregue e revise os dados antes de continuar.");
    this.name = "RequestChangedError";
  }
}

export function nextRequestRevision(expected: number, current: unknown): number {
  const normalizedCurrent = Number(current ?? 0);
  if (!Number.isInteger(expected) || expected < 0 || normalizedCurrent !== expected) {
    throw new RequestChangedError();
  }
  return expected + 1;
}
