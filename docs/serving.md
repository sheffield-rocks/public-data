# Serving data

## JSON file extensions

All JSON artifacts are stored and served with their `.json` extension when using static hosting
(e.g. GitHub Pages or raw file hosting). This keeps paths explicit and predictable.

We only serve extensionless JSON endpoints when a server is in front of the data
(Nginx, Fastify, etc.). In that case, routing rules can map `/resource` to
`/resource.json` (see `pipelines/buses/nginx-bus-stops.conf`).
