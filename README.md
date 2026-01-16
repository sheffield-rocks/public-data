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

### buses (placeholder)
- Data: `data/buses/`
- Pipeline: `pipelines/buses/`

### events (placeholder)
- Data: `data/events/`
- Pipeline: `pipelines/events/`

## Running locally

```bash
# From repo root
bun pipelines/sky/update-sky-data.ts
```

## Consumer repos

Set one of the following in the consumer environment:
- `SHEFFIELD_DATA_DIR` — absolute path to this repo root for local reads.
- `SHEFFIELD_DATA_BASE_URL` — base URL for hosted data (for example, a raw GitHub URL).
