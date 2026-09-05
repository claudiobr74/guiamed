import { TemplateField } from './pdfGenerator';

export interface PdfGuideTarget {
  pos: number; // percentage 0 - 100
  type: 'vertical' | 'horizontal';
  label: string;
  source: 'pdf_line' | 'pdf_text' | 'form_box' | 'field' | 'page_margin' | 'spacing';
  spanStart?: number; // percentage where line/box begins in opposite dimension
  spanEnd?: number;   // percentage where line/box ends in opposite dimension
}

export interface SnappedResult {
  rect: { x: number; y: number; width: number; height: number };
  activeGuides: { type: 'vertical' | 'horizontal'; pos: number; label: string }[];
  hasSnappedX: boolean;
  hasSnappedY: boolean;
}

/**
 * Standard TISS Layout Guide Anchors (ANS standards for Guia de Internação, SP/SADT, etc.)
 */
const STANDARD_TISS_VERTICAL_GUIDES: { pos: number; label: string }[] = [
  { pos: 3.5, label: 'Margem Esquerda do Formulário (3.5%)' },
  { pos: 9.5, label: 'Coluna: Código TUSS/Tabela (9.5%)' },
  { pos: 17.5, label: 'Coluna: Nº Guia Prestador (17.5%)' },
  { pos: 25.5, label: 'Coluna: Senha / Identificador (25.5%)' },
  { pos: 30.0, label: 'Coluna: Descrição Procedimento (30.0%)' },
  { pos: 48.0, label: 'Coluna Central / Validade Carteira (48.0%)' },
  { pos: 50.0, label: 'Eixo Central da Página (50.0%)' },
  { pos: 68.5, label: 'Coluna: Atendimento / Senha Validade (68.5%)' },
  { pos: 71.5, label: 'Coluna: Qtde Solicitada (71.5%)' },
  { pos: 77.5, label: 'Coluna: Qtde Autorizada (77.5%)' },
  { pos: 83.5, label: 'Coluna: Detalhes / Valores (83.5%)' },
  { pos: 96.5, label: 'Margem Direita do Formulário (96.5%)' }
];

const STANDARD_TISS_HORIZONTAL_GUIDES: { pos: number; label: string }[] = [
  { pos: 5.0, label: 'Margem Superior (5.0%)' },
  { pos: 8.5, label: 'Linha: Identificação do Prestador / ANS (8.5%)' },
  { pos: 11.5, label: 'Linha: Nº Guia Atribuído (11.5%)' },
  { pos: 14.5, label: 'Linha: Autorização e Validade (14.5%)' },
  { pos: 18.0, label: 'Divisor: Dados do Beneficiário (18.0%)' },
  { pos: 20.5, label: 'Linha: Carteira e Validade (20.5%)' },
  { pos: 24.5, label: 'Linha: Nome Social (24.5%)' },
  { pos: 26.5, label: 'Linha: Nome do Beneficiário (26.5%)' },
  { pos: 29.5, label: 'Divisor: Contratado Solicitante (29.5%)' },
  { pos: 32.5, label: 'Linha: Profissional Solicitante e CRM (32.5%)' },
  { pos: 37.0, label: 'Divisor: Dados do Hospital / Internação (37.0%)' },
  { pos: 40.5, label: 'Linha: Caráter e Regime de Internação (40.5%)' },
  { pos: 44.0, label: 'Divisor: Indicação Clínica (44.0%)' },
  { pos: 54.0, label: 'Linha: Hipóteses Diagnósticas CID-10 (54.0%)' },
  { pos: 58.5, label: 'Divisor: Procedimentos Solicitados (58.5%)' },
  { pos: 61.5, label: 'Cabeçalho da Tabela de Itens (61.5%)' },
  { pos: 80.5, label: 'Divisor: Dados da Autorização (80.5%)' },
  { pos: 86.5, label: 'Divisor: Observações / Justificativa (86.5%)' },
  { pos: 92.0, label: 'Linha: Assinaturas e Data (92.0%)' },
  { pos: 96.5, label: 'Margem Inferior do Formulário (96.5%)' }
];

/**
 * Extracts line coordinates and text label positions directly from a PDF.js page.
 */
