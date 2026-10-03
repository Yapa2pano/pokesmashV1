'use strict';
// ARCHÉDUC — sniper : Tisse Ombre (maintiens B, vise au stick, relâche ; tir en pleine tête = critique,
// plus la flèche vole loin, plus elle fait mal), piège de plumes pour immobiliser, vol plané.
(function (G) {
  const U = G.U, D = G.D, H = G.H, A = G.A;
  const ARC = G.ARC, LINE = G.LINE;
  const MAXC = 24; // charge max en 24 frames (0,4 s)

  function arrowParams(c) {
    const k = c / MAXC;
    // (nerf : la flèche pleine est un finisher après un combo, plus un kill à bas % depuis le centre)
    return { spd: 3.6 + k * 4.8, grav: 0.06 * (1 - k) * (1 - k), dmg: 4 + k * 7, kbg: 55 + k * 30, bkb: 25 + k * 10, pierce: c >= MAXC - 1 };
  }
  G.PROJ.arrow = {
    tick(S, p) { if (p.age % 2 === 0 && p.v.full) S.events.push({ t: 'trail', s: p.owner, x: p.x, y: p.y, k: 'at' + p.id + '_' + p.age }); },
    dmgFn(S, att, tgt, dmg, h) {
      const p = h.proj;
      let d = dmg * (1 + Math.min(0.25, U.len(p.x - p.v.sx, p.y - p.v.sy) / 400));
      const st = G.ST(tgt);
      const crit = !p.v.nocrit && p.y > tgt.y + st.h * 0.7;
      if (crit) {
        d *= 1.15;
        S.events.push({ t: 'sfx', name: 'snipe', s: p.owner, crit: 1, x: p.x, y: p.y, k: 'crit' + p.id + '_' + tgt.slot });
      }
      if (!p.v.nocrit) p.kbMul = crit ? 1 : 1.1; // flèches de l'arc qui ne critiquent pas : +10 % d'éjection
      return d;
    },
    onHit(S, p, t, res) { if (res === 'hit' && p.v.full) { t.hitstun += 12; t.v.shackle = 60; } },
    draw(ctx, p) {
      const a = Math.atan2(p.vy, p.vx);
      ctx.rotate(a);
      if (p.v.full) { ctx.fillStyle = 'rgba(160,90,255,0.35)'; ctx.beginPath(); ctx.ellipse(-4, 0, 7, 1.6, 0, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#1b1226'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-4.5, 0); ctx.lineTo(3, 0); ctx.stroke();
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-4.5, 0); ctx.lineTo(3, 0); ctx.stroke();
      ctx.fillStyle = p.v.full ? '#b27bff' : '#3fbf5a'; ctx.strokeStyle = '#1b1226'; ctx.lineWidth = 0.25;
      ctx.beginPath(); ctx.moveTo(4.2, 0); ctx.lineTo(2.4, 0.9); ctx.lineTo(2.4, -0.9); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d9502e';
      ctx.beginPath(); ctx.moveTo(-4.5, 0); ctx.lineTo(-6, 1.1); ctx.lineTo(-3.4, 0); ctx.lineTo(-6, -1.1); ctx.closePath(); ctx.fill(); ctx.stroke();
    },
  };
  G.PROJ.leaf = {
    draw(ctx, p) {
      ctx.rotate(Math.atan2(p.vy, p.vx) + p.age * 0.1);
      ctx.fillStyle = '#5fd35a'; ctx.strokeStyle = '#1b1226'; ctx.lineWidth = 0.25;
      ctx.beginPath(); ctx.ellipse(0, 0, 2.2, 0.8, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.stroke();
    },
  };
  G.PROJ.trap = {
    tick(S, p) {
      if (!p.v.set) {
        p.vy -= 0.18;
        const m = S.stage.main;
        let surf = null;
        if (p.x > m.l && p.x < m.r && p.y + p.vy <= m.y && p.y >= m.y - 0.5) surf = m.y;
        for (const pl of S.stage.plats) if (p.x > pl.l && p.x < pl.r && p.y + p.vy <= pl.y && p.y >= pl.y - 0.5) surf = pl.y;
        if (surf != null) { p.y = surf + 1; p.vy = 0; p.vx = 0; p.v.set = 1; p.harmless = false; }
      }
    },
    onHit(S, p, t, res) {
      if (res !== 'hit') return;
      t.hitstun = 75; t.kbx = 0; t.kby = 0; t.v.rooted = 75;
      S.events.push({ t: 'sfx', name: 'magic', s: p.owner, x: p.x, y: p.y, k: 'tr' + p.id });
    },
    draw(ctx, p, t) {
      const on = p.v.set;
      ctx.globalAlpha = on ? 0.75 + Math.sin(t * 4) * 0.15 : 1;
      for (let i = 0; i < 6; i++) {
        ctx.save(); ctx.rotate(i / 6 * Math.PI * 2 + (on ? 0 : p.age * 0.3)); ctx.scale(1, 0.4);
        ctx.fillStyle = i % 2 ? '#3f8f3a' : '#6fcf5a'; ctx.strokeStyle = '#1b1226'; ctx.lineWidth = 0.25;
        ctx.beginPath(); ctx.ellipse(2.4, 0, 2.4, 0.9, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };

  function bowTick(S, f, af, inp, M) {
    if (af === 1) { f.mv.c = 0; f.mv.aim = 0; f.mv.hold = 0; G.sfx(S, f, 'bowDraw'); }
    if (af === 10) {
      const held = inp.held(G.BTN.SPC);
      if (U.len(inp.sx, inp.sy) > 0.35) { // visée à 360° : angle = direction du stick
        let la = U.datan2(inp.sy, inp.sx * f.facing);
        if (la > 95 || la < -95) { f.facing = -f.facing; la = U.datan2(inp.sy, inp.sx * f.facing); } // viser derrière = se retourner
        f.mv.aim = U.clamp(la, -90, 90);
      }
      if (f.buf.s) { f.buf.s = 0; G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; } // annuler au bouclier
      if (held && f.mv.hold < 150) {
        if (f.mv.c < MAXC) { f.mv.c++; if (f.mv.c === MAXC) G.sfx(S, f, 'magic'); }
        f.mv.hold++;
        f.af = 9;
        if (!f.grounded && (f.v.floatB || 0) > 0) { f.v.floatB--; f.vy = Math.max(f.vy, -0.55); }
        return;
      }
    }
    if (af === 11) {
      const st = G.ST(f), P = arrowParams(f.mv.c), a = f.mv.aim;
      const ca = U.dcos(a), sa = U.dsin(a);
      const x = f.x + f.facing * ca * 6, y = f.y + st.h * 0.58 + sa * 6;
      G.spawnProj(S, f, 'arrow', {
        x, y, vx: f.facing * P.spd * ca, vy: P.spd * sa, grav: P.grav, r: 1.8, life: 110, dmg: P.dmg, ang: 38, trajKb: 1, bkb: P.bkb, kbg: P.kbg,
        t: 'ghost', pierce: P.pierce, v: { sx: x, sy: y, full: P.pierce ? 1 : 0 },
      });
      G.sfx(S, f, P.pierce ? 'snipe' : 'arrow');
      if (!f.grounded) { f.vx -= f.facing * ca * 0.6; f.vy -= sa * 0.6; } // recul à l'opposé du tir
    }
  }

  function fanTick(S, f, af) {
    if (af === 4) {
      const st = G.ST(f);
      [-12, 0, 12].forEach((a) => G.spawnProj(S, f, 'leaf', {
        x: f.x + f.facing * 5, y: f.y + st.h * 0.55, vx: f.facing * 4.2 * U.dcos(a), vy: 4.2 * U.dsin(a), r: 2, life: 34,
        dmg: 3, ang: 40, bkb: 38, kbg: 30, t: 'grass',
      }));
      G.sfx(S, f, 'arrow');
    }
  }

  // Haut B façon Élytres (Steve) : propulsion vers le haut, puis vol plané automatique piloté au stick.
  // Stick haut = remonter (on perd de la vitesse), stick bas = piquer (on en gagne), stick en arrière = demi-tour.
  // Pendant la propulsion ET le vol plané : UN coup au choix (aérien avec A / stick droit, spécial avec B),
  // on garde l'élan, puis chute libre. Bouclier = arrêter de planer. Planer vite fait mal (charge en piqué).
  function glideMove(S, f, inp) {
    if (f.buf.a || f.buf.c) {
      let dx = 0, dy = 0;
      if (f.buf.c) { dx = f.cdir[0]; dy = f.cdir[1]; }
      else { const ax = Math.abs(inp.sx), ay = Math.abs(inp.sy); if (ay >= 0.3 && ay >= ax) dy = inp.sy > 0 ? 1 : -1; else if (ax >= 0.3) dx = inp.sx > 0 ? 1 : -1; }
      f.buf.a = 0; f.buf.c = 0;
      const name = dy > 0 ? 'uair' : dy < 0 ? 'dair' : dx === 0 ? 'nair' : dx === f.facing ? 'fair' : 'bair';
      f.v.helpAfter = 1;
      G.startMove(S, f, name);
      return true;
    }
    if (f.buf.b) {
      f.buf.b = 0;
      const up = inp.sy >= 0.5 && inp.sy >= Math.abs(inp.sx) * 0.8, down = inp.sy <= -0.5 && -inp.sy >= Math.abs(inp.sx) * 0.8;
      if (up) { G.setAction(f, 'help'); f.v.helpLag = 12; return true; } // haut B = lâcher le planeur
      let name = 'nspec';
      if (down) name = 'dspec';
      else if (Math.abs(inp.sx) >= 0.4) { f.facing = inp.sx > 0 ? 1 : -1; name = 'sspec'; }
      f.v.helpAfter = 1;
      if (G.startMove(S, f, name)) return true;
      f.v.helpAfter = 0; // feuilles en recharge : on continue de planer
    }
    return false;
  }
  function flightTick(S, f, af, inp) {
    const st = G.ST(f);
    if (af === 4) { f.grounded = false; f.plat = null; f.vx *= 0.3; G.sfx(S, f, 'djump', { burst: 1 }); }
    // propulsion 2 fois plus haute qu'avant (montée d'environ 73 au lieu de 37), puis vol plané
    if (af >= 4 && af <= 23) { f.vy = 5.2 - (af - 4) * 0.12; f.vx = U.approach(f.vx, inp.sx * 0.8, 0.1); }
    if (af >= 6 && af <= 25 && (f.buf.a || f.buf.c) && glideMove(S, f, inp)) return 'stop';
    if (af === 24) { f.mv.glide = 1; f.mv.a = 5; f.mv.sp = 1.9; f.mv.turn = 0; }
    if (af >= 24) {
      if (af > 25 && (f.buf.s || af > 255)) { f.buf.s = 0; G.setAction(f, 'help'); f.v.helpLag = 12; return 'stop'; }
      if (af > 25 && glideMove(S, f, inp)) return 'stop';
      // demi-tour
      if (f.mv.turn > 0) f.mv.turn--;
      if (inp.sx * f.facing < -0.7 && f.mv.turn === 0) { f.facing = -f.facing; f.mv.sp *= 0.75; f.mv.turn = 24; }
      // tangage
      const want = inp.sy > 0.3 ? 42 : inp.sy < -0.3 ? -60 : -8;
      f.mv.a = U.approach(f.mv.a, want, 5.5);
      // vitesse : piquer accélère, monter ralentit, un peu de traînée
      f.mv.sp = U.clamp(f.mv.sp - U.dsin(f.mv.a) * 0.07 - 0.006, 0.7, 3.8);
      if (f.mv.sp < 0.95 && f.mv.a > 0) f.mv.a -= 4; // décrochage
      f.vx = f.facing * U.dcos(f.mv.a) * f.mv.sp;
      f.vy = U.dsin(f.mv.a) * f.mv.sp;
      // charge en piqué : plus on va vite, plus ça fait mal
      if (f.mv.sp > 2.2) G.pendingHitbox(S, f, { x: 4, y: st.h * 0.5, r: 5.5, dmg: 4 + (f.mv.sp - 2.2) * 5, ang: 40, bkb: 45, kbg: 60, t: 'grass', g: 2, noTrail: 1 });
    }
  }

  const NORMALS = /^(jab|jab2|jab3|ftilt|utilt|dtilt|dashAtk|fsmash|usmash|dsmash|nair|fair|bair|uair|dair)$/;
  function buffAll(moves) {
    for (const k in moves) if (NORMALS.test(k) && moves[k].hits) for (const h of moves[k].hits) { h.dmg = +(h.dmg * 1.15).toFixed(2); h.kbg += 4; }
    return moves;
  }

  // Pluie de Flèches (bas + A en l'air) : il se fige un instant et tire 3 flèches en éventail vers le bas
  function rainTick(S, f, af) {
    if (af < 18 && (f.v.floatB || 0) > 0) { f.v.floatB--; f.vy = Math.max(f.vy, af < 6 ? 0.1 : -0.25); f.vx *= 0.93; f.ff = false; }
    if (af === 7 || af === 10 || af === 13) {
      const st = G.ST(f), a = af === 7 ? -62 : af === 10 ? -90 : -118;
      const x = f.x + f.facing * U.dcos(a) * 3, y = f.y + st.h * 0.35;
      G.spawnProj(S, f, 'arrow', { x, y, vx: f.facing * 4.4 * U.dcos(a), vy: 4.4 * U.dsin(a), r: 1.8, life: 40, dmg: 3.5, ang: 65, bkb: 38, kbg: 40, t: 'ghost', v: { sx: x, sy: y, nocrit: 1 } });
      G.sfx(S, f, 'arrow');
    }
  }
  // Flottement limité : 40 frames par saut au total (arrière/avant/haut en l'air, pluie de flèches, arc chargé),
  // rechargé au sol ou au rebord. Avant, on pouvait flotter à l'infini en enchaînant les aériens.
  const FLOAT_AIR = 40;
  const floatFn = (f0, f1, v) => (S, f, af) => { if (af >= f0 && af <= f1 && (f.v.floatB || 0) > 0) { f.v.floatB--; f.vy = Math.max(f.vy, v); f.ff = false; } };
  const bairFloat = floatFn(6, 18, 0), uairFloat = floatFn(5, 16, 0), fairFloat = floatFn(6, 18, -0.45);

  // Rafale (A neutre en l'air) : grand battement d'ailes qui repousse des deux côtés
  function gustTick(S, f, af) { if (af === 5) G.sfx(S, f, 'swing', { gust: 1 }); }

  function trapTick(S, f, af) {
    if (af === 12) {
      for (const p of S.projs) if (p.kind === 'trap' && p.owner === f.slot) p.dead = true;
      const onG = f.grounded;
      G.spawnProj(S, f, 'trap', {
        x: f.x + f.facing * (onG ? 11 : 3), y: f.y + (onG ? 1 : 0), vx: onG ? 0 : f.facing * 0.3, vy: onG ? 0 : -0.5, r: 4.5, life: 900,
        dmg: 5, ang: 90, bkb: 0, kbg: 0, t: 'grass', noAir: true, refl: false, clank: false, ghost: true, harmless: !onG,
        v: { set: onG ? 1 : 0 },
      });
      if (onG) { const s = G.surf(S, f.plat); const p = S.projs[S.projs.length - 1]; p.x = U.clamp(p.x, s.l + 2, s.r - 2); }
      G.sfx(S, f, 'magic');
    }
  }

  G.registerChar({
    id: 'archeduc', name: 'Archéduc', short: 'Archéduc', dex: 724, color: '#5aa84a', trail: '#b6ffb0',
    desc: 'Sniper. Maintiens B pour bander l\'arc (vise au stick), relâche pour tirer. En pleine tête = critique, de loin = plus fort.',
    init(f) { f.v.fanCd = 0; f.v.floatB = FLOAT_AIR; },
    passive(S, f) { if (f.v.fanCd > 0) f.v.fanCd--; if (f.grounded || f.action === 'ledge') f.v.floatB = FLOAT_AIR; },
    hud(ctx, f, S, x, y, pw, ph, u) {
      if (f.v.fanCd > 0) { ctx.fillStyle = '#b6ffb0'; ctx.font = `800 ${10 * u}px Rubik, sans-serif`; ctx.textAlign = 'left'; ctx.fillText('FEUILLES ' + (f.v.fanCd / 60).toFixed(1) + 's', x + ph + 2 * u, y + 43 * u); }
    },
    stats: {
      weight: 92, h: 17.5, w: 8, walk: 1.15, dash: 2.0, dashF: 11, run: 1.9, runAcc: 0.12, traction: 0.1,
      air: 1.2, airAcc: 0.09, grav: 0.075, fall: 1.4, ffall: 2.3, fullHop: 33, shortHop: 15, dJump: 32, jumps: 3,
    },
    palettes: [
      { name: 'Normal', body: '#8a5a3a', belly: '#e8d3a6', hood: '#3f8f3a', hood2: '#2a6a2a', face: '#4a2f22', eye: '#ff8a2a', beak: '#f2c14a', leaf: '#e25a2a', talon: '#2a2230' },
      { name: 'Chromatique', body: '#b3b8c8', belly: '#f4f1e6', hood: '#2f6f7a', hood2: '#1e4a55', face: '#5a5f73', eye: '#ffd23a', beak: '#f2c14a', leaf: '#e25a9a', talon: '#2a2230' },
      { name: 'Hisui', body: '#5a3a28', belly: '#c9a277', hood: '#6a4a2a', hood2: '#4a321c', face: '#2e1c14', eye: '#ff5a2a', beak: '#f2a84a', leaf: '#b8e04a', talon: '#1a1420' },
      { name: 'Nocturne', body: '#3a3450', belly: '#9a93b8', hood: '#23214a', hood2: '#141230', face: '#1a1628', eye: '#b27bff', beak: '#c9b4ff', leaf: '#b27bff', talon: '#0e0b16' },
    ],
    moves: buffAll({
      jab: { len: 17, iasa: 15, next: ['jab2', 5, 15], hits: ARC(3, 5, 1, 10, 8, 50, -10, 3, 4.5, 2.2, 361, 20, 22), anim: A.jab(3, 4, 17) },
      jab2: { len: 18, next: ['jab3', 6, 17], hits: ARC(3, 5, 1, 10, 8, -10, 50, 3, 4.5, 2, 361, 22, 22), anim: A.jab2(3, 4, 18) },
      jab3: { len: 30, hitCancel: 18, hits: LINE(6, 8, 4, 6, 12, 5, 3, 5, 4.5, 361, 50, 95, { t: 'grass' }), anim: A.kickF(6, 8, 30) },
      ftilt: { len: 28, hits: [H(7, 9, 18, 9, 4.5, 12, 361, 36, 96, { t: 'grass' }), ...LINE(7, 9, 5, 9, 14, 9, 3, 4.5, 7, 361, 28, 82)], anim: A.punch(7, 9, 28) },
      utilt: { len: 28, hitCancel: 14, hits: ARC(6, 11, 0, 9, 11, 15, 165, 5, 5, 7, 90, 38, 110), anim: A.upSwing(6, 11, 28) },
      dtilt: { len: 22, hurtH: 0.62, hitCancel: 11, hits: LINE(5, 7, 4, 1.8, 15, 1.8, 3, 4.5, 6, 72, 40, 30, { trip: 1 }), anim: A.sweep(5, 7, 22) },
      dashAtk: { len: 38, keepVel: 1, tick: G.dashAtkTick, hits: ARC(7, 12, 2, 7, 7, 60, -30, 3, 5.5, 10, 55, 55, 78), anim: A.dashAtk(7, 12, 38) },
      fsmash: { len: 52, charge: 9, hits: [H(15, 17, 21, 9, 5, 19, 361, 36, 102, { t: 'ghost' }), ...LINE(15, 17, 6, 9, 17, 9, 3, 5, 13, 361, 32, 94)], anim: A.smashF(9, 15, 17, 52) },
      usmash: { len: 48, charge: 8, hits: LINE(13, 16, 0, 16, 0, 38, 4, 5.5, 15, 88, 36, 104, { t: 'ghost' }), anim: A.smashU(8, 13, 16, 48) },
      dsmash: { len: 48, charge: 5, hits: [...ARC(11, 13, 0, 3, 12, 70, -5, 3, 5, 13, 30, 30, 98), ...ARC(15, 17, 0, 3, 12, 110, 185, 3, 5, 14, 150, 30, 100, { g: 1 })], anim: A.smashD(5, 11, 16, 48) },
      // Rafale : repousse des deux côtés (outil d'espacement), pas de flottement (chute rapide possible)
      nair: { aerial: 1, len: 36, landLag: 8, ac: [4, 26], tick: gustTick, hits: [H(5, 9, 9, 9, 6.5, 7, 45, 45, 72, { t: 'grass', away: 1 }), H(5, 9, -9, 9, 6.5, 7, 45, 45, 72, { t: 'grass', away: 1 }), H(5, 9, 0, 13, 5.5, 6, 70, 40, 70, { t: 'grass', away: 1 }), H(10, 15, 0, 9, 11, 3, 40, 40, 20, { t: 'grass', away: 1, g: 1, noTrail: 1 })], anim: [[0, {}], [4, { aF: 172, aB: 172, wg: 1, sq: 0.95 }], [6, { aF: 55, aB: 55, wg: 1, sq: 1.08, eye: 1 }], [12, { aF: 75, aB: 75, wg: 0.6 }], [36, {}]] },
      // Aile Tranchante : coup d'aile vers l'avant qui relance le vol (élan + descente planée)
      fair: { aerial: 1, len: 38, landLag: 10, ac: [3, 28], tick: (S, f, af) => { if (af === 6) { f.vx = f.facing * Math.max(Math.abs(f.vx), 1.7); f.ff = false; G.sfx(S, f, 'swing'); } fairFloat(S, f, af); }, hits: [...LINE(8, 11, 4, 9, 15, 7.5, 3, 5, 10, 40, 34, 90, { t: 'grass' })], anim: [[0, {}], [5, { aF: 175, lean: -8, wg: 1 }], [8, { aF: 70, eF: 0, lean: 18, eye: 1, wg: 1 }], [18, { aF: 80, lean: 14, wg: 0.6 }], [38, {}]] },
      bair: { aerial: 1, len: 36, landLag: 9, ac: [4, 27], tick: bairFloat, hits: [...ARC(7, 9, 0, 7, 9, 165, 215, 3, 5.5, 13, 361, 30, 102), ...ARC(10, 12, 0, 7, 9, 165, 215, 3, 5, 8, 361, 20, 90, { g: 1 })], anim: A.bair(7, 12, 36) },
      uair: { aerial: 1, len: 36, landLag: 8, ac: [3, 26], tick: uairFloat, hits: [...ARC(5, 13, 0, 14, 9, 150, 30, 4, 5.5, 2, 85, 0, 0, { rehit: 3, link: 1, hs: 8 }), H(15, 17, 0, 21, 7.5, 6, 85, 40, 108, { g: 1 })], anim: A.uairSwipe(5, 17, 36) },
      // Pluie de Flèches : sniper depuis le ciel (3 flèches en éventail vers le bas)
      dair: { aerial: 1, len: 40, landLag: 12, ac: [4, 30], tick: rainTick, hits: [H(5, 7, 0, 3, 5, 5, 280, 20, 40)], anim: [[0, {}], [5, { aF: 20, aB: 30, eB: 120, lean: 30, bow: 1, hd: -30 }], [16, { aF: 20, aB: 30, eB: 120, lean: 30, bow: 1, hd: -30 }], [22, { aF: 60, aB: 40, lean: 10 }], [40, {}]] },
      nspec: { len: 24, tick: bowTick, grav: 0.7, drift: 0.45, land: 'keep', anim: (f) => [[0, {}], [9, { aF: 90, aB: 95, eB: 120, lean: -4, bow: 1 }], [10, { aF: 90, aB: 95, eB: 120, lean: -4, bow: 1 }], [11, { aF: 92, aB: 60, eB: 20, lean: 6, bow: 0.5 }], [24, {}]] },
      // Feuilles : 0 lag (on agit dès que les feuilles partent), limité par la recharge de 1,25 s
      sspec: { len: 10, iasa: 5, tick: fanTick, land: 'keep', grav: 0.6, cond: (S, f) => (f.v.fanCd || 0) <= 0, start: (S, f) => { f.v.fanCd = 75; }, anim: A.cast(3, 4, 10) },
      uspec: { len: 400, helpless: 1, landLag: 8, ledge: 10, ledgeRising: 1, tick: flightTick, drift: 0, noGrav: (af) => af >= 4, anim: [[0, { crouch: 0.4 }], [4, { aF: 170, aB: 170, wg: 1, sq: 1.12 }], [12, { aF: 60, aB: 60, wg: 1 }], [23, { aF: 100, aB: 100, wg: 1, lean: 20 }], [400, { aF: 100, aB: 100, wg: 1, lean: 20 }]], hits: [H(4, 12, 0, 12, 7.5, 9, 80, 55, 75)] },
      dspec: { len: 34, tick: trapTick, land: 'keep', anim: A.lowPoke(12, 14, 34) },
      fthrow: { throw: 1, len: 30, rel: 12, dmg: 8, ang: 40, bkb: 62, kbg: 62, hold: [[0, 1, 0], [10, 1.5, 0.3]], anim: A.throwF },
      bthrow: { throw: 1, back: 1, len: 36, rel: 16, dmg: 9, ang: 45, bkb: 60, kbg: 70, hold: [[0, 1, 0], [8, 0, 0.9], [16, -1.5, 0.3]], anim: A.throwB },
      uthrow: { throw: 1, len: 42, rel: 20, dmg: 6, ang: 90, bkb: 60, kbg: 78, t: 'ghost', hitFrame: 16, hitDmg: 3, hold: [[0, 1, 0], [12, 0.3, 1.6], [20, 0.3, 2.0]], anim: A.throwU },
      dthrow: { throw: 1, len: 38, rel: 18, dmg: 6, ang: 72, bkb: 70, kbg: 42, hold: [[0, 1, 0], [14, 0.9, -0.1]], anim: A.throwD },
      taunt: { len: 70, anim: [[0, {}], [12, { aF: 90, aB: 95, eB: 120, bow: 1, hd: 12 }], [50, { aF: 90, aB: 95, eB: 120, bow: 1, hd: -8 }], [70, {}]] },
    }),
    pose(P, f, S) {
      if (f.action === 'move' && f.move === 'nspec' && f.af >= 9 && f.af <= 10) {
        P.aim = f.mv.aim || 0; P.aF = 90 + P.aim; P.aB = 95 + P.aim; P.hd = P.aim * 0.4; P.drawK = (f.mv.c || 0) / MAXC;
      }
      if (f.action === 'move' && f.move === 'dair' && f.af >= 5 && f.af <= 16) { P.aim = -80; P.drawK = 0.6; }
      if (f.action === 'move' && f.move === 'uspec' && f.mv.glide) { P.wg = 1; P.aF = 175; P.aB = 175; P.eF = 0; P.eB = 0; P.rot = 62 - (f.mv.a || 0) * 0.8; P.lF = -40; P.lB = -50; P.kF = 0; P.kB = 0; }
      if (f.action === 'air' || f.action === 'help') P.wg = f.vy > 0 ? 0.7 : 0.3;
    },
    draw(ctx, P, c, f, S, t) {
      const cr = P.crouch || 0, tu = P.tuck || 0;
      ctx.save();
      ctx.scale(1 + cr * 0.08, 1 - cr * 0.3);
      const hip = [0, 6.8];
      const rot = (x, y) => { ctx.translate(x, y); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-x, -y); };
      const lF = U.lerp(P.lF, 70, tu), lB = U.lerp(P.lB, 50, tu), kF = U.lerp(P.kF, 110, tu), kB = U.lerp(P.kB, 110, tu);
      const wing = (sx, sy, a, e, col, front) => {
        const L = D.limb(ctx, sx, sy, a, -(e || 0) * 0.5, 3.4, 3.4, 2.4, 1.6, col, 0.9);
        // plumes (flèches) au bout de l'aile
        for (let i = 0; i < 3; i++) {
          const [dx, dy] = D.dir(L.a2 + (i - 1) * 14);
          D.seg(ctx, L.ex - dx * 1.5, L.ey - dy * 1.5, L.ex + dx * (2.4 + (P.wg || 0) * 1.6), L.ey + dy * (2.4 + (P.wg || 0) * 1.6), 0.9, i === 1 ? c.leaf : U.shade(col, -0.1), 0.3);
        }
        return L;
      };
      // aile arrière
      ctx.save(); rot(hip[0], hip[1]);
      const wb = wing(-0.8, 11.6, P.aB, P.eB, U.shade(c.body, -0.25));
      ctx.restore();
      // jambe arrière
      const bl = D.limb(ctx, -0.5, hip[1], lB, kB, 3.3, 3.4, 2.2, 1.0, U.shade(c.talon, 0.1));
      D.poly(ctx, [bl.ex - 0.6, bl.ey, bl.ex + 1.8, bl.ey - 0.3, bl.ex + 0.6, bl.ey + 0.4], c.talon);
      ctx.save(); rot(hip[0], hip[1]);
      // capuche / cape arrière
      D.blob(ctx, [-3.6, 9, -1.5, 15.5, 2.5, 13.5, 1, 9.5, -2.8, 6.5], D.lin(ctx, 0, 15, 0, 6, c.hood, c.hood2));
      D.poly(ctx, [-3.2, 8.2, -5.2, 5.2, -2.4, 7.2], c.hood2); D.poly(ctx, [-2.2, 7.6, -3.5, 4.2, -1.2, 6.8], c.hood2);
      // corps
      D.blob(ctx, [-2.8, 6.5, 2.6, 6.5, 3.4, 9.5, 2.4, 13, -2.4, 13, -3.3, 9.5], D.shade(ctx, 0, 9.5, 4, c.body));
      D.blob(ctx, [0.2, 7, 2.6, 7.2, 3.1, 9.5, 2.3, 12.2, 0.3, 11.8, -0.3, 9.5], c.belly, true);
      // feuille-nœud sur le torse
      D.poly(ctx, [0.2, 12.4, 3.3, 11.2, 2.4, 12.6, 3.6, 13.8], c.leaf);
      // tête
      ctx.save(); ctx.translate(0.8, 15.4); ctx.rotate(-(P.hd || 0) * Math.PI / 180);
      D.circ(ctx, 0, 0, 3.0, D.shade(ctx, 0, 0, 3, c.body));
      D.ell(ctx, 1.2, -0.2, 2.2, 2.1, 0, c.face);
      // capuche qui couvre le haut
      D.blob(ctx, [-3.3, -0.4, -2.2, 3.6, 1.8, 3.9, 3.8, 1.4, 1.4, 1.6, -1.2, 1.0], D.lin(ctx, 0, 4, 0, -1, c.hood, c.hood2));
      // yeux
      const ex = P.eye;
      if (ex === 2 || ex === 3) { D.eye(ctx, 0.9, 0.1, 0.8, ex); D.eye(ctx, 2.4, 0.1, 0.7, ex); }
      else {
        D.ell(ctx, 0.9, 0.1, 0.75, 0.85, 0, '#fff8e0'); D.ell(ctx, 2.4, 0.1, 0.62, 0.78, 0, '#fff8e0');
        D.circ(ctx, 1.05, 0.05, 0.5, c.eye, true); D.circ(ctx, 2.5, 0.05, 0.42, c.eye, true);
        D.circ(ctx, 1.1, 0.05, 0.25, '#111', true); D.circ(ctx, 2.55, 0.05, 0.2, '#111', true);
        ctx.strokeStyle = D.OL; ctx.lineWidth = 0.4; ctx.beginPath();
        ctx.moveTo(0.1, ex === 1 ? 1.3 : 1.05); ctx.lineTo(1.6, ex === 1 ? 0.8 : 1.05); ctx.moveTo(1.9, ex === 1 ? 0.8 : 1.0); ctx.lineTo(3.1, ex === 1 ? 1.2 : 1.0); ctx.stroke();
      }
      D.poly(ctx, [1.7, -0.4, 2.8, -0.9, 1.7, -1.8], c.beak);
      ctx.restore();
      ctx.restore();
      // jambe avant
      const fl = D.limb(ctx, 0.6, hip[1], lF, kF, 3.3, 3.4, 2.3, 1.05, c.talon);
      D.poly(ctx, [fl.ex - 0.6, fl.ey, fl.ex + 2, fl.ey - 0.3, fl.ex + 0.7, fl.ey + 0.5], c.talon);
      // aile avant (+ arc)
      ctx.save(); rot(hip[0], hip[1]);
      const wf = wing(1.0, 11.6, P.aF, P.eF, c.body, 1);
      if (P.bow) {
        const aim = (P.aim || 0), k = P.drawK || 0;
        const [dx, dy] = D.dir(90 + aim);
        const bx = wf.ex, by = wf.ey;
        const nx = -dy, ny = dx;
        const L = 5.2;
        ctx.strokeStyle = '#1b1226'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bx + nx * L, by + ny * L); ctx.quadraticCurveTo(bx + dx * 2.6, by + dy * 2.6, bx - nx * L, by - ny * L); ctx.stroke();
        ctx.strokeStyle = c.hood; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(bx + nx * L, by + ny * L); ctx.quadraticCurveTo(bx + dx * 2.6, by + dy * 2.6, bx - nx * L, by - ny * L); ctx.stroke();
        const pull = 1 + k * 3.2;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.18;
        ctx.beginPath(); ctx.moveTo(bx + nx * L, by + ny * L); ctx.lineTo(bx - dx * pull, by - dy * pull); ctx.lineTo(bx - nx * L, by - ny * L); ctx.stroke();
        // flèche encochée
        ctx.strokeStyle = k >= 0.97 ? '#b27bff' : '#6b4a2b'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(bx - dx * pull, by - dy * pull); ctx.lineTo(bx + dx * 4, by + dy * 4); ctx.stroke();
        if (k >= 0.97) { ctx.fillStyle = `rgba(178,123,255,${0.4 + 0.3 * Math.sin(t * 25)})`; ctx.beginPath(); ctx.arc(bx + dx * 4, by + dy * 4, 1.6, 0, 7); ctx.fill(); }
      }
      ctx.restore();
      ctx.restore();
    },
    drawFx(ctx, f, S, t) {
      // Ligne de visée (visible par tous) : trajectoire réelle de la flèche
      if (f.action === 'move' && f.move === 'nspec' && f.af >= 9 && f.af <= 10 && (f.mv.c || 0) > 3) {
        const st = G.ST(f), P = arrowParams(f.mv.c), a = f.mv.aim || 0;
        let x = f.x + f.facing * U.dcos(a) * 6, y = f.y + st.h * 0.58 + U.dsin(a) * 6, vx = f.facing * P.spd * U.dcos(a), vy = P.spd * U.dsin(a);
        const k = f.mv.c / MAXC;
        ctx.strokeStyle = k >= 0.97 ? `rgba(200,120,255,${0.6 + 0.3 * Math.sin(t * 20)})` : `rgba(255,60,60,${0.25 + k * 0.45})`;
        ctx.lineWidth = 0.35 + k * 0.3; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let i = 0; i < 70; i++) { vy -= P.grav; x += vx; y += vy; ctx.lineTo(x, y); if (G.inBlock(S, x, y)) break; }
        ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(x, y, 1 + k, 0, 7); ctx.fill();
      }
    },
    fx(e, R) {
      if (e.name === 'snipe' && e.crit) {
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 22, max: 22, size: 14, col: '#ff4040' });
        R.parts.push({ ty: 'custom', x: e.x, y: e.y, life: 45, max: 45, draw(ctx, p, k) {
          ctx.save(); ctx.translate(p.x, p.y + (1 - k) * 12); ctx.scale(0.4, -0.4);
          ctx.font = 'italic 900 16px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1b1226'; ctx.globalAlpha = Math.min(1, k * 2);
          ctx.strokeText('CRITIQUE !', 0, 0); ctx.fillStyle = '#ff4040'; ctx.fillText('CRITIQUE !', 0, 0); ctx.restore(); ctx.globalAlpha = 1;
        } });
      }
      if (e.burst) for (let i = 0; i < 12; i++) { const an = Math.random() * 6.28, sp = 0.6 + Math.random() * 1.6; R.parts.push({ ty: 'leaf', x: e.x, y: e.y + 4, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp * 0.6 - 0.4, grav: 0.02, life: 30, max: 30, size: 1.3, col: i % 3 ? '#7a5a3a' : '#5fbf4a' }); }
      if (e.gust) for (let i = 0; i < 14; i++) { const d = i % 2 ? 1 : -1, sp = 1 + Math.random() * 1.6; R.parts.push({ ty: 'leaf', x: e.x + d * 4, y: e.y + 8 + (Math.random() - 0.5) * 8, vx: d * sp, vy: (Math.random() - 0.5) * 0.6, grav: 0.01, life: 22, max: 22, size: 1.1, col: i % 3 ? 'rgba(210,255,200,0.8)' : '#5fbf4a' }); }
      if (e.t === 'trail') R.parts.push({ ty: 'smoke', x: e.x, y: e.y, vx: 0, vy: 0, life: 12, max: 12, size: 1, col: 'rgba(178,123,255,0.6)' });
    },
  });
})(window.G);
