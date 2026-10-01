'use strict';
// MOTISMA — le fantôme électrique qui POSSÈDE les appareils.
// Bas B maintenu + direction = il entre dans un appareil (choisir sa forme actuelle = il en ressort) :
//   neutre = Micro-ondes (Chaleur), ↑ = Ventilateur (Hélice), ↓ = Frigo (Froid), → = Tondeuse (Tonte),
//   ← = Machine à laver (Lavage). Quand il quitte un appareil, il l'éjecte devant lui (l'appareil vide fait mal).
// Chaque forme a ses stats, son B neutre et quelques coups à elle :
//   Motisma    : Change Éclair (s'il touche, il se téléporte derrière l'adversaire), très flottant, 3 sauts.
//   Chaleur    : Surchauffe (B maintenu : explosion autour de lui, il encaisse un peu), Four (smash avant), plaque chauffante.
//   Lavage     : Essorage (saisie : l'adversaire tourne dans le tambour, puis Hydrocanon dans la direction du stick).
//   Froid      : Blizzard (gèle), Chute de Frigo (bas en l'air façon Thwomp), porte de frigo (smash avant). Lourd.
//   Hélice     : Bourrasque (B maintenu : vent sans dégâts qui pousse adversaires et projectiles), hélice, haut B plané.
//   Tonte      : Coupe-Herbe (B maintenu : le moteur monte en régime, puis il fonce en coupant), le plus rapide au sol.
(function (G) {
  const U = G.U, D = G.D, H = G.H, A = G.A;
  const RAD = Math.PI / 180;
  const E = (o) => Object.assign({ t: 'elec' }, o || {});
  const F = (o) => Object.assign({ t: 'fire', burn: 120 }, o || {});
  const W = (o) => Object.assign({ t: 'water' }, o || {});
  const I = (o) => Object.assign({ t: 'ice' }, o || {});
  const Gr = (o) => Object.assign({ t: 'grass' }, o || {});
  const FORMS = { heat: 'Motisma Chaleur', wash: 'Motisma Lavage', frost: 'Motisma Froid', fan: 'Motisma Hélice', mow: 'Motisma Tonte' };
  const POSS_CD = 150;
  const PALS = [
    { name: 'Normal', body: '#ff7a2a', body2: '#ffc04a', aura: '#7ae8ff', eye: '#45c8ff', heat: '#e8452c', wash: '#2f8ad8', frost: '#e8f4fb', fan: '#8a5ad8', mow: '#3cae4a', trim: '#2a2a3a' },
    { name: 'Chromatique', body: '#3ab0e8', body2: '#9ae4ff', aura: '#ffe066', eye: '#ffb02a', heat: '#f0a030', wash: '#e05aa0', frost: '#d4ecb0', fan: '#e0a0e8', mow: '#e8c840', trim: '#2a2a3a' },
  ];
  const PAL = (f) => PALS[(f.pal || 0) % PALS.length];

  // ---------- Bas B : Possession ----------
  function pickDir(f, inp) {
    const ax = Math.abs(inp.sx), ay = Math.abs(inp.sy);
    if (ax < 0.4 && ay < 0.4) return 'heat';
    if (ay >= ax) return inp.sy > 0 ? 'fan' : 'frost';
    return inp.sx * f.facing > 0 ? 'mow' : 'wash';
  }
  function possessTick(S, f, af, inp) {
    if (af === 1) { f.mv.pick = 'heat'; f.mv.hold = 0; G.sfx(S, f, 'ghost'); }
    if (!f.grounded) { f.vy = Math.max(f.vy, -0.4); f.vx *= 0.94; }
    if (af === 8 && inp.held(G.BTN.SPC) && f.mv.hold < 90) { f.mv.pick = pickDir(f, inp); f.mv.hold++; f.af = 7; return; }
    if (af === 20) {
      const old = f.v.form;
      const next = f.mv.pick === old ? null : f.mv.pick; // choisir sa forme actuelle = il sort de l'appareil
      if (old) ejectShell(S, f, old);
      f.v.form = next; f.v.possCd = POSS_CD; f.flash = 12;
      G.sfx(S, f, 'transform', { poss: 1 });
    }
  }
  // L'appareil quitté est éjecté devant lui : il fait mal tant qu'il vole, puis reste un instant au sol
  function ejectShell(S, f, kind) {
    const st = G.ST(f);
    G.spawnProj(S, f, 'rshell', {
      x: f.x + f.facing * 3, y: f.y + st.h * 0.45, vx: f.facing * 1.9, vy: 1.7, grav: 0.1, r: 5, life: 75,
      dmg: 7, ang: 45, bkb: 40, kbg: 55, t: 'normal', v: { kind, rot: 0, land: 0, col: PAL(f)[kind] },
    });
  }
  G.PROJ.rshell = {
    tick(S, p) {
      const v = p.v;
      if (v.land) { p.vx *= 0.85; p.vy = 0; p.grav = 0; p.harmless = true; return; }
      v.rot += p.vx * 6;
      const m = S.stage.main, ny = p.y + p.vy - p.grav, bot = p.r * 0.6;
      if (p.x > m.l && p.x < m.r && p.y - bot >= m.y - 0.5 && ny - bot <= m.y) {
        v.land = 1; p.y = m.y + bot; p.vy = 0; p.grav = 0; v.rot = 0;
        S.events.push({ t: 'land', s: p.owner, x: p.x, y: m.y, k: 'rs' + p.id });
      }
    },
    onStage(S, p) { p.dead = true; S.events.push({ t: 'poof', x: p.x, y: p.y, k: 'rsp' + p.id }); },
    draw(ctx, p) {
      ctx.globalAlpha = Math.min(1, p.life / 15);
      ctx.translate(0, -p.r * 0.6); ctx.rotate(-p.v.rot * RAD); ctx.scale(0.62, 0.62);
      drawAppliance(ctx, p.v.kind, { heat: p.v.col, wash: p.v.col, frost: p.v.col, fan: p.v.col, mow: p.v.col, trim: '#2a2a3a' }, null, 0, true);
      ctx.globalAlpha = 1;
    },
  };

  // ---------- B neutre (Motisma) : Change Éclair ----------
  // Un éclair rapide. S'il touche, Motisma se téléporte DERRIÈRE l'adversaire (qui est un peu soulevé) : de quoi
  // enchaîner ; et sa recharge de possession est remise à zéro (il peut entrer tout de suite dans un appareil).
  const BOLT_CD = 50;
  G.PROJ.vbolt = {
    onHit(S, p, t, res) {
      if (res !== 'hit') return;
      const o = S.fighters[p.owner];
      if (!o || o.dead || o.out || o.char !== 'motisma' || o.v.form || o.grabbedBy >= 0 || o.action === 'hit') return;
      const side = t.x >= o.x ? 1 : -1;
      o.x = t.x + side * (G.ST(t).w * 0.5 + 5); o.y = t.y + 2; o.facing = -side; o.vx = 0; o.vy = 0.6;
      o.grounded = false; o.plat = null; G.setAction(o, 'air');
      o.intang = Math.max(o.intang, 8); o.v.possCd = 0;
      S.events.push({ t: 'sfx', name: 'tick', s: o.slot, x: o.x, y: o.y, zap: 1, k: 'vz' + p.id });
    },
    draw(ctx, p, t) {
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(120,220,255,0.55)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-6, 1.4); ctx.lineTo(-3, -1.2); ctx.lineTo(0, 1.1); ctx.lineTo(3, 0); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.fillStyle = '#fff8b0'; ctx.beginPath(); ctx.arc(3, 0, 1.4 + Math.sin(t * 40) * 0.2, 0, 7); ctx.fill();
    },
  };
  function boltTick(S, f, af) {
    if (af === 7) {
      const st = G.ST(f);
      G.spawnProj(S, f, 'vbolt', { x: f.x + f.facing * 6, y: f.y + st.h * 0.55, vx: f.facing * 5, vy: 0, r: 2.6, life: 22, dmg: 7, ang: 80, bkb: 42, kbg: 40, t: 'elec' });
      f.v.boltCd = BOLT_CD; G.sfx(S, f, 'tick');
    }
  }

  // ---------- Côté B (toutes les formes) : Plasma, un éclair qui fonce ----------
  function plasmaTick(S, f, af) {
    if (af === 1) { if (!f.grounded) { if (f.v.plasma) { G.setAction(f, 'air'); return 'stop'; } f.v.plasma = 1; } G.sfx(S, f, 'dash'); }
    if (af >= 5 && af <= 12) { f.vx = f.facing * 4.4; if (!f.grounded) f.vy = 0; }
    else if (af === 13) f.vx *= 0.3;
  }
  // ---------- Haut B : Lévitation ----------
  // Pas de chute libre : après le haut B, il peut faire UN coup (aérien ou spécial), puis il tombe en chute libre.
  // Plus de saut ni d'esquive après, et un seul haut B par saut.
  const upbCond = (S, f) => f.grounded || !f.v.upbUsed;
  function upbEnd(S, f) { if (!f.grounded) { f.v.oneAtk = 1; f.jumps = G.ST(f).jumps; f.airdodged = true; } }
  function levitateTick(S, f, af, inp) {
    if (af === 5) f.v.upbUsed = 1; // (après avoir quitté le sol, sinon le passif le remet à zéro)
    if (af === 4) { f.grounded = false; f.plat = null; G.sfx(S, f, 'tick'); }
    if (af >= 4 && af <= 20) { f.vy = 3.1 - (af - 4) * 0.03; f.vx = U.approach(f.vx, inp.sx * 1.0, 0.1); }
  }
  // Hélice : le ventilateur monte plus haut puis plane
  function fanLiftTick(S, f, af, inp) {
    if (af === 5) f.v.upbUsed = 1; // (après avoir quitté le sol, sinon le passif le remet à zéro)
    if (af === 4) { f.grounded = false; f.plat = null; G.sfx(S, f, 'swing'); }
    if (af >= 4 && af <= 24) { f.vy = 3.3 - (af - 4) * 0.02; f.vx = U.approach(f.vx, inp.sx * 1.15, 0.12); }
    if (af > 24) { f.vy = Math.max(f.vy, -0.75); f.vx = U.approach(f.vx, inp.sx * 1.2, 0.06); }
  }

  // ---------- Chaleur : Surchauffe ----------
  const HEAT_MAX = 50, HEAT_SELF = 0.8; // recul seulement à partir de 80 % de charge
  function heatTick(S, f, af, inp) {
    if (af === 1) f.mv.c = 0;
    if (!f.grounded) f.vy = Math.max(f.vy, -0.5);
    if (af === 6 && inp.held(G.BTN.SPC) && f.mv.c < HEAT_MAX) { f.mv.c++; f.af = 5; if (f.mv.c % 10 === 0) G.sfx(S, f, 'fire'); return; }
    if (af === 7) {
      const c = f.mv.c, st = G.ST(f), k = c / HEAT_MAX, k2 = k * k;
      // sans charge : tue déjà à hauts % ; plus il charge, plus l'éjection devient énorme
      G.spawnEcho(S, f, { x: 0, y: st.h * 0.5, r: 12 + k * 6, delay: 0, dur: 4, dmg: 11 + k * 5, ang: 55, bkb: 55 + k2 * 10, kbg: 100 + k2 * 35, t: 'fire', style: 'orb', col: '#ff7a2a', sfx: 'hammer', extra: { burn: 120, away: true } });
      if (k >= HEAT_SELF) { // presque à fond : il surchauffe et encaisse
        const self = 8; f.percent = Math.min(999, f.percent + self); f.stat.taken += self; f.flash = 8;
      }
      S.events.push({ t: 'sfx', name: 'hammer', s: f.slot, x: f.x, y: f.y + st.h * 0.5, boom: 1 + k, k: 'hb' + f.slot + '_' + S.frame });
      if (!f.grounded) f.vy = Math.max(f.vy, 1.2);
    }
  }

  // ---------- Lavage : Essorage (saisie -> tambour -> Hydrocanon orienté au stick) ----------
  function washGrab(S, a, t) {
    a.grabbing = t.slot; t.grabbedBy = a.slot;
    G.setAction(t, 'thrown'); t.vx = t.vy = t.kbx = t.kby = 0; t.hitstun = 0; t.ff = false;
    t.v.invis = 0.001; t.v.washBy = a.slot; // il disparaît dans le tambour (on le voit tourner dans le hublot)
    G.startMove(S, a, 'washSpin');
    G.sfx(S, a, 'grab');
  }
  function washSpinTick(S, f, af, inp) {
    if (f.mv.shot) return; // jet tiré : temps de récupération
    const v = S.fighters[f.grabbing];
    if (!v || v.grabbedBy !== f.slot) { f.grabbing = -1; G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; }
    v.action = 'thrown';
    if (af === 1) { f.mv.aim = f.facing > 0 ? 25 : 155; G.sfx(S, f, 'water'); }
    const m = U.len(inp.sx, inp.sy);
    if (m > 0.5) f.mv.aim = U.datan2(inp.sy, inp.sx); // on vise au stick (360°)
    if (af >= 6 && af <= 30 && af % 8 === 6) { // l'essorage
      const d = 1.2 * S.dmgMul; v.percent = Math.min(999, v.percent + d); v.stat.taken += d; f.stat.dmg += d; v.flash = 3;
      S.events.push({ t: 'hit', s: f.slot, tg: v.slot, x: f.x, y: f.y + G.ST(f).h * 0.5, dmg: d, kb: 5, ht: 'water', k: 'ws' + f.slot + '_' + S.frame });
    }
    if (af >= 40 || (af >= 20 && f.buf.b)) { // HYDROCANON
      f.buf.b = 0;
      const dmg = 9 * S.dmgMul, ang = f.mv.aim;
      v.percent = Math.min(999, v.percent + dmg); v.stat.taken += dmg; f.stat.dmg += dmg;
      const kb = G.knockback(v.percent, dmg, G.ST(v).weight, 74, 52);
      f.grabbing = -1; v.grabbedBy = -1; v.v.invis = 0; v.v.washBy = -1;
      const st = G.ST(f);
      v.x = f.x + U.dcos(ang) * (st.w * 0.6 + 4); v.y = f.y + st.h * 0.3 + Math.max(0, U.dsin(ang)) * 4;
      G.launch(S, v, kb, { ang }, 1, f);
      v.hitlag = 6; f.hitlag = 6;
      if (Math.abs(U.dcos(ang)) > 0.2) f.facing = U.dcos(ang) > 0 ? 1 : -1;
      S.events.push({ t: 'hit', s: f.slot, tg: v.slot, x: v.x, y: v.y + 6, dmg, kb, ht: 'water', k: 'wh' + f.slot + '_' + S.frame });
      S.events.push({ t: 'sfx', name: 'water', s: f.slot, x: f.x, y: f.y, jet: 1, ang, k: 'wj' + f.slot + '_' + S.frame });
      f.mv.shot = af; f.af = 44;
    }
  }

  // ---------- Froid : Blizzard (gèle) et Chute de Frigo ----------
  function fridgeTick(S, f, af, inp) {
    const st = G.ST(f);
    if (af < 6) { f.vy = Math.max(f.vy, 0.25); f.vx *= 0.85; return; }
    if (af === 6) G.sfx(S, f, 'swing');
    f.vy = -4.4; f.ff = false; f.vx = U.approach(f.vx, 0, 0.05);
    if (af > 18 && f.buf.j && f.jumps < st.jumps) { // on peut l'annuler en sautant (sinon, hors du terrain, c'est la chute)
      f.buf.j = 0; f.jumps++; f.vy = Math.sqrt(2 * st.grav * st.dJump); G.setAction(f, 'air');
      S.events.push({ t: 'djump', s: f.slot, x: f.x, y: f.y, k: 'dj' + f.slot + '_' + S.frame });
      return 'stop';
    }
    if (af > 18 && f.buf.b && G.airAct(S, f, inp, st)) return 'stop'; // ... ou avec n'importe quel spécial (haut B, B, côté B, bas B)
  }
  function fridgeLand(S, f) {
    if (!f.mv.hit) G.spawnEcho(S, f, { x: 0, y: 3, r: 14, delay: 0, dur: 4, dmg: 10, ang: 65, bkb: 55, kbg: 84, t: 'ice', style: 'ring', col: '#bfefff', sfx: 'hammer', extra: { away: true } });
    S.events.push({ t: 'thud', s: f.slot, x: f.x, y: f.y, k: 'fl' + f.slot + '_' + S.frame });
    S.events.push({ t: 'sfx', name: '', s: f.slot, x: f.x, y: f.y, frost: 1, k: 'flf' + f.slot + '_' + S.frame });
    f.lag = 20; G.setAction(f, 'lag');
  }

  // ---------- Hélice : Bourrasque (vent sans dégâts) ----------
  // B lance le vent ; tant que B est maintenu (2 s max), le ventilateur souffle devant lui pendant qu'il se déplace,
  // saute ou descend des plateformes. Attaquer, se protéger ou être touché coupe le vent.
  const GUST_T = 120, GUST_CD = 45, GUST_R = 100;
  const GUST_OK = { idle: 1, walk: 1, dash: 1, run: 1, brake: 1, turn: 1, crouch: 1, jsq: 1, air: 1, land: 1, lag: 1 };
  function gustStart(S, f, af) { if (af === 2) { f.v.gustT = GUST_T; G.sfx(S, f, 'swing'); } }
  function gustUpdate(S, f, inp) {
    if (!(f.v.gustT > 0)) return;
    const ok = f.v.form === 'fan' && !f.dead && inp.held(G.BTN.SPC) && (GUST_OK[f.action] || (f.action === 'move' && f.move === 'nspec'));
    if (!ok || --f.v.gustT <= 0) { f.v.gustT = 0; f.v.gustCd = GUST_CD; return; }
    const st = G.ST(f), cx = f.x, cy = f.y + st.h * 0.55;
    for (const t of S.fighters) {
      if (t === f || t.dead || t.out || t.invinc > 0 || t.intang > 0 || t.grabbedBy >= 0 || t.action === 'ledge' || t.action === 'respawn') continue;
      if (S.teams && t.team === f.team) continue;
      const dx = (t.x - cx) * f.facing, dy = t.y + G.ST(t).h * 0.5 - cy;
      if (dx < -3 || dx > GUST_R || Math.abs(dy) > 14 + dx * 0.3) continue;
      t.x += f.facing * (3.4 - 2.0 * dx / GUST_R); // pousse très fort, sans frapper
      if (t.grounded) { const sf = G.surf(S, t.plat); if (sf && (t.x < sf.l || t.x > sf.r)) G.goAir(S, t); } // poussé au-delà du bord : il tombe
    }
    for (const p of S.projs) { // dévie les projectiles
      if (p.owner === f.slot || p.ghost) continue;
      const dx = (p.x - cx) * f.facing, dy = p.y - cy;
      if (dx < 0 || dx > GUST_R || Math.abs(dy) > 14 + dx * 0.3) continue;
      p.vx += f.facing * 0.3;
    }
    if (f.v.gustT % 12 === 0) G.sfx(S, f, 'swing');
  }

  // ---------- Tonte : Coupe-Herbe (le moteur monte en régime, puis il fonce) ----------
  const MOW_MAX = 60;
  function mowStore(S, f) { // garde la charge pour plus tard (comme un coup chargé de DK)
    f.v.mowStore = f.mv.c; G.sfx(S, f, 'tick');
  }
  // Charge façon DK : un appui sur B = le moteur monte en régime TOUT SEUL ; B à nouveau = il fonce (B B = départ
  // immédiat). Charge pleine = stockée automatiquement. Saut, bouclier, roulade, esquive (au sol ou en l'air) :
  // la charge est gardée pour le prochain B. Stick dans l'autre sens pendant la charge = il se retourne.
  function mowTick(S, f, af, inp) {
    const st = G.ST(f);
    if (af === 1) {
      f.mv.c = f.v.mowStore || 0; f.v.mowStore = 0; // reprend la charge stockée
      f.mv.go = f.mv.c >= MOW_MAX ? 1 : 0; // charge pleine en réserve : il part tout de suite
      if (!f.grounded) { if (f.v.mowAir) { f.v.mowStore = f.mv.c; G.setAction(f, 'air'); return 'stop'; } f.v.mowAir = 1; }
    }
    if (af < 6) { if (f.buf.b) { f.buf.b = 0; f.mv.go = 1; } f.vx = U.approach(f.vx, 0, 0.2); if (!f.grounded) f.vy = Math.max(f.vy, -0.4); return; } // B B rapide : départ direct
    if (af === 6 && !f.mv.go) {
      if (inp.sx * f.facing < -0.5) f.facing = -f.facing;
      if (f.buf.j) { // saut : on garde la charge
        f.buf.j = 0; mowStore(S, f);
        if (f.grounded) { G.setAction(f, 'jsq'); f.jsqSrc = 1; return 'stop'; }
        if (f.jumps < st.jumps) { f.jumps++; f.vy = Math.sqrt(2 * st.grav * st.dJump); f.ff = false; S.events.push({ t: 'djump', s: f.slot, x: f.x, y: f.y, k: 'dj' + f.slot + '_' + S.frame }); }
        G.setAction(f, 'air'); return 'stop';
      }
      if (f.buf.s) { // bouclier / roulade / esquive sur place / esquive aérienne : on garde la charge
        mowStore(S, f);
        if (!f.grounded) { G.setAction(f, 'air'); G.airAct(S, f, inp, st); return 'stop'; }
        f.buf.s = 0;
        if (Math.abs(inp.sx) >= 0.6) { G.setAction(f, 'roll'); f.mv = { d: inp.sx > 0 ? 1 : -1 }; }
        else if (inp.sy <= -0.6) G.setAction(f, 'spot');
        else G.setAction(f, 'shield');
        return 'stop';
      }
      if (f.buf.b) { f.buf.b = 0; f.mv.go = 1; } // B à nouveau : il fonce
      else {
        f.mv.c++;
        if (f.mv.c % 8 === 0) G.sfx(S, f, 'buzz');
        if (f.mv.c >= MOW_MAX) { // plein régime : stocké automatiquement
          f.v.mowStore = MOW_MAX; f.flash = 8; G.sfx(S, f, 'magic');
          G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop';
        }
        f.af = 5; f.vx = U.approach(f.vx, 0, 0.2); if (!f.grounded) f.vy = Math.max(f.vy, -0.4);
        return;
      }
    }
    const c = f.mv.c, k = c / MOW_MAX;
    if (af === 6) { f.mv.dur = Math.round(14 + c * 0.2); f.mv.sp = 3.0 + k * 1.2; G.sfx(S, f, 'dash'); }
    const end = 7 + f.mv.dur;
    if (af >= 7 && af < end) {
      f.vx = f.facing * f.mv.sp; if (!f.grounded) f.vy = 0;
      G.pendingHitbox(S, f, { x: 7, y: 3, r: 5.5, dmg: 1.2, ang: 40, bkb: 0, kbg: 0, t: 'grass', rehit: 4, link: 1, hs: 8, noTrail: 1 });
    }
    if (af === end || af === end + 1) { // coup final : pleine charge = il tue
      const k2 = k * k;
      G.pendingHitbox(S, f, { x: 8, y: 4, r: 7, dmg: 4 + k * 8, ang: 40, bkb: 45 + k2 * 11, kbg: 60 + k2 * 31, t: 'grass', g: 1 });
    }
    if (af > end) { f.vx = U.approach(f.vx, 0, 0.25); if (af >= end + 18) { G.setAction(f, f.grounded ? 'idle' : 'air'); return 'stop'; } }
  }

  // ---------- Dessin ----------
  // Bras d'éclair (zigzag) : angle en degrés (0 = vers le bas, 90 = devant, 180 = vers le haut)
  function zigArm(ctx, x, y, a, len, col, t, ph) {
    const [dx, dy] = D.dir(a), nx = -dy, ny = dx;
    const pts = [];
    for (let i = 0; i <= 4; i++) { const k = i / 4, w = (i % 2 ? 1 : -1) * (i > 0 && i < 4 ? 0.9 : 0) + Math.sin(t * 30 + ph + i) * 0.15; pts.push(x + dx * len * k + nx * w, y + dy * len * k + ny * w); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = U.rgb(U.hex(col), 0.45); ctx.lineWidth = 1.6; ctx.beginPath(); for (let i = 0; i < pts.length; i += 2) { if (i) ctx.lineTo(pts[i], pts[i + 1]); else ctx.moveTo(pts[i], pts[i + 1]); } ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.5; ctx.stroke();
    const ex = pts[8], ey = pts[9]; // petite fourche au bout
    ctx.strokeStyle = col; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + dx * 1.2 + nx * 0.9, ey + dy * 1.2 + ny * 0.9); ctx.moveTo(ex, ey); ctx.lineTo(ex + dx * 1.2 - nx * 0.9, ey + dy * 1.2 - ny * 0.9); ctx.stroke();
  }
  // Yeux de Motisma (bleus, en amande) et sourire en zigzag
  function face(ctx, x, y, s, c, ex, mouth) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (ex === 3) { ctx.strokeStyle = c.eye; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(-0.9, 0, 0.7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.beginPath(); ctx.arc(1.1, 0, 0.7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else {
      for (const [ox, sc] of [[-0.9, 0.9], [1.1, 1]]) {
        D.ell(ctx, ox, 0, 0.75 * sc, 1.05 * sc, -12, '#f4fbff');
        D.ell(ctx, ox + 0.15, -0.05, 0.55 * sc, 0.8 * sc, -12, c.eye, true);
        D.circ(ctx, ox + 0.25, -0.05, 0.25 * sc, '#10203a', true);
        D.circ(ctx, ox + 0.05, 0.3, 0.15 * sc, '#ffffff', true);
      }
      if (ex === 1) { ctx.strokeStyle = D.OL; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(-1.6, 1.1); ctx.lineTo(-0.3, 0.8); ctx.moveTo(0.5, 0.8); ctx.lineTo(1.9, 1.15); ctx.stroke(); }
    }
    if (mouth !== false) {
      ctx.fillStyle = '#1b1226'; ctx.beginPath(); ctx.moveTo(-1.2, -1.4);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-1.2 + i * 0.45, -1.4 - (i % 2 ? 0.45 : 0));
      ctx.lineTo(1.5, -1.9); ctx.quadraticCurveTo(0.2, -2.6, -1.0, -1.9); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // Les appareils (corps des formes). empty = appareil vide éjecté (sans visage)
  function drawAppliance(ctx, kind, c, P, t, empty) {
    const OL = D.OL;
    if (kind === 'heat') { // micro-ondes
      ctx.fillStyle = D.lin(ctx, 0, 10.5, 0, 1, U.shade(c.heat, 0.15), U.shade(c.heat, -0.25));
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-5.2, 1, 10.4, 9.6, 1.4) : ctx.rect(-5.2, 1, 10.4, 9.6); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = D.LW; ctx.stroke();
      D.poly(ctx, [-4.2, 2.2, 1.6, 2.2, 1.6, 9.2, -4.2, 9.2], empty ? '#3a2a2a' : '#2a1a1e'); // porte vitrée
      ctx.fillStyle = 'rgba(255,190,120,0.18)'; ctx.fillRect(-3.8, 6.8, 2.2, 2);
      D.poly(ctx, [2.4, 2.2, 4.4, 2.2, 4.4, 9.2, 2.4, 9.2], U.shade(c.heat, -0.4)); // panneau
      for (let i = 0; i < 3; i++) D.circ(ctx, 3.4, 8 - i * 1.6, 0.42, i === 0 ? '#ffd23a' : '#d8d8d8', true);
      if (!empty) face(ctx, -1.3, 6.2, 1.05, c, P && P.eye, true);
    } else if (kind === 'wash') { // machine à laver
      ctx.fillStyle = D.lin(ctx, 0, 12.4, 0, 0.6, U.shade(c.wash, 0.25), U.shade(c.wash, -0.2));
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-5.2, 0.6, 10.4, 11.8, 1.2) : ctx.rect(-5.2, 0.6, 10.4, 11.8); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = D.LW; ctx.stroke();
      D.poly(ctx, [-5.2, 10.4, 5.2, 10.4, 5.2, 12.4, -5.2, 12.4], U.shade(c.wash, -0.3));
      D.circ(ctx, 3.6, 11.4, 0.45, '#ffd23a', true); D.circ(ctx, 2.3, 11.4, 0.45, '#f4f4f4', true);
      D.circ(ctx, 0.3, 5.6, 4.0, '#dfe8f0'); // hublot
      D.circ(ctx, 0.3, 5.6, 3.1, empty ? '#3a5a78' : '#14304a', true);
      if (!empty) face(ctx, 0.2, 6.0, 0.95, c, P && P.eye, true);
      // tuyau
      ctx.strokeStyle = U.shade(c.wash, -0.35); ctx.lineWidth = 0.9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-4.4, 12.2); ctx.quadraticCurveTo(-7.6, 14.2, -6.6, 9.4); ctx.stroke();
    } else if (kind === 'frost') { // frigo
      ctx.fillStyle = D.lin(ctx, -4.6, 0, 4.6, 0, U.shade(c.frost, -0.12), U.shade(c.frost, 0.08));
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-4.6, 0.6, 9.2, 16, 1.2) : ctx.rect(-4.6, 0.6, 9.2, 16); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = D.LW; ctx.stroke();
      ctx.strokeStyle = 'rgba(40,60,90,0.6)'; ctx.lineWidth = 0.45; ctx.beginPath(); ctx.moveTo(-4.6, 10.6); ctx.lineTo(4.6, 10.6); ctx.stroke();
      D.poly(ctx, [3.4, 11.6, 3.9, 11.6, 3.9, 14.6, 3.4, 14.6], '#5a6a80', true); D.poly(ctx, [3.4, 5.8, 3.9, 5.8, 3.9, 9.6, 3.4, 9.6], '#5a6a80', true); // poignées
      D.shine(ctx, -2.6, 14, 0.9, 1.8, 0.35);
      if (!empty) face(ctx, 0.3, 13.4, 0.95, c, P && P.eye, true);
    } else if (kind === 'fan') { // ventilateur
      D.ell(ctx, 0, 0.8, 4.2, 0.9, 0, U.shade(c.fan, -0.3)); // pied
      D.poly(ctx, [-0.7, 1.2, 0.7, 1.2, 0.7, 6.4, -0.7, 6.4], U.shade(c.fan, -0.2));
      const spin = t * (P && P.spin ? 40 : 14);
      ctx.save(); ctx.translate(0.6, 9.6);
      D.circ(ctx, 0, 0, 4.6, U.rgb(U.hex(c.fan), 0.35));
      for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(spin + i * 2.094); D.ell(ctx, 0, 2.2, 1.3, 2.2, 0, U.shade(c.fan, 0.3)); ctx.restore(); }
      ctx.strokeStyle = U.shade(c.fan, -0.25); ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, 7); ctx.stroke();
      for (let i = 0; i < 8; i++) { const a = i * 0.785; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 1.6, Math.sin(a) * 1.6); ctx.lineTo(Math.cos(a) * 4.6, Math.sin(a) * 4.6); ctx.stroke(); }
      D.circ(ctx, 0, 0, 1.8, c.fan);
      ctx.restore();
      if (!empty) face(ctx, 0.6, 9.9, 0.62, c, P && P.eye, false);
    } else if (kind === 'mow') { // tondeuse
      const spin = t * 30;
      ctx.strokeStyle = U.shade(c.mow, -0.4); ctx.lineWidth = 0.8; ctx.lineCap = 'round'; // guidon
      ctx.beginPath(); ctx.moveTo(-4.2, 6.8); ctx.lineTo(-7.2, 11.2); ctx.lineTo(-5.6, 11.6); ctx.stroke();
      D.blob(ctx, [-5.6, 2.2, 5.0, 2.2, 6.4, 4.2, 5.4, 7.6, -1.4, 8.4, -5.4, 7.0], D.lin(ctx, 0, 8.4, 0, 2.2, U.shade(c.mow, 0.15), U.shade(c.mow, -0.25)));
      D.poly(ctx, [4.2, 2.0, 7.2, 2.6, 6.8, 4.4, 4.6, 4.0], '#e04a2a'); // lames (avant)
      ctx.save(); ctx.translate(5.6, 2.2); ctx.scale(1, 0.3); ctx.rotate(spin); ctx.strokeStyle = 'rgba(230,230,240,0.85)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.moveTo(0, -2); ctx.lineTo(0, 2); ctx.stroke(); ctx.restore();
      for (const wx of [-3.8, 3.4]) { D.circ(ctx, wx, 1.6, 1.6, '#1e1e26'); D.circ(ctx, wx, 1.6, 0.6, '#9a9aa6', true); }
      if (!empty) face(ctx, 2.4, 5.6, 0.85, c, P && P.eye, true);
    }
  }
  function drawRotom(ctx, P, c, f, t) { // forme normale : boule de plasma
    const glow = P.glow || 0;
    D.ell(ctx, 0, 6.4, 6.6 + glow, 6.0 + glow, 0, U.rgb(U.hex(c.aura), 0.22 + glow * 0.15), true); // aura
    for (let i = 0; i < 3; i++) { // traînées sous le corps (il flotte)
      const x = -2 + i * 2, w = Math.sin(t * 8 + i * 2) * 0.6;
      D.poly(ctx, [x - 1, 3.4, x + 1, 3.4, x + w * 1.4, 0.4 - (i % 2) * 0.8], U.rgb(U.hex(c.body), 0.85), true);
    }
    zigArm(ctx, -2.8, 6.4, P.aB, 4.8, c.aura, t, 1);
    D.ell(ctx, 0, 6.4, 4.8, 4.3, 0, D.shade(ctx, 0.6, 7.4, 4.8, c.body)); // corps
    D.ell(ctx, -0.6, 5.0, 2.6, 1.6, 0, U.rgb(U.hex(c.body2), 0.55), true);
    // « cheveux » de plasma bleu en éclair
    D.poly(ctx, [-2.4, 9.6, -6.0, 13.4, -3.6, 12.6, -5.0, 15.6, -0.6, 11.4, 0.4, 10.8], c.aura);
    D.poly(ctx, [-1.6, 10.2, -3.6, 12.0, -1.0, 11.4], '#ffffff', true);
    face(ctx, 1.6, 7.2, 1.0, c, P.eye, true);
    zigArm(ctx, 3.4, 6.0, P.aF, 4.8, c.aura, t, 2);
  }

  const POSS_ANIM = [[0, {}], [7, { glow: 1, eye: 3, sq: 0.9 }], [8, { glow: 1, eye: 3, sq: 0.9 }], [14, { rot: 0, glow: 1 }], [20, { rot: 360, glow: 1, sq: 1.15 }], [40, { rot: 360 }]];

  G.registerChar({
    id: 'motisma', name: 'Motisma', short: 'Motisma', dex: 479,
    formDex: { heat: 10008, wash: 10009, frost: 10010, fan: 10011, mow: 10012 }, color: '#ff7a2a', trail: '#9aefff',
    desc: 'Le fantôme qui possède les appareils. Maintiens bas B + direction : neutre Micro-ondes, ↑ Ventilateur, ↓ Frigo, → Tondeuse, ← Machine à laver (même direction = il en ressort). Chaque appareil change ses stats, son B et quelques coups.',
    nameFor: (f) => FORMS[f.v.form] || 'Motisma',
    stats: { weight: 70, h: 12, w: 8, walk: 1.2, dash: 2.05, dashF: 11, run: 2.0, runAcc: 0.12, traction: 0.1, air: 1.18, airAcc: 0.09, grav: 0.072, fall: 1.3, ffall: 2.15, fullHop: 31, shortHop: 15, dJump: 30, jumps: 3 },
    formStats: {
      heat: { weight: 95, h: 12, w: 10, walk: 1.05, dash: 1.85, run: 1.8, runAcc: 0.1, air: 1.0, airAcc: 0.07, grav: 0.095, fall: 1.6, ffall: 2.55, fullHop: 31, shortHop: 15, dJump: 29, jumps: 2 },
      wash: { weight: 104, h: 13, w: 10.5, walk: 1.0, dash: 1.8, run: 1.72, runAcc: 0.09, air: 0.98, airAcc: 0.065, grav: 0.1, fall: 1.65, ffall: 2.6, fullHop: 30, shortHop: 14.5, dJump: 28, jumps: 2 },
      frost: { weight: 130, h: 17, w: 10, walk: 0.9, dash: 1.6, run: 1.52, runAcc: 0.08, traction: 0.13, air: 0.9, airAcc: 0.055, grav: 0.11, fall: 1.95, ffall: 3.05, fullHop: 29, shortHop: 14, dJump: 27, jumps: 2 },
      fan: { weight: 88, h: 14, w: 9, walk: 1.1, dash: 1.95, run: 1.85, air: 1.3, airAcc: 0.11, grav: 0.062, fall: 1.15, ffall: 1.95, fullHop: 31, shortHop: 15, dJump: 30, jumps: 3 },
      mow: { weight: 100, h: 11, w: 11, walk: 1.3, dash: 2.6, dashF: 14, run: 2.75, runAcc: 0.17, traction: 0.12, air: 1.02, airAcc: 0.07, grav: 0.1, fall: 1.7, ffall: 2.7, fullHop: 31, shortHop: 15, dJump: 29, jumps: 2 },
    },
    palettes: PALS,
    init(f) { f.v.form = null; f.v.possCd = 0; f.v.plasma = 0; f.v.mowAir = 0; f.v.mowStore = 0; f.v.gustT = 0; f.v.gustCd = 0; f.v.upbUsed = 0; f.v.oneAtk = 0; },
    passive(S, f, inp) {
      if (f.v.possCd > 0) f.v.possCd--;
      if (f.v.gustCd > 0) f.v.gustCd--;
      if (f.v.boltCd > 0) f.v.boltCd--;
      if (f.grounded || f.action === 'ledge') { f.v.plasma = 0; f.v.mowAir = 0; f.v.upbUsed = 0; f.v.oneAtk = 0; }
      if (f.v.oneAtk && f.action === 'move' && !f.grounded) { f.v.helpAfter = 1; f.v.oneAtk = 0; } // le coup d'après le haut B, puis chute libre
      if (inp) gustUpdate(S, f, inp);
      for (const o of S.fighters) {
        if (o.v.iceBy === f.slot && o.v.iceT > 0) o.v.iceT--;
        // sécurité : quelqu'un qui n'est plus dans le tambour redevient visible
        if (o.v.washBy === f.slot && !(o.grabbedBy === f.slot && f.action === 'move' && f.move === 'washSpin')) { o.v.invis = 0; o.v.washBy = -1; }
      }
    },
    onKO(S, f) { f.v.form = null; f.v.possCd = 0; f.v.mowStore = 0; f.v.gustT = 0; },
    onHurt(S, f) { f.v.oneAtk = 0; f.v.gustT = 0; },
    // Blizzard : l'adversaire gelé (seulement si l'étourdissement est vraiment appliqué)
    onDealHit(S, f, t, h) { if (h.hb.freeze && t.v.stunImm === h.hb.stun + 60) { t.v.iceT = h.hb.stun; t.v.iceBy = f.slot; } },
    pose(P, f) {
      if ((f.action === 'move' && f.v.form === 'fan' && /^(nspec|nair|uspec|uair|fsmash|fair|bair)$/.test(f.move)) || f.v.gustT > 0) P.spin = 1;
    },
    moves: {
      // ---------- Motisma (et coups communs aux appareils) ----------
      jab: { len: 16, iasa: 14, next: ['jab2', 4, 14], hits: [H(3, 4, 8, 6, 4, 2.5, 361, 20, 22, E())], anim: [[0, {}], [2, { aF: 60 }], [3, { aF: 95, lean: 8 }], [8, { aF: 90 }], [16, {}]] },
      jab2: { len: 17, next: ['jab3', 5, 15], hits: [H(3, 4, 8.5, 6, 4, 2.5, 361, 22, 22, E())], anim: [[0, {}], [2, { aB: 40 }], [3, { aB: 100, aF: 40, lean: 10 }], [9, { aB: 95 }], [17, {}]] },
      jab3: { len: 30, hits: [H(5, 7, 7, 6, 7, 5, 45, 50, 90, E())], anim: [[0, {}], [4, { aF: 40, aB: 40, sq: 0.9, glow: 1 }], [5, { aF: 120, aB: 110, sq: 1.15, glow: 1, eye: 1 }], [12, { aF: 110 }], [30, {}]] },
      ftilt: { len: 28, hitCancel: 16, hits: G.LINE(6, 8, 4, 6, 16, 5, 3, 3.6, 8, 361, 32, 92, E()), anim: [[0, {}], [5, { aF: 40, lean: -6 }], [6, { aF: 95, lean: 12, eye: 1 }], [14, { aF: 90 }], [28, {}]] },
      utilt: { len: 28, hitCancel: 15, hits: G.ARC(5, 10, 0, 6, 10, 20, 160, 4, 4.5, 7, 90, 42, 100, E()), anim: [[0, {}], [4, { aF: 60, aB: 60 }], [6, { aF: 160, aB: 120 }], [10, { aF: 190, aB: 170 }], [28, {}]] },
      dtilt: { len: 22, hurtH: 0.7, hitCancel: 11, hits: [H(5, 7, 9, 1.5, 4.5, 6, 70, 45, 45, E())], anim: [[0, { crouch: 0.6 }], [4, { crouch: 0.8, aF: 40 }], [5, { crouch: 0.8, aF: 70, eye: 1 }], [22, { crouch: 0.6 }]] },
      dashAtk: { len: 36, keepVel: 1, tick: G.dashAtkTick, hits: [H(5, 14, 6, 6, 6, 9, 50, 50, 70, E())], anim: [[0, { lean: 15 }], [5, { lean: 30, aF: 100, aB: 100, glow: 1, eye: 1 }], [14, { lean: 25 }], [36, {}]] },
      // Tonnerre : un éclair tombe juste devant
      fsmash: { len: 50, charge: 9, hits: [...G.LINE(14, 17, 16, 0, 16, 26, 4, 4.5, 16, 361, 36, 100, E({ noTrail: 1 })), H(13, 14, 7, 6, 4.5, 6, 60, 50, 40, E({ g: 1 }))], anim: [[0, {}], [9, { aF: 170, aB: 170, glow: 1, eye: 1 }], [13, { aF: 120, aB: 120, lean: 10, glow: 1 }], [16, { aF: 95, aB: 95, lean: 14, eye: 1 }], [50, {}]] },
      usmash: { len: 50, charge: 8, hits: [H(10, 18, 0, 17, 7, 1.5, 90, 0, 0, E({ rehit: 4, link: 1, hs: 8 })), H(20, 22, 0, 19, 8, 7, 88, 42, 104, E({ g: 1 }))], anim: [[0, {}], [8, { crouch: 0.6, glow: 1 }], [10, { aF: 175, aB: 175, sq: 1.1, glow: 1 }], [22, { aF: 170, aB: 170, eye: 1 }], [50, {}]] },
      dsmash: { len: 48, charge: 6, hits: G.LINE(11, 13, -18, 1.5, 18, 1.5, 7, 3.8, 13, 25, 34, 98, E({ away: 1 })), anim: [[0, {}], [6, { crouch: 0.7, glow: 1, eye: 1 }], [11, { crouch: 0.5, aF: 30, aB: 30, sq: 1.1, glow: 1 }], [48, {}]] },
      // le coup final repousse loin et en hauteur, et il a du lag s'il atterrit pendant : plus d'enchaînement en boucle
      nair: { aerial: 1, len: 36, landLag: 11, ac: [4, 30], hits: [H(4, 12, 0, 6, 9, 1.4, 361, 0, 0, E({ rehit: 3, link: 1, hs: 8 })), H(14, 15, 0, 6, 10, 5, 50, 72, 85, E({ g: 1 }))], anim: [[0, {}], [4, { rot: 0, aF: 90, aB: -90, glow: 1 }], [16, { rot: 720, aF: 90, aB: -90, glow: 1 }], [36, { rot: 720 }]] },
      fair: { aerial: 1, len: 34, landLag: 8, ac: [3, 25], hits: G.ARC(6, 9, 0, 6, 10, 60, -30, 3, 5, 9, 45, 34, 88, E()), anim: [[0, {}], [5, { aF: 160, lean: -6 }], [6, { aF: 120, lean: 8, eye: 1 }], [9, { aF: 40, lean: 12 }], [34, {}]] },
      bair: { aerial: 1, len: 34, landLag: 9, ac: [4, 25], hits: [H(7, 9, -10, 6, 5.5, 12, 361, 32, 100, E())], anim: [[0, {}], [6, { aB: 20, lean: 8 }], [7, { aB: -95, lean: -10, eye: 1, glow: 1 }], [14, { aB: -90 }], [34, {}]] },
      uair: { aerial: 1, len: 32, landLag: 8, ac: [3, 24], hits: G.LINE(5, 8, 0, 10, 0, 22, 3, 4.5, 9, 88, 35, 98, E({ noTrail: 1 })), anim: [[0, {}], [4, { aF: 150, aB: 150, glow: 1 }], [5, { aF: 178, aB: 178, sq: 1.1, eye: 1 }], [32, {}]] },
      dair: { aerial: 1, len: 38, landLag: 10, ac: [4, 30], hits: [H(6, 16, 0, -1, 6, 1.5, 270, 0, 0, E({ rehit: 3, link: 1, hs: 8 })), H(18, 19, 0, -2, 6.5, 5, 285, 30, 55, E({ g: 1 }))], anim: [[0, {}], [5, { aF: 10, aB: -10, glow: 1 }], [19, { aF: 5, aB: -5, glow: 1, eye: 1 }], [38, {}]] },
      fthrow: { throw: 1, len: 30, rel: 12, dmg: 8, ang: 42, bkb: 62, kbg: 62, t: 'elec', hold: [[0, 1, 0], [10, 1.5, 0.2]], anim: A.throwF },
      bthrow: { throw: 1, back: 1, len: 34, rel: 15, dmg: 9, ang: 40, bkb: 60, kbg: 72, t: 'elec', hold: [[0, 1, 0], [8, 0, 0.9], [15, -1.5, 0.3]], anim: A.throwB },
      uthrow: { throw: 1, len: 36, rel: 16, dmg: 7, ang: 90, bkb: 62, kbg: 80, t: 'elec', hitFrame: 9, hitDmg: 3, hold: [[0, 1, 0], [12, 0.2, 1.4]], anim: A.throwU },
      dthrow: { throw: 1, len: 34, rel: 16, dmg: 6, ang: 70, bkb: 70, kbg: 40, t: 'elec', hold: [[0, 1, 0], [12, 0.9, -0.1]], anim: A.throwD },
      taunt: { len: 70, anim: [[0, {}], [10, { rot: 0, eye: 3, glow: 1 }], [40, { rot: 360, eye: 3, glow: 1 }], [70, { rot: 360 }]] },
      nspec: { len: 26, tick: boltTick, land: 'keep', grav: 0.6, cond: (S, f) => !(f.v.boltCd > 0), anim: [[0, {}], [7, { aF: 60, aB: 60, glow: 1, sq: 0.9 }], [9, { aF: 100, aB: 90, glow: 1, sq: 1.1, eye: 1 }], [30, {}]] },
      sspec: { len: 30, tick: plasmaTick, keepVel: 1, offEdge: 1, land: 'keep', drift: 0, intang: [5, 8], noGrav: (af) => af >= 5 && af <= 12, ledge: 12, hits: [H(5, 12, 3, 6, 6, 7, 40, 45, 60, E())], anim: [[0, { sq: 0.9 }], [5, { lean: 30, aF: 95, aB: -95, glow: 1, eye: 1 }], [12, { lean: 25, glow: 1 }], [30, {}]] },
      uspec: { len: 44, landLag: 12, ledge: 12, tick: levitateTick, cond: upbCond, end: upbEnd, drift: 0, noGrav: (af) => af >= 4 && af <= 20, hits: [H(4, 18, 0, 6, 7, 1.2, 90, 0, 0, E({ rehit: 4, link: 1, hs: 9 })), H(20, 21, 0, 9, 8, 5, 85, 55, 80, E({ g: 1 }))], anim: [[0, { sq: 0.9 }], [4, { aF: 175, aB: 175, glow: 1, sq: 1.1 }], [20, { aF: 170, aB: 170, glow: 1 }], [44, {}]] },
      dspec: { len: 40, noReverse: 1, tick: possessTick, land: 'keep', intang: [14, 20], cond: (S, f) => (f.v.possCd || 0) <= 0, anim: POSS_ANIM },

      // ---------- CHALEUR (micro-ondes) ----------
      'heat:nspec': { len: 34, tick: heatTick, land: 'keep', drift: 0.5, anim: [[0, {}], [5, { glow: 1, sq: 0.92, eye: 1 }], [6, { glow: 1, sq: 0.92, eye: 1 }], [7, { sq: 1.2, glow: 1, eye: 3 }], [14, { sq: 1 }], [34, {}]] },
      'heat:fsmash': { len: 52, charge: 9, hits: G.LINE(12, 18, 6, 6, 24, 6, 4, 4.5, 15, 361, 36, 100, F({ noTrail: 1 })), anim: [[0, {}], [9, { lean: -8, glow: 1, eye: 1 }], [12, { lean: 10, glow: 1, eye: 1 }], [18, { lean: 8 }], [52, {}]] },
      'heat:fair': { aerial: 1, len: 34, landLag: 8, ac: [3, 25], hits: [H(6, 9, 8, 6, 6, 10, 45, 32, 92, F())], anim: [[0, {}], [5, { rot: 0 }], [6, { rot: -25, glow: 1, eye: 1 }], [12, { rot: -15 }], [34, {}]] },
      // ---------- LAVAGE (machine à laver) ----------
      'wash:nspec': { len: 36, hits: [G.GH(6, 10, 9, 6, 6.5)], onGrab: washGrab, land: 'keep', grav: 0.5, anim: [[0, {}], [5, { aF: 60, aB: 60, lean: -6 }], [6, { aF: 95, aB: 95, lean: 12, eye: 1 }], [12, { aF: 90, aB: 90 }], [36, {}]] },
      washSpin: { throw: 1, len: 60, tick: washSpinTick, hold: [[0, 0.3, 0.3], [5, 0, 0.3]], anim: [[0, {}], [4, { sq: 0.95 }], [8, { sq: 1.05 }], [12, { sq: 0.95 }], [16, { sq: 1.05 }], [20, { sq: 0.95 }], [24, { sq: 1.05 }], [28, { sq: 0.95 }], [32, { sq: 1.05 }], [44, { sq: 1.2, glow: 1, eye: 1 }], [60, {}]] },
      'wash:bair': { aerial: 1, len: 34, landLag: 9, ac: [4, 25], hits: G.LINE(7, 10, -4, 6, -18, 6, 3, 4.2, 10, 361, 35, 95, W({ noTrail: 1 })), anim: [[0, {}], [6, { lean: 6 }], [7, { lean: -10, eye: 1 }], [16, { lean: -6 }], [34, {}]] },
      'wash:usmash': { len: 54, charge: 8, hits: [...G.LINE(12, 20, 0, 6, 0, 30, 4, 5.5, 1.5, 90, 0, 0, W({ rehit: 3, link: 1, hs: 8, noTrail: 1 })), H(22, 24, 0, 30, 8, 7, 88, 40, 105, W({ g: 1, noTrail: 1 }))], anim: [[0, {}], [8, { crouch: 0.5, eye: 1 }], [12, { sq: 1.12 }], [24, { sq: 1.05 }], [54, {}]] },
      // ---------- FROID (frigo) ----------
      'frost:nspec': { len: 44, land: 'keep', grav: 0.4, tick: (S, f, af) => { if (af === 9) G.sfx(S, f, 'swing', { blizzard: 1 }); },
        hits: [H(10, 26, 9, 8, 4.5, 1, 361, 0, 0, I({ rehit: 4, link: 1, hs: 9, noTrail: 1 })), H(10, 26, 15, 8, 5, 1, 361, 0, 0, I({ rehit: 4, link: 1, hs: 9, noTrail: 1 })), H(28, 29, 13, 8, 6.5, 4, 50, 40, 30, I({ g: 1, stun: 32, freeze: 1, noTrail: 1 }))],
        anim: [[0, {}], [8, { lean: -6, eye: 1 }], [10, { lean: 6, glow: 1 }], [29, { lean: 6, glow: 1 }], [44, {}]] },
      'frost:dair': { aerial: 1, len: 60, landLag: 20, ac: [4, 59], armor: [6, 59, 110], noGrav: (af) => af >= 6, tick: fridgeTick, onLand: fridgeLand,
        // début de la chute (adversaire au contact) = SPIKE énorme vers le bas ; ensuite = éjection en diagonale vers le haut,
        // du côté où se trouve l'adversaire
        hits: [H(6, 11, 0, 1, 7.5, 14, 280, 45, 100, I()), H(12, 59, 0, 1, 7, 13, 45, 50, 100, I({ away: 1 }))], anim: [[0, {}], [5, { sq: 0.9, eye: 1 }], [6, { sq: 1.1, eye: 1 }], [60, { sq: 1.1 }]] },
      'frost:fsmash': { len: 56, charge: 10, hits: [H(15, 17, 11, 8, 7.5, 17, 361, 38, 102, I())], anim: [[0, {}], [10, { lean: -12, eye: 1 }], [15, { lean: 16, eye: 1 }], [24, { lean: 10 }], [56, {}]] },
      // ---------- HÉLICE (ventilateur) ----------
      'fan:nspec': { len: 8, tick: gustStart, land: 'keep', cond: (S, f) => !(f.v.gustCd > 0) && !(f.v.gustT > 0), anim: [[0, {}], [3, { lean: -4, eye: 1 }], [8, {}]] },
      'fan:nair': { aerial: 1, len: 36, landLag: 11, ac: [4, 30], hits: [H(4, 14, 0, 9, 9, 1.3, 361, 0, 0, { rehit: 3, link: 1, hs: 8 }), H(16, 17, 0, 9, 10, 6, 50, 72, 90, { g: 1 })], anim: [[0, {}], [4, { glow: 0.5 }], [19, { glow: 0.5 }], [36, {}]] },
      // Pale tranchante (avant), Rafale arrière (arrière), Tornade (haut, multi-coups qui tue), Ouragan (smash avant)
      'fan:fair': { aerial: 1, len: 32, landLag: 8, ac: [3, 24], hits: [H(6, 9, 9, 9, 7, 11, 45, 36, 96, { t: 'normal' })], anim: [[0, {}], [5, { lean: -8 }], [6, { lean: 14, eye: 1 }], [12, { lean: 10 }], [32, {}]] },
      'fan:bair': { aerial: 1, len: 34, landLag: 9, ac: [4, 25], hits: [H(7, 10, -10, 9, 7.5, 13, 361, 36, 102, { t: 'normal' })], anim: [[0, {}], [6, { lean: 8 }], [7, { lean: -12, eye: 1 }], [14, { lean: -8 }], [34, {}]] },
      'fan:uair': { aerial: 1, len: 34, landLag: 8, ac: [3, 26], hits: [H(5, 14, 0, 17, 8, 1.4, 90, 0, 0, { rehit: 3, link: 1, hs: 8, noTrail: 1 }), H(16, 17, 0, 19, 9.5, 8, 88, 50, 118, { g: 1, noTrail: 1 })], anim: [[0, {}], [5, { sq: 1.1, glow: 0.5 }], [17, { sq: 1.1, eye: 1 }], [34, {}]] },
      'fan:fsmash': { len: 52, charge: 9, hits: G.LINE(12, 16, 6, 9, 22, 9, 4, 5.5, 16, 361, 38, 104, { t: 'normal', noTrail: 1 }), anim: [[0, {}], [9, { lean: -10, eye: 1 }], [12, { lean: 12, eye: 1 }], [20, { lean: 8 }], [52, {}]] },
      'fan:uspec': { len: 70, landLag: 12, ledge: 12, tick: fanLiftTick, cond: upbCond, end: upbEnd, drift: 0, noGrav: (af) => af >= 4 && af <= 24, hits: [H(4, 22, 0, 14, 7, 1.2, 90, 0, 0, { rehit: 4, link: 1, hs: 9 }), H(24, 25, 0, 15, 8, 5, 85, 55, 78, { g: 1 })], anim: [[0, {}], [4, { sq: 1.1 }], [70, {}]] },
      // ---------- TONTE (tondeuse) ----------
      'mow:nspec': { len: 120, tick: mowTick, keepVel: 1, land: 'keep', drift: 0, anim: [[0, {}], [5, { lean: -6, eye: 1 }], [6, { lean: -6, eye: 1 }], [7, { lean: 10, eye: 1 }], [40, { lean: 8 }], [120, {}]] },
      'mow:dashAtk': { len: 36, keepVel: 1, tick: G.dashAtkTick, hits: [H(5, 16, 6, 3, 6, 1.2, 361, 0, 0, Gr({ rehit: 3, link: 1, hs: 8 })), H(18, 19, 7, 3, 6.5, 5, 40, 50, 80, Gr({ g: 1 }))], anim: [[0, { lean: 10 }], [5, { lean: 14, eye: 1 }], [19, { lean: 10 }], [36, {}]] },
      'mow:dtilt': { len: 22, hurtH: 0.8, hitCancel: 11, hits: G.LINE(5, 7, 4, 1.5, 14, 1.5, 3, 3.5, 6, 30, 40, 50, Gr()), anim: [[0, {}], [4, { lean: -6 }], [5, { lean: 10, eye: 1 }], [22, {}]] },
    },
    draw(ctx, P, c, f, S, t) {
      const form = f.v.form;
      ctx.save();
      const cr = P.crouch || 0;
      ctx.scale(1 + cr * 0.06, 1 - cr * 0.18);
      if (!form || form === 'fan') ctx.translate(0, Math.sin(t * 4 + f.slot) * 0.4); // il flotte
      ctx.translate(0, 0); ctx.rotate(-(P.lean || 0) * 0.4 * RAD);
      if (!form) drawRotom(ctx, P, c, f, t);
      else {
        // l'appareil possédé : aura, bras d'éclair, appareil, visage
        const st = G.ST(f);
        D.ell(ctx, 0, st.h * 0.5, st.w * 0.7 + 1, st.h * 0.55, 0, U.rgb(U.hex(c.body), 0.16 + (P.glow || 0) * 0.15), true);
        zigArm(ctx, -st.w * 0.45, st.h * 0.5, P.aB, 4.4, c.body, t, 1);
        drawAppliance(ctx, form, c, P, t, false);
        zigArm(ctx, st.w * 0.45, st.h * 0.48, P.aF, 4.4, c.body, t, 2);
        if (P.glow) { ctx.fillStyle = `rgba(255,170,90,${0.15 + 0.1 * Math.sin(t * 25)})`; ctx.beginPath(); ctx.ellipse(0, st.h * 0.5, st.w * 0.6, st.h * 0.55, 0, 0, 7); ctx.fill(); }
      }
      ctx.restore();
    },
    drawFx(ctx, f, S, t) {
      const st = G.ST(f), mv = f.action === 'move' ? f.move : '', af = f.af, fc = f.facing, c = G.palOf(f);
      // roue de possession
      if (mv === 'dspec' && af >= 7 && af <= 8) {
        const cx = f.x, cy = f.y + st.h * 0.6, R = 17;
        const items = [['fan', 0, 1, c.fan, 'H'], ['frost', 0, -1, c.frost, 'F'], ['mow', fc, 0, c.mow, 'T'], ['wash', -fc, 0, c.wash, 'L'], ['heat', 0, 0, c.heat, 'C']];
        for (const [id, dx, dy, col, l] of items) {
          const x = cx + dx * R, y = cy + dy * R, on = f.mv.pick === id, back = id === f.v.form;
          ctx.fillStyle = back ? '#ff9a4a' : col; ctx.globalAlpha = on ? 1 : 0.55; ctx.beginPath(); ctx.arc(x, y, on ? 4.6 : 3.4, 0, 7); ctx.fill();
          ctx.lineWidth = on ? 0.8 : 0.4; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.globalAlpha = 1;
          ctx.save(); ctx.translate(x, y); ctx.scale(0.3, -0.3); ctx.fillStyle = id === 'frost' && !back ? '#2a3a50' : '#fff'; ctx.font = '900 12px Rubik'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(back ? 'M' : l, 0, 0); ctx.restore();
        }
      }
      // gelés par le Blizzard : bloc de glace
      for (const o of S.fighters) {
        if (o.dead || o.v.iceBy !== f.slot || !(o.v.iceT > 0)) continue;
        const os = G.ST(o), a = Math.min(1, o.v.iceT / 8);
        ctx.fillStyle = `rgba(190,240,255,${0.45 * a})`; ctx.strokeStyle = `rgba(255,255,255,${0.9 * a})`; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.rect(o.x - os.w * 0.75, o.y - 0.5, os.w * 1.5, os.h + 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(o.x - os.w * 0.5, o.y + os.h * 0.8); ctx.lineTo(o.x - os.w * 0.2, o.y + os.h + 1); ctx.stroke();
      }
      // Blizzard : nuage froid
      if (f.v.form === 'frost' && mv === 'nspec' && af >= 10 && af <= 30) {
        for (let i = 0; i < 7; i++) {
          const k = ((t * 2 + i * 0.14) % 1), x = f.x + fc * (6 + k * 16), y = f.y + 8 + Math.sin(i * 2.3 + t * 6) * (1 + k * 4);
          ctx.fillStyle = `rgba(220,248,255,${0.7 * (1 - k)})`; ctx.beginPath(); ctx.arc(x, y, 1.5 + k * 3, 0, 7); ctx.fill();
        }
      }
      // Four : flammes
      if (f.v.form === 'heat' && mv === 'fsmash' && af >= 12 && af <= 20) {
        for (let i = 0; i < 8; i++) {
          const k = i / 8, x = f.x + fc * (6 + k * 19), y = f.y + 6 + Math.sin(t * 30 + i) * k * 2;
          ctx.fillStyle = i % 2 ? 'rgba(255,200,60,0.85)' : 'rgba(255,90,30,0.8)'; ctx.beginPath(); ctx.arc(x, y, 2.4 + k * 2.4, 0, 7); ctx.fill();
        }
      }
      // Surchauffe : il rougit pendant la charge
      if (f.v.form === 'heat' && mv === 'nspec' && af <= 6) {
        const k = (f.mv.c || 0) / HEAT_MAX;
        ctx.strokeStyle = `rgba(255,${180 - k * 120},60,${0.4 + 0.4 * Math.sin(t * (10 + k * 30))})`; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(f.x, f.y + st.h * 0.5, 9 + k * 6, 0, 7); ctx.stroke();
      }
      // Bourrasque : lignes de vent
      if (f.v.gustT > 0) {
        ctx.strokeStyle = 'rgba(235,245,255,0.7)'; ctx.lineWidth = 0.5; ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const k = (t * 2.2 + i * 0.17) % 1, x0 = f.x + fc * (5 + k * GUST_R * 0.9), y0 = f.y + st.h * 0.6 + (i - 2.5) * (2 + k * 4);
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + fc * 3, y0 + 1, x0 + fc * 7, y0); ctx.stroke();
        }
      }
      // Tonte : herbe coupée qui vole
      if (f.v.form === 'mow' && mv === 'nspec' && af >= 7 && f.grounded && G.R.newFrame && S.frame % 2 === 0) {
        for (let i = 0; i < 2; i++) G.R.parts.push({ ty: 'leaf', x: f.x + fc * 6, y: f.y + 1, vx: -fc * (0.5 + Math.random()), vy: 0.8 + Math.random(), grav: 0.05, life: 20, max: 20, size: 0.8, col: i ? '#7ad84a' : '#4aa83a' });
      }
      if (f.v.form === 'mow' && mv === 'nspec' && af <= 6 && (f.mv.c || 0) > 0) { // jauge de régime
        const k = f.mv.c / MOW_MAX;
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(f.x - 5, f.y + st.h + 3, 10, 1.4);
        ctx.fillStyle = k >= 1 ? '#ff5a3a' : '#ffd23a'; ctx.fillRect(f.x - 5, f.y + st.h + 3, 10 * k, 1.4);
      }
      // Tonnerre (smash avant de la forme normale)
      if (!f.v.form && mv === 'fsmash' && af >= 13 && af <= 19) {
        const x = f.x + fc * 16;
        ctx.strokeStyle = 'rgba(255,245,140,0.95)'; ctx.lineWidth = 1.4; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x, f.y + 34); for (let i = 1; i <= 6; i++) ctx.lineTo(x + (i % 2 ? 2 : -2), f.y + 34 - i * 5.6); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.5; ctx.stroke();
      }
      // Machine à laver : l'adversaire tourne dans le hublot
      if (mv === 'washSpin' && f.grabbing >= 0 && af < 44) {
        const v = S.fighters[f.grabbing];
        if (v && G.R.drawFighterAt) {
          const wx = f.x + fc * 0.3, wy = f.y + 5.6;
          ctx.save(); ctx.beginPath(); ctx.arc(wx, wy, 3.1, 0, 7); ctx.clip();
          ctx.fillStyle = '#9ad6ff'; ctx.fillRect(wx - 4, wy - 4, 8, 8);
          ctx.translate(wx, wy); ctx.rotate(t * 14); ctx.scale(1, -1);
          G.R.drawFighterAt(ctx, S, v, t, 0, 0, 3.2 / G.ST(v).h);
          ctx.restore();
          ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 3; i++) { const a = t * 9 + i * 2; ctx.beginPath(); ctx.arc(wx + Math.cos(a) * 2, wy + Math.sin(a) * 2, 0.5, 0, 7); ctx.fill(); }
          // flèche de visée
          const a = f.mv.aim || 0, ax = U.dcos(a), ay = U.dsin(a);
          ctx.strokeStyle = 'rgba(120,210,255,0.9)'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(wx + ax * 7, wy + ay * 7); ctx.lineTo(wx + ax * 15, wy + ay * 15); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(wx + ax * 15, wy + ay * 15); ctx.lineTo(wx + ax * 12.5 - ay * 1.8, wy + ay * 12.5 + ax * 1.8); ctx.lineTo(wx + ax * 12.5 + ay * 1.8, wy + ay * 12.5 - ax * 1.8); ctx.closePath(); ctx.fillStyle = 'rgba(120,210,255,0.9)'; ctx.fill();
        }
      }
    },
    fx(e, R) {
      if (e.zap) { R.parts.push({ ty: 'ring', x: e.x, y: e.y + 6, life: 14, max: 14, size: 9, col: '#9aefff' }); R.spark(e.x, e.y + 6, '#ffffff', 10, 2); }
      if (e.poss) { R.parts.push({ ty: 'ring', x: e.x, y: e.y + 7, life: 24, max: 24, size: 16, col: '#9aefff' }); R.spark(e.x, e.y + 7, '#ffb04a', 18, 2.6); }
      if (e.boom) { R.cam.shake = Math.max(R.cam.shake, 3 + e.boom * 3); for (let i = 0; i < 18; i++) { const a = Math.random() * 6.28, s = 0.8 + Math.random() * 2.5 * e.boom; R.parts.push({ ty: 'flame', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 18, max: 18, size: 2, col: Math.random() < 0.5 ? 'rgba(255,200,60,0.9)' : 'rgba(255,90,30,0.85)' }); } }
      if (e.jet) { // Hydrocanon
        const ax = Math.cos(e.ang * RAD), ay = Math.sin(e.ang * RAD);
        for (let i = 0; i < 16; i++) { const s = 1.5 + Math.random() * 3; R.parts.push({ ty: 'bubble', x: e.x + ax * 6, y: e.y + 6 + ay * 6, vx: ax * s + (Math.random() - 0.5) * 0.6, vy: ay * s + (Math.random() - 0.5) * 0.6, life: 22, max: 22, size: 0.8 + Math.random() }); }
        R.cam.shake = Math.max(R.cam.shake, 4);
      }
      if (e.frost) { R.cam.shake = Math.max(R.cam.shake, 6); R.parts.push({ ty: 'ring', x: e.x, y: e.y + 2, life: 20, max: 20, size: 16, col: '#cff4ff', flat: 1 }); R.spark(e.x, e.y + 2, '#ffffff', 16, 2.4); }
      if (e.blizzard) R.spark(e.x, e.y + 8, '#e6faff', 8, 1.2);
    },
    hud(ctx, f, S, x, y, pw, ph, u) {
      const parts = [];
      if (f.v.possCd > 0) parts.push('POSSESSION ' + Math.ceil(f.v.possCd / 60) + 's');
      if (f.v.gustT > 0) parts.push('VENT ' + (f.v.gustT / 60).toFixed(1) + 's');
      if (f.v.mowStore > 0) parts.push('MOTEUR ' + Math.round(f.v.mowStore / MOW_MAX * 100) + '%');
      if (!parts.length) return;
      ctx.fillStyle = '#ffc06a'; ctx.font = `900 ${9 * u}px Rubik, sans-serif`; ctx.textAlign = 'left'; ctx.fillText(parts.join('  '), x + ph + 2 * u, y + 43 * u);
    },
  });
})(window.G);
