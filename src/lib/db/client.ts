import { PGlite } from "@electric-sql/pglite";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

type GlobalDb = typeof globalThis & { __guiamedDb?: PGlite; __guiamedReady?: Promise<PGlite> };

const g = globalThis as GlobalDb;

async function migrate(db: PGlite): Promise<void> {
  const migrationPath = path.join(process.cwd(), "supabase/migrations/0001_init.sql");
  let sql = readFileSync(migrationPath, "utf8");
  sql = sql.replaceAll("EXECUTE FUNCTION", "EXECUTE PROCEDURE");
  try {
    await db.exec(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) {
      throw error;
    }
  }
  await seedCid(db);
}

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

async function seedCid(db: PGlite): Promise<void> {
  for (const [code, description] of CID_SEED) {
    await db.query(
      `INSERT INTO cid_codes (code, description, version, active)
       VALUES ($1, $2, 'CID-10', true)
       ON CONFLICT (code, version) DO NOTHING`,
      [code, description],
    );
  }
}

export async function getDb(): Promise<PGlite> {
  if (g.__guiamedDb) return g.__guiamedDb;
  if (!g.__guiamedReady) {
    g.__guiamedReady = (async () => {
      const dataDir = path.join(process.cwd(), "data", "pglite");
      if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
      const db = new PGlite(dataDir);
      await db.waitReady;
      await migrate(db);
      g.__guiamedDb = db;
      return db;
    })();
  }
  return g.__guiamedReady;
}

export async function withRls<T>(
  orgId: string | null,
  userId: string | null,
  fn: (db: PGlite) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  await db.query("SELECT set_config('app.org_id', $1, false)", [orgId ?? ""]);
  await db.query("SELECT set_config('app.user_id', $1, false)", [userId ?? ""]);
  return fn(db);
}

export async function query<T>(
  db: PGlite,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await db.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T>(
  db: PGlite,
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(db, text, params);
  return rows[0] ?? null;
}
