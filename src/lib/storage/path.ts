export const STORAGE_BUCKETS = [
  "pdf-templates",
  "generated-documents",
  "signatures",
] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

function isStorageBucket(value: string): value is StorageBucket {
  return STORAGE_BUCKETS.some((bucket) => bucket === value);
}

function isSafeSegment(value: string): boolean {
  return (
    Boolean(value) &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

export function safeStorageFilename(filename: string): string {
  const value = filename.trim();
  if (!isSafeSegment(value)) {
    throw new Error("Nome de arquivo inválido.");
  }
  return value;
}

export function buildStoragePath(
  bucket: StorageBucket,
  organizationId: string,
  filename: string,
): string {
  if (!isSafeSegment(organizationId)) {
    throw new Error("Organização inválida para armazenamento.");
  }
  return [bucket, organizationId, safeStorageFilename(filename)].join("/");
}

/**
 * URL interna para leitura autenticada. Nunca exponha a URL direta do storage
 * para documentos clínicos; a rota /api/files revalida sessão, tenant e vínculo.
 */
export function authenticatedFileUrl(filePath: string): string {
  const segments = filePath.split("/");
  if (segments.length < 3 || segments.some((segment) => !isSafeSegment(segment))) {
    throw new Error("Caminho de arquivo inválido.");
  }
  return `/api/files/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

/**
 * Autoriza apenas bucket/{organizationId}/objeto, comparando o segmento
 * completo da organização. Não usa correspondência parcial por substring.
 */
export function authorizedStoragePath(
  pathSegments: readonly string[],
  organizationId: string,
): string | null {
  if (pathSegments.length < 3 || !isSafeSegment(organizationId)) return null;
  const [bucket, pathOrganizationId, ...objectSegments] = pathSegments;
  if (
    !bucket ||
    !isStorageBucket(bucket) ||
    pathOrganizationId !== organizationId ||
    objectSegments.length === 0 ||
    objectSegments.some((segment) => !isSafeSegment(segment))
  ) {
    return null;
  }
  return [bucket, pathOrganizationId, ...objectSegments].join("/");
}

export function requireAuthorizedStoragePath(
  filePath: string,
  organizationId: string,
): string {
  const authorized = authorizedStoragePath(filePath.split("/"), organizationId);
  if (!authorized) {
    throw new Error("Acesso negado ao arquivo.");
  }
  return authorized;
}
