// Mesure la hauteur max atteinte avec un grand saut + un double saut au sommet, pour chaque perso et forme.
// Plateforme du haut du stage à 3 plateformes : y = 55 (il faut dépasser 55 pour atterrir dessus).
const { load } = require('./test-sim'); const G = load(); const B = G.BTN; const N = [0, 0, 0, 0, 0];
const rows = [];
for (const id of G.CHAR_ORDER) {
  const ch = G.CHARS[id];
  const forms = [null].concat(ch._forms ? Object.keys(ch._forms).filter((k) => !/^n\d/.test(k)) : []);
  for (const form of forms) {
    const S = G.Sim.create({ stage: 'champ', players: [{ char: id }, { char: 'mouscoto' }], stocks: 3, seed: 7, training: true });
    for (let i = 0; i < 30; i++) G.Sim.step(S, [N, N]);
    const f = S.fighters[0]; f.x = 0; S.fighters[1].x = 200; f.v.form = form;
    let top = 0, dj = false, prevVy = 0;
    for (let i = 0; i < 160; i++) {
      let inp = i < 5 ? [0, 0, 0, 0, B.JMP] : N;
      if (!dj && i > 6 && !f.grounded && f.vy <= 0 && prevVy > 0) { inp = [0, 0, 0, 0, B.JMP]; dj = true; }
      prevVy = f.vy;
      G.Sim.step(S, [inp, N]);
      top = Math.max(top, f.y);
    }
    rows.push([ch.name + (form ? ' (' + form + ')' : ''), top]);
  }
}
for (const [n, t] of rows) console.log((n + '                              ').slice(0, 30), t.toFixed(1), t > 63 ? 'OK' : t > 55 ? 'LIMITE' : 'NON');
