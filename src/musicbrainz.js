// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — busca de álbuns reais no MusicBrainz
//
//  Tudo aqui roda no SERVIDOR. O MusicBrainz pede um User-Agent identificável
//  e limita a ~1 requisição por segundo por IP, então:
//    • as chamadas passam por uma fila que respeita o intervalo (rate limit);
//    • os engradados (ano+gênero) ficam em cache na memória do processo, pois
//      os dados de um álbum não mudam — assim repetições saem na hora.
//  As capas vêm do Cover Art Archive direto no <img> do cliente (URL no álbum),
//  então não gastam requisição do servidor.
// ───────────────────────────────────────────────────────────────────────────

const G = require('./gameData');

const VA_MBID = '89ad4ac3-39f7-470e-963a-56509c546377'; // "Various Artists"
const USER_AGENT = 'BatalhaDeVinis/1.0 (jogo educativo; https://localhost)';
const MB_GAP = 1100;     // ms mínimos entre chamadas ao MusicBrainz
const MIN_ALBUNS = 8;    // abaixo disso, o engradado é "magro" demais

const cache = new Map();   // 'tag|ano' -> engradado pronto
const pending = new Map(); // 'tag|ano' -> Promise em andamento (dedup)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fila serial que espaça as chamadas ao MusicBrainz (respeita o rate limit).
let corrente = Promise.resolve();
let ultima = 0;
function agendar(fn) {
  const exec = corrente.then(async () => {
    const espera = MB_GAP - (Date.now() - ultima);
    if (espera > 0) await sleep(espera);
    ultima = Date.now();
    return fn();
  });
  corrente = exec.then(() => {}, () => {}); // mantém a fila viva mesmo com erro
  return exec;
}

async function buscarGrupos(generoTag, ano) {
  const q =
    `tag:"${generoTag}" AND ` +
    `firstreleasedate:[${ano}-01-01 TO ${ano}-12-31] AND ` +
    `primarytype:album AND NOT secondarytype:compilation`;
  const url =
    'https://musicbrainz.org/ws/2/release-group' +
    `?query=${encodeURIComponent(q)}&fmt=json&limit=90`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('MusicBrainz ' + res.status);
    const data = await res.json();
    return data['release-groups'] || [];
  } finally {
    clearTimeout(t);
  }
}

// Filtra para discos "de verdade" (álbum de estúdio, com artista nomeado) e
// limita à quantidade do engradado, sem repetir o mesmo álbum.
function montarAlbuns(grupos, generoLabel, ano) {
  const vistos = new Set();
  const out = [];
  for (const g of grupos) {
    if (out.length >= G.ALBUNS_POR_ENGRADADO) break;
    if ((g['primary-type'] || '') !== 'Album') continue;
    if ((g['secondary-types'] || []).length) continue; // pula live/trilha/etc.

    const credito = g['artist-credit'] || [];
    const artista = credito
      .map((a) => (a.name || '') + (a.joinphrase || ''))
      .join('')
      .trim();
    const artId = credito[0] && credito[0].artist && credito[0].artist.id;
    if (!artista || artId === VA_MBID) continue;

    const titulo = (g.title || '').trim();
    if (!titulo) continue;

    const chave = (titulo + '~' + artista).toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    out.push(G.montarAlbum(g.id, titulo, artista, generoLabel, ano));
  }
  return out;
}

// Busca (com cache) o engradado de um par gênero+ano.
//   { ano, genero, generoTag, albuns:[...], offline:bool }
async function buscarEngradado(generoTag, generoLabel, ano) {
  const chave = generoTag + '|' + ano;
  if (cache.has(chave)) return cache.get(chave);
  if (pending.has(chave)) return pending.get(chave);

  const p = (async () => {
    try {
      const grupos = await agendar(() => buscarGrupos(generoTag, ano));
      const albuns = montarAlbuns(grupos, generoLabel, ano);
      const res = { ano, genero: generoLabel, generoTag, albuns, offline: false };
      cache.set(chave, res); // só cacheia sucesso
      return res;
    } catch (e) {
      // Sem rede / fora do ar: engradado de reserva para o jogo não travar.
      return {
        ano,
        genero: generoLabel,
        generoTag,
        albuns: G.engradadoFallback(generoLabel, ano),
        offline: true,
        erro: String((e && e.message) || e),
      };
    } finally {
      pending.delete(chave);
    }
  })();

  pending.set(chave, p);
  return p;
}

module.exports = { buscarEngradado, MIN_ALBUNS };
