'use strict';
// Rendu : caméra dynamique façon Smash, décor en parallaxe, combattants (calque par perso pour les flashs),
// effets (étincelles, traînées, éjections KO), bulles hors-champ et HUD des dégâts.
(function (G) {
  const U = G.U, D = G.D;
  const RAD = Math.PI / 180;
  const R = G.R = {
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
    cam: { x: 0, y: 40, w: 260, shake: 0, sx: 0, sy: 0 },
    parts: [], trails: {}, seen: new Set(), seenQ: [],
    hud: {}, banner: null, debug: false, flashScreen: 0, slowmo: 0,
    layers: {}, bgKey: '',
  };
  G.PCOL = ['#ff3b4a', '#3b82ff', '#ffc21a', '#2fd35b', '#b05cff', '#ff8a1f', '#28d7d7', '#ff5cc8'];
  G.PC = (f) => G.PCOL[f && f.pslot != null ? f.pslot : (f ? f.slot : 0)];
  G.PNAME = (f) => (f.cpu ? 'CPU' : 'J' + ((f.pslot != null ? f.pslot : f.slot) + 1));

  R.init = (canvas) => {
    R.canvas = canvas; R.ctx = canvas.getContext('2d');
    const rs = () => {
      R.dpr = Math.min(2, window.devicePixelRatio || 1);
      R.W = Math.floor(canvas.clientWidth * R.dpr); R.H = Math.floor(canvas.clientHeight * R.dpr);
      canvas.width = R.W; canvas.height = R.H; R.bgKey = '';
    };
    window.addEventListener('resize', rs); rs();
  };

  R.reset = () => { R.parts = []; R.trails = {}; R.hud = {}; R.banner = null; R.flashScreen = 0; R.cam.shake = 0; R.camInit = false; R.seen = new Set(); R.seenQ = []; };

  // ---------- Événements de la sim -> effets & sons ----------
  R.consume = (S, events) => {
    for (const e of events) {
      if (e.k) {
        if (R.seen.has(e.k)) continue;
        R.seen.add(e.k); R.seenQ.push(e.k);
        if (R.seenQ.length > 800) R.seen.delete(R.seenQ.shift());
      }
      fx(S, e);
    }
  };

  const TYPE_COL = {
    normal: ['#ffffff', '#ffe066'], fire: ['#ffd24a', '#ff5a1f'], elec: ['#fff59a', '#ffe600'], water: ['#bff3ff', '#2fa8ff'],
    ghost: ['#e2b6ff', '#8a3dff'], grass: ['#d8ff9a', '#3fcf4a'], steel: ['#ffffff', '#b8c4d6'], coin: ['#fff3a0', '#ffc21a'],
    fairy: ['#ffd6f2', '#ff6fc8'], dark: ['#d0b0ff', '#5a2a8a'], psychic: ['#ffc2f0', '#ff4fb0'], bug: ['#eaffa0', '#9ad21a'],
    blade: ['#ffffff', '#b27bff'], sound: ['#e8fff4', '#4fe0a8'], ice: ['#ffffff', '#8fe0ff'],
  };

  function fx(S, e) {
    const A = G.Audio;
    switch (e.t) {
      case 'hit': {
        const col = TYPE_COL[e.ht] || TYPE_COL.normal;
        const big = e.kb > 90;
        const n = Math.min(26, 5 + Math.floor(e.dmg * 1.3));
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * (big ? 3.5 : 2);
          R.parts.push({ ty: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 14 + Math.random() * 10, max: 24, size: 0.6 + Math.random() * 0.9, col: i % 2 ? col[0] : col[1] });
        }
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 12, max: 12, size: 3 + e.dmg * 0.35, col: col[1] });
        R.parts.push({ ty: 'star', x: e.x, y: e.y, life: 8, max: 8, size: 4 + e.dmg * 0.45, col: col[0], rot: Math.random() * 6 });
        if (big) { R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 20, max: 20, size: 10 + e.dmg * 0.5, col: '#ffffff' }); R.cam.shake = Math.max(R.cam.shake, Math.min(9, e.kb / 22)); R.flashScreen = Math.max(R.flashScreen, e.kb > 140 ? 0.35 : 0.15); }
        else R.cam.shake = Math.max(R.cam.shake, Math.min(3, e.dmg / 6));
        if (A) A.hit(e.dmg, e.kb, e.ht);
        const tg = S.fighters[e.tg];
        if (tg) { const h = R.hud[tg.slot] || (R.hud[tg.slot] = {}); h.shake = Math.min(18, 4 + e.dmg); }
        rumbleFor(S, e.tg, Math.min(1, 0.25 + e.kb / 150), 90 + e.kb);
        rumbleFor(S, e.s, 0.2, 60);
        break;
      }
      case 'shieldHit':
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 10, max: 10, size: 4, col: '#bfe6ff' });
        if (A) A.play('shield'); break;
      case 'parry':
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 18, max: 18, size: 12, col: '#ffffff' });
        R.flashScreen = 0.2; if (A) A.play('parry'); break;
      case 'counter':
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 16, max: 16, size: 14, col: '#ffdd55' });
        if (A) A.play('counter'); break;
      case 'ko': {
        const f = S.fighters[e.s];
        const col = G.PC(f);
        R.parts.push({ ty: 'ko', x: e.x, y: e.y, side: e.side, life: 60, max: 60, col });
        for (let i = 0; i < 30; i++) {
          const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
          R.parts.push({ ty: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 30, max: 30, size: 1.5, col: i % 2 ? '#fff' : col });
        }
        R.cam.shake = 12; R.flashScreen = 0.3;
        if (A) A.play('ko');
        rumbleFor(S, e.s, 1, 400);
        if (f && !S.training) R.banner = null;
        break;
      }
      case 'jump': dust(e.x, e.y, 5); if (A) A.play('jump'); break;
      case 'djump': R.parts.push({ ty: 'ring', x: e.x, y: e.y + 2, life: 10, max: 10, size: 5, col: 'rgba(255,255,255,0.8)', flat: 1 }); if (A) A.play('djump'); break;
      case 'land': dust(e.x, e.y, e.soft ? 4 : 8); if (A) A.play(e.soft ? 'step' : 'land'); break;
      case 'dash': dust(e.x - e.d * 3, e.y, 4, -e.d); if (A) A.play('dash'); break;
      case 'tech': R.parts.push({ ty: 'ring', x: e.x, y: e.y + 6, life: 14, max: 14, size: 9, col: '#aef' }); if (A) A.play('tech'); break;
      case 'bounce': case 'thud': dust(e.x, e.y, 10); if (A) A.play('thud'); break;
      case 'ledge': if (A) A.play('ledge'); break;
      case 'grab': if (A) A.play('grab'); break;
      case 'sbreak': R.parts.push({ ty: 'ring', x: e.x, y: e.y + 8, life: 30, max: 30, size: 22, col: '#9ad8ff' }); R.cam.shake = 8; if (A) A.play('sbreak'); break;
      case 'clank': case 'reflect': R.parts.push({ ty: 'star', x: e.x, y: e.y, life: 10, max: 10, size: 6, col: '#fff', rot: 0 }); if (A) A.play('clank'); break;
      case 'poof': R.parts.push({ ty: 'smoke', x: e.x, y: e.y, vx: 0, vy: 0.2, life: 14, max: 14, size: 2, col: 'rgba(255,255,255,0.6)' }); break;
      case 'trump': if (A) A.play('clank'); break;
      case 'count': R.banner = { txt: String(e.n), t: 0, big: 1 }; if (A) { A.play('count'); A.say(['', 'Un', 'Deux', 'Trois'][e.n]); } break;
      case 'go': R.banner = { txt: 'GO !', t: 0, big: 1.3, col: '#ffd23a' }; if (A) { A.play('go'); A.say('Go !'); } break;
      case 'game': R.banner = { txt: 'GAME !', t: 0, big: 1.4, col: '#ffffff', hold: 1 }; if (A) { A.play('game'); A.say('Partie terminée !'); } break;
      case 'sudden': R.banner = { txt: 'MORT SUBITE', t: 0, big: 1, col: '#ff4a4a' }; if (A) A.say('Mort subite !'); break;
      case 'tick': if (A) A.play('tick'); break;
      case 'sfx': if (A) A.play(e.name); { const f = S.fighters[e.s]; const ch = f && G.CHARS[f.char]; if (ch && ch.fx) ch.fx(e, R, S); } break;
      default: {
        // effets spécifiques aux personnages
        const f = e.s != null ? S.fighters[e.s] : null;
        const ch = f ? G.CHARS[f.char] : null;
        if (ch && ch.fx) ch.fx(e, R, S);
      }
    }
  }
  function rumbleFor(S, slot, str, ms) {
    if (slot == null || slot < 0 || !G.Game || !G.Game.devForSlot) return;
    const dev = G.Game.devForSlot(slot);
    if (dev) G.Input.rumble(dev, str, ms);
  }
  function dust(x, y, n, dir) {
    for (let i = 0; i < n; i++) {
      R.parts.push({ ty: 'smoke', x: x + (Math.random() - 0.5) * 4, y: y + 0.5, vx: (dir || (Math.random() - 0.5) * 2) * (0.3 + Math.random() * 0.6), vy: 0.1 + Math.random() * 0.3, life: 18 + Math.random() * 10, max: 28, size: 1.2 + Math.random(), col: 'rgba(240,235,225,0.75)' });
    }
  }
  R.dust = dust;
  R.spark = (x, y, col, n, sp) => {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = (sp || 1.5) * (0.4 + Math.random()); R.parts.push({ ty: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 16, max: 16, size: 0.9, col }); }
  };

  // ---------- Caméra ----------
  function updateCam(S) {
    const cam = R.cam, P = S.stage;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, n = 0;
    for (const f of S.fighters) {
      if (f.dead || f.out) continue;
      const st = G.ST(f);
      const x = U.clamp(R.px(f), P.blast.l + 30, P.blast.r - 30), y = U.clamp(R.py(f), P.blast.b + 20, P.blast.t - 20);
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y + st.h); n++;
    }
    if (!n) { minX = -60; maxX = 60; minY = 0; maxY = 40; }
    const asp = R.W / R.H;
    const cb = P.cam;
    let w = Math.max(maxX - minX + 95, (maxY - minY + 72) * asp, 150);
    w = Math.min(w, cb.r - cb.l);
    let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2 + 8;
    const hh = w / asp / 2, hw = w / 2;
    cx = U.clamp(cx, cb.l + hw, cb.r - hw);
    cy = U.clamp(cy, cb.b + hh, cb.t - hh);
    if (!R.camInit) { cam.x = cx; cam.y = cy; cam.w = w; R.camInit = true; }
    const k = R.dtk; // 1 = une frame à 60 Hz
    const kp = 1 - Math.pow(0.9, k), kz = 1 - Math.pow(0.93, k);
    cam.x += (cx - cam.x) * kp; cam.y += (cy - cam.y) * kp; cam.w += (w - cam.w) * kz;
    if (cam.shake > 0) { cam.sx = (Math.random() - 0.5) * cam.shake; cam.sy = (Math.random() - 0.5) * cam.shake; cam.shake *= Math.pow(0.86, k); if (cam.shake < 0.1) cam.shake = 0; }
    else { cam.sx = 0; cam.sy = 0; }
  }
  R.scale = () => R.W / R.cam.w;
  R.toScreen = (x, y) => { const s = R.scale(); return [(x - R.cam.x) * s + R.W / 2 + R.cam.sx * R.dpr, R.H / 2 - (y - R.cam.y) * s + R.cam.sy * R.dpr]; };
  function worldTransform(ctx) {
    const s = R.scale();
    ctx.setTransform(s, 0, 0, -s, R.W / 2 - R.cam.x * s + R.cam.sx * R.dpr, R.H / 2 + R.cam.y * s + R.cam.sy * R.dpr);
  }

  // ---------- Décor ----------
  function drawBG(ctx, S, t) {
    const st = G.STAGES[S.stageId];
    const key = st.id + R.W + 'x' + R.H;
    if (R.bgKey !== key) {
      R.bgKey = key; R.layers = {};
      const c = document.createElement('canvas'); c.width = R.W; c.height = R.H;
      st.bgStatic(c.getContext('2d'), R.W, R.H);
      R.layers.static = c;
      R.layers.list = (st.bgLayers || []).map((L) => {
        const lc = document.createElement('canvas'); lc.width = Math.floor(R.W * 1.5); lc.height = R.H;
        L.draw(lc.getContext('2d'), lc.width, R.H);
        return { c: lc, par: L.par };
      });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(R.layers.static, 0, 0);
    const s = R.scale();
    for (const L of R.layers.list) {
      const off = -R.W * 0.25 - R.cam.x * s * L.par;
      const offY = (R.cam.y - 40) * s * L.par * 0.15;
      ctx.drawImage(L.c, U.clamp(off, R.W - L.c.width, 0), offY);
    }
    if (st.bgDynamic) st.bgDynamic(ctx, R.W, R.H, t);
  }

  // ---------- Combattants ----------
  const layerCv = R.layerCv = {};
  function fighterLayer(slot, size) {
    let c = layerCv[slot];
    if (!c) c = layerCv[slot] = document.createElement('canvas');
    // un canevas neuf fait 300×150 par défaut : il faut vérifier la largeur ET la hauteur
    if (c.width < size || c.height < size) { const n = Math.max(size, c.width, c.height); c.width = n; c.height = n; }
    return c;
  }
  G.palOf = (f) => { const ch = G.CHARS[f.char]; return ch.palettes[f.pal % ch.palettes.length]; };

  function drawFighter(ctx, S, f, t) {
    if (f.dead || f.out) return;
    const st = G.ST(f), ch = G.CHARS[f.char];
    const P = G.pose(S, f, t);
    const s = R.scale();
    const size = Math.min(900, Math.ceil(st.h * 3.4 * s));
    const cv = fighterLayer(f.slot, size);
    const c2 = cv.getContext('2d');
    // Position à l'écran (interpolée entre deux frames de sim) ; le calque est copié au pixel près
    // (sinon le rééchantillonnage le rend flou en mouvement) : on reporte la partie fractionnaire dans le calque.
    let x = R.px(f), y = R.py(f);
    if (f.hitlag > 0 && (f.action === 'hit' || f.action === 'grabbed')) x += Math.sin(t * 95) * 0.7;
    if (P.chargeK) x += Math.sin(t * 80) * 0.3;
    const [sx, sy] = R.toScreen(x, y);
    const ix = Math.floor(sx - size / 2), iy = Math.floor(sy - size * 0.7);
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.clearRect(0, 0, size, size);
    c2.setTransform(s * f.facing, 0, 0, -s, sx - ix, sy - iy);
    c2.translate(0, P.bob || 0);
    if (P.rot) { const cy = st.h * 0.45; c2.translate(0, cy); c2.rotate(-P.rot * RAD); c2.translate(0, -cy); }
    ch.draw(c2, P, G.palOf(f), f, S, t);
    // Teintes (flash d'impact, intangibilité, charge, impuissance)
    let tint = null;
    if (f.flash > 0) tint = `rgba(255,255,255,${Math.min(0.8, f.flash / 10)})`;
    else if (f.intang > 0 && (f.action === 'ledge' || f.action === 'lgetup' || f.action === 'lroll' || f.action === 'lattack' || f.action === 'spot' || f.action === 'roll' || f.action === 'adodge' || f.action === 'getup' || f.action === 'tech' || f.action === 'troll' || f.action === 'groll')) tint = 'rgba(255,255,255,0.35)';
    else if (P.chargeK) tint = `rgba(255,240,150,${0.25 + 0.25 * Math.sin(t * 30)})`;
    else if (f.hitlag > 0 && f.action === 'hit') tint = 'rgba(255,255,255,0.3)';
    else if (P.dark) tint = `rgba(20,10,40,${P.dark})`;
    if (f.v.glow) tint = f.v.glow;
    if (tint) { c2.setTransform(1, 0, 0, 1, 0, 0); c2.globalCompositeOperation = 'source-atop'; c2.fillStyle = tint; c2.fillRect(0, 0, size, size); c2.globalCompositeOperation = 'source-over'; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    let alpha = P.alpha == null ? 1 : P.alpha;
    if (f.invinc > 0 && (S.frame >> 2) % 2) alpha *= 0.6;
    if (f.v.invis) alpha *= f.v.invis;
    ctx.globalAlpha = alpha;
    ctx.drawImage(cv, 0, 0, size, size, ix, iy, size, size);
    ctx.globalAlpha = 1;
  }
  R.drawFighterAt = (ctx, S, f, t, cx, cy, sc) => { // pour les bulles hors-champ / menus
    const st = G.ST(f), ch = G.CHARS[f.char];
    const P = G.pose(S, f, t);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc * f.facing, -sc);
    ctx.translate(0, -st.h * 0.45);
    if (P.rot) { const c = st.h * 0.45; ctx.translate(0, c); ctx.rotate(-P.rot * RAD); ctx.translate(0, -c); }
    ch.draw(ctx, P, G.palOf(f), f, S, t);
    ctx.restore();
  };

  function drawShield(ctx, S, f) {
    if (f.dead || !(f.action === 'shield' || (f.action === 'shieldOff' && f.af < 3))) return;
    const st = G.ST(f);
    const k = 0.3 + 0.7 * (f.shield / G.C.SH_MAX);
    const r = st.h * 0.62 * k * (G.CHARS[f.char].shieldMul || 1);
    const col = G.PC(f);
    const sx = f.prev[0] / 80, sy = f.prev[1] / 80;
    const x = R.px(f) + sx * 2, y = R.py(f) + st.h * 0.5 + sy * 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(x - r * 0.3, y + r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, U.rgb(U.hex(col), 0.15)); g.addColorStop(0.8, U.rgb(U.hex(col), 0.4)); g.addColorStop(1, U.rgb(U.hex(col), 0.75));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.4; ctx.stroke();
  }

  // Traînées d'attaque (arc suivant les hitbox actives)
  function updateTrails(S) {
    for (const f of S.fighters) {
      let tr = R.trails[f.slot] || (R.trails[f.slot] = []);
      for (const p of tr) p.age++;
      R.trails[f.slot] = tr = tr.filter((p) => p.age < 7);
      if (f.dead || f.action !== 'move' || f.hitlag > 0) continue;
      const hbs = G.activeHits(S, f);
      const ch = G.CHARS[f.char];
      for (let i = 0; i < hbs.length; i++) {
        const hb = hbs[i];
        if (hb.grab || hb.noTrail || !hb.dmg) continue;
        tr.push({ x: f.x + hb.x * f.facing, y: f.y + hb.y, r: hb.r, age: 0, i, mi: f.mi, col: hb.trail || ch.trail || '#ffffff' });
      }
    }
  }
  function drawTrails(ctx) {
    ctx.lineCap = 'round';
    for (const k in R.trails) {
      const tr = R.trails[k];
      for (let i = 1; i < tr.length; i++) {
        const a = tr[i - 1], b = tr[i];
        if (a.i !== b.i || a.mi !== b.mi || b.age !== a.age - 1) continue;
        const al = (1 - b.age / 7) * 0.55;
        ctx.strokeStyle = U.rgb(U.hex(b.col), al);
        ctx.lineWidth = b.r * 1.5 * (1 - b.age / 8);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const p of tr) {
        if (p.age > 0) continue;
        ctx.fillStyle = U.rgb(U.hex(p.col), 0.28);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.9, 0, 7); ctx.fill();
      }
    }
  }

  // ---------- Particules ----------
  function drawParts(ctx, S) {
    const keep = [];
    for (const p of R.parts) {
      p.life -= R.dtk;
      if (p.life <= 0) continue;
      keep.push(p);
      const k = p.life / p.max;
      if (p.vx != null) { const k = R.dtk, dr = Math.pow(0.92, k); p.x += p.vx * k; p.y += p.vy * k; p.vx *= dr; p.vy = p.vy * dr - (p.grav || 0) * k; }
      switch (p.ty) {
        case 'spark':
          ctx.strokeStyle = p.col; ctx.lineWidth = p.size * k; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); ctx.stroke(); break;
        case 'ring':
          ctx.strokeStyle = p.col; ctx.globalAlpha = k; ctx.lineWidth = 0.9 * k + 0.2;
          ctx.beginPath(); if (p.flat) ctx.ellipse(p.x, p.y, p.size * (1.3 - k), p.size * 0.35 * (1.3 - k), 0, 0, 7); else ctx.arc(p.x, p.y, p.size * (1.2 - k * 0.8), 0, 7);
          ctx.stroke(); ctx.globalAlpha = 1; break;
        case 'star': {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0); ctx.fillStyle = p.col; ctx.globalAlpha = k;
          const r = p.size * (0.6 + (1 - k) * 0.6);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
          ctx.closePath(); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; break;
        }
        case 'smoke':
          ctx.fillStyle = p.col; ctx.globalAlpha = k * 0.9;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.8), 0, 7); ctx.fill(); ctx.globalAlpha = 1; break;
        case 'coin':
          ctx.save(); ctx.translate(p.x, p.y); ctx.scale(Math.cos((p.life) * 0.4), 1);
          ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#a0660a'; ctx.lineWidth = 0.25;
          ctx.beginPath(); ctx.arc(0, 0, p.size, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); break;
        case 'leaf': case 'petal':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 0.2);
          ctx.fillStyle = p.col; ctx.globalAlpha = Math.min(1, k * 2);
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, 7); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; break;
        case 'bubble':
          ctx.strokeStyle = 'rgba(220,250,255,0.8)'; ctx.lineWidth = 0.25; ctx.globalAlpha = k;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; break;
        case 'flame':
          ctx.fillStyle = p.col; ctx.globalAlpha = k;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k, 0, 7); ctx.fill(); ctx.globalAlpha = 1; break;
        case 'ko': {
          // faisceau d'éjection coloré, du bord de l'écran vers le centre
          const P = S.stage;
          const cx = 0, cy = 40;
          const a = Math.atan2(cy - p.y, cx - p.x);
          const L = 160 * (1 - k * 0.3), w = 26 * k;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
          const g = ctx.createLinearGradient(0, 0, L, 0);
          g.addColorStop(0, U.rgb([255, 255, 255], k)); g.addColorStop(0.3, U.rgb(U.hex(p.col), 0.9 * k)); g.addColorStop(1, U.rgb(U.hex(p.col), 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(0, -w * 0.3); ctx.lineTo(L, -w); ctx.lineTo(L, w); ctx.lineTo(0, w * 0.3); ctx.closePath(); ctx.fill();
          ctx.restore();
          void P;
          break;
        }
        case 'custom': if (p.draw) p.draw(ctx, p, k); break;
      }
    }
    R.parts = keep.length > 600 ? keep.slice(-600) : keep;
  }

  // Fumée d'éjection pour les persos envoyés loin
  function kbSmoke(S) {
    for (const f of S.fighters) {
      if (!f.dead && f.v.poison > 0 && S.frame % 5 === 0) { const st = G.ST(f); R.parts.push({ ty: 'flame', x: f.x + (Math.random() - 0.5) * st.w, y: f.y + Math.random() * st.h * 0.8, vx: 0, vy: 0.25, life: 20, max: 20, size: 1.1, col: Math.random() < 0.5 ? 'rgba(170,70,220,0.8)' : 'rgba(120,230,90,0.7)' }); }
      if (!f.dead && f.v.burn > 0 && S.frame % 4 === 0) { const st = G.ST(f); R.parts.push({ ty: 'flame', x: f.x + (Math.random() - 0.5) * st.w, y: f.y + Math.random() * st.h, vx: 0, vy: 0.4, life: 16, max: 16, size: 1.3, col: Math.random() < 0.5 ? 'rgba(255,120,30,0.85)' : 'rgba(255,210,60,0.85)' }); }
      if (f.dead || f.action !== 'hit' || f.hitlag > 0) continue;
      const sp = Math.hypot(f.kbx, f.kby);
      if (sp > 2.2 && S.frame % 2 === 0) {
        const st = G.ST(f);
        R.parts.push({ ty: 'smoke', x: f.x, y: f.y + st.h * 0.5, vx: 0, vy: 0, life: 22, max: 22, size: 1.5 + sp * 0.3, col: sp > 4 ? 'rgba(255,220,180,0.7)' : 'rgba(255,255,255,0.55)' });
      }
    }
  }

  // ---------- Projectiles ----------
  function drawProjs(ctx, S, t) {
    for (const p of S.projs) {
      const K = G.PROJ[p.kind];
      if (K && K.draw) { ctx.save(); ctx.translate(p.x, p.y); K.draw(ctx, p, t, S); ctx.restore(); }
      else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    }
  }

  // ---------- Debug : hitbox / hurtbox ----------
  function drawDebug(ctx, S) {
    for (const f of S.fighters) {
      if (f.dead) continue;
      const hu = G.hurtbox(S, f);
      ctx.strokeStyle = f.intang > 0 || f.invinc > 0 ? 'rgba(80,160,255,0.8)' : 'rgba(255,230,0,0.8)'; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.arc(hu.x, hu.y0, hu.r, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(hu.x, hu.y1, hu.r, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hu.x - hu.r, hu.y0); ctx.lineTo(hu.x - hu.r, hu.y1); ctx.moveTo(hu.x + hu.r, hu.y0); ctx.lineTo(hu.x + hu.r, hu.y1); ctx.stroke();
      for (const hb of G.activeHits(S, f)) {
        ctx.fillStyle = hb.grab ? 'rgba(160,80,255,0.45)' : 'rgba(255,40,40,0.45)';
        ctx.beginPath(); ctx.arc(f.x + hb.x * f.facing, f.y + hb.y, hb.r, 0, 7); ctx.fill();
      }
    }
    for (const p of S.projs) { ctx.fillStyle = 'rgba(255,40,40,0.4)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  }

  // ---------- Rendu principal ----------
  R.pos = {};
  R.px = (f) => (R.pos[f.slot] ? R.pos[f.slot][0] : f.x);
  R.py = (f) => (R.pos[f.slot] ? R.pos[f.slot][1] : f.y);
  R.draw = (S, t, opts) => {
    opts = opts || {};
    const dt = R.lastT ? t - R.lastT : 1 / 60;
    R.lastT = t;
    R.dtk = U.clamp(dt * 60, 0, 3);
    R.newFrame = S.frame !== R.lastFrame; R.lastFrame = S.frame;
    // interpolation d'affichage entre la frame de sim précédente et l'actuelle
    const a = opts.alpha == null ? 1 : opts.alpha, prev = opts.prev;
    R.pos = {};
    for (const f of S.fighters) {
      const p = prev && prev[f.slot];
      if (p && !f.dead && Math.abs(p[0] - f.x) + Math.abs(p[1] - f.y) < 25) R.pos[f.slot] = [p[0] + (f.x - p[0]) * a, p[1] + (f.y - p[1]) * a];
    }
    const ctx = R.ctx;
    updateCam(S);
    drawBG(ctx, S, t);
    worldTransform(ctx);
    const st = G.STAGES[S.stageId];
    st.drawStage(ctx, S.stage, t);
    // plateforme de réapparition
    for (const f of S.fighters) {
      if (f.action === 'respawn' && !f.dead) {
        const s2 = G.ST(f);
        ctx.fillStyle = D.lin(ctx, f.x - 8, f.y, f.x + 8, f.y, '#9ff', '#fff');
        ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(f.x, f.y - 0.8, s2.w * 0.9 + 2, 1.6, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = G.PC(f); ctx.lineWidth = 0.5; ctx.stroke();
      }
    }
    if (R.newFrame) { updateTrails(S); kbSmoke(S); }
    drawProjs(ctx, S, t);
    drawTrails(ctx);
    const order = S.fighters.slice().sort((a, b) => (a.action === 'move' ? 1 : 0) - (b.action === 'move' ? 1 : 0));
    for (const f of order) { drawFighter(ctx, S, f, t); worldTransform(ctx); drawShield(ctx, S, f); }
    // effets spécifiques persos (au-dessus)
    for (const f of S.fighters) { const ch = G.CHARS[f.char]; if (ch.drawFx && !f.dead && !f.out) { ctx.save(); ch.drawFx(ctx, f, S, t); ctx.restore(); worldTransform(ctx); } }
    drawParts(ctx, S);
    if (R.debug || S.training && opts.hitboxes) drawDebug(ctx, S);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawIndicators(ctx, S, t);
    drawBubbles(ctx, S, t);
    if (R.flashScreen > 0) { ctx.fillStyle = `rgba(255,255,255,${R.flashScreen})`; ctx.fillRect(0, 0, R.W, R.H); R.flashScreen *= Math.pow(0.8, R.dtk); if (R.flashScreen < 0.02) R.flashScreen = 0; }
    drawHUD(ctx, S, t, opts);
  };

  function drawIndicators(ctx, S, t) {
    const u = R.dpr;
    ctx.textAlign = 'center';
    for (const f of S.fighters) {
      if (f.dead || f.out) continue;
      const st = G.ST(f);
      const [x, y] = R.toScreen(R.px(f), R.py(f) + st.h + 3);
      const col = G.PC(f);
      ctx.fillStyle = col; ctx.strokeStyle = '#111'; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6 * u, y - 9 * u); ctx.lineTo(x + 6 * u, y - 9 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.font = `900 ${12 * u}px "Rubik", system-ui, sans-serif`;
      ctx.lineWidth = 3 * u; ctx.strokeText(G.PNAME(f), x, y - 12 * u); ctx.fillText(G.PNAME(f), x, y - 12 * u);
      if (f.action === 'dizzy' || f.action === 'sbreak' || f.v.stun > 0) {
        for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; ctx.fillStyle = '#ffe44a'; ctx.font = `${14 * u}px sans-serif`; ctx.fillText('★', x + Math.cos(a) * 14 * u, y + 4 * u + Math.sin(a) * 4 * u); }
      }
    }
  }

  function drawBubbles(ctx, S, t) {
    const u = R.dpr, m = 34 * u;
    for (const f of S.fighters) {
      if (f.dead || f.out) continue;
      const st = G.ST(f);
      const [x, y] = R.toScreen(R.px(f), R.py(f) + st.h * 0.5);
      if (x > -10 && x < R.W + 10 && y > -10 && y < R.H + 10) continue;
      const cx = U.clamp(x, m + 6, R.W - m - 6), cy = U.clamp(y, m + 6, R.H - m - 110 * u);
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, m, 0, 7); ctx.fillStyle = 'rgba(10,10,30,0.8)'; ctx.fill();
      ctx.lineWidth = 3 * u; ctx.strokeStyle = G.PC(f); ctx.stroke();
      ctx.clip();
      R.drawFighterAt(ctx, S, f, t, cx, cy, m / st.h * 1.1);
      ctx.restore();
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > m * 3) { ctx.strokeStyle = 'rgba(255,60,60,0.9)'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(cx, cy, m + 4 * u, 0, 7); ctx.stroke(); }
    }
  }

  // ---------- HUD ----------
  G.dmgColor = (p) => {
    const stops = [[0, [255, 255, 255]], [40, [255, 244, 170]], [80, [255, 180, 60]], [120, [255, 90, 40]], [160, [230, 20, 20]], [220, [140, 0, 10]]];
    for (let i = 1; i < stops.length; i++) {
      if (p <= stops[i][0]) { const a = stops[i - 1], b = stops[i]; const k = (p - a[0]) / (b[0] - a[0]); return U.rgb(a[1].map((v, j) => v + (b[1][j] - v) * k)); }
    }
    return 'rgb(140,0,10)';
  };
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  R.rr = rr;

  function drawHUD(ctx, S, t, opts) {
    const u = R.dpr * Math.min(1.25, Math.max(0.7, R.H / R.dpr / 820));
    const F = S.fighters;
    const pw = 190 * u, ph = 74 * u, gap = 14 * u;
    const total = F.length * pw + (F.length - 1) * gap;
    let x0 = (R.W - total) / 2;
    const y0 = R.H - ph - 14 * u;
    for (const f of F) {
      const h = R.hud[f.slot] || (R.hud[f.slot] = {});
      if (h.shake > 0) h.shake *= 0.85;
      const ch = G.CHARS[f.char];
      const col = G.PC(f);
      const x = x0, y = y0;
      ctx.save();
      ctx.globalAlpha = f.out ? 0.45 : 1;
      rr(ctx, x, y, pw, ph, 12 * u);
      const g = ctx.createLinearGradient(x, y, x + pw, y + ph);
      g.addColorStop(0, U.rgb(U.hex(col), 0.95)); g.addColorStop(1, U.rgb(U.hex(col).map((v) => v * 0.35), 0.95));
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 2.5 * u; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
      // portrait
      const img = G.portrait(f.char, f.v.form);
      ctx.save(); rr(ctx, x + 4 * u, y + 4 * u, ph - 8 * u, ph - 8 * u, 9 * u); ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y, ph, ph);
      if (img) ctx.drawImage(img, x - 2 * u, y - 2 * u, ph + 4 * u, ph + 4 * u);
      else { const P = G.pose(S, f, t); ctx.translate(x + ph / 2, y + ph * 0.62); ctx.scale(ph / G.ST(f).h * 0.55, -ph / G.ST(f).h * 0.55); ctx.translate(0, -G.ST(f).h * 0.35); ch.draw(ctx, Object.assign({}, D.DEF_POSE, { eye: P.eye }), G.palOf(f), f, S, t); }
      ctx.restore();
      // nom
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = `800 ${13 * u}px "Rubik", system-ui, sans-serif`;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3 * u;
      const nm = ((ch.nameFor && ch.nameFor(f)) || ch.short || ch.name).toUpperCase();
      const maxW = pw - ph - 8 * u, nw = ctx.measureText(nm).width;
      ctx.save(); ctx.translate(x + ph + 2 * u, y + 17 * u); if (nw > maxW) ctx.scale(maxW / nw, 1);
      ctx.strokeText(nm, 0, 0); ctx.fillText(nm, 0, 0); ctx.restore();
      ctx.font = `800 ${10 * u}px "Rubik", system-ui, sans-serif`;
      ctx.fillStyle = f.cpu ? '#ddd' : '#fff';
      const tag = f.cpu ? 'CPU ' + f.cpu : (f.net ? f.net : G.PNAME(f));
      ctx.strokeText(tag, x + ph + 2 * u, y + 30 * u); ctx.fillText(tag, x + ph + 2 * u, y + 30 * u);
      // pourcentage
      if (!f.out) {
        const pct = Math.floor(f.percent);
        const sh = h.shake || 0;
        const ox = (Math.random() - 0.5) * sh * u * 0.6, oy = (Math.random() - 0.5) * sh * u * 0.6;
        ctx.font = `italic 900 ${38 * u}px "Rubik", system-ui, sans-serif`;
        ctx.textAlign = 'right';
        ctx.lineWidth = 6 * u; ctx.strokeStyle = '#1a0a14';
        const px = x + pw - 22 * u + ox, py = y + ph - 12 * u + oy;
        ctx.strokeText(pct, px, py);
        ctx.fillStyle = G.dmgColor(f.percent); ctx.fillText(pct, px, py);
        ctx.font = `italic 900 ${18 * u}px "Rubik", system-ui, sans-serif`;
        ctx.lineWidth = 4 * u; ctx.strokeText('%', px + 16 * u, py); ctx.fillText('%', px + 16 * u, py);
      } else {
        ctx.font = `900 ${22 * u}px "Rubik", system-ui, sans-serif`; ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
        ctx.fillText('K.O.', x + pw - 16 * u, y + ph - 16 * u);
      }
      // vies
      if (S.mode === 'stock' || S.sudden) {
        const n = Math.max(0, f.stocks);
        for (let i = 0; i < Math.min(n, 6); i++) {
          const sx = x + 11 * u + i * 11 * u, sy = y + ph - 10 * u;
          ctx.beginPath(); ctx.arc(sx, sy, 4.4 * u, 0, 7);
          ctx.fillStyle = ch.color || '#fff'; ctx.fill(); ctx.lineWidth = 1.6 * u; ctx.strokeStyle = '#fff'; ctx.stroke();
        }
        if (n > 6) { ctx.fillStyle = '#fff'; ctx.font = `800 ${11 * u}px sans-serif`; ctx.textAlign = 'left'; ctx.fillText('×' + n, x + 8 * u, y + ph - 6 * u); }
      } else {
        ctx.fillStyle = '#fff'; ctx.font = `800 ${12 * u}px "Rubik", sans-serif`; ctx.textAlign = 'left';
        const sc = f.stat.ko - f.stat.fall;
        ctx.fillText((sc >= 0 ? '+' : '') + sc, x + ph + 6 * u, y + ph - 8 * u);
      }
      if (ch.hud) ch.hud(ctx, f, S, x, y, pw, ph, u);
      ctx.restore();
      x0 += pw + gap;
    }
    // minuteur
    if (S.timer >= 0) {
      const s = Math.ceil(S.timer / 60);
      const txt = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      ctx.font = `900 ${30 * u}px "Rubik", system-ui, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 6 * u; ctx.strokeStyle = '#111'; ctx.strokeText(txt, R.W / 2, 44 * u);
      ctx.fillStyle = s <= 10 ? '#ff5050' : '#fff'; ctx.fillText(txt, R.W / 2, 44 * u);
    }
    if (S.training) {
      ctx.font = `800 ${14 * u}px "Rubik", sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3 * u;
      const lines = ['ENTRAÎNEMENT', 'H : hitbox ' + (opts.hitboxes ? 'ON' : 'OFF'), 'R : remettre à 0 %', 'Échap / + : menu pause'];
      lines.forEach((l, i) => { ctx.strokeText(l, 18 * u, 30 * u + i * 20 * u); ctx.fillText(l, 18 * u, 30 * u + i * 20 * u); });
    }
    // bannière (3-2-1-GO, GAME...)
    const b = R.banner;
    if (b) {
      b.t += R.dtk;
      const k = Math.min(1, b.t / 8);
      const life = b.hold ? 999 : 55;
      if (b.t > life) R.banner = null;
      else {
        const sc = (1.6 - 0.6 * k) * b.big;
        const al = b.t > life - 12 ? (life - b.t) / 12 : 1;
        ctx.save(); ctx.globalAlpha = al; ctx.translate(R.W / 2, R.H * 0.42); ctx.scale(sc, sc);
        ctx.font = `italic 900 ${96 * u}px "Rubik", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 14 * u; ctx.strokeStyle = '#1a0830'; ctx.strokeText(b.txt, 0, 0);
        const g2 = ctx.createLinearGradient(0, -50 * u, 0, 50 * u); g2.addColorStop(0, '#fff'); g2.addColorStop(1, b.col || '#ffd23a');
        ctx.fillStyle = g2; ctx.fillText(b.txt, 0, 0);
        ctx.restore();
      }
    }
    if (opts.netInfo) {
      ctx.font = `700 ${12 * u}px "Rubik", sans-serif`; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(opts.netInfo, R.W - 14 * u, 22 * u);
    }
  }
})(window.G);
