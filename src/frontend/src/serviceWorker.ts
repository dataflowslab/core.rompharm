export function registerServiceWorker() {
  if (import.meta.env.DEV) {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        registration.update();

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              // New version installed; it will activate on next reload or when told to skip waiting.
              console.log('[SW] New version installed');
            }
          });
        });
      })
      .catch((error) => {
        console.error('[SW] Registration failed:', error);
      });
  });
}
