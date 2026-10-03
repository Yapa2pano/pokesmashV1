'use strict';
// Entrées : manettes (Gamepad API, manette Pro Switch en Bluetooth incluse) + clavier.
// Chaque frame, un périphérique produit une entrée compacte [sx, sy, cx, cy, boutons]
// qui est tout ce que la simulation voit (et tout ce qui transite en ligne).
(function (G) {
  const U = G.U;
  const B = G.BTN = { ATK: 1, SPC: 2, JMP: 4, SHD: 8, GRB: 16, TAUNT: 32, DIGITAL: 64, TAPJUMP: 128, CTILT: 256 };
  const SM = 80; // amplitude max d'un stick (entier)
  G.NEUTRAL = [0, 0, 0, 0, 0];

  const Input = G.Input = {
    devices: {},   // id -> device
    keys: {},      // event.code -> true
    keysPrev: {},
    opts: { tapJump: true, rumble: true, rstick: 'tilt', pad: null },
    lastUsed: null,
    idx2dev: {}, // numéro de manette du navigateur -> appareil
    seq: 0,
  };

  // Boutons de manette -> actions (par étiquette imprimée sur la manette). Réglable dans Options.
  Input.PAD_DEFAULT = { A: 'atk', B: 'spc', X: 'jmp', Y: 'jmp', L: 'grb', R: 'jmp', ZL: 'grb', ZR: 'shd' };
  Input.PAD_ULTIMATE = { A: 'atk', B: 'spc', X: 'jmp', Y: 'jmp', L: 'grb', R: 'grb', ZL: 'shd', ZR: 'shd' };
  Input.ACTIONS = { atk: 'Attaque', spc: 'Spécial', jmp: 'Saut', shd: 'Bouclier', grb: 'Saisie', taunt: 'Provocation', none: 'Rien' };
  const ACT_BIT = { atk: B.ATK, spc: B.SPC, jmp: B.JMP, shd: B.SHD, grb: B.GRB, taunt: B.TAUNT, none: 0 };
  try { Object.assign(Input.opts, JSON.parse(localStorage.getItem('pks-input') || '{}')); } catch (e) {}
  if (!Input.opts.pad) Input.opts.pad = Object.assign({}, Input.PAD_DEFAULT);
  Input.saveOpts = () => { try { localStorage.setItem('pks-input', JSON.stringify(Input.opts)); } catch (e) {} };

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    Input.keys[e.code] = true;
    Input.latch[e.code] = true; // une frappe très brève compte quand même pour une frame
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
  window.addEventListener('blur', () => { Input.keys = {}; Input.latch = {}; });
  Input.latch = {};

  function isNintendo(id) { return /nintendo|pro controller|057e|joy-con|switch/i.test(id); }

  function makeDevice(id, type, name) {
    return {
      id, type, name,
      raw: [0, 0, 0, 0, 0], prevRaw: [0, 0, 0, 0, 0],
      menu: {}, rep: {}, held: {}, prevHeld: {},
      connected: true,
    };
  }
  Input.devices.kb = makeDevice('kb', 'kb', 'Clavier');

  function radial(x, y, dead) {
    const m = Math.sqrt(x * x + y * y);
    if (m < dead) return [0, 0];
    const k = Math.min(1, (m - dead) / (0.88 - dead)) / m;
    return [x * k, y * k];
  }

  // Croix directionnelle lue sur un « chapeau » (hat switch) : quand le navigateur ne reconnaît pas la manette en
  // disposition standard (manette Pro en mode simplifié, souvent à cause de Steam), la croix arrive sur un axe
  // qui vaut ~1,29 au repos et -1 (haut) à 1 (haut-gauche) par pas de 2/7 dans le sens des aiguilles d'une montre.
  function hatAxis(gp) {
    for (let i = gp.axes.length - 1; i >= 0; i--) { const v = gp.axes[i]; if (v > 1.1 && v < 1.5) return i; }
    return gp.axes.length > 9 ? 9 : -1;
  }
  function readHat(v) {
    if (v == null || v > 1.1 || v < -1.1) return [false, false, false, false];
    const k = Math.round((v + 1) / (2 / 7)) % 8; // 0 haut, 1 haut-droite, 2 droite, ... 7 haut-gauche
    return [k === 7 || k === 0 || k === 1, k >= 3 && k <= 5, k >= 5 && k <= 7, k >= 1 && k <= 3]; // haut, bas, gauche, droite
  }

  function readGamepad(gp, dev) {
    const nin = isNintendo(gp.id), std = gp.mapping === 'standard';
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    // Disposition positionnelle standard : 0=bas 1=droite 2=gauche 3=haut
    // Nintendo (manette Pro) : A=droite, B=bas, X=haut, Y=gauche
    // (en mode simplifié, la manette Pro envoie B, A, Y, X, L, R, ZL, ZR, -, + : même ordre pour ces boutons)
    const btnA = nin ? b(1) : b(0);
    const btnB = nin ? b(0) : b(1);
    const btnX = b(3), btnY = b(2);
    const L = b(4), R = b(5), ZL = b(6), ZR = b(7);
    const minus = b(8), plus = b(9);
    let du = b(12), dd = b(13), dl = b(14), dr = b(15);
    if (!std) { // croix sur un chapeau
      if (dev.hat == null || (dev.hat >= 0 && dev.hat >= gp.axes.length)) dev.hat = hatAxis(gp);
      if (dev.hat >= 0) { const [hu, hd, hl, hr] = readHat(gp.axes[dev.hat]); du = du || hu; dd = dd || hd; dl = dl || hl; dr = dr || hr; }
    }
    const ax = (i) => (i === dev.hat ? 0 : gp.axes[i] || 0);
    let [lx, ly] = radial(ax(0), ax(1), 0.2);
    let [rx, ry] = radial(ax(2), ax(3), 0.3);
    const sx = Math.round(U.clamp(lx, -1, 1) * SM), sy = Math.round(U.clamp(-ly, -1, 1) * SM);
    let cx = 0, cy = 0;
    if (Math.abs(rx) > 0.5 || Math.abs(ry) > 0.5) {
      if (Math.abs(rx) >= Math.abs(ry)) cx = rx > 0 ? 1 : -1; else cy = ry > 0 ? -1 : 1;
    }
    let bt = 0;
    const phys = { A: btnA, B: btnB, X: btnX, Y: btnY, L, R, ZL, ZR };
    const pad = Input.opts.pad || Input.PAD_DEFAULT;
    for (const lab in phys) if (phys[lab]) bt |= ACT_BIT[pad[lab]] || 0;
    if (du || dd || dl || dr) bt |= B.TAUNT;
    if (Input.opts.tapJump) bt |= B.TAPJUMP;
    if (Input.opts.rstick === 'tilt') bt |= B.CTILT; // stick droit = attaque dirigée (direction + A)
    dev.phys = phys;
    dev.raw = [sx, sy, cx, cy, bt];
    dev.held = {
      up: ly < -0.6 || du, down: ly > 0.6 || dd, left: lx < -0.6 || dl, right: lx > 0.6 || dr,
      ok: btnA, back: btnB, start: plus, select: minus, alt: btnX || btnY, l: L || ZL, r: R || ZR,
      rup: ry < -0.6, rdown: ry > 0.6,
    };
    dev.nintendo = nin;
    dev.std = std;
    // diagnostic (écran Options > Boutons de la manette)
    dev.diag = { id: gp.id, mapping: gp.mapping || 'non standard', nb: gp.buttons.length, na: gp.axes.length,
      pressed: gp.buttons.map((x, i) => (x && (x.pressed || x.value > 0.5) ? i : -1)).filter((i) => i >= 0),
      axes: gp.axes.map((v) => Math.round(v * 100) / 100), hat: dev.hat };
  }

  const K = (c) => !!(Input.keys[c] || Input.latch[c]);
  function readKeyboard(dev) {
    const left = K('KeyA') || K('ArrowLeft'), right = K('KeyD') || K('ArrowRight');
    const up = K('KeyW') || K('ArrowUp'), down = K('KeyS') || K('ArrowDown');
    const walk = K('ShiftLeft') || K('ShiftRight');
    const mag = walk ? 36 : SM;
    let sx = (right ? 1 : 0) - (left ? 1 : 0), sy = (up ? 1 : 0) - (down ? 1 : 0);
    if (sx && sy) { sx *= 0.72; sy *= 0.72; }
    let cx = 0, cy = 0;
    if (K('KeyO')) { // touche Smash = stick C dans la direction tenue
      if (sy > 0) cy = 1; else if (sy < 0) cy = -1; else if (sx) cx = sx > 0 ? 1 : -1; else cx = 0, cy = 0;
      if (!cx && !cy) cx = 2; // 2 = « devant » (résolu par la sim selon l'orientation)
    }
    let bt = B.DIGITAL;
    if (K('KeyJ')) bt |= B.ATK;
    if (K('KeyK')) bt |= B.SPC;
    if (K('Space') || K('KeyI')) bt |= B.JMP;
    if (K('KeyL') || K('Semicolon')) bt |= B.SHD;
    if (K('KeyU') || K('KeyH')) bt |= B.GRB;
    if (K('KeyT')) bt |= B.TAUNT;
    dev.raw = [Math.round(sx * mag), Math.round(sy * mag), cx, cy, bt];
    dev.held = {
      up, down, left, right,
      ok: K('Enter') || K('KeyJ'), back: K('Escape') || K('Backspace') || K('KeyK'), start: K('Enter'),
      pause: K('Escape') || K('KeyP'), alt: K('KeyI') || K('Space'), select: K('Tab'), l: false, r: false,
    };
  }

  const MENU_KEYS = ['up', 'down', 'left', 'right', 'ok', 'back', 'start', 'alt', 'select', 'l', 'r', 'pause', 'rup', 'rdown'];
  const REPEAT = { up: 1, down: 1, left: 1, right: 1 };

  Input.poll = function () {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const seen = {};
    const i2d = Input.idx2dev;
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      // Identité stable : une manette qui se reconnecte (veille, coupure Bluetooth) revient souvent sous un autre
      // numéro. On la rattache à son ancien appareil, pour que le joueur qui l'utilisait la retrouve.
      let id = i2d[gp.index];
      if (id && Input.devices[id] && Input.devices[id].gpId !== gp.id) id = null; // une autre manette a pris ce numéro
      if (!id) {
        const taken = new Set(Object.values(i2d));
        const back = Object.values(Input.devices).find((d) => d.type === 'gp' && !d.connected && d.gpId === gp.id && !taken.has(d.id));
        id = back ? back.id : 'gp' + gp.index;
        if (!back && Input.devices[id] && Input.devices[id].gpId !== gp.id) id = 'gp' + gp.index + '_' + (++Input.seq);
        i2d[gp.index] = id;
        if (back && G.UI && G.UI.toast) G.UI.toast(back.name + ' reconnectée', 1500);
      }
      seen[id] = true;
      let dev = Input.devices[id];
      if (!dev) {
        dev = Input.devices[id] = makeDevice(id, 'gp', prettyName(gp.id));
        dev.gpId = gp.id;
      }
      if (!dev.connected) { dev.connected = true; dev.hat = null; dev.warned = false; }
      dev.index = gp.index;
      dev.gp = gp;
      dev.prevRaw = dev.raw;
      readGamepad(gp, dev);
      // manette Pro pas reconnue en disposition standard : prévenir une fois (Steam ouvert règle souvent le problème)
      if (dev.nintendo && !dev.std && !dev.warned) {
        dev.warned = true;
        if (G.UI && G.UI.toast) G.UI.toast('Manette Pro mal reconnue (LED qui clignote, stick muet) : ouvre Steam (ou ferme-le s’il est déjà ouvert), puis éteins et rallume la manette.', 9000);
      }
    }
    for (const idx in i2d) if (!seen[i2d[idx]]) delete i2d[idx];
    for (const id in Input.devices) {
      const d = Input.devices[id];
      if (d.type === 'gp' && !seen[id] && d.connected) { d.connected = false; d.raw = [0, 0, 0, 0, 0]; d.held = {}; d.phys = null; }
    }
    const kb = Input.devices.kb;
    kb.prevRaw = kb.raw;
    readKeyboard(kb);
    Input.latch = {};
    // Fronts montants pour les menus (avec répétition sur les directions)
    for (const id in Input.devices) {
      const d = Input.devices[id];
      const m = {};
      for (const k of MENU_KEYS) {
        const h = !!d.held[k], ph = !!d.prevHeld[k];
        m[k] = h && !ph;
        if (REPEAT[k]) {
          if (h) { d.rep[k] = (d.rep[k] || 0) + 1; if (d.rep[k] > 22 && d.rep[k] % 6 === 0) m[k] = true; }
          else d.rep[k] = 0;
        }
      }
      d.menu = m;
      if (Object.values(m).some(Boolean)) Input.lastUsed = id;
      d.prevHeld = Object.assign({}, d.held);
    }
  };

  function prettyName(id) {
    if (/pro controller/i.test(id)) return 'Manette Pro';
    if (/joy-con/i.test(id)) return 'Joy-Con';
    if (/xbox|xinput/i.test(id)) return 'Manette Xbox';
    if (/dualsense|dualshock|054c/i.test(id)) return 'Manette PlayStation';
    const s = id.replace(/\(.*?\)/g, '').trim();
    return s.length > 22 ? s.slice(0, 22) + '…' : (s || 'Manette');
  }

  Input.frame = (devId) => {
    const d = Input.devices[devId];
    return d && d.connected !== false ? d.raw.slice() : G.NEUTRAL.slice();
  };
  Input.connected = () => Object.values(Input.devices).filter(d => d.connected !== false);

  Input.rumble = (devId, strength, ms) => {
    if (!Input.opts.rumble) return;
    const d = Input.devices[devId];
    if (!d || d.type !== 'gp' || !d.gp) return;
    const act = d.gp.vibrationActuator;
    if (act && act.playEffect) {
      try { act.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strength), weakMagnitude: Math.min(1, strength * 0.7) }); } catch (e) {}
    }
  };

  // Décodage d'une entrée compacte (utilisé par la sim)
  G.decode = (raw) => ({ sx: raw[0] / SM, sy: raw[1] / SM, cx: raw[2], cy: raw[3], b: raw[4] });
})(window.G);
