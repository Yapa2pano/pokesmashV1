// Rendu 3D des combattants (Three.js) — purement visuel, la sim ne change pas.
// Les modèles officiels sont animés par : 1) leurs clips d'origine (attente, marche, course, saut, dégâts...)
// et 2) les poses du jeu (G.pose : aF/aB bras, lF/lB jambes, lean, rot, hd...) appliquées sur les os
// par visée (le bras pointe dans la direction voulue), mélangées au clip selon un poids par état.
// Le calque 3D est dessiné dans le canevas 2D à la place des persos 2D (décor, effets et HUD restent en 2D).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const G = window.G;
const RAD = Math.PI / 180;
const R3 = G.R3 = { ok: false, tpl: {}, loading: {}, inst: {}, THREE };

// ---------- Préférence (Options > Rendu) ----------
R3.enabled = () => !G.Input || !G.Input.opts || G.Input.opts.render3d !== false;

// ---------- Moteur ----------
let renderer, scene, camera, loader;
function init() {
  if (renderer) return true;
  try {
    const cv = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, premultipliedAlpha: true });
  } catch (e) { console.warn('3D indisponible', e); R3.failed = true; return false; }
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6a7088, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(-0.6, 1.4, 1.2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 1.6); rim.position.set(0.8, 0.6, -1.4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe2c0, 0.5); fill.position.set(1.2, 0.2, 0.8); scene.add(fill);
  camera = new THREE.PerspectiveCamera(26, 16 / 9, 1, 5000);
  const draco = new DRACOLoader().setDecoderPath('js/vendor/three/addons/libs/draco/');
  loader = new GLTFLoader().setDRACOLoader(draco);
  R3.renderer = renderer; R3.scene = scene; R3.camera = camera;
  R3.ok = true;
  return true;
}

// ---------- Os : noms officiels (SV « left_arm_01 », anciens « LArm ») -> noms canoniques ----------
const BONES = {
  waist: ['waist'], hips: ['hips'], spine: ['spine_01', 'spine1', 'spine'], spine2: ['spine_02', 'spine2'],
  neck: ['neck'], head: ['head'], tail: ['tail_01', 'tail1', 'tail'],
  armL: ['left_arm_01', 'larm'], foreL: ['left_arm_02', 'lforearm'], handL: ['left_hand', 'lhand'],
  armR: ['right_arm_01', 'rarm'], foreR: ['right_arm_02', 'rforearm'], handR: ['right_hand', 'rhand'],
  thighL: ['left_leg_01', 'lthigh'], shinL: ['left_leg_02', 'lleg'], footL: ['left_foot', 'lfoot'],
  thighR: ['right_leg_01', 'rthigh'], shinR: ['right_leg_02', 'rleg'], footR: ['right_foot', 'rfoot'],
};
const BONE_IDX = {};
for (const k in BONES) for (const n of BONES[k]) if (!BONE_IDX[n]) BONE_IDX[n] = k;
const baseName = (n) => n.toLowerCase().replace(/_\d+$/, '');
function findBones(root) {
  const b = {};
  root.traverse((o) => { if (!o.isBone && o.type !== 'Object3D') return; const k = BONE_IDX[baseName(o.name)]; if (k && !b[k]) b[k] = o; });
  return b;
}

// ---------- Clips : alias -> regex ----------
const CLIP_RX = {
  idle: [/battlewait01_loop/, /defaultwait01_loop/, /wait/i, /idle/i],
  walk: [/walk01_loop/, /walk/i],
  run: [/run01_loop/, /run/i],
  jumpStart: [/jumpup01_start/],
  jumpUp: [/jumpup01_loop/],
  fall: [/jumpdown01_loop/],
  land: [/land0\d/],
  damage: [/damage01/], damage2: [/damage02/, /damage01/],
  downStart: [/down01_start/], downLoop: [/down01_loop/], downEnd: [/down01_end/],
  stun: [/stun01_loop/],
  taunt: [/glad01/, /roar01/],
  attack: [/_attack01/], attack2: [/_attack02/, /_attack01/],
  range: [/rangeattack01/], rangeLoop: [/rangeattack02_loop/, /rangeattack01/],
};
function findClip(tpl, key, cfg) {
  if (key instanceof RegExp) return tpl.clips.find((c) => key.test(c.name)) || null;
  const own = cfg.clips && cfg.clips[key];
  const rxs = own ? [own] : (CLIP_RX[key] || []);
  for (const rx of rxs) {
    const all = tpl.clips.filter((c) => rx.test(c.name));
    if (!all.length) continue;
    const pref = cfg.clips && cfg.clips.prefer;
    return (pref && all.find((c) => pref.test(c.name))) || all[0];
  }
  return null;
}

