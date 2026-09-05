import { PDFDocument, PDFCheckBox, PDFTextField } from 'pdf-lib';
import { TemplateField, ALL_AVAILABLE_MAPPINGS, base64ToUint8Array } from './pdfGenerator';

export interface DetectedFieldSuggestion {
  id: string;
  name: string;
  mappedTo: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isCheckbox?: boolean;
  checkboxMatchValue?: string;
  checkboxMarker?: string;
  isMultiline?: boolean;
  isList?: boolean;
  maxRows?: number;
  rowSpacing?: number;
  confidence: number; // 0 to 1
  source: 'acroform' | 'text_heuristic' | 'ai_vision';
  labelMatched?: string;
}

const MAPPING_KEYWORDS: { mappedTo: string; name: string; patterns: RegExp[]; defaultWidth: number; defaultHeight: number }[] = [
  // PACIENTE
  {
    mappedTo: 'patient.name',
    name: 'Nome do Paciente',
    patterns: [/nome\s*(do)?\s*benefici[aá]rio/i, /nome\s*(do)?\s*paciente/i, /paciente/i, /benefici[aá]rio/i],
    defaultWidth: 42,
    defaultHeight: 2.8
  },
  {
    mappedTo: 'patient.healthPlanNumber',
    name: 'Número da Carteira',
    patterns: [/n[uú]mero\s*(da)?\s*carteira/i, /n[ºo]\s*(da)?\s*carteira/i, /n[ºo]\s*cart[aã]o/i, /carteira/i, /matr[ií]cula/i],
    defaultWidth: 22,
    defaultHeight: 2.6
  },
  {
    mappedTo: 'patient.healthPlanValidity',
    name: 'Validade da Carteira',
    patterns: [/validade\s*(da)?\s*carteira/i, /validade/i, /dt\.?\s*validade/i],
    defaultWidth: 14,
    defaultHeight: 2.6
  },
  {
    mappedTo: 'patient.cpf',
    name: 'CPF do Paciente',
    patterns: [/cpf\s*(do)?\s*benefici[aá]rio/i, /cpf\s*(do)?\s*paciente/i, /\bcpf\b/i],
    defaultWidth: 18,
    defaultHeight: 2.6
  },
  {
    mappedTo: 'patient.birthDate',
    name: 'Data de Nascimento',
    patterns: [/data\s*(de)?\s*nascimento/i, /dt\.?\s*nasc/i, /nascimento/i],
    defaultWidth: 14,
    defaultHeight: 2.6
  },
  {
    mappedTo: 'patient.gender',
    name: 'Sexo do Paciente',
    patterns: [/\bsexo\b/i, /\bg[eê]nero\b/i],
    defaultWidth: 8,
    defaultHeight: 2.6
  },
  {
    mappedTo: 'patient.healthPlanName',
    name: 'Plano / Convênio',
    patterns: [/plano\s*(de)?\s*sa[uú]de/i, /conv[eê]nio/i, /\boperadora\b/i],
    defaultWidth: 25,
    defaultHeight: 2.6
  },

  // MÉDICO
  {
    mappedTo: 'doctor.name',
    name: 'Nome do Médico',
    patterns: [/nome\s*(do)?\s*m[eé]dico/i, /m[eé]dico\s*solicitante/i, /profissional\s*solicitante/i, /solicitante/i, /nome\s*(do)?\s*profissional/i],
    defaultWidth: 38,
    defaultHeight: 2.8
  },
  {
    mappedTo: 'doctor.crm',
    name: 'CRM do Médico',
    patterns: [/\bcrm\b/i, /conselho\s*profissional/i, /n[ºo]\s*(no)?\s*conselho/i, /registro\s*conselho/i],
    defaultWidth: 16,
    defaultHeight: 2.6
  },
  {
    mappedTo: 'doctor.uf',
    name: 'UF do Conselho',
    patterns: [/uf\s*(do)?\s*conselho/i, /\buf\b/i, /estado\s*conselho/i],
    defaultWidth: 7,
    defaultHeight: 2.6
  },
  {
    mappedTo: 'doctor.specialty',
    name: 'Especialidade Médica',
    patterns: [/especialidade/i, /\brqe\b/i, /\bcbo\b/i],
    defaultWidth: 26,
    defaultHeight: 2.6
  },
  {
    mappedTo: 'doctor.providerCode',
    name: 'Código do Prestador',
    patterns: [/c[oó]digo\s*(do)?\s*prestador/i, /c[oó]digo\s*na\s*operadora/i, /c[oó]d\.?\s*prestador/i],
    defaultWidth: 18,
    defaultHeight: 2.6
  },

  // SOLICITAÇÃO / CLÍNICA
  {
    mappedTo: 'clinicalData.date',
    name: 'Data da Solicitação',
    patterns: [/data\s*(da)?\s*solicita[çc][aã]o/i, /data\s*(de)?\s*emiss[aã]o/i, /\bdata\b/i],
    defaultWidth: 14,
    defaultHeight: 2.6
  },
  {
    mappedTo: 'clinicalData.character',
    name: 'Caráter da Solicitação',
    patterns: [/car[aá]ter\s*(do)?\s*atendimento/i, /car[aá]ter\s*(da)?\s*solicita[çc][aã]o/i, /eletivo\s*\/\s*urg[eê]ncia/i],
    defaultWidth: 16,
    defaultHeight: 2.6
  },
  {
    mappedTo: 'clinicalData.cid',
    name: 'CID-10 Principal',
    patterns: [/\bcid\s*-?\s*10\b/i, /\bcid\b/i, /diagn[oó]stico\s*principal/i, /hip[oó]tese\s*diagn[oó]stica/i],
    defaultWidth: 16,
    defaultHeight: 2.6
  },
  {
    mappedTo: 'clinicalData.secondaryCid',
    name: 'CID-10 Secundário',
    patterns: [/cid\s*secund[aá]rio/i, /outros\s*cid/i],
    defaultWidth: 16,
    defaultHeight: 2.6
  },
  {
    mappedTo: 'clinicalData.indication',
    name: 'Indicação Clínica',
    patterns: [/indica[çc][aã]o\s*cl[ií]nica/i, /hist[oó]ria\s*cl[ií]nica/i, /quadro\s*cl[ií]nico/i],
    defaultWidth: 65,
    defaultHeight: 5.5
  },
  {
    mappedTo: 'clinicalData.justification',
    name: 'Justificativa Técnica',
    patterns: [/justificativa\s*(t[eé]cnica)?/i, /motivo\s*(da)?\s*solicita[çc][aã]o/i],
    defaultWidth: 65,
    defaultHeight: 5.5
  },
  {
    mappedTo: 'clinicalData.observations',
    name: 'Observações',
    patterns: [/observa[çc][oõ]es/i, /\bobs\b/i, /informa[çc][oõ]es\s*adicionais/i],
    defaultWidth: 65,
    defaultHeight: 4.5
  },

  // PROCEDIMENTOS (LISTA)
  {
    mappedTo: 'procedure.code',
    name: 'Código do Procedimento',
    patterns: [/c[oó]digo\s*(do)?\s*procedimento/i, /tuss/i, /c[oó]d\.?\s*proc/i],
    defaultWidth: 18,
    defaultHeight: 2.4
  },
  {
    mappedTo: 'procedure.description',
    name: 'Descrição do Procedimento',
    patterns: [/descri[çc][aã]o\s*(do)?\s*procedimento/i, /nome\s*(do)?\s*procedimento/i, /procedimento\s*solicitado/i],
    defaultWidth: 48,
    defaultHeight: 2.4
  },
  {
    mappedTo: 'procedure.quantity',
    name: 'Quantidade do Procedimento',
    patterns: [/quant\b/i, /quantidade/i, /\bqtd\b/i],
    defaultWidth: 8,
    defaultHeight: 2.4
  },

  // OPME
  {
    mappedTo: 'opme.description',
    name: 'Descrição de OPME',
    patterns: [/descri[çc][aã]o\s*(do)?\s*material/i, /opme/i, /material\s*especial/i, /pr[oó]tese/i],
    defaultWidth: 50,
    defaultHeight: 2.4
  },
  {
    mappedTo: 'opme.quantity',
    name: 'Quantidade de OPME',
    patterns: [/qtd\s*(do)?\s*material/i, /quant\.?\s*opme/i],
    defaultWidth: 8,
    defaultHeight: 2.4
  },
  {
    mappedTo: 'opme.manufacturer',
    name: 'Fabricante de OPME',
    patterns: [/fabricante/i, /marca/i, /fornecedor/i],
    defaultWidth: 20,
    defaultHeight: 2.4
  },
  {
    mappedTo: 'opme.anvisa',
    name: 'Registro ANVISA',
    patterns: [/anvisa/i, /reg\.?\s*anvisa/i],
    defaultWidth: 16,
    defaultHeight: 2.4
  }
];

