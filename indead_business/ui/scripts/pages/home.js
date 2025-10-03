// ui/scripts/pages/home.js
(() => {
  window.Indead = window.Indead || {};
  window.Indead.pages = window.Indead.pages || {};

  // ----- header -----
  function ensureHeaderCss() {
    if (!document.querySelector('link[data-style="header"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'styles/partials/header.css';
      link.setAttribute('data-style', 'header');
      document.head.appendChild(link);
    }
  }

  async function injectHeader(root, loadPage, nui) {
    ensureHeaderCss();
    const res = await fetch('partials/header.html', { cache: 'no-store' });
    root.innerHTML = await res.text();
    async function setupNotifications(root, nui){
    const badge = root.querySelector('#notifBadge');
    const panel = root.querySelector('#notifPanel');
    const list  = root.querySelector('#notifList');
    const bell  = root.querySelector('.ib-icon--bell');

    // init badge
    try{
      const r = await nui('indead:getNotifyCount', {});
      const n = r?.ok ? (r.count||0) : 0;
      if(n>0){ badge.textContent=String(n); badge.hidden=false; } else { badge.hidden=true; }
    }catch(e){}

    function fmt(ts){
      // ts "YYYY-MM-DD HH:MM:SS" → "HH:MM"
      const m = String(ts||'').match(/\s(\d{2}:\d{2})/); return m ? m[1] : '';
    }

    bell?.addEventListener('click', async (ev)=>{
      ev.preventDefault(); ev.stopPropagation();
      if(!panel) return;

      if(!panel.hasAttribute('hidden')){ panel.setAttribute('hidden',''); return; }

      let res = null;
      try{ res = await nui('indead:openNotifications', {}); }catch(e){}
      const items = (res?.ok && Array.isArray(res.items)) ? res.items : [];

      if(items.length === 0){
        list.innerHTML = `<div class="ib-notifitem">Aucune nouvelle notification.</div>`;
      }else{
        list.innerHTML = items.map(i =>
          `<div class="ib-notifitem">
            <b>${i.firstname} ${i.lastname}</b> a postulé à votre offre <b>${i.offer_code}</b>
            <span class="ib-notiftime">${fmt(i.created_at)}</span>
          </div>`
        ).join('');
      }

      badge.hidden = true;           // on clear le badge
      panel.removeAttribute('hidden');

      // click extérieur → ferme
      const close = (e) => {
        if(!panel.contains(e.target) && e.target !== bell){ panel.setAttribute('hidden',''); document.removeEventListener('click', close, true); }
      };
      setTimeout(()=>document.addEventListener('click', close, true), 0);
    });
  }

  // … après avoir injecté le header :
  await setupNotifications(root, nui);

  // remap l’ex-onglet messages vers "Postulants"
  root.querySelector('.ib-icon--applicants')?.addEventListener('click',(e)=>{
    e.preventDefault(); e.stopPropagation();
    loadPage('applicants');
  });


    // Activer l'onglet Accueil
    root.querySelectorAll('.ib-nav__link').forEach(a => a.classList.remove('is-active'));
    root.querySelector('.ib-nav__link[data-tab="home"]')?.classList.add('is-active');

    // Routes (avec stopPropagation pour éviter les doubles déclenchements)
    root.querySelector('.ib-logo')?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation(); loadPage('home');
    });
    root.querySelector('.ib-nav__link[data-tab="home"]')?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation(); loadPage('home');
    });
    root.querySelector('.ib-icon--profile')?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation(); loadPage('profile');
    });
    root.querySelector('.ib-rightlink')?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation(); loadPage('post');
    });
    root.querySelector('.ib-icon--bookmark')?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      loadPage('bookmark');
    });
    
  }

  // ----- helpers -----
  const byId = (id) => document.getElementById(id);
  const textOrDash = (v) => { const s = (v==null)?'':String(v).trim(); return s!==''?s:'—'; };
  const plural = (n, base) => (Number(n) === 1) ? base : base + 's';

  function renderOfferItem(o){
    const unit = (o.response_unit === 'semaines' || o.response_unit === 'semaine') ? 'semaine' : 'jour';
    const unitText = (Number(o.response_value) === 1) ? unit : unit + 's';
    const compType = (o.company_type && String(o.company_type).trim() !== '') ? o.company_type : 'Anonyme';

    return `
      <article class="offer" data-id="${o.id}" role="listitem" tabindex="0" aria-label="${o.title}">
        <a class="o-title" href="javascript:void(0)">${escapeHTML(o.title)}</a>
        <div class="o-company">${escapeHTML(o.job_label || o.job_name || '')}</div>
        <div class="o-location">${escapeHTML(o.location || '')}</div>
        <div class="o-badges">
          <span class="b b-blue"><i>⚡</i> Répond généralement dans un délai de ${o.response_value} ${unitText}.</span>
          <span class="b b-green">${o.salary_badge ? 'À partir de ' + escapeHTML(o.salary_badge) + ' <b>✓</b>' : 'À partir de — <b>✓</b>'}</span>
          <span class="b b-gray">${escapeHTML(o.contract_type || '—')}</span>
        </div>
        <span class="o-type">${escapeHTML(compType)}</span>
      </article>`;
  }

  function escapeHTML(s){
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function mountList(items){
    const list = byId('offersList');
    const empty = byId('offersEmpty');
    const loading = byId('offersLoading');

    loading.hidden = true;
    list.innerHTML = '';

    if (!items || items.length === 0){
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    list.innerHTML = items.map(renderOfferItem).join('');

    list.querySelectorAll('.offer').forEach(el => {
      el.addEventListener('click', () => selectOffer(el.dataset.id));
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectOffer(el.dataset.id); }
      });
    });
  }

  function selectOffer(id){
    const item = (window.__INDEAD_OFFERS__ || []).find(x => String(x.id) === String(id));
    if (!item) return;

    // active state
    byId('offersList').querySelectorAll('.offer').forEach(el => el.classList.remove('is-active'));
    const el = byId('offersList').querySelector(`.offer[data-id="${CSS.escape(String(id))}"]`);
    if (el) el.classList.add('is-active');

    // détail
    const unit = (item.response_unit === 'semaines' || item.response_unit === 'semaine') ? 'semaine' : 'jour';
    const unitText = (Number(item.response_value) === 1) ? unit : unit + 's';
    const compType = (item.company_type && String(item.company_type).trim() !== '') ? item.company_type : 'Anonyme';

    byId('d-title').textContent    = textOrDash(item.title);
    byId('d-company').textContent  = textOrDash(item.job_label || item.job_name);
    byId('d-location').textContent = textOrDash(item.location);
    byId('d-blue').innerHTML  = `<i>⚡</i> Répond généralement dans un délai de ${item.response_value} ${unitText}.`;
    byId('d-green').innerHTML = item.salary_badge ? `À partir de ${escapeHTML(item.salary_badge)} <b>✓</b>` : 'À partir de — <b>✓</b>';
    byId('d-gray').textContent = textOrDash(item.contract_type);
    byId('d-type').textContent = compType;

    byId('d-bodyhtml').innerHTML = item.details_html || '—';
  }

  // ----- init page -----
  async function init({ app, loadPage, nui }) {
    const mount = app.querySelector('#header-root');
    await injectHeader(mount, loadPage, nui);

    // charger les offres (toutes, non expirées)
    let res = null;
    try { res = await nui('indead:getOffers', {}); } catch(e) {}
    const items = (res?.ok && Array.isArray(res.items)) ? res.items : [];
    window.__INDEAD_OFFERS__ = items;

    mountList(items);

    // auto-sélection : première
    if (items.length > 0) {
      selectOffer(items[0].id);
    }
  }

  window.Indead.pages.home = { init };
})();
