// ════════════════════════════════════════════════════════════════════════════
//  BATALHA DE VINIS — cliente da sala
//  lobby → COMPRA (engradado dos 20 mais conhecidos; escolhe e COMPRA; a nota
//  fica oculta) → VENDA (separa batalha × guardar e ordena) → BATALHA (revela a
//  avaliação e mostra lucro/prejuízo) → FIM (o acervo guardado decide a parada).
//  A loja (até 5 guardados) aparece o tempo todo.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Identidade ───────────────────────────────────────────────────────────
  var code = decodeURIComponent(location.pathname.replace(/^\//, '')).toUpperCase();
  code = code.replace(/[^A-Z0-9]/g, '').slice(0, 6);

  var pid = sessionStorage.getItem('bdv_pid');
  if (!pid) {
    pid = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    sessionStorage.setItem('bdv_pid', pid);
  }
  var nomeSalvo = localStorage.getItem('bdv_nome') || '';

  // ── Idioma por domínio: vinylbattle.com = EN, batalhadevinis.com = PT ─────
  // (o botão de idioma sobrepõe, salvando por domínio no localStorage)
  var ehVinylBattle = /(^|\.)vinylbattle\.com$/i.test(location.hostname);
  var lang = localStorage.getItem('bdv_lang') || (ehVinylBattle ? 'en' : 'pt');
  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  document.title = lang === 'en' ? 'Vinyl Battle' : 'Batalha de Vinis';
  var EN = {
    // lobby
    'bem-vindo, lojista': 'welcome, shopkeeper', 'Quem tá na loja': "Who's in the shop",
    'Lojistas na sala': 'Shopkeepers in the room', 'Nome da sua loja': "Your shop's name",
    'Estou pronto': "I'm ready", 'Pronto': 'Ready', 'Sem nome': 'No name', ' (você)': ' (you)',
    'ausente…': 'away…', 'pronto pra abrir': 'ready to open', 'escolhendo o nome…': 'picking a name…',
    'Ninguém por aqui ainda…': 'Nobody here yet…', 'Dá um nome pra sua loja primeiro 🙂': 'Name your shop first 🙂',
    'o anfitrião': 'the host', 'Abrir as portas': 'Open the doors',
    'Chame mais um lojista — precisa de pelo menos 2.': 'Get one more shopkeeper — you need at least 2.',
    'Tudo pronto! Pode abrir as portas.': 'All set! You can open the doors.',
    'Esperando ': 'Waiting for ', ' abrir as portas…': ' to open the doors…',
    'Faltam ': 'Still ', ' lojista(s) ficarem prontos.': ' shopkeeper(s) to get ready.',
    // header / geral
    'BATALHA DE VINIS': 'VINYL BATTLE', 'BdV': 'VB',
    'Copiar link': 'Copy link', 'loja': 'shop', 'um instante…': 'a moment…',
    'Entrando na loja': 'Joining the shop',
    'Link da loja copiado!': 'Shop link copied!',
    'Sem conexão com a loja. O servidor está rodando?': 'No connection to the shop. Is the server running?',
    'Lojista': 'Shopkeeper', 'Os rivais': 'The rivals', 'você': 'you',
    'Não deu pra entrar': "Couldn't join", 'Voltar para a vitrine': 'Back to the front page', 'opa…': 'oops…',
    'só um instante…': 'one moment…', 'Preparando sua loja': 'Setting up your shop',
    // compra
    'Rodada de compras': 'Buying round', 'Rodada ': 'Round ', 'caixa': 'cash', 'na loja': 'in shop',
    'garimpando…': 'digging…', 'Buscando os mais conhecidos': 'Finding the best-known',
    'Ranqueando por audiência real (ListenBrainz)…': 'Ranking by real listens (ListenBrainz)…',
    'Só na 1ª vez de cada gênero+ano. O servidor vai pré-carregando os outros em segundo plano, então logo fica tudo instantâneo.':
      'Only the first time for each genre+year. The server pre-loads the others in the background, so it soon becomes instant.',
    'os 20 mais conhecidos': 'the 20 best-known',
    'álbuns reais · a avaliação está oculta — só o preço dá pista': 'real albums · the rating is hidden — only the price hints',
    'Trocar ano': 'Change year', 'Trocar gênero': 'Change genre', 'Encerrar compras': 'Finish buying',
    'Escolhido: ': 'Picked: ', 'Toque numa capa para escolher um disco.': 'Tap a cover to pick a record.',
    'COMPRAR': 'BUY', 'Dinheiro insuficiente para esse disco.': 'Not enough money for that record.',
    'já levado': 'taken', 'caixa cheia': 'crate full', ' discos comprados': ' records bought',
    'Comprados nesta rodada · ': 'Bought this round · ', 'Nenhum disco comprado ainda.': 'No records bought yet.',
    'comprando (': 'buying (', 'caixa fechado ✓': 'crate closed ✓', 'ausente': 'away',
    ' comprados · 🏪 ': ' bought · 🏪 ', 'na loja': 'in shop', ' discos · 🏪 ': ' records · 🏪 ',
    'Sem conexão com o acervo': 'No connection to the archive',
    'Não consegui carregar discos reais agora (sem internet?). Nenhum álbum fictício é mostrado.':
      "Couldn't load real records now (no internet?). No fake albums are shown.",
    'Tentar de novo': 'Try again',
    'Caixa fechado! Esperando os outros lojistas terminarem as compras…': 'Crate closed! Waiting for the other shopkeepers to finish buying…',
    // venda
    'Hora de vender': 'Time to sell', 'À venda · pelo valor real': 'For sale · at real value',
    'No balcão · vão para a batalha': 'On the counter · go to battle',
    'Guardar na loja · acervo final': 'Keep in shop · final collection',
    'Vender e guardar': 'Sell and keep', 'Confirmar venda': 'Confirm sale',
    'As avaliações são reveladas agora.': 'Ratings are revealed now.',
    'Depois disso a batalha começa e as avaliações são reveladas.': 'After this the battle starts and ratings are revealed.',
    '↑ guardar': '↑ keep', '↓ vender': '↓ sell',
    'Tudo guardado — nada será vendido.': 'All kept — nothing will be sold.',
    'Tudo guardado — nada vai à batalha.': 'All kept — nothing goes to battle.',
    'Nada guardado ainda. Guarde seus melhores!': 'Nothing kept yet. Keep your best!',
    'A loja não tem mais vagas.': 'The shop has no more slots.',
    'balcão pronto ✓': 'counter ready ✓', 'montando o balcão…': 'setting up the counter…',
    'Venda confirmada! Esperando os outros lojistas montarem o balcão…': 'Sale confirmed! Waiting for the other shopkeepers to set up…',
    // batalha
    'a hora da verdade': 'the moment of truth', 'Hora de Vender': 'Selling Time', 'Batalha de Vendas': 'Sales Battle',
    'seus discos são vendidos pelo valor real': 'your records are sold at real value',
    'lucro/prejuízo agora — a nota (★) só no fim da partida': 'profit/loss now — the rating (★) only at the end of the game',
    'Próxima rodada': 'Next round', 'Fechar a parada': 'Close the chart',
    'Avança sozinho em alguns segundos.': 'Advances on its own in a few seconds.',
    'O anfitrião puxa a próxima rodada…': 'The host starts the next round…',
    'no caixa': 'in cash', 'Investiu ': 'Spent ', ' · recebeu ': ' · got ', 'crédito da rodada ': 'round credit ',
    'resultado ': 'result ', 'comprou ': 'bought ', ' → vendeu ': ' → sold ',
    'LUCRO +': 'PROFIT +', 'PREJUÍZO −': 'LOSS −', 'no zero a zero': 'broke even',
    'Guardados na loja': 'Kept in shop', 'Loja: ': 'Shop: ', ' guardados · a nota é revelada só no fim da partida': ' kept · the rating is revealed only at the end',
    ' vitória': ' win', ' vitórias': ' wins', 'sem vitória': 'no win', 'Nada foi ao balcão.': 'Nothing went to the counter.',
    // loja shelf
    '🏪 Sua loja · acervo': '🏪 Your shop · collection', ' guardados': ' kept', 'vaga ': 'slot ',
    'rodada ': 'round ',
    // fim
    'fim de jogo': 'game over', 'Parada de Sucessos': 'Hit Parade',
    ' tem o melhor acervo e leva a parada!': ' has the best collection and tops the chart!',
    'acervo ': 'collection ', ' · média ': ' · avg ', 'As lojas e seus acervos': 'The shops and their collections',
    'loja vazia': 'empty shop', 'Tocar de novo': 'Play again', 'Volta todo mundo para o lobby.': 'Sends everyone back to the lobby.',
    'O anfitrião pode começar uma nova partida.': 'The host can start a new game.',
    'Seu acervo': 'Your collection', 'média dos seus ': 'average of your ', ' melhores · ': ' best · ',
    '🎉 Novo recorde!': '🎉 New record!', 'recorde: ': 'record: ', 'caixa final: ': 'final cash: ',
    'Os ': 'The ', ' da sua loja': ' in your shop', 'Jogar de novo': 'Play again', 'Tente bater seu recorde.': 'Try to beat your record.',
    // remover loja
    'Remover da loja': 'Remove from shop',
    'Remover "': 'Remove "',
    '" da sua loja? Você abre essa vaga do acervo.': '" from your shop? This frees a collection slot.',
    // server (avisoSala) — traduzidos no cliente
    'Outro lojista já levou esse disco.': 'Another shopkeeper already took that record.',
    'Você já trocou o ano nesta rodada.': 'You already changed the year this round.',
    'Você já trocou o gênero nesta rodada.': 'You already changed the genre this round.',
    'Você já encerrou as compras.': 'You already finished buying.',
    'Acabaram as combinações novas nesta partida.': 'No new genre+year combos left this game.',
    'A loja já abriu as portas. Espere a próxima partida.': 'The shop already opened. Wait for the next game.',
    'A loja está lotada (máximo de 6 lojistas).': 'The shop is full (max 6 shopkeepers).',
    'É preciso pelo menos 2 lojistas para abrir as portas.': 'You need at least 2 shopkeepers to open.',
    'Todos os lojistas precisam estar prontos.': 'All shopkeepers must be ready.',
  };
  // Tradução por substituição de texto: cobre tudo que é renderizado, sem
  // precisar marcar cada string. Frases mais longas primeiro (evita conflito).
  var EN_PARES = Object.keys(EN).map(function (k) { return [k, EN[k]]; })
    .sort(function (a, b) { return b[0].length - a[0].length; });
  function traduzirTexto(s) {
    for (var i = 0; i < EN_PARES.length; i++) {
      if (s.indexOf(EN_PARES[i][0]) >= 0) s = s.split(EN_PARES[i][0]).join(EN_PARES[i][1]);
    }
    return s;
  }
  function traduzirNo(node) {
    if (lang !== 'en' || !node) return;
    if (node.nodeType === 3) {
      var v = traduzirTexto(node.nodeValue);
      if (v !== node.nodeValue) node.nodeValue = v;
      return;
    }
    if (node.nodeType !== 1) return;
    ['placeholder', 'title', 'aria-label'].forEach(function (a) {
      if (node.hasAttribute && node.hasAttribute(a)) {
        var w = traduzirTexto(node.getAttribute(a));
        if (w !== node.getAttribute(a)) node.setAttribute(a, w);
      }
    });
    var kids = node.childNodes;
    for (var i = 0; i < kids.length; i++) traduzirNo(kids[i]);
  }
  function trocarIdioma() {
    localStorage.setItem('bdv_lang', lang === 'pt' ? 'en' : 'pt');
    location.reload(); // recarrega no novo idioma; o socket reconecta e restaura
  }
  function atualizarBotaoIdioma() {
    var b = $('#btn-lang');
    if (b) b.textContent = lang === 'pt' ? 'EN' : 'PT';
  }
  // Em inglês: observa o DOM e traduz tudo que for renderizado + o que já existe.
  if (lang === 'en') {
    var alvoObs = document.querySelector('.tela') || document.body;
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        for (var i = 0; i < m.addedNodes.length; i++) traduzirNo(m.addedNodes[i]);
      });
    }).observe(alvoObs, { childList: true, subtree: true });
    traduzirNo(alvoObs);
  }

  // ── DOM helpers ──────────────────────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var secs = {
    lobby: $('#lobby'), compra: $('#compra'), venda: $('#venda'),
    batalha: $('#batalha'), fim: $('#fim'), aviso: $('#aviso-conexao'),
  };
  function mostrarSecao(nome) {
    Object.keys(secs).forEach(function (k) { secs[k].classList.toggle('oculto', k !== nome); });
  }
  $('#codigo-loja').textContent = code || '····';

  // Botão de idioma (PT/EN)
  (function () {
    var b = $('#btn-lang');
    if (!b) return;
    b.addEventListener('click', trocarIdioma);
    atualizarBotaoIdioma();
  })();

  // ── Toast ────────────────────────────────────────────────────────────────
  var toastEl = $('#toast');
  var toastT = null;
  function toast(msg) {
    toastEl.textContent = lang === 'en' ? traduzirTexto(String(msg == null ? '' : msg)) : msg;
    toastEl.classList.add('mostrar');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('mostrar'); }, 3400);
  }
  $('#copiar-link').addEventListener('click', function () {
    var url = location.href;
    function ok() { toast('Link da loja copiado!'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok, function () { fallbackCopy(url, ok); });
    } else { fallbackCopy(url, ok); }
  });
  function fallbackCopy(text, done) {
    var t = el('textarea'); t.value = text;
    t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast(text); }
    document.body.removeChild(t);
  }

  // ── Paletas / formatação ─────────────────────────────────────────────────
  var COR_GENERO = {
    'Rock': '#ff3d6e', 'Pop': '#d65fb0', 'Hip-Hop': '#f0a32b', 'Jazz': '#c9a227',
    'Eletrônico': '#4f8cff', 'Punk': '#e23b3b', 'Metal': '#9aa3b2', 'Blues': '#5a73ff',
    'Disco': '#c08be0', 'Alternativo': '#2f9e6b',
  };
  function money(n) { return '$' + (Number(n) || 0); }
  function nota(n) { return (Math.round((Number(n) || 0) * 10) / 10).toFixed(1); }

  function hashStr(s) {
    var h = 0; s = String(s || '');
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function corDoAlbum(v) {
    var h = hashStr((v && (v.album + '·' + v.artista)) || 'x');
    var mat = h % 360;
    return { c1: 'hsl(' + mat + ', 62%, 56%)', c2: 'hsl(' + ((mat + 38) % 360) + ', 54%, 32%)' };
  }

  // ── Capa / sleeve ─────────────────────────────────────────────────────────
  function sleeveFront(v, opts) {
    opts = opts || {};
    var cor = corDoAlbum(v);
    var classes = ['sleeve'];
    if (opts.mao) classes.push('sleeve--mao');
    if (opts.selecionado) classes.push('is-selecionado');
    if (opts.campeao) classes.push('is-campeao');
    if (opts.bloqueado) classes.push('is-bloqueado');
    if (opts.levado) classes.push('is-levado');

    var tabCor = COR_GENERO[v.genero] || '#ff3d6e';
    var attrs = 'style="--c1:' + cor.c1 + ';--c2:' + cor.c2 + '"';
    if (opts.mao) {
      attrs += ' role="button" tabindex="0" data-mbid="' + esc(v.mbid) + '"' +
        ' aria-pressed="' + (opts.selecionado ? 'true' : 'false') + '"' +
        ' aria-label="' + esc(v.album) + ', ' + esc(v.artista) + ', ' + money(v.valor) + '"';
    }

    var capa = v.capaUrl
      ? '<img class="sleeve__capa" src="' + esc(v.capaUrl) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">'
      : '';

    var sticker = '';
    if (opts.precoVenda != null) sticker = '<span class="etiqueta sleeve__sticker sticker--venda">' + esc(money(opts.precoVenda)) + '</span>';
    else if (opts.pago != null) sticker = '<span class="etiqueta sleeve__sticker sticker--pago">' + esc(money(opts.pago)) + '</span>';
    else if (v.valor != null && opts.semPreco !== true) sticker = '<span class="etiqueta sleeve__sticker">' + esc(money(v.valor)) + '</span>';

    // a AVALIAÇÃO (nota) só aparece quando revelada — apenas no FIM da partida
    var avBadge = (opts.mostrarAvaliacao && v.avaliacao != null)
      ? '<span class="sleeve__av" title="avaliação revelada">★ ' + esc(nota(v.avaliacao)) + '</span>' : '';
    // as vitórias da batalha são independentes da nota (podem aparecer sem ela)
    var vit = '';
    if (opts.vitorias != null) {
      vit = '<span class="sleeve__vit">' +
        (opts.vitorias > 0 ? ('🏅 ' + opts.vitorias + (opts.vitorias === 1 ? ' vitória' : ' vitórias')) : 'sem vitória') +
        '</span>';
    }

    var levado = opts.levado ? '<div class="sleeve__levado"><span>já levado</span></div>' : '';

    return '' +
      '<div class="' + classes.join(' ') + '" ' + attrs + '>' +
        '<div class="sleeve__art"><div class="sleeve__art-bola"></div>' + capa + '</div>' +
        '<span class="sleeve__tab" style="--tab:' + tabCor + '">' + esc(v.genero) + ' · ' + esc(v.ano) + '</span>' +
        sticker + avBadge + levado +
        '<div class="sleeve__meta">' +
          '<span class="sleeve__album">' + esc(v.album) + '</span>' +
          '<span class="sleeve__artista">' + esc(v.artista) + '</span>' +
          vit +
        '</div>' +
      '</div>';
  }

  function sleeveBack() {
    return '<div class="sleeve sleeve--back"><div class="back-disc"></div>' +
      '<div class="back-q">?</div><div class="back-marca">BdV</div></div>';
  }

  // ── Loja (acervo) — aparece sempre ───────────────────────────────────────
  function lojaShelf(eu) {
    var loja = (eu.loja || []);
    var max = eu.lojaMax || 5;
    var slots = '';
    for (var i = 0; i < max; i++) {
      var d = loja[i];
      if (d) {
        slots += '<div class="acervo-slot is-cheio">' +
          '<button class="acervo-remover" data-loja-idx="' + i + '" title="Remover da loja" aria-label="Remover ' + esc(d.album) + ' da loja">✕</button>' +
          sleeveFront(d, {
            semPreco: true,
            mostrarAvaliacao: d.avaliacao != null, // só no fim
          }) + '<span class="acervo-slot__rod">rodada ' + (d.rodada || '?') + '</span></div>';
      } else {
        slots += '<div class="acervo-slot is-vago"><div class="acervo-vazio">vaga ' + (i + 1) + '</div></div>';
      }
    }
    return '<div class="acervo">' +
      '<div class="acervo__topo"><span class="acervo__titulo">🏪 Sua loja · acervo</span>' +
        '<span class="acervo__cont">' + loja.length + '/' + max + ' guardados</span></div>' +
      '<div class="acervo__fila">' + slots + '</div>' +
    '</div>';
  }

  // ── Estado ───────────────────────────────────────────────────────────────
  var socket = io();
  var S = null;
  var crachaModo = null;
  var lobbyMontado = false;
  var arranjoVenda = null;
  var selecionadoMbid = null;
  var aguardando = false;

  socket.on('connect', function () {
    socket.emit('entrarSala', { code: code, playerId: pid, nome: nomeSalvo }, function (resp) {
      if (resp && resp.erro) mostrarErroEntrada(resp.erro);
    });
  });
  socket.on('connect_error', function () { toast('Sem conexão com a loja. O servidor está rodando?'); });
  socket.on('estado', function (vis) { S = vis; render(); });
  socket.on('avisoSala', function (msg) { aguardando = false; toast(msg); render(); });
  socket.on('revelacaoVendas', function (p) { mostrarBatalha(p); });
  socket.on('fimDeJogo', function (p) { mostrarFim(p); });

  // Remover disco da loja (delegação — os botões ✕ são recriados a cada render).
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('.acervo-remover') : null;
    if (!b) return;
    var idx = parseInt(b.getAttribute('data-loja-idx'), 10);
    var eu = S && S.voce;
    if (!eu || !eu.loja || !eu.loja[idx]) return;
    var d = eu.loja[idx];
    var msgC = 'Remover "' + d.album + '" da sua loja? Você abre essa vaga do acervo.';
    if (!confirm(lang === 'en' ? traduzirTexto(msgC) : msgC)) return;
    socket.emit('removerDaLoja', { index: idx });
  });

  function mostrarErroEntrada(msg) {
    mostrarSecao('aviso');
    secs.aviso.innerHTML =
      '<div class="lobby__cabeca"><span class="selo">opa…</span><h2>Não deu pra entrar</h2></div>' +
      '<div class="cracha-eu" style="text-align:center">' +
        '<p style="color:var(--smoke);margin:0 0 16px">' + esc(msg) + '</p>' +
        '<a class="btn btn--rosa" href="/">Voltar para a vitrine</a></div>';
  }

  function render() {
    if (!S) return;
    // No modo sozinho não há código de sala nem link para compartilhar.
    var chip = $('.codigo-chip');
    if (chip) chip.classList.toggle('oculto', S.modo === 'solo');
    if (S.fase !== 'venda') { arranjoVenda = null; }
    switch (S.fase) {
      case 'lobby':
        if (S.modo === 'solo') {
          mostrarSecao('aviso');
          secs.aviso.innerHTML = '<div class="lobby__cabeca"><span class="selo">só um instante…</span>' +
            '<h2>Preparando sua loja</h2></div><div class="garimpo"><div class="garimpo__disco"></div></div>';
        } else renderLobby();
        break;
      case 'compra': aguardando = false; renderCompra(); break;
      case 'venda': renderVenda(); break;
      case 'batalha': mostrarSecao('batalha'); break;
      case 'fim': mostrarSecao('fim'); break;
    }
  }

  // ════════════════════════════ LOBBY ════════════════════════════════════════
  function renderLobby() {
    mostrarSecao('lobby');
    if (!lobbyMontado) montarLobby();
    atualizarCracha(); atualizarPrateleira(); atualizarHost();
  }
  function montarLobby() {
    secs.lobby.innerHTML =
      '<div class="lobby__cabeca"><span class="selo">bem-vindo, lojista</span><h2>Quem tá na loja</h2></div>' +
      '<div id="cracha" class="cracha-eu"></div>' +
      '<div class="secao-rotulo">Lojistas na sala</div>' +
      '<div id="prateleira" class="prateleira"></div>' +
      '<div id="host-controles" class="host-controles"></div>';
    lobbyMontado = true;
  }
  function atualizarCracha() {
    var eu = S.voce || {};
    var modo = eu.pronto ? 'pronto' : 'editar';
    if (modo === crachaModo) {
      if (modo === 'pronto') { var n = $('#cracha .nome'); if (n) n.textContent = eu.nome || 'Lojista'; }
      return;
    }
    crachaModo = modo;
    var cracha = $('#cracha');
    if (modo === 'pronto') {
      cracha.innerHTML = '<div class="pronto-feito"><div class="nome">' + esc(eu.nome || 'Lojista') +
        '</div><div class="marca-pronto"><span class="carimbo carimbo--pop">Pronto</span></div></div>';
      return;
    }
    cracha.innerHTML =
      '<label for="nome-input">Nome da sua loja</label>' +
      '<input id="nome-input" maxlength="18" placeholder="Ex.: Bazar do Groove" />' +
      '<button id="btn-pronto" class="btn btn--rosa btn--bloco">Estou pronto</button>';
    var input = $('#nome-input');
    input.value = nomeSalvo || (eu.nome || ''); input.focus();
    function confirmar() {
      var nome = (input.value || '').trim().slice(0, 18);
      if (!nome) { toast('Dá um nome pra sua loja primeiro 🙂'); input.focus(); return; }
      nomeSalvo = nome; localStorage.setItem('bdv_nome', nome);
      socket.emit('ficarPronto', { nome: nome });
    }
    $('#btn-pronto').addEventListener('click', confirmar);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); confirmar(); } });
  }
  function atualizarPrateleira() {
    $('#prateleira').innerHTML = (S.jogadores || []).map(function (j) {
      var cls = ['lojista'];
      if (j.ehHost) cls.push('is-host'); if (j.pronto) cls.push('is-pronto'); if (!j.conectado) cls.push('is-off');
      var status = !j.conectado ? 'ausente…' : j.pronto ? 'pronto pra abrir' : 'escolhendo o nome…';
      var nome = (j.nome || 'Sem nome') + (j.ehVoce ? ' (você)' : '');
      return '<div class="' + cls.join(' ') + '"><div class="lojista__nome">' + esc(nome) +
        '</div><div class="lojista__status">' + status + '</div></div>';
    }).join('') || '<p class="esperando">Ninguém por aqui ainda…</p>';
  }
  function atualizarHost() {
    var alvo = $('#host-controles');
    var jogadores = S.jogadores || [];
    var prontos = jogadores.filter(function (j) { return j.pronto && j.nome; }).length;
    var total = jogadores.length;
    if (!S.souHost) {
      var anf = jogadores.find(function (j) { return j.ehHost; });
      alvo.innerHTML = '<p class="dica">Esperando <b>' + esc((anf && anf.nome) || 'o anfitrião') + '</b> abrir as portas…</p>';
      return;
    }
    var podeAbrir = total >= 2 && prontos === total;
    var dica = total < 2 ? 'Chame mais um lojista — precisa de pelo menos 2.'
      : (prontos < total ? 'Faltam ' + (total - prontos) + ' lojista(s) ficarem prontos.' : 'Tudo pronto! Pode abrir as portas.');
    alvo.innerHTML = '<button id="btn-iniciar" class="btn btn--g"' + (podeAbrir ? '' : ' disabled') + '>Abrir as portas</button>' +
      '<p class="dica">' + dica + '</p>';
    if (podeAbrir) $('#btn-iniciar').addEventListener('click', function () { socket.emit('iniciar'); });
  }

  // ════════════════════════════ COMPRA ═══════════════════════════════════════
  function renderCompra() {
    mostrarSecao('compra');
    var eu = S.voce || {};
    if (eu.compraEncerrada) {
      secs.compra.innerHTML = barraRodada('Rodada de compras', eu) + lojaShelf(eu) +
        esperandoOutros('Caixa fechado! Esperando os outros lojistas terminarem as compras…', 'compraEncerrada');
      return;
    }
    secs.compra.innerHTML =
      barraRodada('Rodada de compras', eu) +
      lojaShelf(eu) +
      '<div id="engradado-area"></div>' +
      '<div class="secao-rotulo">Comprados nesta rodada · ' + (eu.comprados || []).length + '/' + eu.compraMax + '</div>' +
      '<div id="meus-comprados" class="caixa-discos"></div>' +
      rivaisCompra();
    renderEngradado();
    renderComprados();
  }

  function barraRodada(titulo, eu) {
    return '<div class="painel-rodada">' +
      '<div class="painel-rodada__esq"><span class="painel-rodada__tag">' + esc(titulo) + '</span>' +
        '<span class="painel-rodada__num">Rodada ' + S.rodada + '/' + S.totalRodadas + '</span></div>' +
      '<div class="painel-rodada__dir">' +
        '<div class="pill pill--grana"><b>' + money(eu.dinheiro) + '</b><small>caixa</small></div>' +
        '<div class="pill"><b>' + ((eu.loja && eu.loja.length) || 0) + '/' + (eu.lojaMax || 5) + '</b><small>na loja</small></div>' +
      '</div></div>';
  }

  function renderEngradado() {
    var eu = S.voce || {};
    var area = $('#engradado-area');
    if (!area) return;

    // limpa a seleção se o disco saiu do engradado ou foi levado por um rival
    var albuns = (eu.engradado && eu.engradado.albuns) || [];
    if (selecionadoMbid) {
      var selAtual = albuns.find(function (a) { return a.mbid === selecionadoMbid; });
      if (!selAtual || selAtual.bloqueado) selecionadoMbid = null;
    }

    if (eu.carregando) {
      area.innerHTML = garimpando();
      return;
    }
    if (!eu.engradado) {
      if (eu.semDados) {
        area.innerHTML =
          '<div class="engradado-cartaz"><span class="engradado-cartaz__faixa">ops…</span>' +
          '<h2 class="engradado-cartaz__titulo">Sem conexão com o acervo</h2></div>' +
          '<div class="garimpo"><p class="esperando">Não consegui carregar discos reais agora (sem internet?). Nenhum álbum fictício é mostrado.</p>' +
          '<button id="btn-retry" class="btn btn--rosa">Tentar de novo</button></div>';
        var br = $('#btn-retry'); if (br) br.onclick = function () { sortear('novo'); };
        return;
      }
      if ((eu.comprados || []).length >= eu.compraMax) {
        area.innerHTML =
          '<div class="engradado-cartaz"><span class="engradado-cartaz__faixa">caixa cheia</span>' +
          '<h2 class="engradado-cartaz__titulo">' + eu.compraMax + ' discos comprados</h2></div>' +
          '<div class="engradado-controles"><button class="btn btn--rosa" id="btn-encerrar">Encerrar compras</button></div>';
        var be = $('#btn-encerrar'); if (be) be.onclick = function () { be.disabled = true; socket.emit('encerrarCompras'); };
        return;
      }
      area.innerHTML = garimpando();
      return;
    }

    var eng = eu.engradado;
    var corG = COR_GENERO[eng.genero] || '#ff3d6e';
    var sel = albuns.find(function (a) { return a.mbid === selecionadoMbid; });
    var podeComprar = sel && sel.valor <= eu.dinheiro;

    var cartaz =
      '<div class="engradado-cartaz" style="--g:' + corG + '">' +
        '<span class="engradado-cartaz__faixa">os 20 mais conhecidos</span>' +
        '<h2 class="engradado-cartaz__titulo">' + esc(eng.genero) + ' · ' + esc(eng.ano) + '</h2>' +
        '<div class="engradado-cartaz__sub">álbuns reais · a avaliação está oculta — só o preço dá pista</div></div>';

    var controles =
      '<div class="engradado-controles">' +
        '<button class="btn btn--mini" id="btn-ano"' + (eu.rerollAnoRestante <= 0 ? ' disabled' : '') + '>Trocar ano (' + eu.rerollAnoRestante + ')</button>' +
        '<button class="btn btn--mini" id="btn-genero"' + (eu.rerollGeneroRestante <= 0 ? ' disabled' : '') + '>Trocar gênero (' + eu.rerollGeneroRestante + ')</button>' +
        '<button class="btn btn--mini btn--rosa" id="btn-encerrar">Encerrar compras</button>' +
      '</div>';

    var acao =
      '<div class="acao-comprar">' +
        '<div class="acao-comprar__info">' +
          (sel ? ('Escolhido: <b>' + esc(sel.album) + '</b> — ' + esc(sel.artista) + ' · <span class="preco-tag">' + money(sel.valor) + '</span>')
               : 'Toque numa capa para escolher um disco.') +
        '</div>' +
        '<button class="btn btn--g" id="btn-comprar"' + (podeComprar ? '' : ' disabled') + '>COMPRAR' + (sel ? ' · ' + money(sel.valor) : '') + '</button>' +
      '</div>' +
      (sel && !podeComprar ? '<p class="dica dica--alerta">Dinheiro insuficiente para esse disco.</p>' : '');

    var grade = '<div class="engradado-grade">' +
      albuns.map(function (v) {
        if (v.bloqueado) return sleeveFront(v, { bloqueado: true, levado: true });
        var caro = v.valor > eu.dinheiro;
        return sleeveFront(v, { mao: true, selecionado: v.mbid === selecionadoMbid, bloqueado: caro && v.mbid !== selecionadoMbid });
      }).join('') + '</div>';

    area.innerHTML = cartaz + controles + acao + grade;

    var btnAno = $('#btn-ano'), btnGen = $('#btn-genero'), btnEnc = $('#btn-encerrar'), btnCmp = $('#btn-comprar');
    if (btnAno && !btnAno.disabled) btnAno.onclick = function () { sortear('ano'); };
    if (btnGen && !btnGen.disabled) btnGen.onclick = function () { sortear('genero'); };
    if (btnEnc) btnEnc.onclick = function () {
      btnEnc.disabled = true; socket.emit('encerrarCompras');
    };
    if (btnCmp) btnCmp.onclick = function () {
      if (!selecionadoMbid || aguardando) return;
      aguardando = true; btnCmp.disabled = true;
      socket.emit('comprar', { mbid: selecionadoMbid });
      selecionadoMbid = null;
    };

    secs.compra.querySelectorAll('.engradado-grade .sleeve--mao').forEach(function (s) {
      function escolher() { selecionadoMbid = s.getAttribute('data-mbid'); renderEngradado(); }
      s.addEventListener('click', escolher);
      s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(); } });
    });
  }

  function garimpando() {
    var s = (S.voce && S.voce.sorteando) || null;
    var titulo = s ? (esc(s.genero) + ' · ' + esc(s.ano)) : 'Buscando os mais conhecidos';
    return '<div class="engradado-cartaz"><span class="engradado-cartaz__faixa">garimpando…</span>' +
      '<h2 class="engradado-cartaz__titulo">' + titulo + '</h2></div>' +
      '<div class="garimpo"><div class="garimpo__disco"></div>' +
      '<p class="esperando">Ranqueando por audiência real (ListenBrainz)…</p>' +
      '<p class="dica">Só na 1ª vez de cada gênero+ano. O servidor vai pré-carregando os outros em segundo plano, então logo fica tudo instantâneo.</p>' +
      '</div>';
  }

  function sortear(tipo) {
    if (aguardando) return;
    aguardando = true;
    socket.emit('engradado', { tipo: tipo });
  }

  function renderComprados() {
    var eu = S.voce || {};
    var alvo = $('#meus-comprados');
    if (!alvo) return;
    alvo.innerHTML = (eu.comprados || []).map(function (v) { return sleeveFront(v, { pago: v.pago }); }).join('')
      || '<p class="esperando">Nenhum disco comprado ainda.</p>';
  }

  function rivaisCompra() {
    var outros = (S.jogadores || []).filter(function (j) { return !j.ehVoce; });
    if (!outros.length) return '';
    var cards = outros.map(function (j) {
      var status = !j.conectado ? 'ausente' : j.compraEncerrada ? 'caixa fechado ✓' : j.carregando ? 'garimpando…' : 'comprando (' + j.comprados + ')';
      var cls = ['rival']; if (j.compraEncerrada) cls.push('is-jogou'); if (!j.conectado) cls.push('is-off');
      return '<div class="' + cls.join(' ') + '"><div class="rival__topo"><span class="rival__nome">' + esc(j.nome || 'Lojista') +
        (j.ehHost ? ' <span class="estrela">★</span>' : '') + '</span><span class="rival__grana">' + money(j.dinheiro) + '</span></div>' +
        '<div class="rival__linha">🛒 ' + j.comprados + ' comprados · 🏪 ' + j.lojaTamanho + '/5 na loja</div>' +
        '<div class="rival__balcao">' + status + '</div></div>';
    }).join('');
    return '<div class="secao-rotulo">Os rivais</div><div class="rivais">' + cards + '</div>';
  }

  // ════════════════════════════ VENDA ════════════════════════════════════════
  function mapaComprados() {
    var m = {}; ((S.voce && S.voce.comprados) || []).forEach(function (d) { m[d.uid] = d; }); return m;
  }
  function renderVenda() {
    mostrarSecao('venda');
    var eu = S.voce || {};
    if (!arranjoVenda) {
      var base = eu.venda || { batalha: (eu.comprados || []).map(function (d) { return d.uid; }), guardar: [] };
      arranjoVenda = { batalha: base.batalha.slice(), guardar: base.guardar.slice() };
    }
    if (eu.vendaConfirmada) {
      secs.venda.innerHTML = barraRodada('Hora de vender', eu) + lojaShelf(eu) +
        esperandoOutros('Venda confirmada! Esperando os outros lojistas montarem o balcão…', 'vendaConfirmada');
      return;
    }
    var solo = S.modo === 'solo';
    var vagas = (eu.lojaMax || 5) - ((eu.loja && eu.loja.length) || 0);
    var vagasTxt = 'restam ' + vagas + ' vaga' + (vagas === 1 ? '' : 's');
    var explica = solo
      ? 'Escolha o que <b>guardar</b> na loja (' + vagasTxt + ' — contam pro acervo). O resto é <b>vendido pelo valor real</b>: ' +
        'lucro se você pechinchou, prejuízo se pagou caro. A avaliação está oculta — confie no preço.'
      : 'Ordene do <b>pior</b> (esquerda) ao <b>melhor</b> (direita) — palpite, a avaliação está oculta. ' +
        'Mande pro <b>balcão</b> o que vai vender e <b>guarde</b> os melhores (' + vagasTxt + ').';
    secs.venda.innerHTML =
      barraRodada('Hora de vender', eu) +
      lojaShelf(eu) +
      '<div class="venda-explica">' + explica + '</div>' +
      '<div class="secao-rotulo">' + (solo ? 'À venda · pelo valor real' : 'No balcão · vão para a batalha') + '</div>' +
      '<div id="venda-batalha" class="venda-trilha"></div>' +
      '<div class="secao-rotulo">Guardar na loja · acervo final</div>' +
      '<div id="venda-guardar" class="venda-trilha venda-trilha--guardar"></div>' +
      '<div class="venda-acoes"><button id="btn-confirmar" class="btn btn--rosa btn--g">' +
        (solo ? 'Vender e guardar' : 'Confirmar venda') + '</button>' +
        '<p class="dica">' + (solo ? 'As avaliações são reveladas agora.' : 'Depois disso a batalha começa e as avaliações são reveladas.') + '</p></div>' +
      rivaisVenda();
    pintarVenda();
    $('#btn-confirmar').addEventListener('click', function () {
      $('#btn-confirmar').disabled = true;
      socket.emit('confirmarVenda', { batalha: arranjoVenda.batalha, guardar: arranjoVenda.guardar });
    });
  }
  function pintarVenda() {
    var mapa = mapaComprados();
    var eu = S.voce || {};
    var solo = S.modo === 'solo';
    var vagas = (eu.lojaMax || 5) - ((eu.loja && eu.loja.length) || 0);
    var bat = $('#venda-batalha');
    bat.innerHTML = arranjoVenda.batalha.map(function (uid, i) {
      var d = mapa[uid]; if (!d) return '';
      var pos = solo ? '' : '<div class="venda-item__pos">' + (i + 1) + 'º</div>';
      var ferramentas = solo
        ? '<button class="tbtn tbtn--guardar" data-acao="guardar"' + (vagas <= 0 ? ' disabled' : '') + '>↑ guardar</button>'
        : '<button class="tbtn" data-acao="esq" title="pior"' + (i === 0 ? ' disabled' : '') + '>◀</button>' +
          '<button class="tbtn tbtn--guardar" data-acao="guardar"' + (vagas <= 0 ? ' disabled' : '') + '>↑ guardar</button>' +
          '<button class="tbtn" data-acao="dir" title="melhor"' + (i === arranjoVenda.batalha.length - 1 ? ' disabled' : '') + '>▶</button>';
      return '<div class="venda-item" data-uid="' + esc(uid) + '">' + pos + sleeveFront(d, { pago: d.pago }) +
        '<div class="venda-item__ferramentas">' + ferramentas + '</div></div>';
    }).join('') || '<p class="esperando">' + (solo ? 'Tudo guardado — nada será vendido.' : 'Tudo guardado — nada vai à batalha.') + '</p>';
    var gua = $('#venda-guardar');
    gua.innerHTML = arranjoVenda.guardar.map(function (uid) {
      var d = mapa[uid]; if (!d) return '';
      return '<div class="venda-item" data-uid="' + esc(uid) + '">' + sleeveFront(d, { pago: d.pago }) +
        '<div class="venda-item__ferramentas"><button class="tbtn" data-acao="devolver">↓ vender</button></div></div>';
    }).join('') || '<p class="esperando">Nada guardado ainda. Guarde seus melhores!</p>';
    secs.venda.querySelectorAll('.tbtn').forEach(function (b) {
      b.onclick = function () {
        var uid = b.closest('.venda-item').getAttribute('data-uid');
        var acao = b.getAttribute('data-acao');
        if (acao === 'esq') reordenar(uid, -1);
        else if (acao === 'dir') reordenar(uid, 1);
        else if (acao === 'guardar') moverParaGuardar(uid);
        else if (acao === 'devolver') devolverParaBatalha(uid);
      };
    });
  }
  function reordenar(uid, dir) {
    var arr = arranjoVenda.batalha, i = arr.indexOf(uid); if (i < 0) return;
    var j = i + dir; if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t; pintarVenda();
  }
  function moverParaGuardar(uid) {
    var eu = S.voce || {};
    var vagas = (eu.lojaMax || 5) - ((eu.loja && eu.loja.length) || 0);
    if (arranjoVenda.guardar.length >= vagas) { toast('A loja não tem mais vagas.'); return; }
    var i = arranjoVenda.batalha.indexOf(uid); if (i < 0) return;
    arranjoVenda.batalha.splice(i, 1); arranjoVenda.guardar.push(uid); pintarVenda();
  }
  function devolverParaBatalha(uid) {
    var i = arranjoVenda.guardar.indexOf(uid); if (i < 0) return;
    arranjoVenda.guardar.splice(i, 1); arranjoVenda.batalha.push(uid); pintarVenda();
  }
  function rivaisVenda() {
    var outros = (S.jogadores || []).filter(function (j) { return !j.ehVoce; });
    if (!outros.length) return '';
    return '<div class="secao-rotulo">Os rivais</div><div class="rivais">' +
      outros.map(function (j) {
        var status = !j.conectado ? 'ausente' : j.vendaConfirmada ? 'balcão pronto ✓' : 'montando o balcão…';
        var cls = ['rival']; if (j.vendaConfirmada) cls.push('is-jogou'); if (!j.conectado) cls.push('is-off');
        return '<div class="' + cls.join(' ') + '"><div class="rival__topo"><span class="rival__nome">' + esc(j.nome || 'Lojista') +
          '</span><span class="rival__grana">' + money(j.dinheiro) + '</span></div>' +
          '<div class="rival__linha">🛒 ' + j.comprados + ' discos · 🏪 ' + j.lojaTamanho + '/5</div>' +
          '<div class="rival__balcao">' + status + '</div></div>';
      }).join('') + '</div>';
  }
  function esperandoOutros(msg, flag) {
    var faltam = (S.jogadores || []).filter(function (j) { return j.conectado && !j[flag]; }).length;
    return '<div class="aguardando-bloco"><span class="carimbo carimbo--pop">Pronto</span>' +
      '<p class="esperando">' + esc(msg) + '</p>' +
      (faltam > 0 ? '<p class="dica">Faltam ' + faltam + ' lojista(s).</p>' : '<p class="dica">Todo mundo pronto — já vai…</p>') + '</div>';
  }

  // ════════════════════════════ BATALHA ══════════════════════════════════════
  function mostrarBatalha(p) {
    mostrarSecao('batalha');
    var solo = p.modo === 'solo';
    var ehUltima = p.rodada >= p.totalRodadas;
    var cabeca = '<div class="revelacao__cabeca"><span class="selo">a hora da verdade</span><h2>' +
      (solo ? 'Hora de Vender' : 'Batalha de Vendas') + '</h2>' +
      '<div class="revelacao__demanda">Rodada ' + p.rodada + '/' + p.totalRodadas + ' · ' +
      (solo ? 'seus discos são vendidos pelo valor real' : 'lucro/prejuízo agora — a nota (★) só no fim da partida') + '</div></div>';
    var meu = (p.jogadores || []).filter(function (b) { return b.playerId === pid; });
    var outros = (p.jogadores || []).filter(function (b) { return b.playerId !== pid; });
    var blocos = meu.concat(outros).map(function (b) { return blocoBatalha(b, b.playerId === pid); }).join('');
    var controles = (S && S.souHost)
      ? '<div class="rev-controles"><button id="btn-proxima" class="btn">' + (ehUltima ? 'Fechar a parada' : 'Próxima rodada') +
        '</button><p class="dica">Avança sozinho em alguns segundos.</p></div>'
      : '<div class="rev-controles"><p class="dica">O anfitrião puxa a próxima rodada…</p></div>';

    secs.batalha.innerHTML = cabeca + '<div class="batalha-grade">' + blocos + '</div>' + controles;
    var btn = $('#btn-proxima');
    if (btn) btn.addEventListener('click', function () { btn.disabled = true; socket.emit('proxima'); });

    secs.batalha.querySelectorAll('.batalha-bloco').forEach(function (bloco, bi) {
      bloco.querySelectorAll('.venda').forEach(function (card, i) {
        var flip = card.querySelector('.flip');
        setTimeout(function () { if (flip) flip.classList.add('virado'); card.classList.add('revelado'); }, 300 + bi * 220 + i * 540);
      });
    });
  }
  function blocoBatalha(b, ehMeu) {
    var vendidos = b.vendidos || [];
    var balcao = vendidos.map(function (v) {
      var lucroCls = v.lucro > 0 ? 'lucro--pos' : (v.lucro < 0 ? 'lucro--neg' : 'lucro--zero');
      var lucroTxt = v.lucro > 0 ? ('LUCRO +' + money(v.lucro)) : (v.lucro < 0 ? ('PREJUÍZO −' + money(-v.lucro)) : 'no zero a zero');
      return '<div class="venda' + (v.campeao ? ' venceu' : '') + '">' +
        '<div class="flip"><div class="flip__inner">' +
          '<div class="flip__face">' + sleeveFront(v, { vitorias: v.vitorias, precoVenda: v.preco, campeao: v.campeao }) + '</div>' +
          '<div class="flip__face flip__back">' + sleeveBack() + '</div>' +
        '</div></div>' +
        '<div class="venda__troca">comprou ' + money(v.pago) + ' → vendeu <b>' + money(v.preco) + '</b></div>' +
        '<div class="venda__lucro ' + lucroCls + '">' + lucroTxt + '</div>' +
      '</div>';
    }).join('') || '<p class="esperando">Nada foi ao balcão.</p>';

    var guardados = (b.guardados || []).map(function (v) {
      return '<div class="guardado-mini">' + sleeveFront(v, { semPreco: true }) + '</div>';
    }).join('');

    var lucroLiquido = b.lucro || 0;
    var liqCls = lucroLiquido > 0 ? 'lucro--pos' : (lucroLiquido < 0 ? 'lucro--neg' : 'lucro--zero');
    var liqTxt = (lucroLiquido > 0 ? '+' : lucroLiquido < 0 ? '−' : '') + money(Math.abs(lucroLiquido));

    return '<div class="batalha-bloco' + (ehMeu ? ' is-meu' : '') + '">' +
      '<div class="batalha-bloco__topo"><h3>' + esc(b.nome || 'Lojista') + (ehMeu ? ' <span class="voce-tag">você</span>' : '') + '</h3>' +
        '<div class="batalha-bloco__grana">' + money(b.dinheiro) + ' <small>no caixa</small></div></div>' +
      '<div class="batalha-resumo">Investiu ' + money(b.investido) + ' · recebeu ' + money(b.ganho) +
        (b.bonusRodada ? ' · crédito da rodada <b class="credito-rodada">+' + money(b.bonusRodada) + '</b>' : '') +
        ' · <span class="venda__lucro ' + liqCls + '">resultado ' + liqTxt + '</span></div>' +
      '<div class="balcao">' + balcao + '</div>' +
      (guardados ? '<div class="batalha-guardados"><span class="secao-rotulo">Guardados na loja</span><div class="guardados-fila">' + guardados + '</div></div>' : '') +
      '<div class="batalha-bloco__rodape">Loja: <b>' + (b.lojaTamanho || 0) + '/5</b> guardados · a nota é revelada só no fim da partida</div>' +
    '</div>';
  }

  // ════════════════════════════ FIM ══════════════════════════════════════════
  function mostrarFim(p) {
    if (p.modo === 'solo') return mostrarFimSolo(p);
    mostrarSecao('fim');
    var classif = p.classificacao || [];
    var campea = classif[0];
    var cabeca = '<div class="fim__cabeca"><span class="selo">fim de jogo</span><h2>Parada de Sucessos</h2>' +
      (campea ? '<div class="fim__campea">🏆 ' + esc(campea.nome) + ' tem o melhor acervo e leva a parada!</div>' : '') + '</div>';
    var parada = '<div class="parada">' + classif.map(function (c, i) {
      return '<div class="parada__linha' + (i === 0 ? ' campea' : '') + '">' +
        '<div class="parada__pos">' + (i + 1) + 'º</div>' +
        '<div class="parada__nome">' + esc(c.nome || 'Lojista') + '</div>' +
        '<div class="parada__acervo">acervo <b>' + nota(c.acervo) + '</b> ★</div>' +
        '<div class="parada__grana">' + money(c.dinheiro) + '</div></div>';
    }).join('') + '</div>';
    var blocos = classif.map(function (c, i) {
      var discos = (c.loja || []).map(function (v) { return sleeveFront(v, { mostrarAvaliacao: true, semPreco: true }); }).join('');
      return '<div class="loja-final' + (i === 0 ? ' campea' : '') + '">' +
        '<div class="loja-final__cab">' +
          '<span class="loja-final__nome">' + (i + 1) + 'º · ' + esc(c.nome || 'Lojista') + (i === 0 ? ' 👑' : '') + '</span>' +
          '<span class="loja-final__stats">acervo <b>' + nota(c.acervo) + ' ★</b> · média ' + nota(c.media) + ' · ' + money(c.dinheiro) + '</span>' +
        '</div>' +
        '<div class="loja-final__discos">' + (discos || '<span class="esperando">loja vazia</span>') + '</div>' +
      '</div>';
    }).join('');
    var reveal = '<div class="reveal-final"><h3>As lojas e seus acervos</h3><div class="lojas">' + blocos + '</div></div>';
    var controles = (S && S.souHost)
      ? '<div class="fim__controles"><button id="btn-denovo" class="btn btn--rosa btn--g">Tocar de novo</button><p class="dica">Volta todo mundo para o lobby.</p></div>'
      : '<div class="fim__controles"><p class="dica">O anfitrião pode começar uma nova partida.</p></div>';
    secs.fim.innerHTML = cabeca + parada + reveal + controles;
    var btn = $('#btn-denovo');
    if (btn) btn.addEventListener('click', function () { btn.disabled = true; socket.emit('jogarNovamente'); });
    crachaModo = null; arranjoVenda = null; selecionadoMbid = null;
  }

  // ── FIM do modo sozinho: high score (média dos 5 melhores guardados) ──────
  function mostrarFimSolo(p) {
    mostrarSecao('fim');
    var c = (p.classificacao || [])[0] || { loja: [], media: 0, acervo: 0, dinheiro: 0 };
    var score = Math.round((c.media || 0) * 10) / 10; // 0–10
    var pts = Math.round((c.media || 0) * 10);          // 0–100

    var rec = parseFloat(localStorage.getItem('bdv_recorde_solo') || '0') || 0;
    var novoRecorde = score > rec;
    if (novoRecorde) localStorage.setItem('bdv_recorde_solo', String(score));
    var recorde = Math.max(rec, score);

    var discos = (c.loja || []).map(function (v) { return sleeveFront(v, { mostrarAvaliacao: true, semPreco: true }); }).join('');

    var cabeca = '<div class="fim__cabeca"><span class="selo">fim de jogo</span><h2>Seu acervo</h2></div>';
    var placar =
      '<div class="solo-score">' +
        '<div class="solo-score__big"><span class="solo-score__num">' + nota(score) + '</span><span class="solo-score__den">/ 10</span></div>' +
        '<div class="solo-score__sub">média dos seus ' + ((c.loja || []).length) + ' melhores · <b>' + pts + ' pts</b></div>' +
        (novoRecorde
          ? '<div class="solo-score__rec novo">🎉 Novo recorde!</div>'
          : '<div class="solo-score__rec">recorde: ' + nota(recorde) + ' / 10</div>') +
        '<div class="solo-score__grana">caixa final: ' + money(c.dinheiro) + '</div>' +
      '</div>';
    var reveal = '<div class="reveal-final"><h3>Os ' + ((c.loja || []).length) + ' da sua loja</h3>' +
      '<div class="reveal-final__discos">' + (discos || '<span class="esperando">loja vazia</span>') + '</div></div>';
    var controles = '<div class="fim__controles"><a class="btn btn--rosa btn--g" href="/">Jogar de novo</a>' +
      '<p class="dica">Tente bater seu recorde.</p></div>';

    secs.fim.innerHTML = cabeca + placar + reveal + controles;
    crachaModo = null; arranjoVenda = null; selecionadoMbid = null;
  }
})();
