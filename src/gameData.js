// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — dados do jogo
//  Catálogo de discos (fictícios, de propósito) e cartas de demanda.
// ───────────────────────────────────────────────────────────────────────────

const RARIDADES = {
  comum:    { rotulo: 'Comum',    mult: 1, cor: '#b8a89a' },
  raro:     { rotulo: 'Raro',     mult: 2, cor: '#4f8cff' },
  lendario: { rotulo: 'Lendário', mult: 4, cor: '#ffc83d' },
};

// Cada disco: álbum, artista, gênero, raridade, valor de tabela, ano.
const CATALOGO = [
  // ── Rock ──────────────────────────────────────────────────────────────
  { album: 'Trovão de Veludo',     artista: 'Os Cometas de Aço',    genero: 'Rock',        raridade: 'comum',    valor: 32,  ano: 1974 },
  { album: 'Asfalto Quente',       artista: 'Lobo de Neon',         genero: 'Rock',        raridade: 'comum',    valor: 28,  ano: 1981 },
  { album: 'Distorção Azul',       artista: 'As Hienas Elétricas',  genero: 'Rock',        raridade: 'comum',    valor: 38,  ano: 1977 },
  { album: 'Cavalo de Ferro',      artista: 'Caravana Selvagem',    genero: 'Rock',        raridade: 'raro',     valor: 58,  ano: 1972 },
  { album: 'Eclipse na Garagem',   artista: 'Pólvora & Mel',        genero: 'Rock',        raridade: 'raro',     valor: 66,  ano: 1969 },
  { album: 'Rei do Feedback',      artista: 'Vulcão Particular',    genero: 'Rock',        raridade: 'lendario', valor: 110, ano: 1971 },

  // ── Jazz ──────────────────────────────────────────────────────────────
  { album: 'Fumaça de Meia-Noite', artista: 'Trio Penumbra',        genero: 'Jazz',        raridade: 'comum',    valor: 30,  ano: 1959 },
  { album: 'Café com Sétima',      artista: 'Otto Marès',           genero: 'Jazz',        raridade: 'comum',    valor: 36,  ano: 1963 },
  { album: 'Chuva no Saxofone',    artista: 'Quinteto Marfim',      genero: 'Jazz',        raridade: 'comum',    valor: 42,  ano: 1958 },
  { album: 'Boêmia em Lá Menor',   artista: 'Dália Sextante',       genero: 'Jazz',        raridade: 'raro',     valor: 62,  ano: 1956 },
  { album: 'Sussurro de Baixo',    artista: 'Clube Veludo',         genero: 'Jazz',        raridade: 'raro',     valor: 74,  ano: 1961 },
  { album: 'O Último Improviso',   artista: 'Mestre Cordovil',      genero: 'Jazz',        raridade: 'lendario', valor: 125, ano: 1954 },

  // ── Soul ──────────────────────────────────────────────────────────────
  { album: 'Coração de Cobre',     artista: 'As Pérolas do Beco',   genero: 'Soul',        raridade: 'comum',    valor: 34,  ano: 1968 },
  { album: 'Suor & Açúcar',        artista: 'Banda Brasa Viva',     genero: 'Soul',        raridade: 'comum',    valor: 29,  ano: 1972 },
  { album: 'Domingo de Veludo',    artista: 'Íris Calhau',          genero: 'Soul',        raridade: 'comum',    valor: 40,  ano: 1970 },
  { album: 'Beijo de Cetim',       artista: 'Os Embaixadores',      genero: 'Soul',        raridade: 'raro',     valor: 60,  ano: 1967 },
  { album: 'Gospel da Madrugada',  artista: 'Coro Aurora',          genero: 'Soul',        raridade: 'raro',     valor: 70,  ano: 1965 },
  { album: 'A Voz do Bairro',      artista: 'Lurdes & Os Apóstolos',genero: 'Soul',        raridade: 'lendario', valor: 105, ano: 1969 },

  // ── MPB ───────────────────────────────────────────────────────────────
  { album: 'Maré de Abril',        artista: 'Caju Sereno',          genero: 'MPB',         raridade: 'comum',    valor: 33,  ano: 1979 },
  { album: 'Folha Seca',           artista: 'Trio Sertão Azul',     genero: 'MPB',         raridade: 'comum',    valor: 27,  ano: 1975 },
  { album: 'Beira de Rio',         artista: 'Anita Cravo',          genero: 'MPB',         raridade: 'comum',    valor: 39,  ano: 1982 },
  { album: 'Sol de Ladeira',       artista: 'Tonho Maré',           genero: 'MPB',         raridade: 'raro',     valor: 57,  ano: 1973 },
  { album: 'Recado da Lua',        artista: 'Cláudia Caramujo',     genero: 'MPB',         raridade: 'raro',     valor: 69,  ano: 1977 },
  { album: 'Saudade Mecânica',     artista: 'Wilson Tamarindo',     genero: 'MPB',         raridade: 'lendario', valor: 100, ano: 1972 },

  // ── Eletrônico ────────────────────────────────────────────────────────
  { album: 'Néon Líquido',         artista: 'Circuito Fantasma',    genero: 'Eletrônico',  raridade: 'comum',    valor: 35,  ano: 1998 },
  { album: 'Pulso 808',            artista: 'Garotos do Subsolo',   genero: 'Eletrônico',  raridade: 'comum',    valor: 31,  ano: 2001 },
  { album: 'Satélite Caído',       artista: 'Módulo Lunar',         genero: 'Eletrônico',  raridade: 'comum',    valor: 44,  ano: 1995 },
  { album: 'Cidade Sintética',     artista: 'Vetor & Vértice',      genero: 'Eletrônico',  raridade: 'raro',     valor: 64,  ano: 1999 },
  { album: 'Reverb Infinito',      artista: 'Estado Sólido',        genero: 'Eletrônico',  raridade: 'raro',     valor: 78,  ano: 1993 },
  { album: 'Aurora Binária',       artista: 'Coração de Silício',   genero: 'Eletrônico',  raridade: 'lendario', valor: 120, ano: 1990 },

  // ── Punk ──────────────────────────────────────────────────────────────
  { album: 'Cuspe & Confete',      artista: 'Os Encrenca',          genero: 'Punk',        raridade: 'comum',    valor: 26,  ano: 1979 },
  { album: 'Beco sem Saída',       artista: 'Vira-Lata Geral',      genero: 'Punk',        raridade: 'comum',    valor: 24,  ano: 1982 },
  { album: 'Alarme Falso',         artista: 'As Seringas',          genero: 'Punk',        raridade: 'comum',    valor: 37,  ano: 1980 },
  { album: 'Última Garagem',       artista: 'Motim 77',             genero: 'Punk',        raridade: 'raro',     valor: 55,  ano: 1977 },
  { album: 'Pogo na Praça',        artista: 'Banda Estilhaço',      genero: 'Punk',        raridade: 'raro',     valor: 63,  ano: 1983 },
  { album: 'Manifesto Rasgado',    artista: 'Os Inomináveis',       genero: 'Punk',        raridade: 'lendario', valor: 95,  ano: 1978 },

  // ── Pop ───────────────────────────────────────────────────────────────
  { album: 'Brilho de Plástico',   artista: 'Lia Confete',          genero: 'Pop',         raridade: 'comum',    valor: 30,  ano: 1986 },
  { album: 'Coração Pixel',        artista: 'Duo Bombom',           genero: 'Pop',         raridade: 'comum',    valor: 28,  ano: 1992 },
  { album: 'Verão Sintético',      artista: 'As Estrelinhas',       genero: 'Pop',         raridade: 'comum',    valor: 41,  ano: 1988 },
  { album: 'Dança da Fita',        artista: 'Rômulo Glitter',       genero: 'Pop',         raridade: 'raro',     valor: 59,  ano: 1985 },
  { album: 'Refrão Grudento',      artista: 'Banda Vitrine',        genero: 'Pop',         raridade: 'raro',     valor: 67,  ano: 1990 },
  { album: 'Ídolo de Vitrine',     artista: 'Sancho Vega',          genero: 'Pop',         raridade: 'lendario', valor: 102, ano: 1987 },

  // ── Hip-Hop ───────────────────────────────────────────────────────────
  { album: 'Concreto & Rima',      artista: 'Coletivo Quebrada',    genero: 'Hip-Hop',     raridade: 'comum',    valor: 33,  ano: 1994 },
  { album: 'Batida do Viaduto',    artista: 'MC Zóio',              genero: 'Hip-Hop',     raridade: 'comum',    valor: 29,  ano: 1997 },
  { album: 'Caderno de Versos',    artista: 'Sampa Profundo',       genero: 'Hip-Hop',     raridade: 'comum',    valor: 43,  ano: 1999 },
  { album: 'Ouro de Tampinha',     artista: 'Crew Calçada',         genero: 'Hip-Hop',     raridade: 'raro',     valor: 61,  ano: 1996 },
  { album: 'Sermão de Esquina',    artista: 'DJ Catraca',           genero: 'Hip-Hop',     raridade: 'raro',     valor: 72,  ano: 1993 },
  { album: 'Lenda do Boombox',     artista: 'Velho Griô',           genero: 'Hip-Hop',     raridade: 'lendario', valor: 115, ano: 1991 },
];

