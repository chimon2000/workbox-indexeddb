importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/4.0.0/workbox-sw.js"
);

if (!workbox) {
  console.log("Not loaded");
} else {
  workbox.setConfig({ debug: true });
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  workbox.precaching.precacheAndRoute([]);
  workbox.precaching.precache([
    "https://unpkg.com/idb@3.0.2/lib/idb.mjs",
    "https://storage.googleapis.com/workbox-cdn/releases/4.0.0/workbox-window.prod.mjs"
  ]);

  const showNotification = () => {
    self.registration.showNotification("Background sync success!", {
      body: "🎉`🎉`🎉`"
    });
  };

  const bgSyncPlugin = new workbox.backgroundSync.Plugin("dashboardr-queue", {
    callbacks: {
      queueDidReplay: showNotification
    }
  });
  const networkWithBackgroundSync = new workbox.strategies.NetworkOnly({
    plugins: [bgSyncPlugin]
  });

  workbox.routing.registerRoute(
    /\/api\/add/,
    networkWithBackgroundSync,
    "POST"
  );
}
