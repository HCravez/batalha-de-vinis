// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — salas e regras
//  Lógica/estado do jogo. O server.js cuida dos sockets, timers e do envio
//  individualizado. A **avaliação** de cada disco (0–10) fica OCULTA na compra
//  e só viaja revelada na batalha e no fim.
//
//  Cada uma das 5 rodadas:
//    COMPRA  → garimpa engradados (20 mais conhecidos do gênero+ano) e compra.
//              Botão COMPRAR leva o disco e já abre o próximo engradado.
//              3 trocas de ano + 3 trocas de gênero por jogador, por rodada.
//    VENDA   → separa batalha × guardar (loja, até 5) e ordena pior→melhor.
//    BATALHA → rei-do-morro pela avaliação (revelada); mostra lucro/prejuízo.
//  No fim, vence o melhor ACERVO guardado (soma das avaliações).
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
    engradado: null,      // { ano, genero, generoTag, albuns[], offline }
    carregando: false,
    _sorteioPendente: null,
    rerollAnoRestante: G.REROLL_ANO,
    rerollGeneroRestante: G.REROLL_GENERO,
    comprados: [],        // discos comprados nesta rodada (com uid + pago)
    compraEncerrada: false,
    // venda (rodada atual)
    venda: null,          // { batalha:[uid...], guardar:[uid...] }
    vendaConfirmada: false,
    // acervo permanente
    loja: [],             // até LOJA_MAX discos guardados
    ultimaBatalha: null,
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

function comecarCompra(sala) {
  sala.fase = 'compra';
  for (const j of sala.jogadores) {
    j.engradado = null;
    j.carregando = false; // o server dispara o 1º sorteio logo em seguida
    j._sorteioPendente = null;
    j.rerollAnoRestante = G.REROLL_ANO;
    j.rerollGeneroRestante = G.REROLL_GENERO;
    j.comprados = [];
    j.compraEncerrada = false;
    j.venda = null;
    j.vendaConfirmada = false;
    j.ultimaBatalha = null;
  }
}

// ── Sorteio de engradado ─────────────────────────────────────────────────────
//   tipo: 'novo' (gênero+ano novos) | 'ano' (troca o ano) | 'genero' (troca o gênero)
function prepararSorteio(sala, playerId, tipo) {
  if (sala.fase !== 'compra') return { erro: 'Não dá para garimpar agora.' };
  const j = acharJogador(sala, playerId);
  if (!j) return { erro: 'Jogador não encontrado.' };
  if (j.compraEncerrada) return { erro: 'Você já encerrou as compras.' };
  if (j.carregando) return { erro: 'Calma, ainda estou garimpando…' };
  if (j.comprados.length >= G.COMPRA_MAX && tipo !== 'novo') {
    return { erro: `Caixa cheia: no máximo ${G.COMPRA_MAX} discos por rodada.` };
  }

  const atual = j.engradado;
  let genero, ano;

  if (tipo === 'ano') {
    if (!atual) return { erro: 'Abra um engradado primeiro.' };
    if (j.rerollAnoRestante <= 0) return { erro: 'Acabaram suas trocas de ano nesta rodada.' };
    genero = G.acharGenero(atual.generoTag) || G.generoAleatorio(null);
    ano = G.anoDoGenero(genero, atual.ano);
    j.rerollAnoRestante -= 1;
  } else if (tipo === 'genero') {
    if (!atual) return { erro: 'Abra um engradado primeiro.' };
    if (j.rerollGeneroRestante <= 0) return { erro: 'Acabaram suas trocas de gênero nesta rodada.' };
    genero = G.generoAleatorio(atual.generoTag);
    ano = G.anoDoGenero(genero, null);
    j.rerollGeneroRestante -= 1;
  } else {
    tipo = 'novo';
    genero = G.generoAleatorio(null);
    ano = G.anoDoGenero(genero, null);
  }

  j.carregando = true;
  j._sorteioPendente = { tipo, genero: { tag: genero.tag, label: genero.label }, ano };
  return { ok: true };
}

