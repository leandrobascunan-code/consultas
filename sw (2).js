/* Service worker: permite instalar la app y usarla sin conexión (modo guías).
   Al publicar cambios, suba el número de VERSION para que los usuarios
   reciban la versión nueva. */
const VERSION = "asistente-slep-v3";
const ARCHIVOS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/estilos.css",
  "js/config.js",
  "js/conocimiento.js",
  "js/app.js",
  "img/logo-slep.png",
  "img/ayuda.jpg",
  "img/iconos/icon-192.png",
  "img/iconos/icon-512.png",
  "img/iconos/favicon-48.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Red primero para los archivos propios (siempre la versión más reciente),
   caché como respaldo sin conexión. Las consultas a la API nunca se guardan. */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
