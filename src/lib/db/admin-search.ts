import type { DocumentData } from "firebase-admin/firestore";
import type { Db } from "@/lib/db/client";
import { orgCollection } from "@/lib/db/client";
import type { HealthInsurer, Institution, InstitutionKind } from "@/types/domain";

const RESULT_LIMIT = 20;

function prefixVariants(value: string): string[] {
  const query = value.trim();
  if (!query) return [];
  const variants = new Set<string>([
    query,
    query.toLocaleLowerCase("pt-BR"),
    query.toLocaleUpperCase("pt-BR"),
    `${query.charAt(0).toLocaleUpperCase("pt-BR")}${query.slice(1).toLocaleLowerCase("pt-BR")}`,
  ]);
  return [...variants].filter(Boolean);
}

async function searchNamed<T>(
  db: Db,
  orgId: string,
  collectionName: string,
  query: string,
  mapper: (id: string, data: DocumentData) => T,
): Promise<T[]> {
  const variants = prefixVariants(query);
  if (variants.length === 0) return [];

  const snapshots = await Promise.all(
    variants.map((prefix) =>
      orgCollection(db, orgId, collectionName)
        .orderBy("name")
        .startAt(prefix)
        .endAt(`${prefix}\uf8ff`)
        .limit(RESULT_LIMIT)
        .get(),
    ),
  );

  const byId = new Map<string, T>();
  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) {
      if (!byId.has(doc.id)) byId.set(doc.id, mapper(doc.id, doc.data()));
    }
  }
  return [...byId.values()].slice(0, RESULT_LIMIT);
}

export async function searchInstitutionsByName(
  db: Db,
  orgId: string,
  query: string,
): Promise<Institution[]> {
  const results = await searchNamed(db, orgId, "institutions", query, (id, data) => ({
    id,
    organizationId: orgId,
    kind: data.kind as InstitutionKind,
    name: String(data.name ?? ""),
    cnpj: (data.cnpj as string | null) ?? null,
    city: (data.city as string | null) ?? null,
    state: (data.state as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    active: data.active !== false,
  }));
  return results
    .filter((institution) => institution.active)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function searchInsurersByName(
  db: Db,
  orgId: string,
  query: string,
): Promise<HealthInsurer[]> {
  const results = await searchNamed(db, orgId, "healthInsurers", query, (id, data) => ({
    id,
    organizationId: orgId,
    name: String(data.name ?? ""),
    code: (data.code as string | null) ?? null,
    active: data.active !== false,
  }));
  return results
    .filter((insurer) => insurer.active)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
