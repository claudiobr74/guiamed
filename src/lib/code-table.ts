const MAX_TABLE_NAME_LENGTH = 80;

export function normalizeCodeTableName(value: unknown): string {
  const name = String(value ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2) throw new Error("Informe um nome para identificar a tabela TUSS.");
  if (name.length > MAX_TABLE_NAME_LENGTH) {
    throw new Error(`O nome da tabela TUSS deve ter no máximo ${MAX_TABLE_NAME_LENGTH} caracteres.`);
  }
  if (/[\u0000-\u001f\u007f]/.test(name)) throw new Error("O nome da tabela TUSS contém caracteres inválidos.");
  return name;
}

export function codeTableKey(value: unknown): string {
  const name = normalizeCodeTableName(value);
  const key = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!key) throw new Error("Não foi possível identificar a tabela TUSS.");
  return key;
}

export function procedureCodeDocumentId(input: {
  codeSystem: string;
  code: string;
  version: string;
  tableKey?: string | null;
}): string {
  const parts = [
    input.codeSystem.trim().toUpperCase(),
    input.tableKey?.trim() || null,
    input.code.trim(),
    input.version.trim(),
  ].filter(Boolean);
  return parts.join("_").replace(/[^\w.-]+/g, "_");
}
