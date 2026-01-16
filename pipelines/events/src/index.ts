import { loadConfig } from "./config";
import { initDb } from "./db";
import { checkSite } from "./worker";

const config = loadConfig();
const db = initDb(config.databasePath);

async function runLoop() {
  // Stagger initial checks to avoid burst requests.
  const delayMs = config.pollJitterMs;
  const sites = config.sites;

  for (let i = 0; i < sites.length; i += 1) {
    const siteId = sites[i]!.id;
    setTimeout(() => {
      checkSite(config, db, siteId).catch((err) => {
        console.error("site check failed", siteId, err);
      });
    }, i * delayMs);
  }
}

async function main() {
  console.log("sheffield.rocks events worker starting...");
  await runLoop();

  setInterval(() => {
    runLoop().catch((err) => console.error("poll loop failed", err));
  }, config.pollIntervalMinutes * 60_000);
}

main().catch((err) => {
  console.error("fatal error", err);
  process.exit(1);
});
