import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runWithOptions, writeOutput } from "./bods-gtfsrt-sheffield";

type AnyRecord = Record<string, any>;

test("downloads, filters, and writes a valid GTFS-RT JSON feed", async () => {
  const apiKey = process.env.BODS_API_KEY ?? (globalThis as any).Bun?.env?.BODS_API_KEY;
  expect(apiKey, "BODS_API_KEY missing in environment").toBeTruthy();

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bods-gtfsrt-test-"));
  const outPath = path.join(tmpDir, "filtered.json");

  const options = {
    prefix: "370",
    out: outPath,
    format: "json" as const,
    source: process.env.BODS_SOURCE ?? (globalThis as any).Bun?.env?.BODS_SOURCE,
    apiKey,
  };

  const { bundles, summary } = await runWithOptions(options);
  await writeOutput(options, bundles, summary);

  const raw = await fs.readFile(outPath, "utf8");
  const data = JSON.parse(raw) as AnyRecord;

  expect(data.summary).toBeTruthy();
  expect(data.summary.prefix).toBe("370");
  expect(typeof data.summary.totalEntities).toBe("number");
  expect(typeof data.summary.keptEntities).toBe("number");

  const feeds = data.feeds ? Object.values(data.feeds) : [{ header: data.header, entities: data.entities }];
  expect(feeds.length).toBeGreaterThan(0);

  for (const feed of feeds) {
    const header = (feed as AnyRecord).header;
    const entities = (feed as AnyRecord).entities ?? [];
    expect(header).toBeTruthy();
    expect(Array.isArray(entities)).toBe(true);

    for (const entity of entities) {
      if (entity.trip_update?.stop_time_update?.length) {
        for (const stu of entity.trip_update.stop_time_update) {
          if (typeof stu.stop_id === "string") {
            expect(stu.stop_id.startsWith("370")).toBe(true);
          }
        }
      }
      if (entity.alert?.informed_entity?.length) {
        for (const info of entity.alert.informed_entity) {
          if (typeof info.stop_id === "string") {
            expect(info.stop_id.startsWith("370")).toBe(true);
          }
        }
      }
    }
  }
}, { timeout: 120000 });
