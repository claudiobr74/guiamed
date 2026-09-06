import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';

export interface ContinuationConfig {
  enabled?: boolean;
  mode?: 'duplicate_page' | 'annex_sheet';
  sourcePage?: number; // 1-indexed, defaults to 1
  maxItemsFirstPage?: number;
}

export interface TemplateField {
  id: string;
  name: string;
  mappedTo: string;
  pageNumber?: number; // 1-indexed
  x: number; // percentage (0-100)
  y: number; // percentage (0-100) from top
  width: number; // percentage (0-100)
  height: number; // percentage (0-100)
  fontSize: number;
  alignment?: 'left' | 'center' | 'right';
  isMultiline?: boolean;
  isCheckbox?: boolean;
  checkboxMatchValue?: string;
  checkboxMarker?: string; // "X" | "✓"
  isList?: boolean;
  maxRows?: number;
  rowSpacing?: number; // percentage from top or points
}

export interface GeneratorData {
  patient?: {
    name?: string;
    cpf?: string;
    birthDate?: string;
    gender?: string;
    healthPlanNumber?: string;
    healthPlanValidity?: string;
    healthPlanName?: string;
    phone?: string;
    email?: string;
  };
  doctor?: {
    name?: string;
    crm?: string;
    uf?: string;
    specialty?: string;
    rqe?: string;
    cbo?: string;
    cpf?: string;
    providerCode?: string;
    operatorCode?: string;
    signature?: string;
  };
  clinicalData?: {
    date?: string;
    type?: string;
    character?: string; // Eletivo / Urgência
    cid?: string;
    cidCode?: string;
    cidDescription?: string;
    cidFull?: string;
    cidSource?: string;
    cidVersion?: string;
    secondaryCid?: string;
    secondaryCids?: Array<{ code: string; description: string; source?: string; version?: string }>;
    diagnosis?: string;
    indication?: string;
    justification?: string;
    observations?: string;
  };
  procedures?: Array<{
    code: string;
    description: string;
    quantity: number;
    unit?: string;
    complement?: string;
    isPrincipal?: boolean;
  }>;
  hospitalization?: {
    character?: string;
    expectedDate?: string;
    regime?: string;
    type?: string;
    days?: number;
    dailyCount?: string | number;
    accommodation?: string;
    notes?: string;
  };
  opme?: Array<{
    code?: string;
    description: string;
    quantity: number;
    unit?: string;
    manufacturer?: string;
    reference?: string;
    anvisa?: string;
    justification?: string;
  }>;
}

export type PdfGenerationData = GeneratorData;

export const SAMPLE_TEST_DATA: GeneratorData = {
  patient: {
    name: 'João da Silva',
    cpf: '123.456.789-00',
    birthDate: '15/05/1982',
    gender: 'M',
    healthPlanNumber: '123456789',
    healthPlanValidity: '31/12/2026',
    healthPlanName: 'Plano Ouro Especial'
  },
  doctor: {
    name: 'Dr. Médico Teste',
    crm: '00000',
    uf: 'GO',
    specialty: 'Ortopedia e Traumatologia',
    rqe: '1234',
    cbo: '2252-70',
    cpf: '987.654.321-99',
    providerCode: 'PREST-9876',
    operatorCode: 'OP-4321'
  },
  clinicalData: {
    date: new Date().toISOString().split('T')[0],
    type: 'Internação Cirúrgica',
    character: 'Eletivo',
    cid: 'M17.1',
    secondaryCid: 'M17.0',
    diagnosis: 'Gonartrose primária unilateral',
    indication: 'Paciente com quadro de dor crônica refratária ao tratamento conservador, limitação funcional e perda de amplitude de movimento.',
    justification: 'Necessidade de intervenção cirúrgica para restauração articular e alívio de sintomas álgicos incapacitantes.',
    observations: 'Sem contraindicações clínicas para o procedimento.'
  },
  procedures: [
    { code: '31401015', description: 'Artroplastia total de joelho', quantity: 1, isPrincipal: true },
    { code: '31401023', description: 'Reconstrução ligamentar com enxerto', quantity: 1 },
    { code: '31401031', description: 'Sinovectomia articular ampla', quantity: 1 }
  ],
  hospitalization: {
    expectedDate: '15/10/2026',
    regime: 'Hospitalar',
    type: 'Clínico-Cirúrgico',
    dailyCount: 2
  },
  opme: [
    {
      description: 'Prótese total de joelho cimentada com polietileno de alta durabilidade',
      quantity: 1,
      manufacturer: 'BioMedical Corp',
      reference: 'PTJ-2026-X',
      anvisa: '1029384756',
      justification: 'Material indispensável para reconstituição anatômica articular do joelho afetado.'
    }
  ]
};

