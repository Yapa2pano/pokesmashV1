// Musiques en fichier (optionnel). Mets tes fichiers .ogg ou .mp3 dans ce dossier « musique », puis déclare-les ici.
//
// Clés possibles : 'menu' et l'identifiant d'un terrain :
//   champ (Champ de Bataille), final (Destination Finale), seracrawl (Dos de Séracrawl), torterra (Dos de Torterra),
//   ronflex (Ventre de Ronflex), petit (Petit Champ), arene (Arène)
//
// loopStart / loopEnd = points de boucle, en secondes (avec des décimales, ex. 12.384) :
//   - le début du morceau (avant loopStart) est joué une seule fois (l'intro),
//   - puis le passage loopStart → loopEnd se répète à l'infini, sans coupure.
//   Sans loopStart / loopEnd, tout le morceau boucle du début à la fin.
// vol = volume relatif (1 = normal, 0.6 = plus doux, 1.3 = plus fort).
//
// Le jeu doit être lancé avec « Lancer le jeu.bat » (le serveur) pour lire les fichiers ;
// sans fichier, ou sans serveur, c'est la musique synthétisée habituelle qui joue.
window.G = window.G || {};
G.MUSIC_FILES = {
  // seracrawl: { file: 'seracrawl.ogg', loopStart: 8.25, loopEnd: 96.5, vol: 1 },
  // menu: { file: 'menu.mp3', vol: 0.8 },
};
