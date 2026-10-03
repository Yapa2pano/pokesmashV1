'use strict';
// REPLAYS
// La simulation est déterministe : mêmes entrées => même match. Un replay n'est donc PAS une vidéo, c'est
// la config du match (persos, terrain, graine) + les entrées des manettes frame par frame (quelques dizaines de Ko).
// Coût pendant le match : quasi nul (on note 5 nombres par joueur et par frame). Les 10 derniers matchs sont
// gardés dans le navigateur ; on peut aussi sauvegarder un replay en fichier, le revoir (pause, ralenti,
// accéléré, image par image) et l'exporter en vidéo .webm pendant la relecture.
// Limite : un replay se relit avec la MÊME version du jeu. Après un rééquilibrage, la suite peut différer
// (le lecteur le détecte grâce à des sommes de contrôle et l'affiche).
(function (G) {
  const U = G.U;
  const KEY = 'pokesmash.replays', MAX_SAVED = 10, CK_EVERY = 120, FMT = 1, MIN_LEN = 600;
  const SPEEDS = [0.25, 0.5, 1, 2, 4];
  const Rep = G.Replay = { rec: null, play: null, last: null };

  // ---------- Enregistrement ----------
  Rep.start = (cfg, S) => {
    Rep.rec = null;
    if (!cfg || cfg.training) return; // l'entraînement modifie l'état hors simulation (remise à 0 %) : pas de replay
    const c = U.clone(cfg);
    for (const p of c.players) delete p.dev;
    Rep.rec = { cfg: c, frames: [], cpu: [], ck: {}, lastCpu: S.fighters.map((f) => f.cpu || 0) };
  };
  // Appelé par Sim.step au début de chaque frame (aussi pendant les retours arrière du jeu en ligne :
  // la frame est simplement réécrite avec les bonnes entrées).
  Rep.hook = (S, inputs) => {
    const r = Rep.rec, f = S.frame + 1;
    const row = [];
    for (let s = 0; s < S.fighters.length; s++) row.push((inputs[s] || G.NEUTRAL).slice(0, 5));
    r.frames[f] = row;
    for (const fi of S.fighters) { // joueur déconnecté remplacé par un CPU en ligne
      const c = fi.cpu || 0;
      if (c !== r.lastCpu[fi.slot]) { r.cpu = r.cpu.filter((e) => !(e[0] >= f && e[1] === fi.slot)); r.cpu.push([f, fi.slot, c]); r.lastCpu[fi.slot] = c; }
    }
    if ((f - 1) % CK_EVERY === 0) r.ck[f - 1] = G.Sim.hash(S);
  };

  function encode(rec, len) {
    const n = rec.cfg.players.length, out = [];
    for (let s = 0; s < n; s++) {
      const parts = []; let prev = null, cnt = 0;
      for (let f = 1; f <= len; f++) {
        const row = rec.frames[f], v = row && row[s] ? row[s].join(',') : '0,0,0,0,0';
        if (v === prev) cnt++;
        else { if (prev !== null) parts.push(cnt > 1 ? prev + '*' + cnt : prev); prev = v; cnt = 1; }
      }
      if (prev !== null) parts.push(cnt > 1 ? prev + '*' + cnt : prev);
      out.push(parts.join(';'));
    }
    return out;
  }
  function decode(data) {
    return data.inputs.map((str) => {
      const arr = [null];
      if (!str) return arr;
      for (const p of str.split(';')) {
        const [v, c] = p.split('*');
        const nums = v.split(',').map(Number);
        for (let i = 0; i < (c ? +c : 1); i++) arr.push(nums);
      }
      return arr;
    });
  }
  function summary(cfg, S) {
    const res = S.phase === 'done' || S.phase === 'game' ? G.Sim.results(S) : null;
    return {
      stage: (G.STAGES[cfg.stage] || {}).name || cfg.stage,
      players: cfg.players.map((p, i) => ({ char: p.char, cpu: p.cpu || 0, slot: i })),
      winner: res && res[0] ? res[0].char : null,
    };
  }
  // Fin du match (ou abandon) : on fige le replay, on le garde dans le navigateur
  Rep.finish = (S, quit) => {
    const r = Rep.rec;
    Rep.rec = null;
    if (!r || !S) return null;
    const len = S.frame;
    if (len < MIN_LEN) return null;
    const data = { fmt: FMT, game: 'poke-smash', date: new Date().toISOString(), len, cfg: r.cfg, inputs: encode(r, len), cpu: r.cpu, ck: r.ck, sum: summary(r.cfg, S), quit: quit ? 1 : 0 };
    Rep.last = data;
    saveLocal(data);
    return data;
  };

  // ---------- Stockage ----------
  Rep.list = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  function saveLocal(data) {
    let L = Rep.list();
    L.unshift(data);
    L = L.slice(0, MAX_SAVED);
    for (;;) { // si le navigateur manque de place, on oublie les plus vieux
      try { localStorage.setItem(KEY, JSON.stringify(L)); return; } catch (e) { if (L.length <= 1) return; L.pop(); }
    }
  }
  Rep.title = (d) => d.sum.players.map((p) => (G.CHARS[p.char] ? G.CHARS[p.char].name : p.char) + (p.cpu ? ' (CPU)' : '')).join(' vs ');
  Rep.fileName = (d) => 'poke-smash_' + d.sum.players.map((p) => p.char).join('-vs-') + '_' + d.date.slice(0, 16).replace(/[-:T]/g, '') + '.json';
  Rep.download = (d) => {
    if (!d) return false;
    const blob = new Blob([JSON.stringify(d)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = Rep.fileName(d);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return true;
  };
  Rep.openFile = () => new Promise((ok) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => {
      const file = inp.files && inp.files[0];
      if (!file) return ok(null);
      file.text().then((txt) => { try { const d = JSON.parse(txt); ok(d && d.game === 'poke-smash' ? d : null); } catch (e) { ok(null); } });
    };
    inp.click();
  });
  const fmtTime = (fr) => { const s = Math.max(0, Math.floor(fr / 60)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  Rep.fmtTime = fmtTime;

  // ---------- Lecture ----------
  Rep.watch = (data) => {
    const miss = data.cfg.players.find((p) => !G.CHARS[p.char]) || !G.STAGES[data.cfg.stage];
    if (miss) { if (G.UI) G.UI.toast('Ce replay utilise un perso ou un terrain absent de cette version', 2500); return false; }
    const Game = G.Game;
    Rep.rec = null;
    Rep.play = { data, ins: decode(data), speed: 1, paused: false, acc: 0, desync: false, end: false, video: null };
    Rep.restart();
    Game.mode = 'replay'; Game.paused = false; Game.net = null;
    if (G.UI) G.UI.hide();
    if (G.Audio) { G.Audio.init(); G.Audio.music(G.STAGES[data.cfg.stage].music, data.cfg.stage); }
    return true;
  };
  Rep.restart = () => {
    const P = Rep.play;
    G.Game.S = G.Sim.create(P.data.cfg);
    G.Game.cfg = P.data.cfg;
    P.acc = 0; P.end = false; P.desync = false;
    G.Game.prevPos = null;
    G.R.reset();
  };
  function stepOne() {
    const P = Rep.play, S = G.Game.S, f = S.frame + 1;
    if (S.frame >= P.data.len) { P.end = true; return false; }
    const ck = P.data.ck[S.frame];
    if (ck != null && ck !== G.Sim.hash(S)) P.desync = true;
    for (const e of P.data.cpu) if (e[0] === f && S.fighters[e[1]]) S.fighters[e[1]].cpu = e[2];
    const ins = P.ins.map((a) => a[f] || G.NEUTRAL);
    G.Game.prevPos = S.fighters.map((fi) => [fi.x, fi.y]); // pour lisser l'affichage entre deux frames (comme en match)
    G.Sim.step(S, ins);
    G.R.consume(S, S.events);
    return true;
  }
  // Appelé 60 fois par seconde par la boucle principale
  Rep.tick = () => {
    const P = Rep.play;
    if (!P) return;
    const m = {};
    for (const d of G.Input.connected()) for (const k in d.menu) if (d.menu[k]) m[k] = true;
    const beep = (n) => { if (G.Audio) G.Audio.play(n); };
    if (m.back || m.pause) { beep('back'); if (P.video) stopVideo(false); Rep.quit(); return; }
    if (!P.video) {
      if (m.ok || m.start) { if (P.end) { Rep.restart(); P.paused = false; } else P.paused = !P.paused; beep('menu'); }
      if (m.select) { Rep.restart(); beep('menu'); }
      const si = SPEEDS.indexOf(P.speed);
      if (m.left && !P.paused) { P.speed = SPEEDS[Math.max(0, si - 1)]; beep('menu'); }
      if (m.right && !P.paused) { P.speed = SPEEDS[Math.min(SPEEDS.length - 1, si + 1)]; beep('menu'); }
      if (P.paused && (m.right || m.r)) stepOne(); // image par image
      if (m.alt) { startVideo(); return; }
    }
    if (P.paused || P.end) return;
    P.acc += P.video ? 1 : P.speed;
    while (P.acc >= 1) { P.acc -= 1; if (!stepOne()) break; }
    if (P.end && P.video) stopVideo(true);
  };
  // Avancement entre la dernière frame simulée et la suivante (0..1), pour l'interpolation de l'affichage.
  // Sans ça, sur un écran à plus de 60 Hz ou au ralenti, les mouvements rapides saccadent et paraissent flous.
  Rep.alpha = (frac) => {
    const P = Rep.play;
    if (!P || P.paused || P.end) return 1;
    return U.clamp(P.acc + frac * (P.video ? 1 : P.speed), 0, 1);
  };
  Rep.quit = () => {
    if (G.Audio) G.Audio.stopMusic();
    Rep.play = null;
    G.Game.S = null; G.Game.mode = 'menu';
    if (G.UI) G.UI.show('replays');
  };
  // Bandeau du lecteur (pas dessiné pendant l'export vidéo, pour ne pas apparaître dans la vidéo)
  Rep.drawHUD = () => {
    const P = Rep.play, R = G.R, ctx = R.ctx, u = R.dpr, S = G.Game.S;
    if (!P || !S || P.video) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,4,24,0.55)'; ctx.fillRect(0, 0, R.W, 34 * u);
    ctx.textAlign = 'left'; ctx.font = `italic 900 ${17 * u}px Rubik, sans-serif`; ctx.fillStyle = '#ff5a7a';
    ctx.fillText('● REPLAY', 14 * u, 23 * u);
    ctx.font = `800 ${15 * u}px Rubik, sans-serif`; ctx.fillStyle = '#fff';
    const state = P.end ? 'FIN' : P.paused ? 'PAUSE' : '×' + P.speed;
    ctx.fillText(state + '   ' + fmtTime(S.frame) + ' / ' + fmtTime(P.data.len), 120 * u, 23 * u);
    ctx.textAlign = 'right'; ctx.font = `600 ${12 * u}px Rubik, sans-serif`; ctx.fillStyle = '#cfc6ff';
    const help = P.end ? 'A : revoir · X/Y (Espace) : exporter en vidéo · B : quitter'
      : P.paused ? 'A : reprendre · → / R : image suivante · − (Tab) : début · B : quitter'
        : 'A : pause · ← → : vitesse · − (Tab) : début · X/Y (Espace) : vidéo · B : quitter';
    ctx.fillText(help, R.W - 14 * u, 22 * u);
    // barre de progression
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, 34 * u, R.W, 3 * u);
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(0, 34 * u, R.W * U.clamp(S.frame / P.data.len, 0, 1), 3 * u);
    if (P.desync) {
      ctx.textAlign = 'center'; ctx.font = `700 ${13 * u}px Rubik, sans-serif`; ctx.fillStyle = '#ffb04a';
      ctx.fillText('⚠ Replay enregistré avec une autre version du jeu : la suite peut différer du vrai match', R.W / 2, 56 * u);
    }
  };

  // ---------- Export vidéo (pendant la relecture, à vitesse normale) ----------
  function pickMime() {
    if (!window.MediaRecorder) return null;
    for (const m of ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) if (MediaRecorder.isTypeSupported(m)) return m;
    return '';
  }
  function startVideo() {
    const P = Rep.play, mime = pickMime();
    if (mime == null || !G.R.ctx.canvas.captureStream) { if (G.UI) G.UI.toast('Export vidéo non disponible dans ce navigateur', 2500); return; }
    let stream;
    try { stream = G.R.ctx.canvas.captureStream(60); } catch (e) { if (G.UI) G.UI.toast("Export vidéo impossible : le navigateur bloque la capture de l'écran du jeu", 3000); return; }
    Rep.restart(); P.paused = false;
    let dest = null;
    const A = G.Audio;
    if (A && A.ctx && A.master) { try { dest = A.ctx.createMediaStreamDestination(); A.master.connect(dest); for (const tr of dest.stream.getAudioTracks()) stream.addTrack(tr); } catch (e) { dest = null; } }
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6e6 } : { videoBitsPerSecond: 6e6 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    P.video = { rec, chunks, dest, keep: true };
    rec.onstop = () => {
      if (dest && A.master) { try { A.master.disconnect(dest); } catch (e) { /* déjà déconnecté */ } }
      const v = P.video; if (P) P.video = null;
      if (!v || !v.keep) { if (G.UI) G.UI.toast('Export vidéo annulé', 1500); return; }
      const blob = new Blob(chunks, { type: 'video/webm' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = Rep.fileName(P.data).replace(/\.json$/, '.webm');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      if (G.UI) G.UI.toast('Vidéo enregistrée dans tes téléchargements', 2500);
    };
    rec.start(1000);
    if (G.UI) G.UI.toast('● Export vidéo en cours (le match défile à vitesse normale, garde la fenêtre ouverte) · B : annuler', P.data.len / 60 * 1000);
  }
  function stopVideo(keep) {
    const P = Rep.play;
    if (!P || !P.video) return;
    P.video.keep = keep;
    try { P.video.rec.stop(); } catch (e) { P.video = null; }
  }
})(window.G);
