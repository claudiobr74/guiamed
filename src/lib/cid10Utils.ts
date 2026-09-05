import { CID10Record } from '../types/cid10';

/**
 * Normaliza o texto de pesquisa:
 * - Converte para minúsculas
 * - Remove acentos
 * - Remove espaços duplicados
 * - Normaliza pontuação
 * - Preserva texto original separadamente
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos/acentos
    .replace(/[^\w\s]/g, ' ')        // normaliza pontuação para espaço
    .replace(/\s+/g, ' ')           // remove espaços duplicados
    .trim();
}

/**
 * Converte código em formato canônico:
 * Exemplos: K40.0, M17.1, I10, C50.9
 */
export function toCanonicalCode(raw: string): string {
  if (!raw) return '';
  const clean = raw.trim().toUpperCase();
  if (clean.includes('.')) return clean;
  // Subcategorias oficiais DATASUS com 4 caracteres: ex: M171 -> M17.1
  if (clean.length === 4 && /^[A-Z][0-9]{3}$/.test(clean)) {
    return clean.slice(0, 3) + '.' + clean.slice(3);
  }
  return clean;
}

/**
 * Normaliza código para busca sem ponto:
 * Exemplos: M17.1 -> M171, K40.0 -> K400, I10 -> I10
 */
export function toCleanCode(code: string): string {
  if (!code) return '';
  return code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Calcula a relevância (score) de um registro CID-10 para a pesquisa informada:
 * Prioridade:
 * 1. Correspondência exata do código (ex: M17.1 -> 10000)
 * 2. Código iniciado pelo texto informado (ex: M17 -> ~8000)
 * 3. Descrição iniciada pelo texto informado (ex: "gonar" -> 6000)
 * 4. Palavras correspondentes na descrição (ex: "artrose" -> 4000)
 * 5. Demais resultados relevantes (substring na descrição -> 2000)
 */
export function scoreCIDMatch(record: CID10Record, query: string): number {
  if (!query || !query.trim()) return 0;

  const rawQ = query.trim();
  const cleanQ = toCleanCode(rawQ);
  const normQ = normalizeSearchText(rawQ);
  const words = normQ.split(' ').filter(Boolean);

  // 1. Correspondência exata do código
  if (
    record.code.toUpperCase() === rawQ.toUpperCase() ||
    record.codeClean === cleanQ
  ) {
    return 10000;
  }

  // 2. Código iniciado pelo texto informado (com ou sem ponto)
  if (
    (cleanQ.length >= 2 && record.codeClean.startsWith(cleanQ)) ||
    (rawQ.length >= 2 && record.code.toUpperCase().startsWith(rawQ.toUpperCase()))
  ) {
    // Dá prioridade aos códigos com tamanho mais próximo do digitado
    const lenDiff = record.codeClean.length - cleanQ.length;
    return 8000 - Math.max(0, lenDiff * 10);
  }

  // Se a busca for puramente alfanumérica curta (ex: 3 caracteres como "M17"),
  // e não casou no prefixo de código acima, não precisa pontuar descrição agora se o usuário quis código.
  // 3. Descrição iniciada pelo texto informado
  if (normQ.length >= 2 && record.normalizedDescription.startsWith(normQ)) {
    return 6000;
  }

  // 4. Palavras correspondentes na descrição
  if (words.length > 0) {
    let allWordsMatch = true;
    let startsWithWord = false;

    for (const w of words) {
      const idx = record.normalizedDescription.indexOf(w);
      if (idx === -1) {
        allWordsMatch = false;
        break;
      }
      // Verifica se é início de palavra
      if (idx === 0 || record.normalizedDescription[idx - 1] === ' ') {
        startsWithWord = true;
      }
    }

    if (allWordsMatch) {
      return startsWithWord ? 4000 : 3000;
    }
  }

  // 5. Demais resultados relevantes (substring contida)
  if (normQ.length >= 3 && record.normalizedDescription.includes(normQ)) {
    return 2000;
  }

  return 0;
}
