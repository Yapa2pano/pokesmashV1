'use strict';
// Modèles 3D des persos (rendu 3D, purement visuel : la sim ne lit jamais ce fichier).
// Par perso : un ou plusieurs modèles (formes), et `pick(f)` qui choisit la forme à afficher.
// Champs d'un modèle :
//   file   : chemin du .glb (dossier modeles/) ; alt : modèle des palettes impaires (shiny)
//   h      : hauteur affichée = h × hauteur de la hurtbox (stats.h). 1 par défaut.
//   metal / rough : rendu PBR (0..1). env : force des reflets de l'environnement.
//   clips  : alias d'animation -> regex sur le nom du clip officiel (sinon recherche automatique) ;
//            clips.prefer : regex qui départage plusieurs clips (ex. la série « 0xxxx » de Gromago).
//   moves  : réglages par coup ({ clip, w, imp, loop, back }) : clip calé sur le coup, w = poids de la pose du jeu.
//   states : clip imposé pour un état (ex. course sur la planche).
//   abd    : écartement latéral des bras (0..1), armW / legW : poids des poses sur les bras / jambes.
//   turn   : angle vers la caméra (32° par défaut).
// Sources : modeles/sources (rips officiels des jeux, à remplacer au fur et à mesure par de meilleurs modèles).
(function (G) {
  const SRC = 'modeles/sources/';
  G.M3D = {
    gromago: {
      models: {
        main: {
          file: SRC + 'regular_1000.glb', alt: SRC + 'shiny_1000.glb', h: 1.05, metal: 0.85, rough: 0.32, env: 1.2,
          // Série « 10xxx » = pose de combat officielle, debout sur sa planche (la série 00xxx du rip
          // laisse la planche pendre 0,6 sous ses pieds au bout de 5 pièces : faux). Les clips absents
          // de la série 10xxx sont remplacés par leur équivalent 10xxx le plus proche.
          clips: {
            prefer: /_1\d{4}_/, idle: /10000_defaultwait01_loop/, attack2: /10400_attack01/,
            range: /10460_rangeattack02_start/, rangeLoop: /10461_rangeattack02_loop/, taunt: /10300_roar01/,
          },
          hideBones: /^feeler_[b-f]_/, // pile de pièces sous la planche
          moves: { sspec: { clip: /10100_run01_loop/, w: 0.25, loop: 1 } },
          states: { dash: /10100_run01_loop/, run: /10100_run01_loop/ },
        },
      },
    },
    archeduc: { models: { main: { file: SRC + 'regular_724.glb', h: 1.05, rough: 0.7 } } },
    mouscoto: { models: { main: { file: SRC + 'regular_794.glb', h: 1.0, rough: 0.5, abd: 0.35 } } },
    miascarade: { models: { main: { file: SRC + 'regular_908.glb', h: 1.0, rough: 0.65 } } },
    insecateur: {
      pick: (f) => (f.v.form === 'ciz' ? 'ciz' : 'main'),
      models: {
        main: { file: SRC + 'regular_123.glb', h: 1.0, rough: 0.5 },
        ciz: { file: SRC + 'regular_212.glb', h: 1.0, metal: 0.6, rough: 0.3 },
      },
    },
    meloetta: { models: { main: { file: SRC + 'regular_648.glb', h: 1.0, rough: 0.6 } } },
    obalie: { models: { main: { file: SRC + 'regular_363.glb', h: 1.0, rough: 0.55 } } },
    evoli: {
      pick: (f) => f.v.form || 'main',
      models: {
        main: { file: SRC + 'regular_133.glb', h: 1.0, rough: 0.75, addK: 0.7, leanK: 0.5 },
        vol: { file: SRC + 'regular_135.glb', h: 1.0, rough: 0.75, addK: 0.7, leanK: 0.5 },
        pyr: { file: SRC + 'regular_136.glb', h: 1.0, rough: 0.75, addK: 0.7, leanK: 0.5 },
        noc: { file: SRC + 'regular_197.glb', h: 1.0, rough: 0.6, addK: 0.7, leanK: 0.5 },
        aqu: { file: SRC + 'regular_134.glb', h: 1.0, rough: 0.5, addK: 0.7, leanK: 0.5 },
        men: { file: SRC + 'regular_196.glb', h: 1.0, rough: 0.6, addK: 0.7, leanK: 0.5 },
      },
    },
    motisma: {
      pick: (f) => f.v.form || 'main',
      models: {
        main: { file: SRC + 'regular_479.glb', h: 1.0, rough: 0.5 },
        heat: { file: SRC + 'multiform_RotomHeat.glb', h: 1.0, rough: 0.45 },
        frost: { file: SRC + 'multiform_RotomFrost.glb', h: 1.0, rough: 0.45 },
        fan: { file: SRC + 'multiform_RotomFan.glb', h: 1.0, rough: 0.45 },
        mow: { file: SRC + 'multiform_RotomMow.glb', h: 1.0, rough: 0.45 },
      },
    },
  };
})(window.G);