// ---------- Chargement des modèles ----------
function loadTpl(file) {
  if (R3.tpl[file]) return Promise.resolve(R3.tpl[file]);
  if (R3.loading[file]) return R3.loading[file];
  return (R3.loading[file] = loader.loadAsync(file).then((g) => {
    const rm = [];
    g.scene.traverse((o) => { if (o.isMesh && /lod[1-9]|shadow/i.test(o.name)) rm.push(o); });
    rm.forEach((o) => o.parent.remove(o));
    // pas de déplacement venu des clips (« root motion ») : c'est la sim qui place le perso
    for (const c of g.animations || []) {
      c.tracks = c.tracks.filter((tr) => {
        if (!tr.name.endsWith('.position')) return true;
        const bn = baseName(tr.name.slice(0, -9));
        return !(bn === 'origin' || bn === '_rootjoint' || bn === 'root' || /^pm\d+/.test(bn));
      });
    }
    const tpl = { scene: g.scene, clips: g.animations || [] };
    R3.tpl[file] = tpl;
    return tpl;
  }).catch((e) => { console.warn('Modèle 3D introuvable :', file, e); R3.tpl[file] = { bad: true }; return R3.tpl[file]; }));
}
R3.preload = (chars) => {
  if (!R3.enabled() || !init()) return Promise.resolve();
  const ps = [];
  for (const c of chars) { const cfg = G.M3D && G.M3D[c]; if (cfg) for (const k in cfg.models) { ps.push(loadTpl(cfg.models[k].file)); if (cfg.models[k].alt) ps.push(loadTpl(cfg.models[k].alt)); } }
  return Promise.all(ps);
};
R3.has = (f) => {
  if (!R3.ok || !R3.enabled()) return false;
  const cfg = G.M3D && G.M3D[f.char];
  if (!cfg) return false;
  const { mc } = modelFor(cfg, f);
  const tpl = R3.tpl[mc.file];
  if (!tpl) { loadTpl(mc.file); return false; }
  return !tpl.bad;
};
// forme affichée (pick) et couleur alternative : les palettes impaires prennent le modèle « alt » (shiny) s'il existe
function modelFor(cfg, f) {
  let key = (cfg.pick ? cfg.pick(f) : 'main') || 'main';
  if (!cfg.models[key]) key = 'main';
  let mc = cfg.models[key];
  if (mc.alt && f.pal % 2 === 1) { key += '@alt'; mc = mc._alt || (mc._alt = Object.assign({}, mc, { file: mc.alt })); }
  return { key, mc };
}

// ---------- Matériaux ----------
function convertMat(m, mc) {
  const n = new THREE.MeshStandardMaterial({
    map: m.map || null, color: m.color ? m.color.clone() : new THREE.Color(1, 1, 1),
    normalMap: m.normalMap || null, emissiveMap: m.emissiveMap || null,
    transparent: !!m.transparent, opacity: m.opacity == null ? 1 : m.opacity, alphaTest: m.alphaTest || 0,
    side: m.side, metalness: mc.metal == null ? 0.05 : mc.metal, roughness: mc.rough == null ? 0.6 : mc.rough,
  });
  n.envMapIntensity = mc.env == null ? 1 : mc.env;
  n.userData.baseColor = n.color.clone();
  n.userData.baseOpacity = n.opacity;
  n.userData.baseTransparent = n.transparent;
  return n;
}

// os qui porte le plus de sommets d'un maillage (pour masquer une pièce du modèle par son os)
function dominantBone(mesh) {
  const si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, cnt = {};
  if (!si || !sw) return '';
  for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > 0.01) { const j = si.getComponent(i, k); cnt[j] = (cnt[j] || 0) + 1; }
  let best = -1, n = 0; for (const j in cnt) if (cnt[j] > n) { n = cnt[j]; best = +j; }
  return best >= 0 ? mesh.skeleton.bones[best].name : '';
}

