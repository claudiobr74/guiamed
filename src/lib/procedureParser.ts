/**
 * Resilient Medical Procedure Spreadsheet Parser & Column Detector
 * Accurately detects and parses TUSS, CBHPM, AMB, Unimed, and custom Brazilian medical tables.
 */

export interface ParsedProcedure {
  code: string;
  description: string;
  synonym?: string;
  group?: string;
  subgroup?: string;
  defaultQuantity?: number;
  unit?: string;
  observation?: string;
  equivalentCode?: string;
  initialValidity?: string;
  finalValidity?: string;
}

export interface ColumnDetection {
  codeColumn: string;
  descColumn: string;
  synonymColumn?: string;
  groupColumn?: string;
  subgroupColumn?: string;
  qtdColumn?: string;
  unitColumn?: string;
  obsColumn?: string;
  equivColumn?: string;
  initValColumn?: string;
  finalValColumn?: string;
}

export interface ParseResult {
  procedures: ParsedProcedure[];
  detectedColumns: ColumnDetection;
  availableColumns: string[];
  sampleRows: Record<string, any>[];
  totalRows: number;
  validRows: number;
}

export const normalizeHeader = (header: string): string => {
  if (!header) return '';
  return header
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, ''); // Remove punctuation, spaces, underscores
};

// Exact and prefix priority lists for Brazilian medical tables
const EXACT_CODE_NAMES = [
  'codigoprocedimento',
  'cdprocedimento',
  'codprocedimento',
  'codigotuss',
  'cdtuss',
  'codtuss',
  'tuss',
  'codigocbhpm',
  'cdcbhpm',
  'codcbhpm',
  'cbhpm',
  'codigodotermo',
  'cdtermo',
  'codtermo',
  'termocodigo',
  'cdservico',
  'codservico',
  'cdamb',
  'codamb',
  'amb',
  'codigo',
  'cod',
  'cd',
  'idprocedimento',
  'coditem',
  'codigoitem',
  'item'
];

const EXACT_DESC_NAMES = [
  'descricaoprocedimento',
  'dsprocedimento',
  'descricaodotermo',
  'dstermo',
  'nomeprocedimento',
  'descricaotuss',
  'dsitem',
  'dsresumida',
  'dsservico',
  'descricaocbhpm',
  'dsamb',
  'descricao',
  'procedimento',
  'termo',
  'desc',
  'description',
  'nome',
  'titulo',
  'especificacao',
  'texto'
];

const EXACT_SYNONYM_NAMES = [
  'sinonimo',
  'sinonimos',
  'termosinonimo',
  'nomepopular',
  'apelido',
  'outronome',
  'synonym'
];

const EXACT_GROUP_NAMES = [
  'grupo',
  'dsgrupo',
  'cdgrupo',
  'categoria',
  'capitulo',
  'especialidade',
  'group'
];

const EXACT_SUBGROUP_NAMES = [
  'subgrupo',
  'dssubgrupo',
  'cdsubgrupo',
  'subcategoria',
  'subcapitulo',
  'subgroup'
];

const EXACT_QTD_NAMES = [
  'quantidadepadrao',
  'qtdpadrao',
  'qtpadrao',
  'quantidade',
  'qtd',
  'quantity'
];

const EXACT_UNIT_NAMES = [
  'unidademedida',
  'siglaunidade',
  'unidade',
  'unit',
  'un',
  'medida'
];

const EXACT_OBS_NAMES = [
  'observacao',
  'observacoes',
  'obs',
  'instrucoes',
  'orientacoes',
  'regras',
  'observation'
];

const EXACT_EQUIV_NAMES = [
  'codigoequivalente',
  'codequivalente',
  'cdequivalente',
  'codtussanterior',
  'tussanterior',
  'codigoanterior',
  'equivalente'
];

const EXACT_INIT_VAL_NAMES = [
  'vigenciainicial',
  'validadeinicial',
  'iniciovigencia',
  'datainicio',
  'startdate',
  'inicio'
];

const EXACT_FINAL_VAL_NAMES = [
  'vigenciafinal',
  'validadefinal',
  'fimvigencia',
  'datafim',
  'enddate',
  'fim'
];

/**
 * Detect column mappings based on headers AND actual row content heuristics
 */
