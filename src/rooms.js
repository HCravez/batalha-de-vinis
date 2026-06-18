// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — salas e regras
//  Lógica pura/estado do jogo. O server.js cuida dos sockets, dos timers e do
//  envio individualizado (cada lojista só vê a própria caixa e suas notas; a
//  nota da crítica só viaja revelada na batalha e no fim).
//
//  Fluxo de cada uma das 5 rodadas:
//    COMPRA  → cada lojista garimpa engradados (ano+gênero) e compra discos.
//    VENDA   → separa o que vai à batalha e o que guardar; ordena pior→melhor.
//    BATALHA → rei-do-morro pela nota da crítica (oculta), revela e paga.
//  No fim, vence o melhor ACERVO guardado (soma das notas da crítica).
// ───────────────────────────────────────────────────────────────────────────

const G = require('./gameData');
const MB = require('./musicbrainz');

function novaSala(code) {
  return {
    code,
    fase: 'lobby', // 'lobby' | 'compra' | 'venda' | 'batalha' | 'fim'
    hostId: null,
    rodada: 0,
    totalRodadas: G.TOTAL_RODADAS,
    jogadores: [],
    ultimaRevelacao: null,
    ultimoFim: null,
    timerProxima: null,
    timerLimpeza: null,
    _uid: 0,
  };
}

function acharJogador(sala, id) {
  return sala.jogadores.find((j) => j.id === id);
}

function novoJogador(playerId, socketId, nome) {
  return {
    id: playerId,
    nome: (nome || '').trim().slice(0, 18),
    socketId,
    conectado: true,
    pronto: false,
    dinheiro: G.DINHEIRO_INICIAL,
    // compra (rodada atual)
    engradado: null,      // { ano, genero, generoTag, albuns[], comprado, rerollAno, rerollGenero, offline }
    carregando: false,    // buscando engradado no MusicBrainz
    _sorteioPendente: null,
    comprados: [],        // discos comprados nesta rodada (com uid)
    compraEncerrada: false,
    // venda (rodada atual)
    venda: null,          // { batalha:[uid...], guardar:[uid...] }
    vendaConfirmada: false,
    // acervo permanente
    loja: [],             // até LOJA_MAX discos guardados
    ultimaBatalha: null,  // resultado da última batalha (para reconexão)
  };
}

// ── Lobby / entrada ─────────────────────────────────────────────────────────
function entrar(sala, playerId, socketId, nome) {
  if (!playerId) return { erro: 'Identificação inválida.' };
  let j = acharJogador(sala, playerId);
  if (j) {
    j.conectado = true;
    j.socketId = socketId;
  } else {
    if (sala.fase !== 'lobby') {
      return { erro: 'A loja já abriu as portas. Espere a próxima partida.' };
    }
    if (sala.jogadores.length >= 6) {
      return { erro: 'A loja está lotada (máximo de 6 lojistas).' };
    }
    j = novoJogador(playerId, socketId, nome);
    sala.jogadores.push(j);
  }
  if (!sala.hostId) sala.hostId = j.id;
  return { ok: true, jogador: j };
}

function ficarPronto(sala, playerId, nome) {
  if (sala.fase !== 'lobby') return { erro: 'A partida já começou.' };
  const j = acharJogador(sala, playerId);
  if (!j) return { erro: 'Jogador não encontrado.' };
  const limpo = (nome || '').trim().slice(0, 18);
  j.nome = limpo || j.nome || `Lojista ${sala.jogadores.indexOf(j) + 1}`;
  j.pronto = true;
  return { ok: true };
}

function removerJogador(sala, playerId) {
  sala.jogadores = sala.jogadores.filter((j) => j.id !== playerId);
  if (sala.hostId === playerId) {
    const novo = sala.jogadores.find((j) => j.conectado) || sala.jogadores[0];
    sala.hostId = novo ? novo.id : null;
  }
}

