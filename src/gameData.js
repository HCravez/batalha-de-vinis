// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — configuração de dados e modelo de avaliação/preço
//
//  Os álbuns e as capas são REAIS (MusicBrainz + Cover Art Archive). Cada
//  engradado mostra os **20 mais conhecidos** daquele gênero+ano, ranqueados
//  por dados REAIS de audiência do **ListenBrainz** (quantos usuários ouviram e
//  quantas execuções) — ver src/musicbrainz.js.
//
//  Cada álbum tem UM parâmetro de qualidade: a **avaliação** (0–10), derivada
//  da popularidade real (não é um número aleatório). Nota da crítica "de
//  verdade" (Metacritic/RYM) não existe em API gratuita; a avaliação por
//  audiência real é a melhor aproximação possível sem chaves de API.
//
//  A avaliação fica **OCULTA na fase de compra** — só o PREÇO (avaliação×10,
//  ±25%) é uma pista. Ela é revelada na batalha e decide tudo: quem vence e o
//  acervo final.
// ───────────────────────────────────────────────────────────────────────────

const ANO_MIN = 1960;
const ANO_MAX = 2026;

// Gêneros sorteáveis, cada um restrito às décadas em que faz sentido.
//   tag   → tag de busca no MusicBrainz
//   label → nome exibido
//   decadas → décadas liberadas (anos = [década, década+9] ∩ [ANO_MIN, ANO_MAX])
const TODAS_DECADAS = [1960, 1970, 1980, 1990, 2000, 2010, 2020];
const GENEROS = [
  { tag: 'rock',             label: 'Rock',        decadas: TODAS_DECADAS },
  { tag: 'pop',              label: 'Pop',         decadas: TODAS_DECADAS },
  { tag: 'hip hop',          label: 'Hip-Hop',     decadas: [1990, 2000, 2010, 2020] },
  { tag: 'electronic',       label: 'Eletrônico',  decadas: [1980, 1990, 2000, 2010, 2020] },
  { tag: 'jazz',             label: 'Jazz',        decadas: [1960] },
  { tag: 'metal',            label: 'Metal',       decadas: [1980, 1990, 2000, 2010, 2020] },
  { tag: 'punk',             label: 'Punk',        decadas: [1980, 1990, 2000, 2010, 2020] },
  { tag: 'disco',            label: 'Disco',       decadas: [1980] },
  { tag: 'blues',            label: 'Blues',       decadas: [1960] },
  { tag: 'alternative rock', label: 'Alternativo', decadas: [1980, 1990, 2000, 2010, 2020] },
];

const ALBUNS_POR_ENGRADADO = 20;
const DINHEIRO_INICIAL = 500;
const TOTAL_RODADAS = 5;
const LOJA_MAX = 5;       // teto de álbuns guardados (acervo final)
const COMPRA_MAX = 10;    // teto de compras por rodada
const COMPRA_MIN = 4;     // alvo recomendado por rodada
const REROLL_ANO = 3;     // trocas de ano por jogador por rodada
const REROLL_GENERO = 3;  // trocas de gênero por jogador por rodada
const MIN_USUARIOS = 2;   // mínimo de ouvintes reais p/ entrar no engradado

// ── Utilidades ──────────────────────────────────────────────────────────────
function embaralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function aleatorioInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

