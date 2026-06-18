// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — busca de álbuns reais (MusicBrainz + ListenBrainz)
//
//  Tudo roda no SERVIDOR. Pipeline de cada engradado (gênero + ano):
//    1. MusicBrainz: busca os release-groups do gênero+ano (1 requisição).
//    2. ListenBrainz: popularidade REAL em lote — quantos ouvintes/execuções
//       cada álbum tem (1–2 requisições). É o ranking de "mais conhecidos".
//    3. Mantém só quem tem audiência real, ordena pelos mais ouvidos e fica
//       com os 20 primeiros. A nota (avaliação) vem dessa audiência real.
//
//  MusicBrainz pede User-Agent e ~1 req/s; respeitamos com uma fila. Os
//  engradados ficam em cache na memória do processo (dados não mudam), então
//  repetições saem na hora. As capas vêm do Cover Art Archive direto no <img>.
// ───────────────────────────────────────────────────────────────────────────

const G = require('./gameData');

const VA_MBID = '89ad4ac3-39f7-470e-963a-56509c546377'; // "Various Artists"
const USER_AGENT = 'BatalhaDeVinis/1.0 (jogo educativo; https://localhost)';
const MB_GAP = 1100;     // ms mínimos entre chamadas ao MusicBrainz
const MIN_ALBUNS = 6;    // abaixo disso o engradado é "magro" demais

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
  corrente = exec.then(() => {}, () => {});
  return exec;
}

async function buscarGrupos(generoTag, ano) {
  const q =
    `tag:"${generoTag}" AND ` +
    `firstreleasedate:[${ano}-01-01 TO ${ano}-12-31] AND ` +
    `primarytype:album AND NOT secondarytype:compilation`;
  const url =
    'https://musicbrainz.org/ws/2/release-group' +
    `?query=${encodeURIComponent(q)}&fmt=json&limit=100`;

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

// Candidatos "de verdade": álbum de estúdio, com artista nomeado, sem repetir.
function candidatos(grupos) {
  const vistos = new Set();
  const out = [];
  for (const g of grupos) {
    if ((g['primary-type'] || '') !== 'Album') continue;
    if ((g['secondary-types'] || []).length) continue;
    const credito = g['artist-credit'] || [];
    const artista = credito.map((a) => (a.name || '') + (a.joinphrase || '')).join('').trim();
    const artId = credito[0] && credito[0].artist && credito[0].artist.id;
    if (!artista || artId === VA_MBID) continue;
    const titulo = (g.title || '').trim();
    if (!titulo) continue;
    const chave = (titulo + '~' + artista).toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({ mbid: g.id, album: titulo, artista });
  }
  return out;
}

// Popularidade real (ListenBrainz), em lotes de até 50 MBIDs.
async function popularidade(mbids) {
  const mapa = {};
  for (let i = 0; i < mbids.length; i += 50) {
    const lote = mbids.slice(i, i + 50);
    try {
      const res = await fetch('https://api.listenbrainz.org/1/popularity/release-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
        body: JSON.stringify({ release_group_mbids: lote }),
      });
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data.payload || [];
        for (const p of arr) {
          mapa[p.release_group_mbid] = {
            usuarios: p.total_user_count || 0,
            execucoes: p.total_listen_count || 0,
          };
        }
      }
    } catch (_) {
      /* sem popularidade neste lote: tudo bem, esses álbuns ficam de fora */
    }
    if (i + 50 < mbids.length) await sleep(250);
  }
  return mapa;
}

// Busca (com cache) o engradado de um par gênero+ano:
//   { ano, genero, generoTag, albuns:[...], offline:bool }
async function buscarEngradado(generoTag, generoLabel, ano) {
  const chave = generoTag + '|' + ano;
  if (cache.has(chave)) return cache.get(chave);
  if (pending.has(chave)) return pending.get(chave);

  const p = (async () => {
    try {
      const grupos = await agendar(() => buscarGrupos(generoTag, ano));
      const cand = candidatos(grupos);
      const pop = cand.length ? await popularidade(cand.map((c) => c.mbid)) : {};

      const albuns = cand
        .map((c) => {
          const pp = pop[c.mbid] || { usuarios: 0, execucoes: 0 };
          return { ...c, usuarios: pp.usuarios, execucoes: pp.execucoes };
        })
        .filter((c) => c.usuarios >= G.MIN_USUARIOS) // só com audiência real
        .sort((a, b) => b.usuarios - a.usuarios)      // os mais conhecidos primeiro
        .slice(0, G.ALBUNS_POR_ENGRADADO)
        .map((c) => G.montarAlbum(c.mbid, c.album, c.artista, generoLabel, ano, c.usuarios, c.execucoes));

      const res = { ano, genero: generoLabel, generoTag, albuns, offline: false };
      cache.set(chave, res); // só cacheia sucesso
      return res;
    } catch (e) {
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
