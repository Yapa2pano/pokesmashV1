'use strict';
// Stages : données physiques (utilisées par la sim) + rendu (décor en parallaxe et scène).
(function (G) {
  const U = G.U;
  const S = G.STAGES = {};
  G.STAGE_ORDER = ['champ', 'final', 'seracrawl', 'torterra', 'ronflex', 'koraidon', 'wailord', 'colonnes', 'oyacata', 'petit', 'arene'];

  // ---------- helpers de dessin ----------
  function lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function rad(ctx, x, y, r0, r1, stops) { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  // Silhouette de montagnes déterministe
  function ridge(ctx, w, h, base, amp, seed, col, step) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h);
    let y = base;
    for (let x = 0; x <= w + step; x += step) {
      const n = Math.sin(x * 0.004 + seed) * 0.5 + Math.sin(x * 0.011 + seed * 2.3) * 0.3 + Math.sin(x * 0.027 + seed * 5.1) * 0.2;
      y = base - n * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }
  function mesa(ctx, w, h, base, seed, col) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, base);
    let x = 0, i = 0;
    while (x < w) {
      const ww = 60 + ((Math.sin(seed + i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 160;
      const hh = 20 + ((Math.sin(seed + i * 78.233) * 12345.678) % 1 + 1) % 1 * 90;
      ctx.lineTo(x + 10, base - hh); ctx.lineTo(x + ww - 10, base - hh); ctx.lineTo(x + ww, base);
      x += ww; i++;
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }

  // Corps de scène générique : dessus + flancs + dessous effilé
  function stageBody(ctx, m, top, side, under, edge, taper) {
    const d = m.bottom;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(m.l, m.y);
    ctx.lineTo(m.r, m.y);
    ctx.lineTo(m.r, d * 0.45);
    ctx.quadraticCurveTo(m.r - 4, d, m.r * taper, d * 1.6);
    ctx.lineTo(m.l * taper, d * 1.6);
    ctx.quadraticCurveTo(m.l + 4, d, m.l, d * 0.45);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, m.y, 0, d * 1.6, [[0, side], [1, under]]);
    ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
    // bande supérieure
    ctx.beginPath();
    ctx.moveTo(m.l - 1, m.y + 0.6); ctx.lineTo(m.r + 1, m.y + 0.6); ctx.lineTo(m.r, m.y - 4.5); ctx.lineTo(m.l, m.y - 4.5); ctx.closePath();
    ctx.fillStyle = top; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(m.l, m.y + 0.3); ctx.lineTo(m.r, m.y + 0.3); ctx.strokeStyle = edge; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.restore();
  }
  function platform(ctx, p, fill, edge, thick) {
    ctx.save();
    ctx.beginPath();
    const th = thick || 3;
    ctx.moveTo(p.l, p.y); ctx.lineTo(p.r, p.y); ctx.lineTo(p.r - 2, p.y - th); ctx.lineTo(p.l + 2, p.y - th); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.l + 0.5, p.y); ctx.lineTo(p.r - 0.5, p.y); ctx.strokeStyle = edge; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
  }

  // ---------- Champ de Bataille (Paldea au coucher du soleil) ----------
  S.champ = {
    id: 'champ', name: 'Champ de Bataille', sub: 'Mésa de Paldea', music: 0,
    phys: {
      main: { l: -82, r: 82, y: 0, bottom: -24 },
      plats: [{ l: -64, r: -24, y: 28 }, { l: 24, r: 64, y: 28 }, { l: -21, r: 21, y: 55 }],
      blast: { l: -270, r: 270, t: 200, b: -150 }, cam: { l: -220, r: 220, t: 160, b: -95 },
      respawn: [0, 82], spawns: [[-56, 0, -1], [56, 0, -1], [-22, 0, -1], [22, 0, -1]], spawns2: [[-45, 0, -1], [45, 0, -1]],
    },
    bgStatic(ctx, w, h) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#2b1d5c'], [0.35, '#8a3f7a'], [0.62, '#f27b4b'], [0.8, '#ffc36b'], [1, '#ffe0a0']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rad(ctx, w * 0.62, h * 0.66, 0, h * 0.5, [[0, 'rgba(255,245,200,0.95)'], [0.12, 'rgba(255,220,140,0.8)'], [0.4, 'rgba(255,160,90,0.25)'], [1, 'rgba(255,120,80,0)']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff4d8'; ctx.beginPath(); ctx.arc(w * 0.62, h * 0.66, h * 0.06, 0, 7); ctx.fill();
    },
    bgLayers: [
      { par: 0.05, draw(ctx, w, h) { mesa(ctx, w, h, h * 0.72, 3.1, 'rgba(120,60,90,0.55)'); } },
      { par: 0.12, draw(ctx, w, h) {
        // Cratère de la Zone Zéro au loin
        ctx.fillStyle = 'rgba(90,40,80,0.7)'; ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.8, w * 0.28, h * 0.07, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = 'rgba(255,190,120,0.25)'; ctx.beginPath(); ctx.ellipse(w * 0.3, h * 0.8, w * 0.2, h * 0.03, 0, Math.PI, 0); ctx.fill();
        ridge(ctx, w, h, h * 0.8, h * 0.06, 1.7, 'rgba(80,35,70,0.85)', 12);
      } },
      { par: 0.25, draw(ctx, w, h) { mesa(ctx, w, h, h * 0.88, 7.7, '#3d1f45'); } },
    ],
    bgDynamic(ctx, w, h, t) {
      // nuages qui dérivent
      ctx.fillStyle = 'rgba(255,200,190,0.35)';
      for (let i = 0; i < 6; i++) {
        const x = ((i * 337 + t * (8 + i * 2)) % (w + 400)) - 200, y = h * (0.12 + (i % 3) * 0.09);
        ctx.beginPath(); ctx.ellipse(x, y, 120 + i * 18, 14 + (i % 2) * 6, 0, 0, 7); ctx.fill();
      }
      // oiseaux (Étourmi) au loin
      ctx.strokeStyle = 'rgba(60,20,60,0.6)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const x = ((i * 211 + t * 30) % (w + 200)) - 100, y = h * 0.3 + Math.sin(t * 2 + i) * 12 + i * 18;
        const fl = Math.sin(t * 10 + i) * 5;
        ctx.beginPath(); ctx.moveTo(x - 8, y - fl); ctx.lineTo(x, y); ctx.lineTo(x + 8, y - fl); ctx.stroke();
      }
    },
    drawStage(ctx, P, t) {
      const m = P.main;
      stageBody(ctx, m, lin(ctx, 0, 0, 0, -5, [[0, '#7ed957'], [1, '#3f9a3a']]), '#9a6b4a', '#3b2436', '#caff9a', 0.55);
      // détails rocheux
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#5d3a33';
      for (let i = 0; i < 9; i++) { const x = m.l + 10 + i * 15.5, y = -9 - (i % 3) * 5; ctx.beginPath(); ctx.ellipse(x, y, 4 + (i % 2) * 2, 1.6, 0.2, 0, 7); ctx.fill(); }
      ctx.restore();
      // fleurs sur le bord
      for (let i = 0; i < 14; i++) { const x = m.l + 5 + i * 10.3; ctx.fillStyle = i % 3 ? '#ffe36b' : '#ff7fb0'; ctx.beginPath(); ctx.arc(x, 0.9 + Math.sin(t * 2 + i) * 0.15, 0.7, 0, 7); ctx.fill(); }
      P.plats.forEach((p) => platform(ctx, p, lin(ctx, 0, p.y, 0, p.y - 3, [[0, '#d9c4a3'], [1, '#8a6f55']]), '#fff2c9', 3.2));
    },
  };

  // ---------- Destination Finale (Ultra-Dimension) ----------
  S.final = {
    id: 'final', name: 'Destination Finale', sub: 'Ultra-Dimension', music: 1,
    phys: {
      main: { l: -98, r: 98, y: 0, bottom: -34 },
      plats: [],
      blast: { l: -285, r: 285, t: 205, b: -155 }, cam: { l: -230, r: 230, t: 160, b: -100 },
      respawn: [0, 70], spawns: [[-66, 0, -1], [66, 0, -1], [-24, 0, -1], [24, 0, -1]], spawns2: [[-50, 0, -1], [50, 0, -1]],
    },
    bgStatic(ctx, w, h) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#050316'], [0.5, '#170a3a'], [1, '#2c0f4f']]);
      ctx.fillRect(0, 0, w, h);
      const neb = [[0.25, 0.3, '#7b2cff'], [0.75, 0.25, '#ff2d95'], [0.55, 0.7, '#00c2ff']];
      neb.forEach(([x, y, c]) => { ctx.fillStyle = rad(ctx, w * x, h * y, 0, h * 0.5, [[0, U.rgb(U.hex(c), 0.35)], [1, U.rgb(U.hex(c), 0)]]); ctx.fillRect(0, 0, w, h); });
      for (let i = 0; i < 260; i++) {
        const x = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * w, y = ((Math.sin(i * 78.233) * 12345.678) % 1 + 1) % 1 * h;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) * 0.14})`; ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
      }
    },
    bgLayers: [],
    bgDynamic(ctx, w, h, t) {
      // Ultra-Brèche
      const cx = w * 0.5, cy = h * 0.32, R = h * 0.2;
      ctx.save(); ctx.translate(cx, cy);
      for (let i = 0; i < 5; i++) {
        ctx.rotate(t * 0.15 + i);
        ctx.strokeStyle = `hsla(${(t * 40 + i * 60) % 360},100%,70%,0.35)`; ctx.lineWidth = 6 - i;
        ctx.beginPath(); ctx.ellipse(0, 0, R * (1 - i * 0.12), R * 0.45 * (1 - i * 0.1), 0, 0, 7); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = rad(ctx, cx, cy, 0, R * 0.6, [[0, 'rgba(255,255,255,0.8)'], [0.3, 'rgba(160,120,255,0.5)'], [1, 'rgba(80,0,160,0)']]);
      ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.6, R * 0.3, 0, 0, 7); ctx.fill();
      // étoiles filantes
      for (let i = 0; i < 3; i++) {
        const p = ((t * 0.3 + i * 0.37) % 1);
        const x = w * (1.1 - p * 1.4), y = h * (0.1 + i * 0.15) + p * h * 0.3;
        ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - p)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 40, y - 12); ctx.stroke();
      }
    },
    drawStage(ctx, P, t) {
      const m = P.main;
      stageBody(ctx, m, lin(ctx, 0, 0, 0, -5, [[0, '#8fe9ff'], [1, '#3a6fd8']]), '#2a2e6e', '#0b0620', '#e6fbff', 0.35);
      // lignes lumineuses
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.2;
      ctx.strokeStyle = '#6ef0ff'; ctx.lineWidth = 0.5;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 22, -6); ctx.lineTo(i * 14, -40); ctx.stroke(); }
      ctx.restore();
    },
  };

  // ---------- Dos de Séracrawl (terrain plat, lac de montagne enneigé) ----------
  // Chaîne de sommets enneigés (déterministe)
  function peaks(ctx, w, base, maxH, seed, col, snow, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const r1 = ((Math.sin(seed + i * 12.9898) * 43758.5453) % 1 + 1) % 1, r2 = ((Math.sin(seed + i * 78.233) * 12345.678) % 1 + 1) % 1;
      pts.push([i / n * w + (r2 - 0.5) * w / n * 0.5, base - maxH * (0.45 + r1 * 0.55)]);
    }
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, base + 400);
    pts.forEach(([x, y], i) => { if (i) { const [px, py] = pts[i - 1]; ctx.lineTo((px + x) / 2, Math.max(py, y) + maxH * 0.32); } ctx.lineTo(x, y); });
    ctx.lineTo(w, base + 400); ctx.closePath(); ctx.fill();
    ctx.fillStyle = snow; // calottes de neige
    pts.forEach(([x, y]) => { const s = maxH * 0.22; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.75, y + s); ctx.lineTo(x + s * 0.3, y + s * 0.8); ctx.lineTo(x, y + s * 1.05); ctx.lineTo(x - s * 0.35, y + s * 0.78); ctx.lineTo(x - s * 0.8, y + s); ctx.closePath(); ctx.fill(); });
  }
  function pine(ctx, x, b, H, col) {
    ctx.fillStyle = '#4a3020'; ctx.fillRect(x - H * 0.04, b - H * 0.15, H * 0.08, H * 0.15);
    for (let k = 0; k < 3; k++) {
      const y = b - H * (0.12 + k * 0.28), ww = H * (0.34 - k * 0.08);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - ww, y); ctx.lineTo(x, y - H * 0.42); ctx.lineTo(x + ww, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.moveTo(x - ww * 0.45, y - H * 0.24); ctx.lineTo(x, y - H * 0.42); ctx.lineTo(x + ww * 0.45, y - H * 0.24); ctx.closePath(); ctx.fill();
    }
  }
  function chalet(ctx, x, b, sc, seed) {
    const W = 70 * sc, Hh = 38 * sc;
    ctx.fillStyle = seed % 2 ? '#7a4a2a' : '#8d5a32'; ctx.fillRect(x - W / 2, b - Hh, W, Hh);
    ctx.strokeStyle = 'rgba(40,20,10,0.5)'; ctx.lineWidth = 1.2 * sc;
    for (let y = b - Hh + 7 * sc; y < b; y += 7 * sc) { ctx.beginPath(); ctx.moveTo(x - W / 2, y); ctx.lineTo(x + W / 2, y); ctx.stroke(); }
    ctx.fillStyle = '#ffd36a'; // fenêtres allumées
    [[-0.28, 0.45], [0.12, 0.45], [-0.08, 0.15]].forEach(([fx, fy], i) => { if (i < 2 || seed % 3) ctx.fillRect(x + fx * W, b - Hh * (1 - fy) - 6 * sc, 12 * sc, 10 * sc); });
    ctx.fillStyle = '#5a3418'; ctx.beginPath(); ctx.moveTo(x - W * 0.62, b - Hh); ctx.lineTo(x, b - Hh - 34 * sc); ctx.lineTo(x + W * 0.62, b - Hh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4fbff'; ctx.beginPath(); ctx.moveTo(x - W * 0.66, b - Hh + 2 * sc); ctx.lineTo(x, b - Hh - 36 * sc); ctx.lineTo(x + W * 0.66, b - Hh + 2 * sc); ctx.lineTo(x + W * 0.5, b - Hh - 4 * sc); ctx.lineTo(x, b - Hh - 28 * sc); ctx.lineTo(x - W * 0.5, b - Hh - 4 * sc); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6a6a72'; ctx.fillRect(x + W * 0.2, b - Hh - 30 * sc, 8 * sc, 16 * sc); // cheminée
  }
  // Grelaçon sur leur plaque de glace : ils traversent tout le lac, à fleur d'eau, et PLONGENT pour passer sous
  // Séracrawl (et sous le bord de l'écran, d'où ils réapparaissent de l'autre côté). Ce sont des plateformes
  // seulement quand ils sont remontés, hors du terrain : de quoi se rattraper de temps en temps, pas tout le temps.
  // Le n° 0 va de gauche à droite, le n° 1 en miroir. Cycle de 14,5 s ; chaque côté a une plaque environ 40 % du temps.
  const FLOE = { L: 240, v20: 11, half: 13, y: -20, in0: 104, in1: 124, out0: 218, out1: 240, SINK: 14 };
  function floeState(frame, i) {
    const u = ((frame * FLOE.v20) % (FLOE.L * 40)) / 20; // 0,55 unité par frame, en entiers (déterministe)
    const x = i ? FLOE.L - u : u - FLOE.L, a = Math.abs(x);
    const depth = a < FLOE.in1 ? U.clamp((FLOE.in1 - a) / (FLOE.in1 - FLOE.in0), 0, 1) : a > FLOE.out0 ? U.clamp((a - FLOE.out0) / (FLOE.out1 - FLOE.out0), 0, 1) : 0;
    return [x, depth];
  }
  function floe(ctx, x, depth, t, dir, WL) {
    const hw = FLOE.half, y = FLOE.y - depth * FLOE.SINK + Math.sin(t * 1.8 + dir) * 0.25 * (1 - depth);
    ctx.fillStyle = lin(ctx, 0, y, 0, y - 9, [[0, '#cfeefc'], [1, '#5fa9d8']]); // bloc (presque tout sous l'eau)
    ctx.beginPath(); ctx.moveTo(x - hw - 1, y); ctx.lineTo(x + hw + 1, y); ctx.lineTo(x + hw - 2, y - 9); ctx.lineTo(x - hw + 2, y - 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(10,30,60,0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = '#f2fbff'; ctx.beginPath(); ctx.ellipse(x, y, hw + 1.2, 1.4, 0, 0, 7); ctx.fill(); // dessus enneigé
    ctx.strokeStyle = 'rgba(10,30,60,0.45)'; ctx.lineWidth = 0.4; ctx.stroke();
    // Grelaçon à l'arrière de la plaque, regarde dans le sens de la marche
    ctx.save(); ctx.translate(x - dir * (hw - 4), y + 0.4); ctx.scale(dir * 1.15, 1.15);
    ctx.fillStyle = '#7fc8ef'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-3, 6); ctx.lineTo(1, 8.5); ctx.lineTo(5, 5); ctx.lineTo(5, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(10,30,60,0.55)'; ctx.lineWidth = 0.4; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.moveTo(-3.6, 1); ctx.lineTo(-2.2, 5.4); ctx.lineTo(-1, 5); ctx.lineTo(-2.2, 1); ctx.closePath(); ctx.fill();
    if ((t + dir) % 3.7 < 0.13) { ctx.strokeStyle = '#0e2140'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(1.5, 3.4); ctx.lineTo(2.9, 3.4); ctx.stroke(); }
    else { ctx.fillStyle = '#0e2140'; ctx.beginPath(); ctx.arc(2.2, 3.4, 0.7, 0, 7); ctx.fill(); }
    ctx.restore();
    if (depth < 0.95) { // sillage à la surface
      ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - depth)})`;
      for (const e of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + e * (hw + 1.5), WL + 0.3, 2.6 + Math.sin(t * 3 + e) * 0.5, 0.55, 0, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.ellipse(x - dir * (hw + 6), WL + 0.25, 5, 0.4, 0, 0, 7); ctx.fill();
    }
  }
  S.seracrawl = {
    id: 'seracrawl', name: 'Dos de Séracrawl', sub: 'Lac de la station de ski', music: 5,
    phys: {
      main: { l: -98, r: 98, y: 0, bottom: -34 },
      // les 2 plaques de glace des Grelaçon (y -9999 = sous l'eau, inaccessible)
      plats: [{ l: -FLOE.L - FLOE.half, r: -FLOE.L + FLOE.half, y: -9999 }, { l: FLOE.L - FLOE.half, r: FLOE.L + FLOE.half, y: -9999 }],
      blast: { l: -285, r: 285, t: 205, b: -155 }, cam: { l: -230, r: 230, t: 160, b: -100 },
      respawn: [0, 70], spawns: [[-66, 0, -1], [66, 0, -1], [-24, 0, -1], [24, 0, -1]], spawns2: [[-50, 0, -1], [50, 0, -1]],
    },
    tick(S) { // les Grelaçon avancent ; quand ils plongent, ceux qui étaient dessus tombent à l'eau
      const P = S.stage;
      P.fl = P.fl || [[0, 1], [0, 1]];
      for (let i = 0; i < 2; i++) {
        const [x, depth] = floeState(S.frame, i);
        P.fl[i][0] = x; P.fl[i][1] = depth;
        if (depth < 0.3) { movePlat(S, i, x - FLOE.half, x + FLOE.half, FLOE.y); continue; }
        for (const f of S.fighters) if (!f.dead && f.grounded && f.plat === i) G.goAir(S, f);
        const p = P.plats[i]; p.l = x - FLOE.half; p.r = x + FLOE.half; p.y = -9999;
      }
    },
    bgStatic(ctx, w, h) {
      // ciel d'hiver puis lac sous l'horizon
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#4f9ee8'], [0.42, '#a4d4fb'], [0.6, '#e8f6ff'], [0.605, '#5d9fc9'], [1, '#174d78']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rad(ctx, w * 0.78, h * 0.16, 0, h * 0.45, [[0, 'rgba(255,255,235,0.95)'], [0.1, 'rgba(255,250,220,0.6)'], [1, 'rgba(255,255,255,0)']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fffdf0'; ctx.beginPath(); ctx.arc(w * 0.78, h * 0.16, h * 0.045, 0, 7); ctx.fill();
      // reflet du soleil sur le lac
      ctx.fillStyle = 'rgba(255,255,230,0.25)'; ctx.beginPath(); ctx.ellipse(w * 0.78, h * 0.72, w * 0.05, h * 0.12, 0, 0, 7); ctx.fill();
      // très loin : sommets bleutés
      peaks(ctx, w, h * 0.5, h * 0.3, 2.2, 'rgba(150,180,215,0.75)', 'rgba(250,253,255,0.95)', 7);
    },
    bgLayers: [
      { par: 0.05, draw(ctx, w, h) { peaks(ctx, w, h * 0.56, h * 0.26, 5.7, '#7d9cc4', '#f6fbff', 9); } },
      { par: 0.11, draw(ctx, w, h) {
        // la montagne de la station : pistes, forêt, télésiège
        const cx = w * 0.62, b = h * 0.62, H = h * 0.36;
        ctx.fillStyle = '#93b2d6'; ctx.beginPath(); ctx.moveTo(cx - w * 0.42, b); ctx.quadraticCurveTo(cx - w * 0.12, b - H * 0.75, cx, b - H); ctx.quadraticCurveTo(cx + w * 0.14, b - H * 0.7, cx + w * 0.45, b); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#eef7ff'; ctx.beginPath(); ctx.moveTo(cx - w * 0.07, b - H * 0.78); ctx.quadraticCurveTo(cx, b - H * 1.04, cx + w * 0.08, b - H * 0.76); ctx.lineTo(cx + w * 0.03, b - H * 0.82); ctx.lineTo(cx - w * 0.02, b - H * 0.74); ctx.closePath(); ctx.fill();
        // pistes de ski : larges rubans blancs qui descendent en S depuis le sommet
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        [[-0.05, 0.05], [0.04, -0.06], [0.11, 0.04]].forEach(([dx, sw], i) => {
          const xa = cx + w * dx * 0.25, ya = b - H * 0.8, xb = cx + w * dx * 2.2, yb = b - H * 0.05;
          ctx.lineWidth = h * (0.022 + (i % 2) * 0.006); ctx.beginPath(); ctx.moveTo(xa, ya);
          ctx.bezierCurveTo(xa + w * sw, ya + (yb - ya) * 0.33, xb - w * sw, ya + (yb - ya) * 0.66, xb, yb);
          ctx.stroke();
        });
        // forêt de sapins sur les flancs
        for (let i = 0; i < 46; i++) {
          const r = ((Math.sin(i * 91.3) * 4375.5) % 1 + 1) % 1, r2 = ((Math.sin(i * 17.7) * 912.3) % 1 + 1) % 1;
          const x = cx - w * 0.4 + r * w * 0.82, depth = b - r2 * H * 0.42;
          if (Math.abs(x - cx - w * 0.04) < w * 0.07 && r2 > 0.25) continue; // laisse les pistes dégagées
          pine(ctx, x, depth + H * 0.05, h * (0.035 + r2 * 0.02), r2 > 0.5 ? '#2f5a4a' : '#24493c');
        }
        // télésiège : pylônes, câble et sièges
        const x0 = cx - w * 0.25, y0 = b - h * 0.02, x1 = cx - w * 0.04, y1 = b - H * 0.74;
        const u = h / 600; // tailles relatives (même rendu en miniature)
        ctx.strokeStyle = '#3a3a48'; ctx.lineWidth = 2 * u;
        for (let k = 0; k <= 4; k++) { const px = x0 + (x1 - x0) * k / 4, py = y0 + (y1 - y0) * k / 4; ctx.beginPath(); ctx.moveTo(px, py + h * 0.04); ctx.lineTo(px, py - h * 0.012); ctx.stroke(); }
        ctx.lineWidth = 1 * u; ctx.beginPath(); ctx.moveTo(x0, y0 - h * 0.012); ctx.lineTo(x1, y1 - h * 0.012); ctx.stroke();
        ctx.fillStyle = '#d8343a';
        for (let k = 1; k < 9; k++) { const px = x0 + (x1 - x0) * k / 9, py = y0 + (y1 - y0) * k / 9 - h * 0.012; ctx.fillRect(px - 4 * u, py + 4 * u, 8 * u, 5 * u); ctx.fillRect(px - 0.5 * u, py, 1 * u, 4 * u); }
      } },
      { par: 0.2, draw(ctx, w, h) {
        // rive enneigée au bord du lac : chalets et sapins
        const b = h * 0.615;
        ctx.fillStyle = '#f4faff'; ctx.beginPath(); ctx.moveTo(0, b + 6); ctx.quadraticCurveTo(w * 0.25, b - h * 0.03, w * 0.5, b); ctx.quadraticCurveTo(w * 0.75, b - h * 0.035, w, b + 4); ctx.lineTo(w, b + 10); ctx.lineTo(0, b + 10); ctx.closePath(); ctx.fill();
        const sc = h / 900;
        [[0.08, 1], [0.2, 0], [0.31, 2], [0.64, 1], [0.78, 3], [0.9, 0]].forEach(([fx, s], i) => {
          pine(ctx, w * fx - 60 * sc, b + 2, h * 0.06, '#2a4f42'); pine(ctx, w * fx + 58 * sc, b + 2, h * 0.05, '#30594a');
          chalet(ctx, w * fx, b + 2, sc * (0.9 + (i % 2) * 0.2), s);
        });
      } },
    ],
    bgDynamic(ctx, w, h, t) {
      // reflets qui scintillent sur le lac
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        const y = h * (0.65 + (i % 6) * 0.055), x = ((i * 197 + t * 14 * (1 + (i % 3))) % (w + 120)) - 60;
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t * 3 + i); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 22 + (i % 4) * 8, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // fumée des cheminées (au-dessus de la rive)
      for (let i = 0; i < 6; i++) {
        const k = (t * 0.25 + i * 0.37) % 1, x = w * (0.12 + i * 0.15) + Math.sin(t + i) * 8 + k * 30, y = h * 0.53 - k * h * 0.12;
        ctx.fillStyle = `rgba(240,245,255,${0.35 * (1 - k)})`; ctx.beginPath(); ctx.arc(x, y, 6 + k * 14, 0, 7); ctx.fill();
      }
      // neige qui tombe
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 110; i++) {
        const r1 = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1, r2 = ((Math.sin(i * 78.233) * 12345.678) % 1 + 1) % 1;
        const sp = 18 + (i % 5) * 9, sz = 1 + (i % 3) * 0.8;
        const y = (r2 * h + t * sp) % h, x = (r1 * w + Math.sin(t * 0.8 + i) * 14 + t * 6) % w;
        ctx.beginPath(); ctx.arc(x, y, sz * (w / 1400 + 0.6), 0, 7); ctx.fill();
      }
    },
    drawStage(ctx, P, t) {
      const m = P.main, WL = -21;
      // eau du lac derrière Séracrawl
      ctx.fillStyle = lin(ctx, 0, WL, 0, WL - 200, [[0, '#3f8cc0'], [1, '#0c2c4e']]);
      ctx.fillRect(-700, WL, 1400, -260);
      // Grelaçon sur leur plaque (dessinés avant le corps : ils passent SOUS Séracrawl)
      const FL = P.fl || [floeState(0, 0), floeState(0, 1)];
      floe(ctx, FL[0][0], FL[0][1], t, 1, WL); floe(ctx, FL[1][0], FL[1][1], t, -1, WL);
      // pattes (sous l'eau)
      ctx.fillStyle = '#3b78ab';
      [-70, -36, 36, 70].forEach((x) => { ctx.beginPath(); ctx.moveTo(x - 9, -34); ctx.lineTo(x + 9, -34); ctx.lineTo(x + 7, -58); ctx.lineTo(x - 8, -58); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.6; ctx.stroke(); });
      // corps de glace (iceberg à facettes)
      const body = [-98, 0, 98, 0, 100, -6, 103, -15, 97, -27, 82, -36, 40, -40, -40, -40, -82, -36, -97, -27, -104, -16, -101, -6];
      ctx.beginPath(); ctx.moveTo(body[0], body[1]); for (let i = 2; i < body.length; i += 2) ctx.lineTo(body[i], body[i + 1]); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 0, -40, [[0, '#b3e6f8'], [0.45, '#5fa9d8'], [1, '#2a6aa2']]); ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(10,30,60,0.6)'; ctx.stroke();
      ctx.save(); ctx.clip();
      for (let i = -5; i <= 5; i++) { // plaques de glace
        const x = i * 19;
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.16)' : 'rgba(10,50,100,0.14)';
        ctx.beginPath(); ctx.moveTo(x - 9, -5); ctx.lineTo(x + 11, -5); ctx.lineTo(x + 7, -24 - (i % 3) * 3); ctx.lineTo(x - 12, -22); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.35; ctx.stroke();
      }
      ctx.restore();
      // tête (à gauche) : arcade de glace, œil qui cligne, mâchoire en stalactites
      ctx.fillStyle = '#d9f3ff'; ctx.beginPath(); ctx.moveTo(-101, -6); ctx.lineTo(-80, -6); ctx.lineTo(-82, -11); ctx.lineTo(-99, -12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(10,30,60,0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
      const blink = (t % 4.3) < 0.14;
      if (blink) { ctx.strokeStyle = '#0e2140'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-93, -14); ctx.lineTo(-86, -14); ctx.stroke(); }
      else { ctx.fillStyle = '#0e2140'; ctx.beginPath(); ctx.ellipse(-89.5, -14.5, 3, 2.2, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-88.5, -13.6, 0.8, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#eafaff'; ctx.beginPath(); ctx.moveTo(-104, -18); // mâchoire
      for (let i = 0; i <= 6; i++) { ctx.lineTo(-104 + i * 4, -18 - (i % 2 ? 4.5 : 1.5)); }
      ctx.lineTo(-80, -18); ctx.lineTo(-82, -20); ctx.lineTo(-103, -20.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(10,30,60,0.55)'; ctx.lineWidth = 0.45; ctx.stroke();
      // souffle glacé de temps en temps
      const br = (t * 0.35) % 1;
      if (br < 0.35) { const k = br / 0.35; ctx.fillStyle = `rgba(235,248,255,${0.6 * (1 - k)})`; ctx.beginPath(); ctx.arc(-107 - k * 14, -19 + k * 3, 2 + k * 6, 0, 7); ctx.fill(); }
      // le dos : plaque de glace plate (le terrain), plaques de neige et fissures
      ctx.beginPath(); ctx.moveTo(m.l - 1, m.y + 0.6); ctx.lineTo(m.r + 1, m.y + 0.6); ctx.lineTo(m.r, m.y - 4.5); ctx.lineTo(m.l, m.y - 4.5); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 0, -4.5, [[0, '#f4fdff'], [1, '#a9dcf2']]); ctx.fill();
      ctx.strokeStyle = 'rgba(10,30,60,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(m.l + 12 + i * 21.5, 0.35, 5 + (i % 3) * 2.5, 0.75, 0, 0, 7); ctx.fill(); }
      ctx.strokeStyle = 'rgba(90,150,200,0.55)'; ctx.lineWidth = 0.3;
      [[-60, -40], [-12, 6], [30, 52], [70, 84]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a, -0.6); ctx.lineTo((a + b) / 2, -2.6); ctx.lineTo(b, -1.4); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(m.l, m.y + 0.3); ctx.lineTo(m.r, m.y + 0.3); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7; ctx.stroke();
      // stalactites sous le rebord
      ctx.fillStyle = 'rgba(225,246,255,0.95)';
      [[86, 3], [92, 4.5], [97, 2.5], [-79, 3.5], [-74, 2.5]].forEach(([x, l]) => { ctx.beginPath(); ctx.moveTo(x - 1.2, -4.5); ctx.lineTo(x + 1.2, -4.5); ctx.lineTo(x, -4.5 - l); ctx.closePath(); ctx.fill(); });
      // eau devant : la partie immergée paraît sous l'eau
      ctx.fillStyle = 'rgba(40,120,185,0.55)'; ctx.fillRect(-700, WL, 1400, -260);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.6; ctx.beginPath();
      for (let x = -700; x <= 700; x += 5) { const y = WL + Math.sin(x * 0.12 + t * 2.2) * 0.5; if (x === -700) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      // écume autour de Séracrawl
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(s * (100 + i * 4) , WL + 0.3, 3 - i * 0.6 + Math.sin(t * 3 + i) * 0.5, 0.6, 0, 0, 7); ctx.fill(); }
    },
  };

  // ---------- Petit Champ (plage) ----------
  S.petit = {
    id: 'petit', name: 'Petit Champ', sub: 'Plage de Paldea', music: 2,
    phys: {
      main: { l: -75, r: 75, y: 0, bottom: -22 },
      plats: [{ l: -57, r: -16, y: 30 }, { l: 16, r: 57, y: 30 }],
      blast: { l: -258, r: 258, t: 195, b: -145 }, cam: { l: -210, r: 210, t: 155, b: -90 },
      respawn: [0, 78], spawns: [[-50, 0, -1], [50, 0, -1], [-17, 0, -1], [17, 0, -1]], spawns2: [[-40, 0, -1], [40, 0, -1]],
    },
    bgStatic(ctx, w, h) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#3aa8ff'], [0.55, '#9ee0ff'], [0.62, '#e8fbff'], [0.63, '#1d8fd8'], [1, '#0b4f8a']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rad(ctx, w * 0.2, h * 0.2, 0, h * 0.35, [[0, 'rgba(255,255,220,1)'], [0.2, 'rgba(255,250,200,0.7)'], [1, 'rgba(255,255,255,0)']]);
      ctx.fillRect(0, 0, w, h);
    },
    bgLayers: [
      { par: 0.08, draw(ctx, w, h) { ridge(ctx, w, h, h * 0.62, h * 0.05, 4.4, 'rgba(60,140,110,0.6)', 14); } },
      { par: 0.3, draw(ctx, w, h) {
        // îlots avec palmiers à l'horizon
        for (let i = 0; i < 4; i++) {
          const x = w * (0.1 + i * 0.27), b = h * 0.645, sc = h / 900;
          ctx.fillStyle = '#e8cf8a'; ctx.beginPath(); ctx.ellipse(x + 10 * sc, b, 70 * sc, 9 * sc, 0, Math.PI, 0); ctx.fill();
          for (let j = 0; j < 2; j++) {
            const px = x + (j ? 34 : -14) * sc, H = (j ? 70 : 95) * sc;
            ctx.strokeStyle = '#3d5a3f'; ctx.lineWidth = 5 * sc; ctx.beginPath(); ctx.moveTo(px, b - 2 * sc); ctx.quadraticCurveTo(px + 14 * sc, b - H * 0.55, px + 6 * sc, b - H); ctx.stroke();
            ctx.fillStyle = '#3f7d4f';
            for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.beginPath(); ctx.ellipse(px + 6 * sc + Math.cos(a) * 18 * sc, b - H + Math.sin(a) * 6 * sc, 22 * sc, 5 * sc, a, 0, 7); ctx.fill(); }
          }
        }
      } },
    ],
    bgDynamic(ctx, w, h, t) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
      for (let i = 0; i < 18; i++) {
        const y = h * (0.66 + (i % 6) * 0.05), x = ((i * 173 + t * 20 * (1 + (i % 3))) % (w + 100)) - 50;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 30 + (i % 4) * 10, y); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 4; i++) { const x = ((i * 400 + t * 12) % (w + 400)) - 200, y = h * (0.1 + i * 0.07); ctx.beginPath(); ctx.ellipse(x, y, 90, 18, 0, 0, 7); ctx.ellipse(x + 50, y - 10, 50, 16, 0, 0, 7); ctx.fill(); }
    },
    drawStage(ctx, P, t) {
      const m = P.main;
      stageBody(ctx, m, lin(ctx, 0, 0, 0, -5, [[0, '#ffe7a8'], [1, '#e0b86a']]), '#c79458', '#5a3b2a', '#fff6d5', 0.5);
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(m.l + 14 + i * 21, -2.4, 1.6, 0.8, 0, 0, 7); ctx.fill(); }
      ctx.restore();
      P.plats.forEach((p) => {
        platform(ctx, p, lin(ctx, 0, p.y, 0, p.y - 3, [[0, '#b77a45'], [1, '#6e4426']]), '#f3c78d', 2.6);
        ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.lineWidth = 0.3;
        for (let x = p.l + 4; x < p.r - 2; x += 4) { ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y - 2.6); ctx.stroke(); }
      });
    },
  };

  // ---------- Arène (stade de nuit) ----------
  S.arene = {
    id: 'arene', name: 'Arène Pokémon', sub: 'Stade de Paldea', music: 3,
    phys: {
      main: { l: -102, r: 102, y: 0, bottom: -30 },
      plats: [{ l: -71, r: -33, y: 26 }, { l: 33, r: 71, y: 26 }],
      blast: { l: -290, r: 290, t: 205, b: -155 }, cam: { l: -235, r: 235, t: 160, b: -100 },
      respawn: [0, 72], spawns: [[-66, 0, -1], [66, 0, -1], [-26, 0, -1], [26, 0, -1]], spawns2: [[-50, 0, -1], [50, 0, -1]],
    },
    bgStatic(ctx, w, h) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#081030'], [0.5, '#1b2a6b'], [1, '#101a3a']]);
      ctx.fillRect(0, 0, w, h);
    },
    bgLayers: [
      { par: 0.1, draw(ctx, w, h) {
        // tribunes
        ctx.fillStyle = '#1a1f3f';
        ctx.beginPath(); ctx.moveTo(0, h * 0.45); ctx.quadraticCurveTo(w * 0.5, h * 0.3, w, h * 0.45); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
        ctx.fillStyle = '#262c55';
        ctx.beginPath(); ctx.moveTo(0, h * 0.6); ctx.quadraticCurveTo(w * 0.5, h * 0.48, w, h * 0.6); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
        // écran géant
        ctx.fillStyle = '#0a0f25'; ctx.fillRect(w * 0.4, h * 0.12, w * 0.2, h * 0.14);
        ctx.strokeStyle = '#3d4a8a'; ctx.lineWidth = 4; ctx.strokeRect(w * 0.4, h * 0.12, w * 0.2, h * 0.14);
      } },
    ],
    bgDynamic(ctx, w, h, t) {
      // foule (flashs)
      for (let i = 0; i < 160; i++) {
        const x = ((Math.sin(i * 91.7) * 4375.5) % 1 + 1) % 1 * w, yb = ((Math.sin(i * 13.3) * 913.1) % 1 + 1) % 1;
        const y = h * (0.42 + yb * 0.3) + Math.abs(Math.sin(t * 3 + i)) * -3;
        const on = Math.sin(t * 5 + i * 1.7) > 0.93;
        ctx.fillStyle = on ? '#ffffff' : `hsla(${(i * 47) % 360},70%,60%,0.55)`;
        ctx.fillRect(x, y, on ? 3 : 2, on ? 3 : 2);
      }
      // projecteurs
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x = w * (0.1 + i * 0.27), a = Math.sin(t * 0.6 + i * 1.5) * 0.35;
        ctx.save(); ctx.translate(x, 0); ctx.rotate(a);
        ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, 'rgba(180,220,255,0.28)'], [1, 'rgba(180,220,255,0)']]);
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(120, h); ctx.lineTo(-120, h); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      // écran : Poké Ball qui tourne
      ctx.save(); ctx.translate(w * 0.5, h * 0.19); ctx.rotate(Math.sin(t) * 0.3);
      const r = h * 0.05;
      ctx.fillStyle = '#e8313a'; ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillRect(-r, -r * 0.1, r * 2, r * 0.2);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, 7); ctx.fill();
      ctx.restore();
    },
    drawStage(ctx, P, t) {
      const m = P.main;
      stageBody(ctx, m, lin(ctx, 0, 0, 0, -5, [[0, '#e9edf5'], [1, '#9aa5bd']]), '#3c4a78', '#12162e', '#ffffff', 0.6);
      // emblème Poké Ball sur la face
      ctx.save(); ctx.translate(0, -15);
      ctx.fillStyle = 'rgba(232,49,58,0.8)'; ctx.beginPath(); ctx.arc(0, 0, 8, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(240,240,240,0.8)'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(-8, -0.7, 16, 1.4); ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 1.3, 0, 7); ctx.fill();
      ctx.restore();
      P.plats.forEach((p) => platform(ctx, p, lin(ctx, 0, p.y, 0, p.y - 3, [[0, '#9fb3e0'], [1, '#4a5a8c']]), '#ffffff', 2.8));
    },
  };
  // outils de dessin partagés avec les terrains des autres fichiers (stages-pokemon.js)
  // Plateforme mobile : déplace la plateforme i (nouvelles bornes l/r, hauteur y facultative) et emporte ceux
  // qui sont posés dessus. Appelé depuis le tick d'un terrain (donc dans la simulation : rollback et replays OK).
  function movePlat(S, i, l, r, y) {
    const p = S.stage.plats[i], dx = l - p.l;
    p.l = l; p.r = r; if (y != null) p.y = y;
    if (dx) for (const f of S.fighters) if (!f.dead && f.grounded && f.plat === i) f.x += dx;
  }
  G.STG = { lin, rad, ridge, mesa, peaks, pine, chalet, stageBody, platform, movePlat };
})(window.G);
