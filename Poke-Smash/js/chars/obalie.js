'use strict';
// OBALIE — la boule. Il ROULE au lieu de courir (glisse comme sur la glace, garde son élan).
// Côté B = Roulade : part tout de suite avec de l'élan (au sol comme en l'air) ; chaque coup qui touche le fait
// rebondir et accélérer (5 niveaux) ; au max = STRIKE (tue). Annulable : saut (garde l'élan), et en l'air
// aérien / esquive / spécial ; au sol A = glissade sur le ventre.
// B = Boule de Neige : maintenir pour la tasser, elle ROULE au sol en grossissant (une seule à la fois).
// Bas B = Mâchouille : croque l'adversaire façon Wario (et les projectiles pour se soigner), recharge 2 s.
// Haut B = Bulle : rebondit sur une grosse bulle qui éclate. Coups tout ronds, hitbox généreuses (+25 %).
(function (G) {
  const U = G.U, D = G.D, H = G.H, GH = G.GH, A = G.A;
  const I = (o) => Object.assign({ t: 'ice' }, o || {});
  const W = (o) => Object.assign({ t: 'water' }, o || {});
  const ROLL_MAX = 4;
  const BIG = 1.25; // hitbox d'Obalie 25 % plus grosses
  const SZ = 14 / 12; // il est 17 % plus grand qu'au départ : dessin et positions des coups suivent
  const rollSpeed = (l) => 2.6 + l * 0.45;
  const ROLLING = { dash: 1, run: 1, brake: 1, turn: 1 };
  const UPB = { dmg: 8, bkb: 58, kbg: 94 }; // haut B (Bulle) : coup fort vers le haut

  // ---------- Roulade ----------
  function rollTick(S, f, af, inp) {
    const st = G.ST(f);
    if (af === 1) {
      if (!f.grounded) { if (f.v.rollAir) { G.setAction(f, 'air'); return 'stop'; } f.v.rollAir = 1; }
      f.mv.lvl = f.v.rollLvlT > 0 ? f.v.rollLvl : 0; f.v.rollLvlT = 0; // enchaînement : repart au niveau gagné
      f.mv.hits = 0; f.mv.sh = 0; f.mv.t = 0; f.mv.bt = 0;
      // élan de départ dans la direction choisie, au sol comme en l'air
      f.vx = f.facing * Math.max(1.9, f.vx * f.facing);
      if (!f.grounded) f.vy = Math.max(f.vy, 0.7);
      G.sfx(S, f, 'dash');
    }
    if (af === 5) f.mv.dir = f.facing; // (après un éventuel B-reverse)
    if (af < 5) { if (!f.grounded) f.vy = Math.max(f.vy, -0.4); return; } // se met en boule sans perdre l'élan
    // annulations : saut (garde l'élan), et en l'air aérien / esquive / spécial ; au sol A = glissade
    if (f.buf.j) {
      if (f.grounded) {
        f.buf.j = 0; f.grounded = false; f.plat = null; f.jumps = 1; f.ff = false;
        f.vy = Math.sqrt(2 * st.grav * st.fullHop * 0.9);
        G.setAction(f, 'air'); f.v.jumpF = S.frame;
        S.events.push({ t: 'jump', s: f.slot, x: f.x, y: f.y, k: 'rj' + f.slot + '_' + S.frame });
        return 'stop';
      }
      if (f.jumps < st.jumps) {
        f.buf.j = 0; f.jumps++; f.ff = false; f.vy = Math.sqrt(2 * st.grav * st.dJump);
        G.setAction(f, 'air'); f.v.dj = S.frame;
        S.events.push({ t: 'djump', s: f.slot, x: f.x, y: f.y, k: 'rd' + f.slot + '_' + S.frame });
        return 'stop';
      }
    }
    if (!f.grounded && (f.buf.a || f.buf.c || f.buf.s || f.buf.b) && G.airAct(S, f, inp, st)) return 'stop';
    if (f.grounded && (f.buf.a || f.buf.c)) { f.buf.a = 0; f.buf.c = 0; f.facing = f.mv.dir; G.startMove(S, f, 'dashAtk'); return 'stop'; }
    // bouclier : rebond en arrière, la Roulade s'arrête (punissable)
    if ((f.mv.shielded || 0) > f.mv.sh) { G.startMove(S, f, 'rollBonk'); return 'stop'; }
    // touché : petit bond vers l'adversaire, et il redevient LIBRE (pas de chute libre) : saut, aérien, esquive,
    // spécial... La Roulade est rendue (même en l'air) et la prochaine, lancée dans les 1,5 s, repart un niveau
    // plus haut. Au niveau max, le coup = STRIKE (le niveau retombe à 0).
    if ((f.mv.hit || 0) > f.mv.hits) {
      const wasMax = f.mv.lvl >= ROLL_MAX;
      f.mv.hits = f.mv.hit;
      f.v.rollLvl = wasMax ? 0 : Math.min(ROLL_MAX, f.mv.lvl + 1); f.v.rollLvlT = wasMax ? 0 : 90;
      f.v.rollAir = 0;
      f.grounded = false; f.plat = null; f.vy = 2.2; f.vx = f.mv.dir * 1.2; f.ff = false;
      G.sfx(S, f, wasMax ? 'hammer' : 'magic', wasMax ? { strike: 1 } : { rollUp: f.v.rollLvl });
      G.setAction(f, 'air');
      return 'stop';
    }
    f.mv.t++;
    if (f.mv.bt > 0) f.mv.bt--;
    const sp = rollSpeed(f.mv.lvl);
    if (f.grounded) {
      if (f.mv.done) { G.startMove(S, f, 'rollStop'); return 'stop'; }
      if (f.buf.b || f.buf.s) { f.buf.b = 0; f.buf.s = 0; G.startMove(S, f, 'rollStop'); return 'stop'; }
      if (inp.sx * f.mv.dir < -0.6) { // demi-tour : freine puis repart dans l'autre sens
        f.vx = U.approach(f.vx, -f.mv.dir * sp, 0.22);
        if (f.vx * f.mv.dir < -0.4) { f.mv.dir = -f.mv.dir; f.facing = f.mv.dir; }
      } else if (f.mv.bt <= 0) f.vx = U.approach(f.vx, f.mv.dir * sp, 0.35);
      if (S.frame % 3 === 0) S.events.push({ t: 'sfx', name: '', s: f.slot, ice: 1, x: f.x - f.mv.dir * 4, y: f.y + 0.5, k: 'ri' + f.slot + '_' + S.frame });
    } else if (f.mv.bt <= 0) f.vx = U.approach(f.vx, f.mv.dir * sp * 0.85, 0.12); // en l'air : continue sur sa lancée
    if (f.mv.t > 130) { G.startMove(S, f, 'rollStop'); return 'stop'; }
    // hitbox de la boule : plus elle va vite, plus elle fait mal
    const l = f.mv.lvl;
    if (!f.mv.done && (Math.abs(f.vx) > 1.1 || !f.grounded)) {
      G.pendingHitbox(S, f, { x: 0.5, y: st.h * 0.47, r: 6.5 * BIG, dmg: 5 + l * 2.5, ang: 40, bkb: 40 + l * 8, kbg: 50 + l * 12, t: 'ice', g: 10 + l, rehit: 30, noTrail: 1 });
    }
  }
  function bonkTick(S, f, af) {
    if (af === 1) { f.grounded = false; f.plat = null; f.vx = -f.facing * 1.5; f.vy = 2.0; G.sfx(S, f, 'clank'); }
  }
  function stopTick(S, f, af) { if (af === 1) G.sfx(S, f, 'step'); }

  // ---------- Mâchouille ----------
  function chompTick(S, f, af) {
    const st = G.ST(f);
    if (af === 1 && (f.v.chompCd || 0) > 0) { G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; }
    if (af === 4) { f.vx += f.facing * (f.grounded ? 1.1 : 0.6); G.sfx(S, f, 'grab'); }
    if (!f.grounded && af < 14) f.vy = Math.max(f.vy, -0.3);
    if (af >= 3 && af <= 14) { // croque aussi les projectiles : miam, +PV
      const mx = f.x + f.facing * 7 * SZ, my = f.y + st.h * 0.5;
      for (const p of S.projs) {
        if (p.dead || p.owner === f.slot || p.pierce || p.harmless) continue;
        if (U.len(p.x - mx, p.y - my) < 6 * BIG + p.r) {
          p.dead = true;
          f.percent = Math.max(0, f.percent - Math.min(6, (p.dmg || 2) * 0.6)); f.flash = 6;
          G.sfx(S, f, 'coin', { gulp: 1 });
        }
      }
    }
  }
  function chompGrab(S, a, t) {
    a.v.chompCd = 120; // 2 s avant de pouvoir recroquer
    a.grabbing = t.slot; t.grabbedBy = a.slot;
    G.setAction(t, 'thrown'); t.vx = t.vy = t.kbx = t.kby = 0; t.hitstun = 0;
    G.startMove(S, a, 'chomp');
    a.vx = 0; a.vy = 0;
    G.sfx(S, a, 'grab');
  }
  function chewTick(S, f, af, inp, M) {
    const v = S.fighters[f.grabbing];
    if (!v || v.grabbedBy !== f.slot) { f.grabbing = -1; G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; }
    if (!f.grounded) { f.vy = 0; f.y -= 0.03; }
    if (af === 8 || af === 16 || af === 24) {
      const d = 3 * S.dmgMul;
      v.percent = Math.min(999, v.percent + d); v.stat.taken += d; f.stat.dmg += d; v.flash = 4;
      S.events.push({ t: 'hit', s: f.slot, tg: v.slot, x: v.x, y: v.y + 6, dmg: d, kb: 10, ht: 'normal', k: 'ch' + f.slot + '_' + S.frame });
      G.sfx(S, f, 'grab', { chew: 1 });
    }
    G.throwTick(S, f, af, inp, M);
  }

  // ---------- Boule de Neige (B) ----------
  // Lancée en cloche, elle ROULE dès qu'elle touche le sol et grossit en roulant (dégâts et éjection avec).
  // Elle tombe au bord, éclate au contact ; une seule à la fois.
  function surfaceUnder(S, x, yTop, yBot) {
    const m = S.stage.main;
    let best = null;
    if (x > m.l && x < m.r && m.y <= yTop && m.y >= yBot) best = m.y;
    for (const pl of S.stage.plats) if (x > pl.l && x < pl.r && pl.y <= yTop && pl.y >= yBot && (best == null || pl.y > best)) best = pl.y;
    return best;
  }
  G.PROJ.snowball = {
    tick(S, p) {
      const v = p.v;
      if (v.roll) {
        const sy = surfaceUnder(S, p.x, p.y - p.r + 0.6, p.y - p.r - 0.6);
        if (sy == null) { v.roll = 0; p.grav = 0.1; return; } // au bord : elle tombe
        p.y = sy + p.r; p.vy = 0;
        if (p.r < v.rmax) { // grossit en roulant
          p.r = Math.min(v.rmax, p.r + 0.035);
          p.dmg = v.d0 + (p.r - v.r0) * 2.4; p.bkb = 38 + (p.r - v.r0) * 4; p.kbg = 62 + (p.r - v.r0) * 8;
        }
        if (p.age % 4 === 0) S.events.push({ t: 'sfx', name: '', s: p.owner, ice: 1, x: p.x - Math.sign(p.vx) * p.r, y: p.y - p.r + 0.5, k: 'sb' + p.id + '_' + p.age });
        return;
      }
      const ny = p.y + p.vy - p.grav;
      if (p.vy - p.grav <= 0) {
        const sy = surfaceUnder(S, p.x, p.y - p.r + 0.5, ny - p.r - 0.01);
        if (sy != null) { v.roll = 1; p.y = sy + p.r; p.vy = 0; p.grav = 0; S.events.push({ t: 'sfx', name: '', s: p.owner, ice: 1, x: p.x, y: sy, k: 'sl' + p.id }); }
      }
    },
    onHit(S, p) { S.events.push({ t: 'sfx', name: 'hammer', s: p.owner, snow: p.r, x: p.x, y: p.y, k: 'sh' + p.id }); },
    onStage(S, p) { p.dead = true; S.events.push({ t: 'sfx', name: '', s: p.owner, snow: p.r, x: p.x, y: p.y, k: 'ss' + p.id }); },
    onEnd(S, p) { S.events.push({ t: 'sfx', name: '', s: p.owner, snow: p.r * 0.6, x: p.x, y: p.y, k: 'se' + p.id }); },
    draw(ctx, p, t) {
      const r = p.r, a = p.x / Math.max(1, r);
      const g = ctx.createRadialGradient(-r * 0.35, r * 0.35, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.65, '#e6f6ff'); g.addColorStop(1, '#9fd2ee');
      ctx.fillStyle = g; ctx.strokeStyle = '#1b1226'; ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(140,190,225,0.8)'; ctx.lineWidth = 0.3; // traces qui tournent : elle roule
      for (let i = 0; i < 3; i++) { const b = -a + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(b) * r * 0.5, Math.sin(b) * r * 0.5, r * 0.18, 0, 7); ctx.stroke(); }
    },
  };
  // Visée : après avoir appuyé sur B, le stick choisit la direction (360°, viser derrière = se retourner),
  // pendant la mise en place ou tant qu'on maintient B. Sans visée : lob vers l'avant.
  const SNOW_DEF = 28;
  const snowParams = (c, a) => { const k = c / 40, sp = 2.9 + k * 0.8; return { k, sp, r: 2.2 + k * 1.3, vx: U.dcos(a) * sp, vy: U.dsin(a) * sp }; };
  function snowAim(f, inp) {
    if (U.len(inp.sx, inp.sy) < 0.35) return;
    let la = U.datan2(inp.sy, inp.sx * f.facing);
    if (la > 100 || la < -100) { f.facing = -f.facing; la = U.datan2(inp.sy, inp.sx * f.facing); }
    f.mv.aim = U.clamp(la, -90, 90);
  }
  function snowTick(S, f, af, inp) {
    if (af === 1) { f.mv.c = 0; f.mv.aim = SNOW_DEF; G.sfx(S, f, 'step'); }
    if (af >= 2 && af <= 6) snowAim(f, inp);
    if (af === 6 && inp.held(G.BTN.SPC) && f.mv.c < 40) { // maintenir B = tasser une plus grosse boule (et viser)
      f.mv.c++; f.af = 5;
      if (!f.grounded) f.vy = Math.max(f.vy, -0.6);
      if (f.mv.c === 40) G.sfx(S, f, 'magic');
      return;
    }
    if (af === 9) {
      const st = G.ST(f), P = snowParams(f.mv.c, f.mv.aim);
      for (const p of S.projs) if (p.kind === 'snowball' && p.owner === f.slot) { p.dead = true; S.events.push({ t: 'sfx', name: '', s: f.slot, snow: p.r * 0.6, x: p.x, y: p.y, k: 'sr' + p.id }); }
      G.spawnProj(S, f, 'snowball', {
        x: f.x + f.facing * U.dcos(f.mv.aim) * 7 * SZ, y: f.y + st.h * 0.55 + U.dsin(f.mv.aim) * 5, vx: f.facing * P.vx, vy: P.vy, grav: 0.1, r: P.r, life: 170,
        dmg: 5 + P.k * 3, ang: 45, bkb: 38, kbg: 62, t: 'ice', clank: true, refl: true,
        v: { roll: 0, d0: 5 + P.k * 3, rmax: 5.2 + P.k * 1.2 },
      });
      const p = S.projs[S.projs.length - 1]; p.v.r0 = p.r; p.v.rmax = Math.max(p.v.rmax, p.r + 1.5);
      G.sfx(S, f, 'swing');
    }
  }

  // ---------- Bulle (haut B) ----------
  function bubbleTick(S, f, af, inp) {
    const st = G.ST(f);
    // (depuis le sol, la bulle le soulève : avant, il retouchait le sol tout de suite et le coup ne sortait pas)
    if (af === 3) { if (f.grounded) f.y += 0.6; f.grounded = false; f.plat = null; G.sfx(S, f, 'water'); }
    if (af >= 3 && af < 8) { f.vy = 0.25; f.vx *= 0.9; }
    if (af === 8) { // la bulle éclate sous lui : gros coup vers le haut (tue vers 120 % à mi-hauteur)
      G.pendingHitbox(S, f, { x: 0, y: -2, r: 9 * BIG, dmg: UPB.dmg, ang: 88, bkb: UPB.bkb, kbg: UPB.kbg, t: 'water', g: 1 });
      G.sfx(S, f, 'water', { pop: 1, x: f.x, y: f.y - 2 });
    }
    if (af >= 8 && af <= 20) { f.vy = 3.4 - (af - 8) * 0.08; f.vx = U.approach(f.vx, inp.sx * 1.1, 0.12); }
    void st;
  }

  // ---------- Smashs ----------
  // Smash bas « Raz-de-Marée » : il saute et s'écrase sur le ventre, deux vagues glacées filent au ras du sol
  G.PROJ.owave = {
    tick(S, p) { // reste collée à sa surface : elle s'éteint au bord
      const m = S.stage.main;
      let on = p.x > m.l && p.x < m.r && Math.abs(p.y - (m.y + 3)) < 1;
      if (!on) for (const pl of S.stage.plats) if (p.x > pl.l && p.x < pl.r && Math.abs(p.y - (pl.y + 3)) < 1) on = true;
      if (!on) { p.dead = true; S.events.push({ t: 'sfx', name: '', s: p.owner, splash: 1, x: p.x, y: p.y, k: 'wv' + p.id }); }
    },
    draw(ctx, p, t) {
      const d = p.vx >= 0 ? 1 : -1, k = Math.min(1, p.life / 6);
      ctx.scale(d, 1); ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(70,170,240,0.85)'; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(-6, -3); ctx.quadraticCurveTo(-3, 4.5 + Math.sin(t * 20) * 0.4, 2.5, 4); ctx.quadraticCurveTo(4.5, 3.6, 3.6, 1.6); ctx.quadraticCurveTo(2.2, 2.2, 2.8, 0.2); ctx.lineTo(4, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(3.2 + Math.sin(t * 15 + i) * 0.8, 3.6 + i * 0.7, 0.35, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    },
  };
  function slamTick(S, f, af) {
    if (af === 12) {
      const k = 1 + 0.4 * (f.charge || 0) / 60;
      [-1, 1].forEach((d) => G.spawnProj(S, f, 'owave', { x: f.x + d * 6 * SZ, y: f.y + 3, vx: d * 2.3, vy: 0, dir: d, r: 4, life: 17, dmg: 12 * k, ang: 35, bkb: 32, kbg: 94, t: 'water', pierce: true, refl: false, clank: false }));
      G.sfx(S, f, 'water', { splash: 1 }); S.events.push({ t: 'thud', s: f.slot, x: f.x, y: f.y, k: 'sl' + f.slot + '_' + S.frame });
    }
  }
  // Smash haut « Ballon Givré » : une grosse boule de glace tourne sur son nez (multi-coups) puis éclate
  function noseBallTick(S, f, af) {
    if (af === 10) G.sfx(S, f, 'magic');
    if (af === 22) G.sfx(S, f, 'hammer', { shatter: 1, x: f.x, y: f.y + 24 });
  }

  // ---------- Coups au sol / aériens ----------
  const slideTick = (sp, from, to) => (S, f, af) => {
    if (af === from) { f.vx = f.facing * U.clamp(Math.abs(f.vx), sp, sp * 1.3); G.sfx(S, f, 'dash'); }
    if (af > from && af <= to) f.vx = U.approach(f.vx, 0, 0.06);
    if (af > from && af <= to && f.grounded && S.frame % 3 === 0) S.events.push({ t: 'sfx', name: '', s: f.slot, ice: 1, x: f.x - f.facing * 4, y: f.y + 0.5, k: 'si' + f.slot + '_' + S.frame });
    if (af > to) f.vx = U.approach(f.vx, 0, 0.08);
  };
  function flopTick(S, f, af) { // Plat Ventre (bas + A en l'air)
    if (af < 6) { f.vy = Math.max(f.vy, 0.3); f.vx *= 0.9; }
    if (af === 6) { f.vy = -3.0; f.ff = true; G.sfx(S, f, 'swing'); }
  }
  function flopLand(S, f) { // rebondit une fois comme un ballon, éclaboussures des deux côtés
    if (!f.mv.bounced) {
      f.mv.bounced = 1;
      G.pendingHitbox(S, f, { x: 8 * SZ, y: 2, r: 5.5 * BIG, dmg: 5, ang: 60, bkb: 45, kbg: 50, t: 'water', g: 3 });
      G.pendingHitbox(S, f, { x: -8 * SZ, y: 2, r: 5.5 * BIG, dmg: 5, ang: 60, bkb: 45, kbg: 50, t: 'water', g: 4 });
      G.sfx(S, f, 'water', { splash: 1 });
      f.grounded = false; f.plat = null; f.y += 0.3; f.vy = 2.3; f.ff = false;
      return;
    }
    f.lag = 7; G.setAction(f, 'lag');
    S.events.push({ t: 'land', s: f.slot, x: f.x, y: f.y, k: 'ol' + f.slot + '_' + S.frame });
  }

  // toutes ses hitbox (coups au sol, aériens, saisies) 25 % plus grosses, et placées à sa nouvelle taille
  function bigger(moves) {
    for (const k in moves) if (moves[k].hits) for (const h of moves[k].hits) { h.r = +(h.r * BIG).toFixed(2); h.x = +(h.x * SZ).toFixed(2); h.y = +(h.y * SZ).toFixed(2); }
    return moves;
  }

  G.registerChar({
    id: 'obalie', name: 'Obalie', short: 'Obalie', dex: 363, color: '#5aa8e0', trail: '#d8f4ff',
    desc: 'La boule ! Il roule au lieu de courir. Côté B = Roulade (chaque coup l\'accélère, au max STRIKE), B = Boule de Neige qui roule et grossit, bas B = Mâchouille (croque même les projectiles).',
    stats: {
      weight: 92, h: 14, w: 11, walk: 0.95, walkAcc: 0.1, dash: 2.2, dashF: 12, run: 2.45, runAcc: 0.09, traction: 0.055, surfBrake: 1.2, brakeF: 20,
      air: 1.08, airAcc: 0.075, grav: 0.092, fall: 1.55, ffall: 2.5, fullHop: 31, shortHop: 15, dJump: 30, jumpMom: 1.45,
    },
    palettes: [
      { name: 'Normal', body: '#5aa8e0', belly: '#f4e8c4', spot: '#ffffff', eye: '#1b1226', nose: '#2a2a3a', blush: '#ff9ab0' },
      { name: 'Chromatique', body: '#c89ad8', belly: '#f7ecd8', spot: '#ffffff', eye: '#1b1226', nose: '#3a2a3a', blush: '#ff8ab0' },
      { name: 'Banquise', body: '#e4f2fb', belly: '#ffffff', spot: '#9ad4f2', eye: '#1b1226', nose: '#2a3a4a', blush: '#ffb0c4' },
      { name: 'Abysse', body: '#2f4f8a', belly: '#c8d8f0', spot: '#8ad8ff', eye: '#0e0b16', nose: '#0e0b16', blush: '#ff7aa0' },
    ],
    init(f) { f.v.rollAir = 0; f.v.chompCd = 0; f.v.rollLvl = 0; f.v.rollLvlT = 0; },
    passive(S, f) {
      if (f.v.chompCd > 0) f.v.chompCd--;
      if (f.v.rollLvlT > 0) f.v.rollLvlT--;
      if (f.grounded || f.action === 'ledge') f.v.rollAir = 0;
    },
    onKO(S, f) { f.v.chompCd = 0; f.v.rollLvlT = 0; },
    moves: bigger({
      // Claques de nageoires puis CLAP des deux nageoires
      jab: { len: 15, iasa: 13, next: ['jab2', 4, 13], hits: [H(3, 4, 7.5, 6, 4, 2.5, 361, 20, 22)], anim: [[0, {}], [2, { aF: -10 }], [3, { aF: 95, lean: 8 }], [8, { aF: 85 }], [15, {}]] },
      jab2: { len: 16, next: ['jab3', 4, 14], hits: [H(3, 4, 7.5, 6, 4, 2.5, 361, 22, 22)], anim: [[0, {}], [2, { aB: -20 }], [3, { aB: 100, aF: -10, lean: 8 }], [8, { aB: 90 }], [16, {}]] },
      jab3: { len: 30, tick: (S, f, af) => { if (af === 5) G.sfx(S, f, 'clank', { clap: 1, x: f.x + f.facing * 7.5, y: f.y + 6.5 }); }, hits: [H(5, 7, 7.5, 6.5, 5.5, 5, 361, 55, 92)], anim: [[0, {}], [3, { aF: 150, aB: 150, sq: 0.95 }], [5, { aF: 80, aB: 80, eF: 0, lean: 10, sq: 1.06, eye: 3 }], [14, { aF: 85, aB: 85 }], [30, {}]] },
      // Coup de Ventre : il se jette en avant ventre en premier
      ftilt: { len: 28, hitCancel: 16, tick: (S, f, af) => { if (af === 5) f.vx += f.facing * 0.9; }, hits: [H(6, 9, 6, 5.5, 6, 9, 361, 34, 90)], anim: [[0, {}], [4, { lean: -14, aF: -40 }], [6, { lean: 22, aF: -60, sq: 1.08, eye: 1 }], [14, { lean: 14 }], [28, {}]] },
      // Saut Salto (façon Carapuce) : petit bond en salto, la queue balaie en arc au-dessus de sa tête, de l'arrière vers l'avant
      utilt: { len: 24, hitCancel: 13, hits: G.ARC(4, 10, 0, 6, 9, 170, 10, 5, 6, 7, 92, 45, 96), anim: [[0, {}], [3, { crouch: 0.5 }], [5, { bob: 3.5, rot: -70, tl: 60, aF: 120, aB: 120, eye: 3 }], [9, { bob: 4.2, rot: -220, tl: 110 }], [13, { bob: 1.6, rot: -330 }], [17, { bob: 0, rot: -360, crouch: 0.3 }], [24, { rot: -360 }]] },
      // Petite glissade qui fait trébucher
      dtilt: { len: 24, hurtH: 0.6, hitCancel: 12, keepVel: 1, tick: slideTick(1.6, 4, 10), hits: [H(4, 10, 5, 2.5, 5, 6, 75, 45, 40, I({ trip: 1 }))], anim: [[0, {}], [3, { rot: 50, aF: -60, aB: -60, eye: 3 }], [12, { rot: 50, aF: -60, aB: -60, eye: 3 }], [24, {}]] },
      // Glissade sur le Ventre : longue glissade, forte au début (coup qui tue), faible ensuite
      dashAtk: { len: 44, keepVel: 1, hurtH: 0.55, tick: slideTick(2.6, 3, 20), hits: [H(4, 9, 5, 3, 6.5, 12, 40, 60, 90, I()), H(10, 26, 5, 3, 5.5, 6, 60, 40, 50, I({ g: 1 }))], anim: [[0, { lean: 10 }], [3, { rot: 70, aF: -80, aB: -80, eye: 3 }], [26, { rot: 70, aF: -80, aB: -80, eye: 3 }], [34, { rot: 20 }], [44, {}]] },
      // Onde Boréale : petit rayon arc-en-ciel glacé devant lui
      fsmash: { len: 50, charge: 9, hits: G.LINE(14, 17, 7, 6, 24, 6.5, 4, 4.5, 16, 361, 36, 100, I()), anim: [[0, {}], [9, { lean: -10, crouch: 0.3, glow: 1, eye: 1 }], [13, { lean: -8, glow: 1 }], [14, { lean: 12, sq: 1.06, mouth: 1, aF: 60, aB: 40 }], [22, { lean: 8, mouth: 1 }], [50, {}]] },
      // Ballon Givré : une grosse boule de glace tourne sur son nez (elle grossit pendant la charge), puis il l'envoie en l'air et elle éclate
      usmash: { len: 50, charge: 7, tick: noseBallTick, hits: [H(10, 19, 0, 17, 7.5, 1.4, 90, 0, 0, I({ rehit: 3, link: 1, hs: 8, noTrail: 1 })), H(22, 24, 0, 24, 9.5, 13, 88, 36, 104, I({ g: 1 }))], anim: [[0, {}], [7, { hd: 30, crouch: 0.3, eye: 3 }], [10, { hd: 45, aF: 120, aB: 120, eye: 3 }], [14, { hd: 40, sq: 1.06 }], [18, { hd: 45, sq: 0.96 }], [21, { hd: 20, crouch: 0.4 }], [22, { hd: 60, sq: 1.15, aF: 170, aB: 170, eye: 1 }], [30, { hd: 30 }], [50, {}]] },
      // Raz-de-Marée : il saute et s'écrase sur le ventre, deux vagues glacées filent au ras du sol (s'arrêtent au bord)
      dsmash: { len: 48, charge: 5, tick: slamTick, hits: [H(11, 13, 7, 3, 6, 8, 60, 45, 60, W()), H(11, 13, -7, 3, 6, 8, 120, 45, 60, W())], anim: [[0, {}], [5, { crouch: 0.6, eye: 1 }], [8, { bob: 3.5, aF: 165, aB: 165, eye: 3 }], [11, { bob: 0, crouch: 0.85, sq: 0.85, aF: 70, aB: 70, eye: 1 }], [20, { crouch: 0.5 }], [48, {}]] },
      // ---- aériens : la boule ----
      nair: { aerial: 1, len: 34, landLag: 7, ac: [4, 24], hits: [H(4, 8, 0, 6, 7.5, 9, 361, 30, 88, I()), H(9, 18, 0, 6, 7, 5, 361, 20, 78, I())], anim: [[0, {}], [3, { ball: 1, rot: 0 }], [18, { ball: 1, rot: 540 }], [24, { ball: 0, rot: 720 }], [34, { rot: 720 }]] },
      fair: { aerial: 1, len: 32, landLag: 8, ac: [3, 24], hits: [H(7, 9, 7.5, 7, 5.5, 9, 45, 32, 90)], anim: [[0, {}], [6, { aF: 170, lean: -6 }], [7, { aF: 70, lean: 14, eye: 1 }], [14, { aF: 80 }], [32, {}]] },
      bair: { aerial: 1, len: 30, landLag: 8, ac: [4, 22], hits: [H(6, 8, -7.5, 4, 5.5, 11, 361, 30, 100)], anim: [[0, {}], [5, { tl: -40, lean: 10 }], [6, { tl: 70, lean: -18, eye: 1 }], [12, { tl: 50 }], [30, {}]] },
      // Jongle : il fait rebondir l'adversaire sur son nez (multi-coups)
      uair: { aerial: 1, len: 32, landLag: 7, ac: [3, 24], hits: [H(4, 12, 1, 13, 5.5, 1.3, 90, 0, 0, { rehit: 3, link: 1, hs: 8 }), H(14, 15, 1, 14, 6.5, 5, 85, 45, 104, { g: 1 })], anim: [[0, {}], [3, { hd: 40, aF: 150, aB: 150 }], [6, { hd: 30, sq: 1.08 }], [9, { hd: 45, sq: 0.95 }], [12, { hd: 30, sq: 1.08 }], [15, { hd: 50, sq: 1.12, eye: 3 }], [32, {}]] },
      // Plat Ventre : il plonge et rebondit une fois au sol comme un ballon
      dair: { aerial: 1, len: 60, landLag: 7, ac: [4, 56], tick: flopTick, onLand: flopLand, hits: [H(6, 50, 0, 1, 6.5, 10, 70, 45, 60, W({ onHit: (S, a) => { a.vy = 2.6; a.ff = false; } }))], anim: [[0, {}], [5, { aF: 160, aB: 160, eye: 3 }], [6, { rot: 90, aF: 120, aB: 120, sq: 1.05, eye: 3 }], [60, { rot: 90, aF: 120, aB: 120 }]] },
      // ---- spéciaux ----
      nspec: { len: 26, land: 'keep', grav: 0.6, tick: snowTick, anim: [[0, {}], [3, { crouch: 0.3, aF: 20, aB: 20, eye: 3 }], [5, { crouch: 0.3, aF: 40, aB: 40, eye: 3 }], [6, { crouch: 0.3, aF: 40, aB: 40, eye: 3 }], [9, { lean: 14, aF: 110, aB: 100, eye: 1 }], [16, { lean: 8, aF: 95 }], [26, {}]] },
      dspec: { len: 36, land: 'keep', grav: 0.5, tick: chompTick, hits: [GH(6, 12, 8, 6, 5.5, { air: true })], onGrab: chompGrab, anim: [[0, {}], [3, { lean: -8, mouth: 0.4 }], [6, { lean: 16, mouth: 1, aF: 60, aB: 50, eye: 1 }], [13, { lean: 12, mouth: 1 }], [16, { mouth: 0 }], [36, {}]] },
      chomp: { throw: 1, phys: 'none', len: 44, rel: 32, dmg: 4, ang: 40, bkb: 75, kbg: 72, tick: chewTick, hold: [[0, 0.75, 0.15], [32, 0.75, 0.15], [34, 1.2, 0.3]], anim: [[0, { mouth: 1, aF: 100, aB: 90 }], [8, { mouth: 0.2, sq: 1.08 }], [12, { mouth: 1 }], [16, { mouth: 0.2, sq: 1.08 }], [20, { mouth: 1 }], [24, { mouth: 0.2, sq: 1.08 }], [30, { mouth: 1, lean: -10 }], [33, { mouth: 1, lean: 20, eye: 1 }], [44, {}]] },
      sspec: { len: 400, tick: rollTick, keepVel: 1, offEdge: 1, land: 'keep', drift: 0, grav: 0.55, ledge: 8, anim: [[0, {}], [4, { ball: 1 }], [400, { ball: 1 }]] },
      rollStop: { len: 18, land: 'keep', tick: stopTick, traction: 2.5, anim: [[0, { ball: 1 }], [10, { ball: 0, eye: 2 }], [18, {}]] },
      rollBonk: { len: 34, land: 'keep', drift: 0, tick: bonkTick, anim: [[0, { ball: 1, eye: 2 }], [34, { ball: 0, eye: 2 }]] },
      // un seul coup par cible (même groupe g : 1) : l'éclatement ou le corps qui monte (fort au début, faible à la fin)
      uspec: { len: 44, helpless: 1, landLag: 14, ledge: 10, ledgeRising: 1, tick: bubbleTick, drift: 0, noGrav: (af) => af >= 3 && af <= 20, hits: [H(9, 13, 0, 6, 6.5, UPB.dmg, 88, UPB.bkb, UPB.kbg, W({ g: 1 })), H(14, 18, 0, 6, 6.5, 4, 80, 45, 50, W({ g: 1 }))], anim: [[0, {}], [3, { crouch: 0.4, eye: 3 }], [8, { sq: 1.15, aF: 160, aB: 160, eye: 3 }], [20, { aF: 150, aB: 150 }], [44, {}]] },
      fthrow: { throw: 1, len: 30, rel: 12, dmg: 7, ang: 42, bkb: 62, kbg: 62, hold: [[0, 1, 0], [10, 1.4, 0.3]], anim: [[0, { aF: 80, aB: 70 }], [8, { lean: -12 }], [12, { lean: 18, aF: 120, eye: 1 }], [30, {}]] },
      bthrow: { throw: 1, back: 1, len: 36, rel: 16, dmg: 9, ang: 45, bkb: 60, kbg: 72, hold: [[0, 1, 0], [8, 0, 0.9], [16, -1.4, 0.3]], anim: [[0, {}], [8, { ball: 1, rot: -180 }], [16, { ball: 1, rot: -360 }], [24, { ball: 0, rot: -360 }], [36, { rot: -360 }]] },
      // Lancer haut : il fait rebondir l'adversaire sur son nez
      uthrow: { throw: 1, len: 40, rel: 20, dmg: 6, ang: 90, bkb: 62, kbg: 78, hitFrame: 12, hitDmg: 3, hold: [[0, 1, 0], [8, 0.2, 1.1], [12, 0.2, 1.6], [16, 0.2, 1.1], [20, 0.2, 1.7]], anim: [[0, {}], [8, { hd: 40, crouch: 0.3 }], [12, { hd: 50, sq: 1.1 }], [16, { hd: 40, crouch: 0.3 }], [20, { hd: 55, sq: 1.15, eye: 3 }], [40, {}]] },
      // Lancer bas : il s'assoit dessus
      dthrow: { throw: 1, len: 38, rel: 18, dmg: 7, ang: 70, bkb: 70, kbg: 42, hold: [[0, 1, 0], [10, 0.3, 0], [18, 0.1, -0.1]], anim: [[0, {}], [10, { sq: 1.1, eye: 3 }], [18, { crouch: 0.7, sq: 0.9 }], [38, {}]] },
      taunt: { len: 60, tick: (S, f, af) => { if (af === 12 || af === 22 || af === 32) G.sfx(S, f, 'clank', { clap: 1, x: f.x + f.facing * 5, y: f.y + 7 }); }, anim: [[0, {}], [8, { aF: 150, aB: 150, eye: 3 }], [12, { aF: 85, aB: 85, eye: 3 }], [17, { aF: 150, aB: 150, eye: 3 }], [22, { aF: 85, aB: 85, eye: 3 }], [27, { aF: 150, aB: 150, eye: 3 }], [32, { aF: 85, aB: 85, eye: 3, sq: 1.08 }], [60, {}]] },
    }),
    pose(P, f, S) {
      // il roule au lieu de courir : boule qui tourne avec la distance parcourue
      const rolling = ROLLING[f.action] || (f.action === 'move' && f.move === 'sspec' && f.af >= 4);
      if (rolling) { P.ball = 1; P.rot = -((f.x * f.facing * 9.5) % 360); }
      if (f.action === 'walk') { P.lean = Math.sin(S.frame * 0.3) * 7; P.aF = 30 + Math.sin(S.frame * 0.3) * 25; P.aB = 20 - Math.sin(S.frame * 0.3) * 25; }
      if (f.action === 'air' && f.vy > 0.3) { P.aF = 140; P.aB = 130; }
    },
    draw(ctx, P, c, f, S, t) {
      const cr = P.crouch || 0, ball = U.clamp(P.ball || 0, 0, 1);
      const R = 5.8, cy = 5.6;
      ctx.save();
      ctx.scale(SZ, SZ); // il a grandi
      ctx.translate(0, cy); ctx.scale((1 + cr * 0.12) * (2 - (P.sq || 1)), (1 - cr * 0.25) * (P.sq || 1)); ctx.translate(0, -cy);
      ctx.translate(0, cy); ctx.rotate(-(P.lean || 0) * Math.PI / 180 * 0.6); ctx.translate(0, -cy);
      const flipper = (ax, ay, a, col, len) => {
        const [dx, dy] = D.dir(a);
        ctx.save(); ctx.translate(ax + dx * len * 0.5, ay + dy * len * 0.5); ctx.rotate(Math.atan2(dy, dx));
        D.ell(ctx, 0, 0, len * 0.6, 1.3, 0, col); ctx.restore();
      };
      if (ball < 0.6) {
        // nageoire arrière + queue
        flipper(-0.2, 3.4, P.aB, U.shade(c.body, -0.25), 3.3);
        const tl = (P.tl || 0) + Math.sin(t * 4 + f.slot) * 6;
        ctx.save(); ctx.translate(-4.8, 2.0); ctx.rotate((-25 + tl) * Math.PI / 180);
        D.ell(ctx, -1.6, 0.7, 1.8, 0.8, 25, U.shade(c.body, -0.15)); D.ell(ctx, -1.6, -0.7, 1.8, 0.8, -25, U.shade(c.body, -0.15));
        ctx.restore();
      }
      // corps tout rond
      D.circ(ctx, 0, cy, R, D.shade(ctx, 0, cy, R, c.body));
      ctx.save(); ctx.beginPath(); ctx.arc(0, cy, R - 0.05, 0, 7); ctx.clip();
      D.ell(ctx, 2.4, 2.4, 5.4, 4.4, -12, c.belly, true);
      // taches blanches sur le dos
      ctx.globalAlpha = 0.9;
      D.ell(ctx, -2.8, 9.6, 1.0, 0.7, 20, c.spot, true); D.ell(ctx, -0.9, 10.9, 0.8, 0.55, 0, c.spot, true); D.ell(ctx, -4.4, 7.6, 0.7, 0.5, 40, c.spot, true);
      ctx.globalAlpha = 1;
      ctx.restore();
      D.circ(ctx, 0, cy, R, null);
      D.shine(ctx, -1.8, cy + 3.2, 1.6, 0.8, 0.4);
      // visage (la tête, c'est le corps : hd déplace le visage sur la boule)
      ctx.save(); ctx.translate(0, cy); ctx.rotate(-(P.hd || 0) * 0.5 * Math.PI / 180); ctx.translate(0, -cy);
      const ex = ball > 0.6 ? 3 : P.eye;
      if (ex === 3) { ctx.strokeStyle = c.eye; ctx.lineWidth = 0.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(2.6, 7.5, 0.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(4.5, 7.3, 0.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
      else if (ex === 2) { D.eye(ctx, 2.6, 7.5, 0.8, 2); D.eye(ctx, 4.4, 7.3, 0.7, 2); }
      else {
        D.ell(ctx, 2.6, 7.5, 0.8, 1.0, 0, c.eye, true); D.ell(ctx, 4.5, 7.3, 0.65, 0.9, 0, c.eye, true);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(2.8, 7.9, 0.28, 0, 7); ctx.arc(4.65, 7.65, 0.22, 0, 7); ctx.fill();
        if (ex === 1) { ctx.strokeStyle = D.OL; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(1.8, 8.9); ctx.lineTo(3.3, 8.4); ctx.moveTo(3.9, 8.3); ctx.lineTo(5.1, 8.6); ctx.stroke(); }
      }
      // nez, moustaches, joues, bouche
      D.ell(ctx, 5.5, 6.1, 0.55, 0.4, 0, c.nose, true);
      ctx.fillStyle = U.rgb(U.hex(c.blush), 0.55); ctx.beginPath(); ctx.ellipse(3.0, 5.7, 0.8, 0.45, 0, 0, 7); ctx.fill();
      ctx.fillStyle = c.nose; [[4.3, 5.6], [4.8, 5.2], [3.9, 5.1]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 0.12, 0, 7); ctx.fill(); });
      const mo = P.mouth || 0;
      if (mo > 0.1) { D.ell(ctx, 4.9, 4.7, 1.0, 0.25 + mo * 0.9, 0, '#7a2a3a'); ctx.fillStyle = '#fff'; ctx.fillRect(4.3, 4.7 + mo * 0.6, 0.35, 0.35); ctx.fillRect(5.0, 4.7 + mo * 0.6, 0.35, 0.35); }
      else { ctx.strokeStyle = D.OL; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(5.0, 5.3, 0.45, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
      ctx.restore();
      // nageoire avant
      if (ball < 0.6) flipper(2.4, 3.2, P.aF, U.shade(c.body, 0.08), 3.5);
      else { ctx.strokeStyle = U.rgb(U.hex(c.belly), 0.7); ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(0, cy, R * 0.7, -0.6, 0.9); ctx.stroke(); }
      if (P.glow) { ctx.fillStyle = `rgba(210,245,255,${0.2 + 0.15 * Math.sin(t * 20)})`; ctx.beginPath(); ctx.arc(0, cy, R + 1.2, 0, 7); ctx.fill(); }
      ctx.restore();
    },
    drawFx(ctx, f, S, t) {
      const st = G.ST(f), x = G.R.px(f), y = G.R.py(f);
      // Roulade : givre qui grossit avec le niveau, éclat au max
      if (f.action === 'move' && f.move === 'sspec' && f.af >= 7) {
        const l = f.mv.lvl || 0;
        for (let i = 0; i < 3 + l * 2; i++) {
          const a = t * (6 + l * 2) + i * 6.283 / (3 + l * 2), r = 7 + l * 0.8;
          ctx.fillStyle = l >= ROLL_MAX ? `rgba(255,255,255,${0.7 + 0.3 * Math.sin(t * 30)})` : 'rgba(200,240,255,0.75)';
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + st.h * 0.47 + Math.sin(a) * r, 0.5 + l * 0.12, 0, 7); ctx.fill();
        }
      }
      // Bulle (haut B) : grosse bulle sous lui avant d'éclater
      if (f.action === 'move' && f.move === 'uspec' && f.af >= 3 && f.af < 8) {
        const k = (f.af - 3) / 5, r = 4 + k * 4;
        ctx.fillStyle = 'rgba(140,210,255,0.25)'; ctx.strokeStyle = 'rgba(230,250,255,0.9)'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.arc(x, y - r * 0.4, r, 0, 7); ctx.fill(); ctx.stroke();
      }
      // Boule de Neige : trajectoire prévue pendant la visée
      if (f.action === 'move' && f.move === 'nspec' && f.af >= 2 && f.af <= 6) {
        const P = snowParams(f.mv.c || 0, f.mv.aim == null ? SNOW_DEF : f.mv.aim), a = f.mv.aim == null ? SNOW_DEF : f.mv.aim;
        let px = x + f.facing * U.dcos(a) * 7 * SZ, py = y + st.h * 0.55 + U.dsin(a) * 5, vx = f.facing * P.vx, vy = P.vy;
        ctx.strokeStyle = 'rgba(220,245,255,0.75)'; ctx.lineWidth = 0.4; ctx.setLineDash([1.5, 1.5]);
        ctx.beginPath(); ctx.moveTo(px, py);
        for (let i = 0; i < 45; i++) { vy -= 0.1; px += vx; py += vy; ctx.lineTo(px, py); if (G.inBlock(S, px, py) || py < y - 40) break; }
        ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(px, py, 0.9, 0, 7); ctx.fill();
      }
      // Ballon Givré : boule de glace qui tourne sur son nez (grossit pendant la charge), puis monte
      if (f.action === 'move' && f.move === 'usmash' && f.af >= 7 && f.af < 23) {
        const up = f.af >= 20 ? (f.af - 20) * 2.5 : 0, k = f.af === 7 ? (f.charge || 0) / 60 : 1;
        const r = f.af === 7 ? 3 + k * 2 : 5.2, by = y + 13 * SZ + r + up, spin = t * 14;
        const g = ctx.createRadialGradient(x - r * 0.3, by + r * 0.3, r * 0.1, x, by, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#cdeffc'); g.addColorStop(1, '#7cc8ee');
        ctx.fillStyle = g; ctx.strokeStyle = '#1b1226'; ctx.lineWidth = 0.45;
        ctx.beginPath(); ctx.arc(x, by, r, 0, 7); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.35;
        for (let i = 0; i < 3; i++) { const a = spin + i * 2.1; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.2, by + Math.sin(a) * r * 0.2); ctx.lineTo(x + Math.cos(a) * r * 0.85, by + Math.sin(a) * r * 0.85); ctx.stroke(); }
      }
      // Onde Boréale : rayon arc-en-ciel
      if (f.action === 'move' && f.move === 'fsmash' && f.af >= 14 && f.af <= 19) {
        const k = 1 - (f.af - 14) / 6, x0 = x + f.facing * 6, x1 = x + f.facing * 33, yy = y + 6.3 * SZ;
        const g = ctx.createLinearGradient(x0, yy - 2, x0, yy + 2);
        g.addColorStop(0, `rgba(255,140,220,${k})`); g.addColorStop(0.35, `rgba(140,255,200,${k})`); g.addColorStop(0.7, `rgba(120,200,255,${k})`); g.addColorStop(1, `rgba(220,160,255,${k})`);
        ctx.fillStyle = g; ctx.fillRect(Math.min(x0, x1), yy - 2.2 * k, Math.abs(x1 - x0), 4.4 * k);
        ctx.fillStyle = `rgba(255,255,255,${k * 0.8})`; ctx.fillRect(Math.min(x0, x1), yy - 0.5, Math.abs(x1 - x0), 1);
      }
      // traînée de givre quand il roule
      if (ROLLING[f.action] && f.grounded && S.frame % 4 === 0 && G.R.newFrame) G.R.parts.push({ ty: 'smoke', x: x - f.facing * 4, y: y + 0.6, vx: -f.facing * 0.2, vy: 0.1, life: 14, max: 14, size: 0.8, col: 'rgba(220,245,255,0.7)' });
    },
    fx(e, R) {
      const text = (txt, col, sz) => R.parts.push({ ty: 'custom', x: e.x, y: e.y + 16, life: 45, max: 45, draw(ctx, p, k) {
        ctx.save(); ctx.translate(p.x, p.y + (1 - k) * 10); ctx.scale(0.4, -0.4);
        ctx.font = `italic 900 ${sz || 15}px Rubik, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1b1226'; ctx.globalAlpha = Math.min(1, k * 2);
        ctx.strokeText(txt, 0, 0); ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore(); ctx.globalAlpha = 1;
      } });
      if (e.ice) R.parts.push({ ty: 'smoke', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 0.4, vy: 0.2, life: 16, max: 16, size: 1, col: 'rgba(220,245,255,0.8)' });
      if (e.rollUp) { R.parts.push({ ty: 'ring', x: e.x, y: e.y + 6, life: 14, max: 14, size: 7 + e.rollUp * 2, col: '#bff3ff' }); if (e.rollUp >= ROLL_MAX) text('TURBO !', '#9ae8ff', 13); }
      if (e.strike) { text('STRIKE !', '#ffffff', 17); R.parts.push({ ty: 'ring', x: e.x, y: e.y + 6, life: 22, max: 22, size: 18, col: '#9ae8ff' }); R.spark(e.x, e.y + 6, '#ffffff', 18, 3); R.cam.shake = Math.max(R.cam.shake, 7); }
      if (e.gulp) text('MIAM !', '#ffb0c4', 12);
      if (e.chew) R.spark(e.x + 5, e.y + 6, '#ffffff', 4, 1);
      if (e.clap) { R.parts.push({ ty: 'star', x: e.x, y: e.y, life: 8, max: 8, size: 4, col: '#ffffff', rot: 0 }); }
      if (e.shatter) {
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 18, max: 18, size: 14, col: '#cdeffc' });
        for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, sp = 1 + Math.random() * 2.2; R.parts.push({ ty: 'spark', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 22, max: 22, size: 1.1, col: i % 2 ? '#ffffff' : '#8fe0ff' }); }
        R.cam.shake = Math.max(R.cam.shake, 4);
      }
      if (e.snow) for (let i = 0; i < 6 + e.snow * 3; i++) { const a = Math.random() * 6.28, sp = 0.5 + Math.random() * (0.8 + e.snow * 0.3); R.parts.push({ ty: 'smoke', x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 0.3, grav: 0.03, life: 22, max: 22, size: 0.8 + Math.random() * 0.8, col: 'rgba(255,255,255,0.9)' }); }
      if (e.pop || e.splash) for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, s = 0.6 + Math.random() * 1.4; R.parts.push({ ty: 'bubble', x: e.x + Math.cos(a) * 3, y: e.y + 2 + Math.sin(a) * 2, vx: Math.cos(a) * s, vy: Math.abs(Math.sin(a)) * s, grav: 0.04, life: 20, max: 20, size: 0.7 + Math.random() * 0.8 }); }
    },
    hud(ctx, f, S, x, y, pw, ph, u) {
      if (f.v.chompCd > 0) { ctx.fillStyle = '#ffb0c4'; ctx.font = `800 ${10 * u}px Rubik, sans-serif`; ctx.textAlign = 'left'; ctx.fillText('MÂCHOUILLE ' + (f.v.chompCd / 60).toFixed(1) + 's', x + ph + 2 * u, y + 43 * u); }
    },
  });
})(window.G);
