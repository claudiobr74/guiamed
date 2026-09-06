export interface CID10Record {
  id: string;
  code: string;                  // Formato canônico: M17.1, K40.0, I10
  codeClean: string;             // Normalizado para pesquisa: M171, K400, I10
  description: string;           // Descrição oficial intocada DATASUS
  abbreviation?: string;         // Descrição abreviada oficial
  normalizedDescription: string; // Minúsculas, sem acento, pontuação normalizada
  searchTerms?: string[];
  active: boolean;
  source: string;                // "CID-10 Brasil / DATASUS"
  version: string;               // Versão oficial DATASUS (ex: "2008")
  classif?: string | null;
  restrBySex?: string | null;
  canCauseDeath?: string | null;
  refer?: string | null;
  excluded?: string[] | null;
}

export interface CID10Version {
  id: string;
  version: string;
  source: string;
  status: 'ATIVA' | 'EM PROCESSAMENTO' | 'VALIDADA' | 'INATIVA' | 'ERRO';
  recordCount: number;
  lastImportDate: string;
  createdAt: string;
  activatedAt?: string;
  errors?: string[];
  validationReport?: {
    totalRead: number;
    validCount: number;
    encodingOk: boolean;
    hasPortugueseAccents: boolean;
    emptyCodes: number;
    emptyDescriptions: number;
    duplicateCount: number;
  };
}

export interface CID10Snapshot {
  code: string;
  description: string;
  source: string;
  version: string;
}

export interface CID10SearchResult {
  record: CID10Record;
  score: number;
}
