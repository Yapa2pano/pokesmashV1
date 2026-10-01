'use strict';
// Boucle principale : 60 simulations/s à pas fixe, rendu à la fréquence de l'écran.
(function (G) {
  const U = G.U;
  const Game = G.Game = {
    S: null, cfg: null, devs: [], mode: 'menu', paused: false, net: null, hitboxes: false,
    pauseSel: 0, pauseBy: null,
  };

  Game.devForSlot = (slot) => Game.devs[slot] || null;

  // cfg : { stage, players:[{char,pal,cpu,team,dev}], stocks, time, mode, training, seed }
  Game.startMatch = (cfg, opts) => {
    opts = opts || {};
    Game.cfg = cfg;
    Game.devs = cfg.players.map((p) => p.dev || null);
    Game.S = G.Sim.create(cfg);
    Game.net = opts.net || null;
    Game.mode = 'match'; Game.paused = false;
    G.R.reset();
    if (G.UI) G.UI.hide();
    if (G.Audio) { G.Audio.init(); G.Audio.music(G.STAGES[cfg.stage].music); }
  };
  Game.quitMatch = () => {
    if (G.Audio) G.Audio.stopMusic();
    if (Game.net) { Game.net.leaveMatch && Game.net.leaveMatch(); }
    Game.S = null; Game.mode = 'menu'; Game.paused = false;
  };

  function matchTick() {
    const S = Game.S;
    if (Game.paused) { pauseTick(); return; }
    // Pause (local uniquement)
    if (!Game.net) {
      for (let i = 0; i < Game.devs.length; i++) {
        const d = G.Input.devices[Game.devs[i]];
        if (d && (d.menu.start || d.menu.pause)) { Game.paused = true; Game.pauseSel = 0; Game.pauseBy = Game.devs[i]; if (G.Audio) G.Audio.play('menu'); return; }
      }
      if (!Game.devs.some(Boolean)) { const kb = G.Input.devices.kb; if (kb.menu.pause) { Game.paused = true; Game.pauseBy = 'kb'; return; } }
    }
    if (S.training) {
      const kb = G.Input.keys;
      if (kb.KeyH && !Game._h) { Game.hitboxes = !Game.hitboxes; }
      Game._h = kb.KeyH;
      if (kb.KeyR && !Game._r) { for (const f of S.fighters) { f.percent = 0; } }
      Game._r = kb.KeyR;
    }
    if (Game.net) {
      Game.net.tick();
    } else {
      const inputs = Game.devs.map((d) => (d ? G.Input.frame(d) : G.NEUTRAL));
      G.Sim.step(S, inputs);
      G.R.consume(S, S.events);
    }
    if (Game.S && Game.S.phase === 'done' && !Game.resultsShown) {
      Game.resultsShown = true;
      const res = G.Sim.results(Game.S);
      setTimeout(() => { Game.resultsShown = false; if (G.UI) G.UI.showResults(res, Game.cfg, Game.S); Game.quitMatchSoft(); }, 400);
    }
  }
  Game.quitMatchSoft = () => { if (G.Audio) G.Audio.stopMusic(); Game.mode = 'results'; };

  const PAUSE_ITEMS = ['Reprendre', 'Quitter le match'];
  function pauseTick() {
    const d = G.Input.devices[Game.pauseBy] || G.Input.devices.kb;
    const m = d.menu;
    if (m.up || m.down) { Game.pauseSel = (Game.pauseSel + 1) % PAUSE_ITEMS.length; if (G.Audio) G.Audio.play('menu'); }
    if (m.start || m.pause || m.back) { Game.paused = false; return; }
    if (m.ok) {
      if (Game.pauseSel === 0) Game.paused = false;
      else { Game.quitMatch(); if (G.UI) G.UI.show('title'); }
      if (G.Audio) G.Audio.play('select');
    }
  }
  function drawPause() {
    const R = G.R, ctx = R.ctx, u = R.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,4,24,0.6)'; ctx.fillRect(0, 0, R.W, R.H);
    ctx.textAlign = 'center';
    ctx.font = `italic 900 ${64 * u}px Rubik, sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText('PAUSE', R.W / 2, R.H * 0.35);
    PAUSE_ITEMS.forEach((it, i) => {
      ctx.font = `800 ${26 * u}px Rubik, sans-serif`;
      ctx.fillStyle = i === Game.pauseSel ? '#ffd23a' : '#ddd';
      ctx.fillText((i === Game.pauseSel ? '▶ ' : '') + it, R.W / 2, R.H * 0.48 + i * 44 * u);
    });
    ctx.font = `600 ${15 * u}px Rubik, sans-serif`; ctx.fillStyle = '#bbb';
    ctx.fillText('A : valider · + / Échap : reprendre', R.W / 2, R.H * 0.7);
  }

  // Planche de dessin (debug) : ?art=gromago (ou ?art=all)
  const ART_POSES = [['idle'], ['walk'], ['run'], ['air'], ['move', 'jab', 4], ['move', 'fsmash', 17], ['move', 'nair', 12], ['move', 'dair', 15], ['move', 'uair', 7], ['move', 'nspec', 12], ['move', 'uspec', 10], ['hit'], ['shield'], ['ledge'], ['crouch'], ['move', 'bair', 9]];
  function drawArt(t) {
    const R = G.R, ctx = R.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#556'; ctx.fillRect(0, 0, R.W, R.H);
    const base = Game.artChar === 'all' ? G.CHAR_ORDER : [Game.artChar];
    // un perso à formes : une ligne par forme
    const forms = base.length === 1 && G.CHARS[base[0]]._forms ? [null, ...Object.keys(G.CHARS[base[0]]._forms).filter((k) => !/^n\d/.test(k))] : null;
    const ids = forms ? forms.map(() => base[0]) : base;
    const S = Game.artS || (Game.artS = G.Sim.create({ stage: 'final', players: ids.map((c) => ({ char: c })), training: true }));
    S.frame = Math.floor(t * 60);
    const single = ids.length === 1;
    const rows = single ? 4 : ids.length, cols = single ? 4 : 6;
    const cw = R.W / cols, chh = R.H / rows;
    ids.forEach((id, r) => {
      const f = S.fighters[r];
      for (let c = 0; c < (single ? 16 : cols); c++) {
        const p = ART_POSES[c % ART_POSES.length];
        f.action = p[0]; f.move = p[1] || null; f.af = p[2] || (S.frame % 40); f.grounded = p[0] !== 'air'; f.vy = -0.5; f.vx = p[0] === 'run' ? 2 : 0;
        f.v.form = forms ? forms[r] : null;
        const col = single ? c % 4 : c, row = single ? Math.floor(c / 4) : r;
        const st = G.ST(f);
        const sc = Math.min(cw, chh) / (st.h * 1.6);
        ctx.strokeStyle = '#778'; ctx.strokeRect(col * cw, row * chh, cw, chh);
        try { R.drawFighterAt(ctx, S, f, t, col * cw + cw / 2, row * chh + chh * 0.55, sc); } catch (e) { console.error(e); }
        ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(p.join(' '), col * cw + 6, row * chh + 14);
      }
    });
  }

  // Hooks de test (pas utilisés en jeu) : faire avancer la sim à la main
  Game.tickOnce = () => { G.Input.poll(); if (Game.mode === 'match' && Game.S) matchTick(); else if (G.UI) G.UI.tick(); };
  Game.run = (n) => { for (let i = 0; i < n; i++) Game.tickOnce(); };
  Game.renderOnce = () => { if (Game.S) G.R.draw(Game.S, performance.now() / 1000, { hitboxes: Game.hitboxes }); else if (G.UI && G.UI.drawBG) G.UI.drawBG(performance.now() / 1000); };

  let last = 0, acc = 0;
  const STEP = 1000 / 60;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now;
    acc += Math.min(120, now - last); last = now;
    let n = 0;
    while (acc >= STEP && n < 5) {
      G.Input.poll();
      if (Game.mode === 'match' && Game.S) {
        // positions avant la frame de sim : servent à interpoler l'affichage entre deux frames
        if (!Game.paused) Game.prevPos = Game.S.fighters.map((f) => [f.x, f.y]);
        matchTick();
      } else if (G.UI) G.UI.tick();
      acc -= STEP; n++;
    }
    if (n >= 5) acc = 0;
    const t = now / 1000;
    if (Game.mode === 'art') { drawArt(t); return; }
    if ((Game.mode === 'match' || Game.mode === 'results') && Game.S) {
      const alpha = Game.paused || Game.mode !== 'match' ? 1 : U.clamp(acc / STEP, 0, 1);
      G.R.draw(Game.S, t, { hitboxes: Game.hitboxes, netInfo: Game.net ? Game.net.info() : null, alpha, prev: Game.prevPos });
      if (Game.paused) drawPause();
    } else if (G.UI && G.UI.drawBG) G.UI.drawBG(t);
  }

  window.addEventListener('load', () => {
    G.R.init(document.getElementById('game'));
    G.preloadPortraits();
    const first = () => { if (G.Audio) G.Audio.init(); };
    window.addEventListener('pointerdown', first); window.addEventListener('keydown', first);
    const q = new URLSearchParams(location.search);
    if (q.get('art')) { Game.mode = 'art'; Game.artChar = q.get('art'); requestAnimationFrame(frame); return; }
    if (q.get('test')) {
      const c1 = q.get('p1') || 'gromago', c2 = q.get('p2') || 'gromago';
      Game.startMatch({ stage: q.get('stage') || 'champ', mode: 'stock', stocks: 3, time: 0, training: q.get('test') === 'training', seed: 42,
        players: [{ char: c1, dev: 'kb' }, { char: c2, cpu: +(q.get('cpu') || 0), dev: null, pal: c1 === c2 ? 1 : 0 }] });
    } else if (G.UI) G.UI.init();
    requestAnimationFrame(frame);
  });
})(window.G);
