import { mkdir, readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../data/cid10-br-v2008.json', import.meta.url);
const outputDir = new URL('../public/data/', import.meta.url);
const outputPath = new URL('../public/data/cid10.json', import.meta.url);

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const rows = Array.isArray(source) ? source : source.codes;

if (!Array.isArray(rows)) {
  throw new Error('Base CID-10 inválida: lista de códigos não encontrada.');
}

const compact = rows.map((row) => {
  if (Array.isArray(row)) return { code: row[0], description: row[1] };
  return { code: row.code, description: row.description };
}).filter((row) => row.code && row.description);

if (compact.length < 10000) {
  throw new Error(`Base CID-10 incompleta: apenas ${compact.length} registros.`);
}

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, JSON.stringify(compact), 'utf8');
console.log(`CID-10 preparado: ${compact.length} códigos.`);
