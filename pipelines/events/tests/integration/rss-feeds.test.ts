import { describe, expect, test } from "bun:test";
import { parseFeed } from "@rowanmanning/feed-parser";

const feeds = [
  "https://feeds.bbci.co.uk/news/england/rss.xml",
  "https://sheffieldcitycentre.com/rss",
  "https://www.food.gov.uk/rss-feed/news",
  "https://www.steelcitystriders.co.uk/feed/",
  "https://www.legislation.gov.uk/new/scotland/data.feed",
];

describe("rss/atom integration (live)", () => {
  test(
    "fetches and parses real feeds",
    async () => {
      for (const url of feeds) {
        const response = await fetch(url, {
          headers: { "User-Agent": "sheffield.rocks-events-test/0.1" },
        });
        if (response.status >= 400) {
          console.warn("feed status", url, response.status);
        }
        expect(response.status).toBeLessThan(400);
        const xml = await response.text();
        const feed = parseFeed(xml);
        expect(feed.items.length).toBeGreaterThan(0);
      }
    },
    { timeout: 30_000 }
  );
});
