/* =====================================================================
   Utilitários compartilhados (ATUALIZADO PARA MSTR VIA COINGECKO)
   ===================================================================== */
window.BI = (function () {
  'use strict';

  /* ---------- Formatação ---------- */
  function formatUSD(p) {
    return '$ ' + Number(p).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatBRL(p) {
    return 'R$ ' + Number(p).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function formatPct(pct) {
    return (pct >= 0 ? '\u25B2 +' : '\u25BC ') + Number(pct).toFixed(2) + '%';
  }

  /* ---------- Fetch resiliente ---------- */
  async function fetchJSON(url, opts) {
    opts = opts || {};
    var timeout = opts.timeout || 8000;
    var retries = opts.retries != null ? opts.retries : 1;
    for (var attempt = 0; attempt <= retries; attempt++) {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, timeout);
      try {
        var res = await fetch(url, { signal: controller.signal, headers: opts.headers });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) {
        clearTimeout(timer);
        if (attempt === retries) throw e;
        await new Promise(function (r) { setTimeout(r, 600 * (attempt + 1)); });
      }
    }
  }

  /* ---------- NOVA: Fetch específico para MSTR (CoinGecko) ---------- */
  async function fetchMstrPrice() {
    try {
      const data = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=microstrategy&vs_currencies=usd');
      return data.microstrategy.usd;
    } catch (e) {
      console.error("Erro ao buscar MSTR na CoinGecko:", e);
      return null;
    }
  }

  /* ---------- Carregamento de scripts externos ---------- */
  var _scriptCache = {};
  function loadScript(src) {
    if (_scriptCache[src]) return _scriptCache[src];
    _scriptCache[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Falha ao carregar ' + src)); };
      document.head.appendChild(s);
    }).catch(function (err) { delete _scriptCache[src]; throw err; });
    return _scriptCache[src];
  }

  function onVisible(el, cb, rootMargin) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { obs.unobserve(entry.target); cb(); }
      });
    }, { rootMargin: rootMargin || '200px' });
    obs.observe(el);
  }

  return {
    formatUSD: formatUSD,
    formatBRL: formatBRL,
    formatPct: formatPct,
    fetchJSON: fetchJSON,
    fetchMstrPrice: fetchMstrPrice, // Nova função exportada
    loadScript: loadScript,
    onVisible: onVisible
  };
})();
