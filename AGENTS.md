# AGENTS.md

Machine-readable guide for AI agents working in this repository. Complements `CLAUDE.md`. Read both
before editing.

## Purpose

Personal-use tool. Tracks the order hats have been washed and keeps the full wash history for later
reporting. Single user, localhost only, no auth, no scheduler, no external API.

## Commands

| Command | Effect |
| --- | --- |
| `npm start` / `npm run dev` | `tsx src/index.ts` — HTTP server on <http://localhost:4180> |
| `npm test` | `vitest run` |
| `npm run build` | `tsc` → `dist/` (also copies `schema.sql`) |
| `npm run serve:dist` | `node dist/index.js` |
| `npx tsc --noEmit` | Typecheck (no dedicated script) |

No linter is configured. `start`/`dev`/`test` run `.ts` directly via `tsx` — no build step.

## Runtime & conventions

- **ESM**, `"type": "module"`, strict TS, NodeNext resolution. **Imports of local `.ts` files use a
  `.js` extension** (e.g. `import { config } from "./config.js"`). Match this or the build breaks.
- **SQLite via `better-sqlite3`** (synchronous, raw prepared statements — no ORM). Schema in
  `src/db/schema.sql`, re-applied on every `openDatabase()` (all `CREATE ... IF NOT EXISTS`).
  That is the entire migration story; adding a column to an existing database needs a deliberate
  one-off migration, not just an edit to `schema.sql`.
- **`better-sqlite3` is pinned to exactly `12.4.1`** and its native binary was copied from another
  project's install, because no Node 20.8.1 prebuild downloads any more. Do not bump the version
  without confirming a matching binary is obtainable, or the app stops starting.
- **Config** = `src/config.ts` (Zod-validated env, every value defaulted — the app runs with no `.env`).
- **Logging** = `src/logger.ts` (pino). Never `console.log` in product code.
- **Errors** = `src/result.ts` `Result<T,E>` (`ok`/`fail`) for expected failures (validation, bad
  upload); throw for unexpected. Every catch logs with context and either rethrows or returns an
  error state. No silent failures, no empty-array fallbacks.
- **Timestamps are unix epoch _seconds_** everywhere (multiply by 1000 for JS `Date`).
- DB row interfaces keep **snake_case** field names so SQL results map without translation.

## Layout

```
src/
  index.ts              server entry: routes, Zod body validation, listen
  config.ts logger.ts result.ts
  db/                   schema.sql + one repository class per table
    connection.ts       openDatabase() / queryReadonly()
  images/storeImage.ts  parseImageDataUrl() [PURE] + storeImage()/deleteImage() [disk]
  web/
    queryHats.ts        read-only SQL: hats + last_washed + wash_count
    queryHistory.ts     read-only SQL: wash log joined to hats
    rankHats.ts         PURE: queue order (never-washed first, then oldest) + daysSince
    summarizeHistory.ts PURE: the History tab's stat tiles
    dates.ts            PURE: local-noon storage, parsing, day counts, formatting
    hatCard.ts          PURE: escapeHtml + row/card renderers
    renderPage.ts       PURE: whole page — inline CSS + inline JS, one <style>/<script>
test/                   Vitest — pure logic only, no DB or HTTP tests
```

Layering: `entry → query/repository → connection`, with `rank*`/`render*`/`parse*`/`summarize*`
pure so they are testable without I/O.

## Data model

- `hats` — `id`, `name` (UNIQUE index), `image_file` (filename under `IMAGES_DIR`, nullable),
  `notes`, `retired_at` (NULL = active), `created_at`.
- `washes` — `id`, `hat_id` (FK, `ON DELETE CASCADE`), `washed_at`, `notes`, `created_at`.
  `created_at` is when the entry was logged; `washed_at` is the day of the wash, so backdating
  stays auditable.
- `PRAGMA foreign_keys = ON` is set in `openDatabase()` — **without it the cascade silently does
  nothing.**
- Never-washed = `MAX(washes.washed_at) IS NULL` via `LEFT JOIN`.

### Timezone gotcha

`washed_at` is stored at **local noon** of the wash day, not midnight. Anchoring at noon means
`toLocaleDateString` can never render the neighbouring day, and day arithmetic survives DST. All of
this lives in `src/web/dates.ts` (`localNoonSeconds`, `parseWashDate`, `daysSince`). Do not store a
raw `Date.now()` in `washed_at`.

## Images

No multipart dependency. The browser downscales to 1000px max edge and calls
`canvas.toDataURL("image/jpeg", 0.85)`, then POSTs the data URL as a JSON field; the server decodes
it in `parseImageDataUrl` (jpeg/png/webp only, 2 MB decoded cap) and writes
`<16 hex chars>.<ext>` into `IMAGES_DIR`.

- `GET /images/<file>` validates the name against `IMAGE_FILE_PATTERN` **before** touching the
  filesystem. That regex is the path-traversal defence — do not loosen it.
- Replacing or deleting a photo unlinks the old file; a failed insert unlinks the one just written.
  Keep that ordering: write image, then insert/update the row, and only then delete the old file.

## UI model

The server renders the whole page; mutations are `fetch` calls to the JSON API and the page then
calls `location.reload()`. Rendering therefore exists in exactly one place (TypeScript) with no
client-side templating to keep in sync. The active tab survives the reload in `location.hash`.
**Every interpolated value must go through `escapeHtml()`.**

## API

| Route | Body | Notes |
| --- | --- | --- |
| `GET /` | — | Full page (also accepts HEAD) |
| `GET /images/<file>` | — | Immutable cache headers (also accepts HEAD) |
| `POST /api/hats` | `{ name, notes?, imageDataUrl? }` | 201 `{ id }` |
| `PATCH /api/hats/:id` | `{ name?, notes?, imageDataUrl?, retired? }` | Omitted fields are untouched |
| `DELETE /api/hats/:id` | — | Cascades washes, unlinks the photo |
| `POST /api/washes` | `{ hatId, washedAt?, notes? }` | `washedAt` is `YYYY-MM-DD`; defaults to today |
| `DELETE /api/washes/:id` | — | Undo a mis-logged wash |

Errors are `{ error: string }` with 400 (validation) / 404 (missing) / 500 (unexpected).

## Verification expectations

- Run `npm test` and `npx tsc --noEmit` after changes.
- New pure logic → add a Vitest test under `test/` (mirrors the `rankHats`/`dates` style).
- For runtime changes, drive the real server: `npm start`, then exercise the routes with curl and
  check the rendered HTML. **Stopping the server on Windows needs the PID bound to the port**
  (`netstat -ano | grep 4180`); `pkill -f tsx` does not reliably kill it, and a stale listener will
  make a "restarted" server silently serve the old code.
- Do not commit or push unless asked. `hatwash.db*`, `data/`, `.env`, and `dist/` are gitignored —
  never commit them.
