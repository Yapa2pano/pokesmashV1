'use strict';
// Colonnes Lances : les ruines sacrées au sommet du mont Couronné, au-dessus des nuages.
// Plateformes façon Champ de Bataille (deux chapiteaux de colonnes brisées + une dalle flottante).
// Tour à tour, DIALGA et PALKIA surgissent d'une faille dimensionnelle derrière le temple :
//  - DIALGA (corps bleu nuit rayé de bleu clair, plastron argenté avec son gros DIAMANT bleu, crête argentée,
//    ailerons d'acier dans le dos) lance HURLE-TEMPS : le temps s'EMBALLE, tout le combat va 1,5 fois plus vite pendant 6 s.
//  - PALKIA (corps blanc nacré rayé de violet, PERLES roses aux épaules, grandes ailes pâles) lance SPATIO-RIFT :
//    pendant 10 s l'espace se replie, sortir par un côté fait revenir par l'autre (plus de KO par les côtés,
//    mais toujours par le haut et le bas). Les projectiles passent aussi.
// Chaque apparition s'annonce ~2 s avant (la faille s'ouvre, le Pokémon apparaît puis rugit).
(function (G) {
  const S = G.STAGES, U = G.U;
  const { lin, rad, platform, peaks } = G.STG;
  const PI = Math.PI;

  const CYC = 2400, OFF = 2200; // cycle de 40 s ; à « GO ! » (frame 200) on est au début du cycle
  const DIA = { in: 540, roar: 600, s0: 640, s1: 1000, out: 1060 };
  const PAL = { in: 1260, roar: 1320, w0: 1360, w1: 1960, out: 2020 };
  const WX = 212; // bords de l'espace replié
  const KS = { P: null };

  const fade = (c, a0, a1, b0, b1) => c < a0 || c >= b1 ? 0 : c < a1 ? (c - a0) / (a1 - a0) : c < b0 ? 1 : 1 - (c - b0) / (b1 - b0);
  const dialgaOf = (c) => fade(c, DIA.in, DIA.roar, DIA.s1, DIA.out);
  const palkiaOf = (c) => fade(c, PAL.in, PAL.roar, PAL.w1, PAL.out);

  // ---------- dessin ----------
  function poly(ctx, pts, fill, ink, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); if (ink) { ctx.strokeStyle = ink; ctx.lineWidth = lw || 0.6; ctx.stroke(); }
  }
  function blade(ctx, x, y, a, len, wd, c0, c1, ink, stripe) { // aileron / lame effilée
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, -wd * 0.5); ctx.quadraticCurveTo(len * 0.55, -wd * 0.9, len, 0); ctx.quadraticCurveTo(len * 0.5, wd * 0.25, 0, wd * 0.5); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 0, len, 0, [[0, c0], [1, c1]]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.6; ctx.stroke();
    if (stripe) { ctx.strokeStyle = stripe; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(len * 0.12, -wd * 0.05); ctx.quadraticCurveTo(len * 0.55, -wd * 0.35, len * 0.9, -0.2); ctx.stroke(); }
    ctx.restore();
  }

  // DIALGA, en buste, de profil vers la droite, tête levée qui rugit
  function dialga(ctx, t, roar) {
    const NAVY = '#2d4282', NAVY_D = '#18244e', CYAN = '#86dcf6', SIL = '#dfe5ee', SIL_D = '#8e99ae', ink = 'rgba(8,12,34,0.9)';
    // ailerons d'acier dans le dos, en éventail
    for (let i = 4; i >= 0; i--) blade(ctx, -12, 14, (104 + i * 15) * PI / 180, 38 + (i % 2) * 9 - i, 9, SIL_D, SIL, ink, CYAN);
    // corps / poitrail
    ctx.beginPath(); ctx.moveTo(-32, -120); ctx.lineTo(-30, -50); ctx.quadraticCurveTo(-34, 4, -18, 20); ctx.quadraticCurveTo(-4, 28, 8, 22); ctx.quadraticCurveTo(26, 14, 26, -6); ctx.quadraticCurveTo(26, -30, 20, -50); ctx.lineTo(22, -120); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 24, 0, -80, [[0, '#3c55a0'], [1, NAVY_D]]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.strokeStyle = CYAN; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; // rayures bleu clair
    ctx.beginPath(); ctx.moveTo(-26, -40); ctx.quadraticCurveTo(-24, -8, -12, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, -44); ctx.quadraticCurveTo(14, -30, 18, -18); ctx.stroke();
    // cou qui monte vers la tête
    ctx.beginPath(); ctx.moveTo(-6, 20); ctx.quadraticCurveTo(0, 44, 14, 58); ctx.lineTo(30, 54); ctx.quadraticCurveTo(18, 40, 16, 16); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 20, 30, 50, [[0, NAVY_D], [1, NAVY]]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.strokeStyle = CYAN; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(12, 18); ctx.quadraticCurveTo(14, 40, 26, 54); ctx.stroke();
    // épaulière argentée à pointe
    poly(ctx, [-20, 8, -6, 18, 4, 12, -2, 0, -16, -2], SIL, ink, 0.6);
    poly(ctx, [-18, 6, -32, 14, -20, 0], SIL_D, ink, 0.5);
    // PLASTRON argenté et son gros DIAMANT bleu
    ctx.beginPath(); ctx.moveTo(4, 16); ctx.quadraticCurveTo(28, 16, 30, -2); ctx.quadraticCurveTo(30, -20, 16, -26); ctx.quadraticCurveTo(4, -18, 2, 0); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 16, 0, -26, [[0, '#ffffff'], [0.5, SIL], [1, SIL_D]]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.7; ctx.stroke();
    const gx = 18, gy = -3, gk = 1 + roar * 0.15;
    ctx.save(); ctx.translate(gx, gy); ctx.scale(gk, gk);
    if (roar > 0) { ctx.fillStyle = rad(ctx, 0, 0, 0, 22, [[0, `rgba(140,220,255,${0.7 * roar})`], [1, 'rgba(140,220,255,0)']]); ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill(); }
    poly(ctx, [0, 9, 6.5, 0, 0, -9, -6.5, 0], lin(ctx, -6, 9, 6, -9, [[0, '#bfefff'], [0.45, '#3f8fe8'], [1, '#173f9a']]), ink, 0.7);
    poly(ctx, [0, 9, 2, 0, 0, -9, -2, 0], 'rgba(255,255,255,0.35)');
    ctx.restore();
    // tête (levée, gueule ouverte)
    ctx.save(); ctx.translate(22, 58); ctx.rotate((32 + roar * 10) * PI / 180);
    blade(ctx, 2, 7, (172 - roar * 6) * PI / 180, 30, 9, SIL_D, SIL, ink, CYAN); // grande crête argentée vers l'arrière
    blade(ctx, 4, 5, 150 * PI / 180, 18, 6, SIL_D, SIL, ink);
    const op = 3 + roar * 5; // ouverture de la gueule
    poly(ctx, [0, 7, 14, 8, 27, 4.5, 30, 1.5, 24, 0.5, 4, -1], NAVY, ink, 0.7); // mâchoire du haut
    poly(ctx, [24, 0.5, 30, 1.5, 32, 5, 27, 4.5], SIL, ink, 0.5); // pointe argentée du museau
    ctx.fillStyle = '#5a0d16'; ctx.beginPath(); ctx.moveTo(6, -1); ctx.lineTo(25, 0.5); ctx.lineTo(23, -op); ctx.lineTo(6, -3); ctx.closePath(); ctx.fill();
    poly(ctx, [4, -1, 8, -3, 22, -op - 0.5, 25, -op + 1, 6, -6, 0, -5], NAVY_D, ink, 0.6); // mâchoire du bas
    poly(ctx, [2, -5, 10, -6.5, 14, -9, 4, -9], SIL, ink, 0.5); // plaque argentée du menton
    ctx.fillStyle = '#fff'; for (const x of [10, 15, 20]) { poly(ctx, [x, 0.2, x + 1.4, 0.3, x + 0.6, -1.6], '#fff'); }
    ctx.strokeStyle = CYAN; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(3, 3); ctx.lineTo(22, 3.6); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(10, 4.6, 2.6, 1.5, 0.05, 0, 7); ctx.fill(); // œil rouge
    ctx.fillStyle = '#d0202a'; ctx.beginPath(); ctx.arc(10.6, 4.6, 1.2, 0, 7); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(7, 6.6); ctx.lineTo(14, 5.8); ctx.stroke();
    ctx.restore();
  }

  // PALKIA, en buste, de profil vers la gauche (dessiné vers la droite puis retourné), tête levée qui rugit
  function palkia(ctx, t, roar) {
    const PEARL = '#e9e3ef', PEARL_D = '#b9adc8', PURP = '#9a4fb0', GREY = '#6f6c7c', ink = 'rgba(40,20,50,0.85)';
    // grandes ailes pâles dans le dos
    for (const [a, len, w] of [[118, 66, 22], [136, 58, 18]]) {
      ctx.save(); ctx.translate(-12, 16); ctx.rotate(a * PI / 180);
      ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(len, -w * 0.15); ctx.lineTo(len * 0.92, w * 0.55); ctx.lineTo(0, 4); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, len, 0, [[0, 'rgba(225,215,235,0.95)'], [1, 'rgba(250,248,255,0.8)']]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(150,130,170,0.6)'; ctx.lineWidth = 0.4;
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(len * i / 5 * 0.9, -w * 0.13 * i / 5); ctx.lineTo(len * i / 5 * 0.85, w * 0.5 * i / 5 + 2); ctx.stroke(); }
      ctx.restore();
    }
    // corps
    ctx.beginPath(); ctx.moveTo(-30, -120); ctx.lineTo(-28, -50); ctx.quadraticCurveTo(-32, 6, -16, 22); ctx.quadraticCurveTo(-2, 30, 10, 22); ctx.quadraticCurveTo(26, 12, 24, -10); ctx.quadraticCurveTo(22, -32, 18, -50); ctx.lineTo(20, -120); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 26, 0, -80, [[0, '#f6f2fa'], [1, PEARL_D]]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.stroke();
    // centre gris sombre du torse
    ctx.beginPath(); ctx.moveTo(2, 8); ctx.quadraticCurveTo(14, 4, 14, -16); ctx.lineTo(4, -30); ctx.quadraticCurveTo(-4, -12, 2, 8); ctx.closePath(); ctx.fillStyle = GREY; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.strokeStyle = PURP; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; // rayures violettes
    for (const [x0, y0, x1, y1, x2, y2] of [[-24, -44, -26, -16, -16, 6], [18, -46, 22, -24, 18, -6], [-14, -46, -16, -30, -8, -20]]) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x1, y1, x2, y2); ctx.stroke(); }
    // bras gris et griffes blanches
    ctx.strokeStyle = GREY; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(14, 2); ctx.quadraticCurveTo(26, -4, 30, -16); ctx.stroke();
    ctx.fillStyle = '#ffffff'; for (const d of [-2.5, 0, 2.5]) poly(ctx, [29 + d, -18, 31 + d, -18, 30.5 + d, -24], '#fff', ink, 0.3);
    // cou
    ctx.beginPath(); ctx.moveTo(-6, 20); ctx.quadraticCurveTo(0, 44, 14, 58); ctx.lineTo(29, 54); ctx.quadraticCurveTo(18, 40, 16, 14); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 20, 30, 50, [[0, PEARL_D], [1, '#f4effa']]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.strokeStyle = PURP; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-2, 24); ctx.quadraticCurveTo(4, 42, 15, 52); ctx.stroke();
    // épaulière ronde et sa PERLE rose
    const px = -8, py = 10, pk = 1 + roar * 0.12;
    ctx.fillStyle = lin(ctx, px, py + 13, px, py - 13, [[0, '#ffffff'], [1, PEARL_D]]); ctx.beginPath(); ctx.arc(px, py, 13, 0, 7); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.strokeStyle = PURP; ctx.lineWidth = 2.2; for (const a of [0.6, 2.2, 3.8, 5.3]) { ctx.beginPath(); ctx.arc(px, py, 10.5, a, a + 0.7); ctx.stroke(); }
    if (roar > 0) { ctx.fillStyle = rad(ctx, px, py, 0, 20, [[0, `rgba(255,170,210,${0.7 * roar})`], [1, 'rgba(255,170,210,0)']]); ctx.beginPath(); ctx.arc(px, py, 20, 0, 7); ctx.fill(); }
    ctx.fillStyle = PURP; ctx.beginPath(); ctx.arc(px, py, 6.6 * pk, 0, 7); ctx.fill();
    ctx.fillStyle = rad(ctx, px - 1.5, py + 1.5, 0.5, 6 * pk, [[0, '#fff4f8'], [0.45, '#f7b5cc'], [1, '#d77a9e']]); ctx.beginPath(); ctx.arc(px, py, 5.4 * pk, 0, 7); ctx.fill();
    // tête (levée, gueule ouverte), longue crête vers l'arrière
    ctx.save(); ctx.translate(22, 58); ctx.rotate((30 + roar * 10) * PI / 180);
    blade(ctx, 1, 7, (176 - roar * 5) * PI / 180, 34, 8, PEARL_D, '#fbf9fd', ink, PURP);
    const op = 3 + roar * 5;
    poly(ctx, [0, 7, 14, 8.5, 26, 5, 29, 2, 22, 0.5, 4, -1], '#f2edf7', ink, 0.7);
    ctx.fillStyle = '#6a1530'; ctx.beginPath(); ctx.moveTo(6, -1); ctx.lineTo(23, 0.5); ctx.lineTo(21, -op); ctx.lineTo(6, -3); ctx.closePath(); ctx.fill();
    poly(ctx, [4, -1, 8, -3, 20, -op - 0.5, 23, -op + 1, 6, -6, 0, -5], PEARL_D, ink, 0.6);
    for (const x of [10, 15, 19]) poly(ctx, [x, 0.2, x + 1.4, 0.3, x + 0.6, -1.6], '#fff');
    ctx.strokeStyle = PURP; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(2, 4.5); ctx.quadraticCurveTo(12, 7, 24, 4.4); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(10, 4.2, 2.6, 1.5, 0.05, 0, 7); ctx.fill();
    ctx.fillStyle = '#d0202a'; ctx.beginPath(); ctx.arc(10.6, 4.2, 1.2, 0, 7); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(7, 6.4); ctx.lineTo(14, 5.6); ctx.stroke();
    ctx.restore();
  }

  // faille dimensionnelle derrière le temple
  function rift(ctx, x, y, k, t, col) {
    if (k <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = k;
    ctx.fillStyle = rad(ctx, 0, 0, 0, 90, [[0, col[0]], [0.5, col[1]], [1, 'rgba(0,0,0,0)']]); ctx.beginPath(); ctx.ellipse(0, 0, 95 * k, 80 * k, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = col[2]; ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(t * (0.3 + i * 0.1) * (i % 2 ? -1 : 1)); ctx.beginPath(); ctx.ellipse(0, 0, (70 - i * 12) * k, (24 - i * 3) * k, 0, 0, PI * 1.6); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }
  // cadran temporel (ralenti) et coutures de l'espace (repli)
  function clockFx(ctx, x, y, k, t) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = 0.55 * k; ctx.strokeStyle = '#bff0ff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 60, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 54, 0, 7); ctx.stroke();
    for (let i = 0; i < 12; i++) { const a = i * PI / 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 54, Math.sin(a) * 54); ctx.lineTo(Math.cos(a) * 47, Math.sin(a) * 47); ctx.stroke(); }
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(PI / 2 - t * 3) * 30, Math.sin(PI / 2 - t * 3) * 30); ctx.stroke(); // les aiguilles s'emballent
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(PI / 2 - t * 18) * 44, Math.sin(PI / 2 - t * 18) * 44); ctx.stroke();
    ctx.restore();
  }

  function temple(ctx, P, t) {
    const m = P.main, ink = 'rgba(30,30,50,0.75)';
    // socle rocheux sous le sanctuaire
    ctx.beginPath(); ctx.moveTo(m.l - 4, 0); ctx.lineTo(m.r + 4, 0); ctx.lineTo(m.r + 2, -12); ctx.lineTo(m.r - 10, -30); ctx.lineTo(60, -48); ctx.lineTo(20, -62); ctx.lineTo(-24, -58); ctx.lineTo(-64, -44); ctx.lineTo(m.l + 8, -28); ctx.lineTo(m.l - 2, -12); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 0, 0, -62, [[0, '#7e7f98'], [0.5, '#585a76'], [1, '#33344c']]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(20,20,40,0.35)'; ctx.lineWidth = 0.5;
    for (const [a, b, c2, d] of [[-70, -10, -50, -30], [-20, -14, -30, -40], [30, -8, 44, -34], [70, -12, 66, -26]]) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.stroke(); }
    // dallage du sanctuaire (le terrain), avec gravures
    ctx.beginPath(); ctx.moveTo(m.l - 4, 0.6); ctx.lineTo(m.r + 4, 0.6); ctx.lineTo(m.r + 2, -6); ctx.lineTo(m.l - 2, -6); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 0, 0, -6, [[0, '#d9dbea'], [1, '#9a9cb6']]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(60,60,90,0.4)'; ctx.lineWidth = 0.35;
    for (let x = m.l + 12; x < m.r; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0.4); ctx.lineTo(x, -6); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(m.l - 2, -3); ctx.lineTo(m.r + 2, -3); ctx.stroke();
    for (let x = m.l + 4; x < m.r - 4; x += 16) { ctx.beginPath(); ctx.moveTo(x + 2, -4.6); ctx.lineTo(x + 5, -4.6); ctx.lineTo(x + 5, -4); ctx.lineTo(x + 8, -4); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(m.l, 0.3); ctx.lineTo(m.r, 0.3); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7; ctx.stroke();
  }
  function column(ctx, p, broken) { // colonne cannelée dont le chapiteau sert de plateforme
    const cx = (p.l + p.r) / 2, w = 9, ink = 'rgba(30,30,50,0.7)';
    ctx.fillStyle = lin(ctx, cx - w, 0, cx + w, 0, [[0, '#8d8fa8'], [0.4, '#e1e3ef'], [1, '#7c7e98']]);
    ctx.fillRect(cx - w, 0, w * 2, p.y - 4); ctx.strokeStyle = ink; ctx.lineWidth = 0.5; ctx.strokeRect(cx - w, 0, w * 2, p.y - 4);
    ctx.strokeStyle = 'rgba(60,60,90,0.35)'; ctx.lineWidth = 0.4;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 3.4, 1); ctx.lineTo(cx + i * 3.4, p.y - 5); ctx.stroke(); }
    if (broken) { ctx.strokeStyle = 'rgba(40,40,60,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(cx - w, p.y * 0.55); ctx.lineTo(cx - 2, p.y * 0.62); ctx.lineTo(cx + 3, p.y * 0.5); ctx.stroke(); }
    poly(ctx, [p.l - 1, p.y - 4, p.r + 1, p.y - 4, p.r - 3, p.y - 7, p.l + 3, p.y - 7], '#a4a6c0', ink, 0.5); // base du chapiteau
    poly(ctx, [cx - w - 2, 0, cx + w + 2, 0, cx + w + 1, 2.4, cx - w - 1, 2.4], '#b8bad2', ink, 0.4); // socle
  }

  S.colonnes = {
    id: 'colonnes', name: 'Colonnes Lances', sub: 'Sommet du mont Couronné', music: 10,
    phys: {
      main: { l: -92, r: 92, y: 0, bottom: -34 },
      plats: [{ l: -70, r: -36, y: 29 }, { l: 36, r: 70, y: 29 }, { l: -19, r: 19, y: 56 }],
      blast: { l: -280, r: 280, t: 205, b: -150 }, cam: { l: -225, r: 225, t: 160, b: -98 },
      respawn: [0, 84], spawns: [[-60, 0, -1], [60, 0, -1], [-22, 0, -1], [22, 0, -1]], spawns2: [[-46, 0, -1], [46, 0, -1]],
    },
    tick(S2) {
      const P = S2.stage, c = (S2.frame + OFF) % CYC;
      P.c = c;
      P.fast = c >= DIA.s0 && c < DIA.s1 ? 1 : 0; // Hurle-Temps : temps accéléré ×1,5 (géré par la sim)
      const wrap = c >= PAL.w0 && c < PAL.w1;
      P.wrap = wrap ? 1 : 0;
      if (wrap) { // Spatio-Rift : sortir d'un côté fait revenir de l'autre
        for (const f of S2.fighters) {
          if (f.dead || f.out || f.grabbedBy >= 0) continue;
          if (f.x < -WX) f.x += 2 * WX; else if (f.x > WX) f.x -= 2 * WX;
        }
        for (const p of S2.projs) { if (p.x < -WX) p.x += 2 * WX; else if (p.x > WX) p.x -= 2 * WX; }
      }
      if (c === DIA.roar) S2.events.push({ t: 'stage', name: 'roar', ev: 'dialga', k: 'cld' + S2.frame });
      if (c === PAL.roar) S2.events.push({ t: 'stage', name: 'roarHi', ev: 'palkia', k: 'clp' + S2.frame });
    },
    fx(e, R) {
      if (e.ev === 'dialga') R.banner = { txt: 'HURLE-TEMPS ! ×1,5', t: 0, big: 0.85, col: '#8fe2ff' };
      if (e.ev === 'palkia') R.banner = { txt: 'SPATIO-RIFT !', t: 0, big: 0.9, col: '#ffa8d8' };
    },
    bgStatic(ctx, w, h) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#1a1440'], [0.35, '#4a3478'], [0.62, '#c26f8f'], [0.78, '#f2b48a'], [1, '#f8dcb4']]);
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 120; i++) { // étoiles
        const x = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * w, y = ((Math.sin(i * 78.233) * 12345.678) % 1 + 1) % 1 * h * 0.45;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) * 0.12})`; ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
      }
      ctx.fillStyle = rad(ctx, w * 0.5, h * 0.9, 0, h * 0.5, [[0, 'rgba(255,230,190,0.8)'], [1, 'rgba(255,200,160,0)']]); ctx.fillRect(0, 0, w, h);
    },
    bgLayers: [
      { par: 0.04, draw(ctx, w, h) { peaks(ctx, w, h * 0.78, h * 0.3, 3.3, 'rgba(110,90,150,0.85)', 'rgba(240,235,255,0.95)', 8); } },
      { par: 0.1, draw(ctx, w, h) { // mer de nuages
        for (let i = 0; i < 26; i++) { const x = (i * 97.3) % w, y = h * (0.8 + (i % 4) * 0.035), r = h * (0.05 + (i % 3) * 0.02); ctx.fillStyle = i % 2 ? 'rgba(255,236,226,0.95)' : 'rgba(246,214,214,0.95)'; ctx.beginPath(); ctx.ellipse(x, y, r * 2.4, r, 0, 0, 7); ctx.fill(); }
        ctx.fillStyle = 'rgba(250,226,220,1)'; ctx.fillRect(0, h * 0.9, w, h * 0.1);
      } },
      { par: 0.18, draw(ctx, w, h) { // colonnes en lance des ruines, au fond
        const b = h * 0.86;
        for (let i = 0; i < 9; i++) {
          const x = w * (0.06 + i * 0.112), H = h * (0.22 + ((i * 37) % 5) * 0.03), cw = h * 0.018;
          ctx.fillStyle = '#6c6890'; ctx.fillRect(x - cw, b - H, cw * 2, H);
          ctx.fillStyle = '#8a86ac'; ctx.fillRect(x - cw, b - H, cw * 0.7, H);
          ctx.fillStyle = '#5a5680'; ctx.beginPath(); ctx.moveTo(x - cw * 1.4, b - H); ctx.lineTo(x, b - H - cw * 4); ctx.lineTo(x + cw * 1.4, b - H); ctx.closePath(); ctx.fill();
        }
      } },
    ],
    bgDynamic(ctx, w, h, t) {
      const P = KS.P, c = P && P.c != null ? P.c : 300;
      const d = dialgaOf(c), p = palkiaOf(c);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 4; i++) { const x = ((i * 400 + t * 6) % (w + 400)) - 200, y = h * (0.2 + i * 0.07); ctx.beginPath(); ctx.ellipse(x, y, 90, 10, 0, 0, 7); ctx.fill(); }
      if (P && P.fast) { ctx.fillStyle = 'rgba(60,170,255,0.16)'; ctx.fillRect(0, 0, w, h); }
      if (P && P.wrap) { ctx.fillStyle = `rgba(230,90,190,${0.12 + 0.04 * Math.sin(t * 3)})`; ctx.fillRect(0, 0, w, h); }
      void d; void p;
    },
    drawStage(ctx, P, t) {
      KS.P = P;
      const c = P.c != null ? P.c : 300, d = dialgaOf(c), p = palkiaOf(c);
      // Dialga / Palkia surgissent d'une faille derrière le temple
      if (d > 0) {
        const roar = c >= DIA.roar && c < DIA.s1 ? Math.min(1, (c - DIA.roar) / 20) * (0.75 + 0.25 * Math.sin(t * 9)) : 0;
        rift(ctx, -108, 82, Math.min(1, d * 1.5), t, ['rgba(200,240,255,0.9)', 'rgba(60,120,220,0.5)', 'rgba(160,230,255,0.7)']);
        if (P.fast) clockFx(ctx, -108, 82, 1, t);
        ctx.save(); ctx.globalAlpha = d; ctx.translate(-124, 30 - (1 - d) * 40); ctx.scale(1.5, 1.5); dialga(ctx, t, roar); ctx.restore();
        if (P.fast) { // « ×1,5 » qui pulse à côté de sa tête
          const k = 1 + 0.08 * Math.sin(t * 12);
          ctx.save(); ctx.translate(-30, 118); ctx.scale(k, -k); ctx.font = '900 15px Rubik, sans-serif'; ctx.textAlign = 'center';
          ctx.lineWidth = 3; ctx.strokeStyle = '#123070'; ctx.strokeText('×1,5', 0, 0); ctx.fillStyle = '#bff0ff'; ctx.fillText('×1,5', 0, 0); ctx.restore();
        }
      }
      if (p > 0) {
        const roar = c >= PAL.roar && c < PAL.w1 ? Math.min(1, (c - PAL.roar) / 20) * (0.75 + 0.25 * Math.sin(t * 9)) : 0;
        rift(ctx, 108, 82, Math.min(1, p * 1.5), t, ['rgba(255,220,240,0.9)', 'rgba(200,80,180,0.5)', 'rgba(255,170,220,0.7)']);
        ctx.save(); ctx.globalAlpha = p; ctx.translate(124, 30 - (1 - p) * 40); ctx.scale(-1.5, 1.5); palkia(ctx, t, roar); ctx.restore();
      }
      column(ctx, P.plats[0], true); column(ctx, P.plats[1], false);
      temple(ctx, P, t);
      const stone = (q) => lin(ctx, 0, q.y, 0, q.y - 3, [[0, '#e4e6f2'], [1, '#8d8fa8']]);
      platform(ctx, P.plats[0], stone(P.plats[0]), '#ffffff', 3);
      platform(ctx, P.plats[1], stone(P.plats[1]), '#ffffff', 3);
      // dalle flottante (avec le symbole des deux gardiens : diamant + perle)
      const q = P.plats[2], fy = Math.sin(t * 1.2) * 0.3;
      ctx.save(); ctx.translate(0, fy);
      poly(ctx, [q.l, q.y, q.r, q.y, q.r - 3, q.y - 5, q.l + 3, q.y - 5], stone(q), 'rgba(30,30,50,0.7)', 0.6);
      poly(ctx, [-5, q.y - 2.5, -3, q.y - 1, -1, q.y - 2.5, -3, q.y - 4], '#5fb4ee'); ctx.fillStyle = '#f2a8c8'; ctx.beginPath(); ctx.arc(3, q.y - 2.5, 1.4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(q.l + 0.5, q.y); ctx.lineTo(q.r - 0.5, q.y); ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore();
    },
    drawFront(ctx, P, t) {
      if (P.fast) { // traits de vitesse : le temps file
        ctx.strokeStyle = 'rgba(220,245,255,0.6)'; ctx.lineWidth = 0.7;
        for (let i = 0; i < 14; i++) { const x = 240 - ((t * 520 + i * 83) % 480), y = -40 + ((i * 47) % 190); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16 + (i % 3) * 8, y); ctx.stroke(); }
      }
      if (!P.wrap) return;
      // coutures de l'espace replié, sur les deux bords
      for (const s of [-1, 1]) {
        const x = s * WX;
        ctx.fillStyle = lin(ctx, x - s * 14, 0, x, 0, [[0, 'rgba(255,120,210,0)'], [1, 'rgba(255,140,220,0.45)']]);
        ctx.fillRect(Math.min(x, x - s * 14), -200, 14, 420);
        ctx.strokeStyle = 'rgba(255,220,245,0.9)'; ctx.lineWidth = 0.8; ctx.beginPath();
        for (let y = -160; y <= 220; y += 4) { const xx = x + Math.sin(y * 0.15 + t * 6) * 1.6; if (y === -160) ctx.moveTo(xx, y); else ctx.lineTo(xx, y); }
        ctx.stroke();
      }
    },
  };
})(window.G);
