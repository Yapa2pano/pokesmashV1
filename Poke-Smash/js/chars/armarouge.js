'use strict';
// ARMAROUGE — Canon Blindé : maintiens B pour charger, vise au stick (vers le haut au sol, dans toutes les
// directions en l'air), relâche : la boule explose et éjecte dans la direction de sa trajectoire.
// Bouclier pendant la charge = charge stockée (le prochain B tire directement).
(function (G) {
  const U = G.U, D = G.D, H = G.H, A = G.A;
  const MAXC = 60;

  function explode(S, p) {
    if (p.v.done) return;
    p.v.done = 1; p.dead = true;
    const c = p.v.c;
    let ang = U.datan2(p.vy, p.vx);
    if (ang < 0) ang += 360;
    // Explosion de puissance fixe, quelle que soit la charge (≈ 70 % de l'ancienne pleine charge) ;
    // la charge ne change plus que la vitesse, la portée et le recul du tir.
    G.spawnProj(S, S.fighters[p.owner], 'blast', {
      x: p.x, y: p.y, vx: 0, vy: 0, dir: 1, r: 10, life: 6, pierce: true, ghost: true, refl: false, clank: false,
      dmg: 10, ang, bkb: 30, kbg: 75, t: 'fire', burn: 60, v: { c },
    });
    S.events.push({ t: 'sfx', name: 'hammer', s: p.owner, boom: 1, x: p.x, y: p.y, r: 10, k: 'bm' + p.id });
  }
  G.PROJ.cannon = {
    tick(S, p) { if (p.age % 2 === 0) S.events.push({ t: 'sfx', name: '', s: p.owner, trailF: 1, x: p.x, y: p.y, k: 'ct' + p.id + '_' + p.age }); },
    onHit(S, p) { explode(S, p); },
    onStage(S, p) { explode(S, p); },
    onEnd(S, p) { explode(S, p); },
    draw(ctx, p, t) {
      const r = p.r;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
      g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.35, 'rgba(255,200,60,0.95)'); g.addColorStop(0.7, 'rgba(255,90,30,0.7)'); g.addColorStop(1, 'rgba(180,40,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(200,100,255,0.6)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(0, 0, r * (1.1 + 0.15 * Math.sin(t * 30)), 0, 7); ctx.stroke();
    },
  };
  G.PROJ.blast = { draw() {} };

  function cannonTick(S, f, af, inp, M) {
    const st = G.ST(f);
    if (af === 1) { f.mv.c = f.v.store || 0; f.mv.aim = f.mv.aim || 0; f.mv.hold = 0; f.mv.stored = f.v.store >= MAXC ? 1 : 0; f.v.store = 0; }
    if (af === 9) {
      // visée
      const m = U.len(inp.sx, inp.sy);
      if (m > 0.35) {
        let la = U.datan2(inp.sy, inp.sx * f.facing);
        if (la > 95 || la < -95) { f.facing = -f.facing; la = U.datan2(inp.sy, inp.sx * f.facing); }
        if (f.grounded) la = U.clamp(la, -12, 90);
        f.mv.aim = U.clamp(la, -90, 90);
      }
      if (f.buf.s || (f.buf.j && f.mv.c > 5)) { // stocker la charge
        f.buf.s = 0; f.v.store = f.mv.c; G.sfx(S, f, 'shield');
        G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop';
      }
      const held = inp.held(G.BTN.SPC);
      if (!f.mv.stored && held && f.mv.hold < 150) {
        if (f.mv.c < MAXC) { f.mv.c++; if (f.mv.c === MAXC) G.sfx(S, f, 'magic'); }
        f.mv.hold++;
        f.af = 8;
        if (!f.grounded) { f.vy = Math.max(f.vy, -0.5); f.vx *= 0.97; }
        return;
      }
    }
    if (af === 10) {
      const c = f.mv.c, a = f.mv.aim, spd = 2.7 + c / MAXC * 1.5;
      const ca = U.dcos(a), sa = U.dsin(a);
      G.spawnProj(S, f, 'cannon', {
        x: f.x + f.facing * ca * 8, y: f.y + st.h * 0.55 + sa * 8, vx: f.facing * ca * spd, vy: sa * spd,
        r: 2.4 + c / MAXC * 1.6, life: 34 + Math.floor(c * 0.5), dmg: 2, ang: 361, bkb: 0, kbg: 0, t: 'fire', refl: true, v: { c },
      });
      G.sfx(S, f, 'fire');
      if (!f.grounded) { f.vx -= f.facing * ca * (0.8 + c / MAXC); f.vy -= sa * (0.6 + c / MAXC * 0.8); }
      else f.vx -= f.facing * ca * 0.5;
    }
  }

  // Lance-Flammes : dure tant que B est maintenu (min ~14 frames, max ~52), puis gerbe finale qui éjecte
  function flameTick(S, f, af, inp) {
    const st = G.ST(f);
    if (af === 1) { f.mv.t = 0; f.mv.a = 0; f.mv.fin = 0; }
    if (!f.grounded) f.vy = Math.max(f.vy, -0.35);
    if (af < 8) return;
    const t = ++f.mv.t;
    const ca = U.dcos(f.mv.a), sa = U.dsin(f.mv.a);
    if (!f.mv.fin) {
      f.mv.a = U.approach(f.mv.a, U.clamp(inp.sy * 30, -25, 25), 3);
      for (let i = 0; i < 3; i++) {
        const d = 8 + i * 5.5;
        G.pendingHitbox(S, f, { x: ca * d, y: st.h * 0.55 + sa * d, r: 3.4 + i * 0.8, dmg: 1.3, ang: 361, bkb: 0, kbg: 0, t: 'fire', rehit: 4, link: 1, hs: 9, burn: 90, noTrail: 1 });
      }
      if (t % 2 === 0) S.events.push({ t: 'sfx', name: t % 8 === 0 ? 'fire' : '', s: f.slot, flame: 1, x: f.x + f.facing * ca * 9, y: f.y + st.h * 0.55 + sa * 9, dx: f.facing * ca, dy: sa, k: 'fl' + f.slot + '_' + S.frame });
      if ((!inp.held(G.BTN.SPC) && t >= 14) || t >= 52) f.mv.fin = t;
    } else {
      if (t === f.mv.fin + 1) {
        G.pendingHitbox(S, f, { x: ca * 16, y: st.h * 0.55 + sa * 16, r: 7, dmg: 6, ang: 45, bkb: 55, kbg: 72, t: 'fire', g: 1 });
        S.events.push({ t: 'sfx', name: 'fire', s: f.slot, boom: 1, x: f.x + f.facing * ca * 16, y: f.y + st.h * 0.55 + sa * 16, r: 6, k: 'ff' + f.slot + '_' + S.frame });
      }
      if (t >= f.mv.fin + 16) { G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; }
    }
    f.af = 8; // la pose reste figée, la durée est pilotée par f.mv.t
  }

  function jetTick(S, f, af, inp) {
    const st = G.ST(f);
    if (af === 1) { f.mv.dx = 0; f.mv.dy = 1; }
    if (af < 15) { f.vx *= 0.85; f.vy = Math.max(f.vy * 0.8, -0.3); if (af % 3 === 0) G.pendingHitbox(S, f, { x: 0, y: st.h * 0.4, r: 7, dmg: 1.5, ang: 80, bkb: 30, kbg: 0, t: 'fire', rehit: 3, noTrail: 1 }); }
    if (af === 15) {
      const m = U.len(inp.sx, inp.sy);
      if (m > 0.3) { f.mv.dx = inp.sx / m; f.mv.dy = inp.sy / m; } else { f.mv.dx = 0; f.mv.dy = 1; }
      if (f.mv.dx) f.facing = f.mv.dx > 0 ? 1 : -1;
      f.grounded = false; f.plat = null;
      G.sfx(S, f, 'fire');
    }
    if (af >= 15 && af < 36) { f.vx = f.mv.dx * 3.2; f.vy = f.mv.dy * 3.2; }
    if (af === 36) { f.vx *= 0.3; f.vy *= 0.3; }
  }

  // Aériens au canon : chaque tir le propulse à l'opposé (recul = déplacement)
  function kick(S, f, x, y, r) { S.events.push({ t: 'sfx', name: 'fire', s: f.slot, boom: 1, x: f.x + x * f.facing, y: f.y + y, r, k: 'kb' + f.slot + '_' + S.frame }); }
  function fairTick(S, f, af) { // Canonnade : tir devant, recul vers l'arrière
    if (af === 8) { f.vx = -f.facing * 1.6 + f.vx * 0.2; f.vy = Math.max(f.vy, 0.7); f.ff = false; kick(S, f, 14, 10, 4); }
  }
  function bairTick(S, f, af) { // Réacteur Arrière : tir derrière, propulsé vers l'avant
    if (af === 9) { f.vx = f.facing * 2.3; f.vy = Math.max(f.vy, 0.5); f.ff = false; kick(S, f, -14, 9, 5); }
  }
  function uairTick(S, f, af) { // Canon Zénith : le dernier tir le plaque vers le sol
    if (af === 16) { f.vy = Math.min(f.vy, -1.9); kick(S, f, 0, 24, 4); }
  }
  // Onde Psy : si elle renvoie un projectile ou encaisse un coup (super armure), le canon se recharge à fond
  // et reste stocké : le B suivant tire aussitôt.
  function psyStore(S, f) {
    if (f.v.store >= MAXC) return;
    f.v.store = MAXC; f.flash = 8;
    G.sfx(S, f, 'magic', { psyStore: 1 });
  }
  function psyTick(S, f, af) {
    if (af === 2 && !f.grounded) { if (f.v.psyUsed) f.mv.nostall = 1; f.v.psyUsed = 1; }
    if (!f.grounded && !f.mv.nostall && af < 20) { f.vy = Math.max(f.vy, -0.2); f.vx *= 0.9; }
    if (af === 10) G.sfx(S, f, 'magic', { psy: 1 });
  }

  G.registerChar({
    id: 'armarouge', name: 'Armarouge', short: 'Armarouge', dex: 936, color: '#d8382a', trail: '#ffb84a',
    desc: 'Canon Blindé (B) : maintiens pour charger, vise au stick (360° en l\'air), l\'explosion éjecte dans l\'axe du tir. Bouclier = stocker la charge.',
    stats: {
      weight: 106, h: 19.5, w: 9, walk: 1.1, dash: 1.9, dashF: 12, run: 1.82, runAcc: 0.1, traction: 0.1,
      air: 1.02, airAcc: 0.065, grav: 0.092, fall: 1.6, ffall: 2.55, fullHop: 32, shortHop: 15, dJump: 30, jumps: 2,
    },
    palettes: [
      { name: 'Normal', arm: '#cf2f2a', arm2: '#8a1c22', gold: '#f2c14a', inner: '#2a1830', eye: '#ffe066', gem: '#c86bff', flame: '#ff8a2a' },
      { name: 'Chromatique', arm: '#e9e6f2', arm2: '#a19cb8', gold: '#f2c14a', inner: '#2a2440', eye: '#ff6a3a', gem: '#ff5ab4', flame: '#ffb03a' },
      { name: 'Nuit', arm: '#2f4f9a', arm2: '#1a2a5a', gold: '#d8e2f2', inner: '#0f1428', eye: '#7af0ff', gem: '#7af0ff', flame: '#5ab4ff' },
      { name: 'Émeraude', arm: '#2a9a5a', arm2: '#16563a', gold: '#f2d14a', inner: '#12241c', eye: '#fff07a', gem: '#ff7ad8', flame: '#9aff5a' },
    ],
    passive(S, f) { if (f.grounded || f.action === 'ledge') f.v.psyUsed = 0; },
    moves: {
      jab: { len: 16, iasa: 14, next: ['jab2', 4, 14], hits: [H(3, 4, 7.5, 11, 3.8, 2.5, 361, 20, 22)], anim: A.jab(3, 4, 16) },
      jab2: { len: 18, next: ['jab3', 5, 16], hits: [H(3, 4, 8, 11, 3.8, 2.5, 361, 22, 22)], anim: A.jab2(3, 4, 18) },
      jab3: { len: 30, hits: [H(6, 7, 11, 10.5, 6.5, 5.5, 361, 58, 92, { t: 'fire' })], anim: A.punch(6, 7, 30) },
      ftilt: { len: 30, hits: [H(9, 11, 14.5, 10, 5.5, 10, 361, 35, 94, { t: 'fire', burn: 90 }), H(9, 11, 8, 10, 4, 8, 361, 32, 88, { t: 'fire', burn: 90 })], anim: A.punch(9, 11, 30) },
      utilt: { len: 30, hitCancel: 15, hits: [H(6, 12, 3, 21, 7, 8, 95, 48, 88, { t: 'fire' }), H(6, 12, 6, 15, 5, 7, 100, 45, 80, { t: 'fire' })], anim: A.upSwing(6, 12, 30) },
      dtilt: { len: 24, hurtH: 0.62, hitCancel: 14, hits: [H(6, 8, 12, 2, 5, 6, 80, 40, 30, { t: 'fire', burn: 90, trip: 1 })], anim: A.lowPoke(6, 8, 24) },
      dashAtk: { len: 38, keepVel: 1, tick: G.dashAtkTick, hits: [H(6, 14, 8, 9, 6.5, 11, 60, 60, 72, { t: 'fire' })], anim: A.dashAtk(6, 14, 38) },
      fsmash: { len: 54, charge: 10, hits: [H(18, 20, 17, 10, 9, 19, 361, 38, 100, { t: 'fire' }), H(18, 20, 8, 10, 5, 15, 361, 35, 96, { t: 'fire' })], anim: A.smashF(10, 18, 20, 54) },
      usmash: { len: 50, charge: 8, hits: [H(12, 13, 3, 14, 7, 4, 90, 100, 0, { t: 'fire', link: 1 }), H(16, 20, 2, 24, 8, 14, 88, 38, 104, { t: 'fire', g: 1 }), H(16, 20, 2, 32, 6, 13, 88, 36, 100, { t: 'fire', g: 1 })], anim: A.smashU(8, 13, 20, 50) },
      dsmash: { len: 50, charge: 6, hits: [H(12, 14, 13, 3, 6.5, 15, 30, 32, 98, { t: 'fire' }), H(12, 14, -13, 3, 6.5, 15, 150, 32, 98, { t: 'fire' })], anim: A.smashD(6, 12, 14, 50) },
      // Armure Psy : dôme psychique qui RENVOIE les projectiles pendant qu'il frappe
      nair: { aerial: 1, len: 40, landLag: 8, ac: [4, 28], reflect: [4, 16, 0, 10, 13], hits: [H(5, 15, 0, 10, 10, 1.6, 361, 0, 0, { t: 'psychic', rehit: 3, link: 1, hs: 8, noTrail: 1 }), H(17, 18, 0, 10, 11, 6, 361, 45, 100, { t: 'psychic', g: 1 })], anim: [[0, {}], [4, { aF: 130, aB: 130, glow: 1, sq: 0.95 }], [16, { aF: 130, aB: 130, glow: 1 }], [17, { aF: 170, aB: 170, sq: 1.1, eye: 1 }], [40, {}]] },
      // Canonnade : tir devant qui le fait reculer (recul = espacement)
      fair: { aerial: 1, len: 36, landLag: 10, ac: [3, 26], tick: fairTick, hits: [H(8, 10, 14, 10, 6.5, 10, 42, 32, 88, { t: 'fire', burn: 60 }), H(8, 10, 8, 10, 5, 8, 42, 30, 84, { t: 'fire' })], anim: [[0, {}], [6, { aF: 90, aB: 70, cannon: 1, lean: 4 }], [8, { aF: 95, aB: 70, cannon: 1, lean: -16, eye: 1 }], [16, { aF: 92, lean: -8 }], [36, {}]] },
      // Réacteur Arrière : tir derrière qui le propulse vers l'avant (approche / récupération)
      bair: { aerial: 1, len: 38, landLag: 11, ac: [4, 29], tick: bairTick, hits: [H(9, 11, -14, 9, 7, 14, 361, 35, 100, { t: 'fire' })], anim: [[0, {}], [8, { aF: 150, lean: 10 }], [9, { aF: -100, eF: 0, lean: 18, eye: 1 }], [14, { aF: -95, lean: 12 }], [38, {}]] },
      // Canon Zénith : rafale vers le haut, le dernier tir le plaque vers le sol
      uair: { aerial: 1, len: 38, landLag: 10, ac: [3, 28], tick: uairTick, hits: [H(6, 14, 0, 21, 6.5, 2, 90, 0, 0, { t: 'fire', rehit: 4, link: 1, hs: 10 }), H(16, 17, 0, 22, 7.5, 5, 85, 40, 110, { t: 'fire', g: 1 })], anim: [[0, {}], [5, { aF: 175, aB: 150, cannon: 1 }], [16, { aF: 178, aB: 160, cannon: 1, sq: 1.05 }], [22, { aF: 170 }], [38, {}]] },
      dair: { aerial: 1, len: 42, landLag: 12, ac: [4, 32], tick: (S, f, af) => { if (af === 12) { f.vy = Math.max(f.vy, 1.6); f.ff = false; G.sfx(S, f, 'fire'); } }, hits: [H(12, 14, 0, -4, 6.5, 12, 270, 25, 85, { t: 'fire' })], anim: [[0, {}], [11, { aF: 10, aB: 10, lean: 5 }], [12, { aF: 0, aB: 0, sq: 1.1, lean: 0 }], [20, { aF: 5 }], [42, {}]] },
      nspec: { len: 36, tick: cannonTick, grav: 0.4, drift: 0.5, land: 'keep', anim: (f) => [[0, {}], [8, { aF: 90, aB: 60, cannon: 1, lean: -4 }], [9, { aF: 90, aB: 60, cannon: 1 }], [10, { aF: 90, aB: 40, cannon: 1, lean: -12 }], [16, { aF: 90, aB: 40, cannon: 1, lean: -6 }], [36, {}]] },
      sspec: { len: 400, tick: flameTick, land: 'keep', grav: 0.4, drift: 0.4, anim: [[0, {}], [7, { aF: 90, aB: 70, cannon: 1 }], [400, { aF: 90, aB: 70, cannon: 1 }]] },
      uspec: { len: 60, helpless: 1, landLag: 20, ledge: 15, ledgeRising: 1, tick: jetTick, drift: 0, noGrav: (af) => af < 38, hits: [H(15, 35, 0, 9, 7, 10, 50, 50, 80, { t: 'fire' })], anim: [[0, { crouch: 0.4, aF: 20, aB: 20, glow: 1 }], [14, { crouch: 0.6, aF: 0, aB: 0, glow: 1 }], [15, { aF: -20, aB: -20, sq: 1.1 }], [36, { aF: -10, aB: -10 }], [60, {}]] },
      dspec: { len: 36, tick: psyTick, reflect: [6, 16, 0, 10, 16], armor: [6, 16, 80], onReflect: psyStore, onArmor: (S, f) => psyStore(S, f), hits: [H(10, 13, 0, 10, 11, 12, 50, 55, 85, { t: 'psychic', away: 1 }), H(10, 13, 0, 10, 20, 3, 40, 70, 0, { t: 'psychic', away: 1 })], anim: [[0, {}], [8, { aF: 40, aB: 40, crouch: 0.3, glow: 1 }], [10, { aF: 130, aB: 130, sq: 1.08, glow: 1 }], [20, { aF: 120, aB: 120 }], [36, {}]] },
      fthrow: { throw: 1, len: 32, rel: 12, dmg: 10, ang: 38, bkb: 62, kbg: 72, t: 'fire', hold: [[0, 1, 0], [10, 1.4, 0.2]], anim: [[0, { aF: 80, cannon: 1 }], [12, { aF: 90, cannon: 1, lean: -10 }], [32, {}]] },
      bthrow: { throw: 1, back: 1, len: 36, rel: 16, dmg: 9, ang: 45, bkb: 60, kbg: 72, hold: [[0, 1, 0], [8, 0, 0.9], [16, -1.5, 0.3]], anim: A.throwB },
      uthrow: { throw: 1, len: 40, rel: 18, dmg: 9, ang: 90, bkb: 60, kbg: 86, t: 'fire', hold: [[0, 1, 0], [14, 0.2, 1.3]], anim: [[0, { aF: 80 }], [14, { aF: 180, cannon: 1 }], [40, {}]] },
      dthrow: { throw: 1, len: 38, rel: 18, dmg: 7, ang: 70, bkb: 65, kbg: 42, t: 'fire', hold: [[0, 1, 0], [14, 0.9, -0.1]], anim: A.throwD },
      taunt: { len: 70, anim: [[0, {}], [12, { aF: 175, aB: -20, cannon: 1, glow: 1 }], [55, { aF: 175, aB: -20, cannon: 1, glow: 1 }], [70, {}]] },
    },
    pose(P, f, S) {
      if (f.action === 'move' && f.move === 'nspec' && f.af >= 8 && f.af <= 16) { const a = f.mv.aim || 0; P.aF = 90 + a; P.aB = 60 + a * 0.5; P.charge = (f.mv.c || 0) / MAXC; P.hd = a * 0.3; }
      if (f.action === 'move' && f.move === 'sspec') { P.aF = 90 + (f.mv.a || 0); }
      if (f.action === 'move' && f.move === 'uspec' && f.af >= 15 && f.af < 36) { P.rot = U.datan2(f.mv.dx * f.facing, f.mv.dy); }
      if (f.v.store > 0) P.stored = f.v.store / MAXC;
    },
    draw(ctx, P, c, f, S, t) {
      const cr = P.crouch || 0, tu = P.tuck || 0;
      ctx.save();
      ctx.scale(1 + cr * 0.08, 1 - cr * 0.28);
      const hip = [0, 7.8];
      const rot = (x, y) => { ctx.translate(x, y); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-x, -y); };
      const lF = U.lerp(P.lF, 70, tu), lB = U.lerp(P.lB, 50, tu), kF = U.lerp(P.kF, 110, tu), kB = U.lerp(P.kB, 110, tu);
      const glowK = Math.max(P.charge || 0, P.stored || 0);
      const cannon = (sx, sy, a, e, col, front) => {
        const L = D.limb(ctx, sx, sy, a, -(e || 0) * 0.4, 3.2, 0.1, 2.3, 2.3, col);
        const [dx, dy] = D.dir(a - (e || 0) * 0.4);
        const ex = L.jx + dx * 5.4, ey = L.jy + dy * 5.4;
        D.seg(ctx, L.jx, L.jy, ex, ey, 3.4, col, 3.0);
        // anneau doré + bouche du canon
        const nx = -dy, ny = dx;
        D.seg(ctx, L.jx + dx * 1.2 + nx * 1.7, L.jy + dy * 1.2 + ny * 1.7, L.jx + dx * 1.2 - nx * 1.7, L.jy + dy * 1.2 - ny * 1.7, 0.8, c.gold);
        D.ell(ctx, ex, ey, 1.35, 1.35, 0, c.inner);
        if (front && glowK > 0) {
          ctx.fillStyle = `rgba(255,${180 - glowK * 80},60,${0.35 + glowK * 0.5 + 0.1 * Math.sin(t * 30)})`;
          ctx.beginPath(); ctx.arc(ex + dx * 0.5, ey + dy * 0.5, 1.2 + glowK * 2.4, 0, 7); ctx.fill();
        }
        return { ex, ey };
      };
      // bras-canon arrière
      ctx.save(); rot(hip[0], hip[1]);
      cannon(-1.6, 13.6, P.aB, P.eB, c.arm2, 0);
      ctx.restore();
      // jambe arrière
      const bl = D.limb(ctx, -0.8, hip[1], lB, kB, 4, 3.9, 2.3, 1.9, c.arm2);
      D.ell(ctx, bl.ex + 0.7, bl.ey + 0.2, 1.8, 0.9, 0, c.inner);
      ctx.save(); rot(hip[0], hip[1]);
      // cape psychique
      ctx.fillStyle = 'rgba(160,80,255,0.35)';
      ctx.beginPath(); ctx.moveTo(-2.5, 15); ctx.quadraticCurveTo(-7 - Math.sin(t * 4) * 0.8, 10, -5.5, 5 + Math.sin(t * 3) * 0.6); ctx.lineTo(-2, 8); ctx.closePath(); ctx.fill();
      // bassin + torse
      D.poly(ctx, [-3, 8.8, 3, 8.8, 3.6, 6.4, -3.6, 6.4], c.arm2);
      D.blob(ctx, [-3.2, 8.6, 3.0, 8.6, 3.9, 12, 3.2, 15.6, -3.2, 15.6, -3.9, 12], D.shade(ctx, 0, 12, 5, c.arm));
      D.poly(ctx, [-1.4, 13.8, 2.2, 13.8, 1.8, 10.2, 0.4, 9.4, -1.0, 10.2], c.gold);
      D.circ(ctx, 0.4, 11.8, 1.0, c.gem);
      // épaulière arrière
      D.ell(ctx, -1.6, 15.0, 2.6, 1.8, 10, D.shade(ctx, -1.6, 15, 2.6, c.arm2));
      // tête / casque
      ctx.save(); ctx.translate(0.7, 18.0); ctx.rotate(-(P.hd || 0) * Math.PI / 180);
      // crête enflammée
      const fl = Math.sin(t * 14) * 0.4;
      D.poly(ctx, [-1.8, 1.8, -3.4, 5.4 + fl, -0.6, 3.2, 0.2, 6.0 - fl, 1.2, 3.0, 3.0, 4.4 + fl, 2.0, 1.6], c.flame);
      D.blob(ctx, [-2.6, -1.6, 2.8, -1.6, 3.0, 1.2, 1.2, 2.8, -1.4, 2.8, -2.8, 1.0], D.shade(ctx, 0, 0.5, 3, c.arm));
      D.poly(ctx, [-2.8, 0.9, 3.0, 1.1, 2.8, 0.3, -2.6, 0.2], c.gold);
      D.poly(ctx, [0.2, -0.5, 3.2, -0.2, 3.0, -1.4, 0.4, -1.5], c.inner);
      const ex = P.eye;
      ctx.fillStyle = c.eye;
      if (ex === 2 || ex === 3) { ctx.fillRect(1.0, -1.05, 1.6, 0.25); }
      else { D.poly(ctx, [1.0, -0.7, 2.7, (ex === 1 ? -0.4 : -0.6), 2.6, -1.1, 1.1, -1.1], c.eye, true); }
      ctx.restore();
      ctx.restore();
      // jambe avant
      const fl2 = D.limb(ctx, 0.9, hip[1], lF, kF, 4, 3.9, 2.4, 2.0, c.arm);
      D.circ(ctx, (hip[0] + 0.9 + fl2.jx) / 2 + 0.3, fl2.jy, 0.9, c.gold);
      D.ell(ctx, fl2.ex + 0.8, fl2.ey + 0.2, 1.9, 0.95, 0, c.inner);
      // épaulière + bras-canon avant
      ctx.save(); rot(hip[0], hip[1]);
      const cn = cannon(1.8, 13.6, P.aF, P.eF, c.arm, 1);
      D.ell(ctx, 1.8, 15.0, 2.8, 2.0, -10, D.shade(ctx, 1.8, 15, 2.8, c.arm));
      ctx.strokeStyle = c.gold; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.ellipse(1.8, 15.0, 2.8, 2.0, -0.17, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      void cn;
      ctx.restore();
      ctx.restore();
    },
    drawFx(ctx, f, S, t) {
      // Ligne de visée du canon pendant la charge
      if (f.action === 'move' && f.move === 'nspec' && f.af >= 8 && f.af <= 9) {
        const st = G.ST(f), a = f.mv.aim || 0, k = (f.mv.c || 0) / MAXC;
        const x0 = f.x + f.facing * U.dcos(a) * 8, y0 = f.y + st.h * 0.55 + U.dsin(a) * 8;
        const L = (34 + (f.mv.c || 0) * 0.5) * (2.7 + k * 1.5);
        ctx.strokeStyle = `rgba(255,${200 - k * 120},60,${0.3 + k * 0.5})`; ctx.lineWidth = 0.5; ctx.setLineDash([2.5, 2]);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + f.facing * U.dcos(a) * L, y0 + U.dsin(a) * L); ctx.stroke(); ctx.setLineDash([]);
      }
      if (f.action === 'move' && f.move === 'nair' && f.af >= 4 && f.af <= 18) {
        const st = G.ST(f);
        ctx.strokeStyle = `rgba(220,120,255,${0.55 + 0.25 * Math.sin(t * 30)})`; ctx.lineWidth = 0.7; ctx.fillStyle = 'rgba(200,100,255,0.14)';
        ctx.beginPath(); ctx.arc(f.x, f.y + st.h * 0.52, 13, 0, 7); ctx.fill(); ctx.stroke();
      }
      if (f.action === 'move' && f.move === 'dspec' && f.af >= 9 && f.af <= 16) {
        const st = G.ST(f), k = (f.af - 9) / 7;
        ctx.strokeStyle = `rgba(220,120,255,${0.8 * (1 - k)})`; ctx.lineWidth = 1.2 * (1 - k) + 0.2;
        ctx.beginPath(); ctx.arc(f.x, f.y + 10, 8 + k * 14, 0, 7); ctx.stroke();
        ctx.fillStyle = `rgba(200,100,255,${0.25 * (1 - k)})`; ctx.fill();
      }
    },
    fx(e, R) {
      if (e.boom) {
        const r = e.r || 8;
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 16, max: 16, size: r * 1.2, col: '#ffcf4a' });
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 22, max: 22, size: r * 1.6, col: '#c86bff' });
        for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, s = Math.random() * r * 0.25; R.parts.push({ ty: 'flame', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 18 + Math.random() * 10, max: 28, size: 1.5 + Math.random() * 1.5, col: Math.random() < 0.5 ? 'rgba(255,200,60,0.9)' : 'rgba(255,90,30,0.9)' }); }
        R.cam.shake = Math.max(R.cam.shake, r * 0.4);
      }
      if (e.trailF) R.parts.push({ ty: 'flame', x: e.x, y: e.y, vx: 0, vy: 0.1, life: 12, max: 12, size: 1.6, col: 'rgba(255,140,40,0.7)' });
      if (e.flame) for (let i = 0; i < 3; i++) R.parts.push({ ty: 'flame', x: e.x, y: e.y, vx: e.dx * (1.6 + Math.random() * 1.2) + (Math.random() - 0.5) * 0.5, vy: e.dy * 1.8 + (Math.random() - 0.5) * 0.6, life: 14, max: 14, size: 1.8 + Math.random(), col: Math.random() < 0.5 ? 'rgba(255,200,60,0.85)' : 'rgba(255,90,30,0.85)' });
      if (e.psyStore) { R.parts.push({ ty: 'ring', x: e.x, y: e.y + 10, life: 20, max: 20, size: 14, col: '#ffcf4a' }); R.spark(e.x, e.y + 12, '#ffcf4a', 12, 2); }
      if (e.psy) R.parts.push({ ty: 'ring', x: e.x, y: e.y + 10, life: 14, max: 14, size: 20, col: '#d890ff' });
    },
    hud(ctx, f, S, x, y, pw, ph, u) {
      if (f.v.store > 0) { ctx.fillStyle = '#ffb84a'; ctx.font = `900 ${10 * u}px Rubik, sans-serif`; ctx.textAlign = 'left'; ctx.fillText('CANON ' + Math.round(f.v.store / MAXC * 100) + '%', x + ph + 2 * u, y + 43 * u); }
    },
  });
})(window.G);
