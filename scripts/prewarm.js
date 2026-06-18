// ───────────────────────────────────────────────────────────────────────────
//  Pré-computa o DATASET de engradados (.cache/engradados) para TODOS os pares
//  gênero+ano válidos — os "20 mais conhecidos" reais de cada um. Depois disso
//  o jogo lê só do dataset: instantâneo e SEM álbuns fictícios, inclusive entre
//  reinícios. É resumível e PACIENTE: combinações que falham (503 do MusicBrainz)
//  ou vêm incompletas são tentadas de novo em passes seguintes.
//
//  Uso:  npm run prewarm
//  Pode demorar (respeita ~1 req/s do MusicBrainz). Deixe rodando.
// ───────────────────────────────────────────────────────────────────────────

const G = require('../src/gameData');
const MB = require('../src/musicbrainz');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function combosValidos() {
  const out = [];
  for (const g of G.GENEROS) {
    for (const ano of G.anosDoGenero(g)) out.push({ tag: g.tag, label: g.label, ano });
  }
  return out;
}

(async () => {
  let pendentes = combosValidos();
  const total = pendentes.length;
  const t0 = Date.now();
  let passe = 0;

  while (pendentes.length && passe < 8) {
    passe++;
    console.log(`\n──── Passe ${passe} · ${pendentes.length} combinação(ões) ────`);
    const falhas = [];
    let i = 0;
    for (const c of pendentes) {
      i++;
      const t = Date.now();
      let r;
      try { r = await MB.buscarEngradado(c.tag, c.label, c.ano); }
      catch (e) { r = { offline: true, albuns: [], erro: String(e.message || e) }; }
      const seg = ((Date.now() - t) / 1000).toFixed(1);

      if (r.offline || r.albuns.length < 6 || r.completo === false) {
        falhas.push(c);
        console.log(`[${i}/${pendentes.length}] ${c.label} ${c.ano}: ↻ refazer (${r.erro || (r.completo === false ? 'incompleto' : 'poucos')}) · ${seg}s`);
        await sleep(3000); // respira após falha (503)
      } else {
        const top = `${r.albuns[0].album} — ${r.albuns[0].artista}`;
        console.log(`[${i}/${pendentes.length}] ${c.label} ${c.ano}: ✓ ${r.albuns.length} · ${seg}s · ${top}`);
      }
    }
    pendentes = falhas;
    if (pendentes.length) {
      console.log(`\n${pendentes.length} ainda faltam; pausa de 30s antes do próximo passe…`);
      await sleep(30000);
    }
  }

  const feitos = total - pendentes.length;
  console.log(`\n${feitos}/${total} combinações no dataset · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  if (pendentes.length) {
    console.log(`Faltaram ${pendentes.length} (MusicBrainz teimoso). Rode de novo mais tarde para completar.`);
  } else {
    console.log('Dataset completo! O jogo abre instantâneo e nunca mostra álbuns fictícios.');
  }
})().catch((e) => {
  console.error('Falhou:', e);
  process.exit(1);
});
