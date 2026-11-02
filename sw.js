// Offline support for the app shell. The timetable data (data/) is cached by db.js,
// which needs to know whether the server has a newer version, so it is not handled here.
//
// Shell files are served from the cache and refreshed in the background
// (stale-while-revalidate), so a new deploy shows up on the next visit. Bump VERSION when
// the list below changes, so old caches are dropped.

const VERSION = "shell-v5";
const SHELL = [
  "./",
  "index.html",
  "app.js",
  "db.js",
  "style.css",
  "manifest.webmanifest",
  "vendor/sql-wasm.js",
  "vendor/sql-wasm.wasm",
  "vendor/vercel-analytics.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/splash-logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("shell-") && k !== VERSION).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const scope = new URL(self.registration.scope);
  if (url.pathname.startsWith(scope.pathname + "data/")) return;
  if (url.pathname.startsWith("/_vercel/")) return;

  // Every page of the app is index.html; the hash picks the group/teacher/room.
  const key = req.mode === "navigate" ? new URL("index.html", scope).href : req;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: req.mode === "navigate" });
      const refresh = fetch(req.mode === "navigate" ? key : req)
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      return (await refresh) ?? Response.error();
    }),
  );
});
