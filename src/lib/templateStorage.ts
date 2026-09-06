import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

const CHUNK_SIZE = 380_000; // ~380KB characters per chunk, safely below the 1MB (1,048,576 bytes) limit

// In-memory cache for assembled PDF data strings during the session
const pdfCache = new Map<string, string>();

export interface TemplateDataPayload {
  name: string;
  operatorId: string;
  category?: string;
  version?: string;
  validity?: string;
  tableId?: string;
  status?: string;
  fields?: any[];
}

/**
 * Saves a template and its PDF file into Firestore.
 * If the PDF data is larger than ~300KB, it automatically splits the payload
 * into a subcollection of chunks to avoid the 1MB Firestore document limit.
 */
export async function saveTemplateWithPdf(
  doctorId: string,
  data: TemplateDataPayload,
  base64Pdf: string
): Promise<string> {
  const isLarge = base64Pdf.length > 300_000;

  if (!isLarge) {
    // Fits safely in the main document (< 300KB)
    const docRef = await addDoc(collection(db, 'templates'), {
      doctorId,
      name: data.name,
      operatorId: data.operatorId,
      category: data.category || '',
      version: data.version || '',
      validity: data.validity || '',
      tableId: data.tableId || '',
      status: data.status || 'Ativo',
      pdfData: base64Pdf,
      hasChunks: false,
      chunkCount: 0,
      fields: data.fields || [],
      createdAt: new Date()
    });
    pdfCache.set(docRef.id, base64Pdf);
    return docRef.id;
  }

  // Large PDF: Segment into chunks
  const totalChunks = Math.ceil(base64Pdf.length / CHUNK_SIZE);

  // 1. Create main document with pdfData: null
  const docRef = await addDoc(collection(db, 'templates'), {
    doctorId,
    name: data.name,
    operatorId: data.operatorId,
    category: data.category || '',
    version: data.version || '',
    validity: data.validity || '',
    tableId: data.tableId || '',
    status: data.status || 'Ativo',
    pdfData: null,
    hasChunks: true,
    chunkCount: totalChunks,
    fields: data.fields || [],
    createdAt: new Date()
  });

  const templateId = docRef.id;

  // 2. Write chunks into subcollection using batch writes
  // (Batches support up to 500 operations each)
  const batch = writeBatch(db);
  for (let i = 0; i < totalChunks; i++) {
    const chunkContent = base64Pdf.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const chunkDocRef = doc(collection(db, 'templates', templateId, 'chunks'), String(i).padStart(4, '0'));
    batch.set(chunkDocRef, {
      doctorId,
      index: i,
      total: totalChunks,
      data: chunkContent
    });
  }
  await batch.commit();

  pdfCache.set(templateId, base64Pdf);
  return templateId;
}

/**
 * Normalizes any PDF source (URL, base64 data URI, raw base64) into a format
 * that react-pdf and pdf-lib can reliably process without throwing 'No pdf file specified'.
 */
export function normalizePdfSource(source: string): string {
  if (!source || typeof source !== 'string') return '';
  const trimmed = source.trim();
  if (trimmed.length < 20) return '';
  if (
    trimmed.startsWith('data:application/pdf') ||
    trimmed.startsWith('data:application/octet-stream') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('data:')) {
    // Replace custom MIME type with application/pdf if needed
    return trimmed.replace(/^data:[^;]+;base64,/, 'data:application/pdf;base64,');
  }
  // Raw base64 string
  return `data:application/pdf;base64,${trimmed}`;
}

/**
 * Retrieves the complete PDF base64 / URL for a template.
 * Accepts either a template object or a template ID string.
 * If the template was segmented into chunks, it reassembles them transparently.
 */