// ── Início da partida ───────────────────────────────────────────────────────
function iniciar(sala) {
  if (sala.jogadores.length < 2) {
    return { erro: 'É preciso pelo menos 2 lojistas para abrir as portas.' };
  }
  if (!sala.jogadores.every((j) => j.pronto && j.nome)) {
    return { erro: 'Todos os lojistas precisam estar prontos.' };
  }
  sala._uid = 0;
  for (const j of sala.jogadores) {
    j.dinheiro = G.DINHEIRO_INICIAL;
    j.loja = [];
  }
  sala.rodada = 1;
  sala.ultimaRevelacao = null;
  sala.ultimoFim = null;
  comecarCompra(sala);
  return { ok: true };
}

// Prepara a fase de compra de uma rodada (zera o que é por rodada).
function comecarCompra(sala) {
  sala.fase = 'compra';
  for (const j of sala.jogadores) {
    j.engradado = null;
    j.carregando = false; // o server dispara o 1º sorteio logo em seguida
    j._sorteioPendente = null;
    j.comprados = [];
    j.compraEncerrada = false;
    j.venda = null;
    j.vendaConfirmada = false;
    j.ultimaBatalha = null;
  }
}

// ── Sorteio de engradado (ano + gênero) ─────────────────────────────────────
function generoAleatorio(exceto) {
  let g;
  do {
    g = G.GENEROS[G.aleatorioInt(0, G.GENEROS.length - 1)];
  } while (exceto && g.tag === exceto && G.GENEROS.length > 1);
  return g;
}
function anoAleatorio(exceto) {
  let a;
  do {
    a = G.aleatorioInt(G.ANO_MIN, G.ANO_MAX);
  } while (exceto && a === exceto);
  return a;
}

// Parte SÍNCRONA: valida o pedido e decide ano/gênero. O server emite o estado
// (mostrando "carregando") e em seguida chama executarSorteio (assíncrono).
//   tipo: 'novo' (ano+gênero novos) | 'ano' (troca só o ano) | 'genero' (só o gênero)
function prepararSorteio(sala, playerId, tipo) {
  if (sala.fase !== 'compra') return { erro: 'Não dá para garimpar agora.' };
  const j = acharJogador(sala, playerId);
  if (!j) return { erro: 'Jogador não encontrado.' };
  if (j.compraEncerrada) return { erro: 'Você já encerrou as compras.' };
  if (j.carregando) return { erro: 'Calma, ainda estou garimpando…' };

  const atual = j.engradado;
  let ano, genero;

  if (tipo === 'ano') {
    if (!atual) return { erro: 'Abra um engradado primeiro.' };
    if (atual.rerollAno) return { erro: 'Você já trocou o ano deste engradado.' };
    if (atual.comprado) return { erro: 'Engradado já usado — puxe o próximo.' };
    genero = { tag: atual.generoTag, label: atual.genero };
    ano = anoAleatorio(atual.ano);
  } else if (tipo === 'genero') {
    if (!atual) return { erro: 'Abra um engradado primeiro.' };
    if (atual.rerollGenero) return { erro: 'Você já trocou o gênero deste engradado.' };
    if (atual.comprado) return { erro: 'Engradado já usado — puxe o próximo.' };
    genero = generoAleatorio(atual.generoTag);
    ano = atual.ano;
  } else {
    tipo = 'novo';
    genero = generoAleatorio(null);
    ano = anoAleatorio(null);
  }

  j.carregando = true;
  j._sorteioPendente = {
    tipo,
    ano,
    genero,
    rerollAno: atual && tipo !== 'novo' ? atual.rerollAno || tipo === 'ano' : tipo === 'ano',
    rerollGenero: atual && tipo !== 'novo' ? atual.rerollGenero || tipo === 'genero' : tipo === 'genero',
  };
  return { ok: true };
}

