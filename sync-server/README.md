# ChartDB diagram sync API

Small HTTP service that stores one JSON file per diagram under `DATA_DIR` (default `/data/diagrams`). Used with the ChartDB SPA and nginx proxy (`/api/diagram-sync/`) so a Docker volume can hold version-controlled diagrams.

## Canonical diagram id (filename)

- Each diagram is stored as `<id>.json` where `<id>` is a safe alphanumeric string (same rules as ChartDB diagram ids in practice).
- **`GET /diagrams`** returns each diagram’s **`id` as that filename stem**, not the `id` field inside the JSON body. That way `GET /diagrams/mydb` always reads `mydb.json`, even if the file was committed from a Backup export whose body still has `"id": "0"`.
- **`PUT /diagrams/:id`** still requires the JSON body’s top-level **`id`** to match **`:id`** (and thus the filename). Auto-generators and git workflows should set `"id": "mydb"` when writing `mydb.json`.
- The ChartDB app’s Backup menu export uses **renumbered** ids for sharing; for git-friendly stable ids use the app’s volume sync (or `diagramToVolumeJSON` in source). Mixed files are still pullable: the client coerces the in-browser diagram id to the filename stem on pull.

**Sync order (browser):** Volume files that have no local IndexedDB diagram are removed **before** pulling from the volume, so a diagram you delete in the UI is not immediately re-imported from disk in the same sync (which previously could cause a `DELETE` followed by a `PUT`). This assumes a **single-writer** or branch-based git workflow; another user’s new diagram file that you have never pulled will look like an “orphan” and be deleted locally if it is not in your IndexedDB yet.

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
