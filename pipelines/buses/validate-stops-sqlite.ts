import fs from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";

const UK_LAT_MIN = 49.0;
const UK_LAT_MAX = 61.5;
const UK_LNG_MIN = -8.5;
const UK_LNG_MAX = 2.5;

type CliOptions = {
  dbPath: string;
};

function resolveDataRoot(): string {
  const cwd = process.cwd();
  const pipelineSuffix = path.join("pipelines", "buses");
  if (cwd.endsWith(pipelineSuffix)) {
    return path.join(cwd, "..", "..");
  }
  return cwd;
}

function getDefaultDbPath(): string {
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
    dbPath: getDefaultDbPath(),
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--db") {
      options.dbPath = args[i + 1] ?? options.dbPath;
      i += 1;
    }
  }

  return options;
}

function logInfo(message: string): void {
  process.stdout.write(`${message}\n`);
}

function logError(message: string): void {
  process.stderr.write(`ERROR: ${message}\n`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function validateNoSidecars(dbPath: string): void {
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  assert(!fs.existsSync(walPath), `Found WAL file: ${walPath}`);
  assert(!fs.existsSync(shmPath), `Found SHM file: ${shmPath}`);
}

function validateStops(dbPath: string): void {
  assert(fs.existsSync(dbPath), `Missing SQLite file: ${dbPath}`);

  const db = new Database(dbPath);
  try {
    const table = db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='stops'"
    ).get();
    assert(table?.name === "stops", "Missing stops table");

    const countRow = db.query("SELECT COUNT(*) as count FROM stops").get() as {
      count: number;
    };
    assert(Number.isFinite(countRow.count) && countRow.count > 0, "Stops table is empty");

    const range = db.query(
      "SELECT MIN(lat) as minLat, MAX(lat) as maxLat, MIN(lng) as minLng, MAX(lng) as maxLng FROM stops"
    ).get() as {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    };

    assert(
      range.minLat >= UK_LAT_MIN && range.maxLat <= UK_LAT_MAX,
      `Latitude range out of bounds: ${range.minLat}..${range.maxLat}`
    );
    assert(
      range.minLng >= UK_LNG_MIN && range.maxLng <= UK_LNG_MAX,
      `Longitude range out of bounds: ${range.minLng}..${range.maxLng}`
    );

    logInfo(`Stops count: ${countRow.count}`);
    logInfo(`Latitude range: ${range.minLat}..${range.maxLat}`);
    logInfo(`Longitude range: ${range.minLng}..${range.maxLng}`);
  } finally {
    db.close();
  }
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv);
  validateStops(options.dbPath);
  validateNoSidecars(options.dbPath);
  logInfo("Validation complete.");
}

if (import.meta.main) {
  run().catch((err) => {
    logError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