// Parte ASSÍNCRONA: busca no MusicBrainz (com algumas tentativas para não cair
// num par "magro" demais) e fixa o engradado do lojista.
async function executarSorteio(sala, playerId) {
  const j = acharJogador(sala, playerId);
  if (!j || !j._sorteioPendente) return { erro: 'Nada para sortear.' };
  const ped = j._sorteioPendente;

  let res = await MB.buscarEngradado(ped.genero.tag, ped.genero.label, ped.ano);

  // Engradado magro: para 'novo', tenta outros pares antes de desistir.
  if (ped.tipo === 'novo') {
    let tentativas = 0;
    while (!res.offline && res.albuns.length < MB.MIN_ALBUNS && tentativas < 4) {
      const g = generoAleatorio(null);
      const a = anoAleatorio(null);
      res = await MB.buscarEngradado(g.tag, g.label, a);
      ped.genero = g;
      ped.ano = a;
      tentativas++;
    }
  }

  if (!j._sorteioPendente) return { ok: true }; // estado mudou no meio (ex.: reinício)

  j.engradado = {
    ano: res.ano,
    genero: res.genero,
    generoTag: res.generoTag,
    albuns: res.albuns.map((a) => ({ ...a })),
    comprado: false,
    rerollAno: ped.rerollAno,
    rerollGenero: ped.rerollGenero,
    offline: res.offline,
  };
  j.carregando = false;
  j._sorteioPendente = null;
  return { ok: true };
}

// ── Compra ──────────────────────────────────────────────────────────────────
function comprar(sala, playerId, mbid) {
  if (sala.fase !== 'compra') return { erro: 'Não dá para comprar agora.' };
  const j = acharJogador(sala, playerId);
  if (!j) return { erro: 'Jogador não encontrado.' };
  if (j.compraEncerrada) return { erro: 'Você já encerrou as compras.' };
  const eng = j.engradado;
  if (!eng) return { erro: 'Nenhum engradado aberto.' };
  if (eng.comprado) return { erro: 'Você já comprou neste engradado — puxe o próximo.' };
  if (j.comprados.length >= G.COMPRA_MAX) {
    return { erro: `Caixa cheia: no máximo ${G.COMPRA_MAX} discos por rodada.` };
  }
  const alvo = eng.albuns.find((a) => a.mbid === mbid);
  if (!alvo) return { erro: 'Esse disco não está no engradado.' };
  if (alvo.valor > j.dinheiro) return { erro: 'Dinheiro insuficiente para esse disco.' };

  j.dinheiro -= alvo.valor;
  const disco = { ...alvo, uid: `${sala.code}-${sala._uid++}`, pago: alvo.valor };
  j.comprados.push(disco);
  eng.comprado = true; // 1 compra por engradado
  return { ok: true, disco };
}

function encerrarCompras(sala, playerId) {
  if (sala.fase !== 'compra') return { erro: 'Não estamos na compra.' };
  const j = acharJogador(sala, playerId);
  if (!j) return { erro: 'Jogador não encontrado.' };
  j.compraEncerrada = true;
  j.carregando = false;
  j._sorteioPendente = null;
  return { ok: true };
}

function todosEncerraramCompra(sala) {
  const conectados = sala.jogadores.filter((j) => j.conectado);
  return conectados.length > 0 && conectados.every((j) => j.compraEncerrada);
}

// Quem caiu no meio da compra entra na venda com o que já tinha.
function forcarEncerrarDesconectados(sala) {
  for (const j of sala.jogadores) {
    if (!j.conectado) {
      j.compraEncerrada = true;
      j.carregando = false;
    }
  }
}

// ── Venda (separar batalha × guardar, ordenar) ──────────────────────────────
function comecarVenda(sala) {
  sala.fase = 'venda';
  for (const j of sala.jogadores) {
    j.vendaConfirmada = false;
    // pré-arranjo: tudo na batalha, ordenado pelo preço (palpite inicial)
    const ordem = j.comprados
      .slice()
      .sort((a, b) => a.valor - b.valor)
      .map((d) => d.uid);
    j.venda = { batalha: ordem, guardar: [] };
  }
}

