import { readFile } from "node:fs/promises";
import path from "node:path";

const UNICODE_FONT_PATH = path.join(
  process.cwd(),
  "node_modules",
  "pdfjs-dist",
  "standard_fonts",
  "LiberationSans-Regular.ttf",
);

let fontBytesPromise: Promise<Uint8Array> | null = null;

/**
 * Fonte Unicode local e open-source já distribuída com pdfjs-dist.
 * Mantemos o carregamento no servidor e cacheamos os bytes por processo para
 * não reler a TTF a cada preview/finalização.
 */
export function getPdfUnicodeFontBytes(): Promise<Uint8Array> {
  fontBytesPromise ??= readFile(UNICODE_FONT_PATH).then((buffer) => new Uint8Array(buffer));
  return fontBytesPromise;
}
