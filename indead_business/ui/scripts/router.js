// ui/scripts/router.js
(() => {
  const app  = document.getElementById('app');
  const HEAD = document.head;

  // ====== Config & utils =====================================================
  const MIN_LOADER_MS = 1500;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // État global partagé entre pages
  // + gotoApplicants pour présélectionner depuis une notif
  const state = { company: null, gotoApplicants: null };

  // ====== Thème (LB-Tablet) ==================================================
  function syncThemeFromLB() {
    const t = (document.body?.getAttribute('data-theme') === 'dark') ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  }
  syncThemeFromLB();
  if (typeof globalThis?.onSettingsChange === 'function') {
    globalThis.onSettingsChange((settings) => {
      if (settings && (settings.theme === 'light' || settings.theme === 'dark')) {
        document.documentElement.setAttribute('data-theme', settings.theme);
      } else {
        syncThemeFromLB();
      }
    });
  }
  try {
    new MutationObserver(syncThemeFromLB)
      .observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (_) {}

  // ====== Espace global pour les pages =======================================
  window.Indead = window.Indead || {};
  window.Indead.pages = window.Indead.pages || {};

  // ====== Chargement de scripts (une seule fois par fichier) =================
  const loadedScripts = new Set();
  function canonical(src) { return String(src || '').split('?')[0]; }
  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const key = canonical(src);
      if (loadedScripts.has(key)) return resolve();
      const s = document.createElement('script');
      s.src = src; s.defer = true;
      s.onload = () => { loadedScripts.add(key); resolve(); };
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(s);
    });
  }

  // ====== Styles par page =====================================================
  function setPageStyle(name) {
    const old = HEAD.querySelector('link[data-page-style]');
    if (old) old.remove();
    const href = `styles/pages/${name}.css`;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-page-style', name);
    link.addEventListener('error', () => link.remove());
    HEAD.appendChild(link);
  }

  // ====== Popups (fallback alert) ============================================
  function popup(opts) {
    if (globalThis.setPopUp) {
      globalThis.setPopUp({
        title: opts.title || 'Info',
        description: opts.description || '',
        buttons: [{ title: 'OK', bold: true, cb: opts.onClose }]
      });
    } else {
      alert(`${opts.title || 'Info'}\n\n${opts.description || ''}`);
      if (opts.onClose) opts.onClose();
    }
  }

  // ====== NUI helper =========================================================
