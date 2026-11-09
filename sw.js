// Necessario para o navegador oferecer o atalho (instalar o app).
// Nao guarda nada em cache: a pagina sempre busca os dados mais recentes.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request));
});
