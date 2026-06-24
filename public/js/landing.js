// ── Vitrine: jogar sozinho ou abrir uma loja multiplayer ────────────────────
//  A entrada em loja de amigos é só pela URL (link compartilhado) — não há mais
//  campo de código aqui.
(function () {
  var socket = io();

  // ── Idioma por domínio: vinylbattle.com = EN, batalhadevinis.com = PT ──────
  var ehVinylBattle = /(^|\.)vinylbattle\.com$/i.test(location.hostname);
  var lang = localStorage.getItem('bdv_lang') || (ehVinylBattle ? 'en' : 'pt');
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  document.title = lang === 'en' ? 'Vinyl Battle' : 'Batalha de Vinis';
  // Tradução da vitrine por seletor (substitui o conteúdo do elemento).
  var EN = {
    '.vitrine__topo > span': 'VINYL BATTLE<span class="ponto">.</span>',
    '.vitrine__titulo': 'Vinyl<br /><em>Battle</em>',
    '.disco__label-title': 'Vinyl<br />Battle',
    '.vitrine__topo small': 'the record-shop showdown',
    '.vitrine__eyebrow': 'drop the needle…',
    '.vitrine__lead':
      'Open your shop and dig up <em>real albums</em>, with real covers and stats. ' +
      '<strong>Try to buy vinyl at a fair price to sell it later for a profit.</strong> ' +
      'In the end, <strong>the player with the best vinyl selection wins!</strong>',
    '#solo': 'Play solo',
    '.ou-risca': 'or call your friends',
    '#abrir': 'Open multiplayer shop',
    '.acoes-dica': 'In multiplayer, just share the shop link — joining is by URL.',
    '.vitrine__rodape summary': 'How do you play?',
    '.rodape-legal a': 'Privacy Policy',
  };
  // Os parágrafos das regras (na ordem em que aparecem no <details>).
  var EN_REGRAS = [
    '<b>Try to buy vinyl at a fair price to sell it later for a profit — and the ' +
      'player with the best vinyl selection wins!</b>',
    'There are <b>3 rounds</b>, starting with <b>$300</b> in the till (plus ' +
      '<b>+$120 credit</b> at the end of each round). Each round has two phases. In ' +
      'the <b>buy</b> phase, a year and a genre are drawn and the <b>20 best-known ' +
      'albums</b> of that slice show up (real, with real covers). Each record has a ' +
      '<b>hidden rating</b>; the price follows it, but varies ±25% — so bargains and ' +
      'traps appear. You can change the year and the genre once each per round.',
    'In the <b>sell</b> phase, choose what to <b>keep in your shop</b> (up to 5 — ' +
      "that's your selection, which decides the game) and what to <b>sell</b>. The " +
      'rating is revealed: bought a gem cheap? <b>profit</b>; overpaid for a weak ' +
      'record? <b>loss</b>. After 3 rounds, <b>whoever built the best vinyl ' +
      'selection wins</b> (the highest average/sum of ratings among kept records).',
  ];
  function traduzirVitrine() {
    if (lang !== 'en') return;
    Object.keys(EN).forEach(function (sel) {
      var elemento = document.querySelector(sel);
      if (elemento) elemento.innerHTML = EN[sel];
    });
    var priv = document.querySelector('.rodape-legal a');
    if (priv) priv.setAttribute('href', '/privacy.html'); // versão em inglês
    var ps = document.querySelectorAll('.vitrine__rodape details p');
    for (var i = 0; i < ps.length && i < EN_REGRAS.length; i++) ps[i].innerHTML = EN_REGRAS[i];
    var btn = document.getElementById('btn-lang');
    if (btn) btn.title = 'Idioma / Language';
  }
  var btnLang = document.getElementById('btn-lang');
  if (btnLang) {
    btnLang.textContent = lang === 'pt' ? 'EN' : 'PT';
    btnLang.addEventListener('click', function () {
      localStorage.setItem('bdv_lang', lang === 'pt' ? 'en' : 'pt');
      location.reload();
    });
  }
  traduzirVitrine();

  var toastEl = document.getElementById('toast');
  var toastT = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('mostrar');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('mostrar'); }, 3200);
  }

  var TOAST_EN = {
    'Não rolou abrir a loja. Tente de novo.': "Couldn't open the shop. Try again.",
    'Sem conexão com a loja. O servidor está rodando?': 'No connection to the shop. Is the server running?',
    'Preparando…': 'Preparing…', 'Abrindo…': 'Opening…',
  };
  function tt(s) { return lang === 'en' && TOAST_EN[s] ? TOAST_EN[s] : s; }

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
        toast(tt('Não rolou abrir a loja. Tente de novo.'));
      }
    });
  }

  var solo = document.getElementById('solo');
  if (solo) {
    solo.addEventListener('click', function () {
      abrirCom('criarSalaSolo', solo, tt('Preparando…'));
    });
  }

  var abrir = document.getElementById('abrir');
  if (abrir) {
    abrir.addEventListener('click', function () {
      abrirCom('criarSala', abrir, tt('Abrindo…'));
    });
  }

  // Se o servidor cair, avisa de leve.
  socket.on('connect_error', function () {
    toast(tt('Sem conexão com a loja. O servidor está rodando?'));
  });
})();
