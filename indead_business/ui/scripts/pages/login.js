(() => {
  window.Indead = window.Indead || {};
  window.Indead.pages = window.Indead.pages || {};

  function showLoader(app) {
    app.innerHTML = `
      <section class="loading-screen" aria-busy="true" aria-live="polite">
        <div class="animate-pulse flex flex-col items-center gap-4 w-60">
          <div>
            <div class="w-48 h-6 bg-slate-400 rounded-md"></div>
            <div class="w-28 h-4 bg-slate-400 mx-auto mt-3 rounded-md"></div>
          </div>
          <div class="h-7 bg-slate-400 w-full rounded-md"></div>
          <div class="h-7 bg-slate-400 w-full rounded-md"></div>
          <div class="h-7 bg-slate-400 w-full rounded-md"></div>
          <div class="h-7 bg-slate-400 w-1/2 rounded-md"></div>
        </div>
      </section>
    `;
  }

  function init({ app, state, loadPage, popup, nui, sleep, MIN_LOADER_MS }) {
    const btn = app.querySelector('#ctaLogin');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      showLoader(app);
      try {
        const req = nui('indead:login', {});
        await sleep(MIN_LOADER_MS);
        const out = await req;
        if (out?.ok) {
          state.company = out.company || null;
          loadPage('home'); // 🔵 on part sur la Home
        } else {
          popup({
            title: 'Accès refusé',
            description: out?.message || "Vous n'êtes pas autorisé à accéder à INDEAD Business.",
            onClose: () => window.location.reload()
          });
        }
      } catch (e) {
        popup({ title: 'Erreur', description: 'Connexion impossible. Réessayez.', onClose: () => window.location.reload() });
      }
    });
  }

  window.Indead.pages.login = { init };
})();