// hash FNV-1a determinístico (com tempero) → fração [0,1)
function frac(str, sal) {
  let h = 0x811c9dc5;
  const s = (sal || '') + '·' + String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// ── Sorteio de gênero e ano ──────────────────────────────────────────────────
function acharGenero(tag) {
  return GENEROS.find((g) => g.tag === tag) || null;
}
function generoAleatorio(exTag) {
  let g;
  do {
    g = GENEROS[aleatorioInt(0, GENEROS.length - 1)];
  } while (exTag && g.tag === exTag && GENEROS.length > 1);
  return g;
}
// Ano válido para o gênero: sorteia uma das décadas liberadas e um ano dentro.
function anoDoGenero(genero, exAno) {
  const decadas = genero.decadas || TODAS_DECADAS;
  let ano;
  let tentativas = 0;
  do {
    const dec = decadas[aleatorioInt(0, decadas.length - 1)];
    const lo = Math.max(ANO_MIN, dec);
    const hi = Math.min(ANO_MAX, dec + 9);
    ano = aleatorioInt(lo, hi);
    tentativas++;
  } while (exAno && ano === exAno && tentativas < 12);
  return ano;
}

// ── Modelo de avaliação (a partir da audiência real do ListenBrainz) ─────────
//   usuarios = ouvintes distintos | execucoes = total de plays
//   famoso (milhares de ouvintes) → ~9–10 | conhecido → ~6–8 | fringe → ~3–4
function avaliacaoDe(usuarios, execucoes) {
  const mapU = Math.min(10, (Math.log10((usuarios || 0) + 1) / 4.0) * 10);
  const mapL = Math.min(10, (Math.log10((execucoes || 0) + 1) / 5.5) * 10);
  const a = 0.65 * mapU + 0.35 * mapL;
  return round1(clamp(a, 1.5, 10));
}

// Preço = avaliação × 10, variando ±25% (determinístico por MBID).
function precoDe(avaliacao, mbid) {
  const fator = 0.75 + frac(mbid, 'p') * 0.5; // 0.75 – 1.25
  return Math.max(5, Math.round(avaliacao * 10 * fator));
}

// Monta o objeto-álbum do jogo (avaliacao fica oculta do cliente até a batalha).
function montarAlbum(mbid, album, artista, generoLabel, ano, usuarios, execucoes) {
  const avaliacao = avaliacaoDe(usuarios, execucoes);
  return {
    mbid,
    album,
    artista,
    genero: generoLabel,
    ano,
    capaUrl: `https://coverartarchive.org/release-group/${mbid}/front-250`,
    avaliacao,
    valor: precoDe(avaliacao, mbid),
    usuarios: usuarios || 0,
    execucoes: execucoes || 0,
  };
}

// ── Engradado de reserva (offline) ──────────────────────────────────────────
const PALAVRAS_A = ['Trovão', 'Néon', 'Asfalto', 'Eclipse', 'Veludo', 'Fumaça', 'Maré', 'Pulso',
  'Cinzas', 'Aurora', 'Concreto', 'Sereno', 'Vertigem', 'Lanterna', 'Câmbio', 'Estática'];
const PALAVRAS_B = ['de Cobre', 'Particular', 'sem Saída', 'da Madrugada', 'Mecânica', 'Sintética',
  'em Lá Menor', 'Infinito', 'de Vitrine', 'Distante', 'do Subsolo', 'Provisório', 'de Carbono'];
const ARTISTAS_F = ['Os Cometas', 'Trio Penumbra', 'Lobo de Neon', 'Clube Veludo', 'Módulo Lunar',
  'Banda Estilhaço', 'Coral Aurora', 'Vetor & Vértice', 'As Hienas', 'Caravana Selvagem'];

function engradadoFallback(generoLabel, ano) {
  const out = [];
  for (let i = 0; i < ALBUNS_POR_ENGRADADO; i++) {
    const semente = `${generoLabel}-${ano}-${i}`;
    const a = PALAVRAS_A[Math.floor(frac(semente, 'a') * PALAVRAS_A.length)];
    const b = PALAVRAS_B[Math.floor(frac(semente, 'b') * PALAVRAS_B.length)];
    const art = ARTISTAS_F[Math.floor(frac(semente, 'r') * ARTISTAS_F.length)];
    // avaliação fictícia determinística (sem audiência real disponível)
    const av = round1(clamp(2.6 + frac(semente, 'v') * 7, 1.5, 10));
    const alb = {
      mbid: `offline-${semente}`,
      album: `${a} ${b}`,
      artista: art,
      genero: generoLabel,
      ano,
      capaUrl: null,
      avaliacao: av,
      valor: Math.max(5, Math.round(av * 10 * (0.75 + frac(semente, 'p') * 0.5))),
      usuarios: 0,
      execucoes: 0,
    };
    out.push(alb);
  }
  return out;
}

module.exports = {
  ANO_MIN,
  ANO_MAX,
  GENEROS,
  ALBUNS_POR_ENGRADADO,
  DINHEIRO_INICIAL,
  TOTAL_RODADAS,
  LOJA_MAX,
  COMPRA_MAX,
  COMPRA_MIN,
  REROLL_ANO,
  REROLL_GENERO,
  MIN_USUARIOS,
  embaralhar,
  aleatorioInt,
  clamp,
  acharGenero,
  generoAleatorio,
  anoDoGenero,
  avaliacaoDe,
  precoDe,
  montarAlbum,
  engradadoFallback,
};
