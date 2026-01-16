# sheffield.rocks buses pipeline

Generates GTFS-RT snapshots for Sheffield from the BODS data feed.

## Outputs

- `data/buses/sheffield-gtfsrt.json`
- `data/buses/stops/*.json`

## Run locally

```bash
# From data repo root
BODS_API_KEY=... bun pipelines/buses/bods-gtfsrt-sheffield.ts
BODS_API_KEY=... bun pipelines/buses/bods-gtfsrt-per-stop.ts
```

You can override the output locations:

```bash
bun pipelines/buses/bods-gtfsrt-sheffield.ts --out ./tmp/gtfsrt.json
bun pipelines/buses/bods-gtfsrt-per-stop.ts --outDir ./tmp/stops
```

## Serving

Keep `.json` extensions when serving statically.
If you want extensionless endpoints (e.g. `/stops/370000123`), use a server
rule to map `/stops/{id}` to `/stops/{id}.json`.
See `pipelines/buses/nginx-bus-stops.conf` for an example.
