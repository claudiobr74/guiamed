export const MAX_CODE_IMPORT_FILE_BYTES = 3 * 1024 * 1024;

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
    throw new Error(
      "O arquivo de tabela excede 3 MB, limite seguro do upload atual. Use um arquivo menor antes de importar.",
    );
  }
}

export function safeCodeImportFileError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const safePrefixes = [
    "O arquivo ",
    "Planilha ",
    "Não encontramos ",
    "Muitas tentativas",
  ];
  if (safePrefixes.some((prefix) => message.startsWith(prefix))) return message;
  return "Não foi possível processar o arquivo. Confira o formato e tente novamente.";
}
