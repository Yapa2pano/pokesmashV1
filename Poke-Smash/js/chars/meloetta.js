'use strict';
// MELOETTA — Chant Antique (bas B) : onde sonore qui endort brièvement puis change de forme.
// Forme Chant : psy, zoneuse, hitbox généreuses, gros knockback (Psyko à distance, Mégaphone).
// Forme Danse : ultra rapide, combos au corps à corps (Corps à Corps, Pirouette, Pied Sauté).
(function (G) {
  const U = G.U, D = G.D, H = G.H, A = G.A;
  const Ps = (o) => Object.assign({ t: 'psychic' }, o || {});
  const So = (o) => Object.assign({ t: 'sound' }, o || {});

  G.PROJ.psyko = {
    tick(S, p) { if (p.age === 18) { p.harmless = false; S.events.push({ t: 'sfx', name: 'magic', s: p.owner, psyk: 1, x: p.x, y: p.y, k: 'pk' + p.id }); } },
    draw(ctx, p, t) {
      if (p.age < 18) {
        const k = p.age / 18;
        ctx.strokeStyle = `rgba(255,120,220,${0.3 + k * 0.5})`; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(0, 0, 10 * (1.4 - k * 0.4), 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.moveTo(0, -3); ctx.lineTo(0, 3); ctx.stroke();
      } else {
        const k = (p.age - 18) / 6;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 11);
        g.addColorStop(0, `rgba(255,255,255,${1 - k})`); g.addColorStop(0.5, `rgba(255,110,220,${0.8 - k * 0.6})`); g.addColorStop(1, 'rgba(160,60,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 11 * (0.8 + k * 0.4), 0, 7); ctx.fill();
      }
    },
  };
  G.PROJ.voice = {
    tick(S, p) { p.r = 4 + p.age * 0.24; },
    draw(ctx, p) {
      const d = p.vx >= 0 ? 1 : -1;
      ctx.scale(d, 1);
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(90,230,170,${0.8 - i * 0.22})`; ctx.lineWidth = 0.8 - i * 0.2;
        ctx.beginPath(); ctx.arc(-i * 2.2, 0, p.r - i * 1.2, -0.9, 0.9); ctx.stroke();
      }
      ctx.fillStyle = '#1b1226'; ctx.font = '4px serif'; ctx.save(); ctx.scale(1, -1); ctx.fillText('♪', -2, 1); ctx.restore();
    },
  };

  // Note (projectile) : ♪ qui ondule, ou ♫ « basse » qui tombe et rebondit une fois
  G.PROJ.note = {
    tick(S, p) { if (p.v.wobble) p.vy = U.dsin(p.age * 14) * 0.4; },
    onStage(S, p) {
      if (p.v.bass && !p.v.bounced) { p.v.bounced = 1; p.y = S.stage.main.y + 0.5; p.vy = 2.0; S.events.push({ t: 'sfx', name: 'hammer', s: p.owner, x: p.x, y: p.y, k: 'nb' + p.id }); }
      else { p.dead = true; S.events.push({ t: 'poof', x: p.x, y: p.y, k: 'np' + p.id }); }
    },
    draw(ctx, p, t) {
      const big = p.v.bass;
      ctx.strokeStyle = big ? 'rgba(60,40,120,0.7)' : 'rgba(90,230,170,0.7)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(0, 0, p.r * (1 + 0.15 * Math.sin(t * 20)), 0, 7); ctx.stroke();
      ctx.save(); ctx.scale(1, -1); ctx.fillStyle = big ? '#2a1a4a' : '#1b1226'; ctx.font = (big ? 9 : 6) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(big ? '♫' : '♪', 0, 0); ctx.restore();
    },
  };
  // Onde Circulaire (A neutre en l'air, Chant) : un anneau sonore qui grandit et repousse
  function ringTick(S, f, af) {
    if (af === 6) G.sfx(S, f, 'magic');
    if (af >= 6 && af <= 14) G.pendingHitbox(S, f, { x: 0, y: 9, r: 4 + (af - 6) * 1.2, dmg: 6, ang: 50, bkb: 45, kbg: 62, t: 'sound', away: 1, noTrail: 1 });
  }
  function noteTick(S, f, af) { // Note Tenue (avant + A en l'air)
    if (af === 9) { const st = G.ST(f); G.spawnProj(S, f, 'note', { x: f.x + f.facing * 6, y: f.y + st.h * 0.6, vx: f.facing * 2.3, vy: 0, r: 2.8, life: 34, dmg: 7, ang: 45, bkb: 38, kbg: 70, t: 'sound', v: { wobble: 1 } }); G.sfx(S, f, 'magic'); }
  }
  function bassTick(S, f, af) { // Basse (bas + A en l'air) : une grosse note qui tombe
    if (af < 10) { f.vy = Math.max(f.vy, 0.3); f.vx *= 0.92; f.ff = false; }
    if (af === 10) { G.spawnProj(S, f, 'note', { x: f.x + f.facing * 1, y: f.y - 1, vx: f.facing * 0.3, vy: -2.6, grav: 0.04, r: 3.6, life: 60, dmg: 9, ang: 70, bkb: 45, kbg: 72, t: 'sound', v: { bass: 1 } }); G.sfx(S, f, 'ghost'); }
  }
  function relicTick(S, f, af) {
    if (!f.grounded) { f.vy = Math.max(f.vy, -0.5); f.vx *= 0.95; }
    if (af === 8) G.sfx(S, f, 'magic', { relic: 1 });
    if (af >= 8 && af <= 18) G.pendingHitbox(S, f, { x: 0, y: 9, r: 6 + (af - 8) * 0.9, dmg: 5, ang: 80, bkb: 45, kbg: 25, t: 'sound', stun: 42, noTrail: 1 });
    if (af === 22) { f.v.form = f.v.form === 'pir' ? null : 'pir'; f.flash = 10; G.sfx(S, f, 'transform', { swap: 1 }); }
  }
  const relic = { len: 34, land: 'keep', tick: relicTick, cond: (S, f) => (f.v.swapCd || 0) <= 0, start: (S, f) => { f.v.swapCd = 40; }, anim: [[0, {}], [6, { aF: 150, aB: 150, hd: 15, eye: 3, glow: 1 }], [22, { aF: 160, aB: 160, eye: 3, glow: 1 }], [26, { aF: 120, aB: -30 }], [34, {}]] };

  function psykoTick(S, f, af) {
    if (af === 12) {
      const st = G.ST(f);
      let tx = f.x + f.facing * 38, ty = f.y + st.h * 0.55, bd = 1e9;
      for (const t of S.fighters) {
        if (t === f || t.dead || t.out) continue;
        const dx = (t.x - f.x) * f.facing, d = U.len(t.x - f.x, t.y - f.y);
        if (dx > -8 && d < 85 && d < bd) { bd = d; tx = t.x; ty = t.y + G.ST(t).h * 0.5; }
      }
      G.spawnProj(S, f, 'psyko', { x: tx, y: ty, vx: 0, vy: 0, r: 10.5, life: 24, harmless: true, pierce: true, ghost: true, refl: false, clank: false, away: true, dmg: 13, ang: 55, bkb: 45, kbg: 92, t: 'psychic' });
      G.sfx(S, f, 'ghost');
    }
  }
  function voiceTick(S, f, af) {
    if (af === 11) {
      const st = G.ST(f);
      G.spawnProj(S, f, 'voice', { x: f.x + f.facing * 6, y: f.y + st.h * 0.6, vx: f.facing * 2.8, vy: 0, r: 4, life: 28, pierce: true, refl: false, clank: false, ghost: true, dmg: 8, ang: 45, bkb: 50, kbg: 70, t: 'sound' });
      G.sfx(S, f, 'magic');
    }
  }
  function tpTick(S, f, af, inp) {
    const st = G.ST(f);
    if (af === 4) { const m = U.len(inp.sx, inp.sy); f.mv.dx = m > 0.3 ? inp.sx / m : 0; f.mv.dy = m > 0.3 ? inp.sy / m : 1; f.grounded = false; f.plat = null; G.sfx(S, f, 'ghost'); }
    if (af >= 4 && af < 14) { f.vx = 0; f.vy = 0; }
    if (af === 13) {
      f.x += f.mv.dx * 50; f.y += f.mv.dy * 50;
      if (G.inBlock(S, f.x, f.y)) { const m = S.stage.main; if (f.y > m.y - 12) f.y = m.y + 0.1; else f.y = m.bottom - st.h - 1; }
      if (f.mv.dx) f.facing = f.mv.dx > 0 ? 1 : -1;
      G.sfx(S, f, 'magic', { notes: 1 });
    }
    if (af >= 14 && af <= 16) G.pendingHitbox(S, f, { x: 0, y: st.h * 0.5, r: 8, dmg: 5, ang: 80, bkb: 50, kbg: 60, t: 'sound' });
  }
  function ccTick(S, f, af) {
    if (af === 6) G.sfx(S, f, 'swing');
    if (af >= 6 && af <= 30) { f.vx = f.facing * (f.grounded ? 0.7 : 0.4); if (!f.grounded) f.vy = Math.max(f.vy, -0.3); if (af % 6 === 0) G.sfx(S, f, 'swing'); }
  }
  function pirTick(S, f, af) {
    if (af === 1 && !f.grounded) { if (f.v.pd) { G.setAction(f, 'air'); return 'stop'; } f.v.pd = 1; }
    if (af >= 5 && af <= 15) { f.vx = f.facing * 3.3; if (!f.grounded) f.vy = 0; }
    if (af === 5) G.sfx(S, f, 'swing');
    if (af > 16) f.vx = U.approach(f.vx, 0, 0.2);
  }
  // Pied Sauté (haut B forme Danse) : monte 30 % plus haut, sommet atteint au même moment
  // (vitesse verticale ×1,3, et gravité ×1,3 pendant la fin de la montée pour garder le même timing)
  const HJK_UP = 1.3;
  function hjkTick(S, f, af, inp) {
    if (af === 4) { f.grounded = false; f.plat = null; f.mv.a = 70 - U.clamp(inp.sx * f.facing, -1, 1) * 18; G.sfx(S, f, 'djump'); }
    if (af >= 4 && af <= 20) { const sp = 3.3 - (af - 4) * 0.05; f.vx = f.facing * U.dcos(f.mv.a) * sp; f.vy = U.dsin(f.mv.a) * sp * HJK_UP; }
    if (af > 20 && f.vy > 0) f.vy -= G.ST(f).grav * (HJK_UP - 1) / G.FEEL.recovery;
  }

  G.registerChar({
    id: 'meloetta', name: 'Meloetta', short: 'Meloetta', dex: 648, formDex: { pir: 10018 }, color: '#5fd1a0', trail: '#c8ffe8',
    desc: 'Bas B = Chant Antique : endort autour d\'elle puis change de forme. Chant = psy à distance, grosses hitbox. Danse = rapide, combos au corps à corps.',
    nameFor: (f) => (f.v.form === 'pir' ? 'Meloetta Danse' : 'Meloetta Chant'),
    stats: {
      weight: 76, h: 17, w: 7, walk: 1.0, dash: 1.8, dashF: 11, run: 1.66, runAcc: 0.1, traction: 0.1,
      air: 1.18, airAcc: 0.08, grav: 0.068, fall: 1.28, ffall: 2.05, fullHop: 32, shortHop: 15, dJump: 27, jumps: 3,
    },
    formStats: {
      pir: { weight: 82, walk: 1.28, dash: 2.3, run: 2.32, runAcc: 0.13, air: 1.22, airAcc: 0.09, grav: 0.1, fall: 1.8, ffall: 2.9, fullHop: 35, shortHop: 16, dJump: 32, jumps: 2 },
    },
    palettes: [
      { name: 'Normal', skin: '#f5f5f2', leg: '#2a2a35', aria: '#5fd1a0', aria2: '#2f9a78', pir: '#ff8a3a', pir2: '#c8541a', eye: '#2ab5a0', band: '#1b1226' },
      { name: 'Chromatique', skin: '#f5f0e6', leg: '#3a2a35', aria: '#e8d85a', aria2: '#a8981a', pir: '#ff5a8a', pir2: '#b82a5a', eye: '#d85a2a', band: '#1b1226' },
      { name: 'Nocturne', skin: '#e8e6f5', leg: '#1a1a3a', aria: '#8a7aff', aria2: '#4a3ab8', pir: '#ff5ad8', pir2: '#a82a8a', eye: '#8a7aff', band: '#0e0b1a' },
      { name: 'Corail', skin: '#fff6ee', leg: '#3a2420', aria: '#ff9a8a', aria2: '#c85a4a', pir: '#5ad8ff', pir2: '#1a8ab8', eye: '#ff6a5a', band: '#2a1418' },
    ],
    init(f) { f.v.form = null; f.v.swapCd = 0; },
    passive(S, f) { if (f.v.swapCd > 0) f.v.swapCd--; if (f.grounded || f.action === 'ledge') f.v.pd = 0; },
    moves: {
      // ---------- FORME CHANT (psy, grosses hitbox) ----------
      jab: { len: 18, iasa: 16, next: ['jab2', 5, 16], hits: [H(4, 5, 9, 10, 5.5, 3, 361, 25, 25, Ps())], anim: A.cast(4, 5, 18) },
      jab2: { len: 18, next: ['jab3', 5, 16], hits: [H(4, 5, 9.5, 10, 5.5, 3, 361, 25, 25, Ps())], anim: A.cast(4, 5, 18) },
      jab3: { len: 32, hits: [H(7, 8, 11, 10, 8.5, 6, 361, 60, 92, Ps())], anim: A.cast(7, 8, 32) },
      ftilt: { len: 30, hits: [H(8, 10, 15, 10, 5.5, 10, 361, 36, 96, So()), H(8, 10, 8, 10, 5, 8, 361, 34, 90, So())], anim: [[0, {}], [7, { hd: -25, lean: -8 }], [8, { hd: 30, lean: 16, hair: 1 }], [16, { hd: 20, lean: 12 }], [30, {}]] },
      utilt: { len: 28, hits: [H(6, 12, 2, 21, 8.5, 9, 90, 45, 100, So())], anim: A.upSwing(6, 12, 28) },
      dtilt: { len: 24, hurtH: 0.62, hits: [H(7, 9, 14, 2, 5.8, 8, 70, 55, 55, Ps())], anim: A.lowPoke(7, 9, 24) },
      dashAtk: { len: 38, keepVel: 1, tick: G.dashAtkTick, hits: [H(6, 14, 6, 9, 7.5, 10, 60, 55, 72, So())], anim: A.spinArms(6, 14, 38) },
      fsmash: { len: 52, charge: 10, hits: [H(16, 18, 17, 10, 10.5, 17, 361, 40, 102, Ps())], anim: A.cast(16, 18, 52) },
      usmash: { len: 50, charge: 8, hits: [H(12, 13, 2, 14, 8, 4, 90, 100, 0, Ps({ link: 1 })), H(15, 19, 1, 26, 10.5, 15, 88, 40, 104, Ps({ g: 1 }))], anim: A.smashU(8, 13, 19, 50) },
      dsmash: { len: 48, charge: 6, hits: [H(11, 13, 13, 3, 8, 15, 30, 34, 98, So()), H(11, 13, -13, 3, 8, 15, 150, 34, 98, So())], anim: A.smashD(6, 11, 13, 48) },
      // (ces 3 aériens n'ont pas de hitbox fixe : lag réglé à la main, le réglage global ne les voit pas)
      // Onde Circulaire : anneau sonore qui grandit et repousse (espacement)
      nair: { aerial: 1, len: 36, iasa: 23, landLag: 4, ac: [4, 17], tick: ringTick, anim: [[0, {}], [5, { aF: 150, aB: 150, hd: 10, eye: 3, glow: 1 }], [14, { aF: 150, aB: 150, eye: 3, glow: 1 }], [36, {}]] },
      // Note Tenue : une note qui ondule vers l'avant (projectile aérien)
      fair: { aerial: 1, len: 34, iasa: 19, landLag: 5, ac: [3, 12], float: [8, 14, 0.08], tick: noteTick, anim: [[0, {}], [8, { aF: 20, hd: -10 }], [9, { aF: 100, eF: 0, hd: 15, glow: 1 }], [16, { aF: 95 }], [34, {}]] },
      // Contre-Ut : explosion sonore loin derrière elle
      bair: { aerial: 1, len: 38, landLag: 10, ac: [4, 29], tick: (S, f, af) => { if (af === 9) G.sfx(S, f, 'magic', { psyk: 1, x: f.x - f.facing * 15, y: f.y + 9 }); }, hits: [H(9, 11, -15, 9, 8.5, 13, 361, 36, 100, So())], anim: [[0, {}], [8, { aB: 60, hd: -10 }], [9, { aB: -100, lean: -8, glow: 1, hd: -25, eye: 1 }], [16, { aB: -90 }], [38, {}]] },
      // Aigu : colonne de son au-dessus d'elle (multi-coups)
      uair: { aerial: 1, len: 36, landLag: 9, ac: [3, 27], float: [6, 14, 0.12], hits: [...G.LINE(6, 13, 0, 16, 0, 30, 3, 5.5, 1.2, 90, 0, 0, So({ rehit: 3, link: 1, hs: 8 })), H(15, 16, 0, 28, 8, 6, 88, 45, 104, So({ g: 1 }))], anim: [[0, {}], [5, { aF: 175, aB: 175, hd: 30, eye: 3 }], [16, { aF: 175, aB: 175, hd: 30, eye: 3 }], [36, {}]] },
      // Basse : une grosse note tombe sous elle et rebondit une fois
      dair: { aerial: 1, len: 40, iasa: 22, landLag: 6, ac: [4, 13], tick: bassTick, anim: [[0, {}], [9, { aF: 170, aB: 170 }], [10, { aF: 10, aB: 10, glow: 1, hd: -20 }], [20, { aF: 5 }], [40, {}]] },
      nspec: { len: 36, tick: psykoTick, land: 'keep', grav: 0.5, anim: A.cast(12, 14, 36) },
      sspec: { len: 34, tick: voiceTick, land: 'keep', grav: 0.6, anim: [[0, {}], [9, { aF: 20, aB: 20, hd: -10 }], [11, { aF: 100, aB: 80, hd: 20, eye: 1 }], [22, { aF: 95, aB: 75 }], [34, {}]] },
      uspec: { len: 34, helpless: 1, landLag: 14, ledge: 13, tick: tpTick, drift: 0, intang: [4, 14], noGrav: (af) => af >= 4 && af < 14, anim: [[0, {}], [4, { aF: 170, aB: 170, eye: 3 }], [14, { aF: 150, aB: -30 }], [34, {}]] },
      dspec: relic,
      // ---------- FORME DANSE (rapide, combos) ----------
      'pir:jab': { len: 13, iasa: 11, next: ['jab2', 3, 11], hits: [H(2, 3, 7, 10, 3.8, 2, 361, 20, 20)], anim: A.jab(2, 3, 13) },
      'pir:jab2': { len: 14, next: ['jab3', 3, 12], hits: [H(2, 3, 7.5, 10, 3.8, 2, 361, 22, 20)], anim: A.jab2(2, 3, 14) },
      'pir:jab3': { len: 32, hits: [H(4, 20, 9, 7, 5.5, 0.9, 361, 0, 0, { rehit: 3, link: 1, hs: 8 }), H(23, 24, 10, 8, 6.5, 3.5, 361, 55, 105, { g: 1 })], anim: [[0, {}], [4, { lF: 100, kF: 0 }], [7, { lF: 40, lB: -100 }], [10, { lF: 100 }], [13, { lF: 40, lB: -100 }], [16, { lF: 100 }], [20, { lF: 40 }], [23, { lF: 105, lean: -12, eye: 1 }], [32, {}]] },
      'pir:ftilt': { len: 26, hitCancel: 14, hits: [H(6, 8, 11, 8, 5.5, 8, 361, 35, 85, { turn: 1 })], anim: A.kickF(6, 8, 26) },
      'pir:utilt': { len: 24, hitCancel: 12, hits: [H(5, 9, 1, 17, 6.5, 7, 90, 50, 70)], anim: A.uair(5, 9, 24) },
      'pir:dtilt': { len: 20, hurtH: 0.6, hitCancel: 10, hits: [H(5, 7, 10, 2, 5.5, 5, 80, 40, 30, { trip: 1 })], anim: A.sweep(5, 7, 20) },
      'pir:dashAtk': { len: 32, keepVel: 1, hurtH: 0.6, tick: G.dashAtkTick, hitCancel: 20, hits: [H(5, 12, 8, 2.5, 5.5, 9, 78, 62, 45)], anim: [[0, { lean: 10 }], [5, { crouch: 0.8, lF: 95, kF: 0, lean: -25 }], [12, { crouch: 0.8, lF: 90 }], [32, {}]] },
      'pir:fsmash': { len: 46, charge: 9, hits: [H(13, 15, 13, 9, 7, 15, 361, 36, 100)], anim: [[0, {}], [9, { lean: -15, lF: 30, kF: 90, eye: 1 }], [13, { rot: 180, lF: 100, kF: 0 }], [18, { rot: 360, lF: 95 }], [46, { rot: 360 }]] },
      'pir:usmash': { len: 44, charge: 7, hits: [H(10, 14, 2, 20, 7.5, 14, 88, 36, 104)], anim: A.uair(10, 14, 44) },
      'pir:dsmash': { len: 42, charge: 5, hits: [H(9, 11, 11, 2.5, 5.5, 12, 30, 32, 95), H(9, 11, -11, 2.5, 5.5, 12, 150, 32, 95)], anim: [[0, {}], [5, { crouch: 0.8 }], [9, { crouch: 0.9, lF: 100, lB: -100, kF: 0, kB: 0, rot: 0 }], [16, { crouch: 0.9, lF: 100, lB: -100, rot: 360 }], [42, { rot: 360 }]] },
      // Toupie : breakdance tête en bas (fort au début, faible à la fin)
      'pir:nair': { aerial: 1, len: 32, landLag: 6, ac: [4, 24], hits: [H(4, 7, 0, 7, 8.5, 8, 361, 30, 88), H(8, 15, 0, 7, 7.5, 5, 361, 20, 78)], anim: [[0, {}], [3, { rot: 180, lF: 80, lB: -80, kF: 0, kB: 0, aF: 175, aB: 175 }], [15, { rot: 900, lF: 85, lB: -85, kF: 0, kB: 0, aF: 175, aB: 175 }], [24, { rot: 1080 }], [32, { rot: 1080 }]] },
      // Pas Chassé : coup de pied sauté qui avance
      'pir:fair': { aerial: 1, len: 32, landLag: 7, ac: [3, 24], tick: (S, f, af) => { if (af === 5) { f.vx = f.facing * Math.max(Math.abs(f.vx), 2.5); G.sfx(S, f, 'swing'); } }, hits: [H(6, 10, 10, 8, 6, 10, 40, 36, 92)], anim: [[0, {}], [4, { lF: 30, kF: 90, lean: -4 }], [6, { lF: 100, kF: 0, lean: -14, lB: -40, eye: 1 }], [12, { lF: 95, lean: -10 }], [32, {}]] },
      'pir:bair': { aerial: 1, len: 32, landLag: 8, ac: [4, 24], hits: [H(7, 9, -10, 8, 5.8, 13, 361, 32, 100)], anim: A.bair(7, 9, 32) },
      'pir:uair': { aerial: 1, len: 34, landLag: 8, ac: [3, 26], hits: [H(4, 12, 0, 18, 6.5, 1.5, 90, 0, 0, { rehit: 3, link: 1, hs: 8 }), H(14, 16, 0, 19, 7, 5, 85, 40, 110, { g: 1 })], anim: A.uair(4, 16, 34) },
      'pir:dair': { aerial: 1, len: 40, landLag: 10, ac: [4, 32], hits: [H(8, 20, 0, 0, 5.5, 1.5, 270, 0, 0, { rehit: 3, link: 1, hs: 8 }), H(22, 24, 0, 1, 6.5, 6, 280, 30, 80, { g: 1 })], anim: [[0, {}], [7, { lF: 5, lB: -5, kF: 0, kB: 0, rot: 0 }], [22, { lF: 5, lB: -5, rot: 720 }], [40, { rot: 720 }]] },
      'pir:nspec': { len: 44, tick: ccTick, land: 'keep', keepVel: 1, hits: [H(6, 30, 9, 9, 7, 1.3, 361, 0, 0, { rehit: 3, link: 1, hs: 8 }), H(32, 33, 10, 9, 8, 6, 45, 55, 88, { g: 1 })], anim: [[0, {}], [6, { aF: 100, aB: 60, lean: 12 }], [10, { aF: 60, aB: 105 }], [14, { aF: 105, aB: 60 }], [18, { aF: 60, aB: 105 }], [22, { aF: 105, aB: 60 }], [26, { aF: 60, aB: 105 }], [31, { aF: -30 }], [32, { aF: 110, lean: 16, eye: 1 }], [44, {}]] },
      'pir:sspec': { len: 36, tick: pirTick, keepVel: 1, offEdge: 1, land: 'keep', drift: 0, noGrav: (af) => af >= 5 && af <= 15, hitCancel: 19, ledge: 15, hits: [H(5, 15, 3, 9, 7, 2, 361, 0, 0, { rehit: 4, link: 1, hs: 10 }), H(17, 18, 5, 9, 7.5, 6, 50, 50, 72, { g: 1 })], anim: [[0, { crouch: 0.3 }], [5, { rot: 0, lF: 90, lB: -60 }], [15, { rot: 720, lF: 90, lB: -60 }], [17, { rot: 720, lF: 100, lean: -10 }], [36, { rot: 720 }]] },
      'pir:uspec': { len: 44, helpless: 1, landLag: 18, ledge: 12, tick: hjkTick, drift: 0, noGrav: (af) => af >= 4 && af <= 20, hits: [H(5, 8, 4, 12, 6.5, 14, 60, 45, 95), H(9, 20, 3, 10, 5.5, 7, 70, 50, 60)], anim: [[0, { crouch: 0.5 }], [4, { lF: 110, kF: 20, lB: -30, kB: 90, aF: -40, aB: 40, lean: 20, eye: 1 }], [20, { lF: 100, kF: 20, lean: 20 }], [44, {}]] },
      'pir:dspec': relic,
      taunt: { len: 70, anim: [[0, {}], [10, { aF: 170, aB: 170, eye: 3, hd: 10 }], [35, { aF: 120, aB: 170, eye: 3, hd: -10 }], [60, { aF: 170, aB: 120, eye: 3 }], [70, {}]] },
    },
    draw(ctx, P, c, f, S, t) {
      const pir = f.v.form === 'pir';
      const hc = pir ? c.pir : c.aria, hc2 = pir ? c.pir2 : c.aria2;
      const cr = P.crouch || 0, tu = P.tuck || 0;
      ctx.save();
      ctx.scale(1 + cr * 0.08, 1 - cr * 0.3);
      const hip = [0, 6.6];
      const rot = (x, y) => { ctx.translate(x, y); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-x, -y); };
      const lF = U.lerp(P.lF, 70, tu), lB = U.lerp(P.lB, 50, tu), kF = U.lerp(P.kF, 110, tu), kB = U.lerp(P.kB, 110, tu);
      const sway = Math.sin(t * 3 + f.slot) * 0.8 - (f.vx || 0) * f.facing * 1.5 + (f.vy || 0) * 0.5;
      ctx.save(); rot(hip[0], hip[1]);
      // cheveux (derrière)
      if (!pir) {
        D.blob(ctx, [-1.2, 16.5, -4.5 - sway, 13.5, -5.8 - sway * 1.3, 8.5, -4.4 - sway * 1.5, 4.8, -2.6, 7.2, -1.8, 11.5], D.lin(ctx, 0, 17, 0, 5, hc, hc2));
        ctx.strokeStyle = 'rgba(27,18,38,0.55)'; ctx.lineWidth = 0.18;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-1.8 - i * 0.4, 15.5 - i * 0.2); ctx.quadraticCurveTo(-4.5 - sway - i * 0.3, 11, -4.6 - sway * 1.4 + i * 0.3, 6); ctx.stroke(); }
        ctx.fillStyle = c.band; ctx.beginPath(); ctx.ellipse(-4.4 - sway * 1.4, 7.4, 0.7, 0.5, 0, 0, 7); ctx.fill();
        ctx.fillRect(-3.9 - sway * 1.4, 7.4, 0.18, 2.2);
      } else {
        D.blob(ctx, [-1.6, 18.2, -4.2 - sway, 19.5, -5.4 - sway * 1.4, 16.8, -3.2, 15.4], D.lin(ctx, 0, 20, 0, 15, hc, hc2));
      }
      // bras arrière
      const ba = D.limb(ctx, -0.9, 11.8, P.aB, -(P.eB || 0), 2.8, 2.7, 1.3, 1.1, U.shade(c.skin, -0.15));
      D.circ(ctx, ba.ex, ba.ey, 0.8, U.shade(c.skin, -0.15));
      ctx.restore();
      // jambe arrière
      const bl = D.limb(ctx, -0.5, hip[1], lB, kB, 3.4, 3.3, 1.5, 1.0, U.shade(c.leg, 0.1));
      D.ell(ctx, bl.ex + 0.4, bl.ey + 0.1, 1.0, 0.55, 0, c.leg);
      ctx.save(); rot(hip[0], hip[1]);
      // corps (robe claire + bas sombre)
      D.blob(ctx, [-2.0, 6.4, 2.0, 6.4, 1.6, 9.5, 1.5, 12.6, -1.5, 12.6, -1.8, 9.5], D.shade(ctx, 0, 9.6, 3.5, c.skin));
      D.poly(ctx, [-2.2, 6.2, 2.2, 6.2, 1.4, 8.4, -1.4, 8.4], c.leg);
      // tête
      ctx.save(); ctx.translate(0.6, 15.2); ctx.rotate(-(P.hd || 0) * Math.PI / 180);
      D.circ(ctx, 0, 0, 2.7, D.shade(ctx, 0, 0, 2.7, c.skin));
      // bandeau-clé de sol
      ctx.strokeStyle = c.band; ctx.lineWidth = 0.55; ctx.beginPath(); ctx.arc(0, 0.2, 2.75, 0.35 * Math.PI, 0.95 * Math.PI); ctx.stroke();
      if (!pir) {
        D.blob(ctx, [-2.6, 1.6, -1.2, 3.4, 1.6, 3.2, 2.8, 1.6, 1.0, 2.2, -1.4, 1.2], hc);
        D.poly(ctx, [1.6, 2.4, 3.6, 2.2, 2.2, 1.0], hc);
      } else {
        D.blob(ctx, [-2.6, 1.2, -1.4, 3.6, 1.8, 3.4, 3.0, 1.4, 1.2, 2.0, -1.4, 0.8], hc);
        D.poly(ctx, [-0.6, 3.2, 0.4, 5.2, 1.4, 3.2], hc); D.poly(ctx, [0.8, 3.2, 2.6, 4.6, 2.4, 2.4], hc2);
      }
      const ex = P.eye;
      if (ex === 2 || ex === 3) { D.eye(ctx, 0.9, 0.0, 0.75, ex); D.eye(ctx, 2.1, 0.0, 0.62, ex); }
      else {
        D.ell(ctx, 0.9, 0.0, 0.62, 0.9, 0, '#fff'); D.ell(ctx, 2.1, 0.0, 0.5, 0.8, 0, '#fff');
        D.ell(ctx, 1.0, -0.05, 0.42, 0.62, 0, c.eye, true); D.ell(ctx, 2.2, -0.05, 0.34, 0.54, 0, c.eye, true);
        D.circ(ctx, 1.05, -0.05, 0.2, '#111', true); D.circ(ctx, 2.25, -0.05, 0.17, '#111', true);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(1.15, 0.25, 0.12, 0, 7); ctx.fill();
        if (ex === 1) { ctx.strokeStyle = D.OL; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(0.3, 1.1); ctx.lineTo(1.5, 0.8); ctx.stroke(); }
      }
      ctx.restore();
      ctx.restore();
      // jambe avant
      const fl = D.limb(ctx, 0.5, hip[1], lF, kF, 3.4, 3.3, 1.55, 1.05, c.leg);
      D.ell(ctx, fl.ex + 0.4, fl.ey + 0.1, 1.05, 0.58, 0, c.leg);
      // bras avant
      ctx.save(); rot(hip[0], hip[1]);
      const fa = D.limb(ctx, 1.0, 11.8, P.aF, -(P.eF || 0), 2.8, 2.7, 1.35, 1.15, c.skin);
      D.circ(ctx, fa.ex, fa.ey, 0.85, c.skin);
      if (P.glow) { ctx.fillStyle = pir ? `rgba(255,160,80,${0.35 + 0.2 * Math.sin(t * 20)})` : `rgba(255,120,220,${0.35 + 0.2 * Math.sin(t * 20)})`; ctx.beginPath(); ctx.arc(fa.ex, fa.ey, 2.4, 0, 7); ctx.fill(); }
      ctx.restore();
      ctx.restore();
    },
    drawFx(ctx, f, S, t) {
      if (f.action === 'move' && f.move === 'nair' && !f.v.form && f.af >= 6 && f.af <= 16) {
        const k = (f.af - 6) / 10, st = G.ST(f);
        for (let i = 0; i < 2; i++) { ctx.strokeStyle = `rgba(90,230,170,${0.8 * (1 - k)})`; ctx.lineWidth = 0.9 - i * 0.3; ctx.beginPath(); ctx.arc(f.x, f.y + st.h * 0.53, (4 + k * 10) * 1.6 - i * 2, 0, 7); ctx.stroke(); }
      }
      if (f.action === 'move' && f.move === 'dspec' && f.af >= 8 && f.af <= 20) {
        const k = (f.af - 8) / 12;
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = `rgba(120,240,190,${0.7 * (1 - k)})`; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.arc(f.x, f.y + 9, 6 + k * 11 + i * 2, 0, 7); ctx.stroke();
        }
      }
    },
    fx(e, R) {
      if (e.swap || e.relic || e.notes) for (let i = 0; i < 8; i++) {
        const a = Math.random() * 6.28, s = 0.5 + Math.random() * 1.2;
        R.parts.push({ ty: 'custom', x: e.x, y: e.y + 9, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 0.3, life: 40, max: 40, sym: i % 2 ? '♪' : '♫', draw(ctx, p, k) { ctx.save(); ctx.translate(p.x, p.y); ctx.scale(0.35, -0.35); ctx.globalAlpha = k; ctx.fillStyle = '#1b1226'; ctx.font = '14px serif'; ctx.fillText(p.sym, 0, 0); ctx.restore(); ctx.globalAlpha = 1; } });
      }
      if (e.psyk) { R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 16, max: 16, size: 14, col: '#ff7ad8' }); R.cam.shake = Math.max(R.cam.shake, 4); }
    },
  });
})(window.G);
