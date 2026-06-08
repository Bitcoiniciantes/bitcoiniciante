/* =====================================================================
   Utilitários compartilhados
   - formatação de moeda
   - fetch com timeout + retry
   - carregamento de scripts sob demanda
   - lazy-load de widgets via IntersectionObserver
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
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- Fetch resiliente ---------- */
  // fetch com timeout (AbortController) e uma tentativa de retry
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

  /* ---------- Carregamento de scripts externos sob demanda ---------- */
  var _scriptCache = {};
  function loadScript(src) {
    if (_scriptCache[src]) return _scriptCache[src];
    _scriptCache[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
    return _scriptCache[src];
  }
  // Carrega scripts em sequência (mantém ordem de dependência)
  async function loadScripts(list) {
    for (var i = 0; i < list.length; i++) {
      await loadScript(list[i]);
    }
  }

  /* ---------- Lazy-load de widget quando entra na viewport ---------- */
  // Dispara `cb` uma única vez quando o elemento aproxima-se da tela.
  function onVisible(el, cb, rootMargin) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { cb(); return; }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          obs.unobserve(entry.target);
          cb();
        }
      });
    }, { rootMargin: rootMargin || '200px' });
    obs.observe(el);
  }

  return {
    formatUSD: formatUSD,
    formatBRL: formatBRL,
    formatPct: formatPct,
    escapeHtml: escapeHtml,
    fetchJSON: fetchJSON,
    loadScript: loadScript,
    loadScripts: loadScripts,
    onVisible: onVisible
  };
})();
