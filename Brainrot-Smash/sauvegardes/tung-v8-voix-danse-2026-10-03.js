'use strict';
// TUNG TUNG TUNG SAHUR — bûche à batte de baseball, regard fixe. Harceleur rapide.
// Passif LE COMPTE : chaque coup différent qui touche la même cible = « TUNG » (3 max) ; le coup suivant = « SAHUR ! » (+40 % d'éjection).
//   Un coup ne compte qu'une fois par combo (jab 1-2-3 = un seul TUNG), le compte retombe après 1,5 s sans toucher ou s'il est touché.
//   Les coups de tête pendant la prise comptent chacun : 3 coups puis un lancer = lancer SAHUR.
// B = Batte Boomerang (elle part et revient). Sans batte, il frappe aux poings (coups plus courts et plus faibles).
// Haut B = Lancer de Batte : il lance sa batte violemment vers le haut (l'impact tue), puis se propulse pour la rattraper.
// Smash avant = Home Run : swing de batteur, rotatif et horizontal (batte vue en raccourci quand elle passe devant lui).
// Côté B = Coup de Bélier (charge horizontale tête la première, une fois par saut ; haut B possible juste après).
// Bas B = Simple Bûche (il se fige en bûche ; frappé = jumpscare et contre).
// Hitbox de batte : calculées frame par frame à partir de la pose dessinée -> toute la batte touche, du manche au bout.
(function (G) {
  const U = G.U, D = G.D, H = G.H, A = G.A;

  // ---------- Géométrie partagée dessin / hitbox ----------
  const HIP = 6.2, SX = 0.2, SH = 13.0, UA = 3.3, FA = 3.1; // hanche, épaule avant, longueurs du bras
  const BAT_L = 12, BAT_OFF = 15;                           // longueur de la batte, angle batte / avant-bras
  const HT = 26;                                            // taille (stats.h)
  const dirv = (a) => [U.dsin(a), -U.dcos(a)];              // 0 = bas, 90 = devant, 180 = haut (comme D.dir)
  // Swing de batteur (pose « swg ») : phase sw en degrés.
  //   -90..0 : batte dressée derrière la tête qui descend à l'horizontale derrière lui ;
  //   0..180 : balayage horizontal de l'arrière vers l'avant (la batte se raccourcit quand elle pointe vers nous) ;
  //   180..300 : accompagnement, la batte s'enroule par-dessus l'épaule.
  function swingGeom(ph) {
    let hx, hy, dx, dy, k = 1;
    if (ph < 0) { const t = (ph + 90) / 90; hx = -1.2 - 2.1 * t; hy = SH + 5 - 5.5 * t; dx = -0.35 - 0.65 * t; dy = 1 - 0.85 * t; }
    else if (ph <= 180) { hx = 0.3 - 3.6 * U.dcos(ph); hy = SH - 0.5 - 1.0 * U.dsin(ph); dx = -U.dcos(ph); dy = 0.05; k = Math.max(0.25, Math.abs(U.dcos(ph))); }
    else { const t = Math.min(1, (ph - 180) / 120); hx = 3.9 - 3.4 * t; hy = SH - 0.5 + 5 * t; dx = -U.dcos(ph); dy = 0.3 + 0.7 * t; k = 0.9; }
    const n = Math.sqrt(dx * dx + dy * dy) || 1;
    return { hx, hy, bx: dx / n * k, by: dy / n * k, front: ph > 40 && ph < 178 };
  }
  // main et direction de la batte dans le repère du bras (avant inclinaison) ; (bx, by) inclut le raccourci
  function armPts(P) {
    if (P.swg > 0.5) return swingGeom(P.sw || 0);
    const [d1x, d1y] = dirv(P.aF), a2 = P.aF - (P.eF || 0), [d2x, d2y] = dirv(a2);
    const hx = SX + d1x * UA + d2x * FA, hy = SH + d1y * UA + d2y * FA;
    const [bx, by] = dirv(a2 + BAT_OFF + (P.wp || 0));
    return { hx, hy, bx, by, a2, front: true };
  }
  // même transformations que le dessin : inclinaison autour de la hanche, accroupi, rotation du corps
  function toBody(P, x, y) {
    const L = -(P.lean || 0), c = U.dcos(L), s = U.dsin(L), dy = y - HIP;
    let X = x * c - dy * s, Y = HIP + x * s + dy * c;
    const cr = P.crouch || 0; X *= 1 + cr * 0.06; Y *= 1 - cr * 0.28;
    Y += P.bob || 0;
    if (P.rot) { const cy = HT * 0.45, r = -P.rot, c2 = U.dcos(r), s2 = U.dsin(r), ey = Y - cy; const X2 = X * c2 - ey * s2; Y = cy + X * s2 + ey * c2; X = X2; }
    return [X, Y];
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  // Hitbox de la batte entière : 5 cercles du manche au bout, pour chaque frame active, posés sur la pose de l'animation
  function batHits(anim, f0, f1, dmg, ang, bkb, kbg, o) {
    const out = [];
    for (let fr = f0; fr <= f1; fr++) {
      const P = Object.assign({}, D.DEF_POSE); D.applyKF(P, anim, fr);
      const { hx, hy, bx, by } = armPts(P);
      for (let i = 0; i < 5; i++) {
        const k = -0.3 + i * (BAT_L + 0.3) / 4;
        const [x, y] = toBody(P, hx + bx * k, hy + by * k);
        out.push(H(fr, fr, r2(x), r2(y), i === 4 ? 1.5 : 1.3, dmg, ang, bkb, kbg, Object.assign({ bat: 1, bi: i, t: 'normal' }, o || {})));
      }
    }
    return out;
  }

  // ---------- LE COMPTE (TUNG ×3 -> SAHUR) ----------
  const RESET = () => ({ t: -1, n: 0, used: '', time: 0 });
  const CK = (f) => f.v.cpt || (f.v.cpt = RESET());
  const moveKey = (f) => {
    let m = f.move || ''; if (m.indexOf(':') >= 0) m = m.split(':')[1];
    if (/^jab/.test(m)) return 'jab';
    return m;
  };
  const sahurReady = (f, tgt) => { const c = f.v.cpt; return !!(c && c.t === tgt.slot && c.n >= 3); };
  // kbFn de tous les coups qui comptent : +40 % si le compte est plein
  const sahurKb = (S, att, tgt) => { if (att && sahurReady(att, tgt)) { att.v.sahurF = S.frame; return 1.4; } return 1; };
  function doSahur(S, f, tgt) {
    f.v.cpt = RESET();
    S.events.push({ t: 'sfx', name: 'cptSahur', s: f.slot, x: tgt.x, y: tgt.y + 14, sahur: 1, k: 'sh' + f.slot + '_' + tgt.slot + '_' + S.frame });
  }
  function addTung(S, f, tgt, key, force) {
    const c = CK(f);
    if (c.t !== tgt.slot) { c.t = tgt.slot; c.n = 0; c.used = ''; }
    c.time = 90;
    if (!force && c.used.indexOf('|' + key + '|') >= 0) return;
    c.used += '|' + key + '|';
    c.n = Math.min(3, c.n + 1);
    S.events.push({ t: 'sfx', name: 'cptTung', s: f.slot, x: tgt.x, y: tgt.y + 14, tung: c.n, k: 'tg' + f.slot + '_' + tgt.slot + '_' + S.frame });
  }

  // ---------- La voix (sons officiels) ----------
  // Coup faible (éjection < VOICE_KB, typiquement pendant un combo) = « tung » ; coup fort après au moins 2 « tung » = « sahur ».
  // La chaîne retombe après 1,5 s sans toucher, si Tung est touché, ou après le « sahur ». Un SAHUR du Compte dit toujours « sahur ».
  const VOICE_KB = 120, VOICE_GAP = 6;
  const VC = (f) => f.v.voice || (f.v.voice = { t: -1, n: 0, time: 0, last: -99 });
  function voice(S, f, tgt, forceSahur) {
    const v = VC(f);
    if (v.t !== tgt.slot) { v.t = tgt.slot; v.n = 0; }
    const kb = U.len(tgt.kbx, tgt.kby) / G.C.KB_SPEED;
    const say = (name, rate) => S.events.push({ t: 'sfx', name, s: f.slot, x: tgt.x, y: tgt.y + 14, rate, k: 'vo' + name + f.slot + '_' + tgt.slot + '_' + S.frame });
    if (forceSahur || (kb >= VOICE_KB && v.n >= 2)) { say('sahur', 1); v.n = 0; v.time = 0; v.last = S.frame; return; }
    if (kb >= VOICE_KB) { v.n = 0; v.time = 0; return; }
    v.time = 90;
    if (S.frame - v.last < VOICE_GAP) return; // coups multiples très rapprochés : un seul « tung »
    v.n++; v.last = S.frame;
    say('tung', 1 + Math.min(v.n - 1, 4) * 0.035);
  }

  // ---------- Batte Boomerang ----------
  const batProj = (S, f) => { if (!f.v.batOut) return null; for (const p of S.projs) if (p.id === f.v.batOut && !p.dead) return p; return null; };
  function batBack(f) { f.v.batOut = 0; f.v.form = null; }
  G.PROJ.tbat = {
    tick(S, p) {
      const o = S.fighters[p.owner], v = p.v;
      if (!o) { p.dead = true; return; }
      if (!v.ph) { // aller : ralentit puis repart
        p.vx -= p.dir * 0.15;
        if (p.vx * p.dir <= 0.15) {
          v.ph = 1; v.sp = 0.5;
          // retour : petite éjection vers Tung (elle suit la batte) pour enchaîner ; peut retoucher une cible déjà touchée à l'aller
          p.dmg = 4; p.ang = 50; p.bkb = 32; p.kbg = 22;
          const key = 'p' + p.id;
          for (const t of S.fighters) t.hitMem = t.hitMem.filter((m) => m[0] !== key);
        }
      } else { // retour vers le lanceur, de plus en plus vite
        const tx = o.x, ty = o.y + 13, dx = tx - p.x, dy = ty - p.y, d = U.len(dx, dy) || 1;
        v.sp = Math.min(4.6, v.sp + 0.16);
        p.vx = dx / d * v.sp; p.vy = dy / d * v.sp;
        if (d < 5 || o.dead || o.out) {
          p.dead = true;
          if (o.v.batOut === p.id) batBack(o);
          S.events.push({ t: 'sfx', name: 'catch', s: p.owner, x: p.x, y: p.y, k: 'bc' + p.id });
        }
      }
    },
    onEnd(S, p) { const o = S.fighters[p.owner]; if (o && o.v.batOut === p.id) batBack(o); },
    kbFn: (S, att, tgt) => sahurKb(S, att, tgt),
    draw(ctx, p, t) {
      ctx.rotate(-p.age * 0.5 * p.dir);
      const col = p.v.col || '#d9a05a';
      ctx.beginPath(); ctx.moveTo(-6.4, 0.4); ctx.quadraticCurveTo(-1, 0.45, 5.6, 1.05); ctx.arc(5.6, 0, 1.05, Math.PI / 2, -Math.PI / 2, true); ctx.quadraticCurveTo(-1, -0.45, -6.4, -0.4); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW; ctx.stroke();
      D.circ(ctx, -6.6, 0, 0.55, U.shade(col, -0.18));
      ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, 0, 7.2, 0.3, 1.4); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 7.2, 3.44, 4.54); ctx.stroke();
    },
  };
  // Haut B : la batte monte (l'impact tue), reste un instant en l'air, puis redescend dans ses mains (inoffensive)
  const upProj = (S, f) => { if (!f.v.batUp) return null; for (const p of S.projs) if (p.id === f.v.batUp && !p.dead) return p; return null; };
  function catchUp(S, f, p) { p.dead = true; f.v.batUp = 0; S.events.push({ t: 'sfx', name: 'catch', s: f.slot, x: p.x, y: p.y, k: 'bu' + p.id }); }
  G.PROJ.tbatUp = {
    tick(S, p) {
      const o = S.fighters[p.owner], v = p.v;
      if (!o) { p.dead = true; return; }
      if (!v.ph) { p.vy -= 0.24; p.vx *= 0.96; if (p.vy <= 0) { v.ph = 1; v.h = 0; p.vy = 0; p.vx = 0; p.harmless = true; } }
      else if (v.ph === 1) { p.vy = 0; p.vx = 0; if (++v.h >= 6) { v.ph = 2; v.sp = 0.6; } }
      else {
        const dx = o.x - p.x, dy = o.y + 22 - p.y, d = U.len(dx, dy) || 1;
        v.sp = Math.min(3.4, v.sp + 0.15);
        p.vx = dx / d * v.sp; p.vy = dy / d * v.sp;
      }
      if (v.ph && (o.dead || o.out || U.len(o.x - p.x, o.y + 22 - p.y) < 6)) { if (o.v.batUp === p.id) catchUp(S, o, p); else p.dead = true; }
    },
    onEnd(S, p) { const o = S.fighters[p.owner]; if (o && o.v.batUp === p.id) o.v.batUp = 0; },
    kbFn: (S, att, tgt) => sahurKb(S, att, tgt),
    draw(ctx, p, t) { G.PROJ.tbat.draw(ctx, { age: p.age * 1.4, dir: 1, v: p.v }, t); },
  };
  const UPV = 6.8, UPV_NB = 6.25; // propulsion du haut B (avec / sans batte)
  function upThrowTick(S, f, af, inp) {
    if (af < 13 && !f.grounded) f.vy = Math.max(f.vy, -0.3);
    if (af === 7) {
      const p = G.spawnProj(S, f, 'tbatUp', {
        x: f.x + f.facing * 0.8, y: f.y + 20, vx: U.clamp(inp.sx, -1, 1) * 0.5, vy: 5.0, r: 4.6, life: 120,
        dmg: 12, ang: 88, bkb: 53, kbg: 85, pierce: true, ghost: true, refl: false, clank: false, rehit: 0, t: 'normal',
        v: { ph: 0, col: G.palOf ? G.palOf(f).bat : '#d9a05a' },
      });
      f.v.batUp = p.id;
      G.sfx(S, f, 'swingBig');
    }
    if (af === 13) { f.grounded = false; f.plat = null; f.vy = UPV; G.sfx(S, f, 'djump'); }
    if (af > 13) { const p = upProj(S, f); if (p && p.v.ph && U.len(p.x - f.x, p.y - (f.y + 22)) < 8) catchUp(S, f, p); }
  }
  function throwBat(S, f) {
    const p = G.spawnProj(S, f, 'tbat', {
      x: f.x + f.facing * 6, y: f.y + 15, vx: f.facing * 4.6, vy: 0, r: 4.6, life: 240,
      dmg: 8, ang: 40, bkb: 55, kbg: 85, pierce: true, ghost: true, refl: false, clank: false, rehit: 0, t: 'normal',
      v: { ph: 0, col: G.palOf ? G.palOf(f).bat : '#d9a05a' },
    });
    f.v.batOut = p.id; f.v.form = 'nb';
    G.sfx(S, f, 'tp', { throw: 1 });
  }
  // ---------- Animations (aF bras avant, eF coude, wp angle batte ; batte = aF - eF + 15 + wp) ----------
  const AN = {
    jab: [[0, {}], [2, { aF: 50, eF: 50, wp: -10, lean: -2 }], [3, { aF: 92, eF: 0, wp: -17, lean: 6 }], [6, { aF: 90, eF: 0, wp: -15, lean: 5 }], [16, {}]],
    jab2: [[0, { aF: 90, eF: 0, wp: -15 }], [2, { aF: 150, eF: 30, wp: 0 }], [4, { aF: 70, eF: -10, wp: 0, lean: 8 }], [7, { aF: 65, eF: -10 }], [18, {}]],
    jab3: [[0, {}], [4, { aF: -60, eF: 60, wp: 20, lean: -10, eye: 1 }], [7, { aF: 100, eF: 0, wp: -10, lean: 16, eye: 1 }], [11, { aF: 95, eF: 0, lean: 12 }], [30, {}]],
    ftilt: [[0, {}], [4, { aF: 30, eF: 80, wp: -10, lean: -6 }], [7, { aF: 95, eF: 0, wp: -20, lean: 14, eye: 1 }], [11, { aF: 92, eF: 0, wp: -18, lean: 12 }], [26, {}]],
    utilt: [[0, {}], [4, { aF: 60, eF: 0, wp: 0 }], [6, { aF: 110, eF: 0, wp: 0 }], [9, { aF: 200, eF: 0, wp: 0, lean: -6 }], [12, { aF: 262, eF: 0, wp: 0, lean: -12 }], [14, { aF: 268, eF: 0, lean: -12 }], [28, {}]],
    dtilt: [[0, { crouch: 1 }], [3, { crouch: 1, aF: 30, eF: 30, wp: 0 }], [5, { crouch: 1, aF: 60, eF: 0, wp: -10, lean: 10 }], [9, { crouch: 1, aF: 58, eF: 0, wp: -10, lean: 8 }], [22, { crouch: 1 }]],
    // Home Run : appel, garde haute (charge), rotation des hanches, balayage horizontal, accompagnement par-dessus l'épaule
    fsmash: [[0, {}], [6, { swg: 1, sw: -80, lean: -10, crouch: 0.2, lF: 35, kF: 15, lB: -25, kB: 20, eye: 1 }],
      [10, { swg: 1, sw: -88, lean: -14, crouch: 0.25, lF: 42, kF: 20, lB: -25, kB: 25, eye: 1 }],
      [13, { swg: 1, sw: 10, lean: -6, crouch: 0.3, lF: 45, kF: 5, lB: -30, kB: 40, eye: 1 }],
      [15, { swg: 1, sw: 120, lean: 8, crouch: 0.25, lF: 40, kF: 0, lB: -45, kB: 60, eye: 1 }],
      [17, { swg: 1, sw: 195, lean: 12, crouch: 0.15, lF: 35, kF: 0, lB: -50, kB: 70 }],
      [24, { swg: 1, sw: 290, lean: 4, lF: 30, lB: -40, kB: 60 }], [36, { swg: 1, sw: 300, lean: 2, lF: 20, lB: -20, kB: 30 }], [54, {}]],
    usmash: [[0, {}], [7, { crouch: 0.7, aF: 30, eF: 0, wp: -60, eye: 1 }], [12, { crouch: 0, sq: 1.12, bob: 2, aF: 150, eF: 0, wp: -30, eye: 1 }], [16, { sq: 1.1, bob: 1.5, aF: 150 }], [46, {}]],
    dsmash: [[0, {}], [5, { aF: 190, eF: 0, wp: 0, crouch: 0.3, eye: 1 }], [10, { aF: 60, eF: 0, wp: -10, crouch: 0.5, lean: 10 }], [14, { aF: 60, eF: 0, wp: -10, crouch: 0.5, lean: 8 }], [17, { aF: -60, eF: 0, wp: 10, crouch: 0.5, lean: -10 }], [20, { aF: -60, eF: 0, wp: 10, crouch: 0.5, lean: -10 }], [48, {}]],
    dashAtk: [[0, { lean: 10 }], [4, { rot: 90, bob: -7, aF: 0, eF: 0, aB: 0, lF: 0, lB: 0 }], [22, { rot: 810, bob: -7, aF: 0, eF: 0, aB: 0, lF: 0, lB: 0 }], [24, { rot: 900, bob: -7, aF: 0, eF: 0 }], [30, { rot: 1080, bob: 0 }], [40, { rot: 1080 }]],
    nair: [[0, { aF: 90, eF: 0, wp: -15 }], [4, { rot: 0, aF: 90, eF: 0, wp: -15, tuck: 0.4 }], [16, { rot: 360, aF: 90, eF: 0, wp: -15, tuck: 0.4 }], [18, { rot: 360 }], [36, { rot: 360 }]],
    // Smash de tennis : bras levé, batte qui pend dans le dos (armé), elle passe par-dessus la tête et frappe vers l'avant et le bas
    fair: [[0, {}], [3, { aF: 215, eF: -120, wp: -35, aB: 150, eB: 10, lean: -18, lF: 20, kF: 30, lB: -30, kB: 40 }],
      [5, { aF: 205, eF: -60, wp: -10, aB: 155, eB: 10, lean: -14, eye: 1 }],
      [7, { aF: 182, eF: 25, wp: 0, aB: 120, lean: -2, sq: 1.05, eye: 1 }], [9, { aF: 100, eF: 0, wp: -5, aB: 40, lean: 12, lF: -10, kF: 20, lB: 20, kB: 50, eye: 1 }],
      [11, { aF: 40, eF: 0, wp: -10, aB: 10, lean: 16 }], [16, { aF: 35, eF: 0, wp: -10, lean: 12 }], [30, {}]],
    bair: [[0, {}], [4, { lB: -20, kB: 90, lF: -10, kF: 90, lean: 8 }], [6, { lB: -115, kB: 0, lF: -100, kF: 0, lean: 22, eye: 1 }], [10, { lB: -108, lF: -95, lean: 20 }], [30, {}]],
    uair: [[0, {}], [3, { aF: -60, eF: -20, wp: 20 }], [6, { aF: -150, eF: 0, wp: 0 }], [9, { aF: -230, eF: 0, wp: 0 }], [11, { aF: -240, eF: 0 }], [30, {}]],
    dair: [[0, {}], [4, { lF: 40, lB: 40, kF: 90, kB: 90, sq: 0.9, aF: 150, eF: 0 }], [9, { lF: 4, lB: -4, kF: 0, kB: 0, sq: 1.12, eye: 1, aF: 150, eF: 0 }], [14, { lF: 2, lB: -2 }], [40, {}]],
    nspec: [[0, {}], [6, { aF: -40, eF: 40, wp: -30, lean: -8 }], [9, { aF: 100, eF: 0, wp: 0, lean: 10, eye: 1 }], [14, { aF: 95, eF: 0, lean: 8 }], [34, {}]],
    // Coup de Bélier : il se penche, batte rabattue derrière, et charge tête la première
    // Coup de Bélier : tout le corps à l'horizontale, tête devant, jambes tendues derrière, batte plaquée le long du corps
    ram: [[0, {}], [5, { crouch: 0.45, lean: 18, aF: -20, eF: 30, wp: 10, lF: 30, kF: 40, lB: -20, kB: 40 }],
      [8, { rot: 90, aF: 6, eF: 0, wp: -21, aB: -4, eB: 0, lF: 3, kF: 0, lB: -3, kB: 0, eye: 1 }], [24, { rot: 90, aF: 6, eF: 0, wp: -21, aB: -4, eB: 0, lF: 3, kF: 0, lB: -3, kB: 0, eye: 1 }],
      [30, { rot: 35, lean: 10, aF: -10, eF: 20, lF: 20, kF: 20, lB: -15, kB: 20 }], [36, {}]],
    uspec: [[0, { crouch: 0.3, aF: 40, eF: 0, wp: -40 }], [5, { crouch: 0.5, aF: 30, eF: 0, wp: -30, eye: 1 }], [7, { crouch: 0.2, aF: 178, eF: 0, wp: -15, lean: -4, sq: 1.06, eye: 1 }],
      [12, { aF: 178, eF: 0, aB: 170, lean: -2 }], [16, { aF: 175, eF: 0, aB: 175, lF: 10, lB: -10, kF: 30, kB: 30, sq: 1.05 }], [50, { aF: 175, eF: 0, aB: 175 }]],
    uspecNB: [[0, { crouch: 0.5 }], [6, { aF: 175, aB: 175, sq: 1.08 }], [40, { aF: 170, aB: 170 }]],
    dspec: [[0, {}], [4, { log: 1 }], [30, { log: 1 }], [44, {}]],
    scare: [[0, { scare: 1, aF: 200, eF: 10, wp: 0, lean: -10 }], [5, { scare: 1, aF: 200, eF: 10, wp: 0 }], [7, { scare: 1, aF: 90, eF: 0, wp: -10, lean: 16 }], [20, { scare: 1, aF: 85, eF: 0 }], [34, {}]],
    pummel: [[0, { aF: 80, eF: 40, wp: 0 }], [3, { aF: 160, eF: 0, wp: 0 }], [5, { aF: 110, eF: 0, wp: -50 }], [9, { aF: 100, eF: 20 }], [15, { aF: 80, eF: 40 }]],
    // Danse : bras tendus sur les côtés qui ondulent (vague), pieds neutre -> pied avant devant -> neutre -> pied arrière devant, puis pose SAHUR
    taunt: [[0, {}], [6, { aF: 104, eF: 28, wp: -8, aB: -76, eB: -26, lF: 5, lB: -5 }],
      [11, { aF: 76, eF: -26, wp: 8, aB: -104, eB: 28, lF: 30, kF: 4, lB: -10, kB: 10, sq: 0.97, bob: 0.4 }], [16, { aF: 104, eF: 28, wp: -8, aB: -76, eB: -26, lF: 5, lB: -5 }],
      [22, { aF: 76, eF: -26, wp: 8, aB: -104, eB: 28, lF: 5, kF: 6, lB: -5, kB: 6, sq: 0.97, bob: 0.4 }], [27, { aF: 104, eF: 28, wp: -8, aB: -76, eB: -26, lF: 5, lB: -5 }],
      [33, { aF: 76, eF: -26, wp: 8, aB: -104, eB: 28, lF: -10, kF: 10, lB: 30, kB: 4, sq: 0.97, bob: 0.4 }], [38, { aF: 104, eF: 28, wp: -8, aB: -76, eB: -26, lF: 5, lB: -5 }],
      [44, { aF: 150, eF: 0, wp: 0, aB: -150, eB: 0, lF: 14, kF: 0, lB: -14, kB: 0, sq: 1.05, eye: 1 }], [52, { aF: 150, eF: 0, wp: 0, aB: -150, eB: 0, lF: 14, lB: -14, eye: 1 }], [60, {}]],
  };

  // ---------- Ticks ----------
  const FS_STEP = 0.85;
  const homeRun = (S, a, t) => S.events.push({ t: 'sfx', name: 'crack', s: a.slot, x: t.x, y: t.y + 12, homerun: 1, k: 'hr' + a.slot + '_' + t.slot + '_' + S.frame });
  // Coup de Bélier : charge horizontale (une fois par saut), pas d'impuissance après -> haut B possible
  function ramTick(S, f, af) {
    if (af === 1 && !f.grounded) f.v.ramAir = 1;
    if (af < 8) { if (f.grounded) f.vx = U.approach(f.vx, 0, 0.25); else f.vy = Math.max(f.vy, -0.4); }
    else if (af <= 20) { f.vx = f.facing * 3.6; if (!f.grounded) f.vy = 0; } // l'impact ne l'arrête pas : il traverse
    else f.vx = U.approach(f.vx, 0, 0.2); // puis il glisse
    if (af === 8) G.sfx(S, f, 'dash');
  }
  const ramPt = (x, y) => toBody({ rot: 90 }, x, y);
  const ramHit = (S, a, t) => { G.sfx(S, a, 'thunk', { rate: 0.75, x: t.x, y: t.y + 12, shock: 1 }); };
  const ramHits = [[0, 24.5, 4.2], [0, 18.5, 4], [0, 12.5, 3.6]].map(([x, y, r]) => { const [X, Y] = ramPt(x, y); return H(8, 19, r2(X), r2(Y), r, 12, 38, 50, 82, { onHit: ramHit }); });

  function rollTick(S, f, af) {
    if (af >= 4 && af <= 22) f.vx = f.facing * 2.3;
    else if (f.grounded) f.vx = U.approach(f.vx, 0, 0.2);
  }
  function scareCounter(S, me, att, hb) {
    me.v.ctr = hb && hb.dmg ? hb.dmg : 8;
    if (att) me.facing = att.x >= me.x ? 1 : -1;
    G.startMove(S, me, 'dspecHit');
    G.sfx(S, me, 'scare', { x: me.x, y: me.y + 20 });
  }
  // prises : chaque coup de tête = un TUNG ; lancer avec compte plein = SAHUR
  function pummelTick(S, f, af, inp, M) {
    const r = G.pummelTick(S, f, af, inp, M);
    if (af === M.pummel && f.grabbing >= 0) { const v = S.fighters[f.grabbing]; if (v) { addTung(S, f, v, 'pm', true); voice(S, f, v, false); } }
    return r;
  }
  function throwTick(S, f, af, inp, M) {
    if (af !== M.rel) return G.throwTick(S, f, af, inp, M);
    const v = S.fighters[f.grabbing];
    if (!v || v.grabbedBy !== f.slot) { f.grabbing = -1; return; }
    v.action = 'thrown';
    if (sahurReady(f, v)) { G.applyThrow(S, f, v, Object.assign({}, M, { kbg: M.kbg * 1.4, bkb: M.bkb * 1.15 })); doSahur(S, f, v); voice(S, f, v, true); }
    else { G.applyThrow(S, f, v, M); addTung(S, f, v, 'throw'); voice(S, f, v, false); }
  }

  const moves = {
    jab: { len: 16, next: ['jab2', 4, 14], hits: batHits(AN.jab, 3, 5, 2.5, 361, 20, 25), anim: AN.jab },
    jab2: { len: 18, next: ['jab3', 4, 16], hits: batHits(AN.jab2, 4, 5, 2.5, 361, 20, 25), anim: AN.jab2 },
    jab3: { len: 30, hits: batHits(AN.jab3, 7, 9, 5, 40, 50, 90), anim: AN.jab3, tick: (S, f, af) => { if (af === 7) G.sfx(S, f, 'swing'); } },
    ftilt: { len: 26, hits: batHits(AN.ftilt, 7, 9, 9, 361, 30, 88), anim: AN.ftilt },
    utilt: { len: 28, hits: batHits(AN.utilt, 6, 13, 7, 95, 38, 105), anim: AN.utilt },
    dtilt: { len: 22, hurtH: 0.62, hits: batHits(AN.dtilt, 5, 7, 6, 75, 40, 55, { trip: 1 }), anim: AN.dtilt },
    dashAtk: { len: 40, keepVel: 1, tick: rollTick, hits: [...G.LINE(5, 21, -7, 5, 9, 5, 4, 2.6, 1.5, 361, 0, 0, { rehit: 4, link: 1, hs: 8 }), ...G.LINE(23, 25, -6, 5, 10, 5, 4, 3, 6, 50, 62, 70, { g: 1 })], anim: AN.dashAtk },
    // foulée de batteur pendant le swing : il avance de ~4 u (portée)
    fsmash: { len: 54, charge: 10, keepVel: 1, anim: AN.fsmash,
      hits: [...batHits(AN.fsmash, 15, 17, 18, 38, 40, 102, { onHit: homeRun }), H(15, 16, 4.5, 12, 4, 18, 38, 40, 102, { onHit: homeRun, bat: 1, bi: 0 })],
      tick: (S, f, af) => {
        if (af === 14) G.sfx(S, f, 'swingBig');
        if (f.grounded) f.vx = af >= 11 && af <= 15 ? f.facing * FS_STEP : U.approach(f.vx, 0, 0.3);
      } },
    usmash: { len: 46, charge: 7, hits: [H(12, 15, 0.5, 27, 5.5, 15, 88, 36, 104), H(12, 15, 0.5, 22, 5, 13, 88, 36, 100)], anim: AN.usmash },
    dsmash: { len: 48, charge: 5, hits: [...batHits(AN.dsmash, 10, 11, 14, 32, 32, 98), ...batHits(AN.dsmash, 17, 18, 12, 32, 30, 95, { g: 1 })], anim: AN.dsmash,
      tick: (S, f, af) => { if (af === 10 || af === 17) G.sfx(S, f, 'thunk', { rate: af === 10 ? 0.9 : 0.8, x: f.x + f.facing * (af === 10 ? 14 : -14), y: f.y, shock: 1 }); } },
    nair: { aerial: 1, len: 36, landLag: 8, ac: [3, 24], hits: [...batHits(AN.nair, 5, 8, 9, 361, 28, 90), ...batHits(AN.nair, 9, 15, 5, 361, 25, 70)], anim: AN.nair },
    fair: { aerial: 1, len: 30, landLag: 8, ac: [3, 22], hits: [...batHits(AN.fair, 7, 11, 10, 280, 22, 80).filter((h) => h.bi === 4), ...batHits(AN.fair, 7, 11, 8, 361, 30, 88).filter((h) => h.bi !== 4)], anim: AN.fair },
    bair: { aerial: 1, len: 30, landLag: 9, ac: [3, 22], hits: [H(6, 9, -6.5, 9, 4.5, 12, 361, 32, 100), H(6, 9, -3.5, 7.5, 4, 11, 361, 30, 98)], anim: AN.bair },
    uair: { aerial: 1, len: 30, landLag: 8, ac: [3, 22], hits: batHits(AN.uair, 6, 10, 9, 80, 30, 108), anim: AN.uair },
    dair: { aerial: 1, len: 40, landLag: 14, ac: [3, 30], hits: [H(9, 11, 0.5, -0.5, 4.5, 13, 270, 25, 85), H(12, 20, 0.5, 0, 4, 8, 70, 30, 70)], anim: AN.dair },
    // B : Batte Boomerang (une fois par saut)
    nspec: { len: 34, cond: (S, f) => !f.v.batOut && !(f.v.tbAir && !f.grounded), anim: AN.nspec,
      tick: (S, f, af) => { if (af === 1 && !f.grounded) f.v.tbAir = 1; if (af === 9) throwBat(S, f); if (!f.grounded && af < 14) f.vy = Math.max(f.vy, -0.5); } },
    // Côté B : Coup de Bélier
    sspec: { len: 36, keepVel: 1, offEdge: 1, land: 'keep', drift: 0, ledge: 14, noGrav: (af) => af >= 8 && af <= 20, cond: (S, f) => !(f.v.ramAir && !f.grounded), tick: ramTick, hits: ramHits, anim: AN.ram },
    // Haut B : Lancer de Batte (l'impact tue) puis propulsion pour la rattraper
    uspec: { len: 50, helpless: 1, landLag: 18, ledge: 14, drift: 0.8, noGrav: (af) => af >= 13 && af <= 30, tick: upThrowTick, anim: AN.uspec },
    uspecNB: { len: 40, helpless: 1, landLag: 18, ledge: 10, drift: 0.8, noGrav: (af) => af >= 6 && af <= 22, tick: (S, f, af) => { if (af === 6) { f.grounded = false; f.plat = null; f.vy = UPV_NB; G.sfx(S, f, 'djump'); } }, anim: AN.uspecNB },
    // Bas B : Simple Bûche (contre)
    dspec: { len: 44, counter: [5, 30], onCounter: scareCounter, anim: AN.dspec },
    dspecHit: { len: 34, intang: [1, 10], hits: batHits(AN.scare, 6, 9, 10, 361, 45, 92, { dmgFn: (S, att, tgt, d) => Math.max(d, (att.v.ctr || 8) * 1.3) }), anim: AN.scare },
    pummel: { len: 15, pummel: 4, pdmg: 1.6, phys: 'none', tick: pummelTick, end: G.pummelEnd, anim: AN.pummel },
    fthrow: { throw: 1, phys: 'none', len: 30, rel: 11, dmg: 8, ang: 40, bkb: 60, kbg: 72, tick: throwTick, hold: [[0, 1, 0], [10, 1.4, 0.2]], anim: A.throwF },
    bthrow: { throw: 1, phys: 'none', back: 1, len: 36, rel: 16, dmg: 10, ang: 42, bkb: 60, kbg: 78, tick: throwTick, hold: [[0, 1, 0], [8, 0, 0.8], [16, -1.4, 0.3]], anim: A.throwB },
    uthrow: { throw: 1, phys: 'none', len: 36, rel: 14, dmg: 7, ang: 90, bkb: 70, kbg: 60, tick: throwTick, hold: [[0, 1, 0], [12, 0.2, 1.3]], anim: A.throwU },
    dthrow: { throw: 1, phys: 'none', len: 38, rel: 18, dmg: 5, ang: 75, bkb: 65, kbg: 35, tick: throwTick, hold: [[0, 1, 0], [14, 0.8, -0.1]], anim: A.throwD },
    taunt: { len: 60, anim: AN.taunt, tick: (S, f, af) => { if (af === 11 || af === 22 || af === 33) G.sfx(S, f, 'tung', { rate: 1 + (af - 11) / 110 }); if (af === 44) G.sfx(S, f, 'sahur'); } },
  };
  // tous les coups qui comptent reçoivent le bonus SAHUR
  for (const k in moves) {
    const M = moves[k];
    if (!M.hits) continue;
    for (const h of M.hits) if (!h.grab && !h.kbFn) h.kbFn = sahurKb;
  }
  // Sans batte (pendant le boomerang) : mêmes coups, seulement le poing (cercle de la main), plus faibles
  const NOCLONE = { nspec: 1, uspec: 1, uspecNB: 1 };
  for (const k of Object.keys(moves)) {
    const M = moves[k];
    if (NOCLONE[k] || !M.hits || !M.hits.some((h) => h.bat)) continue;
    moves['nb:' + k] = Object.assign({}, M, { hits: M.hits.filter((h) => !h.bat || h.bi === 0).map((h) => (h.bat ? Object.assign({}, h, { dmg: r2(h.dmg * 0.55), kbg: Math.round(h.kbg * 0.8), r: 1.8 }) : h)) });
  }
  moves['nb:uspec'] = moves.uspecNB; // batte partie en boomerang : simple saut, sans lancer

  G.registerChar({
    id: 'tung', name: 'Tung Tung Tung Sahur', short: 'Tung Tung', color: '#c98b4a', trail: '#ffe2b0',
    desc: 'Harceleur à batte. LE COMPTE : 3 coups différents qui touchent = TUNG TUNG TUNG, le suivant = SAHUR ! (+40 % d\'éjection). B = Batte Boomerang. Côté B = Coup de Bélier. Haut B = Lancer de Batte (l\'impact tue) puis il la rattrape. Smash avant = Home Run. Bas B = Simple Bûche (contre).',
    stats: {
      weight: 82, h: HT, w: 6, walk: 1.3, dash: 2.3, run: 2.35, runAcc: 0.13, traction: 0.1,
      air: 1.2, airAcc: 0.08, grav: 0.1, fall: 1.75, ffall: 2.7, fullHop: 34, shortHop: 16, dJump: 32,
    },
    palettes: [
      { name: 'Normal', wood: '#c98546', grain: '#8a5426', limb: '#b8763a', bat: '#d9a05a', iris: '#3b2412' },
      { name: 'Bouleau', wood: '#e6d6bc', grain: '#4a3a30', limb: '#d4c2a4', bat: '#c98b4a', iris: '#2a3a4a' },
      { name: 'Ébène', wood: '#6a432a', grain: '#2a160c', limb: '#5a3822', bat: '#e8d0a0', iris: '#b81e14' },
      { name: 'Cerisier', wood: '#b8573e', grain: '#6e2a1c', limb: '#a44a34', bat: '#f0d090', iris: '#3b2412' },
    ],
    init(f) { f.v.cpt = RESET(); f.v.batOut = 0; f.v.batUp = 0; f.v.form = null; f.v.tbAir = 0; f.v.ramAir = 0; },
    passive(S, f) {
      const c = CK(f);
      if (c.time > 0 && --c.time === 0) f.v.cpt = RESET();
      if (f.grounded || f.action === 'ledge') { f.v.tbAir = 0; f.v.ramAir = 0; }
      if (f.v.batOut && !batProj(S, f)) batBack(f); // batte perdue (zone de KO...) : elle revient d'office
      if (f.v.batUp && !upProj(S, f)) f.v.batUp = 0;
      const vo = VC(f); if (vo.time > 0 && --vo.time === 0) vo.n = 0;
    },
    dmgTaken(S, f, hb, dmg) { f.v.cpt = RESET(); VC(f).n = 0; return dmg; },
    onDealHit(S, att, tgt, h, dmg, isProj) {
      if (att.v.sahurF === S.frame) { doSahur(S, att, tgt); voice(S, att, tgt, true); return; }
      voice(S, att, tgt, false);
      if (h.hb && h.hb.noCompte) return;
      const key = isProj ? (h.proj && h.proj.kind) || 'proj' : moveKey(att);
      if (key) addTung(S, att, tgt, key);
    },
    moves,
    // au repos, la batte pend au bout du bras, le bout posé au sol derrière lui (comme sur le mème)
    pose(P, f) {
      if (f.action === 'idle' || f.action === 'walk' || f.action === 'respawn' || f.action === 'crouch' || f.action === 'land' || f.action === 'jsq') {
        P.aF = 8 + (P.aF - 14) * 0.3; P.eF = 6; P.wp = -78;
      }
    },
    draw(ctx, P, c, f, S, t) {
      const cr = P.crouch || 0, tu = P.tuck || 0, logMode = P.log > 0.5, hasBat = !f.v.batOut && !f.v.batUp, swing = P.swg > 0.5 && !logMode;
      const hip = [0, HIP];
      const W = 2.7, Y0 = 5.6, Y1 = 26; // demi-largeur et hauteurs de la bûche
      ctx.save();
      ctx.scale(1 + cr * 0.06, 1 - cr * 0.28);
      const rot = () => { ctx.translate(hip[0], hip[1]); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-hip[0], -hip[1]); };
      const lF = U.lerp(P.lF, 70, tu), lB = U.lerp(P.lB, 50, tu), kF = U.lerp(P.kF, 110, tu), kB = U.lerp(P.kB, 110, tu);
      const limbB = U.shade(c.limb, -0.22);
      const hand = (x, y, col) => D.circ(ctx, x, y, 0.78, col);
      // batte : manche fin -> bout épais arrondi
      // (dx, dy) = direction de la batte ; une longueur < 1 = batte vue en raccourci (elle pointe vers nous)
      const bat = (hx, hy, vx, vy) => {
        const kl = Math.hypot(vx, vy) || 1, dx = vx / kl, dy = vy / kl, nx = -dy, ny = dx;
        const L = BAT_L * kl, w0 = 0.38, w1 = 1.05 + (1 - kl) * 0.5, bx = hx - dx * 1.2, by = hy - dy * 1.2, tx = hx + dx * L, ty = hy + dy * L;
        D.circ(ctx, bx, by, 0.55, U.shade(c.bat, -0.18));
        ctx.beginPath();
        ctx.moveTo(bx + nx * w0, by + ny * w0);
        ctx.quadraticCurveTo(hx + dx * 4 * kl + nx * w0, hy + dy * 4 * kl + ny * w0, tx + nx * w1, ty + ny * w1);
        ctx.arc(tx, ty, w1, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
        ctx.quadraticCurveTo(hx + dx * 4 * kl - nx * w0, hy + dy * 4 * kl - ny * w0, bx - nx * w0, by - ny * w0);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, bx, by, tx, ty, U.shade(c.bat, -0.12), U.shade(c.bat, 0.08)); ctx.fill();
        ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.22; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx + dx * 4 * kl + nx * 0.2, hy + dy * 4 * kl + ny * 0.2); ctx.lineTo(tx - dx * 0.5 + nx * 0.5, ty - dy * 0.5 + ny * 0.5); ctx.stroke();
      };
      const batA = (hx, hy, a2) => { const [dx, dy] = D.dir(a2 + BAT_OFF + (P.wp || 0)); bat(hx, hy, dx, dy); };
      // bras tendu vers un point (IK à 2 segments, coude vers le bas) : pour le swing à deux mains
      const armTo = (sx, sy, hx, hy, col, w1, w2) => {
        let dx = hx - sx, dy = hy - sy; const d0 = Math.hypot(dx, dy) || 1, d = Math.min(d0, UA + FA - 0.01);
        dx /= d0; dy /= d0;
        const ca = U.clamp((UA * UA + d * d - FA * FA) / (2 * UA * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
        const ex = sx + (dx * ca + dy * sa) * UA, ey = sy + (dy * ca - dx * sa) * UA;
        const hx2 = sx + dx * d, hy2 = sy + dy * d;
        D.seg(ctx, sx, sy, ex, ey, w1, col, w2); D.seg(ctx, ex, ey, hx2, hy2, w2, col);
        return [hx2, hy2];
      };
      const SG = swing ? swingGeom(P.sw || 0) : null;
      // traînée du swing (balayage horizontal autour de lui)
      const swoosh = () => {
        const ph = P.sw || 0; if (ph < 20 || ph > 230) return;
        const a0 = Math.max(0, ph - 80), a1 = Math.min(ph, 200);
        ctx.strokeStyle = 'rgba(255,245,220,0.55)'; ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
          ctx.lineWidth = i ? 0.6 : 1.6; ctx.globalAlpha = i ? 0.9 : 0.35;
          ctx.beginPath();
          for (let a = a0; a <= a1; a += 5) { const r = a * Math.PI / 180, x = 0.3 - 15 * Math.cos(r), y = SH - 0.5 - 2.6 * Math.sin(r); if (a === a0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      };
      const foot = (L, col) => { // pied nu en bois, orteils devant
        D.ell(ctx, L.ex + 0.8, L.ey + 0.36, 1.75, 0.62, 0, col);
        for (let i = 0; i < 3; i++) D.circ(ctx, L.ex + 2.05 - i * 0.18, L.ey + 0.18 + i * 0.12, 0.26 - i * 0.03, U.shade(col, 0.06));
      };

      if (!logMode) {
        // bras arrière (derrière la bûche)
        ctx.save(); rot();
        if (swing) {
          if (!SG.front) { if (hasBat) bat(SG.hx, SG.hy, SG.bx, SG.by); const h2 = armTo(SX, SH, SG.hx, SG.hy, c.limb, 1.05, 0.95); hand(h2[0], h2[1], c.limb); }
          const h1 = armTo(-0.6, SH, SG.hx - 0.5, SG.hy - 0.3, limbB, 1.0, 0.9); hand(h1[0], h1[1], limbB);
        } else {
          const ba = D.limb(ctx, -0.6, SH, P.aB, -(P.eB || 0), UA, FA, 1.0, 0.9, limbB);
          hand(ba.ex, ba.ey, limbB);
        }
        ctx.restore();
        foot(D.limb(ctx, -0.9, hip[1], lB, kB, 3.3, 3.3, 1.05, 0.92, limbB), limbB);
        foot(D.limb(ctx, 0.9, hip[1], lF, kF, 3.3, 3.3, 1.1, 0.95, c.limb), c.limb);
      } else ctx.translate(0, -Y0 + 0.2); // Simple Bûche : posée au sol, sans membres

      ctx.save(); rot();
      // --- la bûche (dessus arrondi, bois verni) ---
      const r = 0.9, rt = 1.5;
      ctx.beginPath();
      ctx.moveTo(-W + r, Y0); ctx.lineTo(W - r, Y0); ctx.quadraticCurveTo(W, Y0, W, Y0 + r);
      ctx.lineTo(W, Y1 - rt); ctx.quadraticCurveTo(W, Y1, W - rt, Y1); ctx.lineTo(-W + rt, Y1); ctx.quadraticCurveTo(-W, Y1, -W, Y1 - rt);
      ctx.lineTo(-W, Y0 + r); ctx.quadraticCurveTo(-W, Y0, -W + r, Y0);
      ctx.closePath();
      ctx.fillStyle = D.lin(ctx, -W, 0, W, 0, U.shade(c.wood, -0.3), U.shade(c.wood, 0.1)); ctx.fill();
      ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW; ctx.stroke();
      ctx.save(); ctx.clip();
      // veines du bois (bas du corps, le visage reste lisse)
      ctx.strokeStyle = c.grain; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.18; ctx.lineCap = 'round';
      const veins = [[-1.9, 6.2, 13.4, 0.35], [-0.9, 6.6, 12.0, -0.3], [-2.2, 12.0, 21.5, 0.25], [0.6, 6.2, 11.0, 0.3], [1.9, 6.8, 13.6, -0.25], [-1.2, 13.5, 16.0, 0.2]];
      for (const [x, a, b, w] of veins) { ctx.beginPath(); ctx.moveTo(x, a); ctx.quadraticCurveTo(x + w, (a + b) / 2, x - w * 0.4, b); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // reflet vernis
      ctx.fillStyle = 'rgba(255,235,200,0.16)'; ctx.fillRect(0.9, Y0 + 0.6, 0.9, Y1 - Y0 - 1.6);
      ctx.restore();

      // --- visage (3/4 face), agrandi ---
      ctx.save(); ctx.translate(0.2, 21.5); ctx.scale(1.05, 1.05); ctx.translate(-0.4, -16.2);
      const ex = P.log > 0.5 ? 3 : P.eye, mad = ex === 1, scare = P.scare > 0.5;
      const SK = 'rgba(70,32,10,'; // ombres sculptées
      // orbites creuses
      for (const [x, y] of [[-0.2, 17.6], [2.0, 17.6]]) {
        const g = ctx.createRadialGradient(x, y, 0.6, x, y, 1.75); g.addColorStop(0, SK + '0.32)'); g.addColorStop(1, SK + '0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 1.75, 1.6, 0, 0, 7); ctx.fill();
      }
      // sourcils sculptés (haussés ; froncés si énervé)
      ctx.strokeStyle = SK + '0.85)'; ctx.lineWidth = 0.32; ctx.lineCap = 'round';
      ctx.beginPath();
      if (mad) { ctx.moveTo(-1.3, 19.4); ctx.quadraticCurveTo(-0.3, 19.3, 0.7, 18.7); ctx.moveTo(1.2, 18.7); ctx.quadraticCurveTo(2.2, 19.3, 3.0, 19.5); }
      else { ctx.moveTo(-1.3, 19.1); ctx.quadraticCurveTo(-0.3, 19.9, 0.75, 19.3); ctx.moveTo(1.15, 19.3); ctx.quadraticCurveTo(2.1, 20.0, 3.0, 19.3); }
      ctx.stroke();
      // yeux : grands, grands ouverts, iris sombre, regard fixe
      const eyes = [[-0.25, 17.55, 1.12, 1.08], [2.05, 17.55, 1.2, 1.12]].map(([x, y, rx, ry]) => (scare ? [x, y + 0.2, rx * 1.3, ry * 1.4] : [x, y, rx, ry]));
      for (const [x, y, rx, ry] of eyes) {
        if (ex === 2 || ex === 3) { D.eye(ctx, x, y, rx, ex); continue; }
        ctx.save();
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fillStyle = '#f3ede2'; ctx.fill();
        ctx.clip();
        const ix = x + 0.14, iy = y - 0.08, ir = scare ? 0.28 : mad ? 0.55 : 0.66;
        D.circ(ctx, ix, iy, ir, c.iris, true);
        D.circ(ctx, ix, iy, ir * 0.55, '#0a0604', true);
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(ix + 0.22, iy + 0.22, 0.13, 0, 7); ctx.fill();
        ctx.fillStyle = SK + '0.35)'; ctx.fillRect(x - rx, y + ry * 0.55, rx * 2, ry); // ombre de la paupière
        ctx.restore();
        // contour + paupière supérieure épaisse + pli au-dessus + cerne
        ctx.strokeStyle = 'rgba(30,14,6,0.9)'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.stroke();
        ctx.lineWidth = 0.26; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
        ctx.strokeStyle = SK + '0.7)'; ctx.lineWidth = 0.18;
        ctx.beginPath(); ctx.ellipse(x, y + 0.12, rx * 1.12, ry * 1.18, 0, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, y - 0.1, rx * 1.05, ry * 1.2, 0, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke();
      }
      // nez : long, qui dépasse du bord
      const nose = new Path2D();
      nose.moveTo(0.95, 17.3); nose.quadraticCurveTo(2.0, 16.5, 2.75, 15.5);
      nose.bezierCurveTo(3.25, 15.4, 3.55, 14.9, 3.3, 14.45); nose.bezierCurveTo(3.0, 14.0, 2.3, 14.1, 1.85, 14.45);
      nose.quadraticCurveTo(1.55, 15.6, 0.95, 17.3); nose.closePath();
      ctx.fillStyle = D.lin(ctx, 1, 17, 3.4, 14.6, U.shade(c.wood, -0.04), U.shade(c.wood, 0.16)); ctx.fill(nose);
      ctx.strokeStyle = 'rgba(40,18,6,0.85)'; ctx.lineWidth = 0.22; ctx.stroke(nose);
      ctx.fillStyle = 'rgba(255,240,215,0.35)'; ctx.beginPath(); ctx.ellipse(2.95, 15.0, 0.22, 0.16, 0, 0, 7); ctx.fill(); // reflet du bout
      ctx.fillStyle = SK + '0.8)'; ctx.beginPath(); ctx.ellipse(2.55, 14.45, 0.28, 0.13, -0.2, 0, 7); ctx.fill(); // narine
      // plis du sourire (joues)
      ctx.strokeStyle = SK + '0.6)'; ctx.lineWidth = 0.2;
      ctx.beginPath(); ctx.moveTo(1.7, 14.6); ctx.quadraticCurveTo(0.9, 14.0, 0.95, 12.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.9, 15.0); ctx.quadraticCurveTo(-1.5, 14.1, -1.3, 13.2); ctx.stroke();
      // joues vernies
      ctx.fillStyle = 'rgba(255,230,190,0.22)';
      ctx.beginPath(); ctx.ellipse(-0.6, 15.3, 0.75, 0.5, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(2.4, 15.9, 0.55, 0.4, 0, 0, 7); ctx.fill();
      // bouche : large sourire fermé, coins relevés (grimace en douleur)
      ctx.lineCap = 'round';
      if (ex === 2) {
        ctx.strokeStyle = D.OL; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(-1.0, 12.9); ctx.quadraticCurveTo(1.0, 13.7, 2.9, 12.9); ctx.stroke();
      } else {
        ctx.fillStyle = U.shade(c.wood, -0.12); // lèvre inférieure
        ctx.beginPath(); ctx.moveTo(-1.25, 13.85); ctx.quadraticCurveTo(0.9, 11.75, 3.0, 13.85); ctx.quadraticCurveTo(0.9, 12.55, -1.25, 13.85); ctx.fill();
        ctx.strokeStyle = D.OL; ctx.lineWidth = 0.32;
        ctx.beginPath(); ctx.moveTo(-1.25, 13.9); ctx.quadraticCurveTo(0.9, 12.55, 3.0, 13.9); ctx.stroke();
        ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(-1.45, 14.15); ctx.lineTo(-1.15, 13.8); ctx.moveTo(3.2, 14.15); ctx.lineTo(2.9, 13.8); ctx.stroke(); // coins
        ctx.strokeStyle = SK + '0.7)'; ctx.lineWidth = 0.16;
        ctx.beginPath(); ctx.moveTo(-0.2, 11.85); ctx.quadraticCurveTo(0.9, 11.5, 2.0, 11.85); ctx.stroke(); // menton
      }
      ctx.restore();

      // --- bras avant + batte ---
      if (swing) {
        swoosh();
        if (SG.front) { if (hasBat) bat(SG.hx, SG.hy, SG.bx, SG.by); const h2 = armTo(SX, SH, SG.hx, SG.hy, c.limb, 1.05, 0.95); hand(h2[0], h2[1], c.limb); }
      } else if (!logMode) {
        const fa = D.limb(ctx, SX, SH, P.aF, -(P.eF || 0), UA, FA, 1.05, 0.95, c.limb);
        if (hasBat) batA(fa.ex, fa.ey, fa.a2);
        hand(fa.ex, fa.ey, c.limb);
      }
      ctx.restore();
      ctx.restore();
    },
    drawFx(ctx, f, S, t) {
      // compteur TUNG au-dessus de la cible
      const c = f.v.cpt;
      if (!c || c.n <= 0 || c.t < 0) return;
      const tg = S.fighters[c.t];
      if (!tg || tg.dead || tg.out) return;
      const x = G.R.px(tg), y = G.R.py(tg) + G.ST(tg).h + 4.5;
      const full = c.n >= 3, pulse = full ? 1 + 0.08 * Math.sin(t * 16) : 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(pulse, -pulse);
      ctx.font = '900 3.6px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const txt = ['TUNG', 'TUNG TUNG', 'TUNG TUNG TUNG'][c.n - 1];
      ctx.lineWidth = 0.9; ctx.strokeStyle = '#1b1226'; ctx.strokeText(txt, 0, 0);
      ctx.fillStyle = full ? '#ff5a2a' : '#ffd27a'; ctx.fillText(txt, 0, 0);
      ctx.restore();
    },
    fx(e, R) {
      if (e.tung) R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 12, max: 12, size: 5 + e.tung * 2, col: e.tung >= 3 ? '#ff5a2a' : '#ffd27a' });
      if (e.shock) { R.parts.push({ ty: 'ring', x: e.x, y: e.y + 1, life: 14, max: 14, size: 9, col: '#ffe2b0' }); R.cam.shake = Math.max(R.cam.shake, 2); }
      if (e.sahur) {
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 20, max: 20, size: 16, col: '#ffffff' });
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 26, max: 26, size: 24, col: '#ff5a2a' });
        R.parts.push({ ty: 'custom', x: e.x, y: e.y + 6, life: 40, max: 40, draw(ctx, p, k) {
          ctx.save(); ctx.translate(p.x, p.y + (1 - k) * 4); const s = 1 + (1 - k) * 0.3; ctx.scale(s, -s);
          ctx.font = '900 6px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = Math.min(1, k * 2);
          ctx.lineWidth = 1.2; ctx.strokeStyle = '#1b1226'; ctx.strokeText('SAHUR !', 0, 0); ctx.fillStyle = '#ff5a2a'; ctx.fillText('SAHUR !', 0, 0);
          ctx.restore();
        } });
        R.cam.shake = Math.max(R.cam.shake, 8); R.flashScreen = Math.max(R.flashScreen || 0, 0.2);
      }
      if (e.homerun) {
        R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 18, max: 18, size: 14, col: '#ffffff' });
        R.parts.push({ ty: 'star', x: e.x, y: e.y, life: 12, max: 12, size: 14, col: '#fff3a0', rot: 0.3 });
        R.cam.shake = Math.max(R.cam.shake, 6);
      }
      if (e.name === 'tp' && e.x != null) { R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 14, max: 14, size: e.arrive ? 12 : 8, col: '#e8d0a0' }); R.spark(e.x, e.y, '#ffe2b0', 8, 2); }
      if (e.name === 'scare') { R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 16, max: 16, size: 14, col: '#ffffff' }); R.flashScreen = Math.max(R.flashScreen || 0, 0.25); R.cam.shake = Math.max(R.cam.shake, 5); }
    },
  });
})(window.G);
