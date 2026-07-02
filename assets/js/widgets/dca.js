/* =====================================================================
   Widget: Simulador DCA em Bitcoin - VERSÃO CORRIGIDA E LIMPA
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};

window.BIWidgets.dca = function initDca() {
  'use strict';
  
  var CFG = window.BI_CONFIG || { api: { binanceTicker24h: 'https://api.binance.com/api/v3/ticker/24hr' } };
  var dcaChart = null;

  function $(id) { return document.getElementById(id); }
  
  if (!$('dca-btn-simulate')) return;

  // Preenche a data final com o mês atual por padrão
  var now = new Date();
  var endInput = $('dca-end');
  if (endInput && !endInput.value) {
    endInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
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

  /* -------------------- Ticker BTC ao Vivo -------------------- */
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

      // Injeta os dados nas IDs exatas do teu HTML
      if ($('dca-btc-price-usd')) $('dca-btc-price-usd').textContent = '$ ' + precoUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if ($('dca-btc-price')) $('dca-btc-price').textContent = 'R$ ' + precoBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      var elVar = $('dca-btc-change');
      if (elVar) {
        elVar.textContent = (variacao >= 0 ? '+' : '') + variacao.toFixed(2) + '%';
        elVar.style.color = variacao >= 0 ? '#10B981' : '#EF4444';
      }
    } catch (e) {
      console.error('Erro ao carregar o ticker ao vivo:', e);
    }
  }

  /* -------------------- Carregar Histórico -------------------- */
  async function carregarHistorico() {
    try {
      const urlDireta = 'https://raw.githubusercontent.com/Bitcoiniciantes/bitcoiniciante/main/dados/historico_dca.json';
      const response = await fetch(urlDireta);
      if (!response.ok) throw new Error("Erro ao ler o ficheiro.");
      return await response.json();
    } catch (e) {
      console.error("Erro no histórico:", e);
      showError("Não foi possível carregar os dados históricos.");
      return null;
    }
  }

  /* -------------------- Lógica do Simulador -------------------- */
  async function simulateDca() {
    var btn = $('dca-btn-simulate');
    var loading = $('dca-loading');
    var resultsBox = $('dca-results');
    
    if (!btn) return;

    try {
      btn.disabled = true;
      if (loading) loading.style.display = 'flex';
      if (resultsBox) resultsBox.style.display = 'none';
      hideError();

      var amountInput = $('dca-monthly');
      var startDate = $('dca-start').value;
      var endDate = $('dca-end').value;
      var monthlyInvestment = parseFloat(amountInput.value);

      var historico = await carregarHistorico();
      if (!historico) return;

      var dadosFiltrados = historico.filter(function(item) {
        return item.mes >= startDate && item.mes <= endDate;
      });

      if (dadosFiltrados.length === 0) throw new Error("Sem dados para este período.");

      var totalInvested = 0;
      var totalBtc = 0;
      var labels = [];
      var dcaValues = [];
      var investedValues = [];

      dadosFiltrados.forEach(function(item) {
        var precoBtc = item.precoBtcBrl;
        var btcCompradoMes = monthlyInvestment / precoBtc;
        totalInvested += monthlyInvestment;
        totalBtc += btcCompradoMes;
        
        // CORREÇÃO DA DATA: Transforma "2024-01" em "01/2024"
        var partes = item.mes.split('-'); 
        labels.push(partes[1] + '/' + partes[0]); 
        
        dcaValues.push(totalBtc * precoBtc);
        investedValues.push(totalInvested);
      });

      var precoFinal = dadosFiltrados[dadosFiltrados.length - 1].precoBtcBrl;
      var finalBrlValue = totalBtc * precoFinal;
      var roi = ((finalBrlValue - totalInvested) / totalInvested) * 100;

      // Atualiza a tabela de resultados do teu HTML
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

      // Desenha o gráfico na ID correta (dca-mini-chart)
      var ctx = $('dca-mini-chart');
      if (ctx && typeof Chart !== 'undefined') {
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
        });
      }

      if (resultsBox) resultsBox.style.display = 'block';

    } catch (e) {
      console.error(e);
      showError(e.message);
    } finally {
      if (loading) loading.style.display = 'none';
      btn.disabled = false;
    }
  }

  var btnSimulate = $('dca-btn-simulate');
  if (btnSimulate) btnSimulate.addEventListener('click', simulateDca);

  // Inicializa o Ticker
  fetchBtcTicker();
  setInterval(fetchBtcTicker, 60000);
};

// Inicialização segura
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.BIWidgets.dca);
} else {
  window.BIWidgets.dca();
}
