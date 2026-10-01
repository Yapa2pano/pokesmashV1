'use strict';
// Espace de noms global + utilitaires. Tout ce qui touche à la simulation doit rester
// déterministe (mêmes résultats sur tous les navigateurs) pour le netcode rollback :
// pas de Math.random, pas de Math.sin/cos/atan2/pow dans la sim — on utilise U.dsin etc.
window.G = window.G || {};
(function (G) {
  const U = G.U = {};
  const PI = 3.141592653589793;

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  U.approach = (v, t, s) => (v < t ? (v + s > t ? t : v + s) : (v - s < t ? t : v - s));
  U.smooth = (t) => t * t * (3 - 2 * t);

  // --- Trigo déterministe (degrés), uniquement + - * / ---
  function sinQ(deg) { // deg dans [-90, 90]
    const x = deg * (PI / 180), x2 = x * x;
    return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110)))));
  }
  U.dsin = (deg) => {
    deg = deg % 360;
    if (deg > 180) deg -= 360; else if (deg < -180) deg += 360;
    if (deg > 90) deg = 180 - deg; else if (deg < -90) deg = -180 - deg;
    return sinQ(deg);
  };
  U.dcos = (deg) => U.dsin(deg + 90);
  function atanQ(z) { // z dans [0,1] -> radians
    const z2 = z * z;
    return z * (0.99997726 + z2 * (-0.33262347 + z2 * (0.19354346 + z2 * (-0.11643287 + z2 * (0.05265332 + z2 * -0.0117212)))));
  }
  U.datan2 = (y, x) => { // degrés
    const ax = x < 0 ? -x : x, ay = y < 0 ? -y : y;
    if (ax === 0 && ay === 0) return 0;
    let a = ax >= ay ? atanQ(ay / ax) : PI / 2 - atanQ(ax / ay);
    if (x < 0) a = PI - a;
    if (y < 0) a = -a;
    return a * (180 / PI);
  };
  U.len = (x, y) => Math.sqrt(x * x + y * y);

  // PRNG déterministe stocké dans l'état (S.rng)
  U.rand = (S) => {
    let t = (S.rng = (S.rng + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  U.randInt = (S, n) => Math.floor(U.rand(S) * n);

  U.clone = typeof structuredClone === 'function' ? (o) => structuredClone(o) : (o) => JSON.parse(JSON.stringify(o));

  // Distance point -> segment (pour les hurtbox capsule)
  U.distSeg = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - px, qy = ay + dy * t - py;
    return Math.sqrt(qx * qx + qy * qy);
  };

  // Hash rapide d'une liste de nombres (détection de désynchro)
  U.hashNums = (arr) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < arr.length; i++) {
      const v = Math.round(arr[i] * 1000) | 0;
      h ^= v & 0xff; h = Math.imul(h, 16777619);
      h ^= (v >>> 8) & 0xff; h = Math.imul(h, 16777619);
      h ^= (v >>> 16) & 0xffff; h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // Couleurs
  U.hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  U.rgb = (c, a) => (a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
  U.shade = (h, k) => { // k<0 assombrit, k>0 éclaircit
    const c = U.hex(h);
    const f = k < 0 ? (v) => v * (1 + k) : (v) => v + (255 - v) * k;
    return U.rgb(c.map(f));
  };
  U.mix = (h1, h2, t) => { const a = U.hex(h1), b = U.hex(h2); return U.rgb([0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t)); };

  U.PI = PI;
})(window.G);
