# ChartDB diagram sync API

Small HTTP service that stores one JSON file per diagram under `DATA_DIR` (default `/data/diagrams`). Used with the ChartDB SPA and nginx proxy (`/api/diagram-sync/`) so a Docker volume can hold version-controlled diagrams.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{ "ok": true }` (no auth) |
| GET | `/diagrams` | `{ "diagrams": [ { id, name, updatedAt } ] }` |
| GET | `/diagrams/:id` | Raw diagram JSON |
| PUT | `/diagrams/:id` | Write diagram; body `id` must match URL. Optional header `X-Expect-Updated-At` (ISO) for optimistic concurrency |
| DELETE | `/diagrams/:id` | Remove file |

## Environment

- `PORT` (default `8080`)
- `DATA_DIR` (default `/data/diagrams`)
- `SYNC_API_TOKEN` — if set, require `Authorization: Bearer <token>`

## Local smoke test

```bash
DATA_DIR=$(mktemp -d) PORT=9876 node server.mjs &
curl -s "http://127.0.0.1:9876/health"
curl -s "http://127.0.0.1:9876/diagrams"
```

Run automated tests from this directory: `npm test`.
