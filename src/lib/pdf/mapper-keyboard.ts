import type { FieldMapping } from "@/types/domain";

export type MapperArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export function isMapperArrowKey(value: string): value is MapperArrowKey {
  return value === "ArrowLeft" || value === "ArrowRight" || value === "ArrowUp" || value === "ArrowDown";
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function moveMappingByKeyboard(
  mapping: FieldMapping,
  key: MapperArrowKey,
  step: number,
  pageWidth: number,
  pageHeight: number,
): Pick<FieldMapping, "x" | "y"> {
  const safeStep = Math.max(0, step);
  const dx = key === "ArrowLeft" ? -safeStep : key === "ArrowRight" ? safeStep : 0;
  const dy = key === "ArrowUp" ? -safeStep : key === "ArrowDown" ? safeStep : 0;
  return {
    x: clamp(mapping.x + dx, 0, Math.max(0, pageWidth - mapping.width)),
    y: clamp(mapping.y + dy, 0, Math.max(0, pageHeight - mapping.height)),
  };
}

export function resizeMappingByKeyboard(
  mapping: FieldMapping,
  key: MapperArrowKey,
  step: number,
  pageWidth: number,
  pageHeight: number,
): Pick<FieldMapping, "width" | "height"> {
  const safeStep = Math.max(0, step);
  const widthDelta = key === "ArrowLeft" ? -safeStep : key === "ArrowRight" ? safeStep : 0;
  const heightDelta = key === "ArrowUp" ? -safeStep : key === "ArrowDown" ? safeStep : 0;
  return {
    width: clamp(mapping.width + widthDelta, 4, Math.max(4, pageWidth - mapping.x)),
    height: clamp(mapping.height + heightDelta, 4, Math.max(4, pageHeight - mapping.y)),
  };
}
