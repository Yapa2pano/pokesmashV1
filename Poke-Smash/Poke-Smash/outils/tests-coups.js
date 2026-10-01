// Tests scriptés des mécaniques signature (node outils/tests-coups.js)
const { load } = require('./test-sim');
const G = load();
const B = G.BTN;
let fails = 0;
const ok = (c, msg) => { console.log((c ? '  OK  ' : '  ÉCHEC ') + msg); if (!c) fails++; };

function mk(a, b, stage) {
  const S = G.Sim.create({ stage: stage || 'champ', players: [{ char: a }, { char: b || 'mouscoto' }], stocks: 3, time: 0, mode: 'stock', seed: 7, training: true });
  return S;
}
function run(S, inputs, n, inputs2) { for (let i = 0; i < n; i++) G.Sim.step(S, [inputs(i), inputs2 ? inputs2(i) : [0, 0, 0, 0, 0]]); }
const N = [0, 0, 0, 0, 0];

// 1) Archéduc : feuilles 0 lag
{
  const S = mk('archeduc'); const f = S.fighters[0];
  run(S, () => N, 30); S.fighters[1].x = 300; S.fighters[1].dead = true;
  run(S, (i) => (i === 0 ? [80, 0, 0, 0, B.SPC] : N), 6);
  ok(S.projs.filter((p) => p.kind === 'leaf').length === 3, 'Archéduc : les 3 feuilles partent');
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.JMP] : [0, 0, 0, 0, i < 5 ? B.JMP : 0]), 14);
  ok(f.action === 'air' || f.action === 'jsq' || !f.grounded, 'Archéduc : peut sauter juste après les feuilles (action=' + f.action + ')');
  ok(f.v.fanCd > 40, 'Archéduc : recharge des feuilles active (' + f.v.fanCd + ')');
}
// 2) Archéduc : deltaplane -> B neutre -> chute libre
{
  const S = mk('archeduc'); const f = S.fighters[0];
  run(S, () => N, 30);
  run(S, (i) => (i === 0 ? [0, 80, 0, 0, B.SPC] : [0, 0, 0, 0, 0]), 30);
  ok(f.move === 'uspec' && f.mv.glide, 'Archéduc : en vol plané');
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : [0, 0, 0, 0, i < 12 ? B.SPC : 0]), 3);
  ok(f.move === 'nspec' && f.v.helpAfter === 1, 'Archéduc : arc tiré depuis le deltaplane (move=' + f.move + ')');
  run(S, (i) => [0, 0, 0, 0, i < 10 ? B.SPC : 0], 40);
  ok(f.action === 'help' || f.grounded, 'Archéduc : chute libre après le coup (action=' + f.action + ')');
}
// 3) Archéduc : deltaplane -> aérien
{
  const S = mk('archeduc'); const f = S.fighters[0];
  run(S, () => N, 30);
  run(S, (i) => (i === 0 ? [0, 80, 0, 0, B.SPC] : N), 30);
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.ATK] : N), 2);
  ok(f.move === 'nair', 'Archéduc : aérien depuis le deltaplane (move=' + f.move + ')');
  run(S, () => N, 45);
  ok(f.action === 'help' || f.grounded, 'Archéduc : chute libre après l\'aérien (action=' + f.action + ')');
}
// 4) Charge des flèches
{
  const S = mk('archeduc'); const f = S.fighters[0];
  run(S, () => N, 30);
  run(S, () => [0, 0, 0, 0, B.SPC], 40);
  ok(f.mv.c === 24, 'Archéduc : flèche pleine en 24 frames (c=' + f.mv.c + ')');
}
// 5) Gromago : surf qui touche => figure
{
  const S = mk('gromago'); const f = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30);
  t.x = f.x + 20 * f.facing;
  run(S, (i) => (i === 0 ? [80 * f.facing, 0, 0, 0, B.SPC] : N), 30);
  ok(f.v.trick >= 1, 'Gromago : FIGURE déclenchée (trick=' + f.v.trick + ', move=' + f.move + ')');
  ok(S.projs.some((p) => p.kind === 'coin') || f.v.trick >= 1, 'Gromago : pièces de la figure');
}
// 7) Miascarade : pétales + Tour de Fleur
{
  const S = mk('miascarade'); const f = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30);
  for (let k = 0; k < 3; k++) { t.x = f.x + 11 * f.facing; t.y = f.y; run(S, (i) => (i === 0 ? [40 * f.facing, 0, 0, 0, B.ATK] : N), 26); }
  ok((t.v.petal || 0) >= 2, 'Miascarade : pétales posés (petal=' + t.v.petal + ')');
}
// 8) Cizayox / Insécateur : B chargé nerfé (charge max)
{
  const S = mk('insecateur'); const f = S.fighters[0];
  run(S, () => N, 30);
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N), 130);
  ok(f.v.storeI === G.INS_CHG.ins.max, 'Insécateur : charge stockée au max après ' + G.INS_CHG.ins.max + ' frames');
}
// 9) Noctali : Clair de Lune
{
  const S = mk('evoli'); const f = S.fighters[0];
  run(S, () => N, 30);
  f.v.form = 'noc'; f.percent = 50;
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.TAUNT] : N), 60);
  ok(f.percent === 44, 'Noctali : Clair de Lune soigne 6 % (' + f.percent + ')');
}
// 10) Obalie : Roulade qui touche => rebond + niveau ; bouclier => rebond en arrière
{
  const S = mk('obalie'); const f = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30); f.x = -50; f.facing = 1; t.x = 0;
  run(S, (i) => (i === 0 ? [60, 0, 0, 0, B.SPC] : N), 40);
  ok(f.v.rollLvl === 1 && f.action !== 'help' && f.action !== 'move', 'Obalie : la Roulade touche, il redevient libre et gagne un niveau (lvl=' + f.v.rollLvl + ', action=' + f.action + ')');
  run(S, (i) => (i === 0 ? [60, 0, 0, 0, B.SPC] : N), 8);
  ok(f.move === 'sspec' && f.mv.lvl === 1, 'Obalie : la Roulade suivante repart au niveau 1 (lvl=' + (f.mv && f.mv.lvl) + ')');
  const S2 = mk('obalie'); const g = S2.fighters[0], u = S2.fighters[1];
  run(S2, () => N, 30); g.x = -50; g.facing = 1; u.x = 0;
  for (let i = 0; i < 40; i++) G.Sim.step(S2, [i === 0 ? [60, 0, 0, 0, B.SPC] : N, [0, 0, 0, 0, B.SHD]]);
  ok(g.move === 'rollBonk' || (g.action !== 'move'), 'Obalie : Roulade bloquée par le bouclier (move=' + g.move + ')');
}
// 11) Obalie : Boule de Neige qui roule et grossit, une seule à la fois
{
  const S = mk('obalie'); const f = S.fighters[0];
  run(S, () => N, 30); S.fighters[1].x = 200; f.x = -70; f.facing = 1;
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N), 60);
  const sb = S.projs.find((p) => p.kind === 'snowball');
  ok(sb && sb.v.roll === 1 && sb.r > sb.v.r0, 'Obalie : la Boule de Neige roule et grossit (r ' + (sb ? sb.v.r0.toFixed(2) + ' -> ' + sb.r.toFixed(2) : '?') + ')');
  run(S, () => N, 20);
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N), 12);
  ok(S.projs.filter((p) => p.kind === 'snowball').length === 1, 'Obalie : une seule Boule de Neige à la fois');
}
// 12) Obalie : Mâchouille sur l'adversaire, puis croquer un projectile
{
  const S = mk('obalie'); const f = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30); t.x = f.x + 9 * f.facing; const p0 = t.percent;
  run(S, (i) => (i === 0 ? [0, -80, 0, 0, B.SPC] : N), 60);
  const p1 = t.percent; t.x = f.x + 9 * f.facing; t.y = f.y; t.grounded = true; t.plat = -1;
  run(S, (i) => (i === 0 ? [0, -80, 0, 0, B.SPC] : N), 40);
  ok(t.percent === p1 && t.action !== 'thrown', 'Obalie : pas de re-Mâchouille immédiate (recharge 2 s)');
  ok(t.percent - p0 >= 12, 'Obalie : Mâchouille (+' + (t.percent - p0).toFixed(1) + ' %)');
  const S2 = mk('obalie', 'archeduc'); const g = S2.fighters[0], a = S2.fighters[1];
  run(S2, () => N, 30); a.x = g.x + 60 * g.facing; g.percent = 30;
  G.spawnProj(S2, a, 'leaf', { x: g.x + 26 * g.facing, y: g.y + 6, vx: -g.facing * 1.5, vy: 0, r: 2, life: 40, dmg: 3, ang: 40, bkb: 38, kbg: 30, t: 'grass' });
  run(S2, (i) => (i === 0 ? [0, -80, 0, 0, B.SPC] : N), 16);
  ok(g.percent < 30, 'Obalie : croque le projectile et se soigne (' + g.percent.toFixed(1) + ' %)');
}
// 14) Obalie : élan de la Roulade (sol / air) et annulations
{
  const S = mk('obalie'); const f = S.fighters[0];
  run(S, () => N, 30); S.fighters[1].x = 200; f.x = -40; f.facing = 1; f.vx = 0;
  run(S, (i) => (i === 0 ? [60, 0, 0, 0, B.SPC] : N), 2);
  ok(f.vx > 1.5, 'Obalie : élan dès le départ au sol (vx=' + f.vx.toFixed(2) + ')');
  run(S, () => N, 12);
  const vx0 = f.vx;
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.JMP] : [0, 0, 0, 0, B.JMP]), 6);
  ok(f.action === 'air' && f.vx > 1.8, 'Obalie : saut qui annule la Roulade en gardant l\'élan (vx ' + vx0.toFixed(2) + ' -> ' + f.vx.toFixed(2) + ')');
  const S2 = mk('obalie'); const g = S2.fighters[0];
  run(S2, () => N, 30); S2.fighters[1].x = 200; g.x = -60; g.facing = 1;
  run(S2, (i) => (i < 6 ? [0, 0, 0, 0, B.JMP] : N), 14);
  const x0 = g.x;
  run(S2, (i) => (i === 0 ? [60, 0, 0, 0, B.SPC] : N), 20);
  ok(g.move === 'sspec' && g.x - x0 > 30, 'Obalie : Roulade aérienne qui avance (' + (g.x - x0).toFixed(1) + ' unités en 20 frames)');
  run(S2, (i) => (i === 0 ? [0, 0, 0, 0, B.ATK] : N), 2);
  ok(g.move === 'nair', 'Obalie : aérien qui annule la Roulade (move=' + g.move + ')');
  const S3 = mk('obalie'); const h = S3.fighters[0];
  run(S3, () => N, 30); S3.fighters[1].x = 200; h.x = -60; h.facing = 1;
  run(S3, (i) => (i < 6 ? [0, 0, 0, 0, B.JMP] : N), 14);
  run(S3, (i) => (i === 0 ? [60, 0, 0, 0, B.SPC] : i === 10 ? [0, 0, 0, 0, B.SHD] : N), 12);
  ok(h.action === 'adodge', 'Obalie : esquive qui annule la Roulade (action=' + h.action + ')');
  const S4 = mk('obalie'); const k = S4.fighters[0];
  run(S4, () => N, 30); S4.fighters[1].x = 200; k.x = -60; k.facing = 1;
  run(S4, (i) => (i === 0 ? [60, 0, 0, 0, B.SPC] : i === 14 ? [0, 0, 0, 0, B.ATK] : N), 16);
  ok(k.move === 'dashAtk', 'Obalie : A au sol pendant la Roulade = glissade (move=' + k.move + ')');
}
// 15) Obalie : smash bas = vagues qui s'arrêtent au bord, smash haut touche
{
  const S = mk('obalie'); const f = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30); t.x = f.x + 26 * f.facing; t.percent = 80;
  run(S, (i) => (i === 0 ? [0, -80, 0, 0, B.ATK] : N), 14);
  ok(S.projs.filter((p) => p.kind === 'owave').length === 2, 'Obalie : 2 vagues au smash bas');
  run(S, () => N, 30);
  ok(t.percent > 85 && S.projs.filter((p) => p.kind === 'owave').length === 0, 'Obalie : la vague touche au loin puis disparaît (' + t.percent.toFixed(1) + ' %)');
  const S2 = mk('obalie'); const g = S2.fighters[0], u = S2.fighters[1];
  run(S2, () => N, 30); u.x = g.x + 6 * g.facing;
  run(S2, (i) => (i === 0 ? [0, 80, 0, 0, B.ATK] : N), 60);
  ok(u.percent > 10, 'Obalie : Ballon Givré touche (' + u.percent.toFixed(1) + ' %)');
}
// 16) Demi-tour B par mémoire du stick (stick arrière -> neutre -> B en ≤ 10 frames) et saisie en l'air
{
  for (const gap of [6, 14]) {
    const S = mk('armarouge'); const f = S.fighters[0];
    run(S, () => N, 30); f.facing = 1; S.fighters[1].x = 200;
    run(S, () => [0, 0, 0, 0, B.JMP], 6);
    const seq = [[-70, 0, 0, 0, 0], [-70, 0, 0, 0, 0]]; for (let i = 0; i < gap; i++) seq.push(N); seq.push([0, 0, 0, 0, B.SPC]);
    seq.forEach((x) => G.Sim.step(S, [x, N]));
    ok(gap <= 9 ? f.facing === -1 : f.facing === 1, 'B neutre ' + (gap <= 9 ? 'retourné' : 'pas retourné') + ' après ' + gap + ' frames de neutre');
  }
  const S = mk('mouscoto', 'meloetta'); const a = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30); t.x = a.x + 12 * a.facing; t.y = a.y + 14; t.grounded = false; t.plat = null; t.action = 'air';
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.GRB] : N), 12);
  ok(t.action === 'grabbed', 'Saisie d\'un adversaire en l\'air à portée (' + t.action + ')');
}
// 17) Archéduc : flottement limité (plus de vol infini en arrière en l'air / arc), pluie de flèches non spammable
{
  const S = mk('archeduc'); const f = S.fighters[0];
  run(S, () => N, 30); S.fighters[1].x = 200; f.x = 0; f.facing = 1;
  let land = -1;
  for (let i = 0; i < 300 && land < 0; i++) { G.Sim.step(S, [i < 4 ? [0, 0, 0, 0, B.JMP] : (i % 2 ? [0, 0, -1, 0, 0] : N), N]); if (i > 10 && f.grounded) land = i; }
  ok(land > 0 && land < 140, 'Archéduc : arrière en l\'air en boucle, il finit par retomber (frame ' + land + ')');
  const S2 = mk('archeduc'); const g = S2.fighters[0];
  run(S2, () => N, 30); S2.fighters[1].x = 200;
  let land2 = -1;
  for (let i = 0; i < 300 && land2 < 0; i++) { G.Sim.step(S2, [i < 4 ? [0, 0, 0, 0, B.JMP] : (i < 8 ? N : [0, 0, 0, 0, B.SPC]), N]); if (i > 10 && g.grounded) land2 = i; }
  ok(land2 > 0 && land2 < 100, 'Archéduc : saut + arc chargé, il retombe (frame ' + land2 + ')');
  const S3 = mk('archeduc'); const a = S3.fighters[0], t = S3.fighters[1];
  run(S3, () => N, 30); t.x = a.x + 6;
  for (let i = 0; i < 600; i++) { const gr = a.grounded && (a.action === 'idle' || a.action === 'land'); G.Sim.step(S3, [gr ? [0, 0, 0, 0, B.JMP] : (i % 2 ? [0, -80, 0, 0, B.ATK] : N), N]); }
  ok(t.percent < 80, 'Archéduc : pluie de flèches en boucle pendant 10 s = ' + t.percent.toFixed(0) + ' % (avant : jusqu\'à 900 %)');
}
// 18) Obalie : haut B qui sort aussi depuis le sol et éjecte fort vers le haut
{
  const S = mk('obalie', 'malvalame'); const f = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30); f.x = 0; f.facing = 1; t.x = 6; t.percent = 100;
  let maxY = 0;
  for (let i = 0; i < 80; i++) { G.Sim.step(S, [i === 0 ? [0, 80, 0, 0, B.SPC] : N, N]); maxY = Math.max(maxY, t.y); }
  ok(maxY > 80, 'Obalie : haut B depuis le sol, la cible monte haut (' + maxY.toFixed(0) + ')');
}
// 19) Obalie : Boule de Neige visée au stick (haut / arrière) et Roulade qui reste vers l'adversaire
{
  const S = mk('obalie'); const f = S.fighters[0];
  run(S, () => N, 30); S.fighters[1].x = 200; f.facing = 1;
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : (i < 7 ? [0, 80, 0, 0, B.SPC] : N)), 12);
  const p = S.projs.find((q) => q.kind === 'snowball');
  ok(p && Math.abs(p.vx) < 0.1 && p.vy > 1.5, 'Obalie : Boule de Neige visée vers le haut');
  const S2 = mk('obalie'); const g = S2.fighters[0];
  run(S2, () => N, 30); S2.fighters[1].x = 200; g.facing = 1;
  run(S2, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : (i < 7 ? [-80, 0, 0, 0, B.SPC] : N)), 12);
  const q = S2.projs.find((o) => o.kind === 'snowball');
  ok(q && q.vx < -2 && g.facing === -1, 'Obalie : Boule de Neige visée derrière (il se retourne)');
  const S3 = mk('obalie'); const h = S3.fighters[0];
  run(S3, () => N, 30); h.x = -50; h.facing = 1; S3.fighters[1].x = 0;
  let after = null;
  for (let i = 0; i < 40; i++) { G.Sim.step(S3, [i === 0 ? [60, 0, 0, 0, B.SPC] : N, N]); if (after == null && h.mv && h.mv.hits) after = h.vx; }
  ok(after != null && after > 0, 'Obalie : après un coup de Roulade, il continue vers l\'adversaire (vx=' + after + ')');
}
// 20) Armarouge : l'Onde Psy qui renvoie un projectile ou encaisse un coup stocke le canon
{
  const S = mk('armarouge', 'archeduc'); const f = S.fighters[0], a = S.fighters[1];
  run(S, () => N, 30); a.x = f.x + 50 * f.facing; f.v.store = 0;
  run(S, (i) => (i === 0 ? [0, -80, 0, 0, B.SPC] : N), 6);
  G.spawnProj(S, a, 'arrow', { x: f.x + 12 * f.facing, y: f.y + 10, vx: -f.facing * 3, vy: 0, r: 1.8, life: 40, dmg: 5, ang: 38, bkb: 20, kbg: 40, t: 'ghost', v: { sx: f.x, sy: f.y } });
  run(S, () => N, 8);
  ok(f.v.store === 60, 'Armarouge : Onde Psy qui renvoie une flèche = canon stocké (' + f.v.store + ')');
  const S2 = mk('armarouge', 'mouscoto'); const g = S2.fighters[0], m = S2.fighters[1];
  run(S2, () => N, 30); m.x = g.x + 9 * g.facing; m.facing = -g.facing; g.v.store = 0;
  for (let i = 0; i < 14; i++) G.Sim.step(S2, [i === 0 ? [0, -80, 0, 0, B.SPC] : N, i === 3 ? [0, 0, 0, 0, B.ATK] : N]);
  ok(g.v.store === 60 && g.action === 'move', 'Armarouge : Onde Psy qui encaisse un jab = canon stocké, pas éjecté (' + g.v.store + ')');
  for (let i = 0; i < 90 && g.action === 'move'; i++) G.Sim.step(S2, [N, N]);
  run(S2, () => N, 3); m.x = 150;
  let shot = -1;
  for (let i = 0; i < 20 && shot < 0; i++) { G.Sim.step(S2, [i === 0 ? [0, 0, 0, 0, B.SPC] : N, N]); if (S2.projs.some((p) => p.kind === 'cannon')) shot = i; }
  ok(shot >= 0 && shot <= 12, 'Armarouge : le B suivant tire aussitôt (frame ' + shot + ')');
}
// 21) Obalie : après un coup de Roulade en l'air, il peut sauter / refaire une Roulade (pas de chute libre)
{
  const S = mk('obalie'); const f = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30); f.x = -50; f.facing = 1; t.x = 0; t.y = 20; t.grounded = false; t.plat = null; G.setAction(t, 'air');
  run(S, (i) => { t.y = 20; t.vy = 0; return i < 5 ? [0, 0, 0, 0, B.JMP] : N; }, 10);
  let hit = -1;
  for (let i = 0; i < 60 && hit < 0; i++) { t.y = f.y; t.vy = 0; G.Sim.step(S, [i === 0 ? [60, 0, 0, 0, B.SPC] : N, N]); if (f.mv && f.mv.hits) hit = i; }
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.JMP] : N), 3);
  ok(hit >= 0 && f.action === 'air' && f.vy > 1, 'Obalie : saut juste après un coup de Roulade aérienne (action=' + f.action + ')');
}
// 22) Tous les persos (et formes) atteignent la plateforme du haut du stage à 3 plateformes en 2 sauts
{
  const fails = [];
  for (const id of G.CHAR_ORDER) {
    const ch = G.CHARS[id];
    for (const form of [null].concat(ch._forms ? Object.keys(ch._forms).filter((k) => !/^n\d/.test(k)) : [])) {
      const S = mk(id); const f = S.fighters[0]; run(S, () => N, 30); f.x = 0; S.fighters[1].x = 200; f.v.form = form;
      let dj = false;
      for (let i = 0; i < 200; i++) { let inp = i < 5 ? [0, 0, 0, 0, B.JMP] : N; if (!dj && i > 6 && !f.grounded && f.vy <= 6 * G.ST(f).grav) { inp = [0, 0, 0, 0, B.JMP]; dj = true; } G.Sim.step(S, [inp, N]); }
      if (!(f.grounded && f.plat === 2)) fails.push(id + (form ? ':' + form : ''));
    }
  }
  ok(!fails.length, 'Plateforme du haut en 2 sauts pour tout le monde' + (fails.length ? ' (ratés : ' + fails.join(', ') + ')' : ''));
}
// 23) Plus d'enfermement par étourdissements en boucle (Mentali)
{
  const S = mk('evoli', 'malvalame'); const f = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30); f.v.form = 'men'; f.x = 0; t.x = 10; f.facing = 1;
  let r = 0, best = 0;
  const mv = [[40, 0, 0, 0, B.ATK], [0, 40, 0, 0, B.ATK], [0, 0, 0, 0, B.SPC], [60, 0, 0, 0, B.SPC], [0, -40, 0, 0, B.ATK]];
  for (let i = 0; i < 600; i++) {
    const dx = t.x - f.x; if (Math.sign(dx) !== f.facing && Math.abs(dx) > 2 && f.action === 'idle') f.facing = Math.sign(dx);
    let inp = N;
    if (f.action === 'idle' || f.action === 'walk' || (f.action === 'move' && f.mv.hit)) inp = Math.abs(dx) > 16 ? [Math.sign(dx) * 50, 0, 0, 0, 0] : (i % 2 ? mv[(i >> 1) % mv.length].map((v, k) => (k === 0 ? v * f.facing : v)) : N);
    G.Sim.step(S, [inp, N]);
    r = (t.action === 'hit' || t.hitstun > 0) ? r + 1 : 0; best = Math.max(best, r);
  }
  ok(best < 180, 'Mentali : plus long enfermement ' + (best / 60).toFixed(1) + ' s (avant : 10 s, sans fin)');
}
// 24) Obalie : Roulade -> A neutre en l'air s'enchaîne même à haut % et tue un poids moyen vers 130 %
{
  let first = null;
  for (let pct = 100; pct <= 200 && first == null; pct += 10) {
    const S = G.Sim.create({ stage: 'final', players: [{ char: 'obalie' }, { char: 'malvalame' }], stocks: 3, seed: 7, training: false }); S.phase = 'play';
    for (let i = 0; i < 30; i++) G.Sim.step(S, [N, N]);
    const f = S.fighters[0], t = S.fighters[1]; f.x = -40; f.facing = 1; t.x = 5; t.percent = pct;
    let hitF = -1;
    for (let i = 0; i < 300; i++) {
      let inp = N; if (i === 0) inp = [60, 0, 0, 0, B.SPC]; if (hitF < 0 && f.mv && f.mv.hits) hitF = i; if (hitF >= 0 && i === hitF + 2) inp = [0, 0, 0, 0, B.ATK];
      G.Sim.step(S, [inp, N]);
      for (const e of S.events) if (e.t === 'ko' && e.s === 1 && e.side !== 'b') first = pct;
      if (t.dead) break;
    }
  }
  ok(first != null && first <= 150, 'Obalie : Roulade -> A neutre en l\'air tue un poids moyen dès ' + first + ' %');
}
// 25) Malvalame : Feux Follets (3 en orbite, puis tir à tête chercheuse)
{
  const S = mk('malvalame'); const f = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30); t.x = 200;
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N), 40);
  ok(S.projs.filter((p) => p.kind === 'wisp' && p.v.orb).length === 3, 'Malvalame : 3 Feux Follets en orbite');
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N), 30);
  ok(S.projs.filter((p) => p.kind === 'wisp' && !p.v.orb).length === 3, 'Malvalame : B à nouveau = les 3 flammes sont tirées');
  t.x = f.x + 60; const p0 = t.percent; run(S, () => N, 80);
  ok(t.percent - p0 >= 8, 'Malvalame : les flammes cherchent la cible (+' + (t.percent - p0).toFixed(1) + ' %)');
}
// 26) Malvalame : Ombre Portée (intangible, distance réglée par B tenu, surgit en taille montante)
{
  const S = mk('malvalame'); const f = S.fighters[0];
  run(S, () => N, 30); f.x = -60; f.facing = 1; S.fighters[1].x = 200; const x0 = f.x;
  let intang = 0;
  for (let i = 0; i < 60; i++) { G.Sim.step(S, [[60, 0, 0, 0, i < 40 ? B.SPC : 0], N]); if (f.intang > 0) intang++; }
  ok(f.x - x0 > 60 && f.x - x0 < 95 && intang >= 25, 'Malvalame : Ombre Portée tenue = ' + (f.x - x0).toFixed(0) + ' unités, intangible ' + intang + ' frames');
  const S2 = mk('malvalame'); const g = S2.fighters[0], u = S2.fighters[1];
  run(S2, () => N, 30); g.x = -60; g.facing = 1; u.x = -20; const p0 = u.percent;
  run(S2, (i) => [60, 0, 0, 0, i < 8 ? B.SPC : 0], 50);
  ok(u.percent - p0 >= 10, 'Malvalame : il surgit sous l\'adversaire (+' + (u.percent - p0).toFixed(1) + ' %)');
}
// 27) Malvalame : Lien du Destin (dégâts partagés, explosion si Malvalame est éjecté)
{
  const S = mk('malvalame', 'obalie'); const f = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30); f.x = 0; f.facing = 1; t.x = 22; t.facing = -1;
  run(S, (i) => (i === 0 ? [0, -80, 0, 0, B.SPC] : N), 30);
  ok(t.v.bondBy === f.slot && t.v.bondT > 0, 'Malvalame : adversaire lié');
  t.x = f.x + 10; const a0 = t.percent, b0 = f.percent;
  run(S, () => N, 20, (i) => (i === 0 ? [-60, 0, 0, 0, B.ATK] : N));
  const df = f.percent - b0, dt = t.percent - a0;
  ok(df > 0 && Math.abs(dt - df * 0.5) < 0.01, 'Malvalame : l\'adversaire lié encaisse la moitié (' + df.toFixed(1) + ' -> ' + dt.toFixed(1) + ')');
  t.percent = 150; f.y = -300; f.grounded = false; f.action = 'air'; S.training = false;
  let dead = false; for (let i = 0; i < 300 && !dead; i++) { G.Sim.step(S, [N, N]); dead = t.dead; }
  ok(dead, 'Malvalame : éjecté pendant le lien, le lien explose et emporte l\'adversaire à 150 %');
}
// 28) Malvalame : Lame Amère au contact = un gros coup, pas un hachoir
{
  const S = mk('malvalame'); const f = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30); t.x = f.x + 4; f.percent = 30; const p0 = t.percent;
  run(S, (i) => (i === 0 ? [0, 80, 0, 0, B.SPC] : N), 60);
  ok(t.percent - p0 > 10 && t.percent - p0 < 26 && f.percent < 30, 'Malvalame : Lame Amère +' + (t.percent - p0).toFixed(1) + ' % et soigne (' + f.percent.toFixed(1) + ' %)');
}
// 29) Dos de Torterra : le grand feuillage se balance et emporte ceux qui sont dessus
{
  const S = G.Sim.create({ stage: 'torterra', players: [{ char: 'obalie' }, { char: 'gromago' }], stocks: 3, seed: 3, training: false }); S.phase = 'play';
  const f = S.fighters[0], c = S.stage.plats[2];
  f.x = (c.l + c.r) / 2; f.y = c.y + 3; f.vy = 0; f.grounded = false; G.setAction(f, 'air');
  for (let i = 0; i < 12; i++) G.Sim.step(S, [N, N]);
  const x0 = f.x, rel0 = f.x - c.l; let minX = f.x, maxX = f.x, stayed = true;
  for (let i = 0; i < 600; i++) { G.Sim.step(S, [N, N]); minX = Math.min(minX, f.x); maxX = Math.max(maxX, f.x); if (!(f.grounded && f.plat === 2)) stayed = false; }
  ok(stayed && maxX - minX > 12 && Math.abs((f.x - c.l) - rel0) < 0.01, 'Torterra : feuillage mobile, le perso reste dessus et bouge avec (' + (maxX - minX).toFixed(1) + ' unités de balancement)');
  void x0;
}
// 30) Aquali : pendant la charge du Pistolet à O, on peut se retourner et sauter sans perdre la charge
{
  const S = mk('evoli', 'gromago', 'final'); const f = S.fighters[0];
  run(S, () => N, 30); S.fighters[1].x = 200; f.v.form = 'aqu'; f.x = 0; f.facing = 1;
  const y0 = f.y; let maxY = 0, moveOk = true, shot = null;
  for (let i = 0; i < 80; i++) {
    let inp = [0, 0, 0, 0, B.SPC];
    if (i >= 3 && i < 8) inp = [-80, 0, 0, 0, B.SPC]; // stick arrière
    if (i === 10 || i === 11) inp = [0, 0, 0, 0, B.SPC | B.JMP]; // saut
    if (i === 30 || i === 31) inp = [0, 0, 0, 0, B.SPC | B.JMP]; // double saut
    if (i >= 50) inp = N;
    G.Sim.step(S, [inp, N]);
    maxY = Math.max(maxY, f.y - y0);
    if (i < 45 && !(f.action === 'move' && f.move === 'nspec')) moveOk = false;
    const p = S.projs.find((q) => q.kind === 'wgun'); if (p && !shot) shot = p;
  }
  ok(moveOk && f.jumps === 2 && maxY > 45, 'Aquali : saut + double saut en chargeant (hauteur ' + maxY.toFixed(0) + ', sauts ' + f.jumps + ')');
  ok(shot && shot.vx < 0, "Aquali : retournée pendant la charge, le jet part de l'autre côté (vx " + (shot ? shot.vx.toFixed(1) : '?') + ')');
}
// 31) Miascarade : la bombe-fleur ne tue plus trop tôt (pétales : effet sur l'éjection réduit de 55 %)
{
  const koAt = (petals) => {
    for (let pct = 40; pct <= 250; pct += 5) {
      const S = G.Sim.create({ stage: 'final', players: [{ char: 'miascarade' }, { char: 'archeduc' }], stocks: 3, seed: 7, training: false }); S.phase = 'play';
      for (let i = 0; i < 30; i++) G.Sim.step(S, [N, N]);
      const f = S.fighters[0], t = S.fighters[1]; f.x = -80; t.x = 0; t.percent = pct;
      if (petals) { t.v.petalBy = 0; t.v.petal = petals; t.v.petalT = 300; }
      G.Sim.step(S, [[0, -80, 0, 0, B.SPC], N]); for (let i = 0; i < 12; i++) G.Sim.step(S, [N, N]); // lance la bombe...
      const bomb = S.projs.find((p) => p.kind === 'fbomb'); bomb.v.stuck = t.slot; bomb.v.ox = 0; bomb.v.oy = 8; // ...collée sur la cible
      for (let i = 0; i < 40; i++) G.Sim.step(S, [N, N]);
      G.Sim.step(S, [[0, -80, 0, 0, B.SPC], N]); // BOUM
      for (let i = 0; i < 300; i++) { G.Sim.step(S, [N, N]); if (t.dead) return pct; }
    }
    return 999;
  };
  const k0 = koAt(0), k3 = koAt(3);
  ok(k0 >= 110 && k3 >= 85 && k0 - k3 <= 30, 'Miascarade : bombe-fleur KO vers ' + k0 + ' % sans pétale, ' + k3 + ' % avec 3 (avant : 85 et 40)');
}
// 32) Miascarade : Feuille Magique avec recharge de 1,5 s
{
  const S = mk('miascarade'); const f = S.fighters[0];
  run(S, () => N, 30); S.fighters[1].x = 200;
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N), 40);
  const n1 = S.projs.filter((p) => p.kind === 'mleaf').length;
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N), 30);
  const blocked = f.move !== 'nspec' && f.v.leafCd > 0;
  run(S, () => N, 30);
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N), 5);
  ok(n1 === 3 && blocked && f.move === 'nspec', 'Miascarade : 3 feuilles, puis B bloqué pendant la recharge, puis de nouveau possible');
}
// 33) Séracrawl : les Grelaçon traversent le lac et plongent sous Séracrawl ; plateformes seulement par moments
{
  const S = G.Sim.create({ stage: 'seracrawl', players: [{ char: 'obalie' }, { char: 'gromago' }], stocks: 3, seed: 3, training: false }); S.phase = 'play';
  const f = S.fighters[0], m = S.stage.main;
  let active = 0, underStage = false, landed = false, dropped = false, carried = 0, rideX = null;
  for (let i = 0; i < 873; i++) {
    const p = S.stage.plats[0], on = p.y > -1000;
    if (on) { active++; if (p.r > m.l - 1 && p.l < m.r + 1) underStage = true; }
    // dès que la plaque n° 0 est active, on pose Obalie dessus
    if (on && rideX == null) { f.x = (p.l + p.r) / 2; f.y = p.y + 6; f.vy = 0; f.grounded = false; f.plat = null; G.setAction(f, 'air'); f.jumps = 2; rideX = f.x; }
    G.Sim.step(S, [N, N]);
    if (!landed && f.grounded && f.plat === 0) { landed = f.jumps === 0; rideX = f.x; }
    if (landed && !dropped && f.grounded && f.plat === 0) carried = Math.abs(f.x - rideX);
    if (landed && !dropped && !(f.grounded && f.plat === 0)) dropped = S.stage.plats[0].y < -1000;
  }
  const frac = active / 873;
  ok(frac > 0.25 && frac < 0.55 && !underStage, 'Séracrawl : un Grelaçon sert de plateforme ' + Math.round(frac * 100) + ' % du temps, jamais sous le terrain');
  ok(landed && carried > 30 && dropped, 'Séracrawl : on atterrit sur le Grelaçon (sauts rendus), il emporte (' + carried.toFixed(0) + ' unités) puis plonge et on tombe');
}
// 34) Gromago : Coup de Planche (bas B) — glissade au sol qui tue à hauts %, plongeon en l'air qui spike
{
  const koSide = (pct) => {
    const S = G.Sim.create({ stage: 'final', players: [{ char: 'gromago' }, { char: 'archeduc' }], stocks: 3, seed: 7, training: false }); S.phase = 'play';
    for (let i = 0; i < 30; i++) G.Sim.step(S, [N, N]);
    const f = S.fighters[0], t = S.fighters[1]; f.x = -20; f.facing = 1; t.x = 0; t.percent = pct;
    G.Sim.step(S, [[0, -80, 0, 0, B.SPC], N]);
    for (let i = 0; i < 300; i++) { G.Sim.step(S, [N, N]); for (const e of S.events) if (e.t === 'ko' && e.s === 1 && e.side !== 'b') return true; if (t.dead) return false; }
    return false;
  };
  let first = null; for (let p = 60; p <= 220 && first == null; p += 10) if (koSide(p)) first = p;
  ok(first >= 110 && first <= 160, 'Gromago : Glissade d\'Or (bas B au sol) tue au centre vers ' + first + ' %');
  // plongeon : diagonale raide vers le bas, une fois par saut, spike
  const S = mk('gromago', 'archeduc', 'final'); const f = S.fighters[0], t = S.fighters[1];
  run(S, () => N, 30); const m = S.stage.main;
  f.x = m.r + 8; f.y = 25; f.grounded = false; f.plat = null; G.setAction(f, 'air'); f.vy = 0; f.facing = 1;
  t.x = m.r + 20; t.y = -10; t.grounded = false; t.plat = null; G.setAction(t, 'air'); t.vy = 0; t.percent = 30;
  const x0 = f.x, y0 = f.y;
  G.Sim.step(S, [[0, -80, 0, 0, B.SPC], N]);
  let kbyMin = 0; for (let i = 0; i < 40; i++) { G.Sim.step(S, [N, N]); kbyMin = Math.min(kbyMin, t.kby); }
  ok(f.move === 'dspecA' || f.v.diveUsed, 'Gromago : bas B en l\'air = Plongeon d\'Or');
  ok(kbyMin < -1.8 && t.y < -40, 'Gromago : le Plongeon spike vers le bas (vitesse ' + kbyMin.toFixed(1) + ', cible à y ' + t.y.toFixed(0) + ')');
  const S2 = mk('gromago', 'archeduc', 'final'); const g = S2.fighters[0]; run(S2, () => N, 30); S2.fighters[1].x = 200;
  g.x = -40; g.y = 160; g.grounded = false; g.plat = null; G.setAction(g, 'air'); g.vy = 0; g.facing = 1;
  G.Sim.step(S2, [[0, -80, 0, 0, B.SPC], N]); run(S2, () => N, 6); const gx = g.x, gy = g.y; run(S2, () => N, 14);
  const ang = Math.atan2(gy - g.y, g.x - gx) * 180 / Math.PI;
  run(S2, () => N, 30); const stillAir = !g.grounded;
  G.Sim.step(S2, [[0, -80, 0, 0, B.SPC], N]); G.Sim.step(S2, [N, N]);
  ok(ang > 60 && ang < 80 && stillAir && !(g.action === 'move' && g.move === 'dspecA'), 'Gromago : plongeon à ' + ang.toFixed(0) + '° sous l\'horizontale, une fois par saut');
}
// 35) Motisma : possession (bas B + direction), sortie de l'appareil (re-choisir sa forme) et appareil éjecté
{
  const S = mk('motisma'); const f = S.fighters[0]; run(S, () => N, 30); S.fighters[1].x = 200;
  const got = [];
  for (const [sx, sy, want] of [[0, 0, 'heat'], [0, 80, 'fan'], [0, -80, 'frost'], [80, 0, 'mow'], [-80, 0, 'wash']]) {
    f.v.possCd = 0; f.facing = 1;
    run(S, (i) => (i < 12 ? [sx, i === 0 ? -80 : sy, 0, 0, B.SPC] : N), 70);
    got.push(f.v.form === want);
  }
  f.v.possCd = 0;
  run(S, (i) => (i < 12 ? [-80, i === 0 ? -80 : 0, 0, 0, B.SPC] : N), 30);
  ok(got.every(Boolean) && f.v.form === null && S.projs.some((p) => p.kind === 'rshell'), 'Motisma : bas B + direction = bon appareil, même direction = il en sort et éjecte l\'appareil');
}
const motiKO = (form, setup, inputs, tg) => {
  for (let pct = 0; pct <= 300; pct += 5) {
    const S = G.Sim.create({ stage: 'final', players: [{ char: 'motisma' }, { char: tg || 'archeduc' }], stocks: 3, seed: 7, training: false }); S.phase = 'play';
    for (let i = 0; i < 30; i++) G.Sim.step(S, [N, N]);
    const f = S.fighters[0], t = S.fighters[1]; f.v.form = form; setup(S, f, t); t.percent = pct;
    for (let i = 0; i < 360; i++) { G.Sim.step(S, [inputs(i), N]); for (const e of S.events) if (e.t === 'ko' && e.s === 1 && e.side !== 'b') return pct; if (t.dead) break; }
  }
  return 999;
};
// 36) Chaleur : Surchauffe sans charge = tue à hauts % sans recul ; presque à fond = recul de 8 % mais éjection énorme
{
  const k0 = motiKO('heat', (S, f, t) => { f.x = -8; f.facing = 1; t.x = 4; }, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N));
  const k1 = motiKO('heat', (S, f, t) => { f.x = -8; f.facing = 1; t.x = 4; }, (i) => (i <= 55 ? [0, 0, 0, 0, B.SPC] : N));
  const self = (hold) => { const S = mk('motisma'); const f = S.fighters[0]; run(S, () => N, 30); f.v.form = 'heat'; S.fighters[1].x = 200; run(S, (i) => (i <= hold ? [0, 0, 0, 0, B.SPC] : N), 80); return f.percent; };
  ok(k0 >= 110 && k0 <= 150 && self(0) === 0 && k1 >= 40 && k1 <= 65 && self(55) >= 8, 'Motisma Chaleur : sans charge KO vers ' + k0 + ' % sans recul ; à fond KO vers ' + k1 + ' % avec ' + self(55) + ' % de recul');
}
// 37) Lavage : Essorage = saisie, tambour, Hydrocanon dans la direction du stick
{
  const S = mk('motisma'); const f = S.fighters[0], t = S.fighters[1]; run(S, () => N, 30); f.v.form = 'wash'; f.x = 0; f.facing = 1; t.x = 9; t.percent = 80;
  let inside = false, ang = null;
  for (let i = 0; i < 70; i++) {
    G.Sim.step(S, [i === 0 ? [0, 0, 0, 0, B.SPC] : i < 9 ? N : [-80, 0, 0, 0, 0], N]);
    if (t.grabbedBy === 0 && t.v.invis > 0 && t.v.invis < 0.01) inside = true;
    if (ang == null && t.action === 'hit' && (t.kbx || t.kby)) ang = Math.round(Math.atan2(t.kby, t.kbx) * 180 / Math.PI);
  }
  ok(inside && Math.abs(Math.abs(ang) - 180) < 25 && !(t.v.invis > 0), 'Motisma Lavage : l\'adversaire tourne dans le tambour puis part vers l\'arrière (' + ang + '°) et redevient visible');
}
// 38) Froid : Blizzard qui gèle ; Chute de Frigo = spike au contact (début), puis diagonale vers le haut qui tue
{
  const S = mk('motisma'); const f = S.fighters[0], t = S.fighters[1]; run(S, () => N, 30); f.v.form = 'frost'; f.x = 0; f.facing = 1; t.x = 13;
  let ice = 0; for (let i = 0; i < 60; i++) { G.Sim.step(S, [i === 0 ? [0, 0, 0, 0, B.SPC] : N, N]); ice = Math.max(ice, t.v.iceT || 0); }
  const kGround = motiKO('frost', (S2, g, u) => { g.x = 0; g.y = 50; g.grounded = false; g.plat = null; G.setAction(g, 'air'); u.x = -5; }, (i) => (i === 0 ? [0, -80, 0, 0, B.ATK] : N));
  const angOf = (u) => Math.round(Math.atan2(u.kby, u.kbx) * 180 / Math.PI);
  // au contact, hors du terrain : spike
  const S3 = mk('motisma', 'archeduc', 'final'); const g = S3.fighters[0], u = S3.fighters[1]; run(S3, () => N, 30); const m = S3.stage.main;
  g.v.form = 'frost'; g.x = m.r + 15; g.y = 25; g.grounded = false; g.plat = null; G.setAction(g, 'air');
  u.x = m.r + 16; u.y = 13; u.grounded = false; u.plat = null; G.setAction(u, 'air'); u.percent = 0;
  let spikeAng = null, freeY = null; G.Sim.step(S3, [[0, -80, 0, 0, B.ATK], N]);
  for (let i = 0; i < 200 && freeY == null; i++) { G.Sim.step(S3, [N, N]); if (spikeAng == null && u.action === 'hit' && (u.kbx || u.kby)) spikeAng = angOf(u); if (spikeAng != null && u.action !== 'hit') freeY = u.y; if (u.dead) freeY = -999; }
  // de haut sur un adversaire au sol : diagonale vers le haut
  const S4 = mk('motisma', 'archeduc', 'final'); const h = S4.fighters[0], v = S4.fighters[1]; run(S4, () => N, 30);
  h.v.form = 'frost'; h.x = 0; h.y = 50; h.grounded = false; h.plat = null; G.setAction(h, 'air'); v.x = 5; v.percent = 60;
  let diagAng = null; G.Sim.step(S4, [[0, -80, 0, 0, B.ATK], N]);
  for (let i = 0; i < 60 && diagAng == null; i++) { G.Sim.step(S4, [N, N]); if (v.action === 'hit' && (v.kbx || v.kby)) diagAng = angOf(v); }
  ok(ice >= 25 && spikeAng < -60 && freeY < -70 && diagAng > 25 && diagAng < 65 && kGround <= 110,
    'Motisma Froid : Blizzard gèle ' + ice + ' frames ; Chute de Frigo au contact = spike (' + spikeAng + '°, cible à y ' + Math.round(freeY) + ') ; ensuite diagonale (' + diagAng + '°), KO vers ' + kGround + ' %');
}
// 39) Hélice : Bourrasque = vent puissant sans dégâts, on avance et on saute avec, 2 s max
{
  const S = mk('motisma', 'archeduc', 'final'); const f = S.fighters[0], t = S.fighters[1]; run(S, () => N, 30); f.v.form = 'fan'; f.x = -60; f.facing = 1; t.x = -20;
  let frames = 0, jumped = false;
  for (let i = 0; i < 200; i++) { G.Sim.step(S, [i < 3 ? [0, 0, 0, 0, B.SPC] : i === 50 || i === 51 ? [50, 0, 0, 0, B.SPC | B.JMP] : [50, 0, 0, 0, B.SPC], N]); if (f.v.gustT > 0) { frames++; if (!f.grounded) jumped = true; } }
  ok(t.x + 20 > 70 && t.percent === 0 && frames === 120 && jumped && f.x + 60 > 60, 'Motisma Hélice : Bourrasque en avançant et en sautant, adversaire poussé de ' + (t.x + 20).toFixed(0) + ' unités, 0 dégât, ' + frames + ' frames max');
}
// 40) Tonte : B = le moteur charge tout seul, B B = départ direct ; pleine charge stockée automatiquement et qui tue ;
//     saut / roulade / esquive aérienne gardent la charge
{
  const BB = (i) => (i === 0 || i === 3 ? [0, 0, 0, 0, B.SPC] : N);
  const setup = () => { const S = mk('motisma', 'archeduc', 'final'); const f = S.fighters[0]; run(S, () => N, 30); S.fighters[1].x = 300; f.v.form = 'mow'; f.x = -90; f.facing = 1; return [S, f]; };
  let [S, f] = setup(); let x0 = f.x; run(S, BB, 80); const d0 = f.x - x0; // B B
  [S, f] = setup(); run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N), 20); const stillCharging = f.action === 'move' && f.move === 'nspec' && Math.abs(f.x + 90) < 1; // un seul B : il charge
  run(S, () => N, 60); const autoStored = f.v.mowStore === 60 && f.action !== 'move';
  x0 = f.x; run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N), 80); const d1 = f.x - x0; // pleine charge en réserve : départ immédiat
  const k = motiKO('mow', (S2, g, t) => { g.x = -40; g.facing = 1; t.x = 30; g.v.mowStore = 60; }, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N));
  [S, f] = setup(); run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : i === 30 ? [80, 0, 0, 0, B.SHD] : N), 40); const rolled = f.action === 'roll' || f.v.mowStore > 15; const rollStore = f.v.mowStore;
  [S, f] = setup(); f.y = 40; f.grounded = false; f.plat = null; G.setAction(f, 'air');
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : i === 20 ? [0, 0, 0, 0, B.SHD] : N), 24); const dodged = f.action === 'adodge' && f.v.mowStore > 8;
  ok(d0 > 40 && stillCharging && autoStored && d1 > d0 * 1.8 && k <= 95 && rolled && rollStore > 15 && dodged,
    'Motisma Tonte : B = charge seule, B B = départ (' + d0.toFixed(0) + ' u) ; pleine charge stockée puis lancée (' + d1.toFixed(0) + ' u, KO vers ' + k + ' %) ; roulade (' + rollStore + ') et esquive gardent la charge');
}
// 41) Motisma : pas de chute libre après le haut B, un seul coup puis chute libre
{
  const S = mk('motisma', 'archeduc', 'final'); const f = S.fighters[0]; run(S, () => N, 30); S.fighters[1].x = 300; f.x = 0; f.y = 80; f.grounded = false; f.plat = null; G.setAction(f, 'air');
  G.Sim.step(S, [[0, 80, 0, 0, B.SPC], N]); run(S, () => N, 75);
  const free = f.action === 'air';
  G.Sim.step(S, [[0, 80, 0, 0, B.SPC], N]); const noUpB = f.move !== 'uspec';
  run(S, () => N, 3); G.Sim.step(S, [[60, 0, 0, 0, B.ATK], N]); const atk = f.move; run(S, () => N, 40);
  ok(free && noUpB && atk === 'fair' && f.action === 'help', 'Motisma : après le haut B il est libre (' + (free ? 'oui' : 'non') + '), un coup (' + atk + '), puis chute libre (' + f.action + ')');
}
// 42) Tonte : on peut changer de direction pendant la charge du Coupe-Herbe
{
  const S = mk('motisma', 'archeduc', 'final'); const f = S.fighters[0]; run(S, () => N, 30); S.fighters[1].x = 300; f.v.form = 'mow'; f.x = 0; f.facing = -1;
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : i < 20 ? N : i < 35 ? [80, 0, 0, 0, 0] : i === 36 ? [0, 0, 0, 0, B.SPC] : N), 37); // regarde à gauche, charge, stick à droite, B
  const x0 = f.x; run(S, () => N, 60);
  ok(f.facing === 1 && f.x - x0 > 40, 'Motisma Tonte : retourné pendant la charge, il part à droite (' + (f.x - x0).toFixed(0) + ' unités)');
}
// 43) Motisma normal : Change Éclair = s'il touche, téléporté derrière l'adversaire, possession prête
{
  const S = mk('motisma', 'archeduc', 'final'); const f = S.fighters[0], t = S.fighters[1]; run(S, () => N, 30); f.x = -50; f.facing = 1; t.x = 0; f.v.possCd = 100;
  run(S, (i) => (i === 0 ? [0, 0, 0, 0, B.SPC] : N), 20);
  ok(f.x > t.x && f.facing === -1 && f.v.possCd === 0 && t.percent > 5, "Motisma : Change Éclair touche et il se retrouve derrière l'adversaire (x " + f.x.toFixed(0) + ' / ' + t.x.toFixed(0) + '), possession prête');
}
// 44) Motisma Froid : la Chute de Frigo s'annule aussi avec un spécial (haut B, côté B...)
{
  const res = [];
  for (const [sx, sy, want] of [[0, 80, 'uspec'], [80, 0, 'sspec'], [0, 0, 'nspec']]) {
    const S = mk('motisma', 'archeduc', 'final'); const f = S.fighters[0]; run(S, () => N, 30); S.fighters[1].x = 300;
    f.v.form = 'frost'; f.x = 0; f.y = 150; f.grounded = false; f.plat = null; G.setAction(f, 'air'); f.facing = 1;
    run(S, (i) => (i === 0 ? [0, -80, 0, 0, B.ATK] : i === 22 ? [sx, sy, 0, 0, B.SPC] : N), 24);
    res.push(f.move === want);
  }
  ok(res.every(Boolean), 'Motisma Froid : Chute de Frigo annulée par haut B / côté B / B (' + res.join(', ') + ')');
}
console.log(fails ? fails + ' échec(s)' : 'tous les tests passent');
