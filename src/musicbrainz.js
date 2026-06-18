// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — busca de álbuns reais (MusicBrainz + ListenBrainz)
//
//  Para mostrar os 20 MAIS CONHECIDOS de um gênero+ano não basta pegar as
//  primeiras páginas do MusicBrainz: ele ordena por relevância de texto, não
//  por popularidade, e os álbuns famosos ficam espalhados até a última página.
//  Então paginamos TUDO e ordenamos pela audiência real do ListenBrainz.
//
//  Robustez: o MusicBrainz às vezes responde 503 (rate limit). Cada página é
//  tentada de novo algumas vezes; se ainda falhar, a paginação PARA e usamos os
//  álbuns reais já coletados — nunca jogamos fora o engradado inteiro por causa
//  de um 503. Só caímos no acervo fictício se não vier nenhum disco real.
//
//  Velocidade: a 1ª vez de cada combinação é lenta; o resultado vai pro CACHE
//  EM DISCO (.cache/engradados) e fica instantâneo para sempre. Um aquecedor em
//  segundo plano (aquecerEmFundo) preenche o cache nos tempos ociosos, com
//  prioridade MENOR que as buscas do jogo, então a espera some com o tempo.
//  `npm run prewarm` faz o mesmo de uma vez só.
// ───────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const G = require('./gameData');

const VA_MBID = '89ad4ac3-39f7-470e-963a-56509c546377'; // "Various Artists"
const USER_AGENT = 'BatalhaDeVinis/1.0 (jogo educativo; https://localhost)';
const MB_GAP = 1200;        // ms entre chamadas ao MusicBrainz (rate limit)
const MIN_ALBUNS = 6;       // abaixo disso o engradado é "magro" demais
const MAX_PAGINAS = 40;     // teto de páginas (100 cada) no fetch profundo
const GUARDAR_TOP = 24;     // itens crus salvos no cache (buffer sobre os 20)
const PAG_TENTATIVAS = 4;   // tentativas por página antes de desistir dela
const CACHE_VERSAO = 2;

const CACHE_DIR = path.join(__dirname, '..', '.cache', 'engradados');
const memCache = new Map();   // 'tag|ano' -> { v, tag, ano, itens, completo }
const pending = new Map();    // 'tag|ano' -> Promise
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Fila com prioridade (jogo=1, aquecedor=0), respeitando o rate limit ─────
const fila = [];
let processando = false;
let ultima = 0;
function agendar(fn, prioridade) {
  return new Promise((resolve, reject) => {
    fila.push({ fn, resolve, reject, prioridade: prioridade || 0 });
    bombear();
  });
}
async function bombear() {
  if (processando) return;
  processando = true;
  while (fila.length) {
    let m = 0;
    for (let i = 1; i < fila.length; i++) if (fila[i].prioridade > fila[m].prioridade) m = i;
    const tarefa = fila.splice(m, 1)[0];
    const espera = MB_GAP - (Date.now() - ultima);
    if (espera > 0) await sleep(espera);
    ultima = Date.now();
    try { tarefa.resolve(await tarefa.fn()); } catch (e) { tarefa.reject(e); }
  }
  processando = false;
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

// Uma página com algumas tentativas (503/timeout são transitórios). Devolve
// null se desistir — aí a paginação para e usamos o que já temos.
async function paginaResiliente(generoTag, ano, offset, prioridade) {
  for (let tent = 0; tent < PAG_TENTATIVAS; tent++) {
    try {
      return await agendar(() => buscarPagina(generoTag, ano, offset), prioridade);
    } catch (e) {
      if (tent < PAG_TENTATIVAS - 1) await sleep(1500 * (tent + 1)); // backoff
    }
  }
  return null;
}

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

// Pagina tudo (tolerando falhas), mede popularidade e fica com os mais ouvidos.
// `completo` = true só se chegou ao fim da lista sem desistir de nenhuma página.
async function fetchProfundo(generoTag, ano, prioridade) {
  const candidatos = [];
  const vistosMbid = new Set();
  const vistosChave = new Set();
  const lbPromises = [];
  let completo = false;

  for (let off = 0; off < MAX_PAGINAS * 100; off += 100) {
    const j = await paginaResiliente(generoTag, ano, off, prioridade);
    if (!j) break; // página falhou de vez → usa o que já coletou
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
    if (grupos.length < 100) { completo = true; break; }
  }

  const mapas = await Promise.all(lbPromises);
  const pop = Object.assign({}, ...mapas);
  const itens = candidatos
    .map((c) => {
      const pp = pop[c.mbid] || { users: 0, listens: 0 };
      return { mbid: c.mbid, album: c.album, artista: c.artista, users: pp.users, listens: pp.listens };
    })
    .filter((c) => c.users >= G.MIN_USUARIOS)
    .sort((a, b) => b.users - a.users || b.listens - a.listens)
    .slice(0, GUARDAR_TOP);

  return { v: CACHE_VERSAO, tag: generoTag, ano, geradoEm: Date.now(), itens, completo };
}

function montarEngradado(dados, generoLabel, ano) {
  const albuns = dados.itens
    .slice(0, G.ALBUNS_POR_ENGRADADO)
    .map((it) => G.montarAlbum(it.mbid, it.album, it.artista, generoLabel, ano, it.users, it.listens));
  return { ano, genero: generoLabel, generoTag: dados.tag, albuns, offline: false, completo: dados.completo !== false };
}

// Falha = SEM álbuns (nunca fictícios). Quem chama trata como "tente outra".
function falha(generoLabel, generoTag, ano, erro) {
  return { ano, genero: generoLabel, generoTag, albuns: [], offline: true, erro };
}

// Já existe dataset (cache) para esta combinação? (memória ou disco)
function temNoCache(generoTag, ano) {
  return memCache.has(generoTag + '|' + ano) || fs.existsSync(arquivoCache(generoTag, ano));
}

// Busca o engradado de um par gênero+ano (memória → disco → fetch profundo).
// prioridade: 1 = jogo (default) | 0 = aquecedor de fundo.
async function buscarEngradado(generoTag, generoLabel, ano, prioridade) {
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
      const dados = await fetchProfundo(generoTag, ano, prioridade == null ? 1 : prioridade);
      if (dados.itens.length >= MIN_ALBUNS) {
        // Só guarda no dataset (memória + disco) se a paginação foi COMPLETA —
        // um resultado parcial é mostrado, mas refeito depois para completar.
        if (dados.completo) {
          memCache.set(chave, dados);
          gravarDisco(generoTag, ano, dados);
        }
        return montarEngradado(dados, generoLabel, ano);
      }
      return falha(generoLabel, generoTag, ano, 'poucos discos reais');
    } catch (e) {
      return falha(generoLabel, generoTag, ano, String((e && e.message) || e));
    } finally {
      pending.delete(chave);
    }
  })();

  pending.set(chave, p);
  return p;
}

// Aquecedor em segundo plano: preenche o cache das combinações que faltam, com
// prioridade menor que o jogo. Pula o que já está em cache (disco ou memória).
let aquecendo = false;
async function aquecerEmFundo(combos) {
  if (aquecendo) return;
  aquecendo = true;
  const lista = combos.slice().sort(() => Math.random() - 0.5); // espalha os gêneros
  for (const c of lista) {
    const chave = c.tag + '|' + c.ano;
    if (memCache.has(chave) || lerDisco(c.tag, c.ano)) continue;
    try { await buscarEngradado(c.tag, c.label, c.ano, 0); } catch (_) {}
    await sleep(400);
  }
  aquecendo = false;
}

module.exports = { buscarEngradado, aquecerEmFundo, temNoCache, MIN_ALBUNS };
