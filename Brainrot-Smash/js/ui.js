'use strict';
// Menus (DOM par-dessus le canvas) : titre, menu principal, règles, sélection des persos (jusqu'à 4,
// manettes + clavier + CPU), sélection du stage, résultats, commandes, options, et salons en ligne.
(function (G) {
  const U = G.U;
  const UI = G.UI = { screen: null, S: {}, lobby: null, stage: 'champ', lastCfg: null };
  const $ = (sel, el) => (el || document).querySelector(sel);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const A = () => G.Audio;
  const beep = (n) => { if (A()) A().play(n); };

  const RULES_KEY = 'pks-rules';
  UI.rules = { mode: 'stock', stocks: 3, time: 7, teams: false };
  try { Object.assign(UI.rules, JSON.parse(localStorage.getItem(RULES_KEY) || '{}')); } catch (e) {}
  const saveRules = () => { try { localStorage.setItem(RULES_KEY, JSON.stringify(UI.rules)); } catch (e) {} };

  UI.toast = (msg, ms) => {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.remove('on'), ms || 2200);
  };

  // ---------- Fond animé des menus ----------
  const bgS = { S: null };
  UI.drawBG = (t) => {
    const R = G.R, ctx = R.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, R.W, R.H);
    g.addColorStop(0, '#1a0b3d'); g.addColorStop(0.55, '#3b1466'); g.addColorStop(1, '#0a1a4a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, R.W, R.H);
    // Poké Balls qui dérivent
    const s = Math.max(R.W, R.H) / 12;
    for (let i = 0; i < 18; i++) {
      const x = ((i * 397 + t * 18 * (1 + (i % 3) * 0.4)) % (R.W + s * 2)) - s, y = ((i * 211) % R.H) + Math.sin(t + i) * 20;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.2 + i); ctx.globalAlpha = 0.07;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#ff4a6a'; ctx.beginPath(); ctx.arc(0, 0, s * 0.5, Math.PI, 0); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // défilé des combattants en bas de l'écran titre
    if (UI.screen === 'title' || UI.screen === 'main') {
      if (!bgS.S) bgS.S = G.Sim.create({ stage: 'final', training: true, players: G.CHAR_ORDER.map((c, i) => ({ char: c, pal: 0 })) });
      const S = bgS.S; S.frame = Math.floor(t * 60);
      const n = S.fighters.length, sc = Math.min(R.W / (n * 22), R.H / 90);
      S.fighters.forEach((f, i) => {
        f.action = i % 3 === 0 ? 'run' : 'idle'; f.facing = 1; f.vx = 2; f.grounded = true; f.af = S.frame;
        R.drawFighterAt(ctx, S, f, t + i, (i + 0.5) * R.W / n, R.H - 30 * R.dpr - G.ST(f).h * sc * 0.55, sc);
      });
    }
  };

  // ---------- Gestion des écrans ----------
  const SCREENS = {};
  UI.init = () => {
    UI.root = $('#ui');
    const hash = location.hash.match(/room=([A-Z0-9]{4,6})/i);
    if (hash) { UI.show('title'); setTimeout(() => UI.joinRoom(hash[1].toUpperCase()), 200); return; }
    UI.show('title');
  };
  UI.show = (name, arg) => {
    UI.root = UI.root || $('#ui');
    if (UI.screen && SCREENS[UI.screen].exit) SCREENS[UI.screen].exit();
    clearInterval(UI._padTimer);
    UI.root.innerHTML = '';
    UI.screen = name;
    if (G.Game) G.Game.mode = 'menu';
    SCREENS[name].enter(arg);
    if (name !== 'css' && name !== 'lobby' && name !== 'stage' && G.Audio && G.Audio.ctx && !UI._menuMusic) { UI._menuMusic = true; G.Audio.music(4, 'menu'); }
  };
  UI.hide = () => { UI.root = UI.root || $('#ui'); if (UI.screen && SCREENS[UI.screen].exit) SCREENS[UI.screen].exit(); UI.root.innerHTML = ''; UI.screen = null; UI._menuMusic = false; };
  UI.tick = () => { if (UI.screen && SCREENS[UI.screen].tick) SCREENS[UI.screen].tick(); };

  // Liste navigable (manette / clavier / souris)
  function menuList(items, opts) {
    const wrap = h('div', 'menu-list' + (opts && opts.cls ? ' ' + opts.cls : ''));
    const els = items.map((it, i) => {
      const b = h('button', 'menu-item', `<span class="mi-t">${it.label}</span>${it.sub ? `<span class="mi-s">${it.sub}</span>` : ''}`);
      b.onmouseenter = () => { st.sel = i; paint(); };
      b.onclick = () => { st.sel = i; paint(); act(); };
      wrap.appendChild(b); return b;
    });
    const st = { sel: 0, wrap, els, items };
    const paint = () => els.forEach((e, i) => e.classList.toggle('sel', i === st.sel));
    const act = () => { beep('select'); const it = items[st.sel]; if (it.fn) it.fn(); };
    st.paint = paint; st.act = act;
    st.tick = (m) => {
      if (m.up) { st.sel = (st.sel + items.length - 1) % items.length; paint(); beep('menu'); }
      if (m.down) { st.sel = (st.sel + 1) % items.length; paint(); beep('menu'); }
      if (m.left && items[st.sel].left) { items[st.sel].left(); beep('menu'); }
      if (m.right && items[st.sel].right) { items[st.sel].right(); beep('menu'); }
      if (m.ok || m.start) act();
    };
    paint();
    return st;
  }
  // Fusionne les fronts de tous les périphériques (menus partagés)
  function anyMenu() {
    const m = {};
    for (const d of G.Input.connected()) for (const k in d.menu) if (d.menu[k]) m[k] = true;
    return m;
  }

  // ---------- Titre ----------
  SCREENS.title = {
    enter() {
      const el = h('div', 'screen title-screen');
      el.innerHTML = `
        <div class="logo"><span class="logo-poke">POKÉ</span><span class="logo-smash">SMASH</span></div>
        <div class="tagline">${G.CHAR_ORDER.length} combattants · ${G.STAGE_ORDER.length} terrains · physique façon Ultimate · jusqu'à 4 joueurs · en ligne</div>
        <div class="press">Appuie sur <b>A</b> ou <b>Entrée</b></div>`;
      el.onclick = () => { if (A()) A().init(); UI.show('main'); };
      UI.root.appendChild(el);
    },
    tick() {
      const m = anyMenu();
      if (m.ok || m.start) { if (A()) A().init(); beep('select'); UI.show('main'); }
    },
  };

  // ---------- Menu principal ----------
  SCREENS.main = {
    enter() {
      const el = h('div', 'screen main-screen');
      el.appendChild(h('div', 'logo small', '<span class="logo-poke">POKÉ</span><span class="logo-smash">SMASH</span>'));
      const ml = menuList([
        { label: 'Combat', sub: 'Local · jusqu\'à 4 joueurs et CPU', fn: () => UI.startLocal(false) },
        { label: 'En ligne', sub: 'Créer ou rejoindre une salle', fn: () => UI.show('online') },
        { label: 'Entraînement', sub: 'Mannequin, hitbox visibles', fn: () => UI.startLocal(true) },
        { label: 'Replays', sub: 'Revoir tes derniers matchs, export vidéo', fn: () => UI.show('replays') },
        { label: 'Règles', sub: rulesText(), fn: () => UI.show('rules') },
        { label: 'Commandes', sub: 'Manette Pro, Xbox, clavier', fn: () => UI.show('controls') },
        { label: 'Options', sub: 'Son, voix, vibrations, saut au stick', fn: () => UI.show('options') },
      ], { cls: 'main-menu' });
      el.appendChild(ml.wrap);
      el.appendChild(h('div', 'hint', 'Manette : stick/croix + A · Clavier : flèches + Entrée · Souris OK'));
      UI.root.appendChild(el);
      this.ml = ml;
      padsInfo(el);
    },
    tick() { const m = anyMenu(); this.ml.tick(m); if (m.back) UI.show('title'); },
  };
  function padsInfo(el) {
    const p = h('div', 'pads');
    const upd = () => { const ds = G.Input.connected().filter(d => d.type === 'gp'); p.innerHTML = ds.length ? ds.map(d => `🎮 ${d.name}`).join(' &nbsp; ') : '🎮 Aucune manette détectée — appuie sur un bouton de ta manette Pro (Bluetooth) pour la réveiller'; };
    upd(); el.appendChild(p);
    UI._padTimer = setInterval(upd, 1000);
  }
  const rulesText = () => (UI.rules.mode === 'stock' ? `${UI.rules.stocks} vie${UI.rules.stocks > 1 ? 's' : ''}` : 'Temps') + ' · ' + (UI.rules.time ? UI.rules.time + ' min' : 'sans limite');

  // ---------- Règles ----------
  SCREENS.rules = {
    enter() {
      const el = h('div', 'screen');
      el.appendChild(h('h1', 'screen-title', 'Règles'));
      const R = UI.rules;
      const TIMES = [0, 3, 5, 7, 10];
      const items = [
        { label: 'Mode', get sub() { return R.mode === 'stock' ? '◀ Vies ▶' : '◀ Temps ▶'; }, left: () => { R.mode = R.mode === 'stock' ? 'time' : 'stock'; }, right: () => { R.mode = R.mode === 'stock' ? 'time' : 'stock'; } },
        { label: 'Vies', get sub() { return `◀ ${R.stocks} ▶`; }, left: () => { R.stocks = Math.max(1, R.stocks - 1); }, right: () => { R.stocks = Math.min(9, R.stocks + 1); } },
        { label: 'Temps', get sub() { return `◀ ${R.time ? R.time + ' min' : 'Illimité'} ▶`; }, left: () => { R.time = TIMES[(TIMES.indexOf(R.time) + TIMES.length - 1) % TIMES.length]; }, right: () => { R.time = TIMES[(TIMES.indexOf(R.time) + 1) % TIMES.length]; } },
        { label: 'Retour', fn: () => { saveRules(); UI.show('main'); } },
      ];
      const ml = menuList(items.map((it) => ({ label: it.label, sub: it.sub, left: it.left, right: it.right, fn: it.fn || it.right })));
      ml.refresh = () => ml.els.forEach((e, i) => { const s = e.querySelector('.mi-s'); if (s) s.textContent = items[i].sub; });
      el.appendChild(ml.wrap);
      el.appendChild(h('div', 'hint', '◀ ▶ pour changer · B pour revenir'));
      UI.root.appendChild(el);
      this.ml = ml; this.items = items;
    },
    tick() {
      const m = anyMenu();
      this.ml.tick(m);
      if (m.left || m.right || m.ok) this.ml.refresh();
      if (m.back) { saveRules(); UI.show('main'); }
    },
  };

  // ---------- Commandes ----------
  const ACT_HELP = { atk: 'Attaque (+ direction = attaques fortes)', spc: 'Spécial (neutre / côté / haut / bas)', jmp: 'Saut (relâcher vite = petit saut)', shd: 'Bouclier · + direction = roulade/esquive · en l’air = esquive aérienne', grb: 'Saisie (puis direction = lancer)', taunt: 'Provocation', none: '—' };
  function padRows() {
    const pad = G.Input.opts.pad, groups = {};
    for (const lab of ['A', 'B', 'X', 'Y', 'L', 'R', 'ZL', 'ZR']) (groups[pad[lab]] = groups[pad[lab]] || []).push(lab);
    return ['atk', 'spc', 'jmp', 'shd', 'grb', 'taunt'].filter((k) => groups[k]).map((k) => `<tr><td>${groups[k].join(' / ')}</td><td>${ACT_HELP[k]}</td></tr>`).join('');
  }
  SCREENS.controls = {
    enter() {
      const el = h('div', 'screen controls-screen');
      el.innerHTML = `<h1 class="screen-title">Commandes</h1>
      <div class="ctl-grid">
        <div class="ctl-card"><h2>🎮 Manette Pro (Bluetooth)</h2><table>
          <tr><td>Stick gauche</td><td>Se déplacer · incliner = marcher / pousser à fond = courir</td></tr>
          ${padRows()}
          <tr><td>Stick droit</td><td>${G.Input.opts.rstick === 'tilt' ? 'Attaque dirigée : direction + A (au sol), aériens (en l’air)' : 'Attaques smash (au sol) / aériennes (en l’air)'}</td></tr>
          <tr><td>Croix</td><td>Provocation</td></tr><tr><td>+</td><td>Pause</td></tr></table>
          <div class="hint" style="text-align:left;margin-top:6px">Modifiable dans Options › Boutons de la manette. Smash : pousser le stick gauche d'un coup + A.</div></div>
        <div class="ctl-card"><h2>⌨️ Clavier (ZQSD sur AZERTY, WASD sur QWERTY)</h2><table>
          <tr><td>Z Q S D / flèches</td><td>Se déplacer (Maj = marcher)</td></tr>
          <tr><td>J</td><td>Attaque</td></tr><tr><td>K</td><td>Spécial</td></tr>
          <tr><td>Espace / I</td><td>Sauter</td></tr><tr><td>L</td><td>Bouclier / esquive</td></tr>
          <tr><td>U / H</td><td>Saisie</td></tr><tr><td>O + direction</td><td>Smash</td></tr>
          <tr><td>T</td><td>Provocation</td></tr><tr><td>Échap</td><td>Pause / retour</td></tr></table></div>
        <div class="ctl-card"><h2>💡 Techniques</h2><ul>
          <li>Relâcher le bouclier juste avant un coup = <b>parry</b></li>
          <li>Appuyer bouclier juste avant de toucher le sol en étant éjecté = <b>tech</b></li>
          <li>Bas vers le sol au sommet d'un saut = <b>chute rapide</b></li>
          <li>Pousser le stick contre l'éjection = <b>DI</b> (survivre plus longtemps)</li>
          <li>Maintenir A (ou le stick droit) pendant un smash = <b>charge</b></li></ul></div>
      </div><div class="hint">B / Échap pour revenir</div>`;
      el.onclick = (e) => { if (e.target === el) UI.show('main'); };
      UI.root.appendChild(el);
    },
    tick() { const m = anyMenu(); if (m.back || m.ok) UI.show('main'); },
  };

  // ---------- Options ----------
  SCREENS.options = {
    enter() {
      const el = h('div', 'screen');
      el.appendChild(h('h1', 'screen-title', 'Options'));
      const V = G.Audio.vol, I = G.Input.opts;
      const pct = (v) => Math.round(v * 100) + ' %';
      const items = [
        { label: 'Effets sonores', get sub() { return `◀ ${pct(V.sfx)} ▶`; }, left: () => { V.sfx = Math.max(0, V.sfx - 0.1); }, right: () => { V.sfx = Math.min(1, V.sfx + 0.1); } },
        { label: 'Musique', get sub() { return `◀ ${pct(V.music)} ▶`; }, left: () => { V.music = Math.max(0, V.music - 0.1); }, right: () => { V.music = Math.min(1, V.music + 0.1); } },
        { label: 'Voix de l\'annonceur', get sub() { return V.voice ? 'Oui' : 'Non'; }, fn: () => { V.voice = !V.voice; }, left: () => { V.voice = !V.voice; }, right: () => { V.voice = !V.voice; } },
        { label: 'Boutons de la manette', sub: 'Régler A, B, X, Y, L, R, ZL, ZR ▶', fn: () => UI.show('pad') },
        { label: 'Stick droit', get sub() { return I.rstick === 'tilt' ? 'Attaque dirigée (direction + A)' : 'Smash'; }, fn: () => { I.rstick = I.rstick === 'tilt' ? 'smash' : 'tilt'; }, left: () => { I.rstick = I.rstick === 'tilt' ? 'smash' : 'tilt'; }, right: () => { I.rstick = I.rstick === 'tilt' ? 'smash' : 'tilt'; } },
        { label: 'Sauter avec le stick (manette)', get sub() { return I.tapJump ? 'Oui' : 'Non'; }, fn: () => { I.tapJump = !I.tapJump; }, left: () => { I.tapJump = !I.tapJump; }, right: () => { I.tapJump = !I.tapJump; } },
        { label: 'Vibrations', get sub() { return I.rumble ? 'Oui' : 'Non'; }, fn: () => { I.rumble = !I.rumble; }, left: () => { I.rumble = !I.rumble; }, right: () => { I.rumble = !I.rumble; } },
        { label: 'Retour', fn: () => UI.show('main') },
      ];
      const ml = menuList(items.map((it) => ({ label: it.label, sub: it.sub, left: it.left, right: it.right, fn: it.fn })));
      ml.refresh = () => { ml.els.forEach((e, i) => { const s = e.querySelector('.mi-s'); if (s) s.textContent = items[i].sub; }); G.Audio.save(); G.Input.saveOpts(); };
      el.appendChild(ml.wrap);
      UI.root.appendChild(el);
      this.ml = ml;
    },
    tick() { const m = anyMenu(); this.ml.tick(m); if (m.left || m.right || m.ok) this.ml.refresh(); if (m.back) UI.show('main'); },
  };

  // ---------- Boutons de la manette ----------
  SCREENS.pad = {
    enter() {
      const In = G.Input, I = In.opts;
      const el = h('div', 'screen');
      el.appendChild(h('h1', 'screen-title', 'Boutons de la manette'));
      const ACTS = Object.keys(In.ACTIONS);
      const LABS = ['A', 'B', 'X', 'Y', 'L', 'R', 'ZL', 'ZR'];
      const cycle = (lab, d) => { const i = ACTS.indexOf(I.pad[lab]); I.pad[lab] = ACTS[(i + d + ACTS.length) % ACTS.length]; };
      const items = LABS.map((lab) => ({ label: lab, get sub() { return `◀ ${In.ACTIONS[I.pad[lab]] || 'Rien'} ▶`; }, left: () => cycle(lab, -1), right: () => cycle(lab, 1) }));
      items.push({ label: 'Ma disposition', sub: 'ZL saisie · ZR bouclier · X/Y/R saut', fn: () => { I.pad = Object.assign({}, In.PAD_DEFAULT); } });
      items.push({ label: 'Disposition Ultimate', sub: 'L/R saisie · ZL/ZR bouclier · X/Y saut', fn: () => { I.pad = Object.assign({}, In.PAD_ULTIMATE); } });
      items.push({ label: 'Retour', fn: () => { In.saveOpts(); UI.show('options'); } });
      const ml = menuList(items.map((it) => ({ label: it.label, sub: it.sub, left: it.left, right: it.right, fn: it.fn })), { cls: 'pad-menu' });
      ml.refresh = () => { ml.els.forEach((e, i) => { const s = e.querySelector('.mi-s'); if (s) s.textContent = items[i].sub; }); In.saveOpts(); };
      el.appendChild(ml.wrap);
      this.test = h('div', 'pad-test', 'Appuie sur un bouton de ta manette pour tester…');
      el.appendChild(this.test);
      this.diag = h('div', 'pad-diag', '');
      el.appendChild(this.diag);
      el.appendChild(h('div', 'hint', '◀ ▶ pour changer l\'action · A sur « Ma disposition » / « Ultimate » pour tout remettre · + ou Échap pour revenir'));
      UI.root.appendChild(el);
      this.ml = ml; this.items = items;
    },
    tick() {
      const In = G.Input, I = In.opts;
      const m = anyMenu();
      // A sur une ligne de bouton ne fait rien (pour pouvoir tester les boutons sans tout dérégler)
      const sel = this.items[this.ml.sel];
      if (m.ok && !sel.fn) m.ok = false;
      if (m.back && !G.Input.devices.kb.menu.back) m.back = false; // B de la manette = test, pas retour
      this.ml.tick(m);
      if (m.left || m.right || m.ok) this.ml.refresh();
      const pressed = [];
      for (const d of In.connected()) {
        if (d.type !== 'gp' || !d.phys) continue;
        for (const lab in d.phys) if (d.phys[lab]) pressed.push(`<b>${lab}</b> = ${In.ACTIONS[I.pad[lab]] || 'Rien'}`);
        if (d.raw[2] || d.raw[3]) pressed.push(`<b>Stick droit</b> = ${I.rstick === 'tilt' ? 'attaque dirigée' : 'smash'}`);
      }
      const html = pressed.length ? pressed.join(' · ') : 'Appuie sur un bouton de ta manette pour tester…';
      if (html !== this.lastHtml) { this.test.innerHTML = html; this.lastHtml = html; }
      // Diagnostic : ce que le navigateur reçoit vraiment de chaque manette
      const esc = (t) => String(t).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]);
      const rows = [];
      for (const d of Object.values(In.devices)) {
        if (d.type !== 'gp' || !d.diag) continue;
        const g = d.diag, ok = g.mapping === 'standard';
        rows.push(`<div class="pd-row ${d.connected ? '' : 'off'}"><b>${esc(d.name)}</b> ${d.connected ? '' : '(déconnectée)'} · disposition : ${ok ? '<span class="pd-ok">standard ✓</span>' : '<span class="pd-ko">NON standard ⚠</span>'} · ${g.nb} boutons / ${g.na} axes`
          + `<br>boutons appuyés : ${g.pressed.length ? g.pressed.join(', ') : '—'} · sticks : ${g.axes.slice(0, 4).map((v) => v.toFixed(2)).join(' ')}${g.hat != null && g.hat >= 0 ? ' · croix : axe ' + g.hat : ''}`
          + `${!ok && d.nintendo ? '<br><span class="pd-ko">Manette Pro en mode simplifié : ferme Steam (ou décoche « Prise en charge de la configuration Nintendo Switch » dans Steam), puis éteins et rallume la manette.</span>' : ''}`
          + `<br><small>${esc(g.id)}</small></div>`);
      }
      const dh = rows.length ? rows.join('') : '<div class="pd-row">Aucune manette vue par le navigateur : appuie sur un bouton de la manette (la fenêtre du jeu doit être au premier plan).</div>';
      if (dh !== this.lastDiag) { this.diag.innerHTML = dh; this.lastDiag = dh; }
      if (m.start || G.Input.devices.kb.menu.back) { In.saveOpts(); UI.show('options'); }
    },
  };

  // =====================================================================
  // Sélection des personnages (locale ou en ligne via UI.lobby.online)
  // =====================================================================
  const ROSTER = () => [...G.CHAR_ORDER, 'random'];
  const COLS = 5;
  function newLobby(online) {
    return { online: !!online, slots: [], training: false, ver: 0 };
  }
  UI.startLocal = (training) => {
    UI.lobby = newLobby(false);
    UI.lobby.training = training;
    UI.show('css');
  };

  // Logique de la sélection (exécutée localement, ou par l'hôte en ligne). dev = identifiant de périphérique
  // (préfixé par l'id du pair pour les joueurs distants).
  UI.cssInput = (L, dev, m, name) => {
    let slot = L.slots.find((s) => s.dev === dev);
    const R = ROSTER();
    if (!slot) {
      if ((m.ok || m.start) && L.slots.length < 4 && !(L.training && L.slots.filter(s => !s.cpu).length >= 1)) {
        const used = L.slots.map((s) => s.pslot);
        let ps = 0; while (used.includes(ps)) ps++;
        L.slots.push({ dev, pslot: ps, cpu: 0, char: null, hl: ps % R.length, pal: 0, ready: false, name: name || '' });
        L.slots.sort((a, b) => a.pslot - b.pslot);
        L.ver++; return 'join';
      }
      return null;
    }
    let r = null;
    const mv = (d) => { slot.hl = (slot.hl + d + R.length) % R.length; r = 'move'; };
    if (m.left) mv(-1);
    if (m.right) mv(1);
    if (m.up) mv(-COLS);
    if (m.down) mv(COLS);
    if (m.alt) { const cid = slot.ready ? slot.char : R[slot.hl]; const ch = G.CHARS[cid]; if (ch) { slot.pal = (slot.pal + 1) % ch.palettes.length; r = 'pal'; } }
    if (m.ok) {
      if (!slot.ready) { slot.char = R[slot.hl]; slot.ready = true; r = 'pick'; }
      else if (!m.start) {
        // déjà prêt : A sur un perso = le donner au dernier CPU
        const cpu = L.slots.filter((s) => s.cpu && s.owner === dev).pop() || L.slots.filter((s) => s.cpu).pop();
        if (cpu) { cpu.char = R[slot.hl]; cpu.pal = 0; r = 'cpuchar'; }
      }
    }
    if (m.back) {
      if (slot.ready) { slot.ready = false; r = 'unpick'; }
      else { L.slots.splice(L.slots.indexOf(slot), 1); r = 'leave'; }
    }
    if (m.select && L.slots.length < 4 && !L.training) { // ajouter un CPU
      const used = L.slots.map((s) => s.pslot); let ps = 0; while (used.includes(ps)) ps++;
      L.slots.push({ dev: 'cpu' + ps + '_' + (L.ver + 1), pslot: ps, cpu: 5, char: 'random', hl: 0, pal: 0, ready: true, owner: dev });
      L.slots.sort((a, b) => a.pslot - b.pslot); r = 'cpu';
    }
    const myCpu = L.slots.filter((s) => s.cpu && (s.owner === dev || !L.online)).pop();
    if (myCpu && (m.l || m.r)) { myCpu.cpu = U.clamp(myCpu.cpu + (m.r ? 1 : -1), 1, 9); r = 'lvl'; }
    if (r) L.ver++;
    if (m.start) r = 'start';
    return r;
  };
  UI.lobbyReady = (L) => {
    const humans = L.slots.filter((s) => !s.cpu);
    if (!humans.length) return false;
    if (L.training) return humans.every((s) => s.ready);
    return L.slots.length >= 2 && humans.every((s) => s.ready);
  };
  // Construit la config de match à partir du lobby (tirage des persos « aléatoire » déterministe)
  UI.lobbyToCfg = (L, seed) => {
    let sd = seed >>> 0;
    const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
    const players = L.slots.map((s) => {
      let c = s.char || 'random';
      if (c === 'random') c = G.CHAR_ORDER[Math.floor(rnd() * G.CHAR_ORDER.length)];
      return { char: c, pal: s.pal, cpu: s.cpu, dev: s.dev, name: s.name, pslot: s.pslot };
    });
    if (L.training) players.push({ char: G.CHAR_ORDER[Math.floor(rnd() * G.CHAR_ORDER.length)], pal: 1, cpu: 0, dev: null, dummy: 1, pslot: 1 });
    // deux fois le même perso avec la même couleur : on décale la couleur
    players.forEach((p, i) => { while (players.slice(0, i).some((q) => q.char === p.char && q.pal === p.pal)) p.pal = (p.pal + 1) % G.CHARS[p.char].palettes.length; });
    return players;
  };

  SCREENS.css = {
    enter() {
      const L = UI.lobby;
      const el = h('div', 'screen css-screen');
      const top = h('div', 'css-top');
      top.innerHTML = `<div class="css-title">${L.online ? 'SALLE EN LIGNE' : L.training ? 'ENTRAÎNEMENT' : 'CHOISIS TON POKÉMON'}</div><div class="css-rules">${L.training ? 'Mannequin' : rulesText()}</div>`;
      el.appendChild(top);
      if (L.online) el.appendChild(G.NetUI.header());
      const grid = h('div', 'css-grid');
      ROSTER().forEach((cid, i) => {
        const ch = G.CHARS[cid];
        const card = h('div', 'char-card');
        card.style.setProperty('--cc', ch ? ch.color : '#888');
        if (ch) {
          const img = h('img'); img.src = G.portraitURL(ch.dex); img.alt = ch.name; img.draggable = false;
          img.onerror = () => { img.remove(); card.appendChild(h('div', 'char-fallback', ch.name[0])); };
          card.appendChild(img);
          card.appendChild(h('div', 'char-name', ch.name));
        } else { card.appendChild(h('div', 'char-random', '?')); card.appendChild(h('div', 'char-name', 'Aléatoire')); }
        card.appendChild(h('div', 'char-tokens'));
        card.onmouseenter = () => { this.mouseHl = i; };
        card.onclick = () => this.mouse({ ok: true }, i);
        grid.appendChild(card);
      });
      el.appendChild(grid);
      this.desc = h('div', 'css-desc'); el.appendChild(this.desc);
      const panels = h('div', 'css-panels');
      for (let i = 0; i < 4; i++) {
        const p = h('div', 'panel empty');
        p.innerHTML = `<canvas class="panel-cv" width="240" height="240"></canvas><div class="panel-info"><div class="panel-name"></div><div class="panel-sub"></div></div><div class="panel-join">Appuie sur <b>A</b> pour rejoindre<br><button class="btn-cpu">+ CPU</button></div><div class="panel-cpu"><button class="lv-">−</button><span class="lv"></span><button class="lv+">+</button><button class="cpu-x">✕</button></div>`;
        panels.appendChild(p);
      }
      el.appendChild(panels);
      const foot = h('div', 'css-foot');
      foot.innerHTML = `<span><b>A</b> choisir</span><span><b>B</b> annuler / quitter</span><span><b>X/Y</b> couleur</span><span><b>−</b> ajouter un CPU</span><span><b>L/R</b> niveau CPU</span><span><b>+</b> lancer</span>`;
      el.appendChild(foot);
      this.go = h('div', 'css-go', 'PRÊT ! Appuie sur + / Entrée'); el.appendChild(this.go);
      UI.root.appendChild(el);
      this.el = el; this.grid = grid; this.panels = panels; this.mouseHl = null;
      // boutons souris des panneaux
      panels.querySelectorAll('.panel').forEach((p, i) => {
        p.querySelector('.btn-cpu').onclick = (e) => { e.stopPropagation(); this.addCpuMouse(); };
        p.querySelector('.lv-').onclick = () => this.cpuEdit(i, -1);
        p.querySelector('.lv\\+').onclick = () => this.cpuEdit(i, 1);
        p.querySelector('.cpu-x').onclick = () => this.cpuEdit(i, 0);
      });
      this.lastVer = -1; this.paint();
    },
    addCpuMouse() {
      const L = UI.lobby;
      if (L.online) { G.NetUI.localMenu('mouse', { select: true }); return; }
      UI.cssInput(L, this.ensureMouse(), { select: true }); this.paint();
    },
    ensureMouse() {
      const L = UI.lobby;
      const s = L.slots.find((x) => x.dev === 'kb') || L.slots.find((x) => !x.cpu);
      return s ? s.dev : 'kb';
    },
    cpuEdit(i, d) {
      const L = UI.lobby;
      const s = L.slots.find((x) => x.pslot === i);
      if (!s || !s.cpu) return;
      if (L.online && !G.Net.isHost) return;
      if (d === 0) L.slots.splice(L.slots.indexOf(s), 1); else s.cpu = U.clamp(s.cpu + d, 1, 9);
      L.ver++; this.paint(); if (L.online) G.NetUI.pushLobby();
    },
    mouse(m, i) {
      const L = UI.lobby;
      const dev = 'kb';
      if (L.online) { G.NetUI.localMenu(dev, Object.assign({ hlTo: i }, m)); return; }
      let s = L.slots.find((x) => x.dev === dev);
      if (!s) { UI.cssInput(L, dev, { ok: true }); s = L.slots.find((x) => x.dev === dev); if (!s) return; }
      s.hl = i; if (s.ready) s.ready = false;
      UI.cssInput(L, dev, m); beep('select'); this.paint();
    },
    tick() {
      const L = UI.lobby;
      if (L.online) { G.NetUI.cssTick(this); return; }
      let changed = false;
      for (const d of G.Input.connected()) {
        const m = d.menu;
        if (!Object.values(m).some(Boolean)) continue;
        const had = L.slots.find((s) => s.dev === d.id);
        const r = UI.cssInput(L, d.id, m);
        if (r === 'start' && UI.lobbyReady(L)) { beep('select'); UI.show('stage'); return; }
        if (!had && !r && m.back) { UI.show('main'); return; }
        if (r) { changed = true; beep(r === 'pick' || r === 'join' ? 'select' : r === 'leave' || r === 'unpick' ? 'back' : 'menu'); if (r === 'pick') announce(L, d.id); }
      }
      if (changed || L.ver !== this.lastVer) this.paint();
      this.drawPanels();
    },
    paint() {
      const L = UI.lobby;
      this.lastVer = L.ver;
      const R = ROSTER();
      const cards = this.grid.children;
      for (let i = 0; i < cards.length; i++) {
        const tok = cards[i].querySelector('.char-tokens');
        const on = L.slots.filter((s) => !s.cpu && s.hl === i);
        tok.innerHTML = on.map((s) => `<span class="tok" style="background:${G.PCOL[s.pslot]}">${s.ready ? '✔' : 'J' + (s.pslot + 1)}</span>`).join('');
        cards[i].classList.toggle('hl', on.length > 0);
        cards[i].style.setProperty('--hl', on.length ? G.PCOL[on[0].pslot] : 'transparent');
      }
      const first = L.slots.find((s) => !s.cpu && !s.ready) || L.slots.find((s) => !s.cpu);
      const cid = first ? R[first.hl] : null;
      this.desc.innerHTML = cid && G.CHARS[cid] ? `<b>${G.CHARS[cid].name}</b> — ${G.CHARS[cid].desc}` : 'Chaque joueur appuie sur A (ou Entrée) avec sa manette pour rejoindre.';
      const P = this.panels.children;
      for (let i = 0; i < 4; i++) {
        const s = L.slots.find((x) => x.pslot === i);
        const p = P[i];
        p.className = 'panel' + (s ? (s.cpu ? ' cpu' : '') + (s.ready ? ' ready' : '') : ' empty');
        p.style.setProperty('--pc', G.PCOL[i]);
        if (!s) continue;
        const c = s.ready || s.cpu ? s.char : R[s.hl];
        const ch = G.CHARS[c];
        p.querySelector('.panel-name').textContent = ch ? ch.name : 'Aléatoire';
        const dev = G.Input.devices[s.dev];
        p.querySelector('.panel-sub').textContent = s.cpu ? `CPU niveau ${s.cpu}` : ((s.name || (dev ? dev.name : 'J' + (i + 1))) + (s.ready ? ' · PRÊT' : '') + (ch ? ' · ' + ch.palettes[s.pal % ch.palettes.length].name : ''));
        p.querySelector('.lv').textContent = s.cpu ? 'Niv. ' + s.cpu : '';
      }
      this.go.classList.toggle('on', UI.lobbyReady(L) && (!L.online || G.Net.isHost));
    },
    drawPanels() {
      const L = UI.lobby, R = ROSTER();
      if (!this.pS) this.pS = G.Sim.create({ stage: 'final', training: true, players: G.CHAR_ORDER.map((c) => ({ char: c })) });
      const S = this.pS; S.frame++;
      const t = performance.now() / 1000;
      const P = this.panels.children;
      for (let i = 0; i < 4; i++) {
        const s = L.slots.find((x) => x.pslot === i);
        const cv = P[i].querySelector('canvas'); const ctx = cv.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
        if (!s) continue;
        const c = s.ready || s.cpu ? s.char : R[s.hl];
        if (!G.CHARS[c]) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '900 120px Rubik'; ctx.textAlign = 'center'; ctx.fillText('?', 120, 170); continue; }
        const f = S.fighters[G.CHAR_ORDER.indexOf(c)];
        f.pal = s.pal; f.facing = 1; f.v.form = null;
        f.action = s.ready ? 'move' : 'idle'; f.move = s.ready ? 'taunt' : null; f.af = s.ready ? (S.frame % 60) + 10 : S.frame;
        if (!G.MV(f, 'taunt')) f.action = 'idle';
        const st = G.ST(f);
        G.R.drawFighterAt(ctx, S, f, t, 120, 130, 200 / st.h * 0.55);
      }
    },
  };
  function announce(L, dev) {
    const s = L.slots.find((x) => x.dev === dev);
    if (s && s.char && G.CHARS[s.char] && A()) A().say(G.CHARS[s.char].name);
  }

  // ---------- Sélection du stage ----------
  SCREENS.stage = {
    enter() {
      const el = h('div', 'screen stage-screen');
      el.appendChild(h('h1', 'screen-title', 'Choisis le terrain'));
      const grid = h('div', 'stage-grid');
      const list = [...G.STAGE_ORDER, 'random'];
      list.forEach((sid, i) => {
        const st = G.STAGES[sid];
        const c = h('div', 'stage-card');
        const cv = h('canvas'); cv.width = 320; cv.height = 180;
        if (st) drawStageThumb(cv, st); else { const x = cv.getContext('2d'); x.fillStyle = '#2a1a4a'; x.fillRect(0, 0, 320, 180); x.fillStyle = '#fff'; x.font = '900 90px Rubik'; x.textAlign = 'center'; x.fillText('?', 160, 125); }
        c.appendChild(cv);
        c.appendChild(h('div', 'stage-name', st ? `${st.name}<small>${st.sub}</small>` : 'Aléatoire'));
        c.onmouseenter = () => { this.sel = i; this.paint(); };
        c.onclick = () => { this.sel = i; this.pick(); };
        grid.appendChild(c);
      });
      el.appendChild(grid);
      el.appendChild(h('div', 'hint', 'A : valider · B : retour'));
      UI.root.appendChild(el);
      this.grid = grid; this.list = list;
      this.sel = Math.max(0, list.indexOf(UI.stage)); this.paint();
    },
    paint() { [...this.grid.children].forEach((c, i) => c.classList.toggle('sel', i === this.sel)); },
    pick() {
      beep('select');
      let sid = this.list[this.sel];
      if (sid === 'random') sid = G.STAGE_ORDER[Math.floor(Math.random() * G.STAGE_ORDER.length)];
      UI.stage = sid;
      if (UI.lobby.online) { G.NetUI.hostStart(sid); return; }
      UI.launch(sid);
    },
    tick() {
      const m = anyMenu();
      const n = this.list.length;
      if (m.left) { this.sel = (this.sel + n - 1) % n; this.paint(); beep('menu'); }
      if (m.right) { this.sel = (this.sel + 1) % n; this.paint(); beep('menu'); }
      if (m.up) { this.sel = (this.sel + n - 4) % n; this.paint(); beep('menu'); }
      if (m.down) { this.sel = (this.sel + 4) % n; this.paint(); beep('menu'); }
      if (m.ok || m.start) this.pick();
      if (m.back) UI.show(UI.lobby.online ? 'lobby' : 'css');
    },
  };
  function drawStageThumb(cv, st) {
    const ctx = cv.getContext('2d');
    st.bgStatic(ctx, cv.width, cv.height);
    (st.bgLayers || []).forEach((L) => L.draw(ctx, cv.width, cv.height));
    const s = cv.width / 260;
    ctx.setTransform(s, 0, 0, -s, cv.width / 2, cv.height * 0.62);
    st.drawStage(ctx, st.phys, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  UI.launch = (sid) => {
    const L = UI.lobby;
    const seed = (Date.now() & 0x7fffffff) >>> 0;
    const players = UI.lobbyToCfg(L, seed);
    const cfg = { stage: sid, mode: UI.rules.mode, stocks: UI.rules.stocks, time: L.training ? 0 : UI.rules.time, training: L.training, seed, players };
    UI.lastCfg = cfg;
    G.Game.startMatch(cfg);
  };

  // ---------- Résultats ----------
  UI.showResults = (res, cfg, S) => {
    UI.root = $('#ui');
    UI.show('results', { res, cfg });
  };
  SCREENS.results = {
    enter(arg) {
      const { res, cfg } = arg;
      this.cfg = cfg;
      const el = h('div', 'screen results-screen');
      const w = res[0];
      const wch = G.CHARS[w.char];
      el.innerHTML = `<div class="res-win" style="--wc:${G.PCOL[w.pslot]}">
        <img src="${G.portraitURL(wch.dex)}" onerror="this.style.display='none'">
        <div class="res-win-t"><div class="res-label">VAINQUEUR</div><div class="res-name">${wch.name}</div><div class="res-who">${w.cpu ? 'CPU niv. ' + w.cpu : 'J' + (w.pslot + 1)}</div></div></div>`;
      const tb = h('div', 'res-table');
      tb.innerHTML = '<div class="res-row head"><span>#</span><span>Joueur</span><span>KO</span><span>Chutes</span><span>Dégâts infligés</span><span>Dégâts subis</span></div>' +
        res.map((r) => `<div class="res-row" style="--rc:${G.PCOL[r.pslot]}"><span>${r.rank}</span><span>${G.CHARS[r.char].name} <small>${r.cpu ? 'CPU ' + r.cpu : 'J' + (r.pslot + 1)}</small></span><span>${r.ko}</span><span>${r.fall}${r.sd ? ` (${r.sd} SD)` : ''}</span><span>${r.dmg} %</span><span>${r.taken} %</span></div>`).join('');
      el.appendChild(tb);
      const save = G.Replay && G.Replay.last ? ' · X/Y (Espace) : sauvegarder le replay' : '';
      el.appendChild(h('div', 'hint', (G.Game.net ? 'A : retour à la salle' : 'A : revanche · B : sélection des persos · + : même stage, persos différents') + save));
      UI.root.appendChild(el);
      if (A()) A().say(wch.name + ' gagne !');
    },
    tick() {
      const m = anyMenu();
      if (m.alt && G.Replay && G.Replay.last) { if (G.Replay.download(G.Replay.last)) UI.toast('Replay sauvegardé dans tes téléchargements (il est aussi dans le menu Replays)', 2600); return; }
      if (G.Game.net) { if (m.ok || m.back || m.start) { G.NetUI.backToLobby(); } return; }
      if (m.ok) { beep('select'); const c = Object.assign({}, this.cfg, { seed: (Date.now() & 0x7fffffff) >>> 0 }); G.Game.startMatch(c); }
      else if (m.back || m.start) { beep('back'); UI.lobby.slots.forEach((s) => { if (!s.cpu) s.ready = false; }); UI.show('css'); }
    },
  };

  // ---------- Replays ----------
  const dateTxt = (iso) => { try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  SCREENS.replays = {
    enter() {
      const R = G.Replay;
      const el = h('div', 'screen');
      el.appendChild(h('h1', 'screen-title', 'Replays'));
      const L = this.L = R ? R.list() : [];
      const items = L.map((d) => {
        const w = d.sum.winner ? ' · victoire ' + (G.CHARS[d.sum.winner] ? G.CHARS[d.sum.winner].name : d.sum.winner) : d.quit ? ' · abandonné' : '';
        return { label: R.title(d), sub: `${d.sum.stage} · ${R.fmtTime(d.len)} · ${dateTxt(d.date)}${w}`, fn: () => R.watch(d) };
      });
      items.push({ label: 'Ouvrir un fichier…', sub: 'Replay .json sauvegardé ou envoyé par un pote (souris ou clavier)', fn: () => R.openFile().then((d) => { if (d) R.watch(d); else UI.toast('Fichier replay illisible', 2000); }) });
      const ml = this.ml = menuList(items, { cls: 'replay-list' });
      el.appendChild(ml.wrap);
      el.appendChild(h('div', 'hint', L.length ? 'A : regarder · X/Y (Espace) : sauvegarder en fichier · B : retour'
        : "Aucun replay pour l'instant : chaque match terminé est gardé ici automatiquement (les 10 derniers)."));
      UI.root.appendChild(el);
    },
    tick() {
      const m = anyMenu();
      this.ml.tick(m);
      const e = this.ml.els[this.ml.sel]; if (e && (m.up || m.down)) e.scrollIntoView({ block: 'nearest' });
      if (m.alt && this.L[this.ml.sel]) { if (G.Replay.download(this.L[this.ml.sel])) UI.toast('Replay sauvegardé dans tes téléchargements', 2200); }
      if (m.back) UI.show('main');
    },
  };

  // ---------- En ligne (menus) ----------
  SCREENS.online = {
    enter() {
      const el = h('div', 'screen');
      el.appendChild(h('h1', 'screen-title', 'Jouer en ligne'));
      const ml = menuList([
        { label: 'Créer une salle', sub: 'Tes potes te rejoignent avec un code, un lien ou un QR code', fn: () => UI.createRoom() },
        { label: 'Rejoindre une salle', sub: 'Entre le code donné par l\'hôte', fn: () => UI.show('join') },
        { label: 'Retour', fn: () => UI.show('main') },
      ]);
      el.appendChild(ml.wrap);
      el.appendChild(h('div', 'hint', 'Connexion directe entre joueurs (pair-à-pair). Le jeu doit être ouvert depuis la même adresse (lien partagé par l\'hôte).'));
      UI.root.appendChild(el); this.ml = ml;
    },
    tick() { const m = anyMenu(); this.ml.tick(m); if (m.back) UI.show('main'); },
  };
  SCREENS.join = {
    enter(code) {
      const el = h('div', 'screen join-screen');
      el.innerHTML = `<h1 class="screen-title">Rejoindre une salle</h1>
        <input class="code-input" maxlength="6" placeholder="CODE" value="${code || ''}" autocomplete="off" spellcheck="false">
        <button class="menu-item big join-go">Rejoindre</button>
        <div class="hint">Tape le code (4 caractères) puis Entrée · Échap pour revenir</div>`;
      UI.root.appendChild(el);
      const inp = $('.code-input', el);
      setTimeout(() => inp.focus(), 50);
      const go = () => { const c = inp.value.trim().toUpperCase(); if (c.length >= 4) UI.joinRoom(c); else UI.toast('Code incomplet'); };
      inp.onkeydown = (e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') UI.show('online'); e.stopPropagation(); };
      inp.oninput = () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
      $('.join-go', el).onclick = go;
    },
    tick() { const d = G.Input.devices; for (const k in d) if (d[k].type === 'gp' && d[k].menu.back) UI.show('online'); },
  };
  UI.createRoom = () => { if (!G.NetUI) return; G.NetUI.create(); };
  UI.joinRoom = (code) => { if (!G.NetUI) return; G.NetUI.join(code); };
  SCREENS.lobby = {
    enter() { SCREENS.css.enter.call(this); },
    addCpuMouse() { SCREENS.css.addCpuMouse.call(this); },
    ensureMouse() { return SCREENS.css.ensureMouse.call(this); },
    cpuEdit(i, d) { SCREENS.css.cpuEdit.call(this, i, d); },
    mouse(m, i) { SCREENS.css.mouse.call(this, m, i); },
    tick() { G.NetUI.cssTick(this); },
    paint() { SCREENS.css.paint.call(this); },
    drawPanels() { SCREENS.css.drawPanels.call(this); },
    exit() { },
  };
  UI.SCREENS = SCREENS;
  UI.h = h;
})(window.G);
