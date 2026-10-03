'use strict';
// Dos de Wailord : on se bat sur le dos de Wailord, en pleine mer.
// Traits qui le font reconnaître : énorme baleine-dirigeable, dos BLEU et tout le dessous GRIS CLAIR strié de longs
// sillons, petit œil noir tout en haut de l'avant arrondi, ailerons bleus en voile à l'arrière, queue dressée.
//  - Plateformes : la queue (bas, à gauche), l'aileron du dos (milieu gauche) et le JET D'EAU de son évent
//    (à droite), qui monte et descend doucement.
//  - PLONGÉE : toutes les 30 s, Wailord souffle puis plonge ; on se bat SOUS L'EAU pendant ~8 s : gravité réduite,
//    chute lente, éjections freinées par l'eau, sauts et remontées bien plus hauts. Le jet d'eau s'arrête pendant
//    la plongée. Ça s'annonce 2 s avant (gros souffle, « PLONGÉE ! »).
(function (G) {
  const S = G.STAGES, U = G.U;
  const { lin, rad, platform, movePlat } = G.STG;
  const PI = Math.PI;

  const CYC = 1800, OFF = 1600; // à « GO ! » (frame 200) on est au début du cycle
  const WL = -50; // niveau de la mer (le bas du ventre de Wailord est dans l'eau)
  const SPOUT = { l: 30, r: 54, y: 32, a: 8 }; // jet d'eau de l'évent : plateforme qui monte et descend
  const WATER_MOD = { g: 0.5, f: 0.55, d: 1.35, a: 0.9 };
  const KS = { P: null };

  // niveau de l'eau (visuel) et part d'immersion selon la position dans le cycle
  function waterOf(c) {
    if (c < 1110) return WL;
    if (c < 1170) return U.lerp(WL, 230, U.smooth((c - 1110) / 60));
    if (c < 1680) return 230;
    if (c < 1740) return U.lerp(230, WL, U.smooth((c - 1680) / 60));
    return WL;
  }
  const subOf = (c) => U.clamp((waterOf(c) - WL) / 120, 0, 1);
  const spoutOn = (c) => c < 1090 || c >= 1770;

  // ---------- dessin ----------
  function wailord(ctx, P, t, c) {
    const ink = 'rgba(18,48,92,0.9)';
    const breathe = Math.sin(t * 0.9) * 0.6;
    ctx.lineJoin = 'round';
    // queue dressée (sa pointe = plateforme)
    const tp = P.plats[0];
    ctx.beginPath(); ctx.moveTo(-118, -30); ctx.quadraticCurveTo(-136, -14, tp.l - 3, tp.y + 1.5); ctx.lineTo(tp.r + 1, tp.y);
    ctx.quadraticCurveTo(tp.r - 2, -2, -108, -20); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, tp.y, 0, -30, [[0, '#5aa6e6'], [1, '#2a6fb4']]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = 'rgba(220,222,220,0.9)'; ctx.beginPath(); ctx.moveTo(-121, -24); ctx.quadraticCurveTo(-134, -8, tp.l - 1, tp.y - 1); ctx.lineTo(tp.l + 4, tp.y - 1.5); ctx.quadraticCurveTo(-128, -6, -116, -26); ctx.closePath(); ctx.fill();
    // corps : dos bleu
    const body = () => {
      ctx.beginPath(); ctx.moveTo(-96, 0); ctx.lineTo(96, 0);
      ctx.bezierCurveTo(122, 0, 142, -12, 143 + breathe, -34);
      ctx.bezierCurveTo(144, -60, 122, -78, 80, -80);
      ctx.bezierCurveTo(20, -84, -64, -78, -102, -56);
      ctx.bezierCurveTo(-118, -46, -126, -36, -128, -28);
      ctx.bezierCurveTo(-124, -12, -112, 0, -96, 0); ctx.closePath();
    };
    body();
    ctx.fillStyle = lin(ctx, 0, 0, 0, -60, [[0, '#5fb0ee'], [0.35, '#3b8fd6'], [1, '#2466ac']]); ctx.fill();
    ctx.save(); ctx.clip();
    // tout le dessous gris clair, avec ses longs sillons
    ctx.beginPath(); ctx.moveTo(150, -18); ctx.bezierCurveTo(124, -24, 108, -40, 60, -46); ctx.bezierCurveTo(10, -52, -60, -54, -100, -40); ctx.lineTo(-140, -30); ctx.lineTo(-140, -100); ctx.lineTo(150, -100); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, -30, 0, -84, [[0, '#ecebe7'], [1, '#bdbcb8']]); ctx.fill();
    ctx.strokeStyle = 'rgba(70,72,78,0.75)'; ctx.lineWidth = 0.55;
    for (let i = 0; i < 8; i++) {
      const k = i / 7, y0 = -26 - k * 40, y1 = -49 - k * 26;
      ctx.beginPath(); ctx.moveTo(146, y0 + 6); ctx.bezierCurveTo(118, y0 - 2, 90, y1 + 2, 40, y1 - 2); ctx.bezierCurveTo(-10, y1 - 4, -60, y1 + 6 - k * 4, -104, -44 - k * 12); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(18,48,92,0.8)'; ctx.lineWidth = 0.8; // frontière bleu / gris
    ctx.beginPath(); ctx.moveTo(150, -18); ctx.bezierCurveTo(124, -24, 108, -40, 60, -46); ctx.bezierCurveTo(10, -52, -60, -54, -100, -40); ctx.stroke();
    // reflet sur le dos
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(110, -10, 16, 5, -0.4, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-100, -5, 200, 2.4);
    ctx.restore();
    body(); ctx.strokeStyle = ink; ctx.lineWidth = 0.9; ctx.stroke();
    // petit œil noir tout en haut de l'avant
    const blink = (t % 5.7) < 0.15;
    if (blink) { ctx.strokeStyle = '#0c1a2e'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(114.5, -11); ctx.lineTo(118.5, -11); ctx.stroke(); }
    else { ctx.fillStyle = '#0c1a2e'; ctx.beginPath(); ctx.arc(116.5, -11, 1.5, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(116.1, -10.5, 0.45, 0, 7); ctx.fill(); }
    // nageoire du flanc (bleue, en voile, vers l'arrière)
    ctx.beginPath(); ctx.moveTo(8, -26); ctx.quadraticCurveTo(-14, -20 + breathe, -34, -10); ctx.quadraticCurveTo(-22, -26, -6, -34); ctx.closePath();
    ctx.fillStyle = lin(ctx, 8, 0, -34, 0, [[0, '#2f7ac2'], [1, '#62b2ee']]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.7; ctx.stroke();
    // aileron du dos (plateforme) en voile, avec une seconde petite nageoire derrière
    const fp = P.plats[1];
    ctx.beginPath(); ctx.moveTo(fp.l - 14, 0); ctx.quadraticCurveTo(fp.l - 9, fp.y * 0.65, fp.l, fp.y); ctx.lineTo(fp.r + 2, fp.y); ctx.quadraticCurveTo(fp.r - 2, fp.y * 0.45, fp.r + 8, 0); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, fp.y, 0, 0, [[0, '#6cbcf2'], [1, '#2f7ac2']]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.4;
    for (let i = 1; i < 4; i++) { const x = fp.l + (fp.r - fp.l) * i / 4; ctx.beginPath(); ctx.moveTo(x, fp.y - 1); ctx.quadraticCurveTo(x - 4, fp.y * 0.5, x - 2 + i * 2, 1); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-96, 0); ctx.quadraticCurveTo(-100, 9, -106, 13); ctx.quadraticCurveTo(-98, 12, -84, 0); ctx.closePath();
    ctx.fillStyle = '#3b8fd6'; ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.6; ctx.stroke();
    // évent
    ctx.fillStyle = '#1d4f8a'; ctx.beginPath(); ctx.ellipse(42, -0.6, 4, 1, 0, 0, 7); ctx.fill();
  }
  // jet d'eau de l'évent (plateforme mobile)
  function spout(ctx, P, t, c) {
    const p = P.plats[2], on = p.y > -999, top = on ? p.y : (c >= 1090 && c < 1150 ? 32 * (1 - (c - 1090) / 60) : 0);
    if (top <= 0.5) return;
    const cx = (SPOUT.l + SPOUT.r) / 2;
    ctx.fillStyle = lin(ctx, 0, 0, 0, top, [[0, 'rgba(160,215,255,0.85)'], [1, 'rgba(235,250,255,0.95)']]);
    ctx.beginPath(); ctx.moveTo(cx - 3, 0); ctx.quadraticCurveTo(cx - 5 + Math.sin(t * 9) * 0.6, top * 0.5, cx - 9, top - 2); ctx.lineTo(cx + 9, top - 2); ctx.quadraticCurveTo(cx + 5 + Math.sin(t * 8) * 0.6, top * 0.5, cx + 3, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.4;
    for (let i = 0; i < 4; i++) { const y = ((t * 40 + i * top / 4) % top); ctx.beginPath(); ctx.moveTo(cx - 2 - y * 0.12, y); ctx.lineTo(cx - 2 - y * 0.12, y + 3); ctx.moveTo(cx + 2 + y * 0.12, y); ctx.lineTo(cx + 2 + y * 0.12, y + 3); ctx.stroke(); }
    // gerbe d'écume au sommet (le dessus sert de plateforme)
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 7; i++) { const x = SPOUT.l + 1 + i * (SPOUT.r - SPOUT.l - 2) / 6, r = 2.6 + (i % 2) * 0.9 + Math.sin(t * 7 + i) * 0.4; ctx.beginPath(); ctx.arc(x, top - 1.4, r, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(200,235,255,0.9)';
    for (let i = 0; i < 6; i++) { const k = (t * 1.3 + i / 6) % 1, s = i % 2 ? 1 : -1; ctx.beginPath(); ctx.arc(cx + s * (10 + k * 10), top + 2 - k * k * 22, 1.2 * (1 - k) + 0.3, 0, 7); ctx.fill(); }
  }

  S.wailord = {
    id: 'wailord', name: 'Dos de Wailord', sub: 'Océan de Hoenn', music: 9,
    phys: {
      main: { l: -96, r: 96, y: 0, bottom: -40 },
      // 0 = queue, 1 = aileron du dos, 2 = jet d'eau de l'évent (monte et descend ; absent pendant la plongée)
      plats: [{ l: -147, r: -123, y: 14 }, { l: -62, r: -38, y: 27 }, { l: SPOUT.l, r: SPOUT.r, y: SPOUT.y }],
      blast: { l: -290, r: 290, t: 205, b: -150 }, cam: { l: -235, r: 235, t: 160, b: -98 },
      respawn: [0, 80], spawns: [[-64, 0, -1], [64, 0, -1], [-22, 0, -1], [22, 0, -1]], spawns2: [[-46, 0, -1], [46, 0, -1]],
    },
    tick(S2) {
      const P = S2.stage, c = (S2.frame + OFF) % CYC;
      P.c = c;
      // jet d'eau
      if (spoutOn(c)) movePlat(S2, 2, SPOUT.l, SPOUT.r, SPOUT.y + Math.round(SPOUT.a * U.dsin(S2.frame * 1.2) * 1000) / 1000);
      else if (P.plats[2].y > -999) {
        for (const f of S2.fighters) if (!f.dead && f.grounded && f.plat === 2) G.goAir(S2, f);
        P.plats[2].y = -9999;
      }
      // sous l'eau : physique modifiée
      const under = c >= 1165 && c < 1712;
      P.mod = under ? WATER_MOD : null;
      if (c === 1080) S2.events.push({ t: 'stage', name: 'roar', ev: 'dive', k: 'wld' + S2.frame });
      if (c === 1120) S2.events.push({ t: 'stage', name: 'splash', k: 'wls' + S2.frame });
      if (c === 1690) S2.events.push({ t: 'stage', name: 'splash', ev: 'up', k: 'wlu' + S2.frame });
    },
    fx(e, R) {
      if (e.ev === 'dive') R.banner = { txt: 'PLONGÉE !', t: 0, big: 1, col: '#7fd8ff' };
    },
    bgStatic(ctx, w, h) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#2f86e0'], [0.48, '#a9dcff'], [0.6, '#e9f8ff'], [0.602, '#2f8fd0'], [1, '#0b3d72']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rad(ctx, w * 0.25, h * 0.2, 0, h * 0.4, [[0, 'rgba(255,255,230,0.95)'], [0.12, 'rgba(255,250,215,0.5)'], [1, 'rgba(255,255,255,0)']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fffbea'; ctx.beginPath(); ctx.arc(w * 0.25, h * 0.2, h * 0.04, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,230,0.25)'; ctx.beginPath(); ctx.ellipse(w * 0.25, h * 0.72, w * 0.04, h * 0.12, 0, 0, 7); ctx.fill();
    },
    bgLayers: [
      { par: 0.05, draw(ctx, w, h) { // îles volcaniques de Hoenn à l'horizon
        const b = h * 0.6;
        [[0.12, 0.09, 0.05], [0.55, 0.16, 0.085], [0.82, 0.07, 0.04]].forEach(([fx, fw, fh]) => {
          ctx.fillStyle = '#5c8a8a'; ctx.beginPath(); ctx.moveTo(w * (fx - fw), b); ctx.quadraticCurveTo(w * (fx - fw * 0.3), b - h * fh * 1.2, w * fx, b - h * fh); ctx.quadraticCurveTo(w * (fx + fw * 0.3), b - h * fh * 1.1, w * (fx + fw), b); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#7aa66e'; ctx.beginPath(); ctx.ellipse(w * fx, b - 2, w * fw * 0.7, h * 0.008, 0, PI, 0); ctx.fill();
        });
      } },
    ],
    bgDynamic(ctx, w, h, t) {
      const P = KS.P, c = P && P.c != null ? P.c : 300, sub = subOf(c);
      // vagues
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
      for (let i = 0; i < 16; i++) { const y = h * (0.63 + (i % 6) * 0.06), x = ((i * 211 + t * 18 * (1 + (i % 3))) % (w + 100)) - 50; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 15, y - 4, x + 30, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 4; i++) { const x = ((i * 420 + t * 7) % (w + 400)) - 200, y = h * (0.1 + i * 0.07); ctx.beginPath(); ctx.ellipse(x, y, 85, 15, 0, 0, 7); ctx.ellipse(x + 46, y - 9, 46, 14, 0, 0, 7); ctx.fill(); }
      // Goélise (blanc, bout des ailes bleu)
      for (let i = 0; i < 3; i++) {
        const x = ((i * 337 + t * 34) % (w + 200)) - 100, y = h * 0.32 + Math.sin(t * 1.4 + i) * 14 + i * 22, fl = Math.sin(t * 6 + i) * 7;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 16, y - fl); ctx.quadraticCurveTo(x - 6, y - 4, x, y); ctx.quadraticCurveTo(x + 6, y - 4, x + 16, y - fl); ctx.stroke();
        ctx.strokeStyle = '#3b7fd0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - 16, y - fl); ctx.lineTo(x - 12, y - fl * 0.8 - 1); ctx.moveTo(x + 16, y - fl); ctx.lineTo(x + 12, y - fl * 0.8 - 1); ctx.stroke();
        ctx.fillStyle = '#f6c84a'; ctx.beginPath(); ctx.arc(x + 2, y + 1, 2, 0, 7); ctx.fill();
      }
      // sous l'eau : tout devient bleu profond, rayons de lumière, Lanturn qui passent
      if (sub > 0) {
        ctx.fillStyle = `rgba(8,52,110,${0.88 * sub})`; ctx.fillRect(0, 0, w, h);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
          const x = w * (0.1 + i * 0.17) + Math.sin(t * 0.5 + i) * 30;
          ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, `rgba(120,200,255,${0.18 * sub})`], [1, 'rgba(120,200,255,0)']]);
          ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x + 20, 0); ctx.lineTo(x + 90, h); ctx.lineTo(x - 20, h); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        for (let i = 0; i < 3; i++) { // Lanturn : corps bleu, deux antennes avec boules lumineuses jaunes
          const x = w + 100 - ((t * (30 + i * 12) + i * 500) % (w + 300)), y = h * (0.3 + i * 0.22), s = h / 600 * (1 + (i % 2) * 0.4);
          ctx.globalAlpha = sub;
          ctx.fillStyle = rad(ctx, x - 22 * s, y - 20 * s, 0, 30 * s, [[0, 'rgba(255,250,150,0.6)'], [1, 'rgba(255,250,150,0)']]); ctx.fillRect(x - 60 * s, y - 60 * s, 80 * s, 80 * s);
          ctx.fillStyle = '#2a5fa8'; ctx.beginPath(); ctx.ellipse(x, y, 18 * s, 11 * s, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#e8d76a'; ctx.beginPath(); ctx.ellipse(x + 3 * s, y - 4 * s, 12 * s, 5 * s, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = '#2a5fa8'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x - 8 * s, y + 8 * s); ctx.quadraticCurveTo(x - 14 * s, y + 24 * s, x - 22 * s, y + 20 * s); ctx.stroke();
          ctx.fillStyle = '#fff59a'; ctx.beginPath(); ctx.arc(x - 22 * s, y + 20 * s, 4 * s, 0, 7); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    },
    drawStage(ctx, P, t) {
      KS.P = P;
      const c = P.c != null ? P.c : 300, wl = waterOf(c), sub = subOf(c);
      // mer derrière Wailord
      ctx.fillStyle = lin(ctx, 0, WL, 0, WL - 200, [[0, '#2f86c8'], [1, '#0a2f5c']]); ctx.fillRect(-700, WL, 1400, -260);
      wailord(ctx, P, t, c);
      spout(ctx, P, t, c);
      // dessus du dos (le terrain)
      const m = P.main;
      ctx.beginPath(); ctx.moveTo(m.l - 1, m.y + 0.6); ctx.lineTo(m.r + 1, m.y + 0.6); ctx.lineTo(m.r, m.y - 4); ctx.lineTo(m.l, m.y - 4); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 0, -4, [[0, '#8fd0fa'], [1, '#4a9ee0']]); ctx.fill();
      ctx.strokeStyle = 'rgba(18,48,92,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; // flaques d'eau qui brillent
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(m.l + 18 + i * 32, 0.35, 4 + (i % 3) * 2, 0.6, 0, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(m.l, m.y + 0.3); ctx.lineTo(m.r, m.y + 0.3); ctx.strokeStyle = '#e6f6ff'; ctx.lineWidth = 0.7; ctx.stroke();
      const blue = (p) => lin(ctx, 0, p.y, 0, p.y - 2.4, [[0, '#9ad6fb'], [1, '#2f7ac2']]);
      platform(ctx, P.plats[0], blue(P.plats[0]), '#e6f6ff', 2.2);
      platform(ctx, P.plats[1], blue(P.plats[1]), '#e6f6ff', 2.2);
      // mer devant (le ventre de Wailord paraît sous l'eau), seulement quand on est en surface
      if (wl <= WL + 0.5 || sub < 1) {
        ctx.fillStyle = 'rgba(30,110,175,0.55)'; ctx.fillRect(-700, WL, 1400, -260);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.6; ctx.beginPath();
        for (let x = -700; x <= 700; x += 5) { const y = WL + Math.sin(x * 0.1 + t * 2) * 0.5; if (x === -700) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(s > 0 ? 140 + i * 4 : -124 - i * 4, WL + 0.3, 3 - i * 0.6 + Math.sin(t * 3 + i) * 0.5, 0.6, 0, 0, 7); ctx.fill(); }
      }
    },
    drawFront(ctx, P, t, S2) {
      const c = P.c != null ? P.c : 300, wl = waterOf(c);
      if (wl <= WL + 0.5) return;
      // l'eau monte (ou redescend) : elle passe DEVANT les combattants
      ctx.fillStyle = 'rgba(25,105,185,0.32)'; ctx.fillRect(-700, wl, 1400, -400);
      if (wl < 220) {
        ctx.strokeStyle = 'rgba(230,248,255,0.9)'; ctx.lineWidth = 0.8; ctx.beginPath();
        for (let x = -700; x <= 700; x += 4) { const y = wl + Math.sin(x * 0.09 + t * 3) * 1.2; if (x === -700) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      }
      // reflets ondulants et bulles qui montent des combattants
      ctx.strokeStyle = 'rgba(200,240,255,0.18)'; ctx.lineWidth = 0.6;
      for (let i = 0; i < 14; i++) { const y = Math.min(wl - 6, 150) - (i * 23) % 220, x = ((i * 61 + t * 9) % 420) - 210; if (y < -100) continue; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y + 1.5, x + 16, y); ctx.stroke(); }
      if (S2) {
        ctx.strokeStyle = 'rgba(235,250,255,0.85)'; ctx.lineWidth = 0.4;
        for (const f of S2.fighters) {
          if (f.dead || f.out) continue;
          const st = G.ST(f);
          for (let i = 0; i < 3; i++) {
            const k = (t * 0.9 + i / 3 + f.slot * 0.17) % 1, y = f.y + st.h + k * 30;
            if (y > wl) continue;
            ctx.beginPath(); ctx.arc(f.x + Math.sin(t * 4 + i * 2 + f.slot) * 2, y, 0.8 + k * 0.9, 0, 7); ctx.stroke();
          }
        }
      }
    },
  };
})(window.G);
