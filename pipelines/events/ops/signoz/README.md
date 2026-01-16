# SigNoz (local via Docker Compose)

This folder documents how to run SigNoz locally with Docker Compose for observability.

## Option A: Use the official SigNoz Docker Compose repo (recommended)

1) Clone the SigNoz repo:
```bash
git clone https://github.com/SigNoz/signoz.git
```

2) Start the Docker Compose stack:
```bash
cd signoz/deploy/docker

docker compose up -d
```

3) Open SigNoz UI:
- `http://localhost:3301`

Notes:
- This runs the full SigNoz stack locally.
- You can stop it with `docker compose down`.

## Option B: Keep the SigNoz repo inside this project

If you want the stack within this repo, clone it into `ops/signoz/signoz`:

```bash
cd ops/signoz

git clone https://github.com/SigNoz/signoz.git
cd signoz/deploy/docker

docker compose up -d
```

This keeps all local observability tooling under `ops/`.

## Next step: Instrumentation

Once SigNoz is running, we can add OpenTelemetry instrumentation for this Bun worker and export traces/metrics to the local SigNoz OTLP endpoint.
