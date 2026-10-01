'use strict';
// Terrains « sur un Pokémon » : Dos de Torterra (menhir, branche et grand feuillage qui se balance) et Ventre de Ronflex (pas plat :
// sa tête et ses pieds dépassent en plateformes, et son ventre fait trampoline quand il ronfle).
(function (G) {
  const S = G.STAGES, U = G.U;
  const { lin, rad, ridge, peaks, pine, platform, movePlat } = G.STG;

  // ---------- Dos de Torterra ----------
  // On se bat sur la carapace verte de Torterra, qui marche dans un lac. Disposition inspirée de son vrai arbre
  // (penché, tordu, avec un gros feuillage en haut à gauche et un plus petit en bas à droite) :
  //  - le sommet d'un MENHIR de pierre à l'arrière de la carapace (petite plateforme basse, près du bord gauche) ;
  //  - le petit feuillage au bout d'une branche (plateforme moyenne, à droite) ;
  //  - le grand feuillage en haut à gauche, qui SE BALANCE doucement dans le vent (plateforme mobile qui emporte
  //    ceux qui sont dessus).
  const CANOPY = { l: -50, r: -10 }, SWAY_A = 9, SWAY_SPEED = 0.6; // amplitude (unités), degrés par frame (cycle de 10 s)
  // Feuillage de chêne bosselé : grappe de boules, ombrées en bas, éclairées en haut à gauche
  function foliage(ctx, lumps, t, ph) {
    ctx.fillStyle = '#24582c';
    for (const [x, y, r] of lumps) { ctx.beginPath(); ctx.arc(x, y - 1, r + 0.8, 0, 7); ctx.fill(); }
    for (const [x, y, r] of lumps) { ctx.fillStyle = lin(ctx, 0, y - r, 0, y + r, [[0, '#2f6e33'], [1, '#4f9a45']]); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    for (let i = 0; i < lumps.length; i++) {
      const [x, y, r] = lumps[i], w = Math.sin(t * 1.3 + i + ph) * 0.3;
      ctx.fillStyle = 'rgba(126,196,96,0.75)'; ctx.beginPath(); ctx.arc(x - r * 0.3 + w, y + r * 0.35, r * 0.55, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(170,224,130,0.5)'; ctx.beginPath(); ctx.arc(x - r * 0.42 + w, y + r * 0.5, r * 0.25, 0, 7); ctx.fill();
    }
  }
  function water(ctx, WL, t, front) {
    if (!front) { ctx.fillStyle = lin(ctx, 0, WL, 0, WL - 200, [[0, '#3d8fae'], [1, '#0e3348']]); ctx.fillRect(-700, WL, 1400, -260); return; }
    ctx.fillStyle = 'rgba(40,120,160,0.55)'; ctx.fillRect(-700, WL, 1400, -260);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath();
    for (let x = -700; x <= 700; x += 5) { const y = WL + Math.sin(x * 0.11 + t * 2) * 0.5; if (x === -700) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // Patte de Torterra : marron, trapue, griffes en pierre grise
  function leg(ctx, x, sw, back) {
    const c1 = back ? '#7a5230' : '#a0703f', c2 = back ? '#5a3a20' : '#7a5230';
    ctx.fillStyle = lin(ctx, x - 10, 0, x + 10, 0, [[0, c2], [0.5, c1], [1, c2]]);
    ctx.beginPath(); ctx.moveTo(x - 11, -24); ctx.lineTo(x + 11, -24); ctx.quadraticCurveTo(x + 13 + sw, -40, x + 11 + sw, -55); ctx.lineTo(x - 11 + sw, -55); ctx.quadraticCurveTo(x - 13 + sw, -40, x - 11, -24); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,8,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.fillStyle = back ? '#9c9c98' : '#c9c9c4';
    for (const dx of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(x + sw + dx - 3, -54); ctx.lineTo(x + sw + dx + 3, -54); ctx.lineTo(x + sw + dx + 1.5, -60); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
  function spike(ctx, x0, y0, x1, y1, tx, ty, col) { // pique de pierre (base x0,y0 - x1,y1 ; pointe tx,ty)
    ctx.fillStyle = col || '#cfcfca'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(tx, ty); ctx.lineTo(x1, y1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(50,45,40,0.7)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2); ctx.lineTo(tx, ty); ctx.stroke();
  }
  // Tête de Torterra (de profil, regard vers la droite) : crâne vert sous le rebord de la carapace, bec sombre
  // crochu de tortue serpentine, œil rouge cerclé de noir au regard dur, mâchoire marron avec un masque dentelé,
  // piques de pierre sur les joues.
  const HEAD = { x: 119, y: -21, k: 0.95 };
  function torterraNeck(ctx, t) { // le cou sort de sous le rebord de la carapace (dessiné avant elle)
    const nod = Math.sin(t * 1.6 + 1) * 0.9;
    ctx.save(); ctx.translate(HEAD.x, HEAD.y + nod); ctx.scale(HEAD.k, HEAD.k);
    ctx.fillStyle = '#8a5c32'; ctx.beginPath(); ctx.moveTo(-36, 12); ctx.lineTo(-14, 10); ctx.lineTo(-12, -14); ctx.lineTo(-36, -16); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function torterraHead(ctx, t) {
    const nod = Math.sin(t * 1.6 + 1) * 0.9, blink = (t % 5.1) < 0.14;
    ctx.save(); ctx.translate(HEAD.x, HEAD.y + nod); ctx.scale(HEAD.k, HEAD.k);
    ctx.lineJoin = 'round';
    const ink = 'rgba(25,20,15,0.75)';
    // pique de la joue opposée (dépasse au-dessus du bec, vers l'avant)
    spike(ctx, 9, 8, 16, 12.5, 22.5, 15.5, '#b9b9b4');
    // mâchoire marron
    ctx.fillStyle = lin(ctx, 0, 2, 0, -16, [[0, '#b27a44'], [1, '#7e5129']]);
    ctx.beginPath(); ctx.moveTo(-22, 3); ctx.quadraticCurveTo(-16, -3, -2, -3); ctx.lineTo(19, -4); ctx.quadraticCurveTo(20, -11, 12, -14); ctx.quadraticCurveTo(-4, -18, -15, -13); ctx.quadraticCurveTo(-24, -7, -22, 3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 0.7; ctx.stroke();
    // crâne vert
    ctx.fillStyle = lin(ctx, 0, 16, 0, -3, [[0, '#6cbf55'], [1, '#2f7a35']]);
    ctx.beginPath(); ctx.moveTo(-21, 10); ctx.quadraticCurveTo(-8, 18, 8, 14); ctx.quadraticCurveTo(17, 11, 21, 4); ctx.lineTo(16, -2); ctx.lineTo(-2, -3); ctx.quadraticCurveTo(-17, -3, -22, 3); ctx.closePath(); ctx.fill();
    ctx.stroke();
    // le rebord gris de la carapace forme une pointe posée sur le front
    ctx.fillStyle = lin(ctx, 0, 18, 0, 9, [[0, '#ecece6'], [1, '#9c9c96']]);
    ctx.beginPath(); ctx.moveTo(-24, 13); ctx.quadraticCurveTo(-10, 18.5, 4, 16.5); ctx.lineTo(13, 12.6); ctx.lineTo(1, 12.4); ctx.quadraticCurveTo(-10, 12, -23, 7.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,40,36,0.7)'; ctx.lineWidth = 0.6; ctx.stroke();
    // masque sombre dentelé sous l'œil
    ctx.fillStyle = '#2a1d14';
    ctx.beginPath(); ctx.moveTo(-6, 0.5); ctx.lineTo(9, -1); ctx.lineTo(7, -6); ctx.lineTo(4, -3.5); ctx.lineTo(1, -8); ctx.lineTo(-2, -4.5); ctx.lineTo(-5, -7); ctx.lineTo(-7, -3); ctx.closePath(); ctx.fill();
    // bouche dentelée
    ctx.strokeStyle = '#2a1d14'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(18, -6);
    for (let i = 1; i <= 6; i++) ctx.lineTo(18 - i * 3.2, -6.5 - (i % 2) * 1.3);
    ctx.stroke();
    // bec crochu
    ctx.fillStyle = lin(ctx, 14, 0, 32, 0, [[0, '#4a4342'], [1, '#1d1919']]);
    ctx.beginPath(); ctx.moveTo(13, 9); ctx.quadraticCurveTo(26, 9, 32, 2); ctx.quadraticCurveTo(34, -5, 28, -10); ctx.lineTo(24, -6); ctx.quadraticCurveTo(25, -2, 17, -2); ctx.quadraticCurveTo(14, 2, 13, 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(10,8,8,0.9)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(24, 5, 4, 1.4, -0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#100c0c'; ctx.beginPath(); ctx.arc(27, 3, 0.7, 0, 7); ctx.fill(); // narine
    // œil : anneau noir, blanc, iris rouge, sourcil lourd
    ctx.fillStyle = '#141010'; ctx.beginPath(); ctx.ellipse(2, 3, 5, 4, -0.15, 0, 7); ctx.fill();
    if (blink) { ctx.strokeStyle = '#6cbf55'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-2, 3); ctx.lineTo(6, 2.4); ctx.stroke(); }
    else {
      ctx.fillStyle = '#f3ebe4'; ctx.beginPath(); ctx.ellipse(2.4, 2.8, 3.2, 2.5, -0.15, 0, 7); ctx.fill();
      ctx.fillStyle = '#c4262a'; ctx.beginPath(); ctx.arc(3.2, 2.6, 1.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a0808'; ctx.beginPath(); ctx.arc(3.4, 2.6, 0.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(2.6, 3.4, 0.5, 0, 7); ctx.fill();
    }
    ctx.fillStyle = '#3f8f3c'; ctx.beginPath(); ctx.moveTo(-4, 6.5); ctx.lineTo(8, 4.6); ctx.lineTo(7, 7.4); ctx.lineTo(-3, 8.6); ctx.closePath(); ctx.fill(); // paupière (air sévère)
    ctx.strokeStyle = '#141010'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, 6.4); ctx.lineTo(8, 4.4); ctx.stroke();
    // pique de la joue (côté visible) vers l'arrière
    spike(ctx, -12, 4, -8, -4, -30, 6);
    ctx.restore();
  }

  S.torterra = {
    id: 'torterra', name: 'Dos de Torterra', sub: 'Lac de la forêt de Sinnoh', music: 6,
    phys: {
      main: { l: -95, r: 95, y: 0, bottom: -34 },
      // 0 = sommet du menhir, 1 = petit feuillage au bout de la branche, 2 = grand feuillage qui se balance
      plats: [{ l: -77, r: -61, y: 24 }, { l: 14, r: 46, y: 36 }, { l: CANOPY.l, r: CANOPY.r, y: 57 }],
      blast: { l: -280, r: 280, t: 205, b: -150 }, cam: { l: -225, r: 225, t: 160, b: -98 },
      respawn: [0, 84], spawns: [[-62, 0, -1], [62, 0, -1], [-22, 0, -1], [22, 0, -1]], spawns2: [[-45, 0, -1], [45, 0, -1]],
    },
    // Le grand feuillage se balance (plateforme mobile) et emporte ceux qui sont posés dessus
    tick(S) {
      const off = Math.round(SWAY_A * U.dsin(S.frame * SWAY_SPEED) * 1000) / 1000;
      S.stage.sway = off;
      movePlat(S, 2, CANOPY.l + off, CANOPY.r + off);
    },
    bgStatic(ctx, w, h) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#6ec0ff'], [0.5, '#c4ebff'], [0.62, '#e9f9e8'], [0.625, '#3f8fb0'], [1, '#164e6a']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rad(ctx, w * 0.2, h * 0.15, 0, h * 0.4, [[0, 'rgba(255,255,225,0.95)'], [0.12, 'rgba(255,250,210,0.55)'], [1, 'rgba(255,255,255,0)']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(w * 0.2, h * 0.15, h * 0.04, 0, 7); ctx.fill();
      peaks(ctx, w, h * 0.52, h * 0.34, 9.1, 'rgba(120,150,190,0.7)', 'rgba(248,252,255,0.9)', 5); // le mont Couronné au loin
    },
    bgLayers: [
      { par: 0.06, draw(ctx, w, h) { ridge(ctx, w, h, h * 0.6, h * 0.07, 2.9, '#7fb86a', 14); } },
      { par: 0.14, draw(ctx, w, h) { // lisière de forêt au bord du lac
        const b = h * 0.625;
        for (let i = 0; i < 60; i++) {
          const r = ((Math.sin(i * 45.1) * 9137.7) % 1 + 1) % 1, x = i / 60 * w + r * 18, H = h * (0.06 + r * 0.05);
          if (i % 3) { ctx.fillStyle = i % 2 ? '#2f6b3a' : '#3a7d42'; ctx.beginPath(); ctx.ellipse(x, b - H * 0.6, H * 0.45, H * 0.6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#4a3020'; ctx.fillRect(x - 2, b - H * 0.2, 4, H * 0.2); }
          else pine(ctx, x, b, H * 1.2, '#24533a');
        }
      } },
      { par: 0.24, draw(ctx, w, h) { // nénuphars
        const b = h * 0.66, u = h / 600;
        for (let i = 0; i < 14; i++) {
          const x = (i * 137.3) % w, y = b + (i % 4) * h * 0.06;
          ctx.fillStyle = 'rgba(70,150,70,0.9)'; ctx.beginPath(); ctx.ellipse(x, y, 16 * u, 5 * u, 0, 0, 7); ctx.fill();
          if (i % 3 === 0) { ctx.fillStyle = '#ff9ac8'; ctx.beginPath(); ctx.arc(x + 4 * u, y - 3 * u, 4 * u, 0, 7); ctx.fill(); }
        }
      } },
    ],
    bgDynamic(ctx, w, h, t) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 5; i++) { const x = ((i * 390 + t * 9) % (w + 400)) - 200, y = h * (0.08 + i * 0.06); ctx.beginPath(); ctx.ellipse(x, y, 80, 16, 0, 0, 7); ctx.ellipse(x + 46, y - 9, 48, 15, 0, 0, 7); ctx.fill(); }
      ctx.strokeStyle = 'rgba(40,60,40,0.6)'; ctx.lineWidth = 2; // Étourmi
      for (let i = 0; i < 4; i++) { const x = ((i * 233 + t * 26) % (w + 200)) - 100, y = h * 0.28 + Math.sin(t * 2 + i) * 10 + i * 14, fl = Math.sin(t * 9 + i) * 5; ctx.beginPath(); ctx.moveTo(x - 7, y - fl); ctx.lineTo(x, y); ctx.lineTo(x + 7, y - fl); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; // reflets sur le lac
      for (let i = 0; i < 12; i++) { const y = h * (0.68 + (i % 5) * 0.06), x = ((i * 211 + t * 12) % (w + 100)) - 50; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26, y); ctx.stroke(); }
    },
    drawStage(ctx, P, t) {
      const m = P.main, WL = -40, step = Math.sin(t * 1.6), s = P.sway || 0;
      water(ctx, WL, t, false);
      // pattes arrière (plus sombres), queue
      leg(ctx, -30, -step * 3, true); leg(ctx, 66, -step * 3, true);
      ctx.fillStyle = lin(ctx, 0, -12, 0, -30, [[0, '#4f9a45'], [1, '#2f6e33']]);
      ctx.beginPath(); ctx.moveTo(-92, -14); ctx.quadraticCurveTo(-112, -18, -126, -30); ctx.quadraticCurveTo(-108, -30, -92, -28); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(20,40,10,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
      for (let i = 0; i < 3; i++) spike(ctx, -100 - i * 7, -17 - i * 2.4, -104 - i * 7, -18.5 - i * 2.6, -103 - i * 7, -13 - i * 2.6, '#bdbdb8');
      // ventre marron sous la carapace
      ctx.fillStyle = lin(ctx, 0, -24, 0, -42, [[0, '#9a6a3a'], [1, '#6a4422']]);
      ctx.beginPath(); ctx.moveTo(-90, -24); ctx.lineTo(94, -24); ctx.quadraticCurveTo(96, -40, 84, -44); ctx.lineTo(-84, -44); ctx.quadraticCurveTo(-94, -40, -90, -24); ctx.closePath(); ctx.fill();
      torterraNeck(ctx, t);
      // carapace verte en écailles
      const sh = [-97, 0, 97, 0, 101, -8, 99, -18, 92, -24, -92, -24, -99, -18, -101, -8];
      ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); for (let i = 2; i < sh.length; i += 2) ctx.lineTo(sh[i], sh[i + 1]); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 0, -24, [[0, '#5fae4e'], [1, '#2c6e31']]); ctx.fill();
      ctx.strokeStyle = 'rgba(15,40,15,0.75)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(15,45,18,0.55)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(-100, -11); ctx.quadraticCurveTo(0, -14, 100, -11); ctx.stroke();
      for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 22 + 3, 0); ctx.quadraticCurveTo(i * 22 + i * 0.6, -12, i * 22 - 2 + i * 0.4, -24); ctx.stroke(); }
      ctx.fillStyle = 'rgba(190,240,160,0.18)'; ctx.fillRect(-100, -6, 200, 3);
      ctx.restore();
      // le gros rebord gris qui fait le tour de la carapace et forme une pointe au-dessus du front
      ctx.fillStyle = lin(ctx, 0, -19, 0, -30, [[0, '#e2e2dc'], [1, '#9c9c96']]);
      ctx.beginPath(); ctx.moveTo(-104, -18); ctx.lineTo(96, -18); ctx.lineTo(103, -20); ctx.lineTo(108, -25); ctx.lineTo(100, -29.5); ctx.lineTo(94, -30); ctx.lineTo(-96, -30); ctx.quadraticCurveTo(-106, -26, -104, -18); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(40,40,36,0.7)'; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(-100, -19.5); ctx.lineTo(100, -19.5); ctx.stroke();
      // tête (devant le rebord), pattes avant
      torterraHead(ctx, t);
      leg(ctx, -66, step * 3, false); leg(ctx, 30, step * 3, false);
      // piques de pierre sur les flancs
      spike(ctx, -97, -4, -97, -12, -110, -6); // (côté tête : c'est la tête qui porte les piques)
      // le dessus de la carapace : herbe, et la terre au pied de l'arbre
      ctx.beginPath(); ctx.moveTo(m.l - 1, m.y + 0.6); ctx.lineTo(m.r + 1, m.y + 0.6); ctx.lineTo(m.r, m.y - 4.5); ctx.lineTo(m.l, m.y - 4.5); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 0, -4.5, [[0, '#7fd257'], [1, '#3d8a2e']]); ctx.fill(); ctx.strokeStyle = 'rgba(20,50,10,0.55)'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.fillStyle = lin(ctx, 0, 0.6, 0, -4, [[0, '#9a6a3c'], [1, '#5a3a20']]);
      ctx.beginPath(); ctx.moveTo(-6, 0.6); ctx.quadraticCurveTo(4, 1.4, 22, 0.8); ctx.quadraticCurveTo(40, 1.4, 54, 0.6); ctx.lineTo(48, -3.6); ctx.quadraticCurveTo(22, -4.4, 0, -3.6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4fa83a'; ctx.lineWidth = 0.35;
      for (let i = 0; i < 40; i++) { const x = m.l + 2 + i * 4.7; if (x > -4 && x < 52) continue; ctx.beginPath(); ctx.moveTo(x, 0.3); ctx.lineTo(x + Math.sin(t * 2 + i) * 0.4, 1.6 + (i % 3) * 0.4); ctx.stroke(); }
      for (let i = 0; i < 12; i++) { const x = m.l + 6 + i * 15.8; if (x > -4 && x < 52) continue; ctx.fillStyle = i % 3 ? '#fff27a' : '#ff8fb8'; ctx.beginPath(); ctx.arc(x, 1.1, 0.7, 0, 7); ctx.fill(); }
      // menhirs : le grand (plateforme) à l'arrière, un petit devant
      const mp = P.plats[0];
      ctx.fillStyle = lin(ctx, mp.l, 0, mp.r + 4, 0, [[0, '#8e8e88'], [0.45, '#d4d4ce'], [1, '#9a9a94']]);
      ctx.beginPath(); ctx.moveTo(mp.l - 6, 0); ctx.lineTo(mp.r + 6, 0); ctx.lineTo(mp.r + 1, mp.y - 5); ctx.lineTo(mp.r - 2, mp.y); ctx.lineTo(mp.l + 2, mp.y); ctx.lineTo(mp.l - 1, mp.y - 6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(50,45,40,0.75)'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(60,55,50,0.45)'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(mp.l + 4, 15); ctx.lineTo(mp.l + 8, 9); ctx.lineTo(mp.l + 6, 3); ctx.moveTo(mp.r - 3, 19); ctx.lineTo(mp.r - 6, 12); ctx.stroke();
      ctx.fillStyle = 'rgba(90,150,70,0.6)'; ctx.beginPath(); ctx.ellipse(mp.l + 3, 1.2, 4, 1.4, 0, 0, 7); ctx.fill(); // mousse
      spike(ctx, 64, 0, 76, 0, 71, 11);
      // l'arbre : racines, tronc tordu et penché qui suit le balancement du feuillage, branches
      ctx.fillStyle = '#6b4426'; ctx.strokeStyle = 'rgba(30,15,5,0.75)'; ctx.lineWidth = 0.6;
      for (const [x0, x1] of [[10, 2], [28, 38], [20, 46]]) { ctx.beginPath(); ctx.moveTo(x0 - 2, 0.4); ctx.quadraticCurveTo((x0 + x1) / 2, 2.6, x1, 0.4); ctx.lineTo(x0 + 2, 0.4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = lin(ctx, 0, 0, 30, 0, [[0, '#5a3a20'], [0.5, '#7a5030'], [1, '#4a2c16']]);
      ctx.beginPath(); ctx.moveTo(10, 0.5); ctx.quadraticCurveTo(3, 14, 9, 24); ctx.quadraticCurveTo(12, 34, -26 + s, 46);
      ctx.lineTo(-17 + s, 49); ctx.quadraticCurveTo(17, 36, 19, 24); ctx.quadraticCurveTo(21, 12, 30, 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,15,5,0.4)'; ctx.lineWidth = 0.4; // écorce
      for (let y = 5; y < 38; y += 5) { const cx = y < 24 ? 16 - y * 0.15 : 16 - (y - 24) * 1.6 + s * (y - 24) / 24; ctx.beginPath(); ctx.moveTo(cx - 3, y); ctx.quadraticCurveTo(cx, y + 1.4, cx + 3, y - 0.4); ctx.stroke(); }
      ctx.fillStyle = '#6b4426'; ctx.strokeStyle = 'rgba(30,15,5,0.7)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(15, 21); ctx.quadraticCurveTo(25, 24, 33, 31); ctx.lineTo(31, 33.5); ctx.quadraticCurveTo(23, 28, 15, 26); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-6 + s * 0.6, 38); ctx.quadraticCurveTo(-24 + s, 40, -40 + s, 44); ctx.lineTo(-39 + s, 46); ctx.quadraticCurveTo(-22 + s, 43, -4 + s * 0.6, 41); ctx.closePath(); ctx.fill(); ctx.stroke();
      // feuillages (le dessus sert de plateforme)
      foliage(ctx, [[19, 28, 6], [27, 29.5, 7], [36, 29, 7.5], [43, 28, 5.5], [24, 23, 6], [33, 22.5, 6.5], [41, 23, 5]], t, 0);
      ctx.save(); ctx.translate(s, 0);
      foliage(ctx, [[-49, 48, 8], [-39, 49, 9.5], [-28, 49.5, 9.5], [-17, 49, 9], [-8, 47, 7], [-44, 41, 7.5], [-33, 40, 9], [-21, 40, 8.5], [-11, 41, 6.5], [-28, 33, 7]], t, 2);
      ctx.restore();
      platform(ctx, P.plats[1], lin(ctx, 0, 36, 0, 33.6, [[0, '#8fdc6a'], [1, '#3f8a35']]), '#e4ffc0', 2.4);
      platform(ctx, P.plats[2], lin(ctx, 0, 57, 0, 54.6, [[0, '#8fdc6a'], [1, '#3f8a35']]), '#e4ffc0', 2.4);
      platform(ctx, mp, lin(ctx, 0, mp.y, 0, mp.y - 2.4, [[0, '#e6e6e0'], [1, '#8e8e88']]), '#ffffff', 2.4);
      // eau devant + vaguelettes autour des pattes
      water(ctx, WL, t, true);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      [-66, -30, 30, 66].forEach((x, i) => { ctx.beginPath(); ctx.ellipse(x, WL + 0.3, 7 + Math.sin(t * 3 + i) * 1.2, 0.7, 0, 0, 7); ctx.fill(); });
    },
  };

  // ---------- Ventre de Ronflex ----------
  // Ronflex dort sur le dos, en travers du pont de la Route 12. On se bat sur son ventre ; le haut de sa tête
  // (à gauche) et la plante de ses pieds levés (à droite) sont deux plateformes qui dépassent du terrain.
  // Toutes les 10 s il RONFLE : son ventre rebondit et fait sauter très haut tous ceux qui sont posés dessus
  // (sans dégâts). Ça s'annonce : le ventre gonfle, le bord rougit et les « Z » grossissent pendant 1 s.
  const SNORE = 600;
  const BOUNCE_OK = { idle: 1, walk: 1, dash: 1, run: 1, brake: 1, turn: 1, crouch: 1, land: 1, lag: 1, shield: 1, shieldOff: 1, down: 1, dizzy: 1 };
  S.ronflex = {
    id: 'ronflex', name: 'Ventre de Ronflex', sub: 'Pont de la Route 12', music: 7,
    phys: {
      main: { l: -90, r: 90, y: 0, bottom: -36 },
      plats: [{ l: -126, r: -100, y: 16 }, { l: 100, r: 124, y: 30 }],
      blast: { l: -300, r: 300, t: 205, b: -155 }, cam: { l: -240, r: 240, t: 160, b: -100 },
      respawn: [0, 70], spawns: [[-60, 0, -1], [60, 0, -1], [-22, 0, -1], [22, 0, -1]], spawns2: [[-45, 0, -1], [45, 0, -1]],
    },
    tick(S2) {
      const P = S2.stage, k = S2.frame % SNORE;
      P.snore = SNORE - k;
      if (k !== 0 || S2.frame === 0 || S2.phase !== 'play') return;
      for (const f of S2.fighters) {
        if (f.dead || f.out || !f.grounded || f.plat !== -1 || !BOUNCE_OK[f.action]) continue;
        f.grounded = false; f.plat = null; f.y += 0.5; f.vy = 3.6; f.ff = false; if (f.jumps < 1) f.jumps = 1;
        G.setAction(f, 'air');
      }
      S2.events.push({ t: 'thud', s: -1, x: 0, y: 0, k: 'snore' + S2.frame });
    },
    bgStatic(ctx, w, h) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#ffb07a'], [0.35, '#ffd9a0'], [0.58, '#fff1d0'], [0.585, '#4f8fbf'], [1, '#173e66']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rad(ctx, w * 0.7, h * 0.5, 0, h * 0.45, [[0, 'rgba(255,240,190,0.95)'], [0.15, 'rgba(255,200,140,0.5)'], [1, 'rgba(255,170,120,0)']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fff2c8'; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.5, h * 0.05, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,160,0.35)'; ctx.fillRect(w * 0.66, h * 0.6, w * 0.08, h * 0.4); // reflet du soleil sur la mer
    },
    bgLayers: [
      { par: 0.06, draw(ctx, w, h) { // côte de Kanto et la Tour Pokémon de Lavanville au loin
        const b = h * 0.585;
        ridge(ctx, w, h, b, h * 0.05, 6.3, '#9a7a9a', 14);
        ctx.fillStyle = '#6a4a7a'; const tx = w * 0.18, tw = h * 0.05;
        for (let k = 0; k < 5; k++) { const ww = tw * (1 - k * 0.14); ctx.fillRect(tx - ww / 2, b - h * 0.05 - k * h * 0.035, ww, h * 0.035); }
        ctx.beginPath(); ctx.moveTo(tx - tw * 0.3, b - h * 0.225); ctx.lineTo(tx, b - h * 0.27); ctx.lineTo(tx + tw * 0.3, b - h * 0.225); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffe9a0'; for (let k = 0; k < 4; k++) ctx.fillRect(tx - h * 0.003, b - h * 0.07 - k * h * 0.035, h * 0.006, h * 0.006);
      } },
      { par: 0.15, draw(ctx, w, h) { // rive herbeuse, arbres et pontons de pêche
        const b = h * 0.6, u = h / 600;
        ctx.fillStyle = '#6aa05a'; ctx.beginPath(); ctx.moveTo(0, b); for (let x = 0; x <= w; x += 20) ctx.lineTo(x, b - h * 0.015 - Math.sin(x * 0.01) * h * 0.01); ctx.lineTo(w, b + 8 * u); ctx.lineTo(0, b + 8 * u); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 18; i++) { const x = (i * 97.3 + 30) % w, H = h * (0.05 + (i % 3) * 0.015); ctx.fillStyle = i % 2 ? '#3f7a3c' : '#4f8f44'; ctx.beginPath(); ctx.ellipse(x, b - H * 0.7, H * 0.5, H * 0.6, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 2 * u, b - H * 0.25, 4 * u, H * 0.25); }
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3 * u;
        for (let i = 0; i < 3; i++) { const x = w * (0.35 + i * 0.22); ctx.beginPath(); ctx.moveTo(x, b + 2 * u); ctx.lineTo(x + 50 * u, b + 2 * u); ctx.stroke(); for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + k * 25 * u, b + 2 * u); ctx.lineTo(x + k * 25 * u, b + 16 * u); ctx.stroke(); } }
      } },
    ],
    bgDynamic(ctx, w, h, t) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const y = h * (0.63 + (i % 5) * 0.07), x = ((i * 233 + t * 16) % (w + 100)) - 50; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 28, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 4; i++) { const x = ((i * 410 + t * 8) % (w + 400)) - 200, y = h * (0.1 + i * 0.07); ctx.beginPath(); ctx.ellipse(x, y, 85, 15, 0, 0, 7); ctx.ellipse(x + 45, y - 9, 45, 14, 0, 0, 7); ctx.fill(); }
      ctx.strokeStyle = 'rgba(80,50,60,0.6)'; ctx.lineWidth = 2; // Goélise
      for (let i = 0; i < 3; i++) { const x = ((i * 311 + t * 22) % (w + 200)) - 100, y = h * 0.34 + Math.sin(t * 1.5 + i) * 12 + i * 20, fl = Math.sin(t * 6 + i) * 6; ctx.beginPath(); ctx.moveTo(x - 10, y - fl); ctx.quadraticCurveTo(x - 4, y - 3, x, y); ctx.quadraticCurveTo(x + 4, y - 3, x + 10, y - fl); ctx.stroke(); }
    },
    drawStage(ctx, P, t) {
      const m = P.main, WL = -48, sn = P.snore == null ? 999 : P.snore, puff = sn <= 60 ? (60 - sn) / 60 : 0;
      const breathe = Math.sin(t * 1.3) * 0.8 + puff * 3, after = sn <= SNORE && sn > SNORE - 25 ? (sn - (SNORE - 25)) / 25 : 0; // (miniature : pas de ronflement)
      const TEAL = '#2e5f73', TEAL2 = '#1c3e4e', CREAM = '#f1e2bf';
      ctx.fillStyle = lin(ctx, 0, WL, 0, WL - 200, [[0, '#4a8cc0'], [1, '#0f2f52']]); ctx.fillRect(-700, WL, 1400, -260); // mer
      // le pont de bois sous lui
      ctx.fillStyle = '#8a5a32'; ctx.fillRect(-700, -36, 1400, -6);
      ctx.strokeStyle = 'rgba(40,20,8,0.6)'; ctx.lineWidth = 0.4;
      for (let x = -700; x < 700; x += 8) { ctx.beginPath(); ctx.moveTo(x, -36); ctx.lineTo(x, -42); ctx.stroke(); }
      ctx.fillStyle = '#6b4426'; for (let x = -680; x < 700; x += 60) ctx.fillRect(x - 2.5, -42, 5, -30);
      ctx.strokeStyle = '#7a4f2c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-700, -30); ctx.lineTo(700, -30); ctx.stroke();
      // jambe + pied levé (à droite) : la plante du pied = plateforme
      const fp = P.plats[1], fx = (fp.l + fp.r) / 2;
      ctx.fillStyle = TEAL; ctx.beginPath(); ctx.moveTo(78, -12); ctx.quadraticCurveTo(98, -4, fp.l + 3, fp.y - 12); ctx.lineTo(fp.r - 3, fp.y - 13); ctx.quadraticCurveTo(106, -22, 84, -30); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(10,25,30,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.fillStyle = CREAM; ctx.beginPath(); ctx.ellipse(fx, fp.y - 6, (fp.r - fp.l) / 2 + 1.5, 6.5, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9b48c'; ctx.beginPath(); ctx.ellipse(fx, fp.y - 7, 6, 3.2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; for (let k = 0; k < 3; k++) { const x = fp.l + 6 + k * 6; ctx.beginPath(); ctx.moveTo(x - 1.5, fp.y - 0.6); ctx.lineTo(x + 1.5, fp.y - 0.6); ctx.lineTo(x, fp.y + 2.6); ctx.closePath(); ctx.fill(); }
      // corps allongé sur le dos
      ctx.beginPath(); ctx.moveTo(-92, 0); ctx.lineTo(92, 0); ctx.quadraticCurveTo(100 + breathe, -8, 96, -24); ctx.quadraticCurveTo(84, -38, 60, -38); ctx.lineTo(-60, -38); ctx.quadraticCurveTo(-86, -38, -96, -24); ctx.quadraticCurveTo(-100 - breathe, -8, -92, 0); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 0, -38, [[0, TEAL], [1, TEAL2]]); ctx.fill(); ctx.strokeStyle = 'rgba(10,25,30,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
      // gros ventre crème (le terrain)
      ctx.beginPath(); ctx.moveTo(-88, 0); ctx.lineTo(88, 0); ctx.quadraticCurveTo(90 + breathe, -12, 70, -20 - breathe * 0.5); ctx.lineTo(-70, -20 - breathe * 0.5); ctx.quadraticCurveTo(-90 - breathe, -12, -88, 0); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 0, -20, [[0, '#fff4d8'], [1, '#dcc496']]); ctx.fill(); ctx.strokeStyle = 'rgba(80,60,30,0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(m.l - 1, m.y + 0.6); ctx.lineTo(m.r + 1, m.y + 0.6); ctx.lineTo(m.r, m.y - 3.5); ctx.lineTo(m.l, m.y - 3.5); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 0, -3.5, [[0, '#fffaf0'], [1, '#efdcb2']]); ctx.fill();
      ctx.beginPath(); ctx.moveTo(m.l, m.y + 0.3); ctx.lineTo(m.r, m.y + 0.3);
      ctx.strokeStyle = puff > 0 ? `rgba(255,${Math.round(200 - puff * 120)},${Math.round(150 - puff * 100)},${0.6 + puff * 0.4})` : '#ffffff'; ctx.lineWidth = 0.7 + puff * 0.8; ctx.stroke();
      // bras posé le long du corps (côté tête)
      ctx.fillStyle = TEAL; ctx.beginPath(); ctx.ellipse(-70, -24, 16, 6, -0.15, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(10,25,30,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.fillStyle = '#ffffff'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-56 + k * 2.2, -22 - k * 1.5); ctx.lineTo(-53 + k * 2.2, -23 - k * 1.5); ctx.lineTo(-54.5 + k * 2.2, -26 - k * 1.5); ctx.closePath(); ctx.fill(); }
      // tête (à gauche), visage tourné vers le ciel : le haut du crâne = plateforme
      const hp = P.plats[0], hx = (hp.l + hp.r) / 2, hy = hp.y - 19;
      ctx.fillStyle = TEAL; ctx.beginPath(); ctx.arc(hx, hy, 19, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(10,25,30,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
      [[-1, 0.6], [1, -0.2]].forEach(([s, a]) => { ctx.fillStyle = TEAL; ctx.beginPath(); ctx.moveTo(hx - 16, hy + s * 9); ctx.lineTo(hx - 26, hy + s * 13 + a * 4); ctx.lineTo(hx - 15, hy + s * 3); ctx.closePath(); ctx.fill(); ctx.stroke(); });
      ctx.fillStyle = CREAM; ctx.beginPath(); ctx.ellipse(hx + 4, hy + 6, 13, 11, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(80,60,30,0.5)'; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 0.9; // yeux fermés
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + 4 + s * 5 - 2.5, hy + 10); ctx.lineTo(hx + 4 + s * 5 + 2.5, hy + 10); ctx.stroke(); }
      const mo = 1.2 + Math.max(0, Math.sin(t * 1.3)) * 1.5 + puff * 3.5; // la bouche s'ouvre en ronflant
      ctx.fillStyle = '#7a2a2a'; ctx.beginPath(); ctx.ellipse(hx + 5, hy + 3, 5, mo, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff'; for (const dx of [2, 8]) { ctx.beginPath(); ctx.moveTo(hx + dx - 1.2, hy + 3 - mo + 0.2); ctx.lineTo(hx + dx + 1.2, hy + 3 - mo + 0.2); ctx.lineTo(hx + dx, hy + 3 - mo + 2.2); ctx.closePath(); ctx.fill(); }
      // « Z » qui montent (plus gros et rouges juste avant le ronflement), onde juste après
      ctx.save(); ctx.scale(1, -1);
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.35 + i / 3) % 1), size = 5 + i * 1.5 + puff * 8;
        ctx.globalAlpha = (1 - k) * (0.75 + puff * 0.25); ctx.fillStyle = puff > 0.5 ? '#ff6a4a' : '#ffffff'; ctx.strokeStyle = '#2a2a40'; ctx.lineWidth = 0.6;
        ctx.font = `900 ${size}px Rubik, sans-serif`;
        const x = hx + 12 + k * 18 + i * 3, y = -(hy + 18 + k * 26 + i * 4);
        ctx.strokeText('Z', x, y); ctx.fillText('Z', x, y);
      }
      ctx.restore(); ctx.globalAlpha = 1;
      if (after > 0) { ctx.strokeStyle = `rgba(255,255,255,${after})`; ctx.lineWidth = 1.5 * after + 0.3; ctx.beginPath(); ctx.ellipse(0, 1, 100 * (1.3 - after * 0.3), 6 + (1 - after) * 10, 0, 0, 7); ctx.stroke(); }
      // mer devant
      ctx.fillStyle = 'rgba(40,110,170,0.5)'; ctx.fillRect(-700, WL, 1400, -260);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath();
      for (let x = -700; x <= 700; x += 5) { const y = WL + Math.sin(x * 0.1 + t * 2) * 0.5; if (x === -700) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    },
  };
})(window.G);