function definirVenda(sala, playerId, arranjo) {
  if (sala.fase !== 'venda') return { erro: 'Não estamos na venda.' };
  const j = acharJogador(sala, playerId);
  if (!j) return { erro: 'Jogador não encontrado.' };

  const validos = new Set(j.comprados.map((d) => d.uid));
  const batalha = (arranjo && Array.isArray(arranjo.batalha) ? arranjo.batalha : [])
    .filter((u) => validos.has(u));
  const guardar = (arranjo && Array.isArray(arranjo.guardar) ? arranjo.guardar : [])
    .filter((u) => validos.has(u));

  // cada disco em exatamente um dos dois grupos
  const usados = new Set();
  const batClean = [];
  for (const u of batalha) { if (!usados.has(u)) { usados.add(u); batClean.push(u); } }
  const guaClean = [];
  for (const u of guardar) { if (!usados.has(u)) { usados.add(u); guaClean.push(u); } }
  // discos não citados vão para a batalha por padrão
  for (const d of j.comprados) if (!usados.has(d.uid)) batClean.push(d.uid);

  const vagas = G.LOJA_MAX - j.loja.length;
  if (guaClean.length > vagas) {
    return { erro: `Só cabem mais ${vagas} disco(s) na sua loja.` };
  }

  j.venda = { batalha: batClean, guardar: guaClean };
  return { ok: true };
}

function confirmarVenda(sala, playerId, arranjo) {
  const r = definirVenda(sala, playerId, arranjo);
  if (r.erro) return r;
  const j = acharJogador(sala, playerId);
  j.vendaConfirmada = true;
  return { ok: true };
}

function todosConfirmaramVenda(sala) {
  const conectados = sala.jogadores.filter((j) => j.conectado);
  return conectados.length > 0 && conectados.every((j) => j.vendaConfirmada);
}

function autoConfirmarDesconectados(sala) {
  for (const j of sala.jogadores) {
    if (!j.conectado && !j.vendaConfirmada) {
      if (!j.venda) j.venda = { batalha: j.comprados.map((d) => d.uid), guardar: [] };
      j.vendaConfirmada = true;
    }
  }
}

// ── Batalha (rei-do-morro pela nota da crítica) ─────────────────────────────
// Os discos entram na ordem definida (pior→melhor, no palpite). O campeão
// defende; quem tem crítica maior vence a batalha e assume. Cada vitória
// aumenta o valor de revenda; quem não vence nenhuma dá prejuízo.
function resolverBatalhaDeUm(ordem) {
  if (!ordem.length) return { passos: [], discos: [] };
  ordem.forEach((d) => { d.vitorias = 0; });
  const passos = [];
  let campeao = ordem[0];
  for (let i = 1; i < ordem.length; i++) {
    const desafiante = ordem[i];
    const desafianteVence = desafiante.critica > campeao.critica;
    if (desafianteVence) {
      desafiante.vitorias += 1;
      passos.push({ desafiante: desafiante.uid, campeao: campeao.uid, vencedor: desafiante.uid });
      campeao = desafiante;
    } else {
      campeao.vitorias += 1;
      passos.push({ desafiante: desafiante.uid, campeao: campeao.uid, vencedor: campeao.uid });
    }
  }
  return { passos, campeaoFinal: campeao.uid };
}

function precoRevenda(disco) {
  // 0 vitórias → 0.5× (prejuízo); cada vitória soma 0.6× sobre o preço de tabela.
  return Math.max(1, Math.round(disco.valor * (0.5 + 0.6 * (disco.vitorias || 0))));
}

