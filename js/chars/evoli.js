'use strict';
// ÉVOLI — perso bonus. Bas B (maintenu) + direction = évolution en plein combat :
//   haut = Voltali (rapide, meilleur neutral)   avant = Pyroli (éjection forte, brûlure)
//   bas  = Noctali (lourd, défensif, tape fort)  arrière = Aquali (projectiles, déplacements d'eau sans perdre le haut B)
//   neutre = Mentali (saisie puissante, coups qui étourdissent)
// Chaque vie recommence en Évoli.
(function (G) {
  const U = G.U, D = G.D, H = G.H, A = G.A;
  const FORMS = { vol: 'Voltali', pyr: 'Pyroli', noc: 'Noctali', aqu: 'Aquali', men: 'Mentali' };

  // ---------- Coups de base (quadrupède) ----------
  const hb = A.headbutt;
  const BASE = {
    jab: { len: 16, iasa: 14, next: ['jab2', 4, 14], hits: [H(3, 4, 7, 6, 3.8, 2.5, 361, 25, 25)], anim: hb(3, 4, 16) },
    jab2: { len: 17, next: ['jab3', 5, 15], hits: [H(3, 4, 7.5, 6, 3.8, 2.5, 361, 25, 25)], anim: hb(3, 4, 17) },
    jab3: { len: 30, hits: [H(5, 7, 6, 5, 6, 4.5, 361, 55, 95)], anim: A.nair(5, 7, 30) },
    ftilt: { len: 26, hitCancel: 16, hits: [H(6, 8, 10, 5, 5, 8, 361, 32, 90)], anim: A.punch(6, 8, 26) },
    utilt: { len: 26, hitCancel: 14, hits: [H(5, 9, -1, 14, 6, 7, 95, 45, 88)], anim: [[0, {}], [4, { tl: -40 }], [5, { tl: 120, lean: -10 }], [12, { tl: 100 }], [26, {}]] },
    dtilt: { len: 20, hurtH: 0.7, hitCancel: 10, hits: [H(5, 7, 9, 1.5, 4.6, 5, 80, 40, 30, { trip: 1 })], anim: A.lowPoke(5, 7, 20) },
    dashAtk: { len: 34, keepVel: 1, tick: G.dashAtkTick, hitCancel: 20, hits: [H(5, 12, 7, 5, 5.8, 9, 55, 55, 70)], anim: A.dashAtk(5, 12, 34) },
    fsmash: { len: 48, charge: 9, hits: [H(14, 16, 11, 6, 6.8, 15, 361, 35, 100)], anim: [[0, {}], [9, { lean: -18, crouch: 0.5, eye: 1 }], [13, { lean: -15 }], [14, { lean: 25, sq: 1.1, eye: 1 }], [20, { lean: 20 }], [48, {}]] },
    usmash: { len: 46, charge: 7, hits: [H(11, 14, 0, 15, 7.5, 14, 88, 35, 102)], anim: A.uair(11, 14, 46) },
    dsmash: { len: 46, charge: 5, hits: [H(10, 11, 10, 2.5, 5.8, 13, 30, 32, 96), H(10, 11, -10, 2.5, 5.8, 13, 150, 32, 96)], anim: A.nair(10, 11, 46) },
    nair: { aerial: 1, len: 36, landLag: 7, ac: [4, 26], hits: [H(4, 7, 0, 6, 7.8, 8, 361, 30, 88), H(8, 16, 0, 6, 7, 5, 361, 20, 78)], anim: A.nair(4, 16, 36) },
    fair: { aerial: 1, len: 36, landLag: 9, ac: [3, 27], hits: [H(8, 11, 8, 6, 6.2, 10, 45, 30, 92)], anim: A.uair(8, 11, 36) },
    bair: { aerial: 1, len: 34, landLag: 9, ac: [4, 26], hits: [H(7, 9, -9, 5, 5.8, 12, 361, 30, 100)], anim: A.bair(7, 9, 34) },
    uair: { aerial: 1, len: 32, landLag: 8, ac: [3, 24], hits: [H(5, 9, 0, 15, 6.5, 9, 85, 30, 105)], anim: [[0, {}], [4, { tl: -30 }], [5, { tl: 150, rot: -60 }], [12, { rot: -120 }], [32, { rot: -360 }]] },
    dair: { aerial: 1, len: 42, landLag: 13, ac: [4, 34], hits: [H(10, 13, 0, -1, 5.2, 11, 270, 20, 85)], anim: A.dair(10, 13, 42) },
  };
  const SMASHES = { fsmash: 1, usmash: 1, dsmash: 1 }, TILTS = { ftilt: 1, utilt: 1, dtilt: 1 };
  function applyForm(key, mods) {
    const out = {};
    for (const name in BASE) {
      const M = Object.assign({}, BASE[name]);
      M.hits = M.hits.map((h) => {
        const n = Object.assign({}, h);
        n.dmg = +(h.dmg * mods.dmg).toFixed(2); n.kbg = Math.round(h.kbg * mods.kbg); n.bkb = h.bkb + (mods.bkb || 0);
        n.r = +(h.r * (mods.r || 1)).toFixed(2); n.t = mods.t;
        if (mods.stunTilts && TILTS[name]) n.stun = mods.stunTilts;
        if (mods.burn && SMASHES[name]) n.burn = mods.burn;
        return n;
      });
      if (mods.armorSmash && SMASHES[name]) M.armor = [Math.max(1, M.hits[0].f[0] - 6), M.hits[0].f[1], mods.armorSmash];
      out[key + ':' + name] = M;
    }
    return out;
  }

  // ---------- Projectiles ----------
  G.PROJ.star = {
    tick(S, p) {
      let best = null, bd = 1e9;
      for (const t of S.fighters) { if (t.slot === p.owner || t.dead || t.out) continue; const d = U.len(t.x - p.x, t.y - p.y); if (d < bd) { bd = d; best = t; } }
      if (best && p.age > 3 && bd < 110) {
        const a = U.datan2(p.vy, p.vx), b = U.datan2(best.y + G.ST(best).h * 0.5 - p.y, best.x - p.x);
        let d = b - a; while (d > 180) d -= 360; while (d < -180) d += 360;
        const na = a + U.clamp(d, -4, 4); p.vx = U.dcos(na) * 3; p.vy = U.dsin(na) * 3;
      }
    },
    draw(ctx, p, t) {
      ctx.rotate(t * 8); ctx.fillStyle = '#ffe44a'; ctx.strokeStyle = '#1b1226'; ctx.lineWidth = 0.25;
      ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 0.9 : 2.2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
    },
  };
  G.PROJ.needle = {
    draw(ctx, p) { ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.strokeStyle = '#fff8a0'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(-2.5, 0); ctx.lineTo(2.2, 0); ctx.stroke(); ctx.strokeStyle = 'rgba(255,230,60,0.6)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-1, 0); ctx.stroke(); },
  };
  G.PROJ.wgun = {
    draw(ctx, p, t) {
      const r = p.r;
      ctx.fillStyle = 'rgba(80,180,255,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r * 0.9, Math.atan2(p.vy, p.vx), 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(220,245,255,0.8)'; ctx.beginPath(); ctx.arc(r * 0.3, r * 0.3, r * 0.35, 0, 7); ctx.fill();
    },
  };
  G.PROJ.psyhold = {
    onHit(S, p, t, res) { if (res === 'hit') { const o = S.fighters[p.owner]; if (o) { t.kbx = Math.sign(o.x - t.x) * 1.4; t.kby = 0.5; } } },
    draw(ctx, p, t) { ctx.strokeStyle = `rgba(230,120,255,0.8)`; ctx.lineWidth = 0.6; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(0, 0, p.r * (0.6 + i * 0.4) + Math.sin(t * 20 + i) * 0.4, 0, 7); ctx.stroke(); } },
  };

  // ---------- Ticks des spéciaux ----------
  const once = (flag) => (S, f) => { if (!f.grounded) { if (f.v[flag]) { G.setAction(f, 'air'); return true; } f.v[flag] = 1; } return false; };
  function swiftTick(S, f, af) {
    if (af === 10 || af === 13 || af === 16) {
      const st = G.ST(f), a = af === 10 ? 20 : af === 13 ? 0 : -20;
      G.spawnProj(S, f, 'star', { x: f.x + f.facing * 5, y: f.y + st.h * 0.6, vx: f.facing * 3 * U.dcos(a), vy: 3 * U.dsin(a), r: 2, life: 60, dmg: 2.5, ang: 65, bkb: 35, kbg: 25, t: 'normal' });
      G.sfx(S, f, 'magic');
    }
  }
  function dashTick(speed, from, to, flag) {
    return (S, f, af) => {
      if (af === 1 && once(flag)(S, f)) return 'stop';
      if (af >= from && af <= to) { f.vx = f.facing * speed; if (!f.grounded) f.vy = 0; }
      if (af === from) G.sfx(S, f, 'dash');
      if (af > to) f.vx = U.approach(f.vx, 0, 0.25);
    };
  }
  function leapTick(vy, from, to, heal) {
    return (S, f, af, inp) => {
      if (af === from) { f.grounded = false; f.plat = null; G.sfx(S, f, 'djump'); if (heal) { f.percent = Math.max(0, f.percent - heal); f.flash = 8; } }
      if (af >= from && af <= to) { f.vy = vy - (af - from) * 0.05; f.vx = U.approach(f.vx, inp.sx * 1.0, 0.12); }
    };
  }
  function zipTick(dist) {
    return (S, f, af, inp) => {
      if (af === 4) { const m = U.len(inp.sx, inp.sy); f.mv.dx = m > 0.3 ? inp.sx / m : 0; f.mv.dy = m > 0.3 ? inp.sy / m : 1; f.grounded = false; f.plat = null; if (f.mv.dx) f.facing = f.mv.dx > 0 ? 1 : -1; G.sfx(S, f, 'dash'); }
      if (af >= 4 && af <= 11) { f.vx = f.mv.dx * dist / 8; f.vy = f.mv.dy * dist / 8; }
      if (af === 12) { f.vx *= 0.3; f.vy *= 0.3; }
    };
  }
  function needleTick(S, f, af) {
    if (af >= 8 && af <= 20 && (af - 8) % 3 === 0) {
      const st = G.ST(f), last = af === 20;
      G.spawnProj(S, f, 'needle', { x: f.x + f.facing * 6, y: f.y + st.h * 0.5, vx: f.facing * 4.4, vy: 0, r: 1.5, life: 26, dmg: last ? 3.5 : 1.8, ang: last ? 45 : 70, bkb: last ? 45 : 30, kbg: last ? 60 : 15, t: 'elec' });
      G.sfx(S, f, 'arrow');
    }
  }
  function voltSwitchTick(S, f, af) {
    if (af === 1) { if (once('vs')(S, f)) return 'stop'; f.mv.x0 = f.x; }
    if (af >= 5 && af <= 13) { f.vx = f.facing * 5; if (!f.grounded) f.vy = 0; }
    if (af === 5) G.sfx(S, f, 'dash');
    if (af === 14) f.vx = 0;
    if (af >= 16 && af <= 23 && f.mv.hit) { f.vx = -f.facing * 5; if (!f.grounded) f.vy = 0; } // repli éclair
    if (af === 24) f.vx *= 0.2;
  }
  function darkPulseTick(S, f, af) { if (af === 12) G.sfx(S, f, 'ghost', { pulse: 1 }); if (!f.grounded && af < 18) f.vy = Math.max(f.vy, -0.3); }
  function crunchGrab(S, a, t) {
    G.applyHit(S, { att: a, tgt: t, hb: { dmg: 12, ang: 40, bkb: 70, kbg: 72, t: 'dark', unblockable: true }, key: 'cr' + a.mi, x: t.x, y: t.y + 6, dir: a.facing, wx: t.x, wy: t.y + 6 });
    G.sfx(S, a, 'grab');
  }
  function psyholdTick(S, f, af) {
    if (af === 10) { const st = G.ST(f); G.spawnProj(S, f, 'psyhold', { x: f.x + f.facing * 6, y: f.y + st.h * 0.55, vx: f.facing * 4, vy: 0, r: 4, life: 16, dmg: 6, ang: 90, bkb: 0, kbg: 0, stun: 36, t: 'psychic', refl: false }); G.sfx(S, f, 'ghost'); }
  }
  function confusionTick(S, f, af) { if (af === 9) G.sfx(S, f, 'magic', { conf: 1 }); }
  function breathTick(S, f, af) {
    const st = G.ST(f);
    if (!f.grounded) f.vy = Math.max(f.vy, -0.35);
    if (af >= 8 && af <= 30) {
      for (let i = 0; i < 2; i++) G.pendingHitbox(S, f, { x: 8 + i * 5, y: st.h * 0.5, r: 3.4 + i, dmg: 1.2, ang: 361, bkb: 0, kbg: 0, t: 'fire', rehit: 4, link: 1, hs: 9, burn: 90, noTrail: 1 });
      if (af % 2 === 0) S.events.push({ t: 'sfx', name: af % 8 === 0 ? 'fire' : '', s: f.slot, flame: 1, x: f.x + f.facing * 8, y: f.y + st.h * 0.5, dx: f.facing, dy: 0, k: 'eb' + f.slot + '_' + S.frame });
    }
    if (af === 32) { G.pendingHitbox(S, f, { x: 13, y: st.h * 0.5, r: 7, dmg: 7, ang: 45, bkb: 55, kbg: 90, t: 'fire', g: 1 }); G.sfx(S, f, 'fire'); }
  }
  function flareTick(S, f, af) {
    if (af === 1 && once('fb')(S, f)) return 'stop';
    if (af >= 8 && af <= 24) { f.vx = f.facing * 3.3; if (!f.grounded) f.vy = Math.max(f.vy, af < 16 ? 0.1 : -0.6); }
    if (af === 8) G.sfx(S, f, 'fire');
    if (af > 24) f.vx = U.approach(f.vx, 0, 0.2);
  }
  function wgunTick(S, f, af, inp) {
    if (af === 1) f.mv.c = 0;
    if (af === 8 && inp.held(G.BTN.SPC) && f.mv.c < 45) {
      f.mv.c++; f.af = 7;
      // pendant la charge : on peut se retourner (stick arrière) et sauter (sol ou double saut) sans perdre la charge
      if (inp.sx * f.facing < -0.5) f.facing = -f.facing;
      if (f.buf.j) {
        const st = G.ST(f), g = st.grav * 0.5; // gravité réduite pendant le coup : même hauteur qu'un saut normal
        if (f.grounded) {
          f.vy = Math.sqrt(2 * g * st.fullHop); f.vx = inp.sx * st.air * 0.8;
          f.grounded = false; f.plat = null; f.jumps = 1; f.ff = false;
          S.events.push({ t: 'jump', s: f.slot, x: f.x, y: f.y, k: 'j' + f.slot + '_' + S.frame });
        } else if (f.jumps < st.jumps) {
          f.jumps++; f.vy = Math.sqrt(2 * g * st.dJump); f.vx = inp.sx * st.air; f.ff = false;
          S.events.push({ t: 'djump', s: f.slot, x: f.x, y: f.y, k: 'dj' + f.slot + '_' + S.frame });
        }
        f.buf.j = 0;
      }
      if (!f.grounded) f.vy = Math.max(f.vy, -0.5);
      return;
    }
    if (af === 9) {
      const c = f.mv.c, st = G.ST(f);
      G.spawnProj(S, f, 'wgun', { x: f.x + f.facing * 6, y: f.y + st.h * 0.55, vx: f.facing * (3 + c / 45 * 1.8), vy: 0, r: 2 + c / 45 * 1.8, life: 34, dmg: 3 + c / 45 * 7, ang: 25, bkb: 50, kbg: 40 + c, t: 'water' });
      G.sfx(S, f, 'water');
      if (!f.grounded) { f.vx -= f.facing * (0.9 + c / 45 * 1.2); f.vy = Math.max(f.vy, 0.6 + c / 45 * 0.8); } // recul : mobilité
    }
  }
  function aquaJetTick(S, f, af, inp) {
    if (af === 1 && !f.grounded) { if ((f.v.aj || 0) >= 2) { G.setAction(f, 'air'); return 'stop'; } f.v.aj = (f.v.aj || 0) + 1; }
    if (af === 4) { const m = U.len(inp.sx, inp.sy); f.mv.dx = m > 0.3 ? inp.sx / m : f.facing; f.mv.dy = m > 0.3 ? inp.sy / m : 0; if (f.grounded && f.mv.dy < 0) f.mv.dy = 0; if (f.mv.dy > 0.2) { f.grounded = false; f.plat = null; } if (f.mv.dx) f.facing = f.mv.dx > 0 ? 1 : -1; G.sfx(S, f, 'water'); }
    if (af >= 4 && af <= 12) { f.vx = f.mv.dx * 4.2; f.vy = f.mv.dy * 4.2; if (af % 2 === 0) S.events.push({ t: 'sfx', name: '', s: f.slot, bub: 1, x: f.x, y: f.y + 6, k: 'aj' + f.slot + '_' + S.frame }); }
    if (af === 13) { f.vx *= 0.35; f.vy *= 0.35; }
  }

  // ---------- Coups signature des évolutions ----------
  G.PROJ.bubble = {
    tick(S, p) { p.vx *= 0.97; },
    draw(ctx, p, t) {
      const r = p.r * (1 + 0.08 * Math.sin(t * 9 + p.id));
      ctx.fillStyle = 'rgba(120,200,255,0.25)'; ctx.strokeStyle = 'rgba(220,250,255,0.9)'; ctx.lineWidth = 0.35;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(-r * 0.35, r * 0.35, r * 0.22, 0, 7); ctx.fill();
    },
  };
  // Voltali — Hérisson : aiguilles électriques dans les 8 directions
  function spikeBurstTick(S, f, af) {
    if (af === 5) {
      const st = G.ST(f);
      for (let i = 0; i < 8; i++) { const a = i * 45; G.spawnProj(S, f, 'needle', { x: f.x, y: f.y + st.h * 0.5, vx: U.dcos(a) * 3.4, vy: U.dsin(a) * 3.4, r: 1.3, life: 8, dmg: 2, ang: 361, bkb: 28, kbg: 30, t: 'elec', refl: false, clank: false }); }
      G.sfx(S, f, 'arrow');
    }
  }
  const lunge = (fr, sp) => (S, f, af) => { if (af === fr) { f.vx = f.facing * Math.max(Math.abs(f.vx), sp); G.sfx(S, f, 'dash'); } };
  function boltTick(S, f, af) { if (af < 8) { f.vy = Math.max(f.vy, 0.2); f.vx *= 0.9; } if (af === 8) G.sfx(S, f, 'hammer', { bolt: 1 }); }
  // Pyroli — Boutefeu Plongé : plonge en flammes, laisse un pilier de feu à l'atterrissage
  function fireDiveTick(S, f, af) { if (af < 6) { f.vy = Math.max(f.vy, 0.3); f.vx *= 0.9; } if (af === 6) { f.vy = -3.2; f.ff = true; G.sfx(S, f, 'fire'); } }
  function fireDiveLand(S, f) {
    G.spawnEcho(S, f, { x: 0, y: 5, r: 8, delay: 0, dur: 26, dmg: 2, rehit: 7, ang: 80, bkb: 42, kbg: 20, style: 'fire', col: '#ff7a2a', t: 'fire', extra: { burn: 90 } });
    G.sfx(S, f, 'fire'); f.lag = 10; G.setAction(f, 'lag');
  }
  // Pyroli — Boutefeu (smash avant) : charge enflammée, 3 % de recul pour lui s'il touche
  function flareBlitzTick(S, f, af) { if (af >= 12 && af <= 20) f.vx = f.facing * 3.0; if (af === 12) G.sfx(S, f, 'fire'); if (af > 20) f.vx = U.approach(f.vx, 0, 0.25); }
  // Aquali — Bulles : trois bulles montent lentement
  function bubbleTick(S, f, af) {
    if (af === 7) { const st = G.ST(f); [78, 90, 102].forEach((a) => G.spawnProj(S, f, 'bubble', { x: f.x + U.dcos(a) * 4 * f.facing, y: f.y + st.h, vx: U.dcos(a) * 1.3 * f.facing, vy: U.dsin(a) * 1.3, r: 2.4, life: 45, dmg: 3, ang: 88, bkb: 42, kbg: 40, t: 'water' })); G.sfx(S, f, 'water'); }
  }
  function cascadeTick(S, f, af) { if (af < 7) { f.vy = Math.max(f.vy, 0.25); f.vx *= 0.9; } if (af === 7) G.sfx(S, f, 'water', { cascade: 1 }); }
  // Mentali — Prescience : un orbe psy apparaît derrière et explose 2/3 s plus tard
  function futureSightTick(S, f, af) { if (af === 8) { G.spawnEcho(S, f, { x: -14, y: 7, r: 7, delay: 40, dur: 5, dmg: 10, ang: 361, bkb: 42, kbg: 88, style: 'orb', col: '#e67aff', t: 'psychic', sfx: 'magic' }); G.sfx(S, f, 'ghost'); } }
  // Noctali — chute obscure
  function darkDropTick(S, f, af) { if (af < 5) { f.vy = Math.max(f.vy, 0.3); f.vx *= 0.9; } if (af === 5) { f.vy = -3.2; f.ff = true; } }
  // Noctali — Clair de Lune (provocation) : soigne 6 % (une fois toutes les 10 s)
  function moonTick(S, f, af) { if (af === 40 && (f.v.moonCd || 0) <= 0) { f.percent = Math.max(0, f.percent - 6); f.v.moonCd = 600; f.flash = 12; G.sfx(S, f, 'magic', { moon: 1 }); } }

  // ---------- Évolution (bas B maintenu + direction) ----------
  function pickDir(f, inp) {
    const ax = Math.abs(inp.sx), ay = Math.abs(inp.sy);
    if (ax < 0.4 && ay < 0.4) return 'men';
    if (ay >= ax) return inp.sy > 0 ? 'vol' : 'noc';
    return inp.sx * f.facing > 0 ? 'pyr' : 'aqu';
  }
  function evoTick(S, f, af, inp) {
    if (af === 1) { f.mv.pick = 'men'; f.mv.hold = 0; G.sfx(S, f, 'magic'); }
    if (!f.grounded) { f.vy = Math.max(f.vy, -0.4); f.vx *= 0.94; }
    if (af === 8) {
      // on garde le choix du dernier frame où B était maintenu (on relâche souvent stick et bouton ensemble)
      if (inp.held(G.BTN.SPC) && f.mv.hold < 90) { f.mv.pick = pickDir(f, inp); f.mv.hold++; f.af = 7; return; }
      if (f.mv.pick === f.v.form) { G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; }
    }
    if (af === 22) {
      f.v.form = f.mv.pick; f.v.evoCd = 150; f.flash = 14;
      G.sfx(S, f, 'transform', { evo: 1 });
    }
  }

  const E = (o) => o;
  const moves = Object.assign({},
    BASE,
    {
      nspec: { len: 34, tick: swiftTick, land: 'keep', grav: 0.6, anim: A.headbutt(10, 16, 34) },
      sspec: { len: 32, tick: dashTick(3.4, 5, 14, 'qa'), keepVel: 1, offEdge: 1, land: 'keep', drift: 0, noGrav: (af) => af >= 5 && af <= 14, hitCancel: 17, ledge: 14, hits: [H(5, 14, 4, 6, 5.5, 7, 50, 50, 55)], anim: [[0, { crouch: 0.4 }], [5, { lean: 20, aF: 100, aB: 100, lF: -60, lB: -60 }], [14, { lean: 15 }], [32, {}]] },
      uspec: { len: 40, helpless: 1, landLag: 16, ledge: 12, tick: leapTick(3.4, 4, 16), drift: 0, noGrav: (af) => af >= 4 && af <= 16, hits: [H(4, 12, 3, 10, 6, 8, 80, 50, 70)], anim: [[0, { crouch: 0.6 }], [4, { lean: -40, aF: 150, aB: 150 }], [16, { lean: -30 }], [40, {}]] },
      dspec: { len: 44, noReverse: 1, tick: evoTick, land: 'keep', intang: [12, 22], cond: (S, f) => (f.v.evoCd || 0) <= 0, anim: [[0, {}], [7, { crouch: 0.4, glow: 1, eye: 3 }], [8, { crouch: 0.4, glow: 1, eye: 3 }], [12, { rot: 0, glow: 1 }], [22, { rot: 720, glow: 1, sq: 1.15 }], [44, { rot: 720 }]] },
    },
    applyForm('vol', { dmg: 0.9, kbg: 0.95, t: 'elec' }),
    applyForm('noc', { dmg: 1.25, kbg: 1.05, bkb: 4, t: 'dark', armorSmash: 45 }),
    applyForm('men', { dmg: 1.0, kbg: 1.0, t: 'psychic', r: 1.18, stunTilts: 20 }),
    applyForm('pyr', { dmg: 1.05, kbg: 1.22, bkb: 5, t: 'fire', burn: 120 }),
    applyForm('aqu', { dmg: 1.0, kbg: 1.0, t: 'water', r: 1.1 }),
    {
      // ===== Chaque évolution a SES aériens et quelques coups au sol à elle (plus de copier-coller d'Évoli) =====
      // VOLTALI — aiguilles électriques, vitesse
      'vol:nair': { aerial: 1, len: 32, landLag: 6, ac: [4, 22], tick: spikeBurstTick, hits: [H(4, 6, 0, 6, 7, 4, 361, 30, 40, { t: 'elec' })], anim: [[0, {}], [4, { sq: 0.85, tuck: 0.6, glow: 1 }], [5, { sq: 1.2, tuck: 0, aF: 60, aB: -40, lF: 60, lB: -60, glow: 1, eye: 1 }], [12, { sq: 1 }], [32, {}]] },
      'vol:fair': { aerial: 1, len: 32, landLag: 8, ac: [3, 24], tick: lunge(5, 2.3), hits: [H(6, 9, 8, 6, 6, 8, 40, 35, 85, { t: 'elec' })], anim: [[0, {}], [4, { lean: -10, hd: -15 }], [6, { lean: 22, hd: 25, aF: 100, aB: 90, eye: 1 }], [12, { lean: 16, hd: 15 }], [32, {}]] },
      'vol:bair': { aerial: 1, len: 32, landLag: 8, ac: [4, 24], hits: [H(5, 6, -9, 5, 5.5, 4, 361, 25, 30, { t: 'elec' }), H(10, 12, -9, 5, 6, 7, 361, 40, 95, { t: 'elec', g: 1 })], anim: [[0, {}], [4, { lB: -20, lF: -10 }], [5, { lB: -110, lF: -100, lean: 10, eye: 1 }], [8, { lB: -30, lF: -20 }], [10, { lB: -115, lF: -105, lean: 12 }], [32, {}]] },
      'vol:uair': { aerial: 1, len: 32, landLag: 7, ac: [3, 24], hits: [H(4, 12, 0, 13, 6.5, 1.2, 90, 0, 0, { t: 'elec', rehit: 3, link: 1, hs: 8 }), H(14, 15, 0, 14, 7, 4, 85, 45, 105, { t: 'elec', g: 1 })], anim: [[0, {}], [3, { hd: 40, lean: -30, glow: 1 }], [15, { hd: 40, lean: -30, glow: 1, tl: 120 }], [32, {}]] },
      'vol:dair': { aerial: 1, len: 38, landLag: 10, ac: [4, 30], tick: boltTick, hits: [...G.LINE(8, 11, 0, -2, 0, -24, 4, 4.5, 8, 72, 45, 72, { t: 'elec' })], anim: [[0, {}], [7, { hd: -20, glow: 1, sq: 0.9 }], [8, { hd: -30, glow: 1, sq: 1.1, eye: 1 }], [14, { hd: -10 }], [38, {}]] },
      'vol:ftilt': { len: 26, hitCancel: 13, hits: [H(5, 6, 9, 5, 5, 4, 361, 20, 20, { t: 'elec' }), H(10, 11, 10, 5, 5.5, 6, 361, 38, 90, { t: 'elec', g: 1 })], anim: [[0, {}], [4, { lB: -20 }], [5, { lB: -100, lean: 14 }], [8, { lB: -20 }], [10, { lB: -110, lean: 16, eye: 1 }], [26, {}]] },
      'vol:usmash': { len: 48, charge: 7, hits: [...G.LINE(12, 16, 0, 8, 0, 40, 5, 5.5, 15, 88, 36, 102, { t: 'elec' })], anim: [[0, {}], [7, { crouch: 0.7, glow: 1, eye: 1 }], [12, { hd: 40, sq: 1.15, glow: 1 }], [18, { hd: 30 }], [48, {}]] },
      // PYROLI — tout brûle, éjection forte
      'pyr:nair': { aerial: 1, len: 36, landLag: 7, ac: [4, 26], hits: [H(4, 14, 0, 6, 7.5, 1.4, 361, 0, 0, { t: 'fire', rehit: 3, link: 1, hs: 8, burn: 60 }), H(16, 17, 0, 6, 8.5, 5, 361, 48, 98, { t: 'fire', g: 1, burn: 90 })], anim: [[0, {}], [4, { tuck: 1, rot: 0, glow: 1 }], [16, { tuck: 1, rot: -720, glow: 1 }], [20, { tuck: 0.2, rot: -720 }], [36, { rot: -720 }]] },
      'pyr:fair': { aerial: 1, len: 36, landLag: 9, ac: [3, 27], hits: [H(8, 10, 8, 6, 6.2, 11, 45, 32, 92, { t: 'fire', burn: 150 })], anim: [[0, {}], [7, { hd: -20, lean: -8 }], [8, { hd: 30, lean: 16, aF: 90, eye: 1 }], [14, { hd: 20 }], [36, {}]] },
      'pyr:bair': { aerial: 1, len: 36, landLag: 10, ac: [4, 27], hits: [H(8, 10, -10, 5, 6.5, 15, 361, 35, 105, { t: 'fire', burn: 150 })], anim: A.bair(8, 10, 36) },
      'pyr:uair': { aerial: 1, len: 32, landLag: 8, ac: [3, 24], tick: (S, f, af) => { if (af === 6) G.sfx(S, f, 'fire', { puff: 1 }); }, hits: [H(6, 9, 0, 15, 7.5, 9, 85, 35, 100, { t: 'fire', burn: 90 })], anim: [[0, {}], [5, { hd: 45, lean: -20 }], [6, { hd: 60, lean: -25, eye: 1 }], [14, { hd: 30 }], [32, {}]] },
      'pyr:dair': { aerial: 1, len: 44, landLag: 10, ac: [4, 38], tick: fireDiveTick, onLand: fireDiveLand, hits: [H(6, 30, 0, 1, 6, 10, 70, 40, 60, { t: 'fire', burn: 90 })], anim: [[0, {}], [5, { tuck: 1, glow: 1 }], [6, { tuck: 1, rot: 90, glow: 1 }], [44, { tuck: 1, rot: 90, glow: 1 }]] },
      'pyr:ftilt': { len: 26, hitCancel: 14, hits: [H(6, 8, 10, 5, 5.5, 9, 361, 32, 92, { t: 'fire', burn: 90 })], anim: [[0, {}], [5, { tl: -40, lean: 10 }], [6, { tl: 140, lean: -8, eye: 1 }], [14, { tl: 100 }], [26, {}]] },
      'pyr:fsmash': { len: 52, charge: 9, tick: flareBlitzTick, keepVel: 1, hits: [H(13, 20, 8, 6, 7.5, 18, 361, 36, 100, { t: 'fire', burn: 120, onHit: (S, a) => { a.percent = Math.min(999, a.percent + 3); a.flash = 4; } })], anim: [[0, {}], [9, { crouch: 0.6, glow: 1, eye: 1 }], [12, { tuck: 1, rot: 0, glow: 1 }], [20, { tuck: 1, rot: -540, glow: 1 }], [26, { tuck: 0, rot: -720 }], [52, { rot: -720 }]] },
      // AQUALI — fluide : se liquéfie, bulles, geyser
      'aqu:nair': { aerial: 1, len: 36, landLag: 7, ac: [4, 26], intang: [3, 9], float: [3, 12, 0.1], hits: [H(10, 13, 0, 6, 9.5, 9, 361, 38, 90, { t: 'water' })], anim: [[0, {}], [3, { tuck: 1, sq: 0.8 }], [9, { tuck: 1, sq: 0.8 }], [10, { tuck: 0, sq: 1.2, aF: 60, lF: 60, eye: 1 }], [18, { sq: 1 }], [36, {}]] },
      'aqu:fair': { aerial: 1, len: 36, landLag: 8, ac: [3, 27], float: [7, 13, 0.1], hits: [H(8, 11, 9, 6, 7, 10, 45, 32, 90, { t: 'water' })], anim: A.uair(8, 11, 36) },
      'aqu:bair': { aerial: 1, len: 36, landLag: 9, ac: [4, 27], hits: [...G.LINE(8, 11, -4, 3, -16, 6, 3, 5, 10, 361, 32, 95, { t: 'water' })], anim: [[0, {}], [7, { tl: -30, lean: 8 }], [8, { tl: 150, lean: -12, eye: 1 }], [16, { tl: 120 }], [36, {}]] },
      'aqu:uair': { aerial: 1, len: 34, landLag: 8, ac: [3, 25], tick: bubbleTick, hits: [H(5, 8, 0, 14, 6, 5, 88, 35, 80, { t: 'water' })], anim: [[0, {}], [5, { hd: 40, lean: -20 }], [7, { hd: 55, lean: -25, eye: 3 }], [16, { hd: 30 }], [34, {}]] },
      'aqu:dair': { aerial: 1, len: 40, landLag: 11, ac: [4, 32], tick: cascadeTick, hits: [...G.LINE(7, 14, 0, -1, 0, -16, 3, 5, 1.2, 270, 0, 0, { t: 'water', rehit: 3, link: 1, hs: 8 }), H(15, 16, 0, -10, 7, 5, 280, 30, 60, { t: 'water', g: 1 })], anim: [[0, {}], [6, { hd: -30, lean: 20 }], [16, { hd: -30, lean: 20 }], [40, {}]] },
      'aqu:ftilt': { len: 28, hitCancel: 15, hits: [H(6, 8, 11, 5, 6, 8, 40, 32, 88, { t: 'water' })], anim: [[0, {}], [5, { tl: -40 }], [6, { tl: 150, lean: 10 }], [14, { tl: 120 }], [28, {}]] },
      'aqu:usmash': { len: 54, charge: 8, hits: [...G.LINE(12, 22, 0, 4, 0, 30, 4, 5.5, 1.6, 90, 0, 0, { t: 'water', rehit: 3, link: 1, hs: 8 }), H(24, 26, 0, 30, 8, 7, 88, 40, 106, { t: 'water', g: 1 })], anim: [[0, {}], [8, { crouch: 0.6, eye: 1 }], [12, { hd: 50, sq: 1.15 }], [26, { hd: 50 }], [54, {}]] },
      // MENTALI — télékinésie : coups à distance, étourdissements, prescience
      'men:nair': { aerial: 1, len: 34, landLag: 7, ac: [4, 24], hits: [H(5, 9, 0, 6, 9.5, 7, 361, 40, 45, { t: 'psychic', stun: 16 })], anim: [[0, {}], [4, { glow: 1, hd: -10, sq: 0.9 }], [5, { glow: 1, sq: 1.15 }], [12, { glow: 0.5 }], [34, {}]] },
      'men:fair': { aerial: 1, len: 36, landLag: 9, ac: [3, 26], tick: (S, f, af) => { if (af === 9) G.sfx(S, f, 'ghost', { psyAt: 1, x: f.x + f.facing * 20, y: f.y + 7 }); }, hits: [H(9, 11, 20, 7, 6.5, 8, 45, 35, 85, { t: 'psychic' })], anim: [[0, {}], [8, { hd: -15, glow: 1 }], [9, { hd: 15, glow: 1, eye: 1 }], [16, { hd: 5 }], [36, {}]] },
      'men:bair': { aerial: 1, len: 34, landLag: 9, ac: [4, 26], tick: futureSightTick, hits: [H(7, 9, -9, 6, 5, 4, 361, 25, 30, { t: 'psychic' })], anim: [[0, {}], [7, { glow: 1, tl: 150, eye: 3 }], [14, { glow: 0.5 }], [34, {}]] },
      'men:dair': { aerial: 1, len: 38, landLag: 10, ac: [4, 30], tick: (S, f, af) => { if (af === 10) G.sfx(S, f, 'ghost', { psyAt: 1, x: f.x, y: f.y - 12 }); }, hits: [H(10, 12, 0, -12, 7, 9, 280, 30, 80, { t: 'psychic' })], anim: [[0, {}], [9, { hd: -35, glow: 1 }], [10, { hd: -40, glow: 1, eye: 1 }], [18, { hd: -20 }], [38, {}]] },
      'men:ftilt': { len: 26, hitCancel: 14, hits: [H(6, 8, 11, 5, 6, 7, 361, 30, 40, { t: 'psychic', stun: 22 })], anim: [[0, {}], [5, { hd: -15, glow: 1 }], [6, { hd: 20, lean: 12, glow: 1, eye: 1 }], [26, {}]] },
      'men:usmash': { len: 50, charge: 8, tick: (S, f, af) => { if (af === 14) G.sfx(S, f, 'ghost', { psyAt: 1, x: f.x, y: f.y + 26 }); }, hits: [H(14, 17, 0, 26, 9, 15, 88, 36, 102, { t: 'psychic' })], anim: [[0, {}], [8, { crouch: 0.5, glow: 1 }], [14, { hd: 50, glow: 1, eye: 1 }], [22, { hd: 30 }], [50, {}]] },
      // NOCTALI — défensif, sueur toxique (poison), Clair de Lune
      'noc:nair': { aerial: 1, len: 36, landLag: 8, ac: [4, 26], tick: (S, f, af) => { if (af === 5) G.sfx(S, f, 'magic', { rings: 1 }); }, hits: [H(5, 9, 0, 6, 9, 8, 361, 35, 80, { t: 'dark', poison: 240 })], anim: [[0, {}], [4, { glow: 1, sq: 0.9 }], [5, { glow: 1, sq: 1.12, eye: 1 }], [14, {}], [36, {}]] },
      'noc:fair': { aerial: 1, len: 40, landLag: 11, ac: [4, 30], hits: [H(9, 12, 8, 6, 6.5, 12, 40, 36, 92, { t: 'dark', poison: 240 })], anim: [[0, {}], [8, { hd: -20, lean: -8 }], [9, { hd: 30, lean: 16, aF: 90, eye: 1 }], [16, { hd: 20 }], [40, {}]] },
      'noc:bair': { aerial: 1, len: 38, landLag: 11, ac: [4, 28], armor: [4, 9, 60], hits: [H(9, 11, -9, 5, 6.5, 15, 361, 34, 102, { t: 'dark' })], anim: [[0, {}], [8, { lB: -20, lF: -10 }], [9, { lB: -115, lF: -105, lean: 14, eye: 1 }], [16, { lB: -100 }], [38, {}]] },
      'noc:uair': { aerial: 1, len: 32, landLag: 8, ac: [3, 24], hits: [H(5, 9, 0, 13, 7, 9, 85, 35, 100, { t: 'dark', poison: 180 })], anim: [[0, {}], [4, { tl: -30 }], [5, { tl: 150, rot: -60 }], [12, { rot: -120 }], [32, { rot: -360 }]] },
      'noc:dair': { aerial: 1, len: 46, landLag: 13, ac: [4, 40], armor: [4, 22, 70], tick: darkDropTick, hits: [H(6, 26, 0, 0, 6, 11, 280, 28, 80, { t: 'dark', poison: 240 })], anim: [[0, {}], [4, { tuck: 0.6, glow: 1 }], [5, { aF: 20, lF: 20, sq: 1.1, eye: 1, glow: 1 }], [46, { aF: 20, lF: 20 }]] },
      'noc:ftilt': { len: 28, hitCancel: 15, hits: [H(7, 9, 10, 5, 5.5, 10, 361, 34, 92, { t: 'dark', poison: 240 })], anim: A.punch(7, 9, 28) },
      'noc:taunt': { len: 70, tick: moonTick, anim: [[0, {}], [12, { hd: 40, glow: 1, eye: 3 }], [58, { hd: 40, glow: 1, eye: 3 }], [70, {}]] },
      'men:uair': { aerial: 1, len: 34, landLag: 8, ac: [3, 25], hits: [H(5, 9, 0, 15, 8, 8, 90, 45, 30, { t: 'psychic', stun: 26 })], anim: A.uair(5, 9, 34) },
      // Voltali : le meilleur neutral
      'vol:nspec': { len: 30, tick: needleTick, land: 'keep', grav: 0.5, anim: A.headbutt(8, 20, 30) },
      'vol:sspec': { len: 34, tick: voltSwitchTick, keepVel: 1, offEdge: 1, land: 'keep', drift: 0, noGrav: (af) => af >= 5 && af <= 24, ledge: 14, hits: [H(5, 13, 4, 6, 6, 8, 45, 50, 60, { t: 'elec' })], anim: [[0, { crouch: 0.4 }], [5, { lean: 22, aF: 100, aB: 100, lF: -60, lB: -60, glow: 1 }], [24, { lean: 10 }], [34, {}]] },
      'vol:uspec': { len: 34, helpless: 1, landLag: 12, ledge: 11, ledgeRising: 1, tick: zipTick(56), drift: 0, noGrav: (af) => af >= 4 && af <= 12, intang: [4, 8], hits: [H(4, 11, 0, 6, 6, 6, 70, 50, 60, { t: 'elec' })], anim: [[0, { crouch: 0.4 }], [4, { lean: 30, glow: 1 }], [12, { lean: 20 }], [34, {}]] },
      // Noctali : défensif, tape fort
      'noc:nspec': { len: 44, tick: darkPulseTick, land: 'keep', armor: [6, 16, 40], hits: [H(12, 15, 0, 6, 13, 13, 55, 50, 90, { t: 'dark', away: 1 })], anim: [[0, {}], [10, { crouch: 0.5, glow: 1, eye: 1 }], [12, { sq: 1.15, glow: 1 }], [20, {}], [44, {}]] },
      'noc:sspec': { len: 40, keepVel: 1, offEdge: 1, land: 'keep', tick: dashTick(2.6, 8, 18, 'cr'), drift: 0, hits: [G.GH(8, 18, 8, 6, 5.8)], onGrab: crunchGrab, anim: [[0, { crouch: 0.3 }], [8, { lean: 25, hd: 20, eye: 1 }], [18, { lean: 20 }], [40, {}]] },
      'noc:uspec': { len: 42, helpless: 1, landLag: 18, ledge: 12, tick: leapTick(3.0, 5, 18, 4), drift: 0, noGrav: (af) => af >= 5 && af <= 18, hits: [H(5, 14, 0, 10, 7, 9, 80, 55, 70, { t: 'fairy' })], anim: [[0, { crouch: 0.6, glow: 1 }], [5, { lean: -40, glow: 1 }], [18, { lean: -30 }], [42, {}]] },
      // Mentali : saisie à distance, étourdissements
      'men:nspec': { len: 36, tick: psyholdTick, land: 'keep', grav: 0.5, anim: [[0, {}], [8, { hd: -15, glow: 1 }], [10, { hd: 20, glow: 1 }], [36, {}]] },
      'men:sspec': { len: 32, tick: confusionTick, land: 'keep', grav: 0.6, hits: [H(9, 12, 12, 6, 9, 7, 60, 45, 30, { t: 'psychic', stun: 28 })], anim: [[0, {}], [8, { glow: 1, hd: -10 }], [9, { glow: 1, hd: 15, lean: 8 }], [32, {}]] },
      'men:uspec': { len: 34, helpless: 1, landLag: 14, ledge: 13, tick: zipTick(50), drift: 0, noGrav: (af) => af >= 4 && af <= 12, intang: [4, 12], anim: [[0, { glow: 1 }], [4, { glow: 1, eye: 3 }], [12, {}], [34, {}]] },
      'men:grab': { len: 34, hits: [G.GH(7, 9, 12, 6, 7.5)], anim: A.grab(7, 9, 34) },
      'men:dashgrab': { len: 40, keepVel: 1, traction: 1.6, hits: [G.GH(10, 12, 14, 6, 8)], anim: A.grab(10, 12, 40) },
      'men:bthrow': { throw: 1, back: 1, len: 38, rel: 18, dmg: 12, ang: 42, bkb: 60, kbg: 92, t: 'psychic', hold: [[0, 1, 0], [9, 0, 1.4], [18, -1.6, 0.4]], anim: A.throwB },
      'men:uthrow': { throw: 1, len: 40, rel: 20, dmg: 10, ang: 90, bkb: 60, kbg: 92, t: 'psychic', hold: [[0, 1, 0], [14, 0.2, 2.0], [20, 0.2, 2.4]], anim: A.throwU },
      'men:fthrow': { throw: 1, len: 32, rel: 12, dmg: 9, ang: 40, bkb: 62, kbg: 74, t: 'psychic', hold: [[0, 1, 0], [10, 1.8, 0.5]], anim: A.throwF },
      'men:dthrow': { throw: 1, len: 36, rel: 16, dmg: 7, ang: 80, bkb: 70, kbg: 40, t: 'psychic', hold: [[0, 1, 0], [12, 0.9, -0.1]], anim: A.throwD },
      // Pyroli : éjection
      'pyr:nspec': { len: 44, tick: breathTick, land: 'keep', grav: 0.4, anim: [[0, {}], [7, { hd: -10 }], [8, { hd: 10, lean: 6 }], [32, { hd: 15 }], [44, {}]] },
      'pyr:sspec': { len: 44, tick: flareTick, keepVel: 1, offEdge: 1, land: 'keep', drift: 0, ledge: 22, hits: [H(8, 24, 5, 6, 7, 16, 40, 55, 95, { t: 'fire', onHit: (S, a) => { a.percent = Math.min(999, a.percent + 3); } })], anim: [[0, { crouch: 0.5, glow: 1 }], [8, { lean: 30, tuck: 1, glow: 1 }], [24, { lean: 25, tuck: 1 }], [44, {}]] },
      'pyr:uspec': { len: 44, helpless: 1, landLag: 18, ledge: 14, tick: leapTick(2.9, 5, 22), drift: 0, noGrav: (af) => af >= 5 && af <= 22, hits: [H(5, 20, 0, 7, 7.5, 1.5, 90, 0, 0, { t: 'fire', rehit: 4, link: 1, hs: 10 }), H(23, 25, 0, 10, 8, 6, 80, 55, 92, { t: 'fire', g: 1 })], anim: [[0, { crouch: 0.5 }], [5, { rot: 0, tuck: 1 }], [22, { rot: 1080, tuck: 1 }], [44, { rot: 1080 }]] },
      // Aquali : projectiles + déplacements d'eau (le haut B reste disponible)
      'aqu:nspec': { len: 30, tick: wgunTick, land: 'keep', grav: 0.5, anim: [[0, {}], [7, { hd: -10, glow: 1 }], [8, { hd: -10, glow: 1 }], [9, { hd: 12, lean: -6 }], [30, {}]] },
      'aqu:sspec': { len: 30, tick: aquaJetTick, keepVel: 1, offEdge: 1, land: 'keep', drift: 0, noGrav: (af) => af >= 4 && af <= 13, ledge: 12, ledgeRising: 1, hits: [H(4, 12, 3, 6, 6, 7, 50, 50, 55, { t: 'water' })], anim: [[0, { crouch: 0.4 }], [4, { lean: 25, tuck: 0.5 }], [13, { lean: 15 }], [30, {}]] },
      'aqu:uspec': { len: 44, helpless: 1, landLag: 16, ledge: 13, tick: leapTick(3.2, 5, 20), drift: 0, noGrav: (af) => af >= 5 && af <= 20, hits: [H(5, 18, 0, 7, 7.5, 1.4, 90, 0, 0, { t: 'water', rehit: 4, link: 1, hs: 10 }), H(21, 23, 0, 11, 8, 6, 80, 55, 90, { t: 'water', g: 1 })], anim: [[0, { crouch: 0.5 }], [5, { lean: -45 }], [20, { lean: -35 }], [44, {}]] },
    });

  const PAL = (name, o) => Object.assign({ name }, o);
  G.registerChar({
    id: 'evoli', name: 'Évoli', short: 'Évoli', dex: 133, formDex: { vol: 135, pyr: 136, noc: 197, aqu: 134, men: 196 }, color: '#c08850', trail: '#fff0c0',
    desc: 'Bonus ! Maintiens bas B + direction pour évoluer : ↑ Voltali, → Pyroli, ↓ Noctali, ← Aquali, neutre Mentali. Chaque vie recommence en Évoli.',
    nameFor: (f) => FORMS[f.v.form] || 'Évoli',
    stats: { weight: 72, h: 12, w: 8, walk: 1.2, dash: 2.1, dashF: 12, run: 2.1, runAcc: 0.12, traction: 0.1, air: 1.1, airAcc: 0.08, grav: 0.095, fall: 1.6, ffall: 2.6, fullHop: 32, shortHop: 15, dJump: 30 },
    formStats: {
      vol: { weight: 78, h: 13, w: 8.5, walk: 1.4, dash: 2.5, run: 2.6, runAcc: 0.15, air: 1.26, airAcc: 0.1, grav: 0.105, fall: 1.9, ffall: 3.0, fullHop: 36, shortHop: 17, dJump: 33 },
      noc: { weight: 118, h: 13.5, w: 9, walk: 0.95, dash: 1.72, run: 1.62, runAcc: 0.09, air: 0.95, airAcc: 0.06, grav: 0.105, fall: 1.75, ffall: 2.8, fullHop: 29, shortHop: 14, dJump: 27 },
      men: { weight: 82, h: 13.5, w: 8.5, walk: 1.1, dash: 1.95, run: 1.9, air: 1.12, airAcc: 0.08, grav: 0.085, fall: 1.45, ffall: 2.3, fullHop: 32, shortHop: 15, dJump: 30, grabRange: 1.6 },
      pyr: { weight: 100, h: 13, w: 9.5, walk: 1.05, dash: 1.82, run: 1.76, air: 1.0, airAcc: 0.065, grav: 0.098, fall: 1.65, ffall: 2.64, fullHop: 31, shortHop: 15, dJump: 29 },
      aqu: { weight: 96, h: 13, w: 9.5, walk: 1.05, dash: 1.8, run: 1.75, air: 1.05, airAcc: 0.07, grav: 0.08, fall: 1.4, ffall: 2.25, fullHop: 32, shortHop: 15, dJump: 30 },
    },
    palettes: [
      PAL('Normal', { evo: ['#b8783c', '#f4e2b4', '#5a3418', '#4a2a14'], vol: ['#f2d23a', '#f7f4e8', '#9a7a10', '#1b1226'], noc: ['#26262e', '#f2d23a', '#111118', '#e0302a'], men: ['#d6a4df', '#e9c8ef', '#8a5a9a', '#6a2a8a'], pyr: ['#f07030', '#ffe08a', '#a0401a', '#1b1226'], aqu: ['#5ab4e8', '#f0f4f8', '#2a6a9a', '#1b1226'] }),
      PAL('Chromatique', { evo: ['#d8d8d8', '#fbf6e8', '#8a8a8a', '#3a2a14'], vol: ['#b8e04a', '#f7f4e8', '#6a8a1a', '#1b1226'], noc: ['#26262e', '#5ab4ff', '#111118', '#f2d23a'], men: ['#a8d88a', '#d8f0c8', '#5a8a3a', '#2a6a2a'], pyr: ['#e8c07a', '#fff4d0', '#9a7a3a', '#1b1226'], aqu: ['#c89ae8', '#f4ecfa', '#7a4a9a', '#1b1226'] }),
    ],
    init(f) { f.v.form = null; f.v.evoCd = 0; f.v.moonCd = 0; },
    passive(S, f) {
      if (f.v.evoCd > 0) f.v.evoCd--;
      if (f.v.moonCd > 0) f.v.moonCd--;
      if (f.grounded || f.action === 'ledge') { f.v.qa = 0; f.v.vs = 0; f.v.cr = 0; f.v.fb = 0; f.v.aj = 0; }
    },
    onKO(S, f) { f.v.form = null; f.v.evoCd = 0; },
    moves,
    pose(P, f) {
      if (f.action === 'move' && f.move === 'dspec' && f.af >= 7 && f.af <= 8) P.wheel = 1;
      if (f.action === 'move' && f.move === 'nair' && f.v.form === 'aqu' && f.af >= 3 && f.af <= 9) P.alpha = 0.35; // Acidarmure : liquéfiée
    },
    draw(ctx, P, pal, f, S, t) {
      const form = f.v.form || 'evo';
      const [body, fluff, dark, eye] = pal[form];
      const cr = P.crouch || 0, tu = P.tuck || 0;
      const st = G.ST(f);
      const k = st.h / 12;
      ctx.save();
      ctx.scale(k * (1 + cr * 0.08), k * (1 - cr * 0.25));
      const leg = (x, a, knee, col) => {
        const L = D.limb(ctx, x, 5.4, a, knee, 2.4, 2.3, 1.7, 1.3, col);
        D.ell(ctx, L.ex + 0.4, L.ey + 0.2, 1.0, 0.6, 0, col);
      };
      const aF = (P.aF - 12) * 0.7, aB = (P.aB + 10) * 0.7;
      const lF = U.lerp(P.lF * 0.8, 60, tu), lB = U.lerp(P.lB * 0.8, 40, tu);
      ctx.save(); ctx.translate(0, 6); ctx.rotate(-(P.lean || 0) * 0.5 * Math.PI / 180); ctx.translate(0, -6);
      // pattes arrière (côté éloigné)
      leg(-3.0, lB, 20, U.shade(body, -0.25));
      leg(2.6, aB, -10, U.shade(body, -0.25));
      // queue
      const tl = (P.tl || 0) + Math.sin(t * 5 + f.slot) * 8;
      ctx.save(); ctx.translate(-4.4, 7.2); ctx.rotate((20 + tl * 0.5) * Math.PI / 180);
      if (form === 'evo') { D.blob(ctx, [0, 0, -2.5, 2.5, -3.8, 5.5, -2.0, 6.8, 0.6, 4.2, 1.0, 1.2], D.lin(ctx, 0, 0, -2, 6, body, fluff)); }
      else if (form === 'vol') { D.poly(ctx, [0.4, 0.4, -2.4, 2.6, -1.2, 3.0, -3.2, 5.4, -1.0, 4.6, -1.4, 6.6, 0.8, 3.8, 1.2, 1.0], body); }
      else if (form === 'noc') { D.blob(ctx, [0.5, 0, -1.8, 2.4, -2.6, 5.4, -1.2, 6.2, 0.4, 3.8, 1.2, 1.0], body); D.ell(ctx, -1.2, 4.2, 1.0, 0.45, 20, fluff, true); }
      else if (form === 'men') { D.seg(ctx, 0, 0, -2.4, 4.4, 1.0, body, 0.8); D.seg(ctx, -2.4, 4.4, -3.8, 5.6, 0.7, body, 0.3); D.seg(ctx, -2.4, 4.4, -1.4, 6.0, 0.7, body, 0.3); }
      else if (form === 'pyr') { D.blob(ctx, [0.5, 0, -3.2, 2.4, -4.2, 6.4, -1.4, 7.4, 1.0, 4.4, 1.4, 1.0], fluff); }
      else if (form === 'aqu') { D.seg(ctx, 0, 0, -3.2, 2.2, 1.5, body, 1.0); D.poly(ctx, [-3.2, 2.2, -5.6, 4.4, -4.6, 1.4, -5.8, -0.6], fluff); }
      ctx.restore();
      // corps
      D.ell(ctx, 0, 6.8, 4.8, 2.9, 0, D.shade(ctx, 0, 6.8, 5, body));
      if (form === 'noc') { D.ell(ctx, -1.4, 7.6, 1.1, 0.55, 0, fluff, true); }
      // pattes avant (côté proche)
      leg(-2.2, lF, 20, body);
      leg(3.2, aF, -10, body);
      // collerette
      if (form === 'evo' || form === 'pyr') D.blob(ctx, [2.4, 9.4, 5.6, 9.2, 6.2, 7.0, 4.8, 5.6, 3.0, 6.2, 1.8, 7.8], fluff);
      if (form === 'vol') D.poly(ctx, [2.0, 9.0, 3.2, 10.4, 3.6, 9.2, 5.0, 10.4, 5.2, 8.8, 6.4, 9.2, 5.4, 6.8, 3.0, 6.6], fluff);
      if (form === 'aqu') D.blob(ctx, [2.4, 9.8, 5.4, 10.0, 6.2, 7.4, 4.4, 6.0, 2.8, 7.0], fluff);
      // tête
      ctx.save(); ctx.translate(5.4, 10.4); ctx.rotate(-(P.hd || 0) * Math.PI / 180);
      const earA = form === 'men' ? 1.25 : form === 'vol' ? 1.1 : 1;
      // oreilles
      const ear = (x, a, col) => { ctx.save(); ctx.translate(x, 1.4); ctx.rotate(a); if (form === 'aqu') D.poly(ctx, [0, 0, -1.8 * earA, 3.4, 0.8, 1.2], fluff); else { D.poly(ctx, [-0.9, 0, -0.2 * earA, 4.6 * earA, 1.1, 0.2], col); if (form === 'noc') D.ell(ctx, -0.1, 2.6, 0.5, 0.8, 0, fluff, true); if (form === 'evo') D.poly(ctx, [-0.35, 3.5 * earA, -0.2 * earA, 4.6 * earA, 0.2, 3.6 * earA], dark, true); } ctx.restore(); };
      ear(-1.2, 0.35, U.shade(body, -0.15));
      ear(0.4, -0.1, body);
      D.circ(ctx, 0, 0, 2.6, D.shade(ctx, 0, 0, 2.6, body));
      D.ell(ctx, 2.0, -0.7, 1.2, 0.9, 0, body);
      if (form === 'pyr') D.blob(ctx, [-1.6, 2.0, -0.4, 3.6, 1.4, 2.4, 0.6, 1.6], fluff);
      if (form === 'men') D.circ(ctx, 1.6, 1.4, 0.45, '#e02a4a');
      if (form === 'noc') D.ell(ctx, 1.2, 1.5, 0.8, 0.4, 0, fluff, true);
      ctx.fillStyle = '#1b1226'; ctx.beginPath(); ctx.arc(3.1, -0.5, 0.28, 0, 7); ctx.fill();
      const ex = P.eye;
      if (ex === 2 || ex === 3) D.eye(ctx, 1.1, 0.3, 0.8, ex);
      else { D.ell(ctx, 1.1, 0.3, 0.65, 0.85, 0, '#fff'); D.ell(ctx, 1.3, 0.25, 0.45, 0.62, 0, eye, true); D.circ(ctx, 1.4, 0.45, 0.16, '#fff', true); if (ex === 1) { ctx.strokeStyle = D.OL; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(0.4, 1.2); ctx.lineTo(1.8, 0.9); ctx.stroke(); } }
      ctx.restore();
      ctx.restore();
      if (P.glow) { ctx.fillStyle = `rgba(255,255,220,${0.25 + 0.2 * Math.sin(t * 25)})`; ctx.beginPath(); ctx.ellipse(1, 7, 7, 5, 0, 0, 7); ctx.fill(); }
      ctx.restore();
    },
    drawFx(ctx, f, S, t) {
      // roue des évolutions
      if (f.action === 'move' && f.move === 'dspec' && f.af >= 7 && f.af <= 8) {
        const st = G.ST(f), cx = f.x, cy = f.y + st.h * 0.6, R = 16;
        const items = [['vol', 0, 1, '#f2d23a', 'V'], ['noc', 0, -1, '#3a3a48', 'N'], ['pyr', f.facing, 0, '#f07030', 'P'], ['aqu', -f.facing, 0, '#5ab4e8', 'A'], ['men', 0, 0, '#d6a4df', 'M']];
        for (const [id, dx, dy, col, l] of items) {
          const x = cx + dx * R, y = cy + dy * R, on = f.mv.pick === id;
          ctx.fillStyle = col; ctx.globalAlpha = on ? 1 : 0.55; ctx.beginPath(); ctx.arc(x, y, on ? 4.6 : 3.4, 0, 7); ctx.fill();
          ctx.lineWidth = on ? 0.8 : 0.4; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.globalAlpha = 1;
          ctx.save(); ctx.translate(x, y); ctx.scale(0.3, -0.3); ctx.fillStyle = '#fff'; ctx.font = '900 12px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l, 0, 0); ctx.restore();
        }
      }
      if (f.action === 'move' && f.v.form === 'noc' && f.move === 'nspec' && f.af >= 11 && f.af <= 18) {
        const st = G.ST(f), k = (f.af - 11) / 7;
        ctx.strokeStyle = `rgba(120,60,200,${0.8 * (1 - k)})`; ctx.lineWidth = 1.4 * (1 - k) + 0.2;
        ctx.beginPath(); ctx.arc(f.x, f.y + st.h * 0.5, 6 + k * 10, 0, 7); ctx.stroke();
      }
      if (f.action === 'move' && f.v.form === 'men' && f.move === 'sspec' && f.af >= 8 && f.af <= 14) {
        const st = G.ST(f), k = (f.af - 8) / 6;
        ctx.strokeStyle = `rgba(230,120,255,${0.8 * (1 - k)})`; ctx.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(f.x + f.facing * (6 + k * 8), f.y + st.h * 0.5, 3 + i * 2.5 + k * 3, -1.2, 1.2); ctx.stroke(); }
      }
    },
    fx(e, R) {
      if (e.evo) { R.parts.push({ ty: 'ring', x: e.x, y: e.y + 7, life: 24, max: 24, size: 16, col: '#ffffff' }); R.spark(e.x, e.y + 7, '#fff8c0', 20, 3); }
      if (e.bub) R.parts.push({ ty: 'bubble', x: e.x + (Math.random() - 0.5) * 4, y: e.y + (Math.random() - 0.5) * 4, vx: 0, vy: 0.3, life: 24, max: 24, size: 0.8 + Math.random() });
      if (e.flame) for (let i = 0; i < 3; i++) R.parts.push({ ty: 'flame', x: e.x, y: e.y, vx: e.dx * (1.4 + Math.random()), vy: (Math.random() - 0.5) * 0.6, life: 12, max: 12, size: 1.6, col: Math.random() < 0.5 ? 'rgba(255,200,60,0.85)' : 'rgba(255,90,30,0.85)' });
      if (e.pulse) R.cam.shake = Math.max(R.cam.shake, 4);
      if (e.bolt) { // Tonnerre : éclair sous Voltali
        R.parts.push({ ty: 'custom', x: e.x, y: e.y, life: 10, max: 10, draw(ctx, p, k) {
          ctx.strokeStyle = `rgba(255,240,90,${k})`; ctx.lineWidth = 1.4 * k + 0.3; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y + 4); for (let i = 1; i <= 6; i++) ctx.lineTo(p.x + (i % 2 ? 2.5 : -2.5), p.y + 4 - i * 5); ctx.stroke();
        } });
        R.cam.shake = Math.max(R.cam.shake, 3);
      }
      if (e.puff) for (let i = 0; i < 10; i++) R.parts.push({ ty: 'flame', x: e.x + (Math.random() - 0.5) * 4, y: e.y + 12, vx: (Math.random() - 0.5) * 0.8, vy: 1 + Math.random() * 1.2, life: 16, max: 16, size: 1.6, col: Math.random() < 0.5 ? 'rgba(255,200,60,0.85)' : 'rgba(255,90,30,0.85)' });
      if (e.cascade) for (let i = 0; i < 10; i++) R.parts.push({ ty: 'bubble', x: e.x + (Math.random() - 0.5) * 5, y: e.y - Math.random() * 14, vx: 0, vy: -0.6, life: 20, max: 20, size: 0.8 + Math.random() });
      if (e.psyAt) { R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 14, max: 14, size: 9, col: '#e67aff' }); R.parts.push({ ty: 'ring', x: e.x, y: e.y, life: 20, max: 20, size: 5, col: '#ffffff' }); }
      if (e.rings) R.parts.push({ ty: 'ring', x: e.x, y: e.y + 6, life: 16, max: 16, size: 12, col: '#f2d23a' });
      if (e.moon) { R.parts.push({ ty: 'ring', x: e.x, y: e.y + 7, life: 30, max: 30, size: 14, col: '#fff6b0' }); R.spark(e.x, e.y + 10, '#fff6b0', 14, 1.6); }
    },
    hud(ctx, f, S, x, y, pw, ph, u) {
      if (f.v.evoCd > 0) { ctx.fillStyle = '#fff0c0'; ctx.font = `900 ${10 * u}px Rubik, sans-serif`; ctx.textAlign = 'left'; ctx.fillText('ÉVOLUTION ' + Math.ceil(f.v.evoCd / 60) + 's', x + ph + 2 * u, y + 43 * u); }
    },
  });
  void E;
})(window.G);
