export const SEARCH_INDEX_VERSION = 1;

const MIN_PREFIX_LENGTH = 2;
const MAX_PREFIX_LENGTH = 24;
const MAX_PREFIXES = 280;
const MAX_QUERY_TERMS = 10;

export interface SearchIndexFields {
  searchIndexVersion: number;
  searchText: string;
  searchPrefixes: string[];
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function prefixesForTerm(term: string): string[] {
  if (term.length < MIN_PREFIX_LENGTH) return [];
  const limit = Math.min(term.length, MAX_PREFIX_LENGTH);
  const prefixes: string[] = [];
  for (let length = MIN_PREFIX_LENGTH; length <= limit; length += 1) {
    prefixes.push(term.slice(0, length));
  }
  return prefixes;
}

export function buildSearchIndex(values: readonly (string | null | undefined)[]): SearchIndexFields {
  const normalizedValues = values
    .map((value) => normalizeSearchText(String(value ?? "")))
    .filter(Boolean);
  const compactValues = values
    .map((value) => compactSearchText(String(value ?? "")))
    .filter((value) => value.length >= MIN_PREFIX_LENGTH);

  const terms = new Set<string>();
  for (const value of normalizedValues) {
    for (const term of value.split(" ")) {
      if (term.length >= MIN_PREFIX_LENGTH) terms.add(term);
    }
  }
  for (const compact of compactValues) terms.add(compact);

  const prefixes = new Set<string>();
  for (const term of terms) {
    for (const prefix of prefixesForTerm(term)) {
      prefixes.add(prefix);
      if (prefixes.size >= MAX_PREFIXES) break;
    }
    if (prefixes.size >= MAX_PREFIXES) break;
  }

  const searchText = [...new Set([...normalizedValues, ...compactValues])].join(" | ");
  return {
    searchIndexVersion: SEARCH_INDEX_VERSION,
    searchText,
    searchPrefixes: [...prefixes],
  };
}

export function searchCandidatePrefixes(query: string): string[] {
  const normalized = normalizeSearchText(query);
  const terms = normalized
    .split(" ")
    .filter((term) => term.length >= MIN_PREFIX_LENGTH)
    .map((term) => term.slice(0, MAX_PREFIX_LENGTH));
  const compact = compactSearchText(query);
  if (compact.length >= MIN_PREFIX_LENGTH && !terms.includes(compact)) {
    terms.push(compact.slice(0, MAX_PREFIX_LENGTH));
  }
  return [...new Set(terms)].slice(0, MAX_QUERY_TERMS);
}

export function matchesIndexedSearch(searchText: string, query: string): boolean {
  const normalized = normalizeSearchText(query);
  if (!normalized) return false;
  const haystack = normalizeSearchText(searchText);
  const terms = normalized.split(" ").filter(Boolean);
  if (terms.every((term) => haystack.includes(term))) return true;
  const compactQuery = compactSearchText(query);
  return compactQuery.length >= MIN_PREFIX_LENGTH && haystack.replace(/\s+/g, "").includes(compactQuery);
}

export function searchRank(primaryText: string, searchText: string, query: string): number {
  const normalizedPrimary = normalizeSearchText(primaryText);
  const normalizedQuery = normalizeSearchText(query);
  const compactPrimary = compactSearchText(primaryText);
  const compactQuery = compactSearchText(query);

  if (normalizedPrimary === normalizedQuery || compactPrimary === compactQuery) return 0;
  if (normalizedPrimary.startsWith(normalizedQuery) || compactPrimary.startsWith(compactQuery)) return 1;
  if (normalizedPrimary.includes(normalizedQuery) || compactPrimary.includes(compactQuery)) return 2;
  if (matchesIndexedSearch(searchText, query)) return 3;
  return 9;
}