export function detectColumns(rawRows: any[]): ColumnDetection {
  if (!rawRows || rawRows.length === 0) {
    return { codeColumn: '', descColumn: '' };
  }

  // Find sample rows with keys
  const sampleRows = rawRows.slice(0, 50).filter(r => r && typeof r === 'object');
  const allKeys = Array.from(
    new Set(sampleRows.flatMap(r => Object.keys(r)))
  ).filter(k => k && !k.startsWith('__EMPTY_EMPTY'));

  const keyNormalizedMap: Record<string, string> = {};
  allKeys.forEach(k => {
    keyNormalizedMap[k] = normalizeHeader(k);
  });

  // Helper to match exact or priority header
  const matchHeader = (candidates: string[]): string | undefined => {
    // 1. Exact match normalized
    for (const cand of candidates) {
      const found = allKeys.find(k => keyNormalizedMap[k] === cand);
      if (found) return found;
    }
    // 2. Starts with candidate or candidate starts with key if length >= 4
    for (const cand of candidates) {
      if (cand.length >= 4) {
        const found = allKeys.find(k => {
          const norm = keyNormalizedMap[k];
          return norm.length >= 4 && (norm.startsWith(cand) || cand.startsWith(norm));
        });
        if (found) return found;
      }
    }
    return undefined;
  };

  let codeCol = matchHeader(EXACT_CODE_NAMES);
  let descCol = matchHeader(EXACT_DESC_NAMES);
  const synCol = matchHeader(EXACT_SYNONYM_NAMES);
  const groupCol = matchHeader(EXACT_GROUP_NAMES);
  const subgroupCol = matchHeader(EXACT_SUBGROUP_NAMES);
  const qtdCol = matchHeader(EXACT_QTD_NAMES);
  const unitCol = matchHeader(EXACT_UNIT_NAMES);
  const obsCol = matchHeader(EXACT_OBS_NAMES);
  const equivCol = matchHeader(EXACT_EQUIV_NAMES);
  const initValCol = matchHeader(EXACT_INIT_VAL_NAMES);
  const finalValCol = matchHeader(EXACT_FINAL_VAL_NAMES);

  // Content analysis for each column across sample rows
  const colStats: Record<string, {
    totalNonEmpty: number;
    totalLen: number;
    avgLen: number;
    spacesCount: number;
    digitsOnlyCount: number;
    isNumericCodeCount: number;
  }> = {};

  allKeys.forEach(k => {
    colStats[k] = {
      totalNonEmpty: 0,
      totalLen: 0,
      avgLen: 0,
      spacesCount: 0,
      digitsOnlyCount: 0,
      isNumericCodeCount: 0
    };
  });

  sampleRows.forEach(row => {
    allKeys.forEach(k => {
      const val = row[k];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const str = String(val).trim();
        colStats[k].totalNonEmpty++;
        colStats[k].totalLen += str.length;
        if (str.includes(' ')) colStats[k].spacesCount++;
        // Check if digits or formatted code like 30101012 or 10.10.10-1
        const digitsOnly = str.replace(/[^0-9]/g, '');
        if (digitsOnly.length >= 4 && digitsOnly.length <= 12 && digitsOnly.length === str.replace(/[^0-9a-zA-Z]/g, '').length) {
          colStats[k].isNumericCodeCount++;
        }
        if (/^\d+$/.test(str)) {
          colStats[k].digitsOnlyCount++;
        }
      }
    });
  });

  allKeys.forEach(k => {
    const s = colStats[k];
    s.avgLen = s.totalNonEmpty > 0 ? s.totalLen / s.totalNonEmpty : 0;
  });

  // Verify / Improve Description column:
  // Medical descriptions typically have avg length > 15, lots of spaces and letters
  const sortedByTextRichness = [...allKeys].sort((a, b) => {
    const scoreA = (colStats[a].avgLen * 2) + (colStats[a].spacesCount * 3) - (colStats[a].digitsOnlyCount * 5);
    const scoreB = (colStats[b].avgLen * 2) + (colStats[b].spacesCount * 3) - (colStats[b].digitsOnlyCount * 5);
    return scoreB - scoreA;
  });

  // If detected descCol looks like a pure numeric code (avgLen < 12 and spacesCount == 0 and digitsOnlyCount > 50%), discard it
  if (descCol && colStats[descCol]) {
    const stat = colStats[descCol];
    if (stat.avgLen < 10 && stat.spacesCount === 0 && stat.digitsOnlyCount > stat.totalNonEmpty * 0.7) {
      descCol = undefined;
    }
  }

  if (!descCol && sortedByTextRichness.length > 0) {
    // Pick the top text-rich column that is not codeCol
    descCol = sortedByTextRichness.find(k => k !== codeCol && colStats[k].totalNonEmpty > 0) || sortedByTextRichness[0];
  }

  // Verify / Improve Code column:
  // Codes are typically 4-12 digits/alphanumeric, short length, no spaces
  const sortedByCodeLikelihood = [...allKeys].sort((a, b) => {
    const scoreA = (colStats[a].isNumericCodeCount * 4) + (colStats[a].digitsOnlyCount * 2) - (colStats[a].spacesCount * 3);
    const scoreB = (colStats[b].isNumericCodeCount * 4) + (colStats[b].digitsOnlyCount * 2) - (colStats[b].spacesCount * 3);
    return scoreB - scoreA;
  });

  if (!codeCol || codeCol === descCol) {
    codeCol = sortedByCodeLikelihood.find(k => k !== descCol && colStats[k].totalNonEmpty > 0) || allKeys[0] || '';
  }

  return {
    codeColumn: codeCol || allKeys[0] || '',
    descColumn: descCol || (allKeys.length > 1 ? allKeys[1] : allKeys[0]) || '',
    synonymColumn: synCol,
    groupColumn: groupCol,
    subgroupColumn: subgroupCol,
    qtdColumn: qtdCol,
    unitColumn: unitCol,
    obsColumn: obsCol,
    equivColumn: equivCol,
    initValColumn: initValCol,
    finalValColumn: finalValCol
  };
}

