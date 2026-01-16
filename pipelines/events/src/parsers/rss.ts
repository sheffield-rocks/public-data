import { parseFeed } from "@rowanmanning/feed-parser";
import type { RssSite } from "../config";
import type { SiteItem } from "../db";

function hashString(value: string) {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function normalizeUrl(baseUrl: string, href: string | null | undefined): string | null {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function parseRssItems(xml: string, site: RssSite): SiteItem[] {
  let feed;
  try {
    feed = parseFeed(xml);
  } catch (error) {
    const err = error as { code?: string; message?: string };
    console.warn("feed parse failed", site.id, err.code ?? err.message ?? err);
    return [];
  }

  return feed.items
    .map((item) => {
      const title = item.title?.trim() ?? "";
      const url = normalizeUrl(site.url, item.url ?? item.id ?? null);
      if (!title || !url) return null;

      const date = item.published ?? item.updated ?? null;
      const publishedAt = date ? date.getTime() : null;

      const contentHash = hashString(`${title}|${url}|${publishedAt ?? ""}`);
      return { title, url, publishedAt, contentHash };
    })
    .filter((item): item is SiteItem => item !== null);
}