function matchPatternToMapping(fieldNameOrLabel: string) {
  const clean = fieldNameOrLabel.trim();
  for (const item of MAPPING_KEYWORDS) {
    for (const pat of item.patterns) {
      if (pat.test(clean)) {
        return item;
      }
    }
  }
  return null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Detect fields directly from PDF interactive form widgets (AcroForms)
 */
export async function detectAcroForms(
  pdfSource: string | ArrayBuffer | Uint8Array
): Promise<DetectedFieldSuggestion[]> {
  try {
    let pdfDoc: PDFDocument;
    if (typeof pdfSource === 'string') {
      const trimmed = pdfSource.trim();
      if (trimmed.startsWith('data:') || (!trimmed.startsWith('http') && !trimmed.startsWith('blob:'))) {
        const bytes = base64ToUint8Array(trimmed);
        pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      } else {
        const res = await fetch(trimmed);
        const ab = await res.arrayBuffer();
        pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
      }
    } else {
      pdfDoc = await PDFDocument.load(pdfSource, { ignoreEncryption: true });
    }

    const form = pdfDoc.getForm();
    const fields = form.getFields();
    if (!fields || fields.length === 0) {
      return [];
    }

    const pages = pdfDoc.getPages();
    const suggestions: DetectedFieldSuggestion[] = [];

    for (const field of fields) {
      const name = field.getName();
      const widgets = (field as any).acroField?.getWidgets?.() || [];
      if (!widgets || widgets.length === 0) continue;

      const widget = widgets[0];
      const rect = widget.getRectangle();
      if (!rect) continue;

      // Find which page this widget belongs to
      let pageIndex = 0;
      const widgetPageRef = widget.P?.();
      if (widgetPageRef) {
        for (let i = 0; i < pages.length; i++) {
          if ((pages[i] as any).ref === widgetPageRef) {
            pageIndex = i;
            break;
          }
        }
      }

      const page = pages[pageIndex] || pages[0];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      const xPercent = round1((rect.x / pageWidth) * 100);
      const yPercent = round1(((pageHeight - (rect.y + rect.height)) / pageHeight) * 100);
      const widthPercent = round1((rect.width / pageWidth) * 100);
      const heightPercent = round1((rect.height / pageHeight) * 100);

      const isCheckbox = field instanceof PDFCheckBox || (field as any).constructor?.name === 'PDFCheckBox';
      const matched = matchPatternToMapping(name);

      suggestions.push({
        id: `detected-acro-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: matched ? matched.name : (name || 'Campo Detectado'),
        mappedTo: matched ? matched.mappedTo : (isCheckbox ? 'clinicalData.character' : 'patient.name'),
        pageNumber: pageIndex + 1,
        x: Math.max(0, Math.min(95, xPercent)),
        y: Math.max(0, Math.min(95, yPercent)),
        width: Math.max(3, Math.min(95, widthPercent)),
        height: Math.max(2, Math.min(30, heightPercent)),
        fontSize: Math.max(8, Math.min(14, Math.round(rect.height * 0.65) || 10)),
        isCheckbox: !!isCheckbox,
        checkboxMarker: isCheckbox ? 'X' : undefined,
        confidence: matched ? 0.95 : 0.7,
        source: 'acroform',
        labelMatched: name
      });
    }

    return suggestions;
  } catch (err) {
    console.warn("AcroForm inspection error (probably no interactive form):", err);
    return [];
  }
}

/**
 * Detect fields heuristically by inspecting the text layer of the current page using pdfjs-dist
 */
export async function detectFromTextLayer(
  pdfJsDoc: any,
  pageNumber: number
): Promise<DetectedFieldSuggestion[]> {
  try {
    const page = await pdfJsDoc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1.0 });
    const { width: pageWidth, height: pageHeight } = viewport;

    if (!textContent || !textContent.items || textContent.items.length === 0) {
      return [];
    }

    const items = textContent.items.map((item: any) => {
      const tx = item.transform; // [scaleX, skewY, skewX, scaleY, x, y]
      const x = tx[4];
      const y = tx[5];
      const w = item.width || 0;
      const h = item.height || 10;
      return {
        text: item.str,
        x,
        y,
        w,
        h,
        // pdfjs (0,0) is bottom-left. Convert to top-left percentages:
        leftPercent: (x / pageWidth) * 100,
        topPercent: ((pageHeight - y) / pageHeight) * 100,
        widthPercent: (w / pageWidth) * 100,
        heightPercent: (h / pageHeight) * 100
      };
    });

    const suggestions: DetectedFieldSuggestion[] = [];
    const usedMappings = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.text || item.text.trim().length < 2) continue;

      // Group nearby tokens on same line if short
      let phrase = item.text.trim();
      let phraseWidthPercent = item.widthPercent;
      let nextIdx = i + 1;
      while (nextIdx < items.length && nextIdx <= i + 3) {
        const next = items[nextIdx];
        if (Math.abs(next.topPercent - item.topPercent) < 0.6 && next.leftPercent - (item.leftPercent + phraseWidthPercent) < 4) {
          phrase += ' ' + next.text.trim();
          phraseWidthPercent += next.widthPercent;
          nextIdx++;
        } else {
          break;
        }
      }

      const match = matchPatternToMapping(phrase);
      if (match && !usedMappings.has(match.mappedTo)) {
        usedMappings.add(match.mappedTo);

        // Place input box:
        // If it's a wide text field (indication, justification, diagnosis, obs), place directly below label
        const isLongText = ['clinicalData.indication', 'clinicalData.justification', 'clinicalData.observations', 'clinicalData.diagnosis'].includes(match.mappedTo);
        const isProcedure = match.mappedTo.startsWith('procedure.');

        let boxX: number;
        let boxY: number;
        let boxW: number = match.defaultWidth;
        let boxH: number = match.defaultHeight;

        if (isLongText) {
          boxX = round1(item.leftPercent);
          boxY = round1(item.topPercent + item.heightPercent + 0.5);
        } else if (isProcedure) {
          // If table column header, place starting slightly below
          boxX = round1(item.leftPercent);
          boxY = round1(item.topPercent + item.heightPercent + 1.2);
        } else {
          // Check if label has space to the right or below
          if (item.leftPercent + phraseWidthPercent + boxW < 96) {
            boxX = round1(item.leftPercent + phraseWidthPercent + 1.2);
            boxY = round1(item.topPercent - 0.5);
          } else {
            boxX = round1(item.leftPercent);
            boxY = round1(item.topPercent + item.heightPercent + 0.4);
          }
        }

        // Clamp inside page
        boxX = Math.max(3, Math.min(95 - boxW, boxX));
        boxY = Math.max(3, Math.min(95 - boxH, boxY));

        suggestions.push({
          id: `detected-text-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: match.name,
          mappedTo: match.mappedTo,
          pageNumber,
          x: boxX,
          y: boxY,
          width: boxW,
          height: boxH,
          fontSize: 10,
          isMultiline: isLongText,
          isList: isProcedure,
          maxRows: isProcedure ? 5 : undefined,
          rowSpacing: isProcedure ? 3.5 : undefined,
          confidence: 0.85,
          source: 'text_heuristic',
          labelMatched: phrase
        });
      }
    }

    return suggestions;
  } catch (err) {
    console.error("Text layer detection error:", err);
    return [];
  }
}

