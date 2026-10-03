'use strict';
// Jeu en ligne : salles pair-à-pair (PeerJS / WebRTC) + netcode ROLLBACK.
// L'hôte crée une salle (code 4 caractères, lien, QR code). Les invités se connectent à l'hôte (étoile).
// En match, chaque machine simule tout ; les entrées locales partent avec un petit délai (2 frames),
// celles des autres sont prédites puis corrigées (retour arrière + resimulation) quand elles arrivent.
(function (G) {
  const U = G.U;
  const Net = G.Net = { peer: null, isHost: false, code: null, myId: null, conns: {}, hostConn: null, handlers: [], names: {}, ping: {}, inMatch: false };
  const PEER_JS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  const QR_JS = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  const PREFIX = 'pksmash-v1-';
  const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('Chargement impossible : ' + src));
      document.head.appendChild(s);
    });
  }
  const peerOpts = () => ({ debug: 1, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } });
  const randCode = () => Array.from({ length: 4 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');

  Net.on = (fn) => Net.handlers.push(fn);
  function dispatch(from, msg) { for (const fn of Net.handlers) fn(from, msg); }

  Net.host = async () => {
    await loadScript(PEER_JS);
    return new Promise((resolve, reject) => {
      const tryOpen = (n) => {
        const code = randCode();
        const p = new window.Peer(PREFIX + code, peerOpts());
        p.on('open', (id) => { Net.peer = p; Net.isHost = true; Net.code = code; Net.myId = 'H'; resolve(code); });
        p.on('error', (e) => {
          if (e.type === 'unavailable-id' && n < 5) { p.destroy(); tryOpen(n + 1); }
          else if (!Net.peer) reject(e); else G.UI.toast('Réseau : ' + (e.type || e.message));
        });
        p.on('connection', (c) => setupConn(c, true));
        p.on('disconnected', () => { try { p.reconnect(); } catch (e) {} });
      };
      tryOpen(0);
    });
  };
  Net.join = async (code) => {
    await loadScript(PEER_JS);
    return new Promise((resolve, reject) => {
      const p = new window.Peer(peerOpts());
      let done = false;
      p.on('open', (id) => {
        Net.peer = p; Net.isHost = false; Net.code = code; Net.myId = id;
        const c = p.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        setupConn(c, false);
        c.on('open', () => { Net.hostConn = c; done = true; c.send({ t: 'hello', name: G.NetUI.myName() }); resolve(); });
        setTimeout(() => { if (!done) reject(new Error('Salle introuvable (code ' + code + ')')); }, 9000);
      });
      p.on('error', (e) => { if (!done) reject(e.type === 'peer-unavailable' ? new Error('Salle introuvable (code ' + code + ')') : e); else G.UI.toast('Réseau : ' + (e.type || e.message)); });
    });
  };
  function setupConn(c, asHost) {
    c.on('open', () => {
      if (asHost) { Net.conns[c.peer] = c; }
      const pi = setInterval(() => { if (!c.open) { clearInterval(pi); return; } c.send({ t: 'ping', ts: performance.now() }); }, 1000);
    });
    c.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'ping') { c.send({ t: 'pong', ts: msg.ts }); return; }
      if (msg.t === 'pong') { Net.ping[asHost ? c.peer : 'H'] = Math.round(performance.now() - msg.ts); return; }
      dispatch(asHost ? c.peer : 'H', msg);
    });
    c.on('close', () => { if (asHost) { delete Net.conns[c.peer]; dispatch(c.peer, { t: 'left' }); } else { dispatch('H', { t: 'hostleft' }); } });
    c.on('error', () => {});
  }
  Net.send = (msg) => { if (Net.hostConn && Net.hostConn.open) Net.hostConn.send(msg); };
  Net.broadcast = (msg, except) => { for (const id in Net.conns) { const c = Net.conns[id]; if (id !== except && c.open) c.send(msg); } };
  Net.sendTo = (id, msg) => { const c = Net.conns[id]; if (c && c.open) c.send(msg); };
  Net.close = () => {
    try { if (Net.peer) Net.peer.destroy(); } catch (e) {}
    Object.assign(Net, { peer: null, isHost: false, code: null, myId: null, conns: {}, hostConn: null, handlers: [], ping: {}, inMatch: false });
  };
  Net.link = () => `${location.origin}${location.pathname}#room=${Net.code}`;
  Net.pingMax = () => { let m = 0; for (const k in Net.ping) m = Math.max(m, Net.ping[k]); return m; };

  // =====================================================================
  // Session de match avec rollback
  // =====================================================================
  const DELAY = 2, MAXRB = 10, CK_EVERY = 120;
  function sameIn(a, b) { if (!a || !b) return false; for (let i = 0; i < 5; i++) if (a[i] !== b[i]) return false; return true; }

  class Session {
    constructor(cfg, owners) {
      this.cfg = cfg;
      this.owners = owners; // slot -> 'H' | peerId | null (CPU)
      this.S = G.Sim.create(cfg);
      this.frame = 0;
      this.n = cfg.players.length;
      this.inp = []; this.pred = []; this.conf = []; this.last = [];
      this.local = []; // slot -> device id
      for (let s = 0; s < this.n; s++) {
        this.inp.push({}); this.pred.push({}); this.conf.push(DELAY); this.last.push(G.NEUTRAL.slice());
        for (let f = 1; f <= DELAY; f++) this.inp[s][f] = G.NEUTRAL.slice();
        const o = owners[s];
        if (o === Net.myId) this.local[s] = cfg.players[s].dev.split('|')[1];
      }
      this.snaps = { 0: U.clone(this.S) };
      this.remoteFrame = {}; // pair -> dernier frame annoncé
      this.rbFrom = Infinity; this.rbCount = 0; this.rbLast = 0; this.skip = 0; this.ticks = 0;
      this.drops = []; this.ckHost = {}; this.ckSnaps = {}; this.ended = false;
      this.q = [];
    }
    needsInput(s) { return this.owners[s] != null && !this.cfg.players[s].cpu && !this.drops.some((d) => d.slot === s); }
    recv(from, msg) {
      if (msg.t === 'in') {
        this.remoteFrame[msg.src || from] = msg.cur;
        const s = msg.p;
        for (let i = 0; i < msg.d.length; i++) {
          const f = msg.f + i;
          if (this.inp[s][f]) continue;
          this.inp[s][f] = msg.d[i];
          if (f > this.conf[s]) this.conf[s] = f;
          if (f <= this.frame) { const pr = this.pred[s][f]; if (!sameIn(pr, msg.d[i])) this.rbFrom = Math.min(this.rbFrom, f); }
        }
        if (Net.isHost) Net.broadcast(Object.assign({}, msg, { src: msg.src || from }), from);
      } else if (msg.t === 'ck' && Net.isHost) {
        const mine = this.ckHost[msg.f];
        if (mine && mine.h !== msg.h) { Net.sendTo(from, { t: 'sync', f: msg.f, st: mine.st }); }
      } else if (msg.t === 'sync' && !Net.isHost) {
        // resynchronisation forcée depuis l'état de l'hôte
        const st = msg.st;
        this.snaps = {}; this.snaps[msg.f] = st;
        const cur = this.frame;
        this.S = U.clone(st); this.frame = msg.f;
        while (this.frame < cur) this.stepOne(true);
        G.UI.toast('Resynchronisé avec l\'hôte', 1500);
      } else if (msg.t === 'drop') {
        if (!this.drops.some((d) => d.slot === msg.slot)) { this.drops.push({ slot: msg.slot, f: msg.f }); if (msg.f <= this.frame) this.rbFrom = Math.min(this.rbFrom, msg.f); }
      }
    }
    inputFor(s, f) {
      if (!this.needsInput(s) && !this.local[s]) return G.NEUTRAL;
      const v = this.inp[s][f];
      if (v) { this.last[s] = v; return v; }
      // prédiction : on répète la dernière entrée connue
      let k = f - 1; while (k > 0 && !this.inp[s][k]) k--;
      const p = k > 0 ? this.inp[s][k] : G.NEUTRAL;
      this.pred[s][f] = p;
      return p;
    }
    stepOne(resim) {
      const f = this.frame + 1;
      for (const d of this.drops) if (f >= d.f) { const fi = this.S.fighters[d.slot]; if (fi && !fi.cpu) fi.cpu = 5; }
      const ins = [];
      for (let s = 0; s < this.n; s++) ins.push(this.inputFor(s, f));
      G.Sim.step(this.S, ins);
      G.R.consume(this.S, this.S.events);
      this.frame = f;
      this.snaps[f] = U.clone(this.S);
      delete this.snaps[f - MAXRB - 4];
      if (f % CK_EVERY === 0) { this.ckSnaps[f] = this.snaps[f]; delete this.ckSnaps[f - CK_EVERY * 6]; }
      void resim;
    }
    minConf() { let m = Infinity; for (let s = 0; s < this.n; s++) if (this.needsInput(s) && !this.local[s]) m = Math.min(m, this.conf[s]); return m; }
    tick() {
      this.ticks++;
      // 1) entrées locales (avec délai)
      const tf = this.frame + DELAY + 1;
      for (let s = 0; s < this.n; s++) {
        if (!this.local[s]) continue;
        if (!this.inp[s][tf]) {
          this.inp[s][tf] = G.Input.frame(this.local[s]);
          this.conf[s] = tf;
          const d = []; const from = Math.max(1, tf - 5);
          for (let f = from; f <= tf; f++) d.push(this.inp[s][f] || G.NEUTRAL);
          const msg = { t: 'in', p: s, f: from, d, cur: this.frame };
          if (Net.isHost) Net.broadcast(Object.assign({ src: 'H' }, msg)); else Net.send(msg);
        }
      }
      // 2) retour arrière si une prédiction était fausse
      if (this.rbFrom <= this.frame) {
        const target = this.frame, back = this.rbFrom - 1;
        const snap = this.snaps[back];
        if (snap) {
          this.S = U.clone(snap); this.frame = back;
          while (this.frame < target) this.stepOne(true);
          this.rbCount++; this.rbLast = target - back;
        }
      }
      this.rbFrom = Infinity;
      // 3) synchro du temps : ne pas trop prendre d'avance sur les autres
      let minRemote = Infinity;
      for (const k in this.remoteFrame) minRemote = Math.min(minRemote, this.remoteFrame[k] + Math.round((Net.ping[Net.isHost ? k : 'H'] || 0) / 2 / 16.7));
      const adv = minRemote === Infinity ? 0 : this.frame - minRemote;
      if (adv > 2 && this.ticks % Math.max(2, 10 - adv) === 0) return;
      // 4) avancer d'une frame si la fenêtre de rollback le permet
      const mc = this.minConf();
      if (mc !== Infinity && this.frame + 1 - mc > MAXRB) { this.stall = (this.stall || 0) + 1; return; }
      this.stall = 0;
      this.stepOne(false);
      // 5) sommes de contrôle (frames confirmées)
      const conf = Math.min(this.minConf(), this.frame);
      const ckf = Math.floor(conf / CK_EVERY) * CK_EVERY;
      if (ckf > 0 && ckf !== this.lastCk && this.ckSnaps[ckf]) {
        this.lastCk = ckf;
        const h = G.Sim.hash(this.ckSnaps[ckf]);
        if (Net.isHost) { this.ckHost[ckf] = { h, st: this.ckSnaps[ckf] }; delete this.ckHost[ckf - CK_EVERY * 6]; }
        else Net.send({ t: 'ck', f: ckf, h });
      }
    }
    info() {
      const p = Net.pingMax();
      return `Ping ${p} ms · rollback ${this.rbLast}f` + (this.stall > 30 ? ' · attente réseau…' : '');
    }
    leaveMatch() { this.ended = true; }
  }
  Net.Session = Session;

  // =====================================================================
  // Interface en ligne (salle d'attente = écran de sélection partagé)
  // =====================================================================
  const NetUI = G.NetUI = { pendingMenus: [], session: null };
  NetUI.myName = () => { try { return localStorage.getItem('pks-name') || ''; } catch (e) { return ''; } };

  function devKey(dev) { return Net.myId + '|' + dev; }
  function onMsg(from, msg) {
    const UI = G.UI;
    if (NetUI.session && G.Game.mode === 'match' && ['in', 'ck', 'sync', 'drop'].includes(msg.t)) { NetUI.session.recv(from, msg); return; }
    switch (msg.t) {
      case 'hello': // hôte
        Net.names[from] = msg.name || 'Invité';
        Net.sendTo(from, { t: 'welcome', id: from, lobby: UI.lobby, rules: UI.rules });
        UI.toast((msg.name || 'Un joueur') + ' a rejoint la salle');
        refreshHeader();
        break;
      case 'welcome':
        Net.myId = msg.id; UI.lobby = msg.lobby; Object.assign(UI.rules, msg.rules);
        UI.show('lobby');
        break;
      case 'menu': if (Net.isHost) NetUI.pendingMenus.push({ dev: from + '|' + msg.dev, m: msg.m, name: Net.names[from] }); break;
      case 'lobby':
        if (!Net.isHost) {
          UI.lobby = msg.lobby; Object.assign(UI.rules, msg.rules);
          if (UI.screen !== 'lobby' && G.Game.mode !== 'match') UI.show('lobby');
          else if (UI.screen === 'lobby' && UI.SCREENS.lobby.paint) UI.SCREENS.lobby.paint();
        }
        break;
      case 'start': if (!Net.isHost) startSession(msg.cfg, msg.owners); break;
      case 'left': {
        const L = UI.lobby;
        UI.toast((Net.names[from] || 'Un joueur') + ' a quitté la salle');
        if (NetUI.session && G.Game.mode === 'match') {
          const s = NetUI.session;
          s.owners.forEach((o, slot) => { if (o === from) { const f = s.conf[slot] + 1; const m = { t: 'drop', slot, f }; s.recv('H', m); Net.broadcast(m); } });
        }
        if (L) { L.slots = L.slots.filter((x) => !x.dev.startsWith(from + '|')); L.ver++; NetUI.pushLobby(); }
        refreshHeader();
        break;
      }
      case 'hostleft':
        UI.toast('L\'hôte a fermé la salle', 3000);
        if (G.Game.mode === 'match') G.Game.quitMatch();
        Net.close(); UI.show('online');
        break;
    }
  }
  NetUI.create = async () => {
    const UI = G.UI;
    UI.toast('Création de la salle…');
    try {
      Net.close(); Net.on(onMsg);
      await Net.host();
      UI.lobby = { online: true, slots: [], training: false, ver: 0 };
      UI.show('lobby');
      UI.toast('Salle ' + Net.code + ' prête ! Partage le code ou le lien.', 3500);
    } catch (e) { UI.toast('Impossible de créer la salle : ' + (e.message || e.type), 4000); }
  };
  NetUI.join = async (code) => {
    const UI = G.UI;
    UI.toast('Connexion à la salle ' + code + '…');
    try { Net.close(); Net.on(onMsg); await Net.join(code); }
    catch (e) { UI.toast(e.message || 'Connexion impossible', 4000); UI.show('join', code); }
  };
  NetUI.header = () => {
    const el = document.createElement('div');
    el.className = 'net-head';
    if (Net.isHost) {
      const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
      el.innerHTML = `<div class="net-qr"></div><div class="net-info"><div>Code de la salle : <span class="net-code">${Net.code}</span></div>
        ${local ? '<div class="net-tip">👉 Ton pote (même chez lui, pas besoin d’être sur le même réseau) : il lance <b>sa copie du jeu</b> › En ligne › Rejoindre une salle › code <b>' + Net.code + '</b>. Le lien ci-dessous ne marche que sur ce PC (sauf si le jeu est hébergé en ligne).</div>' : ''}
        <div class="net-link">${Net.link()}</div><div><button class="net-btn copy">Copier le lien</button></div><div class="net-peers"></div></div>`;
      el.querySelector('.copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(Net.link()).then(() => G.UI.toast('Lien copié !')); };
      loadScript(QR_JS).then(() => { const box = el.querySelector('.net-qr'); box.innerHTML = ''; new window.QRCode(box, { text: Net.link(), width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M }); }).catch(() => { el.querySelector('.net-qr').textContent = 'QR indispo'; });
    } else {
      el.innerHTML = `<div class="net-info"><div>Connecté à la salle <span class="net-code">${Net.code}</span></div><div class="net-peers"></div><div class="hint" style="text-align:left">L'hôte choisit le terrain et lance la partie.</div></div>`;
    }
    NetUI.headEl = el; refreshHeader();
    return el;
  };
  function refreshHeader() {
    const el = NetUI.headEl; if (!el) return;
    const p = el.querySelector('.net-peers'); if (!p) return;
    const n = Object.keys(Net.conns).length;
    p.textContent = Net.isHost ? (n ? `${n} invité(s) connecté(s) · ping max ${Net.pingMax()} ms` : 'En attente de joueurs…') : `Ping : ${Net.ping.H || '…'} ms`;
  }
  setInterval(refreshHeader, 1000);

  NetUI.pushLobby = () => { if (Net.isHost) Net.broadcast({ t: 'lobby', lobby: G.UI.lobby, rules: G.UI.rules }); };
  NetUI.localMenu = (dev, m) => {
    if (Net.isHost) NetUI.pendingMenus.push({ dev: 'H|' + dev, m });
    else Net.send({ t: 'menu', dev, m });
  };
  // Appelé chaque frame sur l'écran de salle
  NetUI.cssTick = (screen) => {
    const UI = G.UI, L = UI.lobby;
    for (const d of G.Input.connected()) {
      const m = d.menu;
      if (!Object.values(m).some(Boolean)) continue;
      if (m.back && !L.slots.find((s) => s.dev === devKey(d.id)) && d.type !== 'kb') { leaveRoom(); return; }
      NetUI.localMenu(d.id, m);
    }
    if (Net.isHost) {
      let changed = false, start = false;
      for (const pm of NetUI.pendingMenus.splice(0)) {
        const m = Object.assign({}, pm.m);
        if (pm.m.hlTo != null) { const s = L.slots.find((x) => x.dev === pm.dev); if (s) { s.hl = pm.m.hlTo; if (s.ready) s.ready = false; } }
        const r = UI.cssInput(L, pm.dev, m, pm.name);
        if (r) changed = true;
        if (r === 'start' && pm.dev.startsWith('H|')) start = true;
      }
      if (changed) { NetUI.pushLobby(); screen.paint(); }
      if (start && UI.lobbyReady(L)) { UI.show('stage'); return; }
    } else if (L.ver !== screen.lastVer) screen.paint();
    screen.drawPanels();
  };
  function leaveRoom() { Net.close(); NetUI.session = null; G.UI.show('online'); }
  NetUI.hostStart = (stageId) => {
    const UI = G.UI, L = UI.lobby;
    const seed = (Date.now() & 0x7fffffff) >>> 0;
    const players = UI.lobbyToCfg(L, seed);
    const cfg = { stage: stageId, mode: UI.rules.mode, stocks: UI.rules.stocks, time: UI.rules.time, training: false, seed, players };
    const owners = players.map((p) => (p.cpu || !p.dev ? null : p.dev.split('|')[0]));
    Net.broadcast({ t: 'start', cfg, owners });
    startSession(cfg, owners);
  };
  function startSession(cfg, owners) {
    const s = new Session(cfg, owners);
    NetUI.session = s;
    G.Game.startMatch(cfg, { net: s });
    G.Game.S = s.S;
    // la session remplace l'état à chaque rollback : on garde Game.S synchronisé
    const origTick = s.tick.bind(s);
    s.tick = () => { origTick(); G.Game.S = s.S; };
    G.Game.devs = cfg.players.map((p, i) => s.local[i] || null);
  }
  NetUI.backToLobby = () => {
    const UI = G.UI;
    NetUI.session = null; G.Game.net = null;
    if (Net.isHost) { UI.lobby.slots.forEach((s) => { if (!s.cpu) s.ready = false; }); UI.lobby.ver++; NetUI.pushLobby(); }
    UI.show('lobby');
  };
})(window.G);
