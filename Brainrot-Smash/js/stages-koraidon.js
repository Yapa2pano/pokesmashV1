'use strict';
// Dos de Koraidon : on se bat sur le dos de Koraidon en Mode Course, lancé à pleine vitesse à travers Paldea.
// Traits qui le font reconnaître : corps rouge à marques blanches en créneaux, gros anneaux noirs façon PNEUS
// (dents blanches) au poitrail et aux hanches, panache de plumes blanches / bleues / roses sur la tête, deux longues
// antennes blanches segmentées qui flottent derrière lui, éventails de plumes blanches sur le dos, queue à crête blanche.
//  - Plateformes : le bout de la queue (bas, à gauche) et le dessus de la tête (haut, à droite).
//  - BRANCHES : sous les arbres, une branche balaie tout le terrain d'avant en arrière. Alerte 1,5 s avant (« ! » à
//    droite + bande rouge) ; branche BASSE (au ras du dos : sauter ou monter sur une plateforme) ou HAUTE (rester au
//    sol). Elle éjecte vers l'arrière.
//  - VOL PLANÉ : toutes les 30 s il saute d'une falaise et plane ~7 s ; ses éventails de plumes s'ouvrent en deux
//    AILES qui servent de plateformes, puis se replient à l'atterrissage (ceux qui sont dessus tombent).
(function (G) {
  const S = G.STAGES, U = G.U;
  const { lin, rad, platform } = G.STG;
  const PI = Math.PI;

  const CYC = 1800, OFF = 1600; // cycle de 30 s ; à « GO ! » (frame 200) on est au début du cycle
  const WING_Y = 28, WINGS = [{ l: -74, r: -34 }, { l: 34, r: 74 }];
  const BR = { len: 135, speed: 6, warn: 90, starts: [240, 600, 960], bands: { low: [0, 11], high: [22, 42] } };
  const BR_HB = { dmg: 8, kbg: 78, bkb: 42, ang: 40, t: 'grass', hitlag: 1 };
  const KS = { P: null }; // dernier état dessiné (pour le décor qui défile)
  const GROUND = -82; // la route, sous ses pieds

  // altitude apparente (décor) et ouverture des ailes selon la position dans le cycle
  function altOf(c) {
    if (c < 1190) return 0;
    if (c < 1260) return 170 * U.smooth((c - 1190) / 70);
    if (c < 1660) return 170 - 90 * (c - 1260) / 400;
    if (c < 1730) return 80 * (1 - U.smooth((c - 1660) / 70));
    return 0;
  }
  function wingOf(c) {
    if (c < 1200 || c >= 1710) return 0;
    if (c < 1230) return U.smooth((c - 1200) / 30);
    if (c < 1680) return 1;
    return 1 - U.smooth((c - 1680) / 30);
  }
  function branchAt(S2, c) { // { kind, x } pendant le balayage, { kind, warn } pendant l'alerte
    const n = Math.floor((S2.frame + OFF) / CYC);
    for (let k = 0; k < BR.starts.length; k++) {
      const w0 = BR.starts[k], s0 = w0 + BR.warn, kind = (n * 3 + k) % 2 ? 'high' : 'low';
      if (c >= w0 && c < s0) return { kind, warn: (c - w0) / BR.warn, k, s0 };
      if (c >= s0 && c < s0 + 115) return { kind, x: 250 - (c - s0) * BR.speed, k, s0 };
    }
    return null;
  }

  // ---------- dessin ----------
  // plume : racine (x, y), angle (radians), longueur, demi-largeur ; dégradé de la base à la pointe
  function feather(ctx, x, y, a, len, wd, c0, c1, ink) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.45, wd * 1.2, len, 0); ctx.quadraticCurveTo(len * 0.45, -wd * 1.2, 0, 0); ctx.closePath();
    ctx.fillStyle = c1 ? lin(ctx, 0, 0, len, 0, [[0, c0], [1, c1]]) : c0; ctx.fill();
    ctx.strokeStyle = ink || 'rgba(70,64,80,0.75)'; ctx.lineWidth = 0.45; ctx.stroke();
    ctx.strokeStyle = 'rgba(120,112,130,0.5)'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(len * 0.08, 0); ctx.lineTo(len * 0.9, 0); ctx.stroke();
    ctx.restore();
  }
  // éventail de plumes blanches (racine, angle de départ, étalement, nombre)
  function fan(ctx, x, y, a0, spread, n, len, wd) {
    for (let i = n - 1; i >= 0; i--) {
      const a = a0 + (n > 1 ? spread * i / (n - 1) : 0);
      feather(ctx, x, y, a, len * (0.82 + 0.18 * Math.sin(i * 1.7 + 1)), wd, '#d9c9e6', '#fbfaf8');
    }
    ctx.fillStyle = '#c64a9a'; ctx.beginPath(); ctx.arc(x, y, wd * 0.9, 0, 7); ctx.fill(); // base rose
  }
  // anneau noir « pneu » à dents blanches
  function tire(ctx, x, y, R, th, rot) {
    ctx.fillStyle = lin(ctx, x, y + R, x, y - R, [[0, '#4a4650'], [0.5, '#2a2730'], [1, '#18161c']]);
    ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(10,8,12,0.9)'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = '#f2efea'; ctx.strokeStyle = 'rgba(60,55,65,0.7)'; ctx.lineWidth = 0.35;
    const n = 9, ri = R - th;
    for (let i = 0; i < n; i++) { // dents blanches sur le bord intérieur, pointées vers le centre
      const a = rot + i * 2 * PI / n, b = PI / n * 0.55;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a - b) * (ri + 0.6), y + Math.sin(a - b) * (ri + 0.6)); ctx.lineTo(x + Math.cos(a + b) * (ri + 0.6), y + Math.sin(a + b) * (ri + 0.6)); ctx.lineTo(x + Math.cos(a) * (ri - th * 0.75), y + Math.sin(a) * (ri - th * 0.75)); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = lin(ctx, x, y + ri, x, y - ri, [[0, '#f0503e'], [1, '#a92019']]); // moyeu rouge (le corps)
    ctx.beginPath(); ctx.arc(x, y, ri - th * 0.72, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x, y, R - 1.2, PI * 0.15, PI * 0.75); ctx.stroke();
  }
  // jambe (cuisse + tibia, genou vers l'avant) et pied à 3 griffes blanches
  function leg(ctx, hx, hy, fx, fy, back) {
    const L1 = 33, L2 = 32;
    let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy);
    if (d > L1 + L2 - 0.5) { const k = (L1 + L2 - 0.5) / d; dx *= k; dy *= k; d = L1 + L2 - 0.5; fx = hx + dx; fy = hy + dy; }
    const base = Math.atan2(dy, dx), a = Math.acos(U.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const kx = hx + Math.cos(base + a) * L1, ky = hy + Math.sin(base + a) * L1; // genou vers l'avant (+x)
    const c = back ? '#9a2018' : '#dd3428', cd = back ? '#6a140f' : '#931c16';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = cd; ctx.lineWidth = 17.5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = 10.5; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.strokeStyle = c; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
    if (!back) { // marque blanche en créneaux sur la cuisse
      ctx.save(); ctx.translate((hx + kx) / 2, (hy + ky) / 2); ctx.rotate(Math.atan2(ky - hy, kx - hx));
      ctx.fillStyle = '#f4f1ec'; ctx.beginPath(); ctx.moveTo(-9, 3); ctx.lineTo(9, 3); ctx.lineTo(9, -1); ctx.lineTo(5, -1); ctx.lineTo(5, 1.5); ctx.lineTo(1, 1.5); ctx.lineTo(1, -1); ctx.lineTo(-3, -1); ctx.lineTo(-3, 1.5); ctx.lineTo(-9, 1.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(fx + 3, fy + 1.5, 8, 3.4, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(40,8,6,0.7)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = back ? '#c9c4c0' : '#f4f1ec';
    for (const ox of [5, 9, 12.5]) { ctx.beginPath(); ctx.moveTo(fx + ox - 1.6, fy + 0.4); ctx.lineTo(fx + ox + 1.6, fy + 0.4); ctx.lineTo(fx + ox + 2.6, fy - 1.2); ctx.closePath(); ctx.fill(); }
  }
  // antenne blanche segmentée (courbe de Bézier)
  function streamer(ctx, pts, ph) {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = pts;
    const at = (u) => { const v = 1 - u; return [v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3, v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3]; };
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
    ctx.strokeStyle = 'rgba(95,88,105,0.85)'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.strokeStyle = '#f7f5f2'; ctx.lineWidth = 1.7; ctx.stroke();
    ctx.strokeStyle = 'rgba(110,100,120,0.75)'; ctx.lineWidth = 0.35;
    for (let i = 1; i < 26; i++) { // segments
      const u = i / 26, [px, py] = at(u), [qx, qy] = at(u + 0.01), a = Math.atan2(qy - py, qx - px) + PI / 2;
      const r = 1.0 * (1 - u * 0.4);
      ctx.beginPath(); ctx.moveTo(px - Math.cos(a) * r, py - Math.sin(a) * r); ctx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r); ctx.stroke();
    }
    void ph;
  }
  // tête (de profil, vers la droite) avec son panache
  function head(ctx, x, y, t, gl) {
    ctx.save(); ctx.translate(x, y);
    // panache : plumes blanches dressées vers l'arrière, puis bleues et roses vers l'avant
    const flap = Math.sin(t * 7) * 0.05 * (1 - gl) + gl * 0.12;
    for (let i = 0; i < 6; i++) feather(ctx, -5, 7, (96 + i * 14) * PI / 180 + flap, 20 + (i % 2) * 5, 2.6, '#cfc7da', '#fbfaf8');
    for (let i = 0; i < 4; i++) feather(ctx, -1, 8, (62 + i * 11) * PI / 180 + flap * 0.6, 13 + (i % 2) * 2, 2.1, '#2b3fb0', i < 2 ? '#e24fae' : '#5a78ec');
    // crâne
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-12, 3); ctx.quadraticCurveTo(-9, 9.5, 0, 9.5); ctx.quadraticCurveTo(10, 9, 17, 4); ctx.quadraticCurveTo(21, 1.5, 20, -1.5);
    ctx.lineTo(10, -3); ctx.quadraticCurveTo(14, -6, 12, -8); ctx.quadraticCurveTo(0, -10, -8, -7); ctx.quadraticCurveTo(-13, -3, -12, 3); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 9.5, 0, -9, [[0, '#f4523f'], [0.6, '#d8301f'], [1, '#9c1d15']]); ctx.fill();
    ctx.strokeStyle = 'rgba(50,8,6,0.85)'; ctx.lineWidth = 0.7; ctx.stroke();
    // gueule entrouverte, crocs blancs
    ctx.fillStyle = '#5a0c0c'; ctx.beginPath(); ctx.moveTo(19.5, -1.4); ctx.lineTo(8, -3.2); ctx.lineTo(11, -5.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; for (const fx of [10.5, 14, 17]) { ctx.beginPath(); ctx.moveTo(fx - 0.9, -2.4 + (fx - 10) * 0.08); ctx.lineTo(fx + 0.9, -2.2 + (fx - 10) * 0.08); ctx.lineTo(fx, -4); ctx.closePath(); ctx.fill(); }
    // arcade sourcilière sombre et œil jaune à pupille fendue (regard décidé)
    ctx.fillStyle = '#8a1912'; ctx.beginPath(); ctx.moveTo(-1, 6.6); ctx.quadraticCurveTo(5, 8, 11, 5); ctx.lineTo(10, 3.6); ctx.quadraticCurveTo(5, 5.6, -0.5, 4.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd43a'; ctx.beginPath(); ctx.ellipse(5.2, 3.0, 3.1, 1.9, -0.12, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2a0806'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = '#1a0606'; ctx.beginPath(); ctx.ellipse(6.0, 2.9, 0.55, 1.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(4.5, 3.6, 0.45, 0, 7); ctx.fill();
    ctx.fillStyle = '#5a0c0c'; ctx.beginPath(); ctx.arc(17.5, 2.6, 0.55, 0, 7); ctx.fill(); // narine
    // petites écailles blanches en créneaux sur la joue
    ctx.fillStyle = '#f4f1ec'; ctx.beginPath(); ctx.moveTo(-9, -1); ctx.lineTo(-3, -1); ctx.lineTo(-3, -3); ctx.lineTo(-5, -3); ctx.lineTo(-5, -5); ctx.lineTo(-9, -4.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // Koraidon complet (les plateformes sont dessinées par-dessus)
  // ailes déployées (vol plané) : les plumes partent du dos et leurs pointes forment la plateforme
  function wings(ctx, wa) {
    for (const [w, sgn] of [[WINGS[0], -1], [WINGS[1], 1]]) {
      const rx = sgn * 16, ry = -3, n = 8;
      for (let i = 0; i < n; i++) {
        const tx = w.l + (w.r - w.l) * i / (n - 1), ty = WING_Y - 1.2;
        const ex = U.lerp(rx + sgn * (20 + 14 * i / n), tx, wa), ey = U.lerp(ry - 14, ty, wa);
        const a = Math.atan2(ey - ry, ex - rx), len = Math.hypot(ex - rx, ey - ry) + 3;
        feather(ctx, rx, ry, a, len, 2.6 + wa * 1.1, '#d6c4e4', '#fbfaf8');
      }
      ctx.fillStyle = '#c64a9a'; ctx.beginPath(); ctx.arc(rx, ry, 3.2, 0, 7); ctx.fill();
      for (let i = 0; i < 3; i++) feather(ctx, rx, ry, (sgn > 0 ? 70 - i * 12 : 110 + i * 12) * PI / 180, 9, 1.6, '#2b3fb0', i ? '#5a78ec' : '#e24fae');
    }
  }

  function koraidon(ctx, P, t, c) {
    const gl = wingOf(c), run = 1 - gl, ph = t * 9.5;
    const plT = P.plats[0], plH = P.plats[1];
    if (gl > 0.02) wings(ctx, gl); // ailes déployées (derrière le corps)
    // antennes blanches : elles montent du panache puis flottent loin derrière, haut dans le ciel
    const hx = (plH.l + plH.r) / 2 + 1, hy = plH.y - 11.5;
    const wv = Math.sin(t * 3.2) * 5, wv2 = Math.sin(t * 3.2 + 1.3) * 6;
    ctx.globalAlpha = 0.9;
    streamer(ctx, [hx - 8, hy + 12, hx - 14, hy + 70, hx - 60, hy + 74 + wv, hx - 118, hy + 92 + wv2 + gl * 8], ph);
    streamer(ctx, [hx - 5, hy + 13, hx - 4, hy + 78, hx - 44, hy + 90 + wv2, hx - 96, hy + 108 + wv + gl * 8], ph + 1);
    ctx.globalAlpha = 1;
    // jambe du fond
    const hip = { x: -16, y: -24 }, gy = GROUND;
    const legAt = (p) => run > 0.01 // en vol : jambes repliées vers l'arrière, sous le ventre
      ? [U.lerp(hip.x - 58, hip.x - 24 * Math.cos(p), run), U.lerp(hip.y - 22, gy + Math.max(0, Math.sin(p)) * 20, run)]
      : [hip.x - 58, hip.y - 22];
    const fb = legAt(ph + PI), ff = legAt(ph);
    leg(ctx, hip.x - 4, hip.y, fb[0] - 4, fb[1], true);
    // queue (la pointe sert de plateforme)
    ctx.beginPath(); ctx.moveTo(-86, 0); ctx.quadraticCurveTo(-100, 2, plT.r, plT.y); ctx.lineTo(plT.l, plT.y); ctx.lineTo(plT.l - 9, plT.y + 1.5);
    ctx.quadraticCurveTo(plT.l - 6, plT.y - 3, plT.l + 2, plT.y - 4.5); ctx.quadraticCurveTo(-104, -6, -84, -24); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, plT.y, 0, -24, [[0, '#f0503e'], [1, '#9c1d15']]); ctx.fill();
    ctx.strokeStyle = 'rgba(50,8,6,0.8)'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = '#f4f1ec'; ctx.strokeStyle = 'rgba(80,70,80,0.6)'; ctx.lineWidth = 0.35; // crête blanche dentelée sous la queue
    for (let i = 0; i < 7; i++) { const x = -92 - i * 6.2, y = -14 + i * 2.1 - (i > 3 ? (i - 3) * 0.8 : 0); ctx.beginPath(); ctx.moveTo(x + 2.4, y + 0.6); ctx.lineTo(x - 2.4, y + 1.2); ctx.lineTo(x - 0.6, y - 3.4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    for (let i = 0; i < 3; i++) { const x = plT.l - 2 - i * 3.2; ctx.beginPath(); ctx.moveTo(x + 1.6, plT.y - 0.5 - i * 0.6); ctx.lineTo(x - 1.6, plT.y - 0.2 - i * 0.6); ctx.lineTo(x - 1, plT.y + 3.4 - i * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    // corps : poitrail massif à l'avant, taille plus fine, hanches rondes
    ctx.beginPath(); ctx.moveTo(-88, 0); ctx.lineTo(86, 0); ctx.quadraticCurveTo(104, -3, 104, -20); ctx.quadraticCurveTo(103, -40, 82, -45);
    ctx.quadraticCurveTo(48, -48, 28, -36); ctx.quadraticCurveTo(2, -29, -28, -34); ctx.quadraticCurveTo(-62, -42, -80, -30); ctx.quadraticCurveTo(-94, -18, -88, 0); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 0, 0, -46, [[0, '#ee4a38'], [0.55, '#cf2c20'], [1, '#8f1a13']]); ctx.fill();
    ctx.strokeStyle = 'rgba(50,8,6,0.85)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(232,226,232,0.92)'; ctx.beginPath(); ctx.ellipse(60, -50, 40, 11, 0.05, 0, 7); ctx.fill(); // dessous clair du poitrail
    ctx.beginPath(); ctx.ellipse(-40, -42, 32, 8, -0.05, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(120,20,14,0.35)'; ctx.lineWidth = 0.5; // muscles
    ctx.beginPath(); ctx.moveTo(30, -4); ctx.quadraticCurveTo(46, -22, 36, -36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30, -6); ctx.quadraticCurveTo(-20, -18, -28, -30); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(-90, -5, 195, 2.2);
    ctx.restore();
    // marque blanche en éclair (créneaux) sur l'épaule, comme sur son bras
    ctx.fillStyle = '#f4f1ec'; ctx.strokeStyle = 'rgba(80,20,15,0.5)'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.moveTo(44, -10); ctx.lineTo(52, -8); ctx.lineTo(52, -12); ctx.lineTo(58, -10); ctx.lineTo(58, -14); ctx.lineTo(66, -12); ctx.lineTo(64, -17); ctx.lineTo(56, -18); ctx.lineTo(56, -15); ctx.lineTo(50, -16.5); ctx.lineTo(50, -13.5); ctx.lineTo(43, -14.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#dd3428'; ctx.fillRect(53, -14.2, 2.2, 2.2); ctx.fillRect(59.5, -15.2, 2.2, 2.2);
    // éventails de plumes blanches repliés sur le flanc (ils s'ouvrent en ailes pour planer)
    if (gl < 0.5) {
      ctx.globalAlpha = 1 - gl * 2;
      fan(ctx, 22, -4, 196 * PI / 180, 30 * PI / 180, 6, 30, 2.6);
      fan(ctx, -50, -4, 194 * PI / 180, 26 * PI / 180, 5, 24, 2.4);
      ctx.globalAlpha = 1;
    }
    // touffes bleues / violettes aux hanches
    for (let i = 0; i < 5; i++) feather(ctx, -66 + i * 3, -8 - i * 1.5, (205 + i * 9) * PI / 180, 8 + (i % 2) * 2, 1.5, '#22339a', i % 2 ? '#7a4cc8' : '#4a6ae6');
    // pneu des hanches
    const rot = t * 7 * run + t * 1.2;
    tire(ctx, -50, -22, 15, 5, -rot);
    // jambe de devant
    leg(ctx, hip.x + 4, hip.y - 2, ff[0] + 4, ff[1], false);
    // cou + crinière bleue
    ctx.beginPath(); ctx.moveTo(80, -2); ctx.quadraticCurveTo(92, 4, hx - 12, hy + 4); ctx.lineTo(hx - 2, hy - 9); ctx.quadraticCurveTo(108, -6, 104, -18); ctx.closePath();
    ctx.fillStyle = lin(ctx, 84, 0, 112, 0, [[0, '#c92b1f'], [1, '#e8402f']]); ctx.fill(); ctx.strokeStyle = 'rgba(50,8,6,0.85)'; ctx.lineWidth = 0.7; ctx.stroke();
    for (let i = 0; i < 7; i++) { // plumes bleues le long de la nuque
      const u = i / 6, x = U.lerp(84, hx - 12, u), y = U.lerp(0, hy + 3, u);
      feather(ctx, x, y, (150 - i * 6) * PI / 180, 10 + (i % 2) * 3, 1.8, '#22339a', i % 3 === 1 ? '#7a4cc8' : '#4a6ae6');
    }
    // GROS pneu en col, à la base du cou
    tire(ctx, 94, -12, 23, 7, rot);
    // bras replié sous le poitrail (tendu vers l'avant en vol)
    const ax = 108 + gl * 8, ay = -40 + gl * 12;
    ctx.strokeStyle = '#931c16'; ctx.lineCap = 'round'; ctx.lineWidth = 7.5; ctx.beginPath(); ctx.moveTo(98, -30); ctx.quadraticCurveTo(110, -32, ax, ay); ctx.stroke();
    ctx.strokeStyle = '#dd3428'; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = '#f4f1ec'; for (const o of [-2.2, 0, 2.2]) { ctx.beginPath(); ctx.moveTo(ax + o - 0.9, ay); ctx.lineTo(ax + o + 0.9, ay); ctx.lineTo(ax + o + 0.7, ay - 3.8); ctx.closePath(); ctx.fill(); }
    // tête
    ctx.save(); ctx.translate(hx, hy); ctx.scale(1.25, 1.25); head(ctx, 0, 0, t, gl); ctx.restore();
  }

  function ground(ctx, gy, c, t) { // route de terre de Paldea qui défile (en coordonnées du monde)
    if (gy < -260) return;
    const sc = (t * 70) % 40;
    // falaise avant le saut : le sol s'arrête à cliffX
    const cliffX = c >= 1130 && c < 1260 ? 330 - (c - 1130) * 4.5 : 9999;
    const L = -700, Rr = Math.min(700, cliffX);
    ctx.fillStyle = lin(ctx, 0, gy, 0, gy - 60, [[0, '#c9a46a'], [0.2, '#a9824e'], [1, '#6e5233']]); ctx.fillRect(L, gy, Rr - L, -200);
    ctx.fillStyle = '#7fbf4a'; ctx.fillRect(L, gy, Rr - L, 1.4); // herbe au bord de la route
    ctx.fillStyle = 'rgba(80,55,30,0.35)';
    for (let x = L - sc; x < Rr; x += 40) { ctx.beginPath(); ctx.ellipse(x, gy - 5, 6, 1, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 21, gy - 11, 9, 1.2, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#5f9f3a';
    for (let x = L - (t * 70 % 23); x < Rr; x += 23) { ctx.beginPath(); ctx.moveTo(x, gy + 1); ctx.lineTo(x + 1.2, gy + 3.6); ctx.lineTo(x + 2.4, gy + 1); ctx.closePath(); ctx.fill(); }
    if (cliffX < 700) { // bord de la falaise
      ctx.fillStyle = '#6e5233'; ctx.beginPath(); ctx.moveTo(cliffX, gy + 1.4); ctx.lineTo(cliffX + 6, gy - 20); ctx.lineTo(cliffX + 2, gy - 60); ctx.lineTo(cliffX - 4, gy - 200); ctx.lineTo(cliffX - 30, gy - 200); ctx.lineTo(cliffX - 30, gy + 1); ctx.closePath(); ctx.fill();
    }
    // poussière soulevée par la course
    if (gy > GROUND - 4) {
      for (let i = 0; i < 6; i++) { const k = (t * 1.6 + i / 6) % 1; ctx.fillStyle = `rgba(230,210,170,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(-20 - k * 90, gy + 3 + k * 10, 3 + k * 9, 0, 7); ctx.fill(); }
    }
  }

  S.koraidon = {
    id: 'koraidon', name: 'Dos de Koraidon', sub: 'Plaines de Paldea', music: 8,
    phys: {
      main: { l: -86, r: 86, y: 0, bottom: -30 },
      // 0 = bout de la queue, 1 = dessus de la tête, 2-3 = ailes (seulement en vol plané ; y -9999 = absentes)
      plats: [{ l: -134, r: -110, y: 10 }, { l: 104, r: 127, y: 28 }, { l: WINGS[0].l, r: WINGS[0].r, y: -9999 }, { l: WINGS[1].l, r: WINGS[1].r, y: -9999 }],
      blast: { l: -285, r: 285, t: 205, b: -150 }, cam: { l: -230, r: 230, t: 160, b: -98 },
      respawn: [0, 80], spawns: [[-60, 0, -1], [60, 0, -1], [-22, 0, -1], [22, 0, -1]], spawns2: [[-45, 0, -1], [45, 0, -1]],
    },
    tick(S2) {
      const P = S2.stage, c = (S2.frame + OFF) % CYC;
      P.c = c;
      // ailes : plateformes pendant le vol plané
      const open = c >= 1222 && c < 1690;
      for (let i = 2; i <= 3; i++) {
        const p = P.plats[i], want = open ? WING_Y : -9999;
        if (p.y === want) continue;
        if (!open) for (const f of S2.fighters) if (!f.dead && f.grounded && f.plat === i) G.goAir(S2, f);
        p.y = want;
      }
      if (c === 1196) S2.events.push({ t: 'stage', name: 'roar', k: 'korr' + S2.frame });
      if (c === 1716) S2.events.push({ t: 'stage', name: 'thud', k: 'korl' + S2.frame });
      // branches
      const br = branchAt(S2, c);
      P.br = null; P.warn = null;
      if (!br || S2.phase !== 'play') return;
      if (br.warn != null) {
        P.warn = { kind: br.kind, u: br.warn };
        if (c === BR.starts[br.k]) S2.events.push({ t: 'stage', name: 'warn', k: 'korw' + S2.frame });
        return;
      }
      if (c === br.s0) { P.bh = 0; S2.events.push({ t: 'stage', name: 'whoosh', k: 'korb' + S2.frame }); }
      P.br = { kind: br.kind, x: br.x };
      const [y0, y1] = BR.bands[br.kind], x0 = br.x, x1 = br.x + BR.len;
      for (const f of S2.fighters) {
        if (f.dead || f.out || f.invinc > 0 || f.intang > 0 || (P.bh >> f.slot) & 1) continue;
        const hu = G.hurtbox(S2, f);
        if (hu.x + hu.r < x0 || hu.x - hu.r > x1 || hu.y1 + hu.r < y0 || hu.y0 - hu.r > y1) continue;
        P.bh |= 1 << f.slot;
        const wy = U.clamp((y0 + y1) / 2, hu.y0, hu.y1);
        G.applyHit(S2, { att: null, tgt: f, hb: BR_HB, key: 'kor' + S2.frame, clock: 0, x: hu.x, y: wy, dir: -1, wx: hu.x, wy });
      }
    },
    bgStatic(ctx, w, h) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#3f8fe8'], [0.45, '#8fd0ff'], [0.7, '#e6f6ff'], [1, '#f6ead0']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rad(ctx, w * 0.82, h * 0.18, 0, h * 0.4, [[0, 'rgba(255,255,230,0.95)'], [0.12, 'rgba(255,250,210,0.5)'], [1, 'rgba(255,255,255,0)']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fffbea'; ctx.beginPath(); ctx.arc(w * 0.82, h * 0.18, h * 0.04, 0, 7); ctx.fill();
    },
    bgLayers: [],
    bgDynamic(ctx, w, h, t) {
      const P = KS.P, c = P && P.c != null ? P.c : 300, alt = altOf(c);
      const dy = alt / 170 * h * 0.45; // en vol, l'horizon descend
      const ridgeAt = (base, amp, seed, col, step, off) => {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h + 10);
        for (let x = 0; x <= w + step; x += step) {
          const X = x + off;
          const n = Math.sin(X * 0.004 + seed) * 0.5 + Math.sin(X * 0.011 + seed * 2.3) * 0.3 + Math.sin(X * 0.027 + seed * 5.1) * 0.2;
          ctx.lineTo(x, base - n * amp);
        }
        ctx.lineTo(w, h + 10); ctx.closePath(); ctx.fill();
      };
      // très loin : montagnes bleutées (la grande cavité de la Zone Zéro au milieu)
      ridgeAt(h * 0.58 + dy * 0.6, h * 0.1, 1.3, 'rgba(120,150,200,0.75)', 14, t * 6);
      ctx.fillStyle = 'rgba(70,90,140,0.55)'; ctx.beginPath(); ctx.ellipse(((w * 0.5 - t * 6) % (w * 2) + w * 2) % (w * 2) - w * 0.3, h * 0.6 + dy * 0.6, w * 0.22, h * 0.035, 0, 0, 7); ctx.fill();
      // collines vertes, champs et villages
      ridgeAt(h * 0.66 + dy * 0.8, h * 0.06, 4.1, '#7fb560', 12, t * 40);
      ctx.fillStyle = 'rgba(240,200,90,0.55)';
      for (let i = 0; i < 6; i++) { const x = ((i * 271 - t * 40) % (w + 300) + w + 300) % (w + 300) - 150; ctx.beginPath(); ctx.ellipse(x, h * 0.7 + dy * 0.85, 70, 8, 0, 0, 7); ctx.fill(); }
      ridgeAt(h * 0.74 + dy, h * 0.05, 7.7, '#5f9a48', 10, t * 110);
      // arbres qui défilent vite
      for (let i = 0; i < 9; i++) {
        const x = ((i * 197 - t * 160) % (w + 200) + w + 200) % (w + 200) - 100, b = h * 0.78 + dy * 1.1, H = h * (0.08 + (i % 3) * 0.02);
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(x - H * 0.05, b - H * 0.5, H * 0.1, H * 0.5);
        ctx.fillStyle = i % 2 ? '#3f7d3a' : '#4d8f42'; ctx.beginPath(); ctx.ellipse(x, b - H * 0.62, H * 0.32, H * 0.36, 0, 0, 7); ctx.fill();
      }
      // nuages (plus nombreux et sous nous pendant le vol)
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 6; i++) {
        const x = ((i * 380 - t * (30 + i * 8)) % (w + 400) + w + 400) % (w + 400) - 200, y = h * (0.08 + (i % 3) * 0.08) + dy * (i % 2 ? 1.6 : 1.2);
        ctx.beginPath(); ctx.ellipse(x, y, 80, 15, 0, 0, 7); ctx.ellipse(x + 44, y - 9, 46, 14, 0, 0, 7); ctx.fill();
      }
    },
    drawStage(ctx, P, t) {
      KS.P = P;
      const c = P.c != null ? P.c : 300, alt = altOf(c);
      ground(ctx, GROUND - alt * 1.6, c, t);
      koraidon(ctx, P, t, c);
      // dessus du dos (le terrain) : écailles rouges, bord clair
      const m = P.main;
      ctx.beginPath(); ctx.moveTo(m.l - 1, m.y + 0.6); ctx.lineTo(m.r + 1, m.y + 0.6); ctx.lineTo(m.r, m.y - 4); ctx.lineTo(m.l, m.y - 4); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 0, -4, [[0, '#ff7a5c'], [1, '#d63a26']]); ctx.fill();
      ctx.strokeStyle = 'rgba(60,8,6,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(140,20,14,0.45)'; ctx.lineWidth = 0.35;
      for (let x = m.l + 6; x < m.r; x += 7) { ctx.beginPath(); ctx.moveTo(x, -0.4); ctx.quadraticCurveTo(x + 3.5, -2.6, x + 7, -0.4); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(m.l, m.y + 0.3); ctx.lineTo(m.r, m.y + 0.3); ctx.strokeStyle = '#ffd9c8'; ctx.lineWidth = 0.7; ctx.stroke();
      // plateformes
      const red = (p) => lin(ctx, 0, p.y, 0, p.y - 2.6, [[0, '#ff7a5c'], [1, '#b8281c']]);
      platform(ctx, P.plats[0], red(P.plats[0]), '#ffd9c8', 2.4);
      platform(ctx, P.plats[1], red(P.plats[1]), '#ffd9c8', 2.2);
      for (let i = 2; i <= 3; i++) if (P.plats[i].y > -999) platform(ctx, P.plats[i], lin(ctx, 0, WING_Y, 0, WING_Y - 2.4, [[0, '#ffffff'], [1, '#c9bfd6']]), '#ffffff', 2.2);
    },
    drawFront(ctx, P, t) {
      const c = P.c != null ? P.c : 300, gl = wingOf(c);
      const cam = G.R && G.R.cam;
      // lignes de vitesse (plus fortes en vol)
      ctx.strokeStyle = `rgba(255,255,255,${0.25 + gl * 0.35})`; ctx.lineWidth = 0.5;
      for (let i = 0; i < 10; i++) { const x = 260 - ((t * 420 + i * 97) % 560), y = -60 + ((i * 53) % 170); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18 + (i % 3) * 8, y); ctx.stroke(); }
      // alerte de branche : bande rouge sur la zone touchée + « ! » au bord droit de l'écran
      if (P.warn) {
        const [y0, y1] = BR.bands[P.warn.kind], blink = Math.sin(t * 22) > -0.2;
        ctx.save(); ctx.beginPath(); ctx.rect(-170, y0, 340, y1 - y0); ctx.clip();
        ctx.fillStyle = `rgba(255,40,30,${0.16 + 0.14 * P.warn.u})`; ctx.fillRect(-170, y0, 340, y1 - y0);
        ctx.fillStyle = `rgba(255,220,60,${0.22 + 0.18 * P.warn.u})`; // rayures de danger qui défilent
        for (let x = -190 - (t * 30 % 12); x < 180; x += 12) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + 5, y0); ctx.lineTo(x + 5 + (y1 - y0), y1); ctx.lineTo(x + (y1 - y0), y1); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        ctx.strokeStyle = `rgba(255,60,40,${0.6 + 0.3 * P.warn.u})`; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(-170, y0); ctx.lineTo(170, y0); ctx.moveTo(-170, y1); ctx.lineTo(170, y1); ctx.stroke();
        const ex = cam ? cam.x + cam.w / 2 - 9 : 150, ey = (y0 + y1) / 2;
        if (blink) {
          ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#7a1200'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(ex, ey + 8); ctx.lineTo(ex + 7.5, ey - 5); ctx.lineTo(ex - 7.5, ey - 5); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.save(); ctx.scale(1, -1); ctx.fillStyle = '#7a1200'; ctx.font = '900 9px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', ex, -ey + 3.6); ctx.restore();
        }
      }
      // branche qui balaie le terrain (de droite à gauche)
      if (P.br) {
        const [y0, y1] = BR.bands[P.br.kind], x0 = P.br.x, yc = (y0 + y1) / 2, th = (y1 - y0) * 0.45;
        // tronc (au fond, du sol jusqu'en haut)
        ctx.fillStyle = lin(ctx, x0 + BR.len, 0, x0 + BR.len + 22, 0, [[0, '#4a2e18'], [0.5, '#7a5232'], [1, '#3a2412']]);
        ctx.fillRect(x0 + BR.len, -200, 22, 420);
        // branche
        ctx.fillStyle = lin(ctx, 0, yc + th, 0, yc - th, [[0, '#8a5e38'], [1, '#4f3119']]);
        ctx.beginPath(); ctx.moveTo(x0 + BR.len + 2, yc + th * 1.3); ctx.quadraticCurveTo(x0 + BR.len * 0.5, yc + th * 0.9, x0 + 8, yc + th * 0.35); ctx.lineTo(x0, yc); ctx.lineTo(x0 + 8, yc - th * 0.35); ctx.quadraticCurveTo(x0 + BR.len * 0.5, yc - th * 0.8, x0 + BR.len + 2, yc - th * 1.3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(30,18,8,0.8)'; ctx.lineWidth = 0.7; ctx.stroke();
        // feuillage le long de la branche
        for (let i = 0; i < 9; i++) {
          const x = x0 + 6 + i * 14, y = yc + (i % 2 ? 1 : -1) * th * 0.9, r = 5 + (i % 3);
          ctx.fillStyle = '#2f6e2a'; ctx.beginPath(); ctx.arc(x, y - 0.6, r + 0.6, 0, 7); ctx.fill();
          ctx.fillStyle = i % 2 ? '#4f9a3c' : '#5fae48'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(180,230,140,0.5)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y + r * 0.35, r * 0.4, 0, 7); ctx.fill();
        }
      }
    },
  };
})(window.G);
