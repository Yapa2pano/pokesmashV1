'use strict';
// MIASCARADE — rushdown magicienne : Magie Florale (bas B) = bombe-fleur qui se colle à l'adversaire ou au
// décor, bas B à nouveau pour la faire exploser (façon C4). Feuille Magique (B) : 3 feuilles à tête chercheuse.
// Coup Bas (côté B) : dash qui traverse et se retourne. Voltige Florale (haut B) : téléportation.
(function (G) {
  const U = G.U, D = G.D, H = G.H, A = G.A;
  const Gr = (o) => Object.assign({ t: 'grass' }, o || {});

  // Marque florale : ses coups « fleur » posent des pétales sur l'adversaire (max 3, pendant 6 s).
  // La bombe-fleur (+3,5 % par pétale) et le Tour de Fleur (critique à 3 pétales) les consomment.
  function mark(S, f, t) {
    if (t.v.petalBy !== f.slot) { t.v.petal = 0; t.v.petalBy = f.slot; }
    t.v.petal = Math.min(3, (t.v.petal || 0) + 1); t.v.petalT = 360;
  }
  const petals = (f, t) => (f && t.v.petalBy === f.slot ? t.v.petal || 0 : 0);
  function flowerTrick(S, a, t, d) { // Tour de Fleur : à 3 pétales, coup critique
    if (petals(a, t) < 3) return d;
    t.v.petal = 0;
    S.events.push({ t: 'sfx', name: 'snipe', s: a.slot, flowerCrit: 1, x: t.x, y: t.y + 10, k: 'fcr' + a.slot + '_' + S.frame });
    return d * 1.6;
  }
  function bombOf(S, f) { for (const p of S.projs) if (p.kind === 'fbomb' && p.owner === f.slot && !p.dead) return p; return null; }
  function blowUp(S, p) {
    if (p.dead) return;
    p.dead = true;
    let x = p.x, y = p.y;
    if (p.v.stuck >= 0) { const t = S.fighters[p.v.stuck]; if (t && !t.dead) { x = t.x; y = t.y + G.ST(t).h * 0.5; } }
    G.spawnProj(S, S.fighters[p.owner], 'fblast', { x, y, vx: 0, vy: 0, r: 11, life: 5, pierce: true, ghost: true, refl: false, clank: false, away: true, dmg: 15, ang: 72, bkb: 58, kbg: 92, t: 'grass' });
    S.events.push({ t: 'sfx', name: 'hammer', s: p.owner, bloom: 1, x, y, k: 'fb' + p.id });
  }
  G.PROJ.fblast = {
    draw() {},
    dmgFn(S, att, tgt, dmg) {
      const n = petals(att, tgt);
      if (n) { tgt.v.petal = 0; S.events.push({ t: 'sfx', name: 'magic', s: att.slot, bouquet: n, x: tgt.x, y: tgt.y + 14, k: 'bq' + att.slot + '_' + S.frame }); }
      return dmg + n * 3.5;
    },
  };
  G.PROJ.fbomb = {
    tick(S, p) {
      const v = p.v;
      if (++v.timer >= 480) { blowUp(S, p); return; }
      if (v.stuck >= 0) {
        const t = S.fighters[v.stuck];
        if (!t || t.dead || t.out) { v.stuck = -1; p.grav = 0.1; return; }
        p.x = t.x + v.ox; p.y = t.y + v.oy; p.vx = 0; p.vy = 0; p.grav = 0;
        return;
      }
      if (v.stuck === -2) { p.vx = 0; p.vy = 0; p.grav = 0; return; }
      // en vol : colle au premier adversaire touché
      for (const t of S.fighters) {
        if (t.slot === p.owner || t.dead || t.out || t.invinc > 0) continue;
        const hu = G.hurtbox(S, t);
        if (U.distSeg(p.x, p.y, hu.x, hu.y0, hu.x, hu.y1) < p.r + hu.r) {
          v.stuck = t.slot; v.ox = U.clamp(p.x - t.x, -3, 3); v.oy = U.clamp(p.y - t.y, 2, G.ST(t).h - 2);
          S.events.push({ t: 'sfx', name: 'grab', s: p.owner, x: p.x, y: p.y, k: 'fs' + p.id });
          return;
        }
      }
      // colle au décor
      const m = S.stage.main;
      const ny = p.y + p.vy - p.grav;
      if (p.x > m.l && p.x < m.r && p.y >= m.y && ny <= m.y) { p.y = m.y + 1; v.stuck = -2; return; }
      for (const pl of S.stage.plats) if (p.x > pl.l && p.x < pl.r && p.y >= pl.y && ny <= pl.y) { p.y = pl.y + 1; v.stuck = -2; return; }
      if (G.inBlock(S, p.x + p.vx, ny)) { v.stuck = -2; p.vx = 0; }
    },
    onEnd(S, p) { blowUp(S, p); },
    draw(ctx, p, t) {
      const pulse = p.v.timer > 360 ? Math.sin(t * 30) * 0.3 : Math.sin(t * 6) * 0.1;
      const r = p.r * (1 + pulse * 0.3);
      for (let i = 0; i < 5; i++) {
        ctx.save(); ctx.rotate(i / 5 * Math.PI * 2 + t);
        ctx.fillStyle = i % 2 ? '#ff4a7a' : '#ff7aa0'; ctx.strokeStyle = '#1b1226'; ctx.lineWidth = 0.25;
        ctx.beginPath(); ctx.ellipse(r * 0.8, 0, r * 0.75, r * 0.45, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, 7); ctx.fill();
      ctx.fillStyle = p.v.timer % 30 < 15 ? '#ff2a2a' : '#ffe066'; ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, 7); ctx.fill();
    },
  };
  G.PROJ.mleaf = {
    tick(S, p) {
      let best = null, bd = 1e9;
      for (const t of S.fighters) {
        if (t.slot === p.owner || t.dead || t.out) continue;
        const d = U.len(t.x - p.x, t.y + 8 - p.y);
        if (d < bd) { bd = d; best = t; }
      }
      if (best && p.age > 4 && bd < 120) {
        const a = U.datan2(p.vy, p.vx), b = U.datan2(best.y + G.ST(best).h * 0.5 - p.y, best.x - p.x);
        let d = b - a; while (d > 180) d -= 360; while (d < -180) d += 360;
        const na = a + U.clamp(d, -5, 5), sp = 2.9;
        p.vx = U.dcos(na) * sp; p.vy = U.dsin(na) * sp;
      }
    },
    draw(ctx, p, t) {
      ctx.rotate(Math.atan2(p.vy, p.vx) + Math.sin(t * 20 + p.id) * 0.3);
      ctx.fillStyle = '#7de35a'; ctx.strokeStyle = '#1b1226'; ctx.lineWidth = 0.25;
      ctx.beginPath(); ctx.moveTo(2.4, 0); ctx.quadraticCurveTo(0, 1.4, -2.2, 0); ctx.quadraticCurveTo(0, -1.4, 2.4, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,200,0.6)'; ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, 7); ctx.fill();
    },
  };

  function leafTick(S, f, af) {
    const st = G.ST(f);
    if (af === 10 || af === 14 || af === 18) {
      const a = af === 10 ? 18 : af === 14 ? 0 : -18;
      G.spawnProj(S, f, 'mleaf', { x: f.x + f.facing * 5, y: f.y + st.h * 0.6, vx: f.facing * 2.9 * U.dcos(a), vy: 2.9 * U.dsin(a), r: 1.9, life: 70, dmg: 2.5, ang: 70, bkb: 35, kbg: 22, t: 'grass' });
      G.sfx(S, f, 'magic');
    }
  }
  function bombThrowTick(S, f, af) {
    if (af === 10) {
      const st = G.ST(f);
      G.spawnProj(S, f, 'fbomb', { x: f.x + f.facing * 5, y: f.y + st.h * 0.6, vx: f.facing * 2.3 + f.vx * 0.4, vy: f.grounded ? 1.6 : 0.6, grav: 0.1, r: 2.2, life: 600, dmg: 0, harmless: true, ghost: true, refl: false, clank: false, v: { stuck: -1, timer: 0, ox: 0, oy: 0 } });
      G.sfx(S, f, 'magic');
    }
  }
  function suckerTick(S, f, af) {
    if (af === 1 && !f.grounded) { if (f.v.sb) { G.setAction(f, 'air'); return 'stop'; } f.v.sb = 1; }
    if (af >= 6 && af <= 16) { f.vx = f.facing * 3.7; if (!f.grounded) f.vy = 0; }
    if (af === 6) G.sfx(S, f, 'dash');
    if (af === 17) f.vx *= 0.3;
    if (af === 20) f.facing = -f.facing;
  }
  // Tourbillon de Cape (A neutre en l'air) : attire un peu et RETOURNE l'adversaire (il se retrouve dos à elle)
  function capeTick(S, f, af) { if (af >= 3 && af <= 9) G.pull(S, f, f.x, f.y + 9, 20, 0.55); if (af === 4) G.sfx(S, f, 'swing', { petals: 1 }); }
  // Voltige Arrière (bas + A en l'air) : salto arrière qui frappe dessous puis derrière, elle finit retournée
  function flipTick(S, f, af) {
    if (af === 4) { f.vy = Math.max(f.vy, 1.1); f.ff = false; G.sfx(S, f, 'swing'); }
    if (af === 15) f.facing = -f.facing;
  }
  function tpTick(S, f, af, inp) {
    const st = G.ST(f);
    if (af === 4) { const m = U.len(inp.sx, inp.sy); f.mv.dx = m > 0.3 ? inp.sx / m : 0; f.mv.dy = m > 0.3 ? inp.sy / m : 1; G.sfx(S, f, 'magic', { petals: 1 }); f.grounded = false; f.plat = null; }
    if (af >= 4 && af < 15) { f.vx = 0; f.vy = 0; }
    if (af === 14) {
      f.x += f.mv.dx * 44; f.y += f.mv.dy * 44;
      if (G.inBlock(S, f.x, f.y)) { const m = S.stage.main; if (f.y > m.y - 12) f.y = m.y + 0.1; else f.y = m.bottom - st.h - 1; }
      if (f.mv.dx) f.facing = f.mv.dx > 0 ? 1 : -1;
      G.sfx(S, f, 'magic', { petals: 1 });
    }
    if (af >= 15 && af <= 17) G.pendingHitbox(S, f, { x: 0, y: st.h * 0.5, r: 9, dmg: 7, ang: 80, bkb: 55, kbg: 70, t: 'grass' });
  }

  G.registerChar({
    id: 'miascarade', name: 'Miascarade', short: 'Miascarade', dex: 908, color: '#3fae52', trail: '#ff9ac0',
    desc: 'Rushdown magicienne. Bas B : bombe-fleur collante, rappuie pour la faire exploser. B : feuilles à tête chercheuse. Côté B : Coup Bas qui traverse.',
    stats: {
      weight: 82, h: 17, w: 7.5, walk: 1.3, dash: 2.25, dashF: 12, run: 2.3, runAcc: 0.13, traction: 0.1,
      air: 1.22, airAcc: 0.09, grav: 0.1, fall: 1.75, ffall: 2.8, fullHop: 34, shortHop: 16, dJump: 32,
    },
    palettes: [
      { name: 'Normal', body: '#3fae52', cape: '#276b3a', lining: '#e8467a', mask: '#f4efe0', eye: '#ff3a6a', leg: '#1f4a2c', bud: '#ff4a7a' },
      { name: 'Chromatique', body: '#3a3a4a', cape: '#1e1e2a', lining: '#5ae0a0', mask: '#e8e4f0', eye: '#ffd23a', leg: '#15151f', bud: '#5ae0a0' },
      { name: 'Sakura', body: '#ff9ac8', cape: '#d85a9a', lining: '#fff0a0', mask: '#fff8f0', eye: '#8a3aff', leg: '#9a3a6a', bud: '#fff0a0' },
      { name: 'Minuit', body: '#6a4ac8', cape: '#3a2a7a', lining: '#ffb03a', mask: '#efe8ff', eye: '#ff5a5a', leg: '#241a4a', bud: '#ffb03a' },
    ],
    init(f) { f.v.sb = 0; },
    passive(S, f) { if (f.grounded || f.action === 'ledge') f.v.sb = 0; },
    onDealHit(S, f, t, h, dmg, isProj) { if (h.hb.petal || (isProj && h.proj.kind === 'mleaf')) mark(S, f, t); },
    postTick(S, f) {
      for (const t of S.fighters) if (t.v.petalBy === f.slot && t.v.petal > 0 && (t.dead || --t.v.petalT <= 0)) t.v.petal = 0;
    },
    drawFx(ctx, f, S, t) { // pétales qui tournent au-dessus des adversaires marqués
      for (const o of S.fighters) {
        const n = o.v.petalBy === f.slot && !o.dead ? o.v.petal || 0 : 0;
        if (!n) continue;
        const st = G.ST(o), cx = G.R.px(o), cy = G.R.py(o) + st.h * 0.55;
        for (let i = 0; i < n; i++) { // fleurs en orbite autour du corps (plus grosses et rouges à 3 = prêt pour le critique)
          const a = t * 2.4 + i * 2.09, x = cx + Math.cos(a) * (st.w * 0.9 + 1.5), y = cy + Math.sin(a) * st.h * 0.35, sz = n >= 3 ? 1.35 : 1;
          for (let j = 0; j < 5; j++) { ctx.fillStyle = n >= 3 ? (j % 2 ? '#ff2a5a' : '#ffe066') : (j % 2 ? '#ff6a9a' : '#ffb0c8'); ctx.beginPath(); ctx.ellipse(x + Math.cos(j * 1.256) * 0.8 * sz, y + Math.sin(j * 1.256) * 0.8 * sz, 0.65 * sz, 0.42 * sz, j * 1.256, 0, 7); ctx.fill(); }
          ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(x, y, 0.42 * sz, 0, 7); ctx.fill();
        }
      }
    },
    moves: {
      jab: { len: 14, iasa: 12, next: ['jab2', 3, 12], hits: [H(2, 3, 7, 10, 3.6, 2, 361, 20, 20)], anim: A.jab(2, 3, 14) },
      jab2: { len: 15, next: ['jab3', 4, 13], hits: [H(3, 4, 7.5, 10, 3.6, 2, 361, 22, 20)], anim: A.jab2(3, 4, 15) },
      jab3: { len: 34, hits: [H(4, 20, 9, 9, 5.5, 0.9, 361, 0, 0, { rehit: 3, link: 1, hs: 8 }), H(24, 25, 10, 9, 6.5, 3.5, 361, 55, 105, Gr({ g: 1 }))], anim: [[0, {}], [4, { aF: 100, aB: 60 }], [7, { aF: 60, aB: 105 }], [10, { aF: 105, aB: 60 }], [13, { aF: 60, aB: 105 }], [16, { aF: 105, aB: 60 }], [20, { aF: 60, aB: 105 }], [23, { lF: 20, kF: 80 }], [24, { lF: 100, kF: 0, lean: -12, eye: 1 }], [34, {}]] },
      ftilt: { len: 26, hitCancel: 14, hits: [H(6, 8, 12, 9, 5.5, 7, 361, 30, 70, Gr({ turn: 1, petal: 1 }))], anim: [[0, {}], [5, { aF: -40, lean: -6 }], [6, { aF: 110, lean: 14, cape: 1 }], [12, { aF: 100 }], [26, {}]] },
      utilt: { len: 24, hitCancel: 12, hits: [H(5, 9, 2, 17, 6, 6, 95, 55, 60)], anim: A.uair(5, 9, 24) },
      dtilt: { len: 20, hurtH: 0.6, hitCancel: 10, hits: [H(5, 7, 11, 1.8, 4.5, 5, 80, 40, 30, Gr({ trip: 1, petal: 1 }))], anim: A.sweep(5, 7, 20) },
      dashAtk: { len: 34, keepVel: 1, hurtH: 0.6, tick: G.dashAtkTick, hitCancel: 20, hits: [H(5, 12, 8, 2.5, 5.5, 8, 80, 62, 48)], anim: [[0, { lean: 10 }], [5, { crouch: 0.8, lF: 95, kF: 0, lean: -25 }], [14, { crouch: 0.8, lF: 90, lean: -20 }], [34, {}]] },
      fsmash: { len: 48, charge: 9, hits: [H(14, 16, 15, 9, 8, 16, 361, 36, 102, Gr()), H(14, 16, 7, 9, 5, 13, 361, 33, 96, Gr())], anim: [[0, {}], [9, { aF: -60, aB: -60, lean: -12, cape: 1, eye: 1 }], [13, { aF: -50, lean: -10, cape: 1 }], [14, { aF: 110, aB: 90, lean: 18, cape: 1, eye: 1 }], [22, { aF: 100, aB: 85, lean: 16, cape: 1 }], [48, {}]] },
      usmash: { len: 46, charge: 7, hits: [H(10, 11, 2, 14, 7, 3, 90, 100, 0, Gr({ link: 1 })), H(14, 17, 1, 23, 8, 14, 88, 36, 104, Gr({ g: 1 }))], anim: A.smashU(7, 11, 17, 46) },
      dsmash: { len: 44, charge: 5, hits: [H(9, 11, 11, 2.5, 5.5, 13, 30, 32, 96), H(9, 11, -11, 2.5, 5.5, 13, 150, 32, 96)], anim: [[0, {}], [5, { crouch: 0.8 }], [9, { crouch: 0.9, lF: 100, lB: -100, kF: 0, kB: 0 }], [16, { crouch: 0.9, lF: 95, lB: -95 }], [44, {}]] },
      // Tourbillon de Cape : attire et retourne l'adversaire (+ pétale)
      nair: { aerial: 1, len: 34, landLag: 7, ac: [4, 26], tick: capeTick, hits: [H(4, 8, 0, 9, 8.5, 5, 70, 40, 35, Gr({ turn: 1, petal: 1 })), H(12, 14, 0, 9, 9, 5, 361, 45, 88, Gr({ g: 1, petal: 1 }))], anim: [[0, { cape: 1 }], [3, { cape: 1, aF: 120, aB: -120, rot: 0 }], [14, { cape: 1, aF: 120, aB: -120, rot: 360, eye: 1 }], [34, { rot: 360 }]] },
      // Tour de Fleur : pose un pétale ; à 3 pétales, CRITIQUE (×1,6) et les pétales sont consommés
      fair: { aerial: 1, len: 32, landLag: 8, ac: [3, 24], hits: [H(6, 8, 10, 10, 6.5, 7, 45, 32, 82, Gr({ petal: 1, dmgFn: flowerTrick }))], anim: [[0, {}], [5, { aF: -30, lean: -8, cape: 1 }], [6, { aF: 110, eF: 0, lean: 14, glow: 1, eye: 1 }], [12, { aF: 100, glow: 1 }], [32, {}]] },
      // Bouquet Surprise : un bouquet jaillit de sous la cape, derrière elle
      bair: { aerial: 1, len: 34, landLag: 9, ac: [4, 26], tick: (S, f, af) => { if (af === 7) G.sfx(S, f, 'magic', { petals: 1, x: f.x - f.facing * 10 }); }, hits: [H(7, 9, -11, 9, 7, 13, 361, 32, 100, Gr())], anim: [[0, { cape: 1 }], [6, { cape: 1, aB: 60, lean: 8 }], [7, { cape: 1, aB: -110, lean: -10, eye: 1 }], [14, { cape: 1, aB: -100 }], [34, {}]] },
      // Chapeau Magique : coup de pied retourné au-dessus (+ pétale)
      uair: { aerial: 1, len: 32, landLag: 8, ac: [3, 24], hits: [H(5, 9, 1, 19, 6.5, 9, 80, 30, 105, Gr({ petal: 1 }))], anim: A.uair(5, 9, 32) },
      // Voltige Arrière : salto qui frappe dessous puis derrière ; elle se retrouve retournée (mix-up)
      dair: { aerial: 1, len: 36, landLag: 10, ac: [4, 28], tick: flipTick, hits: G.ARC(6, 12, 0, 8, 9, -40, -220, 4, 5.5, 9, 55, 40, 85, Gr()), anim: [[0, { tuck: 0.3 }], [4, { rot: 0, tuck: 0.8, cape: 1 }], [13, { rot: 330, tuck: 0.8, lF: 100, cape: 1, eye: 1 }], [16, { rot: 360, tuck: 0.2 }], [36, { rot: 360 }]] },
      nspec: { len: 34, tick: leafTick, land: 'keep', grav: 0.6, anim: A.cast(10, 18, 34) },
      sspec: { len: 34, tick: suckerTick, intang: [6, 12], keepVel: 1, offEdge: 1, land: 'keep', drift: 0, noGrav: (af) => af >= 6 && af <= 16, hitCancel: 18, ledge: 16,
        hits: [H(6, 16, 3, 8, 6, 8, 55, 55, 50, { t: 'dark' })], anim: [[0, { crouch: 0.3, cape: 1 }], [6, { lean: 35, aF: 110, aB: -60, cape: 1 }], [16, { lean: 30, aF: 100, aB: -60, cape: 1 }], [20, { lean: 0 }], [34, {}]] },
      uspec: { len: 36, helpless: 1, landLag: 16, ledge: 14, tick: tpTick, drift: 0, noGrav: (af) => af >= 4 && af < 15, intang: [4, 15], anim: [[0, { cape: 1 }], [4, { aF: 170, aB: 170, cape: 1 }], [15, { aF: 170, aB: -40, cape: 1 }], [36, {}]] },
      dspec: { len: 30, tick: bombThrowTick, land: 'keep', start: (S, f) => { if (bombOf(S, f)) G.startMove(S, f, 'detonate'); }, anim: [[0, {}], [8, { aF: -40, lean: -6 }], [10, { aF: 120, lean: 10 }], [30, {}]] },
      detonate: { len: 16, land: 'keep', tick: (S, f, af) => { if (af === 4) { const b = bombOf(S, f); if (b) blowUp(S, b); } }, anim: [[0, {}], [3, { aF: 150, eye: 1 }], [5, { aF: 120, eye: 3 }], [16, {}]] },
      fthrow: { throw: 1, len: 30, rel: 12, dmg: 7, ang: 42, bkb: 62, kbg: 62, hold: [[0, 1, 0], [10, 1.4, 0.2]], anim: A.throwF },
      bthrow: { throw: 1, back: 1, len: 34, rel: 15, dmg: 11, ang: 42, bkb: 60, kbg: 84, hold: [[0, 1, 0], [8, 0, 0.9], [15, -1.5, 0.3]], anim: A.throwB },
      uthrow: { throw: 1, len: 34, rel: 14, dmg: 6, ang: 90, bkb: 70, kbg: 60, hold: [[0, 1, 0], [12, 0.2, 1.3]], anim: A.throwU },
      dthrow: { throw: 1, len: 34, rel: 16, dmg: 5, ang: 75, bkb: 72, kbg: 38, hold: [[0, 1, 0], [12, 0.9, -0.1]], anim: A.throwD },
      taunt: { len: 60, anim: [[0, {}], [10, { aF: 150, aB: -40, cape: 1, eye: 3 }], [45, { aF: 90, aB: 150, cape: 1, eye: 3 }], [60, {}]] },
    },
    pose(P, f) {
      if (f.action === 'move' && f.move === 'uspec' && f.af >= 5 && f.af < 14) P.alpha = 0.08;
    },
    draw(ctx, P, c, f, S, t) {
      const cr = P.crouch || 0, tu = P.tuck || 0;
      ctx.save();
      ctx.scale(1 + cr * 0.08, 1 - cr * 0.3);
      const hip = [0, 7.2];
      const rot = (x, y) => { ctx.translate(x, y); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-x, -y); };
      const lF = U.lerp(P.lF, 70, tu), lB = U.lerp(P.lB, 50, tu), kF = U.lerp(P.kF, 110, tu), kB = U.lerp(P.kB, 110, tu);
      const sway = Math.sin(t * 4 + f.slot) * 0.8 - (f.vx || 0) * f.facing * 1.2;
      // cape (derrière)
      ctx.save(); rot(hip[0], hip[1]);
      const open = P.cape ? 1 : 0;
      D.blob(ctx, [-1.5, 14.2, -5.2 - open * 3 - sway, 9 + open * 2, -6 - open * 2 - sway, 3.2 - open, -2.6, 4.4, -0.6, 9], D.lin(ctx, 0, 14, 0, 3, c.cape, U.shade(c.cape, -0.25)));
      if (open) D.blob(ctx, [-1.8, 13.4, -6.5 - sway, 9.5, -7 - sway, 3.6, -3.4, 5.2], c.lining, true);
      ctx.restore();
      // bras arrière
      ctx.save(); rot(hip[0], hip[1]);
      const ba = D.limb(ctx, -1.0, 12.4, P.aB, -(P.eB || 0), 3.0, 2.9, 1.4, 1.2, U.shade(c.body, -0.25));
      D.circ(ctx, ba.ex, ba.ey, 0.9, U.shade(c.mask, -0.2));
      ctx.restore();
      // jambe arrière
      const bl = D.limb(ctx, -0.5, hip[1], lB, kB, 3.7, 3.7, 1.6, 1.1, U.shade(c.leg, -0.1));
      D.poly(ctx, [bl.ex - 0.5, bl.ey + 0.3, bl.ex + 2.1, bl.ey - 0.2, bl.ex - 0.3, bl.ey - 0.4], c.leg);
      ctx.save(); rot(hip[0], hip[1]);
      // corps
      D.blob(ctx, [-2.0, 7.4, 1.9, 7.4, 2.5, 10.2, 1.9, 13.4, -1.8, 13.4, -2.4, 10.2], D.shade(ctx, 0, 10.4, 4, c.body));
      // bourgeon-fleur sur la poitrine
      D.ell(ctx, 1.4, 11.6, 1.5, 1.8, -15, c.bud);
      D.ell(ctx, 1.7, 12.6, 0.9, 0.6, -15, '#ffffff', true);
      // tête
      ctx.save(); ctx.translate(0.7, 15.6); ctx.rotate(-(P.hd || 0) * Math.PI / 180);
      // oreilles
      D.poly(ctx, [-1.8, 1.6, -2.6, 5.6, -0.2, 2.4], c.body); D.poly(ctx, [-1.6, 2.2, -2.2, 4.6, -0.8, 2.6], c.lining, true);
      D.poly(ctx, [0.6, 2.2, 1.2, 6.0, 2.4, 2.0], c.body); D.poly(ctx, [0.9, 2.6, 1.3, 5.0, 2.0, 2.3], c.lining, true);
      D.blob(ctx, [-2.4, -1.4, 2.4, -1.4, 3.0, 0.6, 1.8, 2.6, -1.6, 2.6, -2.8, 0.6], D.shade(ctx, 0, 0.5, 2.8, c.body));
      // masque clair autour des yeux
      D.blob(ctx, [-0.3, -1.3, 3.1, -0.6, 3.0, 1.4, 1.2, 1.9, -0.4, 0.8], c.mask, true);
      const ex = P.eye;
      if (ex === 2 || ex === 3) { D.eye(ctx, 1.1, 0.4, 0.75, ex); D.eye(ctx, 2.5, 0.4, 0.62, ex); }
      else {
        D.ell(ctx, 1.1, 0.4, 0.55, 0.8, -8, c.eye); D.ell(ctx, 2.5, 0.4, 0.45, 0.7, 8, c.eye);
        D.circ(ctx, 1.25, 0.4, 0.26, '#111', true); D.circ(ctx, 2.6, 0.4, 0.22, '#111', true);
        if (ex === 1) { ctx.strokeStyle = D.OL; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(0.4, 1.4); ctx.lineTo(1.8, 1.0); ctx.moveTo(2.0, 1.0); ctx.lineTo(3.0, 1.3); ctx.stroke(); }
      }
      ctx.strokeStyle = D.OL; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(2.3, -0.7, 0.5, 0.2, 2.6); ctx.stroke();
      ctx.restore();
      ctx.restore();
      // jambe avant
      const fl = D.limb(ctx, 0.5, hip[1], lF, kF, 3.7, 3.7, 1.7, 1.15, c.leg);
      D.poly(ctx, [fl.ex - 0.5, fl.ey + 0.3, fl.ex + 2.2, fl.ey - 0.2, fl.ex - 0.3, fl.ey - 0.4], c.leg);
      // bras avant
      ctx.save(); rot(hip[0], hip[1]);
      const fa = D.limb(ctx, 1.1, 12.4, P.aF, -(P.eF || 0), 3.0, 2.9, 1.5, 1.25, c.body);
      D.circ(ctx, fa.ex, fa.ey, 0.95, c.mask);
      if (P.glow) { ctx.fillStyle = `rgba(255,140,190,${0.4 + 0.2 * Math.sin(t * 20)})`; ctx.beginPath(); ctx.arc(fa.ex, fa.ey, 2.2, 0, 7); ctx.fill(); }
      ctx.restore();
      ctx.restore();
    },
    fx(e, R) {
      if (e.bloom) {
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 18, max: 18, size: 14, col: '#ff7aa0' });
        for (let i = 0; i < 22; i++) { const a = Math.random() * 6.28, s = 0.8 + Math.random() * 2.5; R.parts.push({ ty: 'petal', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, grav: 0.02, life: 30 + Math.random() * 20, max: 50, size: 1.2 + Math.random(), col: i % 3 ? '#ff6a9a' : '#fff0a0' }); }
        R.cam.shake = Math.max(R.cam.shake, 6);
      }
      const crit = (txt, col) => R.parts.push({ ty: 'custom', x: e.x, y: e.y, life: 45, max: 45, draw(ctx, p, k) {
        ctx.save(); ctx.translate(p.x, p.y + (1 - k) * 10); ctx.scale(0.4, -0.4);
        ctx.font = 'italic 900 15px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1b1226'; ctx.globalAlpha = Math.min(1, k * 2);
        ctx.strokeText(txt, 0, 0); ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore(); ctx.globalAlpha = 1;
      } });
      if (e.flowerCrit) { crit('TOUR DE FLEUR !', '#ff4a7a'); R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 20, max: 20, size: 13, col: '#ff7aa0' }); }
      if (e.bouquet) crit(e.bouquet >= 3 ? 'BOUQUET ×3 !' : 'BOUQUET ×' + e.bouquet, '#ffe066');
      if (e.petals) for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, s = Math.random() * 1.5; R.parts.push({ ty: 'petal', x: e.x, y: e.y + 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s, grav: 0.02, life: 26, max: 26, size: 1.1, col: i % 2 ? '#ff6a9a' : '#7de35a' }); }
    },
  });
})(window.G);
