import { describe, expect, test } from "bun:test";
import { initDb } from "../../src/db";
import { loadConfig } from "../../src/config";
import { runOnce } from "../../src/worker";

const dbPath = `./data/test-events-${Date.now()}.sqlite`;

describe("worker e2e (live)", () => {
  test(
    "runs a single polling pass and records rows",
    async () => {
      process.env.EVENTS_KEYWORDS = "";
      const config = loadConfig();
      const db = initDb(dbPath);

      await runOnce(config, db);

      const counts = db.query(
        "SELECT COUNT(*) as count FROM items"
      ).get() as { count: number } | undefined;

      expect(counts?.count ?? 0).toBeGreaterThan(0);
    },
    { timeout: 60_000 }
  );
});
