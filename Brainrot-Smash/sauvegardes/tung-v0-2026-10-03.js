'use strict';
// TUNG TUNG TUNG SAHUR — bûche en bois à batte de baseball, regard vide et fixe.
// V0 : apparence seulement (coups génériques du moteur) ; le kit sera défini avec l'utilisateur.
(function (G) {
  const U = G.U, D = G.D;

  G.registerChar({
    id: 'tung', name: 'Tung Tung Tung Sahur', short: 'Tung Tung', color: '#c98b4a', trail: '#ffe2b0',
    desc: 'Bûche à batte. (Kit à venir : coups génériques pour l\'instant.)',
    stats: {
      weight: 104, h: 21, w: 6.5, walk: 1.15, dash: 2.0, run: 2.0, runAcc: 0.11, traction: 0.1,
      air: 1.05, airAcc: 0.07, grav: 0.104, fall: 1.8, ffall: 2.8, fullHop: 32, shortHop: 15, dJump: 30,
    },
    palettes: [
      { name: 'Normal', wood: '#c98b4a', grain: '#8a5426', cut: '#ecc68e', limb: '#3a2416', bat: '#d9a05a', pupil: '#0d0806' },
      { name: 'Bouleau', wood: '#e6dcc8', grain: '#4a3a30', cut: '#f6efe0', limb: '#2a2220', bat: '#c98b4a', pupil: '#0d0806' },
      { name: 'Ébène', wood: '#5a3a26', grain: '#2a160c', cut: '#9a6a44', limb: '#1a100a', bat: '#e8d0a0', pupil: '#ff3a2a' },
      { name: 'Cerisier', wood: '#b8573e', grain: '#6e2a1c', cut: '#e8a58a', limb: '#3a1a14', bat: '#f0d090', pupil: '#0d0806' },
    ],
    moves: {
      // « tung tung tung » : la batte tape le sol trois fois
      taunt: { len: 60, anim: [[0, {}], [6, { aF: 70, eF: 10, wp: -20 }], [11, { aF: 20, eF: 0, wp: 10, sq: 0.97 }], [17, { aF: 70, wp: -20 }], [22, { aF: 20, wp: 10, sq: 0.97 }], [28, { aF: 70, wp: -20 }], [33, { aF: 20, wp: 10, sq: 0.97 }], [48, { aF: 20, wp: 10 }], [60, {}]] },
    },
    // au repos, la batte est posée sur l'épaule
    pose(P, f) {
      if (f.action === 'idle' || f.action === 'walk' || f.action === 'respawn' || f.action === 'crouch' || f.action === 'land' || f.action === 'jsq') {
        P.aF = 28 + (P.aF - 14) * 0.2; P.eF = -128; P.wp = 52; P.batBack = 1;
      }
    },
    draw(ctx, P, c, f, S, t) {
      const cr = P.crouch || 0, tu = P.tuck || 0;
      const hip = [0, 6.2];
      const W = 2.9, Y0 = 5.6, Y1 = 20.6; // demi-largeur et hauteurs de la bûche
      ctx.save();
      ctx.scale(1 + cr * 0.06, 1 - cr * 0.28);
      const rot = () => { ctx.translate(hip[0], hip[1]); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-hip[0], -hip[1]); };
      const lF = U.lerp(P.lF, 70, tu), lB = U.lerp(P.lB, 50, tu), kF = U.lerp(P.kF, 110, tu), kB = U.lerp(P.kB, 110, tu);
      const limbB = U.shade(c.limb, -0.25);
      const hand = (x, y, col) => D.circ(ctx, x, y, 0.72, col);
      // batte : manche fin -> bout épais arrondi (angle a2 de l'avant-bras + décalage wp)
      const bat = (hx, hy, a2) => {
        const [dx, dy] = D.dir(a2 + 15 + (P.wp || 0)), nx = -dy, ny = dx;
        const L = 12, w0 = 0.38, w1 = 1.05, bx = hx - dx * 1.2, by = hy - dy * 1.2, tx = hx + dx * L, ty = hy + dy * L;
        D.circ(ctx, bx, by, 0.55, U.shade(c.bat, -0.18));
        ctx.beginPath();
        ctx.moveTo(bx + nx * w0, by + ny * w0);
        ctx.quadraticCurveTo(hx + dx * 4 + nx * w0, hy + dy * 4 + ny * w0, tx + nx * w1, ty + ny * w1);
        ctx.arc(tx, ty, w1, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
        ctx.quadraticCurveTo(hx + dx * 4 - nx * w0, hy + dy * 4 - ny * w0, bx - nx * w0, by - ny * w0);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, bx, by, tx, ty, U.shade(c.bat, -0.12), U.shade(c.bat, 0.08)); ctx.fill();
        ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.22; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx + dx * 4 + nx * 0.2, hy + dy * 4 + ny * 0.2); ctx.lineTo(tx - dx * 0.5 + nx * 0.5, ty - dy * 0.5 + ny * 0.5); ctx.stroke();
      };
      const foot = (L, col) => D.ell(ctx, L.ex + 0.7, L.ey + 0.3, 1.45, 0.62, 0, col);

      // bras arrière (derrière la bûche)
      ctx.save(); rot();
      const ba = D.limb(ctx, -0.4, 12.6, P.aB, -(P.eB || 0), 3.4, 3.2, 0.68, 0.6, limbB);
      hand(ba.ex, ba.ey, limbB);
      ctx.restore();
      // jambe arrière
      foot(D.limb(ctx, -0.9, hip[1], lB, kB, 3.3, 3.3, 0.72, 0.62, limbB), limbB);
      // jambe avant
      foot(D.limb(ctx, 0.9, hip[1], lF, kF, 3.3, 3.3, 0.76, 0.65, c.limb), c.limb);

      ctx.save(); rot();
      if (P.batBack) {
        const [d1x, d1y] = D.dir(P.aF), a2 = P.aF - (P.eF || 0), [d2x, d2y] = D.dir(a2);
        bat(0.4 + d1x * 3.4 + d2x * 3.2, 12.6 + d1y * 3.4 + d2y * 3.2, a2);
      }
      // --- la bûche ---
      const r = 0.9;
      ctx.beginPath();
      ctx.moveTo(-W + r, Y0); ctx.lineTo(W - r, Y0); ctx.quadraticCurveTo(W, Y0, W, Y0 + r);
      ctx.lineTo(W, Y1); ctx.lineTo(-W, Y1); ctx.lineTo(-W, Y0 + r); ctx.quadraticCurveTo(-W, Y0, -W + r, Y0);
      ctx.closePath();
      ctx.fillStyle = D.lin(ctx, -W, 0, W, 0, U.shade(c.wood, -0.28), U.shade(c.wood, 0.1)); ctx.fill();
      ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW; ctx.stroke();
      // veines du bois
      ctx.save(); ctx.clip();
      ctx.strokeStyle = c.grain; ctx.globalAlpha = 0.55; ctx.lineWidth = 0.2; ctx.lineCap = 'round';
      const veins = [[-2.0, 6.4, 13.2, 0.35], [-1.0, 9.5, 19.6, -0.3], [-2.3, 14.0, 20.2, 0.25], [0.2, 6.2, 10.8, 0.3], [1.9, 6.8, 11.8, -0.25]];
      for (const [x, a, b, w] of veins) { ctx.beginPath(); ctx.moveTo(x, a); ctx.quadraticCurveTo(x + w, (a + b) / 2, x - w * 0.4, b); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(-1.5, 11.6, 0.42, 0.75, 0, 0, 7); ctx.stroke(); // nœud
      ctx.restore();
      // tranche du dessus (bois coupé)
      D.ell(ctx, 0, Y1, W, 0.72, 0, c.cut);
      ctx.strokeStyle = U.shade(c.cut, -0.3); ctx.lineWidth = 0.18;
      ctx.beginPath(); ctx.ellipse(0, Y1, W * 0.62, 0.42, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, Y1, W * 0.28, 0.18, 0, 0, 7); ctx.stroke();

      // --- visage : regard vide et fixe ---
      const ex = P.eye;
      const eyes = [[0.2, 17.1, 1.2, 1.5], [2.5, 17.1, 1.28, 1.58]]; // œil du fond, œil de devant (dépasse du bord)
      // nez (bosse sur le bord avant)
      D.ell(ctx, W + 0.15, 15.3, 0.55, 0.85, 0, U.shade(c.wood, 0.08));
      if (ex === 2 || ex === 3) for (const [x, y, rx] of eyes) D.eye(ctx, x, y, rx, ex);
      else {
        for (const [x, y, rx, ry] of eyes) {
          ctx.fillStyle = 'rgba(40,20,8,0.38)'; ctx.beginPath(); ctx.ellipse(x, y - 0.3, rx * 1.28, ry * 1.22, 0, 0, 7); ctx.fill(); // orbite creuse
          D.ell(ctx, x, y, rx, ry, 0, '#fbf7ee');
          D.circ(ctx, x + 0.12, y - 0.05, ex === 1 ? 0.16 : 0.2, c.pupil, true); // pupille minuscule, sans reflet
          // cernes : le regard fixe et vide du mème
          ctx.strokeStyle = 'rgba(50,22,8,0.75)'; ctx.lineWidth = 0.28;
          ctx.beginPath(); ctx.arc(x, y - 0.1, rx * 1.12, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
          if (ex === 1) { ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW * 1.4; ctx.beginPath(); ctx.moveTo(x - rx, y + ry + 0.15); ctx.lineTo(x + rx, y + ry - 0.45); ctx.stroke(); }
        }
      }
      // bouche : petit sourire plat
      ctx.strokeStyle = D.OL; ctx.lineWidth = 0.3; ctx.lineCap = 'round';
      ctx.beginPath();
      if (ex === 2) { ctx.moveTo(0.9, 13.6); ctx.quadraticCurveTo(1.8, 14.3, 2.7, 13.6); }
      else { ctx.moveTo(0.8, 13.75); ctx.quadraticCurveTo(1.9, 13.6, 2.7, 13.95); }
      ctx.stroke();

      // --- bras avant + batte ---
      const fa = D.limb(ctx, 0.4, 12.6, P.aF, -(P.eF || 0), 3.4, 3.2, 0.72, 0.64, c.limb);
      if (!P.batBack) bat(fa.ex, fa.ey, fa.a2);
      hand(fa.ex, fa.ey, c.limb);
      ctx.restore();
      ctx.restore();
    },
  });
})(window.G);