/**
 * Parses raw rows given an explicit or auto-detected column configuration
 */
export function parseProcedureRows(
  rawRows: any[], 
  customMapping?: Partial<ColumnDetection>
): ParseResult {
  if (!rawRows || rawRows.length === 0) {
    return {
      procedures: [],
      detectedColumns: { codeColumn: '', descColumn: '' },
      availableColumns: [],
      sampleRows: [],
      totalRows: 0,
      validRows: 0
    };
  }

  const sampleRows = rawRows.slice(0, 10).filter(r => r && typeof r === 'object');
  const allKeys = Array.from(new Set(sampleRows.flatMap(r => Object.keys(r))));

  const autoDetected = detectColumns(rawRows);
  const mapping: ColumnDetection = {
    codeColumn: customMapping?.codeColumn || autoDetected.codeColumn,
    descColumn: customMapping?.descColumn || autoDetected.descColumn,
    synonymColumn: customMapping?.synonymColumn !== undefined ? customMapping.synonymColumn : autoDetected.synonymColumn,
    groupColumn: customMapping?.groupColumn !== undefined ? customMapping.groupColumn : autoDetected.groupColumn,
    subgroupColumn: customMapping?.subgroupColumn !== undefined ? customMapping.subgroupColumn : autoDetected.subgroupColumn,
    qtdColumn: customMapping?.qtdColumn !== undefined ? customMapping.qtdColumn : autoDetected.qtdColumn,
    unitColumn: customMapping?.unitColumn !== undefined ? customMapping.unitColumn : autoDetected.unitColumn,
    obsColumn: customMapping?.obsColumn !== undefined ? customMapping.obsColumn : autoDetected.obsColumn,
    equivColumn: customMapping?.equivColumn !== undefined ? customMapping.equivColumn : autoDetected.equivColumn,
    initValColumn: customMapping?.initValColumn !== undefined ? customMapping.initValColumn : autoDetected.initValColumn,
    finalValColumn: customMapping?.finalValColumn !== undefined ? customMapping.finalValColumn : autoDetected.finalValColumn
  };

  const procedures: ParsedProcedure[] = [];

  for (const row of rawRows) {
    if (!row || typeof row !== 'object') continue;

    const rawCode = mapping.codeColumn ? row[mapping.codeColumn] : undefined;
    const rawDesc = mapping.descColumn ? row[mapping.descColumn] : undefined;

    // Skip entirely empty row
    if (rawCode === undefined && rawDesc === undefined) continue;

    const codeStr = String(rawCode ?? '').trim();
    const descStr = String(rawDesc ?? '').trim();

    // Skip empty lines or repeated header rows
    if (!codeStr && !descStr) continue;
    const normCode = normalizeHeader(codeStr);
    const normDesc = normalizeHeader(descStr);
    if ((normCode === 'codigo' || normCode === 'cdprocedimento') && (normDesc === 'descricao' || normDesc === 'dsprocedimento' || normDesc === 'termo')) {
      continue;
    }

    const finalCode = codeStr || descStr.substring(0, 20);
    const finalDesc = descStr || codeStr;

    const synonym = mapping.synonymColumn && row[mapping.synonymColumn] ? String(row[mapping.synonymColumn]).trim() : '';
    const group = mapping.groupColumn && row[mapping.groupColumn] ? String(row[mapping.groupColumn]).trim() : '';
    const subgroup = mapping.subgroupColumn && row[mapping.subgroupColumn] ? String(row[mapping.subgroupColumn]).trim() : '';
    const defaultQuantity = mapping.qtdColumn && row[mapping.qtdColumn] ? Number(row[mapping.qtdColumn]) || 1 : 1;
    const unit = mapping.unitColumn && row[mapping.unitColumn] ? String(row[mapping.unitColumn]).trim() : '';
    const observation = mapping.obsColumn && row[mapping.obsColumn] ? String(row[mapping.obsColumn]).trim() : '';
    const equivalentCode = mapping.equivColumn && row[mapping.equivColumn] ? String(row[mapping.equivColumn]).trim() : '';
    const initialValidity = mapping.initValColumn && row[mapping.initValColumn] ? String(row[mapping.initValColumn]).trim() : '';
    const finalValidity = mapping.finalValColumn && row[mapping.finalValColumn] ? String(row[mapping.finalValColumn]).trim() : '';

    procedures.push({
      code: finalCode,
      description: finalDesc,
      synonym: synonym || undefined,
      group: group || undefined,
      subgroup: subgroup || undefined,
      defaultQuantity: defaultQuantity > 0 ? defaultQuantity : 1,
      unit: unit || undefined,
      observation: observation || undefined,
      equivalentCode: equivalentCode || undefined,
      initialValidity: initialValidity || undefined,
      finalValidity: finalValidity || undefined
    });
  }

  return {
    procedures,
    detectedColumns: mapping,
    availableColumns: allKeys,
    sampleRows: sampleRows.slice(0, 5),
    totalRows: rawRows.length,
    validRows: procedures.length
  };
}