// ---------- Une forme de perso (modèle cloné + mixer) ----------
function makeForm(tpl, mc, st) {
  const model = SkeletonUtils.clone(tpl.scene);
  const mats = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    if (mc.hideBones && o.isSkinnedMesh && mc.hideBones.test(dominantBone(o))) { o.visible = false; return; }
    if (Array.isArray(o.material)) o.material = o.material.map((m) => { const n = convertMat(m, mc); mats.push(n); return n; });
    else { o.material = convertMat(o.material, mc); mats.push(o.material); }
  });
  const mixer = new THREE.AnimationMixer(model);
  const form = { model, mixer, mats, mc, tpl, bones: findBones(model), actions: {}, cur: null, curKey: null };
  // pose de repos des os pilotés (remise à zéro avant chaque frame : les retouches ne s'accumulent pas)
  form.rest = Object.values(form.bones).map((b) => [b, b.quaternion.clone()]);
  // Mise à l'échelle sur la hurtbox, pieds à l'origine, mesurée dans la pose d'attente
  const idle = findClip(tpl, 'idle', mc);
  // modèle sans clips nommés : son clip unique (souvent la pose de repos) sert de base sous les poses du jeu
  const base = idle || tpl.clips[0] || null;
  if (base) { const a = mixer.clipAction(base); a.play(); mixer.update(0); }
  model.updateMatrixWorld(true);
  const box = new THREE.Box3(), bb = new THREE.Box3(); // morceaux visibles seulement
  model.traverse((o) => { if (o.isMesh && o.visible) box.union(bb.setFromObject(o, true)); });
  const h = Math.max(0.001, box.max.y - box.min.y);
  const s = (st.h * (mc.h || 1)) / h;
  model.scale.setScalar(s);
  model.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s + (mc.dy || 0), -(box.min.z + box.max.z) / 2 * s);
  mixer.stopAllAction();
  form.hasClips = !!idle;
  form.baseClip = idle ? null : base;
  form.wrap = new THREE.Group(); form.wrap.add(model);
  return form;
}

// ---------- Instance par combattant ----------
function getInst(f) {
  const cfg = G.M3D[f.char];
  let I = R3.inst[f.slot];
  if (!I || I.char !== f.char) {
    if (I) scene.remove(I.root);
    I = R3.inst[f.slot] = { char: f.char, forms: {}, root: new THREE.Group(), pivot: new THREE.Group(), yaw: new THREE.Group(), yawA: null, shadow: null };
    I.root.add(I.pivot); I.pivot.add(I.yaw);
    I.shadow = makeShadow(); scene.add(I.shadow);
    scene.add(I.root);
  }
  const { key, mc } = modelFor(cfg, f);
  if (!I.forms[key]) {
    I.forms[key] = makeForm(R3.tpl[mc.file], mc, G.ST(f));
    I.yaw.add(I.forms[key].wrap);
  }
  for (const k in I.forms) I.forms[k].wrap.visible = k === key;
  I.form = I.forms[key];
  return I;
}

