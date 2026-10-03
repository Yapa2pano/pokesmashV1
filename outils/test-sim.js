// Harnais headless (node outils/test-sim.js [frames] [v|moves]) : fait tourner tous les duels CPU,
// vérifie l'absence d'erreur, de NaN et de désynchro (rejeu + rollback depuis un clone de l'état).
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '../js/') + '/';
function load(extra) {
  const noop = () => {};
  const ctx = { console, Math, JSON, Object, Array, Set, Map, Date, structuredClone,
    localStorage: { getItem: () => null, setItem: noop },
    navigator: { getGamepads: () => [] }, document: { createElement: () => ({ getContext: () => ({}) }) } };
  ctx.window = ctx; ctx.addEventListener = noop;
  vm.createContext(ctx);
  const files = ['util.js', 'input.js', 'anim.js', 'sim/fighter.js', 'sim/combat.js', 'sim/moves.js', 'sim/sim.js', 'stages.js', 'stages-pokemon.js', 'stages-koraidon.js', 'stages-wailord.js', 'stages-colonnes.js', 'stages-oyacata.js', 'render/draw.js',
    'chars/gromago.js', 'chars/archeduc.js', 'chars/mouscoto.js', 'chars/armarouge.js', 'chars/malvalame.js', 'chars/miascarade.js', 'chars/insecateur.js', 'chars/meloetta.js', 'chars/obalie.js', 'chars/evoli.js', 'chars/motisma.js', 'chars/minotaupe.js', 'ai.js'].concat(extra || []);
  for (const f of files) vm.runInContext(fs.readFileSync(ROOT + f, 'utf8'), ctx, { filename: f });
  return ctx.G;
}
module.exports = { load };
if (require.main === module) {
  const G = load();
  const chars = G.CHAR_ORDER;
  let errors = 0;
  const frames = +(process.argv[2] || 3000);
  const moveUse = {};
  for (let i = 0; i < chars.length; i++) {
    for (let j = 0; j < chars.length; j++) {
      const cfg = { stage: Object.keys(G.STAGES)[(i + j) % Object.keys(G.STAGES).length], players: [{ char: chars[i], cpu: 9 }, { char: chars[j], cpu: 7 + (j % 3) }], stocks: 99, time: 0, mode: 'stock', seed: 1000 + i * 17 + j };
      try {
        const S = G.Sim.create(cfg);
        const S2 = G.Sim.create(cfg);
        let snap = null;
        for (let k = 0; k < frames; k++) {
          G.Sim.step(S, []); G.Sim.step(S2, []);
          for (const f of S.fighters) if (f.action === 'move') { const key = f.char + ':' + (f.v.form ? f.v.form + ':' : '') + f.move; moveUse[key] = (moveUse[key] || 0) + (f.af === 1 ? 1 : 0); }
          if (k === Math.floor(frames / 2)) snap = G.U.clone(S);
          for (const f of S.fighters) for (const key of ['x', 'y', 'vx', 'vy', 'percent']) if (!Number.isFinite(f[key])) throw new Error('NaN ' + key + ' ' + f.char + ' ' + f.action + ' ' + f.move);
        }
        if (G.Sim.hash(S) !== G.Sim.hash(S2)) { console.log('DESYNC', chars[i], chars[j]); errors++; }
        // rollback : re-simuler depuis le clone
        const S3 = snap; for (let k = Math.floor(frames / 2) + 1; k < frames; k++) G.Sim.step(S3, []);
        if (G.Sim.hash(S3) !== G.Sim.hash(S)) { console.log('ROLLBACK DESYNC', chars[i], chars[j]); errors++; }
        const st = S.fighters.map((f) => `${f.char} ko${f.stat.ko} dmg${Math.round(f.stat.dmg)}`).join(' | ');
        if (process.argv[3] === 'v') console.log(st);
      } catch (e) { console.log('ERREUR', chars[i], 'vs', chars[j], e.stack.split('\n').slice(0, 4).join(' / ')); errors++; }
    }
  }
  if (process.argv[3] === 'moves') console.log(Object.entries(moveUse).sort().map(([k, v]) => k + '=' + v).join('  '));
  console.log('fini, erreurs :', errors);
}
