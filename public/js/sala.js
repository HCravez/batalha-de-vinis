// ════════════════════════════════════════════════════════════════════════════
//  BATALHA DE VINIS — cliente da sala
//  Renderiza lobby, jogo, a batalha de vendas (revelação com flip 3D) e a
//  parada de sucessos. O segredo do jogo é respeitado: a caixa dos rivais só
//  aparece como lombadas de costas; os discos só viram no balcão e no fim.
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
    jogo: $('#jogo'),
    revelacao: $('#revelacao'),
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

  // ── Paletas ──────────────────────────────────────────────────────────────
  var COR_GENERO = {
    'Rock': '#ff3d6e', 'Jazz': '#c9a227', 'Soul': '#d56b2c', 'MPB': '#2f9e6b',
    'Eletrônico': '#4f8cff', 'Punk': '#e23b3b', 'Pop': '#d65fb0', 'Hip-Hop': '#f0a32b',
  };
  var COR_RAR = { comum: '#b8a89a', raro: '#4f8cff', lendario: '#ffc83d' };
  var ROTULO_RAR = { comum: 'Comum', raro: 'Raro', lendario: 'Lendário' };

  function money(n) {
    return 'R$ ' + (Number(n) || 0);
  }

  // Cor da capa derivada do nome do álbum (determinística).
  function hashStr(s) {
    var h = 0;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }
  function corDoAlbum(v) {
    var h = hashStr((v && (v.album + '·' + v.artista)) || 'x');
    var mat = h % 360;
    var c1 = 'hsl(' + mat + ', 62%, 58%)';
    var c2 = 'hsl(' + ((mat + 38) % 360) + ', 54%, 34%)';
    return { c1: c1, c2: c2 };
  }

  // ── HTML de uma capa (sleeve) ────────────────────────────────────────────
  function sleeveFront(v, opts) {
    opts = opts || {};
    var cor = corDoAlbum(v);
    var classes = ['sleeve'];
    if (opts.mao) classes.push('sleeve--mao');
    if (opts.escolhido) classes.push('is-escolhido');
    if (v.raridade === 'lendario') classes.push('rar-lendario');

    var tabCor = COR_GENERO[v.genero] || '#ff3d6e';
    var rarCor = COR_RAR[v.raridade] || '#6a5444';
    var attrs = 'style="--c1:' + cor.c1 + ';--c2:' + cor.c2 + '"';
    if (opts.mao) {
      attrs += ' role="button" tabindex="0" data-uid="' + esc(v.uid) + '"' +
        ' aria-pressed="' + (opts.escolhido ? 'true' : 'false') + '"' +
        ' aria-label="Vender ' + esc(v.album) + ', ' + esc(v.artista) + '"';
    }

    return '' +
      '<div class="' + classes.join(' ') + '" ' + attrs + '>' +
        '<div class="sleeve__art"><div class="sleeve__art-bola"></div></div>' +
        '<span class="sleeve__tab" style="--tab:' + tabCor + '">' + esc(v.genero) + '</span>' +
        '<span class="etiqueta sleeve__sticker">$' + esc(v.valor) + '</span>' +
        '<div class="sleeve__meta">' +
          '<span class="sleeve__album">' + esc(v.album) + '</span>' +
          '<span class="sleeve__artista">' + esc(v.artista) + '</span>' +
        '</div>' +
        '<span class="sleeve__rar" style="--rar-cor:' + rarCor + '">' +
          (ROTULO_RAR[v.raridade] || v.raridade) +
        '</span>' +
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
  var escolhidoUid = null;
  var ultimaRodadaJogo = -1;
  var crachaModo = null; // 'editar' | 'pronto'
  var lobbyMontado = false;

  socket.on('connect', function () {
    socket.emit('entrarSala', { code: code, playerId: pid, nome: nomeSalvo }, function (resp) {
      if (resp && resp.erro) {
        mostrarErroEntrada(resp.erro);
      }
    });
  });

  socket.on('connect_error', function () {
    toast('Sem conexão com a loja. O servidor está rodando?');
  });

  socket.on('estado', function (vis) {
    S = vis;
    render();
  });
  socket.on('avisoSala', function (msg) { toast(msg); });
  socket.on('revelacaoBatalha', function (p) { mostrarRevelacao(p); });
  socket.on('fimDeJogo', function (p) { mostrarFim(p); });

  function mostrarErroEntrada(msg) {
    mostrarSecao('aviso');
    secs.aviso.innerHTML =
      '<div class="lobby__cabeca">' +
        '<span class="selo">opa…</span>' +
        '<h2>Não deu pra entrar</h2>' +
      '</div>' +
      '<div class="cracha-eu" style="text-align:center">' +
        '<p style="color:var(--smoke);margin:0 0 16px">' + esc(msg) + '</p>' +
        '<a class="btn btn--rosa" href="/">Voltar para a vitrine</a>' +
      '</div>';
  }

  // ── Render principal ─────────────────────────────────────────────────────
  function render() {
    if (!S) return;
    switch (S.fase) {
      case 'lobby': renderLobby(); break;
      case 'jogo': renderJogo(); break;
      case 'revelacao': mostrarSecao('revelacao'); break; // conteúdo vem do evento
      case 'fim': mostrarSecao('fim'); break;             // conteúdo vem do evento
    }
  }

  // ── LOBBY ────────────────────────────────────────────────────────────────
  function renderLobby() {
    mostrarSecao('lobby');
    if (!lobbyMontado) montarLobby();
    atualizarCracha();
    atualizarPrateleira();
    atualizarHost();
  }

  function montarLobby() {
    secs.lobby.innerHTML =
      '<div class="lobby__cabeca">' +
        '<span class="selo">bem-vindo, lojista</span>' +
        '<h2>Quem tá na loja</h2>' +
      '</div>' +
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
      // já está no modo certo — não reescrevo (preserva o que o usuário digita)
      if (modo === 'pronto') {
        var nomeEl = $('#cracha .nome');
        if (nomeEl) nomeEl.textContent = eu.nome || 'Lojista';
      }
      return;
    }
    crachaModo = modo;
    var cracha = $('#cracha');

    if (modo === 'pronto') {
      cracha.innerHTML =
        '<div class="pronto-feito">' +
          '<div class="nome">' + esc(eu.nome || 'Lojista') + '</div>' +
          '<div class="marca-pronto"><span class="carimbo carimbo--pop">Pronto</span></div>' +
        '</div>';
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
      nomeSalvo = nome;
      localStorage.setItem('bdv_nome', nome);
      socket.emit('ficarPronto', { nome: nome });
    }
    $('#btn-pronto').addEventListener('click', confirmar);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
    });
  }

  function atualizarPrateleira() {
    var alvo = $('#prateleira');
    var lista = (S.jogadores || []).map(function (j) {
      var cls = ['lojista'];
      if (j.ehHost) cls.push('is-host');
      if (j.pronto) cls.push('is-pronto');
      if (!j.conectado) cls.push('is-off');
      var status = !j.conectado ? 'ausente…'
        : j.pronto ? 'pronto pra abrir'
        : 'escolhendo o nome…';
      var nome = j.nome || 'Sem nome';
      if (j.ehVoce) nome += ' (você)';
      return '<div class="' + cls.join(' ') + '">' +
        '<div class="lojista__nome">' + esc(nome) + '</div>' +
        '<div class="lojista__status">' + status + '</div>' +
      '</div>';
    }).join('');
    alvo.innerHTML = lista || '<p class="esperando">Ninguém por aqui ainda…</p>';
  }

  function atualizarHost() {
    var alvo = $('#host-controles');
    var jogadores = S.jogadores || [];
    var prontos = jogadores.filter(function (j) { return j.pronto && j.nome; }).length;
    var total = jogadores.length;

    if (!S.souHost) {
      var anfitriao = jogadores.find(function (j) { return j.ehHost; });
      alvo.innerHTML = '<p class="dica">Esperando <b>' +
        esc((anfitriao && anfitriao.nome) || 'o anfitrião') +
        '</b> abrir as portas…</p>';
      return;
    }

    var podeAbrir = total >= 2 && prontos === total;
    var dica = total < 2
      ? 'Chame mais um lojista — precisa de pelo menos 2.'
      : (prontos < total
          ? 'Faltam ' + (total - prontos) + ' lojista(s) ficarem prontos.'
          : 'Tudo pronto! Pode abrir as portas.');

    alvo.innerHTML =
      '<button id="btn-iniciar" class="btn btn--g"' + (podeAbrir ? '' : ' disabled') + '>Abrir as portas</button>' +
      '<p class="dica">' + dica + '</p>';

    if (podeAbrir) {
      $('#btn-iniciar').addEventListener('click', function () {
        socket.emit('iniciar');
      });
    }
  }

  // ── JOGO ─────────────────────────────────────────────────────────────────
  function renderJogo() {
    mostrarSecao('jogo');

    if (S.rodada !== ultimaRodadaJogo) {
      escolhidoUid = null;
      ultimaRodadaJogo = S.rodada;
    }

    var d = S.demanda || {};
    var modCls = d.tipo === 'raridade' ? ' demanda--raridade'
      : d.tipo === 'valor' ? ' demanda--valor' : '';

    var cartaz =
      '<div class="demanda' + modCls + '">' +
        '<span class="demanda__rodada-tag">Faixa ' + S.rodada + '/' + S.totalRodadas + '</span>' +
        '<div class="demanda__faixa">a freguesia pede…</div>' +
        '<h2 class="demanda__titulo">' + esc(d.titulo || '') + '</h2>' +
        '<div class="demanda__sub">' + esc(d.sub || '') + '</div>' +
      '</div>';

    var rivais = renderRivais();
    var minha = renderMinhaArea();

    secs.jogo.innerHTML = cartaz + rivais + minha;
    ligarEventosJogo();
  }

  function renderRivais() {
    var outros = (S.jogadores || []).filter(function (j) { return !j.ehVoce; });
    if (!outros.length) {
      return '<div><div class="secao-rotulo">Os rivais</div>' +
        '<p class="esperando">Sem rivais na loja.</p></div>';
    }
    var cards = outros.map(function (j) {
      var cls = ['rival'];
      if (j.jogou) cls.push('is-jogou');
      if (!j.conectado) cls.push('is-off');

      var n = Math.max(0, j.discosNaCaixa | 0);
      var lombadas = '';
      for (var i = 0; i < n; i++) lombadas += '<div class="lombada"></div>';

      var nome = esc(j.nome || 'Lojista') + (j.ehHost ? ' <span class="estrela">★</span>' : '');
      var balcao = j.jogou ? 'disco no balcão ✓' : (j.conectado ? 'escolhendo…' : 'ausente');

      return '<div class="' + cls.join(' ') + '">' +
        '<div class="rival__topo">' +
          '<span class="rival__nome">' + nome + '</span>' +
          '<span class="rival__grana">' + money(j.dinheiro) + '</span>' +
        '</div>' +
        '<div class="rival__caixa">' + lombadas +
          '<span class="contador-discos">' + n + '</span>' +
        '</div>' +
        '<div class="rival__balcao">' + balcao + '</div>' +
      '</div>';
    }).join('');

    return '<div><div class="secao-rotulo">Os rivais &middot; caixa fechada</div>' +
      '<div class="rivais">' + cards + '</div></div>';
  }

  function renderMinhaArea() {
    var eu = S.voce || { mao: [], dinheiro: 0 };
    var mao = eu.mao || [];

    var discos = mao.map(function (v) {
      return sleeveFront(v, { mao: !eu.jaJoguei, escolhido: !eu.jaJoguei && v.uid === escolhidoUid });
    }).join('');

    var rodape;
    if (eu.jaJoguei) {
      rodape = '<p class="esperando">Disco no balcão. Aguardando a freguesia decidir…</p>';
    } else {
      var esc1 = mao.find(function (v) { return v.uid === escolhidoUid; });
      var label = esc1
        ? '<span class="escolhido">Escolhido: <b>' + esc(esc1.album) + '</b></span>'
        : '<span class="escolhido">Toque num disco da sua caixa para escolher.</span>';
      rodape = '<div class="acao-vender">' + label +
        '<button id="btn-vender" class="btn btn--rosa"' + (esc1 ? '' : ' disabled') + '>Vender este disco</button>' +
      '</div>';
    }

    return '<div class="minha-area">' +
      '<div class="minha-area__topo">' +
        '<h3>Sua caixa</h3>' +
        '<div class="minha-grana">' + money(eu.dinheiro) + '<small>faturado</small></div>' +
      '</div>' +
      '<div class="caixa-discos">' + (discos || '<p class="esperando">Caixa vazia.</p>') + '</div>' +
      rodape +
    '</div>';
  }

  function ligarEventosJogo() {
    var eu = S.voce || {};
    if (eu.jaJoguei) return;

    var sleeves = secs.jogo.querySelectorAll('.sleeve--mao');
    sleeves.forEach(function (s) {
      function escolher() {
        escolhidoUid = s.getAttribute('data-uid');
        renderJogo();
      }
      s.addEventListener('click', escolher);
      s.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); escolher(); }
      });
    });

    var btn = $('#btn-vender');
    if (btn) {
      btn.addEventListener('click', function () {
        if (!escolhidoUid) return;
        btn.disabled = true;
        socket.emit('jogar', { uid: escolhidoUid });
      });
    }
  }

  // ── REVELAÇÃO (batalha de vendas) ────────────────────────────────────────
  function mostrarRevelacao(p) {
    mostrarSecao('revelacao');
    var d = p.demanda || {};
    var ehUltima = p.rodada >= p.totalRodadas;

    var cabeca =
      '<div class="revelacao__cabeca">' +
        '<span class="selo">a hora da verdade</span>' +
        '<h2>Batalha de Vendas</h2>' +
        '<div class="revelacao__demanda">Faixa ' + p.rodada + '/' + p.totalRodadas +
          ' &middot; ' + esc(d.titulo || '') + '</div>' +
      '</div>';

    var vendas = (p.jogadas || []).map(function (jd, i) {
      var venceu = (p.vencedores || []).indexOf(jd.playerId) >= 0;
      var ganho = (p.ganhos && p.ganhos[jd.playerId] != null) ? p.ganhos[jd.playerId] : 0;
      return '<div class="venda" data-i="' + i + '"' + (venceu ? ' data-venceu="1"' : '') + '>' +
          '<div class="venda__nome">' + esc(jd.nome || 'Lojista') + '</div>' +
          '<div class="flip">' +
            '<div class="flip__inner">' +
              '<div class="flip__face">' + sleeveFront(jd.vinil, {}) + '</div>' +
              '<div class="flip__face flip__back">' + sleeveBack() + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="venda__pontos">' + jd.pontos + ' pts &middot; ' +
            '<span class="ganho">+' + ganho + '</span></div>' +
          '<div class="venda__carimbo"></div>' +
        '</div>';
    }).join('');

    var placar = '<div class="placar-mini">' +
      (p.jogadas || []).map(function (jd) {
        var tot = (p.dinheiro && p.dinheiro[jd.playerId] != null) ? p.dinheiro[jd.playerId] : 0;
        return '<span>' + esc(jd.nome) + ' <b>' + money(tot) + '</b></span>';
      }).join('') +
    '</div>';

    var controles;
    if (S && S.souHost) {
      controles = '<div class="rev-controles">' +
        '<button id="btn-proxima" class="btn">' + (ehUltima ? 'Fechar a parada' : 'Próxima faixa') + '</button>' +
        '<p class="dica">Avança sozinho em alguns segundos.</p>' +
      '</div>';
    } else {
      controles = '<div class="rev-controles"><p class="dica">O anfitrião puxa a próxima faixa…</p></div>';
    }

    secs.revelacao.innerHTML = cabeca + '<div class="balcao">' + vendas + '</div>' + placar + controles;

    var btnProx = $('#btn-proxima');
    if (btnProx) {
      btnProx.addEventListener('click', function () {
        btnProx.disabled = true;
        socket.emit('proxima');
      });
    }

    // Vira as capas uma a uma — o momento da revelação.
    var cards = secs.revelacao.querySelectorAll('.venda');
    cards.forEach(function (card, i) {
      var flip = card.querySelector('.flip');
      setTimeout(function () {
        flip.classList.add('virado');
        card.classList.add('revelado');
        if (card.getAttribute('data-venceu')) card.classList.add('venceu');
        var carimbo = card.querySelector('.venda__carimbo');
        setTimeout(function () {
          if (card.getAttribute('data-venceu')) {
            carimbo.innerHTML = '<span class="carimbo carimbo--vendido carimbo--pop">Vendido!</span>';
          } else {
            carimbo.innerHTML = '<span class="esperando">encalhou</span>';
          }
        }, 480);
      }, 350 + i * 620);
    });
  }

  // ── FIM (parada de sucessos) ─────────────────────────────────────────────
  function mostrarFim(p) {
    mostrarSecao('fim');
    var classif = p.classificacao || [];
    var campea = classif[0];

    var cabeca =
      '<div class="fim__cabeca">' +
        '<span class="selo">fim de jogo</span>' +
        '<h2>Parada de Sucessos</h2>' +
        (campea ? '<div class="fim__campea">🏆 ' + esc(campea.nome) + ' fatura mais e leva a parada!</div>' : '') +
      '</div>';

    var parada = '<div class="parada">' +
      classif.map(function (c, i) {
        var cls = 'parada__linha' + (i === 0 ? ' campea' : '');
        return '<div class="' + cls + '">' +
          '<div class="parada__pos">' + (i + 1) + 'º</div>' +
          '<div class="parada__nome">' + esc(c.nome || 'Lojista') + '</div>' +
          '<div class="parada__grana">' + money(c.dinheiro) + '</div>' +
        '</div>';
      }).join('') +
    '</div>';

    var blocos = (p.maosFinais || []).map(function (m) {
      var discos = (m.vinis || []).map(function (v) { return sleeveFront(v, {}); }).join('');
      return '<div class="reveal-final__bloco">' +
        '<div class="reveal-final__nome">' + esc(m.nome || 'Lojista') + '</div>' +
        '<div class="reveal-final__bonus">+ ' + money(m.bonus) + ' de colecionador</div>' +
        '<div class="reveal-final__discos">' + (discos || '<span class="esperando">caixa vazia</span>') + '</div>' +
      '</div>';
    }).join('');

    var reveal = '<div class="reveal-final">' +
      '<h3>O que sobrou na caixa</h3>' +
      '<div class="grade">' + blocos + '</div>' +
    '</div>';

    var controles;
    if (S && S.souHost) {
      controles = '<div class="fim__controles">' +
        '<button id="btn-denovo" class="btn btn--rosa btn--g">Tocar de novo</button>' +
        '<p class="dica">Volta todo mundo para o lobby.</p>' +
      '</div>';
    } else {
      controles = '<div class="fim__controles"><p class="dica">O anfitrião pode começar uma nova rodada.</p></div>';
    }

    secs.fim.innerHTML = cabeca + parada + reveal + controles;

    var btn = $('#btn-denovo');
    if (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true;
        socket.emit('jogarNovamente');
      });
    }

    // Reset de estado de jogo para a próxima partida.
    escolhidoUid = null;
    ultimaRodadaJogo = -1;
    crachaModo = null;
  }
})();
