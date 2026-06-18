// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — busca de álbuns reais (MusicBrainz + ListenBrainz)
//
//  Para mostrar os 20 MAIS CONHECIDOS de um gênero+ano não basta pegar as
//  primeiras páginas do MusicBrainz: ele ordena por relevância de texto, não
//  por popularidade, e os álbuns famosos ficam espalhados até a última página
//  (ex.: em "rock 1988" há 2693 discos e o Surfer Rosa está lá na página 17).
//
//  Então o pipeline é:
//    1. MusicBrainz: pagina TODOS os release-groups do gênero+ano.
//    2. ListenBrainz: popularidade REAL (ouvintes/execuções) de cada um.
//    3. Ordena pelos mais ouvidos e fica com os 20 — os de verdade famosos.
//
//  Isso leva ~5–40s na PRIMEIRA vez de cada combinação, então o resultado é
//  gravado em CACHE EM DISCO (.cache/engradados): depois disso, é instantâneo —
//  inclusive entre reinícios. Rode `npm run prewarm` para preencher tudo de uma
//  vez. As capas vêm do Cover Art Archive direto no <img> do cliente.
// ───────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const G = require('./gameData');

const VA_MBID = '89ad4ac3-39f7-470e-963a-56509c546377'; // "Various Artists"
const USER_AGENT = 'BatalhaDeVinis/1.0 (jogo educativo; https://localhost)';
const MB_GAP = 1100;        // ms entre chamadas ao MusicBrainz (rate limit)
const MIN_ALBUNS = 6;       // abaixo disso o engradado é "magro" demais
const MAX_PAGINAS = 40;     // teto de páginas (100 cada) no fetch profundo
const GUARDAR_TOP = 24;     // itens crus salvos no cache (buffer sobre os 20)
const CACHE_VERSAO = 2;

const CACHE_DIR = path.join(__dirname, '..', '.cache', 'engradados');
const memCache = new Map();   // 'tag|ano' -> { v, tag, ano, itens }
const pending = new Map();    // 'tag|ano' -> Promise
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Fila serial que respeita o rate limit do MusicBrainz ────────────────────
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

// ── Cache em disco ──────────────────────────────────────────────────────────
function arquivoCache(tag, ano) {
  return path.join(CACHE_DIR, tag.replace(/[^a-z0-9]+/gi, '_') + '-' + ano + '.json');
}
function lerDisco(tag, ano) {
  try {
    const dados = JSON.parse(fs.readFileSync(arquivoCache(tag, ano), 'utf8'));
    if (dados && dados.v === CACHE_VERSAO && Array.isArray(dados.itens)) return dados;
  } catch (_) { /* sem cache */ }
  return null;
}
function gravarDisco(tag, ano, dados) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(arquivoCache(tag, ano), JSON.stringify(dados));
  } catch (_) { /* segue sem persistir */ }
}

// ── Requisições ─────────────────────────────────────────────────────────────
async function buscarPagina(generoTag, ano, offset) {
  const q =
    `tag:"${generoTag}" AND ` +
    `firstreleasedate:[${ano}-01-01 TO ${ano}-12-31] AND ` +
    `primarytype:album AND NOT secondarytype:compilation`;
  const url =
    'https://musicbrainz.org/ws/2/release-group' +
    `?query=${encodeURIComponent(q)}&fmt=json&limit=100&offset=${offset}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('MusicBrainz ' + res.status);
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

// candidatos "de verdade" de uma página (álbum de estúdio, artista nomeado)
function candidatosDaPagina(grupos) {
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
    out.push({ mbid: g.id, album: titulo, artista });
  }
  return out;
}

// popularidade real (ListenBrainz), lotes de 50; tolera falhas
async function popularidadeLote(mbids) {
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
            users: p.total_user_count || 0,
            listens: p.total_listen_count || 0,
          };
        }
      }
    } catch (_) { /* esses ficam de fora */ }
    if (i + 50 < mbids.length) await sleep(120);
  }
  return mapa;
}

// Fetch profundo: pagina tudo, mede popularidade em paralelo, fica com os mais
// ouvidos. Retorna os itens CRUS (sem nota/preço) para o cache resistir a
// mudanças no modelo de avaliação.
async function fetchProfundo(generoTag, ano) {
  const candidatos = [];
  const vistosMbid = new Set();
  const vistosChave = new Set();
  const lbPromises = [];

  for (let off = 0; off < MAX_PAGINAS * 100; off += 100) {
    const j = await agendar(() => buscarPagina(generoTag, ano, off));
    const grupos = j['release-groups'] || [];
    const novos = [];
    for (const c of candidatosDaPagina(grupos)) {
      if (vistosMbid.has(c.mbid)) continue;
      const chave = (c.album + '~' + c.artista).toLowerCase();
      if (vistosChave.has(chave)) continue;
      vistosMbid.add(c.mbid);
      vistosChave.add(chave);
      novos.push(c);
      candidatos.push(c);
    }
    if (novos.length) lbPromises.push(popularidadeLote(novos.map((c) => c.mbid)));
    if (grupos.length < 100) break;
  }

  const mapas = await Promise.all(lbPromises);
  const pop = Object.assign({}, ...mapas);

  const itens = candidatos
    .map((c) => {
      const pp = pop[c.mbid] || { users: 0, listens: 0 };
      return { mbid: c.mbid, album: c.album, artista: c.artista, users: pp.users, listens: pp.listens };
    })
    .filter((c) => c.users >= G.MIN_USUARIOS)
    .sort((a, b) => b.users - a.users || b.listens - a.listens) // mais conhecidos primeiro
    .slice(0, GUARDAR_TOP);

  return { v: CACHE_VERSAO, tag: generoTag, ano, geradoEm: Date.now(), itens };
}

// Monta o engradado jogável a partir dos itens crus (recalcula nota/preço).
function montarEngradado(dados, generoLabel, ano) {
  const albuns = dados.itens
    .slice(0, G.ALBUNS_POR_ENGRADADO)
    .map((it) => G.montarAlbum(it.mbid, it.album, it.artista, generoLabel, ano, it.users, it.listens));
  return { ano, genero: generoLabel, generoTag: dados.tag, albuns, offline: false };
}

// Busca o engradado de um par gênero+ano (memória → disco → fetch profundo).
async function buscarEngradado(generoTag, generoLabel, ano) {
  const chave = generoTag + '|' + ano;

  if (memCache.has(chave)) return montarEngradado(memCache.get(chave), generoLabel, ano);

  const disco = lerDisco(generoTag, ano);
  if (disco) {
    memCache.set(chave, disco);
    return montarEngradado(disco, generoLabel, ano);
  }

  if (pending.has(chave)) return pending.get(chave);

  const p = (async () => {
    try {
      const dados = await fetchProfundo(generoTag, ano);
      memCache.set(chave, dados);
      gravarDisco(generoTag, ano, dados);
      return montarEngradado(dados, generoLabel, ano);
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
