'use strict';
// Langue d'Oyacata : on se bat sur la langue d'Oyacata, face à sa gueule grande ouverte, au milieu d'un lac.
// Traits qui le font reconnaître : énorme tête BLEUE avec une bande d'écailles HEXAGONALES plus sombres, gueule
// gigantesque, longues MOUSTACHES blanches qui partent des coins de la bouche, petits yeux gris au regard
// furieux, nageoires blanches arrondies sur le dessus de la tête, dessous blanc. Et Nigirigon, son « commandant »,
// installé sur sa langue.
//  - Plateformes : les deux coins de la bouche (lèvres).
//  - GLOUPS : toutes les 15 s, Nigirigon donne l'ordre (alerte 1,5 s : il saute, « ! », zone rouge au milieu) et
//    la mâchoire se referme au MILIEU de la gueule. Ceux qui y sont se font AVALER, puis 1,2 s plus tard RECRACHER
//    comme un boulet (dégâts + éjection en diagonale vers le haut), et le boulet percute ceux qu'il croise.
//    Les projectiles dans la zone sont avalés aussi. Les côtés de la langue et les lèvres sont à l'abri.
(function (G) {
  const S = G.STAGES, U = G.U;
  const { lin, rad, platform } = G.STG;
  const PI = Math.PI;

  const CYC = 900, OFF = 700; // 15 s ; à « GO ! » (frame 200) on est au début du cycle
  const CH = { warn: 780, slam: 870, shut: 878, open0: 912, open1: 942, gulp: 876 };
  const ZONE = { l: -62, r: 62, t: 92 }; // zone avalée (milieu de la gueule)
  const HOLD = 72; // frames dans le ventre avant d'être recraché
  const SPIT_HB = { dmg: 10, kbg: 70, bkb: 55, ang: 62, t: 'water', hitlag: 1 };
  const BALL_HB = { dmg: 8, kbg: 60, bkb: 45, ang: 45, t: 'water', hitlag: 1 };
  const LIP = { y: 96 }; // bord de la lèvre du haut (bouche ouverte), au milieu
  const BLUE = '#2f7cc4', BLUE_L = '#5aa6e6', BLUE_D = '#1b4c86', WHITE = '#eef2f6', GREYW = '#b4bfcc';
  const ink = 'rgba(10,30,60,0.9)';

  // fermeture de la mâchoire (0 = ouverte, 1 = fermée au milieu)
  function jawOf(c) {
    if (c < CH.warn) return 0;
    if (c < CH.slam) return 0.08 * U.smooth((c - CH.warn) / (CH.slam - CH.warn)); // elle s'abaisse un peu : ça va claquer
    if (c < CH.shut) return 0.08 + 0.92 * (c - CH.slam) / (CH.shut - CH.slam);
    if (c < CH.open0) return 1;
    if (c < CH.open1) return 1 - U.smooth((c - CH.open0) / (CH.open1 - CH.open0));
    return 0;
  }

  // ---------- dessin ----------
  function hexes(ctx, x0, x1, y, r, rows) { // bande d'écailles hexagonales
    for (let row = 0; row < rows; row++) {
      for (let x = x0 + (row % 2) * r * 0.87; x < x1; x += r * 1.74) {
        const cy = y - row * r * 1.5;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = PI / 6 + k * PI / 3; const px = x + Math.cos(a) * r * 0.92, py = cy + Math.sin(a) * r * 0.92; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.closePath(); ctx.fillStyle = '#21609f'; ctx.fill(); ctx.strokeStyle = 'rgba(120,190,245,0.55)'; ctx.lineWidth = 0.5; ctx.stroke();
      }
    }
  }
  function whisker(ctx, x0, y0, s, len, curl, t, ph) {
    const w = Math.sin(t * 1.4 + ph) * 4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 + s * len * 0.4, y0 + 10 + w * 0.3, x0 + s * len * 0.8, y0 - 6 + w, x0 + s * len, y0 - curl + w);
    ctx.strokeStyle = 'rgba(60,70,90,0.8)'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.strokeStyle = '#f7f9fb'; ctx.lineWidth = 1.7; ctx.stroke();
    // petite boucle au bout
    ctx.beginPath(); ctx.arc(x0 + s * len - s * 3, y0 - curl + w - 3, 3, 0, PI * 1.6); ctx.strokeStyle = 'rgba(60,70,90,0.8)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.strokeStyle = '#f7f9fb'; ctx.lineWidth = 0.9; ctx.stroke();
  }
  function eye(ctx, x, y, s, t, angry) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, 1);
    ctx.fillStyle = BLUE_D; ctx.beginPath(); ctx.ellipse(0, 0, 12, 8, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d9dde3'; ctx.beginPath(); ctx.ellipse(0, -0.5, 8.5, 5.6, 0, 0, 7); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = '#9aa4b2'; ctx.beginPath(); ctx.arc(2.2, -0.5, 3.3 + angry * 0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#10151e'; ctx.beginPath(); ctx.arc(2.4, -0.5, 1.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(1.4, 0.6, 0.7, 0, 7); ctx.fill();
    // sourcil lourd et furieux
    ctx.fillStyle = BLUE_D; ctx.beginPath(); ctx.moveTo(-13, 4 + angry * 2); ctx.lineTo(12, 7.5 - angry * 3); ctx.lineTo(12, 3.4 - angry * 3); ctx.lineTo(-12, 1 + angry * 2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function finTop(ctx, x, y, s) { // nageoire blanche arrondie sur le dessus de la tête
    ctx.save(); ctx.translate(x, y); ctx.scale(s, 1);
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-14, 22, 6, 30); ctx.quadraticCurveTo(22, 26, 16, 0); ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 0, 0, 30, [[0, GREYW], [1, WHITE]]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.strokeStyle = 'rgba(120,130,150,0.6)'; ctx.lineWidth = 0.4;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(2 + i * 2.5, 1); ctx.quadraticCurveTo(-2 + i * 4, 16, 2 + i * 4.5, 27); ctx.stroke(); }
    ctx.restore();
  }
  // Nigirigon (forme courbée, orange à taches pâles), installé sur la langue
  function tatsugiri(ctx, x, y, t, warn) {
    const hop = warn > 0 ? Math.abs(Math.sin(t * 14)) * 6 : Math.abs(Math.sin(t * 2)) * 0.6;
    ctx.save(); ctx.translate(x, y + hop);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, 1.2, 7, 2.2, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(80,80,90,0.6)'; ctx.lineWidth = 0.4; ctx.stroke(); // « riz »
    ctx.beginPath(); ctx.moveTo(-6, 2.5); ctx.quadraticCurveTo(-8, 12, -2, 14); ctx.quadraticCurveTo(-6, 18, -9, 15); ctx.quadraticCurveTo(-4, 21, -1, 16); ctx.quadraticCurveTo(2, 12, -1, 8); ctx.quadraticCurveTo(4, 6, 8, 5.5); ctx.quadraticCurveTo(10, 3, 7, 2.5); ctx.closePath();
    ctx.fillStyle = '#f26a2e'; ctx.fill(); ctx.strokeStyle = 'rgba(80,25,8,0.8)'; ctx.lineWidth = 0.45; ctx.stroke();
    ctx.fillStyle = '#ffb08a'; ctx.beginPath(); ctx.ellipse(-4.5, 8, 1.6, 2.4, 0.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(2, 5.6, 2, 1, 0, 0, 7); ctx.fill();
    for (const ex of [4.6, 7.2]) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex, 4.6, 1.15, 0, 7); ctx.fill(); ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.arc(ex + 0.2, 4.6, 0.65, 0, 7); ctx.fill(); }
    if (warn > 0 && Math.sin(t * 20) > -0.3) {
      ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#7a1200'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(6, 20); ctx.lineTo(-6, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.scale(1, -1); ctx.fillStyle = '#7a1200'; ctx.font = '900 8px Rubik, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', 0, -21.2); ctx.restore();
    }
    ctx.restore();
  }
  // Profil de la gueule : bord de la lèvre du haut, ouverte (y0) puis refermée au MILIEU seulement (y1) ;
  // sur les côtés la lèvre ne descend qu'à 34, au-dessus des têtes.
  const MX = 118, MY = 24;
  const y0 = (x) => MY + (LIP.y + 4 - MY) * Math.sqrt(Math.max(0, 1 - (x / MX) * (x / MX)));
  const y1 = (x) => { const a = Math.abs(x); return a < 50 ? 0 : a < 78 ? Math.min(y0(x), 34 * U.smooth((a - 50) / 28)) : Math.min(y0(x), 34); };
  const yEdge = (x, j) => y0(x) + (y1(x) - y0(x)) * j;
  function mouthPath(ctx, f) { ctx.moveTo(-MX, MY); for (let x = -MX + 4; x <= MX; x += 4) ctx.lineTo(x, f(x)); }
  function upperJaw(ctx, j) { // la partie de la lèvre du haut qui descend
    ctx.beginPath(); mouthPath(ctx, (x) => yEdge(x, j));
    for (let x = MX; x >= -MX; x -= 4) ctx.lineTo(x, y0(x) + 0.5);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 0, 0, LIP.y + 4, [[0, BLUE_D], [0.15, BLUE], [1, BLUE_L]]); ctx.fill();
    ctx.beginPath(); mouthPath(ctx, (x) => yEdge(x, j)); ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); mouthPath(ctx, (x) => yEdge(x, j) + 2.2); ctx.strokeStyle = 'rgba(170,215,250,0.7)'; ctx.lineWidth = 1.4; ctx.stroke();
  }

  S.oyacata = {
    id: 'oyacata', name: "Langue d'Oyacata", sub: 'Grand lac de Paldea', music: 11,
    phys: {
      main: { l: -92, r: 92, y: 0, bottom: -30 },
      plats: [{ l: -136, r: -112, y: 22 }, { l: 112, r: 136, y: 22 }], // coins de la bouche
      blast: { l: -290, r: 290, t: 210, b: -150 }, cam: { l: -235, r: 235, t: 165, b: -98 },
      respawn: [0, 70], spawns: [[-70, 0, -1], [70, 0, -1], [-30, 0, -1], [30, 0, -1]], spawns2: [[-50, 0, -1], [50, 0, -1]],
    },
    tick(S2) {
      const P = S2.stage, c = (S2.frame + OFF) % CYC;
      P.c = c;
      if (c === CH.warn) S2.events.push({ t: 'stage', name: 'warn', k: 'oyw' + S2.frame });
      if (c === CH.slam + 4) S2.events.push({ t: 'stage', name: 'chomp', k: 'oyc' + S2.frame });
      // GLOUPS : ceux qui sont au milieu de la gueule sont avalés
      if (c === CH.gulp && S2.phase === 'play') {
        let n = 0;
        for (const f of S2.fighters) {
          if (f.dead || f.out || f.invinc > 0 || f.intang > 0 || f.v.hidden > 0) continue;
          const hu = G.hurtbox(S2, f);
          if (hu.x < ZONE.l || hu.x > ZONE.r || hu.y0 - hu.r > ZONE.t || hu.y1 + hu.r < -2) continue;
          if (f.grabbing >= 0) { const v = S2.fighters[f.grabbing]; if (v) { v.grabbedBy = -1; G.setAction(v, 'air'); } f.grabbing = -1; }
          if (f.grabbedBy >= 0) { const g = S2.fighters[f.grabbedBy]; if (g) { g.grabbing = -1; G.setAction(g, g.grounded ? 'idle' : 'air'); } f.grabbedBy = -1; }
          f.v.hidden = HOLD; f.v.gulpDir = f.x < 0 ? -1 : 1; n++;
          f.grounded = false; f.plat = null; G.setAction(f, 'air');
        }
        for (const p of S2.projs) if (p.x > ZONE.l && p.x < ZONE.r && p.y < ZONE.t && p.y > -5) p.dead = true;
        if (n) S2.events.push({ t: 'stage', name: 'gulp', k: 'oyg' + S2.frame });
      }
      // avalés : gardés au chaud, puis recrachés en boulet
      for (const f of S2.fighters) {
        if (f.v.ball > 0) f.v.ball--;
        if (!(f.v.hidden > 0)) continue;
        if (f.dead || f.out) { f.v.hidden = 0; continue; }
        f.v.hidden--;
        f.x = 0; f.y = 10; f.vx = f.vy = f.kbx = f.kby = 0; f.ledge = 0;
        f.hitlag = Math.max(f.hitlag, 2); f.intang = Math.max(f.intang, 2);
        if (f.v.hidden > 0) continue;
        f.y = 30; f.intang = 0; f.hitlag = 0;
        G.applyHit(S2, { att: null, tgt: f, hb: SPIT_HB, key: 'oys' + S2.frame, clock: 0, x: 0, y: 34, dir: f.v.gulpDir || 1, wx: 0, wy: 34 });
        f.v.ball = 40; f.v.ballHit = 0;
        S2.events.push({ t: 'stage', name: 'spit', k: 'oyp' + f.slot + '_' + S2.frame });
      }
      // le boulet recraché percute ceux qu'il croise
      for (const b of S2.fighters) {
        if (!(b.v.ball > 0) || b.dead || b.out || b.hitlag > 0) continue;
        const hb = G.hurtbox(S2, b);
        for (const f of S2.fighters) {
          if (f === b || f.dead || f.out || f.invinc > 0 || f.intang > 0 || f.v.hidden > 0 || (b.v.ballHit >> f.slot) & 1) continue;
          if (S2.teams && f.team === b.team) continue;
          const hu = G.hurtbox(S2, f);
          if (U.distSeg(hb.x, (hb.y0 + hb.y1) / 2, hu.x, hu.y0, hu.x, hu.y1) > hb.r + hu.r + 2) continue;
          b.v.ballHit |= 1 << f.slot;
          const dir = b.kbx + b.vx >= 0 ? 1 : -1;
          G.applyHit(S2, { att: null, tgt: f, hb: BALL_HB, key: 'oyb' + b.slot + '_' + S2.frame, clock: 0, x: (b.x + f.x) / 2, y: (hb.y0 + hu.y0) / 2 + 4, dir, wx: b.x, wy: hb.y0 });
        }
      }
    },
    bgStatic(ctx, w, h) {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, '#5aa8e8'], [0.5, '#bfe6ff'], [0.64, '#e8f8ff'], [0.645, '#4a9ac0'], [1, '#164e6a']]);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = rad(ctx, w * 0.8, h * 0.14, 0, h * 0.35, [[0, 'rgba(255,255,230,0.95)'], [0.12, 'rgba(255,250,215,0.45)'], [1, 'rgba(255,255,255,0)']]); ctx.fillRect(0, 0, w, h);
    },
    bgLayers: [
      { par: 0.06, draw(ctx, w, h) { // collines boisées autour du lac
        const b = h * 0.645;
        ctx.fillStyle = '#6f9f6a'; ctx.beginPath(); ctx.moveTo(0, b); for (let x = 0; x <= w; x += 16) ctx.lineTo(x, b - h * (0.05 + 0.03 * Math.sin(x * 0.006 + 1) + 0.02 * Math.sin(x * 0.017))); ctx.lineTo(w, b); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 50; i++) { const x = (i * 61.7) % w, H = h * (0.035 + (i % 3) * 0.01); ctx.fillStyle = i % 2 ? '#3f7a44' : '#4b8a4c'; ctx.beginPath(); ctx.ellipse(x, b - H * 0.5, H * 0.45, H * 0.6, 0, 0, 7); ctx.fill(); }
      } },
    ],
    bgDynamic(ctx, w, h, t) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 4; i++) { const x = ((i * 410 + t * 8) % (w + 400)) - 200, y = h * (0.08 + i * 0.06); ctx.beginPath(); ctx.ellipse(x, y, 85, 15, 0, 0, 7); ctx.ellipse(x + 45, y - 9, 45, 14, 0, 0, 7); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) { const y = h * (0.68 + (i % 5) * 0.06), x = ((i * 211 + t * 12) % (w + 100)) - 50; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 26, y); ctx.stroke(); }
    },
    drawStage(ctx, P, t) {
      const c = P.c != null ? P.c : 300, j = jawOf(c), warn = c >= CH.warn && c < CH.slam ? 1 : 0;
      const WLk = -44;
      ctx.fillStyle = lin(ctx, 0, WLk, 0, WLk - 200, [[0, '#3d8fae'], [1, '#0e3348']]); ctx.fillRect(-700, WLk, 1400, -260); // lac
      // la tête, vue de face : grand dôme bleu
      ctx.beginPath(); ctx.moveTo(-196, -56); ctx.quadraticCurveTo(-214, 70, -168, 128); ctx.quadraticCurveTo(-100, 162, 0, 164); ctx.quadraticCurveTo(100, 162, 168, 128); ctx.quadraticCurveTo(214, 70, 196, -56); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 164, 0, -56, [[0, BLUE_L], [0.45, BLUE], [1, BLUE_D]]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
      // nageoires blanches sur le dessus, écailles hexagonales, yeux furieux
      finTop(ctx, -64, 150, -1); finTop(ctx, 64, 150, 1);
      ctx.save(); ctx.beginPath(); ctx.moveTo(-196, -56); ctx.quadraticCurveTo(-214, 70, -168, 128); ctx.quadraticCurveTo(-100, 162, 0, 164); ctx.quadraticCurveTo(100, 162, 168, 128); ctx.quadraticCurveTo(214, 70, 196, -56); ctx.closePath(); ctx.clip();
      hexes(ctx, -220, 220, 150, 7.5, 2); hexes(ctx, -214, -150, 112, 7.5, 6); hexes(ctx, 150, 214, 112, 7.5, 6);
      ctx.restore();
      const angry = warn ? 1 : j > 0.5 ? 1 : 0;
      eye(ctx, -136, 112, -1, t, angry); eye(ctx, 136, 112, 1, t, angry);
      // gueule : intérieur sombre, gorge au fond
      ctx.beginPath(); mouthPath(ctx, y0); ctx.lineTo(MX, -6); ctx.lineTo(-MX, -6); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 100, 0, -6, [[0, '#1a3f75'], [1, '#2a5a9a']]); ctx.fill();
      ctx.beginPath(); mouthPath(ctx, y0); ctx.strokeStyle = BLUE_D; ctx.lineWidth = 4; ctx.stroke(); // lèvre du haut
      ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); mouthPath(ctx, (x) => y0(x) + 3); ctx.strokeStyle = 'rgba(170,215,250,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = rad(ctx, 0, 34, 2, 46, [[0, '#050c1c'], [0.55, 'rgba(8,20,45,0.85)'], [1, 'rgba(20,50,95,0)']]); ctx.beginPath(); ctx.ellipse(0, 34, 52, 34, 0, 0, 7); ctx.fill();
      // zone dangereuse pendant l'alerte
      if (warn) {
        ctx.fillStyle = `rgba(255,50,40,${0.12 + 0.1 * Math.abs(Math.sin(t * 8))})`;
        ctx.beginPath(); ctx.moveTo(ZONE.l, 0); ctx.lineTo(ZONE.r, 0); ctx.lineTo(ZONE.r, ZONE.t * 0.92); ctx.quadraticCurveTo(0, ZONE.t + 4, ZONE.l, ZONE.t * 0.92); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,90,70,0.8)'; ctx.lineWidth = 0.7; ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]);
      }
      // moustaches (barbillons) blanches
      whisker(ctx, -124, 20, -1, 78, 50, t, 0); whisker(ctx, -120, 14, -1, 56, 22, t, 1.5);
      whisker(ctx, 124, 20, 1, 78, 50, t, 0.7); whisker(ctx, 120, 14, 1, 56, 22, t, 2.2);
      // menton blanc + lèvre du bas bleue
      ctx.beginPath(); ctx.moveTo(-128, 0); ctx.quadraticCurveTo(-130, -40, -60, -52); ctx.quadraticCurveTo(0, -58, 60, -52); ctx.quadraticCurveTo(130, -40, 128, 0); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 0, 0, -56, [[0, '#d6dee8'], [1, WHITE]]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.9; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-130, 4); ctx.quadraticCurveTo(-128, -14, -96, -16); ctx.lineTo(96, -16); ctx.quadraticCurveTo(128, -14, 130, 4); ctx.lineTo(118, 2); ctx.lineTo(-118, 2); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 2, 0, -16, [[0, BLUE], [1, BLUE_D]]); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 0.8; ctx.stroke();
      // la langue (le terrain)
      const m = P.main;
      ctx.beginPath(); ctx.moveTo(m.l - 2, 0.6); ctx.quadraticCurveTo(0, 2.6, m.r + 2, 0.6); ctx.lineTo(m.r - 2, -7); ctx.quadraticCurveTo(0, -9, m.l + 2, -7); ctx.closePath();
      ctx.fillStyle = lin(ctx, 0, 1, 0, -8, [[0, '#f0a9bd'], [1, '#c4708a']]); ctx.fill(); ctx.strokeStyle = 'rgba(100,30,50,0.7)'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(150,60,85,0.5)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, 1.2); ctx.lineTo(0, -6); ctx.stroke(); // sillon
      ctx.fillStyle = 'rgba(255,220,230,0.45)'; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.ellipse(m.l + 14 + i * 23, -3, 2.2, 0.8, 0, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(m.l, 0.4); ctx.quadraticCurveTo(0, 2.4, m.r, 0.4); ctx.strokeStyle = '#ffe6ee'; ctx.lineWidth = 0.7; ctx.stroke();
      // Nigirigon, le commandant, au fond de la langue
      if (j < 0.6) tatsugiri(ctx, 0, 0.8, t, warn);
      // coins de la bouche (plateformes)
      for (const p of P.plats) { // coins de la bouche : gros bourrelets de lèvre
        ctx.fillStyle = lin(ctx, 0, p.y, 0, p.y - 8, [[0, BLUE_L], [1, BLUE_D]]);
        ctx.beginPath(); ctx.moveTo(p.l, p.y); ctx.lineTo(p.r, p.y); ctx.quadraticCurveTo(p.r + 3, p.y - 5, p.r - 4, p.y - 9); ctx.lineTo(p.l + 4, p.y - 9); ctx.quadraticCurveTo(p.l - 3, p.y - 5, p.l, p.y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = ink; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.l + 0.5, p.y); ctx.lineTo(p.r - 0.5, p.y); ctx.strokeStyle = '#d6edff'; ctx.lineWidth = 0.9; ctx.stroke();
      }
      // lac devant
      ctx.fillStyle = 'rgba(40,120,160,0.5)'; ctx.fillRect(-700, WLk, 1400, -260);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath();
      for (let x = -700; x <= 700; x += 5) { const y = WLk + Math.sin(x * 0.1 + t * 2) * 0.5; if (x === -700) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
    },
    drawFront(ctx, P, t, S2) {
      const c = P.c != null ? P.c : 300, j = jawOf(c);
      if (j > 0.002) upperJaw(ctx, j); // la mâchoire qui claque passe devant ceux qui se font avaler
      if (!S2) return;
      // boulet recraché : traînée d'eau
      for (const f of S2.fighters) {
        if (!(f.v.ball > 0) || f.dead) continue;
        const st = G.ST(f), k = f.v.ball / 40;
        ctx.fillStyle = `rgba(190,235,255,${0.6 * k})`;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(f.x - (f.kbx || 0) * i * 3, f.y + st.h * 0.5 - (f.kby || 0) * i * 3, 3 + i * 1.2, 0, 7); ctx.fill(); }
      }
    },
  };
})(window.G);
