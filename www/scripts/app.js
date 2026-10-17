/* app.js - interfaccia GPT CORE Mobile */
(() => {
  'use strict';
  const C = window.Core, esc = C.esc;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ============================================================ STORAGE (il "config.json" vive qui)
  const KEY = { cfg: 'gptcore.config', chats: 'gptcore.chats', mail: 'gptcore.mail', cur: 'gptcore.cur', profile: 'gptcore.profile', acc: 'gptcore.accounts' };
  const jget = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v, (kk, vv) => kk === 'thumbs' ? undefined : vv)); return true; } catch (e) { toast('Memoria piena: impossibile salvare'); return false; } };

  let config = Object.assign(C.defaultConfig(), jget(KEY.cfg, {}));
  config.api_keys = config.api_keys || {}; config.api_models = config.api_models || {};
  config.mail = Object.assign({ service: '', template: '', key: '' }, config.mail || {});
  config.google = Object.assign({ web_client_id: '', ios_client_id: '' }, config.google || {});
  let chats = jget(KEY.chats, []);
  let mailHist = jget(KEY.mail, []);
  let curId = null, pending = [], busy = false, ctl = null, stopped = false;
  const saveCfg = () => jset(KEY.cfg, Object.assign({}, config, { system_prompt: '', _filePrompt: '' }));   // il system prompt vive solo in config.json
  const saveChats = () => { chats = chats.slice(0, 60); jset(KEY.chats, chats); };

  // ============================================================ ICONE / UTILITA'
  const I = {
    send: '<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    x: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
    trash: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.35 9m-4.78 0L9.26 9m9.97-3.21c.34.05.68.11 1.02.17m-1.02-.17L18.16 19.67a2.25 2.25 0 01-2.24 2.08H8.08a2.25 2.25 0 01-2.24-2.08L4.77 5.79m14.46 0a48.1 48.1 0 00-3.48-.4m-12 .56c.34-.06.68-.12 1.02-.17m0 0a48.1 48.1 0 013.48-.4m7.5 0v-.92c0-1.18-.91-2.16-2.09-2.2a51.96 51.96 0 00-3.32 0c-1.18.04-2.09 1.02-2.09 2.2v.92m7.5 0a48.67 48.67 0 00-7.5 0"/></svg>',
    key: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.03 5.91c-.5-.09-1.04.04-1.4.4l-2.07 2.07H9v2.25H6.75V18H4.5v-2.25l5.84-5.84c.36-.36.49-.9.4-1.4A6 6 0 1121.75 8.25z"/></svg>',
    check: '<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>',
    chev: '<svg class="chev" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>',
    plus: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>',
    doc: '<svg style="width:16px;height:16px" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 0C12 6.62742 6.62742 12 0 12C6.62742 12 12 17.3726 12 24C12 17.3726 17.3726 12 24 12C17.3726 12 12 6.62742 12 0Z" fill="url(#gg)"/></svg>',
  };
  const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const color = s => 'hsl(' + hue(s) + ' 70% 58%)';
  const fmtDt = ts => { try { return new Date(ts).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ts; } };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  let toastT;
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }
  const show = (el, on) => el.classList.toggle('hidden', !on);

  function ask(title, text, ok, danger) {
    return new Promise(res => {
      $('#dlgT').textContent = title; $('#dlgP').textContent = text;
      const y = $('#dlgYes'); y.textContent = ok || 'OK'; y.classList.toggle('dng', !!danger); y.classList.toggle('pri', !danger);
      show($('#dlg'), true);
      const done = v => { show($('#dlg'), false); $('#dlgYes').onclick = $('#dlgNo').onclick = null; res(v); };
      $('#dlgYes').onclick = () => done(true); $('#dlgNo').onclick = () => done(false);
    });
  }

  // ============================================================ MOTORE ATTIVO + TENDINA
  const engineList = () => Object.entries(config.api_models);
  function engine() {
    const e = config.api_models[config.active];
    if (e) return [config.active, e];
    const f = engineList()[0];
    if (f) { config.active = f[0]; saveCfg(); return f; }
    return null;
  }
  function renderPill() { const e = engine(); $('#pillText').textContent = e ? e[0] : 'Nessuna API'; }
  function renderModelMenu() {
    const act = engine() && engine()[0];
    const items = engineList().map(([a, e]) =>
      `<button class="mi ${a === act ? 'act' : ''}" data-alias="${esc(a)}"><span class="dot" style="background:${color(a)}"></span><span class="t"><b>${esc(a)}</b><small>${esc(e.provider_name || e.provider)} · ${esc(e.model)}</small></span>${a === act ? I.check : ''}</button>`).join('');
    $('#mmCard').innerHTML = (items || '<div class="empty" style="padding:14px">Nessuna API aggiunta.</div>') +
      `<button class="mi" data-alias="__store"><span class="dot" style="background:#4c8df6"></span><span class="t"><b>Aggiungi API</b><small>Apri lo Store API</small></span></button>`;
  }
  function toggleModelMenu(on) {
    const open = on === undefined ? $('#modelMenu').classList.contains('hidden') : on;
    if (open) renderModelMenu();
    show($('#modelMenu'), open); $('#modelPill').classList.toggle('on', open);
  }
  $('#modelPill').onclick = () => toggleModelMenu();
  $('#modelMenu').onclick = e => {
    const b = e.target.closest('[data-alias]');
    if (!b) { if (e.target.id === 'modelMenu') toggleModelMenu(false); return; }
    toggleModelMenu(false);
    if (b.dataset.alias === '__store') return openScreen('store');
    config.active = b.dataset.alias; saveCfg(); renderPill();
  };

  // ============================================================ DRAWER / SCHERMATE
  const drawer = $('#drawer');
  const toggleDrawer = on => { if (on) renderRecents(); drawer.classList.toggle('open', on); };
  $('#btnMenu').onclick = () => toggleDrawer(true);
  $('#dClose').onclick = () => toggleDrawer(false);
  drawer.onclick = e => { if (e.target === drawer) toggleDrawer(false); };
  $('#dNew').onclick = () => { toggleDrawer(false); newChat(); };
  $('#dStore').onclick = () => { toggleDrawer(false); openScreen('store'); };
  $('#dMail').onclick = () => { toggleDrawer(false); openScreen('mail'); };
  $('#dSet').onclick = () => { toggleDrawer(false); openScreen('set'); };
  $('#btnAvatar').onclick = () => openScreen('set');

  const SCR = { store: '#scrStore', mail: '#scrMail', set: '#scrSet' };
  function openScreen(n) {
    if (n === 'store') { S.view = 'home'; S.msg = null; renderStore(); }
    if (n === 'mail') { M.tab = 'write'; M.step = 'compose'; renderMail(); }
    if (n === 'set') renderSettings();
    $(SCR[n]).classList.add('open');
  }
  function closeScreen(n) { $(SCR[n]).classList.remove('open'); renderPill(); }
  $$('[data-back]').forEach(b => b.onclick = () => {
    const n = b.dataset.back;
    if (n === 'store' && S.view !== 'home' && S.view !== 'busy-lock') return storeBack();
    closeScreen(n);
  });

  function renderRecents() {
    const list = [...chats].sort((a, b) => b.ts - a.ts);
    $('#recents').innerHTML = list.length ? list.map(c =>
      `<div class="di ${c.id === curId ? 'cur' : ''}" data-id="${c.id}" style="cursor:pointer"><span class="l">💬 ${esc(c.title)}</span><button class="x" data-del="${c.id}" aria-label="Elimina">${I.x}</button></div>`).join('')
      : '<div class="empty">Nessuna chat salvata</div>';
  }
  $('#recents').onclick = e => {
    const d = e.target.closest('[data-del]');
    if (d) { chats = chats.filter(c => c.id !== d.dataset.del); if (curId === d.dataset.del) newChat(); saveChats(); renderRecents(); return; }
    const r = e.target.closest('[data-id]'); if (!r) return;
    if (busy) return toast('Attendi la fine della risposta');
    curId = r.dataset.id; jset(KEY.cur, curId); renderChat(); toggleDrawer(false);
  };

  // ============================================================ CHAT
  const main = $('#main'), chatEl = $('#chat'), inp = $('#inp');
  const curChat = () => chats.find(c => c.id === curId);
  function showChatMode(on) { show($('#hero'), !on); show($('#sugg'), !on); show(chatEl, on); }
  function newChat() {
    if (busy) return toast('Attendi la fine della risposta');
    curId = null; pending = []; renderChips(); chatEl.innerHTML = ''; showChatMode(false); inp.value = ''; autoGrow(); syncBtn();
  }
  function renderChat() {
    chatEl.innerHTML = ''; const c = curChat();
    if (!c || !c.messages.length) return showChatMode(false);
    showChatMode(true);
    c.messages.forEach(m => { if (m.role === 'user') chatEl.appendChild(userNode(m)); else { const n = aiNode(); fillAI(n, m); chatEl.appendChild(n.el); } });
    main.scrollTop = main.scrollHeight;
  }
  function userNode(m) {
    const d = document.createElement('div'); d.className = 'u'; let h = '';
    if (m.thumbs && m.thumbs.length) h += '<div class="thumbs">' + m.thumbs.map(t => `<img src="${t}" alt="">`).join('') + '</div>';
    else if (m.imgs) h += `<div class="tag">📷 ${m.imgs} immagine/i</div>`;
    if (m.docs && m.docs.length) h += `<div class="tag">📁 ${esc(m.docs.join(', '))}</div>`;
    d.innerHTML = `<div class="bub">${h}${esc(m.content)}</div>`; return d;
  }
  function aiNode() {
    const d = document.createElement('div'); d.className = 'a';
    d.innerHTML = `<div class="ico">${I.spark}</div><div class="ab"><div class="stat"></div><details class="think hidden"><summary>Ragionamento</summary><div class="tt"></div></details><div class="txt ai"><span class="pulse">GPT CORE sta elaborando...</span></div><div class="srcs"></div></div>`;
    return { el: d, stat: $('.stat', d), think: $('.think', d), tt: $('.tt', d), txt: $('.txt', d), srcs: $('.srcs', d), wasOpen: false };
  }
  function renderAI(n, text) {
    const s = C.splitThink(text);
    if (s.think || s.open) {
      n.think.classList.remove('hidden'); n.tt.textContent = s.think;
      if (s.open) { n.think.open = true; n.wasOpen = true; } else if (n.wasOpen) { n.think.open = false; n.wasOpen = false; }
    }
    if (s.answer) n.txt.innerHTML = C.md(s.answer);
    else n.txt.innerHTML = text ? (s.open ? '<span class="pulse">Sto ragionando...</span>' : '') : '<span class="pulse">GPT CORE sta elaborando...</span>';
  }
  function renderSrcs(n, src) {
    n.srcs.innerHTML = (src || []).map((s, i) => `<a href="${esc(s.u)}" target="_blank" rel="noopener">[${i + 1}] ${esc(s.d)}</a>`).join('');
  }
  function fillAI(n, m) {
    if (m.err) n.txt.innerHTML = `<span class="err">${esc(m.content)}</span>`; else renderAI(n, m.content);
    renderSrcs(n, m.src);
  }
  main.addEventListener('click', e => {
    const b = e.target.closest('.copy-btn'); if (!b) return;
    const t = b.closest('.code').querySelector('code').textContent;
    const ok = () => { b.textContent = 'Copiato'; setTimeout(() => b.textContent = 'Copia', 1400); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, () => toast('Copia non riuscita')); else toast('Copia non supportata');
  });

  // composer
  function autoGrow() { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 132) + 'px'; }
  function syncBtn() {
    const has = inp.value.trim().length > 0 || pending.length > 0;
    const b = $('#btnSend'); show(b, has || busy); b.innerHTML = busy ? I.stop : I.send;
    show($('#btnMic'), (!has && !busy) || Rec.active); show($('#btnVoice'), !has && !busy && !Rec.active); show($('#btnCam'), !has && !busy && !Rec.active);
  }
  inp.oninput = () => { autoGrow(); syncBtn(); };
  inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) { e.preventDefault(); send(); } };
  $('#btnSend').onclick = () => send();
  $$('.sc').forEach(b => b.onclick = () => { inp.value = b.dataset.p; autoGrow(); syncBtn(); send(); });
  const nearBottom = () => main.scrollHeight - main.scrollTop - main.clientHeight < 140;

  // allegati
  $('#btnPlus').onclick = () => show($('#attach'), true);
  $('#attach').onclick = e => {
    const k = e.target.closest('[data-k]');
    if (!k && e.target.id !== 'attach') return;
    show($('#attach'), false);
    if (k) ({ gal: $('#fGal'), doc: $('#fDoc') })[k.dataset.k].click();
  };
  ['fGal', 'fCam'].forEach(id => $('#' + id).onchange = async e => {
    for (const f of e.target.files) { try { pending.push({ type: 'img', name: f.name || 'foto', url: await toDataUrl(f) }); } catch (err) { toast('Immagine non leggibile'); } }
    e.target.value = ''; renderChips();
  });
  $('#fDoc').onchange = async e => {
    for (const f of e.target.files) {
      if (f.size > 1.5e6) { toast(f.name + ': troppo grande (max 1,5 MB)'); continue; }
      try { pending.push({ type: 'doc', name: f.name, text: (await f.text()).slice(0, 60000) }); } catch (err) { toast(f.name + ': non leggibile'); }
    }
    e.target.value = ''; renderChips();
  };
  function toDataUrl(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1280 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); res(cv.toDataURL('image/jpeg', .82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); }; img.src = url;
    });
  }
  function renderChips() {
    $('#chips').innerHTML = pending.map((p, i) => `<div class="chip">${p.type === 'img' ? `<img src="${p.url}" alt="">` : `<em>${I.doc}</em>`}<span>${esc(p.name)}</span><button data-rm="${i}" aria-label="Rimuovi">${I.x}</button></div>`).join('');
    syncBtn();
  }
  $('#chips').onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { pending.splice(+b.dataset.rm, 1); renderChips(); } };

  $('#btnCam').onclick = () => $('#fCam').click();

  // ============================================================ RICONOSCIMENTO VOCALE (motore unico: plugin nativo se c'e', altrimenti Web Speech)
  const NativeSR = () => window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition;
  const WebSR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
  const micErr = e => /not-allowed|denied|permission/i.test(e) ? 'Permesso al microfono negato: abilitalo nelle impostazioni del telefono'
    : e === 'unsupported' ? 'Riconoscimento vocale non disponibile qui: usa il microfono della tastiera' : 'Microfono non disponibile';
  const Rec = {
    active: false, _stop: null,
    async start({ onPartial, onFinal, onEnd, onError }) {
      if (Rec.active) return;
      Rec.active = true; syncBtn();
      let last = '', done = false, timer = 0;
      const finish = err => {
        if (done) return; done = true; clearTimeout(timer); Rec.active = false; Rec._stop = null; syncBtn();
        if (err) { onError && onError(String(err)); return; }
        const t = last.trim(); if (t) onFinal && onFinal(t);
        onEnd && onEnd(!!t);
      };
      const nat = NativeSR();
      if (nat) {
        try {
          const p = await nat.requestPermissions();
          if (p && p.speechRecognition && p.speechRecognition !== 'granted') return finish('not-allowed');
          const stopSoon = ms => { clearTimeout(timer); timer = setTimeout(() => nat.stop().catch(() => { }), ms); };
          await nat.removeAllListeners();
          await nat.addListener('partialResults', d => { last = ((d.matches || d.value || [])[0]) || ''; onPartial && onPartial(last); stopSoon(1700); });
          await nat.addListener('listeningState', d => { if (d.status === 'stopped') { nat.removeAllListeners(); finish(); } });
          Rec._stop = () => nat.stop().catch(() => { });
          await nat.start({ language: 'it-IT', maxResults: 1, partialResults: true, popup: false });
          stopSoon(8000);
        } catch (e) { finish((e && e.message) || 'errore'); }
        return;
      }
      const SR = WebSR();
      if (!SR) return finish('unsupported');
      const r = new SR(); r.lang = 'it-IT'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      r.onresult = ev => { let t = ''; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; last = t; onPartial && onPartial(t); };
      r.onerror = ev => { if (ev.error === 'no-speech' || ev.error === 'aborted') return; finish(ev.error || 'errore'); };
      r.onend = () => finish();
      Rec._stop = () => { try { r.stop(); } catch (e) { } };
      try { r.start(); } catch (e) { finish('errore'); }
    },
  };

  // dettatura: un tocco avvia, un secondo tocco ferma (si ferma anche da sola quando smetti di parlare)
  $('#btnMic').onclick = () => {
    if (V.on) return;
    if (Rec.active) { Rec._stop && Rec._stop(); return; }
    const base = inp.value.trim() ? inp.value.trim() + ' ' : '';
    const put = t => { inp.value = base + t; autoGrow(); syncBtn(); };
    $('#btnMic').classList.add('rec'); inp.placeholder = 'Ascolto... tocca il microfono per fermare';
    Rec.start({
      onPartial: put, onFinal: put,
      onEnd: () => { $('#btnMic').classList.remove('rec'); inp.placeholder = 'Chiedi a GPT CORE...'; },
      onError: e => { $('#btnMic').classList.remove('rec'); inp.placeholder = 'Chiedi a GPT CORE...'; toast(micErr(e)); },
    });
  };

  // ============================================================ MODALITA' VOCALE (parli, risponde a voce mentre scrive)
  const V = {
    on: false, state: 'idle', pos: 0, queued: 0, gen: 0, finished: false, muted: false, voice: null,
    hint: '\n\n[MODALITA VOCALE] Stai parlando a voce: rispondi in modo breve, naturale e colloquiale, senza markdown, elenchi puntati, emoji o blocchi di codice.',
    labels: { listening: 'Ti ascolto…', thinking: 'Sto pensando…', speaking: 'Parlo…' },
    set(s) { V.state = s; const el = $('#voice'); el.dataset.s = s; $('#vState').textContent = V.labels[s] || ''; },
    txt(t) { $('#vTxt').textContent = t || ''; },
    pick() {
      try {
        const vs = speechSynthesis.getVoices().filter(v => /^it/i.test(v.lang));
        V.voice = vs.find(v => /google|natural|premium|enhanced|siri/i.test(v.name)) || vs[0] || null;
      } catch (e) { V.voice = null; }
    },
    clean(t) {
      return t.replace(/```[\s\S]*?(```|$)/g, ' ').replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '')
        .replace(/^\s*[-*•]\s+/gm, '').replace(/^\s*#+\s*/gm, '').replace(/[*_#>~|]/g, '')
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();
    },
    say(raw) {
      const t = V.clean(raw); if (!t || !V.on) return;
      const g = V.gen, u = new SpeechSynthesisUtterance(t);
      u.lang = 'it-IT'; if (V.voice) u.voice = V.voice; u.rate = 1.05;
      u.onstart = () => { if (g === V.gen) { V.set('speaking'); V.txt(t); } };
      u.onend = u.onerror = () => { if (g !== V.gen) return; V.queued--; V.check(); };
      V.queued++; speechSynthesis.speak(u);
    },
    // chiamata a ogni pezzo di testo in streaming: legge le frasi complete man mano che arrivano
    feed(full) {
      if (!V.on || V.muted) return;
      if (/<think>/.test(full) && !/<\/think>/.test(full)) return;
      const t = C.stripThink(full); if (t.length < V.pos) V.pos = 0;
      if ((t.match(/```/g) || []).length % 2 === 1) return;   // dentro un blocco di codice: non si legge
      const re = /[.!?…]+["')\]]*\s+|\n+/g; let m, end = -1; const tail = t.slice(V.pos);
      while ((m = re.exec(tail))) end = m.index + m[0].length;
      if (end < 0) return;
      const chunk = tail.slice(0, end); if (V.clean(chunk).length < 14) return;
      V.pos += end; V.say(chunk);
    },
    done(full, isErr, wasStopped) {
      if (!V.on) return;
      V.finished = true;
      if (isErr) { toast(full.replace(/^\[!\]\s*/, '').slice(0, 120)); V.stop(); return; }
      if (!wasStopped && !V.muted) { const t = C.stripThink(full); V.say(t.slice(Math.min(V.pos, t.length))); V.pos = t.length; }
      V.check();
    },
    check() { if (V.on && V.finished && V.queued <= 0) V.listen(); },
    cut() { V.gen++; V.queued = 0; V.muted = true; try { speechSynthesis.cancel(); } catch (e) { } },
    listen() {
      if (!V.on || Rec.active || busy) return;
      try { speechSynthesis.cancel(); } catch (e) { }
      V.set('listening'); V.txt('');
      Rec.start({
        onPartial: t => V.txt(t),
        onFinal: t => {
          if (!V.on) return;
          V.txt(t); V.set('thinking'); V.pos = 0; V.queued = 0; V.finished = false; V.muted = false; V.gen++;
          inp.value = t; send(); if (!busy) V.stop();   // se send() non parte (nessuna API) esco dalla modalità
        },
        onEnd: had => { if (V.on && !had && V.state === 'listening') setTimeout(() => V.listen(), 350); },
        onError: e => { toast(micErr(e)); V.stop(); },
      });
    },
    orb() {
      if (V.state === 'speaking') { V.cut(); if (busy) send(); else { V.finished = true; V.listen(); } }
      else if (V.state === 'listening') { Rec._stop && Rec._stop(); }
      else if (V.state === 'thinking' && busy) send();
    },
    start() {
      if (!engine()) { toast('Aggiungi prima una API dallo Store'); openScreen('store'); return; }
      if (!WebSR() && !NativeSR()) return toast('Riconoscimento vocale non disponibile su questo dispositivo');
      if (!('speechSynthesis' in window)) return toast('Sintesi vocale non disponibile su questo dispositivo');
      V.on = true; V.finished = false; V.muted = false; V.pick();
      try { speechSynthesis.getVoices(); speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch (e) { }   // sblocca l'audio con il gesto dell'utente
      show($('#voice'), true); V.listen();
    },
    stop() {
      V.on = false; V.gen++; V.queued = 0;
      try { speechSynthesis.cancel(); } catch (e) { }
      if (Rec.active) Rec._stop && Rec._stop();
      if (busy) send();
      show($('#voice'), false); V.set('idle');
    },
  };
  try { speechSynthesis.onvoiceschanged = () => V.pick(); } catch (e) { }
  $('#btnVoice').onclick = () => V.start();
  $('#vClose').onclick = () => V.stop();
  $('#vOrb').onclick = () => V.orb();

  // ---------- invio: stesso ciclo di AIAssistant.process_query_streaming (con ricerca web decisa dal modello)
  function historyMessages(c) {
    if (!config.history_enabled || !c) return [];
    const out = [], ms = c.messages.filter(m => !m.err);
    const turns = []; for (let i = 0; i + 1 < ms.length; i += 2) if (ms[i].role === 'user' && ms[i + 1].role === 'assistant') turns.push([ms[i], ms[i + 1]]);
    const last = turns.slice(-20);
    last.forEach(([u, a], i) => {
      const txt = u.content.slice(0, 6000), withImg = i >= last.length - 3 && u.thumbs && u.thumbs.length;
      out.push({ role: 'user', content: withImg ? [{ type: 'text', text: txt }, ...u.thumbs.map(url => ({ type: 'image_url', image_url: { url } }))] : txt });
      out.push({ role: 'assistant', content: C.stripThink(a.content).slice(0, 6000) });
    });
    return out;
  }

  async function send() {
    if (busy) { stopped = true; if (ctl) ctl.abort(); return; }
    const text = inp.value.trim();
    if (!text && !pending.length) return;
    if (/^\/mail$/i.test(text)) { inp.value = ''; autoGrow(); syncBtn(); openScreen('mail'); return; }
    const eng = engine();
    if (!eng) { toast('Aggiungi prima una API dallo Store'); openScreen('store'); return; }
    const [alias, entry] = eng;
    const apiKey = C.resolveKey(config, entry.key_id || entry.provider, C.PROVIDERS[entry.provider]);
    if (!apiKey && !entry.keyless) { toast('Chiave mancante per ' + (entry.provider_name || entry.provider)); openScreen('store'); return; }

    // contesto allegati
    const docs = pending.filter(p => p.type === 'doc'), imgsAll = pending.filter(p => p.type === 'img');
    const images = imgsAll.map(p => p.url);   // le immagini partono sempre: se il modello non le supporta lo dice l'API
    const attCtx = docs.map(d => `[ALLEGATO: ${d.name}]\n${d.text}\n[FINE ALLEGATO]\n\n`).join('');
    const query = text || 'Analizza gli allegati.';

    // chat corrente
    let c = curChat();
    if (!c) { c = { id: uid(), title: query.slice(0, 40), ts: Date.now(), messages: [] }; chats.unshift(c); curId = c.id; jset(KEY.cur, curId); }
    const past = historyMessages(c);
    const um = { role: 'user', content: query, imgs: imgsAll.length, thumbs: imgsAll.map(p => p.url), docs: docs.map(d => d.name) };
    c.messages.push(um); c.ts = Date.now();
    showChatMode(true); chatEl.appendChild(userNode(um));
    const node = aiNode(); chatEl.appendChild(node.el); main.scrollTop = main.scrollHeight;
    inp.value = ''; pending = []; renderChips(); autoGrow();
    busy = true; stopped = false; syncBtn();

    const mode = ['auto', 'always', 'off'].includes(config.web_search) ? config.web_search : 'auto';
    const maxRounds = Math.max(1, parseInt(config.web_max_rounds, 10) || 2);
    const who = config.user_name ? '\n\n[UTENTE] Stai parlando con ' + config.user_name + '. Chiamalo per nome quando e\' naturale. Questo non cambia chi e\' il tuo creatore.' : '';
    const sys = (config.system_prompt || C.DEFAULT_PROMPT) + who + (V.on ? V.hint : '') + (mode !== 'off' ? C.systemHint() : '');
    let webCtx = '', rounds = 0, full = '', sources = [];
    const status = t => { const s = document.createElement('span'); s.textContent = '🌐 ' + t; node.stat.appendChild(s); };
    if (images.length) status(images.length + (images.length > 1 ? ' immagini inviate' : ' immagine inviata') + ' a ' + alias);
    let raf = 0;
    const paint = () => { raf = 0; const nb = nearBottom(); renderAI(node, full); if (nb) main.scrollTop = main.scrollHeight; };

    const runSearch = async q => {
      try {
        const { block, results, err } = await C.buildContext(q, config, rounds >= maxRounds);
        if (!results.length) return { block, line: 'Nessun risultato (' + err + ')' };
        const doms = [];
        results.forEach(r => {
          let d = ''; try { d = new URL(r.url).hostname.replace(/^www\./, ''); } catch (e) { /* ignore */ }
          if (!sources.some(s => s.u === r.url)) sources.push({ u: r.url, d: d || r.url });
          if (d && !doms.includes(d)) doms.push(d);
        });
        return { block, line: results.length + ' fonti: ' + doms.slice(0, 4).join(', ') };
      } catch (ex) { return { block: '', line: 'Ricerca fallita: ' + ex.message }; }
    };

    try {
      if (mode === 'always') {
        const q = query.replace(/\n/g, ' ').slice(0, 200);
        status('Cerco sul web: «' + q + '»'); rounds++;
        const r = await runSearch(q); webCtx += r.block; status(r.line);
      }
      for (; ;) {
        full = ''; V.pos = 0;
        const allow = mode !== 'off' && rounds < maxRounds;
        const userContent = webCtx + attCtx + query;
        const content = images.length ? [{ type: 'text', text: userContent }, ...images.map(u => ({ type: 'image_url', image_url: { url: u } }))] : userContent;
        const messages = [{ role: 'system', content: sys }, ...past, { role: 'user', content }];
        ctl = new AbortController();
        const stream = C.chatStream(entry, apiKey, messages, ctl);
        const events = mode === 'off' ? (async function* () { for await (const x of stream) yield ['text', x]; })() : C.intercept(stream, allow);
        let wanted = null;
        for await (const [kind, val] of events) {
          if (kind === 'text') { full += val; if (V.on) V.feed(full); if (!raf) raf = requestAnimationFrame(paint); } else wanted = val;
        }
        if (wanted === null || stopped) break;
        rounds++; status('Cerco sul web: «' + wanted + '»');
        const r = await runSearch(wanted); webCtx += r.block; status(r.line);
        if (stopped) break;
      }
    } catch (e) { full += (full ? '\n' : '') + '[!] ' + e.message; }

    cancelAnimationFrame(raf);
    if (images.length && full.trim().startsWith('[!]')) full += '\n\nSe «' + alias + '» non legge le immagini, scegli nello Store un modello con il badge rosa «visione» (es. gpt-4o, gemini, llama-4).';
    const isErr = full.trim().startsWith('[!]') || (!full.trim() && !stopped);
    const am = { role: 'assistant', content: full.trim() || (stopped ? '(interrotto)' : '[!] Nessuna risposta dal modello'), src: sources, err: isErr };
    c.messages.push(am); if (config.history_enabled) saveChats(); else { chats = chats.filter(x => x.id !== c.id); curId = null; }
    fillAI(node, am); main.scrollTop = main.scrollHeight;
    busy = false; ctl = null; syncBtn();
    V.done(am.content, isErr, stopped);
  }

  // ============================================================ STORE API
  const S = { view: 'home', pid: '', base: '', key: '', keyId: '', fresh: false, change: false, models: [], q: '', lim: 60, chosen: null, alias: '', err: '', msg: null, test: null, url: '' };
  const PV = C.PROVIDERS;
  const noteH = (k, t) => `<div class="note ${k}">${esc(t)}</div>`;
  const sb = () => $('#storeBody');
  const flash = (kind, text) => { S.msg = { kind, text }; };
  const keyOf = pid => C.resolveKey(config, pid, PV[pid]);

  function storeBack() {
    const v = S.view;
    if (v === 'summary') S.view = 'models';
    else if (v === 'testfail') S.view = 'summary';
    else S.view = 'home';
    S.err = ''; renderStore();
  }
  function renderStore() {
    const t = $('#storeTitle'), b = sb();
    const titles = { home: 'Store API', key: 'Chiave API', custom: 'Server personalizzato', loading: 'Modelli', models: 'Modelli', summary: 'Aggiungi API', testing: 'Test', testfail: 'Test fallito', done: 'Aggiunta' };
    t.textContent = titles[S.view] || 'Store API';
    const V = {
      home() {
        const act = engine() && engine()[0], added = engineList();
        let h = S.msg ? noteH(S.msg.kind, S.msg.text) : '';
        h += `<div class="sec" style="margin-top:6px">API aggiunte · ${added.length}</div>`;
        h += added.length ? added.map(([a, e]) => `<div class="row"><span class="av" style="background:${color(a)}">${esc(a[0].toUpperCase())}</span><div class="t"><b>${esc(a)}</b><small>${esc(e.provider_name || e.provider)} · ${esc(e.model)}</small></div>${a === act ? '<span class="ks ok">attiva</span>' : `<button class="mini" data-act="use" data-a="${esc(a)}" title="Usa">${I.check}</button>`}<button class="mini" data-act="rm" data-a="${esc(a)}" title="Rimuovi">${I.trash}</button></div>`).join('')
          : '<div class="card" style="font-size:13px;color:var(--muted);line-height:1.55">Non hai ancora nessuna API. Scegli un provider qui sotto, incolla la chiave e seleziona un modello: comparirà nel menu in alto.</div>';
        h += '<div class="sec">Provider</div>';
        h += C.PROVIDER_IDS.map(pid => {
          const p = PV[pid], hasKey = !!keyOf(pid) && pid !== 'custom';
          return `<div class="row" data-act="prov" data-p="${pid}" style="cursor:pointer"><span class="av" style="background:${color(pid)}">${esc(p.short[0])}</span><div class="t"><b>${esc(p.name)}</b><small>${esc(p.desc)}</small></div>${pid !== 'custom' ? (hasKey ? '<span class="ks ok">chiave ✓</span>' : '<span class="ks">nessuna chiave</span>') + `<button class="mini" data-act="chgkey" data-p="${pid}" title="Chiave">${I.key}</button>` : ''}${I.chev}</div>`;
        }).join('');
        h += '<div class="hint" style="margin-top:14px">Le chiavi e le API restano solo su questo telefono, nella memoria locale dell\'app.</div>';
        return h;
      },
      key() {
        const p = PV[S.pid];
        return `<p class="big">${esc(p.name)}</p>` + (S.err ? noteH('err', S.err) : '') +
          noteH('info', 'Incolla la chiave API. Viene salvata solo dopo che il provider l\'ha accettata.') +
          (p.keyurl ? `<div class="kv"><span>Crea la chiave</span><b><a href="https://${p.keyurl}" target="_blank" rel="noopener" style="color:var(--blue)">${esc(p.keyurl)}</a></b></div>` : '') +
          `<label class="lbl">Chiave API${S.change && keyOf(S.pid) ? ' (attuale: ' + esc(C.maskKey(keyOf(S.pid))) + ')' : ''}</label><input class="inp" id="kIn" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Incolla qui la chiave">` +
          `<button class="btn pri" data-act="keyok">Verifica e continua</button>` +
          (S.change && keyOf(S.pid) ? '<button class="btn dng" data-act="keydel">Elimina la chiave salvata</button>' : '');
      },
      custom() {
        return `<p class="big">Server personalizzato</p>` + (S.err ? noteH('err', S.err) : '') +
          noteH('info', 'Inserisci l\'URL base di un server compatibile OpenAI (quello che precede /chat/completions).') +
          `<label class="lbl">URL base</label><input class="inp" id="cUrl" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="https://api.tuoserver.it/v1" value="${esc(S.url)}">` +
          `<div class="hint">Esempi: http://192.168.1.10:1234/v1 (LM Studio), http://192.168.1.10:8000/v1 (vLLM)</div>` +
          `<label class="lbl">Chiave API (facoltativa)</label><input class="inp" id="cKey" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Lascia vuoto se il server non la richiede">` +
          `<button class="btn pri" data-act="custok">Collega</button>`;
      },
      loading: () => `<div class="center"><div class="spin"></div><div>${esc(S.loadMsg || 'Attendi…')}</div></div>`,
      testing: () => `<div class="center"><div class="spin"></div><div>Provo ${esc(S.chosen.id)}…</div></div>`,
      models() {
        return `<div class="kv" style="border:0;padding-top:0"><span>Provider</span><b>${esc(PV[S.pid].name)}</b></div><input class="inp" id="mq" placeholder="Cerca tra ${S.models.length} modelli…" value="${esc(S.q)}" autocapitalize="off" spellcheck="false"><div id="mList" style="margin-top:12px"></div>`;
      },
      summary() {
        const m = S.chosen;
        return `<p class="big" style="word-break:break-all">${esc(m.id)}</p><div class="bds" style="margin:0 0 14px">${m.free ? '<span class="bd free">gratis</span>' : ''}${m.vision ? '<span class="bd vis">visione</span>' : ''}${m.ctx ? `<span class="bd ctx">${C.fmtCtx(m.ctx)} ctx</span>` : ''}</div>` +
          `<div class="card"><div class="kv"><span>Provider</span><b>${esc(PV[S.pid].name)}</b></div><div class="kv"><span>Endpoint</span><b>${esc(S.base)}</b></div><div class="kv"><span>Chiave</span><b>${S.key ? esc(C.maskKey(S.key)) : 'nessuna'}</b></div><div class="kv"><span>Modalità</span><b>${m.vision ? 'Visione + testo' : 'Solo testo'}</b></div></div>` +
          `<label class="lbl">Nome nel menu</label><input class="inp" id="aIn" value="${esc(S.alias)}" autocapitalize="off" spellcheck="false">` +
          (S.err ? noteH('err', S.err).replace('class="note', 'style="margin-top:10px" class="note') : '<div class="hint">Minuscole, numeri e . _ - (max 32 caratteri).</div>') +
          `<button class="btn pri" data-act="addgo">Testa e aggiungi</button>`;
      },
      testfail() {
        return noteH('err', 'Il test non è andato a buon fine: ' + S.test.msg) + noteH('info', 'Puoi aggiungerla comunque (per esempio se la quota è esaurita), ma potrebbe non rispondere.') +
          `<button class="btn pri" data-act="addforce">Aggiungi comunque</button><button class="btn" data-act="back">Annulla</button>`;
      },
      done() {
        return noteH('ok', 'API aggiunta con successo!' + (S.test && S.test.ok ? ' Risposta in ' + S.test.secs.toFixed(1) + ' s.' : '')) +
          `<div class="card"><div class="kv"><span>Nome</span><b>${esc(S.alias)}</b></div><div class="kv"><span>Provider</span><b>${esc(PV[S.pid].name)}</b></div><div class="kv"><span>Modello</span><b>${esc(S.chosen.id)}</b></div></div>` +
          `<button class="btn pri" data-act="usenow">Usa subito</button><button class="btn" data-act="back">Aggiungi un'altra</button>`;
      },
    };
    b.innerHTML = V[S.view]();
    if (S.view === 'models') renderModelList();
    if (S.view === 'key') setTimeout(() => { const k = $('#kIn'); if (k) k.focus(); }, 320);
  }

  function renderModelList() {
    const w = S.q.toLowerCase().split(/\s+/).filter(Boolean);
    const flt = w.length ? S.models.filter(m => w.every(x => m.id.toLowerCase().includes(x))) : S.models;
    const shown = flt.slice(0, S.lim);
    $('#mList').innerHTML = shown.length ? shown.map(m => `<button class="row" data-act="pick" data-id="${esc(m.id)}" style="display:block"><b>${esc(m.id)}</b><div class="bds">${m.free ? '<span class="bd free">gratis</span>' : ''}${m.vision ? '<span class="bd vis">visione</span>' : ''}${m.ctx ? `<span class="bd ctx">${C.fmtCtx(m.ctx)} ctx</span>` : ''}${m.price_in ? `<span class="bd">$${m.price_in.toFixed(2)}/M</span>` : ''}</div></button>`).join('') +
      (flt.length > S.lim ? `<button class="btn" data-act="more">Mostra altri (${flt.length - S.lim})</button>` : '')
      : noteH('warn', 'Nessun modello corrisponde alla ricerca.');
  }

  async function loadModels() {
    S.view = 'loading'; S.loadMsg = 'Collegamento a ' + PV[S.pid].name + '…'; renderStore();
    let models;
    try { models = await C.fetchModels(S.base, S.key); }
    catch (e) {
      if (e.name === 'PermissionError') { S.err = e.message + '. Controlla la chiave.'; S.view = S.pid === 'custom' ? 'custom' : 'key'; return renderStore(); }
      flash('err', 'Impossibile ottenere i modelli: ' + (e.message === 'Failed to fetch' ? 'connessione fallita (controlla internet o l\'URL; alcuni provider non accettano richieste dal browser: usa l\'app installata)' : e.message));
      S.view = 'home'; return renderStore();
    }
    if (S.fresh) { config.api_keys[S.keyId] = S.key; saveCfg(); S.fresh = false; }
    if (!models.length) { flash('warn', 'Il provider non ha restituito modelli di chat utilizzabili.'); S.view = 'home'; return renderStore(); }
    S.models = models; S.q = ''; S.lim = 60; S.view = 'models'; renderStore();
  }

  async function startAdd(pid) {
    S.pid = pid; S.msg = null; S.err = ''; S.change = false;
    if (pid === 'custom') { S.view = 'custom'; return renderStore(); }
    S.base = PV[pid].base; S.keyId = pid;
    const k = keyOf(pid);
    if (!k) { S.view = 'key'; return renderStore(); }
    S.key = k; S.fresh = false; loadModels();
  }

  function normUrl(u) {
    u = u.trim(); if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = (/^(localhost|127\.|192\.168\.|10\.)/.test(u) ? 'http://' : 'https://') + u;
    return u.replace(/\/+$/, '');
  }

  function saveEntry() {
    const m = S.chosen;
    config.api_models[S.alias] = { provider: S.pid, provider_name: PV[S.pid].name, model: m.id, base_url: S.base, key_id: S.keyId, keyless: !S.key, ctx: m.ctx, vision: !!m.vision, tok_param: (S.test && S.test.param) || 'max_tokens' };
    if (!config.active || !config.api_models[config.active]) config.active = S.alias;
    saveCfg(); renderPill();
  }

  sb().addEventListener('input', e => { if (e.target.id === 'mq') { S.q = e.target.value; S.lim = 60; renderModelList(); } });
  sb().addEventListener('click', async e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act;
    if (act === 'prov') { if (e.target.closest('[data-act="chgkey"]')) return; return startAdd(el.dataset.p); }
    if (act === 'chgkey') { e.stopPropagation(); const pid = el.dataset.p; if (pid === 'custom') return; S.pid = pid; S.change = true; S.err = ''; S.view = 'key'; return renderStore(); }
    if (act === 'use') { config.active = el.dataset.a; saveCfg(); renderPill(); return renderStore(); }
    if (act === 'rm') {
      const a = el.dataset.a;
      if (await ask('Rimuovere «' + a + '»?', 'La API verrà tolta dal menu. La chiave del provider resta salvata.', 'Rimuovi', true)) {
        delete config.api_models[a]; if (config.active === a) config.active = ''; engine(); saveCfg(); renderPill(); flash('ok', 'API «' + a + '» rimossa.'); renderStore();
      } return;
    }
    if (act === 'keyok') {
      const k = ($('#kIn').value || '').trim(); if (!k) { S.err = 'Incolla la chiave.'; return renderStore(); }
      if (S.change) {
        S.view = 'loading'; S.loadMsg = 'Verifico la chiave con ' + PV[S.pid].name + '…'; renderStore();
        try { await C.fetchModels(PV[S.pid].base, k); config.api_keys[S.pid] = k; saveCfg(); flash('ok', 'Chiave di ' + PV[S.pid].name + ' verificata e salvata (' + C.maskKey(k) + ').'); S.view = 'home'; }
        catch (err) { S.err = (err.name === 'PermissionError' ? err.message : 'Impossibile verificare: ' + err.message) + '. La chiave NON è stata salvata.'; S.view = 'key'; }
        return renderStore();
      }
      S.key = k; S.fresh = true; return loadModels();
    }
    if (act === 'keydel') { delete config.api_keys[S.pid]; saveCfg(); flash('ok', 'Chiave di ' + PV[S.pid].name + ' eliminata.'); S.view = 'home'; return renderStore(); }
    if (act === 'custok') {
      const u = normUrl($('#cUrl').value); S.url = $('#cUrl').value;
      if (!u) { S.err = 'Inserisci l\'URL del server.'; return renderStore(); }
      S.base = u; S.keyId = C.customKeyId(u);
      const typed = ($('#cKey').value || '').trim();
      S.key = typed || C.resolveKey(config, S.keyId, PV.custom); S.fresh = !!typed && typed !== C.resolveKey(config, S.keyId, PV.custom); S.err = '';
      return loadModels();
    }
    if (act === 'more') { S.lim += 60; return renderModelList(); }
    if (act === 'pick') {
      S.chosen = S.models.find(m => m.id === el.dataset.id);
      const taken = new Set(Object.keys(config.api_models));
      S.alias = C.makeKey(S.chosen.id, S.pid, taken); S.err = ''; S.view = 'summary'; return renderStore();
    }
    if (act === 'addgo') {
      const a = ($('#aIn').value || '').trim().toLowerCase(); S.alias = a;
      if (!C.ALIAS_RE.test(a)) { S.err = 'Nome non valido: minuscole, numeri e . _ - (max 32 caratteri).'; return renderStore(); }
      if (config.api_models[a]) { S.err = '«' + a + '» è già in uso: scegline un altro.'; return renderStore(); }
      S.err = ''; S.view = 'testing'; renderStore();
      S.test = await C.testModel(S.base, S.key, S.chosen.id);
      if (!S.test.ok) { S.view = 'testfail'; return renderStore(); }
      saveEntry(); S.view = 'done'; return renderStore();
    }
    if (act === 'addforce') { saveEntry(); S.view = 'done'; return renderStore(); }
    if (act === 'usenow') { config.active = S.alias; saveCfg(); renderPill(); S.view = 'home'; S.msg = null; closeScreen('store'); toast('Attiva: ' + S.alias); return; }
    if (act === 'back') { S.view = 'home'; S.msg = null; return renderStore(); }
  });

  // ============================================================ MAIL
  const M = { tab: 'write', step: 'compose', body: '', email: '', err: '', res: null, cfgOpen: false };
  const mb = () => $('#mailBody');
  $('#tabW').onclick = () => { M.tab = 'write'; M.step = M.step === 'sending' ? 'sending' : 'compose'; renderMail(); };
  $('#tabH').onclick = () => { M.tab = 'hist'; renderMail(); };

  function renderMail() {
    $('#tabW').classList.toggle('on', M.tab === 'write'); $('#tabH').classList.toggle('on', M.tab === 'hist');
    const ready = C.mailReady(config.mail);
    let h = '';
    if (M.tab === 'hist') {
      const ok = mailHist.filter(x => x.ok).length, ko = mailHist.length - ok;
      const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d.toDateString(); });
      const cnt = days.map(d => mailHist.filter(x => x.ok && new Date(x.ts).toDateString() === d).length), mx = Math.max(1, ...cnt);
      h += `<div class="stats"><div class="card"><b>${mailHist.length}</b><small>Totale</small></div><div class="card"><b style="color:#34d399">${ok}</b><small>Riusciti</small></div><div class="card"><b style="color:${ko ? '#f87171' : 'inherit'}">${ko}</b><small>Falliti</small></div></div>`;
      h += `<div class="sec">Ultimi 14 giorni</div><div class="bars">${cnt.map(n => `<i class="${n ? '' : 'z'}" style="height:${n ? 10 + 90 * n / mx : 6}%"></i>`).join('')}</div><div class="sec">Messaggi recenti</div>`;
      h += mailHist.length ? '<div class="card" style="padding:4px 14px">' + [...mailHist].reverse().slice(0, 50).map(x => `<div class="hi"><em style="color:${x.ok ? '#34d399' : '#f87171'}">${x.ok ? '✓' : '✗'}</em><div class="t"><small>${esc(fmtDt(x.ts))} · ${esc(x.code)}</small><p style="${x.ok ? '' : 'color:#fca5a5;white-space:normal'}">${esc(x.ok ? x.preview : x.error)}</p></div></div>`).join('') + '</div>'
        : '<div class="card" style="font-size:13px;color:var(--muted)">Nessun invio registrato.</div>';
      mb().innerHTML = h; return;
    }
    if (M.step === 'compose') {
      h += `<p class="big">Scrivi all'amministratore</p><p class="hint" style="margin:0 0 14px">Il messaggio arriva al creatore di GPT CORE con un codice univoco come oggetto.</p>`;
      if (!ready) h += noteH('warn', 'Invio non configurato: compila la sezione "mail" (service, template, public_key) nel config.json dentro www/, oppure inserisci i dati qui sotto.');
      if (M.err) h += noteH('err', M.err);
      h += `<label class="lbl">Messaggio</label><textarea class="inp" id="mBody" placeholder="Il server è tornato online…">${esc(M.body)}</textarea>`;
      h += `<label class="lbl">La tua email (facoltativa)</label><input class="inp" id="mEmail" type="email" inputmode="email" autocapitalize="off" placeholder="nome@dominio.it" value="${esc(M.email)}"><div class="hint">L'amministratore potrà risponderti direttamente.</div>`;
      h += `<button class="btn pri" data-m="next">Continua</button>`;
      if (!ready) h += `<div class="sec">Configurazione invio</div>` + mailCfgForm();
    } else if (M.step === 'confirm') {
      const size = new Blob([M.body]).size;
      h += `<p class="big">Scheda messaggio</p><div class="card"><div class="kv"><span>Oggetto</span><b>codice univoco (generato all'invio)</b></div><div class="kv"><span>A</span><b>${esc(config.help_email || 'Amministratore')}</b></div><div class="kv"><span>Tua email</span><b>${esc(M.email || 'non specificata')}</b></div><div class="kv"><span>Dimensione</span><b>~${size} byte</b></div><div class="kv"><span>Account</span><b style="color:${ready ? '#34d399' : '#f87171'}">${ready ? 'pronto' : 'da configurare'}</b></div></div>`;
      h += `<div class="sec">Messaggio</div><div class="card sel" style="white-space:pre-wrap;font-size:13.5px;line-height:1.55;color:var(--muted);max-height:240px;overflow:auto">${esc(M.body)}</div>`;
      h += `<div class="btns"><button class="btn" data-m="edit">Annulla</button><button class="btn pri" data-m="send" ${ready ? '' : 'disabled'}>Invia</button></div>`;
    } else if (M.step === 'sending') {
      h += `<div class="center"><div class="spin"></div><div>Invio in corso…</div></div>`;
    } else if (M.step === 'result') {
      const r = M.res;
      if (r.ok) h += noteH('ok', 'Messaggio inviato all\'amministratore!') + `<div class="card"><div class="kv"><span>Codice</span><b>${esc(r.code)}</b></div><div class="kv"><span>Risposta attesa a</span><b>${esc(r.reply || 'non specificata')}</b></div><div class="kv"><span>Dimensione</span><b>${r.size} byte</b></div><div class="kv"><span>Tempo</span><b>${r.secs.toFixed(1)} s</b></div></div>`;
      else h += noteH('err', r.error);
      h += `<div class="btns"><button class="btn" data-m="hist">Storico</button><button class="btn pri" data-m="new">${r.ok ? 'Nuovo messaggio' : 'Riprova'}</button></div>`;
    }
    mb().innerHTML = h;
  }
  const mailCfgForm = () => `<div class="card"><div class="hint" style="margin:0 0 4px;line-height:1.55">L'app non può usare SMTP: l'invio passa da <b>EmailJS</b> (gratuito), collegato al tuo Gmail. Nel template imposta destinatario = l'amministratore, oggetto <code>{{subject}}</code>, corpo <code>{{message}}</code>, Reply-To <code>{{reply_to}}</code>. La password Gmail non entra mai nell'app.</div>
    <label class="lbl">Service ID</label><input class="inp" id="eS" value="${esc(config.mail.service)}" autocapitalize="off" spellcheck="false">
    <label class="lbl">Template ID</label><input class="inp" id="eT" value="${esc(config.mail.template)}" autocapitalize="off" spellcheck="false">
    <label class="lbl">Public Key</label><input class="inp" id="eK" type="password" value="${esc(config.mail.key)}" autocapitalize="off" spellcheck="false">
    <button class="btn" data-m="savecfg">Salva configurazione</button></div>`;

  mb().addEventListener('click', async e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    const a = b.dataset.m;
    const grab = () => { const t = $('#mBody'); if (t) { M.body = t.value; M.email = $('#mEmail').value.trim(); } };
    if (a === 'cfg') { grab(); M.cfgOpen = true; return renderMail(); }
    if (a === 'savecfg') { grab(); config.mail = { service: $('#eS').value.trim(), template: $('#eT').value.trim(), key: $('#eK').value.trim() }; saveCfg(); M.cfgOpen = false; toast('Configurazione salvata'); return renderMail(); }
    if (a === 'next') {
      grab();
      if (!M.body.trim()) { M.err = 'Il messaggio è vuoto: scrivi almeno una riga.'; return renderMail(); }
      if (M.email && !C.EMAIL_RE.test(M.email)) { M.err = 'Indirizzo non valido: serve un formato come nome@dominio.it.'; return renderMail(); }
      M.err = ''; M.step = 'confirm'; return renderMail();
    }
    if (a === 'edit') { M.step = 'compose'; return renderMail(); }
    if (a === 'hist') { M.tab = 'hist'; return renderMail(); }
    if (a === 'new') { if (M.res && M.res.ok) { M.body = ''; M.email = ''; } M.step = 'compose'; return renderMail(); }
    if (a === 'send') {
      const code = C.genCode(), t0 = Date.now(), size = new Blob([M.body]).size;
      M.step = 'sending'; renderMail();
      let ok = true, error = '';
      try { await C.sendMail(config.mail, M.body, M.email, code, config.help_email); } catch (err) { ok = false; error = err.message; }
      const entry = { ts: new Date().toISOString(), code, reply: M.email, preview: M.body.replace(/\s+/g, ' ').trim().slice(0, 80), size, ok, error };
      mailHist.push(entry); mailHist = mailHist.slice(-200); jset(KEY.mail, mailHist);
      M.res = { ok, code, reply: M.email, size, secs: (Date.now() - t0) / 1000, error };
      M.step = 'result'; renderMail();
    }
  });

  // ============================================================ IMPOSTAZIONI
  function renderSettings() {
    const c = config;
    $('#setBody').innerHTML = `
      <div class="sec" style="margin-top:6px">Account</div>
      <div class="card"><div class="kv"><span>Accesso</span><b>${profile && profile.method === 'google' ? 'Google' : 'Email'}</b></div><div class="kv"><span>Email</span><b>${esc((profile && profile.email) || '-')}</b></div></div>
      <button class="btn dng" id="sOut">Esci dall'account</button>
      <div class="sec">Profilo</div>
      <label class="lbl" style="margin-top:0">Il tuo nome</label><input class="inp" id="sName" value="${esc(c.user_name)}">
      <div class="sec">Ricerca web in background</div>
      <label class="lbl" style="margin-top:0">Modalità</label>
      <select class="inp" id="sWeb"><option value="auto">Auto: decide il modello</option><option value="always">Sempre: cerca a ogni messaggio</option><option value="off">Spenta</option></select>
      <label class="lbl">Ricerche massime per risposta</label><input class="inp" id="sRounds" type="number" min="1" max="5" value="${esc(c.web_max_rounds)}">
      <label class="lbl">Chiave Brave Search (facoltativa)</label><input class="inp" id="sBrave" type="password" autocapitalize="off" spellcheck="false" value="${esc(c.brave_key)}">
      <label class="lbl">Proxy CORS (solo se usi l'app nel browser)</label><input class="inp" id="sProxy" inputmode="url" autocapitalize="off" spellcheck="false" placeholder="https://tuo-worker.workers.dev/?url=" value="${esc(c.cors_proxy)}">
      <div class="hint">Nell'app installata (APK) la ricerca usa la rete nativa e non serve nessun proxy. Nel browser senza proxy funziona solo Wikipedia.</div>
      <div class="sec">Cronologia</div>
      <div class="sw"><span style="font-size:14px">Ricorda la conversazione</span><input id="sHist" type="checkbox" ${c.history_enabled ? 'checked' : ''}></div>
      <button class="btn pri" id="sSave">Salva impostazioni</button>
      <div class="sec">Config</div>
      <button class="btn" id="sImp" style="margin-top:0">Importa config.json</button>
      <button class="btn" id="sExp">Copia config negli appunti</button>
      <div class="hint">L'import prende chiavi, API e impostazioni web dal vecchio config.json (i percorsi dei modelli locali vengono ignorati).</div>
      <div class="sec">Dati</div>
      <button class="btn dng" id="sClear" style="margin-top:0">Cancella tutte le chat</button>`;
    $('#sWeb').value = c.web_search;
    $('#sSave').onclick = () => {
      c.user_name = $('#sName').value.trim() || c.user_name; if (profile) { profile.name = c.user_name; jset(KEY.profile, profile); } c.web_search = $('#sWeb').value;
      c.web_max_rounds = Math.min(5, Math.max(1, parseInt($('#sRounds').value, 10) || 2)); c.brave_key = $('#sBrave').value.trim();
      c.cors_proxy = $('#sProxy').value.trim(); c.history_enabled = $('#sHist').checked; saveCfg(); applyName(); toast('Impostazioni salvate');
    };
    $('#sOut').onclick = async () => { if (await ask('Uscire dall\'account?', 'Le chat restano su questo telefono. Dovrai accedere di nuovo.', 'Esci', true)) { profile = null; localStorage.removeItem(KEY.profile); closeScreen('set'); showAuth('login'); } };
    $('#sImp').onclick = () => $('#fCfg').click();
    $('#sExp').onclick = () => { const pub = Object.assign({}, config); delete pub.system_prompt; delete pub._filePrompt; const t = JSON.stringify(pub, null, 2); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copiato (contiene le tue chiavi!)'), () => toast('Copia non riuscita')); };
    $('#sClear').onclick = async () => { if (await ask('Cancellare le chat?', 'Tutte le conversazioni salvate verranno eliminate.', 'Cancella', true)) { chats = []; saveChats(); newChat(); toast('Chat cancellate'); } };
  }
  $('#fCfg').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { importConfig(JSON.parse(await f.text())); renderSettings(); renderPill(); applyName(); }
    catch (err) { toast('config.json non valido'); }
  };
  function importConfig(o) {
    let n = 0;
    Object.entries(o.api_keys || {}).forEach(([k, v]) => { if (v) { config.api_keys[k] = v; n++; } });
    if (o.openrouter_key) { config.api_keys.openrouter = o.openrouter_key; n++; }
    if (o.gemini_key) { config.api_keys.gemini = o.gemini_key; n++; }
    Object.entries(o.api_models || {}).forEach(([k, v]) => { config.api_models[k] = v; });
    const legacy = (alias, pid, model) => {
      if (config.api_keys[pid] && !config.api_models[alias]) config.api_models[alias] = { provider: pid, provider_name: PV[pid].name, model, base_url: PV[pid].base, key_id: pid, keyless: false, ctx: 0, vision: false, tok_param: 'max_tokens' };
    };
    legacy('deepseek', 'openrouter', 'deepseek/deepseek-r1'); legacy('gemini', 'gemini', o.gemini_model || 'gemini-2.5-flash');
    if (o.google) config.google = Object.assign(config.google, o.google); if (o.help && o.help.email) config.help_email = o.help.email;
    ['web_search', 'web_max_rounds', 'web_results', 'web_pages', 'web_page_chars', 'brave_key', 'history_enabled', 'max_history'].forEach(k => { if (o[k] !== undefined && o[k] !== '') config[k] = o[k]; });
    if (o.default_engine && config.api_models[o.default_engine]) config.active = o.default_engine;
    const mm = C.mailFromConfig(o); ['service', 'template', 'key'].forEach(k => { if (mm[k]) config.mail[k] = mm[k]; });
    saveCfg(); toast('Config importato (' + n + ' chiavi, ' + Object.keys(config.api_models).length + ' API)');
  }

  // ============================================================ ACCESSO (Google / email) + NOME
  const authEl = $('#auth');
  let profile = jget(KEY.profile, null), accounts = jget(KEY.acc, {});
  const A = { step: 'login', err: '', email: '', name: '', method: '' };
  const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
  const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function hashPw(pw, salt) {
    const enc = new TextEncoder(), k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    return b64u(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150000, hash: 'SHA-256' }, k, 256));
  }
  function showAuth(step) { A.step = step; A.err = ''; show(authEl, true); renderAuth(); }
  function renderAuth() {
    const logo = `<div class="logo">${I.spark}</div>`, err = A.err ? noteH('err', A.err) : '';
    const em = esc(A.email);
    let h = '';
    if (A.step === 'login') h = `${logo}<h1>Benvenuto in <span class="grad-t">GPT CORE</span></h1><p class="sub">Accedi per continuare.</p>${err}
      <button class="gbtn" data-a="google"><b>G</b>Continua con Google</button>
      <div class="or">oppure con email</div>
      <input class="inp" id="aMail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="Email" value="${em}">
      <input class="inp" id="aPw" type="password" autocomplete="current-password" placeholder="Password">
      <button class="btn pri" data-a="login">Accedi</button>
      <button class="lnk" data-a="toreg">Non hai un account? Creane uno</button>
      <button class="lnk mut" data-a="forgot">Password dimenticata?</button>
      <p class="hint" style="text-align:center">L'account email resta solo su questo telefono.</p>`;
    else if (A.step === 'register') h = `${logo}<h1>Crea il tuo account</h1><p class="sub">Basta un'email e una password.</p>${err}
      <input class="inp" id="aMail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="Email" value="${em}">
      <input class="inp" id="aPw" type="password" autocomplete="new-password" placeholder="Password (almeno 6 caratteri)">
      <input class="inp" id="aPw2" type="password" autocomplete="new-password" placeholder="Ripeti la password">
      <button class="btn pri" data-a="register">Crea account</button>
      <button class="lnk" data-a="tologin">Ho già un account</button>`;
    else if (A.step === 'name') h = `${logo}<h1>Come ti chiami?</h1><p class="sub">${A.method === 'google' ? 'Collegato come ' + esc(A.email) + '. ' : ''}Dimmi il tuo nome e mi adatto a te.</p>${err}
      <input class="inp" id="aName" autocomplete="given-name" maxlength="40" placeholder="Il tuo nome" value="${esc(A.name)}">
      <button class="btn pri" data-a="enter">Entra</button>`;
    else h = `<div class="center" style="margin-top:30vh"><div class="spin"></div><div>Collegamento con Google…</div></div>`;
    authEl.innerHTML = h;
    const f = $('#aName') || $('#aMail'); if (f && !f.value) setTimeout(() => f.focus(), 120);
  }
  const authErr = m => { A.err = m; renderAuth(); };
  const grabMail = () => { const e = $('#aMail'); if (e) A.email = e.value.trim().toLowerCase(); };

  async function googleLogin() {
    const cap = window.Capacitor, P = cap && cap.Plugins;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform() || !P || !P.Browser || !P.App) return authErr('L\'accesso con Google funziona solo nell\'app installata (APK/IPA). Qui usa l\'email.');
    const cid = String((config.google || {}).ios_client_id || '').trim();
    if (!cid) return authErr('Manca google.ios_client_id nel config.json.');
    const scheme = 'com.googleusercontent.apps.' + cid.replace(/\.apps\.googleusercontent\.com$/, ''), redirect = scheme + ':/oauth2redirect';
    const verifier = b64u(crypto.getRandomValues(new Uint8Array(48))), state = hex(12);
    const challenge = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: cid, redirect_uri: redirect, response_type: 'code', scope: 'openid email profile', code_challenge: challenge, code_challenge_method: 'S256', state, prompt: 'select_account' });
    A.step = 'wait'; renderAuth();
    let settled = false; const handles = [];
    const code = await new Promise(async (res, rej) => {
      const fin = (fn, v) => { if (settled) return; settled = true; handles.forEach(x => { try { x.remove(); } catch (e) { /* ignore */ } }); fn(v); };
      try {
        handles.push(await P.App.addListener('appUrlOpen', ev => {
          if (!ev.url || !ev.url.startsWith(scheme + ':')) return;
          try { P.Browser.close(); } catch (e) { /* ignore */ }
          const q = new URL(ev.url.replace(scheme + ':/', 'https://x/')).searchParams;
          if (q.get('error')) return fin(rej, new Error(q.get('error')));
          if (q.get('state') !== state) return fin(rej, new Error('risposta non valida'));
          fin(res, q.get('code'));
        }));
        handles.push(await P.Browser.addListener('browserFinished', () => setTimeout(() => fin(rej, new Error('annullato')), 1500)));
        await P.Browser.open({ url });
      } catch (e) { fin(rej, e); }
    }).catch(e => { A.err = e.message === 'annullato' ? 'Accesso annullato.' : 'Accesso Google non riuscito: ' + e.message; return null; });
    if (!code) { A.step = 'login'; return renderAuth(); }
    try {
      const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: cid, code, code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: redirect }) });
      const t = await r.json();
      if (!r.ok || !t.access_token) throw new Error(t.error_description || t.error || 'HTTP ' + r.status);
      const u = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + t.access_token } })).json();
      A.method = 'google'; A.email = (u.email || '').toLowerCase(); A.name = u.given_name || u.name || ''; A.step = 'name'; A.err = ''; renderAuth();   // i token non vengono salvati
    } catch (e) { A.step = 'login'; authErr('Accesso Google non riuscito: ' + e.message); }
  }

  authEl.addEventListener('click', async e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const act = b.dataset.a;
    if (act === 'google') return googleLogin();
    if (act === 'toreg') { grabMail(); A.step = 'register'; A.err = ''; return renderAuth(); }
    if (act === 'tologin') { grabMail(); A.step = 'login'; A.err = ''; return renderAuth(); }
    if (act === 'forgot') {
      grabMail();
      if (!accounts[A.email]) return authErr('Scrivi l\'email dell\'account da reimpostare.');
      if (await ask('Eliminare questo account?', 'Gli account email sono salvati solo su questo telefono, quindi la password non si può recuperare. Puoi eliminarlo e crearne uno nuovo con la stessa email.', 'Elimina account', true)) { delete accounts[A.email]; jset(KEY.acc, accounts); A.err = ''; toast('Account eliminato: ora puoi crearne uno nuovo'); A.step = 'register'; renderAuth(); }
      return;
    }
    if (act === 'login' || act === 'register') {
      grabMail(); const pw = $('#aPw').value;
      if (!C.EMAIL_RE.test(A.email)) return authErr('Inserisci un\'email valida (nome@dominio.it).');
      if (!(window.crypto && crypto.subtle)) return authErr('Questo ambiente non permette di proteggere la password (serve HTTPS o l\'app installata).');
      if (act === 'login') {
        const acc = accounts[A.email];
        if (!acc) return authErr('Nessun account con questa email: creane uno.');
        if (await hashPw(pw, acc.salt) !== acc.hash) return authErr('Password errata.');
        A.method = 'email'; A.name = acc.name || ''; A.step = 'name'; A.err = ''; return renderAuth();
      }
      if (pw.length < 6) return authErr('La password deve avere almeno 6 caratteri.');
      if (pw !== $('#aPw2').value) return authErr('Le due password non coincidono.');
      if (accounts[A.email]) return authErr('Esiste già un account con questa email: accedi.');
      const salt = hex(16); accounts[A.email] = { salt, hash: await hashPw(pw, salt), name: '' }; jset(KEY.acc, accounts);
      A.method = 'email'; A.name = ''; A.step = 'name'; A.err = ''; return renderAuth();
    }
    if (act === 'enter') {
      const n = ($('#aName').value || '').trim().slice(0, 40);
      if (!n) return authErr('Scrivi il tuo nome per continuare.');
      A.name = n; profile = { method: A.method, email: A.email, name: n, ts: Date.now() }; jset(KEY.profile, profile);
      if (A.method === 'email' && accounts[A.email]) { accounts[A.email].name = n; jset(KEY.acc, accounts); }
      config.user_name = n; saveCfg(); applyName(); show(authEl, false); toast('Benvenuto, ' + n);
    }
  });

  // ============================================================ config.json IN CARTELLA (letto a ogni avvio)
  function applyFileConfig(o) {
    if (!o || typeof o !== 'object') return;
    const mm = C.mailFromConfig(o); ['service', 'template', 'key'].forEach(k => { if (mm[k]) config.mail[k] = mm[k]; });   // la mail e' guidata dal file
    Object.entries(o.api_keys || {}).forEach(([k, v]) => { if (v && !config.api_keys[k]) config.api_keys[k] = v; });
    if (o.openrouter_key && !config.api_keys.openrouter) config.api_keys.openrouter = o.openrouter_key;
    if (o.gemini_key && !config.api_keys.gemini) config.api_keys.gemini = o.gemini_key;
    Object.entries(o.api_models || {}).forEach(([k, v]) => { if (!config.api_models[k]) config.api_models[k] = v; });
    const sp = C.promptText(o.system_prompt);   // il system prompt viene SEMPRE da config.json: stesso testo a ogni avvio
    if (sp) { config.system_prompt = sp; config._filePrompt = sp; }
    if (o.google && typeof o.google === 'object') config.google = Object.assign(config.google, o.google);
    if (o.help && o.help.email) config.help_email = o.help.email;
    ['brave_key', 'cors_proxy'].forEach(k => { if (o[k] && !config[k]) config[k] = o[k]; });
    ['web_search', 'web_max_rounds', 'web_results', 'web_pages', 'web_page_chars'].forEach(k => { if (o[k] !== undefined && !(config._fileSeen)) config[k] = o[k]; });
    config._fileSeen = true; saveCfg();
  }
  fetch('config.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null).then(o => {
    if (!o) return; applyFileConfig(o); applyName(); renderPill();
    if ($('#scrMail').classList.contains('open')) renderMail();
  });

  // ============================================================ AVVIO
  function applyName() { $('#heroName').textContent = config.user_name || ''; $('#avatarL').textContent = (config.user_name || '?')[0].toUpperCase(); }
  applyName(); renderPill(); syncBtn();
  if (!profile) showAuth('login');
  const last = jget(KEY.cur, null);
  if (last && chats.some(c => c.id === last)) { curId = last; renderChat(); }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.Capacitor) navigator.serviceWorker.register('sw.js').catch(() => { });
})();
