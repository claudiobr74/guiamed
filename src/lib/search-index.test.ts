import { describe, expect, it } from "vitest";
import {
  SEARCH_INDEX_VERSION,
  buildSearchIndex,
  matchesIndexedSearch,
  normalizeSearchText,
  searchCandidatePrefixes,
  searchRank,
} from "@/lib/search-index";

describe("search index", () => {
  it("normaliza acentos, pontuação e caixa sem perder números", () => {
    expect(normalizeSearchText("João D'Ávila — CPF 123.456.789-00")).toBe(
      "joao d avila cpf 123 456 789 00",
    );
  });

  it("gera prefixos pesquisáveis por qualquer termo e por valor compacto", () => {
    const index = buildSearchIndex(["Colecistectomia Videolaparoscópica", "40101010"]);
    expect(index.searchIndexVersion).toBe(SEARCH_INDEX_VERSION);
    expect(index.searchPrefixes).toContain("cole");
    expect(index.searchPrefixes).toContain("videolap");
    expect(index.searchPrefixes).toContain("40101010");
    expect(matchesIndexedSearch(index.searchText, "videolaparoscopica")).toBe(true);
    expect(matchesIndexedSearch(index.searchText, "40101010")).toBe(true);
  });

  it("transforma pesquisa composta em poucos candidatos para array-contains-any", () => {
    expect(searchCandidatePrefixes("Hérnia inguinal bilateral")).toEqual([
      "hernia",
      "inguinal",
      "bilateral",
      "herniainguinalbilateral",
    ]);
  });

  it("mantém busca de CPF com ou sem pontuação", () => {
    const index = buildSearchIndex(["Maria Silva", "123.456.789-00"]);
    expect(index.searchPrefixes).toContain("12345678900");
    expect(matchesIndexedSearch(index.searchText, "12345678900")).toBe(true);
    expect(matchesIndexedSearch(index.searchText, "123.456")).toBe(true);
  });

  it("prioriza correspondência exata e prefixo do nome", () => {
    const index = buildSearchIndex(["Artroplastia total do joelho", "procedimento ortopédico"]);
    expect(searchRank("Artroplastia", index.searchText, "Artroplastia")).toBe(0);
    expect(searchRank("Artroplastia total do joelho", index.searchText, "Artro")).toBe(1);
    expect(searchRank("Procedimento", index.searchText, "ortopedico")).toBe(3);
  });
});