async function executarSorteio(sala, playerId) {
  const j = acharJogador(sala, playerId);
  if (!j || !j._sorteioPendente) return { erro: 'Nada para sortear.' };
  const ped = j._sorteioPendente;

  let res = await MB.buscarEngradado(ped.genero.tag, ped.genero.label, ped.ano);

  // Engradado magro: tenta de novo variando a dimensão livre.
  let tentativas = 0;
  while (!res.offline && res.albuns.length < MB.MIN_ALBUNS && tentativas < 4) {
    let genero = G.acharGenero(ped.genero.tag);
    if (ped.tipo === 'genero' || !genero) genero = G.generoAleatorio(ped.genero.tag);
    if (ped.tipo === 'novo') genero = G.generoAleatorio(null);
    const ano = G.anoDoGenero(genero, ped.ano);
    res = await MB.buscarEngradado(genero.tag, genero.label, ano);
    ped.genero = { tag: genero.tag, label: genero.label };
    ped.ano = ano;
    tentativas++;
  }

  if (!j._sorteioPendente) return { ok: true }; // estado mudou no meio

  j.engradado = {
    ano: res.ano,
    genero: res.genero,
    generoTag: res.generoTag,
    albuns: res.albuns.map((a) => ({ ...a })),
    offline: res.offline,
  };
  j.carregando = false;
  j._sorteioPendente = null;
  return { ok: true };
}

