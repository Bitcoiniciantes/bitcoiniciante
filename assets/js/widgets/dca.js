/* =====================================================================
   Widget: Simulador DCA em Bitcoin (fonte: Binance — sem chave, sem 401)
   - Ticker BTC/BRL ao vivo via /api/v3/ticker/24hr
   - Histórico mensal via /api/v3/klines (interval=1M, BTCBRL)
   - Chart.js carregado sob demanda
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};
window.BIWidgets.dca = function initDca() {
  'use strict';
  var CFG = window.BI_CONFIG;
  var dcaChart = null;

  function $(id) { return document.getElementById(id); }
  if (!$('dca-btn-simulate')) return;

  // data final padrão = mês atual
  var now = new Date();
  var endInput = $('dca-end');
  if (endInput && !endInput.value) {
    endInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  /* -------------------- Ticker BTC/BRL via Binance -------------------- */
  function fetchBtcTicker() {
    // Em paralelo: BTCUSDT (preço USD) e BTCBRL (preço BRL + variação 24h)
    Promise.all([
      BI.fetchJSON(CFG.api.binanceTicker24h + '?symbol=BTCUSDT', { timeout: 7000, retries: 1 }),
      BI.fetchJSON(CFG.api.binanceTicker24h + '?symbol=BTCBRL', { timeout: 7000, retries: 1 })
    ]).then(function (arr) {
      var usd = parseFloat(arr[0].lastPrice);
      var brl = parseFloat(arr[1].lastPrice);
      var change = parseFloat(arr[1].priceChangePercent);

      $('dca-btc-price-usd').textContent = '$ ' + Math.round(usd).toLocaleString('en-US');
      $('dca-btc-price').textContent = 'R$ ' + Math.round(brl).toLocaleString('pt-BR');
      var changeEl = $('dca-btc-change');
      changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '% 24h';
      changeEl.className = 'dca__ticker-change ' + (change >= 0 ? 'up' : 'down');
    }).catch(function () { /* ticker é só visual; falha silenciosa */ });
  }
  fetchBtcTicker();
  setInterval(fetchBtcTicker, 60000);

  /* -------------------- Slider -------------------- */
  var monthlySlider = $('dca-monthly');
  var monthlyVal = $('dca-val-monthly');
  if (monthlySlider) monthlySlider.addEventListener('input', function () {
    monthlyVal.textContent = parseInt(this.value, 10).toLocaleString('pt-BR');
  });

  $('dca-btn-simulate').addEventListener('click', dcaSimulate);

  /* -------------------- Helpers -------------------- */
  function getDcaMonths(s, e) {
    var parts = s.split('-').map(Number);
    var eParts = e.split('-').map(Number);
    var months = [], y = parts[0], m = parts[1];
    while (y < eParts[0] || (y === eParts[0] && m <= eParts[1])) {
      months.push({ year: y, month: m });
      m++; if (m > 12) { m = 1; y++; }
    }
    return months;
  }

  // Para cada mês alvo, encontra o kline cuja abertura cai no início desse mês.
  // klines vêm como arrays [openTime, open, high, low, close, volume, closeTime, ...]
  function priceForMonth(klines, year, month) {
    var target = Date.UTC(year, month - 1, 1);
    var closest = klines[0], minD = Math.abs(klines[0][0] - target);
    for (var i = 1; i < klines.length; i++) {
      var d = Math.abs(klines[i][0] - target);
      if (d < minD) { minD = d; closest = klines[i]; }
    }
    return parseFloat(closest[1]); // open do candle
  }

  // Último preço disponível (usado para "valor hoje")
  function latestPrice(klines) {
    var last = klines[klines.length - 1];
    return parseFloat(last[4]); // close do último candle
  }

  /* -------------------- Simulação -------------------- */
  async function dcaSimulate() {
    var monthly = parseInt($('dca-monthly').value, 10);
    var startDate = $('dca-start').value;
    var endDate = $('dca-end').value;

    if (!startDate || !endDate || startDate > endDate) {
      showError('Datas inválidas.');
      return;
    }

    hideError();
    showLoading(true);
    showResults(false);

    try {
      // Carrega Chart.js apenas na primeira simulação
      if (typeof window.Chart === 'undefined') {
        await BI.loadScript(CFG.cdn.chartjs);
      }

      var months = getDcaMonths(startDate, endDate);

      // Validação: período no futuro não tem dado.
      var firstMonthMs = Date.UTC(months[0].year, months[0].month - 1, 1);
      if (firstMonthMs > Date.now()) {
        throw new Error('Período no futuro. Escolha datas até o mês atual.');
      }

      // Janela em ms (start até "agora" para garantir o preço atual no fim)
      var startMs = firstMonthMs;
      var endMs = Date.now();

      // Binance klines: 1 candle/mês, máx 1000 — sobra muito.
      var url = CFG.api.binanceKlinesBase
        + '?symbol=BTCBRL&interval=1M'
        + '&startTime=' + startMs
        + '&endTime=' + endMs
        + '&limit=1000';

      var klines = await BI.fetchJSON(url, { timeout: 12000, retries: 1 });
      if (!klines || klines.length === 0) {
        throw new Error('Sem dados para o período.');
      }

      // DCA: compra no preço de abertura de cada mês
      var totalInvested = 0, totalCoins = 0;
      var dcaValues = [];
      for (var i = 0; i < months.length; i++) {
        var monthMs = Date.UTC(months[i].year, months[i].month - 1, 1);
        if (monthMs > endMs) break; // ignora meses que ainda não aconteceram
        var price = priceForMonth(klines, months[i].year, months[i].month);
        if (!price || isNaN(price)) continue;
        totalCoins += monthly / price;
        totalInvested += monthly;
        dcaValues.push(totalCoins * price);
      }

      if (dcaValues.length === 0) {
        throw new Error('Não há dados para os meses escolhidos.');
      }

      // Reavalia o último ponto com o preço atual (fim do período pedido)
      var current = latestPrice(klines);
      dcaValues[dcaValues.length - 1] = totalCoins * current;
      var finalValue = dcaValues[dcaValues.length - 1];

      var pctTotal = ((finalValue / totalInvested) - 1) * 100;
      var years = dcaValues.length / 12;
      var cagr = years > 0 ? (Math.pow(finalValue / totalInvested, 1 / years) - 1) * 100 : 0;

      displayResults(totalInvested, finalValue, pctTotal, cagr, dcaValues.length);
      renderChart(months.slice(0, dcaValues.length), dcaValues, totalInvested);
      showResults(true);
    } catch (e) {
      showError(e.message || 'Erro ao buscar dados. Tente um período menor.');
    } finally {
      showLoading(false);
    }
  }

  /* -------------------- Render -------------------- */
  function displayResults(invested, final, pctTotal, cagr, numMonths) {
    var grid = $('dca-result-grid');
    var cls = pctTotal >= 0 ? 'positive' : 'negative';
    var sign = pctTotal >= 0 ? '+' : '';
    var signCagr = cagr >= 0 ? '+' : '';
    grid.innerHTML =
      '<div class="dca__result-item"><div class="dca__result-label">Total Investido</div><div class="dca__result-value">R$ ' + Math.round(invested).toLocaleString('pt-BR') + '</div></div>' +
      '<div class="dca__result-item"><div class="dca__result-label">Valor Hoje</div><div class="dca__result-value ' + cls + '">R$ ' + Math.round(final).toLocaleString('pt-BR') + '</div></div>' +
      '<div class="dca__result-item"><div class="dca__result-label">Retorno Total</div><div class="dca__result-value ' + cls + '">' + sign + pctTotal.toFixed(1) + '%</div></div>' +
      '<div class="dca__result-item"><div class="dca__result-label">Retorno Anual (CAGR)</div><div class="dca__result-value ' + cls + '">' + signCagr + cagr.toFixed(1) + '% a.a.</div><div class="dca__result-sub">' + numMonths + ' meses</div></div>';
    $('dca-results-title').textContent = 'Resultado — DCA em Bitcoin (Binance)';
  }

  function renderChart(months, dcaValues, totalInvested) {
    var canvas = $('dca-mini-chart');
    var ctx = canvas.getContext('2d');
    if (dcaChart) dcaChart.destroy();

    var labels = months.map(function (m) { return String(m.month).padStart(2, '0') + '/' + m.year; });
    var investedLine = months.map(function (_, i) { return (totalInvested / months.length) * (i + 1); });

    dcaChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'DCA Bitcoin', data: dcaValues, borderColor: '#F7931A', borderWidth: 2, fill: true, backgroundColor: 'rgba(247,147,26,0.08)', tension: 0.3, pointRadius: 0 },
          { label: 'Total Investido', data: investedLine, borderColor: '#555', borderWidth: 1.5, borderDash: [4, 4], fill: false, tension: 0, pointRadius: 0 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#aaa', font: { size: 10 }, boxWidth: 12 } } },
        scales: {
          x: { ticks: { maxTicksLimit: 5, font: { size: 9 }, color: '#666' }, grid: { display: false } },
          y: { ticks: { font: { size: 9 }, color: '#666', callback: function (v) { return 'R$' + Math.round(v / 1000) + 'k'; } }, grid: { color: 'rgba(255,255,255,0.04)' } }
        }
      }
    });
  }

  function showLoading(v) { $('dca-loading').style.display = v ? 'flex' : 'none'; $('dca-btn-simulate').disabled = v; }
  function showResults(v) { $('dca-results').style.display = v ? 'block' : 'none'; }
  function showError(msg) { var el = $('dca-error'); el.textContent = msg; el.style.display = 'block'; }
  function hideError() { $('dca-error').style.display = 'none'; }
};
