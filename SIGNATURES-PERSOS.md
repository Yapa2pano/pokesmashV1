# Signatures des persos — Poké Smash

Règle de design : **un perso = une idée qu'on sent en 10 secondes de jeu**, tirée de ce qu'est le Pokémon (son corps, son type, son attaque culte). Chaque propriété forte (aspiration, recul, écho, marque...) appartient à un seul perso, ou à deux au plus avec un usage différent. On peut reprendre un coup classique de Smash, mais les aériens doivent se reconnaître les yeux fermés.

**Règle commune des B qui se chargent (demande du 2026-10-02, pour Minotaupe et tous les suivants)** : B UNE fois = la charge monte toute seule (pas besoin de garder B) ; B à nouveau = le coup part (B B = coup immédiat) ; pendant la charge, stick arrière = demi-tour, saut = il saute vraiment en gardant la charge, bouclier = bouclier (+ côté = roulade, + bas = esquive, en l'air = esquive aérienne) en gardant la charge ; charge pleine = gardée automatiquement. Brique moteur : `G.chargeLoop` (js/sim/moves.js). Insécateur/Cizayox et Gromago gardent leur ancien système tant que l'utilisateur ne demande pas de les passer dessus.

## Les persos actuels

| Pokémon | Signature | Comment elle se joue |
|---|---|---|
| **Gromago** | Surf & figures, corps en pièces | Surf'Or qui touche = FIGURE sur la tête de l'adversaire (surf et saut rendus, 3 figures = JACKPOT). Pièces en projectiles sur ses aériens (avant, haut, atterrissage du bas). Kickflip au neutre, planche-batte à l'arrière. Bas B = Coup de Planche façon Falcon Kick : glissade qui tue au sol, plongeon qui spike en l'air. |
| **Archéduc** | Sniper planeur | Arc à charge rapide (critique à la tête, bonus de distance). Vol plané avec un coup au choix puis chute libre. Pluie de flèches vers le bas, Rafale qui repousse, aile qui relance le vol. Feuilles 0 lag avec recharge. |
| **Mouscoto** | Moustique culturiste : aspirer, voler, choper | Tourbillon qui aspire, Dard trompe en avant qui draine, trompe qui soigne, battement d'ailes, prises spéciales, contre Gonflette. |
| **Armarouge** | Canon & recul | Chaque tir aérien le propulse à l'opposé : les aériens servent aussi à se déplacer (reculer, foncer, se plaquer au sol, rebondir). Canon 360°, dôme psy qui renvoie les projectiles. |
| **Malvalame** | La rancune (samouraï spectral) | Lien du Destin (bas B) : l'adversaire lié encaisse la moitié des dégâts que Malvalame subit, et si Malvalame est éjecté pendant le lien, le lien explose sur lui. Feux Follets en orbite puis tirés à tête chercheuse (B). Ombre Portée (côté B) : intangible dans son ombre tant que B est tenu, surgit en taille montante. Lame Amère : geyser qui reste brûler (soin). Armurouillée : gros coup reçu = +vitesse. Échos sur 2 aériens (neutre, avant). Kit refait pour ne plus ressembler à Insécateur. |
| **Miascarade** | Magicienne | Pétales posés sur l'adversaire (max 3), consommés par la bombe-fleur (+3,5 % chacun, mais effet sur l'éjection réduit de 55 %) et le Tour de Fleur (critique à 3). Tours de passe-passe : cape qui retourne l'adversaire, salto qui la retourne, Coup Bas, téléportation. |
| **Insécateur / Cizayox** | Duo lame / acier | Kit d'origine gardé tel quel (choix de l'utilisateur) : bas B pour changer de forme, coup chargé façon DK (nerfé), Vive-Attaque, Pince Titan, Pisto-Poing. |
| **Meloetta** | Deux styles | Chant = ondes et notes (anneau, notes projectiles, basse qui rebondit, colonne d'aigus). Danse = mouvement (toupie, pas chassé, corps à corps). Chant Antique endort et change de forme. |
| **Obalie** | La boule | Il roule au lieu de courir et garde son élan. Roulade avec élan immédiat (sol et air) ; chaque coup qui touche le rend libre et fait repartir la Roulade suivante un niveau plus haut (5 niveaux, STRIKE au max) ; annulable en saut / aérien / esquive. Boule de Neige (B) qui roule et grossit, Mâchouille (bas B) qui croque aussi les projectiles (+PV, recharge 2 s), salto façon Carapuce, Ballon Givré sur le nez, vagues au ras du sol, plat ventre qui rebondit. Hitbox +25 %. |
| **Motisma** | Possession d'appareils | Bas B maintenu + direction = il entre dans un appareil (neutre micro-ondes, ↑ ventilateur, ↓ frigo, → tondeuse, ← machine à laver ; même direction = il en ressort et ÉJECTE l'appareil, qui fait mal). Chaque appareil change stats et B : Surchauffe (explosion autour de lui, il encaisse un peu), Essorage (saisie, tambour, Hydrocanon dans la direction choisie), Blizzard (gèle) + Chute de Frigo façon Thwomp, Bourrasque (vent sans dégâts), Coupe-Herbe (moteur chargé puis passage de tondeuse). Forme de base : Change Éclair (s'il touche, téléportation derrière l'adversaire + possession rechargée), très flottant. |
| **Minotaupe** | La foreuse et le sous-sol | B une fois = la perceuse monte en régime toute seule (fraise de dentiste), B à nouveau = il visse ; saut / bouclier / roulade = garde le régime ; régime max = bouclier cassé net et KO EN UN COUP à 100 %+. Côté B = Tour Rapide (éjection à 45°, détruit projectiles/pièges, Turbo 4 s, ~1 s avant de relancer une toupie qui a touché). Haut B = Forage dans l'angle choisi, éjecte dans son axe ; traverse le terrain par en dessous. Bas B = Tunnel : sous terre 1,5 s (aileron frappable) ; B = Foreuse Montante, A = Séisme (renverse tout le monde au sol), saut = bondit. Bas en l'air = Perceuse qui ENTERRE (1 à 3 s). Pelleteuse (smash avant vers l'arrière), Taupinière (dôme), Éboulis (rochers qui spikent au bord), Tranche (neutre en l'air, pointe des griffes = critique, son de tipper), Pioche (s'accroche au bord de loin), Perceuse arrière (hitbox qui dure tant que la foreuse tourne, tue tôt). Perforation : ×2 au bouclier, ignore l'armure. |
| **Évoli** | Évolution en combat | Voltali : aiguilles et éclairs, vitesse. Pyroli : tout brûle, pilier de feu, Boutefeu avec recul. Aquali : se liquéfie (intangible), bulles, geyser. Mentali : coups à distance, étourdit, Prescience. Noctali : poison, armure, Clair de Lune (soin). |

## Registre des propriétés (pour éviter les doublons)

- **Aspiration** : Mouscoto (principal), Miascarade (léger, avec retournement).
- **Recul / propulsion par tir** : Armarouge.
- **Coup retardé (écho)** : Malvalame (lame au même endroit, neutre et avant en l'air), Mentali (orbe derrière soi).
- **Lien / malédiction (dégâts partagés, vengeance au KO)** : Malvalame (Lien du Destin).
- **Orbitaux (projectiles qui tournent autour de soi)** : Malvalame (Feux Follets).
- **Déplacement intangible contrôlé** : Malvalame (Ombre Portée, au sol tant que B est tenu).
- **Zone de feu qui reste au sol** : Malvalame (geyser de la Lame Amère, braise du Fauchage).
- **Projectile qui roule au sol** : Obalie (Boule de Neige qui grossit, vagues du smash bas).
- **Projectile aérien** : Gromago (pièces), Archéduc (flèches vers le bas), Meloetta Chant (notes), Voltali (aiguilles), Aquali (bulles).
- **Rebond sur l'adversaire** : Gromago (ollie + pièces), Malvalame (Estoc Amer, soin), Obalie (Roulade qui accélère, plat ventre qui rebondit au sol).
- **Compteur sur soi** : Gromago (figures), Malvalame (Nitro + Armurouillée), Mouscoto (Gonflette), Obalie (niveau de Roulade).
- **Manger les projectiles** : Obalie (Mâchouille, se soigne).
- **Marque sur l'adversaire** : Miascarade (pétales), Malvalame (Lien du Destin, usage différent : malédiction temporaire).
- **Super armure** : Cizayox (Tête de Fer), Mouscoto (coude, smashs), Noctali.
- **Soin** : Mouscoto (drain), Malvalame (Lame Amère), Noctali (Clair de Lune).
- **Statuts** : brûlure (Armarouge, Pyroli, Malvalame feux follets / feu spectral), poison (Noctali), sommeil/étourdissement (Meloetta, Mentali), immobilisation (piège d'Archéduc).
- **Renvoi de projectiles** : Armarouge (dôme du neutre en l'air). (Gromago n'en a plus : son bas B est devenu le Coup de Planche.)
- **Spike / météore sur un spécial** : Gromago (Plongeon d'Or, bas B en l'air).
- **Vent sans dégâts (windbox)** : Motisma Hélice (Bourrasque).
- **Saisie spéciale avec éjection orientée au stick** : Motisma Lavage (Essorage).
- **Gel** : Motisma Froid (Blizzard).
- **Explosion qui blesse aussi le lanceur** : Motisma Chaleur (Surchauffe).
- **Changement de forme au bas B** : Évoli, Motisma (Motisma peut revenir à sa forme de base et éjecte l'appareil quitté).
- **Retournement** : Miascarade.
- **Intangibilité offensive** : Aquali (Acidarmure).

- **Perforation (×2 au bouclier, ignore la super armure)** : Minotaupe (coups de foreuse).
- **Sous terre / sous la surface du terrain (frappable, pas d'intangibilité)** : Minotaupe (Tunnel, Séisme, Foreuse Montante).
- **Entrer dans le terrain par dessous / par le côté** : Minotaupe (règle Foreur).
- **Enterrement** : Minotaupe (Perceuse, bas en l'air). Géré par le moteur (`f.v.buried`, buriedStep dans fighter.js) : se débattre fait sortir au mieux 1,5× plus vite.
- **Coup critique à la pointe (tipper)** : Minotaupe (Tranche, neutre en l'air : la pointe des griffes fait plus mal, son « tchiing » façon Marth dans Melee).
- **Charge stockée** : Cizayox (façon DK), Minotaupe (perceuse : règle commune des B chargés, KO en un coup au régime max à 100 %+).
- **Bonus de vitesse temporaire** : Minotaupe (Turbo après Tour Rapide).
- **Détruire les projectiles / pièges** : Minotaupe (Tour Rapide).
- **Prise du rebord à distance** : Minotaupe (Pioche).
- **Coup qui touche tous les adversaires au sol** : Minotaupe (Séisme depuis le sous-sol).

Encore libres : combo qui monte en puissance (type Taillade, testée puis retirée sur Insécateur), ralentissement, inversion des commandes, invocation d'alliés, avaler/recracher un projectile, terrain qui change, montée en puissance à chaque utilisation d'un même coup.

## Idées pour de futurs persos (propriétés encore libres)

- **Blancoton** — coton, poids plume. Ultra flottant (plusieurs sauts planés) mais meurt tôt. Effilochage : quand on le frappe, son coton s'envole et ralentit tout le monde autour. Spore Coton : touffes collantes qui ralentissent la cible. Cotogarde : boule de coton qui absorbe un coup puis éclate.
- **Nigosier** — avaler/recracher. Gobe-Missile : attrape un projectile ou un adversaire léger dans son bec et le recrache comme un missile. Plongeon (il revient avec un Embrochet dans le gosier).
- **Scalpereur** — invocation. Appelle 1 ou 2 Scalpion qui foncent ou gardent le bord ; plus il a d'alliés en jeu, plus il est lent mais tape fort.
- **Flâmigator** — montée en puissance. Chanson Flamme : chaque utilisation augmente ses dégâts spéciaux jusqu'à la mort ; il chante pour charger.
- **Pêchaminus** — contrôle. Chaîne de poison qui, à 3 marques, inverse les commandes de la cible pendant 2 s.

## Kits proposés à partir des idées de l'utilisateur (2026-10-01, à valider avant de coder)

- **Golemastoc** — golem géant. Signature : BOULET DE CANON (côté B). Il rentre ses membres, part comme un Bill Bourrin et se pilote au stick à 360° (il tourne lentement). Super armure pendant le vol, explosion à l'impact ; rappuyer sur B le fait exploser sur place. Haut B façon R.O.B. : réacteurs avec une jauge de carburant (on peut monter, s'arrêter, remonter), qui se recharge au sol. B = Poing Ombre (son poing part en missile chercheur et revient). Bas B = Séisme, qui ne touche que les adversaires au sol. Passif « Sceau » : au-delà de 100 %, le sceau de sa poitrine casse et il devient enragé (plus fort et plus rapide jusqu'à sa mort).
- **Obalie** — FAIT (voir le tableau). Kit d'origine : la boule. Signature : ROULADE. Il roule au lieu de courir et garde son élan, comme sur la glace. Côté B = Roulade : chaque rebond ou coup qui touche l'accélère et le rend plus fort, comme dans le jeu. Saut pendant la Roulade = rebond sur l'adversaire pour combo ; à pleine vitesse, c'est un coup qui tue. Bas B = Boul'Armure : il se met en boule (armure) et sa prochaine Roulade compte double. B = Mâchouille à la Wario : il croque l'adversaire, qui peut se débattre ; il peut aussi croquer les projectiles. Haut B = Geyser : rebond sur une grosse bulle. Coups tout ronds, peu de portée : battements de nageoires, toupie, bulles, Poudreuse.
- **Alakazam** — télépathe. Signature : CUILLÈRES = charges de téléportation (2). Bas B = Téléport de Poursuite : il apparaît à côté de l'adversaire qu'il vient de frapper pour continuer le combo (au-dessus, derrière, devant selon le stick) ; coûte 1 cuillère, qui revient en quelques secondes. B = cuillère-boomerang (Kinésie) : tant qu'elle n'est pas revenue, une charge de moins. Côté B = Mur Lumière : un mur qui bloque et renvoie les projectiles. Haut B = Téléport classique. Corps fragile, il lévite.
- **Charkos** — le bélier. Signature : ÉLAN. L'attaque en courant est un coup de tête dont la puissance monte avec le temps passé à courir ; à fond, elle casse les boucliers (Brise Moule) et tue tôt. Côté B = Coud'Krâne : il baisse la tête (super armure), charge puis fonce. Bas B = Fracass'Tête : énorme coup de tête qui tue, mais lui coûte 10 % de recul. B = Pouvoir Antique : pierres qui tournent autour de lui, puis tir. Petits bras : tout se fait avec la tête, la queue et les pieds.
- **Coquiperl / Serpang / Rosabyss** — bas B maintenu + direction : avant = Serpang (Dent Océan), arrière = Rosabyss (Écaille Océan), neutre = retour en Coquiperl. Les 3 formes restent utiles.
  - Coquiperl, le TANK PIÈGE : Claquoir = coquille ouverte en contre ; si on la frappe, elle se referme sur l'attaquant et le broie (contre-prise). B = tir de perle (puissant, il doit la ramasser). Côté B = Exuviation : il brise sa coquille et devient pendant 8 s beaucoup plus fort et rapide, mais prend +50 % de dégâts.
  - Serpang, le PRÉDATEUR AU CORPS À CORPS : morsures qui agrippent et secouent (Mâchouille). Leurre : il pose le bout de sa queue (un faux petit poisson) ; si l'adversaire s'en approche, Serpang jaillit dessus de loin. Long corps = fouets de queue à longue portée.
  - Rosabyss, le ZONEUR ÉLÉGANT : Laser Glace = rayon instantané qui traverse l'écran et ralentit ; Bulles d'O qui flottent ; Vampibaiser qui soigne ; aériens flottants.
- **Motisma** — FAIT (voir le tableau des persos actuels).
- **Spoink** — le ressort. Signature : FLIPPER. B maintenu = sa queue se recroqueville comme le lanceur d'un flipper ; plus on charge, plus la perle part fort. Elle REBONDIT sur le sol et les murs (ricochets) puis revient ; tant qu'elle n'est pas revenue, ses coups psy sont plus faibles. Il sautille en permanence, et maintenir le saut comprime le ressort (saut plus haut). Bas B = pilonnage : il fonce vers le bas et rebondit plus haut à chaque fois. Côté B = Rebond (grand bond qui écrase).
- **Tortank** — la forteresse. Signature : EAU QUI POUSSE SANS FRAPPER (façon J.E.T. de Mario : pas de hitstun, donc ça ne redonne pas son haut B à l'adversaire, parfait pour garder le bord). B = Hydrocanon des épaules, chargeable et orientable. Côté B = Tour Rapide : il glisse en tournant dans sa carapace (multi-coups, on peut sauter pendant) et ça DÉTRUIT les pièges et projectiles posés (piège d'Archéduc, bombe de Miascarade…). Haut B = tournoiement qui monte. Bas B = Repli : super armure et dégâts réduits.
- **Posipi & Négapi OU Famignol** — être à plusieurs (demande une nouvelle brique moteur : plusieurs corps pour un même joueur).
  - Posipi & Négapi : on en contrôle un, l'autre suit avec un léger retard (façon Ice Climbers). Haut B = l'un lance l'autre. Coup d'Main = l'un booste le prochain coup de l'autre. Quand les deux touchent la même cible (+ et −), COURT-CIRCUIT : explosion bonus.
  - Famignol : 4 souris. Chaque coup touche une fois par souris présente. B = Prolifération : rafale de 1 à 10 coups (part de chance, gros frisson quand ça fait 10). Quand on le frappe fort, une souris est sonnée quelques secondes (il tape moins). Elles peuvent se lancer entre elles.
  - Avis de Claude : Famignol est plus original (essaim + Prolifération) ; Posipi & Négapi est plus technique.

## Kit Minotaupe V2 (2026-10-02) — FAIT (voir le tableau des persos actuels)

V1 jugée trop bridée par l'utilisateur : la V2 garde le sous-sol et ajoute Tour Rapide, la perceuse qui se charge (vrai bruit de perceuse / fraise de dentiste), l'enterrement au bas en l'air et le Séisme.

**Signature : LA FOREUSE.** Une perceuse qu'on fait monter en régime, une foreuse dans les 4 directions, et le SOUS-SOL : pour lui, le terrain n'est pas un mur, c'est une porte. Monstre au sol, pataud en l'air.
- Stats : poids 112 (2e plus lourd), course rapide (1,95), lent en l'air (0,98), chute rapide, petits sauts, 2 sauts.
- Passif PERFORATION (coups ⚙ = tous ses coups de foreuse) : dégâts au bouclier ×2, la super armure ne les arrête pas.
- Règle FOREUR : si Tour Rapide ou Forage rencontre le terrain par en dessous ou par le côté, il entre dedans (passage en sous-sol).
- Son : chaque coup de foreuse fait un vrai bruit de perceuse ; la charge d'Empal'Korne monte dans les aigus comme une fraise de dentiste.

**Spéciaux**
- B : EMPAL'KORNE — LA PERCEUSE QUI MONTE EN RÉGIME. B une fois = la foreuse (casque + griffes) tourne de plus en plus vite toute seule (1,5 s jusqu'au régime max ; bruit de perceuse qui monte, étincelles, la pointe rougit) ; B à nouveau = il se fend (B B = tout de suite) ; stick arrière = demi-tour ; saut / roulade / bouclier = il GARDE le régime (règle commune des B chargés, 2026-10-02). Bouclier = il GARDE le régime (la foreuse continue de tourner au ralenti sur ses griffes, visible et audible : tout le monde sait qu'il est chargé). B = il se fend en avant : portée, nombre de tours de vissage et puissance selon le régime. La cible est vissée au bout de la foreuse (⚙) puis éjectée assez à l'horizontale (32°, éjection relevée puis +20 % à toutes les charges le 2026-10-02 ; KO centre / bord sur Mouscoto : ~246 / 188 % à vide, ~132 / 96 % à demi-régime, ~88 / 60 % au régime max : le bonus de +20 % redescend à +10 % entre le demi-régime et le max, pour qu'il tue avant 100 % sans rendre le KO en un coup inutile ; tous ces % sont ceux de la cible AVANT le coup, qui en ajoute ~25 % au régime max). RÉGIME MAX : un bouclier touché CASSE net, et une cible à 100 % ou plus est KO EN UN COUP (« EMPAL'KORNE ! », flash). Raté : gros lag (la foreuse tourne dans le vide).
- Côté B : TOUR RAPIDE. Il se roule en toupie-foreuse et file à l'horizontale (on peut le guider un peu) : multi-coups qui emportent la cible, puis l'éjectent en bout de course EN DIAGONALE VERS LE HAUT (45° ; KO ~180-250 % près du bord selon le poids). Le 10° demandé plus tôt le 2026-10-02 faisait une boucle 0 à la mort (cible à plat → à terre → reprise par la toupie suivante) : remonté à 45° + mini cooldown anti-infini, 65 frames avant de relancer une toupie QUI A TOUCHÉ (la cible a toujours ≥ 15 frames pour agir). Il DÉTRUIT les projectiles et les pièges qu'il touche (pièges d'Archéduc, bombe de Miascarade, boule de neige, feux follets…). Comme dans les jeux, il en ressort plus RAPIDE : +25 % de vitesse au sol et en l'air pendant 4 s. En l'air : retour horizontal ; s'il touche le côté du terrain, il entre dedans.
- Haut B : FORAGE. Foreuse lancée en ligne droite (distance +12 % le 2026-10-02 : ~49 u à la verticale, ~55 u à l'horizontale) dans la direction choisie, À 360° (2026-10-02 ; haut + B puis le stick oriente, lu de la frame 4 à la 7 ; au sol, pas plus bas que l'horizontale), qui visse la cible et l'ÉJECTE DANS SON AXE (en diagonale ou à l'horizontale : ça peut tuer par le côté ; vers le bas : spike). Vers le bas dans le terrain : il entre sous terre si le Tunnel est rechargé, sinon il se pose. Sous le terrain, il le TRAVERSE et passe en sous-sol (il revient sans passer par le rebord). C'est le finisher de ses jongles (KO ~115 %). Avec la perceuse chargée, il consomme le régime et devient bien plus fort (éjection -7,5 % le 2026-10-02 contre les jongles haut A → haut B ; mesuré sur Mouscoto au centre, depuis le sol : KO ~166 % à vide, ~118 % au régime max ; en jongle à 50 u du sol : ~126 % ; éjection de la version chargée réduite deux fois de 15 % le 2026-10-02, elle tuait à 48 %).
- Bas B : TUNNEL. Au sol, il passe sous terre ; sur une plateforme, il la perce vers le bas ; en l'air, il plonge vers le sol et s'y enfonce à l'atterrissage.

**Le sous-sol** (bloc principal uniquement) : 1,5 s max, il fonce plus vite qu'en courant. PAS invisible ni invincible : une bosse de terre avance et son casque dépasse comme un AILERON DE REQUIN ; l'aileron est sa hurtbox, un coup bas le touche et le déterre. 1,5 s avant de recreuser. Depuis le sous-sol :
- B ou haut B = FOREUSE MONTANTE : le sol gonfle 6 frames (signal) puis il JAILLIT en forant vers le haut (mesuré sur Mouscoto au centre : KO ~134 % à vide, ~98 % au régime max ; éjection de la version chargée réduite deux fois de 15 % le 2026-10-02, elle tuait à 46 %). PAS de chute libre ensuite (2026-10-02) : il garde son double saut et peut attaquer, faire haut B, etc. Quand il jaillit, une éruption au ras du sol soulève un adversaire ALLONGÉ (après Séisme) dans la foreuse : avant, la pointe lui passait au-dessus. Elle monte 20 % moins haut qu'avant (2026-10-02) : le combo Foreuse Montante → Forage tuait à 52-64 % ; il reste garanti aux bas % mais ne tue plus avant 90 %.
- A = SÉISME : il cogne le plafond de son tunnel ; des fissures parcourent la surface (14 frames de signal) puis une ONDE de 0,5 s (2026-10-02) : TOUS les adversaires posés sur le terrain principal, ceux qui y atterrissent pendant l'onde et ceux qui retombent en chute à moins de 12 unités du sol (pas vraiment en l'air, pas sur les plateformes) prennent 5 % et sont renversés, une fois chacun (projetés en l'air à haut %). Une fois par passage sous terre, et il reste sous terre : il peut ensuite jaillir sous la cible de son choix.
- Saut = il bondit hors du sol (garde son double saut). Fin du temps = il sort sans attaque.

**Smashs**
- Avant : PELLETEUSE (⚙). Il ramasse l'adversaire avec ses griffes et le jette PAR-DESSUS SON ÉPAULE (vers l'arrière). Au bord, dos au vide : KO ~95 %. Sur un adversaire enterré : il le déterre et le balance.
- Haut : TAUPINIÈRE. Une taupinière explose en dôme tout autour de lui (un gros coup). KO ~100 %.
- Bas : ÉBOULIS. Il frappe le sol et des rochers TOMBENT des deux côtés : au sol, l'adversaire rebondit très haut ; sous le bord, il est SPIKÉ.

**Aériens**
- Neutre : TRANCHE (remplace la Brasse le 2026-10-02). Griffe avant de haut en bas devant lui, puis griffe arrière de bas en haut derrière lui. La POINTE des griffes = COUP CRITIQUE (Tranche a un taux de critique élevé dans les jeux) : plus de dégâts, gros hitlag, trait de lumière et son « tchiing » façon tipper aérien de Marth dans Melee (KO ~120 % derrière, ~150 % devant, au bord). Près du corps = petit coup qui lance les combos ; de près, le 1er coup faible enchaîne sur le critique du 2e.
- Avant : PIOCHE (⚙). Gros coup de pioche (KO ~125 % au bord) ; comme un piolet, si la pointe touche le coin du terrain, il s'y accroche de loin.
- Arrière : PERCEUSE ARRIÈRE (⚙, remplace la Pelletée le 2026-10-02). La foreuse pointée derrière lui ; la hitbox dure TANT QU'ELLE TOURNE (frames 8 à 21). Début : KO ~88 % au bord ; fin : ~118 % (éjection réduite le 2026-10-02, elle tuait à 74 / 98 %).
- Haut : CASQUE PERFORANT (⚙). Coup de lame du casque vers le haut, rapide : le jongle avant le Forage.
- Bas : PERCEUSE (⚙). Foreuse pointée vers le bas, multi-coups qui emportent la cible vers le bas. Si la cible est au sol (ou y arrive pendant le forage) : ENTERRÉE (coincée dans le sol, plus longtemps à haut %, on secoue le stick pour sortir plus vite) et il rebondit dessus. Hors du terrain : le dernier coup SPIKE. Après un enterrement, la cible ne peut pas être ré-enterrée pendant 3 s (pas de boucle).

**Au sol** : jab griffe, griffe, coup de casque ; inclinaison avant Griffe Acier (orientable) ; haut griffes en ciseaux ; bas Gratte-Sol (rapide, envoie à 80° : lance les combos) ; attaque en course glissade casque en avant (⚙).
**Saisie** (portée +15 %) : avant lancer en pelle ; arrière par-dessus l'épaule (KO ~130 % au bord) ; haut lancé puis piqué au casque ; bas : il plaque et PLONGE SOUS TERRE juste sous la cible (2026-10-03 ; avant, 4 u derrière lui, la Foreuse Montante sortait à côté). Foreuse Montante tout de suite = GARANTIE (la cible plaquée n'a pas encore d'option) : KO ~104-140 % à vide, ~72-100 % perceuse chargée (Gromago-Mouscoto).

**Combos et kills** : Gratte-Sol → Casque ×2 → Forage ; Perceuse (bas en l'air) → enterré → Pelleteuse chargée, ou Empal'Korne au régime max (KO direct à 100 %+) ; sous terre : Séisme (tout le monde au sol) → Foreuse Montante sous la cible ; Tour Rapide → Turbo → pression ; lancer bas → tech-chase sous terre ; retour par en dessous → Séisme sur l'edgeguardeur.
**Faiblesses** : jonglé facilement (lourd, petits sauts) ; aileron frappable ; perceuse chargée visible et audible ; gros coups lents et punissables ; retour court loin du terrain ; pas de vrai projectile.
**Garde-fous** : Tour Rapide qui a touché = ~1 s avant la suivante (anti-boucle) ; sous-sol 1,5 s max et 1,5 s avant de recreuser ; Séisme une fois par passage ; enterrement immunisé 3 s ; KO en un coup seulement au régime max ET à 100 %+ ; Foreuse Montante : un seul double saut gardé (pas de saut en plus).
**Look (20/80)** : corps brun-gris sombre en poire, grand CASQUE D'ACIER argenté à lame dentelée, visage blanc avec nez rose et lignes rouges, marques rouges en éclair sur le ventre, énormes GRIFFES D'ACIER dentelées ; en mode foreuse, casque + griffes forment un cône qui tourne.
