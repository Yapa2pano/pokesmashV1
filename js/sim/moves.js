'use strict';
// Coups génériques (utilisés si un personnage ne redéfinit pas un coup) et helpers de définition.
(function (G) {
  const A = G.A;
  // H(début, fin, x, y, rayon, dégâts, angle, BKB, KBG, options)
  const H = G.H = (f0, f1, x, y, r, dmg, ang, bkb, kbg, o) => Object.assign({ f: [f0, f1], x, y, r, dmg, ang, bkb, kbg }, o || {});
  G.GH = (f0, f1, x, y, r, o) => Object.assign({ f: [f0, f1], x, y, r, grab: true, dmg: 0 }, o || {});

  // Hitbox en ARC de cercle qui balaie l'espace (n cercles, activés l'un après l'autre entre f0 et f1).
  // Angles en degrés dans le repère du perso : 0 = devant, 90 = au-dessus, 180 = derrière.
  G.ARC = (f0, f1, cx, cy, R, a0, a1, n, r, dmg, ang, bkb, kbg, o) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (n === 1 ? 0.5 : i / (n - 1));
      const s = f0 + Math.floor(i * (f1 - f0 + 1) / n), e = Math.max(s, f0 + Math.floor((i + 1) * (f1 - f0 + 1) / n));
      out.push(H(s, Math.min(f1, e), +(cx + R * Math.cos(a * Math.PI / 180)).toFixed(2), +(cy + R * Math.sin(a * Math.PI / 180)).toFixed(2), r, dmg, ang, bkb, kbg, o));
    }
    return out;
  };
  // Hitbox en LIGNE (lame, colonne...) : tous les cercles actifs en même temps
  G.LINE = (f0, f1, x0, y0, x1, y1, n, r, dmg, ang, bkb, kbg, o) => {
    const out = [];
    for (let i = 0; i < n; i++) { const k = n === 1 ? 0 : i / (n - 1); out.push(H(f0, f1, +(x0 + (x1 - x0) * k).toFixed(2), +(y0 + (y1 - y0) * k).toFixed(2), r, dmg, ang, bkb, kbg, o)); }
    return out;
  };

  // Événement sonore/visuel (clé unique pour ne pas le rejouer lors d'un rollback)
  G.sfx = (S, f, name, extra) => S.events.push(Object.assign({ t: 'sfx', name, s: f.slot, x: f.x, y: f.y, k: 'x' + f.slot + name + S.frame }, extra || {}));

  // ---------- B qui se chargent : règle commune à tous les persos (demande du 2026-10-02) ----------
  // B UNE fois = la charge démarre et monte toute seule (pas besoin de garder B). B à nouveau = il lâche le coup
  // (B B = coup immédiat). Pendant la charge : stick arrière = il se retourne ; saut = il GARDE la charge et saute vraiment ;
  // bouclier = il la garde et passe en bouclier (+ côté = roulade, + bas = esquive sur place ; en l'air = esquive aérienne).
  // Charge pleine = elle est gardée et il reprend la main. À appeler à chaque frame de la boucle de charge, sur f.mv.c.
  // o : { max, rate (par frame), store(S, f, c) (garder la charge), onFull(S, f) }.
  // Renvoie 'go' (lâcher le coup), 'hold' (on continue de charger) ou 'stop' (il a quitté le coup).
  G.chargeLoop = (S, f, inp, o) => {
    const bf = f.buf, st = G.ST(f);
    if (inp.sx * f.facing <= -0.5) f.facing = -f.facing;
    if (bf.b) { bf.b = 0; return 'go'; }
    if (bf.j) {
      o.store(S, f, f.mv.c);
      if (f.grounded) { bf.j = 0; G.setAction(f, 'jsq'); }
      else { G.setAction(f, 'air'); if (f.jumps < st.jumps) { bf.j = 0; G.doubleJump(S, f, inp, st); } }
      return 'stop';
    }
    if (bf.s) {
      o.store(S, f, f.mv.c); bf.s = 0;
      if (!f.grounded) { G.setAction(f, 'air'); if (!f.airdodged) G.startAirdodge(S, f, inp); }
      else if (Math.abs(inp.sx) >= 0.6) { G.setAction(f, 'roll'); f.mv = { d: inp.sx > 0 ? 1 : -1 }; }
      else if (inp.sy <= -0.6) G.setAction(f, 'spot');
      else G.setAction(f, 'shield');
      return 'stop';
    }
    f.mv.c = Math.min(o.max, (f.mv.c || 0) + o.rate);
    if (f.mv.c >= o.max) {
      o.store(S, f, o.max);
      if (o.onFull) o.onFull(S, f);
      G.setAction(f, f.grounded ? 'idle' : 'air');
      return 'stop';
    }
    return 'hold';
  };

  function dashAtkTick(S, f, af) {
    if (f.grounded) f.vx = G.U.approach(f.vx, 0, G.ST(f).traction * 0.55);
  }
  G.dashAtkTick = dashAtkTick;

  G.genericMoves = (st) => {
    const w = st.w, h = st.h;
    return {
      jab: { len: 18, iasa: 16, next: ['jab2', 5, 16], hits: [H(3, 4, w * 0.9, h * 0.55, 3.8, 2.5, 361, 20, 25)], anim: A.jab(3, 4, 18) },
      jab2: { len: 20, next: ['jab3', 6, 18], hits: [H(3, 4, w, h * 0.55, 3.8, 2, 361, 20, 25)], anim: A.jab2(3, 4, 20) },
      jab3: { len: 30, hits: [H(5, 7, w * 1.1, h * 0.5, 4.8, 4, 45, 45, 90)], anim: A.punch(5, 7, 30) },
      ftilt: { len: 28, hits: [H(7, 9, w * 1.2, h * 0.45, 4.6, 9, 361, 30, 90)], anim: A.kickF(7, 9, 28) },
      utilt: { len: 28, hits: [H(6, 10, w * 0.4, h * 1.1, 5, 7, 95, 35, 110)], anim: A.upSwing(6, 10, 28) },
      dtilt: { len: 22, hurtH: 0.62, hits: [H(5, 7, w * 1.1, 1.5, 4, 6, 80, 40, 60)], anim: A.sweep(5, 7, 22) },
      dashAtk: { len: 38, keepVel: 1, tick: dashAtkTick, hits: [H(7, 12, w * 0.9, h * 0.45, 5, 10, 60, 50, 80)], anim: A.dashAtk(7, 12, 38) },
      fsmash: { len: 50, charge: 9, hits: [H(14, 16, w * 1.3, h * 0.5, 6, 16, 361, 35, 100)], anim: A.smashF(9, 14, 16, 50) },
      usmash: { len: 46, charge: 7, hits: [H(12, 15, 0, h * 1.1, 7, 15, 88, 35, 105)], anim: A.smashU(7, 12, 15, 46) },
      dsmash: { len: 48, charge: 5, hits: [H(10, 11, w * 1.1, 2, 5, 13, 32, 30, 100), H(10, 11, -w * 1.1, 2, 5, 13, 148, 30, 100)], anim: A.smashD(5, 10, 11, 48) },
      nair: { aerial: 1, len: 40, landLag: 8, ac: [4, 30], hits: [H(6, 24, 0, h * 0.5, 6.5, 8, 361, 25, 90)], anim: A.nair(6, 24, 40) },
      fair: { aerial: 1, len: 40, landLag: 12, ac: [3, 32], hits: [H(10, 13, w, h * 0.5, 5.5, 11, 361, 30, 95)], anim: A.fair(10, 13, 40) },
      bair: { aerial: 1, len: 36, landLag: 10, ac: [4, 28], hits: [H(8, 11, -w * 1.1, h * 0.45, 5.5, 12, 361, 30, 100)], anim: A.bair(8, 11, 36) },
      uair: { aerial: 1, len: 34, landLag: 9, ac: [3, 26], hits: [H(6, 10, 0, h * 1.1, 6, 9, 80, 30, 110)], anim: A.uair(6, 10, 34) },
      dair: { aerial: 1, len: 44, landLag: 16, ac: [4, 36], hits: [H(12, 15, 0, -1, 6, 13, 270, 20, 90)], anim: A.dair(12, 15, 44) },
      nspec: { len: 40, hits: [H(10, 14, w * 1.2, h * 0.5, 6, 10, 361, 40, 80)], anim: A.cast(10, 14, 40) },
      sspec: { len: 40, hits: [H(10, 14, w * 1.2, h * 0.5, 6, 10, 361, 40, 80)], anim: A.punch(10, 14, 40) },
      uspec: { len: 40, helpless: 1, ledge: 8, landLag: 20, tick: (S, f, af) => { if (af === 6) { f.vy = 3.3; f.grounded = false; f.plat = null; } }, grav: 0.8, hits: [H(6, 14, 0, h * 0.7, 6, 7, 85, 50, 70)], anim: A.rise(6, 40) },
      dspec: { len: 40, hits: [H(10, 14, 0, 2, 8, 10, 60, 40, 80)], anim: A.smashD(4, 10, 14, 40) },
      grab: { len: 32, hits: [G.GH(7, 8, w * 0.95, h * 0.5, 5 * st.grabRange)], anim: A.grab(7, 8, 32) },
      dashgrab: { len: 40, keepVel: 1, traction: 1.6, hits: [G.GH(10, 11, w * 1.15, h * 0.5, 5.6 * st.grabRange)], anim: A.grab(10, 11, 40) },
      pummel: { len: 15, pummel: 4, phys: 'none', tick: G.pummelTick, end: G.pummelEnd, anim: A.pummel },
      fthrow: { throw: 1, phys: 'none', len: 30, rel: 11, dmg: 7, ang: 45, bkb: 65, kbg: 55, hold: [[0, 1, 0], [10, 1.4, 0.2]], anim: A.throwF },
      bthrow: { throw: 1, phys: 'none', back: 1, len: 36, rel: 16, dmg: 9, ang: 45, bkb: 60, kbg: 70, hold: [[0, 1, 0], [8, 0, 0.8], [16, -1.4, 0.3]], anim: A.throwB },
      uthrow: { throw: 1, phys: 'none', len: 36, rel: 14, dmg: 7, ang: 90, bkb: 70, kbg: 60, hold: [[0, 1, 0], [12, 0.2, 1.3]], anim: A.throwU },
      dthrow: { throw: 1, phys: 'none', len: 38, rel: 18, dmg: 6, ang: 70, bkb: 70, kbg: 45, hold: [[0, 1, 0], [14, 0.8, -0.1]], anim: A.throwD },
      getupAtk: { len: 44, intang: [1, 20], hits: [H(18, 20, w * 1.1, 3, 5.5, 7, 361, 50, 30), H(24, 26, -w * 1.1, 3, 5.5, 7, 361, 50, 30, { g: 1, rev: true })], anim: A.getupAtk },
      taunt: { len: 60, anim: A.taunt },
    };
  };

  // Réglage global du rythme (jeu nerveux) : appliqué à tous les persos à l'enregistrement.
  // gravité/chute plus fortes (hauteurs de saut identiques, moins de temps en l'air), moins de lag après les coups,
  // atterrissage des aériens plus court, et tout coup normal qui touche peut s'annuler (combos).
  G.FEEL = { twoJumps: 67, grav: 1.35, fall: 1.22, ffallK: 1.8, airAcc: 1.35, air: 1.05, traction: 1.15, endlag: 0.4, smashEndlag: 0.6, landLag: 0.5, djump: 0.88, recovery: 0.9, sideSmashKbg: 0.86, sideSmashBkb: 0.9 };
  const NORMALS = { jab: 1, jab2: 1, jab3: 1, ftilt: 1, utilt: 1, dtilt: 1, dashAtk: 1, fsmash: 1, usmash: 1, dsmash: 1, nair: 1, fair: 1, bair: 1, uair: 1, dair: 1, grab: 1, dashgrab: 1 };
  // Hitbox plus généreuses : +100 % pour les toutes petites, +50 % vers un rayon de 5, +12 % pour les grosses
  G.hbScale = (r) => r * Math.min(2, Math.max(1.12, 1 + (8 - r) / 6));
  G.projScale = (r) => r * Math.min(1.6, Math.max(1, 1 + (6 - r) / 6));
  G.tuneFeel = (def) => {
    const F = G.FEEL;
    const tuneStats = (s) => {
      s.grav *= F.grav; s.fall *= F.fall; s.ffall = Math.max(s.ffall * F.fall, s.fall * F.ffallK);
      s.airAcc *= F.airAcc; s.air *= F.air; s.traction *= F.traction; s.landLag = Math.min(s.landLag, 2);
      s.dJump *= F.djump; // double saut un peu moins haut (plus d'edge guard)
      // tout le monde atteint la plateforme du haut du stage à 3 plateformes (y = 55) en grand saut + double saut,
      // avec de la marge : le manque va surtout sur le grand saut (60 %) pour peu toucher aux récupérations
      const need = F.twoJumps - (s.fullHop + s.dJump);
      if (need > 0) { s.fullHop += need * 0.6; s.dJump += need * 0.4; }
    };
    tuneStats(def._stats);
    if (def._forms) for (const k in def._forms) tuneStats(def._forms[k]);
    for (const k in def.moves) {
      const M = def.moves[k];
      if (!M || M._tuned) continue;
      M._tuned = 1;
      if (M.hits) for (const h of M.hits) {
        if (h._scaled) continue;
        h._scaled = 1;
        h.r = h.grab ? h.r * 1.3 : G.hbScale(h.r);
      }
      const base = k.includes(':') ? k.split(':')[1] : k;
      if (!NORMALS[base] || !M.hits || !M.hits.length) continue;
      const le = Math.max(...M.hits.map((h) => h.f[1]));
      const smash = base.endsWith('smash');
      // smashs qui envoient sur le côté : un peu moins forts
      if (base === 'fsmash' || base === 'dsmash') for (const h of M.hits) { if (!h._sideNerf) { h._sideNerf = 1; h.kbg = Math.round(h.kbg * F.sideSmashKbg); h.bkb = Math.round(h.bkb * F.sideSmashBkb); } }
      if (!M.iasa) M.iasa = Math.min(M.len, le + Math.ceil((M.len - le) * (smash ? F.smashEndlag : F.endlag)));
      if (M.aerial) {
        M.landLag = Math.max(4, Math.round(M.landLag * F.landLag));
        if (M.ac) M.ac = [M.ac[0], Math.min(M.ac[1], le + 3)];
      }
      if (!M.hitCancel && !smash && base !== 'grab' && base !== 'dashgrab') M.hitCancel = le + 1;
    }
  };

  // ---------- Briques réutilisables pour les coups « signature » ----------
  const U = G.U;
  // Écho : hitbox fixe dans l'espace qui frappe après un délai (lame spectrale, prescience, pilier de feu...).
  // Pendant le délai elle est visible mais inoffensive (on voit venir le piège).
  G.PROJ.echo = {
    tick(S, p) {
      const v = p.v;
      p.harmless = !(p.age >= v.delay && p.age < v.delay + v.dur);
      if (p.age === v.delay && v.sfx) S.events.push({ t: 'sfx', name: v.sfx, s: p.owner, x: p.x, y: p.y, k: 'ec' + p.id });
    },
    draw(ctx, p, t) {
      const v = p.v, on = p.age >= v.delay;
      const k = on ? U.clamp(1 - (p.age - v.delay) / Math.max(1, v.dur), 0, 1) : U.clamp(p.age / Math.max(1, v.delay), 0, 1);
      const col = U.hex(v.col), r = p.r;
      ctx.scale(v.face || 1, 1); ctx.lineCap = 'round';
      if (v.style === 'slash' || v.style === 'x') {
        const a = on ? 0.35 + 0.6 * k : 0.12 + 0.3 * k, w = on ? 0.5 + 1.6 * k : 0.45;
        ctx.strokeStyle = U.rgb(col, a); ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(-r, r * 0.9); ctx.quadraticCurveTo(r * 0.3, r * 0.2, r, -r * 0.9); ctx.stroke();
        if (v.style === 'x') { ctx.beginPath(); ctx.moveTo(-r, -r * 0.9); ctx.quadraticCurveTo(r * 0.3, -r * 0.2, r, r * 0.9); ctx.stroke(); }
        if (!on) { ctx.setLineDash([1, 1.2]); ctx.strokeStyle = U.rgb(col, 0.35); ctx.lineWidth = 0.25; ctx.beginPath(); ctx.arc(0, 0, r * (1.3 - k * 0.3), 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      } else if (v.style === 'ring') {
        ctx.strokeStyle = U.rgb(col, on ? 0.9 * k : 0.15 + 0.3 * k); ctx.lineWidth = on ? 1.4 * k + 0.3 : 0.4;
        ctx.beginPath(); ctx.arc(0, 0, r * (on ? 1.15 - k * 0.15 : 0.6 + k * 0.4), 0, 7); ctx.stroke();
      } else if (v.style === 'orb') {
        const rr = on ? r * (0.9 + (1 - k) * 0.6) : 1.2 + k * 1.6 + 0.3 * Math.sin(t * 18);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
        g.addColorStop(0, `rgba(255,255,255,${on ? k : 0.8})`); g.addColorStop(0.5, U.rgb(col, on ? 0.7 * k : 0.7)); g.addColorStop(1, U.rgb(col, 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.fill();
      } else if (v.style === 'fire' || v.style === 'water') {
        const fire = v.style === 'fire';
        for (let i = 0; i < 5; i++) {
          const x = (i - 2) * r * 0.35, h = r * (1.2 + 0.5 * Math.sin(t * 20 + i * 1.7)) * (on ? 0.4 + k * 0.6 : 0.3);
          ctx.fillStyle = fire ? (i % 2 ? `rgba(255,200,60,${0.8 * (on ? k : 0.5)})` : `rgba(255,90,30,${0.8 * (on ? k : 0.5)})`) : `rgba(90,190,255,${0.75 * (on ? k : 0.5)})`;
          ctx.beginPath(); ctx.ellipse(x, -r * 0.5 + h * 0.5, r * 0.22, h * 0.6, 0, 0, 7); ctx.fill();
        }
      }
    },
  };
  // o : { x, y (relatifs au perso, x dans le sens du regard), r, delay, dur, dmg, ang, bkb, kbg, t, style, col, rehit, sfx, extra }
  G.spawnEcho = (S, f, o) => G.spawnProj(S, f, 'echo', Object.assign({
    x: f.x + (o.x || 0) * f.facing, y: f.y + (o.y || 0), vx: 0, vy: 0, life: o.delay + o.dur + 1,
    ghost: true, pierce: true, refl: false, clank: false, harmless: o.delay > 0, dir: f.facing,
    r: o.r, dmg: o.dmg, ang: o.ang, bkb: o.bkb, kbg: o.kbg, t: o.t || 'normal', rehit: o.rehit || 0,
    v: { delay: o.delay, dur: o.dur, style: o.style || 'slash', col: o.col || '#b27bff', face: f.facing, sfx: o.sfx || '' },
  }, o.extra || {}));

  // Aspiration : attire les adversaires proches vers un point du monde (tourbillon, siphon, trompe...)
  G.pull = (S, f, x, y, R, k) => {
    for (const t of S.fighters) {
      if (t === f || t.dead || t.out || t.invinc > 0 || t.intang > 0 || t.grabbedBy >= 0 || t.action === 'ledge' || t.action === 'respawn') continue;
      if (S.teams && t.team === f.team) continue;
      const dx = x - t.x, dy = y - (t.y + G.ST(t).h * 0.5), d = U.len(dx, dy);
      if (d > R || d < 1.5) continue;
      const s = k * (1 - d / R * 0.5);
      t.x += dx / d * s;
      if (!t.grounded) t.y += dy / d * s;
    }
  };

  // Complète les définitions (lancers, pummel) après enregistrement
  G.finalizeMoves = (def) => {
    for (const k in def.moves) {
      const M = def.moves[k];
      if (M.throw && !M.tick) M.tick = G.throwTick;
      if (M.throw && !M.phys) M.phys = 'none';
    }
  };
})(window.G);
