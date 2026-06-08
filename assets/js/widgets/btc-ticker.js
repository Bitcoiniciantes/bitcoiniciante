/* =====================================================================
   Widget: Cotação BTC ao vivo (hero)
   - mini gráfico de velas (canvas) com histórico Binance
   - WebSocket Binance para BTC/USD, BTC/BRL, USD/BRL em tempo real
   - MSTR via Yahoo Finance (com proxy CORS, falha silenciosa)
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};
window.BIWidgets.btcTicker = function initBtcTicker() {
  'use strict';
  var CFG = window.BI_CONFIG;

  var candles = [];
  var lastPrice = null;

  var canvas = document.getElementById('btcMiniChart');
  var ctx = canvas ? canvas.getContext('2d') : null;
  if (!canvas) return;

  var priceEl = document.getElementById('btcPrice');
  var change24hEl = document.getElementById('btcChange24h');
  var brlEl = document.getElementById('btcPriceBrl');
  var brlChangeEl = document.getElementById('btcChangeBrl');
  var usdBrlEl = document.getElementById('btcPriceUsdBrl');
  var usdChangeEl = document.getElementById('usdChange');
  var mstrEl = document.getElementById('btcPriceMstr');
  var mstrChangeEl = document.getElementById('mstrChange');
  var dotEl = document.getElementById('btcDot');
  var statusEl = document.getElementById('btcStatusTxt');

  var flashTimer = null;

  function drawChart() {
    if (!ctx || candles.length < 2) return;
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.offsetWidth;
    var h = 72;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    var min = Math.min.apply(null, candles.map(function (c) { return c.l; }));
    var max = Math.max.apply(null, candles.map(function (c) { return c.h; }));
    var range = max - min || 1;
    var spacing = w / candles.length;
    var candleWidth = spacing * 0.52;

    for (var i = 0; i < candles.length; i++) {
      var c = candles[i];
      var x = i * spacing + spacing / 2;
      var yOpen = h - ((c.o - min) / range) * h;
      var yClose = h - ((c.c - min) / range) * h;
      var yHigh = h - ((c.h - min) / range) * h;
      var yLow = h - ((c.l - min) / range) * h;
      var color = c.c >= c.o ? '#00ffae' : '#ff4d6d';

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.lineWidth = 1.2;
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      var bodyY = Math.min(yOpen, yClose);
      var bodyH = Math.max(Math.abs(yClose - yOpen), 2);
      ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, bodyH);
    }
  }

  async function fetchChartData() {
    try {
      var data = await BI.fetchJSON(CFG.api.binanceKlines, { timeout: 8000, retries: 1 });
      candles = data.map(function (k) {
        return { o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]) };
      });
      drawChart();
    } catch (e) { /* falha silenciosa */ }
  }

  async function fetchMSTR() {
    try {
      var url = CFG.api.corsProxy + encodeURIComponent(CFG.api.mstrYahoo);
      var data = await BI.fetchJSON(url, { timeout: 9000, retries: 0 });
      if (data && data.contents) {
        var json = JSON.parse(data.contents);
        var result = json.chart.result[0];
        var price = result.meta.regularMarketPrice;
        var prevClose = result.meta.chartPreviousClose || result.meta.previousClose;
        if (price && mstrEl) {
          mstrEl.textContent = '$ ' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          if (prevClose && mstrChangeEl) {
            var pct = ((price - prevClose) / prevClose) * 100;
            mstrChangeEl.textContent = (pct >= 0 ? '\u25B2 +' : '\u25BC ') + pct.toFixed(2) + '%';
            mstrChangeEl.className = 'bci-change ' + (pct >= 0 ? 'up' : 'down');
          }
        }
      }
    } catch (e) {
      if (mstrEl) mstrEl.textContent = '$ —';
    }
  }

  function connect() {
    var ws;
    try { ws = new WebSocket(CFG.api.binanceWs); }
    catch (e) { return; }

    ws.onopen = function () {
      if (dotEl) dotEl.className = 'btc-live-dot live';
      if (statusEl) statusEl.textContent = 'AO VIVO';
    };

    ws.onmessage = function (e) {
      var payload = JSON.parse(e.data);
      var stream = payload.stream;
      var data = payload.data;

      if (stream === 'btcusdt@ticker') {
        var p = parseFloat(data.c);
        var pct = parseFloat(data.P);
        if (candles.length > 0) {
          var last = candles[candles.length - 1];
          last.c = p;
          if (p > last.h) last.h = p;
          if (p < last.l) last.l = p;
          drawChart();
        }
        var dir = lastPrice === null ? 0 : (p > lastPrice ? 1 : (p < lastPrice ? -1 : 0));
        lastPrice = p;
        if (priceEl) {
          priceEl.textContent = BI.formatUSD(p);
          priceEl.className = 'btc-price ' + (dir === 1 ? 'up' : dir === -1 ? 'down' : '');
        }
        if (change24hEl) {
          change24hEl.textContent = (pct >= 0 ? '\u25B2 +' : '\u25BC ') + pct.toFixed(2) + '% 24h';
          change24hEl.className = 'btc-change-badge ' + (pct >= 0 ? 'up' : 'down');
        }
        if (flashTimer) clearTimeout(flashTimer);
        flashTimer = setTimeout(function () { if (priceEl) priceEl.className = 'btc-price'; }, 700);
      }
      else if (stream === 'btcbrl@ticker') {
        if (brlEl) brlEl.textContent = BI.formatBRL(parseFloat(data.c));
        var brlPct = parseFloat(data.P);
        if (brlChangeEl) {
          brlChangeEl.textContent = (brlPct >= 0 ? '\u25B2 +' : '\u25BC ') + brlPct.toFixed(2) + '%';
          brlChangeEl.className = 'bci-change ' + (brlPct >= 0 ? 'up' : 'down');
        }
      }
      else if (stream === 'usdtbrl@ticker') {
        var usdVal = parseFloat(data.c);
        if (usdBrlEl) usdBrlEl.textContent = BI.formatBRL(usdVal);
        var usdPct = parseFloat(data.P);
        if (usdChangeEl) {
          usdChangeEl.textContent = (usdPct >= 0 ? '\u25B2 +' : '\u25BC ') + usdPct.toFixed(2) + '%';
          usdChangeEl.className = 'bci-change ' + (usdPct >= 0 ? 'up' : 'down');
        }
      }
    };

    ws.onclose = function () {
      if (dotEl) dotEl.className = 'btc-live-dot';
      if (statusEl) statusEl.textContent = 'RECONECTANDO';
      setTimeout(connect, 3000);
    };
    ws.onerror = function () { ws.close(); };
  }

  canvas.width = canvas.offsetWidth;
  fetchChartData().then(connect);
  fetchMSTR();
  setInterval(fetchMSTR, 60000);
  window.addEventListener('resize', drawChart);
};
