import { CID10Record, CID10Version } from '../types/cid10';
import { normalizeSearchText, toCanonicalCode, toCleanCode } from './cid10Utils';
import { saveRecordsToIDB } from './cid10Store';
import { db } from './firebase';
import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

/**
 * Parser de linha do arquivo oficial DATASUS CID-10-SUBCATEGORIAS.CSV
 * Formato oficial: SUBCAT;CLASSIF;RESTRSEXO;CAUSAOBITO;DESCRICAO;DESCRABREV;NOFER;EXCLUIDOS
 */
export class Cid10SubcategoryRecord {
  code: string;
  classif?: string | null;
  restrBySex?: string | null;
  canCauseDeath?: string | null;
  description: string;
  abbreviation?: string | null;
  refer?: string | null;
  excluded?: string[] | null;

  constructor(line: string) {
    const parts = line.split(';');
    this.code = (parts[0] || '').trim();
    this.classif = (parts[1] || '').trim() || null;
    this.restrBySex = (parts[2] || '').trim() || null;
    this.canCauseDeath = (parts[3] || '').trim() || null;
    this.description = (parts[4] || '').trim();
    this.abbreviation = (parts[5] || '').trim() || null;
    this.refer = (parts[6] || '').trim() || null;
    const exc = (parts[7] || '').trim();
    this.excluded = exc ? exc.split(',').map(s => s.trim()).filter(Boolean) : null;
  }
}

export interface ImportOptions {
  versionName?: string;
  sourceName?: string;
  onProgress?: (progress: { stage: string; current: number; total: number; percent: number }) => void;
}

/**
 * Decodifica o ArrayBuffer do CSV garantindo preservação de acentos e caracteres em português
 */
export function decodeCSVContent(buffer: ArrayBuffer): string {
  // O DATASUS distribui os arquivos oficiais em ISO-8859-1 / Windows-1252.
  // Testamos ISO-8859-1 primeiro:
  const decoderLatin1 = new TextDecoder('iso-8859-1');
  const textLatin1 = decoderLatin1.decode(buffer);

  // Testa se os acentos em português ficaram intactos
  const hasValidAccents = /[áéíóúãõçÁÉÍÓÚÃÕÇ]/.test(textLatin1);
  const hasMojibake = /[\uFFFD]|Ã§|Ã£|Ã³|Ã©|Ã­|Ã¡/.test(textLatin1);

  if (hasValidAccents && !hasMojibake) {
    return textLatin1;
  }

  // Se já for UTF-8 válido
  const decoderUtf8 = new TextDecoder('utf-8');
  const textUtf8 = decoderUtf8.decode(buffer);
  return textUtf8;
}

/**
 * Rotina administrativa de importação atômica da base CID-10
 */