export const AVAILABLE_MAPPINGS_GROUPED = [
  {
    group: 'PACIENTE',
    items: [
      { label: 'Paciente > Nome Completo', value: 'patient.name' },
      { label: 'Paciente > CPF', value: 'patient.cpf' },
      { label: 'Paciente > Data de Nascimento', value: 'patient.birthDate' },
      { label: 'Paciente > Sexo', value: 'patient.gender' },
      { label: 'Paciente > Número da Carteira', value: 'patient.healthPlanNumber' },
      { label: 'Paciente > Validade da Carteira', value: 'patient.healthPlanValidity' },
      { label: 'Paciente > Plano/Convênio', value: 'patient.healthPlanName' }
    ]
  },
  {
    group: 'MÉDICO',
    items: [
      { label: 'Médico > Nome', value: 'doctor.name' },
      { label: 'Médico > CRM', value: 'doctor.crm' },
      { label: 'Médico > UF', value: 'doctor.uf' },
      { label: 'Médico > Especialidade', value: 'doctor.specialty' },
      { label: 'Médico > RQE', value: 'doctor.rqe' },
      { label: 'Médico > CBO', value: 'doctor.cbo' },
      { label: 'Médico > CPF', value: 'doctor.cpf' },
      { label: 'Médico > Código do Prestador', value: 'doctor.providerCode' },
      { label: 'Médico > Código na Operadora', value: 'doctor.operatorCode' }
    ]
  },
  {
    group: 'SOLICITAÇÃO',
    items: [
      { label: 'Solicitação > Data', value: 'clinicalData.date' },
      { label: 'Solicitação > Tipo de Solicitação', value: 'clinicalData.type' },
      { label: 'Solicitação > Caráter (Eletivo/Urgência)', value: 'clinicalData.character' },
      { label: 'Solicitação > CID Principal', value: 'clinicalData.cid' },
      { label: 'Solicitação > CID Principal > Código', value: 'clinicalData.cidCode' },
      { label: 'Solicitação > CID Principal > Descrição', value: 'clinicalData.cidDescription' },
      { label: 'Solicitação > CID Principal > Código + Descrição', value: 'clinicalData.cidFull' },
      { label: 'Solicitação > CID Secundários', value: 'clinicalData.secondaryCid' },
      { label: 'Solicitação > Diagnóstico', value: 'clinicalData.diagnosis' },
      { label: 'Solicitação > Indicação Clínica', value: 'clinicalData.indication' },
      { label: 'Solicitação > Justificativa', value: 'clinicalData.justification' },
      { label: 'Solicitação > Observações', value: 'clinicalData.observations' }
    ]
  },
  {
    group: 'PROCEDIMENTOS (Lista)',
    items: [
      { label: 'Procedimento > Código (Linha da Lista)', value: 'procedure.code' },
      { label: 'Procedimento > Descrição (Linha da Lista)', value: 'procedure.description' },
      { label: 'Procedimento > Quantidade (Linha da Lista)', value: 'procedure.quantity' },
      { label: 'Procedimento > Unidade', value: 'procedure.unit' },
      { label: 'Procedimento > Complemento', value: 'procedure.complement' }
    ]
  },
  {
    group: 'INTERNAÇÃO',
    items: [
      { label: 'Internação > Data Prevista', value: 'hospitalization.expectedDate' },
      { label: 'Internação > Regime', value: 'hospitalization.regime' },
      { label: 'Internação > Tipo de Internação', value: 'hospitalization.type' },
      { label: 'Internação > Quantidade de Diárias', value: 'hospitalization.dailyCount' }
    ]
  },
  {
    group: 'OPME',
    items: [
      { label: 'OPME > Descrição', value: 'opme.description' },
      { label: 'OPME > Quantidade', value: 'opme.quantity' },
      { label: 'OPME > Fabricante', value: 'opme.manufacturer' },
      { label: 'OPME > Referência', value: 'opme.reference' },
      { label: 'OPME > Registro ANVISA', value: 'opme.anvisa' },
      { label: 'OPME > Justificativa Técnica', value: 'opme.justification' }
    ]
  }
];

