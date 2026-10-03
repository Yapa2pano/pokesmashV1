'use strict';
// Simulation d'un match : création de l'état, pas de simulation (60/s), KO, fin de partie.
// step() est déterministe : mêmes entrées => même état (base du netcode rollback).
(function (G) {
  const U = G.U, C = G.C;
  const Sim = G.Sim = {};
  const COUNT = 200;

  Sim.create = (cfg) => {
    const stage = G.STAGES[cfg.stage] || G.STAGES.champ;
    const phys = U.clone(stage.phys);
    const n = cfg.players.length;
    const spawns = n <= 2 ? phys.spawns2 : phys.spawns;
    const S = {
      frame: 0, rng: (cfg.seed >>> 0) || 12345, nextId: 1,
      stageId: stage.id, stage: phys,
      fighters: [], projs: [], events: [], tmpHits: [],
      phase: cfg.training ? 'play' : 'count', phaseT: cfg.training ? 0 : COUNT,
      mode: cfg.mode || 'stock', stocks: cfg.stocks || 3,
      timer: cfg.time > 0 ? Math.round(cfg.time * 3600) : -1,
      dmgMul: n === 2 ? 1.2 : 1, teams: !!cfg.teams, training: !!cfg.training,
      sudden: false, winner: null, endT: 0, kos: 0,
    };
    cfg.players.forEach((p, i) => {
      const sp = spawns[i % spawns.length];
      S.fighters.push(G.createFighter(i, p, sp, S.mode === 'stock' ? S.stocks : 99));
    });
    return S;
  };

  Sim.step = (S, inputs) => {
    const RP = G.Replay;
    if (RP && RP.rec) RP.hook(S, inputs); // replay : on note les entrées de la frame (coût négligeable)
    S.events = [];
    S.frame++;
    const F = S.fighters;
    if (S.phase === 'count') {
      S.phaseT--;
      if (S.phaseT === COUNT - 1) S.events.push({ t: 'count', n: 3, k: 'c3' });
      if (S.phaseT === COUNT - 61) S.events.push({ t: 'count', n: 2, k: 'c2' });
      if (S.phaseT === COUNT - 121) S.events.push({ t: 'count', n: 1, k: 'c1' });
      for (const f of F) G.updateFighter(S, f, G.NEUTRAL);
      if (S.phaseT <= 0) { S.phase = 'play'; S.events.push({ t: 'go', k: 'go' }); }
      return;
    }
    if (S.phase === 'game' || S.phase === 'done') {
      S.endT++;
      for (const f of F) if (!f.dead && !f.out && f.hitlag <= 0) { f.hitlag = 0; }
      if (S.phase === 'game' && S.endT > 150) S.phase = 'done';
      return;
    }
    // Minuteur
    if (S.timer > 0 && !S.training) {
      S.timer--;
      if (S.timer % 60 === 0 && S.timer <= 600 && S.timer > 0) S.events.push({ t: 'tick', n: S.timer / 60, k: 'tk' + S.timer });
      if (S.timer === 0) { timeUp(S); return; }
    }
    const stg = G.STAGES[S.stageId];
    if (stg && stg.tick) stg.tick(S); // terrains animés (ex. ventre de Ronflex qui rebondit)
    fightStep(S, inputs);
    // Temps accéléré (Hurle-Temps de Dialga) : le combat avance de 1,5 frame par frame (un pas de plus une frame sur deux) ;
    // le terrain, le minuteur et le numéro de frame (entrées en ligne, replays) restent au rythme normal.
    if (S.stage.fast && !(S.frame & 1) && S.phase === 'play') fightStep(S, inputs);
  };

  function fightStep(S, inputs) {
    const F = S.fighters;
    for (const f of F) {
      const raw = f.cpu ? G.AI.think(S, f) : (inputs[f.slot] || G.NEUTRAL);
      G.updateFighter(S, f, raw);
    }
    G.syncGrabs(S);
    G.updateProjs(S);
    G.resolveCombat(S);
    pushApart(S);
    for (const f of F) {
      const ch = G.CHARS[f.char];
      if (ch.postTick && !f.dead && !f.out) ch.postTick(S, f);
    }
    checkBlast(S);
    if (!S.training) checkEnd(S);
  }

  function pushApart(S) {
    const F = S.fighters;
    for (let i = 0; i < F.length; i++) {
      const a = F[i];
      if (a.dead || a.out || !a.grounded || a.grabbedBy >= 0 || a.grabbing >= 0 || a.v.under) continue; // (sous terre : il passe dessous)
      for (let j = i + 1; j < F.length; j++) {
        const b = F[j];
        if (b.dead || b.out || !b.grounded || b.plat !== a.plat || b.grabbedBy >= 0 || b.grabbing >= 0 || b.v.under) continue;
        const sa = G.ST(a), sb = G.ST(b);
        const min = (sa.w + sb.w) * 0.35;
        const dx = b.x - a.x;
        if (Math.abs(dx) < min) {
          const d = dx === 0 ? (a.slot < b.slot ? 1 : -1) : Math.sign(dx);
          const p = Math.min(0.5, (min - Math.abs(dx)) * 0.25);
          const s = G.surf(S, a.plat);
          b.x = U.clamp(b.x + d * p, s.l, s.r); a.x = U.clamp(a.x - d * p, s.l, s.r);
        }
      }
    }
  }

  function checkBlast(S) {
    const bl = S.stage.blast;
    for (const f of S.fighters) {
      if (f.dead || f.out) continue;
      const topKO = f.y > bl.t && (f.action === 'hit' || f.action === 'tumble' || f.y > bl.t + 30);
      if (f.x < bl.l || f.x > bl.r || f.y < bl.b || topKO) ko(S, f);
    }
  }

  function ko(S, f) {
    const bl = S.stage.blast;
    const killer = f.lastAttT > 0 && f.lastAtt >= 0 && f.lastAtt !== f.slot ? f.lastAtt : -1;
    S.events.push({
      t: 'ko', s: f.slot, x: U.clamp(f.x, bl.l, bl.r), y: U.clamp(f.y, bl.b, bl.t),
      side: f.x < bl.l ? 'l' : f.x > bl.r ? 'r' : f.y < bl.b ? 'b' : 't', killer, k: 'ko' + f.slot + '_' + S.frame,
    });
    if (f.grabbing >= 0) { const v = S.fighters[f.grabbing]; if (v) { v.grabbedBy = -1; G.setAction(v, 'air'); } f.grabbing = -1; }
    if (f.grabbedBy >= 0) { const g = S.fighters[f.grabbedBy]; if (g) { g.grabbing = -1; G.setAction(g, g.grounded ? 'idle' : 'air'); } f.grabbedBy = -1; }
    f.dead = true; f.action = 'dead'; f.af = 0; f.stat.fall++;
    if (killer >= 0) S.fighters[killer].stat.ko++; else f.stat.sd++;
    S.kos++;
    if (S.mode === 'stock' || S.sudden) f.stocks--;
    f.respT = C.RESPAWN_T;
    if (f.stocks <= 0) { f.out = true; f.respT = 0; }
    const ch = G.CHARS[f.char];
    if (ch.onKO) ch.onKO(S, f);
  }

  const score = (f) => f.stat.ko - f.stat.fall;
  function aliveKeys(S) {
    const keys = new Set();
    for (const f of S.fighters) if (!f.out) keys.add(S.teams ? 't' + f.team : 'p' + f.slot);
    return keys;
  }
  function checkEnd(S) {
    if (S.mode !== 'stock' && !S.sudden) return;
    const alive = aliveKeys(S);
    if (alive.size <= 1 && S.fighters.length > 1) endGame(S, S.fighters.filter(f => !f.out).map(f => f.slot));
  }
  function endGame(S, winners) {
    S.phase = 'game'; S.endT = 0;
    S.winner = winners;
    S.events.push({ t: 'game', k: 'game' });
  }
  function timeUp(S) {
    // Classement : stock -> plus de vies ; temps -> meilleur score. Égalité => mort subite à 300 %.
    const F = S.fighters.filter(f => !f.out);
    const val = (f) => S.mode === 'stock' ? f.stocks * 1000 - f.percent * 0.001 : score(f);
    let best = -Infinity;
    for (const f of F) best = Math.max(best, S.mode === 'stock' ? f.stocks : score(f));
    const top = F.filter(f => (S.mode === 'stock' ? f.stocks : score(f)) === best);
    if (top.length === 1 || S.fighters.length === 1) { endGame(S, [top[0].slot]); return; }
    // Mort subite
    S.sudden = true; S.timer = -1;
    S.events.push({ t: 'sudden', k: 'sd' });
    for (const f of S.fighters) {
      if (!top.includes(f)) { f.out = true; f.dead = true; continue; }
      f.stocks = 1; f.percent = 300; f.dead = false; f.out = false;
    }
    void val;
  }

  Sim.hash = (S) => {
    const a = [S.frame, S.rng, S.projs.length];
    for (const f of S.fighters) a.push(f.x, f.y, f.vx, f.vy, f.kbx, f.kby, f.percent, f.stocks, f.af, f.hitlag, f.shield, f.facing, f.action.length, f.dead ? 1 : 0);
    for (const p of S.projs) a.push(p.x, p.y, p.id);
    return U.hashNums(a);
  };

  Sim.results = (S) => {
    const F = S.fighters;
    const order = F.slice().sort((a, b) => {
      const wa = S.winner && S.winner.includes(a.slot) ? 1 : 0, wb = S.winner && S.winner.includes(b.slot) ? 1 : 0;
      if (wa !== wb) return wb - wa;
      if (S.mode === 'stock') return (b.stocks - a.stocks) || (a.stat.fall - b.stat.fall);
      return score(b) - score(a);
    });
    return order.map((f, i) => ({ slot: f.slot, pslot: f.pslot, char: f.char, pal: f.pal, cpu: f.cpu, rank: i + 1, ko: f.stat.ko, fall: f.stat.fall, sd: f.stat.sd, dmg: Math.round(f.stat.dmg), taken: Math.round(f.stat.taken), score: score(f) }));
  };
})(window.G);
