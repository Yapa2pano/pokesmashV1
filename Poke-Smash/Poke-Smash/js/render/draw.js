'use strict';
// Boîte à outils de dessin vectoriel « cartoon HD » (contours épais, ombrage cel) + calcul des poses.
// Repère local d'un perso : origine aux pieds, x vers l'avant, y vers le HAUT (unités du monde).
(function (G) {
  const U = G.U;
  const D = G.D = {};
  const RAD = Math.PI / 180;
  D.OL = '#1b1226';
  D.LW = 0.55;

  D.dir = (a) => [Math.sin(a * RAD), -Math.cos(a * RAD)];
  D.ell = (ctx, x, y, rx, ry, rot, fill, noStroke) => {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), (rot || 0) * RAD, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (!noStroke) { ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW; ctx.stroke(); }
  };
  D.circ = (ctx, x, y, r, fill, noStroke) => D.ell(ctx, x, y, r, r, 0, fill, noStroke);
  D.poly = (ctx, pts, fill, noStroke, open) => {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    if (!open) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (!noStroke) { ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW; ctx.lineJoin = 'round'; ctx.stroke(); }
  };
  // Forme lissée à partir de points (courbes quadratiques passant par les milieux)
  D.blob = (ctx, pts, fill, noStroke) => {
    const n = pts.length / 2;
    ctx.beginPath();
    const mx = (i) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2, my = (i) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
    ctx.moveTo(mx(0), my(0));
    for (let i = 1; i <= n; i++) ctx.quadraticCurveTo(pts[(i % n) * 2], pts[(i % n) * 2 + 1], mx(i), my(i));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (!noStroke) { ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW; ctx.lineJoin = 'round'; ctx.stroke(); }
  };
  // Segment épais avec contour (membres)
  D.seg = (ctx, x0, y0, x1, y1, w, col, w1) => {
    ctx.lineCap = 'round';
    if (w1 != null && w1 !== w) { // effilé : quadrilatère + disques
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const pts = [x0 + nx * w / 2, y0 + ny * w / 2, x1 + nx * w1 / 2, y1 + ny * w1 / 2, x1 - nx * w1 / 2, y1 - ny * w1 / 2, x0 - nx * w / 2, y0 - ny * w / 2];
      ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW * 2; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x0, y0, w / 2, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x1, y1, w1 / 2, 0, 7); ctx.fill(); ctx.stroke();
      D.poly(ctx, pts, col, true);
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[2], pts[3]); ctx.moveTo(pts[4], pts[5]); ctx.lineTo(pts[6], pts[7]);
      ctx.lineWidth = D.LW; ctx.stroke();
      return;
    }
    ctx.strokeStyle = D.OL; ctx.lineWidth = w + D.LW * 2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };
  // Membre à 2 segments : angle a (0 = bas, 90 = avant), coude b (relatif), longueurs l1 l2
  D.limb = (ctx, x, y, a, b, l1, l2, w1, w2, col, w3) => {
    const [dx1, dy1] = D.dir(a);
    const jx = x + dx1 * l1, jy = y + dy1 * l1;
    const [dx2, dy2] = D.dir(a + b);
    const ex = jx + dx2 * l2, ey = jy + dy2 * l2;
    D.seg(ctx, x, y, jx, jy, w1, col, w2);
    D.seg(ctx, jx, jy, ex, ey, w2, col, w3 == null ? w2 : w3);
    return { jx, jy, ex, ey, a2: a + b };
  };
  // Dégradé cel-shading radial (lumière en haut à l'avant)
  D.shade = (ctx, x, y, r, col) => {
    const g = ctx.createRadialGradient(x + r * 0.35, y + r * 0.45, r * 0.1, x, y, r * 1.25);
    g.addColorStop(0, U.shade(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, U.shade(col, -0.35));
    return g;
  };
  D.lin = (ctx, x0, y0, x1, y1, c0, c1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; };
  // Reflet brillant
  D.shine = (ctx, x, y, rx, ry, a) => { ctx.fillStyle = `rgba(255,255,255,${a == null ? 0.45 : a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.5, 0, 7); ctx.fill(); };
  // Œil générique (expressions : 0 normal, 1 énervé, 2 douleur, 3 fermé)
  D.eye = (ctx, x, y, r, expr, iris, sclera) => {
    if (expr === 3) { ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW * 1.3; ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 0.8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); return; }
    if (expr === 2) { ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW * 1.3; ctx.beginPath(); ctx.moveTo(x - r * 0.7, y + r * 0.5); ctx.lineTo(x + r * 0.5, y); ctx.lineTo(x - r * 0.7, y - r * 0.5); ctx.stroke(); return; }
    D.ell(ctx, x, y, r * 0.75, r, 0, sclera || '#ffffff');
    D.ell(ctx, x + r * 0.2, y, r * 0.45, r * 0.62, 0, iris || '#222', true);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.3, r * 0.2, 0, 7); ctx.fill();
    if (expr === 1) { ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW * 1.6; ctx.beginPath(); ctx.moveTo(x - r * 0.9, y + r * 1.25); ctx.lineTo(x + r * 0.9, y + r * 0.8); ctx.stroke(); }
  };

  // ---------- Poses ----------
  const DEF = { lean: 0, bob: 0, sq: 1, rot: 0, aF: 12, aB: -10, eF: 15, eB: 15, lF: 5, lB: -5, kF: 6, kB: 6, hd: 0, tl: 0, wg: 0, wp: 0, crouch: 0, eye: 0, glow: 0, tuck: 0, alpha: 1, dark: 0, run: 0, walk: 0 };
  D.DEF_POSE = DEF;
  const S3 = (t) => Math.sin(t);

  function base(S, f, st, t) {
    const P = Object.assign({}, DEF);
    const a = f.action, af = f.af, fr = S.frame;
    switch (a) {
      case 'idle': case 'respawn': {
        const b = S3(fr * 0.07 + f.slot);
        P.bob = b * 0.22; P.aF = 14 + b * 4; P.aB = -10 - b * 3; P.sq = 1 + b * 0.012;
        if (f.v.turnF && fr - f.v.turnF < 6) P.lean = -8;
        break;
      }
      case 'walk': {
        const ph = fr * 0.22 * Math.max(0.5, Math.abs(f.vx) / st.walk);
        P.walk = ph; P.lF = S3(ph) * 28; P.lB = -P.lF; P.kF = Math.max(0, -S3(ph)) * 30 + 4; P.kB = Math.max(0, S3(ph)) * 30 + 4;
        P.aF = -S3(ph) * 22 + 10; P.aB = S3(ph) * 22 - 10; P.bob = Math.abs(S3(ph)) * 0.5; P.lean = 4;
        break;
      }
      case 'dash': P.lean = 20; P.lF = 55; P.lB = -45; P.kB = 50; P.aF = -35; P.aB = 55; P.bob = 0.6; P.run = fr * 0.36; break;
      case 'run': {
        const ph = fr * 0.36;
        P.run = ph; P.lF = S3(ph) * 55; P.lB = -P.lF; P.kF = Math.max(0, -S3(ph)) * 70 + 10; P.kB = Math.max(0, S3(ph)) * 70 + 10;
        P.aF = -S3(ph) * 50; P.aB = S3(ph) * 50; P.eF = 60; P.eB = 60; P.lean = 18; P.bob = Math.abs(S3(ph)) * 1.1;
        break;
      }
      case 'brake': P.lean = -18; P.lF = 45; P.lB = -10; P.crouch = 0.3; P.aF = 60; P.aB = -40; break;
      case 'turn': P.lean = af < 7 ? -22 : 12; P.lF = 40; P.crouch = 0.25; P.aF = 70; break;
      case 'crouch': P.crouch = 1; P.aF = 35; P.aB = 10; break;
      case 'jsq': P.crouch = 0.6; P.aF = -10; P.aB = -20; break;
      case 'air': case 'tumble': case 'grel': {
        if (a === 'tumble') { P.rot = (fr * 7) % 360; P.eye = 2; P.aF = 150; P.aB = -120; P.lF = 40; P.lB = -40; break; }
        const rising = f.vy > 0.2;
        if (rising) { P.lF = 30; P.kF = 65; P.lB = -8; P.kB = 45; P.aF = 45; P.aB = -35; }
        else { P.lF = 12; P.lB = -18; P.kF = 20; P.kB = 25; P.aF = 110; P.aB = 95; P.eF = 30; P.eB = 30; }
        if (f.v.dj != null && fr - f.v.dj < 20) { P.rot = (fr - f.v.dj) / 20 * 360; P.tuck = 1 - (fr - f.v.dj) / 20; }
        if (f.ff) { P.lF = 0; P.lB = 0; P.aF = 150; P.aB = 150; P.sq = 1.06; }
        break;
      }
      case 'land': case 'lag': P.crouch = U.clamp(1 - af / Math.max(1, f.lag), 0, 1) * 0.75; P.aF = 40; P.aB = 20; break;
      case 'shield': case 'shieldOff': P.crouch = 0.25; P.aF = 70; P.aB = 50; P.eye = 1; break;
      case 'spot': P.crouch = 0.3; P.lean = -12; P.alpha = af > 3 && af < 17 ? 0.55 : 1; break;
      case 'roll': case 'groll': case 'troll': P.tuck = 1; P.rot = U.clamp(af / 28, 0, 1) * 360 * (f.mv.d === f.facing ? 1 : -1); P.alpha = 0.8; break;
      case 'adodge': P.alpha = af > 2 && af < (f.adDir ? 18 : 27) ? 0.5 : 1; P.aF = 60; P.aB = 60; P.lF = 20; P.lB = -20; P.tuck = 0.3; break;
      case 'help': P.aF = 170 + S3(fr * 0.5) * 12; P.aB = 160 - S3(fr * 0.5) * 12; P.lF = 12; P.lB = -22; P.dark = 0.35; P.eye = 2; break;
      case 'hit': case 'thrown': P.eye = 2; P.lean = -25; P.aF = 150; P.aB = -110; P.lF = 30; P.lB = -35; P.kF = 30;
        if (f.tumble && !f.grounded) P.rot = (fr * 16) % 360;
        break;
      case 'grabbed': P.eye = 2; P.aF = 155; P.aB = 150; P.lean = -12; P.lF = 20; P.lB = -10; break;
      case 'down': P.rot = -90; P.eye = 3; P.aF = 150; P.aB = 30; P.lF = 10; P.bob = 1.5; break;
      case 'getup': case 'tech': { const k = U.clamp(af / 14, 0, 1); P.rot = -90 * (1 - k); P.crouch = (1 - k) * 0.8; P.alpha = f.intang > 0 ? 0.75 : 1; break; }
      case 'sbreak': P.rot = (fr * 10) % 360; P.eye = 2; break;
      case 'dizzy': P.lean = S3(fr * 0.12) * 14; P.eye = 2; P.aF = 30 + S3(fr * 0.2) * 20; P.aB = -20; break;
      case 'hold': Object.assign(P, { aF: 85, aB: 72, eF: 40, eB: 40, lean: 5 }); break;
      case 'ledge': P.aF = 176; P.aB = 168; P.eF = 0; P.eB = 0; P.lF = 12 + S3(fr * 0.08) * 6; P.lB = -8; P.kF = 20; P.lean = -5; break;
      case 'lgetup': case 'lroll': case 'lattack': {
        const k = U.clamp(af / 18, 0, 1);
        P.aF = 176 - k * 150; P.aB = 168 - k * 150; P.crouch = (1 - k) * 0.6;
        if (a === 'lroll') { P.tuck = 1; P.rot = U.clamp((af - 16) / 28, 0, 1) * 360; }
        if (a === 'lattack' && af > 18) { P.aF = 100; P.lF = 90; P.lean = 12; }
        break;
      }
    }
    return P;
  }

  function applyKF(P, kfs, af) {
    if (!kfs || !kfs.length) return;
    let i = 0;
    while (i < kfs.length - 1 && kfs[i + 1][0] <= af) i++;
    const k0 = kfs[i], k1 = kfs[Math.min(i + 1, kfs.length - 1)];
    const span = k1[0] - k0[0];
    const t = span > 0 ? U.smooth(U.clamp((af - k0[0]) / span, 0, 1)) : 1;
    const keys = new Set([...Object.keys(k0[1]), ...Object.keys(k1[1])]);
    const b = Object.assign({}, P);
    for (const key of keys) {
      const v0 = k0[1][key] != null ? k0[1][key] : (b[key] != null ? b[key] : 0);
      const v1 = k1[1][key] != null ? k1[1][key] : (b[key] != null ? b[key] : 0);
      P[key] = i === kfs.length - 1 ? v0 : v0 + (v1 - v0) * t;
    }
  }
  D.applyKF = applyKF;

  G.pose = (S, f, t) => {
    const st = G.ST(f), ch = G.CHARS[f.char];
    let P;
    if (f.action === 'move') {
      P = Object.assign({}, DEF);
      const b = S3(S.frame * 0.07 + f.slot);
      P.bob = b * 0.1;
      const M = G.MV(f, f.move);
      if (M && M.anim) applyKF(P, typeof M.anim === 'function' ? M.anim(f, S) : M.anim, f.af);
      if (M && M.charge && f.af === M.charge && f.charge > 0) P.chargeK = f.charge / 60;
    } else P = base(S, f, st, t);
    if (ch.pose) ch.pose(P, f, S, t);
    return P;
  };
})(window.G);
