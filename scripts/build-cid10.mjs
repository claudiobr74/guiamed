import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SOURCE_URL = "http://www2.datasus.gov.br/cid10/V2008/downloads/CID10CSV.zip";
const SOURCE_ARCHIVE_SHA256 = "84f23809275575f751255048064bbb244b0de33fd5987ab98df0f98e5f5d2c95";
const SOURCE_FILE = "CID-10-SUBCATEGORIAS.CSV";
const SOURCE_FILE_SHA256 = "1a85bef8f2065ad3e95ab07b6441e6f03404c54ab35849ebd4edccc3ba234e60";
const OUTPUT_PATH = resolve("src/data/cid10-br-v2008.json");

const inputPath = process.argv[2];
if (!inputPath) {
  console.error(`Uso: node scripts/build-cid10.mjs /caminho/${SOURCE_FILE}`);
  process.exit(1);
}

const input = await readFile(resolve(inputPath));
const inputSha256 = createHash("sha256").update(input).digest("hex");
if (inputSha256 !== SOURCE_FILE_SHA256) {
  throw new Error(
    `O hash do arquivo CID-10 não corresponde à versão oficial esperada. Esperado ${SOURCE_FILE_SHA256}; recebido ${inputSha256}.`,
  );
}

const text = new TextDecoder("windows-1252").decode(input).replace(/\r\n?/g, "\n");
const lines = text.trimEnd().split("\n");
const header = lines.shift()?.split(";").slice(0, 8);
const expectedHeader = [
  "SUBCAT",
  "CLASSIF",
  "RESTRSEXO",
  "CAUSAOBITO",
  "DESCRICAO",
  "DESCRABREV",
  "REFER",
  "EXCLUIDOS",
];

if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) {
  throw new Error("Cabeçalho inesperado no arquivo oficial de subcategorias CID-10.");
}

const seen = new Set();
const codes = lines.map((line, index) => {
  const columns = line.split(";");
  if (columns.length !== 9 || columns[8] !== "") {
    throw new Error(`Linha ${index + 2}: quantidade de colunas inválida.`);
  }

  const [rawCode, classification, sexRestriction, causeOfDeath, description, , reference, excluded] = columns;
  if (!/^[A-Z][0-9]{2}[0-9]?$/.test(rawCode)) {
    throw new Error(`Linha ${index + 2}: código CID-10 inválido (${rawCode || "vazio"}).`);
  }
  if (!description.trim()) {
    throw new Error(`Linha ${index + 2}: descrição CID-10 vazia.`);
  }
  if (seen.has(rawCode)) {
    throw new Error(`Linha ${index + 2}: código CID-10 duplicado (${rawCode}).`);
  }
  if (classification && classification !== "+" && classification !== "*") {
    throw new Error(`Linha ${index + 2}: classificação CID-10 inválida (${classification}).`);
  }
  if (sexRestriction && sexRestriction !== "F" && sexRestriction !== "M") {
    throw new Error(`Linha ${index + 2}: restrição de sexo inválida (${sexRestriction}).`);
  }
  if (causeOfDeath && causeOfDeath !== "N") {
    throw new Error(`Linha ${index + 2}: indicador de causa de óbito inválido (${causeOfDeath}).`);
  }

  seen.add(rawCode);
  const code = rawCode.length === 4 ? `${rawCode.slice(0, 3)}.${rawCode.slice(3)}` : rawCode;
  return [
    code,
    description.trim(),
    classification || null,
    sexRestriction || null,
    causeOfDeath === "N",
    reference || null,
    excluded || null,
  ];
});

if (codes.length !== 12_451) {
  throw new Error(`Quantidade inesperada de códigos CID-10: ${codes.length}.`);
}

const metadata = {
  name: "Classificação Estatística Internacional de Doenças e Problemas Relacionados à Saúde — CID-10 Brasil",
  version: "DATASUS V2008",
  sourceOrganization: "Ministério da Saúde — DATASUS",
  sourceUrl: SOURCE_URL,
  sourceFile: SOURCE_FILE,
  sourceArchiveSha256: SOURCE_ARCHIVE_SHA256,
  sourceFileSha256: SOURCE_FILE_SHA256,
  recordCount: codes.length,
};

const rows = codes.map((row) => `    ${JSON.stringify(row)}`).join(",\n");
const output = `{
  "metadata": ${JSON.stringify(metadata, null, 2).replace(/\n/g, "\n  ")},
  "codes": [
${rows}
  ]
}\n`;

await writeFile(OUTPUT_PATH, output, "utf8");
console.log(`CID-10 gerada: ${codes.length} códigos em ${OUTPUT_PATH}`);
