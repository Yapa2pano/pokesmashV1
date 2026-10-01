'use strict';
// Portraits officiels (artwork PokéAPI) chargés à la volée ; repli vectoriel si hors ligne.
(function (G) {
  const cache = {};
  const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';
  G.portraitURL = (id, shiny) => BASE + (shiny ? 'shiny/' : '') + id + '.png';
  G.portrait = (charId, form, shiny) => {
    const ch = G.CHARS[charId];
    if (!ch || !ch.dex) return null;
    const id = (form && ch.formDex && ch.formDex[form]) || ch.dex;
    const key = id + (shiny ? 's' : '');
    let e = cache[key];
    if (!e) {
      const img = new Image();
      e = cache[key] = { img, ok: false };
      img.onload = () => { e.ok = true; };
      img.onerror = () => { e.ok = false; e.err = true; };
      img.src = G.portraitURL(id, shiny);
    }
    return e.ok ? e.img : null;
  };
  G.preloadPortraits = () => { for (const id of G.CHAR_ORDER) G.portrait(id); };
})(window.G);
