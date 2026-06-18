// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — configuração de dados e modelo de notas/preço
//
//  Os álbuns são REAIS (vêm do MusicBrainz, em src/musicbrainz.js) e as capas
//  também (Cover Art Archive). As NOTAS, porém, não existem em nenhuma API
//  gratuita — Metacritic / AlbumOfTheYear / RateYourMusic não têm API livre.
//  Por isso a nota dos usuários e a nota da crítica são derivadas de forma
//  DETERMINÍSTICA do MBID do álbum: assim ficam estáveis (o mesmo disco vale
//  sempre o mesmo) e jogáveis, mas não são notas reais de verdade.
//
//  Dois valores por álbum, como na ideia do jogo:
//    • nota dos USUÁRIOS  → visível na compra, define o PREÇO (nota×10 ±25%).
//    • nota da CRÍTICA    → OCULTA até a batalha; decide quem vence e o acervo.
//  A crítica é correlacionada à dos usuários, mas com desvio — por isso o preço
//  é só uma pista ruidosa da qualidade real (aparecem gemas baratas e furadas).
// ───────────────────────────────────────────────────────────────────────────

// Gêneros sorteáveis: tag do MusicBrainz → rótulo exibido.
const GENEROS = [
  { tag: 'rock',        label: 'Rock' },
  { tag: 'pop',         label: 'Pop' },
  { tag: 'hip hop',     label: 'Hip-Hop' },
  { tag: 'jazz',        label: 'Jazz' },
  { tag: 'soul',        label: 'Soul' },
  { tag: 'funk',        label: 'Funk' },
  { tag: 'electronic',  label: 'Eletrônico' },
  { tag: 'punk',        label: 'Punk' },
  { tag: 'heavy metal', label: 'Metal' },
  { tag: 'folk',        label: 'Folk' },
  { tag: 'reggae',      label: 'Reggae' },
  { tag: 'blues',       label: 'Blues' },
  { tag: 'country',     label: 'Country' },
  { tag: 'disco',       label: 'Disco' },
];

const ANO_MIN = 1966;
const ANO_MAX = 2016;

const ALBUNS_POR_ENGRADADO = 20; // quantos discos aparecem no engradado
const DINHEIRO_INICIAL = 500;
const TOTAL_RODADAS = 5;
const LOJA_MAX = 5;   // teto de álbuns guardados na loja (acervo final)
const COMPRA_MAX = 10; // teto de compras por rodada
const COMPRA_MIN = 4;  // alvo recomendado por rodada

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

// Notas determinísticas a partir do MBID.
//   usuários: 2.6 – 9.6   (define o preço)
//   crítica:  usuários ± 1.7  (oculta; decide as batalhas)
function notasDe(mbid) {
  const usuarios = round1(2.6 + frac(mbid, 'u') * 7.0);
  const desvio = (frac(mbid, 'c') - 0.5) * 3.4; // ±1.7
  const critica = round1(clamp(usuarios + desvio, 1.0, 10.0));
  return { usuarios, critica };
}

// Preço = nota dos usuários × 10, variando ±25% (determinístico por MBID).
function precoDe(usuarios, mbid) {
  const fator = 0.75 + frac(mbid, 'p') * 0.5; // 0.75 – 1.25
  return Math.max(5, Math.round(usuarios * 10 * fator));
}

// Monta o objeto-álbum do jogo a partir de um MBID e metadados reais.
function montarAlbum(mbid, album, artista, generoLabel, ano) {
  const notas = notasDe(mbid);
  return {
    mbid,
    album,
    artista,
    genero: generoLabel,
    ano,
    capaUrl: `https://coverartarchive.org/release-group/${mbid}/front-250`,
    usuarios: notas.usuarios,
    critica: notas.critica,
    valor: precoDe(notas.usuarios, mbid),
  };
}

// ── Engradado de reserva (offline) ──────────────────────────────────────────
// Se o MusicBrainz estiver fora do ar, o jogo não trava: fabrica um engradado
// fictício do gênero/ano pedido (sem capa real — o cliente usa a arte gerada).
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
    const mbid = `offline-${semente}`;
    const alb = montarAlbum(mbid, `${a} ${b}`, art, generoLabel, ano);
    alb.capaUrl = null; // sem capa real
    out.push(alb);
  }
  return out;
}

module.exports = {
  GENEROS,
  ANO_MIN,
  ANO_MAX,
  ALBUNS_POR_ENGRADADO,
  DINHEIRO_INICIAL,
  TOTAL_RODADAS,
  LOJA_MAX,
  COMPRA_MAX,
  COMPRA_MIN,
  embaralhar,
  aleatorioInt,
  clamp,
  notasDe,
  precoDe,
  montarAlbum,
  engradadoFallback,
};
