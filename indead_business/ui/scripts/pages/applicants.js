// ui/scripts/pages/applicants.js
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

  function fmtDateHuman(v){
    if (v == null) return '—';
    const s = String(v).trim();
    if (/^\d+$/.test(s)) { const n = Number(s); const d = new Date(n < 1e12 ? n*1000 : n);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleDateString(undefined,{year:'numeric',month:'2-digit',day:'2-digit'}) + ' ' +
             d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
    }
    const d2 = new Date(s.replace(' ', 'T'));
    if (!isNaN(d2.getTime())) {
      return d2.toLocaleDateString(undefined,{year:'numeric',month:'2-digit',day:'2-digit'}) + ' ' +
             d2.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
    }
    return s;
  }

  async function injectHeader(root, loadPage, nui){
    ensureHeaderCss();
    const res = await fetch('partials/header.html', { cache: 'no-store' });
    root.innerHTML = await res.text();

    root.querySelector('.ib-logo')?.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); loadPage('home'); });
    root.querySelector('.ib-nav__link[data-tab="home"]')?.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); loadPage('home'); });
    root.querySelector('.ib-icon--bookmark')?.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); loadPage('bookmark'); });
    root.querySelector('.ib-rightlink')?.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); loadPage('post'); });
    root.querySelector('.ib-icon--profile')?.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); loadPage('profile'); });
    root.querySelector('.ib-icon--applicants')?.addEventListener('click',(e)=>{ e.preventDefault(); e.stopPropagation(); loadPage('applicants'); });

    try {
      const r = await nui('indead:getNotifyCount', {}); const n = r?.ok ? (r.count||0) : 0;
      const badge = root.querySelector('#notifBadge'); if (badge) { badge.textContent = String(n); badge.hidden = n<=0; }
    } catch (e) {}

    const panel = root.querySelector('#notifPanel');
    const list  = root.querySelector('#notifList');
    const bell  = root.querySelector('.ib-icon--bell');
    const fmtT  = (ts)=> (String(ts||'').match(/\s(\d{2}:\d{2})/)||[])[1] || '';
    bell?.addEventListener('click', async (ev)=>{
      ev.preventDefault(); ev.stopPropagation();
      if (!panel) return;
      if (!panel.hasAttribute('hidden')) { panel.setAttribute('hidden',''); return; }
      let out=null; try{ out=await nui('indead:openNotifications',{});}catch(e){}
      const items = (out?.ok && Array.isArray(out.items)) ? out.items : [];
      list.innerHTML = items.length
        ? items.map(i => `<div class="ib-notifitem"><b>${i.firstname} ${i.lastname}</b> a postulé à votre offre <b>${i.offer_code}</b><span class="ib-notiftime">${fmtT(i.created_at)}</span></div>`).join('')
        : `<div class="ib-notifitem">Aucune nouvelle notification.</div>`;
      const badge = root.querySelector('#notifBadge'); if (badge) badge.hidden = true;
      panel.removeAttribute('hidden');
      const close = (e) => { if (!panel.contains(e.target) && e.target !== bell) { panel.setAttribute('hidden',''); document.removeEventListener('click', close, true); } };
      setTimeout(() => document.addEventListener('click', close, true), 0);
    });
  }

  const $ = (id)=>document.getElementById(id);
  const esc = (s)=>String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // Normalisation statuts
  const normForUi = (s) => (s === 'ACCEPTE' ? 'ACCEPTER' : s === 'REFUSE' ? 'REFUSER' : s);
  const normForClass = (s) => {
    const v = String(s||'').toUpperCase();
    if (v === 'ACCEPTER' || v === 'ACCEPTE') return 'ACCEPTE';
    if (v === 'REFUSER'  || v === 'REFUSE')  return 'REFUSE';
    return v;
  };

  function renderItem(a){
    const st = normForClass(a.status);
    const cls = st === 'ACCEPTE' ? 'is-accepted' : st === 'REFUSE' ? 'is-refused' : '';
    return `<article class="app-card ${cls}" data-id="${a.id}">
      <div class="app-title">${esc(a.firstname)} ${esc(a.lastname)}</div>
      <div class="app-meta">Offre ${esc(a.offer_code)} • ${fmtDateHuman(a.created_at)}</div>
      <div class="badge-status">${esc(a.status || 'NOUVEAU')}</div>
    </article>`;
  }

  function mountList(items){
    const list=$('appsList'), empty=$('appsEmpty'), loading=$('appsLoading');
    loading.hidden=true; list.innerHTML='';
    if(!items || !items.length){ empty.hidden=false; return; }
    empty.hidden=true; list.innerHTML = items.map(renderItem).join('');
    list.querySelectorAll('.app-card').forEach(el => el.addEventListener('click', ()=>select(el.dataset.id)));
  }

  function safeParse(s){ try{ return JSON.parse(s); }catch(e){ return null; } }

  function applyDetailStamp(status){
    const st = normForClass(status);
    const card = document.getElementById('appDetail');
    card.classList.remove('accepted','refused');
    if (st === 'ACCEPTE') card.classList.add('accepted');
    if (st === 'REFUSE')  card.classList.add('refused');
  }

  function setStatusPill(status){
    const pill = $('a-statusPill'); if(!pill) return;
    const st = normForClass(status);
    pill.className = 'status-pill';
    if (st === 'ACCEPTE'){ pill.classList.add('is-accepted'); pill.textContent = 'ACCEPTÉ'; return; }
    if (st === 'REFUSE'){  pill.classList.add('is-refused');  pill.textContent = 'REFUSÉ'; return; }
    if (st === 'EN_COURS'){ pill.classList.add('is-progress'); pill.textContent = 'EN COURS'; return; }
    pill.classList.add('is-new'); pill.textContent = 'NOUVEAU';
  }

  async function select(id){
    const a = (window.__APPS__||[]).find(x=>String(x.id)===String(id));
    if(!a) return;

    document.querySelectorAll('.app-card').forEach(e=>e.classList.remove('is-active'));
    document.querySelector(`.app-card[data-id="${CSS.escape(String(id))}"]`)?.classList.add('is-active');

    $('a-name').textContent = `${a.firstname} ${a.lastname}`;
    $('a-offer').textContent = a.offer_code || '—';
    $('a-date').textContent  = fmtDateHuman(a.created_at);

    // Statut (select + pill + stamp)
    const sel = $('a-statusSel'); if (sel) sel.value = normForUi(a.status || 'NOUVEAU');
    setStatusPill(a.status || 'NOUVEAU');
    applyDetailStamp(a.status || 'NOUVEAU');

    // Voir l’offre -> "Mes offres"
    $('a-viewoffer').onclick = () => {
      window.Indead = window.Indead || {};
      if (window.Indead?.ctx?.state) { window.Indead.ctx.state.openOfferId = a.offer_id; }
      window.Indead?.ctx?.loadPage?.('bookmark');
    };

    // Profil + Appeler
    let out=null; try{ out = await window.Indead?.ctx?.nui('indead:getApplicantProfile', { citizenid:a.applicant_citizenid }); }catch(e){}
    const p = out?.profile || {};
    $('a-phone').textContent = p?.phone || '—';
    $('a-email').textContent = p?.email || '—';
    $('a-call').onclick = async () => {
      if (!p?.phone) { alert('Numéro indisponible'); return; }
      try{
        const rr = await window.Indead?.ctx?.nui('indead:callApplicant', { phone: p.phone });
        if(!(rr && rr.ok)){ alert('Impossible de démarrer l\'appel.'); }
      }catch(e){ alert('Erreur appel.'); }
    };

    // CV (les H4 sont maintenant dans le HTML, on n'injecte que les items)
    const cv = (p?.cv_json ? safeParse(p.cv_json) : null) || {};
    const dipsWrap = $('cv-diplomas');
    const dips = Array.isArray(cv.diplomas) ? cv.diplomas : [];
    dipsWrap.innerHTML = dips.length ? dips.map(d => `
      <div class="dip">
        <div><b>${esc(d.title || '—')}</b> — ${esc(d.school || '—')}</div>
        <div class="meta">${esc(String(d.year || '—'))}</div>
      </div>`).join('') : `<div class="meta">Aucun diplôme</div>`;

    const expsWrap = $('cv-experiences');
    const exps = Array.isArray(cv.experiences) ? cv.experiences : [];
    expsWrap.innerHTML = exps.length ? exps.map(e => `
      <div class="exp">
        <div><b>${esc(e.title || '—')}</b> — ${esc(e.company || '—')}</div>
        <div class="meta">${esc(e.contract_type || '—')} • ${esc(String(e.start_year||'—'))}–${esc(String(e.end_year||'—'))}</div>
        <div>${esc(e.details || '')}</div>
      </div>`).join('') : `<div class="meta">Aucune expérience</div>`;

    const skillsWrap = $('cv-skills');
    const skills = Array.isArray(cv.skills) ? cv.skills : [];
    skillsWrap.innerHTML = skills.length
      ? skills.map(s=>`<span class="skill-badge">${esc(String(s))}</span>`).join('')
      : `<div class="meta">Aucune compétence</div>`;

    // Sauvegarde statut
    $('a-statusBtn').onclick = async () => {
      const newStatusUi = $('a-statusSel').value;
      try{
        const res = await window.Indead?.ctx?.nui('indead:updateApplicationStatus', { id:a.id, status:newStatusUi });
        if(res && res.ok){
          const saved = res.status || newStatusUi;
          a.status = saved;
          // MAJ affichages
          const st = normForClass(saved);
          const left = document.querySelector(`.app-card[data-id="${CSS.escape(String(a.id))}"]`);
          if (left){
            left.querySelector('.badge-status').textContent = saved;
            left.classList.remove('is-accepted','is-refused');
            if(st==='ACCEPTE') left.classList.add('is-accepted');
            if(st==='REFUSE')  left.classList.add('is-refused');
          }
          setStatusPill(saved);
          applyDetailStamp(saved);
          const ok = $('a-statusSave'); ok.hidden = false; setTimeout(()=> ok.hidden = true, 1400);
        }else{
          alert('Échec mise à jour du statut');
        }
      }catch(e){
        alert('Erreur mise à jour statut');
      }
    };
  }

  async function init({ app, loadPage, nui }){
    await injectHeader(app.querySelector('#header-root'), loadPage, nui);
    let res=null; try{ res = await nui('indead:getApplicants', {}); }catch(e){}
    const items = (res?.ok && Array.isArray(res.items)) ? res.items : [];
    window.__APPS__ = items;
    mountList(items);
    if(items.length>0) select(items[0].id);
  }

  window.Indead.pages.applicants = { init };
})();
