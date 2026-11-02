# gtu_timetable_web — Uni Hub

Offline-capable web app (PWA) for the GTU timetable produced by
[`gtu_timetable_parser`](../gtu_timetable_parser), in the design of the Uni Hub app
(`../UniHub/uni-hub-master`: white, purple `#7650FF`, tinted lesson cards, day chips).

1. **Splash** — the სტუ logo (`icons/splash-logo.png`) while the data loads.
2. **Search** — one field that searches groups, teachers and rooms together; results are
   grouped by kind. On mobile browsers (not when already installed) a button at the
   bottom explains how to add the site to the home screen: Android Chrome shows its
   install prompt, other browsers get step-by-step instructions (iOS: Share → Add to
   Home Screen).
3. **Week** — the chosen group's, teacher's or room's lessons day by day; every teacher,
   room and group on a lesson card links to that one's week.

No build step and no CDN: plain HTML/CSS/JS modules, with
[sql.js](https://github.com/sql-js/sql.js) 1.14.2 vendored in `vendor/` to read the
SQLite file in the browser.

## Run

```bash
python3 -m http.server 8077     # from this folder, then open http://localhost:8077
```

Any static file server works. Service workers need `https://` or `localhost`.

## Update the data

```bash
(cd ../gtu_timetable_parser && python3 -m gtu_timetable_parser)   # fetch this week's data
python3 scripts/update_data.py        # copies the newest ../gtu_timetable_parser/output/*.sqlite
python3 scripts/update_data.py path/to/2026__2027_I_B.sqlite   # or a specific file
```

`update_data.py` copies the file to `data/` and writes `data/current.json`:

```json
{ "file": "2026__2027_I_B.sqlite", "version": "0a1de05c7936c012", "week": "7", ... }
```

`version` is a hash of the file. Deploying new data is just uploading those two files.

## How offline works

| what | where it is cached | how it is refreshed |
|------|--------------------|---------------------|
| app shell (HTML, JS, CSS, icons, sql.js + wasm) | service worker (`sw.js`), cache `shell-v1` | stale-while-revalidate: served from cache, re-fetched in the background |
| timetable database | `db.js`, cache `gtu-data` | on every start: show the cached copy at once, then fetch `data/current.json`; if its `version` differs, download the new file, open it to check it, then replace the cached copy |

So the first visit needs internet; after that the app opens and works with no
connection, and picks up a new week the next time it is online (with a "timetable
updated" message). A broken or half-downloaded file never replaces a working one.
`navigator.storage.persist()` is requested to keep the browser from evicting the data.

When the file list in `sw.js` changes, bump its `VERSION` so old shell caches are dropped.

## Files

```
index.html, style.css      layout; light/dark follows the system
app.js                     UI: search, routing (#/group/12300, #/teacher/<name>, #/room/01-529),
                           week board, recents, KA/EN, install button, online/offline status
db.js                      loading/caching the SQLite file and the SQL queries
sw.js                      service worker for the app shell
manifest.webmanifest       PWA metadata; icons in icons/ (drawn by scripts/make_icons.py)
vendor/                    sql.js browser build + license
data/                      current.json + the .sqlite file (from scripts/update_data.py)
```

Links and "recently viewed" use names, not database ids, because the parser assigns ids
anew on every run.
