import { describe, expect, it } from "vitest";
import { moveMappingByKeyboard, resizeMappingByKeyboard } from "@/lib/pdf/mapper-keyboard";
import type { FieldMapping } from "@/types/domain";

const mapping: FieldMapping = {
  id: "map-1",
  templateVersionId: "version-1",
  semanticField: "patient.full_name",
  pdfFieldName: null,
  mappingKind: "overlay",
  page: 1,
  x: 20,
  y: 30,
  width: 100,
  height: 20,
  fontSize: 10,
  alignment: "left",
  multiline: false,
  autoShrink: true,
  maxCharacters: null,
  required: false,
};

describe("mapper keyboard geometry", () => {
  it("moves a mapping by the requested step", () => {
    expect(moveMappingByKeyboard(mapping, "ArrowRight", 10, 595, 842)).toEqual({ x: 30, y: 30 });
    expect(moveMappingByKeyboard(mapping, "ArrowUp", 1, 595, 842)).toEqual({ x: 20, y: 29 });
  });

  it("keeps movement inside the PDF page", () => {
    expect(moveMappingByKeyboard({ ...mapping, x: 0, y: 0 }, "ArrowLeft", 10, 595, 842)).toEqual({ x: 0, y: 0 });
    expect(moveMappingByKeyboard({ ...mapping, x: 500, y: 830 }, "ArrowRight", 10, 595, 842)).toEqual({ x: 495, y: 822 });
  });

  it("resizes with arrow keys and keeps the minimum size", () => {
    expect(resizeMappingByKeyboard(mapping, "ArrowRight", 10, 595, 842)).toEqual({ width: 110, height: 20 });
    expect(resizeMappingByKeyboard({ ...mapping, width: 5, height: 5 }, "ArrowLeft", 10, 595, 842)).toEqual({ width: 4, height: 5 });
    expect(resizeMappingByKeyboard({ ...mapping, width: 5, height: 5 }, "ArrowUp", 10, 595, 842)).toEqual({ width: 5, height: 4 });
  });

  it("keeps resizing inside the page boundary", () => {
    expect(resizeMappingByKeyboard({ ...mapping, x: 560, y: 820, width: 30, height: 20 }, "ArrowRight", 10, 595, 842)).toEqual({ width: 35, height: 20 });
    expect(resizeMappingByKeyboard({ ...mapping, x: 560, y: 820, width: 30, height: 20 }, "ArrowDown", 10, 595, 842)).toEqual({ width: 30, height: 22 });
  });
});
