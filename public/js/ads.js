// ───────────────────────────────────────────────────────────────────────────
//  BATALHA DE VINIS — anúncios (leves, não-intrusivos)
//
//  Dois lugares só: rodapé da vitrine e tela de fim de jogo. Nunca cobre o
//  jogo, sem pop-up/intersticial/vídeo. Enquanto não houver conta de AdSense
//  configurada, mostra um placeholder discreto (não carrega script externo).
//
//  ▶ PARA ATIVAR DE VERDADE (depois de aprovar o site no Google AdSense):
//    1. preencha BDV_ADS.cliente com seu "ca-pub-XXXXXXXXXXXXXXXX";
//    2. crie 2 blocos de anúncio no painel do AdSense e cole os IDs em
//       BDV_ADS.slots.vitrine e BDV_ADS.slots.fim;
//    3. publique o /ads.txt na raiz do site (já tem um modelo em public/ads.txt);
//    4. ative o Gerenciamento de Consentimento (CMP) do Google p/ LGPD/GDPR.
//  Para desligar tudo: BDV_ADS.ativo = false.
// ───────────────────────────────────────────────────────────────────────────
(function () {
  window.BDV_ADS = window.BDV_ADS || {
    ativo: true,
    cliente: 'ca-pub-5458101207661511', // seu ID de editor do AdSense
    // Crie um bloco "Display" no painel do AdSense e cole o ID do bloco aqui:
    slots: { vitrine: '' },
  };
  var cfg = window.BDV_ADS;
  var scriptCarregado = false;

  function ehIngles() { return localStorage.getItem('bdv_lang') === 'en'; }
  function rotulo() { return ehIngles() ? 'Advertisement' : 'Publicidade'; }
  function textoPlaceholder() { return ehIngles() ? 'Ad space' : 'Espaço de anúncio'; }

  function carregarAdSense() {
    if (scriptCarregado || !cfg.cliente) return;
    // Não duplica: o loader já costuma estar no <head> da vitrine.
    if (document.querySelector('script[src*="adsbygoogle.js"]')) { scriptCarregado = true; return; }
    scriptCarregado = true;
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
      encodeURIComponent(cfg.cliente);
    document.head.appendChild(s);
  }

  // Preenche um container com um anúncio (ou placeholder se ainda não configurado).
  window.montarAnuncio = function (container, slotKey) {
    if (!container) return;
    if (!cfg.ativo) { container.style.display = 'none'; return; }

    var slot = (cfg.slots && cfg.slots[slotKey]) || '';
    container.classList.add('anuncio');
    container.innerHTML = '<span class="anuncio__rotulo">' + rotulo() + '</span>';

    if (cfg.cliente && slot) {
      carregarAdSense();
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', cfg.cliente);
      ins.setAttribute('data-ad-slot', slot);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      container.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    } else {
      var ph = document.createElement('div');
      ph.className = 'anuncio__placeholder';
      ph.textContent = textoPlaceholder();
      container.appendChild(ph);
    }
  };

  // Preenche automaticamente containers estáticos: <div data-anuncio="vitrine">
  function auto() {
    var nodes = document.querySelectorAll('[data-anuncio]');
    for (var i = 0; i < nodes.length; i++) {
      window.montarAnuncio(nodes[i], nodes[i].getAttribute('data-anuncio'));
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', auto);
  } else {
    auto();
  }
})();