export async function extractPdfGuidesFromDocument(
  pdfDoc: any,
  pageNumber: number
): Promise<{ vertical: PdfGuideTarget[]; horizontal: PdfGuideTarget[] }> {
  const verticalTargets: PdfGuideTarget[] = [];
  const horizontalTargets: PdfGuideTarget[] = [];

  // Seed with standard form layout guides
  STANDARD_TISS_VERTICAL_GUIDES.forEach(g => {
    verticalTargets.push({
      pos: g.pos,
      type: 'vertical',
      label: g.label,
      source: 'page_margin'
    });
  });

  STANDARD_TISS_HORIZONTAL_GUIDES.forEach(g => {
    horizontalTargets.push({
      pos: g.pos,
      type: 'horizontal',
      label: g.label,
      source: 'page_margin'
    });
  });

  if (!pdfDoc) {
    return { vertical: verticalTargets, horizontal: horizontalTargets };
  }

  try {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    const pw = viewport.width;
    const ph = viewport.height;

    // 1. Extract from Text Layer (labels and text headers)
    const textContent = await page.getTextContent();
    if (textContent && Array.isArray(textContent.items)) {
      for (const item of textContent.items) {
        if (!item.str || !item.str.trim()) continue;
        const text = item.str.trim();
        // Ignore single random characters
        if (text.length < 2 && !/^\d$/.test(text)) continue;

        const tx = item.transform[4];
        const ty = item.transform[5];
        const itemWidth = item.width || 0;
        const itemHeight = item.height || 10;

        const xLeft = (tx / pw) * 100;
        const xRight = ((tx + itemWidth) / pw) * 100;
        const yTop = ((ph - (ty + itemHeight)) / ph) * 100;
        const yBase = ((ph - ty) / ph) * 100;

        // Truncate label for clean display
        const displayLabel = text.length > 28 ? text.substring(0, 25) + '...' : text;

        // Add text left alignment guide
        verticalTargets.push({
          pos: Math.round(xLeft * 10) / 10,
          type: 'vertical',
          label: `Rótulo: ${displayLabel}`,
          source: 'pdf_text',
          spanStart: yTop,
          spanEnd: yBase
        });

        // Add text right alignment guide for significant labels
        if (itemWidth > 20) {
          verticalTargets.push({
            pos: Math.round(xRight * 10) / 10,
            type: 'vertical',
            label: `Fim do texto: ${displayLabel}`,
            source: 'pdf_text',
            spanStart: yTop,
            spanEnd: yBase
          });
        }

        // Add baseline and top horizontal guides
        horizontalTargets.push({
          pos: Math.round(yBase * 10) / 10,
          type: 'horizontal',
          label: `Linha base: ${displayLabel}`,
          source: 'pdf_text',
          spanStart: xLeft,
          spanEnd: xRight
        });

        horizontalTargets.push({
          pos: Math.round(yTop * 10) / 10,
          type: 'horizontal',
          label: `Topo do texto: ${displayLabel}`,
          source: 'pdf_text',
          spanStart: xLeft,
          spanEnd: xRight
        });
      }
    }

    // 2. Extract vector lines and boxes from PDF OperatorList
    try {
      const opList = await page.getOperatorList();
      if (opList && opList.fnArray && opList.argsArray) {
        const { fnArray, argsArray } = opList;
        for (let i = 0; i < fnArray.length; i++) {
          const args = argsArray[i];
          if (!args) continue;

          // Check for constructPath or direct rectangle/lines
          // In PDF.js constructPath args is [ops, data]
          if (args.length === 2 && Array.isArray(args[0]) && Array.isArray(args[1])) {
            const pathOps = args[0];
            const pathData = args[1];
            let dataIdx = 0;

            let curX = 0;
            let curY = 0;

            for (let j = 0; j < pathOps.length; j++) {
              const op = pathOps[j];
              // 0: moveTo(x, y)
              if (op === 0 && dataIdx + 1 < pathData.length) {
                curX = pathData[dataIdx++];
                curY = pathData[dataIdx++];
              }
              // 1: lineTo(x, y)
              else if (op === 1 && dataIdx + 1 < pathData.length) {
                const nextX = pathData[dataIdx++];
                const nextY = pathData[dataIdx++];

                // Check if line is vertical
                if (Math.abs(curX - nextX) < 1.5 && Math.abs(curY - nextY) > 5) {
                  const xPct = (curX / pw) * 100;
                  const yStartPct = ((ph - Math.max(curY, nextY)) / ph) * 100;
                  const yEndPct = ((ph - Math.min(curY, nextY)) / ph) * 100;

                  verticalTargets.push({
                    pos: Math.round(xPct * 10) / 10,
                    type: 'vertical',
                    label: `Linha vertical do PDF (${xPct.toFixed(1)}%)`,
                    source: 'pdf_line',
                    spanStart: yStartPct,
                    spanEnd: yEndPct
                  });
                }
                // Check if line is horizontal
                else if (Math.abs(curY - nextY) < 1.5 && Math.abs(curX - nextX) > 5) {
                  const yPct = ((ph - curY) / ph) * 100;
                  const xStartPct = (Math.min(curX, nextX) / pw) * 100;
                  const xEndPct = (Math.max(curX, nextX) / pw) * 100;

                  horizontalTargets.push({
                    pos: Math.round(yPct * 10) / 10,
                    type: 'horizontal',
                    label: `Linha horizontal do PDF (${yPct.toFixed(1)}%)`,
                    source: 'pdf_line',
                    spanStart: xStartPct,
                    spanEnd: xEndPct
                  });
                }

                curX = nextX;
                curY = nextY;
              }
              // 4: rectangle(x, y, w, h)
              else if (op === 4 && dataIdx + 3 < pathData.length) {
                const rx = pathData[dataIdx++];
                const ry = pathData[dataIdx++];
                const rw = pathData[dataIdx++];
                const rh = pathData[dataIdx++];

                if (rw > 5 && rh > 3) {
                  const leftPct = (rx / pw) * 100;
                  const rightPct = ((rx + rw) / pw) * 100;
                  const topPct = ((ph - (ry + rh)) / ph) * 100;
                  const bottomPct = ((ph - ry) / ph) * 100;

                  verticalTargets.push({
                    pos: Math.round(leftPct * 10) / 10,
                    type: 'vertical',
                    label: `Borda de caixa (${leftPct.toFixed(1)}%)`,
                    source: 'form_box',
                    spanStart: topPct,
                    spanEnd: bottomPct
                  });

                  verticalTargets.push({
                    pos: Math.round(rightPct * 10) / 10,
                    type: 'vertical',
                    label: `Borda de caixa (${rightPct.toFixed(1)}%)`,
                    source: 'form_box',
                    spanStart: topPct,
                    spanEnd: bottomPct
                  });

                  horizontalTargets.push({
                    pos: Math.round(topPct * 10) / 10,
                    type: 'horizontal',
                    label: `Linha de caixa (${topPct.toFixed(1)}%)`,
                    source: 'form_box',
                    spanStart: leftPct,
                    spanEnd: rightPct
                  });

                  horizontalTargets.push({
                    pos: Math.round(bottomPct * 10) / 10,
                    type: 'horizontal',
                    label: `Linha de caixa (${bottomPct.toFixed(1)}%)`,
                    source: 'form_box',
                    spanStart: leftPct,
                    spanEnd: rightPct
                  });
                }
              }
            }
          }
        }
      }
    } catch (opErr) {
      console.warn('Não foi possível analisar lista de operadores do PDF:', opErr);
    }
  } catch (err) {
    console.warn('Erro ao extrair guias do PDF:', err);
  }

  // Deduplicate and cluster targets within 0.3%
  const deduplicate = (targets: PdfGuideTarget[]): PdfGuideTarget[] => {
    targets.sort((a, b) => a.pos - b.pos);
    const result: PdfGuideTarget[] = [];
    for (const t of targets) {
      if (t.pos < 0.5 || t.pos > 99.5) continue;
      const last = result[result.length - 1];
      if (!last || Math.abs(last.pos - t.pos) > 0.35) {
        result.push(t);
      } else {
        // Keep the one with richer information / more specific label
        if (last.source === 'page_margin' && t.source !== 'page_margin') {
          result[result.length - 1] = t;
        }
      }
    }
    return result;
  };

  return {
    vertical: deduplicate(verticalTargets),
    horizontal: deduplicate(horizontalTargets)
  };
}

