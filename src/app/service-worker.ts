export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
    const serviceWorkerUrl = new URL("service-worker.js", baseUrl);

    navigator.serviceWorker
      .register(serviceWorkerUrl, { scope: baseUrl.pathname })
      .catch((error) => {
        console.error("Failed to register service worker", error);
      });
  });
}
