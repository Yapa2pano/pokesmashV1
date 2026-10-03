'use strict';
// MINOTAUPE — « La Foreuse ». Monstre au sol, pataud en l'air. Une perceuse qu'on fait monter en régime, une foreuse
// dans les 4 directions, et le SOUS-SOL : pour lui, le terrain n'est pas un mur, c'est une porte.
//  - Passif PERFORATION (tous ses coups de foreuse) : dégâts au bouclier ×2, la super armure ne les arrête pas.
//  - Règle FOREUR : si Tour Rapide ou Forage rencontre le terrain par en dessous ou par le côté, il entre dedans.
//  - B = EMPAL'KORNE : B une fois = la perceuse monte en régime toute seule (bruit de fraise de dentiste) ; B à nouveau =
//    il se fend et VISSE la cible (B B = tout de suite) ; saut / bouclier / roulade = il GARDE le régime ; stick arrière =
//    demi-tour. Au régime max : bouclier cassé net, et KO EN UN COUP à 100 %+.
//  - Côté B = TOUR RAPIDE : toupie-foreuse qui emporte la cible puis l'éjecte très à l'horizontale, DÉTRUIT projectiles
//    et pièges, et le rend plus rapide (Turbo, 4 s). Une fois par saut.
//  - Haut B = FORAGE : foreuse lancée dans la direction choisie (360° ; au sol, pas plus bas que l'horizontale), qui éjecte
//    DANS SON AXE. Vers le bas dans le terrain : il entre sous terre si le Tunnel est rechargé.
//  - Bas B = TUNNEL : sous terre 1,5 s max (un aileron dépasse : frappable). B = FOREUSE MONTANTE (il jaillit, sans chute libre ensuite),
//    A = SÉISME (renverse tous les adversaires posés sur le terrain), saut = il bondit hors du sol. 1,5 s avant de recreuser.
//    Sur une plateforme : il la perce vers le bas ; en l'air : il plonge et s'enfonce à l'atterrissage.
//  - Bas en l'air = PERCEUSE : enterre l'adversaire posé au sol, 1 à 3 s selon ses % (immunité 3 s ensuite : pas de boucle).
//  - Neutre en l'air = TRANCHE : deux coups de griffe, la pointe = COUP CRITIQUE (son de tipper). Arrière en l'air =
//    PERCEUSE ARRIÈRE : hitbox qui dure tant que la foreuse tourne, gros coup qui tue.
(function (G) {
  const U = G.U, D = G.D, H = G.H, A = G.A;
  const ST_ = (o) => Object.assign({ t: 'steel' }, o || {});
  // ⚙ coup de foreuse : perfore (dégâts au bouclier ×2, ignore la super armure)
  const DR = (o) => Object.assign({ t: 'steel', noArmor: 1, drill: 1 }, o || {});
  const perf = (hits) => { for (const h of hits) if (h.drill && h.shieldDmg == null) h.shieldDmg = +(h.dmg * 1.2).toFixed(2); return hits; };
  const TUN_T = 90, DIG_CD = 90, TURBO_T = 240, REV_MAX = 100, REV_T = 90, BURY_IMM = 180, SPD = 2.25;
  const UNDER = { tunnel: 1, quake: 1, rise: 1 }; // coups joués sous terre (rise : seulement pendant le signal)
  // Séisme : sous 80 %, la cible est RENVERSÉE (à terre, à elle de choisir comment se relever) ; au-delà, projetée en l'air
  const QUAKE = { dmg: 5, ang: 80, bkb: 42, kbg: 55, unblockable: 1, t: 'normal', onHit: (S, a, t) => {
    if (t.percent >= 80) return;
    t.grounded = true; t.plat = -1; t.y = S.stage.main.y; t.kbx = 0; t.kby = 0; t.vx = 0; t.vy = 0; t.hitstun = 0; t.tumble = false;
    G.setAction(t, 'down'); t.af = 4;
  } };

  // ---------- Sous-sol ----------
  function enterGround(S, f, x) {
    const m = S.stage.main;
    f.x = U.clamp(x, m.l + 4, m.r - 4); f.y = m.y; f.grounded = true; f.plat = -1;
    f.vx = 0; f.vy = 0; f.kbx = 0; f.kby = 0; f.ff = false; f.jumps = 0; f.airdodged = false;
    f.v.under = 1; f.v.tunT = TUN_T; f.v.quaked = 0; f.v.spinAir = 0;
    G.startMove(S, f, 'tunnel');
    G.sfx(S, f, 'dig', { burst: 1, x: f.x, y: m.y });
  }
  function leaveGround(S, f) { f.v.under = 0; f.v.digCd = DIG_CD; }
  function popJump(S, f) { // il bondit hors du sol (il garde son double saut)
    const st = G.ST(f);
    leaveGround(S, f);
    f.grounded = false; f.plat = null; f.y += 0.5; f.vy = Math.sqrt(2 * st.grav * st.fullHop); f.jumps = 1; f.ff = false;
    G.setAction(f, 'air'); f.v.jumpF = S.frame;
    G.sfx(S, f, 'dig', { burst: 1 });
  }
  function tunnelTick(S, f, af, inp) {
    const m = S.stage.main;
    f.grounded = true; f.plat = -1; f.y = m.y; f.v.under = 1;
    f.v.tunT--;
    if (f.buf.b) { f.buf.b = 0; G.startMove(S, f, 'rise'); return 'stop'; }
    if ((f.buf.a || f.buf.c) && !f.v.quaked) { f.buf.a = 0; f.buf.c = 0; G.startMove(S, f, 'quake'); return 'stop'; }
    if (f.buf.j) { f.buf.j = 0; popJump(S, f); return 'stop'; }
    if (f.v.tunT <= 0) { G.startMove(S, f, 'emerge'); return 'stop'; }
    f.vx = U.approach(f.vx, Math.abs(inp.sx) > 0.2 ? inp.sx * 2.4 : 0, 0.35);
    if (Math.abs(inp.sx) > 0.3) f.facing = inp.sx > 0 ? 1 : -1;
    f.x = U.clamp(f.x + f.vx, m.l + 4, m.r - 4);
    if (af % 5 === 0) S.events.push({ t: 'sfx', name: '', s: f.slot, dirt: 1, x: f.x, y: m.y, k: 'dt' + f.slot + '_' + S.frame });
  }
  function quakeTick(S, f, af) {
    const m = S.stage.main;
    f.grounded = true; f.plat = -1; f.y = m.y; f.v.under = 1; f.v.tunT--;
    if (af === 1) { f.v.quaked = 1; S.events.push({ t: 'sfx', name: 'crack', s: f.slot, x: f.x, y: m.y, k: 'qc' + f.slot + '_' + S.frame }); }
    if (af === 14) { // SÉISME : tous les adversaires posés sur le terrain principal
      for (const t of S.fighters) {
        if (t === f || t.dead || t.out || !t.grounded || t.plat !== -1 || t.invinc > 0 || t.intang > 0 || t.v.under || t.v.hidden > 0) continue;
        if (S.teams && t.team === f.team) continue;
        G.applyHit(S, { att: f, tgt: t, hb: QUAKE, key: 'mq' + f.slot + '_' + S.frame + '_' + t.slot, clock: f.mc, x: t.x, y: t.y + 1, dir: t.x >= f.x ? 1 : -1, wx: t.x, wy: t.y });
      }
      S.events.push({ t: 'sfx', name: 'quake', s: f.slot, quake: 1, x: f.x, y: m.y, k: 'qq' + f.slot + '_' + S.frame });
    }
    if (af >= 24) { G.startMove(S, f, 'tunnel'); return 'stop'; }
  }
  function emergeTick(S, f, af) { if (af === 1) { leaveGround(S, f); G.sfx(S, f, 'dig', { burst: 1 }); } }

  // ---------- Foreuses lancées (haut B à 360°, et Foreuse Montante depuis le sous-sol) ----------
  // f.mv.tilt = angle depuis la verticale, du côté où il regarde : 0 = haut, 90 = devant, 180 = bas
  const takeRevs = (f) => { const k = (f.v.revs || 0) / REV_MAX; f.v.revs = 0; return k; };
  function drillUp(S, f, i) {
    const st = G.ST(f), tl = f.mv.tilt || 0, dx = U.dsin(tl), dy = U.dcos(tl);
    f.vx = f.facing * dx * SPD; f.vy = dy * SPD; f.ff = false;
    const tx = dx * (st.w * 0.5 + 3), ty = st.h * 0.55 + dy * (st.h * 0.5 + 2);
    if (i % 4 === 0) G.pendingHitbox(S, f, { x: tx, y: ty, r: 6 + (f.mv.k || 0) * 1.5, dmg: 1.4, ang: 90, bkb: 0, kbg: 0, link: 1, rehit: 4, hs: 8, hitlag: 0.4, g: 1, t: 'steel', noArmor: 1, shieldDmg: 1.7, noTrail: 1 });
    // la foreuse rencontre le terrain par en dessous ou par le côté : il le traverse (passe sous terre) ;
    // par au-dessus (foreuse vers le bas) : seulement si le Tunnel est rechargé, sinon il se pose
    const px = f.x + f.facing * tx + f.vx, py = f.y + ty + f.vy; // (pointe à la frame suivante : sinon, vers le bas, il se pose avant)
    if (G.inBlock(S, px, py) && !(dy < -0.3 && f.v.digCd > 0)) { enterGround(S, f, px); return 'stop'; }
    return null;
  }
  function drillFinal(S, f, base) { // éjection DANS L'AXE de la foreuse
    const st = G.ST(f), tl = f.mv.tilt || 0, k = f.mv.k || 0;
    // perceuse chargée : éjection totale -15 % au régime max (nerf du 2026-10-02 : tuait vers 47 %, maintenant ~72 %)
    G.pendingHitbox(S, f, { x: U.dsin(tl) * (st.w * 0.5 + 3), y: st.h * 0.55 + U.dcos(tl) * (st.h * 0.5 + 2), r: 7.5 + k * 2.5, dmg: base.dmg + k * 6, ang: (450 - tl) % 360, bkb: base.bkb + k * 10, kbg: base.kbg + k * 20, kbMul: 1 - 0.15 * k, g: 2, t: 'steel', noArmor: 1, shieldDmg: 8 + k * 10 });
    if (k > 0.3) G.sfx(S, f, 'hammer', { drillBoom: 1, x: f.x, y: f.y + st.h });
  }
  function forageTick(S, f, af, inp) {
    if (af === 1) { f.mv.k = takeRevs(f); f.mv.tilt = 0; }
    if (af < 5) { if (!f.grounded) f.vy = Math.max(f.vy, -0.3); f.vx *= 0.85; }
    // visée à 360° (stick au neutre = tout droit vers le haut) : lue à la frame 4, et encore réorientable jusqu'à la
    // frame 7 (le temps de passer le stick de haut en bas après haut + B), tant que la foreuse n'a rien touché
    if (af === 4) f.mv.gnd = f.grounded ? 1 : 0;
    if (af >= 4 && af <= 7 && !f.mv.hit && U.len(inp.sx, inp.sy) > 0.3) {
      if (Math.abs(inp.sx) > 0.2) f.facing = inp.sx > 0 ? 1 : -1;
      f.mv.tilt = U.datan2(Math.abs(inp.sx), inp.sy);
      if (f.mv.gnd) f.mv.tilt = Math.min(f.mv.tilt, 90); // parti du sol : au plus bas, à l'horizontale (pas dans le sol)
    }
    if (af === 4) {
      if (f.grounded) { f.grounded = false; f.plat = null; f.y += 0.3; }
      G.sfx(S, f, 'swingBig', { drillGo: 1 });
    }
    if (af >= 5 && af <= 26) { const r = drillUp(S, f, af - 5); if (r) return r; }
    if (af === 27) drillFinal(S, f, { dmg: 8, bkb: 62, kbg: 96 });
  }
  function riseTick(S, f, af) {
    const m = S.stage.main;
    if (af <= 6) { // le sol gonfle : il va jaillir (signal)
      f.grounded = true; f.plat = -1; f.y = m.y; f.vx = 0; f.v.under = 1;
      if (af === 1) S.events.push({ t: 'sfx', name: 'crack', s: f.slot, bulge: 1, x: f.x, y: m.y, k: 'rb' + f.slot + '_' + S.frame });
      return;
    }
    if (af === 7) { // il jaillit : pas de chute libre ensuite, il garde son double saut (et peut attaquer, haut B…)
      leaveGround(S, f); f.mv.k = takeRevs(f); f.mv.tilt = 0; f.grounded = false; f.plat = null; f.y = m.y + 0.5; f.jumps = 1;
      G.sfx(S, f, 'dig', { burst: 1, x: f.x, y: m.y });
    }
    if (af >= 7 && af <= 24) { const r = drillUp(S, f, af - 7); if (r) return r; }
    if (af === 25) drillFinal(S, f, { dmg: 9, bkb: 64, kbg: 95 });
  }

  // ---------- Tunnel (bas B) ----------
  function digTick(S, f, af) {
    if (af === 1) {
      if (f.plat >= 0) { // sur une plateforme : il la perce vers le bas
        const pl = f.plat;
        f.grounded = false; f.plat = null; f.y -= 0.5; f.vy = -1.5;
        G.startMove(S, f, 'dspecA'); f.mv.drop = 1; f.dropPlat = pl; f.dropT = 16;
        return 'stop';
      }
      if (f.v.digCd > 0) { G.sfx(S, f, 'clank', { hardGround: 1 }); G.setAction(f, 'idle'); return 'stop'; }
      G.sfx(S, f, 'dig');
    }
    if (af === 12) { enterGround(S, f, f.x); return 'stop'; }
  }
  function plungeTick(S, f, af) {
    if (af < 6) { f.vy = f.mv.drop ? -1.5 : Math.max(f.vy, 0.4); f.vx *= 0.85; return; }
    if (af === 6) G.sfx(S, f, 'swingBig');
    f.vy = -3.3; f.vx *= 0.9; f.ff = false;
    if ((af - 6) % 4 === 0) G.pendingHitbox(S, f, { x: 0, y: -1, r: 6, dmg: 1.6, ang: 270, bkb: 0, kbg: 0, link: 1, rehit: 4, hs: 8, hitlag: 0.4, g: 1, t: 'steel', noArmor: 1, shieldDmg: 2, noTrail: 1 });
  }
  function plungeLand(S, f) {
    // impact : la cible emportée est plaquée et rebondit juste au-dessus de lui
    G.pendingHitbox(S, f, { x: 0, y: 3, r: 9, dmg: 5, ang: 85, bkb: 58, kbg: 45, g: 3, t: 'steel', noArmor: 1, shieldDmg: 6 });
    S.events.push({ t: 'thud', s: f.slot, x: f.x, y: f.y, k: 'pl' + f.slot + '_' + S.frame });
    if (f.plat === -1 && !(f.v.digCd > 0)) { enterGround(S, f, f.x); return; }
    f.lag = 16; G.setAction(f, 'lag');
  }

  // ---------- Empal'Korne (B) ----------
  // KO en un coup : régime max ET cible à 100 %+ au moment où la foreuse l'accroche (le % qu'on voit, pas celui après le vissage)
  const ohkoOk = (a, t) => a.mv.max && (a.mv.p0 != null ? a.mv.p0 : t.percent) >= 100;
  function ohkoKb(S, a, t) { return ohkoOk(a, t) ? 8 : 1; }
  function drillGrip(S, a, t, h) { if (a.mv.p0 == null) a.mv.p0 = t.percent - (h && h.hb ? h.hb.dmg * S.dmgMul : 0); }
  function ohkoHit(S, a, t) { if (ohkoOk(a, t)) S.events.push({ t: 'sfx', name: 'ohko', s: a.slot, ohko: 1, x: t.x, y: t.y + 8, k: 'ok' + a.slot + '_' + S.frame }); }
  const REV_CHG = { max: REV_MAX, rate: REV_MAX / REV_T, store: (S, f, c) => { f.v.revs = Math.round(c); }, onFull: (S, f) => { f.flash = 8; G.sfx(S, f, 'magic', { revFull: 1 }); } };
  function revTick(S, f, af, inp) {
    const st = G.ST(f);
    if (af === 1) { f.mv.c = f.v.revs || 0; f.v.revs = 0; f.mv.go = f.mv.c >= REV_MAX ? 1 : 0; }
    if (af === 8 && !f.mv.go) { // la perceuse monte en régime toute seule (règle commune des B chargés : G.chargeLoop)
      const r = G.chargeLoop(S, f, inp, REV_CHG);
      if (r === 'stop') return 'stop';
      if (r === 'hold') { f.af = 7; if (!f.grounded) f.vy = Math.max(f.vy, -0.5); return; }
      f.mv.go = 1; // B : il se fend
    }
    if (af === 9) {
      const k = f.mv.c / REV_MAX;
      f.mv.k = k; f.mv.max = k >= 0.999 ? 1 : 0; f.mv.dur = 6 + Math.round(k * 24); f.mv.end = 10 + f.mv.dur; f.mv.lag = 0;
      f.vx = f.facing * (1.0 + k * 1.4);
      G.sfx(S, f, f.mv.max ? 'swingBig' : 'swing', { drillGo: 1 });
    }
    if (af < 9) return;
    const k = f.mv.k, end = f.mv.end;
    if (af >= 10 && af < end) { // vissage : la cible reste au bout de la foreuse
      f.vx = U.approach(f.vx, f.facing * (f.mv.hit ? 0.25 : 0.6 + k * 0.6), 0.15);
      if ((af - 10) % 4 === 0) G.pendingHitbox(S, f, { x: st.w * 0.5 + 6, y: st.h * 0.5, r: 5.5 + k * 1.5, dmg: 1.2, ang: 0, bkb: 0, kbg: 0, link: 1, rehit: 4, hs: 8, hitlag: 0.4, g: 1, t: 'steel', noArmor: 1, shieldDmg: f.mv.max ? 60 : 1.5, noTrail: 1, onHit: drillGrip }); // (régime max : le bouclier casse au premier contact)
    }
    if (af === end) {
      G.pendingHitbox(S, f, { x: st.w * 0.5 + 6, y: st.h * 0.5, r: 7 + k * 2, dmg: 5 + k * 6, ang: 32, bkb: 49 + k * 10, kbg: 76 + k * 14, g: 2, t: 'steel', noArmor: 1, shieldDmg: f.mv.max ? 60 : 4 + k * 10, kbFn: ohkoKb, onHit: ohkoHit });
    }
    if (af === end + 1) f.mv.lag = f.mv.hit ? 14 : 30 + Math.round(k * 10); // raté : la foreuse tourne dans le vide
    if (af > end + 1) {
      f.vx = U.approach(f.vx, 0, 0.12);
      if (af >= end + 1 + f.mv.lag) { G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; }
    }
  }
  const revAnim = (f) => {
    const e = f.mv && f.mv.end ? f.mv.end : 40, l = f.mv && f.mv.lag ? f.mv.lag : 30;
    return [[0, {}], [6, { drill: 1, dA: 90, crouch: 0.35, lean: -8, eye: 1 }], [8, { drill: 1, dA: 90, crouch: 0.35, lean: -8, eye: 1 }], [10, { drill: 1, dA: 90, lean: 18 }], [e, { drill: 1, dA: 90, lean: 14 }], [e + 2, { drill: 0, aF: 90, aB: 70, lean: 6 }], [e + l, {}]];
  };

  // ---------- Tour Rapide (côté B) ----------
  function spinTick(S, f, af, inp) {
    const st = G.ST(f);
    if (af === 1 && !f.grounded) { if (f.v.spinAir) { G.setAction(f, 'air'); return 'stop'; } f.v.spinAir = 1; }
    if (af === 6) {
      f.v.form = 'turbo'; f.v.turboT = TURBO_T; // comme dans les jeux : il en ressort plus rapide
      f.vx = f.facing * 2.6; if (!f.grounded) f.vy = Math.max(f.vy, 1.3);
      G.sfx(S, f, 'dash', { turbo: 1 });
    }
    if (af < 6) { f.vx *= 0.8; if (!f.grounded) f.vy = Math.max(f.vy, -0.3); return; }
    if (af <= 34) {
      f.vx = U.approach(f.vx, f.facing * (2.6 + inp.sx * f.facing * 0.6), 0.25);
      if (!f.grounded) f.vy = Math.max(f.vy, -0.8);
      if ((af - 6) % 4 === 0) G.pendingHitbox(S, f, { x: 2, y: st.h * 0.45, r: 7.5, dmg: 1.5, ang: 0, bkb: 0, kbg: 0, link: 1, rehit: 4, hs: 8, hitlag: 0.4, g: 1, t: 'steel', noArmor: 1, shieldDmg: 1.8, noTrail: 1 });
      // il détruit les projectiles et les pièges qu'il touche
      const cx = f.x + f.facing * 2, cy = f.y + st.h * 0.45;
      for (const p of S.projs) {
        if (p.dead || p.owner === f.slot) continue;
        if (U.len(p.x - cx, p.y - cy) < 9 + p.r) { p.dead = true; S.events.push({ t: 'clank', x: p.x, y: p.y, k: 'rs' + p.id }); }
      }
      // la foreuse rencontre le côté du terrain : il entre dedans
      const px = f.x + f.facing * (st.w * 0.5 + 3);
      if (!f.grounded && G.inBlock(S, px, cy)) { enterGround(S, f, px); return 'stop'; }
    }
    if (af === 35) G.pendingHitbox(S, f, { x: 3, y: st.h * 0.45, r: 8, dmg: 5, ang: 10, bkb: 55, kbg: 72, g: 2, t: 'steel', noArmor: 1, shieldDmg: 6 }); // éjection très horizontale (80° de la verticale)
    if (af > 35) f.vx = U.approach(f.vx, 0, 0.12);
  }

  // ---------- Enterrement (bas en l'air) ----------
  // 1 s à 0 %, jusqu'à 3 s à 135 %+ ; se débattre fait sortir au mieux 1,5× plus vite (géré par le moteur : buriedStep)
  function buryHit(S, a, t) {
    if (!t.grounded || t.dead || S.frame < (t.v.buryUntil || 0) || t.v.hidden > 0) return;
    const d = Math.round(U.clamp(60 + t.percent * 0.9, 60, 180));
    t.v.buried = d; t.hitlag = d; t.hitstun = 0; t.tumble = false; t.kbx = 0; t.kby = 0; t.vx = 0; t.vy = 0;
    t.v.burBy = a.slot; t.v.burM = 0;
    G.setAction(t, 'idle'); t.grounded = true; t.v.buryUntil = S.frame + d + BURY_IMM;
    a.grounded = false; a.plat = null; a.vy = 2.3; a.vx = -a.facing * 0.4; a.ff = false; G.setAction(a, 'air'); // il rebondit sur sa victime
    S.events.push({ t: 'sfx', name: 'dig', s: a.slot, bury: 1, x: t.x, y: t.y, k: 'bu' + t.slot + '_' + S.frame });
  }

  // ---------- Tranche (neutre en l'air) : la POINTE des griffes = COUP CRITIQUE (façon tipper de Marth) ----------
  function critHit(S, a, t, h) { S.events.push({ t: 'sfx', name: 'tipper', s: a.slot, crit: 1, x: h.x, y: h.y, k: 'cr' + a.slot + '_' + t.slot + '_' + S.frame }); }
  const SOUR = (o) => Object.assign({ t: 'claw' }, o || {});
  const CRIT = (o) => Object.assign({ t: 'claw', hitlag: 1.4, onHit: critHit }, o || {});
  // 1er coup : griffe avant de haut en bas devant lui ; 2e : griffe arrière de bas en haut derrière lui.
  // Le près-du-corps passe AVANT la pointe dans la liste (prioritaire) : le critique ne sort qu'à bonne distance.
  const nairHits = [
    ...G.ARC(5, 8, 0, 8, 3.5, 70, -50, 4, 3.5, 5, 65, 25, 40, SOUR()),
    ...G.ARC(5, 8, 0, 8, 13.5, 70, -50, 4, 3.5, 10, 40, 36, 84, CRIT()),
    ...G.ARC(12, 15, 0, 8, 3.5, 215, 120, 4, 3.5, 6, 361, 25, 48, SOUR({ g: 1 })),
    ...G.ARC(12, 15, 0, 8, 13.5, 215, 120, 4, 3.5, 11, 361, 36, 90, CRIT({ g: 1 })),
  ];
  const nairTick = (S, f, af) => { if (af === 4 || af === 11) G.sfx(S, f, 'clawSwipe'); };

  // ---------- Perceuse arrière (arrière en l'air) : la hitbox dure tant que la foreuse tourne ----------
  const bairTick = (S, f, af) => { if (af === 7) G.sfx(S, f, 'swingBig', { drillGo: 1, x: f.x - f.facing * 9, y: f.y }); };

  // ---------- Pioche (avant en l'air) : s'accroche au coin du terrain de loin ----------
  function pickTick(S, f, af) {
    if (af < 8 || af > 16 || f.grounded || f.ledgeCd > 0) return;
    const m = S.stage.main, st = G.ST(f);
    for (const s of [-1, 1]) {
      const lx = s > 0 ? m.r : m.l;
      if ((f.x - lx) * s <= 0 || f.facing !== -s) continue; // hors du terrain de ce côté, tourné vers lui
      const tipx = f.x + f.facing * 14, tipy = f.y + st.h * 0.35;
      if (Math.abs(tipx - lx) < 9 && Math.abs(tipy - m.y) < 10) {
        f.x = lx + s * (st.w * 0.5 + 0.6); f.y = m.y - st.h * 0.92; f.vx = 0; f.vy = 0; // (la prise du rebord se fait juste après)
        G.sfx(S, f, 'clank', { hook: 1, x: lx, y: m.y });
        return;
      }
    }
  }

  // ---------- Projectiles ----------
  G.PROJ.mrock = { // rochers de l'Éboulis (smash bas)
    onStage(S, p) { p.dead = true; S.events.push({ t: 'sfx', name: '', s: p.owner, rockBreak: 1, x: p.x, y: p.y, k: 'rk' + p.id }); },
    draw(ctx, p) {
      const r = p.r;
      ctx.rotate(p.age * 0.15 * (p.dir || 1));
      ctx.fillStyle = '#7d6e60'; ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(-r, -0.2 * r); ctx.lineTo(-0.5 * r, -r); ctx.lineTo(0.6 * r, -0.85 * r); ctx.lineTo(r, 0.1 * r); ctx.lineTo(0.4 * r, r); ctx.lineTo(-0.7 * r, 0.75 * r); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(-0.5 * r, 0.6 * r); ctx.lineTo(0.3 * r, 0.75 * r); ctx.lineTo(-0.1 * r, 0.1 * r); ctx.closePath(); ctx.fill();
    },
  };
  function rockfallTick(S, f, af) {
    if (af === 11) { S.events.push({ t: 'thud', s: f.slot, x: f.x, y: f.y, k: 'rf' + f.slot + '_' + S.frame }); G.sfx(S, f, 'crack'); }
    if (af === 13) { // ÉBOULIS : des rochers tombent des deux côtés (frappent vers le bas)
      const k = 1 + 0.4 * (f.charge || 0) / 60;
      for (const [d, h0] of [[16, 26], [26, 30]]) for (const s of [-1, 1]) {
        G.spawnProj(S, f, 'mrock', { x: f.x + s * d, y: f.y + h0, vx: 0, vy: -2, grav: 0.18, life: 46, r: 3.4, dmg: 12 * k, ang: 275, bkb: 32, kbg: 80, t: 'normal', pierce: true, clank: false, refl: false, dir: s });
      }
    }
  }
  function dthrowTick(S, f, af, inp, M) { // il plaque au sol et plonge sous terre à côté : tech-chase en sous-sol
    const v = S.fighters[f.grabbing];
    G.throwTick(S, f, af, inp, M);
    if (af === M.rel && v && !v.dead) {
      v.grounded = f.grounded; v.plat = f.plat; v.y = f.y; v.kbx = 0; v.kby = 0; v.vx = 0; v.vy = 0; v.hitstun = 0; v.tumble = false;
      if (v.grounded) { G.setAction(v, 'down'); v.af = 6; }
    }
    if (af === M.rel + 3 && f.grounded && f.plat === -1) { enterGround(S, f, f.x - f.facing * 4); return 'stop'; }
  }
  const slideTick = (S, f, af) => {
    if (af === 3) f.vx = f.facing * U.clamp(Math.abs(f.vx), 2.2, 2.8);
    if (af > 3) f.vx = U.approach(f.vx, 0, af < 16 ? 0.05 : 0.1);
  };
  const dome = (f0, f1, R, n, r, dmg, ang, bkb, kbg, o) => { // dôme de terre (tous les cercles en même temps)
    const out = [];
    for (let i = 0; i < n; i++) { const a = (15 + 150 * i / (n - 1)) * Math.PI / 180; out.push(H(f0, f1, +(Math.cos(a) * R).toFixed(2), +(3 + Math.sin(a) * R).toFixed(2), r, dmg, ang, bkb, kbg, o)); }
    return out;
  };

  // ---------- Palettes ----------
  const PALS = [
    { name: 'Normal', body: '#4b4140', dark: '#2f2827', face: '#f3efea', red: '#c43b47', steel: '#d2d7de', steelD: '#7b8592', nose: '#f19aa6', eye: '#1b1226', foot: '#3a3130' },
    { name: 'Casque de chantier', body: '#5a4a3e', dark: '#382c24', face: '#f6f0e4', red: '#e0662a', steel: '#ffd23a', steelD: '#b08410', nose: '#f4a0a0', eye: '#1b1226', foot: '#3a2e26' },
    { name: 'Rouillé', body: '#3e3632', dark: '#26201d', face: '#efe6dc', red: '#9a3a2a', steel: '#d88a5a', steelD: '#7a3e20', nose: '#e89a8a', eye: '#1b1226', foot: '#2e2622' },
    { name: 'Obsidienne', body: '#2a2433', dark: '#17131d', face: '#e8e4f4', red: '#7a5cff', steel: '#b8c0ff', steelD: '#4a52a0', nose: '#d8a0e8', eye: '#100c18', foot: '#1e1a26' },
  ];

  // ---------- Dessin ----------
  function claw(ctx, x, y, a, open, c, k) { // ÉNORMES lames d'acier dentelées en forme de feuille (a : angle de pose, 0 = bas, 90 = devant)
    const L = 9.6 * (k || 1), spread = 8 + (open || 0) * 18;
    for (const sg of [-1, 1]) {
      const [dx, dy] = D.dir(a + sg * spread), nx = -dy * sg, ny = dx * sg;
      const P = (u, o) => [x + dx * L * u + nx * o, y + dy * L * u + ny * o];
      // bord extérieur bombé avec deux grosses dents, bord intérieur droit
      const pts = [...P(-0.05, 0.9), ...P(0.18, 2.3), ...P(0.36, 2.7), ...P(0.42, 1.7), ...P(0.6, 2.2), ...P(0.68, 1.2), ...P(0.86, 0.9), ...P(1, 0), ...P(0.6, -0.9), ...P(0.2, -1.1), ...P(-0.05, -0.6)];
      D.poly(ctx, pts, D.lin(ctx, ...P(0, 0), ...P(1, 0), c.steelD, c.steel));
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(...P(0.08, 0.3)); ctx.lineTo(...P(0.9, 0.15)); ctx.stroke();
      ctx.strokeStyle = 'rgba(40,40,60,0.35)'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(...P(0.1, -0.5)); ctx.lineTo(...P(0.8, -0.35)); ctx.stroke();
    }
  }
  function helmetPts() { // grand casque d'acier : couvre le haut de la tête, deux grosses dents, finit en lame vers l'avant
    return [-6.0, 10.4, -5.8, 14.6, -4.2, 17.6, -3.0, 21.0, -0.8, 18.6, 1.4, 21.4, 3.2, 18.8, 6.0, 17.6, 10.8, 15.0, 7.6, 13.9, 4.8, 14.1, 2.0, 14.5, -1.2, 13.5, -4.0, 11.6];
  }
  function drawUnder(ctx, P, c, t) { // sous terre : la bosse de terre et l'aileron (le casque) qui dépasse
    const b = P.bulge || 0, sh = b > 0 ? Math.sin(t * 60) * 0.3 * b : 0;
    ctx.save(); ctx.translate(sh, 0);
    D.ell(ctx, 0, 0.3, 7 + b * 2.5, 2.1 + b * 1.6, 0, '#7a5a3c');
    D.ell(ctx, -0.6, 1.0 + b * 0.8, 5 + b * 1.6, 0.9 + b * 0.6, 0, 'rgba(160,125,85,0.9)', true);
    ctx.fillStyle = '#5a4230'; for (const [px, py] of [[-4.5, 0.8], [3.8, 1.0], [5.6, 0.2], [-2, 1.6]]) { ctx.beginPath(); ctx.arc(px, py, 0.45, 0, 7); ctx.fill(); }
    const fin = [-3.6, 0.6, -2.2, 3.8, -0.8, 3.1, 0.4, 6.0, 1.8, 4.7, 3.6, 7.0, 3.3, 3.5, 4.8, 0.6];
    D.poly(ctx, fin, D.lin(ctx, 0, 0.6, 0, 7, c.steelD, c.steel));
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(-2, 3.2); ctx.lineTo(0.5, 5.5); ctx.lineTo(3.3, 6.4); ctx.stroke();
    ctx.restore();
  }
  function drawCone(ctx, P, c, t, cx, cy) { // mode foreuse : casque + griffes forment un cône qui tourne
    const [dx, dy] = D.dir(P.dA == null ? 90 : P.dA), nx = -dy, ny = dx;
    const L = 15, R = 6.2, bx = cx + dx * 1.5, by = cy + dy * 1.5, tx = bx + dx * L, ty = by + dy * L;
    ctx.beginPath(); ctx.moveTo(bx + nx * R, by + ny * R); ctx.lineTo(tx, ty); ctx.lineTo(bx - nx * R, by - ny * R);
    ctx.quadraticCurveTo(bx - dx * 2.2, by - dy * 2.2, bx + nx * R, by + ny * R); ctx.closePath();
    const g = ctx.createLinearGradient(bx + nx * R, by + ny * R, bx - nx * R, by - ny * R);
    g.addColorStop(0, c.steelD); g.addColorStop(0.45, c.steel); g.addColorStop(1, c.steelD);
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(30,25,40,0.55)'; ctx.lineWidth = 0.55; // rainures en hélice qui défilent
    const ph = (t * 7) % 1;
    for (let i = -1; i < 7; i++) {
      const u = (i + ph) / 6, u2 = u + 0.13;
      ctx.beginPath(); ctx.moveTo(bx + dx * L * u + nx * R * (1 - u), by + dy * L * u + ny * R * (1 - u));
      ctx.lineTo(bx + dx * L * u2 - nx * R * (1 - u2), by + dy * L * u2 - ny * R * (1 - u2)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.4; // reflet
    ctx.beginPath(); ctx.moveTo(bx + nx * R * 0.45, by + ny * R * 0.45); ctx.lineTo(tx - nx * 0.3, ty - ny * 0.3); ctx.stroke();
    ctx.restore();
  }
  function draw(ctx, P, c, f, S, t) {
    if (P.under) { drawUnder(ctx, P, c, t); return; }
    const cr = P.crouch || 0, drill = (P.drill || 0) >= 0.5;
    ctx.save();
    if (P.sink) { ctx.beginPath(); ctx.rect(-30, 0, 60, 60); ctx.clip(); ctx.translate(0, -P.sink * 17); }
    ctx.scale(1 + cr * 0.08, 1 - cr * 0.26);
    const rot = (x, y) => { ctx.translate(x, y); ctx.rotate(-(P.lean || 0) * Math.PI / 180); ctx.translate(-x, -y); };
    const leg = (x, la, ka, col) => {
      const L = D.limb(ctx, x, 3.6, drill ? 60 : la, drill ? 60 : ka, 1.9, 1.8, 2.7, 2.3, col);
      D.ell(ctx, L.ex + 0.9, L.ey - 0.3, 1.9, 0.9, 0, c.foot);
      ctx.fillStyle = '#e8e4dc'; for (const o of [2.1, 2.9]) { ctx.beginPath(); ctx.moveTo(L.ex + o, L.ey - 0.2); ctx.lineTo(L.ex + o + 0.9, L.ey - 0.6); ctx.lineTo(L.ex + o, L.ey - 0.8); ctx.closePath(); ctx.fill(); }
    };
    const arm = (sx, sy, a, e, col, open) => {
      const L = D.limb(ctx, sx, sy, a, -(e || 0), 2.3, 2.0, 2.7, 2.3, col);
      claw(ctx, L.ex, L.ey, L.a2, open, c);
    };
    leg(-1.9, P.lB, P.kB, c.dark);
    ctx.save(); rot(0, 6.5);
    if (!drill) arm(-1.4, 9.8, P.aB, P.eB, c.dark, P.claw);
    // corps en poire
    const bodyPts = drill ? [-5.2, 4.4, 4.4, 4.4, 6.0, 7.6, 5.0, 11.4, 1.0, 13.6, -3.4, 13.0, -5.8, 10.2, -6.4, 6.8] : [-5.6, 2.8, 5.4, 2.8, 6.6, 6.2, 5.6, 10.6, 4.0, 13.6, 0.6, 15.2, -3.4, 14.6, -5.6, 11.6, -6.6, 6.6];
    D.blob(ctx, bodyPts, D.shade(ctx, 0, 8.5, 8.5, c.body));
    // marques rouges en éclair sur le ventre
    D.poly(ctx, [1.2, 10.2, 4.0, 8.8, 2.9, 8.0, 5.4, 6.0, 2.8, 6.7, 3.7, 4.6, 0.4, 7.0, 1.7, 8.0, 0.2, 9.0], c.red, false);
    D.poly(ctx, [-2.2, 6.6, 0.0, 5.2, -0.8, 4.4, 1.0, 3.2, -1.2, 3.6, -2.8, 5.2], c.red, false);
    D.poly(ctx, [-5.4, 10.0, -3.2, 8.6, -3.9, 7.8, -2.0, 6.6, -4.4, 7.0, -5.9, 8.6], c.red, false);
    if (drill) {
      drawCone(ctx, P, c, t, 0.6, 9);
    } else {
      // tête : museau blanc à nez rose, lignes rouges, petit œil sous la visière, casque d'acier
      ctx.save(); ctx.translate(2.6, 12.5); ctx.rotate(-(P.hd || 0) * Math.PI / 180); ctx.translate(-2.6, -12.5);
      D.blob(ctx, [0.6, 14.2, 4.6, 14.4, 7.8, 14.0, 10.0, 12.6, 9.7, 10.6, 7.2, 9.4, 3.6, 9.4, 0.8, 10.8], c.face);
      ctx.strokeStyle = c.red; ctx.lineWidth = 0.6; ctx.lineCap = 'round'; // lignes rouges sur le museau
      ctx.beginPath(); ctx.moveTo(2.6, 13.4); ctx.lineTo(6.0, 11.4); ctx.moveTo(2.0, 12.0); ctx.lineTo(4.8, 10.3); ctx.moveTo(1.8, 10.8); ctx.lineTo(3.4, 9.9); ctx.stroke();
      D.ell(ctx, 9.7, 11.5, 1.15, 0.95, 0, c.nose);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(9.4, 11.9, 0.3, 0, 7); ctx.fill();
      const ex = P.eye;
      if (ex === 2 || ex === 3) D.eye(ctx, 6.6, 12.9, 0.6, ex);
      else { D.ell(ctx, 6.6, 12.95, 0.68, 0.5, 0, c.eye, true); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6.85, 13.1, 0.18, 0, 7); ctx.fill(); }
      D.poly(ctx, helmetPts(), D.lin(ctx, 0, 19, 0, 12, c.steel, c.steelD));
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(-4.4, 15.4); ctx.quadraticCurveTo(1.5, 18.0, 9.2, 15.0); ctx.stroke();
      if (ex === 1) { ctx.fillStyle = U.shade(c.steelD, -0.3); ctx.beginPath(); ctx.moveTo(5.2, 13.9); ctx.lineTo(7.9, 13.9); ctx.lineTo(7.3, 13.3); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    ctx.restore();
    leg(1.9, P.lF, P.kF, U.shade(c.dark, 0.12));
    if (!drill) { ctx.save(); rot(0, 6.5); arm(2.2, 9.4, P.aF, P.eF, U.shade(c.body, -0.12), P.claw); ctx.restore(); }
    if (P.glow) { ctx.fillStyle = `rgba(255,220,150,${0.18 + 0.12 * Math.sin(t * 25)})`; ctx.beginPath(); ctx.ellipse(0, 9, 9, 10, 0, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  G.registerChar({
    id: 'minotaupe', name: 'Minotaupe', short: 'Minotaupe', dex: 530, color: '#c43b47', trail: '#e8ecf2',
    desc: 'La foreuse. B = la perceuse monte en régime toute seule (B à nouveau = il visse ; saut / bouclier = il garde la charge ; régime max = KO en un coup à 100 %+). Côté B = Tour Rapide, haut B = Forage dans l\'angle choisi, bas B = Tunnel (sous terre : B jaillit, A Séisme, saut bondit). Bas en l\'air = Perceuse qui enterre, arrière en l\'air = Perceuse arrière, neutre en l\'air = Tranche (pointe = critique).',
    stats: {
      weight: 112, h: 18, w: 10, walk: 1.0, walkAcc: 0.1, dash: 2.1, dashF: 12, run: 1.95, runAcc: 0.1, traction: 0.1,
      air: 0.98, airAcc: 0.06, grav: 0.106, fall: 1.75, ffall: 2.8, fullHop: 29, shortHop: 14, dJump: 28, grabRange: 1.15,
    },
    formStats: { turbo: { walk: 1.25, dash: 2.5, run: 2.45, air: 1.2, airAcc: 0.08 } },
    palettes: PALS,
    init(f) { f.v.form = null; f.v.revs = 0; f.v.digCd = 0; f.v.turboT = 0; f.v.tunT = 0; f.v.quaked = 0; f.v.spinAir = 0; f.v.under = 0; },
    passive(S, f) {
      if (f.v.digCd > 0) f.v.digCd--;
      if (f.v.turboT > 0 && --f.v.turboT === 0 && f.v.form === 'turbo') f.v.form = null;
      if (f.grounded || f.action === 'ledge') f.v.spinAir = 0;
      if (f.v.under && !(f.action === 'move' && UNDER[f.move])) leaveGround(S, f); // déterré par un coup
    },
    onKO(S, f) { f.v.revs = 0; f.v.under = 0; f.v.digCd = 0; f.v.turboT = 0; f.v.tunT = 0; if (f.v.form === 'turbo') f.v.form = null; },
    moves: {
      // griffe, griffe, coup de casque
      jab: { len: 15, iasa: 13, next: ['jab2', 4, 13], hits: [H(3, 4, 10, 9, 4.5, 2.5, 361, 20, 22, ST_())], anim: [[0, {}], [2, { aF: 40, eF: 30 }], [3, { aF: 100, eF: 0, lean: 6 }], [8, { aF: 95 }], [15, {}]] },
      jab2: { len: 16, next: ['jab3', 4, 14], hits: [H(3, 4, 10, 9, 4.5, 2.5, 361, 22, 22, ST_())], anim: [[0, {}], [2, { aB: 40 }], [3, { aB: 100, aF: 10, lean: 8 }], [8, { aB: 95 }], [16, {}]] },
      jab3: { len: 30, hits: perf([H(5, 7, 8, 12, 5.5, 5, 45, 55, 90, DR())]), anim: A.headbutt(5, 7, 30) },
      // Griffe Acier
      ftilt: { len: 28, hits: [H(7, 9, 13, 8, 5.5, 9, 361, 30, 92, ST_()), H(7, 9, 6, 8, 4, 8, 361, 28, 88, ST_())], anim: A.punch(7, 9, 28) },
      // griffes en ciseaux au-dessus de la tête
      utilt: { len: 26, hits: G.LINE(6, 9, -4, 20, 6, 20, 3, 4.5, 7, 92, 40, 92, ST_()), anim: [[0, {}], [4, { aF: 150, aB: 150, claw: 1 }], [6, { aF: 185, aB: 175, claw: 0, eye: 1 }], [12, { aF: 180, aB: 170 }], [26, {}]] },
      // Gratte-Sol : rapide, envoie à 80° (lance les combos)
      dtilt: { len: 20, hurtH: 0.6, hits: [H(5, 6, 11, 2, 4.5, 5, 80, 55, 40, ST_())], anim: A.lowPoke(5, 6, 20) },
      // glissade sur le ventre, casque en avant
      dashAtk: { len: 40, keepVel: 1, hurtH: 0.55, tick: slideTick, hits: perf([H(4, 9, 8, 5, 6, 10, 50, 55, 75, DR()), H(10, 22, 7, 4, 5, 6, 60, 40, 50, DR({ g: 1 }))]), anim: [[0, { lean: 10 }], [3, { lean: 75, aF: 150, aB: 140, lF: 60, lB: 40 }], [22, { lean: 75, aF: 150, aB: 140, lF: 60, lB: 40 }], [30, { lean: 20 }], [40, {}]] },
      // PELLETEUSE : il ramasse l'adversaire et le jette par-dessus son épaule (vers l'arrière)
      fsmash: { len: 50, charge: 9, hits: perf([H(14, 16, 11, 4, 6.5, 16, 125, 40, 98, DR()), H(14, 16, 5, 4, 5, 14, 125, 38, 94, DR())]), anim: [[0, {}], [9, { aF: -30, aB: -20, crouch: 0.5, lean: 22, eye: 1, claw: 1 }], [13, { aF: 20, aB: 30, crouch: 0.6, lean: 30, claw: 1 }], [15, { aF: 150, aB: 160, lean: -25, crouch: 0.1, eye: 1, claw: 0 }], [22, { aF: 190, aB: 190, lean: -30 }], [50, {}]] },
      // TAUPINIÈRE : une taupinière explose en dôme tout autour de lui
      usmash: { len: 48, charge: 7, hits: dome(12, 14, 11, 7, 6, 14, 88, 32, 92), tick: (S, f, af) => { if (af === 12) G.sfx(S, f, 'dig', { mound: 1 }); }, anim: [[0, {}], [7, { crouch: 0.75, aF: 30, aB: 30, eye: 1 }], [11, { crouch: 0.85, aF: 10, aB: 10, sq: 0.9 }], [12, { aF: 175, aB: 175, sq: 1.12, eye: 1 }], [20, { aF: 170, aB: 170 }], [48, {}]] },
      // ÉBOULIS : il frappe le sol, des rochers tombent des deux côtés
      dsmash: { len: 50, charge: 5, tick: rockfallTick, hits: [H(11, 12, 0, 2, 8, 6, 70, 50, 40, ST_())], anim: [[0, {}], [5, { aF: 175, aB: 175, crouch: 0.3, eye: 1 }], [11, { aF: 70, aB: 70, crouch: 0.85, sq: 0.9, eye: 1 }], [20, { crouch: 0.6 }], [50, {}]] },
      // ---- aériens ----
      // TRANCHE : griffe avant de haut en bas, puis griffe arrière de bas en haut ; la pointe = COUP CRITIQUE (son de tipper)
      nair: { aerial: 1, len: 36, landLag: 10, ac: [3, 26], tick: nairTick, hits: nairHits, anim: [[0, {}], [3, { aF: 175, aB: -20, eF: 10, claw: 1, lean: -8 }], [5, { aF: 160, aB: -25, claw: 1, lean: -4, eye: 1 }], [8, { aF: 40, aB: -30, claw: 0.4, lean: 12, eye: 1 }], [11, { aF: 35, aB: -45, claw: 1, lean: 6 }], [12, { aF: 35, aB: -55, claw: 1, lean: 4, eye: 1 }], [15, { aF: 40, aB: -150, claw: 0.4, lean: -12, eye: 1 }], [24, { aF: 50, aB: -130, lean: -6 }], [36, {}]] },
      // PIOCHE : gros coup de pioche ; si la pointe touche le coin du terrain, il s'y accroche de loin
      fair: { aerial: 1, len: 40, landLag: 12, ac: [3, 30], ledge: 8, ledgeRising: 1, tick: pickTick, hits: perf(G.ARC(10, 13, 0, 9, 11, 100, -20, 4, 5.5, 12, 45, 32, 84, DR())), anim: A.overhead(6, 10, 13, 40) },
      // PERCEUSE ARRIÈRE (⚙) : la foreuse pointée derrière lui ; la hitbox dure tant qu'elle tourne (le début est le plus fort)
      bair: { aerial: 1, len: 40, landLag: 16, ac: [3, 30], tick: bairTick, hits: perf([...G.LINE(8, 12, -7, 9, -15, 9, 2, 4.5, 15, 40, 34, 90, DR()), ...G.LINE(13, 21, -7, 9, -15, 9, 2, 4.2, 13, 40, 32, 84, DR())]), anim: [[0, {}], [4, { crouch: 0.15, lean: -6, dA: 270, eye: 1 }], [6, { drill: 1, dA: 270, lean: 4 }], [21, { drill: 1, dA: 270, lean: 4 }], [25, { dA: 270, lean: 2 }], [40, {}]] },
      // CASQUE PERFORANT : coup de lame du casque vers le haut (le jongle)
      uair: { aerial: 1, len: 30, landLag: 8, ac: [3, 22], hits: perf(G.LINE(4, 7, 1, 14, 1, 25, 3, 4.5, 7, 88, 35, 82, DR())), anim: [[0, {}], [3, { lean: 10, crouch: 0.2 }], [4, { lean: -35, hd: -20, sq: 1.12, aF: -20, aB: -30 }], [10, { lean: -25 }], [30, {}]] },
      // PERCEUSE : foreuse pointée vers le bas ; enterre l'adversaire posé au sol, spike hors du terrain
      dair: { aerial: 1, len: 42, landLag: 16, ac: [4, 30], tick: (S, f, af) => { if (af >= 6 && af <= 21) { f.vy = -1.5; f.ff = false; } }, hits: perf([H(6, 20, 0, -1.5, 5, 1.4, 270, 0, 0, DR({ rehit: 4, link: 1, hs: 8, hitlag: 0.4, onHit: buryHit })), H(22, 23, 0, -2, 6, 4, 280, 30, 70, DR({ g: 1, onHit: buryHit }))]), anim: [[0, {}], [5, { drill: 1, dA: 0 }], [23, { drill: 1, dA: 0 }], [30, {}], [42, {}]] },
      // ---- spéciaux ----
      nspec: { len: 220, land: 'keep', grav: 0.5, tick: revTick, anim: revAnim },
      sspec: { len: 52, tick: spinTick, keepVel: 1, offEdge: 1, land: 'keep', drift: 0, grav: 0.6, ledge: 14, anim: [[0, { crouch: 0.4 }], [5, { drill: 1, dA: 90 }], [35, { drill: 1, dA: 90 }], [40, {}], [52, {}]] },
      uspec: { len: 46, helpless: 1, landLag: 18, ledge: 14, ledgeRising: 1, tick: forageTick, drift: 0, noGrav: (af) => af >= 4 && af <= 27, anim: [[0, { crouch: 0.4 }], [4, { drill: 1, dA: 180 }], [27, { drill: 1, dA: 180 }], [32, { aF: 170, aB: 170 }], [46, {}]] },
      dspec: { len: 30, tick: digTick, hits: perf([H(4, 10, 0, 3, 7, 4, 80, 55, 30, DR())]), anim: [[0, {}], [3, { drill: 1, dA: 0, crouch: 0.3 }], [12, { drill: 1, dA: 0, sink: 1 }]] },
      dspecA: { len: 80, helpless: 1, landLag: 16, tick: plungeTick, onLand: plungeLand, drift: 0.3, anim: [[0, { crouch: 0.3 }], [5, { drill: 1, dA: 0 }], [80, { drill: 1, dA: 0 }]] },
      tunnel: { len: 400, phys: 'none', tick: tunnelTick, anim: [[0, { under: 1 }]] },
      quake: { len: 40, phys: 'none', tick: quakeTick, anim: [[0, { under: 1, bulge: 0.3 }], [14, { under: 1, bulge: 1 }], [24, { under: 1 }]] },
      rise: { len: 48, landLag: 18, ledge: 16, ledgeRising: 1, tick: riseTick, drift: 0, noGrav: (af) => af <= 25, anim: [[0, { under: 1, bulge: 1 }], [6, { under: 1, bulge: 1 }], [7, { drill: 1, dA: 180 }], [25, { drill: 1, dA: 180 }], [30, { aF: 170, aB: 170 }], [48, {}]] },
      emerge: { len: 22, tick: emergeTick, anim: [[0, { crouch: 0.9, sink: 0.5 }], [8, { crouch: 0.5 }], [22, {}]] },
      // ---- saisies / lancers ----
      fthrow: { throw: 1, len: 30, rel: 12, dmg: 8, ang: 40, bkb: 62, kbg: 60, t: 'steel', hold: [[0, 1, 0], [11, 1.5, 0.2]], anim: A.throwF },
      bthrow: { throw: 1, back: 1, len: 38, rel: 17, dmg: 10, ang: 45, bkb: 58, kbg: 68, t: 'steel', hold: [[0, 1, 0], [9, 0, 1.1], [17, -1.4, 0.3]], anim: [[0, { aF: 80, aB: 70 }], [9, { aF: 180, aB: 180, lean: -10 }], [17, { aF: 240, aB: 240, lean: -25, eye: 1 }], [38, {}]] },
      uthrow: { throw: 1, len: 38, rel: 18, dmg: 5, ang: 90, bkb: 66, kbg: 62, hitFrame: 12, hitDmg: 3, t: 'steel', hold: [[0, 1, 0], [10, 0.3, 1.0], [18, 0.2, 1.3]], anim: [[0, { aF: 80, aB: 70 }], [10, { aF: 170, aB: 170 }], [12, { lean: -30, sq: 1.1, eye: 1 }], [38, {}]] },
      dthrow: { throw: 1, len: 34, rel: 14, dmg: 6, ang: 80, bkb: 40, kbg: 20, t: 'steel', tick: dthrowTick, hold: [[0, 1, 0], [10, 0.9, 0]], anim: [[0, { aF: 80, aB: 70 }], [12, { aF: 20, aB: 20, crouch: 0.7, eye: 1 }], [16, { drill: 1, dA: 0, crouch: 0.5 }], [34, { drill: 1, dA: 0 }]] },
      // la foreuse tourne au-dessus de sa tête
      taunt: { len: 60, anim: [[0, {}], [8, { drill: 1, dA: 180 }], [48, { drill: 1, dA: 180 }], [52, { eye: 3 }], [60, {}]] },
    },
    pose(P, f) {
      if (f.action === 'move' && f.move === 'uspec' && f.mv.tilt != null && P.drill) P.dA = 180 - f.mv.tilt;
    },
    draw,
    drawFx(ctx, f, S, t) {
      const st = G.ST(f), x = G.R.px(f), y = G.R.py(f), mv = f.action === 'move' ? f.move : null;
      // ---- le son de la perceuse ----
      const Au = G.Audio, paused = G.Game && G.Game.paused;
      if (Au && Au.drill && !paused) {
        let lvl = -1, vol = 0.07, kind = 'whine';
        if (mv === 'nspec' && f.af <= 8 && !f.mv.go) { lvl = (f.mv.c || 0) / REV_MAX; vol = 0.05 + lvl * 0.06; }
        else if (mv === 'nspec' && f.mv.end && f.af < f.mv.end + 1) { lvl = Math.max(0.6, f.mv.k || 0); vol = 0.09; }
        else if ((mv === 'sspec' && f.af >= 6 && f.af <= 35) || (mv === 'uspec' && f.af >= 4 && f.af <= 27) || (mv === 'rise' && f.af >= 7 && f.af <= 25) || mv === 'dspecA' || (mv === 'dair' && f.af >= 5 && f.af <= 23) || (mv === 'bair' && f.af >= 6 && f.af <= 21) || (mv === 'dspec' && f.af >= 3) || (mv === 'taunt' && f.af >= 8 && f.af <= 48)) lvl = 0.55;
        else if (mv === 'tunnel' || mv === 'quake') { lvl = 0.5; kind = 'rumble'; vol = 0.05; }
        if (lvl >= 0) Au.drill(f.slot, lvl, vol, kind);
      }
      // ---- perceuse chargée : étincelles sur les griffes ----
      const charging = mv === 'nspec' && f.af <= 8 && !f.mv.go;
      const revs = charging ? f.mv.c || 0 : (mv === 'nspec' ? 0 : f.v.revs || 0);
      if (revs > 0) {
        const k = revs / REV_MAX, px = x + f.facing * (charging ? 13 : 9), py = y + st.h * 0.5;
        ctx.fillStyle = k >= 1 ? `rgba(255,90,60,${0.25 + 0.2 * Math.sin(t * 30)})` : `rgba(255,230,150,${0.12 + k * 0.18})`;
        ctx.beginPath(); ctx.arc(px, py, 3 + k * 3, 0, 7); ctx.fill();
        if (G.R.newFrame && Math.random() < 0.25 + k * 0.6) {
          const a = Math.random() * 6.28, sp = 0.8 + Math.random() * 1.5 * (0.5 + k);
          G.R.parts.push({ ty: 'spark', x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 10, max: 10, size: 0.6, col: k >= 1 ? '#ff7a4a' : '#fff1a8' });
        }
      }
      // ---- sous terre : traînée de terre ; Séisme : fissures qui parcourent le terrain ----
      if ((mv === 'tunnel' || mv === 'quake') && G.R.newFrame && S.frame % 3 === 0 && Math.abs(f.vx) > 0.3) G.R.parts.push({ ty: 'smoke', x: x - f.facing * 5, y: y + 0.8, vx: -f.vx * 0.2, vy: 0.25, life: 18, max: 18, size: 1.1, col: 'rgba(140,105,70,0.8)' });
      if (mv === 'quake' && f.af < 14) {
        const m = S.stage.main, k = f.af / 14;
        ctx.strokeStyle = `rgba(40,25,15,${0.5 + 0.4 * k})`; ctx.lineWidth = 0.5;
        for (const s of [-1, 1]) {
          const x1 = U.clamp(x + s * (m.r - m.l) * k, m.l, m.r);
          ctx.beginPath(); ctx.moveTo(x, m.y + 0.4);
          for (let xx = x, i = 0; s > 0 ? xx < x1 : xx > x1; xx += s * 4, i++) ctx.lineTo(xx, m.y + 0.4 + (i % 2 ? 1.1 : -0.3));
          ctx.stroke();
        }
      }
      // ---- adversaires enterrés : butte de terre autour d'eux ----
      for (const o of S.fighters) {
        if (!(o.v.buried > 0) || o.hitlag <= 0 || o.action === 'hit' || o.dead) continue;
        const ox = G.R.px(o), oy = G.R.py(o), w = G.ST(o).w;
        D.ell(ctx, ox, oy + 0.3, w * 0.9, 1.8, 0, '#7a5a3c'); D.ell(ctx, ox - 0.5, oy + 1.0, w * 0.6, 0.7, 0, 'rgba(160,125,85,0.9)', true);
      }
    },
    fx(e, R) {
      const text = (txt, col, sz) => R.parts.push({ ty: 'custom', x: e.x, y: e.y + 18, life: 50, max: 50, draw(ctx, p, k) {
        ctx.save(); ctx.translate(p.x, p.y + (1 - k) * 10); ctx.scale(0.4, -0.4);
        ctx.font = `italic 900 ${sz || 15}px Rubik, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1b1226'; ctx.globalAlpha = Math.min(1, k * 2);
        ctx.strokeText(txt, 0, 0); ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore(); ctx.globalAlpha = 1;
      } });
      const dirt = (n, sp) => { for (let i = 0; i < n; i++) { const a = Math.PI * (0.1 + Math.random() * 0.8), s = (0.6 + Math.random()) * (sp || 1.6); R.parts.push({ ty: 'smoke', x: e.x + (Math.random() - 0.5) * 6, y: e.y + 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, grav: 0.06, life: 24, max: 24, size: 0.7 + Math.random() * 0.9, col: i % 3 ? 'rgba(130,95,60,0.9)' : 'rgba(90,65,40,0.9)' }); } };
      if (e.burst || e.mound) { dirt(e.mound ? 22 : 14, e.mound ? 2.4 : 1.8); R.cam.shake = Math.max(R.cam.shake, 2); }
      if (e.dirt) R.parts.push({ ty: 'smoke', x: e.x + (Math.random() - 0.5) * 6, y: e.y + 0.6, vx: (Math.random() - 0.5) * 0.6, vy: 0.3 + Math.random() * 0.3, grav: 0.03, life: 16, max: 16, size: 0.7, col: 'rgba(130,95,60,0.85)' });
      if (e.bulge) { dirt(8, 0.9); R.parts.push({ ty: 'ring', x: e.x, y: e.y + 1, life: 14, max: 14, size: 9, col: '#c8a070', flat: 1 }); }
      if (e.bury) { dirt(16, 1.4); text('ENTERRÉ !', '#e8c48a', 13); R.cam.shake = Math.max(R.cam.shake, 4); }
      if (e.unbury) dirt(10, 1.2);
      if (e.quake) {
        R.cam.shake = Math.max(R.cam.shake, 9);
        const m = G.Game && G.Game.S ? G.Game.S.stage.main : { l: -80, r: 80, y: 0 };
        for (let xx = m.l; xx < m.r; xx += 6) R.parts.push({ ty: 'smoke', x: xx, y: m.y + 0.5, vx: 0, vy: 0.5 + Math.random() * 0.5, grav: 0.04, life: 20, max: 20, size: 1.2, col: 'rgba(150,115,80,0.8)' });
        text('SÉISME !', '#ffcf7a', 15);
      }
      if (e.ohko) {
        text('EMPAL\'KORNE !', '#ff5a3a', 20); R.flashScreen = 0.6; R.cam.shake = Math.max(R.cam.shake, 14);
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 26, max: 26, size: 26, col: '#ff7a4a' }); R.spark(e.x, e.y, '#ffffff', 24, 4);
      }
      if (e.revFull) { R.parts.push({ ty: 'ring', x: e.x, y: e.y + 9, life: 20, max: 20, size: 12, col: '#ff7a4a' }); text('RÉGIME MAX !', '#ff9a6a', 12); }
      if (e.turbo) text('TURBO !', '#9ae8ff', 11);
      if (e.hook) { R.parts.push({ ty: 'star', x: e.x, y: e.y, life: 10, max: 10, size: 5, col: '#ffffff', rot: 0 }); R.spark(e.x, e.y, '#fff1a8', 8, 1.5); }
      if (e.hardGround) R.spark(e.x, e.y + 1, '#ffffff', 5, 1);
      if (e.drillGo || e.drillBoom) R.spark(e.x, e.y + 9, '#fff1a8', e.drillBoom ? 14 : 6, e.drillBoom ? 2.6 : 1.6);
      if (e.crit) { // pointe des griffes : trait de lumière + étincelles blanches
        R.parts.push({ ty: 'custom', x: e.x, y: e.y, life: 10, max: 10, rot: Math.random() * Math.PI, draw(ctx, p, k) {
          const L = 15 * (1.25 - k * 0.25);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.lineCap = 'round'; ctx.globalAlpha = Math.min(1, k * 1.6);
          ctx.strokeStyle = '#bfe4ff'; ctx.lineWidth = 2.2 * k; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.9 * k; ctx.beginPath(); ctx.moveTo(-L * 1.15, 0); ctx.lineTo(L * 1.15, 0); ctx.stroke();
          ctx.restore(); ctx.globalAlpha = 1;
        } });
        R.spark(e.x, e.y, '#ffffff', 12, 2.4); R.cam.shake = Math.max(R.cam.shake, 3);
      }
      if (e.rockBreak) { dirt(8, 1.1); R.parts.push({ ty: 'star', x: e.x, y: e.y, life: 8, max: 8, size: 4, col: '#d8c8b0', rot: 0.4 }); }
    },
    hud(ctx, f, S, x, y, pw, ph, u) {
      let txt = null, col = '#ffb08a';
      if (f.v.revs > 0) txt = 'PERCEUSE ' + (f.v.revs >= REV_MAX ? 'MAX' : Math.round(f.v.revs / REV_MAX * 100) + '%');
      else if (f.v.turboT > 0) { txt = 'TURBO ' + (f.v.turboT / 60).toFixed(1) + 's'; col = '#9ae8ff'; }
      else if (f.v.digCd > 0) { txt = 'TUNNEL ' + (f.v.digCd / 60).toFixed(1) + 's'; col = '#e8c48a'; }
      if (txt) { ctx.fillStyle = col; ctx.font = `900 ${10 * u}px Rubik, sans-serif`; ctx.textAlign = 'left'; ctx.fillText(txt, x + ph + 2 * u, y + 43 * u); }
    },
  });
})(window.G);
