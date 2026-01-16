import { loadConfig } from "./config";
import { initDb } from "./db";
import { runOnce } from "./worker";
import { promises as fs } from "node:fs";

async function main() {
  const config = loadConfig();
  const db = initDb(config.databasePath);

  console.log("sheffield.rocks events worker (run-once) starting...");
  await runOnce(config, db);
  try {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch (error) {
    console.warn("wal checkpoint failed", error);
  }
  db.close();

  const walPath = `${config.databasePath}-wal`;
  const shmPath = `${config.databasePath}-shm`;
  await fs.rm(walPath, { force: true });
  await fs.rm(shmPath, { force: true });
  console.log("run-once complete");
}

main().catch((err) => {
  console.error("run-once failed", err);
  process.exit(1);
});
