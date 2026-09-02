export interface PdfPointRect {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function viewportToPdfPoints(params: {
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
  pageWidthPt: number;
  pageHeightPt: number;
}): { x: number; y: number } {
  const scaleX = params.pageWidthPt / params.canvasWidth;
  const scaleY = params.pageHeightPt / params.canvasHeight;
  return {
    x: params.canvasX * scaleX,
    y: params.canvasY * scaleY,
  };
}

export function topLeftToPdfLib(params: {
  x: number;
  y: number;
  height: number;
  pageHeightPt: number;
}): { x: number; y: number } {
  return {
    x: params.x,
    y: params.pageHeightPt - params.y - params.height,
  };
}

export function fitFontSize(params: {
  text: string;
  maxWidth: number;
  fontSize: number;
  autoShrink: boolean;
  minSize?: number;
  charWidthFactor?: number;
}): number {
  const factor = params.charWidthFactor ?? 0.55;
  if (!params.autoShrink) return params.fontSize;
  const estimated = params.text.length * params.fontSize * factor;
  if (estimated <= params.maxWidth) return params.fontSize;
  const next = params.fontSize * (params.maxWidth / Math.max(estimated, 1));
  return Math.max(params.minSize ?? 6, next);
}

export function clipText(text: string, maxCharacters: number | null): string {
  if (!maxCharacters || text.length <= maxCharacters) return text;
  return text.slice(0, maxCharacters);
}