export const ALL_AVAILABLE_MAPPINGS = AVAILABLE_MAPPINGS_GROUPED.flatMap(g => g.items);

export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').trim();
  const binaryString = atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function generateFilledPdf(
  templatePdfSource: string | ArrayBuffer | Uint8Array,
  fields: TemplateField[],
  data: GeneratorData,
  continuationConfig?: ContinuationConfig
): Promise<{ pdfBytes: Uint8Array; warnings: string[] }> {
  const warnings: string[] = [];
  
  let pdfDoc: PDFDocument;
  if (typeof templatePdfSource === 'string') {
    const trimmed = templatePdfSource.trim();
    if (trimmed.startsWith('data:') || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('blob:'))) {
      const bytes = base64ToUint8Array(trimmed);
      pdfDoc = await PDFDocument.load(bytes);
    } else {
      const res = await fetch(trimmed);
      const ab = await res.arrayBuffer();
      pdfDoc = await PDFDocument.load(ab);
    }
  } else {
    pdfDoc = await PDFDocument.load(templatePdfSource);
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  const getResolvedValue = (mappedTo: string, index = 0): string => {
    switch (mappedTo) {
      case 'patient.name': return data.patient?.name || '';
      case 'patient.cpf': return data.patient?.cpf || '';
      case 'patient.birthDate': return data.patient?.birthDate || '';
      case 'patient.gender': return data.patient?.gender || '';
      case 'patient.healthPlanNumber': return data.patient?.healthPlanNumber || '';
      case 'patient.healthPlanValidity': return data.patient?.healthPlanValidity || '';
      case 'patient.healthPlanName': return data.patient?.healthPlanName || '';

      case 'doctor.name': return data.doctor?.name || '';
      case 'doctor.crm': return data.doctor?.crm || '';
      case 'doctor.uf': return data.doctor?.uf || '';
      case 'doctor.specialty': return data.doctor?.specialty || '';
      case 'doctor.rqe': return data.doctor?.rqe || '';
      case 'doctor.cbo': return data.doctor?.cbo || '';
      case 'doctor.cpf': return data.doctor?.cpf || '';
      case 'doctor.providerCode': return data.doctor?.providerCode || '';
      case 'doctor.operatorCode': return data.doctor?.operatorCode || '';

      case 'clinicalData.date': return data.clinicalData?.date || '';
      case 'clinicalData.type': return data.clinicalData?.type || '';
      case 'clinicalData.character': return data.clinicalData?.character || '';
      case 'clinicalData.cid': return data.clinicalData?.cidCode || data.clinicalData?.cid || '';
      case 'clinicalData.cidCode': return data.clinicalData?.cidCode || data.clinicalData?.cid || '';
      case 'clinicalData.cidDescription': return data.clinicalData?.cidDescription || '';
      case 'clinicalData.cidFull':
        return data.clinicalData?.cidFull || (data.clinicalData?.cidCode && data.clinicalData?.cidDescription ? `${data.clinicalData.cidCode} - ${data.clinicalData.cidDescription}` : data.clinicalData?.cid || '');
      case 'clinicalData.secondaryCid':
        return data.clinicalData?.secondaryCid || data.clinicalData?.secondaryCids?.map(c => `${c.code} - ${c.description}`).join('; ') || '';
      case 'clinicalData.diagnosis': return data.clinicalData?.diagnosis || '';
      case 'clinicalData.indication': return data.clinicalData?.indication || '';
      case 'clinicalData.justification': return data.clinicalData?.justification || '';
      case 'clinicalData.observations': return data.clinicalData?.observations || '';

      case 'procedure.code': return data.procedures?.[index]?.code || '';
      case 'procedure.description': return data.procedures?.[index]?.description || '';
      case 'procedure.quantity': return data.procedures?.[index] ? String(data.procedures[index].quantity) : '';
      case 'procedure.unit': return data.procedures?.[index]?.unit || '';
      case 'procedure.complement': return data.procedures?.[index]?.complement || '';

      case 'hospitalization.expectedDate': return data.hospitalization?.expectedDate || '';
      case 'hospitalization.regime': return data.hospitalization?.regime || '';
      case 'hospitalization.type': return data.hospitalization?.type || '';
      case 'hospitalization.dailyCount': return data.hospitalization?.dailyCount ? String(data.hospitalization.dailyCount) : '';

      case 'opme.description': return data.opme?.[index]?.description || '';
      case 'opme.quantity': return data.opme?.[index] ? String(data.opme[index].quantity) : '';
      case 'opme.manufacturer': return data.opme?.[index]?.manufacturer || '';
      case 'opme.reference': return data.opme?.[index]?.reference || '';
      case 'opme.anvisa': return data.opme?.[index]?.anvisa || '';
      case 'opme.justification': return data.opme?.[index]?.justification || data.clinicalData?.justification || '';

      default: return '';
    }
  };

  const renderSingleField = (
    targetPage: PDFPage,
    field: TemplateField,
    rawText: string,
    rowIndex = 0
  ) => {
    if (!rawText) return;
    const { width: pageWidth, height: pageHeight } = targetPage.getSize();
    const defaultStepPoints = field.rowSpacing ? (field.rowSpacing / 100) * pageHeight : 16;

    const baseFontSize = field.fontSize || 10;
    let effectiveFontSize = baseFontSize;

    const boxWidth = (field.width / 100) * pageWidth;
    const boxHeight = (field.height / 100) * pageHeight;
    const baseX = (field.x / 100) * pageWidth;
    const baseYOffset = rowIndex * defaultStepPoints;
    const baseY = pageHeight - ((field.y / 100) * pageHeight) - baseYOffset;

    if (field.isMultiline) {
      const words = rawText.split(/\s+/);
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const textWidth = font.widthOfTextAtSize(testLine, effectiveFontSize);
        if (textWidth <= boxWidth) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);

      const lineHeight = effectiveFontSize * 1.25;
      const totalTextHeight = lines.length * lineHeight;
      if (totalTextHeight > boxHeight && effectiveFontSize > 7) {
        effectiveFontSize = Math.max(7, Math.floor(baseFontSize * 0.85));
      }

      const effectiveLineHeight = effectiveFontSize * 1.25;
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const lineWidth = font.widthOfTextAtSize(line, effectiveFontSize);
        let drawX = baseX;
        if (field.alignment === 'center') {
          drawX = baseX + (boxWidth - lineWidth) / 2;
        } else if (field.alignment === 'right') {
          drawX = baseX + boxWidth - lineWidth;
        }

        const drawY = baseY - (lineIndex * effectiveLineHeight) - effectiveFontSize;
        if (drawY < baseY - boxHeight - effectiveFontSize) break;

        targetPage.drawText(line, {
          x: Math.max(0, drawX),
          y: drawY,
          size: effectiveFontSize,
          font,
          color: rgb(0, 0, 0)
        });
      }
    } else {
      const textWidth = font.widthOfTextAtSize(rawText, effectiveFontSize);
      let drawX = baseX;
      if (field.alignment === 'center') {
        drawX = baseX + (boxWidth - textWidth) / 2;
      } else if (field.alignment === 'right') {
        drawX = baseX + boxWidth - textWidth;
      }
      const drawY = baseY - effectiveFontSize;

      targetPage.drawText(rawText, {
        x: Math.max(0, drawX),
        y: drawY,
        size: effectiveFontSize,
        font,
        color: rgb(0, 0, 0)
      });
    }
  };

  // 1. First Pass: Render page 1 and original template pages
  const procFields = fields.filter(f => f.mappedTo.startsWith('procedure.') || f.isList);
  const opmeFields = fields.filter(f => f.mappedTo.startsWith('opme.'));
  const maxProcRows = procFields.length > 0 ? Math.max(...procFields.map(f => f.maxRows || 5)) : 5;
  const maxOpmeRows = opmeFields.length > 0 ? Math.max(...opmeFields.map(f => f.maxRows || 3)) : 3;

  for (const field of fields) {
    const pageIndex = (field.pageNumber || 1) - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];

    const isProcField = field.mappedTo.startsWith('procedure.') || field.isList;
    const isOpmeField = field.mappedTo.startsWith('opme.');

    let loops = 1;
    if (isProcField) {
      loops = Math.min(data.procedures?.length || 0, field.maxRows || 5);
    } else if (isOpmeField) {
      loops = Math.min(data.opme?.length || 0, field.maxRows || 3);
    }

    for (let i = 0; i < (loops === 0 && (isProcField || isOpmeField) ? 0 : loops); i++) {
      let rawText = getResolvedValue(field.mappedTo, i);

      if (field.isCheckbox) {
        const isMatch = field.checkboxMatchValue
          ? rawText.trim().toLowerCase() === field.checkboxMatchValue.trim().toLowerCase()
          : Boolean(rawText);
        if (isMatch) {
          rawText = field.checkboxMarker || 'X';
        } else {
          continue;
        }
      }

      renderSingleField(page, field, rawText, i);
    }
  }

  // 2. Second Pass: Check for overflow procedures or OPME
  const totalProcedures = data.procedures?.length || 0;
  const totalOpme = data.opme?.length || 0;
  const hasProcOverflow = procFields.length > 0 && totalProcedures > maxProcRows;
  const hasOpmeOverflow = opmeFields.length > 0 && totalOpme > maxOpmeRows;

  const isContinuationEnabled = continuationConfig?.enabled !== false;

  if ((hasProcOverflow || hasOpmeOverflow) && isContinuationEnabled) {
    const mode = continuationConfig?.mode || 'duplicate_page';

    if (mode === 'duplicate_page') {
      const extraProcBatches = hasProcOverflow ? Math.ceil((totalProcedures - maxProcRows) / maxProcRows) : 0;
      const extraOpmeBatches = hasOpmeOverflow ? Math.ceil((totalOpme - maxOpmeRows) / maxOpmeRows) : 0;
      const neededPages = Math.max(extraProcBatches, extraOpmeBatches);

      const sourcePageNum = continuationConfig?.sourcePage || procFields[0]?.pageNumber || 1;
      const sourcePageIndex = Math.max(0, Math.min(pages.length - 1, sourcePageNum - 1));

      for (let batch = 1; batch <= neededPages; batch++) {
        // Clone source blank template page
        const [clonedPage] = await pdfDoc.copyPages(pdfDoc, [sourcePageIndex]);
        pdfDoc.addPage(clonedPage);
        const { width: pWidth, height: pHeight } = clonedPage.getSize();

        // Banner marker
        clonedPage.drawText(`FOLHA DE CONTINUAÇÃO (PÁGINA ${batch + 1}) - ITENS EXCEDENTES`, {
          x: 35,
          y: pHeight - 16,
          size: 7.5,
          font: fontBold,
          color: rgb(0.12, 0.35, 0.65)
        });

        // 1. Re-render non-list header fields from that page (patient, doctor, clinicalData, dates, cid)
        const headerFields = fields.filter(f => 
          ((f.pageNumber || 1) === sourcePageNum) && 
          !f.mappedTo.startsWith('procedure.') && 
          !f.mappedTo.startsWith('opme.') && 
          !f.isList
        );

        for (const hField of headerFields) {
          let rawText = getResolvedValue(hField.mappedTo, 0);
          if (hField.isCheckbox) {
            const isMatch = hField.checkboxMatchValue
              ? rawText.trim().toLowerCase() === hField.checkboxMatchValue.trim().toLowerCase()
              : Boolean(rawText);
            if (isMatch) rawText = hField.checkboxMarker || 'X';
            else continue;
          }
          renderSingleField(clonedPage, hField, rawText, 0);
        }

        // 2. Render overflow procedures for this batch
        if (hasProcOverflow) {
          const startProcIdx = maxProcRows + (batch - 1) * maxProcRows;
          for (const pField of procFields) {
            for (let i = 0; i < maxProcRows; i++) {
              const actualIdx = startProcIdx + i;
              if (actualIdx < totalProcedures) {
                const text = getResolvedValue(pField.mappedTo, actualIdx);
                renderSingleField(clonedPage, pField, text, i);
              }
            }
          }
        }

        // 3. Render overflow OPME for this batch
        if (hasOpmeOverflow) {
          const startOpmeIdx = maxOpmeRows + (batch - 1) * maxOpmeRows;
          for (const oField of opmeFields) {
            for (let i = 0; i < maxOpmeRows; i++) {
              const actualIdx = startOpmeIdx + i;
              if (actualIdx < totalOpme) {
                const text = getResolvedValue(oField.mappedTo, actualIdx);
                renderSingleField(clonedPage, oField, text, i);
              }
            }
          }
        }
      }

      warnings.push(`Excedente detectado: foram geradas ${neededPages} folha(s) de continuação do formulário oficial com os itens adicionais.`);
    } else {
      // mode === 'annex_sheet' (Folha Anexa Padronizada)
      const annexPage = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
      const { width: aWidth, height: aHeight } = annexPage.getSize();
      let currentY = aHeight - 40;

      // Header Banner
      annexPage.drawRectangle({
        x: 35,
        y: currentY - 24,
        width: aWidth - 70,
        height: 32,
        color: rgb(0.93, 0.95, 0.98),
        borderColor: rgb(0.75, 0.82, 0.92),
        borderWidth: 1
      });

      annexPage.drawText('ANEXO DE CONTINUAÇÃO DE SOLICITAÇÃO MÉDICA', {
        x: 45,
        y: currentY - 8,
        size: 11,
        font: fontBold,
        color: rgb(0.08, 0.25, 0.5)
      });
      annexPage.drawText('Itens de Procedimentos e Materiais Especiais (OPME) Excedentes', {
        x: 45,
        y: currentY - 20,
        size: 8,
        font,
        color: rgb(0.3, 0.4, 0.5)
      });

      currentY -= 42;

      // Patient & Doctor Summary Box
      annexPage.drawRectangle({
        x: 35,
        y: currentY - 50,
        width: aWidth - 70,
        height: 50,
        color: rgb(0.98, 0.98, 0.99),
        borderColor: rgb(0.85, 0.88, 0.92),
        borderWidth: 0.8
      });

      annexPage.drawText(`Paciente: ${data.patient?.name || 'Não informado'}`, { x: 45, y: currentY - 14, size: 8.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      annexPage.drawText(`CPF: ${data.patient?.cpf || '-'}  •  Carteira: ${data.patient?.healthPlanNumber || '-'} (${data.patient?.healthPlanName || '-'})`, { x: 45, y: currentY - 26, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
      annexPage.drawText(`Médico Solicitante: ${data.doctor?.name || '-'}  •  CRM: ${data.doctor?.crm || '-'}/${data.doctor?.uf || '-'}  •  CID: ${data.clinicalData?.cidCode || data.clinicalData?.cid || '-'}`, { x: 45, y: currentY - 40, size: 8, font, color: rgb(0.3, 0.3, 0.3) });

      currentY -= 65;

      // Procedures Table
      if (hasProcOverflow) {
        annexPage.drawText(`PROCEDIMENTOS COMPLEMENTARES (${totalProcedures - maxProcRows} itens adicionais):`, {
          x: 35,
          y: currentY,
          size: 9,
          font: fontBold,
          color: rgb(0.1, 0.2, 0.4)
        });
        currentY -= 16;

        // Table Header
        annexPage.drawRectangle({ x: 35, y: currentY - 14, width: aWidth - 70, height: 16, color: rgb(0.9, 0.93, 0.97) });
        annexPage.drawText('CÓDIGO TUSS', { x: 42, y: currentY - 10, size: 7.5, font: fontBold, color: rgb(0.2, 0.3, 0.4) });
        annexPage.drawText('DESCRIÇÃO DO PROCEDIMENTO', { x: 120, y: currentY - 10, size: 7.5, font: fontBold, color: rgb(0.2, 0.3, 0.4) });
        annexPage.drawText('QTD', { x: aWidth - 65, y: currentY - 10, size: 7.5, font: fontBold, color: rgb(0.2, 0.3, 0.4) });
        currentY -= 16;

        for (let idx = maxProcRows; idx < totalProcedures; idx++) {
          const proc = data.procedures![idx];
          annexPage.drawText(proc.code || '-', { x: 42, y: currentY - 10, size: 8, font, color: rgb(0.15, 0.15, 0.15) });
          annexPage.drawText((proc.description || '').substring(0, 75), { x: 120, y: currentY - 10, size: 8, font, color: rgb(0.15, 0.15, 0.15) });
          annexPage.drawText(String(proc.quantity || 1), { x: aWidth - 60, y: currentY - 10, size: 8, font, color: rgb(0.15, 0.15, 0.15) });
          
          annexPage.drawLine({
            start: { x: 35, y: currentY - 14 },
            end: { x: aWidth - 35, y: currentY - 14 },
            thickness: 0.5,
            color: rgb(0.85, 0.88, 0.92)
          });
          currentY -= 18;
          if (currentY < 120) break;
        }
        currentY -= 15;
      }

      // OPME Table
      if (hasOpmeOverflow && currentY > 150) {
        annexPage.drawText(`MATERIAIS ESPECIAIS E OPME COMPLEMENTARES:`, {
          x: 35,
          y: currentY,
          size: 9,
          font: fontBold,
          color: rgb(0.1, 0.2, 0.4)
        });
        currentY -= 16;

        annexPage.drawRectangle({ x: 35, y: currentY - 14, width: aWidth - 70, height: 16, color: rgb(0.9, 0.93, 0.97) });
        annexPage.drawText('DESCRIÇÃO DO MATERIAL / OPME', { x: 42, y: currentY - 10, size: 7.5, font: fontBold, color: rgb(0.2, 0.3, 0.4) });
        annexPage.drawText('FABRICANTE / ANVISA', { x: 300, y: currentY - 10, size: 7.5, font: fontBold, color: rgb(0.2, 0.3, 0.4) });
        annexPage.drawText('QTD', { x: aWidth - 65, y: currentY - 10, size: 7.5, font: fontBold, color: rgb(0.2, 0.3, 0.4) });
        currentY -= 16;

        for (let idx = maxOpmeRows; idx < totalOpme; idx++) {
          const item = data.opme![idx];
          annexPage.drawText((item.description || '').substring(0, 52), { x: 42, y: currentY - 10, size: 7.5, font, color: rgb(0.15, 0.15, 0.15) });
          const fab = `${item.manufacturer || '-'} / ${item.anvisa || '-'}`;
          annexPage.drawText(fab.substring(0, 36), { x: 300, y: currentY - 10, size: 7.5, font, color: rgb(0.3, 0.3, 0.3) });
          annexPage.drawText(String(item.quantity || 1), { x: aWidth - 60, y: currentY - 10, size: 7.5, font, color: rgb(0.15, 0.15, 0.15) });

          annexPage.drawLine({
            start: { x: 35, y: currentY - 14 },
            end: { x: aWidth - 35, y: currentY - 14 },
            thickness: 0.5,
            color: rgb(0.85, 0.88, 0.92)
          });
          currentY -= 18;
          if (currentY < 100) break;
        }
      }

      // Signature Footer
      const footerY = 55;
      annexPage.drawLine({
        start: { x: aWidth - 240, y: footerY + 20 },
        end: { x: aWidth - 40, y: footerY + 20 },
        thickness: 0.8,
        color: rgb(0.3, 0.3, 0.3)
      });
      annexPage.drawText(`${data.doctor?.name || 'Assinatura e Carimbo do Médico'}`, {
        x: aWidth - 230,
        y: footerY + 8,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1)
      });
      annexPage.drawText(`CRM: ${data.doctor?.crm || '-'}/${data.doctor?.uf || '-'}  •  Data: ${data.clinicalData?.date || ''}`, {
        x: aWidth - 230,
        y: footerY - 2,
        size: 7.5,
        font,
        color: rgb(0.35, 0.35, 0.35)
      });

      warnings.push(`Excedente detectado: gerada folha anexa oficial de continuação para os itens que ultrapassaram a primeira folha.`);
    }
  } else if (hasProcOverflow || hasOpmeOverflow) {
    warnings.push(`Este formulário possui espaço para ${maxProcRows} procedimentos. Existem ${totalProcedures} procedimentos na solicitação.`);
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, warnings };
}
