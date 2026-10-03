// Test des terrains animés (node outils/test-terrains.js [terrain] [frames]) : sur chaque terrain (ou celui demandé),
// fait tourner un duel CPU par perso pendant plusieurs cycles du terrain, puis vérifie : pas d'erreur ni de NaN,
// même résultat en rejouant (déterminisme), et même résultat après un rollback depuis un clone de l'état
// (pris à 3 moments différents, pour tomber dans les différentes phases du terrain).
const { load } = require('./test-sim');
const G = load();
const want = process.argv[2] && process.argv[2] !== 'tous' ? [process.argv[2]] : G.STAGE_ORDER;
const frames = +(process.argv[3] || 5600);
const chars = G.CHAR_ORDER;
let errors = 0;
for (const sid of want) {
  if (!G.STAGES[sid]) { console.log('terrain inconnu :', sid); errors++; continue; }
  let kos = 0, hazard = 0;
  for (let i = 0; i < chars.length; i++) {
    const a = chars[i], b = chars[(i + 3) % chars.length];
    const cfg = { stage: sid, players: [{ char: a, cpu: 9 }, { char: b, cpu: 8 }, ...(i % 3 === 0 ? [{ char: chars[(i + 5) % chars.length], cpu: 7 }] : [])], stocks: 99, time: 0, mode: 'stock', seed: 777 + i * 31 };
    try {
      const S = G.Sim.create(cfg), S2 = G.Sim.create(cfg);
      const snaps = {}, at = [Math.floor(frames * 0.3), Math.floor(frames * 0.55), Math.floor(frames * 0.8)];
      for (let k = 0; k < frames; k++) {
        G.Sim.step(S, []); G.Sim.step(S2, []);
        if (at.includes(k)) snaps[k] = G.U.clone(S);
        for (const e of S.events) { if (e.t === 'ko') kos++; if (e.t === 'hit' && e.s === -1) hazard++; }
        for (const f of S.fighters) for (const key of ['x', 'y', 'vx', 'vy', 'percent']) if (!Number.isFinite(f[key])) throw new Error('NaN ' + key + ' ' + f.char + ' ' + f.action + ' ' + f.move);
      }
      if (G.Sim.hash(S) !== G.Sim.hash(S2) || JSON.stringify(S.stage) !== JSON.stringify(S2.stage)) { console.log('DÉSYNCHRO', sid, a, b); errors++; }
      for (const k of at) {
        const S3 = snaps[k];
        for (let j = k + 1; j < frames; j++) G.Sim.step(S3, []);
        if (G.Sim.hash(S3) !== G.Sim.hash(S) || JSON.stringify(S3.stage) !== JSON.stringify(S.stage)) { console.log('ROLLBACK DÉSYNCHRO', sid, a, b, 'depuis la frame', k); errors++; }
      }
    } catch (e) { console.log('ERREUR', sid, a, 'vs', b, e.stack.split('\n').slice(0, 4).join(' / ')); errors++; }
  }
  console.log(`${sid} : ${chars.length} duels de ${frames} frames, ${kos} KO, ${hazard} coups du terrain`);
}
console.log('fini, erreurs :', errors);