async function nui(event, data = {}) {
  // IMPORTANT : pointer explicitement vers ta ressource, pas vers lb-tablet
  const res = await fetch(`https://indead_business/${event}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  try {
    return await res.json();
  } catch {
    return null;
  }
}

  // ====== Fetch robuste (HTML) ===============================================
  async function fetchHTMLSequential(paths) {
    for (const p of paths) {
      try {
        const res = await fetch(p, { cache: 'no-store' });
        if (res.ok) return await res.text();
      } catch (_) {}
    }
    return null;
  }

  // ====== Notifications Patron (cloche) ======================================
  (function prepareNotifications() {
    // style unique (une seule fois)
    const STYLE_ID = 'ib-notify-style';
    function ensureStyle() {
      if (document.getElementById(STYLE_ID)) return;
      const s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = `
        .ib-notify-btn{position:relative}
        .ib-notify-dot{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;
          font-size:10px;line-height:16px;background:#ef4444;color:#fff;text-align:center;font-weight:700;display:none}
        .ib-notify-panel{position:absolute;right:0;top:calc(100% + 8px);width:min(360px,84vw);max-height:320px;overflow:auto;
          background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.12);z-index:9999}
        .ib-notify-hd{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #eee}
        .ib-notify-hd .ttl{font-weight:700}
        .ib-notify-hd .markall{font-size:12px;border:1px solid #d1d5db;border-radius:8px;padding:6px 8px;background:#f9fafb;cursor:pointer}
        .ib-notify-item{padding:10px 12px;display:flex;gap:8px;cursor:pointer}
        .ib-notify-item:hover{background:#f3f4f6}
        .ib-notify-item .who{font-weight:600}
        .ib-notify-empty{padding:14px;color:#6b7280;font-size:14px}
      `;
      document.head.appendChild(s);
    }

    async function getNotifs() {
      const out = await nui('indead_business:notifications:get', {});
      return (out && out.ok && Array.isArray(out.notifications)) ? out.notifications : [];
    }

function mountBellOnce() {
  ensureStyle();

  // Barre d’icônes (header)
  const bar =
    app.querySelector('.home-header .iconbar') ||
    app.querySelector('header .iconbar') ||
    app.querySelector('.iconbar') ||
    app;

  // Détection tolérante du bouton cloche
  function findBellButton(container) {
    let btn = container.querySelector(
      '.icon-btn[data-action="notifs"],' +
      '.icon-btn[data-action="notifications"],' +
      '.icon-btn[data-action="notify"],' +
      '.icon-btn.notifs,' +
      '.icon-btn.notification'
    );
    if (btn) return btn;

    const img = container.querySelector(
      'img[src*="icon-bell"], img[src*="icon-bell.svg"], svg[data-icon="bell"], .icon-bell'
    );
    return img ? (img.closest('.icon-btn,button,a') || null) : null;
  }

  const btn = findBellButton(bar);
  if (!btn || btn.dataset.ibBellMounted === '1') return;

  btn.dataset.ibBellMounted = '1';
  btn.classList.add('ib-notify-btn');

  let dot = btn.querySelector('.ib-notify-dot');
  if (!dot) {
    dot = document.createElement('span');
    dot.className = 'ib-notify-dot';
    btn.appendChild(dot);
  }

  let panel = null;
  let open  = false;

  async function refreshBadge() {
    const out = await nui('indead_business:notifications:get', {});
    const list = (out && out.ok && Array.isArray(out.notifications)) ? out.notifications : [];
    const n = list.length;
    dot.textContent = String(n);
    dot.style.display = n > 0 ? 'inline-block' : 'none';
    return list;
  }

  async function renderPanel(list) {
    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.className = 'ib-notify-panel';

    if (!list.length) {
      panel.innerHTML = `<div class="ib-notify-empty">Aucune nouvelle notification.</div>`;
    } else {
      const items = list.map(n => {
        const who = [n.candidate_firstname, n.candidate_lastname].filter(Boolean).join(' ').trim() || n.candidate_citizenid;
        return `
          <div class="ib-notify-item" data-code="${n.offer_code}" data-cid="${n.candidate_citizenid}">
            <div>
              <div class="who">${who}</div>
              <div class="txt">${who} a postulé à une de vos offres</div>
            </div>
          </div>`;
      }).join('');

      panel.innerHTML = `
        <div class="ib-notify-hd">
          <div class="ttl">Notifications</div>
          <button class="markall" type="button">Tout marquer comme lu</button>
        </div>
        ${items}
      `;
    }

    btn.parentElement.style.position = 'relative';
    btn.parentElement.appendChild(panel);

    panel.querySelectorAll('.ib-notify-item')?.forEach(it => {
      it.addEventListener('click', async () => {
        const res = await nui('indead_business:notifications:open', {
          offer_code: it.dataset.code,
          candidate_citizenid: it.dataset.cid
        });
        panel.remove(); open = false;
        await refreshBadge();
        if (res && res.ok && res.route === 'applicants') {
          state.gotoApplicants = { offer_code: res.offer_code, citizenid: res.citizenid };
          loadPage('applicants');
        }
      });
    });

    panel.querySelector('.markall')?.addEventListener('click', async () => {
      await nui('indead_business:notifications:markAll', {});
      panel.remove(); open = false;
      await refreshBadge();
      loadPage('applicants');
    });
  }

  // Rafraîchissement externe (utilisé par le polling)
  async function externalRefresh({ rerender = false } = {}) {
    const list = await refreshBadge();
    if (rerender && open && panel) await renderPanel(list);
  }
  window.__INDEAD_NOTIFY_REFRESH__ = externalRefresh;

  // Polling badge (toutes les 6s)
  if (!window.__INDEAD_NOTIFY_POLL) {
    window.__INDEAD_NOTIFY_POLL = setInterval(() => {
      window.__INDEAD_NOTIFY_REFRESH__?.({ rerender: false });
    }, 6000);
  }

  // Ouverture/fermeture du panneau
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (open) { panel?.remove(); open = false; return; }
    const list = await refreshBadge();
    await renderPanel(list);
    open = true;
  });

  document.addEventListener('click', (e) => {
    if (!open) return;
    if (panel && !panel.contains(e.target) && !btn.contains(e.target)) {
      panel.remove(); open = false;
    }
  }, true);

  // Badge initial
  refreshBadge();
}


    // Expose un hook que l’on appellera après chaque chargement de page
    window.__INDEAD_MOUNT_BELL__ = () => {
      // Monte immédiatement si la cloche est déjà dans le DOM,
      // sinon ré-essaie une fois après la phase d'init de la page.
      mountBellOnce();
      setTimeout(mountBellOnce, 50);
    };
  })();

  // ====== Routeur blindé contre les courses ==================================
  let navToken = 0; // jeton de navigation
  async function loadPage(name) {
    const token = ++navToken;

    const tries = [
      `pages/${name}.html`,
      `./pages/${name}.html`,
    ];
    const html = await fetchHTMLSequential(tries);

    if (token !== navToken) return; // une autre navigation a commencé → on abandonne

    if (!html) {
      app.innerHTML = `<p style="color:#b91c1c;margin:12px">Impossible de charger la page "<b>${name}</b>".</p>`;
      console.error('[INDEAD] loadPage failed', { name, tried: tries });
      return;
    }

    // On applique le style seulement maintenant (après avoir validé la page)
    setPageStyle(name);

    // On remplace le contenu
    app.innerHTML = html;

    // (1) Monte la cloche si présente sur cette page (header)
    if (typeof window.__INDEAD_MOUNT_BELL__ === 'function') {
      window.__INDEAD_MOUNT_BELL__();
    }

    // Charge le script de la page
    try {
      await loadScriptOnce(`scripts/pages/${name}.js`);
    } catch (e) {
      console.error('[INDEAD] script load failed', name, e);
    }

    if (token !== navToken) return; // si autre navigation depuis, on ne lance pas l'init

    // Initialise la page
    const mod = window.Indead?.pages?.[name];
    if (typeof mod?.init === 'function') {
      mod.init({ app, state, loadPage, popup, nui, sleep, MIN_LOADER_MS });
    }

    // (2) Re-monte la cloche après init si le header a été modifié par le script de page
    if (typeof window.__INDEAD_MOUNT_BELL__ === 'function') {
      window.__INDEAD_MOUNT_BELL__();
    }
  }

  // ====== Export contexte & boot =============================================
  window.Indead.ctx = { app, state, loadPage, popup, nui, sleep, MIN_LOADER_MS };
  loadPage('login');
})();
