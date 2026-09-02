import type { Db } from "@/lib/db/client";
import type { CidCode } from "@/types/domain";

const CID_SEED: Array<[string, string]> = [
  ["M50.0", "Transtorno do disco cervical com mielopatia"],
  ["M50.1", "Transtorno do disco cervical com radiculopatia"],
  ["M51.1", "Transtornos de discos lombares e de outros discos intervertebrais com radiculopatia"],
  ["M54.1", "Radiculopatia"],
  ["M54.5", "Dor lombar baixa"],
  ["G97.8", "Outros transtornos do sistema nervoso pós-procedimento"],
  ["I25.1", "Doença aterosclerótica do coração"],
  ["K80.0", "Calculose da vesícula biliar com colecistite aguda"],
  ["K80.1", "Calculose da vesícula biliar com outra colecistite"],
  ["E66.0", "Obesidade devida a excesso de calorias"],
  ["E66.8", "Outra obesidade"],
  ["K35.8", "Outras apendicites agudas"],
  ["N20.0", "Cálculo do rim"],
  ["C16.9", "Neoplasia maligna do estômago, não especificada"],
  ["S72.0", "Fratura do colo do fêmur"],
];

export async function seedCidCodes(db: Db): Promise<void> {
  const marker = db.collection("cidCodes").doc("_seeded");
  const existing = await marker.get();
  if (existing.exists) return;
  const batch = db.batch();
  for (const [code, description] of CID_SEED) {
    const ref = db.collection("cidCodes").doc(code.replace(/\./g, "_"));
    const data: CidCode = {
      id: ref.id,
      code,
      description,
      version: "CID-10",
      active: true,
    };
    batch.set(ref, data, { merge: true });
  }
  batch.set(marker, { at: new Date().toISOString(), version: "CID-10" });
  await batch.commit();
}
