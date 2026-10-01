'use strict';
// MALVALAME — samouraï spectral rancunier : une armure habitée par les flammes de rancune d'anciens épéistes.
// Signature : LA RANCUNE.
//  - Lien du Destin (bas B) : un fouet de chaîne enflammée. S'il touche, l'adversaire est lié 5 s : il encaisse
//    la moitié des dégâts que Malvalame subit, et si Malvalame est éjecté pendant le lien, le lien explose sur lui.
//  - Feux Follets (B) : 3 flammes tournent autour de lui (elles brûlent au contact et arrêtent les petits
//    projectiles) ; B à nouveau = il les tire une par une, à tête chercheuse.
//  - Ombre Portée (côté B) : il se fond dans son ombre (intangible), glisse tant que B est maintenu (demi-tour
//    possible), puis surgit en taille montante. En l'air : glissade fixe, une fois par saut.
//  - Lame Amère (haut B) : un geyser de feu spectral le propulse et reste brûler là où il a décollé ; soigne.
//  - Armurouillée (passif) : chaque coup qui le fait tournoyer lui donne +1 niveau de vitesse (comme la Nitrocharge).
(function (G) {
  const U = G.U, D = G.D, H = G.H, A = G.A;
  const B = (o) => Object.assign({ t: 'blade' }, o || {});
  const GF = (o) => Object.assign({ t: 'ghost' }, o || {}); // feu spectral
  const RAD = Math.PI / 180;
  const PALS = [
    { name: 'Normal', arm: '#2c2542', arm2: '#4b3f73', blade: '#b45cff', edge: '#ffd1ff', flame: '#6a5cff', eye: '#ffe066', cape: '#3a2a6a' },
    { name: 'Chromatique', arm: '#3a2230', arm2: '#6a3a50', blade: '#ff5a8a', edge: '#ffe0ea', flame: '#ff7a5a', eye: '#7af0ff', cape: '#5a2a3a' },
    { name: 'Spectre bleu', arm: '#1c2a42', arm2: '#35507a', blade: '#4ac8ff', edge: '#e0fbff', flame: '#4a8aff', eye: '#ffe066', cape: '#1f3a5a' },
    { name: 'Braise', arm: '#2a1e1a', arm2: '#5a3a2a', blade: '#ff8a2a', edge: '#fff0c0', flame: '#ff4a2a', eye: '#b7ff5a', cape: '#4a2a1a' },
  ];
  const PAL = (f) => PALS[(f.pal || 0) % PALS.length];
  const heal = (a, n) => { a.percent = Math.max(0, a.percent - n); a.flash = Math.max(a.flash || 0, 4); };

  function addNitro(S, f) {
    const lvl = Math.min(3, (f.v.nitro || 0) + 1);
    f.v.nitro = lvl; f.v.form = 'n' + lvl; f.v.nitroT = 600;
    G.sfx(S, f, 'fire', { nitro: lvl });
  }

  // ---------- Feux Follets ----------
  const WISP_R = 12, WISP_CD = 150, WISP_LIFE = 540;
  const myWisps = (S, f) => S.projs.filter((p) => p.kind === 'wisp' && p.owner === f.slot && !p.dead && p.v.orb);
  G.PROJ.wisp = {
    tick(S, p) {
      const o = S.fighters[p.owner];
      if (p.v.orb) { // en orbite autour de Malvalame
        if (!o || o.dead || o.out || o.char !== 'malvalame') { p.dead = true; return; }
        const a = p.v.a0 + p.age * 4;
        p.x = o.x + U.dcos(a) * WISP_R; p.y = o.y + G.ST(o).h * 0.5 + U.dsin(a) * WISP_R * 0.75;
        p.vx = 0; p.vy = 0;
        return;
      }
      // tirée : tête chercheuse douce pendant 45 frames
      if (p.age - p.v.t0 > 45) return;
      let best = null, bd = 1e9;
      for (const t of S.fighters) {
        if (t.slot === p.owner || t.dead || t.out) continue;
        if (S.teams && o && t.team === o.team) continue;
        const d = U.len(t.x - p.x, t.y + 9 - p.y);
        if (d < bd) { bd = d; best = t; }
      }
      if (!best || bd < 1) return;
      const dx = best.x - p.x, dy = best.y + G.ST(best).h * 0.5 - p.y, d = U.len(dx, dy);
      p.vx += dx / d * 0.16; p.vy += dy / d * 0.16;
      const sp = U.len(p.vx, p.vy);
      if (sp > 2.7) { p.vx *= 2.7 / sp; p.vy *= 2.7 / sp; }
    },
    draw(ctx, p, t) {
      const v = p.v, r = p.r * 1.15, w = Math.sin(t * 24 + p.id * 1.7);
      ctx.save();
      if (!v.orb) ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2); // la queue de flamme part vers l'arrière
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
      g.addColorStop(0, U.rgb(U.hex(v.c3), 0.6)); g.addColorStop(0.4, U.rgb(U.hex(v.c1), 0.35)); g.addColorStop(1, U.rgb(U.hex(v.c1), 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = v.c2;
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(-r * 0.9, r * 1.4, w * r * 0.4, r * (v.orb ? 2.6 : 3.4)); ctx.quadraticCurveTo(r * 0.9, r * 1.4, r, 0); ctx.arc(0, 0, r, 0, Math.PI, true); ctx.fill();
      ctx.fillStyle = v.c1; ctx.beginPath(); ctx.arc(0, r * 0.15, r * 0.7, 0, 7); ctx.fill();
      ctx.fillStyle = v.c3; ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.35, 0, 7); ctx.fill();
      ctx.restore();
    },
  };
  function launchWisp(S, f) {
    const w = myWisps(S, f);
    if (!w.length) return;
    let p = w[0]; // la flamme la plus en avant part en premier
    for (const q of w) if ((q.x - f.x) * f.facing > (p.x - f.x) * f.facing) p = q;
    Object.assign(p, { vx: f.facing * 2.5, vy: 0.4, life: 95, refl: true, away: false, dmg: 4, ang: 45, bkb: 32, kbg: 48, dir: f.facing });
    p.v.orb = 0; p.v.t0 = p.age;
    G.sfx(S, f, 'fire');
  }
  function wispTick(S, f, af) {
    if (af === 1) f.mv.mode = myWisps(S, f).length ? 1 : 0;
    if (!f.grounded && af < 20) f.vy = Math.max(f.vy, -0.6);
    if (f.mv.mode) { // tir
      if (af === 5 || af === 9 || af === 13) launchWisp(S, f);
      if (af >= 22) { G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; }
      return;
    }
    if (af === 10) { // invocation
      const pl = PAL(f);
      for (let i = 0; i < 3; i++) {
        G.spawnProj(S, f, 'wisp', {
          x: f.x, y: f.y + 9, r: 2.4, life: WISP_LIFE, dmg: 3, ang: 70, bkb: 28, kbg: 25, t: 'fire', burn: 90,
          refl: false, ghost: true, away: true, v: { orb: 1, a0: i * 120, t0: 0, c1: pl.blade, c2: pl.flame, c3: pl.edge },
        });
      }
      f.v.wispCd = WISP_CD;
      G.sfx(S, f, 'magic');
    }
  }

  // ---------- Feu spectral au sol (geyser de la Lame Amère, braises du Fauchage) ----------
  G.PROJ.gfire = {
    tick(S, p) { p.harmless = p.age < p.v.delay; },
    draw(ctx, p, t) {
      const v = p.v;
      if (!v.draw) return;
      const k = U.clamp(p.life / v.life0, 0, 1), on = p.age >= v.delay;
      const hh = v.h * (on ? 0.35 + 0.65 * Math.min(1, k * 3) : 0.3);
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * v.w * 0.22, h = hh * (0.6 + 0.4 * Math.sin(t * 18 + i * 1.9 + p.id)) * (i === 2 ? 1 : 0.72);
        ctx.fillStyle = U.rgb(U.hex(i % 2 ? v.c2 : v.c1), 0.75 * k + 0.1);
        ctx.beginPath(); ctx.moveTo(x - v.w * 0.17, v.y0);
        ctx.quadraticCurveTo(x - v.w * 0.13, v.y0 + h * 0.6, x + Math.sin(t * 9 + i) * 0.8, v.y0 + h);
        ctx.quadraticCurveTo(x + v.w * 0.13, v.y0 + h * 0.6, x + v.w * 0.17, v.y0);
        ctx.closePath(); ctx.fill();
      }
    },
  };
  function gfire(S, f, x, y, o) {
    const pl = PAL(f), life = o.life || 45;
    return G.spawnProj(S, f, 'gfire', {
      x, y, vx: 0, vy: 0, r: o.r || 6, life, dmg: o.dmg || 2, ang: 80, bkb: 30, kbg: 16, t: 'ghost', burn: 60,
      rehit: o.rehit || 12, pierce: true, ghost: true, refl: false, clank: false, away: true, harmless: true,
      v: { delay: o.delay || 3, life0: life, w: o.w || 10, h: o.h || 12, y0: o.y0 || -5, draw: o.draw === 0 ? 0 : 1, src: o.src || '', c1: pl.blade, c2: pl.flame },
    });
  }
  // Lame Amère : le geyser propulse Malvalame et reste brûler à l'endroit du décollage (piège pour qui le poursuit)
  function bitterTick(S, f, af, inp) {
    if (af === 6) {
      f.grounded = false; f.plat = null; G.sfx(S, f, 'fire');
      // (il ne s'allume qu'après l'éjection du coup de départ : il punit ceux qui poursuivent, pas un double coup)
      gfire(S, f, f.x, f.y + 5, { r: 7, life: 46, delay: 14, rehit: 14, w: 12, h: 30, y0: -6 });
      gfire(S, f, f.x, f.y + 17, { r: 7, life: 46, delay: 14, rehit: 14, draw: 0 });
    }
    if (af >= 6 && af <= 24) { f.vy = 3.1 - (af - 6) * 0.04; f.vx = U.approach(f.vx, inp.sx * 1.0, 0.1); }
  }
  // Fauchage : laisse une braise spectrale au sol (une seule à la fois)
  function sweepTick(S, f, af) {
    if (af !== 7 || !f.grounded) return;
    for (const p of S.projs) if (p.kind === 'gfire' && p.owner === f.slot && p.v.src === 'dt') p.dead = true;
    gfire(S, f, f.x + f.facing * 19, f.y + 3, { r: 5, life: 50, delay: 5, rehit: 14, dmg: 1.5, w: 8, h: 8, y0: -3, src: 'dt' });
  }

  // ---------- Ombre Portée ----------
  const SNEAK_MIN = 10, SNEAK_MAX = 28, SNEAK_V = 2.8;
  function sneakTick(S, f, af, inp) {
    if (af === 1) {
      if (!f.grounded) { if (f.v.sneakAir) { G.setAction(f, 'air'); return 'stop'; } f.v.sneakAir = 1; f.mv.air = 1; }
      G.sfx(S, f, 'ghost');
    }
    if (f.mv.air) { // en l'air : glissade d'ombre de longueur fixe, presque à l'horizontale
      if (af < 6) { f.vx *= 0.8; f.vy = Math.max(f.vy, 0); return; }
      if (af <= 16) { f.vx = f.facing * SNEAK_V; f.vy = -0.2; f.intang = Math.max(f.intang, 2); return; }
      G.startMove(S, f, 'sspecOut'); return 'stop';
    }
    if (af < 6) { f.vx = U.approach(f.vx, 0, 0.25); return; }
    f.intang = Math.max(f.intang, 2);
    const tr = af - 6;
    if (f.mv.turnT > 0) f.mv.turnT--;
    else if (inp.sx * f.facing < -0.6 && tr > 2) { f.facing = -f.facing; f.mv.turnT = 10; } // demi-tour dans l'ombre
    f.vx = f.facing * SNEAK_V;
    if (!f.grounded || (tr >= SNEAK_MIN && !inp.held(G.BTN.SPC)) || tr >= SNEAK_MAX) { G.startMove(S, f, 'sspecOut'); return 'stop'; }
  }
  function emergeTick(S, f, af) {
    if (af === 1) { f.vx = f.facing * 0.8; G.sfx(S, f, 'slash'); if (!f.grounded) f.vy = Math.max(f.vy, 1.2); }
    if (f.grounded) f.vx = U.approach(f.vx, 0, 0.12);
  }

  // ---------- Lien du Destin ----------
  const BOND_T = 300, BOND_CD = 720, BOND_SHARE = 0.5;
  function bond(S, a, t) {
    if ((a.v.bondCd || 0) > 0) return;
    for (const o of S.fighters) if (o.v.bondBy === a.slot) { o.v.bondBy = -1; o.v.bondT = 0; }
    t.v.bondBy = a.slot; t.v.bondT = BOND_T; a.v.bondCd = BOND_CD;
    G.sfx(S, a, 'ghost', { bond: 1, bx: t.x, by: t.y });
  }
  const bondedTo = (S, f) => S.fighters.filter((o) => o !== f && !o.dead && !o.out && o.v.bondBy === f.slot && o.v.bondT > 0);

  // Écho spectral : certaines coupes laissent une lame fantôme qui re-frappe au même endroit ~1/4 s plus tard
  const echo = (af0, o) => (S, f, af) => { if (af === af0) G.spawnEcho(S, f, Object.assign({ t: 'ghost', col: PAL(f).blade, sfx: 'slash' }, o)); };
  const nairEcho = echo(8, { x: 0, y: 9, r: 10, delay: 14, dur: 4, dmg: 4, ang: 361, bkb: 42, kbg: 62, style: 'ring' });
  const fairEcho = echo(9, { x: 12, y: 9, r: 7.5, delay: 16, dur: 4, dmg: 5, ang: 50, bkb: 45, kbg: 72, style: 'x' });
  // Fendoir : si la lame rate, la flamme au bout de la lame explose un peu plus loin
  function cleaveTick(S, f, af) {
    if (af === 17 && !f.mv.hit) G.spawnEcho(S, f, { x: 25, y: 4, r: 7, delay: 2, dur: 4, dmg: 9, ang: 40, bkb: 45, kbg: 85, t: 'fire', style: 'orb', col: PAL(f).flame, sfx: 'fire', extra: { burn: 60 } });
  }
  // Estoc Amer (bas + A en l'air) : il se fige, puis plonge lame en bas ; s'il touche, il se soigne et rebondit
  function stabTick(S, f, af) {
    if (af < 6) { f.vy = Math.max(f.vy, 0.3); f.vx *= 0.9; }
    if (af === 6) { f.vy = -3.3; f.ff = true; G.sfx(S, f, 'slash'); }
  }
  function lungeTick(S, f, af) { if (af === 4 && f.grounded) f.vx = f.facing * 1.7; }

  const SUMMON_ANIM = [[0, {}], [6, { aF: 40, aB: 40, eF: 90, eB: 90, lean: -6, glow: 1 }], [10, { aF: 150, aB: -150, eF: 0, eB: 0, glow: 1, eye: 1 }], [24, { aF: 140, aB: -140, glow: 1 }], [34, {}]];
  const LAUNCH_ANIM = [[0, {}], [4, { aF: 40, eF: 80, lean: -8, glow: 1 }], [5, { aF: 95, eF: 0, lean: 12, glow: 1, eye: 1 }], [9, { aF: 100, aB: 60 }], [13, { aF: 95, lean: 10, eye: 1 }], [22, {}]];

  G.registerChar({
    id: 'malvalame', name: 'Malvalame', short: 'Malvalame', dex: 937, color: '#8a5cff', trail: '#d6a8ff',
    desc: 'Samouraï spectral rancunier. Lien du Destin (bas B) : l\'adversaire lié encaisse la moitié de tes dégâts, et prend une explosion si tu meurs. Feux Follets (B), Ombre Portée (côté B, tenir B).',
    stats: {
      weight: 98, h: 19, w: 8.5, walk: 1.2, dash: 2.05, dashF: 11, run: 1.95, runAcc: 0.12, traction: 0.11,
      air: 1.08, airAcc: 0.075, grav: 0.095, fall: 1.65, ffall: 2.64, fullHop: 33, shortHop: 15.5, dJump: 31,
    },
    formStats: {
      n1: { walk: 1.3, dash: 2.2, run: 2.12, air: 1.16 },
      n2: { walk: 1.4, dash: 2.35, run: 2.3, air: 1.24, airAcc: 0.085 },
      n3: { walk: 1.5, dash: 2.5, run: 2.5, air: 1.32, airAcc: 0.095 },
    },
    palettes: PALS,
    init(f) { f.v.nitro = 0; f.v.nitroT = 0; f.v.sneakAir = 0; f.v.wispCd = 0; f.v.bondCd = 0; },
    passive(S, f) {
      if (f.v.nitroT > 0 && --f.v.nitroT === 0) { f.v.nitro = 0; f.v.form = null; }
      if (f.grounded || f.action === 'ledge') f.v.sneakAir = 0;
      if (f.v.wispCd > 0) f.v.wispCd--;
      if (f.v.bondCd > 0) f.v.bondCd--;
      for (const o of S.fighters) {
        if (o === f || o.v.bondBy !== f.slot) continue;
        if (o.dead || o.out || --o.v.bondT <= 0) { o.v.bondBy = -1; o.v.bondT = 0; }
      }
    },
    // Armurouillée : un coup qui le fait tournoyer = +1 niveau de vitesse
    onHurt(S, f) { if (f.hitstun >= 32) addNitro(S, f); },
    // Lien du Destin : l'adversaire lié encaisse la moitié des dégâts que subit Malvalame
    dmgTaken(S, f, hb, dmg) {
      for (const o of bondedTo(S, f)) {
        const d = dmg * BOND_SHARE;
        o.percent = Math.min(999, o.percent + d); o.flash = Math.max(o.flash || 0, 6);
        o.stat.taken += d; f.stat.dmg += d;
        S.events.push({ t: 'hit', s: f.slot, tg: o.slot, x: o.x, y: o.y + 9, dmg: d, kb: 5, ht: 'ghost', k: 'bd' + o.slot + '_' + S.frame });
      }
      return dmg;
    },
    onKO(S, f) {
      f.v.nitro = 0; f.v.nitroT = 0; f.v.form = null;
      // ... et s'il est éjecté pendant le lien, le lien explose sur l'adversaire
      for (const o of S.fighters) {
        if (o === f || o.v.bondBy !== f.slot) continue;
        const live = o.v.bondT > 0 && !o.dead && !o.out && !(o.invinc > 0);
        o.v.bondBy = -1; o.v.bondT = 0;
        if (!live) continue;
        G.applyHit(S, { att: f, tgt: o, hb: { dmg: 14, ang: 85, bkb: 55, kbg: 72, t: 'ghost', unblockable: true }, proj: 1, key: 'dest' + f.slot, x: o.x, y: o.y + 9, dir: o.x >= f.x ? 1 : -1, wx: o.x, wy: o.y + 9 });
        S.events.push({ t: 'sfx', name: 'counter', s: f.slot, x: o.x, y: o.y, dest: 1, k: 'dest' + f.slot + '_' + S.frame });
      }
    },
    pose(P, f) {
      if (f.action !== 'move') return;
      if (f.move === 'sspec' && f.af >= 4) { P.alpha = f.grounded ? 0.07 : 0.28; P.dark = 0.5; }
      else if (f.move === 'sspecOut' && f.af < 3) P.alpha = 0.55;
    },
    moves: {
      // Taille / Revers / Estoc : deux coupes puis une fente qui allonge la lame
      jab: { len: 16, iasa: 14, next: ['jab2', 4, 14], hits: [H(3, 4, 10, 9, 4.2, 2.5, 361, 20, 22, B())], anim: [[0, {}], [2, { aF: 150, eF: 10, lean: -4 }], [3, { aF: 60, eF: 0, lean: 10 }], [8, { aF: 65, lean: 8 }], [16, {}]] },
      jab2: { len: 17, next: ['jab3', 5, 15], hits: [H(3, 4, 10, 11, 4.2, 2.5, 361, 22, 22, B())], anim: [[0, { aF: 60 }], [2, { aB: 20, lean: -2 }], [3, { aB: 125, aF: 40, lean: 12 }], [9, { aB: 115 }], [17, {}]] },
      jab3: { len: 32, tick: lungeTick, hits: G.LINE(5, 7, 6, 10, 23, 10, 4, 3.6, 5, 361, 52, 100, B()), anim: [[0, {}], [4, { aF: 60, eF: 100, lean: -10 }], [5, { aF: 92, eF: 0, lean: 20, reach: 8, eye: 1, glow: 1 }], [12, { aF: 90, lean: 16, reach: 8 }], [20, { aF: 80, reach: 0 }], [32, {}]] },
      // Taille Lourde : grande coupe à deux mains, lames allongées
      ftilt: { len: 32, hitCancel: 20, hits: G.ARC(8, 10, 0, 9, 13, 65, -25, 3, 5.5, 10, 38, 42, 92, B()), anim: [[0, {}], [6, { aF: 160, aB: 150, lean: -10, reach: 3 }], [8, { aF: 110, aB: 100, lean: 8, reach: 5, glow: 1 }], [10, { aF: 50, aB: 45, lean: 16, reach: 5, eye: 1 }], [18, { aF: 55, reach: 2 }], [32, {}]] },
      // Croissant de Lune : la lame trace un croissant de devant jusque derrière lui
      utilt: { len: 30, hitCancel: 16, hits: G.ARC(5, 11, 0, 9, 14, -5, 195, 6, 5, 8, 92, 45, 84, B()), anim: [[0, {}], [4, { aF: 70, crouch: 0.3, lean: 6 }], [5, { aF: 90, reach: 4, glow: 1 }], [8, { aF: 180, reach: 4, lean: -4 }], [11, { aF: 265, reach: 4, lean: -10, eye: 1 }], [18, { aF: 255, reach: 0 }], [30, {}]] },
      // Fauchage : balayage au ras du sol qui laisse une braise spectrale
      dtilt: { len: 22, hurtH: 0.6, hitCancel: 12, tick: sweepTick, hits: G.LINE(6, 7, 5, 2, 19, 1.5, 3, 3.5, 5, 25, 38, 40, B()), anim: [[0, { crouch: 1 }], [5, { crouch: 1, aF: 20, lean: 6 }], [6, { crouch: 1, aF: 80, reach: 4, lean: 14, glow: 1 }], [12, { crouch: 1, aF: 85, reach: 4 }], [22, { crouch: 1 }]] },
      // Nitrocharge : chaque touche = +1 niveau de vitesse
      dashAtk: { len: 38, keepVel: 1, tick: G.dashAtkTick, hits: [H(6, 16, 7, 9, 6.5, 10, 60, 55, 70, { t: 'fire', onHit: (S, a) => addNitro(S, a) })], anim: [[0, { lean: 15 }], [6, { lean: 32, aF: 60, aB: 40, glow: 1, eye: 1 }], [16, { lean: 28, glow: 1 }], [38, {}]] },
      // Fendoir Spectral : coupe verticale ; si elle rate, la flamme au bout de la lame explose plus loin
      fsmash: { len: 54, charge: 10, tick: cleaveTick, hits: G.ARC(14, 16, 0, 9, 14, 100, -15, 4, 6.5, 16, 361, 38, 100, B()), anim: [[0, {}], [10, { aF: 200, aB: 200, eF: 20, lean: -12, sq: 0.95, eye: 1, reach: 4 }], [14, { aF: 120, aB: 120, eF: 0, lean: 18, sq: 1.05, eye: 1, reach: 6, glow: 1 }], [16, { aF: 40, aB: 40, lean: 24, reach: 6, glow: 1 }], [24, { aF: 45, aB: 45, lean: 20, reach: 3 }], [54, {}]] },
      // Bûcher : il plante ses lames, une colonne de feu spectral jaillit autour de lui
      usmash: { len: 50, charge: 8, hits: G.LINE(11, 15, 0, 5, 0, 36, 5, 6.2, 15, 88, 38, 100, GF({ away: 1, burn: 60, noTrail: 1 })), anim: [[0, {}], [8, { aF: 175, aB: 165, lean: -6, eye: 1 }], [11, { aF: 5, aB: -5, crouch: 0.7, glow: 1, eye: 1, reach: 2 }], [22, { aF: 5, aB: -5, crouch: 0.6, glow: 1, reach: 2 }], [50, {}]] },
      // Cercle de Braises : flammes qui jaillissent du sol des deux côtés en même temps
      dsmash: { len: 50, charge: 5, hits: G.LINE(12, 14, -21, 2, 21, 2, 7, 4.2, 14, 30, 34, 96, GF({ away: 1, burn: 60, noTrail: 1 })), anim: [[0, {}], [5, { crouch: 0.9, aF: 150, aB: -150, eye: 1 }], [12, { crouch: 0.9, aF: 60, aB: -60, reach: 5, glow: 1 }], [22, { crouch: 0.9, aF: 60, aB: -60, reach: 5 }], [50, {}]] },
      // Halo Spectral : il écarte les lames, un anneau de feu jaillit, puis l'écho en anneau re-frappe
      nair: { aerial: 1, len: 36, landLag: 7, ac: [4, 26], tick: nairEcho, hits: [H(5, 8, 0, 9, 11, 9, 361, 30, 88, GF()), H(9, 14, 0, 9, 10, 5, 361, 20, 75, GF())], anim: [[0, {}], [4, { aF: 40, aB: 40, tuck: 0.4, sq: 0.9 }], [5, { aF: 125, aB: -125, lF: 60, lB: -60, glow: 1, eye: 1, reach: 2 }], [14, { aF: 120, aB: -120, glow: 1, reach: 2 }], [36, {}]] },
      // Taille Croisée : coupe en X devant + écho en X qui re-frappe
      fair: { aerial: 1, len: 38, landLag: 9, ac: [3, 28], tick: fairEcho, hits: [H(7, 9, 12, 13, 5.5, 5, 50, 32, 60, B()), H(7, 9, 12, 5, 5.5, 5, 50, 32, 60, B()), H(7, 9, 11, 9, 5, 6, 45, 34, 80, B())], anim: [[0, {}], [5, { aF: 175, aB: 20, lean: -6 }], [7, { aF: 30, aB: 165, lean: 14, eye: 1, glow: 1 }], [14, { aF: 40, aB: 150, lean: 10 }], [38, {}]] },
      // Revers Ardent : estoc vers l'arrière, la pointe est la plus forte
      bair: { aerial: 1, len: 36, landLag: 10, ac: [4, 27], hits: [H(8, 10, -21, 9, 4.5, 15, 361, 34, 104, B()), ...G.LINE(8, 10, -6, 9, -15, 9, 2, 4.2, 10, 361, 30, 88, B())], anim: [[0, {}], [6, { aB: -40, eB: 100, lean: -4 }], [8, { aB: -92, eB: 0, lean: 12, reach: 7, eye: 1, glow: 1 }], [16, { aB: -90, reach: 7 }], [24, { aB: -80, reach: 0 }], [36, {}]] },
      // Couronne Spectrale : couronne de flammes qui tourne au-dessus de sa tête puis éclate
      uair: { aerial: 1, len: 34, landLag: 8, ac: [3, 26], hits: [H(5, 12, 0, 21, 8, 2, 90, 0, 0, GF({ rehit: 4, link: 1, hs: 8, noTrail: 1 })), H(14, 16, 0, 22, 9, 6, 88, 46, 96, GF({ g: 1, noTrail: 1 }))], anim: [[0, {}], [4, { aF: 150, aB: 210, eF: 60, eB: 60, glow: 1 }], [12, { aF: 160, aB: 200, eF: 70, eB: 70, glow: 1 }], [14, { aF: 180, aB: 180, eF: 0, eB: 0, eye: 1, glow: 1 }], [34, {}]] },
      // Estoc Amer : plongeon lame en bas, soigne 3 % et rebondit s'il touche
      dair: { aerial: 1, len: 46, landLag: 13, ac: [4, 38], tick: stabTick, hits: [H(6, 30, 0, -2, 6, 10, 75, 45, 55, B({ onHit: (S, a) => { a.vy = 2.6; a.ff = false; heal(a, 3); } }))], anim: [[0, {}], [5, { aF: 170, aB: 170, tuck: 0.4 }], [6, { aF: 0, aB: 0, sq: 1.1, glow: 1, eye: 1 }], [30, { aF: 0, aB: 0, glow: 1 }], [46, {}]] },
      // Feux Follets : 1er B = 3 flammes en orbite ; B suivant = tir à tête chercheuse
      nspec: { len: 34, tick: wispTick, land: 'keep', cond: (S, f) => !(f.v.wispCd > 0) || myWisps(S, f).length > 0, anim: (f) => (f.mv && f.mv.mode ? LAUNCH_ANIM : SUMMON_ANIM) },
      // Ombre Portée : fondu dans l'ombre, glisse tant que B est tenu, puis surgit
      sspec: { len: 60, tick: sneakTick, keepVel: 1, land: 'keep', drift: 0, noGrav: (af) => af >= 6 && af <= 16, anim: [[0, {}], [4, { crouch: 1, aF: 40, aB: -40, glow: 1 }], [60, { crouch: 1, aF: 40, aB: -40, glow: 1 }]] },
      sspecOut: { len: 34, iasa: 26, intang: [1, 3], tick: emergeTick, keepVel: 1, land: 'keep', offEdge: 1, drift: 0.4, ledge: 10,
        hits: G.ARC(3, 7, 0, 7, 11, -35, 95, 4, 6.5, 11, 80, 52, 78, B({ t: 'ghost' })),
        anim: [[0, { crouch: 0.8, aF: 10, aB: -30, glow: 1 }], [3, { aF: 60, aB: -30, lean: 10, glow: 1, reach: 3 }], [7, { aF: 185, aB: 40, lean: -8, eye: 1, glow: 1, reach: 3 }], [16, { aF: 175, reach: 1 }], [34, {}]] },
      // Lame Amère : geyser qui propulse + soigne ; une lame pointée vers le ciel, l'autre vers le geyser
      uspec: { len: 48, helpless: 1, landLag: 18, ledge: 14, tick: bitterTick, drift: 0, noGrav: (af) => af >= 6 && af <= 24,
        hits: [H(6, 8, 0, 5, 10, 9, 88, 62, 70, GF({ burn: 90, onHit: (S, a) => heal(a, 3) })), H(10, 22, 1, 21, 6.5, 5, 80, 55, 62, B({ t: 'ghost', g: 1, onHit: (S, a) => heal(a, 2) }))],
        anim: [[0, { crouch: 0.6, aF: 40, aB: 30 }], [5, { crouch: 0.9, aF: 10, aB: -10, glow: 1 }], [6, { aF: 180, eF: 0, aB: -5, sq: 1.1, glow: 1, eye: 1, reach: 4 }], [24, { aF: 178, aB: 0, glow: 1, reach: 4 }], [30, { aF: 130, aB: 40 }], [48, {}]] },
      // Lien du Destin : fouet de chaîne enflammée
      dspec: { len: 40, tick: (S, f, af) => { if (af === 7) G.sfx(S, f, 'ghost'); if (!f.grounded && af < 14) f.vy = Math.max(f.vy, -0.6); },
        hits: G.LINE(8, 11, 7, 9, 30, 9, 5, 3.2, 4, 75, 35, 25, GF({ onHit: (S, a, t) => bond(S, a, t) })),
        anim: [[0, {}], [6, { aF: -50, aB: 120, lean: -10, glow: 1 }], [8, { aF: 95, eF: 0, aB: 40, lean: 14, eye: 1, glow: 1 }], [14, { aF: 92, lean: 10 }], [40, {}]] },
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
        const bx = L.ex, by = L.ey, len = 8.2 + (P.reach || 0);
        // lame spectrale (s'allonge sur les estocs et les grandes coupes)
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
      const pl = G.palOf(f), st = G.ST(f), fc = f.facing, af = f.af, mv = f.action === 'move' ? f.move : '';
      const col = U.hex(pl.blade), fcol = U.hex(pl.flame);
      if (f.v.nitro > 0 && (f.action === 'run' || f.action === 'dash' || !f.grounded) && S.frame % 3 === 0 && G.R.newFrame) {
        G.R.parts.push({ ty: 'flame', x: f.x - fc * 3, y: f.y + Math.random() * st.h * 0.7, vx: -fc * 0.4, vy: 0.3, life: 14, max: 14, size: 1 + f.v.nitro * 0.4, col: 'rgba(140,100,255,0.7)' });
      }
      // Lien du Destin : chaîne de flammes vers l'adversaire lié + marque de rancune au-dessus de lui
      for (const o of bondedTo(S, f)) {
        const ost = G.ST(o), x0 = f.x, y0 = f.y + st.h * 0.55, x1 = o.x, y1 = o.y + ost.h * 0.55;
        const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        const blink = o.v.bondT < 90 ? (Math.sin(t * 30) > 0 ? 1 : 0.35) : 1;
        ctx.strokeStyle = U.rgb(fcol, 0.6 * blink); ctx.lineWidth = 0.7; ctx.setLineDash([1.6, 1.1]);
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) { const k = i / 24, ww = Math.sin(k * 14 + t * 10) * 1.2 * Math.sin(k * Math.PI); const px = x0 + dx * k + nx * ww, py = y0 + dy * k + ny * ww; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke(); ctx.setLineDash([]);
        const mx = o.x, my = o.y + ost.h + 4 + Math.sin(t * 6) * 0.5;
        ctx.fillStyle = U.rgb(col, 0.85 * blink);
        ctx.beginPath(); ctx.moveTo(mx - 2, my); ctx.quadraticCurveTo(mx - 1.6, my + 2.4, mx + Math.sin(t * 20) * 0.4, my + 4.4); ctx.quadraticCurveTo(mx + 1.6, my + 2.4, mx + 2, my); ctx.arc(mx, my, 2, 0, Math.PI, true); ctx.fill();
        ctx.fillStyle = pl.eye; ctx.fillRect(mx - 1, my - 0.4, 0.6, 0.5); ctx.fillRect(mx + 0.4, my - 0.4, 0.6, 0.5);
      }
      // Ombre Portée : flaque d'ombre avec ses yeux (au sol), brume spectrale (en l'air)
      if (mv === 'sspec' && af >= 3) {
        const k = Math.min(1, (af - 3) / 4);
        if (f.grounded) {
          ctx.fillStyle = `rgba(16,8,30,${0.75 * k})`; ctx.beginPath(); ctx.ellipse(f.x, f.y + 0.4, 8 * k + 0.1, 1.8 * k + 0.1, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = U.rgb(fcol, 0.7 * k); ctx.lineWidth = 0.4; ctx.stroke();
          for (let i = 0; i < 3; i++) { const x = f.x + (i - 1) * 4 * k, h = (2 + Math.sin(t * 16 + i * 2)) * k; ctx.fillStyle = U.rgb(col, 0.6); ctx.beginPath(); ctx.ellipse(x, f.y + 0.6 + h * 0.5, 0.7, h * 0.6 + 0.1, 0, 0, 7); ctx.fill(); }
          ctx.fillStyle = pl.eye; ctx.fillRect(f.x + fc * 2.2 - 0.35, f.y + 0.9, 0.7, 0.35); ctx.fillRect(f.x + fc * 3.6 - 0.35, f.y + 0.9, 0.7, 0.35);
        } else {
          const cy = f.y + st.h * 0.5, g = ctx.createRadialGradient(f.x, cy, 0, f.x, cy, 9);
          g.addColorStop(0, 'rgba(16,8,30,0.8)'); g.addColorStop(0.7, U.rgb(fcol, 0.35)); g.addColorStop(1, U.rgb(fcol, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x - fc * 2, cy, 10, 6, 0, 0, 7); ctx.fill();
          ctx.fillStyle = pl.eye; ctx.fillRect(f.x + fc * 1.5 - 0.35, cy + 1, 0.7, 0.35); ctx.fillRect(f.x + fc * 2.9 - 0.35, cy + 1, 0.7, 0.35);
        }
      }
      // Lame Amère : jet de feu spectral sous lui pendant la montée
      if (mv === 'uspec' && af >= 6 && af <= 26) {
        const k = af <= 22 ? 1 : 1 - (af - 22) / 4;
        for (let i = 0; i < 5; i++) {
          const x = f.x + Math.sin(t * 25 + i * 1.7) * 1.3, y = f.y - i * 2.6 + 1, r = (3.2 - i * 0.5) * k;
          ctx.fillStyle = U.rgb(i % 2 ? fcol : col, (0.8 - i * 0.12) * k); ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.2, r * 0.7), Math.max(0.2, r * 1.2), 0, 0, 7); ctx.fill();
        }
      }
      // Croissant de Lune : traînée en croissant
      if (mv === 'utilt' && af >= 5 && af <= 16) {
        const k = U.clamp((af - 5) / 6, 0, 1), fade = af <= 11 ? 1 : 1 - (af - 11) / 5;
        ctx.save(); ctx.translate(f.x, f.y + 9); ctx.scale(fc, 1); ctx.lineCap = 'round';
        ctx.strokeStyle = U.rgb(col, 0.7 * fade); ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(0, 0, 14, -5 * RAD, (-5 + 200 * k) * RAD); ctx.stroke();
        ctx.strokeStyle = U.rgb(U.hex(pl.edge), 0.9 * fade); ctx.lineWidth = 0.6; ctx.stroke();
        ctx.restore();
      }
      // Bûcher : colonne de feu spectral (3 couches : contour, flamme, cœur clair) avec des langues de feu au sommet
      if (mv === 'usmash' && af >= 11 && af <= 24) {
        const k = af <= 15 ? 1 : 1 - (af - 15) / 9;
        const layer = (wd, hgt, c, a, ph) => {
          ctx.fillStyle = U.rgb(c, a * k); ctx.beginPath(); ctx.moveTo(f.x - wd, f.y);
          for (let i = 0; i <= 8; i++) { const q = i / 8; ctx.lineTo(f.x - wd * (1 - q * 0.55) - Math.sin(t * 20 + i * 1.3 + ph) * 0.9, f.y + q * hgt); }
          for (let j = 0; j < 3; j++) { const x = f.x + (j - 1) * wd * 0.45; ctx.lineTo(x - wd * 0.12, f.y + hgt); ctx.lineTo(x + Math.sin(t * 15 + j * 2 + ph) * 0.8, f.y + hgt + (5 + 3 * Math.sin(t * 19 + j * 1.7 + ph)) * k); ctx.lineTo(x + wd * 0.12, f.y + hgt); }
          for (let i = 8; i >= 0; i--) { const q = i / 8; ctx.lineTo(f.x + wd * (1 - q * 0.55) + Math.sin(t * 23 + i * 1.1 + ph) * 0.9, f.y + q * hgt); }
          ctx.closePath(); ctx.fill();
        };
        layer(7, 34, fcol, 0.55, 0); layer(5, 31, col, 0.7, 1.3); layer(2.4, 26, U.hex(pl.edge), 0.8, 2.1);
      }
      // Cercle de Braises : flammes au sol des deux côtés
      if (mv === 'dsmash' && af >= 12 && af <= 22) {
        const k = af <= 15 ? 1 : 1 - (af - 15) / 7;
        for (let i = -6; i <= 6; i++) {
          if (!i) continue;
          const x = f.x + i * 3.4, h = (5 + Math.sin(t * 22 + i) * 1.6) * k * (1 - Math.abs(i) / 9);
          ctx.fillStyle = U.rgb(i % 2 ? fcol : col, 0.75 * k); ctx.beginPath(); ctx.ellipse(x, f.y + h * 0.5, 1.4, h * 0.6 + 0.3, 0, 0, 7); ctx.fill();
        }
      }
      // Couronne Spectrale : couronne de flammes qui tourne au-dessus de la tête
      if (mv === 'uair' && af >= 5 && af <= 17) {
        const k = af <= 14 ? 1 : 1 - (af - 14) / 3, cx = f.x, cy = f.y + 21;
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2 + t * 9, x = cx + Math.cos(a) * 7, y = cy + Math.sin(a) * 2.6;
          ctx.fillStyle = U.rgb(i % 2 ? fcol : col, 0.8 * k); ctx.beginPath(); ctx.ellipse(x, y + 1.2, 1.1, 2.2, 0, 0, 7); ctx.fill();
        }
        if (af >= 14) { ctx.strokeStyle = U.rgb(col, k); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, 9 * (1.3 - k * 0.3), 0, 7); ctx.stroke(); }
      }
      // Lien du Destin : la chaîne-fouet (grisée pendant la recharge : elle frappe mais ne lie pas)
      if (mv === 'dspec' && af >= 7 && af <= 16) {
        const k = af <= 11 ? 1 : 1 - (af - 11) / 5, ready = !(f.v.bondCd > 0) || f.mv.hit;
        const x0 = f.x + fc * 7, y0 = f.y + 9, L = 30 * Math.min(1, (af - 6) / 3);
        ctx.strokeStyle = ready ? U.rgb(fcol, 0.95 * k) : `rgba(150,150,160,${0.7 * k})`; ctx.lineWidth = 0.9; ctx.setLineDash([1.4, 0.9]);
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) { const q = i / 16, x = x0 + fc * L * q, y = y0 + Math.sin(q * 12 + t * 25) * 1.2 * q; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = ready ? U.rgb(col, 0.95 * k) : `rgba(180,180,190,${0.7 * k})`; ctx.beginPath(); ctx.arc(x0 + fc * L, y0, 1.6, 0, 7); ctx.fill();
      }
    },
    fx(e, R) {
      if (e.nitro) R.parts.push({ ty: 'ring', x: e.x, y: e.y + 9, life: 16, max: 16, size: 8 + e.nitro * 3, col: '#9a7aff' });
      if (e.bond) R.parts.push({ ty: 'ring', x: e.bx, y: e.by + 9, life: 24, max: 24, size: 13, col: '#b45cff' });
      if (e.dest) {
        R.cam.shake = Math.max(R.cam.shake, 7);
        R.parts.push({ ty: 'ring', x: e.x, y: e.y + 9, life: 30, max: 30, size: 22, col: '#d6a8ff' });
        R.parts.push({ ty: 'custom', x: e.x, y: e.y + 28, life: 80, max: 80, draw: (ctx, p, k) => {
          ctx.save(); ctx.translate(p.x, p.y + (1 - k) * 6); ctx.scale(0.3, -0.3); ctx.globalAlpha = Math.min(1, k * 3);
          ctx.font = '900 13px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#1a0830';
          ctx.strokeText('LIEN DU DESTIN !', 0, 0); ctx.fillStyle = '#d6a8ff'; ctx.fillText('LIEN DU DESTIN !', 0, 0);
          ctx.restore(); ctx.globalAlpha = 1;
        } });
      }
    },
    hud(ctx, f, S, x, y, pw, ph, u) {
      const parts = [];
      if (f.v.nitro > 0) parts.push('VITESSE ' + '»'.repeat(f.v.nitro));
      if (bondedTo(S, f).length) parts.push('LIÉ !');
      else if (f.v.bondCd > 0) parts.push('LIEN ' + Math.ceil(f.v.bondCd / 60) + 's');
      if (f.v.wispCd > 0 && !myWisps(S, f).length) parts.push('FOLLETS ' + Math.ceil(f.v.wispCd / 60) + 's');
      if (!parts.length) return;
      ctx.fillStyle = '#b38aff'; ctx.font = `900 ${9 * u}px Rubik, sans-serif`; ctx.textAlign = 'left';
      ctx.fillText(parts.join('  '), x + ph + 2 * u, y + 43 * u);
    },
  });
})(window.G);
