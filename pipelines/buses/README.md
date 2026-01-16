# sheffield.rocks buses pipeline

Generates GTFS-RT snapshots for Sheffield from the BODS data feed.

## Outputs

- `data/buses/sheffield-gtfsrt.json`
- `data/buses/stops/*.json`
- `data/buses/stops.sqlite`

## Run locally

```bash
# From data repo root
BODS_API_KEY=... bun pipelines/buses/bods-gtfsrt-sheffield.ts
BODS_API_KEY=... bun pipelines/buses/bods-gtfsrt-per-stop.ts
bun pipelines/buses/naptan-stops-sqlite.ts
```

You can override the output locations:

```bash
bun pipelines/buses/bods-gtfsrt-sheffield.ts --out ./tmp/gtfsrt.json
bun pipelines/buses/bods-gtfsrt-per-stop.ts --outDir ./tmp/stops
bun pipelines/buses/naptan-stops-sqlite.ts --out ./tmp/stops.sqlite
```

## Stops SQLite (NaPTAN)

- Source: NaPTAN access-nodes CSV from DfT (`https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv`).
- Filter: `ATCOCode` prefix `370` (South Yorkshire PTE) to keep the dataset Sheffield-focused.
  This is a proxy for Sheffield, which is within South Yorkshire.
- Output: `data/buses/stops.sqlite`.
- No API key required.

### Options

- `--prefix 370` (set to `all` to disable filtering)
- `--out /path/to/stops.sqlite`
- `--source <url>`
- `--no-rtree` (skip RTree; lat/lng indexes are always created)

By default the pipeline attempts to create an RTree table (`stops_rtree`) for spatial lookups. If the SQLite build
doesn't support RTree, it logs a warning and falls back to lat/lng indexes.

### Validation

```bash
bun pipelines/buses/validate-stops-sqlite.ts
```

## Serving

Keep `.json` extensions when serving statically.
If you want extensionless endpoints (e.g. `/stops/370000123`), use a server
rule to map `/stops/{id}` to `/stops/{id}.json`.
See `pipelines/buses/nginx-bus-stops.conf` for an example.
