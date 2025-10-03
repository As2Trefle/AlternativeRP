// ui/scripts/pages/profile.js
(() => {
  window.Indead = window.Indead || {};
  window.Indead.pages = window.Indead.pages || {};

  // ------------------------------------------------------------
  // Helpers d'injection du header (et CSS du header)
  // ------------------------------------------------------------
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
    if (!res.ok) {
      root.innerHTML = '<p style="color:#b91c1c">Impossible de charger le header.</p>';
      return;
    }
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


    // Pas d’onglet actif sur la page Profil
    root.querySelectorAll('.ib-nav__link').forEach(a => a.classList.remove('is-active'));

    // Routes
    root.querySelector('.ib-logo')?.addEventListener('click', () => loadPage('home'));
    root.querySelector('.ib-nav__link[data-tab="home"]')?.addEventListener('click', (e) => {
      e.preventDefault(); loadPage('home');
    });
    root.querySelector('.ib-icon--profile')?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      loadPage('profile');
    });
    root.querySelector('.ib-rightlink')?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      loadPage('post');
    });
    root.querySelector('.ib-icon--bookmark')?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      loadPage('bookmark');
    });
  }

  // ------------------------------------------------------------
  // Helpers DOM
  // ------------------------------------------------------------
  const byId = (id) => document.getElementById(id);

  function setText(id, val) {
    const el = byId(id);
    if (!el) return;
    const s = (val == null) ? '' : String(val).trim();
    el.textContent = (s !== '') ? s : '—';
  }

  function setInput(id, val) {
    const el = byId(id);
    if (!el) return;
    el.value = (val == null) ? '' : String(val);
  }

  function toggleEditing(on) {
    const card = document.querySelector('.profile-card');
    if (!card) return;
    card.classList.toggle('is-editing', !!on);
    const btnSave = byId('btnSave');
    if (btnSave) btnSave.disabled = !on;
  }

  // ------------------------------------------------------------
  // Page init
  // ------------------------------------------------------------
  async function init({ app, loadPage, nui, popup }) {
    const mount = app.querySelector('#header-root');
    await injectHeader(mount, loadPage, nui);

    // Récupère (ou crée) l’entreprise liée au setjob
    let out = null;
    try { out = await nui('indead:getOrCreateCompany', {}); } catch (e) { /* noop */ }
    const c = (out?.ok && out.company) ? out.company : null;

    if (!c) {
      const card = app.querySelector('.profile-card');
      if (card) {
        const msg = document.createElement('p');
        msg.style.color = '#b91c1c';
        msg.style.marginTop = '8px';
        msg.textContent = out?.message || 'Impossible de charger le profil.';
        card.appendChild(msg);
      }
      return;
    }

    // Remplit la vue (lecture)
    setText('c-label',   c.job_label);
    setText('c-address', c.address);
    setText('c-owner',   c.owner_name);
    setText('c-type',    c.company_type);

    // Remplit les inputs (édition)
    setInput('i-address', c.address);
    setInput('i-owner',   c.owner_name);
    setInput('i-type',    c.company_type);

    // Boutons
    const btnEdit = byId('btnEdit');
    const btnSave = byId('btnSave');

    btnEdit?.addEventListener('click', () => toggleEditing(true));

    btnSave?.addEventListener('click', async () => {
      if (btnSave.disabled) return;

      const payload = {
        address:    byId('i-address')?.value ?? '',
        owner_name: byId('i-owner')?.value ?? '',
        company_type: byId('i-type')?.value ?? ''
      };
      // Trim client
      Object.keys(payload).forEach(k => payload[k] = String(payload[k] || '').trim());

      // Verrouille le bouton pendant la sauvegarde
      btnSave.disabled = true;

      let res = null;
      try { res = await nui('indead:updateCompany', payload); } catch (e) { /* noop */ }

      if (res?.ok && res.company) {
        const u = res.company;

        // Màj lecture
        setText('c-address', u.address);
        setText('c-owner',   u.owner_name);
        setText('c-type',    u.company_type);

        // Màj inputs
        setInput('i-address', u.address);
        setInput('i-owner',   u.owner_name);
        setInput('i-type',    u.company_type);

        toggleEditing(false);
        popup?.({ title: 'Sauvegardé', description: 'Profil mis à jour.' });
      } else {
        btnSave.disabled = false;
        popup?.({ title: 'Erreur', description: res?.message || "Impossible d'enregistrer." });
      }
    });
  }

  window.Indead.pages.profile = { init };
})();
