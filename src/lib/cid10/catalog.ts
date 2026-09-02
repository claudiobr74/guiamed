import catalogFile from "@/data/cid10-br-v2008.json";
import type { CidCode, RequestCid } from "@/types/domain";

type CidClassification = "+" | "*" | null;
type CidSexRestriction = "F" | "M" | null;
type CatalogRow = [
  code: string,
  description: string,
  classification: CidClassification,
  sexRestriction: CidSexRestriction,
  unlikelyCauseOfDeath: boolean,
  reference: string | null,
  excluded: string | null,
];

interface CatalogFile {
  metadata: {
    name: string;
    version: string;
    sourceOrganization: string;
    sourceUrl: string;
    sourceFile: string;
    sourceArchiveSha256: string;
    sourceFileSha256: string;
    recordCount: number;
  };
  codes: CatalogRow[];
}

interface SearchableCid extends CidCode {
  compactCode: string;
  normalizedDescription: string;
}

const data = catalogFile as CatalogFile;

export const CID10_METADATA = Object.freeze({ ...data.metadata });

function compactCidCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CATALOG: SearchableCid[] = data.codes.map(
  ([code, description, classification, sexRestriction, unlikelyCauseOfDeath, reference, excluded]) => ({
    id: compactCidCode(code),
    code,
    description,
    version: data.metadata.version,
    active: true,
    classification,
    sexRestriction,
    unlikelyCauseOfDeath,
    reference,
    excluded,
    compactCode: compactCidCode(code),
    normalizedDescription: normalizeText(description),
  }),
);

if (CATALOG.length !== data.metadata.recordCount) {
  throw new Error("Catálogo CID-10 inconsistente: total de registros diverge dos metadados.");
}

const BY_CODE = new Map(CATALOG.map((cid) => [cid.compactCode, cid]));

function publicCid(cid: SearchableCid): CidCode {
  return {
    id: cid.id,
    code: cid.code,
    description: cid.description,
    version: cid.version,
    active: cid.active,
    classification: cid.classification,
    sexRestriction: cid.sexRestriction,
    unlikelyCauseOfDeath: cid.unlikelyCauseOfDeath,
    reference: cid.reference,
    excluded: cid.excluded,
  };
}

export function getCid10ByCode(code: string): CidCode | null {
  const cid = BY_CODE.get(compactCidCode(code));
  return cid ? publicCid(cid) : null;
}

export function searchCid10(query: string, limit = 20): CidCode[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  const compactQuery = compactCidCode(query);
  const looksLikeCode = /^[A-Z][0-9]{0,3}$/.test(compactQuery);
  const terms = normalizedQuery.split(" ").filter(Boolean);
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);

  return CATALOG.flatMap((cid) => {
    const codeMatches = looksLikeCode && cid.compactCode.includes(compactQuery);
    const descriptionMatches = terms.every((term) => cid.normalizedDescription.includes(term));
    if (!codeMatches && !descriptionMatches) return [];

    let score = 5;
    if (cid.compactCode === compactQuery) score = 0;
    else if (looksLikeCode && cid.compactCode.startsWith(compactQuery)) score = 1;
    else if (cid.normalizedDescription === normalizedQuery) score = 2;
    else if (cid.normalizedDescription.startsWith(normalizedQuery)) score = 3;
    else if (cid.normalizedDescription.includes(normalizedQuery)) score = 4;

    return [{ cid, score }];
  })
    .sort((a, b) => a.score - b.score || a.cid.code.localeCompare(b.cid.code, "pt-BR"))
    .slice(0, safeLimit)
    .map(({ cid }) => publicCid(cid));
}

export function normalizeRequestCids(cids: RequestCid[], requestId: string): RequestCid[] {
  const seen = new Set<string>();
  return cids.map((selected, index) => {
    const cid = getCid10ByCode(selected.codeSnapshot);
    if (!cid) {
      const informed = selected.codeSnapshot.trim() || "vazio";
      throw new Error(`Código CID-10 ${informed} não localizado na base oficial DATASUS V2008.`);
    }
    if (seen.has(cid.id)) {
      throw new Error(`O código CID-10 ${cid.code} foi selecionado mais de uma vez.`);
    }
    seen.add(cid.id);
    return {
      ...selected,
      requestId,
      cidCodeId: cid.id,
      codeSnapshot: cid.code,
      descriptionSnapshot: cid.description,
      sortOrder: index,
    };
  });
}
