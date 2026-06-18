// ════════════════════════════════════════════════════════════════════════════
//  BATALHA DE VINIS — cliente da sala
//  Renderiza: lobby → COMPRA (garimpa engradados de álbuns REAIS e compra) →
//  VENDA (separa batalha × guardar e ordena pior→melhor) → BATALHA (revela a
//  nota da crítica oculta) → FIM (acervo guardado decide a parada).
//  O segredo é respeitado: a nota da crítica e os discos dos rivais só viajam
//  revelados na batalha e no fim.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Identidade da sala e do jogador ──────────────────────────────────────
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

  // ── Atalhos de DOM ───────────────────────────────────────────────────────
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
    lobby: $('#lobby'),
    compra: $('#compra'),
    venda: $('#venda'),
    batalha: $('#batalha'),
    fim: $('#fim'),
    aviso: $('#aviso-conexao'),
  };
  function mostrarSecao(nome) {
    Object.keys(secs).forEach(function (k) {
      secs[k].classList.toggle('oculto', k !== nome);
    });
  }

  $('#codigo-loja').textContent = code || '····';

  // ── Toast ────────────────────────────────────────────────────────────────
  var toastEl = $('#toast');
  var toastT = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('mostrar');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('mostrar'); }, 3400);
  }

  $('#copiar-link').addEventListener('click', function () {
    var url = location.href;
    function ok() { toast('Link da loja copiado!'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(ok, function () { fallbackCopy(url, ok); });
    } else {
      fallbackCopy(url, ok);
    }
  });
  function fallbackCopy(text, done) {
    var t = el('textarea');
    t.value = text;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast(text); }
    document.body.removeChild(t);
  }

  // ── Paletas / formatação ─────────────────────────────────────────────────
  var COR_GENERO = {
    'Rock': '#ff3d6e', 'Pop': '#d65fb0', 'Hip-Hop': '#f0a32b', 'Jazz': '#c9a227',
    'Soul': '#d56b2c', 'Funk': '#e0518a', 'Eletrônico': '#4f8cff', 'Punk': '#e23b3b',
    'Metal': '#9aa3b2', 'Folk': '#7fae5a', 'Reggae': '#2f9e6b', 'Blues': '#5a73ff',
    'Country': '#cf9b52', 'Disco': '#c08be0',
  };
  function money(n) { return '$' + (Number(n) || 0); }
  function nota(n) { return (Math.round((Number(n) || 0) * 10) / 10).toFixed(1); }

  // Cor da capa derivada do nome (fallback quando não há capa real).
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

  // ── Capa / sleeve de disco (com capa real + fallback) ────────────────────
  function sleeveFront(v, opts) {
    opts = opts || {};
    var cor = corDoAlbum(v);
    var classes = ['sleeve'];
    if (opts.mao) classes.push('sleeve--mao');
    if (opts.escolhido) classes.push('is-escolhido');
    if (opts.campeao) classes.push('is-campeao');
    if (opts.bloqueado) classes.push('is-bloqueado');

    var tabCor = COR_GENERO[v.genero] || '#ff3d6e';
    var attrs = 'style="--c1:' + cor.c1 + ';--c2:' + cor.c2 + '"';
    if (opts.mao) {
      attrs += ' role="button" tabindex="0" data-mbid="' + esc(v.mbid) + '" data-uid="' + esc(v.uid || '') + '"' +
        ' aria-label="' + esc(v.album) + ', ' + esc(v.artista) + '"';
    }

    // arte: gradiente sempre atrás; capa real por cima (some no onerror).
    var capa = v.capaUrl
      ? '<img class="sleeve__capa" src="' + esc(v.capaUrl) + '" alt="" loading="lazy" ' +
        'onerror="this.style.display=\'none\'">'
      : '';

    // selo de canto: preço pago, preço de revenda, ou preço de tabela.
    var sticker = '';
    if (opts.precoVenda != null) {
      sticker = '<span class="etiqueta sleeve__sticker sticker--venda">' + esc(money(opts.precoVenda)) + '</span>';
    } else if (opts.pago != null) {
      sticker = '<span class="etiqueta sleeve__sticker sticker--pago">' + esc(money(opts.pago)) + '</span>';
    } else if (v.valor != null && opts.semPreco !== true) {
      sticker = '<span class="etiqueta sleeve__sticker">' + esc(money(v.valor)) + '</span>';
    }

    // notas: usuários sempre que houver; crítica só quando revelada.
    var notas = '';
    if (v.usuarios != null) notas += '<span class="nota nota--user" title="média dos usuários">♪ ' + esc(nota(v.usuarios)) + '</span>';
    if (opts.mostrarCritica && v.critica != null) notas += '<span class="nota nota--crit" title="média da crítica">★ ' + esc(nota(v.critica)) + '</span>';

    var faixaVit = '';
    if (opts.mostrarCritica && opts.vitorias != null) {
      faixaVit = '<span class="sleeve__vit">' +
        (opts.vitorias > 0 ? ('🏅 ' + opts.vitorias + (opts.vitorias === 1 ? ' vitória' : ' vitórias')) : 'encalhou') +
        '</span>';
    }

    return '' +
      '<div class="' + classes.join(' ') + '" ' + attrs + '>' +
        '<div class="sleeve__art"><div class="sleeve__art-bola"></div>' + capa + '</div>' +
        '<span class="sleeve__tab" style="--tab:' + tabCor + '">' + esc(v.genero) + ' · ' + esc(v.ano) + '</span>' +
        sticker +
        '<div class="sleeve__meta">' +
          '<span class="sleeve__album">' + esc(v.album) + '</span>' +
          '<span class="sleeve__artista">' + esc(v.artista) + '</span>' +
          (notas ? '<span class="sleeve__notas">' + notas + '</span>' : '') +
          faixaVit +
        '</div>' +
      '</div>';
  }

  function sleeveBack() {
    return '' +
      '<div class="sleeve sleeve--back">' +
        '<div class="back-disc"></div>' +
        '<div class="back-q">?</div>' +
        '<div class="back-marca">BdV</div>' +
      '</div>';
  }

  // ── Estado ───────────────────────────────────────────────────────────────
  var socket = io();
  var S = null;
  var crachaModo = null;
  var lobbyMontado = false;
  var arranjoVenda = null;     // { batalha:[uid], guardar:[uid] } — local
  var vendaUiPronta = false;
  var aguardando = false;      // travinha anti-clique-duplo em ações async

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

  function mostrarErroEntrada(msg) {
    mostrarSecao('aviso');
    secs.aviso.innerHTML =
      '<div class="lobby__cabeca"><span class="selo">opa…</span><h2>Não deu pra entrar</h2></div>' +
      '<div class="cracha-eu" style="text-align:center">' +
        '<p style="color:var(--smoke);margin:0 0 16px">' + esc(msg) + '</p>' +
        '<a class="btn btn--rosa" href="/">Voltar para a vitrine</a>' +
      '</div>';
  }

  // ── Render principal ─────────────────────────────────────────────────────
  function render() {
    if (!S) return;
    if (S.fase !== 'venda') { arranjoVenda = null; vendaUiPronta = false; }
    switch (S.fase) {
      case 'lobby': renderLobby(); break;
      case 'compra': aguardando = false; renderCompra(); break;
      case 'venda': renderVenda(); break;
      case 'batalha': mostrarSecao('batalha'); break; // conteúdo vem do evento
      case 'fim': mostrarSecao('fim'); break;          // conteúdo vem do evento
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  LOBBY
  // ════════════════════════════════════════════════════════════════════════
  function renderLobby() {
    mostrarSecao('lobby');
    if (!lobbyMontado) montarLobby();
    atualizarCracha();
    atualizarPrateleira();
    atualizarHost();
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
      cracha.innerHTML =
        '<div class="pronto-feito"><div class="nome">' + esc(eu.nome || 'Lojista') + '</div>' +
        '<div class="marca-pronto"><span class="carimbo carimbo--pop">Pronto</span></div></div>';
      return;
    }
    cracha.innerHTML =
      '<label for="nome-input">Nome da sua loja</label>' +
      '<input id="nome-input" maxlength="18" placeholder="Ex.: Bazar do Groove" />' +
      '<button id="btn-pronto" class="btn btn--rosa btn--bloco">Estou pronto</button>';
    var input = $('#nome-input');
    input.value = nomeSalvo || (eu.nome || '');
    input.focus();
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
      if (j.ehHost) cls.push('is-host');
      if (j.pronto) cls.push('is-pronto');
      if (!j.conectado) cls.push('is-off');
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
    alvo.innerHTML =
      '<button id="btn-iniciar" class="btn btn--g"' + (podeAbrir ? '' : ' disabled') + '>Abrir as portas</button>' +
      '<p class="dica">' + dica + '</p>';
    if (podeAbrir) $('#btn-iniciar').addEventListener('click', function () { socket.emit('iniciar'); });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  COMPRA
  // ════════════════════════════════════════════════════════════════════════
  function renderCompra() {
    mostrarSecao('compra');
    var eu = S.voce || {};
    var topo = barraRodada('Rodada de compras', eu);

    if (eu.compraEncerrada) {
      secs.compra.innerHTML = topo + esperandoOutros('Caixa fechado! Esperando os outros lojistas terminarem as compras…', 'compraEncerrada');
      return;
    }

    secs.compra.innerHTML =
      topo +
      '<div id="engradado-area"></div>' +
      '<div class="secao-rotulo">Sua caixa desta rodada · ' + (eu.comprados || []).length + '/' + eu.compraMax + '</div>' +
      '<div id="meus-comprados" class="caixa-discos"></div>' +
      rivaisCompra();

    renderEngradado();
    renderComprados();
  }

  function barraRodada(titulo, eu) {
    return '<div class="painel-rodada">' +
      '<div class="painel-rodada__esq">' +
        '<span class="painel-rodada__tag">' + esc(titulo) + '</span>' +
        '<span class="painel-rodada__num">Rodada ' + S.rodada + '/' + S.totalRodadas + '</span>' +
      '</div>' +
      '<div class="painel-rodada__dir">' +
        '<div class="pill pill--grana"><b>' + money(eu.dinheiro) + '</b><small>caixa</small></div>' +
        '<div class="pill"><b>' + (eu.loja ? eu.loja.length : 0) + '/' + (eu.lojaMax || 5) + '</b><small>na loja</small></div>' +
      '</div>' +
    '</div>';
  }

  function renderEngradado() {
    var eu = S.voce || {};
    var area = $('#engradado-area');
    if (!area) return;

    if (eu.carregando || !eu.engradado) {
      area.innerHTML =
        '<div class="engradado-cartaz"><span class="engradado-cartaz__faixa">garimpando o engradado…</span>' +
        '<h2 class="engradado-cartaz__titulo">Procurando discos reais</h2></div>' +
        '<div class="garimpo"><div class="garimpo__disco"></div><p class="esperando">Buscando capas e fichas no acervo…</p></div>';
      return;
    }

    var eng = eu.engradado;
    var podeComprar = !eng.comprado && (eu.comprados || []).length < eu.compraMax;
    var corG = COR_GENERO[eng.genero] || '#ff3d6e';

    var cartaz =
      '<div class="engradado-cartaz" style="--g:' + corG + '">' +
        '<span class="engradado-cartaz__faixa">o engradado de hoje</span>' +
        '<h2 class="engradado-cartaz__titulo">' + esc(eng.genero) + ' · ' + esc(eng.ano) + '</h2>' +
        '<div class="engradado-cartaz__sub">' +
          (eng.offline ? 'acervo offline (sem internet) — capas geradas' : 'álbuns reais · o preço segue a nota dos usuários (♪)') +
        '</div>' +
      '</div>';

    var controles =
      '<div class="engradado-controles">' +
        '<button class="btn btn--mini" id="btn-ano"' + ((eng.rerollAno || eng.comprado) ? ' disabled' : '') + '>Trocar ano' + (eng.rerollAno ? ' ✓' : '') + '</button>' +
        '<button class="btn btn--mini" id="btn-genero"' + ((eng.rerollGenero || eng.comprado) ? ' disabled' : '') + '>Trocar gênero' + (eng.rerollGenero ? ' ✓' : '') + '</button>' +
        '<button class="btn btn--mini btn--vinil" id="btn-proximo">Próximo engradado ⟳</button>' +
        '<button class="btn btn--mini btn--rosa" id="btn-encerrar">Encerrar compras</button>' +
      '</div>';

    var dicaTopo = eng.comprado
      ? '<p class="dica engradado-dica">Comprou! Cada engradado dá direito a 1 disco — puxe o próximo ou encerre.</p>'
      : '<p class="dica engradado-dica">Compre 1 disco deste engradado (clique na capa). Alvo: ' + eu.compraMin + '+ por rodada.</p>';

    var grade = '<div class="engradado-grade">' +
      eng.albuns.map(function (v) {
        var caro = v.valor > eu.dinheiro;
        return sleeveFront(v, {
          mao: podeComprar && !caro,
          bloqueado: !podeComprar || caro,
        });
      }).join('') +
    '</div>';

    area.innerHTML = cartaz + controles + dicaTopo + grade;

    var btnAno = $('#btn-ano'), btnGen = $('#btn-genero'), btnProx = $('#btn-proximo'), btnEnc = $('#btn-encerrar');
    if (btnAno && !btnAno.disabled) btnAno.onclick = function () { sortear('ano'); };
    if (btnGen && !btnGen.disabled) btnGen.onclick = function () { sortear('genero'); };
    if (btnProx) btnProx.onclick = function () { sortear('novo'); };
    if (btnEnc) btnEnc.onclick = function () {
      if ((eu.comprados || []).length < eu.compraMin &&
          !confirm('Você tem só ' + (eu.comprados || []).length + ' disco(s). Encerrar mesmo assim?')) return;
      btnEnc.disabled = true; socket.emit('encerrarCompras');
    };

    if (podeComprar) {
      secs.compra.querySelectorAll('.engradado-grade .sleeve--mao').forEach(function (s) {
        function comprar() {
          if (aguardando) return;
          var mbid = s.getAttribute('data-mbid');
          aguardando = true; socket.emit('comprar', { mbid: mbid });
        }
        s.addEventListener('click', comprar);
        s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); comprar(); } });
      });
    }
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
    var lista = (eu.comprados || []).map(function (v) {
      return sleeveFront(v, { pago: v.pago, mini: true });
    }).join('');
    alvo.innerHTML = lista || '<p class="esperando">Nenhum disco comprado ainda.</p>';
  }

  function rivaisCompra() {
    var outros = (S.jogadores || []).filter(function (j) { return !j.ehVoce; });
    if (!outros.length) return '';
    var cards = outros.map(function (j) {
      var status = !j.conectado ? 'ausente'
        : j.compraEncerrada ? 'caixa fechado ✓'
        : j.carregando ? 'garimpando…'
        : 'comprando (' + j.comprados + ')';
      var cls = ['rival']; if (j.compraEncerrada) cls.push('is-jogou'); if (!j.conectado) cls.push('is-off');
      return '<div class="' + cls.join(' ') + '">' +
        '<div class="rival__topo"><span class="rival__nome">' + esc(j.nome || 'Lojista') + (j.ehHost ? ' <span class="estrela">★</span>' : '') +
        '</span><span class="rival__grana">' + money(j.dinheiro) + '</span></div>' +
        '<div class="rival__linha">🛒 ' + j.comprados + ' comprados · 🏪 ' + j.lojaTamanho + '/5 na loja</div>' +
        '<div class="rival__balcao">' + status + '</div>' +
      '</div>';
    }).join('');
    return '<div class="secao-rotulo">Os rivais</div><div class="rivais">' + cards + '</div>';
  }

  // ════════════════════════════════════════════════════════════════════════
  //  VENDA  (separar batalha × guardar, ordenar pior→melhor)
  // ════════════════════════════════════════════════════════════════════════
  function mapaComprados() {
    var m = {};
    ((S.voce && S.voce.comprados) || []).forEach(function (d) { m[d.uid] = d; });
    return m;
  }

  function renderVenda() {
    mostrarSecao('venda');
    var eu = S.voce || {};

    if (!arranjoVenda) {
      var base = eu.venda || { batalha: (eu.comprados || []).map(function (d) { return d.uid; }), guardar: [] };
      arranjoVenda = { batalha: base.batalha.slice(), guardar: base.guardar.slice() };
    }

    if (eu.vendaConfirmada) {
      secs.venda.innerHTML = barraRodada('Hora de vender', eu) +
        esperandoOutros('Venda confirmada! Esperando os outros lojistas montarem o balcão…', 'vendaConfirmada');
      vendaUiPronta = false;
      return;
    }

    var vagas = (eu.lojaMax || 5) - ((eu.loja && eu.loja.length) || 0);

    secs.venda.innerHTML =
      barraRodada('Hora de vender', eu) +
      '<div class="venda-explica">Arraste com as setas para ordenar do <b>pior</b> (esquerda) ao <b>melhor</b> (direita) — é seu palpite, a nota da crítica está oculta. ' +
        'Mande pro <b>balcão</b> o que vai vender, e <b>guarde</b> os melhores na loja (restam ' + vagas + ' vaga' + (vagas === 1 ? '' : 's') + ').</div>' +
      '<div class="secao-rotulo">No balcão · vão para a batalha de vendas</div>' +
      '<div id="venda-batalha" class="venda-trilha"></div>' +
      '<div class="secao-rotulo">Guardar na loja · contam pro acervo final (' + (((eu.loja && eu.loja.length) || 0)) + '/' + (eu.lojaMax || 5) + ')</div>' +
      '<div id="venda-guardar" class="venda-trilha venda-trilha--guardar"></div>' +
      '<div class="venda-acoes"><button id="btn-confirmar" class="btn btn--rosa btn--g">Confirmar venda</button>' +
        '<p class="dica">Depois disso a batalha começa e as notas da crítica são reveladas.</p></div>' +
      rivaisVenda();

    pintarVenda();
    vendaUiPronta = true;

    $('#btn-confirmar').addEventListener('click', function () {
      $('#btn-confirmar').disabled = true;
      socket.emit('confirmarVenda', { batalha: arranjoVenda.batalha, guardar: arranjoVenda.guardar });
    });
  }

  function pintarVenda() {
    var mapa = mapaComprados();
    var eu = S.voce || {};
    var vagas = (eu.lojaMax || 5) - ((eu.loja && eu.loja.length) || 0);

    var bat = $('#venda-batalha');
    bat.innerHTML = arranjoVenda.batalha.map(function (uid, i) {
      var d = mapa[uid]; if (!d) return '';
      return '<div class="venda-item" data-uid="' + esc(uid) + '">' +
        '<div class="venda-item__pos">' + (i + 1) + 'º</div>' +
        sleeveFront(d, { pago: d.pago }) +
        '<div class="venda-item__ferramentas">' +
          '<button class="tbtn" data-acao="esq" title="pior"' + (i === 0 ? ' disabled' : '') + '>◀</button>' +
          '<button class="tbtn tbtn--guardar" data-acao="guardar"' + (vagas <= 0 ? ' disabled' : '') + '>↑ guardar</button>' +
          '<button class="tbtn" data-acao="dir" title="melhor"' + (i === arranjoVenda.batalha.length - 1 ? ' disabled' : '') + '>▶</button>' +
        '</div>' +
      '</div>';
    }).join('') || '<p class="esperando">Tudo guardado — nada vai à batalha.</p>';

    var gua = $('#venda-guardar');
    gua.innerHTML = arranjoVenda.guardar.map(function (uid) {
      var d = mapa[uid]; if (!d) return '';
      return '<div class="venda-item" data-uid="' + esc(uid) + '">' +
        sleeveFront(d, { pago: d.pago }) +
        '<div class="venda-item__ferramentas">' +
          '<button class="tbtn" data-acao="devolver">↓ vender</button>' +
        '</div>' +
      '</div>';
    }).join('') || '<p class="esperando">Nada guardado ainda. Guarde seus melhores discos!</p>';

    secs.venda.querySelectorAll('.tbtn').forEach(function (b) {
      b.onclick = function () {
        var item = b.closest('.venda-item');
        var uid = item.getAttribute('data-uid');
        var acao = b.getAttribute('data-acao');
        if (acao === 'esq') reordenar(uid, -1);
        else if (acao === 'dir') reordenar(uid, 1);
        else if (acao === 'guardar') moverParaGuardar(uid);
        else if (acao === 'devolver') devolverParaBatalha(uid);
      };
    });
  }

  function reordenar(uid, dir) {
    var arr = arranjoVenda.batalha;
    var i = arr.indexOf(uid); if (i < 0) return;
    var j = i + dir; if (j < 0 || j >= arr.length) return;
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    pintarVenda();
  }
  function moverParaGuardar(uid) {
    var eu = S.voce || {};
    var vagas = (eu.lojaMax || 5) - ((eu.loja && eu.loja.length) || 0);
    if (arranjoVenda.guardar.length >= vagas) { toast('A loja não tem mais vagas.'); return; }
    var i = arranjoVenda.batalha.indexOf(uid); if (i < 0) return;
    arranjoVenda.batalha.splice(i, 1);
    arranjoVenda.guardar.push(uid);
    pintarVenda();
  }
  function devolverParaBatalha(uid) {
    var i = arranjoVenda.guardar.indexOf(uid); if (i < 0) return;
    arranjoVenda.guardar.splice(i, 1);
    arranjoVenda.batalha.push(uid);
    pintarVenda();
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
    var outros = (S.jogadores || []);
    var faltam = outros.filter(function (j) { return j.conectado && !j[flag]; }).length;
    return '<div class="aguardando-bloco">' +
      '<span class="carimbo carimbo--pop">Pronto</span>' +
      '<p class="esperando">' + esc(msg) + '</p>' +
      (faltam > 0 ? '<p class="dica">Faltam ' + faltam + ' lojista(s).</p>' : '<p class="dica">Todo mundo pronto — já vai…</p>') +
    '</div>';
  }

  // ════════════════════════════════════════════════════════════════════════
  //  BATALHA  (revelação da crítica oculta)
  // ════════════════════════════════════════════════════════════════════════
  function mostrarBatalha(p) {
    mostrarSecao('batalha');
    var ehUltima = p.rodada >= p.totalRodadas;

    var cabeca =
      '<div class="revelacao__cabeca"><span class="selo">a hora da verdade</span>' +
        '<h2>Batalha de Vendas</h2>' +
        '<div class="revelacao__demanda">Rodada ' + p.rodada + '/' + p.totalRodadas + ' · a nota da crítica (★) é revelada agora</div>' +
      '</div>';

    var meu = (p.jogadores || []).filter(function (b) { return b.playerId === pid; });
    var outros = (p.jogadores || []).filter(function (b) { return b.playerId !== pid; });
    var ordenados = meu.concat(outros);

    var blocos = ordenados.map(function (b, idx) {
      return blocoBatalha(b, b.playerId === pid, idx);
    }).join('');

    var controles;
    if (S && S.souHost) {
      controles = '<div class="rev-controles"><button id="btn-proxima" class="btn">' +
        (ehUltima ? 'Fechar a parada' : 'Próxima rodada') + '</button>' +
        '<p class="dica">Avança sozinho em alguns segundos.</p></div>';
    } else {
      controles = '<div class="rev-controles"><p class="dica">O anfitrião puxa a próxima rodada…</p></div>';
    }

    secs.batalha.innerHTML = cabeca + '<div class="batalha-grade">' + blocos + '</div>' + controles;

    var btn = $('#btn-proxima');
    if (btn) btn.addEventListener('click', function () { btn.disabled = true; socket.emit('proxima'); });

    // anima a revelação de cada disco (flip + nota + carimbo de vitórias).
    secs.batalha.querySelectorAll('.batalha-bloco').forEach(function (bloco, bi) {
      var cards = bloco.querySelectorAll('.venda');
      cards.forEach(function (card, i) {
        var flip = card.querySelector('.flip');
        setTimeout(function () {
          if (flip) flip.classList.add('virado');
          card.classList.add('revelado');
        }, 300 + bi * 250 + i * 560);
      });
    });
  }

  function blocoBatalha(b, ehMeu, idx) {
    var vendidos = b.vendidos || [];
    var balcao = vendidos.map(function (v) {
      return '<div class="venda' + (v.campeao ? ' venceu' : '') + '">' +
          '<div class="flip"><div class="flip__inner">' +
            '<div class="flip__face">' + sleeveFront(v, { mostrarCritica: true, vitorias: v.vitorias, precoVenda: v.preco, campeao: v.campeao }) + '</div>' +
            '<div class="flip__face flip__back">' + sleeveBack() + '</div>' +
          '</div></div>' +
          '<div class="venda__pontos">★ ' + nota(v.critica) + ' · <span class="ganho">' + money(v.preco) + '</span></div>' +
        '</div>';
    }).join('') || '<p class="esperando">Nada foi ao balcão.</p>';

    var guardados = (b.guardados || []).map(function (v) {
      return '<div class="guardado-mini">' + sleeveFront(v, { mostrarCritica: true, semPreco: true }) + '</div>';
    }).join('');

    return '<div class="batalha-bloco' + (ehMeu ? ' is-meu' : '') + '">' +
      '<div class="batalha-bloco__topo"><h3>' + esc(b.nome || 'Lojista') + (ehMeu ? ' <span class="voce-tag">você</span>' : '') + '</h3>' +
        '<div class="batalha-bloco__grana">+' + money(b.ganho) + ' <small>nas vendas</small></div></div>' +
      '<div class="balcao">' + balcao + '</div>' +
      (guardados ? '<div class="batalha-guardados"><span class="secao-rotulo">Guardados na loja</span><div class="guardados-fila">' + guardados + '</div></div>' : '') +
      '<div class="batalha-bloco__rodape">Caixa: <b>' + money(b.dinheiro) + '</b> · Acervo guardado: <b>' + nota(b.acervo) + '</b> (★)</div>' +
    '</div>';
  }

  // ════════════════════════════════════════════════════════════════════════
  //  FIM  (parada de sucessos — vence o melhor acervo)
  // ════════════════════════════════════════════════════════════════════════
  function mostrarFim(p) {
    mostrarSecao('fim');
    var classif = p.classificacao || [];
    var campea = classif[0];

    var cabeca =
      '<div class="fim__cabeca"><span class="selo">fim de jogo</span><h2>Parada de Sucessos</h2>' +
        (campea ? '<div class="fim__campea">🏆 ' + esc(campea.nome) + ' tem o melhor acervo e leva a parada!</div>' : '') +
      '</div>';

    var parada = '<div class="parada">' +
      classif.map(function (c, i) {
        return '<div class="parada__linha' + (i === 0 ? ' campea' : '') + '">' +
          '<div class="parada__pos">' + (i + 1) + 'º</div>' +
          '<div class="parada__nome">' + esc(c.nome || 'Lojista') + '</div>' +
          '<div class="parada__acervo">acervo <b>' + nota(c.acervo) + '</b> ★</div>' +
          '<div class="parada__grana">' + money(c.dinheiro) + '</div>' +
        '</div>';
      }).join('') +
    '</div>';

    var blocos = classif.map(function (c) {
      var discos = (c.loja || []).map(function (v) { return sleeveFront(v, { mostrarCritica: true, semPreco: true }); }).join('');
      return '<div class="reveal-final__bloco">' +
        '<div class="reveal-final__nome">' + esc(c.nome || 'Lojista') + '</div>' +
        '<div class="reveal-final__bonus">acervo ' + nota(c.acervo) + ' ★ · média ' + nota(c.media) + ' · ' + money(c.dinheiro) + '</div>' +
        '<div class="reveal-final__discos">' + (discos || '<span class="esperando">loja vazia</span>') + '</div>' +
      '</div>';
    }).join('');

    var reveal = '<div class="reveal-final"><h3>As lojas e seus acervos</h3><div class="grade">' + blocos + '</div></div>';

    var controles;
    if (S && S.souHost) {
      controles = '<div class="fim__controles"><button id="btn-denovo" class="btn btn--rosa btn--g">Tocar de novo</button>' +
        '<p class="dica">Volta todo mundo para o lobby.</p></div>';
    } else {
      controles = '<div class="fim__controles"><p class="dica">O anfitrião pode começar uma nova partida.</p></div>';
    }

    secs.fim.innerHTML = cabeca + parada + reveal + controles;

    var btn = $('#btn-denovo');
    if (btn) btn.addEventListener('click', function () { btn.disabled = true; socket.emit('jogarNovamente'); });

    crachaModo = null;
    arranjoVenda = null;
  }
})();
