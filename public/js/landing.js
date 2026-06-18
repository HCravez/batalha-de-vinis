// ── Vitrine: jogar sozinho ou abrir uma loja multiplayer ────────────────────
//  A entrada em loja de amigos é só pela URL (link compartilhado) — não há mais
//  campo de código aqui.
(function () {
  var socket = io();

  var toastEl = document.getElementById('toast');
  var toastT = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('mostrar');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('mostrar'); }, 3200);
  }

  function abrirCom(evento, botao, textoOcupado) {
    var original = botao.textContent;
    botao.disabled = true;
    botao.textContent = textoOcupado;
    socket.emit(evento, function (resp) {
      if (resp && resp.code) {
        location.href = '/' + resp.code;
      } else {
        botao.disabled = false;
        botao.textContent = original;
        toast('Não rolou abrir a loja. Tente de novo.');
      }
    });
  }

  var solo = document.getElementById('solo');
  if (solo) {
    solo.addEventListener('click', function () {
      abrirCom('criarSalaSolo', solo, 'Preparando…');
    });
  }

  var abrir = document.getElementById('abrir');
  if (abrir) {
    abrir.addEventListener('click', function () {
      abrirCom('criarSala', abrir, 'Abrindo…');
    });
  }

  // Se o servidor cair, avisa de leve.
  socket.on('connect_error', function () {
    toast('Sem conexão com a loja. O servidor está rodando?');
  });
})();
