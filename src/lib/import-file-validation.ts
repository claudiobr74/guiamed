export const MAX_CODE_IMPORT_FILE_BYTES = 20 * 1024 * 1024;
export const CODE_IMPORT_CHUNK_BYTES = 3 * 1024 * 1024;
export const CODE_IMPORT_SESSION_TTL_MS = 20 * 60 * 1000;
export const MAX_CODE_IMPORT_CHUNKS = Math.ceil(MAX_CODE_IMPORT_FILE_BYTES / CODE_IMPORT_CHUNK_BYTES);

const ALLOWED_CODE_IMPORT_EXTENSIONS = [".csv", ".xlsx", ".json"] as const;

export function validateCodeImportFileMetadata(file: {
  name: string;
  size: number;
}): void {
  const name = file.name.trim().toLowerCase();
  if (!name || !ALLOWED_CODE_IMPORT_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    throw new Error("O arquivo deve ser CSV, XLSX ou JSON.");
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error("O arquivo de tabela está vazio.");
  }
  if (file.size > MAX_CODE_IMPORT_FILE_BYTES) {
    throw new Error("O arquivo de tabela excede o limite de 20 MB.");
  }
}

export function codeImportChunkCount(size: number): number {
  if (!Number.isInteger(size) || size <= 0 || size > MAX_CODE_IMPORT_FILE_BYTES) {
    throw new Error("Tamanho de arquivo inválido para importação.");
  }
  return Math.ceil(size / CODE_IMPORT_CHUNK_BYTES);
}

export function codeImportChunkBounds(
  size: number,
  index: number,
): { start: number; end: number; size: number } {
  const count = codeImportChunkCount(size);
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error("Parte de importação inválida.");
  }
  const start = index * CODE_IMPORT_CHUNK_BYTES;
  const end = Math.min(start + CODE_IMPORT_CHUNK_BYTES, size);
  return { start, end, size: end - start };
}

export function codeImportSessionExpired(expiresAt: string, now = new Date()): boolean {
  const expires = Date.parse(expiresAt);
  return !Number.isFinite(expires) || expires <= now.getTime();
}

export function safeCodeImportFileError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const safePrefixes = [
    "O arquivo ",
    "Planilha ",
    "Não encontramos ",
    "Parte de importação ",
    "Tamanho de arquivo ",
    "Upload da tabela ",
    "Muitas tentativas",
  ];
  if (safePrefixes.some((prefix) => message.startsWith(prefix))) return message;
  if (message.includes("Firebase Storage") || message.includes("Cloud Storage")) {
    return "Não foi possível acessar o armazenamento privado para importar a tabela.";
  }
  return "Não foi possível processar o arquivo. Confira o formato e tente novamente.";
}
