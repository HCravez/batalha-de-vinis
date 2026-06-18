// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — servidor
//  Express serve as páginas; Socket.IO conduz as salas em tempo real.
//  Rotas:  /          → vitrine (criar/entrar numa loja)
//          /:codigo   → a sala de batalha
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

function agendarProxima(code) {
  const sala = salas.get(code);
  if (!sala) return;
  clearTimeout(sala.timerProxima);
  sala.timerProxima = setTimeout(() => avancar(code), 11000);
}

function avancar(code) {
  const sala = salas.get(code);
  if (!sala || sala.fase !== 'revelacao') return;
  clearTimeout(sala.timerProxima);
  const r = R.proximaRodada(sala);
  if (r.fim) {
    const fim = R.finalizar(sala);
    enviarEstado(code);
    io.to(code).emit('fimDeJogo', fim);
  } else {
    enviarEstado(code);
  }
}

function tentarResolver(code) {
  const sala = salas.get(code);
  if (!sala || sala.fase !== 'jogo') return;
  if (!R.todosConectadosJogaram(sala)) return;
  R.autoJogarDesconectados(sala);
  const rev = R.resolverBatalha(sala);
  enviarEstado(code);
  io.to(code).emit('revelacaoBatalha', rev);
  agendarProxima(code);
}

io.on('connection', (socket) => {
  socket.on('criarSala', (cb) => {
    const code = gerarCodigo();
    salas.set(code, R.novaSala(code));
    if (typeof cb === 'function') cb({ code });
  });

  socket.on('entrarSala', ({ code, playerId, nome } = {}, cb) => {
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
    if (cb) cb({ ok: true, code, souHost: sala.hostId === playerId });
    enviarEstado(code);
    // Reconexão no meio de um momento especial: reenvia o quadro atual.
    if (sala.fase === 'revelacao' && sala.ultimaRevelacao) {
      socket.emit('revelacaoBatalha', sala.ultimaRevelacao);
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

  socket.on('iniciar', () => {
    const sala = salas.get(socket.data.code);
    if (!sala || sala.hostId !== socket.data.playerId) return;
    const res = R.iniciar(sala);
    if (res.erro) {
      socket.emit('avisoSala', res.erro);
      return;
    }
    enviarEstado(socket.data.code);
  });

  socket.on('jogar', ({ uid } = {}) => {
    const sala = salas.get(socket.data.code);
    if (!sala) return;
    const res = R.jogar(sala, socket.data.playerId, uid);
    if (res.erro) {
      socket.emit('avisoSala', res.erro);
      return;
    }
    enviarEstado(socket.data.code);
    tentarResolver(socket.data.code);
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
    tentarResolver(code);
  });
});

// Inicialização correta usando a variável de ambiente da AWS
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  🎙️  Batalha de Vinis no ar  →  porta: ${PORT}\n`);
});