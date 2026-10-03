'use strict';
// MALVALAME — épéiste spectral : combos à la lame, Cisaille Spectrale (dash qui traverse puis coupe en X,
// réutilisable en l'air si elle touche), Coupe Psycho chargeable, Nitrocharge (chaque touche = +vitesse),
// Lame Amère (remontée qui soigne), contre.
(function (G) {
  const U = G.U, D = G.D, H = G.H, A = G.A;
  const B = (o) => Object.assign({ t: 'blade' }, o || {});

  function addNitro(S, f) {
    const lvl = Math.min(3, (f.v.nitro || 0) + 1);
    f.v.nitro = lvl; f.v.form = 'n' + lvl; f.v.nitroT = 600;
    G.sfx(S, f, 'fire', { nitro: lvl });
  }
  G.PROJ.psycut = {
    draw(ctx, p, t) {
      const big = p.v.big;
      ctx.scale(p.vx >= 0 ? 1 : -1, 1);
      const r = p.r * 1.6;
      ctx.globalAlpha = 0.9;
      for (let k = 0; k < (big ? 2 : 1); k++) {
        ctx.save(); if (big) ctx.rotate(k ? 0.5 : -0.5);
        const g = ctx.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, 'rgba(120,60,255,0)'); g.addColorStop(0.6, 'rgba(190,110,255,0.9)'); g.addColorStop(1, '#ffe6ff');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(-r * 0.5, 0, r, -1.2, 1.2); ctx.arc(-r * 0.9, 0, r * 0.9, 1.1, -1.1, true); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };

  function psycutTick(S, f, af, inp) {
    if (af === 1) f.mv.c = 0;
    if (af === 8 && inp.held(G.BTN.SPC) && f.mv.c < 40) { f.mv.c++; f.af = 7; if (f.mv.c === 40) G.sfx(S, f, 'magic'); if (!f.grounded) f.vy = Math.max(f.vy, -0.5); return; }
    if (af === 9) {
      const c = f.mv.c, st = G.ST(f), big = c >= 40;
      G.spawnProj(S, f, 'psycut', {
        x: f.x + f.facing * 7, y: f.y + st.h * 0.55, vx: f.facing * 3.4, vy: 0, r: 3 + c * 0.08, life: 38,
        dmg: 5 + c * 0.2, ang: 45, bkb: 35 + c * 0.3, kbg: 50 + c, t: 'blade', pierce: big, v: { big: big ? 1 : 0 },
      });
      G.sfx(S, f, 'slash');
    }
  }
  function scissorTick(S, f, af) {
    if (af === 1) {
      if (!f.grounded) { if ((f.v.cis || 0) >= 2) { G.setAction(f, 'air'); return 'stop'; } f.v.cis = (f.v.cis || 0) + 1; }
      G.sfx(S, f, 'slash');
    }
    if (af >= 8 && af <= 17) { f.vx = f.facing * 4.0; if (!f.grounded) f.vy = 0; }
    else if (af === 18) f.vx = f.facing * 1.2;
    else if (af > 18) f.vx = U.approach(f.vx, 0, 0.15);
    if (af === 20) G.sfx(S, f, 'slash');
    if (af === 23 && f.mv.hit && f.v.cis > 0) f.v.cis--; // si ça touche, on peut enchaîner une autre cisaille
  }
  function bitterTick(S, f, af, inp) {
    if (af === 5) { f.grounded = false; f.plat = null; G.sfx(S, f, 'slash'); }
    if (af >= 5 && af <= 24) { f.vy = 2.9 - (af - 5) * 0.03; f.vx = U.approach(f.vx, inp.sx * 1.0, 0.1); }
  }
  // Écho spectral : certaines coupes laissent une lame fantôme qui re-frappe au même endroit ~1/4 s plus tard
  const echo = (af0, o) => (S, f, af) => { if (af === af0) G.spawnEcho(S, f, Object.assign({ t: 'ghost', col: '#c08aff', sfx: 'slash' }, o)); };
  const nairEcho = echo(8, { x: 0, y: 9, r: 10, delay: 14, dur: 4, dmg: 4, ang: 361, bkb: 42, kbg: 62, style: 'ring' });
  const fairEcho = echo(9, { x: 12, y: 9, r: 7.5, delay: 16, dur: 4, dmg: 5, ang: 50, bkb: 45, kbg: 72, style: 'x' });
  const uairEcho = echo(7, { x: 0, y: 26, r: 8, delay: 15, dur: 4, dmg: 5, ang: 88, bkb: 45, kbg: 82, style: 'slash' });
  // Estoc Amer (bas + A en l'air) : il se fige, puis plonge lame en bas ; s'il touche, il se soigne et rebondit
  function stabTick(S, f, af) {
    if (af < 6) { f.vy = Math.max(f.vy, 0.3); f.vx *= 0.9; }
    if (af === 6) { f.vy = -3.3; f.ff = true; G.sfx(S, f, 'slash'); }
  }
  function counterHit(S, me, att, hb) {
    if (att) me.facing = att.x >= me.x ? 1 : -1;
    G.startMove(S, me, 'dspecHit');
    me.mv.dmg = Math.max(9, (hb.dmg || 0) * 1.35);
    G.sfx(S, me, 'counter');
  }

  G.registerChar({
    id: 'malvalame', name: 'Malvalame', short: 'Malvalame', dex: 937, color: '#8a5cff', trail: '#d6a8ff',
    desc: 'Épéiste spectral. Cisaille Spectrale (côté B) : dash qui traverse et coupe en X, réutilisable s\'il touche. Attaque en courant = Nitrocharge (+vitesse).',
    stats: {
      weight: 98, h: 19, w: 8.5, walk: 1.2, dash: 2.05, dashF: 11, run: 1.95, runAcc: 0.12, traction: 0.11,
      air: 1.08, airAcc: 0.075, grav: 0.095, fall: 1.65, ffall: 2.64, fullHop: 33, shortHop: 15.5, dJump: 31,
    },
    formStats: {
      n1: { walk: 1.3, dash: 2.2, run: 2.12, air: 1.16 },
      n2: { walk: 1.4, dash: 2.35, run: 2.3, air: 1.24, airAcc: 0.085 },
      n3: { walk: 1.5, dash: 2.5, run: 2.5, air: 1.32, airAcc: 0.095 },
    },
    palettes: [
      { name: 'Normal', arm: '#2c2542', arm2: '#4b3f73', blade: '#b45cff', edge: '#ffd1ff', flame: '#6a5cff', eye: '#ffe066', cape: '#3a2a6a' },
      { name: 'Chromatique', arm: '#3a2230', arm2: '#6a3a50', blade: '#ff5a8a', edge: '#ffe0ea', flame: '#ff7a5a', eye: '#7af0ff', cape: '#5a2a3a' },
      { name: 'Spectre bleu', arm: '#1c2a42', arm2: '#35507a', blade: '#4ac8ff', edge: '#e0fbff', flame: '#4a8aff', eye: '#ffe066', cape: '#1f3a5a' },
      { name: 'Braise', arm: '#2a1e1a', arm2: '#5a3a2a', blade: '#ff8a2a', edge: '#fff0c0', flame: '#ff4a2a', eye: '#b7ff5a', cape: '#4a2a1a' },
    ],
    init(f) { f.v.nitro = 0; f.v.nitroT = 0; f.v.cis = 0; },
    passive(S, f) {
      if (f.v.nitroT > 0 && --f.v.nitroT === 0) { f.v.nitro = 0; f.v.form = null; }
      if (f.grounded || f.action === 'ledge') f.v.cis = 0;
    },
    onKO(S, f) { f.v.nitro = 0; f.v.nitroT = 0; f.v.form = null; },
    moves: {
      jab: { len: 16, iasa: 14, next: ['jab2', 4, 14], hits: [H(3, 4, 9, 10, 4, 2.5, 361, 20, 22, B())], anim: A.jab(3, 4, 16) },
      jab2: { len: 17, next: ['jab3', 5, 15], hits: [H(3, 4, 10, 10, 4, 2.5, 361, 22, 22, B())], anim: A.jab2(3, 4, 17) },
      jab3: { len: 36, hits: [H(4, 22, 11, 10, 6, 1, 361, 0, 0, B({ rehit: 3, link: 1, hs: 8 })), H(26, 27, 12, 10, 7, 4, 361, 55, 110, B({ g: 1 }))], anim: [[0, {}], [4, { aF: 100, aB: 60, lean: 10 }], [8, { aF: 60, aB: 110 }], [12, { aF: 110, aB: 50 }], [16, { aF: 60, aB: 110 }], [20, { aF: 110, aB: 50 }], [25, { aF: -40, lean: -6 }], [26, { aF: 110, lean: 14, eye: 1 }], [36, {}]] },
      ftilt: { len: 30, hitCancel: 18, hits: [H(7, 8, 12, 9, 5.5, 5, 45, 30, 30, B()), H(14, 15, 13, 10, 6, 7, 40, 40, 95, B({ g: 1 }))], anim: [[0, {}], [6, { aF: 170, lean: -6 }], [7, { aF: 60, lean: 12 }], [12, { aB: 170 }], [14, { aB: 60, aF: 90, lean: 14, eye: 1 }], [30, {}]] },
      utilt: { len: 28, hitCancel: 14, hits: [H(6, 11, 3, 22, 7, 8, 92, 45, 85, B()), H(6, 11, 8, 15, 5, 7, 100, 45, 80, B())], anim: A.upSwing(6, 11, 28) },
      dtilt: { len: 20, hurtH: 0.62, hitCancel: 10, hits: [H(5, 6, 13, 2, 4.5, 6, 75, 40, 30, B({ trip: 1 }))], anim: A.lowPoke(5, 6, 20) },
      dashAtk: { len: 38, keepVel: 1, tick: G.dashAtkTick, hits: [H(6, 16, 7, 9, 6.5, 10, 60, 55, 70, { t: 'fire', onHit: (S, a) => addNitro(S, a) })], anim: [[0, { lean: 15 }], [6, { lean: 32, aF: 60, aB: 40, glow: 1, eye: 1 }], [16, { lean: 28, glow: 1 }], [38, {}]] },
      fsmash: { len: 52, charge: 10, hits: [H(16, 18, 16, 10, 7.5, 18, 361, 38, 100, B()), H(16, 18, 8, 10, 5, 14, 361, 35, 96, B())], anim: A.overhead(10, 16, 18, 52) },
      usmash: { len: 48, charge: 8, hits: [H(11, 12, 4, 18, 7, 4, 90, 100, 0, B({ link: 1 })), H(14, 17, 1, 25, 8, 15, 90, 38, 104, B({ g: 1 }))], anim: A.smashU(8, 12, 17, 48) },
      dsmash: { len: 48, charge: 5, hits: [H(10, 11, 13, 3, 6, 14, 30, 32, 98, B()), H(14, 15, -13, 3, 6, 14, 150, 32, 98, B({ g: 1 }))], anim: A.smashD(5, 10, 15, 48) },
      // Cercle Maudit : tourbillon des deux lames + écho en anneau
      nair: { aerial: 1, len: 36, landLag: 7, ac: [4, 26], tick: nairEcho, hits: [H(5, 8, 0, 9, 10, 8, 361, 30, 88, B()), H(9, 14, 0, 9, 9, 5, 361, 20, 78, B())], anim: A.spinArms(5, 14, 36) },
      // Taille Croisée : coupe en X devant + écho en X qui re-frappe
      fair: { aerial: 1, len: 38, landLag: 9, ac: [3, 28], tick: fairEcho, hits: [H(7, 9, 12, 13, 5.5, 5, 50, 32, 60, B()), H(7, 9, 12, 5, 5.5, 5, 50, 32, 60, B()), H(7, 9, 11, 9, 5, 6, 45, 34, 80, B())], anim: [[0, {}], [5, { aF: 175, aB: 20, lean: -6 }], [7, { aF: 30, aB: 165, lean: 14, eye: 1, glow: 1 }], [14, { aF: 40, aB: 150, lean: 10 }], [38, {}]] },
      bair: { aerial: 1, len: 36, landLag: 10, ac: [4, 27], hits: [H(9, 11, -15, 9, 4, 16, 361, 34, 104, B()), H(9, 11, -8, 9, 5, 11, 361, 30, 92, B())], anim: [[0, {}], [8, { aB: 60, lean: 10 }], [9, { aB: -110, lean: -12, eye: 1 }], [14, { aB: -100 }], [36, {}]] },
      // Lame Montante : arc au-dessus de la tête + écho plus haut (jonglage)
      uair: { aerial: 1, len: 32, landLag: 8, ac: [3, 24], tick: uairEcho, hits: G.ARC(5, 9, 0, 11, 11, 20, 160, 4, 6, 8, 88, 40, 96, B()), anim: A.uairSwipe(5, 9, 32) },
      // Estoc Amer : plongeon lame en bas, soigne 3 % et rebondit s'il touche
      dair: { aerial: 1, len: 46, landLag: 13, ac: [4, 38], tick: stabTick, hits: [H(6, 30, 0, -2, 6, 10, 75, 45, 55, B({ onHit: (S, a) => { a.vy = 2.6; a.ff = false; a.percent = Math.max(0, a.percent - 3); a.flash = 5; } }))], anim: [[0, {}], [5, { aF: 170, aB: 170, tuck: 0.4 }], [6, { aF: 0, aB: 0, sq: 1.1, glow: 1, eye: 1 }], [30, { aF: 0, aB: 0, glow: 1 }], [46, {}]] },
      nspec: { len: 34, tick: psycutTick, land: 'keep', grav: 0.5, anim: [[0, {}], [7, { aF: 200, aB: 180, lean: -8, glow: 1 }], [8, { aF: 200, aB: 180, lean: -8, glow: 1 }], [9, { aF: 70, aB: 60, lean: 14, eye: 1 }], [34, {}]] },
      sspec: { len: 40, tick: scissorTick, intang: [8, 12], keepVel: 1, offEdge: 1, land: 'keep', drift: 0, noGrav: (af) => af >= 8 && af <= 18, ledge: 18,
        hits: [H(8, 17, 4, 9, 6.5, 3, 60, 0, 0, B({ link: 1, hs: 16 })), H(20, 22, 10, 9, 8.5, 9, 40, 58, 90, B({ g: 1 }))],
        anim: [[0, { aF: 30, aB: -30, crouch: 0.3 }], [7, { aF: 150, aB: 150, lean: -8, glow: 1 }], [8, { aF: 100, aB: -80, lean: 30, glow: 1 }], [18, { aF: 100, aB: -80, lean: 28 }], [20, { aF: 30, aB: 150, lean: 10, eye: 1 }], [21, { aF: 150, aB: 30 }], [40, {}]] },
      uspec: { len: 46, helpless: 1, landLag: 20, ledge: 16, tick: bitterTick, drift: 0, noGrav: (af) => af >= 5 && af <= 24,
        hits: [H(5, 24, 0, 11, 8.5, 1.5, 90, 0, 0, B({ rehit: 4, link: 1, hs: 10, onHit: (S, a) => { a.percent = Math.max(0, a.percent - 0.7); } })), H(27, 29, 0, 16, 9, 6, 80, 55, 92, B({ g: 1, onHit: (S, a) => { a.percent = Math.max(0, a.percent - 3); } }))],
        anim: [[0, { crouch: 0.4 }], [5, { aF: 175, aB: 175, sq: 1.08, glow: 1 }], [24, { aF: 175, aB: 175, glow: 1 }], [28, { aF: 60, aB: 60 }], [46, {}]] },
      dspec: { len: 44, counter: [5, 24], onCounter: counterHit, anim: A.counter(44) },
      dspecHit: { len: 30, intang: [1, 12], tick: (S, f, af) => { if (af >= 6 && af <= 8) G.pendingHitbox(S, f, { x: 10, y: 9, r: 9, dmg: f.mv.dmg || 9, ang: 40, bkb: 60, kbg: 95, t: 'blade' }); }, anim: [[0, { aF: 170, aB: 170, glow: 1 }], [6, { aF: 60, aB: 60, lean: 16, eye: 1, glow: 1 }], [30, {}]] },
      fthrow: { throw: 1, len: 30, rel: 12, dmg: 8, ang: 42, bkb: 62, kbg: 64, t: 'blade', hold: [[0, 1, 0], [10, 1.4, 0.2]], anim: A.throwF },
      bthrow: { throw: 1, back: 1, len: 36, rel: 16, dmg: 10, ang: 42, bkb: 60, kbg: 76, t: 'blade', hold: [[0, 1, 0], [8, 0, 0.9], [16, -1.5, 0.3]], anim: A.throwB },
      uthrow: { throw: 1, len: 36, rel: 16, dmg: 8, ang: 90, bkb: 65, kbg: 74, t: 'blade', hold: [[0, 1, 0], [12, 0.2, 1.3]], anim: A.throwU },
      dthrow: { throw: 1, len: 34, rel: 16, dmg: 6, ang: 70, bkb: 70, kbg: 38, t: 'blade', hold: [[0, 1, 0], [12, 0.9, -0.1]], anim: A.throwD },
      taunt: { len: 70, anim: [[0, {}], [12, { aF: 180, aB: -30, glow: 1, eye: 3 }], [55, { aF: 180, aB: -30, glow: 1, eye: 3 }], [70, {}]] },
    },
    draw(ctx, P, c, f, S, t) {
      const cr = P.crouch || 0, tu = P.tuck || 0;
      ctx.save();
      ctx.scale(1 + cr * 0.08, 1 - cr * 0.28);
      const hip = [0, 7.6];
      const rot = (x, y) => { ctx.translate(x, y); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-x, -y); };
      const lF = U.lerp(P.lF, 70, tu), lB = U.lerp(P.lB, 50, tu), kF = U.lerp(P.kF, 110, tu), kB = U.lerp(P.kB, 110, tu);
      const glow = P.glow || (f.action === 'move' ? 0.4 : 0);
      const armBlade = (sx, sy, a, e, col, front) => {
        const L = D.limb(ctx, sx, sy, a, -(e || 0), 3.3, 3.2, 1.9, 1.7, col);
        const [dx, dy] = D.dir(L.a2);
        const nx = -dy, ny = dx;
        const bx = L.ex, by = L.ey, len = 8.2;
        // lame spectrale
        const g = ctx.createLinearGradient(bx, by, bx + dx * len, by + dy * len);
        g.addColorStop(0, U.shade(c.blade, -0.2)); g.addColorStop(0.7, c.blade); g.addColorStop(1, c.edge);
        ctx.save();
        if (glow) { ctx.shadowColor = c.blade; ctx.shadowBlur = 6 * glow; }
        D.poly(ctx, [bx + nx * 0.9, by + ny * 0.9, bx + dx * len + nx * 0.2, by + dy * len + ny * 0.2, bx + dx * (len + 1.4), by + dy * (len + 1.4), bx - nx * 0.7, by - ny * 0.7], g);
        ctx.restore();
        ctx.strokeStyle = c.edge; ctx.lineWidth = 0.25; ctx.beginPath(); ctx.moveTo(bx + nx * 0.6, by + ny * 0.6); ctx.lineTo(bx + dx * (len + 1), by + dy * (len + 1)); ctx.stroke();
        D.circ(ctx, bx, by, 1.05, U.shade(col, 0.15));
        return L;
      };
      // bras + lame arrière
      ctx.save(); rot(hip[0], hip[1]);
      armBlade(-1.3, 13.2, P.aB, P.eB, U.shade(c.arm, -0.1), 0);
      ctx.restore();
      // jambe arrière
      const bl = D.limb(ctx, -0.7, hip[1], lB, kB, 3.9, 3.8, 2.0, 1.6, U.shade(c.arm, -0.1));
      D.poly(ctx, [bl.ex - 0.8, bl.ey + 0.4, bl.ex + 2.0, bl.ey, bl.ex - 0.6, bl.ey - 0.3], c.arm2);
      ctx.save(); rot(hip[0], hip[1]);
      // cape de flammes spectrales (robe)
      const w = Math.sin(t * 6) * 0.6;
      D.blob(ctx, [-3.4, 9.5, 2.8, 9.5, 3.6, 5.6 + w, 1.4, 4.2, -1.2, 5.2 - w, -3.8, 3.8 + w, -4.4, 7], D.lin(ctx, 0, 9.5, 0, 3.5, c.cape, U.rgb(U.hex(c.flame), 0.55)));
      // torse en armure
      D.blob(ctx, [-2.8, 8.8, 2.6, 8.8, 3.3, 12.2, 2.7, 15.0, -2.7, 15.0, -3.3, 12.2], D.shade(ctx, 0, 12, 4.4, c.arm));
      D.poly(ctx, [-1.6, 14.2, 2.0, 14.2, 1.4, 10.6, 0.2, 9.6, -1.0, 10.6], c.arm2);
      ctx.strokeStyle = c.blade; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(0.2, 13.6); ctx.lineTo(0.2, 10.2); ctx.stroke();
      // tête / casque + plumet de flamme
      ctx.save(); ctx.translate(0.6, 17.2); ctx.rotate(-(P.hd || 0) * Math.PI / 180);
      const fl = Math.sin(t * 12) * 0.5;
      D.poly(ctx, [-1.2, 2.0, -5.5, 4.5 + fl, -6.8, 1.8 - fl, -3.2, 0.4], U.rgb(U.hex(c.flame), 0.85));
      D.poly(ctx, [-0.8, 2.2, -4.2, 5.4 - fl, -3.0, 2.0], U.rgb(U.hex(c.blade), 0.9));
      D.blob(ctx, [-2.3, -1.6, 2.5, -1.6, 2.8, 1.0, 1.0, 2.6, -1.6, 2.5, -2.6, 0.6], D.shade(ctx, 0, 0.5, 2.8, c.arm2));
      D.poly(ctx, [0.2, -0.3, 3.0, 0.0, 2.8, -1.2, 0.4, -1.3], '#0c0816');
      const ex = P.eye;
      if (ex === 2 || ex === 3) { ctx.fillStyle = c.eye; ctx.fillRect(1.0, -0.85, 1.5, 0.22); }
      else { ctx.save(); ctx.shadowColor = c.eye; ctx.shadowBlur = 3; D.poly(ctx, [1.0, -0.5, 2.6, ex === 1 ? -0.3 : -0.45, 2.5, -0.95, 1.1, -0.95], c.eye, true); ctx.restore(); }
      ctx.restore();
      ctx.restore();
      // jambe avant
      const fl2 = D.limb(ctx, 0.8, hip[1], lF, kF, 3.9, 3.8, 2.1, 1.7, c.arm);
      D.poly(ctx, [fl2.ex - 0.8, fl2.ey + 0.4, fl2.ex + 2.2, fl2.ey, fl2.ex - 0.6, fl2.ey - 0.3], c.arm2);
      // bras + lame avant
      ctx.save(); rot(hip[0], hip[1]);
      D.ell(ctx, 1.4, 14.6, 2.1, 1.5, -10, D.shade(ctx, 1.4, 14.6, 2, c.arm2));
      armBlade(1.6, 13.2, P.aF, P.eF, c.arm, 1);
      ctx.restore();
      ctx.restore();
    },
    drawFx(ctx, f, S, t) {
      if (f.v.nitro > 0 && (f.action === 'run' || f.action === 'dash' || !f.grounded) && S.frame % 3 === 0 && G.R.newFrame) {
        const st = G.ST(f);
        G.R.parts.push({ ty: 'flame', x: f.x - f.facing * 3, y: f.y + Math.random() * st.h * 0.7, vx: -f.facing * 0.4, vy: 0.3, life: 14, max: 14, size: 1 + f.v.nitro * 0.4, col: 'rgba(140,100,255,0.7)' });
      }
      if (f.action === 'move' && f.move === 'sspec' && f.af >= 8 && f.af <= 18) {
        const st = G.ST(f);
        ctx.strokeStyle = 'rgba(200,140,255,0.6)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(f.x - f.facing * 18, f.y + st.h * 0.5); ctx.lineTo(f.x, f.y + st.h * 0.5); ctx.stroke();
      }
    },
    fx(e, R) {
      if (e.nitro) R.parts.push({ ty: 'ring', x: e.x, y: e.y + 9, life: 16, max: 16, size: 8 + e.nitro * 3, col: '#9a7aff' });
    },
    hud(ctx, f, S, x, y, pw, ph, u) {
      if (f.v.nitro > 0) { ctx.fillStyle = '#b38aff'; ctx.font = `900 ${10 * u}px Rubik, sans-serif`; ctx.textAlign = 'left'; ctx.fillText('VITESSE ' + '»'.repeat(f.v.nitro), x + ph + 2 * u, y + 43 * u); }
    },
  });
})(window.G);
