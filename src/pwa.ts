import { registerSW } from 'virtual:pwa-register';

/**
 * Registers the service worker (offline support). A new version is activated and loaded
 * automatically; the data lives in IndexedDB, which an update never touches.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Installed iPhone apps can stay open for days: look for a new version when coming back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update().catch(() => {});
      });
    },
  });
  void updateSW;
}

/** Asks the browser not to evict our IndexedDB data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    // Not supported: nothing else to do.
  }
  return false;
}