const GENEROS = [...new Set(CATALOGO.map((c) => c.genero))];

// ── Cartas de demanda ───────────────────────────────────────────────────────
// Cada carta define COMO os discos são pontuados na batalha daquela rodada.
//   tipo 'genero'   → disco do gênero pedido vale 3×; os outros, 1×.
//   tipo 'raridade' → vale (valor × multiplicador de raridade).
//   tipo 'valor'    → vale o valor de tabela puro (maior preço leva).
const DEMANDAS_GENERO = {
  Rock:         { titulo: 'A FREGUESIA QUER ROCK',   sub: 'Disco de rock vende por 3× hoje' },
  Jazz:         { titulo: 'NOITE DE JAZZ',           sub: 'Disco de jazz vende por 3× hoje' },
  Soul:         { titulo: 'A PEDIDA É SOUL',         sub: 'Disco de soul vende por 3× hoje' },
  MPB:          { titulo: 'TARDE DE MPB',            sub: 'Disco de MPB vende por 3× hoje' },
  'Eletrônico': { titulo: 'A PISTA PEDE ELETRÔNICO', sub: 'Disco eletrônico vende por 3× hoje' },
  Punk:         { titulo: 'NOITE PUNK NO BAIRRO',    sub: 'Disco punk vende por 3× hoje' },
  Pop:          { titulo: 'HORA DO POP',             sub: 'Disco pop vende por 3× hoje' },
  'Hip-Hop':    { titulo: 'O ROLÊ QUER HIP-HOP',     sub: 'Disco de hip-hop vende por 3× hoje' },
};

