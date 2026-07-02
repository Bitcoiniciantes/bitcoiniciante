/* =====================================================================
   Widget: Simulador DCA em Bitcoin 
   - Ticker ao vivo via Binance nativo
   - Histórico desde 2014 via JSON estático do GitHub Actions
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};

window.BIWidgets.dca = function initDca() {
  'use strict';
  
  var CFG = window.BI_CONFIG;
  var dcaChart = null;

  function $(id) { return document.getElementById(id); }
  
  // Se não encontrar o botão, aborta por segurança
  if (!$('dca-btn-simulate')) return;

  // Preenche a data final padrão com o mês atual (Isto voltará a funcionar!)
  var now = new Date();
  var endInput = $('dca-end');
  if (endInput && !endInput.value) {
    endInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }

  /* -------------------- Ticker BTC/BRL (Cotação ao vivo) -------------------- */
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

      // ⚠️ ATENÇÃO: Se as cotações continuarem em branco, é porque no seu index.html 
      // as IDs não são essas abaixo. Se for o caso, me avise ou troque aqui:
      var elUsd = $('dca-price-usd');
      var elBrl = $('dca-price-brl');
      var elVar = $('dca-price-var');

      if (elUsd) elUsd.textContent = '$ ' + precoUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (elBrl) elBrl.textContent = 'R$ ' + precoBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (elVar) {
        elVar.textContent = (variacao >= 0 ? '+' : '') + variacao.toFixed(2) + '%';
        elVar.className = 'dca-live-var ' + (variacao >= 0 ? 'positive' : 'negative');
      }
    } catch (e) {
      console.error('Erro no ticker ao vivo:', e);
    }
  }

  /* -------------------- Helpers de Erro -------------------- */
  function showError(msg) {
    var errEl = $('dca-error');
    if (errEl) {
      errEl.textContent = msg;
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

  /* -------------------- Leitura do Histórico JSON -------------------- */
  async function carregarHistorico() {
    try {
      const urlDireta = 'https://raw.githubusercontent.com/Bitcoiniciantes/bitcoiniciante/main/dados/historico_dca.json';
      const response = await fetch(urlDireta);
      if (!response.ok) throw new Error("Erro na rede");
      return await response.json();
    } catch (e) {
      console.error("Erro ao carregar os dados:", e);
      showError("Não foi possível carregar os dados históricos.");
      return null;
    }
  }

  /* -------------------- Lógica do Simulador DCA -------------------- */
  async function simulateDca() {
    var btn = $('dca-btn-simulate');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Calculando...';
    hideError();

    var amountInput = $('dca-amount');
    var startInput = $('dca-start');
    var endDate = $('dca-end').value;
    var startDate = startInput.value;
    var monthlyInvestment = parseFloat((amountInput.value || '0').replace(/\./g, '').replace(',', '.'));

    if (isNaN(monthlyInvestment) || monthlyInvestment <= 0) {
      showError('Por favor, insira um valor mensal válido.');
      btn.disabled = false;
      btn.textContent = 'Simular \u2192';
      return;
    }
    if (startDate > endDate) {
      showError('A data inicial não pode ser maior que a data final.');
      btn.disabled = false;
      btn.textContent = 'Simular \u2192';
      return;
    }

    var historico = await carregarHistorico();
    if (!historico) {
      btn.disabled = false;
      btn.textContent = 'Simular \u2192';
      return;
    }

    var dadosFiltrados = historico.filter(function(item) {
      return item.mes >= startDate && item.mes <= endDate;
    });

    if (dadosFiltrados.length === 0) {
      showError('Não há dados disponíveis para este período específico.');
      btn.disabled = false;
      btn.textContent = 'Simular \u2192';
      return;
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

    $('dca-result-invested').textContent = 'R$ ' + totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    $('dca-result-total').textContent = 'R$ ' + finalBrlValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    var roiEl = $('dca-result-roi');
    roiEl.textContent = (roi >= 0 ? '+' : '') + roi.toFixed(2) + '%';
    roiEl.className = roi >= 0 ? 'dca-roi-positive' : 'dca-roi-negative';

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

    $('dca-result-box').style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Simular \u2192';
  }

  var btnSimulate = $('dca-btn-simulate');
  if (btnSimulate) {
    btnSimulate.addEventListener('click', simulateDca);
  }

  fetchBtcTicker();
  setInterval(fetchBtcTicker, 60000);
};

// =====================================================================
// INICIALIZAÇÃO BLINDADA (Resolve o problema da data em branco)
// =====================================================================
function arrancarScript() {
  // Se o HTML da calculadora ainda não existir, tenta de novo em meio segundo
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