function resolverVendas(sala) {
  const porJogador = [];

  for (const j of sala.jogadores) {
    const arr = j.venda || { batalha: j.comprados.map((d) => d.uid), guardar: [] };
    const mapa = new Map(j.comprados.map((d) => [d.uid, d]));

    const ordem = arr.batalha.map((u) => mapa.get(u)).filter(Boolean);
    const guardados = arr.guardar.map((u) => mapa.get(u)).filter(Boolean);

    const { passos, campeaoFinal } = resolverBatalhaDeUm(ordem);

    let ganho = 0;
    const vendidos = ordem.map((d) => {
      const preco = precoRevenda(d);
      ganho += preco;
      return {
        uid: d.uid, mbid: d.mbid, album: d.album, artista: d.artista,
        genero: d.genero, ano: d.ano, capaUrl: d.capaUrl,
        usuarios: d.usuarios, critica: d.critica, valor: d.valor, pago: d.pago,
        vitorias: d.vitorias || 0, preco, campeao: d.uid === campeaoFinal,
      };
    });
    j.dinheiro += ganho;

    // guarda no acervo (respeitando o teto, por garantia)
    const vagas = G.LOJA_MAX - j.loja.length;
    const guardadosOk = guardados.slice(0, Math.max(0, vagas));
    for (const d of guardadosOk) {
      j.loja.push({
        mbid: d.mbid, album: d.album, artista: d.artista, genero: d.genero,
        ano: d.ano, capaUrl: d.capaUrl, usuarios: d.usuarios, critica: d.critica,
        valor: d.valor, rodada: sala.rodada,
      });
    }

    const resultado = {
      playerId: j.id,
      nome: j.nome,
      vendidos,
      passos,
      campeaoFinal,
      guardados: guardadosOk.map((d) => ({
        mbid: d.mbid, album: d.album, artista: d.artista, genero: d.genero,
        ano: d.ano, capaUrl: d.capaUrl, usuarios: d.usuarios, critica: d.critica,
      })),
      ganho,
      dinheiro: j.dinheiro,
      acervo: pontosAcervo(j),
      lojaTamanho: j.loja.length,
    };
    j.ultimaBatalha = resultado;
    porJogador.push(resultado);
  }

  sala.fase = 'batalha';
  const payload = {
    rodada: sala.rodada,
    totalRodadas: sala.totalRodadas,
    jogadores: porJogador,
  };
  sala.ultimaRevelacao = payload;
  return payload;
}

// ── Avanço de rodada / fim ──────────────────────────────────────────────────
function proximaRodada(sala) {
  if (sala.rodada < sala.totalRodadas) {
    sala.rodada += 1;
    comecarCompra(sala);
    return { fim: false };
  }
  return { fim: true };
}

function pontosAcervo(j) {
  // soma das notas da crítica dos discos guardados (até LOJA_MAX).
  return Math.round(
    j.loja
      .slice()
      .sort((a, b) => b.critica - a.critica)
      .slice(0, G.LOJA_MAX)
      .reduce((s, d) => s + d.critica, 0) * 10
  ) / 10;
}

function mediaAcervo(j) {
  if (!j.loja.length) return 0;
  return Math.round((pontosAcervo(j) / Math.min(j.loja.length, G.LOJA_MAX)) * 10) / 10;
}

function finalizar(sala) {
  sala.fase = 'fim';
  const classificacao = sala.jogadores
    .map((j) => ({
      playerId: j.id,
      nome: j.nome,
      dinheiro: j.dinheiro,
      acervo: pontosAcervo(j),
      media: mediaAcervo(j),
      loja: j.loja
        .slice()
        .sort((a, b) => b.critica - a.critica)
        .map((d) => ({ ...d })),
    }))
    .sort((a, b) => b.acervo - a.acervo || b.dinheiro - a.dinheiro);

  const payload = { classificacao };
  sala.ultimoFim = payload;
  return payload;
}

