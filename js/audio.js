'use strict';
// Sons synthétisés (WebAudio) + musique procédurale par stage + annonceur (synthèse vocale).
(function (G) {
  const A = G.Audio = { ctx: null, vol: { sfx: 0.7, music: 0.45, voice: true } };
  try { Object.assign(A.vol, JSON.parse(localStorage.getItem('pks-audio') || '{}')); } catch (e) {}
  A.save = () => { try { localStorage.setItem('pks-audio', JSON.stringify(A.vol)); } catch (e) {} ; if (A.sfxG) { A.sfxG.gain.value = A.vol.sfx; A.musG.gain.value = A.vol.music * 0.5; } };

  A.init = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      const C = A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.master = C.createGain(); A.master.gain.value = 0.9;
      const comp = C.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      A.master.connect(comp); comp.connect(C.destination);
      A.sfxG = C.createGain(); A.sfxG.gain.value = A.vol.sfx; A.sfxG.connect(A.master);
      A.musG = C.createGain(); A.musG.gain.value = A.vol.music * 0.5; A.musG.connect(A.master);
      const len = C.sampleRate;
      A.noiseBuf = C.createBuffer(1, len, C.sampleRate);
      const d = A.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { A.ctx = null; }
  };

  function tone(f0, dur, type, vol, f1, delay, out) {
    const C = A.ctx; if (!C) return;
    const t = C.currentTime + (delay || 0);
    const o = C.createOscillator(), g = C.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || A.sfxG); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq, ftype, f1, delay, out, q) {
    const C = A.ctx; if (!C) return;
    const t = C.currentTime + (delay || 0);
    const s = C.createBufferSource(); s.buffer = A.noiseBuf;
    const fl = C.createBiquadFilter(); fl.type = ftype || 'lowpass'; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q || 0.8;
    if (f1) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = C.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(out || A.sfxG);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  A.tone = tone; A.noise = noise;

  const SFX = {
    jump: () => { tone(280, 0.12, 'triangle', 0.18, 620); noise(0.08, 0.08, 3000, 'highpass'); },
    djump: () => { tone(420, 0.14, 'triangle', 0.16, 900); noise(0.1, 0.06, 4000, 'highpass'); },
    land: () => { noise(0.1, 0.22, 600, 'lowpass', 150); },
    step: () => { noise(0.05, 0.1, 900, 'lowpass', 300); },
    dash: () => { noise(0.12, 0.12, 1800, 'bandpass', 600); },
    shield: () => { tone(900, 0.08, 'sine', 0.15, 500); noise(0.06, 0.1, 5000, 'highpass'); },
    parry: () => { tone(1500, 0.25, 'sine', 0.25, 3000); tone(2250, 0.25, 'sine', 0.12, 4500); },
    counter: () => { tone(700, 0.2, 'square', 0.12, 1400); tone(1050, 0.2, 'sine', 0.15, 2100, 0.05); },
    ko: () => { noise(1.2, 0.6, 3000, 'lowpass', 60); tone(120, 0.8, 'sawtooth', 0.35, 30); tone(880, 0.5, 'square', 0.1, 220, 0.05); },
    tech: () => { tone(1200, 0.1, 'sine', 0.15, 1800); },
    thud: () => { noise(0.18, 0.3, 500, 'lowpass', 80); tone(90, 0.15, 'sine', 0.3, 40); },
    ledge: () => { noise(0.05, 0.12, 2500, 'bandpass'); },
    grab: () => { noise(0.08, 0.2, 1200, 'bandpass'); tone(200, 0.08, 'square', 0.08, 120); },
    sbreak: () => { tone(1600, 0.6, 'sine', 0.25, 200); noise(0.5, 0.3, 6000, 'highpass', 1000); },
    clank: () => { tone(2400, 0.15, 'square', 0.1, 1800); tone(3100, 0.12, 'sine', 0.1); },
    count: () => { tone(660, 0.2, 'square', 0.12); },
    go: () => { tone(880, 0.35, 'square', 0.14); tone(1320, 0.35, 'square', 0.08); },
    game: () => { noise(0.6, 0.3, 2000, 'lowpass', 200); tone(440, 0.6, 'sawtooth', 0.12, 220); },
    tick: () => { tone(1000, 0.05, 'square', 0.08); },
    menu: () => { tone(900, 0.05, 'square', 0.07, 1100); },
    select: () => { tone(700, 0.08, 'square', 0.09, 1400); tone(1400, 0.1, 'sine', 0.06, 2000, 0.05); },
    back: () => { tone(600, 0.08, 'square', 0.07, 300); },
    swing: () => { noise(0.12, 0.12, 2500, 'bandpass', 900, 0, null, 2); },
    swingBig: () => { noise(0.2, 0.2, 1800, 'bandpass', 400, 0, null, 2); },
    coin: () => { tone(1800, 0.12, 'triangle', 0.1); tone(2700, 0.18, 'sine', 0.08, null, 0.04); },
    coins: () => { for (let i = 0; i < 5; i++) tone(1600 + Math.random() * 1400, 0.1, 'triangle', 0.06, null, i * 0.035); },
    arrow: () => { tone(900, 0.12, 'sawtooth', 0.08, 300); noise(0.15, 0.15, 3000, 'bandpass', 800, 0, null, 3); },
    bowDraw: () => { noise(0.25, 0.05, 1200, 'bandpass', 2400, 0, null, 6); },
    snipe: () => { tone(1600, 0.25, 'square', 0.1, 400); noise(0.25, 0.25, 5000, 'bandpass', 1500, 0, null, 4); },
    buzz: () => { tone(110, 0.3, 'sawtooth', 0.08, 130); tone(113, 0.3, 'sawtooth', 0.08, 128); },
    flex: () => { tone(160, 0.25, 'sawtooth', 0.12, 90); noise(0.2, 0.1, 800, 'lowpass'); },
    hammer: () => { noise(0.4, 0.5, 1200, 'lowpass', 60); tone(70, 0.35, 'sine', 0.5, 30); tone(1900, 0.2, 'triangle', 0.08, 1700); },
    water: () => { for (let i = 0; i < 4; i++) tone(500 + Math.random() * 500, 0.08, 'sine', 0.08, 1200 + Math.random() * 600, i * 0.03); },
    transform: () => { tone(300, 0.8, 'sawtooth', 0.12, 1200); tone(450, 0.8, 'square', 0.06, 1800); noise(0.8, 0.12, 2000, 'bandpass', 8000); },
    ghost: () => { tone(500, 0.35, 'sine', 0.1, 250); tone(510, 0.35, 'sine', 0.1, 245); },
    fire: () => { noise(0.35, 0.25, 1500, 'bandpass', 500, 0, null, 1); },
    magic: () => { for (let i = 0; i < 5; i++) tone(1000 + i * 250, 0.12, 'sine', 0.06, null, i * 0.04); },
    disguise: () => { noise(0.2, 0.2, 1500, 'bandpass', 300); tone(300, 0.2, 'triangle', 0.1, 150); },
    slash: () => { noise(0.14, 0.2, 4000, 'highpass', 1500); tone(1400, 0.1, 'sawtooth', 0.05, 700); },
    // terrains
    roar: () => { tone(95, 1.1, 'sawtooth', 0.22, 55); tone(142, 1.0, 'square', 0.1, 70); noise(1.0, 0.25, 900, 'lowpass', 150); },
    roarHi: () => { tone(220, 1.0, 'sawtooth', 0.16, 520); tone(330, 0.9, 'square', 0.08, 780); noise(0.9, 0.2, 2500, 'bandpass', 900); },
    warn: () => { tone(880, 0.09, 'square', 0.09); tone(880, 0.09, 'square', 0.09, null, 0.16); },
    whoosh: () => { noise(0.45, 0.3, 700, 'bandpass', 2600, 0, null, 1.5); },
    splash: () => { noise(0.8, 0.4, 1800, 'lowpass', 200); for (let i = 0; i < 6; i++) tone(400 + Math.random() * 700, 0.12, 'sine', 0.07, 1300, i * 0.05); },
    bubble: () => { for (let i = 0; i < 3; i++) tone(300 + Math.random() * 300, 0.1, 'sine', 0.06, 900, i * 0.07); },
    gulp: () => { tone(160, 0.35, 'sine', 0.4, 50); noise(0.3, 0.35, 400, 'lowpass', 80); },
    spit: () => { noise(0.3, 0.35, 2500, 'bandpass', 600); tone(300, 0.2, 'triangle', 0.15, 900); },
    dig: () => { noise(0.35, 0.35, 700, 'lowpass', 120); for (let i = 0; i < 4; i++) noise(0.05, 0.12, 1800, 'bandpass', 600, i * 0.05); },
    quake: () => { noise(0.9, 0.55, 400, 'lowpass', 50); tone(55, 0.8, 'sine', 0.5, 30); tone(82, 0.6, 'sawtooth', 0.12, 40); },
    crack: () => { for (let i = 0; i < 5; i++) noise(0.04, 0.18, 2600, 'highpass', 900, i * 0.06); tone(70, 0.4, 'sine', 0.2, 50); },
    ohko: () => { noise(1.0, 0.6, 5000, 'lowpass', 100); tone(1800, 0.6, 'sawtooth', 0.12, 300); tone(90, 0.9, 'sine', 0.5, 30); },
    // griffes qui fendent l'air (Tranche de Minotaupe) : deux « fffit » secs
    clawSwipe: () => { noise(0.09, 0.15, 6500, 'bandpass', 2600, 0, null, 1.8); noise(0.07, 0.09, 7800, 'highpass', 3600, 0.03); },
    // pointe des griffes = coup critique, façon tipper aérien de Marth dans Melee : claquement sec + lame qui « tchiiing »
    tipper: () => {
      noise(0.035, 0.5, 7000, 'highpass', 4000);
      noise(0.17, 0.34, 9500, 'bandpass', 2400, 0, null, 2.2);
      tone(2650, 0.34, 'triangle', 0.11, 2560); tone(3970, 0.27, 'sine', 0.07, 3900); tone(5320, 0.18, 'sine', 0.05, 5250);
      tone(1320, 0.09, 'square', 0.05, 900);
      tone(170, 0.15, 'sine', 0.42, 55);
    },
    chomp: () => { noise(0.25, 0.5, 900, 'lowpass', 90); tone(70, 0.3, 'sine', 0.5, 35); tone(2000, 0.08, 'square', 0.06, 1500); },
  };
  A.play = (name) => { if (!A.ctx) return; const f = SFX[name]; if (f) try { f(); } catch (e) {} };

  // Boucle de PERCEUSE (Minotaupe) : sifflement aigu, grésillant, comme une fraise de dentiste ; le régime (0..1)
  // fait monter la note. À appeler à chaque image tant que la foreuse tourne : sans appel, elle s'éteint seule.
  // kind : 'whine' (perceuse) ou 'rumble' (grondement sous terre).
  const drills = {};
  A.drill = (id, level, vol, kind) => {
    if (!A.ctx) return;
    const C = A.ctx, now = C.currentTime;
    let L = drills[id];
    if (!L) {
      try {
        const o1 = C.createOscillator(), o2 = C.createOscillator(), lfo = C.createOscillator();
        const lg = C.createGain(), am = C.createGain(), fl = C.createBiquadFilter(), env = C.createGain();
        o1.type = 'sawtooth'; o2.type = 'square'; lfo.type = 'sine';
        fl.type = 'bandpass'; fl.Q.value = 1.6;
        am.gain.value = 0.55; lg.gain.value = 0.45; env.gain.value = 0;
        lfo.connect(lg); lg.connect(am.gain); // grésillement (modulation rapide du volume)
        o1.connect(fl); o2.connect(fl); fl.connect(am); am.connect(env); env.connect(A.sfxG);
        o1.start(); o2.start(); lfo.start();
        L = drills[id] = { o1, o2, lfo, fl, env };
      } catch (e) { return; }
    }
    const rumble = kind === 'rumble';
    const fq = rumble ? 70 + level * 40 : 650 + level * 2300;
    L.o1.frequency.setTargetAtTime(fq, now, 0.04);
    L.o2.frequency.setTargetAtTime(fq * (rumble ? 1.5 : 1.502), now, 0.04);
    L.fl.frequency.setTargetAtTime(rumble ? 260 : fq * 1.3, now, 0.04);
    L.lfo.frequency.setTargetAtTime(rumble ? 9 : 34 + level * 46, now, 0.04);
    L.env.gain.cancelScheduledValues(now);
    L.env.gain.setTargetAtTime((vol == null ? 0.07 : vol) * (rumble ? 2.2 : 1), now, 0.015);
    L.env.gain.setTargetAtTime(0, now + 0.09, 0.03); // s'éteint si on ne l'entretient plus
  };
  A.hit = (dmg, kb, type) => {
    if (!A.ctx) return;
    const v = Math.min(0.55, 0.12 + dmg * 0.022);
    noise(0.08 + dmg * 0.006, v, 1500 + dmg * 180, 'lowpass', 300);
    tone(180 - Math.min(90, dmg * 4), 0.1 + dmg * 0.006, 'sine', v * 0.9, 45);
    if (kb > 90) { noise(0.35, 0.4, 5000, 'highpass', 1200); tone(1200, 0.25, 'square', 0.06, 300); }
    if (type === 'fire') noise(0.25, 0.2, 2500, 'bandpass', 600);
    else if (type === 'elec') { tone(90, 0.2, 'square', 0.12, 110); tone(1800, 0.12, 'square', 0.05, 900); }
    else if (type === 'water') SFX.water();
    else if (type === 'coin' || type === 'steel') tone(2200, 0.18, 'triangle', 0.1, 1800);
    else if (type === 'ghost' || type === 'dark') tone(300, 0.2, 'sine', 0.1, 180);
    else if (type === 'grass') noise(0.12, 0.15, 3500, 'bandpass', 1200);
    else if (type === 'fairy' || type === 'psychic') tone(1500, 0.18, 'sine', 0.08, 2600);
    else if (type === 'blade') { noise(0.12, 0.25, 6000, 'highpass', 2500); tone(2600 + Math.random() * 600, 0.35, 'triangle', 0.07, 2400); tone(3900, 0.25, 'sine', 0.04); }
    else if (type === 'sound') { tone(880, 0.12, 'triangle', 0.08); tone(1320, 0.15, 'triangle', 0.06, null, 0.05); }
    else if (type === 'bug') noise(0.1, 0.12, 2200, 'bandpass', 900);
    else if (type === 'claw') { noise(0.05, 0.24, 5200, 'bandpass', 2400, 0, null, 2.5); noise(0.05, 0.17, 4300, 'bandpass', 2000, 0.03, null, 2.5); tone(2900, 0.12, 'triangle', 0.04, 2700); } // griffure
  };

  // Annonceur
  let voiceFR = null;
  function pickVoice() {
    if (!window.speechSynthesis) return;
    const vs = speechSynthesis.getVoices();
    voiceFR = vs.find(v => /fr/i.test(v.lang) && /male|homme|paul|thomas|henri|claude/i.test(v.name)) || vs.find(v => /fr/i.test(v.lang)) || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  A.say = (txt) => {
    if (!A.vol.voice || !txt || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = 'fr-FR'; if (voiceFR) u.voice = voiceFR;
      u.rate = 1.0; u.pitch = 0.7; u.volume = 1;
      speechSynthesis.speak(u);
    } catch (e) {}
  };

  // ---------- Musique procédurale ----------
  const THEMES = [
    { bpm: 148, root: 57, prog: [0, -4, 3, -2], scale: [0, 2, 3, 5, 7, 8, 10], lead: 'square', bass: 'sawtooth' },   // champ : épique mineur
    { bpm: 132, root: 50, prog: [0, 1, -2, -4], scale: [0, 2, 3, 6, 7, 8, 11], lead: 'sawtooth', bass: 'square' },   // ultra-dimension : étrange
    { bpm: 156, root: 60, prog: [0, 5, -3, 4], scale: [0, 2, 4, 5, 7, 9, 11], lead: 'triangle', bass: 'square' },   // plage : majeur joyeux
    { bpm: 140, root: 55, prog: [0, -2, -4, -5], scale: [0, 2, 3, 5, 7, 9, 10], lead: 'square', bass: 'sawtooth' },  // arène : dorien
    { bpm: 120, root: 60, prog: [0, -3, 5, 4], scale: [0, 2, 4, 5, 7, 9, 11], lead: 'triangle', bass: 'triangle' },  // menu
    { bpm: 126, root: 62, prog: [0, -5, -3, 2], scale: [0, 2, 4, 6, 7, 9, 11], lead: 'triangle', bass: 'square' },   // Séracrawl : lydien, station de ski
    { bpm: 108, root: 55, prog: [0, -2, 3, -5], scale: [0, 2, 4, 5, 7, 9, 10], lead: 'square', bass: 'triangle' },   // Torterra : mixolydien, forêt
    { bpm: 84, root: 60, prog: [0, 5, -3, -5], scale: [0, 2, 4, 5, 7, 9, 11], lead: 'triangle', bass: 'triangle' },  // Ronflex : berceuse paresseuse
    { bpm: 172, root: 57, prog: [0, 3, 5, -2], scale: [0, 2, 3, 5, 7, 8, 10], lead: 'sawtooth', bass: 'sawtooth' }, // Koraidon : course rock
    { bpm: 96, root: 58, prog: [0, -4, 5, -2], scale: [0, 2, 4, 5, 7, 9, 11], lead: 'sine', bass: 'triangle' },      // Wailord : océan, ample
    { bpm: 118, root: 52, prog: [0, 1, -4, -2], scale: [0, 1, 4, 5, 7, 8, 10], lead: 'square', bass: 'sawtooth' },   // Colonnes Lances : solennel (phrygien dominant)
    { bpm: 134, root: 53, prog: [0, -2, 3, -5], scale: [0, 2, 3, 5, 7, 9, 10], lead: 'square', bass: 'square' },     // Oyacata : lac, groove dorien
  ];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let seq = null;

  // ---------- Musiques en fichier (optionnel, voir musique/musiques.js) ----------
  // Lecture via WebAudio : boucle à l'échantillon près entre loopStart et loopEnd (l'intro avant loopStart
  // n'est jouée qu'une fois). Si le fichier manque ou si le jeu est ouvert sans serveur : musique synthétisée.
  const bufCache = {};
  let fileSrc = null, playTok = 0;
  function playFile(key, idx) {
    const def = G.MUSIC_FILES[key], tok = ++playTok;
    const go = (buf) => {
      if (tok !== playTok || !A.ctx) return; // une autre musique a été demandée entre-temps
      const C = A.ctx, src = C.createBufferSource(), g = C.createGain();
      src.buffer = buf; src.loop = true;
      src.loopStart = Math.max(0, def.loopStart || 0);
      src.loopEnd = def.loopEnd && def.loopEnd > src.loopStart ? Math.min(def.loopEnd, buf.duration) : buf.duration;
      g.gain.value = def.vol == null ? 1 : def.vol;
      src.connect(g); g.connect(A.musG); src.start();
      fileSrc = src; A.fileMusic = { key, file: def.file, loopStart: src.loopStart, loopEnd: src.loopEnd, duration: buf.duration };
    };
    if (bufCache[def.file]) { go(bufCache[def.file]); return; }
    fetch('musique/' + encodeURI(def.file)).then((r) => { if (!r.ok) throw new Error('absent'); return r.arrayBuffer(); })
      .then((ab) => A.ctx.decodeAudioData(ab))
      .then((buf) => { bufCache[def.file] = buf; go(buf); })
      .catch(() => { if (tok === playTok) synthMusic(idx); });
  }
  // key : 'menu' ou l'id du terrain ; idx : thème synthétisé de secours
  A.music = (idx, key) => {
    if (!A.ctx) return;
    A.stopMusic();
    if (key && G.MUSIC_FILES && G.MUSIC_FILES[key] && G.MUSIC_FILES[key].file) { playFile(key, idx); return; }
    synthMusic(idx);
  };
  function synthMusic(idx) {
    const th = THEMES[idx % THEMES.length];
    const C = A.ctx;
    const stepDur = 60 / th.bpm / 4;
    let step = 0, next = C.currentTime + 0.1;
    // mélodie pseudo-aléatoire mais fixe pour le thème
    let sd = idx * 7919 + 17;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const melody = [];
    for (let i = 0; i < 64; i++) melody.push(rnd() < 0.62 ? Math.floor(rnd() * 7) + (rnd() < 0.3 ? 7 : 0) : null);
    seq = setInterval(() => {
      while (next < C.currentTime + 0.25) {
        const bar = Math.floor(step / 16) % 4, s16 = step % 16;
        const chord = th.root + th.prog[bar];
        const out = A.musG;
        const d = Math.max(0, next - C.currentTime);
        // batterie
        if (s16 % 4 === 0) tone(140, 0.18, 'sine', 0.5, 40, d, out);
        if (s16 % 8 === 4) noise(0.14, 0.25, 2500, 'bandpass', 900, d, out);
        if (s16 % 2 === 1) noise(0.04, 0.08, 8000, 'highpass', null, d, out);
        // basse
        if (s16 % 2 === 0) tone(mtof(chord - 24 + (s16 % 8 === 6 ? 7 : 0)), stepDur * 1.8, th.bass, 0.12, null, d, out);
        // arpège
        if (s16 % 2 === 1 && bar % 2 === 1) tone(mtof(chord + [0, 3, 7, 12][(s16 >> 1) % 4]), stepDur * 0.9, 'triangle', 0.05, null, d, out);
        // mélodie
        const mi = melody[(step >> 1) % 64];
        if (s16 % 2 === 0 && mi != null && Math.floor(step / 64) % 2 === 0) {
          const deg = th.scale[mi % 7] + (mi >= 7 ? 12 : 0);
          tone(mtof(chord + 12 + deg), stepDur * 1.7, th.lead, 0.05, null, d, out);
        }
        next += stepDur; step++;
      }
    }, 50);
  }
  A.stopMusic = () => {
    playTok++;
    if (fileSrc) { try { fileSrc.stop(); } catch (e) {} fileSrc = null; A.fileMusic = null; }
    if (seq) { clearInterval(seq); seq = null; }
  };
})(window.G);