// ── Compra ──────────────────────────────────────────────────────────────────
// COMPRAR leva o disco escolhido e ESVAZIA o engradado (1 por engradado); o
// server abre o próximo logo em seguida.
function comprar(sala, playerId, mbid) {
  if (sala.fase !== 'compra') return { erro: 'Não dá para comprar agora.' };
  const j = acharJogador(sala, playerId);
  if (!j) return { erro: 'Jogador não encontrado.' };
  if (j.compraEncerrada) return { erro: 'Você já encerrou as compras.' };
  if (j.carregando || !j.engradado) return { erro: 'Espere o engradado abrir.' };
  if (j.comprados.length >= G.COMPRA_MAX) {
    return { erro: `Caixa cheia: no máximo ${G.COMPRA_MAX} discos por rodada.` };
  }
  const alvo = j.engradado.albuns.find((a) => a.mbid === mbid);
  if (!alvo) return { erro: 'Esse disco não está no engradado.' };
  if (alvo.valor > j.dinheiro) return { erro: 'Dinheiro insuficiente para esse disco.' };

  j.dinheiro -= alvo.valor;
  j.comprados.push({ ...alvo, uid: `${sala.code}-${sala._uid++}`, pago: alvo.valor });
  j.engradado = null; // engradado gasto — server abre o próximo
  return { ok: true, podeMais: j.comprados.length < G.COMPRA_MAX };
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

function forcarEncerrarDesconectados(sala) {
  for (const j of sala.jogadores) {
    if (!j.conectado) {
      j.compraEncerrada = true;
      j.carregando = false;
    }
  }
}

// ── Venda ────────────────────────────────────────────────────────────────────
function comecarVenda(sala) {
  sala.fase = 'venda';
  for (const j of sala.jogadores) {
    j.vendaConfirmada = false;
    const ordem = j.comprados
      .slice()
      .sort((a, b) => a.valor - b.valor) // palpite inicial: do mais barato ao mais caro
      .map((d) => d.uid);
    j.venda = { batalha: ordem, guardar: [] };
  }
}

function definirVenda(sala, playerId, arranjo) {
  if (sala.fase !== 'venda') return { erro: 'Não estamos na venda.' };
  const j = acharJogador(sala, playerId);
  if (!j) return { erro: 'Jogador não encontrado.' };

  const validos = new Set(j.comprados.map((d) => d.uid));
  const batalha = (arranjo && Array.isArray(arranjo.batalha) ? arranjo.batalha : []).filter((u) => validos.has(u));
  const guardar = (arranjo && Array.isArray(arranjo.guardar) ? arranjo.guardar : []).filter((u) => validos.has(u));

  const usados = new Set();
  const batClean = [];
  for (const u of batalha) if (!usados.has(u)) { usados.add(u); batClean.push(u); }
  const guaClean = [];
  for (const u of guardar) if (!usados.has(u)) { usados.add(u); guaClean.push(u); }
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
  acharJogador(sala, playerId).vendaConfirmada = true;
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

// ── Batalha (rei-do-morro pela avaliação) ────────────────────────────────────
function resolverBatalhaDeUm(ordem) {
  if (!ordem.length) return;
  ordem.forEach((d) => { d.vitorias = 0; });
  let campeao = ordem[0];
  for (let i = 1; i < ordem.length; i++) {
    const desafiante = ordem[i];
    if (desafiante.avaliacao > campeao.avaliacao) {
      desafiante.vitorias += 1;
      campeao = desafiante;
    } else {
      campeao.vitorias += 1;
    }
  }
  return campeao.uid;
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

    const campeaoFinal = resolverBatalhaDeUm(ordem);

    let ganho = 0;
    let investido = 0;
    const vendidos = ordem.map((d) => {
      const preco = precoRevenda(d);
      ganho += preco;
      investido += d.pago;
      return {
        uid: d.uid, mbid: d.mbid, album: d.album, artista: d.artista,
        genero: d.genero, ano: d.ano, capaUrl: d.capaUrl,
        avaliacao: d.avaliacao, valor: d.valor, pago: d.pago,
        vitorias: d.vitorias || 0, preco, lucro: preco - d.pago,
        campeao: d.uid === campeaoFinal,
      };
    });
    j.dinheiro += ganho;

    const vagas = G.LOJA_MAX - j.loja.length;
    const guardadosOk = guardados.slice(0, Math.max(0, vagas));
    for (const d of guardadosOk) {
      j.loja.push({
        mbid: d.mbid, album: d.album, artista: d.artista, genero: d.genero,
        ano: d.ano, capaUrl: d.capaUrl, avaliacao: d.avaliacao, valor: d.valor,
        rodada: sala.rodada,
      });
    }

    const resultado = {
      playerId: j.id,
      nome: j.nome,
      vendidos,
      campeaoFinal,
      guardados: guardadosOk.map((d) => ({
        mbid: d.mbid, album: d.album, artista: d.artista, genero: d.genero,
        ano: d.ano, capaUrl: d.capaUrl, avaliacao: d.avaliacao,
      })),
      ganho,
      investido,
      lucro: ganho - investido,
      dinheiro: j.dinheiro,
      acervo: pontosAcervo(j),
      lojaTamanho: j.loja.length,
    };
    j.ultimaBatalha = resultado;
    porJogador.push(resultado);
  }

  sala.fase = 'batalha';
  const payload = { rodada: sala.rodada, totalRodadas: sala.totalRodadas, jogadores: porJogador };
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
  return Math.round(
    j.loja.slice().sort((a, b) => b.avaliacao - a.avaliacao).slice(0, G.LOJA_MAX)
      .reduce((s, d) => s + d.avaliacao, 0) * 10
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
      loja: j.loja.slice().sort((a, b) => b.avaliacao - a.avaliacao).map((d) => ({ ...d })),
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
    j.rerollAnoRestante = G.REROLL_ANO;
    j.rerollGeneroRestante = G.REROLL_GENERO;
    j.comprados = [];
    j.compraEncerrada = false;
    j.venda = null;
    j.vendaConfirmada = false;
    j.loja = [];
    j.ultimaBatalha = null;
  }
}

// ── Visão individualizada ────────────────────────────────────────────────────
// A AVALIAÇÃO nunca é enviada antes da batalha. Dos rivais só vazam números.
function albumPublico(a) {
  return {
    mbid: a.mbid, uid: a.uid, album: a.album, artista: a.artista,
    genero: a.genero, ano: a.ano, capaUrl: a.capaUrl, valor: a.valor, pago: a.pago,
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
    const revelarLoja = sala.fase === 'fim';
    voce = {
      id: eu.id,
      nome: eu.nome || '',
      pronto: eu.pronto,
      dinheiro: eu.dinheiro,
      carregando: eu.carregando,
      compraEncerrada: eu.compraEncerrada,
      vendaConfirmada: eu.vendaConfirmada,
      rerollAnoRestante: eu.rerollAnoRestante,
      rerollGeneroRestante: eu.rerollGeneroRestante,
      comprados: eu.comprados.map(albumPublico),
      loja: eu.loja.map((d) => ({
        mbid: d.mbid, album: d.album, artista: d.artista, genero: d.genero,
        ano: d.ano, capaUrl: d.capaUrl, rodada: d.rodada,
        avaliacao: revelarLoja ? d.avaliacao : undefined,
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
            albuns: eu.engradado.albuns.map(albumPublico),
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
