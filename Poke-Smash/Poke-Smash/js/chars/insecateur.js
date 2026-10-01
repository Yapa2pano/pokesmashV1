'use strict';
// INSÉCATEUR / CIZAYOX — duo façon Pyra/Mythra, bas B pour changer de forme (même en l'air).
// Insécateur : rapide, dashs (Vive-Attaque ×2), Tranche Montante chargeable (éjecte vers le haut), combos.
// Cizayox : lourd, grosses patates, Pisto-Poing (jab ultra rapide), Pince Titan chargeable et stockable.
(function (G) {
  const U = G.U, D = G.D, H = G.H, A = G.A;
  const S_ = (o) => Object.assign({ t: 'blade' }, o || {});
  const St = (o) => Object.assign({ t: 'steel' }, o || {});

  function swapTick(S, f, af) {
    if (af === 5) {
      f.v.form = f.v.form === 'ciz' ? null : 'ciz';
      f.flash = 10;
      G.sfx(S, f, 'transform', { swap: 1 });
    }
  }
  const swapMove = { len: 16, iasa: 12, intang: [3, 8], land: 'keep', tick: swapTick, cond: (S, f) => (f.v.swapCd || 0) <= 0, start: (S, f) => { f.v.swapCd = 18; }, anim: [[0, {}], [4, { aF: 170, aB: 170, crouch: 0.3, glow: 1 }], [8, { aF: 120, aB: 120, glow: 1 }], [16, {}]] };

  // Coup chargé façon Donkey Kong (les deux formes) : B = on charge (ça continue tout seul), B à nouveau = on frappe,
  // bouclier / saut pendant la charge = charge stockée ; charge pleine = stockée automatiquement.
  // (nerf : charge plus longue, moins de dégâts/éjection, élan réduit, plus de lag, armure de Cizayox limitée)
  const CHG = G.INS_CHG = {
    ins: { max: 100, store: 'storeI' },  // Tranche Montante : cisaille qui remonte, éjection vers le haut
    ciz: { max: 110, store: 'storeC' },  // Pince Titan : gros poing, éjection vers le côté
  };
  function chargeTick(kind) {
    const P = CHG[kind];
    return (S, f, af) => {
      const st = G.ST(f);
      if (af === 1) { f.mv.c = f.v[P.store] || 0; f.v[P.store] = 0; f.mv.go = f.mv.c >= P.max ? 1 : 0; }
      if (af === 8 && !f.mv.go) {
        if (f.buf.s || f.buf.j) { f.buf.s = 0; f.v[P.store] = f.mv.c; G.sfx(S, f, 'shield'); G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; }
        if (f.buf.b) { f.buf.b = 0; f.mv.go = 1; }
        else {
          f.mv.c++;
          if (f.mv.c % 20 === 0) G.sfx(S, f, 'bowDraw');
          if (f.mv.c >= P.max) { f.v[P.store] = P.max; f.flash = 8; G.sfx(S, f, 'magic', { full: 1 }); G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; }
          f.af = 7;
          if (!f.grounded) f.vy = Math.max(f.vy, -0.6);
          return;
        }
      }
      const k = Math.min(1, f.mv.c / P.max), full = k >= 0.99;
      if (kind === 'ins') {
        if (af === 9) {
          f.vx = f.facing * (0.9 + k * 1.5);
          if (full && f.grounded) { f.grounded = false; f.plat = null; f.vy = 2.0; }
          G.sfx(S, f, full ? 'swingBig' : 'slash', full ? { slashFull: 1 } : null);
        }
        if (af >= 10 && af <= 15) {
          const t = af - 10; // arc qui remonte devant soi
          G.pendingHitbox(S, f, { x: 10 - t * 0.6, y: st.h * 0.3 + t * 2.6, r: 5.5 + k * 1.5, dmg: 6 + k * 9, ang: 82, bkb: 32 + k * 16, kbg: 66 + k * 22, t: 'blade' });
        }
      } else {
        if (af === 9) { f.vx = f.facing * (1.1 + k * 1.7); G.sfx(S, f, full ? 'hammer' : 'swingBig', full ? { boom: 1, x: f.x + f.facing * 12, y: f.y + st.h * 0.55 } : null); }
        if (af >= 10 && af <= 14) G.pendingHitbox(S, f, { x: 11, y: st.h * 0.55, r: 6 + k * 2, dmg: 7 + k * 11, ang: 32, bkb: 34 + k * 14, kbg: 70 + k * 22, t: 'steel' });
      }
      if (af > 15) f.vx = U.approach(f.vx, 0, 0.2);
    };
  }
  const chargeMove = (kind) => ({
    len: 44, iasa: 36, land: 'keep', grav: 0.5, tick: chargeTick(kind), armor: kind === 'ciz' ? [9, 14, 70] : [9, 14, 40],
    anim: kind === 'ins'
      ? [[0, {}], [7, { aF: -120, aB: -90, lean: -12, crouch: 0.3, glow: 1, eye: 1 }], [8, { aF: -120, aB: -90, lean: -12, crouch: 0.3, glow: 1, eye: 1 }], [10, { aF: 40, aB: -40, lean: 8 }], [14, { aF: 180, aB: 130, lean: -10, eye: 1 }], [20, { aF: 170, aB: 120 }], [38, {}]]
      : [[0, {}], [7, { aF: -95, eF: 60, lean: -14, glow: 1, eye: 1 }], [8, { aF: -95, eF: 60, lean: -14, glow: 1, eye: 1 }], [10, { aF: 95, eF: 0, lean: 24, eye: 1 }], [18, { aF: 92, lean: 18 }], [38, {}]],
  });

  function quickTick(S, f, af, inp, M) {
    const st = G.ST(f);
    if (af === 1 && !f.grounded && M.first) { if (f.v.qa) { G.setAction(f, 'air'); return 'stop'; } f.v.qa = 1; }
    if (af === 4) {
      const m = U.len(inp.sx, inp.sy);
      if (m > 0.3) { f.mv.dx = inp.sx / m; f.mv.dy = inp.sy / m; } else { f.mv.dx = f.facing; f.mv.dy = 0; }
      if (f.grounded && f.mv.dy < 0) f.mv.dy = 0;
      if (f.mv.dx) f.facing = f.mv.dx > 0 ? 1 : -1;
      if (f.mv.dy > 0.2) { f.grounded = false; f.plat = null; }
      G.sfx(S, f, 'dash');
    }
    if (af >= 4 && af <= 12) { f.vx = f.mv.dx * 4.6; f.vy = f.mv.dy * 4.6; }
    if (af === 13) { f.vx *= 0.35; f.vy *= 0.3; }
    void st;
  }

  function ironTick(S, f, af) {
    if (af === 1 && !f.grounded) { if (f.v.ih) { G.setAction(f, 'air'); return 'stop'; } f.v.ih = 1; }
    if (af >= 8 && af <= 22) { f.vx = f.facing * 3.1; if (!f.grounded) f.vy = Math.max(f.vy, af < 16 ? 0.2 : -0.5); }
    if (af === 8) G.sfx(S, f, 'dash');
    if (af > 22) f.vx = U.approach(f.vx, 0, 0.2);
  }
  function meteorTick(S, f, af, inp) {
    if (af === 4) { f.grounded = false; f.plat = null; G.sfx(S, f, 'swingBig'); }
    if (af >= 4 && af <= 20) { f.vy = 3.1 - (af - 4) * 0.06; f.vx = U.approach(f.vx, inp.sx * 0.9, 0.1); }
  }

  G.registerChar({
    id: 'insecateur', name: 'Insécateur / Cizayox', short: 'Insécateur', dex: 123, formDex: { ciz: 212 }, color: '#6ac24a', trail: '#eaffd0',
    desc: 'Duo : bas B pour changer. B = coup chargé façon DK (B pour charger, B pour frapper, bouclier pour stocker) : Tranche Montante (Insécateur, éjecte vers le haut) / Pince Titan (Cizayox, éjecte sur le côté).',
    nameFor: (f) => (f.v.form === 'ciz' ? 'Cizayox' : 'Insécateur'),
    stats: {
      weight: 88, h: 18, w: 8, walk: 1.3, dash: 2.3, dashF: 12, run: 2.35, runAcc: 0.13, traction: 0.1,
      air: 1.2, airAcc: 0.085, grav: 0.098, fall: 1.8, ffall: 2.85, fullHop: 35, shortHop: 16, dJump: 33,
    },
    formStats: {
      ciz: { weight: 116, h: 18, w: 8.5, walk: 1.0, dash: 1.72, run: 1.62, runAcc: 0.09, traction: 0.11, air: 0.96, airAcc: 0.06, grav: 0.108, fall: 1.85, ffall: 2.9, fullHop: 30, shortHop: 14, dJump: 28 },
    },
    palettes: [
      { name: 'Normal', body: '#6ac24a', belly: '#f2e6a8', blade: '#eef2f7', eye: '#1b1226', wing: 'rgba(240,250,255,0.55)', ciz: '#d8202a', ciz2: '#8a1418', metal: '#b8bcc8', cizEye: '#ffd23a' },
      { name: 'Chromatique', body: '#c8d84a', belly: '#fff3c0', blade: '#f7f2e6', eye: '#1b1226', wing: 'rgba(255,255,220,0.55)', ciz: '#6ad84a', ciz2: '#2f7a22', metal: '#c8ccd8', cizEye: '#ffe066' },
      { name: 'Acier bleu', body: '#4ab4c2', belly: '#e0f6ff', blade: '#ffffff', eye: '#1b1226', wing: 'rgba(210,240,255,0.55)', ciz: '#2a5ad8', ciz2: '#16307a', metal: '#d0d8e8', cizEye: '#7af0ff' },
      { name: 'Doré', body: '#d8a83a', belly: '#fff1c8', blade: '#fff8e0', eye: '#1b1226', wing: 'rgba(255,240,200,0.55)', ciz: '#f2c14a', ciz2: '#9a6a12', metal: '#fff0b0', cizEye: '#ff5a3a' },
    ],
    init(f) { f.v.form = null; f.v.swapCd = 0; f.v.storeI = 0; f.v.storeC = 0; },
    passive(S, f) {
      if (f.v.swapCd > 0) f.v.swapCd--;
      if (f.grounded || f.action === 'ledge') { f.v.qa = 0; f.v.ih = 0; }
    },
    moves: {
      // ---------- INSÉCATEUR ----------
      jab: { len: 14, iasa: 12, next: ['jab2', 3, 12], hits: [H(2, 3, 9, 10, 4, 2, 361, 20, 20, S_())], anim: A.jab(2, 3, 14) },
      jab2: { len: 15, next: ['jab3', 4, 13], hits: [H(3, 4, 9.5, 10, 4, 2, 361, 22, 20, S_())], anim: A.jab2(3, 4, 15) },
      jab3: { len: 32, hits: [H(4, 20, 10, 10, 6, 0.9, 361, 0, 0, S_({ rehit: 3, link: 1, hs: 8 })), H(24, 25, 11, 10, 7, 3.5, 361, 55, 105, S_({ g: 1 }))], anim: [[0, {}], [4, { aF: 100, aB: 60 }], [7, { aF: 60, aB: 105 }], [10, { aF: 105, aB: 60 }], [13, { aF: 60, aB: 105 }], [16, { aF: 105, aB: 60 }], [20, { aF: 60, aB: 105 }], [23, { aF: -30 }], [24, { aF: 110, lean: 14, eye: 1 }], [32, {}]] },
      ftilt: { len: 26, hitCancel: 16, hits: [H(6, 7, 11, 10, 5.5, 4, 50, 30, 25, S_()), H(11, 12, 12, 9, 6, 6, 40, 38, 80, S_({ g: 1 }))], anim: [[0, {}], [5, { aF: 170 }], [6, { aF: 70, lean: 12 }], [10, { aB: 170 }], [11, { aB: 70, aF: 100, lean: 14 }], [26, {}]] },
      utilt: { len: 24, hitCancel: 13, hits: [H(5, 10, 2, 20, 7, 7, 95, 45, 70, S_())], anim: A.upSwing(5, 10, 24) },
      dtilt: { len: 20, hurtH: 0.6, hitCancel: 10, hits: [H(5, 6, 12, 2, 4.5, 6, 80, 55, 40, S_())], anim: A.lowPoke(5, 6, 20) },
      dashAtk: { len: 34, keepVel: 1, tick: G.dashAtkTick, hitCancel: 20, hits: [H(6, 12, 9, 9, 6, 9, 45, 50, 62, S_())], anim: A.dashAtk(6, 12, 34) },
      fsmash: { len: 48, charge: 9, hits: [H(13, 14, 13, 10, 7, 6, 45, 40, 20, S_()), H(18, 20, 14, 9, 8, 13, 361, 38, 98, S_({ g: 1 }))], anim: [[0, {}], [9, { aF: 180, aB: 180, lean: -10, eye: 1 }], [13, { aF: 60, aB: 180, lean: 12 }], [18, { aF: 60, aB: 60, lean: 16, eye: 1 }], [48, {}]] },
      usmash: { len: 44, charge: 7, hits: [H(9, 16, 2, 18, 7.5, 1.6, 90, 0, 0, S_({ rehit: 3, link: 1, hs: 8 })), H(18, 20, 1, 24, 8, 8, 88, 45, 100, S_({ g: 1 }))], anim: A.smashU(7, 12, 20, 44) },
      dsmash: { len: 44, charge: 5, hits: [H(9, 10, 12, 3, 5.5, 12, 30, 32, 94, S_()), H(12, 13, -12, 3, 5.5, 12, 150, 32, 94, S_({ g: 1 }))], anim: A.smashD(5, 9, 13, 44) },
      nair: { aerial: 1, len: 34, landLag: 7, ac: [4, 26], hits: [H(4, 7, 0, 9, 9, 7, 361, 30, 80, S_()), H(8, 16, 0, 9, 8, 4, 361, 25, 70, S_())], anim: A.spinArms(4, 16, 34) },
      fair: { aerial: 1, len: 34, landLag: 8, ac: [3, 26], hits: [H(6, 7, 10, 10, 6, 4, 65, 30, 20, S_()), H(10, 12, 11, 9, 6.5, 6, 45, 35, 85, S_({ g: 1 }))], anim: [[0, {}], [5, { aF: 170, aB: 170 }], [6, { aF: 60, aB: 170, lean: 10 }], [10, { aB: 60, lean: 14, eye: 1 }], [34, {}]] },
      bair: { aerial: 1, len: 34, landLag: 9, ac: [4, 26], hits: [H(7, 9, -11, 9, 6.2, 12, 361, 32, 100, S_())], anim: [[0, {}], [6, { aB: 90 }], [7, { aB: -110, lean: -12, eye: 1 }], [12, { aB: -100 }], [34, {}]] },
      uair: { aerial: 1, len: 30, landLag: 7, ac: [3, 22], hits: [H(5, 9, 0, 21, 7, 7, 85, 42, 80, S_())], anim: A.uairSwipe(5, 9, 30) },
      dair: { aerial: 1, len: 38, landLag: 11, ac: [4, 30], hits: [H(9, 11, 2, -1, 6, 10, 280, 28, 80, S_({ onHit: (S, a) => { a.vy = 2.2; a.ff = false; } })), H(12, 18, 2, 0, 5.5, 7, 60, 35, 60, S_())], anim: A.dairSwing(9, 11, 38) },
      nspec: chargeMove('ins'),
      sspec: { first: 1, len: 32, tick: quickTick, keepVel: 1, offEdge: 1, land: 'keep', drift: 0, noGrav: (af) => af >= 4 && af <= 13, nextB: ['sspec2', 13, 24], ledge: 12, ledgeRising: 1, hits: [H(4, 12, 3, 9, 6, 6, 50, 50, 50, S_())], anim: [[0, { crouch: 0.4 }], [4, { lean: 40, aF: -60, aB: -70 }], [13, { lean: 30, aF: -60, aB: -70 }], [32, {}]] },
      sspec2: { len: 34, tick: quickTick, keepVel: 1, offEdge: 1, land: 'keep', drift: 0, noGrav: (af) => af >= 4 && af <= 13, helpless: 1, landLag: 12, ledge: 12, ledgeRising: 1, hits: [H(4, 12, 3, 9, 6, 7, 50, 60, 70, S_())], anim: [[0, { crouch: 0.4 }], [4, { lean: 40, aF: -60, aB: -70 }], [13, { lean: 30, aF: -60, aB: -70 }], [34, {}]] },
      uspec: { len: 44, helpless: 1, landLag: 18, ledge: 14, tick: (S, f, af, inp) => { if (af === 5) { f.grounded = false; f.plat = null; G.sfx(S, f, 'slash'); } if (af >= 5 && af <= 22) { f.vy = 3.0 - (af - 5) * 0.04; f.vx = U.approach(f.vx, inp.sx * 1.1, 0.12); } }, drift: 0, noGrav: (af) => af >= 5 && af <= 22,
        hits: [H(5, 20, 0, 11, 8.5, 1.6, 90, 0, 0, S_({ rehit: 4, link: 1, hs: 10 })), H(23, 25, 0, 17, 9, 6, 80, 60, 100, S_({ g: 1 }))], anim: [[0, { crouch: 0.4 }], [5, { aF: 175, aB: 175, wg: 1 }], [22, { aF: 175, aB: 175, wg: 1 }], [25, { aF: 60, aB: 60 }], [44, {}]] },
      dspec: swapMove,
      fthrow: { throw: 1, len: 28, rel: 10, dmg: 7, ang: 45, bkb: 62, kbg: 58, t: 'blade', hold: [[0, 1, 0], [9, 1.4, 0.2]], anim: A.throwF },
      bthrow: { throw: 1, back: 1, len: 34, rel: 15, dmg: 9, ang: 42, bkb: 60, kbg: 72, hold: [[0, 1, 0], [8, 0, 0.9], [15, -1.5, 0.3]], anim: A.throwB },
      uthrow: { throw: 1, len: 32, rel: 13, dmg: 6, ang: 90, bkb: 70, kbg: 55, hold: [[0, 1, 0], [11, 0.2, 1.3]], anim: A.throwU },
      dthrow: { throw: 1, len: 32, rel: 15, dmg: 5, ang: 78, bkb: 70, kbg: 35, hold: [[0, 1, 0], [12, 0.9, -0.1]], anim: A.throwD },
      // ---------- CIZAYOX ----------
      'ciz:jab': { len: 13, iasa: 11, next: ['jab2', 3, 11], hits: [H(2, 3, 9, 10, 4.5, 3.5, 361, 25, 25, St())], anim: A.jab(2, 3, 13) },
      'ciz:jab2': { len: 14, next: ['jab3', 3, 12], hits: [H(3, 4, 9.5, 10, 4.5, 3.5, 361, 25, 25, St())], anim: A.jab2(3, 4, 14) },
      'ciz:jab3': { len: 30, hits: [H(5, 6, 11, 10, 6.5, 7, 361, 50, 96, St())], anim: A.punch(5, 6, 30) },
      'ciz:ftilt': { len: 32, hits: [H(9, 11, 13, 10, 6.5, 13, 361, 35, 96, St()), H(9, 11, 7, 10, 5, 11, 361, 32, 92, St())], anim: A.punch(9, 11, 32) },
      'ciz:utilt': { len: 32, hits: [H(8, 12, 4, 20, 7.5, 12, 88, 40, 100, St())], anim: A.upSwing(8, 12, 32) },
      'ciz:dtilt': { len: 26, hurtH: 0.62, hits: [H(7, 9, 12, 2, 5.5, 10, 70, 55, 60, St())], anim: A.lowPoke(7, 9, 26) },
      'ciz:dashAtk': { len: 40, keepVel: 1, tick: G.dashAtkTick, hits: [H(7, 13, 9, 10, 6.5, 13, 45, 50, 88, St())], anim: A.dashAtk(7, 13, 40) },
      'ciz:fsmash': { len: 58, charge: 12, hits: [H(18, 20, 14, 10, 8.5, 22, 361, 40, 102, St()), H(18, 20, 7, 10, 5.5, 18, 361, 38, 96, St())], anim: A.smashF(12, 18, 20, 58) },
      'ciz:usmash': { len: 52, charge: 9, hits: [H(14, 17, 3, 22, 8.5, 19, 90, 38, 102, St())], anim: A.smashU(9, 14, 17, 52) },
      'ciz:dsmash': { len: 52, charge: 7, hits: [H(14, 16, 13, 3, 6.5, 18, 32, 34, 98, St()), H(14, 16, -13, 3, 6.5, 18, 148, 34, 98, St())], anim: A.smashD(7, 14, 16, 52) },
      'ciz:nair': { aerial: 1, len: 40, landLag: 10, ac: [5, 30], hits: [H(7, 10, 0, 9, 9.5, 12, 361, 32, 92, St()), H(11, 18, 0, 9, 8.5, 8, 361, 25, 85, St())], anim: A.spinArms(7, 18, 40) },
      'ciz:fair': { aerial: 1, len: 44, landLag: 14, ac: [4, 34], hits: [H(12, 15, 10, 8, 7, 15, 50, 35, 100, St())], anim: A.overhead(6, 12, 15, 44) },
      'ciz:bair': { aerial: 1, len: 40, landLag: 12, ac: [4, 30], hits: [H(9, 11, -11, 9, 6.5, 16, 361, 34, 100, St())], anim: A.bair(9, 11, 40) },
      'ciz:uair': { aerial: 1, len: 38, landLag: 10, ac: [4, 28], hits: [H(7, 10, 2, 21, 7, 13, 85, 34, 108, St())], anim: A.upSwing(7, 10, 38) },
      'ciz:dair': { aerial: 1, len: 50, landLag: 20, ac: [4, 42], hits: [H(15, 18, 0, -1, 6.5, 16, 270, 25, 92, St()), H(19, 25, 0, 0, 5.5, 10, 60, 35, 70, St())], anim: A.dairSwing(15, 18, 50) },
      'ciz:nspec': chargeMove('ciz'),
      'ciz:sspec': { len: 44, tick: ironTick, keepVel: 1, offEdge: 1, land: 'keep', drift: 0, armor: [8, 22, 70], ledge: 20, hits: [H(8, 22, 5, 12, 6.5, 14, 40, 50, 90, St())], anim: [[0, { crouch: 0.4 }], [8, { lean: 45, hd: 20, eye: 1 }], [22, { lean: 40, hd: 20 }], [44, {}]] },
      'ciz:uspec': { len: 44, helpless: 1, landLag: 22, ledge: 12, tick: meteorTick, drift: 0, noGrav: (af) => af >= 4 && af <= 20, hits: [H(4, 8, 5, 12, 7, 13, 85, 65, 100, St()), H(9, 20, 3, 16, 6, 6, 80, 55, 80, St())], anim: [[0, { crouch: 0.5 }], [4, { aF: 175, aB: 10, sq: 1.1, eye: 1 }], [20, { aF: 175 }], [44, {}]] },
      'ciz:dspec': swapMove,
      'ciz:grab': { len: 34, hits: [G.GH(8, 9, 10, 10, 5.5)], anim: A.grab(8, 9, 34) },
      'ciz:fthrow': { throw: 1, len: 34, rel: 14, dmg: 10, ang: 40, bkb: 62, kbg: 70, t: 'steel', hold: [[0, 1, 0], [12, 1.5, 0.3]], anim: A.throwF },
      'ciz:bthrow': { throw: 1, back: 1, len: 40, rel: 18, dmg: 13, ang: 42, bkb: 60, kbg: 88, t: 'steel', hold: [[0, 1, 0], [9, 0, 1.0], [18, -1.5, 0.2]], anim: A.throwB },
      'ciz:uthrow': { throw: 1, len: 40, rel: 18, dmg: 10, ang: 90, bkb: 60, kbg: 86, t: 'steel', hold: [[0, 1, 0], [14, 0.2, 1.4]], anim: A.throwU },
      'ciz:dthrow': { throw: 1, len: 38, rel: 18, dmg: 8, ang: 70, bkb: 70, kbg: 45, t: 'steel', hold: [[0, 1, 0], [14, 0.9, -0.1]], anim: A.throwD },
      taunt: { len: 60, anim: [[0, {}], [10, { aF: 170, aB: 170, eye: 3 }], [45, { aF: 150, aB: 170, eye: 3 }], [60, {}]] },
    },
    draw(ctx, P, c, f, S, t) {
      const ciz = f.v.form === 'ciz';
      const body = ciz ? c.ciz : c.body, dark = ciz ? c.ciz2 : U.shade(c.body, -0.3);
      const cr = P.crouch || 0, tu = P.tuck || 0;
      ctx.save();
      ctx.scale(1 + cr * 0.08, 1 - cr * 0.3);
      const hip = [0, 7.4];
      const rot = (x, y) => { ctx.translate(x, y); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-x, -y); };
      const lF = U.lerp(P.lF, 70, tu), lB = U.lerp(P.lB, 50, tu), kF = U.lerp(P.kF, 110, tu), kB = U.lerp(P.kB, 110, tu);
      const arm = (sx, sy, a, e, col, front) => {
        const L = D.limb(ctx, sx, sy, a, -(e || 0), 3.0, 2.8, 1.6, 1.4, col);
        const [dx, dy] = D.dir(L.a2);
        const nx = -dy, ny = dx;
        if (!ciz) { // faux
          const bx = L.ex, by = L.ey;
          const tipx = bx + dx * 6.5 - nx * 2.5, tipy = by + dy * 6.5 - ny * 2.5;
          ctx.beginPath(); ctx.moveTo(bx + nx * 0.8, by + ny * 0.8);
          ctx.quadraticCurveTo(bx + dx * 5 + nx * 1.6, by + dy * 5 + ny * 1.6, tipx, tipy);
          ctx.quadraticCurveTo(bx + dx * 3.5 - nx * 0.4, by + dy * 3.5 - ny * 0.4, bx - nx * 0.8, by - ny * 0.8);
          ctx.closePath(); ctx.fillStyle = D.lin(ctx, bx, by, tipx, tipy, U.shade(c.blade, -0.15), c.blade); ctx.fill();
          ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW; ctx.stroke();
        } else { // pince
          const bx = L.ex + dx * 1.8, by = L.ey + dy * 1.8;
          ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.atan2(dy, dx));
          const op = P.glow ? 0.5 : 0.2;
          D.ell(ctx, 1.2, 1.1, 2.9, 1.6, op * 57, D.shade(ctx, 1, 1, 3, col));
          D.ell(ctx, 1.2, -1.1, 2.9, 1.6, -op * 57, D.shade(ctx, 1, -1, 3, col));
          if (front) { D.circ(ctx, 1.6, 1.2, 0.8, c.cizEye); D.circ(ctx, 1.6, 1.2, 0.35, '#111', true); }
          ctx.restore();
        }
        return L;
      };
      // ailes
      ctx.save(); rot(hip[0], hip[1]);
      const buzz = (!f.grounded) ? Math.sin(t * 80) * 0.3 : Math.sin(t * 2) * 0.05;
      for (let i = 0; i < 2; i++) {
        ctx.save(); ctx.translate(-1.8, 13.4 - i * 1.6); ctx.rotate(0.9 + i * 0.4 + buzz);
        D.ell(ctx, -4, 0, 4.6, 1.3, 0, ciz ? 'rgba(200,205,220,0.75)' : c.wing); ctx.restore();
      }
      arm(-1.2, 12.8, P.aB, P.eB, dark, 0);
      ctx.restore();
      // jambe arrière
      const bl = D.limb(ctx, -0.6, hip[1], lB, kB, 3.6, 3.6, 1.6, 1.1, ciz ? c.metal : dark);
      D.poly(ctx, [bl.ex - 0.6, bl.ey + 0.2, bl.ex + 2.0, bl.ey - 0.2, bl.ex + 0.2, bl.ey - 0.5], ciz ? U.shade(c.metal, -0.2) : dark);
      ctx.save(); rot(hip[0], hip[1]);
      // abdomen + thorax
      D.ell(ctx, -1.4, 7.4, 3.0, 2.0, 20, D.shade(ctx, -1.4, 7.4, 3, ciz ? c.ciz2 : c.body));
      D.blob(ctx, [-2.1, 8.2, 2.1, 8.2, 2.6, 11, 2.0, 13.8, -2.0, 13.8, -2.5, 11], D.shade(ctx, 0, 11, 4, body));
      if (!ciz) for (let i = 0; i < 3; i++) D.ell(ctx, 1.2, 9.2 + i * 1.4, 1.2, 0.55, 0, c.belly, true);
      else { ctx.strokeStyle = U.shade(c.ciz2, -0.3); ctx.lineWidth = 0.3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-1.6, 9.2 + i * 1.4); ctx.lineTo(1.8, 9.2 + i * 1.4); ctx.stroke(); } }
      // tête
      ctx.save(); ctx.translate(1.0, 16.0); ctx.rotate(-(P.hd || 0) * Math.PI / 180);
      if (!ciz) { D.poly(ctx, [-1.0, 1.8, -1.8, 4.2, 0.2, 2.2], body); D.poly(ctx, [0.2, 2.0, 0.6, 4.6, 1.4, 1.8], body); }
      else { D.seg(ctx, -0.4, 1.8, -2.2, 4.4, 0.6, '#1b1226', 0.3); D.seg(ctx, 0.6, 1.8, 0.2, 4.6, 0.6, '#1b1226', 0.3); }
      D.blob(ctx, [-2.0, -1.2, 2.2, -1.4, 3.0, 0.4, 1.6, 2.2, -1.4, 2.2, -2.4, 0.4], D.shade(ctx, 0, 0.4, 2.6, body));
      const ex = P.eye;
      if (ex === 2 || ex === 3) D.eye(ctx, 1.4, 0.3, 0.7, ex);
      else if (ciz) { D.ell(ctx, 1.5, 0.3, 0.8, 0.55, 0, c.cizEye); D.circ(ctx, 1.7, 0.3, 0.25, '#111', true); }
      else { D.ell(ctx, 1.4, 0.4, 0.9, 0.55, -10, '#fff'); D.ell(ctx, 1.6, 0.35, 0.55, 0.4, -10, c.eye, true); if (ex === 1) { ctx.strokeStyle = D.OL; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(0.4, 1.3); ctx.lineTo(2.4, 0.9); ctx.stroke(); } }
      ctx.restore();
      ctx.restore();
      // jambe avant
      const fl = D.limb(ctx, 0.6, hip[1], lF, kF, 3.6, 3.6, 1.7, 1.15, ciz ? U.shade(c.metal, 0.1) : body);
      D.poly(ctx, [fl.ex - 0.6, fl.ey + 0.2, fl.ex + 2.1, fl.ey - 0.2, fl.ex + 0.2, fl.ey - 0.5], ciz ? c.metal : body);
      // bras avant
      ctx.save(); rot(hip[0], hip[1]);
      arm(1.2, 12.8, P.aF, P.eF, body, 1);
      ctx.restore();
      ctx.restore();
    },
    drawFx(ctx, f, S, t) {
      // aura quand une charge est stockée (pleine = pulsation forte)
      const store = f.v.form === 'ciz' ? f.v.storeC : f.v.storeI;
      const charging = f.action === 'move' && f.move === 'nspec' && f.af <= 8;
      if (store > 0 || charging) {
        const st = G.ST(f), max = f.v.form === 'ciz' ? CHG.ciz.max : CHG.ins.max;
        const k = Math.min(1, (charging ? f.mv.c || 0 : store) / max);
        const col = f.v.form === 'ciz' ? '255,120,60' : '200,255,170';
        ctx.fillStyle = `rgba(${col},${0.12 + k * 0.18 + (k >= 0.99 ? 0.12 * Math.sin(t * 18) : 0)})`;
        ctx.beginPath(); ctx.ellipse(G.R.px(f), G.R.py(f) + st.h * 0.5, st.w * 0.8 + k * 4, st.h * 0.62 + k * 3, 0, 0, 7); ctx.fill();
      }
    },
    fx(e, R) {
      if (e.swap) { R.parts.push({ ty: 'ring', x: e.x, y: e.y + 9, life: 18, max: 18, size: 14, col: '#ffffff' }); R.spark(e.x, e.y + 9, '#fff', 14, 2.5); }
      if (e.full) { R.parts.push({ ty: 'ring', x: e.x, y: e.y + 9, life: 20, max: 20, size: 12, col: '#ffe066' }); R.spark(e.x, e.y + 9, '#fff4b0', 10, 2); }
      if (e.boom) {
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 18, max: 18, size: 16, col: '#ffffff' });
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 24, max: 24, size: 22, col: '#ff6a3a' });
        R.parts.push({ ty: 'star', x: e.x, y: e.y, life: 12, max: 12, size: 12, col: '#fff3a0', rot: 0.3 });
        R.cam.shake = Math.max(R.cam.shake, 7);
      }
      if (e.slashFull) {
        R.parts.push({ ty: 'custom', x: e.x, y: e.y, life: 16, max: 16, fc: e.s, draw(ctx, p, k) {
          ctx.strokeStyle = `rgba(230,255,220,${k})`; ctx.lineWidth = 2.2 * k; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(p.x, p.y + 10, 13, -0.6, 1.9); ctx.stroke();
          ctx.beginPath(); ctx.arc(p.x, p.y + 10, 11, 1.2, 3.7); ctx.stroke();
        } });
      }
    },
    hud(ctx, f, S, x, y, pw, ph, u) {
      const ciz = f.v.form === 'ciz', store = ciz ? f.v.storeC : f.v.storeI;
      if (store > 0) {
        ctx.fillStyle = ciz ? '#ffb05a' : '#c8ffb0'; ctx.font = `900 ${10 * u}px Rubik, sans-serif`; ctx.textAlign = 'left';
        const mx = ciz ? CHG.ciz.max : CHG.ins.max;
        ctx.fillText((ciz ? 'PINCE ' : 'LAME ') + (store >= mx ? 'MAX' : Math.round(store / mx * 100) + '%'), x + ph + 2 * u, y + 43 * u);
      }
    },
  });
})(window.G);
