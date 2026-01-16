import type { Database } from "bun:sqlite";
import type { Config } from "./config";
import { getSiteState, upsertSiteState, recordItems } from "./db";
import { fetchWithCache } from "./fetcher";
import { filterItemsByKeywords } from "./filters";
import { parseHtmlItems } from "./parsers/html";
import { parseRssItems } from "./parsers/rss";

export async function checkSite(
  config: Config,
  db: Database,
  siteId: string
): Promise<void> {
  const site = config.sites.find((s) => s.id === siteId);
  if (!site) return;

  const state = getSiteState(db, site.id);
  const now = Date.now();
  const nextDue = (state?.lastCheckedAt ?? 0) + site.intervalMinutes * 60_000;
  if (now < nextDue) return;

  const { status, text, etag, lastModified, fetchedAt } = await fetchWithCache({
    url: site.url,
    etag: state?.etag ?? undefined,
    lastModified: state?.lastModified ?? undefined,
    timeoutMs: 30_000,
  });

  if (status === 0 || status >= 400) {
    upsertSiteState(db, {
      siteId: site.id,
      lastCheckedAt: fetchedAt,
      etag: etag ?? state?.etag ?? null,
      lastModified: lastModified ?? state?.lastModified ?? null,
    });
    return;
  }

  if (status === 304 || text === null) {
    upsertSiteState(db, {
      siteId: site.id,
      lastCheckedAt: fetchedAt,
      etag: etag ?? state?.etag ?? null,
      lastModified: lastModified ?? state?.lastModified ?? null,
    });
    return;
  }

  const items = site.type === "rss"
    ? parseRssItems(text, site)
    : parseHtmlItems(text, site);

  const filteredItems = filterItemsByKeywords(items, config.keywords);
  recordItems(db, site.id, filteredItems, fetchedAt);

  upsertSiteState(db, {
    siteId: site.id,
    lastCheckedAt: fetchedAt,
    etag: etag ?? null,
    lastModified: lastModified ?? null,
  });
}

export async function runOnce(config: Config, db: Database): Promise<void> {
  for (const site of config.sites) {
    await checkSite(config, db, site.id);
  }
}
