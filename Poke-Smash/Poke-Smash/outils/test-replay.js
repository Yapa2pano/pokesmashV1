// Test des replays (node outils/test-replay.js) : un match avec des entrées « humaines » pseudo-aléatoires est
// enregistré, encodé, décodé puis relu par le vrai lecteur ; l'état final doit être identique (même hash),
// sans alerte de désynchro. Vérifie aussi qu'un replay d'une autre version est bien détecté.
const { load } = require('./test-sim');
const G = load(['replay.js']);
const Rep = G.Replay;
G.R = { reset() {}, consume() {}, ctx: null };
G.Game = { S: null, mode: 'menu' };
let fails = 0;
const ok = (c, msg) => { console.log((c ? '  OK  ' : '  ÉCHEC ') + msg); if (!c) fails++; };

function randomMatch(chars, stage, frames, seed) {
  const cfg = { stage, players: chars.map((c, i) => ({ char: c, dev: 'gp' + i, cpu: i >= 2 ? 6 : 0 })), stocks: 3, time: 0, mode: 'stock', seed };
  const S = G.Sim.create(cfg);
  Rep.start(cfg, S);
  let r = seed;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const hold = chars.map(() => [0, 0, 0, 0, 0]);
  for (let k = 0; k < frames && S.phase !== 'done'; k++) {
    const ins = chars.map((c, i) => {
      if (rnd() < 0.08) { // nouvelle entrée maintenue quelques frames, comme un humain
        const bt = rnd() < 0.5 ? 0 : [1, 2, 4, 8, 16][Math.floor(rnd() * 5)];
        hold[i] = [Math.round((rnd() * 2 - 1) * 80), Math.round((rnd() * 2 - 1) * 80), 0, 0, bt];
      }
      return hold[i].slice();
    });
    G.Sim.step(S, ins);
  }
  return { S, data: Rep.finish(S) };
}
function replay(data) {
  Rep.watch(data);
  let n = 0;
  while (!Rep.play.end && n < data.len + 10) { Rep.tick(); n++; }
  return { S: G.Game.S, desync: Rep.play.desync };
}

const cases = [[['malvalame', 'obalie'], 'torterra'], [['archeduc', 'gromago', 'mouscoto'], 'ronflex'], [['evoli', 'insecateur', 'meloetta', 'miascarade'], 'seracrawl'], [['armarouge', 'malvalame'], 'final']];
cases.forEach(([chars, stage], i) => {
  const { S, data } = randomMatch(chars, stage, 7200, 77 + i);
  ok(!!data, 'Replay créé (' + chars.join(' vs ') + ', ' + stage + ', ' + data.len + ' frames)');
  const size = JSON.stringify(data).length;
  ok(size < 400000, '  taille : ' + (size / 1024).toFixed(1) + ' Ko pour ' + (data.len / 60).toFixed(0) + ' s');
  const json = JSON.parse(JSON.stringify(data)); // comme un fichier sauvegardé puis rouvert
  const R = replay(json);
  ok(G.Sim.hash(R.S) === G.Sim.hash(S) && !R.desync, '  relu à l\'identique (hash ' + G.Sim.hash(R.S) + ')');
});
// Replay « d'une autre version » : on fausse une somme de contrôle, le lecteur doit le signaler
{
  const { data } = randomMatch(['obalie', 'gromago'], 'champ', 2000, 5);
  const k = Object.keys(data.ck).find((f) => +f > 0);
  data.ck[k] = (data.ck[k] + 1) | 0;
  ok(replay(data).desync, 'Désynchro détectée sur un replay d\'une autre version');
}
// Un match de moins de 10 s n'est pas gardé
{
  const { data } = randomMatch(['obalie', 'gromago'], 'champ', 300, 9);
  ok(data === null, 'Match trop court (5 s) : pas de replay');
}
console.log(fails ? fails + ' échec(s)' : 'tous les tests replay passent');
