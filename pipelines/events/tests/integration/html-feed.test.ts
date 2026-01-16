import { describe, expect, test } from "bun:test";
import { fetchWithCache } from "../../src/fetcher";
import { parseHtmlItems } from "../../src/parsers/html";

const site = {
  id: "sheffield-city-centre-events",
  name: "Sheffield City Centre Events",
  type: "html" as const,
  url: "https://sheffieldcitycentre.com/events",
  intervalMinutes: 60,
  itemSelector: "article.wall-item",
  titleSelector: ".wall-item__summary",
  urlSelector: ".wall-item__link",
};

describe("html integration (live)", () => {
  test(
    "fetches and parses real HTML",
    async () => {
      const result = await fetchWithCache({ url: site.url });
      if (result.status >= 400) {
        console.warn("html status", site.url, result.status);
      }
      expect(result.status).toBeLessThan(400);
      expect(result.text).not.toBeNull();
      const items = parseHtmlItems(result.text ?? "", site);
      expect(items.length).toBeGreaterThan(0);
    },
    { timeout: 30_000 }
  );
});
