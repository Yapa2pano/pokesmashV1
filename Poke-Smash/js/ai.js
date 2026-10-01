'use strict';
// IA des bots CPU (niveaux 1 à 9). Déterministe : ne lit que l'état de la sim et utilise S.rng,
// donc elle fonctionne aussi en ligne (chaque machine calcule les mêmes entrées).
(function (G) {
  const U = G.U, B = G.BTN;
  const AI = G.AI = {};
  const REACT = [34, 28, 23, 19, 15, 12, 9, 7, 5];
  const ZONERS = { motisma: 0.2, gromago: 0.25, archeduc: 0.5, armarouge: 0.35, malvalame: 0.25, miascarade: 0.35, meloetta: 0.35, insecateur: 0.1, mouscoto: 0 };

  function mem(f) {
    if (!f.ai) f.ai = { q: [], t: 0, tgt: -1, pb: 0, ledgeT: 0, lastDec: 0 };
    return f.ai;
  }
  const r = (S) => U.rand(S);
  function push(ai, steps) { for (const s of steps) ai.q.push({ n: s[0], sx: s[1] || 0, sy: s[2] || 0, b: s[3] || 0, cx: s[4] || 0, cy: s[5] || 0 }); }
  function out(ai, sx, sy, b, cx, cy) {
    // les boutons doivent être relâchés entre deux appuis
    let bb = b | 0;
    const again = bb & ai.pb & ~ai.hold;
    bb &= ~again;
    ai.pb = bb;
    return [Math.round(U.clamp(sx, -1, 1) * 80), Math.round(U.clamp(sy, -1, 1) * 80), cx | 0, cy | 0, bb | B.TAPJUMP * 0];
  }

  function nearestTarget(S, f) {
    let best = null, bd = 1e9;
    for (const o of S.fighters) {
      if (o === f || o.dead || o.out) continue;
      if (S.teams && o.team === f.team) continue;
      const d = Math.abs(o.x - f.x) + Math.abs(o.y - f.y) * 0.7;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  function offstage(S, f) {
    const m = S.stage.main;
    return f.x < m.l - 1 || f.x > m.r + 1 || (f.y < m.y - 4 && !f.grounded);
  }
  function overStage(S, x) { const m = S.stage.main; return x > m.l + 2 && x < m.r - 2; }

  AI.think = (S, f) => {
    const ai = mem(f);
    const lvl = U.clamp(f.cpu, 1, 9);
    ai.hold = 0;
    if (f.dead || f.out) { ai.q.length = 0; return out(ai, 0, 0, 0); }
    // Plan en cours
    if (ai.q.length) {
      const s = ai.q[0];
      if (--s.n <= 0) ai.q.shift();
      ai.hold = s.hold ? s.b : 0;
      return out(ai, s.sx, s.sy, s.b, s.cx, s.cy);
    }
    const st = G.ST(f);
    const m = S.stage.main;
    const a = f.action;
    const T = nearestTarget(S, f);

    // Situations réflexes (pas de délai de réaction)
    if (a === 'grabbed' || a === 'dizzy') { ai.mash = !ai.mash; return out(ai, ai.mash ? 1 : -1, 0, ai.mash ? B.ATK : B.JMP); }
    if (a === 'respawn') { if (f.af > 30 + (9 - lvl) * 8) return out(ai, T ? Math.sign(T.x - f.x) * 0.6 : 0, 0, 0); return out(ai, 0, 0, 0); }
    if ((a === 'hit' || a === 'tumble') && !f.grounded) {
      // DI de survie + tech
      const nearGround = f.y < 14 && f.vy + f.kby < 0 && overStage(S, f.x);
      const techOk = lvl >= 3 && r(S) < 0.12 * lvl;
      const di = lvl >= 4 ? [-Math.sign(f.x || 1) * 0.7, 0.7] : [0, 0];
      if (a === 'tumble' && offstage(S, f)) return recover(S, f, ai, lvl, st);
      return out(ai, di[0], di[1], nearGround && techOk ? B.SHD : 0);
    }
    if (a === 'ledge') return ledgeOption(S, f, ai, lvl);
    if (offstage(S, f) && !f.grounded && (a === 'air' || a === 'help' || a === 'tumble' || a === 'adodge' || (a === 'move' && f.af > 30))) return recover(S, f, ai, lvl, st);
    if (a === 'hold') return throwChoice(S, f, ai, lvl, T);
    if (a === 'down') { if (f.af > 24 + (9 - lvl) * 4) { const k = r(S); return out(ai, k < 0.33 ? 1 : k < 0.66 ? -1 : 0, k >= 0.66 ? 1 : 0, k > 0.85 ? B.ATK : 0); } return out(ai, 0, 0, 0); }
    if (a === 'move' && f.move === 'uspec' && f.char === 'archeduc') return recoverGlide(S, f, ai);
    // Coup chargé façon DK (Insécateur/Cizayox) : frapper si l'adversaire est à portée, sinon stocker
    if (a === 'move' && f.move === 'nspec' && f.char === 'insecateur' && f.af <= 8 && T) {
      const dx = T.x - f.x;
      if (Math.abs(dx) < 24 && Math.sign(dx) === f.facing && Math.abs(T.y - f.y) < 16) return out(ai, 0, 0, B.SPC);
      if ((f.mv.c || 0) > 25 + lvl * 3) return out(ai, 0, 0, B.SHD);
      return out(ai, 0, 0, 0);
    }
    // Roulade d'Obalie : s'arrêter avant le bord ou après avoir dépassé la cible
    if (a === 'move' && f.move === 'sspec' && f.char === 'obalie' && f.af > 12) {
      const d = f.mv.dir || f.facing, ahead = d > 0 ? m.r - f.x : f.x - m.l;
      if ((f.grounded && f.plat === -1 && ahead < 20) || (T && (T.x - f.x) * d < -25)) return out(ai, 0, 0, B.SPC);
      return out(ai, 0, 0, 0);
    }
    if (f.char === 'insecateur' && T && f.grounded && (a === 'idle' || a === 'walk' || a === 'run')) {
      const store = f.v.form === 'ciz' ? f.v.storeC : f.v.storeI, dx = T.x - f.x;
      if (store > 30 && Math.abs(dx) < 22 && Math.abs(T.y - f.y) < 14 && r(S) < 0.08 * lvl) return out(ai, Math.sign(dx) * 0.3, 0, B.SPC);
    }

    // Délai de réaction
    if (++ai.t < REACT[lvl - 1] && !(a === 'shield' && ai.t > 4)) {
      if (f.grounded && f.plat === -1 && ((f.x < m.l + 14 && ai.msx < 0) || (f.x > m.r - 14 && ai.msx > 0))) ai.msx = 0;
      return out(ai, ai.msx || 0, 0, ai.shield ? B.SHD : 0);
    }
    ai.t = 0; ai.shield = false; ai.msx = 0;
    if (!T) return out(ai, 0, 0, 0);

    const dx = T.x - f.x, adx = Math.abs(dx), dy = T.y - f.y;
    const dir = Math.sign(dx) || 1;
    const tst = G.ST(T);

    // Se défendre : l'adversaire attaque tout près
    if (T.action === 'move' && adx < 26 && Math.abs(dy) < 20 && f.grounded) {
      const k = r(S);
      if (k < 0.05 * lvl) {
        const d = r(S);
        if (d < 0.5) { ai.shield = true; push(ai, [[8 + Math.floor(r(S) * 10), 0, 0, B.SHD]]); ai.q[0].hold = 1; return out(ai, 0, 0, B.SHD); }
        if (d < 0.7) return out(ai, 0, -1, B.SHD);
        if (d < 0.85) return out(ai, -dir, 0, B.SHD);
        push(ai, [[1, 0, 0, B.JMP], [3, -dir * 0.8, 0, 0]]);
        return out(ai, 0, 0, 0);
      }
    }

    // Garde du rebord : l'adversaire revient par en dessous
    if (offstage(S, T) && f.grounded && lvl >= 4) {
      const lx = T.x < 0 ? m.l : m.r;
      const toLedge = lx - f.x;
      if (Math.abs(toLedge) > 14) { ai.msx = Math.sign(toLedge) * 0.9; return out(ai, ai.msx, 0, 0); }
      if (Math.abs(T.x - lx) < 25 && T.y > -30 && T.y < 20) {
        f.facing !== Math.sign(toLedge || 1) && (ai.msx = Math.sign(toLedge));
        const k = r(S);
        if (k < 0.5) return out(ai, 0, 0, 0, 0, -1); // smash bas
        return out(ai, 0, 0, 0, Math.sign(toLedge), 0);
      }
      return out(ai, 0, 0, 0);
    }

    // Ne pas tomber de la scène
    if (f.grounded && f.plat === -1 && ((f.x < m.l + 10 && f.vx < -0.3) || (f.x > m.r - 10 && f.vx > 0.3))) return out(ai, f.x < 0 ? 0.5 : -0.5, 0, 0);

    // Spécificités
    const ch = f.char;
    if (ch === 'miascarade') {
      const bomb = S.projs.find((p) => p.kind === 'fbomb' && p.owner === f.slot);
      if (bomb && (bomb.v.stuck === T.slot || U.len(bomb.x - T.x, bomb.y - T.y - 8) < 12)) return out(ai, 0, -1, B.SPC);
      if (!bomb && adx < 45 && adx > 10 && r(S) < 0.25) return out(ai, 0, -1, B.SPC);
    }
    if ((ch === 'insecateur' || ch === 'meloetta') && r(S) < 0.04 && (f.v.swapCd || 0) <= 0 && adx > 30) return out(ai, 0, -1, B.SPC);
    if (ch === 'evoli' && (f.v.evoCd || 0) <= 0 && f.grounded && adx > 28 && (!f.v.form || r(S) < 0.03)) {
      const dirs = [[0, 1], [f.facing, 0], [0, -1], [-f.facing, 0], [0, 0]];
      const d = dirs[U.randInt(S, 5)];
      push(ai, [[14, d[0], d[1], B.SPC]]); ai.q[0].hold = 1;
      return out(ai, 0, -1, B.SPC);
    }

    if (ch === 'obalie' && f.grounded && adx > 35 && adx < 110 && Math.abs(dy) < 10 && r(S) < 0.04 + lvl * 0.01) {
      if (r(S) < 0.6) return out(ai, dir, 0, B.SPC); // Roulade
      return out(ai, 0, 0, B.SPC); // Boule de Neige
    }
    if (ch === 'obalie' && adx < 16 && Math.abs(dy) < 14 && !(f.v.chompCd > 0) && r(S) < 0.05 * lvl) return out(ai, 0, -1, B.SPC); // Mâchouille
    if (ch === 'motisma') { // possession, puis le B de chaque appareil
      const fm = f.v.form;
      if (!(f.v.possCd > 0) && f.grounded && adx > 35 && r(S) < 0.012 * lvl) {
        const dirs = [[0, 1], [f.facing, 0], [0, -1], [-f.facing, 0], [0, 0]];
        const d = dirs[U.randInt(S, 5)];
        push(ai, [[14, d[0], d[1], B.SPC]]); ai.q[0].hold = 1;
        return out(ai, 0, -1, B.SPC);
      }
      if (fm === 'wash' && adx < 16 && Math.abs(dy) < 12 && r(S) < 0.05 * lvl) return out(ai, 0, 0, B.SPC);
      if (fm === 'heat' && adx < 18 && Math.abs(dy) < 14 && r(S) < 0.03 * lvl) { push(ai, [[Math.floor(r(S) * 40), 0, 0, B.SPC], [2, 0, 0, 0]]); ai.q[0].hold = 1; return out(ai, 0, 0, B.SPC); }
      if (fm === 'frost' && adx < 24 && Math.abs(dy) < 10 && r(S) < 0.03 * lvl) return out(ai, 0, 0, B.SPC);
      if (fm === 'frost' && !f.grounded && overStage(S, f.x) && adx < 12 && dy < -10 && r(S) < 0.05 * lvl) return out(ai, 0, -1, B.ATK);
      if (fm === 'mow' && f.grounded && adx > 25 && adx < 90 && Math.abs(dy) < 8 && dx * f.facing > 0 && r(S) < 0.02 * lvl) { push(ai, [[8 + Math.floor(r(S) * 40), 0, 0, 0], [2, 0, 0, B.SPC]]); return out(ai, 0, 0, B.SPC); } // B (charge), puis B (fonce)
      if (fm === 'fan' && adx < 40 && Math.abs(dy) < 14 && dx * f.facing > 0 && !overStage(S, T.x + dir * 25) && r(S) < 0.05 * lvl) { push(ai, [[40, 0, 0, B.SPC], [2, 0, 0, 0]]); ai.q[0].hold = 1; return out(ai, 0, 0, B.SPC); }
    }
    if (ch === 'gromago') { // Coup de Planche : glissade pour tuer, plongeon (spike) au-dessus de la cible au-dessus de la scène
      if (f.grounded && adx > 12 && adx < 45 && Math.abs(dy) < 8 && T.percent > 90 && r(S) < 0.03 * lvl) return out(ai, dir * 0.3, -1, B.SPC);
      if (!f.grounded && !f.v.diveUsed && dy < -12 && dy > -45 && dx * f.facing > 0 && adx < 22 && overStage(S, f.x) && r(S) < 0.05 * lvl) return out(ai, 0, -1, B.SPC);
    }
    if (ch === 'malvalame') {
      if (adx > 12 && adx < 30 && Math.abs(dy) < 10 && !(f.v.bondCd > 0) && r(S) < 0.03 * lvl) return out(ai, 0, -1, B.SPC); // Lien du Destin
      if (f.grounded && adx > 30 && adx < 70 && Math.abs(dy) < 8 && r(S) < 0.015 * lvl) return out(ai, dir, 0, B.SPC); // Ombre Portée
    }
    // Zoning
    const zone = ZONERS[ch] || 0;
    const zoner = ch === 'insecateur' && f.v.form === 'ciz' ? 0 : zone;
    if (adx > 45 && r(S) < zoner) return zoneAttack(S, f, ai, T, dir, lvl);

    // Cible à une autre hauteur (plateformes)
    if (f.grounded && dy > 20 && adx < 45) {
      push(ai, [[6, dir * 0.5, 0, B.JMP], [7, dir * 0.6, 0, 0], [1, 0, 1, B.ATK], [10, dir * 0.4, 0, 0]]);
      ai.q[0].hold = 1;
      return out(ai, dir * 0.5, 0, 0);
    }
    if (f.grounded && dy < -18 && f.plat >= 0 && adx < 50) { push(ai, [[2, 0, -1, 0]]); return out(ai, 0, 0, 0); }

    // Approche
    if (adx > 22) {
      if (!f.grounded) { return out(ai, dir, 0, 0); }
      const k = r(S);
      if (adx < 36 && k < 0.25) { // saut + aérien
        const aer = Math.abs(dy) > 12 && dy > 0 ? [0, 1] : [dir, 0];
        push(ai, [[1, dir * 0.5, 0, B.JMP], [5, dir, 0, 0], [1, aer[0], aer[1], B.ATK], [14, dir * 0.6, 0, 0]]);
        return out(ai, 0, 0, 0);
      }
      if (adx < 32 && k < 0.45 && (a === 'run' || a === 'dash')) return out(ai, dir, 0, B.ATK); // attaque en courant
      if (adx < 30 && k < 0.55 && (a === 'run' || a === 'dash')) return out(ai, dir, 0, B.GRB);
      ai.msx = dir;
      return out(ai, dir, 0, 0);
    }

    // Au contact
    if (dir !== f.facing && f.grounded) { return out(ai, dir * 0.4, 0, 0); }
    if (!f.grounded) {
      if (dy > 8) return out(ai, 0, 1, B.ATK);
      if (dy < -8) return out(ai, 0, -1, B.ATK);
      return out(ai, dir, 0, B.ATK);
    }
    const k = r(S);
    const pct = T.percent;
    const killy = pct > 90 + (T.stat ? 0 : 0);
    if (dy > 14) {
      if (k < 0.5) return out(ai, 0, 0.5, B.ATK);
      if (k < 0.8) return out(ai, 0, 0, 0, 0, 1);
      push(ai, [[1, 0, 0, B.JMP], [4, 0, 0, 0], [1, 0, 1, B.ATK]]); return out(ai, 0, 0, 0);
    }
    if (T.action === 'shield' && k < 0.6) return out(ai, 0, 0, B.GRB);
    if (T.action === 'hit' && T.hitstun > 6) { // enchaîner
      if (T.y > f.y + 8) { push(ai, [[1, 0, 0, B.JMP], [4, dir * 0.4, 0, 0], [1, 0, 1, B.ATK]]); return out(ai, 0, 0, 0); }
      return out(ai, 0, 0.5, B.ATK);
    }
    if (killy && k < 0.35) return out(ai, 0, 0, 0, dir, 0);
    if (k < 0.2) return out(ai, 0, 0, B.GRB);
    if (k < 0.4) return out(ai, 0, 0, B.ATK);
    if (k < 0.55) return out(ai, dir * 0.5, 0, B.ATK);
    if (k < 0.68) return out(ai, 0, -0.5, B.ATK);
    if (k < 0.78) return out(ai, dir, 0, B.SPC);
    if (k < 0.86) return out(ai, 0, 0, B.SPC);
    if (k < 0.93) return out(ai, 0, 0, 0, 0, -1);
    push(ai, [[1, 0, 0, B.JMP], [4, dir * 0.5, 0, 0], [1, dir, 0, B.ATK], [10, 0, 0, 0]]);
    return out(ai, 0, 0, 0);
  };

  function aimTo(f, tx, ty) {
    const st = G.ST(f);
    const dx = tx - f.x, dy = ty - (f.y + st.h * 0.55);
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    return [dx / d, dy / d];
  }
  function zoneAttack(S, f, ai, T, dir, lvl) {
    const ch = f.char, tst = G.ST(T);
    const [ax, ay] = aimTo(f, T.x, T.y + tst.h * 0.75);
    if (ch === 'archeduc') {
      const n = 20 + Math.floor(r(S) * 45);
      push(ai, [[n, ax, ay, B.SPC], [2, 0, 0, 0]]); // vise droit sur la cible (360°)
      ai.q[0].hold = 1;
      return out(ai, dir * 0.2, 0, B.SPC);
    }
    if (ch === 'armarouge') {
      const n = 8 + Math.floor(r(S) * 30);
      push(ai, [[n, ax, ay, B.SPC], [2, 0, 0, 0]]); ai.q[0].hold = 1;
      return out(ai, dir * 0.2, 0, B.SPC);
    }
    if (ch === 'malvalame') return out(ai, 0, 0, B.SPC); // Feux Follets : invoque, puis tire
    if (ch === 'motisma') return f.v.form ? out(ai, dir, 0, 0) : out(ai, 0, 0, B.SPC); // Change Éclair seulement en forme normale
    if (ch === 'gromago') {
      const n = 4 + Math.floor(r(S) * 30);
      push(ai, [[n, 0, 0, B.SPC], [2, 0, 0, 0]]); ai.q[0].hold = 1;
      return out(ai, dir * 0.3, 0, B.SPC);
    }
    if (ch === 'meloetta' && !f.v.form) return out(ai, r(S) < 0.5 ? dir : 0, 0, B.SPC);
    return out(ai, r(S) < 0.4 ? dir : 0, 0, B.SPC);
  }

  function throwChoice(S, f, ai, lvl, T) {
    if (f.af < 6 + (9 - lvl)) return out(ai, 0, 0, 0);
    const m = S.stage.main;
    const toEdge = f.x > 0 ? 1 : -1;
    const v = S.fighters[f.grabbing];
    const k = r(S);
    if (v && v.percent < 60 && k < 0.3) return out(ai, 0, 0, B.ATK);
    if (v && v.percent > 100) return out(ai, 0, 1, 0);
    if (Math.abs(f.x) > (m.r - m.l) * 0.2) return out(ai, toEdge, 0, 0);
    return out(ai, 0, k < 0.5 ? -1 : 1, 0);
  }

  function ledgeOption(S, f, ai, lvl) {
    const wait = 10 + Math.floor((9 - lvl) * 4);
    if (f.af < wait) return out(ai, 0, 0, 0);
    const k = r(S);
    if (k < 0.3) return out(ai, 0, 1, 0);
    if (k < 0.55) return out(ai, 0, 0, B.JMP);
    if (k < 0.75) return out(ai, 0, 0, B.SHD);
    if (k < 0.9) return out(ai, 0, 0, B.ATK);
    return out(ai, 0, 0, 0);
  }

  function recover(S, f, ai, lvl, st) {
    const m = S.stage.main;
    const side = f.x > 0 ? 1 : -1;
    const lx = side > 0 ? m.r : m.l;
    const tx = lx - side * 6, ty = m.y + 6;
    const dx = tx - f.x, dy = ty - f.y;
    const toward = Math.sign(dx) || -side;
    const a = f.action;
    if (a === 'help' || a === 'adodge' || (a === 'move' && f.af < 40)) return out(ai, toward, 0, 0);
    const d = Math.sqrt(dx * dx + dy * dy);
    const ch = f.char;
    // saut restant
    if (f.jumps < st.jumps && (f.y < m.y + 6 || Math.abs(dx) > 25) && f.vy < 1.2) return out(ai, toward, 0, B.JMP);
    // récupération horizontale
    const sideRec = { gromago: 1, malvalame: 1, miascarade: 1, insecateur: 1, motisma: 1 }[ch];
    if (sideRec && Math.abs(dx) > 40 && f.y > m.y - 20 && !f.v.surfUsed && !f.v.sb && !f.v.sneakAir && !f.v.plasma && !f.v.qa && !f.v.ih) return out(ai, toward, 0, B.SPC);
    // spécial haut vers le rebord
    if ((f.vy < 0.5 || d > 40) && (f.y < m.y + 4 || Math.abs(dx) > 22)) {
      const [ax, ay] = [dx / (d || 1), dy / (d || 1)];
      const sy = Math.max(0.55, ay);
      push(ai, [[20, ax, sy, 0]]);
      return out(ai, ax * 0.5, sy, B.SPC);
    }
    return out(ai, toward, 0, 0);
  }
  function recoverGlide(S, f, ai) {
    const m = S.stage.main;
    const toward = f.x > 0 ? -1 : 1;
    if (!f.mv.glide) return out(ai, toward * 0.5, 1, 0); // propulsion : stick vers le haut
    const above = f.x > m.l + 6 && f.x < m.r - 6;
    if (above && f.y > m.y + 1) return out(ai, 0, 0, B.SHD); // au-dessus de la scène : on arrête de planer (bouclier)
    const pitch = f.y < m.y + 10 ? 1 : (f.mv.sp > 2.5 ? 0.5 : -0.2);
    return out(ai, f.facing !== toward ? toward : 0, pitch, 0);
  }

})(window.G);
