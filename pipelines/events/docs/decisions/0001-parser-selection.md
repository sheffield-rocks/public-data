# 0001 - Parser + AI fallback selection

Date: 2026-01-15

## Status
Accepted

## Context
We need to poll a mix of event sources:
- HTML pages without structured feeds
- RSS/Atom feeds (e.g. Google Alerts for "Sheffield")
- Potentially other sources that are not simple feeds

The worker runs on Bun and should be fast, robust, and simple to configure.

## Decision
- Use Cheerio for HTML parsing and CSS selectors.
- Use @rowanmanning/feed-parser for RSS/Atom parsing.
- For sources that are not parseable as event feeds (e.g. irregular HTML, PDFs, or email-like pages), route the content to an AI extractor to pull out candidate event details.

## Rationale
- Cheerio is fast and widely used for server-side HTML parsing with a jQuery-style API.
- @rowanmanning/feed-parser is designed to parse real-world RSS/Atom feeds and returns normalized fields.
- AI extraction provides a safety net for sources that are too irregular to maintain bespoke scrapers.

## Consequences
- HTML parsing now depends on Cheerio.
- Feed parsing now depends on @rowanmanning/feed-parser.
- @rowanmanning/feed-parser documents a Node.js 20+ runtime requirement; we should verify Bun compatibility in our deployment environment.
- AI extraction is planned but not yet implemented; it requires a provider choice (e.g. OpenAI) and an extraction schema.

## Follow-ups
- Implement AI extraction pipeline and storage for extracted events.
- Add per-site parsing profiles and quality checks.