/**
 * Detect fields using AI Vision (Gemini 3.8 Flash) via backend /api/detect-fields
 */
export async function detectWithAI(
  imageBase64: string,
  pageNumber: number
): Promise<DetectedFieldSuggestion[]> {
  try {
    const res = await fetch('/api/detect-fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageBase64,
        pageNumber,
        availableMappings: ALL_AVAILABLE_MAPPINGS
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Falha na requisição: status ${res.status}`);
    }

    const data = await res.json();
    if (!data.fields || !Array.isArray(data.fields)) {
      return [];
    }

    return data.fields.map((f: any) => ({
      id: `detected-ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: f.name || f.mappedTo,
      mappedTo: f.mappedTo,
      pageNumber,
      x: round1(Math.max(0, Math.min(95, Number(f.x) || 5))),
      y: round1(Math.max(0, Math.min(95, Number(f.y) || 5))),
      width: round1(Math.max(3, Math.min(95, Number(f.width) || 20))),
      height: round1(Math.max(2, Math.min(50, Number(f.height) || 3))),
      fontSize: Number(f.fontSize) || 10,
      isCheckbox: !!f.isCheckbox,
      checkboxMarker: f.isCheckbox ? 'X' : undefined,
      isMultiline: !!f.isMultiline,
      isList: !!f.isList,
      maxRows: f.maxRows ? Number(f.maxRows) : undefined,
      rowSpacing: f.rowSpacing ? Number(f.rowSpacing) : undefined,
      confidence: Number(f.confidence) || 0.9,
      source: 'ai_vision',
      labelMatched: f.labelMatched || f.name
    }));
  } catch (err) {
    console.error("AI detection error:", err);
    throw err;
  }
}

/**
 * Convert suggestions into TemplateField items
 */
export function convertSuggestionsToTemplateFields(
  suggestions: DetectedFieldSuggestion[]
): TemplateField[] {
  return suggestions.map(s => ({
    id: s.id,
    name: s.name,
    mappedTo: s.mappedTo,
    pageNumber: s.pageNumber,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    fontSize: s.fontSize,
    alignment: 'left',
    isCheckbox: s.isCheckbox,
    checkboxMarker: s.checkboxMarker,
    isMultiline: s.isMultiline,
    isList: s.isList,
    maxRows: s.maxRows,
    rowSpacing: s.rowSpacing
  }));
}