function reiniciar(sala) {
  sala.fase = 'lobby';
  sala.rodada = 0;
  sala.ultimaRevelacao = null;
  sala.ultimoFim = null;
  for (const j of sala.jogadores) {
    j.pronto = false;
    j.dinheiro = G.DINHEIRO_INICIAL;
    j.engradado = null;
    j.carregando = false;
    j._sorteioPendente = null;
    j.comprados = [];
    j.compraEncerrada = false;
    j.venda = null;
    j.vendaConfirmada = false;
    j.loja = [];
    j.ultimaBatalha = null;
  }
}

// ── Visão individualizada (o segredo do jogo vive aqui) ─────────────────────
// Cada lojista recebe seu engradado, suas compras e sua loja — mas a NOTA DA
// CRÍTICA dos discos nunca é enviada antes da batalha. Dos rivais só vazam
// números (dinheiro, quantos discos, acervo), nunca quais discos.
function limparAlbum(a) {
  // versão pública: sem a nota da crítica.
  return {
    mbid: a.mbid, uid: a.uid, album: a.album, artista: a.artista,
    genero: a.genero, ano: a.ano, capaUrl: a.capaUrl,
    usuarios: a.usuarios, valor: a.valor, pago: a.pago,
  };
}

function visao(sala, playerId) {
  const eu = acharJogador(sala, playerId);

  const jogadores = sala.jogadores.map((j) => ({
    id: j.id,
    nome: j.nome || '',
    pronto: j.pronto,
    conectado: j.conectado,
    dinheiro: j.dinheiro,
    ehHost: sala.hostId === j.id,
    ehVoce: j.id === playerId,
    compraEncerrada: j.compraEncerrada,
    vendaConfirmada: j.vendaConfirmada,
    carregando: j.carregando,
    comprados: j.comprados.length,
    lojaTamanho: j.loja.length,
    acervo: sala.fase === 'fim' ? pontosAcervo(j) : undefined,
  }));

  let voce = null;
  if (eu) {
    voce = {
      id: eu.id,
      nome: eu.nome || '',
      pronto: eu.pronto,
      dinheiro: eu.dinheiro,
      carregando: eu.carregando,
      compraEncerrada: eu.compraEncerrada,
      vendaConfirmada: eu.vendaConfirmada,
      comprados: eu.comprados.map(limparAlbum),
      loja: eu.loja.map((d) => ({
        mbid: d.mbid, album: d.album, artista: d.artista, genero: d.genero,
        ano: d.ano, capaUrl: d.capaUrl, usuarios: d.usuarios, rodada: d.rodada,
        // crítica só no fim
        critica: sala.fase === 'fim' ? d.critica : undefined,
      })),
      lojaMax: G.LOJA_MAX,
      compraMax: G.COMPRA_MAX,
      compraMin: G.COMPRA_MIN,
      venda: eu.venda,
      engradado: eu.engradado
        ? {
            ano: eu.engradado.ano,
            genero: eu.engradado.genero,
            offline: eu.engradado.offline,
            comprado: eu.engradado.comprado,
            rerollAno: eu.engradado.rerollAno,
            rerollGenero: eu.engradado.rerollGenero,
            albuns: eu.engradado.albuns.map(limparAlbum),
          }
        : null,
    };
  }

  return {
    code: sala.code,
    fase: sala.fase,
    rodada: sala.rodada,
    totalRodadas: sala.totalRodadas,
    hostId: sala.hostId,
    souHost: sala.hostId === playerId,
    jogadores,
    voce,
  };
}

module.exports = {
  novaSala,
  entrar,
  ficarPronto,
  removerJogador,
  iniciar,
  comecarCompra,
  prepararSorteio,
  executarSorteio,
  comprar,
  encerrarCompras,
  todosEncerraramCompra,
  forcarEncerrarDesconectados,
  comecarVenda,
  definirVenda,
  confirmarVenda,
  todosConfirmaramVenda,
  autoConfirmarDesconectados,
  resolverVendas,
  proximaRodada,
  finalizar,
  reiniciar,
  visao,
};
