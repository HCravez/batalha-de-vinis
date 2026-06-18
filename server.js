// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — servidor
//  Express serve as páginas; Socket.IO conduz as salas em tempo real.
//  Rotas:  /          → vitrine (criar/entrar numa loja)
//          /:codigo   → a sala de batalha
//  Os dados dos discos (álbuns reais + capas) vêm do MusicBrainz / Cover Art
//  Archive em src/musicbrainz.js — sempre do lado do servidor.
// ───────────────────────────────────────────────────────────────────────────

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const R = require('./src/rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PUBLIC = path.join(__dirname, 'public');
app.use(express.static(PUBLIC));

app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));

// Qualquer /CODIGO abre a sala (ignora caminhos com ponto, que são arquivos).
app.get('/:code', (req, res, next) => {
  if (req.params.code.includes('.')) return next();
  res.sendFile(path.join(PUBLIC, 'sala.html'));
});

// ── Salas em memória ────────────────────────────────────────────────────────
const salas = new Map();

function gerarCodigo() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I
  let c;
  do {
    c = '';
    for (let i = 0; i < 4; i++) c += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  } while (salas.has(c));
  return c;
}

// Envia o estado individualizado para cada lojista da sala.
function enviarEstado(code) {
  const sala = salas.get(code);
  if (!sala) return;
  for (const j of sala.jogadores) {
    if (j.socketId) io.to(j.socketId).emit('estado', R.visao(sala, j.id));
  }
}

// Abre o 1º engradado de cada lojista no começo de uma rodada de compra.
// Mostra "garimpando…" na hora e vai preenchendo conforme o MusicBrainz responde.
async function abrirEngradadosIniciais(code) {
  const sala = salas.get(code);
  if (!sala || sala.fase !== 'compra') return;
  for (const j of sala.jogadores) {
    if (j.conectado && !j.engradado && !j.compraEncerrada) {
      R.prepararSorteio(sala, j.id, 'novo');
    }
  }
  enviarEstado(code);
  await Promise.all(
    sala.jogadores.map(async (j) => {
      if (j._sorteioPendente) {
        await R.executarSorteio(sala, j.id);
        if (salas.get(code) === sala) enviarEstado(code);
      }
    })
  );
}

// Sai da compra para a venda quando todos encerraram.
function tentarAbrirVenda(code) {
  const sala = salas.get(code);
  if (!sala || sala.fase !== 'compra') return;
  R.forcarEncerrarDesconectados(sala);
  if (!R.todosEncerraramCompra(sala)) return;
  R.comecarVenda(sala);
  enviarEstado(code);
}

// Resolve a venda em batalha quando todos confirmaram.
function tentarResolverVenda(code) {
  const sala = salas.get(code);
  if (!sala || sala.fase !== 'venda') return;
  R.autoConfirmarDesconectados(sala);
  if (!R.todosConfirmaramVenda(sala)) return;
  const rev = R.resolverVendas(sala);
  enviarEstado(code);
  io.to(code).emit('revelacaoVendas', rev);
  agendarProxima(code);
}

function agendarProxima(code) {
  const sala = salas.get(code);
  if (!sala) return;
  clearTimeout(sala.timerProxima);
  sala.timerProxima = setTimeout(() => avancar(code), 24000);
}

async function avancar(code) {
  const sala = salas.get(code);
  if (!sala || sala.fase !== 'batalha') return;
  clearTimeout(sala.timerProxima);
  const r = R.proximaRodada(sala);
  if (r.fim) {
    const fim = R.finalizar(sala);
    enviarEstado(code);
    io.to(code).emit('fimDeJogo', fim);
  } else {
    enviarEstado(code);
    await abrirEngradadosIniciais(code);
  }
}

