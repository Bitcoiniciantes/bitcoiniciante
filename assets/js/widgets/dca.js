/* =====================================================================
   Widget: Simulador DCA em Bitcoin - EXORCISTA E ANTI-ADBLOCK
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};

window.BIWidgets.dca = function initDca() {
  'use strict';
  
  var CFG = window.BI_CONFIG || { api: { binanceTicker24h: 'https://api.binance.com/api/v3/ticker/24hr' } };
  var dcaChart = null;

  function $(id) { return document.getElementById(id); }
  
  if (!$('dca-btn-simulate')) return;

  // ALTERAÇÃO: Define a data inicial padrão no formato brasileiro (dia/mês/ano)
  var now = new Date();
  var endInput = $('dca-end');
  if (endInput && !endInput.value) {
    var dia = String(now.getDate()).padStart(2, '0');
    var mes = String(now.getMonth() + 1).padStart(2, '0');
    var ano = now.getFullYear();
    endInput.value = dia + '/' + mes + '/' + ano;
  }

  function showError(msg) {
    var errEl = $('dca-error');
    if (errEl) {
      errEl.textContent = '⚠️ ' + msg;
      errEl.style.display = 'block';
    }
  }

  function hideError() {
    var errEl = $('dca-error');
    if (errEl) {
      errEl.style.display = 'none';
      errEl.textContent = '';
    }
  }

  // Auto-carregamento do Chart.js
  function loadChartJS() {
    return new Promise(function(resolve, reject) {
      if (typeof Chart !== 'undefined') return resolve();
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = resolve;
      script.onerror = function() { reject(new Error("Falha ao descarregar o Chart.js.")); };
      document.head.appendChild(script);
    });
  }

  function atualizarTelaTicker(usd, brl, varPercent) {
    var precoUsd = parseFloat(usd);
    var precoBrl = parseFloat(brl);
    var variacao = parseFloat(varPercent);

    if ($('dca-btc-price-usd')) $('dca-btc-price-usd').textContent = '$ ' + precoUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if ($('dca-btc-price')) $('dca-btc-price').textContent = 'R$ ' + precoBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    var elVar = $('dca-btc-change');
    if (elVar) {
      elVar.textContent = (variacao >= 0 ? '+' : '') + variacao.toFixed(2) + '%';
      elVar.style.color = variacao >= 0 ? '#10B981' : '#EF4444';
    }
  }

  /* -------------------- Ticker Anti-AdBlock -------------------- */
  async function fetchBtcTicker() {
    try {
      // 1. Tenta a Binance primeiro
      const [resUsd, resBrl] = await Promise.all([
        fetch(CFG.api.binanceTicker24h + '?symbol=BTCUSDT'),
        fetch(CFG.api.binanceTicker24h + '?symbol=BTCBRL')
      ]);
      if (!resUsd.ok || !resBrl.ok) throw new Error("Binance bloqueada");
      
      const dataUsd = await resUsd.json();
      const dataBrl = await resBrl.json();
      atualizarTelaTicker(dataUsd.lastPrice, dataBrl.lastPrice, dataBrl.priceChangePercent);
      
    } catch (e) {
      try {
        // 2. Se falhar (AdBlock), o CoinGecko entra em ação silenciosamente
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,brl&include_24hr_change=true');
        const data = await res.json();
        atualizarTelaTicker(data.bitcoin.usd, data.bitcoin.brl, data.bitcoin.brl_24h_change);
      } catch (err) {
        console.error('Ticker falhou em ambas as APIs.');
      }
    }
  }

  /* -------------------- Busca do Histórico -------------------- */
  async function carregarHistorico() {
    let urls = [
      './dados/historico_dca.json',
      'https://raw.githubusercontent.com/Bitcoiniciantes/bitcoiniciante/main/dados/historico_dca.json'
    ];
    for (let url of urls) {
      try {
        let response = await fetch(url);
        if (response.ok) return await response.json();
      } catch (e) {}
    }
    throw new Error("O ficheiro de histórico JSON não foi encontrado.");
  }

  /* -------------------- Simulador Principal -------------------- */
  async function simulateDca() {
    var loading = $('dca-loading');
    var resultsBox = $('dca-results');
    var btn = $('dca-btn-simulate');
    
    try {
      if (btn) btn.disabled = true;
      if (loading) loading.style.display = 'flex';
      if (resultsBox) resultsBox.style.display = 'none';
      hideError();

      await loadChartJS();

      var amountInput = $('dca-monthly');
      var rawStart = $('dca-start').value;
      var rawEnd = $('dca-end').value;
      var monthlyInvestment = parseFloat(amountInput.value);

      // ALTERAÇÃO: Função interna para converter o formato PT-BR (DD/MM/AAAA) para o formato do JSON (AAAA-MM)
      function brToIsoMonth(dateStr) {
        if (!dateStr) return '';
        var parts = dateStr.split('/');
        // Se o usuário digitou DD/MM/AAAA, pega o Ano e o Mês
        if (parts.length === 3) return parts[2] + '-' + parts[1];
        // Se o usuário digitou apenas MM/AAAA, ajusta também
        if (parts.length === 2) return parts[1] + '-' + parts[0];
        return dateStr;
      }

      var startDate = brToIsoMonth(rawStart);
      var endDate = brToIsoMonth(rawEnd);

      var historico = await carregarHistorico();
      var dadosFiltrados = historico.filter(function(item) {
        return item.mes >= startDate && item.mes <= endDate;
      });

      if (dadosFiltrados.length === 0) throw new Error("Não existem dados disponíveis para este período.");

      var totalInvested = 0;
      var totalBtc = 0;
      var labels = [];
      var dcaValues = [];
      var investedValues = [];

      dadosFiltrados.forEach(function(item) {
        var precoBtc = item.precoBtcBrl;
        var btcCompradoMês = monthlyInvestment / precoBtc;
        totalInvested += monthlyInvestment;
        totalBtc += btcCompradoMês;
        
        // Mantém a exibição dos meses no gráfico em formato MM/AAAA
        labels.push(item.mes.split('-').reverse().join('/')); 
        dcaValues.push(totalBtc * precoBtc);
        investedValues.push(totalInvested);
      });

      var precoFinal = dadosFiltrados[dadosFiltrados.length - 1].precoBtcBrl;
      var finalBrlValue = totalBtc * precoFinal;
      var roi = ((finalBrlValue - totalInvested) / totalInvested) * 100;

      var grid = $('dca-result-grid');
      if (grid) {
        grid.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span style="font-size:12px; color:#aaa;">Total Investido</span>
            <strong style="color:#fff; font-size:16px;">R$ ${totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span style="font-size:12px; color:#aaa;">Valor Atual</span>
            <strong style="color:#fff; font-size:16px;">R$ ${finalBrlValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span style="font-size:12px; color:#aaa;">Retorno</span>
            <strong style="font-size:16px; color:${roi >= 0 ? '#10B981' : '#EF4444'};">${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%</strong>
          </div>
        `;
      }

      var ctx = $('dca-mini-chart');
      if (ctx) {
        if (dcaChart) dcaChart.destroy();
        dcaChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              { label: 'Valor Atual (R$)', data: dcaValues, borderColor: '#F7931A', borderWidth: 2, fill: true, backgroundColor: 'rgba(247,147,26,0.08)', tension: 0.3, pointRadius: 0 },
              { label: 'Investido (R$)', data: investedValues, borderColor: '#555', borderWidth: 1.5, borderDash: [4, 4], fill: false, tension: 0, pointRadius: 0 }
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#aaa', font: { size: 10 } } } },
            scales: {
              x: { ticks: { maxTicksLimit: 5, font: { size: 9 }, color: '#666' }, grid: { display: false } },
              y: { ticks: { font: { size: 9 }, color: '#666', callback: function (v) { return 'R$' + Math.round(v / 1000) + 'k'; } }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
          }
        });
      }

      if (resultsBox) resultsBox.style.display = 'block';

    } catch (e) {
      console.error(e);
      showError(e.message);
    } finally {
      if (loading) loading.style.display = 'none';
      if (btn) btn.disabled = false;
    }
  }

  var slider = $('dca-monthly');
  var sliderVal = $('dca-val-monthly');
  if (slider && sliderVal) {
    slider.addEventListener('input', function() {
      sliderVal.textContent = parseFloat(this.value).toLocaleString('pt-BR');
    });
  }

  // === O HACK CLONE: Mata qualquer fantasma do código antigo ===
  var oldBtn = $('dca-btn-simulate');
  if (oldBtn) {
    var newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener('click', simulateDca);
  }

  fetchBtcTicker();
  setInterval(fetchBtcTicker, 60000);
};

function arrancarScript() {
  if (!document.getElementById('dca-btn-simulate')) {
    setTimeout(arrancarScript, 500);
    return;
  }
  window.BIWidgets.dca();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancarScript);
} else {
  arrancarScript();
}
