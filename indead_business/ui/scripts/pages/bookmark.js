// ui/scripts/pages/bookmark.js
(() => {
  window.Indead = window.Indead || {};
  window.Indead.pages = window.Indead.pages || {};

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

    // --- Notifications : badge + panneau ---
    async function setupNotifications(root, nui){
      const badge = root.querySelector('#notifBadge');
      const panel = root.querySelector('#notifPanel');
      const list  = root.querySelector('#notifList');
      const bell  = root.querySelector('.ib-icon--bell');

      try{
        const r = await nui('indead:getNotifyCount', {});
        const n = r?.ok ? (r.count||0) : 0;
        if(n>0){ badge.textContent=String(n); badge.hidden=false; } else { badge.hidden=true; }
      }catch(e){}

      const fmt = (ts)=> (String(ts||'').match(/\s(\d{2}:\d{2})/)||[])[1] || '';
      bell?.addEventListener('click', async (ev)=>{
        ev.preventDefault(); ev.stopPropagation();
        if(!panel) return;

        if(!panel.hasAttribute('hidden')){ panel.setAttribute('hidden',''); return; }

        let res = null;
        try{ res = await nui('indead:openNotifications', {}); }catch(e){}
        const items = (res?.ok && Array.isArray(res.items)) ? res.items : [];

        list.innerHTML = items.length
          ? items.map(i => `<div class="ib-notifitem">
              <b>${i.firstname} ${i.lastname}</b> a postulé à votre offre <b>${i.offer_code}</b>
              <span class="ib-notiftime">${fmt(i.created_at)}</span>
            </div>`).join('')
          : `<div class="ib-notifitem">Aucune nouvelle notification.</div>`;

        badge.hidden = true;
        panel.removeAttribute('hidden');

        const close = (e) => {
          if(!panel.contains(e.target) && e.target !== bell){
            panel.setAttribute('hidden',''); document.removeEventListener('click', close, true);
          }
        };
        setTimeout(()=>document.addEventListener('click', close, true), 0);
      });
    }
    await setupNotifications(root, nui);

    // --- Routes ---
    root.querySelectorAll('.ib-nav__link').forEach(a => a.classList.remove('is-active'));
    root.querySelector('.ib-nav__link[data-tab="home"]')?.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); loadPage('home'); });
    root.querySelector('.ib-logo')?.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); loadPage('home'); });
    root.querySelector('.ib-icon--profile')?.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); loadPage('profile'); });
    root.querySelector('.ib-rightlink')?.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); loadPage('post'); });
    root.querySelector('.ib-icon--bookmark')?.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); loadPage('bookmark'); });
    root.querySelector('.ib-icon--applicants')?.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); loadPage('applicants'); });
  }

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const tdash = (v) => { const s = (v==null)?'':String(v).trim(); return s!==''?s:'—'; };

  function renderOfferItem(o){
    const unit = (o.response_unit === 'semaines' || o.response_unit === 'semaine') ? 'semaine' : 'jour';
    const unitText = (Number(o.response_value) === 1) ? unit : unit + 's';
    const compType = (o.company_type && String(o.company_type).trim() !== '') ? o.company_type : 'Anonyme';
    const expired = Number(o.expired) === 1;

    return `
      <article class="offer ${expired ? 'is-expired' : ''}" data-id="${o.id}" role="listitem" tabindex="0" aria-label="${esc(o.title)}">
        <a class="o-title" href="javascript:void(0)">${esc(o.title)}</a>
        <div class="o-company">${esc(o.job_label || o.job_name || '')}</div>
        <div class="o-location">${esc(o.location || '')}</div>
        <div class="o-badges">
          <span class="b b-blue"><i>⚡</i> Répond généralement dans un délai de ${o.response_value} ${unitText}.</span>
          <span class="b b-green">${o.salary_badge ? 'À partir de ' + esc(o.salary_badge) + ' <b>✓</b>' : 'À partir de — <b>✓</b>'}</span>
          <span class="b b-gray">${esc(o.contract_type || '—')}</span>
        </div>
        <span class="o-type">${esc(compType)}</span>
      </article>`;
  }

  function mountList(items){
    const list = $('offersList'), empty=$('offersEmpty'), loading=$('offersLoading');
    loading.hidden = true; list.innerHTML='';

    if (!items || items.length===0){ empty.hidden=false; return; }
    empty.hidden=true;
    list.innerHTML = items.map(renderOfferItem).join('');

    list.querySelectorAll('.offer').forEach(el=>{
      el.addEventListener('click', ()=>selectOffer(el.dataset.id));
      el.addEventListener('keydown', (ev)=>{ if(ev.key==='Enter'||ev.key===' '){ ev.preventDefault(); selectOffer(el.dataset.id); } });
    });
  }

  function attachDeleteHandler(itemId, popup, nui){
    $('btnDelete').onclick = async () => {
      const ok = window.confirm ? window.confirm("Supprimer définitivement cette offre ?") : true;
      if (!ok) return;

      let res = null;
      try { res = await nui('indead:deleteOffer', { id: itemId }); } catch(e) {}
      if (res?.ok) {
        const arr = (window.__INDEAD_MYOFFERS__||[]);
        const idx = arr.findIndex(x=>String(x.id)===String(itemId));
        if (idx >= 0) arr.splice(idx,1);

        const card = $('offersList').querySelector(`.offer[data-id="${CSS.escape(String(itemId))}"]`);
        if (card) card.remove();

        if (!arr.length) {
          $('offersEmpty').hidden = false;
          $('detailCard').classList.remove('expired');
          $('d-title').textContent = '—';
          $('d-company').textContent = '—';
          $('d-location').textContent = '—';
          $('d-blue').innerHTML = `<i>⚡</i> Répond généralement dans un délai de —.`;
          $('d-green').innerHTML = 'À partir de — <b>✓</b>';
          $('d-gray').textContent = '—';
          $('d-type').textContent = '—';
          $('d-bodyhtml').innerHTML = '—';
          ['btnReactivate','btnCancel','btnDelete'].forEach(id => $(id).classList.add('hidden'));
        } else {
          const first = $('offersList').querySelector('.offer');
          if (first) selectOffer(first.dataset.id);
        }
      } else {
        (popup || alert)({ title:'Erreur', description: res?.message || "Impossible de supprimer l'offre." });
      }
    };
  }

  function setDetailButtons(expired, itemId, popup, nui){
    const bReact = $('btnReactivate');
    const bCancel = $('btnCancel');
    const bDelete = $('btnDelete');

    if (expired) {
      bReact.classList.remove('hidden');
      bCancel.classList.add('hidden');
      bDelete.classList.remove('hidden');

      bReact.onclick = () => {
        const item = (window.__INDEAD_MYOFFERS__||[]).find(x=>String(x.id)===String(itemId));
        if (!item) return;
        window.Indead = window.Indead || {};
        if (window.Indead?.ctx?.state) {
          window.Indead.ctx.state.reactivate = {
            id: item.id,
            prefill: {
              title: item.title || '',
              location: item.location || '',
              response_value: Number(item.response_value) || 2,
              response_unit: (item.response_unit === 'semaines' || item.response_unit === 'semaine') ? 'semaine' : 'jour',
              salary_badge: item.salary_badge || '',
              contract_type: item.contract_type || '',
              details_html: item.details_html || ''
            }
          };
        }
        window.Indead?.ctx?.loadPage?.('post');
      };
      bCancel.onclick = null;
      attachDeleteHandler(itemId, popup, nui);
    } else {
      bReact.classList.add('hidden');
      bCancel.classList.remove('hidden');
      bDelete.classList.remove('hidden');

      bCancel.onclick = async () => {
        const ok = window.confirm ? window.confirm("Annuler cette offre ? Elle sera marquée expirée immédiatement.") : true;
        if (!ok) return;

        let res = null;
        try { res = await nui('indead:cancelOffer', { id: itemId }); } catch(e) {}
        if (res?.ok) {
          const arr = (window.__INDEAD_MYOFFERS__||[]);
          const it = arr.find(x=>String(x.id)===String(itemId));
          if (it){ it.expired = 1; it.expires_at = res.expires_at; }

          $('detailCard').classList.add('expired');
          setDetailButtons(true, itemId, popup, nui);

          const card = $('offersList').querySelector(`.offer[data-id="${CSS.escape(String(itemId))}"]`);
          if (card) card.classList.add('is-expired');
        } else {
          (popup || alert)({ title:'Erreur', description: res?.message || "Impossible d'annuler l'offre." });
        }
      };

      attachDeleteHandler(itemId, popup, nui);
    }
  }

  function selectOffer(id){
    const item = (window.__INDEAD_MYOFFERS__||[]).find(x=>String(x.id)===String(id));
    if(!item) return;

    $('offersList').querySelectorAll('.offer').forEach(el=>el.classList.remove('is-active'));
    const el = $('offersList').querySelector(`.offer[data-id="${CSS.escape(String(id))}"]`);
    if(el) el.classList.add('is-active');

    const unit = (item.response_unit === 'semaines' || item.response_unit === 'semaine') ? 'semaine' : 'jour';
    const unitText = (Number(item.response_value) === 1) ? unit : unit + 's';
    const compType = (item.company_type && String(item.company_type).trim() !== '') ? item.company_type : 'Anonyme';
    const expired = Number(item.expired) === 1;

    $('d-title').textContent    = tdash(item.title);
    $('d-company').textContent  = tdash(item.job_label || item.job_name);
    $('d-location').textContent = tdash(item.location);
    $('d-blue').innerHTML  = `<i>⚡</i> Répond généralement dans un délai de ${item.response_value} ${unitText}.`;
    $('d-green').innerHTML = item.salary_badge ? `À partir de ${esc(item.salary_badge)} <b>✓</b>` : 'À partir de — <b>✓</b>';
    $('d-gray').textContent = tdash(item.contract_type);
    $('d-type').textContent = compType;
    $('d-bodyhtml').innerHTML = item.details_html || '—';

    $('detailCard').classList.toggle('expired', expired);

    setDetailButtons(expired, id, window.Indead?.ctx?.popup, window.Indead?.ctx?.nui);
  }

  // -------------------- INIT --------------------
  async function init({ app, loadPage, nui }) {
    await injectHeader(app.querySelector('#header-root'), loadPage, nui);

    let res = null;
    try { res = await nui('indead:getMyOffers', {}); } catch(e) {}
    const items = (res?.ok && Array.isArray(res.items)) ? res.items : [];
    window.__INDEAD_MYOFFERS__ = items;

    mountList(items);

    // Si on vient de "Postulants" avec une offre cible
    const st = window.Indead?.ctx?.state;
    if (st?.openOfferId) {
      const target = items.find(x => String(x.id) === String(st.openOfferId));
      delete st.openOfferId;
      if (target) { selectOffer(target.id); return; }
    }

    // Sinon, sélectionner la première si dispo
    if (items.length > 0) selectOffer(items[0].id);
  }

  window.Indead.pages.bookmark = { init };
})();