let shadowTex;
function makeShadow() {
  if (!shadowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = -1;
  return m;
}
function groundBelow(S, x, y) {
  const P = S.stage; let best = -Infinity;
  const test = (p) => { if (p && x >= p.l && x <= p.r && p.y <= y + 0.5 && p.y > best) best = p.y; };
  test(P.main); (P.plats || []).forEach(test);
  return best;
}

// ---------- Choix du clip et du poids des poses selon l'état ----------
// w = poids des poses du jeu sur les membres (0 = clip officiel seul, 1 = pose du jeu seule)
function stateOf(f, P, form) {
  const a = f.action, mc = form.mc;
  const ov = mc.states && mc.states[a];
  const fall = f.vy > 0.2 ? 'jumpUp' : 'fall';
  let o;
  switch (a) {
    case 'idle': case 'respawn': o = { clip: 'idle', w: 0 }; break;
    case 'walk': o = { clip: 'walk', w: 0, speed: Math.max(0.5, Math.abs(f.vx) / G.ST(f).walk) }; break;
    case 'dash': case 'run': o = { clip: 'run', w: 0, lean: 0.4 }; break;
    case 'brake': case 'turn': o = { clip: 'idle', w: 0.5 }; break;
    case 'crouch': o = { clip: 'idle', w: 0.6 }; break;
    case 'jsq': o = { clip: 'jumpStart', w: 0.3 }; break;
    case 'air': o = { clip: fall, w: f.ff ? 0.6 : 0.15 }; break;
    case 'land': case 'lag': o = { clip: 'land', w: 0.3, t: Math.min(1, f.af / Math.max(6, f.lag || 6)) * 0.6 }; break;
    case 'shield': case 'shieldOff': case 'spot': o = { clip: 'idle', w: 0.5 }; break;
    case 'roll': case 'groll': case 'troll': o = { clip: 'run', w: 0.5 }; break;
    case 'adodge': o = { clip: fall, w: 0.5 }; break;
    case 'help': o = { clip: 'fall', w: 0.7 }; break;
    case 'tumble': o = { clip: 'damage2', w: 0.4, loop: 1 }; break;
    case 'hit': case 'thrown': o = { clip: f.tumble ? 'damage2' : 'damage', w: 0.35, t: Math.min(1, f.af / 24) }; break;
    case 'grabbed': o = { clip: 'damage', w: 0.6, t: 0.3 }; break;
    case 'down': o = { clip: 'downLoop', w: 0, noRot: 1, fb: { clip: 'damage2', w: 0.8 } }; break;
    case 'getup': case 'tech': o = { clip: 'downEnd', w: 0, noRot: 1, t: Math.min(1, f.af / 18), fb: { clip: 'idle', w: 0.8 } }; break;
    case 'sbreak': case 'dizzy': o = { clip: 'stun', w: 0.2 }; break;
    case 'hold': o = { clip: 'idle', w: 0.8 }; break;
    case 'grel': o = { clip: 'fall', w: 0.4 }; break;
    case 'ledge': o = { clip: 'fall', w: 0.9 }; break;
    case 'lgetup': case 'lroll': case 'lattack': o = { clip: 'idle', w: 0.8 }; break;
    case 'taunt': o = { clip: 'taunt', w: 0.1, t: Math.min(1, f.af / 60) }; break;
    case 'move': {
      // réglage du perso, sinon clip officiel par famille de coup, sinon pose du jeu seule
      const mv = (mc.moves && mc.moves[f.move]) || (form.hasClips && defaultMove(f.move));
      if (mv) {
        const M = G.MV(f, f.move);
        o = { clip: mv.clip, w: mv.w == null ? 0.5 : mv.w, loop: mv.loop, back: mv.back, move: 1 };
        if (!mv.loop) o.t = timeWarp(f.af, M, mv.imp == null ? 0.38 : mv.imp);
      } else o = { clip: f.grounded ? 'idle' : fall, w: 0.9, move: 1 };
      break;
    }
    default: o = { clip: 'idle', w: 0.5 };
  }
  if (ov) { o.clip = ov; o.w = 0; }
  if (!form.hasClips) { o.w = 1; o.noRot = 0; }
  return o;
}
// Clip officiel par défaut selon le nom du coup (persos aux animations officielles)
function defaultMove(name) {
  if (!name) return null;
  if (/^(jab|ftilt|dashAtk|fsmash|grab|dashgrab|pummel|fthrow|getupAtk|lattack|trick)/.test(name)) return { clip: 'attack', w: 0.3 };
  if (/^(bthrow)/.test(name)) return { clip: 'attack', w: 0.3, back: 1 };
  if (/^(utilt|usmash|uthrow)/.test(name)) return { clip: 'attack2', w: 0.55 };
  if (/^(dtilt|dsmash|dthrow)/.test(name)) return { clip: 'attack', w: 0.5 };
  if (/^(nair|fair|uair|dair)/.test(name)) return { clip: 'attack2', w: 0.5 };
  if (/^bair/.test(name)) return { clip: 'attack', w: 0.35, back: 1 };
  if (/spec/.test(name)) return { clip: 'range', w: 0.35 };
  if (/taunt/.test(name)) return { clip: 'taunt', w: 0 };
  return null;
}
// Cale l'instant d'impact du clip (imp, fraction) sur la première frame active du coup.
function timeWarp(af, M, imp) {
  const len = (M && M.len) || 30;
  const h0 = M && M.hits && M.hits.length ? M.hits[0].f[0] : Math.round(len * 0.35);
  if (imp == null) return Math.min(1, af / len);
  if (af <= h0) return (af / Math.max(1, h0)) * imp;
  return imp + (1 - imp) * Math.min(1, (af - h0) / Math.max(1, len - h0));
}

function playClip(form, o, dt) {
  for (const [b, q] of form.rest) b.quaternion.copy(q);
  if (!form.hasClips) { // pas d'animations officielles : clip de base en boucle, les poses font le reste
    if (form.baseClip && !form.cur) { form.cur = form.mixer.clipAction(form.baseClip); form.cur.play(); }
    form.mixer.update(dt);
    return;
  }
  let key = o.clip, clip = key ? findClip(form.tpl, key, form.mc) : null;
  if (!clip && o.fb) { o.w = Math.max(o.w, o.fb.w); clip = findClip(form.tpl, o.fb.clip, form.mc); }
  if (!clip) clip = findClip(form.tpl, 'idle', form.mc);
  if (!clip) return;
  const id = clip.name;
  let act = form.actions[id];
  if (!act) act = form.actions[id] = form.mixer.clipAction(clip);
  if (form.curKey !== id) {
    const prev = form.cur;
    act.reset(); act.enabled = true; act.setEffectiveWeight(1); act.play();
    act.setLoop(o.t == null || o.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); act.clampWhenFinished = true;
    if (prev) prev.crossFadeTo(act, 0.1, false);
    form.cur = act; form.curKey = id;
  }
  if (o.t != null && !o.loop) { act.timeScale = 0; act.time = Math.min(clip.duration - 1e-3, o.t * clip.duration); }
  else act.timeScale = o.speed || 1;
  form.mixer.update(dt);
}

// ---------- Poses du jeu appliquées sur les os (visée) ----------
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3();
const fwdW = new THREE.Vector3(), upW = new THREE.Vector3(), latW = new THREE.Vector3();
function dirOf(a, out, side, abd) { // a : 0 = bas, 90 = devant, 180 = haut
  const c = Math.cos(a * RAD), s = Math.sin(a * RAD);
  out.copy(upW).multiplyScalar(-c).addScaledVector(fwdW, s);
  if (abd) out.addScaledVector(latW, side * abd);
  return out.normalize();
}
function aim(bone, child, target, w) {
  if (!bone || !child || w <= 0) return;
  bone.getWorldPosition(_p0); child.getWorldPosition(_p1);
  _v.subVectors(_p1, _p0); if (_v.lengthSq() < 1e-10) return;
  _v.normalize();
  _q.setFromUnitVectors(_v, target);
  if (w < 1) _q.slerp(_qi.identity(), 1 - w);
  bone.getWorldQuaternion(_q2);
  _q2.premultiply(_q);
  if (bone.parent) { bone.parent.getWorldQuaternion(_qi); _q2.premultiply(_qi.invert()); }
  bone.quaternion.copy(_q2);
  bone.updateMatrixWorld(true);
}
function tilt(bone, deg, w) { // rotation avant/arrière autour de l'axe latéral du corps
  if (!bone || !deg || w <= 0) return;
  _v.crossVectors(upW, fwdW).normalize();
  _q.setFromAxisAngle(_v, deg * RAD * w);
  bone.getWorldQuaternion(_q2); _q2.premultiply(_q);
  if (bone.parent) { bone.parent.getWorldQuaternion(_qi); _q2.premultiply(_qi.invert()); }
  bone.quaternion.copy(_q2);
  bone.updateMatrixWorld(true);
}
function applyPose(I, f, P, w, spineLean) {
  const B = I.form.bones, mc = I.form.mc;
  I.yaw.updateMatrixWorld(true);
  I.yaw.getWorldQuaternion(_q2);
  fwdW.set(0, 0, 1).applyQuaternion(_q2); upW.set(0, 1, 0).applyQuaternion(_q2);
  latW.crossVectors(fwdW, upW).normalize(); // vers la droite du perso
  if (spineLean) { tilt(B.spine || B.waist, spineLean * 0.6, 1); tilt(B.spine2 || B.neck, spineLean * 0.4, 1); }
  if (w <= 0) return;
  // côté caméra = « avant » (aF, lF) ; à droite : bras droit du modèle, à gauche : bras gauche
  const nearR = Math.sin(I.yawA) > 0;
  const F = nearR ? 'R' : 'L', Bk = nearR ? 'L' : 'R';
  const sideF = nearR ? 1 : -1, abd = mc.abd == null ? 0.18 : mc.abd;
  const legW = w * (mc.legW == null ? 1 : mc.legW), armW = w * (mc.armW == null ? 1 : mc.armW);
  const T = new THREE.Vector3();
  const tu = P.tuck || 0;
  if ((mc.mode || (I.form.baseClip ? 'add' : 'aim')) === 'add') {
    // mode additif : la pose de repos du modèle est gardée, les angles du jeu s'ajoutent (écart à la pose neutre)
    const D0 = G.D.DEF_POSE, k = mc.addK == null ? 0.75 : mc.addK;
    const lFa = P.lF + (60 - P.lF) * tu, lBa = P.lB + (40 - P.lB) * tu;
    tilt(B['arm' + F], -(P.aF - D0.aF) * k, armW);
    tilt(B['arm' + Bk], -(P.aB - D0.aB) * k, armW);
    tilt(B['fore' + F], -((P.eF || 0) - D0.eF) * k * 0.5, armW);
    tilt(B['fore' + Bk], -((P.eB || 0) - D0.eB) * k * 0.5, armW);
    tilt(B['thigh' + F], -(lFa - D0.lF) * k, legW);
    tilt(B['thigh' + Bk], -(lBa - D0.lB) * k, legW);
    tilt(B['shin' + F], ((P.kF || 0) - D0.kF) * k * 0.6, legW);
    tilt(B['shin' + Bk], ((P.kB || 0) - D0.kB) * k * 0.6, legW);
    tilt(B.head || B.neck, P.hd || 0, w);
    tilt(B.tail, -(P.tl || 0), w);
    return;
  }
  // bras
  aim(B['arm' + F], B['fore' + F], dirOf(P.aF, T, sideF, abd), armW);
  aim(B['fore' + F], B['hand' + F], dirOf(P.aF + (P.eF || 0), T, sideF, abd * 0.5), armW);
  aim(B['arm' + Bk], B['fore' + Bk], dirOf(P.aB, T, -sideF, abd), armW);
  aim(B['fore' + Bk], B['hand' + Bk], dirOf(P.aB + (P.eB || 0), T, -sideF, abd * 0.5), armW);
  // jambes (le repli en boule « tuck » ramène les genoux)
  const lF = P.lF + (75 - P.lF) * tu, lB = P.lB + (55 - P.lB) * tu, kF = P.kF + (110 - P.kF) * tu, kB = P.kB + (110 - P.kB) * tu;
  aim(B['thigh' + F], B['shin' + F], dirOf(lF, T, sideF, 0.08), legW);
  aim(B['shin' + F], B['foot' + F], dirOf(lF + kF * -1, T, sideF, 0.04), legW * 0.8);
  aim(B['thigh' + Bk], B['shin' + Bk], dirOf(lB, T, -sideF, 0.08), legW);
  aim(B['shin' + Bk], B['foot' + Bk], dirOf(lB + kB * -1, T, -sideF, 0.04), legW * 0.8);
  // tête, queue
  tilt(B.head || B.neck, P.hd || 0, w);
  tilt(B.tail, -(P.tl || 0), w);
}

// ---------- Teinte (flash d'impact, charge, intangibilité...) ----------
const INTANG = new Set(['ledge', 'lgetup', 'lroll', 'lattack', 'spot', 'roll', 'adodge', 'getup', 'tech', 'troll', 'groll']);
const _c = new THREE.Color();
function parseRGBA(s) { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(',').map(Number); return [p[0] / 255, p[1] / 255, p[2] / 255, p[3] == null ? 1 : p[3]]; }
function applyTint(I, f, P, t, S) {
  let e = null, k = 0;
  if (f.flash > 0) { e = [1, 1, 1]; k = Math.min(0.8, f.flash / 10); }
  else if (f.intang > 0 && INTANG.has(f.action)) { e = [1, 1, 1]; k = 0.3; }
  else if (P.chargeK) { e = [1, 0.94, 0.6]; k = 0.25 + 0.25 * Math.sin(t * 30); }
  else if (f.hitlag > 0 && f.action === 'hit') { e = [1, 1, 1]; k = 0.3; }
  if (f.v.glow) { const g = parseRGBA(f.v.glow); if (g) { e = g; k = g[3]; } }
  let alpha = P.alpha == null ? 1 : P.alpha;
  if (f.invinc > 0 && (S.frame >> 2) % 2) alpha *= 0.6;
  if (f.v.invis) alpha *= f.v.invis;
  const dark = P.dark || 0;
  for (const m of I.form.mats) {
    if (e) { m.emissive.setRGB(e[0], e[1], e[2]); m.emissiveIntensity = k * 1.6; } else m.emissiveIntensity = 0;
    m.color.copy(m.userData.baseColor).multiplyScalar(1 - dark * 0.8);
    const tr = alpha < 0.999 || m.userData.baseTransparent;
    if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
    m.opacity = m.userData.baseOpacity * alpha;
    m.depthWrite = alpha > 0.95;
  }
}

// ---------- Rendu d'une frame ----------
R3.render = (S, t, ctx, list) => {
  if (!R3.ok) return;
  const R = G.R, W = R.W, H = R.H;
  if (renderer.domElement.width !== W || renderer.domElement.height !== H) renderer.setSize(W, H, false);
  // caméra perspective calée sur la caméra 2D : à z = 0, le champ visible = celui du jeu 2D
  const asp = W / H, sc = R.scale();
  camera.aspect = asp; camera.fov = 26;
  const worldH = R.cam.w / asp, dist = worldH / 2 / Math.tan(camera.fov * RAD / 2);
  camera.position.set(R.cam.x - R.cam.sx * R.dpr / sc, R.cam.y + R.cam.sy * R.dpr / sc, dist);
  camera.near = dist * 0.2; camera.far = dist * 3;
  camera.lookAt(camera.position.x, camera.position.y, 0);
  camera.updateProjectionMatrix();
  const dt = Math.min(0.05, (R.dtk || 1) / 60);
  const live = new Set();
  for (const f of list) {
    const I = getInst(f);
    live.add(f.slot);
    const st = G.ST(f);
    const P = G.pose(S, f, t);
    const form = I.form;
    // position (interpolée), secousses
    let x = R.px(f), y = R.py(f);
    if (f.hitlag > 0 && (f.action === 'hit' || f.action === 'grabbed')) x += Math.sin(t * 95) * 0.7;
    if (P.chargeK) x += Math.sin(t * 80) * 0.3;
    let buried = f.v.buried > 0 && f.hitlag > 0 && f.action !== 'hit';
    I.root.position.set(x, y + (buried ? -st.h * 0.5 : 0), 0);
    // orientation : de profil, tourné de 30° vers la caméra ; demi-tour rapide
    const o = stateOf(f, P, form);
    const fdir = o.back ? -f.facing : f.facing; // coups vers l'arrière : il se retourne pour frapper
    const target = fdir * (90 - (I.form.mc.turn == null ? 32 : I.form.mc.turn)) * RAD;
    if (I.yawA == null || Math.abs(target - I.yawA) > Math.PI * 1.2) I.yawA = target;
    I.yawA += (target - I.yawA) * Math.min(1, 0.45 * (R.dtk || 1));
    I.yaw.rotation.y = I.yawA;
    // clip officiel + poses
    playClip(form, o, dt);
    const cy = st.h * 0.45;
    const leanW = (o.move ? (form.hasClips ? 0.5 : 1) : (o.lean != null ? o.lean : Math.max(o.w, 0.3))) * (form.mc.leanK == null ? 1 : form.mc.leanK);
    const rot = o.noRot ? 0 : (P.rot || 0);
    // modèles animés : l'inclinaison passe par la colonne (le bas du corps reste au sol) ; sinon tout le corps
    const spineLean = form.hasClips && !rot ? (P.lean || 0) * leanW : 0;
    I.pivot.position.set(0, cy + (P.bob || 0) * 0.6, 0);
    I.yaw.position.set(0, -cy, 0);
    I.pivot.rotation.z = -f.facing * ((spineLean ? 0 : (P.lean || 0) * leanW) + rot) * RAD;
    const sq = (P.sq || 1), cr = (P.crouch || 0) * (form.hasClips ? 0.5 : 0.6);
    I.pivot.scale.set(1 + cr * 0.06, sq * (1 - cr * 0.22), 1 + cr * 0.06);
    applyPose(I, f, P, o.w, spineLean);
    applyTint(I, f, P, t, S);
    I.root.visible = true;
    // découpe au sol quand il est enterré
    const clip = buried ? [new THREE.Plane(new THREE.Vector3(0, 1, 0), -y)] : null;
    if (I.clipOn !== !!clip) { for (const m of form.mats) { m.clippingPlanes = clip; m.needsUpdate = true; } I.clipOn = !!clip; }
    else if (clip) for (const m of form.mats) m.clippingPlanes = clip;
    // ombre au sol
    const gy = groundBelow(S, f.x, f.y);
    const hgt = f.y - gy;
    if (gy > -1e8 && hgt < 60 && !buried) {
      const k = Math.max(0, 1 - hgt / 60);
      I.shadow.visible = true; I.shadow.position.set(x, gy + 0.05, 0);
      const r = st.w * 2.6 * (0.6 + 0.4 * k);
      I.shadow.scale.set(r, r * 0.9, 1); I.shadow.material.opacity = k * (P.alpha == null ? 1 : P.alpha);
    } else I.shadow.visible = false;
  }
  for (const k in R3.inst) if (!live.has(+k)) { R3.inst[k].root.visible = false; R3.inst[k].shadow.visible = false; }
  renderer.render(scene, camera);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(renderer.domElement, 0, 0);
};
R3.reset = () => { for (const k in R3.inst) { scene.remove(R3.inst[k].root); scene.remove(R3.inst[k].shadow); } R3.inst = {}; };

// ---------- Outil de vérification : planche de poses du J1 (états / coups à une frame donnée) ----------
// G.R3.planche([['idle'], ['move', 'fsmash', 17], ['air', 0, 5, { vy: -1, grounded: false }]], cols)
// 'impact' à la place de la frame = première frame active du coup + 1.
R3.planche = (items, cols = 4, cw = 190, ch = 220, w = 40) => {
  const Gm = G.Game, S = Gm.S, f = S.fighters[0];
  Gm.mode = 'results';
  let ov = document.getElementById('planche3d');
  if (!ov) { ov = document.createElement('canvas'); ov.id = 'planche3d'; ov.style.cssText = 'position:fixed;left:0;top:0;z-index:99;background:#445'; ov.onclick = () => ov.remove(); document.body.appendChild(ov); }
  const rows = Math.ceil(items.length / cols); ov.width = cols * cw; ov.height = rows * ch;
  const o = ov.getContext('2d'); o.fillStyle = '#445'; o.fillRect(0, 0, ov.width, ov.height);
  const save = { x: f.x, y: f.y, vx: f.vx, vy: f.vy, grounded: f.grounded, facing: f.facing };
  const t0 = performance.now() / 1000;
  items.forEach((it, i) => {
    let [act, mv, af, ex] = it;
    if (af === 'impact') { const M = G.MV(f, mv); af = M && M.hits && M.hits[0] ? M.hits[0].f[0] + 1 : 10; }
    Object.assign(f, save, { action: act, move: mv || f.move, af: af || 0, hitlag: 0, flash: 0, mv: f.mv || {} }, ex || {});
    G.R.camFix = { x: f.x, y: f.y + G.ST(f).h * 0.55, w };
    for (let k = 0; k < 4; k++) G.R.draw(S, t0 + k / 60, {});
    const c = G.R.canvas, sw = Math.min(c.width * 0.62, c.height * 0.62 * cw / ch), sh = sw * ch / cw;
    o.drawImage(c, (c.width - sw) / 2, (c.height - sh) / 2, sw, sh, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
    o.fillStyle = '#fff'; o.font = 'bold 12px sans-serif';
    o.fillText(act + (mv ? ' ' + mv : '') + ' ' + (af || ''), (i % cols) * cw + 4, Math.floor(i / cols) * ch + 14);
  });
  Object.assign(f, save, { action: 'idle', af: 0 });
  G.R.camFix = null;
  return ov.width + 'x' + ov.height;
};

init();
// préchargement de tous les modèles en tâche de fond (prêts avant le premier match)
if (G.Game && G.Game.S) R3.preload(G.Game.S.fighters.map((f) => f.char));
setTimeout(() => R3.preload(Object.keys(G.M3D || {})), 300);
