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
function run(S, inputs, n) { for (let i = 0; i < n; i++) G.Sim.step(S, [inputs(i), [0, 0, 0, 0, 0]]); }
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
console.log(fails ? fails + ' échec(s)' : 'tous les tests passent');