/**
 * Calculates snapping for both MOVING and RESIZING fields.
 * Includes magnetic hysteresis (stickiness) and multi-point alignment.
 */
export function calculateSnapping(
  mode: string,
  rawRect: { x: number; y: number; width: number; height: number },
  pdfGuides: { vertical: PdfGuideTarget[]; horizontal: PdfGuideTarget[] },
  otherFields: TemplateField[],
  snapThreshold: number = 1.3
): SnappedResult {
  const activeGuides: { type: 'vertical' | 'horizontal'; pos: number; label: string }[] = [];
  let snappedX = rawRect.x;
  let snappedY = rawRect.y;
  let snappedW = rawRect.width;
  let snappedH = rawRect.height;
  let hasSnappedX = false;
  let hasSnappedY = false;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  // Build full vertical and horizontal target lists
  const vTargets: PdfGuideTarget[] = [...pdfGuides.vertical];
  const hTargets: PdfGuideTarget[] = [...pdfGuides.horizontal];

  // Add field targets from other fields on this page
  otherFields.forEach(f => {
    const name = f.mappedTo.split('.').pop() || f.name || 'Campo';
    // Vertical edges
    vTargets.push({ pos: f.x, type: 'vertical', label: `Esq. ${name}`, source: 'field' });
    vTargets.push({ pos: f.x + f.width, type: 'vertical', label: `Dir. ${name}`, source: 'field' });
    vTargets.push({ pos: f.x + f.width / 2, type: 'vertical', label: `Centro ${name}`, source: 'field' });

    // Horizontal edges
    hTargets.push({ pos: f.y, type: 'horizontal', label: `Topo ${name}`, source: 'field' });
    hTargets.push({ pos: f.y + f.height, type: 'horizontal', label: `Base ${name}`, source: 'field' });
    hTargets.push({ pos: f.y + f.height / 2, type: 'horizontal', label: `Centro ${name}`, source: 'field' });
  });

  // Sort targets
  vTargets.sort((a, b) => a.pos - b.pos);
  hTargets.sort((a, b) => a.pos - b.pos);

  // 1. SNAPPING FOR 'move'
  if (mode === 'move') {
    let bestDistX = snapThreshold;
    let bestSnapX: number | null = null;
    let chosenVGuide: PdfGuideTarget | null = null;

    for (const vt of vTargets) {
      // Left edge match
      const distLeft = Math.abs(rawRect.x - vt.pos);
      if (distLeft < bestDistX) {
        bestDistX = distLeft;
        bestSnapX = vt.pos;
        chosenVGuide = vt;
      }
      // Right edge match
      const distRight = Math.abs(rawRect.x + rawRect.width - vt.pos);
      if (distRight < bestDistX) {
        bestDistX = distRight;
        bestSnapX = vt.pos - rawRect.width;
        chosenVGuide = vt;
      }
      // Center X match
      const distCenterX = Math.abs(rawRect.x + rawRect.width / 2 - vt.pos);
      if (distCenterX < bestDistX) {
        bestDistX = distCenterX;
        bestSnapX = vt.pos - rawRect.width / 2;
        chosenVGuide = vt;
      }
    }

    if (bestSnapX !== null && chosenVGuide) {
      snappedX = clamp(bestSnapX, 0, 100 - rawRect.width);
      hasSnappedX = true;
      activeGuides.push({
        type: 'vertical',
        pos: chosenVGuide.pos,
        label: chosenVGuide.label
      });
    }

    let bestDistY = snapThreshold;
    let bestSnapY: number | null = null;
    let chosenHGuide: PdfGuideTarget | null = null;

    for (const ht of hTargets) {
      // Top edge match
      const distTop = Math.abs(rawRect.y - ht.pos);
      if (distTop < bestDistY) {
        bestDistY = distTop;
        bestSnapY = ht.pos;
        chosenHGuide = ht;
      }
      // Bottom edge match
      const distBottom = Math.abs(rawRect.y + rawRect.height - ht.pos);
      if (distBottom < bestDistY) {
        bestDistY = distBottom;
        bestSnapY = ht.pos - rawRect.height;
        chosenHGuide = ht;
      }
      // Center Y match
      const distCenterY = Math.abs(rawRect.y + rawRect.height / 2 - ht.pos);
      if (distCenterY < bestDistY) {
        bestDistY = distCenterY;
        bestSnapY = ht.pos - rawRect.height / 2;
        chosenHGuide = ht;
      }
    }

    if (bestSnapY !== null && chosenHGuide) {
      snappedY = clamp(bestSnapY, 0, 100 - rawRect.height);
      hasSnappedY = true;
      activeGuides.push({
        type: 'horizontal',
        pos: chosenHGuide.pos,
        label: chosenHGuide.label
      });
    }
  }

  // 2. SNAPPING FOR RESIZING (East, West, South, North, and Corners)
  else {
    const isEast = mode.includes('e');
    const isWest = mode.includes('w');
    const isSouth = mode.includes('s');
    const isNorth = mode.includes('n');

    // Snapping East edge (width changes, x stays same)
    if (isEast) {
      const rightEdge = rawRect.x + rawRect.width;
      let bestDist = snapThreshold;
      let targetPos: number | null = null;
      let guide: PdfGuideTarget | null = null;

      for (const vt of vTargets) {
        const d = Math.abs(rightEdge - vt.pos);
        if (d < bestDist && vt.pos > rawRect.x + 1.0) {
          bestDist = d;
          targetPos = vt.pos;
          guide = vt;
        }
      }

      // Also check equal width with other fields
      for (const of of otherFields) {
        const d = Math.abs(rawRect.width - of.width);
        if (d < bestDist) {
          bestDist = d;
          targetPos = rawRect.x + of.width;
          guide = { pos: rawRect.x + of.width, type: 'vertical', label: `Largura igual (${of.width.toFixed(1)}%)`, source: 'field' };
        }
      }

      if (targetPos !== null && guide) {
        snappedW = clamp(targetPos - rawRect.x, 1.2, 100 - rawRect.x);
        hasSnappedX = true;
        activeGuides.push({ type: 'vertical', pos: guide.pos, label: guide.label });
      }
    }

    // Snapping West edge (x and width change, right edge stays same)
    if (isWest) {
      const rightEdge = rawRect.x + rawRect.width;
      let bestDist = snapThreshold;
      let targetPos: number | null = null;
      let guide: PdfGuideTarget | null = null;

      for (const vt of vTargets) {
        const d = Math.abs(rawRect.x - vt.pos);
        if (d < bestDist && vt.pos < rightEdge - 1.0) {
          bestDist = d;
          targetPos = vt.pos;
          guide = vt;
        }
      }

      if (targetPos !== null && guide) {
        snappedX = clamp(targetPos, 0, rightEdge - 1.2);
        snappedW = rightEdge - snappedX;
        hasSnappedX = true;
        activeGuides.push({ type: 'vertical', pos: guide.pos, label: guide.label });
      }
    }

    // Snapping South edge (height changes, y stays same)
    if (isSouth) {
      const bottomEdge = rawRect.y + rawRect.height;
      let bestDist = snapThreshold;
      let targetPos: number | null = null;
      let guide: PdfGuideTarget | null = null;

      for (const ht of hTargets) {
        const d = Math.abs(bottomEdge - ht.pos);
        if (d < bestDist && ht.pos > rawRect.y + 0.8) {
          bestDist = d;
          targetPos = ht.pos;
          guide = ht;
        }
      }

      // Also check equal height with other fields
      for (const of of otherFields) {
        const d = Math.abs(rawRect.height - of.height);
        if (d < bestDist) {
          bestDist = d;
          targetPos = rawRect.y + of.height;
          guide = { pos: rawRect.y + of.height, type: 'horizontal', label: `Altura igual (${of.height.toFixed(1)}%)`, source: 'field' };
        }
      }

      if (targetPos !== null && guide) {
        snappedH = clamp(targetPos - rawRect.y, 0.8, 100 - rawRect.y);
        hasSnappedY = true;
        activeGuides.push({ type: 'horizontal', pos: guide.pos, label: guide.label });
      }
    }

    // Snapping North edge (y and height change, bottom edge stays same)
    if (isNorth) {
      const bottomEdge = rawRect.y + rawRect.height;
      let bestDist = snapThreshold;
      let targetPos: number | null = null;
      let guide: PdfGuideTarget | null = null;

      for (const ht of hTargets) {
        const d = Math.abs(rawRect.y - ht.pos);
        if (d < bestDist && ht.pos < bottomEdge - 0.8) {
          bestDist = d;
          targetPos = ht.pos;
          guide = ht;
        }
      }

      if (targetPos !== null && guide) {
        snappedY = clamp(targetPos, 0, bottomEdge - 0.8);
        snappedH = bottomEdge - snappedY;
        hasSnappedY = true;
        activeGuides.push({ type: 'horizontal', pos: guide.pos, label: guide.label });
      }
    }
  }

  return {
    rect: {
      x: Math.round(snappedX * 10) / 10,
      y: Math.round(snappedY * 10) / 10,
      width: Math.round(snappedW * 10) / 10,
      height: Math.round(snappedH * 10) / 10
    },
    activeGuides,
    hasSnappedX,
    hasSnappedY
  };
}
