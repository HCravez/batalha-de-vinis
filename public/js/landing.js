// ── Vitrine: abrir uma loja nova ou entrar numa existente ───────────────────
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

  function sanitizar(c) {
    return (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  var abrir = document.getElementById('abrir');
  abrir.addEventListener('click', function () {
    abrir.disabled = true;
    abrir.textContent = 'Abrindo…';
    socket.emit('criarSala', function (resp) {
      if (resp && resp.code) {
        location.href = '/' + resp.code;
      } else {
        abrir.disabled = false;
        abrir.textContent = 'Abrir minha loja';
        toast('Não rolou abrir a loja. Tente de novo.');
      }
    });
  });

  var form = document.getElementById('form-entrar');
  var input = document.getElementById('codigo');

  input.addEventListener('input', function () {
    var p = input.selectionStart;
    input.value = sanitizar(input.value);
    try { input.setSelectionRange(p, p); } catch (e) {}
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var code = sanitizar(input.value);
    if (code.length < 3) {
      toast('Digite o código da loja (pelo menos 3 caracteres).');
      input.focus();
      return;
    }
    location.href = '/' + code;
  });

  // Se o servidor cair, avisa de leve.
  socket.on('connect_error', function () {
    toast('Sem conexão com a loja. O servidor está rodando?');
  });
})();