const DEMANDA_RARIDADE = {
  tipo: 'raridade',
  titulo: 'CAÇADORES DE RARIDADE',
  sub: 'Vale valor × raridade — raro 2×, lendário 4×',
};

const DEMANDA_VALOR = {
  tipo: 'valor',
  titulo: 'QUEM TEM O DISCO MAIS CARO LEVA',
  sub: 'Vence o maior valor de tabela',
};

function cartaDeGenero(genero) {
  return { tipo: 'genero', genero, ...DEMANDAS_GENERO[genero] };
}

function embaralhar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Monta a sequência de demandas da partida.
// Garante sempre uma rodada de raridade e uma de valor; o resto, gêneros
// sorteados. A ordem final é embaralhada para a arena não ficar previsível.
function montarDemandas(total) {
  const cartas = [];
  if (total >= 2) {
    cartas.push(DEMANDA_RARIDADE, DEMANDA_VALOR);
  }
  const generos = embaralhar(GENEROS);
  while (cartas.length < total) {
    cartas.push(cartaDeGenero(generos[(cartas.length) % generos.length]));
  }
  return embaralhar(cartas).slice(0, total);
}

// Pontuação de um disco diante da demanda da rodada.
function pontuar(demanda, vinil) {
  if (!demanda || !vinil) return 0;
  if (demanda.tipo === 'genero') {
    return vinil.valor * (vinil.genero === demanda.genero ? 3 : 1);
  }
  if (demanda.tipo === 'raridade') {
    return vinil.valor * RARIDADES[vinil.raridade].mult;
  }
  return vinil.valor; // 'valor'
}

module.exports = {
  RARIDADES,
  CATALOGO,
  GENEROS,
  embaralhar,
  montarDemandas,
  pontuar,
};
