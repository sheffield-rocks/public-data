import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SiteState = {
  siteId: string;
  lastCheckedAt: number;
  etag: string | null;
  lastModified: string | null;
};

export type SiteItem = {
  title: string;
  url: string;
  publishedAt: number | null;
  contentHash: string;
};

export function initDb(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);

  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS site_state (
      site_id TEXT PRIMARY KEY,
      last_checked_at INTEGER NOT NULL,
      etag TEXT,
      last_modified TEXT
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      published_at INTEGER,
      content_hash TEXT NOT NULL,
      first_seen_at INTEGER NOT NULL,
      UNIQUE(site_id, content_hash)
    );
  `);

  return db;
}

export function getSiteState(db: Database, siteId: string): SiteState | null {
  const row = db.query(
    `SELECT site_id, last_checked_at, etag, last_modified FROM site_state WHERE site_id = ?`
  ).get(siteId) as
    | {
        site_id: string;
        last_checked_at: number;
        etag: string | null;
        last_modified: string | null;
      }
    | undefined;

  if (!row) return null;
  return {
    siteId: row.site_id,
    lastCheckedAt: row.last_checked_at,
    etag: row.etag,
    lastModified: row.last_modified,
  };
}

export function upsertSiteState(db: Database, state: SiteState) {
  db.query(
    `INSERT INTO site_state (site_id, last_checked_at, etag, last_modified)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(site_id)
     DO UPDATE SET last_checked_at = excluded.last_checked_at,
                   etag = excluded.etag,
                   last_modified = excluded.last_modified`
  ).run(state.siteId, state.lastCheckedAt, state.etag, state.lastModified);
}

export function recordItems(
  db: Database,
  siteId: string,
  items: SiteItem[],
  fetchedAt: number
) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO items
      (site_id, title, url, published_at, content_hash, first_seen_at)
      VALUES (?, ?, ?, ?, ?, ?)`
  );

  const insertMany = db.transaction((batch: SiteItem[]) => {
    for (const item of batch) {
      stmt.run(
        siteId,
        item.title,
        item.url,
        item.publishedAt,
        item.contentHash,
        fetchedAt
      );
    }
  });

  insertMany(items);
}
