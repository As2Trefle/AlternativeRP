// ui/scripts/pages/post.js
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

    root.querySelectorAll('.ib-nav__link').forEach(a => a.classList.remove('is-active'));
    root.querySelector('.ib-logo')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); loadPage('home'); });
    root.querySelector('.ib-nav__link[data-tab="home"]')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); loadPage('home'); });
    root.querySelector('.ib-icon--profile')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); loadPage('profile'); });
    root.querySelector('.ib-rightlink')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); loadPage('post'); });
    root.querySelector('.ib-icon--bookmark')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); loadPage('bookmark'); });
  }

  const byId = (id) => document.getElementById(id);
  const textOrDash = (v) => { const s = (v==null)?'':String(v).trim(); return s!==''?s:'—'; };
  const plural = (n, base) => (Number(n) === 1) ? base : base + 's';
  const escapeHTML = (s) => String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function splitLines(s){ return String(s||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean); }

  function buildListSection(title, lines){
    if (!lines.length) return '';
    const items = lines.map(li=>`<li>${escapeHTML(li)}</li>`).join('');
    return `<h4>${escapeHTML(title)}</h4><ul>${items}</ul>`;
  }

  function buildParagraphSection(title, text){
    const t = String(text||'').trim();
    if (!t) return '';
    const paras = t.split(/\n{2,}/).map(p=>`<p>${escapeHTML(p).replace(/\n/g,'<br>')}</p>`).join('');
    return `<h4>${escapeHTML(title)}</h4>${paras}`;
  }

  function renderDetailsHTML(){
    const desc     = byId('d-desc')?.value || '';
    const missions = splitLines(byId('d-missions')?.value || '');
    const profile  = splitLines(byId('d-profile')?.value || '');
    const benefits = splitLines(byId('d-benefits')?.value || '');
    const html =
      buildParagraphSection('Description', desc) +
      buildListSection('Missions', missions) +
      buildListSection('Profil recherché', profile) +
      buildListSection('Avantages', benefits);
    return html || '—';
  }

  function refreshPreview(step2Visible) {
    const title    = byId('i-title').value;
    const label    = byId('i-label').value;
    const loc      = byId('i-location').value;
    const delay    = byId('i-delay').value || '2';
    const unit     = byId('i-delayUnit').value; // 'jour' | 'semaine'
    const salary   = byId('i-salary').value;
    const contract = byId('i-contract').value;

    byId('pv-title').textContent    = textOrDash(title);
    byId('pv-company').textContent  = textOrDash(label);
    byId('pv-location').textContent = textOrDash(loc);

    const unitText = plural(delay, unit);
    byId('pv-blue').innerHTML  = `<i>⚡</i> Répond généralement dans un délai de ${delay} ${unitText}.`;
    byId('pv-green').innerHTML = (salary.trim() !== '')
      ? `À partir de ${escapeHTML(salary)} <b>✓</b>` : 'À partir de — <b>✓</b>';
    byId('pv-gray').textContent = textOrDash(contract);

    if (step2Visible !== false && !byId('formStep2').classList.contains('hidden')) {
      byId('pv-bodyhtml').innerHTML = renderDetailsHTML();
    }
  }

  function resetAll(company) {
    byId('i-title').value = '';
    byId('i-location').value = company?.address || '';
    byId('i-delay').value = '2';
    byId('i-delayUnit').value = 'jour';
    byId('i-salary').value = '';
    byId('i-contract').value = '';
    ['d-desc','d-missions','d-profile','d-benefits'].forEach(id => { const el = byId(id); if (el) el.value = ''; });
    byId('formStep1').classList.remove('hidden');
    byId('formStep2').classList.add('hidden');
    byId('btnContinue').classList.remove('hidden');
    byId('btnValidate').classList.add('hidden');
    byId('pv-title').textContent = '—';
    byId('pv-company').textContent = byId('i-label').value || '—';
    byId('pv-location').textContent = company?.address || '—';
    byId('pv-blue').innerHTML = `<i>⚡</i> Répond généralement dans un délai de 2 jours.`;
    byId('pv-green').innerHTML = 'À partir de — <b>✓</b>';
    byId('pv-gray').textContent = '—';
    byId('pv-bodyhtml').innerHTML = '—';
  }

  // --- parse details_html (pour préremplir étape 2 lors d'une réactivation) ---
  function parseDetailsHTML(html) {
    const out = { desc:'', missions:[], profile:[], benefits:[] };
    if (!html || typeof DOMParser === 'undefined') return out;
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const h4s = Array.from(doc.querySelectorAll('h4'));
      function collectUntilNext(start){
        const parts=[]; let n=start.nextSibling;
        while(n && !(n.nodeType===1 && n.tagName==='H4')) { parts.push(n); n = n.nextSibling; }
        return parts;
      }
      function textOf(el){
        if (!el) return ''; return el.textContent.replace(/\u00A0/g,' ').trim();
      }
      h4s.forEach(h => {
        const title = h.textContent.trim().toLowerCase();
        const seg = collectUntilNext(h);
        if (title.includes('description')){
          // paragraphs
          const ps = seg.filter(x => x.nodeType===1 && x.tagName==='P');
          out.desc = ps.map(p => textOf(p).replace(/\n+/g,'\n')).join('\n\n');
        } else if (title.includes('mission')){
          const ul = seg.find(x => x.nodeType===1 && x.tagName==='UL');
          if (ul) out.missions = Array.from(ul.querySelectorAll('li')).map(li => textOf(li));
        } else if (title.includes('profil')){
          const ul = seg.find(x => x.nodeType===1 && x.tagName==='UL');
          if (ul) out.profile = Array.from(ul.querySelectorAll('li')).map(li => textOf(li));
        } else if (title.includes('avantage')){
          const ul = seg.find(x => x.nodeType===1 && x.tagName==='UL');
          if (ul) out.benefits = Array.from(ul.querySelectorAll('li')).map(li => textOf(li));
        }
      });
    } catch(e) {}
    return out;
  }

  async function init({ app, loadPage, nui, popup }) {
    const mount = app.querySelector('#header-root');
    await injectHeader(mount, loadPage, nui);

    // Profil entreprise
    let out = null;
    try { out = await nui('indead:getOrCreateCompany', {}); } catch(e) {}
    const c = (out?.ok && out.company) ? out.company : null;
    window.__INDEAD_COMPANY__ = c;

    if (c) {
      byId('i-label').value    = c.job_label || '';
      byId('i-location').value = c.address   || '';
      const t = (c.company_type && c.company_type.trim() !== '') ? c.company_type : 'Anonyme';
      byId('pv-type').textContent = t;
      byId('i-companyTypeDisplay').textContent = t;
    } else {
      byId('i-label').value = '';
      byId('pv-type').textContent = 'Anonyme';
      byId('i-companyTypeDisplay').textContent = 'Anonyme';
    }

    // ---- Mode réactivation ? (depuis bookmark) ----
    let reactivateId = null;
    const st = window.Indead?.ctx?.state;
    if (st?.reactivate) {
      reactivateId = st.reactivate.id;
      const p = st.reactivate.prefill || {};
      // Étape 1
      byId('i-title').value    = p.title || '';
      byId('i-location').value = p.location || (c?.address || '');
      byId('i-delay').value    = String(p.response_value || 2);
      byId('i-delayUnit').value= (p.response_unit === 'semaine') ? 'semaine' : 'jour';
      byId('i-salary').value   = p.salary_badge || '';
      byId('i-contract').value = p.contract_type || '';
      // Étape 2 (on tente de reconstruire depuis details_html)
      const parsed = parseDetailsHTML(p.details_html || '');
      byId('d-desc').value     = parsed.desc || '';
      byId('d-missions').value = (parsed.missions || []).join('\n');
      byId('d-profile').value  = (parsed.profile  || []).join('\n');
      byId('d-benefits').value = (parsed.benefits || []).join('\n');

      // On montre directement l'étape 2 pour personnaliser
      byId('formStep1').classList.add('hidden');
      byId('formStep2').classList.remove('hidden');
      byId('btnContinue').classList.add('hidden');
      byId('btnValidate').classList.remove('hidden');

      // Preview direct
      byId('pv-bodyhtml').innerHTML = renderDetailsHTML();
      refreshPreview(false);

      // Nettoie l’état (une fois entré sur la page)
      delete st.reactivate;
    }

    // Live preview
    ['i-title','i-label','i-location','i-delay','i-delayUnit','i-salary','i-contract']
      .forEach(id => byId(id)?.addEventListener('input', () => refreshPreview(true)));
    ['d-desc','d-missions','d-profile','d-benefits']
      .forEach(id => byId(id)?.addEventListener('input', () => { byId('pv-bodyhtml').innerHTML = renderDetailsHTML(); }));

    refreshPreview(true);

    // Continuer → Étape 2
    byId('btnContinue')?.addEventListener('click', () => {
      byId('formStep1').classList.add('hidden');
      byId('formStep2').classList.remove('hidden');
      byId('btnContinue').classList.add('hidden');
      byId('btnValidate').classList.remove('hidden');
      byId('pv-bodyhtml').innerHTML = renderDetailsHTML();
    });

    // Valider → create ou reactivate
    byId('btnValidate')?.addEventListener('click', async () => {
      const title = String(byId('i-title').value || '').trim();
      if (!title) { popup?.({ title:'Titre manquant', description:"Merci de saisir un titre d'annonce." }); return; }

      const payload = {
        title,
        location: String(byId('i-location').value || '').trim(),
        response_value: Math.max(1, parseInt(byId('i-delay').value || '1', 10) || 1),
        response_unit: (byId('i-delayUnit').value === 'semaine') ? 'semaines' : 'jours',
        salary_badge: String(byId('i-salary').value || '').trim(),
        contract_type: String(byId('i-contract').value || '').trim(),
        details_html: renderDetailsHTML()
      };

      let res = null;
      try {
        if (reactivateId) {
          res = await nui('indead:reactivateOffer', { id: reactivateId, data: payload });
        } else {
          res = await nui('indead:createOffer', payload);
        }
      } catch (e) {}

      if (res?.ok) {
        resetAll(window.__INDEAD_COMPANY__);
        popup?.({
          title: reactivateId ? 'Offre réactivée' : 'Offre publiée',
          description: `Identifiant: ${res.offer_code}\nExpiration: ${res.expires_at}`
        });
        setTimeout(() => { window.Indead?.ctx?.loadPage?.('home'); }, 400);
      } else {
        popup?.({ title:'Erreur', description: res?.message || "Impossible d'enregistrer l'offre." });
      }
    });
  }

  window.Indead.pages.post = { init };
})();