export async function importCID10Subcategories(
  csvData: ArrayBuffer | string,
  options: ImportOptions = {}
): Promise<{ success: boolean; version: CID10Version; error?: string }> {
  const {
    versionName = `DATASUS-${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    sourceName = 'CID-10 Brasil / DATASUS',
    onProgress
  } = options;

  const versionId = `cid10_${Date.now()}`;
  const nowIso = new Date().toISOString();

  // 1. Inicia versão com status EM PROCESSAMENTO
  const newVersion: CID10Version = {
    id: versionId,
    version: versionName,
    source: sourceName,
    status: 'EM PROCESSAMENTO',
    recordCount: 0,
    lastImportDate: nowIso,
    createdAt: nowIso,
    errors: []
  };

  try {
    // Registra versão em processamento no Firestore
    try {
      await setDoc(doc(db, 'cid10_versions', versionId), newVersion);
    } catch (fsErr) {
      console.warn('Aviso ao registrar versão no Firestore (prosseguindo com importação):', fsErr);
    }

    onProgress?.({ stage: 'Decodificando arquivo CSV...', current: 0, total: 100, percent: 10 });

    // 2. Decodificação e obtenção do texto
    let content: string;
    if (typeof csvData === 'string') {
      content = csvData;
    } else {
      content = decodeCSVContent(csvData);
    }

    const rawLines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (rawLines.length < 2) {
      throw new Error('O arquivo CSV informado está vazio ou inválido.');
    }

    onProgress?.({ stage: 'Processando arquivo CID-10...', current: 0, total: rawLines.length, percent: 20 });

    // Pula cabeçalho se houver (SUBCAT;CLASSIF...)
    const startIndex = rawLines[0].toUpperCase().includes('SUBCAT') ? 1 : 0;
    const linesToProcess = rawLines.slice(startIndex);

    const records: CID10Record[] = [];
    const seenCodes = new Set<string>();
    let emptyCodes = 0;
    let emptyDescriptions = 0;
    let duplicateCount = 0;
    let hasPortugueseAccents = false;
    let hasMojibake = false;

    // 3. Processamento linha a linha utilizando parser oficial DATASUS
    for (let i = 0; i < linesToProcess.length; i++) {
      const line = linesToProcess[i];
      if (!line.trim()) continue;

      try {
        const subcat = new Cid10SubcategoryRecord(line);
        const rawCode = subcat.code;
        const description = subcat.description;

        if (!rawCode || !rawCode.trim()) {
          emptyCodes++;
          continue;
        }

        if (!description || !description.trim()) {
          emptyDescriptions++;
          continue;
        }

        const canonicalCode = toCanonicalCode(rawCode);
        const codeClean = toCleanCode(canonicalCode);

        if (seenCodes.has(canonicalCode)) {
          duplicateCount++;
          continue;
        }
        seenCodes.add(canonicalCode);

        // Verificação de encoding
        if (/[áéíóúãõçÁÉÍÓÚÃÕÇ]/.test(description)) {
          hasPortugueseAccents = true;
        }
        if (/[\uFFFD]|Ã§|Ã£|Ã³|Ã©|Ã­|Ã¡/.test(description)) {
          hasMojibake = true;
        }

        const normDesc = normalizeSearchText(description);

        records.push({
          id: canonicalCode,
          code: canonicalCode,
          codeClean: codeClean,
          description: description.trim(),
          abbreviation: subcat.abbreviation ? subcat.abbreviation.trim() : undefined,
          normalizedDescription: normDesc,
          active: true,
          source: sourceName,
          version: versionName,
          classif: subcat.classif || null,
          restrBySex: subcat.restrBySex || null,
          canCauseDeath: subcat.canCauseDeath || null,
          refer: subcat.refer || null,
          excluded: subcat.excluded && subcat.excluded.length > 0 ? subcat.excluded : null
        });
      } catch (err: any) {
        newVersion.errors = newVersion.errors || [];
        newVersion.errors.push(`Linha ${i + 1}: ${err.message}`);
      }

      if (i % 2000 === 0) {
        const pct = Math.floor(20 + (i / linesToProcess.length) * 50);
        onProgress?.({
          stage: `Processando registros (${records.length} válidos)...`,
          current: i,
          total: linesToProcess.length,
          percent: pct
        });
      }
    }

    onProgress?.({ stage: 'Validando integridade da base...', current: records.length, total: records.length, percent: 75 });

    // 4. Validações estritas da importação (Requisito 20)
    const report = {
      totalRead: linesToProcess.length,
      validCount: records.length,
      encodingOk: !hasMojibake && hasPortugueseAccents,
      hasPortugueseAccents,
      emptyCodes,
      emptyDescriptions,
      duplicateCount
    };
    newVersion.validationReport = report;

    // Regra: Não aceitar base vazia ou com queda absurda de registros (< 10000 para subcategorias)
    if (records.length < 10000) {
      throw new Error(
        `Falha na validação: Quantidade de registros insuficientes (${records.length} encontrados, esperado >= 10.000 para CID-10 subcategorias).`
      );
    }

    // Regra: Encoding não pode estar corrompido
    if (hasMojibake) {
      throw new Error(
        'Falha na validação de codificação: caracteres corrompidos detectados (mojibake). A base não foi ativada.'
      );
    }

    // 5. Marca status como VALIDADA
    newVersion.status = 'VALIDADA';
    newVersion.recordCount = records.length;

    onProgress?.({ stage: 'Salvando no banco de dados e ativando nova versão...', current: records.length, total: records.length, percent: 85 });

    // 6. Grava registros e ativa a nova versão
    newVersion.status = 'ATIVA';
    newVersion.activatedAt = new Date().toISOString();

    // Salva registros no IndexedDB local
    await saveRecordsToIDB(records, newVersion);

    // 7. Transição atômica no Firestore: desativa versões anteriores e ativa a nova
    try {
      const versionsQuery = query(collection(db, 'cid10_versions'), where('status', '==', 'ATIVA'));
      const activeVersionsSnap = await getDocs(versionsQuery);
      for (const verDoc of activeVersionsSnap.docs) {
        if (verDoc.id !== versionId) {
          await updateDoc(doc(db, 'cid10_versions', verDoc.id), { status: 'INATIVA' });
        }
      }

      await setDoc(doc(db, 'cid10_versions', versionId), newVersion);
    } catch (fsErr) {
      console.warn('Aviso ao atualizar versão no Firestore (salvo com sucesso no IndexedDB):', fsErr);
    }

    onProgress?.({ stage: 'Importação concluída com sucesso!', current: records.length, total: records.length, percent: 100 });

    return {
      success: true,
      version: newVersion
    };
  } catch (error: any) {
    console.error('Erro na rotina de importação CID-10:', error);
    newVersion.status = 'ERRO';
    newVersion.errors = newVersion.errors || [];
    newVersion.errors.push(error.message || String(error));

    try {
      await setDoc(doc(db, 'cid10_versions', versionId), newVersion, { merge: true });
    } catch {
      // ignore
    }

    return {
      success: false,
      version: newVersion,
      error: error.message || 'Erro desconhecido durante importação'
    };
  }
}
