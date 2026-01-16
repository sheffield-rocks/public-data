import { describe, expect, test } from "bun:test";
import { filterItemsByKeywords } from "../src/filters";
import { parseHtmlItems } from "../src/parsers/html";
import { parseRssItems } from "../src/parsers/rss";

const htmlFixture = `
<!doctype html>
<html>
  <body>
    <div class="event">
      <a class="link" href="/events/1">Event One</a>
      <span class="date">2026-02-01</span>
    </div>
    <div class="event">
      <a class="link" href="https://example.com/events/2">Event Two</a>
      <span class="date">2026-03-15</span>
    </div>
  </body>
</html>
`;

const rssFixture = `
<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Sheffield Alerts</title>
    <item>
      <title>First alert</title>
      <link>https://example.com/alert/1</link>
      <pubDate>Mon, 05 Jan 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Second alert</title>
      <link>https://example.com/alert/2</link>
      <pubDate>Tue, 06 Jan 2026 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
`;

const atomFixture = `
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Legislation updates</title>
  <entry>
    <title>Regulation Update A</title>
    <id>https://example.com/legislation/a</id>
    <link href="https://example.com/legislation/a" />
    <updated>2026-01-10T09:00:00Z</updated>
  </entry>
  <entry>
    <title>Regulation Update B</title>
    <id>https://example.com/legislation/b</id>
    <link href="https://example.com/legislation/b" />
    <updated>2026-01-11T09:00:00Z</updated>
  </entry>
</feed>
`;

describe("parseHtmlItems", () => {
  test("extracts title, url, and date", () => {
    const items = parseHtmlItems(htmlFixture, {
      id: "test-html",
      name: "Test HTML",
      type: "html",
      url: "https://example.com",
      intervalMinutes: 60,
      itemSelector: ".event",
      titleSelector: ".link",
      urlSelector: ".link",
      dateSelector: ".date",
    });

    expect(items.length).toBe(2);
    expect(items[0]?.title).toBe("Event One");
    expect(items[0]?.url).toBe("https://example.com/events/1");
    expect(items[0]?.publishedAt).toBe(Date.parse("2026-02-01"));
  });
});

describe("parseRssItems", () => {
  test("extracts items from RSS", () => {
    const items = parseRssItems(rssFixture, {
      id: "test-rss",
      name: "Test RSS",
      type: "rss",
      url: "https://example.com/feed",
      intervalMinutes: 60,
    });

    expect(items.length).toBe(2);
    expect(items[0]?.title).toBe("First alert");
    expect(items[0]?.url).toBe("https://example.com/alert/1");
  });

  test("extracts items from Atom", () => {
    const items = parseRssItems(atomFixture, {
      id: "test-atom",
      name: "Test Atom",
      type: "rss",
      url: "https://example.com/feed",
      intervalMinutes: 60,
    });

    expect(items.length).toBe(2);
    expect(items[1]?.title).toBe("Regulation Update B");
    expect(items[1]?.url).toBe("https://example.com/legislation/b");
  });
});

describe("filterItemsByKeywords", () => {
  test("filters items by keyword matches in title or url", () => {
    const items = [
      {
        title: "Sheffield meetup",
        url: "https://example.com/events/1",
        publishedAt: null,
        contentHash: "a",
      },
      {
        title: "Leeds meetup",
        url: "https://example.com/events/2",
        publishedAt: null,
        contentHash: "b",
      },
      {
        title: "Workshop",
        url: "https://example.com/sheffield/workshop",
        publishedAt: null,
        contentHash: "c",
      },
    ];

    const filtered = filterItemsByKeywords(items, ["Sheffield", "Tramlines"]);
    expect(filtered.length).toBe(2);
    expect(filtered[0]?.title).toBe("Sheffield meetup");
    expect(filtered[1]?.title).toBe("Workshop");
  });
});
