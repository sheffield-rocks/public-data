# sheffield.rocks data

This repository is the canonical home for generated data used by sheffield.rocks.
Scheduled workflows live here and write outputs into `data/<domain>/`.

## Structure

- `data/<domain>/` — committed data artifacts consumed by other repos.
- `pipelines/<domain>/` — scripts/jobs that generate the data.
- `docs/` — domain notes and schemas.

## Domains

### sky
- Data: `data/sky/sky-config.json`
- Pipeline: `pipelines/sky/update-sky-data.ts`

### buses
- Data: `data/buses/sheffield-gtfsrt.json`
- Data: `data/buses/stops/*.json`
- Pipeline: `pipelines/buses/`

### events
- Data: `data/events/events.sqlite`
- Pipeline: `pipelines/events/`

## Running locally

```bash
# From repo root
bun pipelines/sky/update-sky-data.ts
```

## Workflow secrets

- `BODS_API_KEY` (required for buses workflow)

## Serving decisions

- JSON artifacts keep their `.json` extension in this repo and when served statically.
- Extensionless endpoints are only provided when a server (Nginx/Fastify/etc.) is in front of the data.
- See `docs/serving.md`.

## Consumer repos

Set one of the following in the consumer environment:
- `SHEFFIELD_DATA_DIR` — absolute path to this repo root for local reads.
- `SHEFFIELD_DATA_BASE_URL` — base URL for hosted data (for example, a raw GitHub URL).
