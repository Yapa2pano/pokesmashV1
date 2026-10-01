'use strict';
// Combattant : état (objet JSON pur, clonable pour le rollback), lecture des entrées,
// machine à états façon Smash Ultimate et physique de déplacement.
(function (G) {
  const U = G.U, B = G.BTN;

  const C = G.C = {
    BUF: 9, JSQ: 3, TILT: 0.25, SMASH: 0.66, CROUCH: -0.6,
    KB_DECAY: 0.051, KB_SPEED: 0.03, HITSTUN: 0.4, TUMBLE: 80,
    SH_MAX: 50, SH_DECAY: 0.15, SH_REGEN: 0.08, SH_DROP: 7, PARRY: 5,
    RESPAWN_T: 70, RESPAWN_INV: 120, RESPAWN_MAX: 300, LEDGE_MAX: 300,
    TECH_WIN: 11, SMASH_WIN: 10,
  };

  G.CHARS = {}; G.CHAR_ORDER = [];
  const DEF = {
    weight: 100, h: 16, w: 8,
    walk: 1.1, walkAcc: 0.12, dash: 1.9, dashF: 11, run: 1.8, runAcc: 0.1, traction: 0.11,
    air: 1.05, airAcc: 0.07, airFric: 0.012,
    grav: 0.1, fall: 1.6, ffall: 2.5,
    fullHop: 33, shortHop: 16, dJump: 33, jumps: 2, jumpMom: 1.0,
    landLag: 3, grabRange: 1,
  };
  G.registerChar = (def) => {
    def._stats = Object.assign({}, DEF, def.stats);
    if (def.formStats) {
      def._forms = {};
      for (const k in def.formStats) def._forms[k] = Object.assign({}, def._stats, def.formStats[k]);
    }
    def.moves = Object.assign({}, G.genericMoves(def._stats), def.moves);
    G.finalizeMoves(def);
    G.tuneFeel(def);
    G.CHARS[def.id] = def;
    if (!G.CHAR_ORDER.includes(def.id)) G.CHAR_ORDER.push(def.id);
  };
  G.ST = (f) => { const ch = G.CHARS[f.char]; return (ch._forms && f.v.form && ch._forms[f.v.form]) || ch._stats; };
  G.MV = (f, name) => {
    const ch = G.CHARS[f.char];
    if (f.v.form) { const m = ch.moves[f.v.form + ':' + name]; if (m) return m; }
    return ch.moves[name];
  };

  G.createFighter = (slot, cfg, spawn, stocks) => {
    const f = {
      slot, pslot: cfg.pslot != null ? cfg.pslot : slot, char: cfg.char, pal: cfg.pal || 0, cpu: cfg.cpu || 0, team: cfg.team == null ? slot : cfg.team,
      x: spawn[0], y: spawn[1], vx: 0, vy: 0, kbx: 0, kby: 0, facing: spawn[0] > 0 ? -1 : 1,
      grounded: true, plat: spawn[2] == null ? -1 : spawn[2], action: 'idle', af: 0, move: null, mi: 0,
      jumps: 0, ff: false, airdodged: false, adDir: false, dropT: 0, dropPlat: -2, jsqSrc: 0,
      percent: 0, stocks, hitlag: 0, hitstun: 0, tumble: false, shield: C.SH_MAX, shieldStun: 0,
      intang: 0, invinc: 0, lag: 0, charge: 0,
      grabbing: -1, grabbedBy: -1, grabT: 0,
      ledge: 0, ledgeRegrab: 0, ledgeCd: 0, lastShd: 99, sfx: 0, sfxa: 99, sfy: 0, sfya: 99,
      buf: { a: 0, b: 0, j: 0, s: 0, g: 0, c: 0, t: 0 }, cdir: [0, 0], prev: [0, 0, 0, 0, 0], fxc: 0, fyc: 0, lsx: 0, lsxT: 99, bRev: 0,
      hitMem: [], lastAtt: -1, lastAttT: 0, mv: {}, v: {}, buff: 1,
      stat: { ko: 0, fall: 0, dmg: 0, taken: 0, sd: 0 },
      dead: false, respT: 0, out: false, flash: 0,
      ai: null,
    };
    const ch = G.CHARS[f.char];
    if (ch.init) ch.init(f);
    return f;
  };

  // ---------- Entrées ----------
  function readIn(S, f, raw) {
    const p = f.prev;
    const b = raw[4], pb = p[4];
    const pressed = b & ~pb;
    if (Math.abs(raw[0]) < 24) f.fxc = 0; else f.fxc++;
    if (Math.abs(raw[1]) < 24) f.fyc = 0; else f.fyc++;
    const bf = f.buf;
    for (const k in bf) if (bf[k] > 0) bf[k]--;
    if (pressed & B.ATK) bf.a = C.BUF;
    // dernière direction horizontale du stick (pour le demi-tour B : stick arrière, retour au neutre, puis B)
    if (Math.abs(raw[0]) >= 20) { f.lsx = raw[0] > 0 ? 1 : -1; f.lsxT = 0; } else if (f.lsxT < 99) f.lsxT++;
    if (pressed & B.SPC) { bf.b = C.BUF; f.bRev = f.lsxT <= 10 ? f.lsx : 0; }
    if (pressed & B.JMP) { bf.j = C.BUF; f.jsqSrc = 1; }
    if (pressed & B.SHD) { bf.s = C.BUF; f.lastShd = 0; } else if (f.lastShd < 99) f.lastShd++;
    if (pressed & B.GRB) bf.g = C.BUF;
    if (pressed & B.TAUNT) bf.t = C.BUF;
    const cOn = raw[2] || raw[3], pcOn = p[2] || p[3];
    if (cOn && !pcOn) {
      bf.c = C.BUF;
      f.cdir = [raw[2] === 2 ? f.facing : raw[2], raw[3]];
      f.ctilt = !!(b & B.CTILT);
    }
    const flickX = Math.abs(raw[0]) >= 52 && f.fxc >= 1 && f.fxc <= 3;
    const flickY = Math.abs(raw[1]) >= 52 && f.fyc >= 1 && f.fyc <= 3;
    // Smash : on retient le dernier coup de stick rapide ; A dans les SMASH_WIN frames suivantes = smash
    if (f.sfxa < 99) f.sfxa++;
    if (f.sfya < 99) f.sfya++;
    if (Math.abs(raw[0]) >= 52 && f.fxc >= 1 && f.fxc <= 4 && (f.sfxa > 4 || f.sfx !== Math.sign(raw[0]))) { f.sfx = Math.sign(raw[0]); f.sfxa = 0; }
    if (Math.abs(raw[1]) >= 52 && f.fyc >= 1 && f.fyc <= 4 && (f.sfya > 4 || f.sfy !== Math.sign(raw[1]))) { f.sfy = Math.sign(raw[1]); f.sfya = 0; }
    const tap = !!(b & B.TAPJUMP);
    if (tap && flickY && raw[1] > 0 && f.fyc === 1) { bf.j = C.BUF; f.jsqSrc = 2; }
    f.prev = raw;
    return {
      sx: raw[0] / 80, sy: raw[1] / 80, b, pressed, flickX, flickY,
      digital: !!(b & B.DIGITAL), tap,
      held: (bit) => !!(b & bit),
      cHeld: !!cOn,
      anyPress: pressed !== 0 || (flickX && f.fxc === 1) || (flickY && f.fyc === 1),
    };
  }

  // ---------- Helpers état ----------
  const setA = G.setAction = (f, a) => { f.action = a; f.af = 0; if (a !== 'move') f.move = null; };
  const surf = (S, id) => (id === -1 ? S.stage.main : S.stage.plats[id]);
  G.surf = surf;

  const startMove = G.startMove = (S, f, name) => {
    const M = G.MV(f, name);
    if (!M) return false;
    if (M.cond && !M.cond(S, f)) return false;
    f.action = 'move'; f.move = name; f.af = 0; f.mi++; f.charge = 0; f.mv = {};
    if (M.start) M.start(S, f, M);
    return true;
  };

  function goAir(S, f) {
    f.grounded = false; f.plat = null;
    if (f.jumps < 1) f.jumps = 1;
    const a = f.action;
    if (a === 'idle' || a === 'walk' || a === 'dash' || a === 'run' || a === 'brake' || a === 'turn' || a === 'crouch' || a === 'land' || a === 'grel') setA(f, 'air');
  }
  G.goAir = goAir;

  function hurtH(S, f, st) {
    const a = f.action;
    if (a === 'crouch') return st.h * 0.62;
    if (a === 'down' || a === 'dizzy' && false) return st.h * 0.42;
    if (a === 'move') { const M = G.MV(f, f.move); if (M && M.hurtH) return st.h * M.hurtH; }
    return st.h;
  }
  G.hurtbox = (S, f) => {
    const st = G.ST(f);
    const h = hurtH(S, f, st);
    const r = st.w * 0.55;
    const wide = f.action === 'down';
    return { x: f.x, y0: f.y + r, y1: f.y + Math.max(r, h - r), r: wide ? r * 1.4 : r };
  };

  // ---------- Options d'action ----------
  function specDir(inp) {
    if (inp.sy >= 0.5 && inp.sy >= Math.abs(inp.sx) * 0.8) return 'up';
    if (inp.sy <= -0.5 && -inp.sy >= Math.abs(inp.sx) * 0.8) return 'down';
    if (Math.abs(inp.sx) >= 0.4) return 'side';
    return 'n';
  }
  const SPEC = { n: 'nspec', side: 'sspec', up: 'uspec', down: 'dspec' };
  function doSpecial(S, f, inp, air) {
    const d = specDir(inp);
    let name = SPEC[d];
    if (air && G.MV(f, name + 'A')) name += 'A';
    const NM = G.MV(f, name);
    if (d === 'side') f.facing = inp.sx > 0 ? 1 : -1;
    else if (NM && NM.noReverse) { /* pas de demi-tour : le stick sert à choisir (formes d'Évoli / Motisma) */ }
    else if (inp.sx * f.facing <= -0.25) f.facing = -f.facing; // demi-tour B
    else if (d === 'n' && f.bRev === -f.facing) f.facing = -f.facing; // stick arrière puis neutre puis B (≤ 10 frames) : B neutre retourné
    f.bRev = 0;
    f.buf.b = 0;
    return startMove(S, f, name);
  }
  function doSmash(S, f, dx, dy) {
    let name;
    if (dy > 0) name = 'usmash';
    else if (dy < 0) name = 'dsmash';
    else { if (dx) f.facing = dx > 0 ? 1 : -1; name = 'fsmash'; }
    f.buf.a = 0; f.buf.c = 0;
    return startMove(S, f, name);
  }
  function doTilt(S, f, inp) {
    const ax = Math.abs(inp.sx), ay = Math.abs(inp.sy);
    f.buf.a = 0;
    if (ay >= C.TILT && ay >= ax) return startMove(S, f, inp.sy > 0 ? 'utilt' : 'dtilt');
    if (ax >= C.TILT) { f.facing = inp.sx > 0 ? 1 : -1; return startMove(S, f, 'ftilt'); }
    return startMove(S, f, 'jab');
  }
  // Stick droit en mode « attaque dirigée » : direction + A
  function cTilt(S, f, ctx) {
    const [dx, dy] = f.cdir;
    f.buf.c = 0; f.buf.a = 0;
    if (ctx === 'dash' || ctx === 'run') {
      if (dx === f.facing) return startMove(S, f, 'dashAtk'); // même sens que le dash
      if (dx) { f.facing = dx; return startMove(S, f, 'ftilt'); } // demi-tour
    }
    if (dy > 0) return startMove(S, f, 'utilt');
    if (dy < 0) return startMove(S, f, 'dtilt');
    if (dx) f.facing = dx > 0 ? 1 : -1;
    return startMove(S, f, 'ftilt');
  }
  function flickSmash(f, inp) { // smash au stick gauche (pas au clavier) : coup de stick rapide + A dans la fenêtre
    if (inp.digital) return null;
    const ax = Math.abs(inp.sx), ay = Math.abs(inp.sy);
    const okY = f.sfya <= C.SMASH_WIN && inp.sy * f.sfy >= 0.5;
    const okX = f.sfxa <= C.SMASH_WIN && inp.sx * f.sfx >= 0.5;
    if (okY && (ay >= ax || !okX)) return [0, f.sfy];
    if (okX) return [f.sfx, 0];
    return null;
  }

  // ctx : 'std' | 'dash' | 'run' | 'crouch'
  function groundAct(S, f, inp, ctx) {
    const bf = f.buf;
    if (bf.b) return doSpecial(S, f, inp, false);
    if (bf.c) return f.ctilt ? cTilt(S, f, ctx) : doSmash(S, f, f.cdir[0], f.cdir[1]);
    if (bf.a) {
      if (ctx === 'dash' || ctx === 'run') {
        const fs = flickSmash(f, inp); // stick + A juste après le dash = smash
        if (fs) return doSmash(S, f, fs[0], fs[1]);
        bf.a = 0; return startMove(S, f, 'dashAtk');
      }
      const fs = flickSmash(f, inp);
      if (fs) return doSmash(S, f, fs[0], fs[1]);
      if (ctx === 'crouch' && inp.sy < -0.3) { bf.a = 0; return startMove(S, f, 'dtilt'); }
      return doTilt(S, f, inp);
    }
    if (bf.g) { bf.g = 0; return startMove(S, f, ctx === 'dash' || ctx === 'run' ? 'dashgrab' : 'grab'); }
    if (inp.held(B.SHD)) { setA(f, 'shield'); return true; }
    if (bf.j) { bf.j = 0; setA(f, 'jsq'); return true; }
    if (bf.t && ctx === 'std') { bf.t = 0; return startMove(S, f, 'taunt'); }
    return false;
  }

  function aerialName(f, dx, dy) {
    if (dy > 0) return 'uair';
    if (dy < 0) return 'dair';
    if (dx === 0) return 'nair';
    return dx === f.facing ? 'fair' : 'bair';
  }
  function airAct(S, f, inp, st) {
    const bf = f.buf;
    if (bf.b) return doSpecial(S, f, inp, true);
    if (bf.c) { bf.c = 0; bf.a = 0; return startMove(S, f, aerialName(f, f.cdir[0], f.cdir[1])); }
    if (bf.a) {
      bf.a = 0;
      const ax = Math.abs(inp.sx), ay = Math.abs(inp.sy);
      let dx = 0, dy = 0;
      if (ay >= 0.3 && ay >= ax) dy = inp.sy > 0 ? 1 : -1;
      else if (ax >= 0.3) dx = inp.sx > 0 ? 1 : -1;
      return startMove(S, f, aerialName(f, dx, dy));
    }
    if (bf.s && !f.airdodged) { bf.s = 0; startAirdodge(S, f, inp); return true; }
    if (bf.j && f.jumps < st.jumps) { bf.j = 0; doubleJump(S, f, inp, st); return true; }
    return false;
  }

  function jumpV(st, h) { return Math.sqrt(2 * st.grav * h); }
  function doubleJump(S, f, inp, st) {
    f.jumps++;
    f.vy = jumpV(st, st.dJump);
    f.vx = inp.sx * st.air;
    if (Math.abs(inp.sx) > 0.3 && Math.sign(inp.sx) !== f.facing && st.djTurn !== false) f.facing = inp.sx > 0 ? 1 : -1;
    f.ff = false; f.kbx *= 0.3; f.kby *= 0.3;
    setA(f, 'air'); f.v.dj = S.frame;
    S.events.push({ t: 'djump', s: f.slot, x: f.x, y: f.y, k: 'dj' + f.slot + '_' + S.frame });
    const ch = G.CHARS[f.char];
    if (ch.onDoubleJump) ch.onDoubleJump(S, f);
  }
  function startAirdodge(S, f, inp) {
    const m = U.len(inp.sx, inp.sy);
    setA(f, 'adodge');
    f.airdodged = true; f.ff = false;
    if (m > 0.35) {
      f.adDir = true;
      f.vx = inp.sx / m * 2.35; f.vy = inp.sy / m * 2.35;
    } else {
      f.adDir = false;
      f.vx *= 0.3; f.vy = Math.max(f.vy, 0) * 0.3;
    }
    f.kbx = 0; f.kby = 0;
  }
  function fastFall(f, inp) {
    // chute rapide : un coup de stick vers le bas un peu avant/après le sommet du saut
    if (!f.ff && f.vy <= 0.8 && inp.sy < -0.6 && f.fyc >= 1 && f.fyc <= 5) { f.ff = true; }
  }

  // ---------- Physique ----------
  const FALL_OK = { idle: 1, walk: 1, dash: 1, run: 1, brake: 1, turn: 1, hit: 1, grel: 1, crouch: 1 };
  function physGround(S, f, st, fallOk) {
    f.x += f.vx + f.kbx;
    if (f.kbx) f.kbx = U.approach(f.kbx, 0, C.KB_DECAY + st.traction);
    const s = surf(S, f.plat);
    if (!s) { goAir(S, f); return; }
    if (f.x < s.l || f.x > s.r) {
      if (fallOk) { goAir(S, f); return; }
      f.x = U.clamp(f.x, s.l, s.r); f.vx = 0; f.kbx = 0;
    }
    f.y = s.y;
  }
  G.physGround = physGround;

  function decayKB(f) {
    const sp = Math.sqrt(f.kbx * f.kbx + f.kby * f.kby);
    if (sp > 0) {
      const ns = sp - C.KB_DECAY;
      if (ns <= 0) { f.kbx = 0; f.kby = 0; } else { f.kbx *= ns / sp; f.kby *= ns / sp; }
    }
  }

  function physAir(S, f, st, o) {
    o = o || {};
    if (!o.noGrav) {
      f.vy -= st.grav * (o.grav == null ? 1 : o.grav);
      if (f.ff && o.ff !== false) f.vy = -st.ffall;
      else if (f.vy < -st.fall * (o.fallMul || 1)) f.vy = Math.min(f.vy + st.grav * 2, -st.fall * (o.fallMul || 1));
    }
    const drift = o.drift == null ? 1 : o.drift;
    if (drift > 0) {
      const sx = o.sx || 0;
      const maxA = st.air * drift;
      if (sx !== 0) {
        const tgt = sx * maxA;
        if (Math.abs(f.vx) <= maxA || Math.sign(f.vx) !== Math.sign(sx)) f.vx = U.approach(f.vx, tgt, st.airAcc * Math.abs(sx) + st.airFric);
        else f.vx = U.approach(f.vx, Math.sign(f.vx) * maxA, st.airFric);
      } else f.vx = U.approach(f.vx, 0, st.airFric);
    }
    const px = f.x, py = f.y;
    f.x += f.vx + f.kbx;
    f.y += f.vy + f.kby;
    decayKB(f);
    if (f.dropT > 0) f.dropT--;
    collideAir(S, f, st, px, py);
  }
  G.physAir = physAir;

  function collideAir(S, f, st, px, py) {
    const m = S.stage.main;
    const h = st.h;
    const down = f.vy + f.kby <= 0;
    // Atterrissage
    if (down) {
      if (py >= m.y - 0.01 && f.y <= m.y && f.x >= m.l && f.x <= m.r) { landOn(S, f, st, -1); return; }
      const P = S.stage.plats;
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        if (f.dropT > 0 && f.dropPlat === i) continue;
        if (py >= p.y - 0.01 && f.y <= p.y && f.x >= p.l && f.x <= p.r) { landOn(S, f, st, i); return; }
      }
    }
    // Murs du bloc principal
    if (f.y < m.y - 0.01 && f.y + h > m.bottom) {
      if (px <= m.l && f.x > m.l) { f.x = m.l; wallHit(S, f, -1); }
      else if (px >= m.r && f.x < m.r) { f.x = m.r; wallHit(S, f, 1); }
      else if (f.x > m.l && f.x < m.r) {
        // coincé dans le bloc : on sort par le côté le plus proche
        if (f.y > m.y - 6 && py >= m.y - 6) { landOn(S, f, st, -1); return; }
        if (f.x - m.l < m.r - f.x) f.x = m.l; else f.x = m.r;
      }
    }
    // Plafond (dessous de la scène)
    if (f.x > m.l && f.x < m.r && py + h <= m.bottom + 0.01 && f.y + h > m.bottom) {
      f.y = m.bottom - h;
      if (f.vy > 0) f.vy = 0;
      if (f.kby > 0) f.kby = (f.action === 'hit' || f.action === 'tumble') ? -f.kby * 0.6 : 0;
    }
  }
  function wallHit(S, f, side) {
    if ((f.action === 'hit' || f.action === 'tumble') && Math.abs(f.kbx) > 1.2) {
      if (f.lastShd <= C.TECH_WIN) { // tech mural
        f.kbx = 0; f.kby = 0; f.vx = 0; f.vy = 0.8; setA(f, 'air'); f.intang = Math.max(f.intang, 20);
        S.events.push({ t: 'tech', s: f.slot, x: f.x, y: f.y, k: 'wt' + f.slot + '_' + S.frame });
        return;
      }
      f.kbx = -f.kbx * 0.6;
      S.events.push({ t: 'bounce', s: f.slot, x: f.x, y: f.y, k: 'wb' + f.slot + '_' + S.frame });
    } else { f.kbx = 0; if (f.vx * side < 0) f.vx = 0; }
  }

  function landOn(S, f, st, platId) {
    const s = surf(S, platId);
    f.y = s.y; f.grounded = true; f.plat = platId;
    const vyIn = f.vy + f.kby;
    f.vy = 0;
    const wasTumble = f.action === 'tumble' || (f.action === 'hit' && f.tumble);
    f.jumps = 0; f.airdodged = false; f.ff = false; f.ledgeRegrab = 0; f.v.helpAfter = 0;
    const a = f.action;
    if (wasTumble) {
      if (f.lastShd <= C.TECH_WIN) {
        f.kbx = 0; f.kby = 0; f.hitstun = 0;
        const d = Math.abs(f.prev[0]) > 40 ? Math.sign(f.prev[0]) : 0;
        if (d) { setA(f, 'troll'); f.mv.d = d; } else setA(f, 'tech');
        S.events.push({ t: 'tech', s: f.slot, x: f.x, y: f.y, k: 'tc' + f.slot + '_' + S.frame });
        return;
      }
      if (vyIn < -2.4 && f.hitstun > 4) { // rebond au sol
        f.grounded = false; f.plat = null; f.y = s.y + 0.1;
        f.kby = -f.kby * 0.75; f.vy = Math.max(1.0, -vyIn * 0.2);
        S.events.push({ t: 'bounce', s: f.slot, x: f.x, y: f.y, k: 'gb' + f.slot + '_' + S.frame });
        return;
      }
      f.kby = 0; f.kbx *= 0.4; f.hitstun = 0; f.tumble = false;
      setA(f, 'down');
      S.events.push({ t: 'thud', s: f.slot, x: f.x, y: f.y, k: 'td' + f.slot + '_' + S.frame });
      return;
    }
    f.kby = 0;
    if (a === 'hit') { return; } // continue le hitstun au sol
    if (a === 'move') {
      const M = G.MV(f, f.move);
      if (M.onLand) { M.onLand(S, f, M); return; }
      if (M.land === 'keep') return;
      if (typeof M.land === 'string' && M.land !== 'lag') { startMove(S, f, M.land); return; }
      let lag;
      if (M.aerial) lag = (M.ac && (f.af < M.ac[0] || f.af >= M.ac[1])) ? st.landLag : M.landLag;
      else lag = M.landLag != null ? M.landLag : (M.helpless ? 20 : 6);
      f.lag = lag; setA(f, 'lag');
      if (M.aerial && lag > st.landLag) S.events.push({ t: 'land', s: f.slot, x: f.x, y: f.y, k: 'll' + f.slot + '_' + S.frame });
      return;
    }
    if (a === 'help') { f.lag = f.v.helpLag || 20; setA(f, 'lag'); return; }
    if (a === 'adodge') { f.lag = f.adDir ? 7 : (f.af > 24 ? 2 : 6); setA(f, 'lag'); f.vx *= f.adDir ? 0.6 : 0; return; }
    if (a === 'sbreak') { setA(f, 'dizzy'); f.v.dizzyT = Math.max(120, 330 - f.percent); f.vx = 0; return; }
    if (a === 'respawn' || a === 'ledge') return;
    f.lag = st.landLag + (vyIn < -2 ? 1 : 0); setA(f, 'land');
    S.events.push({ t: 'land', s: f.slot, x: f.x, y: f.y, k: 'ld' + f.slot + '_' + S.frame, soft: 1 });
  }

  // ---------- Rebords ----------
  function canLedge(f) {
    if (f.ledgeCd > 0 || f.grounded || f.ledgeRegrab >= 6) return false;
    const a = f.action;
    if (a === 'air' || a === 'help' || a === 'tumble') return f.vy + f.kby <= 0.2;
    if (a === 'adodge') return f.af > 6;
    if (a === 'move') {
      const M = G.MV(f, f.move);
      if (!M || !M.ledge) return false;
      return f.af >= (M.ledge === true ? 1 : M.ledge) && (M.ledgeRising || f.vy + f.kby <= 0.5);
    }
    return false;
  }
  function checkLedge(S, f, st) {
    if (!canLedge(f)) return;
    const m = S.stage.main;
    for (const s of [-1, 1]) {
      const lx = s > 0 ? m.r : m.l;
      const dx = (f.x - lx) * s;
      const top = f.y + st.h * 0.8;
      if (dx >= -5 && dx <= 13 && top >= m.y - 11 && top <= m.y + 7) {
        // Trump : on éjecte celui qui tient déjà le rebord
        for (const o of S.fighters) {
          if (o !== f && o.action === 'ledge' && o.ledge === s) {
            setA(o, 'air'); o.grounded = false; o.vx = s * 1.2; o.vy = 1.2; o.ledge = 0; o.ledgeCd = 40; o.intang = 0;
            S.events.push({ t: 'trump', s: o.slot, x: o.x, y: o.y, k: 'tr' + o.slot + '_' + S.frame });
          }
        }
        grabLedge(S, f, st, s);
        return;
      }
    }
  }
  function grabLedge(S, f, st, s) {
    const m = S.stage.main;
    setA(f, 'ledge'); f.v.helpAfter = 0;
    f.ledge = s; f.facing = -s;
    f.x = (s > 0 ? m.r : m.l) + s * (st.w * 0.5 + 0.6);
    f.y = m.y - st.h * 0.92;
    f.vx = 0; f.vy = 0; f.kbx = 0; f.kby = 0; f.ff = false; f.jumps = 1; f.airdodged = false;
    f.intang = Math.max(f.intang, Math.max(0, 34 - f.ledgeRegrab * 14));
    f.ledgeRegrab++;
    f.hitstun = 0; f.tumble = false;
    S.events.push({ t: 'ledge', s: f.slot, x: f.x, y: m.y, k: 'lg' + f.slot + '_' + S.frame });
  }

  // ---------- Mise à jour principale ----------
  G.updateFighter = (S, f, raw) => {
    if (f.out) return;
    if (f.dead) {
      if (f.respT > 0) { f.respT--; if (f.respT === 0 && f.stocks > 0) respawn(S, f); }
      return;
    }
    const st = G.ST(f);
    const inp = readIn(S, f, raw);
    if (f.intang > 0) f.intang--;
    if (f.invinc > 0) f.invinc--;
    if (f.ledgeCd > 0) f.ledgeCd--;
    if (f.flash > 0) f.flash--;
    if (f.lastAttT > 0) f.lastAttT--;
    if (f.v.rooted > 0) f.v.rooted--;
    if (f.v.shackle > 0) f.v.shackle--;
    if (f.v.stun > 0) f.v.stun--;
    if (f.v.stunImm > 0) f.v.stunImm--;
    if (f.v.burn > 0) { f.v.burn--; if (f.v.burn % 30 === 0) { f.percent = Math.min(999, f.percent + 1); f.flash = 3; } }
    if (f.v.poison > 0) { f.v.poison--; if (f.v.poison % 40 === 0) { f.percent = Math.min(999, f.percent + 1); f.flash = 2; } }
    if (f.action !== 'shield' && f.shield < C.SH_MAX) f.shield = Math.min(C.SH_MAX, f.shield + C.SH_REGEN);
    const ch = G.CHARS[f.char];
    if (ch.passive) ch.passive(S, f, inp);
    f.frz = 0;
    if (f.hitlag > 0) {
      f.hitlag--;
      f.frz = 1;
      // SDI : petit décalage pendant le hitlag si on est la cible
      if ((f.action === 'hit' || f.action === 'tumble') && (inp.flickX && f.fxc === 1 || inp.flickY && f.fyc === 1)) {
        f.x += inp.sx * 1.6; if (!f.grounded) f.y += inp.sy * 1.6;
      }
      return;
    }
    f.af++;
    f.mc = (f.mc || 0) + 1;
    step(S, f, st, inp);
    if (!f.grounded && !f.dead && f.action !== 'ledge' && f.action !== 'grabbed' && f.action !== 'thrown' && f.action !== 'respawn') checkLedge(S, f, st);
  };

  function respawn(S, f) {
    const R = S.stage.respawn;
    const n = S.fighters.length;
    const off = (f.slot - (n - 1) / 2) * 22;
    f.dead = false;
    f.x = R[0] + off; f.y = R[1]; f.vx = 0; f.vy = 0; f.kbx = 0; f.kby = 0;
    f.grounded = false; f.plat = null; f.percent = 0; f.hitstun = 0; f.tumble = false;
    f.shield = C.SH_MAX; f.jumps = 0; f.airdodged = false; f.ff = false; f.ledge = 0; f.ledgeRegrab = 0;
    f.invinc = C.RESPAWN_INV; f.grabbing = -1; f.grabbedBy = -1; f.buff = 1; f.v.burn = 0; f.v.poison = 0;
    f.facing = f.x > 0 ? -1 : 1;
    setA(f, 'respawn');
    const ch = G.CHARS[f.char];
    if (ch.onRespawn) ch.onRespawn(S, f);
  }

  function step(S, f, st, inp) {
    const a = f.action;
    switch (a) {
      case 'idle': {
        if (!f.grounded) { setA(f, 'air'); break; }
        if (inp.sx * f.facing < -C.TILT && !f.buf.a && !f.buf.b) { f.facing = -f.facing; f.v.turnF = S.frame; }
        if (groundAct(S, f, inp, 'std')) break;
        if (inp.sy <= C.CROUCH) {
          if (inp.flickY && f.plat >= 0) { dropThrough(S, f); break; }
          setA(f, 'crouch'); break;
        }
        if (inp.flickX && Math.abs(inp.sx) >= C.SMASH) { startDash(S, f, inp.sx > 0 ? 1 : -1, st); break; }
        if (Math.abs(inp.sx) >= C.TILT) { setA(f, 'walk'); }
        f.vx = U.approach(f.vx, 0, st.traction);
        physGround(S, f, st, Math.abs(f.vx) > 0.4);
        break;
      }
      case 'walk': {
        if (groundAct(S, f, inp, 'std')) break;
        if (inp.sy <= C.CROUCH) { if (inp.flickY && f.plat >= 0) { dropThrough(S, f); break; } setA(f, 'crouch'); break; }
        if (inp.flickX && Math.abs(inp.sx) >= C.SMASH) { startDash(S, f, inp.sx > 0 ? 1 : -1, st); break; }
        if (Math.abs(inp.sx) < C.TILT) { setA(f, 'idle'); physGround(S, f, st, true); break; }
        if (inp.sx * f.facing < 0) f.facing = -f.facing;
        f.vx = U.approach(f.vx, inp.sx * st.walk, st.walkAcc);
        physGround(S, f, st, true);
        break;
      }
      case 'dash': {
        if (groundAct(S, f, inp, 'dash')) break;
        if (inp.flickX && inp.sx * f.facing <= -C.SMASH) { startDash(S, f, -f.facing, st); break; }
        if (inp.sy <= C.CROUCH) { setA(f, 'crouch'); break; }
        if (f.af >= st.dashF) {
          if (inp.sx * f.facing >= 0.5) setA(f, 'run'); else setA(f, 'idle');
        }
        if (f.af > 2 && inp.sx * f.facing < 0.2) f.vx = U.approach(f.vx, 0, st.traction * 1.5);
        else f.vx = f.facing * st.dash;
        physGround(S, f, st, true);
        break;
      }
      case 'run': {
        if (groundAct(S, f, inp, 'run')) break;
        if (inp.sy <= C.CROUCH) { setA(f, 'crouch'); break; }
        if (inp.sx * f.facing < -0.3) { setA(f, 'turn'); break; }
        if (Math.abs(inp.sx) < 0.3) { setA(f, 'brake'); break; }
        f.vx = U.approach(f.vx, f.facing * st.run, st.runAcc);
        physGround(S, f, st, true);
        break;
      }
      case 'brake': {
        if (f.af > 2 && groundAct(S, f, inp, 'std')) break;
        if (inp.flickX && Math.abs(inp.sx) >= C.SMASH) { startDash(S, f, inp.sx > 0 ? 1 : -1, st); break; }
        f.vx = U.approach(f.vx, 0, st.traction * (st.surfBrake || 1.6));
        if (f.af >= (st.brakeF || 12) && Math.abs(f.vx) < 0.5) setA(f, 'idle');
        physGround(S, f, st, true);
        break;
      }
      case 'turn': {
        if (f.buf.j) { f.buf.j = 0; setA(f, 'jsq'); f.facing = -f.facing; break; }
        if (f.buf.b) { f.facing = -f.facing; doSpecial(S, f, inp, false); break; }
        if (f.buf.a || f.buf.c || f.buf.g) { if (f.af < 7) f.facing = -f.facing; if (groundAct(S, f, inp, 'std')) break; }
        f.vx = U.approach(f.vx, 0, st.traction * 1.4);
        if (f.af === 7) f.facing = -f.facing;
        if (f.af >= 13) { if (Math.abs(inp.sx) > 0.5 && inp.sx * f.facing > 0) setA(f, 'run'); else setA(f, 'idle'); }
        physGround(S, f, st, true);
        break;
      }
      case 'crouch': {
        if (groundAct(S, f, inp, 'crouch')) break;
        if (inp.flickY && inp.sy <= C.CROUCH && f.plat >= 0 && f.af < 5) { dropThrough(S, f); break; }
        if (inp.sy > -0.5) { setA(f, 'idle'); }
        f.vx = U.approach(f.vx, 0, st.traction * 1.2);
        physGround(S, f, st, false);
        break;
      }
      case 'jsq': {
        if (f.buf.b && inp.sy >= 0.5) { doSpecial(S, f, inp, false); break; }
        if ((f.buf.a && inp.flickY && inp.sy > 0.6 && !inp.digital) || (f.buf.c && f.cdir[1] > 0 && !f.ctilt)) { doSmash(S, f, 0, 1); break; }
        if (f.af >= C.JSQ) {
          const full = f.jsqSrc === 2 ? inp.sy >= 0.4 : inp.held(B.JMP);
          const h = full ? st.fullHop : st.shortHop;
          const maxJ = st.air * st.jumpMom;
          f.vx = U.clamp(f.vx * 0.9 + inp.sx * 0.45, -maxJ, maxJ);
          f.vy = jumpV(st, h);
          f.grounded = false; f.plat = null; f.jumps = 1; f.ff = false;
          setA(f, 'air'); f.v.jumpF = S.frame; f.v.short = !full;
          S.events.push({ t: 'jump', s: f.slot, x: f.x, y: f.y, k: 'j' + f.slot + '_' + S.frame });
          physAir(S, f, st, { sx: 0, drift: 0 });
          break;
        }
        f.vx = U.approach(f.vx, 0, st.traction * 0.5);
        physGround(S, f, st, false);
        break;
      }
      case 'air': {
        if (airAct(S, f, inp, st)) break;
        fastFall(f, inp);
        physAir(S, f, st, { sx: inp.sx });
        break;
      }
      case 'land': {
        f.vx = U.approach(f.vx, 0, st.traction * 2);
        if (f.af >= f.lag) setA(f, 'idle');
        physGround(S, f, st, false);
        break;
      }
      case 'lag': {
        f.vx = U.approach(f.vx, 0, st.traction);
        if (f.af >= f.lag) { setA(f, inp.sy <= C.CROUCH ? 'crouch' : 'idle'); }
        physGround(S, f, st, false);
        break;
      }
      case 'shield': {
        f.shield -= C.SH_DECAY;
        if (f.shield <= 0) { shieldBreak(S, f); break; }
        f.vx = U.approach(f.vx, 0, st.traction);
        physGround(S, f, st, false);
        if (!f.grounded) { setA(f, 'air'); break; }
        if (f.shieldStun > 0) { f.shieldStun--; break; }
        if (f.buf.j) { f.buf.j = 0; setA(f, 'jsq'); break; }
        if (f.buf.b && inp.sy >= 0.5) { doSpecial(S, f, inp, false); break; }
        if ((f.buf.c && f.cdir[1] > 0) || (f.buf.a && inp.flickY && inp.sy > 0.6 && !inp.digital)) { doSmash(S, f, 0, 1); break; }
        if (f.buf.a || f.buf.g) { f.buf.a = 0; f.buf.g = 0; startMove(S, f, 'grab'); break; }
        if (inp.flickY && inp.sy <= -0.6) {
          if (f.plat >= 0 && inp.sy <= -0.85 && false) { dropThrough(S, f); break; }
          setA(f, 'spot'); break;
        }
        if (inp.flickX && Math.abs(inp.sx) >= 0.6) { setA(f, 'roll'); f.mv = { d: inp.sx > 0 ? 1 : -1 }; break; }
        if (!inp.held(B.SHD) && f.af > 3) { setA(f, 'shieldOff'); }
        break;
      }
      case 'shieldOff': {
        f.vx = U.approach(f.vx, 0, st.traction);
        physGround(S, f, st, false);
        if (f.af >= C.SH_DROP) setA(f, 'idle');
        else if (f.af > 3 && f.buf.j) { f.buf.j = 0; setA(f, 'jsq'); }
        break;
      }
      case 'spot': {
        if (f.af === 3) f.intang = Math.max(f.intang, 13);
        f.vx = U.approach(f.vx, 0, st.traction * 2);
        physGround(S, f, st, false);
        if (f.af >= 21) setA(f, 'idle');
        break;
      }
      case 'roll': {
        const d = f.mv.d;
        if (f.af === 4) f.intang = Math.max(f.intang, 12);
        f.vx = f.af < 4 ? d * 0.5 : f.af < 20 ? d * (st.rollSpd || 1.85) : U.approach(f.vx, 0, 0.3);
        physGround(S, f, st, false);
        if (f.af === 16) f.facing = -d;
        if (f.af >= 26) { setA(f, 'idle'); f.facing = -d; }
        break;
      }
      case 'adodge': {
        if (f.af === 3) f.intang = Math.max(f.intang, f.adDir ? 15 : 24);
        if (f.adDir) {
          if (f.af > 4) { f.vx *= 0.86; f.vy *= 0.86; }
          physAir(S, f, st, { noGrav: f.af < 22, drift: 0 });
        } else physAir(S, f, st, { sx: inp.sx, grav: f.af < 20 ? 0.2 : 1, drift: 0.5 });
        if (f.action !== 'adodge') break;
        if (f.af >= (f.adDir ? 36 : 32)) setA(f, 'air');
        break;
      }
      case 'help': {
        fastFall(f, { flickY: false, sy: 0 });
        physAir(S, f, st, { sx: inp.sx, drift: 0.65 });
        break;
      }
      case 'hit': {
        if (f.hitstun > 0) f.hitstun--;
        if (f.grounded) {
          f.vx = U.approach(f.vx, 0, st.traction);
          physGround(S, f, st, true);
          if (f.grounded && f.hitstun <= 0) setA(f, 'idle');
        } else {
          physAir(S, f, st, { drift: 0 });
          if (f.action === 'hit' && f.hitstun <= 0 && !f.grounded) { if (f.tumble) setA(f, 'tumble'); else setA(f, 'air'); }
        }
        break;
      }
      case 'tumble': {
        if (airAct(S, f, inp, st)) { f.tumble = false; break; }
        fastFall(f, inp);
        physAir(S, f, st, { sx: inp.sx });
        break;
      }
      case 'down': {
        f.vx = U.approach(f.vx, 0, st.traction * 2);
        physGround(S, f, st, false);
        if (f.af > 22) {
          if (f.buf.a) { f.buf.a = 0; startMove(S, f, 'getupAtk'); break; }
          if (Math.abs(inp.sx) > 0.5) { setA(f, 'groll'); f.mv = { d: inp.sx > 0 ? 1 : -1 }; break; }
          if (inp.sy > 0.5 || f.buf.j || f.buf.s || f.af > 110) { f.buf.j = 0; f.buf.s = 0; setA(f, 'getup'); break; }
        }
        break;
      }
      case 'getup': case 'tech': {
        if (f.af === 1) f.intang = Math.max(f.intang, a === 'tech' ? 20 : 22);
        f.vx = U.approach(f.vx, 0, st.traction * 2);
        physGround(S, f, st, false);
        if (f.af >= (a === 'tech' ? 26 : 30)) setA(f, 'idle');
        break;
      }
      case 'groll': case 'troll': {
        const d = f.mv.d;
        if (f.af === 1) f.intang = Math.max(f.intang, a === 'troll' ? 20 : 24);
        f.vx = f.af < 22 ? d * 1.6 : U.approach(f.vx, 0, 0.3);
        physGround(S, f, st, false);
        if (f.af >= (a === 'troll' ? 38 : 34)) { setA(f, 'idle'); }
        break;
      }
      case 'sbreak': {
        physAir(S, f, st, { drift: 0 });
        break;
      }
      case 'dizzy': {
        if (inp.anyPress) f.v.dizzyT -= 4;
        f.v.dizzyT--;
        f.vx = U.approach(f.vx, 0, st.traction);
        physGround(S, f, st, false);
        if (f.v.dizzyT <= 0) setA(f, 'idle');
        break;
      }
      case 'grabbed': {
        if (inp.anyPress) f.grabT -= 5;
        f.grabT--;
        const g = S.fighters[f.grabbedBy];
        if (!g || g.grabbing !== f.slot || g.dead) { releaseGrab(S, f, null); break; }
        if (f.grabT <= 0 && !(g.action === 'move' && G.MV(g, g.move).throw)) releaseGrab(S, f, g);
        break;
      }
      case 'thrown': break; // positionné par le lanceur
      case 'hold': {
        const v = S.fighters[f.grabbing];
        if (!v || v.grabbedBy !== f.slot) { f.grabbing = -1; setA(f, 'idle'); break; }
        f.vx = 0;
        if (f.af > 4) {
          let dx = 0, dy = 0;
          if (f.buf.c) { dx = f.cdir[0]; dy = f.cdir[1]; f.buf.c = 0; }
          else if (Math.abs(inp.sx) >= 0.6 || Math.abs(inp.sy) >= 0.6) {
            if (Math.abs(inp.sy) > Math.abs(inp.sx)) dy = inp.sy > 0 ? 1 : -1; else dx = inp.sx > 0 ? 1 : -1;
          }
          if (dx || dy) {
            const name = dy > 0 ? 'uthrow' : dy < 0 ? 'dthrow' : dx === f.facing ? 'fthrow' : 'bthrow';
            startMove(S, f, name); v.action = 'thrown'; v.af = 0;
            break;
          }
          if (f.buf.a) { f.buf.a = 0; startMove(S, f, 'pummel'); break; }
        }
        physGround(S, f, st, false);
        break;
      }
      case 'grel': {
        f.vx = U.approach(f.vx, 0, 0.06);
        if (f.grounded) physGround(S, f, st, true); else physAir(S, f, st, { drift: 0.4, sx: inp.sx });
        if (f.af >= 24 && f.action === 'grel') setA(f, f.grounded ? 'idle' : 'air');
        break;
      }
      case 'ledge': {
        const s = f.ledge;
        if (f.af >= C.LEDGE_MAX) { ledgeDrop(S, f); break; }
        if (f.af < 8) break;
        if (f.buf.j || (inp.tap && inp.flickY && inp.sy > 0.5 && false)) { f.buf.j = 0; ledgeJump(S, f, st); break; }
        if (f.buf.a || f.buf.c) { f.buf.a = 0; f.buf.c = 0; setA(f, 'lattack'); f.mv = { s }; break; }
        if (f.buf.s) { f.buf.s = 0; setA(f, 'lroll'); f.mv = { s }; break; }
        if (inp.sy >= 0.5 || inp.sx * s <= -0.5) { setA(f, 'lgetup'); f.mv = { s }; break; }
        if (inp.sy <= -0.5 || inp.sx * s >= 0.5) { ledgeDrop(S, f); break; }
        if (f.buf.b) { ledgeDrop(S, f); doSpecial(S, f, inp, true); break; }
        break;
      }
      case 'lgetup': case 'lroll': case 'lattack': {
        ledgeAction(S, f, st, a);
        break;
      }
      case 'respawn': {
        if (f.af > 20 && (inp.anyPress || Math.abs(inp.sx) > 0.4 || Math.abs(inp.sy) > 0.4) || f.af >= C.RESPAWN_MAX) {
          setA(f, 'air'); f.jumps = 0; f.invinc = Math.max(f.invinc, 60);
          if (f.buf.j && f.jumps < st.jumps) { f.buf.j = 0; doubleJump(S, f, inp, st); f.jumps = 1; }
        }
        break;
      }
      case 'move': {
        runMove(S, f, st, inp);
        break;
      }
      default:
        setA(f, f.grounded ? 'idle' : 'air');
    }
  }

  function startDash(S, f, d, st) {
    f.facing = d; setA(f, 'dash'); f.vx = d * st.dash;
    S.events.push({ t: 'dash', s: f.slot, x: f.x, y: f.y, d, k: 'd' + f.slot + '_' + S.frame });
  }
  function dropThrough(S, f) {
    f.dropPlat = f.plat; f.dropT = 12; f.grounded = false; f.plat = null; f.y -= 0.5; f.vy = -0.8;
    if (f.jumps < 1) f.jumps = 1;
    setA(f, 'air');
  }
  function shieldBreak(S, f) {
    f.shield = C.SH_MAX * 0.4; f.grounded = false; f.plat = null; f.vy = 3.2; f.vx = 0;
    setA(f, 'sbreak');
    S.events.push({ t: 'sbreak', s: f.slot, x: f.x, y: f.y, k: 'sb' + f.slot + '_' + S.frame });
  }
  G.shieldBreak = shieldBreak;

  function releaseGrab(S, v, g) {
    v.grabbedBy = -1;
    setA(v, 'grel'); v.vx = (g ? Math.sign(v.x - g.x) || -g.facing : -v.facing) * 1.3;
    if (!v.grounded) v.vy = 1.2;
    if (g) { g.grabbing = -1; setA(g, 'grel'); g.vx = -Math.sign(v.x - g.x || g.facing) * 0.9; }
  }
  G.releaseGrab = releaseGrab;

  function ledgeDrop(S, f) {
    setA(f, 'air'); f.ledge = 0; f.ledgeCd = 24; f.jumps = 1; f.vy = -0.2; f.x += f.facing * -1;
  }
  function ledgeJump(S, f, st) {
    const s = f.ledge;
    f.ledge = 0; f.ledgeCd = 20;
    f.y = S.stage.main.y - st.h * 0.2; f.x -= s * 2;
    f.vy = jumpV(st, st.fullHop * 1.05); f.vx = -s * 0.7;
    f.jumps = 1; f.intang = Math.max(f.intang, 3);
    setA(f, 'air'); f.v.jumpF = S.frame;
    S.events.push({ t: 'jump', s: f.slot, x: f.x, y: f.y, k: 'lj' + f.slot + '_' + S.frame });
  }
  function ledgeAction(S, f, st, a) {
    const m = S.stage.main, s = f.mv.s;
    const lx = s > 0 ? m.r : m.l;
    const T = a === 'lgetup' ? 32 : a === 'lroll' ? 48 : 52;
    const climb = a === 'lgetup' ? 18 : a === 'lroll' ? 16 : 20;
    if (f.af === 1) f.intang = Math.max(f.intang, a === 'lgetup' ? 30 : a === 'lroll' ? 34 : 24);
    const hang = { x: lx + s * (st.w * 0.5 + 0.6), y: m.y - st.h * 0.92 };
    const endX = lx - s * (a === 'lgetup' ? st.w * 0.6 + 2 : a === 'lroll' ? 40 : 14);
    if (f.af <= climb) {
      const t = U.smooth(f.af / climb);
      f.x = U.lerp(hang.x, lx - s * (st.w * 0.6 + 1), t);
      f.y = U.lerp(hang.y, m.y, Math.min(1, t * 1.4));
    } else {
      const t = U.smooth(Math.min(1, (f.af - climb) / (T - climb - 4)));
      f.x = U.lerp(lx - s * (st.w * 0.6 + 1), endX, t);
      f.y = m.y;
    }
    f.grounded = f.af > climb * 0.7; f.plat = -1;
    if (a === 'lattack' && f.af >= 24 && f.af <= 27) {
      G.pendingHitbox(S, f, { x: 9, y: 5, r: 8, dmg: 9, ang: 45, bkb: 50, kbg: 20, t: 'normal' }, 'lattack');
    }
    if (f.af >= T) { f.ledge = 0; f.facing = -s; setA(f, 'idle'); f.grounded = true; f.plat = -1; f.y = m.y; }
  }

  // ---------- Exécution d'un coup ----------
  function runMove(S, f, st, inp) {
    const M = G.MV(f, f.move);
    if (!M) { setA(f, f.grounded ? 'idle' : 'air'); return; }
    // Charge des smashs
    if (M.charge && f.af === M.charge && f.charge < 60) {
      const holding = inp.held(B.ATK) || inp.cHeld || (M.chargeBtn === 'spc' && inp.held(B.SPC));
      if (holding) { f.charge++; f.af--; }
    }
    if (M.intang && f.af === M.intang[0]) f.intang = Math.max(f.intang, M.intang[1] - M.intang[0] + 1);
    // B-reverse : B puis stick dans l'autre sens dans les 5 premières frames = le spécial se retourne (+ petit élan)
    if (f.af <= 5 && !f.mv.brev && !M.noReverse && /^[nsud]spec(A)?$/.test(f.move) && inp.sx * f.facing <= -0.55) {
      f.facing = -f.facing; f.mv.brev = 1;
      f.vx = f.grounded ? f.facing * 0.3 : f.vx * 0.3 + f.facing * 0.7;
    }
    if (M.tick) {
      const r = M.tick(S, f, f.af, inp, M);
      if (f.action !== 'move' || r === 'stop') return;
    }
    // récupérations un peu moins hautes (plus d'edge guard)
    if (/^uspec(A)?$/.test(f.move) && !f.grounded && f.vy > 0) f.vy *= G.FEEL.recovery;
    // Enchaînements (jab 1-2-3)
    if (M.next && f.buf.a && f.af >= M.next[1] && f.af <= M.next[2]) { f.buf.a = 0; startMove(S, f, M.next[0]); return; }
    if (M.nextB && f.buf.b && f.af >= M.nextB[1] && f.af <= M.nextB[2]) { f.buf.b = 0; startMove(S, f, M.nextB[0]); return; }
    // Annulation sur coup réussi (combos)
    if (M.hitCancel && f.mv.hit && f.af >= M.hitCancel && f.hitlag <= 0 && !(f.v.helpAfter && !f.grounded)) {
      if (f.grounded) { if (groundAct(S, f, inp, 'std')) return; }
      else if (airAct(S, f, inp, st)) return;
    }
    // IASA
    if (M.iasa && f.af >= M.iasa && !(f.v.helpAfter && !f.grounded)) {
      if (f.grounded) { if (groundAct(S, f, inp, 'std')) return; }
      else if (airAct(S, f, inp, st)) return;
    }
    if (M.aerial) fastFall(f, inp);
    if (f.af >= M.len) {
      if (M.end) { M.end(S, f, M); if (f.action !== 'move') return; }
      if (f.grounded) setA(f, inp.sy <= C.CROUCH ? 'crouch' : 'idle');
      else if (M.helpless || f.v.helpAfter) { setA(f, 'help'); f.v.helpLag = M.landLag || 20; f.v.helpAfter = 0; }
      else setA(f, 'air');
      return;
    }
    if (M.phys === 'none') return;
    if (!f.grounded) {
      if (M.boost && f.af === M.boost[0]) { f.vy = Math.max(f.vy, M.boost[1]); f.ff = false; }
      if (M.float && f.af >= M.float[0] && f.af <= M.float[1]) { f.vy = Math.max(f.vy, M.float[2]); f.ff = false; }
    }
    if (f.grounded) {
      if (!M.keepVel) f.vx = U.approach(f.vx, 0, st.traction * (M.traction || 1));
      physGround(S, f, st, !!M.offEdge);
      if (!f.grounded && M.offEdge) { /* reste dans le coup en l'air */ }
    } else {
      physAir(S, f, st, { sx: M.drift === 0 ? 0 : inp.sx, drift: M.drift == null ? 1 : M.drift, grav: M.grav, noGrav: M.noGrav && M.noGrav(f.af), ff: M.aerial ? undefined : false, fallMul: M.fallMul });
    }
  }

  G.readIn = readIn;
  G.airAct = airAct;
})(window.G);
