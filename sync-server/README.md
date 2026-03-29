# ChartDB diagram sync API

Small HTTP service that stores one JSON file per diagram under `DATA_DIR` (default `/data/diagrams`). Used with the ChartDB SPA and nginx proxy (`/api/diagram-sync/`) so a Docker volume can hold version-controlled diagrams.

## Canonical diagram id (filename)

- Each diagram is stored as `<id>.json` where `<id>` is a safe string: letters, digits, hyphen, and underscore (no dots or slashes), up to 128 characters—so names like `school-pathways-slim` are valid.
- **`GET /diagrams`** returns each diagram’s **`id` as that filename stem**, not the `id` field inside the JSON body. That way `GET /diagrams/mydb` always reads `mydb.json`, even if the file was committed from a Backup export whose body still has `"id": "0"`.
- **`PUT /diagrams/:id`** still requires the JSON body’s top-level **`id`** to match **`:id`** (and thus the filename). Auto-generators and git workflows should set `"id": "mydb"` when writing `mydb.json`.
- The ChartDB app’s Backup menu export uses **renumbered** ids for sharing; for git-friendly stable ids use the app’s volume sync (or `diagramToVolumeJSON` in source). Mixed files are still pullable: the client coerces the in-browser diagram id to the filename stem on pull.

**Deleting in the app:** Only **explicit** removals (trash from the diagram list, or **Delete diagram** in the editor menu) queue a volume `DELETE`. Internal storage replaces (examples, template clone, sync import) do **not** remove the `.json` file. New files you copy into `DATA_DIR` are **pulled** on the next sync.

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

Each successful `DELETE` is logged to stderr as `[chartdb-diagram-sync] DELETE <id> <ISO time>` so you can correlate volume removals with HTTP clients (including other browser tabs or tools).

## Development (auto-reload)

`node --watch` restarts the process when `server.mjs` (or imported local modules) change:

```bash
cd sync-server
DATA_DIR="$(pwd)/../diagram-data" PORT=8080 npm run dev
```

## Local smoke test

```bash
DATA_DIR=$(mktemp -d) PORT=9876 node server.mjs &
curl -s "http://127.0.0.1:9876/health"
curl -s "http://127.0.0.1:9876/diagrams"
```

Run automated tests from this directory: `npm test`.
