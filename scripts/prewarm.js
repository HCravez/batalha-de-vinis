// ───────────────────────────────────────────────────────────────────────────
//  Pré-aquece o cache de engradados (.cache/engradados) para TODOS os pares
//  gênero+ano válidos. A primeira busca de cada combinação é lenta (pagina o
//  MusicBrainz inteiro); depois fica instantânea no jogo, inclusive entre
//  reinícios. É resumível: combinações já em cache passam na hora.
//
//  Uso:  npm run prewarm
//  Pode levar bastante tempo (respeita ~1 req/s do MusicBrainz). Deixe rodando.
// ───────────────────────────────────────────────────────────────────────────

const G = require('../src/gameData');
const MB = require('../src/musicbrainz');

function combosValidos() {
  const out = [];
  for (const g of G.GENEROS) {
    const anos = new Set();
    for (const dec of g.decadas) {
      for (let y = Math.max(G.ANO_MIN, dec); y <= Math.min(G.ANO_MAX, dec + 9); y++) anos.add(y);
    }
    for (const ano of [...anos].sort((a, b) => a - b)) out.push({ tag: g.tag, label: g.label, ano });
  }
  return out;
}

(async () => {
  const combos = combosValidos();
  console.log(`Pré-aquecendo ${combos.length} combinações (gênero+ano)…\n`);
  const t0 = Date.now();
  let i = 0;
  for (const c of combos) {
    i++;
    const t = Date.now();
    let r;
    try {
      r = await MB.buscarEngradado(c.tag, c.label, c.ano);
    } catch (e) {
      console.log(`[${i}/${combos.length}] ${c.label} ${c.ano}: ERRO ${e.message}`);
      continue;
    }
    const seg = ((Date.now() - t) / 1000).toFixed(1);
    const top = (r.albuns[0] && `${r.albuns[0].album} — ${r.albuns[0].artista}`) || '(vazio)';
    console.log(
      `[${i}/${combos.length}] ${c.label} ${c.ano}: ${r.albuns.length} álbuns` +
      `${r.offline ? ' (OFFLINE)' : ''} · ${seg}s · top: ${top}`
    );
  }
  console.log(`\nPronto em ${((Date.now() - t0) / 60000).toFixed(1)} min. Cache em .cache/engradados/`);
})().catch((e) => {
  console.error('Falhou:', e);
  process.exit(1);
});
