import * as cheerio from "cheerio";
import type { HtmlSite } from "../config";
import type { SiteItem } from "../db";

function hashString(value: string) {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function normalizeUrl(baseUrl: string, href: string | null): string | null {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function parseHtmlItems(html: string, site: HtmlSite): SiteItem[] {
  const $ = cheerio.load(html);

  return $(site.itemSelector)
    .toArray()
    .map((element) => {
      const node = $(element);
      const title = node.find(site.titleSelector).first().text().trim();
      const href = node.find(site.urlSelector).first().attr("href") ?? null;
      const url = normalizeUrl(site.url, href);
      if (!title || !url) return null;

      let publishedAt: number | null = null;
      if (site.dateSelector) {
        const dateText = node.find(site.dateSelector).first().text().trim();
        if (dateText) {
          const parsed = Date.parse(dateText);
          if (!Number.isNaN(parsed)) publishedAt = parsed;
        }
      }

      const contentHash = hashString(`${title}|${url}|${publishedAt ?? ""}`);
      return { title, url, publishedAt, contentHash };
    })
    .filter((item): item is SiteItem => item !== null);
}
