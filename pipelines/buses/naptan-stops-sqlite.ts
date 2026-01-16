/**
 * Build a SQLite stops database for Sheffield (NaPTAN access-nodes CSV).
 *
 * Run locally:
 *   bun run naptan-stops-sqlite.ts
 *   bun run naptan-stops-sqlite.ts --prefix 370
 *   bun run naptan-stops-sqlite.ts --out ./tmp/stops.sqlite
 *   bun run naptan-stops-sqlite.ts --source ./access-nodes.csv
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import csvParser from "csv-parser";
import { Database } from "bun:sqlite";

const DEFAULT_SOURCE = "https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv";
const DEFAULT_ATCO_PREFIX = "370";
const BATCH_SIZE = 2000;

type CliOptions = {
  source: string;
  out: string;
  atcoPrefix: string | null;
  useRtree: boolean;
};

type StopRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  localityName?: string;
  adminAreaCode?: string;
  stopType?: string;
  stopAreaCode?: string;
  indicator?: string;
  street?: string;
  bearing?: string;
  nptgLocalityCode?: string;
  status?: string;
};

function resolveDataRoot(): string {
  const cwd = process.cwd();
  const pipelineSuffix = path.join("pipelines", "buses");
  if (cwd.endsWith(pipelineSuffix)) {
    return path.join(cwd, "..", "..");
  }
  return cwd;
}

function getDefaultOutPath(): string {
  const dataDir = process.env.SHEFFIELD_DATA_DIR;
  if (dataDir) {
    return path.join(dataDir, "data", "buses", "stops.sqlite");
  }
  const root = resolveDataRoot();
  return path.join(root, "data", "buses", "stops.sqlite");
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const options: CliOptions = {
    source: DEFAULT_SOURCE,
    out: getDefaultOutPath(),
    atcoPrefix: DEFAULT_ATCO_PREFIX,
    useRtree: true,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--source") {
      options.source = args[i + 1] ?? options.source;
      i += 1;
    } else if (arg === "--out") {
      options.out = args[i + 1] ?? options.out;
      i += 1;
    } else if (arg === "--prefix" || arg === "--atcoPrefix") {
      const value = args[i + 1];
      if (value === "all" || value === "*") {
        options.atcoPrefix = null;
      } else {
        options.atcoPrefix = value ?? options.atcoPrefix;
      }
      i += 1;
    } else if (arg === "--no-rtree") {
      options.useRtree = false;
    }
  }

  return options;
}

function logInfo(message: string): void {
  process.stdout.write(`${message}\n`);
}

function logWarn(message: string): void {
  process.stderr.write(`WARN: ${message}\n`);
}

function logError(message: string): void {
  process.stderr.write(`ERROR: ${message}\n`);
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return url;
  }
}

function isRemoteSource(source: string): boolean {
  return /^https?:/i.test(source);
}

async function resolveSourceToTempFile(source: string): Promise<{ tmpPath: string; tmpDir: string }> {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "naptan-"));
  const tmpPath = path.join(tmpDir, "access-nodes.csv");

  if (isRemoteSource(source)) {
    logInfo(`Downloading: ${sanitizeUrl(source)}`);
    const response = await fetch(source, {
      headers: {
        accept: "text/csv",
      },
    });
    if (!response.ok || !response.body) {
      throw new Error(`Network error: ${response.status} ${response.statusText}`);
    }
    const fileStream = fs.createWriteStream(tmpPath);
    await pipeline(Readable.fromWeb(response.body), fileStream);
  } else {
    const localPath = source.startsWith("file://") ? new URL(source) : source;
    const resolvedPath = localPath instanceof URL ? localPath : path.resolve(localPath);
    logInfo(`Using local file: ${resolvedPath}`);
    await fsp.copyFile(resolvedPath, tmpPath);
  }

  return { tmpPath, tmpDir };
}

async function createTempDbPath(outPath: string): Promise<{ tmpPath: string; tmpDir: string }> {
  const outDir = path.dirname(outPath);
  await fsp.mkdir(outDir, { recursive: true });
  const tmpDir = await fsp.mkdtemp(path.join(outDir, ".stops-"));
  return { tmpPath: path.join(tmpDir, path.basename(outPath)), tmpDir };
}

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function parseNumber(raw?: string): number | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function mapRow(row: Record<string, string>, atcoPrefix: string | null): StopRow | null {
  const id = pick(row, ["ATCOCode", "AtcoCode", "atcocode"]);
  if (!id) return null;

  if (atcoPrefix && !id.startsWith(atcoPrefix)) {
    return null;
  }

  const areaCode = pick(row, ["AdministrativeAreaCode", "AdminAreaCode", "administrativeareacode"]);
  const lat = parseNumber(pick(row, ["Latitude", "latitude", "Lat", "lat"]));
  const lng = parseNumber(pick(row, ["Longitude", "longitude", "Lon", "lon", "Lng", "lng"]));
  if (lat === undefined || lng === undefined) return null;

  const name =
    pick(row, ["CommonName", "StopName", "ShortCommonName", "Descriptor", "Name", "name"]) ?? id;

  return {
    id,
    name,
    lat,
    lng,
    localityName: pick(row, ["LocalityName", "Town"]),
    adminAreaCode: areaCode,
    stopType: pick(row, ["StopType"]),
    stopAreaCode: pick(row, ["StopAreaCode"]),
    indicator: pick(row, ["Indicator"]),
    street: pick(row, ["Street"]),
    bearing: pick(row, ["Bearing"]),
    nptgLocalityCode: pick(row, ["NptgLocalityCode"]),
    status: pick(row, ["Status"]),
  };
}

async function ensureNoSidecars(dbPath: string): Promise<void> {
  await fsp.rm(`${dbPath}-wal`, { force: true });
  await fsp.rm(`${dbPath}-shm`, { force: true });
}

function setupSchema(db: Database, useRtree: boolean): { rtreeEnabled: boolean } {
  db.exec("PRAGMA journal_mode = DELETE;");
  db.exec("PRAGMA synchronous = OFF;");
  db.exec("PRAGMA temp_store = MEMORY;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS stops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      locality_name TEXT,
      admin_area_code TEXT,
      stop_type TEXT,
      stop_area_code TEXT,
      indicator TEXT,
      street TEXT,
      bearing TEXT,
      nptg_locality_code TEXT,
      status TEXT
    );
  `);

  db.exec("CREATE INDEX IF NOT EXISTS idx_stops_lat ON stops(lat);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_stops_lng ON stops(lng);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_stops_admin_area ON stops(admin_area_code);");

  let rtreeEnabled = false;
  if (useRtree) {
    try {
      db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS stops_rtree USING rtree(id, minX, maxX, minY, maxY);");
      rtreeEnabled = true;
    } catch (error) {
      rtreeEnabled = false;
    }
  }

  return { rtreeEnabled };
}

async function buildStopsSqlite(options: CliOptions): Promise<void> {
  const { tmpPath: csvPath, tmpDir: csvDir } = await resolveSourceToTempFile(options.source);
  const { tmpPath: dbPath, tmpDir: dbDir } = await createTempDbPath(options.out);
  const db = new Database(dbPath);
  const { rtreeEnabled } = setupSchema(db, options.useRtree);

  const insertStop = db.query(`
    INSERT OR IGNORE INTO stops (
      id,
      name,
      lat,
      lng,
      locality_name,
      admin_area_code,
      stop_type,
      stop_area_code,
      indicator,
      street,
      bearing,
      nptg_locality_code,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  const insertRtree = rtreeEnabled
    ? db.query("INSERT OR REPLACE INTO stops_rtree (id, minX, maxX, minY, maxY) VALUES (?, ?, ?, ?, ?);")
    : null;

  let totalRows = 0;
  let keptRows = 0;
  let skippedRows = 0;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  const batch: StopRow[] = [];
  const insertBatch = db.transaction((rows: StopRow[]) => {
    for (const row of rows) {
      const result = insertStop.run(
        row.id,
        row.name,
        row.lat,
        row.lng,
        row.localityName ?? null,
        row.adminAreaCode ?? null,
        row.stopType ?? null,
        row.stopAreaCode ?? null,
        row.indicator ?? null,
        row.street ?? null,
        row.bearing ?? null,
        row.nptgLocalityCode ?? null,
        row.status ?? null
      );
      if (insertRtree && result.changes === 1) {
        const rowid = Number(result.lastInsertRowid);
        if (Number.isFinite(rowid)) {
          insertRtree.run(rowid, row.lng, row.lng, row.lat, row.lat);
        }
      }
    }
  });

  try {
    const stream = fs.createReadStream(csvPath).pipe(csvParser());
    for await (const raw of stream as AsyncIterable<Record<string, string>>) {
      totalRows += 1;
      const mapped = mapRow(raw, options.atcoPrefix);
      if (!mapped) {
        skippedRows += 1;
        continue;
      }

      keptRows += 1;
      minLat = Math.min(minLat, mapped.lat);
      maxLat = Math.max(maxLat, mapped.lat);
      minLng = Math.min(minLng, mapped.lng);
      maxLng = Math.max(maxLng, mapped.lng);

      batch.push(mapped);
      if (batch.length >= BATCH_SIZE) {
        insertBatch(batch.splice(0, batch.length));
      }
    }

    if (batch.length > 0) {
      insertBatch(batch.splice(0, batch.length));
    }

    db.exec("PRAGMA optimize;");
    db.exec("VACUUM;");
  } finally {
    db.close();
    await fsp.rm(csvDir, { recursive: true, force: true });
  }

  await ensureNoSidecars(dbPath);

  await fsp.rm(options.out, { force: true });
  await fsp.rename(dbPath, options.out);
  await fsp.rm(dbDir, { recursive: true, force: true });
  await ensureNoSidecars(options.out);

  logInfo(`Rows processed: ${totalRows}`);
  logInfo(`Rows kept: ${keptRows}`);
  logInfo(`Rows skipped: ${skippedRows}`);
  if (keptRows > 0) {
    logInfo(`Latitude range: ${minLat.toFixed(6)} to ${maxLat.toFixed(6)}`);
    logInfo(`Longitude range: ${minLng.toFixed(6)} to ${maxLng.toFixed(6)}`);
  }

  if (options.atcoPrefix) {
    logInfo(`ATCO prefix filter: ${options.atcoPrefix}`);
  } else {
    logInfo("ATCO prefix filter: none");
  }

  if (options.useRtree && !rtreeEnabled) {
    logWarn("RTree module unavailable; using lat/lng indexes only.");
  } else if (rtreeEnabled) {
    logInfo("RTree enabled for spatial lookups.");
  }

  logInfo(`Done. Wrote ${options.out}`);
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv);
  await buildStopsSqlite(options);
}

if (import.meta.main) {
  run().catch((err) => {
    logError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
