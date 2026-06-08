/* =====================================================================
   Widget: Fear & Greed Index (alternative.me)
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};
window.BIWidgets.fearGreed = function initFearGreed() {
  'use strict';
  var CFG = window.BI_CONFIG;

  function getLabel(v) {
    if (v <= 20) return 'Medo Extremo';
    if (v <= 40) return 'Medo';
    if (v <= 60) return 'Neutro';
    if (v <= 80) return 'Ganância';
    return 'Ganância Extrema';
  }
  function getColor(v) {
    if (v <= 20) return '#C62828';
    if (v <= 40) return '#E65100';
    if (v <= 60) return '#F9A825';
    if (v <= 80) return '#7CB342';
    return '#2E7D32';
  }
  function rotateNeedle(v) {
    var deg = (v / 100) * 180 - 90;
    var needle = document.getElementById('fng-needle');
    if (needle) needle.style.transform = 'rotate(' + deg + 'deg)';
  }
  function setBadge(badgeId, sentId, val) {
    if (val === null) return;
    var lbl = getLabel(val), col = getColor(val);
    var b = document.getElementById(badgeId);
    var s = document.getElementById(sentId);
    if (b) { b.textContent = val; b.style.background = col; }
    if (s) { s.textContent = lbl; s.style.color = col; }
  }

  function load() {
    BI.fetchJSON(CFG.api.fearGreed, { timeout: 8000, retries: 1 })
      .then(function (d) {
        var data = d.data;
        var now = parseInt(data[0].value, 10);
        var prev = data[1] ? parseInt(data[1].value, 10) : null;
        var week = data[7] ? parseInt(data[7].value, 10) : null;
        var month = data[30] ? parseInt(data[30].value, 10) : null;
        var col = getColor(now);

        var nowSent = document.getElementById('fng-now-sent');
        if (nowSent) { nowSent.textContent = getLabel(now); nowSent.style.color = col; }

        rotateNeedle(now);

        var arcScore = document.getElementById('fng-arc-score');
        if (arcScore) { arcScore.textContent = now; arcScore.setAttribute('fill', col); }

        var dot = document.getElementById('fng-dot');
        if (dot) dot.className = 'fng-dot live';

        var upd = document.getElementById('fng-updated');
        if (upd) {
          var ts = new Date(parseInt(data[0].timestamp, 10) * 1000);
          upd.textContent = 'alternative.me · Atualizado: ' +
            ts.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        setBadge('fng-h-now-badge', 'fng-h-now-sent', now);
        setBadge('fng-h-prev-badge', 'fng-h-prev-sent', prev);
        setBadge('fng-h-week-badge', 'fng-h-week-sent', week);
        setBadge('fng-h-month-badge', 'fng-h-month-sent', month);
      })
      .catch(function () {
        var el = document.getElementById('fng-now-sent');
        if (el) el.textContent = 'Erro ao carregar';
      });
  }

  load();
  setInterval(load, 60000);
};
