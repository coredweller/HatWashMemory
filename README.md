# Hat Wash Memory

A personal, local-only tracker for the order you have washed your hats. It answers one question
fast — **which hat should I wash next?** — and keeps a permanent history you can report on later.

- **Wash Next** ranks your hats most-overdue first: never-washed at the top, then longest-since-washed.
- **All Hats** is a photo grid where you add hats, edit them, and retire ones you no longer wear.
- **History** is the full wash log, with a summary strip (total washes, washes this year, average
  days between washes, most-washed hat, next one up).

Everything lives on your machine: a SQLite file and a folder of photos. The server binds to
`127.0.0.1` only and has no authentication, because nothing else can reach it.

## Running it

```
npm install
npm start
```

Then open <http://localhost:4180>.

> **Note on `npm install`:** `better-sqlite3` is pinned to exactly `12.4.1` and needs a prebuilt
> binary for your Node version. On Node 20.8.1 the published prebuild no longer downloads, so
> `node_modules/better-sqlite3/build/Release/better_sqlite3.node` was copied from a working install
> of the same version. If you wipe `node_modules`, restore that file — or move to Node 22+, where
> the prebuild downloads normally and this whole step disappears.

## Using it

- **Add a hat** — All Hats tab. A name is the only requirement; a photo and notes are optional.
  Photos are downscaled in the browser to 1000px JPEG before upload, so they stay small.
- **Log a wash** — hit `Wash ✓` on the Wash Next tab. That records today with no notes.
  The `…` button opens a form for backdating and adding notes.
- **Fix a mistake** — remove a wash with the `×` on its History row.
- **Retire a hat** — takes it out of the queue but keeps its history. Unretire it any time.

## Commands

| Command | Effect |
| --- | --- |
| `npm start` | Run the server (`tsx src/index.ts`) on <http://localhost:4180> |
| `npm run dev` | Same thing; separate name for muscle memory |
| `npm test` | `vitest run` |
| `npm run build` | `tsc` → `dist/` (also copies `schema.sql`) |
| `npm run serve:dist` | Run the compiled build |
| `npx tsc --noEmit` | Typecheck |

## Configuration

No `.env` is required. To override defaults, copy `.env.example` to `.env`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `DB_PATH` | `./hatwash.db` | SQLite file |
| `IMAGES_DIR` | `./data/images` | Where hat photos are written |
| `PORT` | `4180` | Server port |
| `LOG_LEVEL` | `info` | pino level |

## Your data

`hatwash.db` and `data/` are gitignored. The database is plain SQLite, so you can query it directly
for any reporting the History tab does not cover:

```sql
SELECT h.name, COUNT(w.id) AS washes, MAX(w.washed_at) AS last_washed
FROM hats h LEFT JOIN washes w ON w.hat_id = h.id
GROUP BY h.id ORDER BY washes DESC;
```

If you would rather have your hat photos backed up in git, remove `data/` from `.gitignore`.