io.on('connection', (socket) => {
  socket.on('criarSala', (cb) => {
    const code = gerarCodigo();
    salas.set(code, R.novaSala(code));
    if (typeof cb === 'function') cb({ code });
  });

  socket.on('criarSalaSolo', (cb) => {
    const code = gerarCodigo();
    salas.set(code, R.novaSala(code, 'solo'));
    if (typeof cb === 'function') cb({ code });
  });

  socket.on('entrarSala', async ({ code, playerId, nome } = {}, cb) => {
    code = (code || '').toUpperCase().trim();
    if (!/^[A-Z0-9]{3,6}$/.test(code)) {
      if (cb) cb({ erro: 'Código de loja inválido.' });
      return;
    }
    let sala = salas.get(code);
    if (!sala) {
      sala = R.novaSala(code);
      salas.set(code, sala);
    }
    const res = R.entrar(sala, playerId, socket.id, nome);
    if (res.erro) {
      if (cb) cb({ erro: res.erro });
      return;
    }
    socket.data.code = code;
    socket.data.playerId = playerId;
    socket.join(code);
    if (cb) cb({ ok: true, code, souHost: sala.hostId === playerId, modo: sala.modo });
    enviarEstado(code);

    // Modo sozinho: começa na hora, sem lobby.
    if (sala.modo === 'solo' && sala.fase === 'lobby' && sala.jogadores.length >= 1) {
      R.iniciarSolo(sala);
      enviarEstado(code);
      await abrirEngradadosIniciais(code);
      return;
    }

    // Reconexão no meio de um momento especial: reenvia o quadro atual.
    if (sala.fase === 'batalha' && sala.ultimaRevelacao) {
      socket.emit('revelacaoVendas', sala.ultimaRevelacao);
    }
    if (sala.fase === 'fim' && sala.ultimoFim) {
      socket.emit('fimDeJogo', sala.ultimoFim);
    }
  });

  socket.on('ficarPronto', ({ nome } = {}) => {
    const sala = salas.get(socket.data.code);
    if (!sala) return;
    R.ficarPronto(sala, socket.data.playerId, nome);
    enviarEstado(socket.data.code);
  });

  socket.on('iniciar', async () => {
    const sala = salas.get(socket.data.code);
    if (!sala || sala.hostId !== socket.data.playerId) return;
    const res = R.iniciar(sala);
    if (res.erro) {
      socket.emit('avisoSala', res.erro);
      return;
    }
    enviarEstado(socket.data.code);
    await abrirEngradadosIniciais(socket.data.code);
  });

  // Garimpar: tipo 'novo' (próximo engradado) | 'ano' | 'genero'.
  socket.on('engradado', async ({ tipo } = {}) => {
    const code = socket.data.code;
    const sala = salas.get(code);
    if (!sala) return;
    const r = R.prepararSorteio(sala, socket.data.playerId, tipo);
    if (r.erro) {
      socket.emit('avisoSala', r.erro);
      return;
    }
    enviarEstado(code);
    await R.executarSorteio(sala, socket.data.playerId);
    if (salas.get(code) === sala) enviarEstado(code);
  });

  // COMPRAR: leva o disco e já abre o próximo engradado (se ainda couber).
  socket.on('comprar', async ({ mbid } = {}) => {
    const code = socket.data.code;
    const sala = salas.get(code);
    if (!sala) return;
    const r = R.comprar(sala, socket.data.playerId, mbid);
    if (r.erro) {
      socket.emit('avisoSala', r.erro);
      return;
    }
    enviarEstado(code);
    if (r.podeMais) {
      const prep = R.prepararSorteio(sala, socket.data.playerId, 'novo');
      if (prep.ok) {
        enviarEstado(code);
        await R.executarSorteio(sala, socket.data.playerId);
        if (salas.get(code) === sala) enviarEstado(code);
      }
    }
  });

  socket.on('removerDaLoja', ({ index } = {}) => {
    const sala = salas.get(socket.data.code);
    if (!sala) return;
    const r = R.removerDaLoja(sala, socket.data.playerId, index);
    if (r.erro) {
      socket.emit('avisoSala', r.erro);
      return;
    }
    enviarEstado(socket.data.code);
  });

  socket.on('encerrarCompras', () => {
    const code = socket.data.code;
    const sala = salas.get(code);
    if (!sala) return;
    R.encerrarCompras(sala, socket.data.playerId);
    enviarEstado(code);
    tentarAbrirVenda(code);
  });

  socket.on('confirmarVenda', (arranjo = {}) => {
    const code = socket.data.code;
    const sala = salas.get(code);
    if (!sala) return;
    const r = R.confirmarVenda(sala, socket.data.playerId, arranjo);
    if (r.erro) {
      socket.emit('avisoSala', r.erro);
      return;
    }
    enviarEstado(code);
    tentarResolverVenda(code);
  });

  socket.on('proxima', () => {
    const sala = salas.get(socket.data.code);
    if (!sala || sala.hostId !== socket.data.playerId) return;
    avancar(socket.data.code);
  });

  socket.on('jogarNovamente', () => {
    const sala = salas.get(socket.data.code);
    if (!sala || sala.hostId !== socket.data.playerId) return;
    R.reiniciar(sala);
    enviarEstado(socket.data.code);
  });

  socket.on('disconnect', () => {
    const code = socket.data.code;
    const pid = socket.data.playerId;
    const sala = salas.get(code);
    if (!sala) return;
    const j = sala.jogadores.find((x) => x.id === pid);
    if (j) {
      j.conectado = false;
      j.socketId = null;
    }
    if (sala.fase === 'lobby') {
      R.removerJogador(sala, pid);
    } else if (sala.hostId === pid) {
      const novo = sala.jogadores.find((x) => x.conectado);
      if (novo) sala.hostId = novo.id;
    }
    // Recolhe salas que ficaram totalmente vazias.
    if (sala.jogadores.length === 0 || sala.jogadores.every((x) => !x.conectado)) {
      clearTimeout(sala.timerLimpeza);
      sala.timerLimpeza = setTimeout(() => {
        const s = salas.get(code);
        if (s && (s.jogadores.length === 0 || s.jogadores.every((x) => !x.conectado))) {
          salas.delete(code);
        }
      }, 60000);
    }
    enviarEstado(code);
    // Não trava o jogo se quem caiu estava no meio de uma fase.
    tentarAbrirVenda(code);
    tentarResolverVenda(code);
  });
});

// Inicialização usando a variável de ambiente (PORT padrão 3000).
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor a rodar na porta ${PORT}`);

    // Aquecedor de cache em segundo plano: preenche as combinações gênero+ano
    // que ainda faltam, com prioridade menor que o jogo (não atrapalha quem
    // está jogando). Assim a espera da "1ª vez" vai sumindo sozinha.
    // Desligue com BDV_NO_WARM=1 (ou rode `npm run prewarm` à parte).
    if (!process.env.BDV_NO_WARM) {
      const G = require('./src/gameData');
      const MB = require('./src/musicbrainz');
      const combos = [];
      for (const g of G.GENEROS) {
        for (const ano of G.anosDoGenero(g)) combos.push({ tag: g.tag, label: g.label, ano });
      }
      setTimeout(() => MB.aquecerEmFundo(combos), 8000); // deixa o boot respirar
    }
});