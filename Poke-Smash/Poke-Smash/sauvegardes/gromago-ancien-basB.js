'use strict';
// GROMAGO — surfe sur sa planche de pièces quand il court, Ruée d'Or (pluie de pièces chargeable).
(function (G) {
  const U = G.U, D = G.D, H = G.H, A = G.A;

  // ---- Projectile : pièce ----
  G.PROJ.coin = {
    tick(S, p) { p.vx *= 0.995; },
    onStage(S, p) { p.dead = true; S.events.push({ t: 'poof', x: p.x, y: p.y, k: 'cp' + p.id }); },
    draw(ctx, p, t) {
      const w = Math.abs(Math.cos(p.age * 0.45)) * p.r + 0.25;
      ctx.fillStyle = p.big ? '#fff08a' : '#ffd23a'; ctx.strokeStyle = '#8a5a08'; ctx.lineWidth = 0.3;
      ctx.beginPath(); ctx.ellipse(0, 0, w, p.r, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-w * 0.3, p.r * 0.3, w * 0.25, p.r * 0.3, 0, 0, 7); ctx.fill();
    },
  };

  const SURF = { dash: 1, run: 1, brake: 1, turn: 1 };

  function nspecTick(S, f, af, inp, M) {
    const st = G.ST(f);
    if (!f.grounded) { f.vy = Math.max(f.vy, -0.6); }
    if (af === M.charge && f.charge === 1) G.sfx(S, f, 'coin');
    if (af > M.charge) {
      const k = f.mv.n || (f.mv.n = Math.max(2, 3 + Math.floor(f.charge / 9) - (f.v.mir || 0)));
      const i = af - M.charge - 2;
      if (i >= 0 && i % 3 === 0 && i / 3 < k) {
        const j = i / 3, last = j === k - 1;
        const spread = (U.rand(S) - 0.5);
        G.spawnProj(S, f, 'coin', {
          x: f.x + f.facing * 5, y: f.y + st.h * 0.62, vx: f.facing * (2.4 + f.charge / 60 * 1.3 + spread * 0.5), vy: 1.1 + spread * 0.9,
          grav: 0.055, r: last ? 2.1 : 1.6, life: 80, dmg: last ? 4 + f.charge / 20 : 1.8, ang: last ? 45 : 60, bkb: last ? 45 : 18, kbg: last ? 75 : 25,
          t: 'coin', big: last, rehit: 0,
        });
        G.sfx(S, f, 'coins');
      }
      if (i / 3 >= k + 2) { f.v.mir = Math.min(3, (f.v.mir || 0) + 1); f.v.mirT = 300; G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; }
    }
  }

  function surfTick(S, f, af, inp, M) {
    const st = G.ST(f);
    if (af === 1) { f.mv.air = !f.grounded; if (f.mv.air) { if (f.v.surfUsed) { G.setAction(f, 'air'); return 'stop'; } f.v.surfUsed = 1; } G.sfx(S, f, 'dash'); }
    // FIGURE : le surf touche => il décolle sur la tête de l'adversaire (max 3 figures par saut)
    if (f.mv.hit && (f.v.trickAir || 0) < 3) { G.startMove(S, f, 'trick'); return 'stop'; }
    if (af >= 6 && af <= 34) {
      f.vx = f.facing * (af < 10 ? 2.2 + (af - 6) * 0.2 : 3.0);
      if (!f.grounded) { f.vy = af < 20 ? 0.35 : Math.max(f.vy - 0.08, -1.2); }
      if (f.buf.j && af > 12) { // sortie en saut avec l'élan
        f.buf.j = 0;
        if (f.grounded) { G.setAction(f, 'jsq'); f.jsqSrc = 1; return 'stop'; }
        if (f.jumps < st.jumps) { f.jumps++; f.vy = Math.sqrt(2 * st.grav * st.dJump); G.setAction(f, 'air'); f.v.dj = S.frame; return 'stop'; }
      }
    } else if (af > 34) f.vx = U.approach(f.vx, 0, 0.12);
  }

  // Figure : ollie + kickflip au-dessus de l'adversaire, rend le surf et le double saut => on enchaîne.
  // Chaque figure d'un même combo monte le compteur (dégâts du surf +10 % par niveau) ; la 3e = JACKPOT.
  function trickTick(S, f, af) {
    if (af === 1) {
      f.grounded = false; f.plat = null; f.vy = 3.1; f.vx = f.facing * 0.7; f.ff = false;
      f.v.trickAir = (f.v.trickAir || 0) + 1;
      f.v.trick = Math.min(5, (f.v.trick || 0) + 1); f.v.trickT = 170;
      f.v.surfUsed = f.v.trickAir >= 3 ? 1 : 0;
      if (f.jumps > 1) f.jumps = 1;
      const jack = f.v.trickAir >= 3, st = G.ST(f);
      const n = jack ? 7 : 2 + f.v.trickAir;
      for (let i = 0; i < n; i++) {
        const a = 90 + (i - (n - 1) / 2) * (jack ? 22 : 26);
        G.spawnProj(S, f, 'coin', { x: f.x, y: f.y + st.h * 0.4, vx: U.dcos(a) * 2.2, vy: U.dsin(a) * 2.6, grav: 0.07, r: jack ? 2 : 1.6, life: 40, dmg: jack ? 3 : 1.8, ang: 70, bkb: jack ? 40 : 20, kbg: jack ? 60 : 25, t: 'coin', big: jack });
      }
      G.sfx(S, f, jack ? 'coins' : 'coin', { trick: f.v.trickAir });
    }
  }

  // Aériens : la planche et les pièces
  function coinThrow(S, f, af) { // fair : pièce lancée
    if (af === 7) {
      const st = G.ST(f);
      G.spawnProj(S, f, 'coin', { x: f.x + f.facing * 6, y: f.y + st.h * 0.6, vx: f.facing * 3.8, vy: 0.4, grav: 0.03, r: 2.2, life: 26, dmg: 6, ang: 45, bkb: 34, kbg: 62, t: 'coin', big: true });
      G.sfx(S, f, 'coin');
    }
  }
  function fountainTick(S, f, af) { // uair : fontaine de pièces
    if (af === 6) {
      const st = G.ST(f);
      [72, 90, 108].forEach((a) => G.spawnProj(S, f, 'coin', { x: f.x, y: f.y + st.h, vx: U.dcos(a) * 3.0 * f.facing, vy: U.dsin(a) * 3.2, grav: 0.07, r: 1.8, life: 30, dmg: 3, ang: 88, bkb: 30, kbg: 55, t: 'coin' }));
      G.sfx(S, f, 'coins');
    }
  }
  function stompTick(S, f, af) { // dair : ollie stomp
    if (af < 5) { f.vy = Math.max(f.vy, 0.3); f.vx *= 0.9; }
    if (af === 5) { f.vy = -2.8; f.ff = false; }
  }
  function stompLand(S, f) {
    [-1, 1].forEach((d) => [1.4, 2.4].forEach((sp) => G.spawnProj(S, f, 'coin', { x: f.x + d * 4, y: f.y + 1.5, vx: d * sp, vy: 1.1, grav: 0.06, r: 1.6, life: 24, dmg: 3, ang: 60, bkb: 35, kbg: 40, t: 'coin' })));
    G.sfx(S, f, 'coins');
    S.events.push({ t: 'land', s: f.slot, x: f.x, y: f.y, k: 'gs' + f.slot + '_' + S.frame });
    f.lag = 9; G.setAction(f, 'lag');
  }

  function tornadoTick(S, f, af, inp, M) {
    if (af === 4) { f.grounded = false; f.plat = null; f.vy = 0; G.sfx(S, f, 'coins'); }
    if (af >= 4 && af <= 34) { f.vy = af < 26 ? 2.35 : 1.3; f.vx = U.approach(f.vx, inp.sx * 1.05, 0.12); }
    if (af % 6 === 0 && af < 34) G.sfx(S, f, 'coin');
  }

  function guardTick(S, f, af) {
    if (af === 2) { G.sfx(S, f, 'coin'); if (!f.grounded) { if (f.v.guardUsed) f.mv.nostall = 1; f.v.guardUsed = 1; } }
    if (!f.grounded && !f.mv.nostall && af < 26) { f.vy = Math.max(f.vy, -0.3); f.vx *= 0.9; }
  }

  G.registerChar({
    id: 'gromago', name: 'Gromago', short: 'Gromago', dex: 1000, color: '#f5c431', trail: '#ffe066',
    desc: 'Surfe sur sa planche de pièces : rapide, glissant, zoneur. Ruée d\'Or : maintiens B pour charger la pluie de pièces.',
    stats: {
      weight: 95, h: 17, w: 8, walk: 1.15, dash: 2.0, dashF: 12, run: 2.15, runAcc: 0.12, traction: 0.062, surfBrake: 1.3, brakeF: 18,
      air: 1.1, airAcc: 0.07, grav: 0.085, fall: 1.45, ffall: 2.35, fullHop: 34, shortHop: 16, dJump: 32, jumpMom: 1.35,
    },
    palettes: [
      { name: 'Or', gold: '#f5c431', dark: '#a86f0e', face: '#2b1a10', eye: '#fff1a0', gem: '#ff5a3c' },
      { name: 'Chromatique', gold: '#dfe4ee', dark: '#8b93a6', face: '#1d2233', eye: '#ff9ad0', gem: '#6ad0ff' },
      { name: 'Bronze', gold: '#e0915a', dark: '#8a4a22', face: '#2a120a', eye: '#ffe0b0', gem: '#39d98a' },
      { name: 'Or noir', gold: '#3b3548', dark: '#15121d', face: '#f5c431', eye: '#1b1226', gem: '#f5c431' },
    ],
    init(f) { f.v.mir = 0; f.v.mirT = 0; f.v.trick = 0; f.v.trickT = 0; f.v.trickAir = 0; },
    passive(S, f) {
      if (f.v.mirT > 0 && --f.v.mirT === 0 && f.v.mir > 0) { f.v.mir--; if (f.v.mir > 0) f.v.mirT = 300; }
      if (f.grounded || f.action === 'ledge') { f.v.surfUsed = 0; f.v.guardUsed = 0; f.v.trickAir = 0; }
      if (f.v.trickT > 0 && --f.v.trickT === 0) f.v.trick = 0;
    },
    onKO(S, f) { f.v.trick = 0; f.v.trickT = 0; f.v.trickAir = 0; },
    moves: {
      jab: { len: 17, iasa: 15, next: ['jab2', 5, 15], hits: [H(3, 4, 7, 10, 3.6, 2.2, 361, 20, 22, { t: 'coin' })], anim: A.jab(3, 4, 17) },
      jab2: { len: 18, next: ['jab3', 6, 17], hits: [H(3, 4, 7.5, 10, 3.6, 2, 361, 22, 22, { t: 'coin' })], anim: A.jab2(3, 4, 18) },
      jab3: { len: 30, hits: [H(6, 8, 9, 9.5, 5.2, 4.5, 361, 50, 95, { t: 'coin' })], anim: A.punch(6, 8, 30) },
      ftilt: { len: 30, hitCancel: 20, hits: [H(8, 10, 11.5, 9, 4.6, 9.5, 361, 32, 95, { t: 'coin' }), H(8, 10, 6, 9.5, 3.5, 8, 361, 30, 90)], anim: A.punch(8, 10, 30) },
      utilt: { len: 30, hitCancel: 16, hits: [H(7, 12, 1, 20, 6, 7.5, 92, 40, 112, { t: 'coin' }), H(7, 12, 4, 15, 4.5, 7, 100, 40, 100)], anim: A.upSwing(7, 12, 30) },
      dtilt: { len: 22, hurtH: 0.62, hitCancel: 12, hits: [H(6, 8, 10, 2, 4.2, 6, 78, 48, 55)], anim: A.sweep(6, 8, 22) },
      dashAtk: { len: 38, keepVel: 1, tick: G.dashAtkTick, hits: [H(6, 10, 7, 4, 6, 11, 50, 55, 75), H(11, 18, 6, 4, 5, 7, 60, 45, 60)], anim: [[0, { lean: 20 }], [6, { lean: 28, aF: 60, aB: -60 }], [18, { lean: 22 }], [38, {}]] },
      fsmash: { len: 52, charge: 10, hits: [H(16, 18, 14.5, 9.5, 7.5, 17, 361, 35, 102, { t: 'coin' }), H(16, 18, 7, 9.5, 4.5, 14, 361, 32, 98)], anim: A.smashF(10, 16, 18, 52) },
      usmash: { len: 50, charge: 8, hits: [H(12, 13, 2, 14, 7, 4, 90, 100, 0, { t: 'coin', link: 1 }), H(16, 19, 1, 22, 8, 13, 88, 38, 106, { t: 'coin', g: 1 })], anim: A.smashU(8, 13, 19, 50) },
      dsmash: { len: 50, charge: 6, hits: [H(12, 14, 12, 2.5, 5.5, 14, 30, 32, 98, { t: 'coin' }), H(12, 14, -12, 2.5, 5.5, 14, 150, 32, 98, { t: 'coin' })], anim: A.smashD(6, 12, 14, 50) },
      // Kickflip : la planche fait deux tours sous ses pieds (2 coups)
      nair: { aerial: 1, len: 36, landLag: 7, ac: [4, 26], hits: [H(4, 8, 0, 3, 8.5, 6, 70, 30, 40, { t: 'coin' }), H(11, 14, 0, 5, 8.5, 6, 361, 40, 92, { t: 'coin', g: 1 })], anim: [[0, { flip: 0 }], [4, { flip: 0, tuck: 0.6, aF: 110, aB: -60 }], [14, { flip: 2, tuck: 0.6, aF: 110, aB: -60, eye: 1 }], [22, { flip: 2, tuck: 0.2 }], [36, { flip: 2 }]] },
      // Pièce Lancée : une grosse pièce projetée devant (zoning aérien)
      fair: { aerial: 1, len: 34, landLag: 9, ac: [3, 24], tick: coinThrow, hits: [H(6, 8, 7, 11, 4.5, 4, 45, 30, 50, { t: 'coin' })], anim: [[0, {}], [5, { aF: -40, lean: -8 }], [7, { aF: 100, eF: 0, lean: 12, eye: 1 }], [12, { aF: 95 }], [34, {}]] },
      // Batte d'Or : la planche en batte de baseball derrière lui
      bair: { aerial: 1, len: 38, landLag: 10, ac: [4, 28], hits: [H(9, 12, -13, 9, 6.5, 14, 361, 32, 100, { t: 'coin' }), H(9, 12, -6, 9, 4.5, 10, 361, 30, 90)], anim: [[0, { bat: 1 }], [7, { bat: 1, aF: 150, lean: 8 }], [9, { bat: 1, aF: -95, eF: 0, lean: -14, eye: 1 }], [16, { bat: 1, aF: -110 }], [30, { bat: 0 }], [38, {}]] },
      // Fontaine d'Or : trois pièces jaillissent vers le haut
      uair: { aerial: 1, len: 32, landLag: 8, ac: [3, 24], tick: fountainTick, hits: [H(5, 8, 1, 18, 6, 6, 86, 30, 96, { t: 'coin' })], anim: A.uairSwipe(5, 8, 32) },
      // Ollie Stomp : écrase avec la planche, rebondit sur l'adversaire ; à l'atterrissage, gerbe de pièces
      dair: { aerial: 1, len: 40, landLag: 9, ac: [4, 34], tick: stompTick, onLand: stompLand, hits: [H(5, 30, 0, 0, 6.5, 9, 65, 45, 55, { t: 'coin', onHit: (S, a) => { a.vy = 2.8; a.ff = false; a.v.surfUsed = 0; } })], anim: [[0, { flip: 0 }], [4, { flip: 0, tuck: 0.6 }], [5, { flip: 0.5, lF: 0, lB: 0, kF: 0, kB: 0, sq: 1.1, eye: 1, aF: 150, aB: 150 }], [40, { flip: 0.5, aF: 150, aB: 150 }]] },
      nspec: { len: 400, charge: 8, chargeBtn: 'spc', tick: nspecTick, grav: 0.35, drift: 0.6, landLag: 6, land: 'keep', anim: (f) => [[0, {}], [8, { aF: -40, aB: -30, lean: -8, glow: 1 }], [9, { aF: -40, lean: -8, glow: 1 }], [10, { aF: 100, aB: 60, lean: 12 }], [400, { aF: 100, aB: 60, lean: 12 }]] },
      sspec: { len: 46, tick: surfTick, offEdge: 1, keepVel: 1, land: 'keep', noGrav: (af) => af >= 6 && af < 20, drift: 0, ledge: 20, hits: [H(8, 30, 5, 5, 6, 8, 76, 55, 45, { t: 'coin', dmgFn: (S, a, t, d) => d * (1 + 0.1 * (a.v.trick || 0)) })], anim: [[0, { crouch: 0.4 }], [6, { lean: 22, aF: 60, aB: -50 }], [34, { lean: 18, aF: 60, aB: -50 }], [46, {}]] },
      trick: { len: 30, iasa: 13, landLag: 4, tick: trickTick, hits: [H(2, 6, 1, 1, 7, 4, 82, 58, 30, { t: 'coin' })], anim: [[0, { flip: 0, tuck: 0.8, rot: 0 }], [3, { flip: 0.5, tuck: 1, rot: -120, aF: 150, aB: 150, eye: 1 }], [12, { flip: 1.5, tuck: 0.7, rot: -360, aF: 170, aB: 120 }], [30, { flip: 1.5, rot: -360 }]] },
      uspec: { len: 44, helpless: 1, landLag: 22, ledge: 18, tick: tornadoTick, drift: 0, noGrav: (af) => af >= 4 && af <= 34, hits: [H(5, 30, 0, 9, 8.5, 1.6, 90, 0, 0, { t: 'coin', rehit: 5, link: 1, hs: 10 }), H(35, 37, 0, 12, 9, 5, 80, 60, 90, { t: 'coin', g: 1 })], anim: [[0, { crouch: 0.4 }], [4, { aF: 175, aB: 175, sq: 1.08 }], [40, { aF: 170, aB: 170 }], [44, {}]] },
      dspec: { len: 36, tick: guardTick, reflect: [4, 26, 0, 9, 13], intang: [4, 10], landLag: 8, anim: [[0, {}], [4, { aF: 150, aB: 150, glow: 1, crouch: 0.2 }], [26, { aF: 150, aB: 150, glow: 1 }], [36, {}]] },
      fthrow: { throw: 1, len: 30, rel: 12, dmg: 8, ang: 42, bkb: 65, kbg: 60, t: 'coin', hold: [[0, 1, 0], [10, 1.5, 0.3]], anim: A.throwF },
      bthrow: { throw: 1, back: 1, len: 36, rel: 16, dmg: 10, ang: 40, bkb: 62, kbg: 72, hold: [[0, 1, 0], [8, 0, 0.9], [16, -1.5, 0.3]], anim: A.throwB },
      uthrow: { throw: 1, len: 40, rel: 18, dmg: 7, ang: 88, bkb: 55, kbg: 82, t: 'coin', hitFrame: 12, hitDmg: 3, hold: [[0, 1, 0], [12, 0.3, 1.4], [18, 0.2, 1.6]], anim: A.throwU },
      dthrow: { throw: 1, len: 38, rel: 18, dmg: 6, ang: 70, bkb: 70, kbg: 42, hold: [[0, 1, 0], [14, 0.9, -0.1]], anim: A.throwD },
      taunt: { len: 70, anim: [[0, {}], [10, { aF: 140, eye: 3 }], [35, { aF: 150, aB: 150, eye: 3 }], [60, { aF: 140, eye: 3 }], [70, {}]] },
    },
    pose(P, f, S) {
      if (SURF[f.action] || (f.action === 'move' && (f.move === 'sspec' || f.move === 'dashAtk'))) {
        P.surf = 1;
        if (f.action !== 'move') { P.lF = 38; P.lB = -34; P.kF = 18; P.kB = 22; P.aF = 75 + Math.sin(S.frame * 0.2) * 8; P.aB = -55; P.eF = 20; P.walk = 0; P.bob = Math.sin(S.frame * 0.25) * 0.25; }
        if (f.action === 'brake') P.lean = -12;
        if (f.action === 'turn') P.lean = f.af < 7 ? -15 : 5;
      }
      if (f.action === 'move' && f.move === 'uspec') P.spin = f.af;
      if (f.action === 'move' && (f.move === 'nair' || f.move === 'dair' || f.move === 'trick')) P.board = 1;
    },
    draw(ctx, P, c, f, S, t) {
      const cr = P.crouch || 0, tu = P.tuck || 0;
      ctx.save();
      if (P.surf) { // planche de pièces
        ctx.save(); ctx.rotate(-P.lean * 0.15 * Math.PI / 180);
        const bg = ctx.createLinearGradient(0, 2, 0, -0.5); bg.addColorStop(0, U.shade(c.gold, 0.3)); bg.addColorStop(1, c.dark);
        D.ell(ctx, 0, 0.9, 8.4, 1.25, 0, bg);
        ctx.strokeStyle = U.shade(c.dark, -0.2); ctx.lineWidth = 0.25;
        for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(i * 2.2, 0.9, 1, 0.9, 0, 0, 7); ctx.stroke(); }
        ctx.restore();
        ctx.translate(0, 1.6);
      }
      if (P.board && !P.surf) { // planche sous les pieds pendant les aériens (kickflip = elle tourne sur elle-même)
        const fl = Math.cos((P.flip || 0) * Math.PI * 2);
        const bg = ctx.createLinearGradient(0, 1, 0, -1); bg.addColorStop(0, U.shade(c.gold, 0.3)); bg.addColorStop(1, c.dark);
        D.ell(ctx, 0, -0.6, 8.4, Math.max(0.25, Math.abs(fl) * 1.25), 0, fl >= 0 ? bg : c.dark);
      }
      ctx.scale(1 + cr * 0.08, 1 - cr * 0.3);
      const hip = [0, 7.3];
      const lF = U.lerp(P.lF, 75, tu), lB = U.lerp(P.lB, 55, tu), kF = U.lerp(P.kF, 110, tu), kB = U.lerp(P.kB, 110, tu);
      ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-hip[0], -hip[1]);
      const sh = [0.5, 12.2];
      // bras arrière
      const bA = D.limb(ctx, sh[0] - 1.1, sh[1], P.aB, -(P.eB || 0), 3.3, 3.1, 1.5, 1.25, c.dark);
      D.circ(ctx, bA.ex, bA.ey, 1.05, c.dark);
      ctx.restore();
      // jambe arrière
      const bl = D.limb(ctx, hip[0] - 0.6, hip[1], lB, kB, 3.7, 3.7, 1.7, 1.35, c.dark);
      D.ell(ctx, bl.ex + 0.5, bl.ey, 1.4, 0.75, 0, c.dark);
      ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-hip[0], -hip[1]);
      // dreadlocks de pièces (derrière la tête)
      const hx = 0.7 + (P.hd || 0) * 0.02, hy = 15.3;
      const sway = Math.sin(t * 3 + f.slot) * 0.6 - (f.vx || 0) * f.facing * 0.8;
      for (let k = 0; k < 3; k++) {
        for (let i = 0; i < 4; i++) {
          const x = hx - 2.0 - k * 0.5 + sway * i * 0.3 - i * 0.35, y = hy + 0.6 - i * 1.4 - k * 0.2;
          D.ell(ctx, x, y, 0.75, 0.62, 0, i % 2 ? c.gold : U.shade(c.gold, -0.12));
        }
      }
      // torse
      D.blob(ctx, [-2.2, 7.6, 2.0, 7.6, 2.8, 10.4, 2.2, 12.9, -1.9, 12.9, -2.7, 10.4], D.shade(ctx, 0.2, 10.5, 4, c.gold));
      D.circ(ctx, 0.9, 10.5, 1.35, U.shade(c.gold, 0.25)); D.circ(ctx, 0.9, 10.5, 0.7, c.gem);
      // tête
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(-(P.hd || 0) * Math.PI / 180);
      D.circ(ctx, 0, 0, 3.0, D.shade(ctx, 0, 0, 3, c.gold));
      // crête de pièces
      [[-0.9, 3.0], [0.2, 3.35], [1.3, 3.0]].forEach(([x, y]) => D.ell(ctx, x, y, 0.55, 0.95, 0, U.shade(c.gold, 0.15)));
      // visage sombre
      D.ell(ctx, 1.25, -0.1, 1.9, 2.25, 0, c.face);
      const ex = P.eye;
      if (ex === 3) { ctx.strokeStyle = c.eye; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.arc(1.0, 0.4, 0.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.beginPath(); ctx.arc(2.3, 0.4, 0.45, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      else if (ex === 2) { ctx.strokeStyle = c.eye; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(0.6, 0.9); ctx.lineTo(1.3, 0.3); ctx.lineTo(0.6, -0.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(2.6, 0.9); ctx.lineTo(1.9, 0.3); ctx.lineTo(2.6, -0.1); ctx.stroke(); }
      else {
        ctx.fillStyle = c.eye;
        ctx.beginPath(); ctx.ellipse(0.95, 0.35, 0.42, 0.72, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(2.25, 0.35, 0.38, 0.68, 0, 0, 7); ctx.fill();
        if (ex === 1) { ctx.strokeStyle = c.eye; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(0.4, 1.3); ctx.lineTo(1.4, 1.0); ctx.moveTo(1.8, 1.0); ctx.lineTo(2.8, 1.3); ctx.stroke(); }
      }
      ctx.strokeStyle = c.eye; ctx.lineWidth = 0.28; ctx.beginPath(); ctx.arc(1.6, -1.0, 0.6, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      D.shine(ctx, -1.2, 1.4, 0.9, 0.5, 0.35);
      ctx.restore();
      ctx.restore();
      // jambe avant
      const fl = D.limb(ctx, hip[0] + 0.6, hip[1], lF, kF, 3.7, 3.7, 1.8, 1.45, c.gold);
      D.ell(ctx, fl.ex + 0.6, fl.ey, 1.5, 0.8, 0, c.gold);
      // bras avant (+ pièces en main pendant la Ruée d'Or)
      ctx.save(); ctx.translate(hip[0], hip[1]); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-hip[0], -hip[1]);
      const fA = D.limb(ctx, sh[0] + 1.2, sh[1], P.aF, -(P.eF || 0), 3.3, 3.1, 1.6, 1.3, c.gold);
      D.circ(ctx, fA.ex, fA.ey, 1.15, D.shade(ctx, fA.ex, fA.ey, 1.2, c.gold));
      if (P.glow) {
        ctx.fillStyle = `rgba(255,230,120,${0.35 + 0.25 * Math.sin(t * 20)})`; ctx.beginPath(); ctx.arc(fA.ex, fA.ey, 2.6 + (f.charge || 0) / 30, 0, 7); ctx.fill();
      }
      if (P.bat > 0.5) { // planche tenue comme une batte
        const [dx, dy] = D.dir(P.aF - (P.eF || 0));
        ctx.save(); ctx.translate(fA.ex + dx * 4.2, fA.ey + dy * 4.2); ctx.rotate(Math.atan2(dy, dx));
        const bg = ctx.createLinearGradient(0, 1.2, 0, -1.2); bg.addColorStop(0, U.shade(c.gold, 0.3)); bg.addColorStop(1, c.dark);
        D.ell(ctx, 0, 0, 5.4, 1.2, 0, bg); ctx.restore();
      }
      ctx.restore();
      ctx.restore();
    },
    drawFx(ctx, f, S, t) {
      // Tornade Dorée : anneau de pièces
      if (f.action === 'move' && f.move === 'uspec' && f.af < 38) {
        const st = G.ST(f);
        for (let i = 0; i < 14; i++) {
          const a = t * 9 + i * 0.9, y = f.y + (i / 14) * st.h * 1.3;
          const r = 5 + (i / 14) * 6;
          const x = f.x + Math.cos(a) * r, w = Math.abs(Math.sin(a)) * 1.1 + 0.3;
          ctx.fillStyle = Math.sin(a) > 0 ? '#ffe066' : '#c8900e';
          ctx.beginPath(); ctx.ellipse(x, y, w, 1.1, 0, 0, 7); ctx.fill();
        }
      }
      // Corps en Or : dôme doré
      if (f.action === 'move' && f.move === 'dspec' && f.af >= 4 && f.af <= 26) {
        const st = G.ST(f);
        ctx.strokeStyle = `rgba(255,220,90,${0.6 + 0.3 * Math.sin(t * 25)})`; ctx.lineWidth = 0.8;
        ctx.fillStyle = 'rgba(255,215,80,0.18)';
        ctx.beginPath(); ctx.arc(f.x, f.y + st.h * 0.52, 12, 0, 7); ctx.fill(); ctx.stroke();
      }
      // traînée de pièces en surfant
      if ((f.action === 'run' || f.action === 'dash' || (f.action === 'move' && f.move === 'sspec')) && S.frame % 3 === 0 && f.grounded && G.R.newFrame) {
        G.R.parts.push({ ty: 'coin', x: f.x - f.facing * 7, y: f.y + 1, vx: -f.facing * 0.3, vy: 0.4, grav: 0.05, life: 20, max: 20, size: 0.7 });
      }
    },
    hud(ctx, f, S, x, y, pw, ph, u) {
      const txt = (f.v.mir > 0 ? '▼'.repeat(f.v.mir) + ' ' : '') + (f.v.trick > 0 ? 'FIGURES ×' + f.v.trick : '');
      if (txt) { ctx.fillStyle = '#ffd23a'; ctx.font = `800 ${10 * u}px Rubik, sans-serif`; ctx.textAlign = 'left'; ctx.fillText(txt, x + ph + 2 * u, y + 43 * u); }
    },
    fx(e, R) {
      if (e.trick) {
        const txt = e.trick >= 3 ? 'JACKPOT !' : e.trick === 2 ? 'FIGURE ×2 !' : 'FIGURE !';
        R.parts.push({ ty: 'ring', x: e.x, y: e.y + 4, life: 18, max: 18, size: e.trick >= 3 ? 18 : 11, col: '#ffe066' });
        R.parts.push({ ty: 'custom', x: e.x, y: e.y + 18, life: 45, max: 45, draw(ctx, p, k) {
          ctx.save(); ctx.translate(p.x, p.y + (1 - k) * 10); ctx.scale(0.4, -0.4);
          ctx.font = 'italic 900 15px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1b1226'; ctx.globalAlpha = Math.min(1, k * 2);
          ctx.strokeText(txt, 0, 0); ctx.fillStyle = '#ffd23a'; ctx.fillText(txt, 0, 0); ctx.restore(); ctx.globalAlpha = 1;
        } });
        if (e.trick >= 3) R.cam.shake = Math.max(R.cam.shake, 5);
      }
    },
  });
})(window.G);
