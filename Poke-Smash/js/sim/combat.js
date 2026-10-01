'use strict';
// Combat : hitbox/hurtbox, formule de knockback d'Ultimate, DI, hitlag, bouclier/parry,
// contres, armure, prises et lancers, projectiles.
(function (G) {
  const U = G.U, C = G.C;

  G.PROJ = {};

  // Formule officielle (Smash 4 / Ultimate)
  G.knockback = (p, d, w, kbg, bkb, fkb) => {
    if (fkb) return ((((1 + fkb * 10 / 20) * (200 / (w + 100)) * 1.4) + 18) * (kbg / 100)) + bkb;
    return ((((p / 10 + p * d / 20) * (200 / (w + 100)) * 1.4) + 18) * (kbg / 100)) + bkb;
  };
  const rage = (f) => f ? 1 + U.clamp((f.percent - 35) / 115, 0, 1) * 0.1 : 1;
  const chargeMul = (f) => {
    if (!f || f.action !== 'move') return 1;
    const M = G.MV(f, f.move);
    return M && M.charge ? 1 + 0.4 * f.charge / 60 : 1;
  };

  G.pendingHitbox = (S, f, hb, tag) => { hb.r = G.hbScale(hb.r); S.tmpHits.push({ s: f.slot, hb }); };

  // Mémoire des coups reçus. L'horloge est celle de l'attaquant (son frame d'animation, ou l'âge du
  // projectile) : le hitlag gèle donc aussi le rythme des coups multiples, comme dans Smash.
  function canHit(S, t, key, rehit, clock) {
    for (const m of t.hitMem) {
      if (m[0] === key) {
        if (rehit && clock - m[1] >= rehit) { m[1] = clock; return true; }
        return false;
      }
    }
    t.hitMem.push([key, clock]);
    if (t.hitMem.length > 24) t.hitMem.shift();
    return true;
  }
  function peekHit(S, t, key, rehit, clock) {
    for (const m of t.hitMem) if (m[0] === key) return rehit ? clock - m[1] >= rehit : false;
    return true;
  }

  function activeHits(S, f) {
    const out = [];
    if (f.dead || f.out || f.hitlag > 0 || f.frz) return out;
    if (f.action === 'move') {
      const M = G.MV(f, f.move);
      if (M && M.hits) for (const hb of M.hits) {
        if (f.af >= hb.f[0] && f.af <= hb.f[1] && (!hb.cond || hb.cond(f, S))) out.push(hb);
      }
    }
    for (const t of S.tmpHits) if (t.s === f.slot) out.push(t.hb);
    return out;
  }
  G.activeHits = activeHits;

  const hbX = (f, hb) => f.x + hb.x * f.facing;
  const hbY = (f, hb) => f.y + hb.y;

  G.resolveCombat = (S) => {
    const F = S.fighters;
    const hits = [];
    // Coups au corps à corps
    for (const a of F) {
      const hbs = activeHits(S, a);
      if (!hbs.length) continue;
      for (const t of F) {
        if (t === a || t.dead || t.out) continue;
        if (S.teams && t.team === a.team) continue;
        if (t.invinc > 0 || t.intang > 0) continue;
        if (t.grabbedBy === a.slot) continue;
        const hu = G.hurtbox(S, t);
        for (const hb of hbs) {
          if (hb.grab) {
            if (t.grabbedBy >= 0 || t.grabbing >= 0 || t.action === 'ledge' || t.action === 'respawn') continue;
            // (les saisies attrapent aussi un adversaire en l'air s'il est à portée)
          }
          if (hb.noGround && t.grounded) continue;
          if (hb.noAir && !t.grounded) continue;
          const wx = hbX(a, hb), wy = hbY(a, hb);
          if (U.distSeg(wx, wy, hu.x, hu.y0, hu.x, hu.y1) > hb.r + hu.r) continue;
          const key = 'f' + a.slot + '_' + a.mi + '_' + (hb.g || 0);
          if (!hb.grab && !peekHit(S, t, key, hb.rehit, a.mc)) break;
          let dir = a.facing;
          if (hb.rev !== false && hb.rev) dir = (t.x - a.x) * a.facing < 0 ? -a.facing : a.facing;
          if (hb.away) dir = t.x >= a.x ? 1 : -1;
          else if (!hb.rev && hb.x < -1 && (hb.ang === 361 || hb.ang <= 90)) dir = -a.facing;
          hits.push({ att: a, tgt: t, hb, key, clock: a.mc, x: (wx + hu.x) / 2, y: U.clamp(wy, hu.y0 - hu.r, hu.y1 + hu.r), dir, wx, wy });
          break;
        }
      }
    }
    // Projectiles : renvoi, contact
    for (const p of S.projs) {
      if (p.dead || p.harmless) continue;
      const own = F[p.owner];
      for (const t of F) {
        if (t.slot === p.owner || t.dead || t.out) continue;
        if (S.teams && own && t.team === own.team) continue;
        // Réflecteur
        if (t.action === 'move' && p.refl !== false) {
          const M = G.MV(t, t.move);
          if (M && M.reflect && t.af >= M.reflect[0] && t.af <= M.reflect[1]) {
            const rx = t.x + (M.reflect[2] || 0) * t.facing, ry = t.y + (M.reflect[3] || 8);
            if (U.len(p.x - rx, p.y - ry) < (M.reflect[4] || 12) + p.r) {
              p.owner = t.slot; p.vx = -p.vx * 1.3; p.vy = -p.vy * 0.5; p.dmg *= 1.4; p.hitMem = []; p.dir = -p.dir; p.life = Math.max(p.life, 60);
              S.events.push({ t: 'reflect', s: t.slot, x: p.x, y: p.y, k: 'rf' + p.id + '_' + S.frame });
              if (M.onReflect) M.onReflect(S, t, p);
              break;
            }
          }
        }
        if (t.invinc > 0 || t.intang > 0) continue;
        if (p.noAir && !t.grounded) continue;
        const hu = G.hurtbox(S, t);
        if (U.distSeg(p.x, p.y, hu.x, hu.y0, hu.x, hu.y1) > p.r + hu.r) continue;
        const key = 'p' + p.id;
        if (!peekHit(S, t, key, p.rehit, p.age)) continue;
        let dir = p.away ? (t.x >= p.x ? 1 : -1) : (p.vx > 0.05 ? 1 : p.vx < -0.05 ? -1 : p.dir);
        if (p.trajKb) { let a = U.datan2(p.vy, p.vx); if (a < 0) a += 360; p.ang = a; dir = 1; } // éjecte dans l'axe de la trajectoire
        hits.push({ att: own, tgt: t, hb: p, proj: p, key, clock: p.age, x: p.x, y: p.y, dir, wx: p.x, wy: p.y });
        if (!p.pierce) break;
      }
    }
    // Coups contre projectiles (on peut détruire un projectile en le frappant)
    for (const a of F) {
      const hbs = activeHits(S, a);
      if (!hbs.length) continue;
      for (const p of S.projs) {
        if (p.dead || p.owner === a.slot || p.clank === false) continue;
        for (const hb of hbs) {
          if (hb.grab || !hb.dmg) continue;
          if (U.len(hbX(a, hb) - p.x, hbY(a, hb) - p.y) < hb.r + p.r && hb.dmg >= p.dmg * 0.8) {
            p.dead = true;
            S.events.push({ t: 'clank', x: p.x, y: p.y, k: 'ck' + p.id });
            break;
          }
        }
      }
    }
    // Application (ordre déterministe)
    for (const h of hits) {
      if (h.tgt.dead) continue;
      if (h.proj && h.proj.dead) continue;
      if (!canHit(S, h.tgt, h.key, h.hb.rehit, h.clock)) continue;
      let res = 'grab';
      if (h.hb.grab) doGrab(S, h.att, h.tgt);
      else res = applyHit(S, h);
      if (h.proj) {
        const K = G.PROJ[h.proj.kind];
        if (K && K.onHit) K.onHit(S, h.proj, h.tgt, res);
        if (!h.proj.pierce) h.proj.dead = true;
      }
    }
    S.tmpHits.length = 0;
  };

  G.surfY = (S, f) => {
    // hauteur de la surface sous le perso (ou null)
    const m = S.stage.main;
    let best = null;
    if (f.x >= m.l && f.x <= m.r && f.y >= m.y - 1) best = m.y;
    for (const p of S.stage.plats) if (f.x >= p.l && f.x <= p.r && f.y >= p.y - 1 && (best == null || p.y > best)) best = p.y;
    return best;
  };

  function doGrab(S, a, t) {
    if (a.action !== 'move') return;
    const M = G.MV(a, a.move);
    if (t.action === 'shield' || t.action === 'shieldOff') t.shieldStun = 0;
    if (M.onGrab) { M.onGrab(S, a, t); return; }
    a.grabbing = t.slot; G.setAction(a, 'hold'); a.vx = 0;
    t.grabbedBy = a.slot; G.setAction(t, 'grabbed');
    t.grabT = 70 + Math.floor(t.percent * 1.1);
    t.vx = t.vy = t.kbx = t.kby = 0; t.hitstun = 0; t.facing = -a.facing; t.ff = false;
    if (t.grabbing >= 0) { const o = S.fighters[t.grabbing]; if (o) { o.grabbedBy = -1; G.setAction(o, 'grel'); } t.grabbing = -1; }
    S.events.push({ t: 'grab', s: a.slot, x: t.x, y: t.y + 8, k: 'gr' + a.slot + '_' + S.frame });
  }
  G.doGrab = doGrab;

  function applyHit(S, h) {
    const { att, tgt, hb } = h;
    const isProj = !!h.proj;
    const tm = tgt.action === 'move' ? G.MV(tgt, tgt.move) : null;
    // Contre
    if (tm && tm.counter && tgt.af >= tm.counter[0] && tgt.af <= tm.counter[1] && !hb.unblockable) {
      S.events.push({ t: 'counter', s: tgt.slot, x: tgt.x, y: tgt.y + 8, k: 'ct' + tgt.slot + '_' + S.frame });
      tgt.flash = 10;
      if (att && !isProj) att.hitlag = 14;
      tgt.hitlag = 10;
      tm.onCounter(S, tgt, att, hb, h);
      return 'counter';
    }
    // Capacités passives (ex. déguisement de Mimiqui)
    const tch = G.CHARS[tgt.char];
    if (tch.absorb && tch.absorb(S, tgt, h)) {
      if (att && !isProj) att.hitlag = 8;
      return 'absorb';
    }
    // Bouclier / parry
    if (!hb.unblockable && (tgt.action === 'shield' || (tgt.action === 'shieldOff' && tgt.af <= C.PARRY))) {
      const hl = Math.min(30, Math.floor(hb.dmg * 0.65 + 6));
      if (tgt.action === 'shieldOff') {
        tgt.flash = 14; G.setAction(tgt, 'idle'); tgt.hitlag = 6;
        if (att && !isProj) att.hitlag = hl + 12;
        S.events.push({ t: 'parry', s: tgt.slot, x: h.x, y: h.y, k: 'py' + tgt.slot + '_' + S.frame });
        return 'parry';
      }
      if (att && !isProj && att.action === 'move') att.mv.shielded = (att.mv.shielded || 0) + 1;
      const sd = hb.dmg * (isProj ? 1 : 1.19) * S.dmgMul + (hb.shieldDmg || 0);
      tgt.shield -= sd;
      S.events.push({ t: 'shieldHit', s: tgt.slot, x: h.x, y: h.y, dmg: hb.dmg, k: 'sh' + tgt.slot + '_' + S.frame + '_' + h.key });
      if (tgt.shield <= 0) { tgt.shield = 0; G.shieldBreak(S, tgt); return 'shield'; }
      tgt.shieldStun = Math.floor(hb.dmg * (isProj ? 0.35 : 0.58) + 2);
      tgt.hitlag = Math.floor(hl * 0.67);
      if (att && !isProj) att.hitlag = Math.floor(hl * 0.67);
      const push = Math.min(1.7, 0.25 + hb.dmg * 0.075);
      tgt.vx = h.dir * push;
      if (att && !isProj && att.grounded && Math.abs(att.x - tgt.x) < 20) att.vx -= h.dir * push * 0.4;
      return 'shield';
    }
    // Dégâts
    let dmg = hb.dmg * S.dmgMul * (isProj ? 1 : chargeMul(att));
    if (att && !isProj && att.buff !== 1) { dmg *= att.buff; att.buff = 1; }
    const ach = att ? G.CHARS[att.char] : null;
    if (ach && ach.dmgBonus) dmg *= ach.dmgBonus(S, att, tgt, hb, isProj);
    const dmgFn = hb.dmgFn || (isProj && G.PROJ[hb.kind] && G.PROJ[hb.kind].dmgFn);
    if (dmgFn) dmg = dmgFn(S, att, tgt, dmg, h);
    if (tch.dmgTaken) dmg = tch.dmgTaken(S, tgt, hb, dmg);
    tgt.percent = Math.min(999, tgt.percent + dmg);
    tgt.stat.taken += dmg;
    if (att) att.stat.dmg += dmg;
    const st = G.ST(tgt);
    let kb = G.knockback(tgt.percent, dmg, st.weight, hb.kbg, hb.bkb, hb.fkb) * rage(att);
    if (tgt.action === 'crouch') kb *= 0.85;
    if (hb.kbMul) kb *= hb.kbMul;
    const kbFn = hb.kbFn || (isProj && G.PROJ[hb.kind] && G.PROJ[hb.kind].kbFn);
    if (kbFn) kb *= kbFn(S, att, tgt, h); // éjection qui dépend de la situation (vitesse de l'attaquant, pétales...)
    // Armure
    if (tm && tm.armor && tgt.af >= tm.armor[0] && tgt.af <= tm.armor[1] && kb < tm.armor[2]) {
      const hl = Math.min(30, Math.floor(dmg * 0.65 + 6));
      tgt.hitlag = hl; if (att && !isProj) att.hitlag = hl;
      tgt.flash = 6;
      S.events.push({ t: 'hit', s: att ? att.slot : -1, tg: tgt.slot, x: h.x, y: h.y, dmg, kb: 10, ht: hb.t || 'normal', armor: 1, k: 'h' + h.key + '_' + tgt.slot + '_' + S.frame });
      if (tm.onArmor) tm.onArmor(S, tgt, att, dmg);
      return 'armor';
    }
    const hl = Math.min(26, Math.floor((dmg * 0.55 + 5) * (hb.hitlag || 1)));
    const crouching = tgt.action === 'crouch';
    launch(S, tgt, kb, hb, h.dir, att, h);
    tgt.hitlag = Math.floor(hl * (hb.t === 'elec' ? 1.5 : 1) * (crouching ? 0.67 : 1));
    if (att && !isProj) att.hitlag = hl;
    // Propriétés spéciales : étourdissement, croche-pied, brûlure
    // Étourdissement : protection anti-enfermement. Après un étourdissement, la cible ne peut plus être
    // ré-étourdie pendant (durée + 1 s) : les coups qui étourdissent l'éjectent alors normalement.
    if (hb.stun && !((tgt.v.stunImm || 0) > 0)) { tgt.hitstun = Math.max(tgt.hitstun, hb.stun); tgt.kbx *= 0.25; tgt.kby *= 0.25; tgt.v.stun = hb.stun; tgt.tumble = false; tgt.v.stunImm = hb.stun + 60; }
    if (hb.trip && tgt.grounded && kb < 75) { G.setAction(tgt, 'down'); tgt.af = 8; tgt.kbx *= 0.3; tgt.hitstun = 0; tgt.tumble = false; }
    if (hb.burn) tgt.v.burn = Math.max(tgt.v.burn || 0, hb.burn);
    if (hb.poison) tgt.v.poison = Math.max(tgt.v.poison || 0, hb.poison);
    if (hb.turn) tgt.facing = -tgt.facing;
    if (att && !isProj && att.action === 'move') att.mv.hit = (att.mv.hit || 0) + 1;
    if (att && isProj) att.v.projHit = S.frame;
    if (hb.onHit) hb.onHit(S, att, tgt, h);
    if (ach && ach.onDealHit) ach.onDealHit(S, att, tgt, h, dmg, isProj);
    S.events.push({ t: 'hit', s: att ? att.slot : -1, tg: tgt.slot, x: h.x, y: h.y, dmg, kb, ht: hb.t || 'normal', ang: tgt.kbx || tgt.kby ? U.datan2(tgt.kby, tgt.kbx) : 0, k: 'h' + h.key + '_' + tgt.slot + '_' + S.frame });
    return 'hit';
  }
  G.applyHit = applyHit;

  function launch(S, t, kb, hb, dir, att, h) {
    const st = G.ST(t);
    // Libère les prises
    if (t.grabbing >= 0) { const v = S.fighters[t.grabbing]; if (v) { v.grabbedBy = -1; G.setAction(v, 'grel'); } t.grabbing = -1; }
    if (t.grabbedBy >= 0) { const g = S.fighters[t.grabbedBy]; if (g) { g.grabbing = -1; if (g.action === 'hold') G.setAction(g, 'idle'); } t.grabbedBy = -1; }
    t.ledge = 0;
    let kbx, kby, hs;
    if (hb.link && h) {
      // multi-coups : on aspire la cible vers la hitbox pour que la suite connecte
      const dx = h.wx - t.x, dy = h.wy - (t.y + st.h * 0.5);
      kbx = U.clamp(dx * 0.22, -1.4, 1.4) + (att ? att.vx * 0.9 : 0);
      kby = U.clamp(dy * 0.22, -1.4, 1.4) + (att && !att.grounded ? att.vy * 0.9 : 0.35);
      hs = hb.hs || 14;
      t.tumble = false;
    } else {
      let ang = hb.ang;
      if (ang === 361) ang = t.grounded ? (kb < 60 ? 0 : kb >= 88 ? 40 : (kb - 60) / 28 * 40) : 38;
      let a = dir >= 0 ? ang : 180 - ang;
      if (kb >= 25 && !hb.noDI) {
        const sx = t.prev[0] / 80, sy = t.prev[1] / 80;
        if (sx * sx + sy * sy > 0.05) {
          const perp = -U.dsin(a) * sx + U.dcos(a) * sy;
          a += 18 * U.clamp(perp, -1, 1);
        }
      }
      const sp = kb * C.KB_SPEED;
      kbx = U.dcos(a) * sp; kby = U.dsin(a) * sp;
      hs = Math.floor(kb * C.HITSTUN);
      t.tumble = kb >= C.TUMBLE;
    }
    t.vx = 0; t.vy = 0; t.ff = false; t.airdodged = false; t.v.helpAfter = 0;
    t.hitstun = Math.max(hs, 4);
    if (t.grounded) {
      if (kby <= 0.02 && !t.tumble) { t.kbx = kbx; t.kby = 0; }
      else {
        if (kby < 0) kby = -kby * 0.8;
        t.grounded = false; t.plat = null; t.y += 0.3; t.kbx = kbx; t.kby = Math.max(kby, 0.3);
      }
    } else { t.kbx = kbx; t.kby = kby; }
    G.setAction(t, 'hit');
    t.lastAtt = att ? att.slot : -1; t.lastAttT = 600;
    const ch = G.CHARS[t.char];
    if (ch.onHurt) ch.onHurt(S, t);
  }
  G.launch = launch;

  // ---------- Prises / lancers ----------
  G.throwTick = (S, f, af, inp, M) => {
    const v = S.fighters[f.grabbing];
    if (!v || v.grabbedBy !== f.slot) { f.grabbing = -1; return; }
    v.action = 'thrown';
    if (M.hitFrame && af === M.hitFrame) { // coup intermédiaire (ex. piqué)
      v.percent += (M.hitDmg || 2) * S.dmgMul;
      S.events.push({ t: 'hit', s: f.slot, tg: v.slot, x: v.x, y: v.y + 6, dmg: M.hitDmg || 2, kb: 20, ht: M.t || 'normal', k: 'th' + f.slot + '_' + S.frame });
    }
    if (af === M.rel) G.applyThrow(S, f, v, M);
  };
  G.applyThrow = (S, a, v, M) => {
    const dir = M.back ? -a.facing : a.facing;
    let dmg = M.dmg * S.dmgMul;
    if (a.buff !== 1) { dmg *= a.buff; a.buff = 1; }
    v.percent = Math.min(999, v.percent + dmg);
    v.stat.taken += dmg; a.stat.dmg += dmg;
    const kb = G.knockback(v.percent, dmg, G.ST(v).weight, M.kbg, M.bkb, M.fkb) * rage(a);
    a.grabbing = -1; v.grabbedBy = -1;
    if (M.back && M.turn !== false) a.facing = -a.facing;
    launch(S, v, kb, { ang: M.ang }, dir, a);
    v.hitlag = 4;
    S.events.push({ t: 'hit', s: a.slot, tg: v.slot, x: v.x, y: v.y + 6, dmg, kb, ht: M.t || 'normal', k: 'tw' + a.slot + '_' + S.frame });
  };
  G.pummelTick = (S, f, af, inp, M) => {
    const v = S.fighters[f.grabbing];
    if (!v || v.grabbedBy !== f.slot) { f.grabbing = -1; G.setAction(f, 'idle'); return 'stop'; }
    if (af === M.pummel) {
      const d = (M.pdmg || 1.3) * S.dmgMul;
      v.percent = Math.min(999, v.percent + d); v.stat.taken += d; f.stat.dmg += d;
      v.flash = 4;
      S.events.push({ t: 'hit', s: f.slot, tg: v.slot, x: (f.x + v.x) / 2, y: v.y + 8, dmg: d, kb: 5, ht: M.t || 'normal', k: 'pm' + f.slot + '_' + S.frame });
    }
  };
  G.pummelEnd = (S, f) => { G.setAction(f, 'hold'); f.af = 5; };

  // Positionne les victimes de prises / lancers après la mise à jour des combattants
  G.syncGrabs = (S) => {
    for (const v of S.fighters) {
      if (v.grabbedBy < 0 || v.dead) continue;
      const a = S.fighters[v.grabbedBy];
      if (!a || a.grabbing !== v.slot) { v.grabbedBy = -1; if (v.action === 'grabbed' || v.action === 'thrown') G.setAction(v, v.grounded ? 'idle' : 'air'); continue; }
      const sa = G.ST(a), sv = G.ST(v);
      let dx = sa.w * 0.5 + sv.w * 0.5 + 1.5, dy = 0;
      if (a.action === 'move') {
        const M = G.MV(a, a.move);
        if (M && M.hold) {
          const k = M.hold; let i = 0;
          while (i < k.length - 1 && k[i + 1][0] <= a.af) i++;
          const k0 = k[i], k1 = k[Math.min(i + 1, k.length - 1)];
          const t = k1[0] > k0[0] ? U.clamp((a.af - k0[0]) / (k1[0] - k0[0]), 0, 1) : 0;
          dx = U.lerp(k0[1], k1[1], t) * (sa.w * 0.5 + sv.w * 0.5 + 1.5);
          dy = U.lerp(k0[2], k1[2], t) * sa.h;
        }
      }
      v.x = a.x + a.facing * dx; v.y = a.y + dy;
      v.grounded = a.grounded && dy <= 0.01; v.plat = a.plat;
      v.vx = v.vy = v.kbx = v.kby = 0;
      if (v.action !== 'thrown') v.facing = -a.facing;
    }
  };

  // ---------- Projectiles ----------
  G.spawnProj = (S, owner, kind, props) => {
    const p = Object.assign({
      id: S.nextId++, kind, owner: owner.slot, x: owner.x, y: owner.y, vx: 0, vy: 0, r: 3, life: 120, age: 0,
      dmg: 5, ang: 361, bkb: 20, kbg: 50, t: 'normal', pierce: false, grav: 0, refl: true, clank: true, dead: false,
      dir: owner.facing, v: {}, ghost: false,
    }, props);
    p.r = G.projScale(p.r);
    S.projs.push(p);
    return p;
  };
  function inBlock(S, x, y) {
    const m = S.stage.main;
    return x > m.l && x < m.r && y < m.y && y > m.bottom;
  }
  G.inBlock = inBlock;
  G.updateProjs = (S) => {
    for (const p of S.projs) {
      if (p.dead) continue;
      p.age++;
      const K = G.PROJ[p.kind];
      if (K && K.tick) K.tick(S, p);
      if (p.dead) continue;
      p.vy -= p.grav;
      p.x += p.vx; p.y += p.vy;
      if (--p.life <= 0) { p.dead = true; if (K && K.onEnd) K.onEnd(S, p); continue; }
      if (!p.ghost && inBlock(S, p.x, p.y)) {
        if (K && K.onStage) K.onStage(S, p); else { p.dead = true; S.events.push({ t: 'poof', x: p.x, y: p.y, pk: p.kind, k: 'pf' + p.id }); }
      }
      const bl = S.stage.blast;
      if (p.x < bl.l || p.x > bl.r || p.y < bl.b || p.y > bl.t) p.dead = true;
    }
    // Projectiles qui s'annulent entre eux
    const P = S.projs;
    for (let i = 0; i < P.length; i++) {
      const a = P[i]; if (a.dead || a.clank === false) continue;
      for (let j = i + 1; j < P.length; j++) {
        const b = P[j]; if (b.dead || b.clank === false || b.owner === a.owner) continue;
        if (U.len(a.x - b.x, a.y - b.y) < a.r + b.r) {
          if (a.dmg <= b.dmg + 3) a.dead = true;
          if (b.dmg <= a.dmg + 3) b.dead = true;
          S.events.push({ t: 'clank', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, k: 'pc' + a.id + '_' + b.id });
        }
      }
    }
    S.projs = P.filter(p => !p.dead);
  };
})(window.G);
