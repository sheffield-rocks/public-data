# sheffield.rocks events pipeline

A small Bun worker that polls a list of event sources, stores items in SQLite, and keeps change state (ETag/Last-Modified) so we only re-parse when something changes. This repository is designed for an open‑source community project.

## Quick start (local dev)

1) Install Bun (if not already installed).
2) Install dependencies:
```bash
bun install
```
3) Run the worker:
```bash
BUN_TMPDIR=/tmp bun run src/index.ts
```

If Bun complains about temp directory permissions, ensure `BUN_TMPDIR=/tmp` is set.

## Run the program (detailed)

The worker can run as a long‑running process or as a single pass for cron workflows.

### Local run
```bash
BUN_TMPDIR=/tmp bun run src/index.ts
```

### Run once (for cron workflows)
```bash
BUN_TMPDIR=/tmp bun run src/run-once.ts
```

### Run with custom database location
```bash
EVENTS_DB_PATH=./data/events/events.sqlite BUN_TMPDIR=/tmp bun run src/index.ts
```

### Use the shared data repo (recommended)
```bash
SHEFFIELD_DATA_DIR=/path/to/sheffield.rocks/data BUN_TMPDIR=/tmp bun run src/index.ts
```

### Run once with the shared data repo
```bash
SHEFFIELD_DATA_DIR=/path/to/sheffield.rocks/data BUN_TMPDIR=/tmp bun run src/run-once.ts
```

### Run with custom polling interval
```bash
EVENTS_POLL_INTERVAL_MINUTES=10 BUN_TMPDIR=/tmp bun run src/index.ts
```

### Run with custom keywords
```bash
EVENTS_KEYWORDS="Sheffield,South Yorkshire,Tramlines" BUN_TMPDIR=/tmp bun run src/index.ts
```

### Expected output
- Logs that the worker has started
- Warnings for any failed requests (HTTP errors/timeouts)
- Data stored in `./data/events/events.sqlite` (or the data repo path when `SHEFFIELD_DATA_DIR` is set)

## Configure sources

Edit `config/sites.json` and replace or extend the URLs/selectors.

Current default sources are UK-based RSS feeds covering England, Scotland, Wales, Northern Ireland, plus Food Standards Agency and West Yorkshire Police. These are intended as a free “alert layer” that we can keyword-filter for local events.

Notes:
- Sheffield Forum is Cloudflare-protected; RSS may return a challenge page. We may need a different access path or permission.
- WordPress sites are supported via their standard RSS feed at `/feed/` (e.g. Steel City Striders).

- `type: "html"` uses CSS selectors to pull items from a page.
- `type: "rss"` expects RSS/Atom (e.g. a Google Alerts RSS feed URL).

Example HTML site definition:

```json
{
  "id": "example-events",
  "name": "Example Events",
  "type": "html",
  "url": "https://example.com/events",
  "intervalMinutes": 60,
  "itemSelector": ".event-card",
  "titleSelector": ".event-title",
  "urlSelector": "a",
  "dateSelector": ".event-date"
}
```

Example RSS site definition:

```json
{
  "id": "google-alerts-sheffield",
  "name": "Google Alerts: Sheffield",
  "type": "rss",
  "url": "https://your-google-alerts-feed-url",
  "intervalMinutes": 30
}
```

## Parsing approach

- HTML parsing uses Cheerio with CSS selectors.
- RSS/Atom parsing uses @rowanmanning/feed-parser.
- For sources that are not structured as feeds, we plan to route content through an AI extractor (not yet implemented).
- Keyword filtering uses `config/keywords.json` (override with `EVENTS_KEYWORDS`).

## Data storage

SQLite database is created at `./data/events/events.sqlite` by default, or at
`$SHEFFIELD_DATA_DIR/data/events/events.sqlite` when `SHEFFIELD_DATA_DIR` is set.

Override with:

```bash
EVENTS_DB_PATH=/path/to/events.sqlite bun run src/index.ts
```

## Tests

```bash
BUN_TMPDIR=/tmp bun test
```

Test pyramid (all live, no mocks):
- Unit: parser + keyword filter tests (local fixtures)
- Integration: live fetch + parse for real RSS/Atom and one HTML page
- E2E: run the worker once against all configured sources and assert items are stored

Note: live tests are non-deterministic by nature (network + feed content). We can add record/replay or mocks later if needed.

Common commands:
```bash
BUN_TMPDIR=/tmp bun run test:unit
BUN_TMPDIR=/tmp bun run test:integration
BUN_TMPDIR=/tmp bun run test:e2e
BUN_TMPDIR=/tmp bun run test:live
```

### Test pyramid (explained)

- Unit tests: parser + keyword filtering on local fixtures (deterministic).
- Integration tests: live fetch + parse of real RSS/Atom and HTML pages (non‑deterministic).
- E2E tests: run a single polling pass against configured sources and assert items are stored (non‑deterministic).

If live tests become too flaky, we can introduce record/replay or mocking in a later phase.

## Code overview (high level)

```
src/
  index.ts            # process entrypoint + poll scheduler
  worker.ts           # single-site check + run-once helper (for e2e)
  config.ts           # config loader (env + JSON)
  fetcher.ts          # HTTP fetch with caching headers + timeout
  db.ts               # SQLite schema + persistence helpers
  filters.ts          # keyword filtering
  parsers/
    html.ts           # Cheerio-based HTML parsing
    rss.ts            # RSS/Atom parsing
config/
  sites.json          # source list (HTML + RSS)
  keywords.json       # default keyword list
tests/
  parsers.test.ts     # unit tests
  integration/        # live integration tests
  e2e/                # end-to-end tests
```

## Contributing (quick guidance)

- Keep selectors and feeds in `config/sites.json`.
- Prefer RSS/Atom when available; use HTML scraping only when necessary.
- Add a unit test for any new parser logic.
- Add a live integration test for any new source if it is stable.
- Keep the worker idempotent and tolerant of transient failures.

## Observability (SigNoz via Docker Compose)

We use SigNoz locally via Docker Compose.

Quick start:
```bash
git clone https://github.com/SigNoz/signoz.git
cd signoz/deploy/docker
docker compose up -d
```

Open UI: `http://localhost:3301`

More details: `ops/signoz/README.md`

## Next steps

- Replace the placeholder selectors and URLs in `config/sites.json`.
- Decide where the worker should run (local, server, cron, etc.).
