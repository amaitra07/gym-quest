// Network first, falling back to the saved copy, so new versions appear as soon as you
// are online and the app still opens with no connection.
const CACHE_NAME = "gymquest-shell";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// The app's own files, plus the Google Fonts files and the Ionic components it loads from
// a CDN, so the app looks and works the same with no connection.
const LIBRARY_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"];

function isCacheable(url) {
  return url.origin === self.location.origin || LIBRARY_HOSTS.includes(url.hostname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !isCacheable(new URL(request.url))) {
    return;
  }
  // For the app's own files, "no-cache" makes the browser ask the server whether its saved
  // copy is still current (a quick check) instead of trusting it for the 10 minutes GitHub
  // Pages allows. Font and Ionic files never change, so they keep the normal rules.
  const isOwnFile = new URL(request.url).origin === self.location.origin;
  event.respondWith(
    fetch(request, isOwnFile ? { cache: "no-cache" } : undefined)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});
