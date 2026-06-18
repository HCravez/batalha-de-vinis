// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — salas e regras
//  Lógica pura do jogo. O server.js cuida dos sockets, timers e do envio de
//  estado individualizado (cada lojista só enxerga a própria caixa de discos).
// ───────────────────────────────────────────────────────────────────────────

const { RARIDADES, CATALOGO, embaralhar, montarDemandas, pontuar } = require('./gameData');

const MAO_INICIAL = 5; // discos por lojista → 4 batalhas + 1 disco no fim

function novaSala(code) {
  return {
    code,
    fase: 'lobby', // 'lobby' | 'jogo' | 'revelacao' | 'fim'
    hostId: null,
    rodada: 0,
    totalRodadas: MAO_INICIAL - 1,
    maoInicial: MAO_INICIAL,
    demandas: [],
    demandaAtual: null,
    jogadores: [], // { id, nome, socketId, conectado, pronto, dinheiro, mao[], jogadaAtual }
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

// Entrada/reconexão. Jogadores novos só entram no lobby; quem já estava na
// partida pode reconectar a qualquer momento e recupera a própria caixa.
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
    j = {
      id: playerId,
      nome: (nome || '').trim().slice(0, 18),
      socketId,
      conectado: true,
      pronto: false,
      dinheiro: 0,
      mao: [],
      jogadaAtual: null,
    };
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

function iniciar(sala) {
  if (sala.jogadores.length < 2) {
    return { erro: 'É preciso pelo menos 2 lojistas para abrir as portas.' };
  }
  if (!sala.jogadores.every((j) => j.pronto && j.nome)) {
    return { erro: 'Todos os lojistas precisam estar prontos.' };
  }
  const baralho = embaralhar(CATALOGO.map((c) => ({ ...c })));
  sala._uid = 0;
  for (const j of sala.jogadores) {
    j.mao = [];
    j.dinheiro = 0;
    j.jogadaAtual = null;
    for (let i = 0; i < sala.maoInicial; i++) {
      const carta = baralho.pop();
      carta.uid = `${sala.code}-${sala._uid++}`;
      j.mao.push(carta);
    }
  }
  sala.totalRodadas = sala.maoInicial - 1;
  sala.demandas = montarDemandas(sala.totalRodadas);
  sala.rodada = 1;
  sala.demandaAtual = sala.demandas[0];
  sala.fase = 'jogo';
  sala.ultimaRevelacao = null;
  sala.ultimoFim = null;
  return { ok: true };
}

// Lojista coloca um disco no balcão (escolha secreta). O disco sai da caixa.
function jogar(sala, playerId, uid) {
  if (sala.fase !== 'jogo') return { erro: 'Não dá para vender agora.' };
  const j = acharJogador(sala, playerId);
  if (!j) return { erro: 'Jogador não encontrado.' };
  if (j.jogadaAtual) return { erro: 'Você já colocou um disco no balcão.' };
  const idx = j.mao.findIndex((v) => v.uid === uid);
  if (idx < 0) return { erro: 'Esse disco não está na sua caixa.' };
  j.jogadaAtual = j.mao.splice(idx, 1)[0];
  return { ok: true };
}

function todosConectadosJogaram(sala) {
  const conectados = sala.jogadores.filter((j) => j.conectado);
  return conectados.length > 0 && conectados.every((j) => j.jogadaAtual);
}

// Quem caiu e ainda não jogou tem um disco sorteado para não travar a rodada.
function autoJogarDesconectados(sala) {
  for (const j of sala.jogadores) {
    if (!j.jogadaAtual && j.mao.length > 0) {
      const i = Math.floor(Math.random() * j.mao.length);
      j.jogadaAtual = j.mao.splice(i, 1)[0];
    }
  }
}

// Revela os discos do balcão, pontua pela demanda e paga os lojistas.
// Vencedor leva os pontos cheios; os demais fazem uma venda menor (valor / 2).
function resolverBatalha(sala) {
  const jogadas = sala.jogadores
    .filter((j) => j.jogadaAtual)
    .map((j) => ({
      playerId: j.id,
      nome: j.nome,
      vinil: j.jogadaAtual,
      pontos: pontuar(sala.demandaAtual, j.jogadaAtual),
    }));

  const maxPontos = jogadas.reduce((m, x) => Math.max(m, x.pontos), 0);
  const vencedores = jogadas.filter((x) => x.pontos === maxPontos).map((x) => x.playerId);

  const ganhos = {};
  for (const jd of jogadas) {
    const j = acharJogador(sala, jd.playerId);
    const ganho = vencedores.includes(jd.playerId)
      ? jd.pontos
      : Math.floor(jd.vinil.valor / 2);
    j.dinheiro += ganho;
    ganhos[jd.playerId] = ganho;
  }

  sala.fase = 'revelacao';
  const payload = {
    rodada: sala.rodada,
    totalRodadas: sala.totalRodadas,
    demanda: sala.demandaAtual,
    jogadas,
    vencedores,
    ganhos,
    dinheiro: Object.fromEntries(sala.jogadores.map((j) => [j.id, j.dinheiro])),
  };
  sala.ultimaRevelacao = payload;
  return payload;
}

// Avança para a próxima faixa, descartando os discos vendidos.
function proximaRodada(sala) {
  if (sala.rodada < sala.totalRodadas) {
    sala.rodada += 1;
    sala.demandaAtual = sala.demandas[sala.rodada - 1];
    for (const j of sala.jogadores) j.jogadaAtual = null;
    sala.fase = 'jogo';
    return { fim: false };
  }
  return { fim: true };
}

// Fim de jogo: revela o disco que sobrou na caixa de cada um (bônus de
// colecionador) e fecha a parada de sucessos.
function finalizar(sala) {
  for (const j of sala.jogadores) j.jogadaAtual = null;
  const maosFinais = sala.jogadores.map((j) => {
    const bonus = j.mao.reduce(
      (s, v) => s + Math.floor((v.valor * RARIDADES[v.raridade].mult) / 2),
      0
    );
    j.dinheiro += bonus;
    return { playerId: j.id, nome: j.nome, vinis: j.mao.slice(), bonus };
  });
  sala.fase = 'fim';
  const classificacao = sala.jogadores
    .map((j) => ({ playerId: j.id, nome: j.nome, dinheiro: j.dinheiro }))
    .sort((a, b) => b.dinheiro - a.dinheiro);
  const payload = { maosFinais, classificacao };
  sala.ultimoFim = payload;
  return payload;
}

function reiniciar(sala) {
  sala.fase = 'lobby';
  sala.rodada = 0;
  sala.demandas = [];
  sala.demandaAtual = null;
  sala.ultimaRevelacao = null;
  sala.ultimoFim = null;
  for (const j of sala.jogadores) {
    j.pronto = false;
    j.dinheiro = 0;
    j.mao = [];
    j.jogadaAtual = null;
  }
}

// Visão individualizada: o segredo do jogo vive aqui. Cada lojista recebe a
// própria caixa de discos por inteiro, mas dos rivais só vê QUANTOS discos
// restam — nunca quais. Os discos só viajam revelados na batalha e no fim.
function visao(sala, playerId) {
  const eu = acharJogador(sala, playerId);
  const mostraDemanda = sala.fase === 'jogo' || sala.fase === 'revelacao';
  return {
    code: sala.code,
    fase: sala.fase,
    rodada: sala.rodada,
    totalRodadas: sala.totalRodadas,
    demanda: mostraDemanda ? sala.demandaAtual : null,
    hostId: sala.hostId,
    souHost: sala.hostId === playerId,
    jogadores: sala.jogadores.map((j) => ({
      id: j.id,
      nome: j.nome || '',
      pronto: j.pronto,
      conectado: j.conectado,
      dinheiro: j.dinheiro,
      discosNaCaixa: j.mao.length,
      jogou: !!j.jogadaAtual,
      ehHost: sala.hostId === j.id,
      ehVoce: j.id === playerId,
    })),
    voce: eu
      ? {
          id: eu.id,
          nome: eu.nome || '',
          pronto: eu.pronto,
          dinheiro: eu.dinheiro,
          jaJoguei: !!eu.jogadaAtual,
          mao: sala.fase === 'lobby' ? [] : eu.mao.map((v) => ({ ...v })),
        }
      : null,
  };
}

module.exports = {
  MAO_INICIAL,
  novaSala,
  entrar,
  ficarPronto,
  removerJogador,
  iniciar,
  jogar,
  todosConectadosJogaram,
  autoJogarDesconectados,
  resolverBatalha,
  proximaRodada,
  finalizar,
  reiniciar,
  visao,
};
