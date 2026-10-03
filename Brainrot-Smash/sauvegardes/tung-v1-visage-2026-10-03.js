'use strict';
// TUNG TUNG TUNG SAHUR — bûche en bois à batte de baseball, regard vide et fixe.
// V0 : apparence seulement (coups génériques du moteur) ; le kit sera défini avec l'utilisateur.
(function (G) {
  const U = G.U, D = G.D;

  G.registerChar({
    id: 'tung', name: 'Tung Tung Tung Sahur', short: 'Tung Tung', color: '#c98b4a', trail: '#ffe2b0',
    desc: 'Bûche à batte. (Kit à venir : coups génériques pour l\'instant.)',
    stats: {
      weight: 104, h: 22, w: 6.5, walk: 1.15, dash: 2.0, run: 2.0, runAcc: 0.11, traction: 0.1,
      air: 1.05, airAcc: 0.07, grav: 0.104, fall: 1.8, ffall: 2.8, fullHop: 32, shortHop: 15, dJump: 30,
    },
    palettes: [
      { name: 'Normal', wood: '#c98546', grain: '#8a5426', limb: '#b8763a', bat: '#d9a05a', iris: '#3b2412' },
      { name: 'Bouleau', wood: '#e6d6bc', grain: '#4a3a30', limb: '#d4c2a4', bat: '#c98b4a', iris: '#2a3a4a' },
      { name: 'Ébène', wood: '#6a432a', grain: '#2a160c', limb: '#5a3822', bat: '#e8d0a0', iris: '#b81e14' },
      { name: 'Cerisier', wood: '#b8573e', grain: '#6e2a1c', limb: '#a44a34', bat: '#f0d090', iris: '#3b2412' },
    ],
    moves: {
      // « tung tung tung » : la batte tape le sol trois fois
      taunt: { len: 60, anim: [[0, {}], [6, { aF: 70, eF: 10, wp: -20 }], [11, { aF: 20, eF: 0, wp: 10, sq: 0.97 }], [17, { aF: 70, wp: -20 }], [22, { aF: 20, wp: 10, sq: 0.97 }], [28, { aF: 70, wp: -20 }], [33, { aF: 20, wp: 10, sq: 0.97 }], [48, { aF: 20, wp: 10 }], [60, {}]] },
    },
    // au repos, la batte pend au bout du bras, le bout posé au sol derrière lui (comme sur le mème)
    pose(P, f) {
      if (f.action === 'idle' || f.action === 'walk' || f.action === 'respawn' || f.action === 'crouch' || f.action === 'land' || f.action === 'jsq') {
        P.aF = 8 + (P.aF - 14) * 0.3; P.eF = 6; P.wp = -78;
      }
    },
    draw(ctx, P, c, f, S, t) {
      const cr = P.crouch || 0, tu = P.tuck || 0;
      const hip = [0, 6.2];
      const W = 3.1, Y0 = 5.6, Y1 = 21.6; // demi-largeur et hauteurs de la bûche
      ctx.save();
      ctx.scale(1 + cr * 0.06, 1 - cr * 0.28);
      const rot = () => { ctx.translate(hip[0], hip[1]); ctx.rotate(-P.lean * Math.PI / 180); ctx.translate(-hip[0], -hip[1]); };
      const lF = U.lerp(P.lF, 70, tu), lB = U.lerp(P.lB, 50, tu), kF = U.lerp(P.kF, 110, tu), kB = U.lerp(P.kB, 110, tu);
      const limbB = U.shade(c.limb, -0.22);
      const hand = (x, y, col) => D.circ(ctx, x, y, 0.78, col);
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
      const foot = (L, col) => { // pied nu en bois, orteils devant
        D.ell(ctx, L.ex + 0.8, L.ey + 0.36, 1.75, 0.62, 0, col);
        for (let i = 0; i < 3; i++) D.circ(ctx, L.ex + 2.05 - i * 0.18, L.ey + 0.18 + i * 0.12, 0.26 - i * 0.03, U.shade(col, 0.06));
      };

      // bras arrière (derrière la bûche)
      ctx.save(); rot();
      const ba = D.limb(ctx, -0.6, 11.2, P.aB, -(P.eB || 0), 3.3, 3.1, 1.0, 0.9, limbB);
      hand(ba.ex, ba.ey, limbB);
      ctx.restore();
      // jambe arrière
      foot(D.limb(ctx, -0.9, hip[1], lB, kB, 3.3, 3.3, 1.05, 0.92, limbB), limbB);
      // jambe avant
      foot(D.limb(ctx, 0.9, hip[1], lF, kF, 3.3, 3.3, 1.1, 0.95, c.limb), c.limb);

      ctx.save(); rot();
      if (P.batBack) {
        const [d1x, d1y] = D.dir(P.aF), a2 = P.aF - (P.eF || 0), [d2x, d2y] = D.dir(a2);
        bat(0.2 + d1x * 3.3 + d2x * 3.1, 11.2 + d1y * 3.3 + d2y * 3.1, a2);
      }
      // --- la bûche (dessus arrondi, bois verni) ---
      const r = 0.9, rt = 1.5;
      ctx.beginPath();
      ctx.moveTo(-W + r, Y0); ctx.lineTo(W - r, Y0); ctx.quadraticCurveTo(W, Y0, W, Y0 + r);
      ctx.lineTo(W, Y1 - rt); ctx.quadraticCurveTo(W, Y1, W - rt, Y1); ctx.lineTo(-W + rt, Y1); ctx.quadraticCurveTo(-W, Y1, -W, Y1 - rt);
      ctx.lineTo(-W, Y0 + r); ctx.quadraticCurveTo(-W, Y0, -W + r, Y0);
      ctx.closePath();
      ctx.fillStyle = D.lin(ctx, -W, 0, W, 0, U.shade(c.wood, -0.3), U.shade(c.wood, 0.1)); ctx.fill();
      ctx.strokeStyle = D.OL; ctx.lineWidth = D.LW; ctx.stroke();
      ctx.save(); ctx.clip();
      // veines du bois (bas du corps, le visage reste lisse)
      ctx.strokeStyle = c.grain; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.18; ctx.lineCap = 'round';
      const veins = [[-2.1, 6.2, 12.4, 0.35], [-1.0, 6.6, 11.0, -0.3], [-2.4, 12.0, 18.8, 0.25], [0.6, 6.2, 10.0, 0.3], [2.1, 6.8, 10.6, -0.25]];
      for (const [x, a, b, w] of veins) { ctx.beginPath(); ctx.moveTo(x, a); ctx.quadraticCurveTo(x + w, (a + b) / 2, x - w * 0.4, b); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // reflet vernis
      ctx.fillStyle = 'rgba(255,235,200,0.16)'; ctx.fillRect(0.9, Y0 + 0.6, 0.9, Y1 - Y0 - 1.6);
      ctx.restore();

      // --- visage (3/4 face), agrandi ---
      ctx.save(); ctx.translate(0.4, 16.4); ctx.scale(1.28, 1.28); ctx.translate(-0.4, -16.2);
      const ex = P.eye, mad = ex === 1;
      const SK = 'rgba(70,32,10,'; // ombres sculptées
      // orbites creuses
      for (const [x, y] of [[-0.2, 17.6], [2.0, 17.6]]) {
        const g = ctx.createRadialGradient(x, y, 0.6, x, y, 1.75); g.addColorStop(0, SK + '0.32)'); g.addColorStop(1, SK + '0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 1.75, 1.6, 0, 0, 7); ctx.fill();
      }
      // sourcils sculptés (haussés ; froncés si énervé)
      ctx.strokeStyle = SK + '0.85)'; ctx.lineWidth = 0.32; ctx.lineCap = 'round';
      ctx.beginPath();
      if (mad) { ctx.moveTo(-1.3, 19.4); ctx.quadraticCurveTo(-0.3, 19.3, 0.7, 18.7); ctx.moveTo(1.2, 18.7); ctx.quadraticCurveTo(2.2, 19.3, 3.0, 19.5); }
      else { ctx.moveTo(-1.3, 19.1); ctx.quadraticCurveTo(-0.3, 19.9, 0.75, 19.3); ctx.moveTo(1.15, 19.3); ctx.quadraticCurveTo(2.1, 20.0, 3.0, 19.3); }
      ctx.stroke();
      // yeux : grands, grands ouverts, iris sombre, regard fixe
      const eyes = [[-0.25, 17.55, 1.12, 1.08], [2.05, 17.55, 1.2, 1.12]];
      for (const [x, y, rx, ry] of eyes) {
        if (ex === 2 || ex === 3) { D.eye(ctx, x, y, rx, ex); continue; }
        ctx.save();
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fillStyle = '#f3ede2'; ctx.fill();
        ctx.clip();
        const ix = x + 0.14, iy = y - 0.08, ir = mad ? 0.55 : 0.66;
        D.circ(ctx, ix, iy, ir, c.iris, true);
        D.circ(ctx, ix, iy, ir * 0.55, '#0a0604', true);
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(ix + 0.22, iy + 0.22, 0.13, 0, 7); ctx.fill();
        ctx.fillStyle = SK + '0.35)'; ctx.fillRect(x - rx, y + ry * 0.55, rx * 2, ry); // ombre de la paupière
        ctx.restore();
        // contour + paupière supérieure épaisse + pli au-dessus + cerne
        ctx.strokeStyle = 'rgba(30,14,6,0.9)'; ctx.lineWidth = 0.2; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.stroke();
        ctx.lineWidth = 0.26; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
        ctx.strokeStyle = SK + '0.7)'; ctx.lineWidth = 0.18;
        ctx.beginPath(); ctx.ellipse(x, y + 0.12, rx * 1.12, ry * 1.18, 0, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, y - 0.1, rx * 1.05, ry * 1.2, 0, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke();
      }
      // nez : long, qui dépasse du bord
      const nose = new Path2D();
      nose.moveTo(0.95, 17.3); nose.quadraticCurveTo(2.0, 16.5, 2.75, 15.5);
      nose.bezierCurveTo(3.25, 15.4, 3.55, 14.9, 3.3, 14.45); nose.bezierCurveTo(3.0, 14.0, 2.3, 14.1, 1.85, 14.45);
      nose.quadraticCurveTo(1.55, 15.6, 0.95, 17.3); nose.closePath();
      ctx.fillStyle = D.lin(ctx, 1, 17, 3.4, 14.6, U.shade(c.wood, -0.04), U.shade(c.wood, 0.16)); ctx.fill(nose);
      ctx.strokeStyle = 'rgba(40,18,6,0.85)'; ctx.lineWidth = 0.22; ctx.stroke(nose);
      ctx.fillStyle = 'rgba(255,240,215,0.35)'; ctx.beginPath(); ctx.ellipse(2.95, 15.0, 0.22, 0.16, 0, 0, 7); ctx.fill(); // reflet du bout
      ctx.fillStyle = SK + '0.8)'; ctx.beginPath(); ctx.ellipse(2.55, 14.45, 0.28, 0.13, -0.2, 0, 7); ctx.fill(); // narine
      // plis du sourire (joues)
      ctx.strokeStyle = SK + '0.6)'; ctx.lineWidth = 0.2;
      ctx.beginPath(); ctx.moveTo(1.7, 14.6); ctx.quadraticCurveTo(0.9, 14.0, 0.95, 12.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.9, 15.0); ctx.quadraticCurveTo(-1.5, 14.1, -1.3, 13.2); ctx.stroke();
      // joues vernies
      ctx.fillStyle = 'rgba(255,230,190,0.22)';
      ctx.beginPath(); ctx.ellipse(-0.6, 15.3, 0.75, 0.5, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(2.4, 15.9, 0.55, 0.4, 0, 0, 7); ctx.fill();
      // bouche : large sourire fermé, coins relevés (grimace en douleur)
      ctx.lineCap = 'round';
      if (ex === 2) {
        ctx.strokeStyle = D.OL; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(-1.0, 12.9); ctx.quadraticCurveTo(1.0, 13.7, 2.9, 12.9); ctx.stroke();
      } else {
        ctx.fillStyle = U.shade(c.wood, -0.12); // lèvre inférieure
        ctx.beginPath(); ctx.moveTo(-1.25, 13.85); ctx.quadraticCurveTo(0.9, 11.75, 3.0, 13.85); ctx.quadraticCurveTo(0.9, 12.55, -1.25, 13.85); ctx.fill();
        ctx.strokeStyle = D.OL; ctx.lineWidth = 0.32;
        ctx.beginPath(); ctx.moveTo(-1.25, 13.9); ctx.quadraticCurveTo(0.9, 12.55, 3.0, 13.9); ctx.stroke();
        ctx.lineWidth = 0.2; ctx.beginPath(); ctx.moveTo(-1.45, 14.15); ctx.lineTo(-1.15, 13.8); ctx.moveTo(3.2, 14.15); ctx.lineTo(2.9, 13.8); ctx.stroke(); // coins
        ctx.strokeStyle = SK + '0.7)'; ctx.lineWidth = 0.16;
        ctx.beginPath(); ctx.moveTo(-0.2, 11.85); ctx.quadraticCurveTo(0.9, 11.5, 2.0, 11.85); ctx.stroke(); // menton
      }
      ctx.restore();

      // --- bras avant + batte ---
      const fa = D.limb(ctx, 0.2, 11.2, P.aF, -(P.eF || 0), 3.3, 3.1, 1.05, 0.95, c.limb);
      if (!P.batBack) bat(fa.ex, fa.ey, fa.a2);
      hand(fa.ex, fa.ey, c.limb);
      ctx.restore();
      ctx.restore();
    },
  });
})(window.G);