export async function getTemplatePdfSource(templateOrId: {
  id: string;
  pdfData?: string | null;
  pdfUrl?: string | null;
  hasChunks?: boolean;
  chunkCount?: number;
} | string): Promise<string> {
  if (!templateOrId) return '';

  const templateId = typeof templateOrId === 'string' ? templateOrId.trim() : templateOrId.id?.trim();
  if (!templateId) return '';

  // 1. Check memory cache
  if (pdfCache.has(templateId)) {
    const cached = pdfCache.get(templateId)!;
    if (cached && cached.trim().length > 20) {
      return normalizePdfSource(cached);
    }
  }

  // 2. Direct embedded base64 from object if provided
  if (typeof templateOrId === 'object' && templateOrId.pdfData && typeof templateOrId.pdfData === 'string' && templateOrId.pdfData.trim().length > 50) {
    const normalized = normalizePdfSource(templateOrId.pdfData);
    pdfCache.set(templateId, normalized);
    return normalized;
  }

  // 3. Direct URL / Storage URL from object if provided
  if (typeof templateOrId === 'object') {
    const directUrl = templateOrId.pdfUrl || (templateOrId as any).pdfStorageUrl;
    if (directUrl && typeof directUrl === 'string' && directUrl.trim().length > 5) {
      const normalized = normalizePdfSource(directUrl);
      pdfCache.set(templateId, normalized);
      return normalized;
    }
  }

  // 4. If pdfData wasn't in the provided object, check Firestore document directly
  try {
    const docSnap = await getDoc(doc(db, 'templates', templateId));
    if (docSnap.exists()) {
      const docData = docSnap.data();
      if (docData.pdfData && typeof docData.pdfData === 'string' && docData.pdfData.trim().length > 50) {
        const normalized = normalizePdfSource(docData.pdfData);
        pdfCache.set(templateId, normalized);
        return normalized;
      }
      if (docData.pdfUrl && typeof docData.pdfUrl === 'string' && docData.pdfUrl.trim().length > 5) {
        const normalized = normalizePdfSource(docData.pdfUrl);
        pdfCache.set(templateId, normalized);
        return normalized;
      }
      if (docData.pdfStorageUrl && typeof docData.pdfStorageUrl === 'string' && docData.pdfStorageUrl.trim().length > 5) {
        const normalized = normalizePdfSource(docData.pdfStorageUrl);
        pdfCache.set(templateId, normalized);
        return normalized;
      }
    }
  } catch (err) {
    console.warn(`Erro ao consultar doc do template ${templateId}:`, err);
  }

  // 5. Reassemble from chunks subcollection
  try {
    const chunksCol = collection(db, 'templates', templateId, 'chunks');
    const snap = await getDocs(chunksCol);

    if (!snap.empty) {
      const sorted = snap.docs
        .map(d => d.data() as { index: number; data: string })
        .sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));

      const assembled = sorted.map(c => c.data).join('');
      if (assembled.trim().length > 0) {
        const normalized = normalizePdfSource(assembled);
        pdfCache.set(templateId, normalized);
        return normalized;
      }
    }
  } catch (err) {
    console.error(`Erro ao carregar chunks do template ${templateId}:`, err);
  }

  return '';
}

/**
 * Updates an existing template with a new PDF file (handles chunking if needed).
 */
export async function updateTemplatePdf(
  doctorId: string,
  templateId: string,
  base64Pdf: string
): Promise<void> {
  const isLarge = base64Pdf.length > 300_000;

  // Clean old chunks if any
  try {
    const chunksCol = collection(db, 'templates', templateId, 'chunks');
    const snap = await getDocs(chunksCol);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn(`Erro ao limpar chunks antigos do template ${templateId}:`, err);
  }

  if (!isLarge) {
    await updateDoc(doc(db, 'templates', templateId), {
      pdfData: base64Pdf,
      hasChunks: false,
      chunkCount: 0
    });
  } else {
    const totalChunks = Math.ceil(base64Pdf.length / CHUNK_SIZE);
    await updateDoc(doc(db, 'templates', templateId), {
      pdfData: null,
      hasChunks: true,
      chunkCount: totalChunks
    });

    const batch = writeBatch(db);
    for (let i = 0; i < totalChunks; i++) {
      const chunkContent = base64Pdf.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const chunkDocRef = doc(collection(db, 'templates', templateId, 'chunks'), String(i).padStart(4, '0'));
      batch.set(chunkDocRef, {
        doctorId,
        index: i,
        total: totalChunks,
        data: chunkContent
      });
    }
    await batch.commit();
  }

  pdfCache.set(templateId, base64Pdf);
}

/**
 * Duplicates a template and all its associated PDF chunks if present.
 */
export async function duplicateTemplateWithPdf(
  doctorId: string,
  sourceTemplate: any
): Promise<string> {
  const pdfSource = await getTemplatePdfSource(sourceTemplate);
  
  return saveTemplateWithPdf(
    doctorId,
    {
      name: `${sourceTemplate.name} (Cópia)`,
      operatorId: sourceTemplate.operatorId,
      category: sourceTemplate.category || '',
      version: sourceTemplate.version || '',
      validity: sourceTemplate.validity || '',
      tableId: sourceTemplate.tableId || '',
      status: 'Inativo',
      fields: sourceTemplate.fields || []
    },
    pdfSource
  );
}

/**
 * Deletes a template document and any subcollection chunks.
 */
export async function deleteTemplateWithPdf(templateId: string): Promise<void> {
  try {
    const chunksCol = collection(db, 'templates', templateId, 'chunks');
    const snap = await getDocs(chunksCol);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn(`Erro ao limpar chunks do template ${templateId}:`, err);
  }

  await deleteDoc(doc(db, 'templates', templateId));
  pdfCache.delete(templateId);
}
