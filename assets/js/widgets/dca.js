/* =====================================================================
   Widget: Simulador DCA em Bitcoin - EDIÇÃO BLINDADA
   - Ticker ao vivo nativo
   - Histórico JSON com tripla tentativa (Fail-safe)
   - Proteção contra congelamento de botão
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};

window.BIWidgets.dca = function initDca() {
  'use strict';
  
  // Proteção: Se o config.js falhar, não quebra o código todo
  var CFG = window.BI_CONFIG || { api: { binanceTicker24h: 'https://api.binance.com/api/v3/ticker/24hr' } };
  var dcaChart = null;

  function $(id) { return document.getElementById(id); }
  
  if (!$('dca-btn-simulate')) return;

  // Força o preenchimento da data final (se estiver vazio)
  var now = new Date();
  var endInput = $('dca-end');
  if (endInput && !endInput.value) {
    endInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  /* -------------------- Helpers de Erro -------------------- */
  function showError(msg) {
    var errEl = $('dca-error');
    if (errEl) {
      errEl.textContent = '⚠️ Erro: ' + msg;
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

  /* -------------------- Ticker BTC/BRL (Ao vivo) -------------------- */
  async function fetchBtcTicker() {
    try {
      const [resUsd, resBrl] = await Promise.all([
        fetch(CFG.api.binanceTicker24h + '?symbol=BTCUSDT'),
        fetch(CFG.api.binanceTicker24h + '?symbol=BTCBRL')
      ]);

      const dataUsd = await resUsd.json();
      const dataBrl = await resBrl.json();

      var precoUsd = parseFloat(dataUsd.lastPrice);
      var precoBrl = parseFloat(dataBrl.lastPrice);
      var variacao = parseFloat(dataBrl.priceChangePercent);

      if ($('dca-price-usd')) $('dca-price-usd').textContent = '$ ' + precoUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if ($('dca-price-brl')) $('dca-price-brl').textContent = 'R$ ' + precoBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      var elVar = $('dca-price-var');
      if (elVar) {
        elVar.textContent = (variacao >= 0 ? '+' : '') + variacao.toFixed(2) + '%';
        elVar.className = 'dca-live-var ' + (variacao >= 0 ? 'positive' : 'negative');
      }
    } catch (e) {
      console.error('Ticker falhou:', e);
    }
  }

  /* -------------------- Tripla tentativa do JSON -------------------- */
  async function carregarHistorico() {
    let urls = [
      './dados/historico_dca.json', // 1. Tenta o local do GitHub Pages
      'https://raw.githubusercontent.com/Bitcoiniciantes/bitcoiniciante/main/dados/historico_dca.json', // 2. Tenta o raw da Main
      'https://raw.githubusercontent.com/Bitcoiniciantes/bitcoiniciante/master/dados/historico_dca.json' // 3. Tenta o raw da Master
    ];

    for (let url of urls) {
      try {
        let response = await fetch(url);
        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        // Ignora e tenta o próximo URL
      }
    }
    throw new Error("O ficheiro de histórico não foi encontrado no servidor.");
  }

  /* -------------------- Simulador Principal -------------------- */
  async function simulateDca() {
    var btn = $('dca-btn-simulate');
    if (!btn) return;

    try {
      btn.disabled = true;
      btn.textContent = 'Calculando...';
      hideError();

      // Verifica se o HTML existe antes de tentar ler
      if (!$('dca-amount')) throw new Error("Campo de valor (dca-amount) em falta no HTML.");
      if (!$('dca-start')) throw new Error("Campo de data inicial (dca-start) em falta no HTML.");
      if (!$('dca-end')) throw new Error("Campo de data final (dca-end) em falta no HTML.");

      var amountInput = $('dca-amount');
      var startDate = $('dca-start').value;
      var endDate = $('dca-end').value;
      
      if (!startDate || !endDate) {
          throw new Error("As datas não podem estar vazias.");
      }

      var monthlyInvestment = parseFloat((amountInput.value || '0').replace(/\./g, '').replace(',', '.'));

      if (isNaN(monthlyInvestment) || monthlyInvestment <= 0) {
        throw new Error("Insira um valor mensal válido.");
      }
      if (startDate > endDate) {
        throw new Error("A data inicial não pode ser maior que a final.");
      }

      var historico = await carregarHistorico();
      if (!historico || historico.length === 0) {
        throw new Error("O ficheiro JSON está vazio ou corrompido.");
      }

      var dadosFiltrados = historico.filter(function(item) {
        return item.mes >= startDate && item.mes <= endDate;
      });

      if (dadosFiltrados.length === 0) {
        throw new Error("Não existem dados disponíveis para este período (" + startDate + " a " + endDate + ").");
      }

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
        var valorPosicaoEmReais = totalBtc * precoBtc;

        var partesData = item.mes.split('-');
        labels.push(partesData[1] + '/' + partesData[0]); 
        dcaValues.push(valorPosicaoEmReais);
        investedValues.push(totalInvested);
      });

      var precoFinal = dadosFiltrados[dadosFiltrados.length - 1].precoBtcBrl;
      var finalBrlValue = totalBtc * precoFinal;
      var roi = ((finalBrlValue - totalInvested) / totalInvested) * 100;

      if ($('dca-result-invested')) $('dca-result-invested').textContent = 'R$ ' + totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if ($('dca-result-total')) $('dca-result-total').textContent = 'R$ ' + finalBrlValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      var roiEl = $('dca-result-roi');
      if (roiEl) {
        roiEl.textContent = (roi >= 0 ? '+' : '') + roi.toFixed(2) + '%';
        roiEl.className = roi >= 0 ? 'dca-roi-positive' : 'dca-roi-negative';
      }

      // Previne que a falta do Chart.js congele o processo
      if (typeof Chart === 'undefined') {
          throw new Error("A biblioteca Chart.js não foi carregada na página.");
      }

      var ctx = $('dcaChart');
      if (ctx) {
        if (dcaChart) dcaChart.destroy();
        dcaChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              { label: 'DCA Bitcoin (R$)', data: dcaValues, borderColor: '#F7931A', borderWidth: 2, fill: true, backgroundColor: 'rgba(247,147,26,0.08)', tension: 0.3, pointRadius: 0 },
              { label: 'Total Investido (R$)', data: investedValues, borderColor: '#555', borderWidth: 1.5, borderDash: [4, 4], fill: false, tension: 0, pointRadius: 0 }
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#aaa', font: { size: 10 }, boxWidth: 12 } } },
            scales: {
              x: { ticks: { maxTicksLimit: 5, font: { size: 9 }, color: '#666' }, grid: { display: false } },
              y: { ticks: { font: { size: 9 }, color: '#666', callback: function (v) { return 'R$' + Math.round(v / 1000) + 'k'; } }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
          }
        });
      }

      if ($('dca-result-box')) $('dca-result-box').style.display = 'block';

      // Liberta o botão com sucesso
      btn.disabled = false;
      btn.textContent = 'Simular \u2192';

    } catch (e) {
      // Se algo falhar, liberta o botão e exibe o erro exato na tela
      console.error(e);
      showError(e.message);
      btn.disabled = false;
      btn.textContent = 'Simular \u2192';
    }
  }

  var btnSimulate = $('dca-btn-simulate');
  if (btnSimulate) {
    btnSimulate.addEventListener('click', simulateDca);
  }

  fetchBtcTicker();
  setInterval(fetchBtcTicker, 60000);
};

// =====================================================================
// INICIALIZAÇÃO SEGURA
// =====================================================================
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
