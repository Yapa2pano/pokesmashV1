'use strict';
// MOUSCOTO — grappler lourd : prises spéciales (Vampipoing qui draine, Prise Colossale), Gonflette (contre qui
// absorbe le coup et charge le prochain), super armure sur les gros coups.
(function (G) {
  const U = G.U, D = G.D, H = G.H, GH = G.GH, A = G.A;
  const ARC = G.ARC, LINE = G.LINE;

  // Vampisuçoir : prise spéciale (B) qui marche en l'air ; il aspire, attrape, puis pique 4 fois
  // (dégâts + PV rendus à chaque piqûre) avant de relâcher avec une éjection.
  function leechGrab(S, a, t) {
    a.grabbing = t.slot; t.grabbedBy = a.slot;
    G.setAction(t, 'thrown'); t.vx = t.vy = t.kbx = t.kby = 0; t.hitstun = 0;
    G.startMove(S, a, 'leech');
    a.vx = 0; a.vy = 0;
    G.sfx(S, a, 'grab');
  }
  function leechTick(S, f, af, inp, M) {
    const v = S.fighters[f.grabbing];
    if (!v || v.grabbedBy !== f.slot) { f.grabbing = -1; G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; }
    if (!f.grounded) { f.vy = 0; f.y -= 0.05; } // vol stationnaire pendant qu'il suce
    if (af === 8 || af === 16 || af === 24 || af === 32) {
      const d = 2.6 * S.dmgMul;
      v.percent = Math.min(999, v.percent + d); v.stat.taken += d; f.stat.dmg += d;
      f.percent = Math.max(0, f.percent - d); f.flash = 5; v.flash = 4;
      S.events.push({ t: 'hit', s: f.slot, tg: v.slot, x: v.x, y: v.y + 8, dmg: d, kb: 10, ht: 'bug', k: 'lk' + f.slot + '_' + S.frame });
      G.sfx(S, f, 'buzz', { drain: 1, tx: v.x, ty: v.y + 8 });
    }
    G.throwTick(S, f, af, inp, M);
  }
  function slamGrab(S, a, t) {
    a.grabbing = t.slot; t.grabbedBy = a.slot;
    G.setAction(t, 'thrown'); t.vx = t.vy = t.kbx = t.kby = 0; t.hitstun = 0;
    G.startMove(S, a, a.grounded ? 'slam' : 'slamAir');
    a.mv.by = a.y;
    G.sfx(S, a, 'grab');
  }
  function slamTick(S, f, af, inp, M) {
    // bond puis écrasement (position gérée à la main)
    const k = af / M.rel;
    if (f.grounded) f.y = f.mv.by + Math.sin(Math.min(1, k) * Math.PI) * 14;
    G.throwTick(S, f, af, inp, M);
    if (af === M.rel) {
      f.y = f.mv.by;
      S.events.push({ t: 'thud', s: f.slot, x: f.x, y: f.y, k: 'sl' + f.slot + '_' + S.frame });
    }
  }
  function lungeTick(S, f, af) {
    if (af >= 8 && af <= 24) f.vx = f.facing * (af < 12 ? 1.6 : 2.3);
    else if (af > 24) f.vx = U.approach(f.vx, 0, 0.15);
    if (!f.grounded && af >= 8 && af <= 24) f.vy = Math.max(f.vy, -0.4);
  }
  function buzzTick(S, f, af, inp) {
    if (af === 6) { f.grounded = false; f.plat = null; G.sfx(S, f, 'buzz'); }
    if (af >= 6 && af <= 28) { f.vy = 2.15; f.vx = U.approach(f.vx, inp.sx * 0.9, 0.1); }
  }
  // Tourbillon Aspirant (A neutre en l'air) : il vrombit sur place et ASPIRE tout ce qui est proche, puis claque des deux bras
  function vortexTick(S, f, af) {
    const st = G.ST(f);
    if (af >= 3 && af <= 15) { f.vy = Math.max(f.vy, -0.35); f.ff = false; G.pull(S, f, f.x, f.y + st.h * 0.55, 28, 1.0); }
    if (af === 3 || af === 9) G.sfx(S, f, 'buzz', { vortex: 1 });
  }
  // Dard (avant + A en l'air) : fonce trompe en avant comme un moustique ; s'il pique, il suce (+PV)
  function dartTick(S, f, af) {
    if (af === 6) { f.vx = f.facing * Math.max(Math.abs(f.vx), 2.6); f.vy = Math.max(f.vy, 0.5); f.ff = false; G.sfx(S, f, 'buzz'); }
    if (af > 6 && af <= 12) f.vy = Math.max(f.vy, 0);
  }
  function flexCounter(S, me, att, hb) {
    me.buff = Math.min(1.6, (me.buff || 1) + 0.35 + (hb.dmg || 0) * 0.012);
    me.v.pumped = 600;
    G.startMove(S, me, 'dspecHit');
    G.sfx(S, me, 'flex');
  }

  G.registerChar({
    id: 'mouscoto', name: 'Mouscoto', short: 'Mouscoto', dex: 794, color: '#e0492f', trail: '#ffb08a',
    desc: 'Grappler poids lourd. B = Vampisuçoir : aspire, attrape (même en l’air) et suce 4 fois (dégâts + PV rendus). Côté B = Prise Colossale. Bas B = Gonflette (contre qui booste le coup suivant).',
    shieldMul: 1.1,
    stats: {
      weight: 128, h: 20, w: 10, walk: 0.95, dash: 1.62, dashF: 13, run: 1.48, runAcc: 0.08, traction: 0.1,
      air: 0.95, airAcc: 0.05, grav: 0.105, fall: 1.72, ffall: 2.7, fullHop: 30, shortHop: 14, dJump: 28, jumps: 2,
      grabRange: 1.35, landLag: 4,
    },
    palettes: [
      { name: 'Normal', mus: '#e0492f', mus2: '#ff8a4a', dark: '#2e2330', wing: 'rgba(255,190,140,0.55)', eye: '#ffffff', beak: '#3a2a35' },
      { name: 'Chromatique', mus: '#4f8a3a', mus2: '#9ad25a', dark: '#1f2a1c', wing: 'rgba(200,255,160,0.5)', eye: '#ffe066', beak: '#1f2a1c' },
      { name: 'Océan', mus: '#2f6fd8', mus2: '#6ab4ff', dark: '#1a1d33', wing: 'rgba(170,220,255,0.55)', eye: '#ffffff', beak: '#1a1d33' },
      { name: 'Rose', mus: '#e24a9a', mus2: '#ff9ad0', dark: '#2e1d2a', wing: 'rgba(255,190,230,0.55)', eye: '#ffffff', beak: '#2e1d2a' },
    ],
    init(f) { f.v.pumped = 0; f.v.flut = 0; f.v.flutId = -2; f.v.jhold = -1; f.v.lastJump = -1; },
    passive(S, f, inp) {
      if (f.v.pumped > 0 && --f.v.pumped === 0) f.buff = 1;
      if (f.buff === 1) f.v.pumped = 0;
      // Battement d'ailes (façon double saut de Yoshi) : maintenir saut pendant un saut = impulsion en plus,
      // une fois par saut (premier ou deuxième) ; après celui du premier saut, le double saut reste dispo.
      const jumpId = Math.max(f.v.jumpF == null ? -1 : f.v.jumpF, f.v.dj == null ? -1 : f.v.dj);
      if (jumpId !== f.v.lastJump) { f.v.lastJump = jumpId; f.v.jhold = jumpId; f.v.flut = 0; }
      const held = inp.held(G.BTN.JMP);
      if (!held) f.v.jhold = -1;
      if (f.grounded) { f.v.flut = 0; return; }
      if (f.hitlag > 0) return;
      if (f.v.flut > 0) {
        if (!held || f.action !== 'air') { f.v.flut = 0; return; }
        f.v.flut--;
        f.vy = U.approach(f.vy, 1.2, 0.22); f.ff = false;
        if (f.v.flut % 7 === 0) G.sfx(S, f, 'buzz', { flut: 1 });
      } else if (f.action === 'air' && held && f.v.jhold === jumpId && jumpId >= 0 && f.v.flutId !== jumpId && f.vy <= 0.5 && S.frame - jumpId < 120) {
        f.v.flutId = jumpId; f.v.flut = 16;
        G.sfx(S, f, 'buzz', { flut: 1 });
      }
    },
    moves: {
      jab: { len: 24, iasa: 22, next: ['jab2', 8, 22], hits: ARC(6, 8, 3, 11, 8, 40, -20, 3, 5, 5, 361, 30, 30), anim: A.jab(6, 7, 24) },
      jab2: { len: 36, hits: ARC(9, 12, 2, 11, 10, 110, -35, 4, 6, 8, 361, 60, 105), anim: A.overhead(5, 9, 11, 36) },
      jab3: { len: 36, hits: [H(9, 11, 10, 8, 6, 7, 361, 55, 100)], anim: A.overhead(5, 9, 11, 36) },
      ftilt: { len: 34, armor: [5, 12, 60], hits: [H(8, 9, -11, 10, 6, 9, 10, 40, 80), H(10, 10, 0, 16, 6, 10, 10, 42, 84), H(11, 13, 13, 10, 7, 12, 10, 45, 88)], anim: [[0, {}], [5, { aF: 90, eF: 0, lean: -10, crouch: 0.2 }], [7, { rot: 0, aF: 90, eF: 0, aB: -80 }], [14, { rot: 360, aF: 90, eF: 0, aB: -80, lean: 10, eye: 1 }], [20, { rot: 360, aF: 80 }], [34, { rot: 360 }]] },
      utilt: { len: 32, hitCancel: 16, armor: [3, 9, 70], hits: ARC(7, 13, 0, 10, 12.5, 20, 160, 5, 6, 11, 88, 40, 105), anim: A.upSwing(8, 12, 32) },
      dtilt: { len: 30, hurtH: 0.7, hitCancel: 16, hits: ARC(9, 11, 2, 1, 10, 60, -5, 3, 5.5, 9, 80, 50, 20, { stun: 32 }), anim: [[0, {}], [7, { lF: 60, kF: 80, lean: -5 }], [9, { lF: 0, kF: 0, crouch: 0.4, eye: 1 }], [30, {}]] },
      dashAtk: { len: 42, keepVel: 1, tick: G.dashAtkTick, armor: [5, 12, 60], hits: ARC(7, 13, 2, 10, 9, 70, -40, 4, 6.5, 12, 50, 60, 80), anim: [[0, { lean: 15 }], [6, { lean: 30, aF: 80, aB: 70, eye: 1 }], [16, { lean: 25 }], [42, {}]] },
      fsmash: { len: 60, charge: 12, armor: [8, 17, 999], hits: ARC(17, 21, 0, 12, 14, 85, -20, 5, 7, 21, 361, 40, 100), anim: A.smashF(12, 18, 20, 60) },
      usmash: { len: 52, charge: 9, hits: ARC(14, 19, 0, 10, 13, 5, 175, 6, 6.5, 18, 90, 38, 100), anim: A.smashU(9, 14, 17, 52) },
      dsmash: { len: 54, charge: 7, hits: [H(14, 15, 7, 2, 6, 17, 35, 35, 95), H(15, 16, 14, 2, 6, 16, 35, 35, 95), H(16, 17, 21, 2, 6, 15, 35, 35, 95), H(14, 15, -7, 2, 6, 17, 145, 35, 95), H(15, 16, -14, 2, 6, 16, 145, 35, 95), H(16, 17, -21, 2, 6, 15, 145, 35, 95)], anim: A.smashD(7, 14, 16, 54) },
      // Tourbillon Aspirant : aspire puis claque (le seul nair qui attire)
      nair: { aerial: 1, len: 42, landLag: 10, ac: [5, 32], tick: vortexTick, hits: [H(4, 14, 0, 10, 8, 1, 361, 0, 0, { t: 'bug', rehit: 4, link: 1, hs: 8, noTrail: 1 }), ...ARC(16, 18, 0, 10, 10, 90, -270, 6, 6.5, 12, 361, 42, 92, { g: 1 })], anim: [[0, {}], [3, { aF: 150, aB: 150, wg: 1, lean: -6 }], [15, { aF: 150, aB: 150, wg: 1, lean: -6 }], [16, { aF: 80, aB: -80, eF: 0, eB: 0, sq: 1.1, eye: 1 }], [24, { aF: 85, aB: -85 }], [42, {}]] },
      // Dard : ruée trompe en avant, draine 3 % s'il pique
      fair: { aerial: 1, len: 40, landLag: 11, ac: [4, 30], tick: dartTick, hits: [H(6, 12, 12, 14, 5.5, 9, 40, 38, 84, { t: 'bug', onHit: (S, a) => { a.percent = Math.max(0, a.percent - 3); a.flash = 4; } }), H(6, 12, 6, 12, 6, 7, 40, 34, 78, { t: 'bug' })], anim: [[0, {}], [5, { hd: -20, lean: -6, wg: 1 }], [6, { hd: 40, beakOut: 1, lean: 32, aF: 20, aB: 10, wg: 1, eye: 1 }], [14, { hd: 35, beakOut: 1, lean: 28, wg: 1 }], [40, {}]] },
      // Coude Colossal : coup de coude arrière en super armure
      bair: { aerial: 1, len: 40, landLag: 12, ac: [4, 30], armor: [4, 11, 70], hits: ARC(9, 12, 0, 10, 11.5, 150, 225, 4, 6.5, 15, 361, 32, 102), anim: A.bair(9, 11, 40) },
      uair: { aerial: 1, len: 38, landLag: 10, ac: [4, 28], hits: ARC(7, 11, 0, 12, 11, 160, 20, 4, 6, 11, 88, 32, 108, { t: 'bug', onHit: (S, a) => { a.percent = Math.max(0, a.percent - 3); a.flash = 4; } }), anim: [[0, {}], [6, { hd: -20, aF: 150, aB: 150 }], [7, { hd: 40, beakOut: 1, lean: -10, aF: 40, aB: 40 }], [14, { hd: 35, beakOut: 1 }], [38, {}]] },
      dair: { aerial: 1, len: 50, landLag: 16, ac: [4, 44], tick: (S, f, af) => { if (af < 6) { f.vy = Math.max(f.vy, 0.3); f.vx *= 0.9; } if (af === 6) { f.vy = -3.4; f.ff = true; } }, onLand: (S, f) => { G.pendingHitbox(S, f, { x: 8, y: 2, r: 7, dmg: 8, ang: 60, bkb: 55, kbg: 60, t: 'normal', g: 3 }); G.pendingHitbox(S, f, { x: -8, y: 2, r: 7, dmg: 8, ang: 60, bkb: 55, kbg: 60, t: 'normal', g: 4 }); S.events.push({ t: 'thud', s: f.slot, x: f.x, y: f.y, k: 'bs' + f.slot + '_' + S.frame }); f.lag = 16; G.setAction(f, 'lag'); }, hits: [H(7, 40, 0, 3, 8, 12, 275, 25, 80)], anim: [[0, {}], [5, { aF: 170, aB: 170, tuck: 0.5 }], [7, { aF: 60, aB: 60, lF: 20, lB: 20, sq: 1.1, eye: 1 }], [50, { aF: 60, aB: 60 }]] },
      nspec: { len: 46, land: 'keep', grav: 0.4, tick: (S, f, af) => { if (af === 3) G.sfx(S, f, 'buzz'); if (!f.grounded && af < 20) f.vy = Math.max(f.vy, -0.4); }, hits: [H(4, 9, 13, 10, 9, 0.5, 361, 0, 0, { t: 'bug', link: 1, hs: 12, noTrail: 1, g: 1 }), GH(8, 14, 11, 10, 7, { air: true })], onGrab: leechGrab, anim: [[0, {}], [3, { hd: -20, lean: -8, wg: 1 }], [8, { hd: 25, lean: 16, beakOut: 1, wg: 1, eye: 1 }], [16, { hd: 20, lean: 12, beakOut: 1 }], [46, {}]] },
      leech: { throw: 1, phys: 'none', len: 52, rel: 40, dmg: 3, ang: 40, bkb: 62, kbg: 58, t: 'bug', tick: leechTick, hold: [[0, 0.9, 0.35], [40, 0.9, 0.35], [44, 1.2, 0.3]], anim: [[0, { hd: 25, beakOut: 1, aF: 120, aB: 110, wg: 1 }], [8, { hd: 35, beakOut: 1, aF: 125, aB: 115, wg: 1, sq: 1.05 }], [12, { hd: 25, beakOut: 1, aF: 120 }], [16, { hd: 35, beakOut: 1, sq: 1.05 }], [24, { hd: 35, beakOut: 1, sq: 1.05 }], [32, { hd: 35, beakOut: 1, sq: 1.05 }], [40, { hd: 0, aF: 60, aB: 60, lean: 14, eye: 1 }], [52, {}]] },
      sspec: { len: 50, keepVel: 1, offEdge: 1, land: 'keep', tick: lungeTick, drift: 0, hits: [GH(8, 24, 9, 10, 6.5)], onGrab: slamGrab, anim: [[0, { crouch: 0.3 }], [8, { lean: 25, aF: 95, aB: 85, eF: 0, eye: 1 }], [24, { lean: 25, aF: 95, aB: 85 }], [50, {}]] },
      slam: { throw: 1, phys: 'none', len: 46, rel: 26, dmg: 16, ang: 70, bkb: 70, kbg: 70, tick: slamTick, hold: [[0, 0.9, 0.4], [12, 0.2, 1.2], [22, 0.6, 1.0], [26, 1.0, -0.1]], anim: [[0, { aF: 150, aB: 150 }], [14, { aF: 175, aB: 175, sq: 1.1 }], [24, { aF: 175, aB: 175 }], [27, { aF: 60, aB: 60, crouch: 0.6, eye: 1 }], [46, {}]] },
      slamAir: { throw: 1, phys: 'none', len: 34, rel: 14, dmg: 11, ang: 285, bkb: 50, kbg: 60, hold: [[0, 0.9, 0.4], [14, 0.5, -0.6]], anim: [[0, { aF: 150, aB: 150 }], [14, { aF: 30, aB: 30, eye: 1 }], [34, {}]], end: (S, f) => { f.vy = 1.5; } },
      uspec: { len: 50, helpless: 1, landLag: 24, ledge: 16, tick: buzzTick, drift: 0, noGrav: (af) => af >= 6 && af <= 28, hits: [H(6, 26, 2, 12, 8, 1.5, 90, 0, 0, { t: 'bug', rehit: 5, link: 1, hs: 10 }), H(29, 31, 4, 18, 8, 6, 80, 60, 90, { g: 1 })], anim: [[0, { crouch: 0.4 }], [6, { aF: 160, aB: 160, wg: 1 }], [28, { aF: 160, aB: 160, wg: 1 }], [30, { aF: 180, aB: 60, wg: 1 }], [50, {}]] },
      dspec: { len: 46, counter: [5, 28], onCounter: flexCounter, anim: [[0, {}], [5, { aF: 160, aB: 160, eF: 120, eB: 120, crouch: 0.2, eye: 1, flex: 1 }], [28, { aF: 160, aB: 160, eF: 120, eB: 120, flex: 1 }], [46, {}]] },
      dspecHit: { len: 22, intang: [1, 10], anim: [[0, { aF: 165, aB: 165, eF: 130, eB: 130, flex: 1, glow: 1, eye: 1 }], [22, { aF: 160, aB: 160, flex: 1 }]] },
      grab: { len: 34, hits: [GH(8, 9, 12, 10, 6.5)], anim: A.grab(8, 9, 34) },
      dashgrab: { len: 42, keepVel: 1, traction: 1.6, hits: [GH(11, 12, 14, 10, 7)], anim: A.grab(11, 12, 42) },
      fthrow: { throw: 1, len: 34, rel: 14, dmg: 10, ang: 40, bkb: 65, kbg: 65, hold: [[0, 1, 0], [12, 1.6, 0.4]], anim: A.throwF },
      bthrow: { throw: 1, back: 1, len: 44, rel: 20, dmg: 12, ang: 42, bkb: 62, kbg: 86, hold: [[0, 1, 0], [10, 0, 1.2], [20, -1.4, 0.1]], anim: A.throwB },
      uthrow: { throw: 1, len: 42, rel: 20, dmg: 7, ang: 90, bkb: 60, kbg: 82, hitFrame: 16, hitDmg: 4, hold: [[0, 1, 0], [12, 0.3, 1.4], [20, 0.3, 1.8]], anim: A.throwU },
      dthrow: { throw: 1, len: 42, rel: 22, dmg: 9, ang: 75, bkb: 75, kbg: 45, hold: [[0, 1, 0], [18, 0.9, -0.2]], anim: A.throwD },
      taunt: { len: 80, anim: [[0, {}], [12, { aF: 160, aB: 160, eF: 120, eB: 120, flex: 1, eye: 3 }], [60, { aF: 160, aB: 160, eF: 130, eB: 130, flex: 1, eye: 3 }], [80, {}]] },
    },
    pose(P, f, S) {
      if (f.buff > 1) P.pump = 1;
      if (f.v.flut > 0 && f.action === 'air') { P.wg = 1; P.lF = 30 + Math.sin(S.frame * 1.3) * 28; P.lB = -P.lF; P.kF = 40; P.kB = 40; P.aF = 150; P.aB = 150; P.eye = 1; }
    },
    draw(ctx, P, c, f, S, t) {
      const cr = P.crouch || 0, tu = P.tuck || 0;
      ctx.save();
      ctx.scale(1 + cr * 0.08, 1 - cr * 0.28);
      const hip = [0, 7.2];
      const rot = (x, y) => { ctx.translate(x, y); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-x, -y); };
      const lF = U.lerp(P.lF, 70, tu), lB = U.lerp(P.lB, 50, tu), kF = U.lerp(P.kF, 110, tu), kB = U.lerp(P.kB, 110, tu);
      const flex = P.flex ? 1 : 0;
      const arm = (sx, sy, a, e, col, col2, front) => {
        const L = D.limb(ctx, sx, sy, a, -(e || 0), 3.4, 0.1, 2.6, 2.6, col);
        // avant-bras géant (poche de muscle)
        const [dx, dy] = D.dir(a - (e || 0));
        const mx = L.jx + dx * 3.4, my = L.jy + dy * 3.4;
        const rr = 3.3 + flex * 0.6 + (P.pump ? 0.35 : 0);
        ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.atan2(dy, dx));
        D.ell(ctx, 0, 0, rr * 1.35, rr, 0, D.shade(ctx, 0, 0, rr * 1.3, col));
        ctx.strokeStyle = U.shade(col, -0.3); ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(-0.4, 0, rr * 0.7, -1.1, 1.1); ctx.stroke();
        D.shine(ctx, 0.4, rr * 0.45, rr * 0.6, rr * 0.25, 0.35);
        // main noire griffue
        D.ell(ctx, rr * 1.35 + 0.8, 0, 1.2, 1.0, 0, c.dark);
        ctx.restore();
        return L;
      };
      // ailes (arrière)
      ctx.save(); rot(hip[0], hip[1]);
      const buzz = (!f.grounded || P.wg) ? Math.sin(t * 90) * 0.35 : 0;
      for (let i = 0; i < 2; i++) {
        ctx.save(); ctx.translate(-2.2, 13.5 - i * 2.2); ctx.rotate(0.6 + i * 0.5 + buzz);
        D.ell(ctx, -4.5, 0, 5.2, 1.7, 0, c.wing); ctx.restore();
      }
      arm(-2.2, 13.5, P.aB, P.eB, U.shade(c.mus, -0.22), c.mus2);
      ctx.restore();
      // jambe arrière (insecte)
      const bl = D.limb(ctx, -0.8, hip[1], lB, kB, 3.8, 3.8, 1.3, 0.8, c.dark);
      D.seg(ctx, bl.ex, bl.ey, bl.ex + 1.4, bl.ey - 0.2, 0.7, c.dark);
      ctx.save(); rot(hip[0], hip[1]);
      // abdomen
      D.ell(ctx, -1.2, 7.4, 3.2, 2.3, 15, D.shade(ctx, -1.2, 7.4, 3, c.dark));
      // torse en V
      D.blob(ctx, [-2.4, 8.2, 2.2, 8.2, 4.2, 12.5, 3.4, 15.2, -3.6, 15.2, -4.0, 12.2], D.shade(ctx, 0, 12, 5, c.mus));
      D.ell(ctx, 1.2, 13.1, 2.0, 1.5, -10, c.mus2, true);
      D.ell(ctx, -1.4, 13.1, 1.6, 1.4, 10, U.shade(c.mus2, -0.1), true);
      ctx.strokeStyle = U.shade(c.mus, -0.35); ctx.lineWidth = 0.3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-1, 11.2 - i * 1.0); ctx.lineTo(1.2, 11.2 - i * 1.0); ctx.stroke(); }
      // tête + trompe
      ctx.save(); ctx.translate(0.8, 17.0); ctx.rotate(-(P.hd || 0) * Math.PI / 180);
      const bo = P.beakOut ? 3 : 0;
      D.seg(ctx, 1.6, -0.6, 3.6 + bo, -3.2 + bo * 0.4, 0.8, c.beak, 0.35);
      D.blob(ctx, [-2.4, -1.2, 2.4, -1.2, 2.6, 1.2, 0.8, 2.8, -1.4, 2.6, -2.8, 0.8], D.shade(ctx, 0, 0.5, 2.8, c.mus));
      D.ell(ctx, -0.3, 2.4, 1.5, 0.6, 0, c.mus2, true);
      if (P.eye === 2 || P.eye === 3) { D.eye(ctx, 1.1, 0.4, 0.6, P.eye); }
      else { D.ell(ctx, 1.1, 0.4, 0.62, 0.72, 0, c.eye); D.circ(ctx, 1.3, 0.4, 0.3, '#111', true); if (P.eye === 1) { ctx.strokeStyle = D.OL; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(0.2, 1.4); ctx.lineTo(1.9, 0.9); ctx.stroke(); } }
      ctx.restore();
      ctx.restore();
      // jambe avant
      const fl = D.limb(ctx, 0.8, hip[1], lF, kF, 3.8, 3.8, 1.4, 0.85, U.shade(c.dark, 0.1));
      D.seg(ctx, fl.ex, fl.ey, fl.ex + 1.5, fl.ey - 0.2, 0.75, c.dark);
      // bras avant
      ctx.save(); rot(hip[0], hip[1]);
      arm(2.8, 13.5, P.aF, P.eF, c.mus, c.mus2, 1);
      ctx.restore();
      ctx.restore();
    },
    drawFx(ctx, f, S, t) {
      if (f.buff > 1) {
        const st = G.ST(f);
        ctx.strokeStyle = `rgba(255,80,40,${0.35 + 0.25 * Math.sin(t * 12)})`; ctx.lineWidth = 0.6;
        for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.1; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 3, f.y + st.h * 0.5 + Math.sin(a * 1.3) * 5, 1.2, 0, 7); ctx.stroke(); }
      }
    },
    fx(e, R) {
      if (e.flut) for (let i = 0; i < 4; i++) R.parts.push({ ty: 'smoke', x: e.x + (Math.random() - 0.5) * 10, y: e.y + 12 + Math.random() * 4, vx: (Math.random() - 0.5) * 0.6, vy: -0.4, life: 14, max: 14, size: 1.2, col: 'rgba(255,220,190,0.6)' });
      if (e.vortex) for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28, d = 14 + Math.random() * 10; R.parts.push({ ty: 'smoke', x: e.x + Math.cos(a) * d, y: e.y + 11 + Math.sin(a) * d, vx: -Math.cos(a) * 1.4, vy: -Math.sin(a) * 1.4, life: 12, max: 12, size: 0.9, col: 'rgba(255,220,190,0.55)' }); }
      if (e.drain) for (let i = 0; i < 10; i++) R.parts.push({ ty: 'flame', x: e.tx + (Math.random() - 0.5) * 6, y: e.ty + (Math.random() - 0.5) * 6, vx: (e.x - e.tx) * 0.06, vy: 0.2, life: 20, max: 20, size: 1.2, col: 'rgba(255,60,80,0.8)' });
    },
    hud(ctx, f, S, x, y, pw, ph, u) {
      if (f.buff > 1) { ctx.fillStyle = '#ff6a3a'; ctx.font = `900 ${10 * u}px Rubik, sans-serif`; ctx.textAlign = 'left'; ctx.fillText('GONFLÉ ×' + f.buff.toFixed(2), x + ph + 2 * u, y + 43 * u); }
    },
  });
})(window.G);
