/* =====================================================================
   Widget: Simulador DCA em Bitcoin & Consulta Histórica
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};

window.BIWidgets.dca = function initDca() {
  'use strict';
  console.log("[DCA] Widget iniciado com sucesso!");

  var CFG = window.BI_CONFIG || { api: { binanceTicker24h: 'https://api.binance.com/api/v3/ticker/24hr' } };
  var dcaChart = null;

  var historicoDiarioCache = null;
  var historicoDiarioPromise = null;

  function $(id) { return document.getElementById(id); }

  if (!$('dca-btn-simulate') && !$('dca-hist-btn-consultar')) {
    console.log("[DCA] Botões não encontrados, abortando.");
    return;
  }

  // ==========================================================
  // CORREÇÃO: Datas preenchidas conforme o "Type" do HTML
  // ==========================================================
  var now = new Date();
  var yyyy = now.getFullYear();
  var mm = String(now.getMonth() + 1).padStart(2, '0');
  var dd = String(now.getDate()).padStart(2, '0');

  // 1. O input do Simulador "Até" é type="text" (padrão Brasil: DD/MM/AAAA)
  var endInput = $('dca-end');
  if (endInput && !endInput.value) {
    endInput.value = dd + '/' + mm + '/' + yyyy;
    console.log("[DCA] Data Final Simulador preenchida: " + endInput.value);
  }

  // 2. O input da Consulta Histórica é type="date" (padrão HTML5: YYYY-MM-DD)
  var histInput = $('dca-hist-data');
  if (histInput && !histInput.value) {
    histInput.value = yyyy + '-' + mm + '-' + dd;
    console.log("[DCA] Data Consulta Histórica preenchida: " + histInput.value);
  }

  function showError(msg) {
    var errEl = $('dca-error');
    if (errEl) { errEl.textContent = '⚠️ ' + msg; errEl.style.display = 'block'; }
  }

  function hideError() {
    var errEl = $('dca-error');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  }

  function loadChartJS() {
    return new Promise(function(resolve, reject) {
      if (typeof Chart !== 'undefined') return resolve();
      console.log("[DCA] Baixando biblioteca de Gráficos (Chart.js)...");
      var script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = function() { console.log("[DCA] Chart.js carregado!"); resolve(); };
      script.onerror = function() { reject(new Error("Falha ao carregar o Chart.js.")); };
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

  async function fetchBtcTicker() {
    try {
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
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,brl&include_24hr_change=true');
        const data = await res.json();
        atualizarTelaTicker(data.bitcoin.usd, data.bitcoin.brl, data.bitcoin.brl_24h_change);
      } catch (err) {
        console.error('[DCA] Ticker falhou em ambas as APIs.');
      }
    }
  }

  async function carregarHistoricoDiario() {
    if (historicoDiarioCache) return historicoDiarioCache;
    if (historicoDiarioPromise) return historicoDiarioPromise;

    let urls = [
      './dados/historico_dca.json',
      'https://raw.githubusercontent.com/Bitcoiniciantes/bitcoiniciante/main/dados/historico_dca.json'
    ];

    historicoDiarioPromise = (async function() {
      for (let url of urls) {
        try {
          console.log("[DCA] Tentando buscar JSON do histórico: " + url);
          let response = await fetch(url);
          if (response.ok) {
            let json = await response.json();
            json.sort(function(a, b) { return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0); });
            historicoDiarioCache = json;
            console.log("[DCA] JSON de histórico carregado com sucesso (" + json.length + " linhas).");
            return json;
          }
        } catch (e) {}
      }
      throw new Error("O arquivo de histórico JSON não foi encontrado no servidor.");
    })();

    return historicoDiarioPromise;
  }

  function agruparPorMes(historicoDiario) {
    var porMes = {};
    for (var i = 0; i < historicoDiario.length; i++) {
      var item = historicoDiario[i];
      var mes = item.data.slice(0, 7); 
      if (!porMes[mes]) { porMes[mes] = { mes: mes, precoBtcBrl: item.precoBtcBrl }; }
    }
    var lista = Object.keys(porMes).map(function(k) { return porMes[k]; });
    lista.sort(function(a, b) { return a.mes < b.mes ? -1 : (a.mes > b.mes ? 1 : 0); });
    return lista;
  }

  function precoMaisProximo(historicoDiario, dataAlvoIso) {
    var alvo = new Date(dataAlvoIso + 'T00:00:00');
    var melhor = null;
    for (var i = 0; i < historicoDiario.length; i++) {
      var item = historicoDiario[i];
      var d = new Date(item.data + 'T00:00:00');
      if (d <= alvo) { melhor = item; } else { break; }
    }
    return melhor;
  }

  /* ================= SIMULADOR DCA ================= */
  async function simulateDca(e) {
    if (e) e.preventDefault();
    console.log("[DCA] Simulador acionado pelo botão.");

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

      function getIsoMonth(dateStr) {
        if (!dateStr) return '';
        if (dateStr.includes('/')) {
          var parts = dateStr.split('/');
          if (parts.length === 3) return parts[2] + '-' + parts[1];
          if (parts.length === 2) return parts[1] + '-' + parts[0];
        }
        if (dateStr.includes('-')) return dateStr.substring(0, 7);
        return dateStr;
      }

      var startDate = getIsoMonth(rawStart);
      var endDate = getIsoMonth(rawEnd);
      console.log("[DCA] Procurando datas entre:", startDate, "e", endDate);

      var historicoDiario = await carregarHistoricoDiario();
      var historico = agruparPorMes(historicoDiario);

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
            plugins: { 
              legend: { labels: { color: '#aaa', font: { size: 10 } } },
              tooltip: { callbacks: { label: function(context) { var valor = context.parsed.y; return context.dataset.label + ': R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } } }
            },
            scales: {
              x: { ticks: { maxTicksLimit: 5, font: { size: 9 }, color: '#666' }, grid: { display: false } },
              y: { ticks: { font: { size: 9 }, color: '#666', callback: function (v) { return 'R$ ' + v.toLocaleString('pt-BR'); } }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
          }
        });
      }

      if (resultsBox) resultsBox.style.display = 'block';
      console.log("[DCA] Processo do Simulador concluído.");

    } catch (e) {
      console.error("[DCA] Erro no simulador:", e);
      showError(e.message);
    } finally {
      if (loading) loading.style.display = 'none';
      if (btn) btn.disabled = false;
    }
  }

  /* ================= CONSULTA HISTÓRICA ================= */
  function showHistError(msg) {
    var errEl = $('dca-hist-error');
    if (errEl) { errEl.textContent = '⚠️ ' + msg; errEl.style.display = 'block'; }
  }

  function hideHistError() {
    var errEl = $('dca-hist-error');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  }

  function formatarBRL(v) {
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Conversão inteligente Sats -> BTC[cite: 1]
  function formatarSats(sats) {
    if (sats >= 100000000) {
      var btc = sats / 100000000;
      return btc.toLocaleString('pt-BR', { maximumFractionDigits: 8 }) + ' BTC';
    }
    return Math.round(sats).toLocaleString('pt-BR') + ' sats';
  }

  async function consultarHistorico(e) {
    if (e) e.preventDefault();
    console.log("[DCA] Consulta Histórica acionada pelo botão.");

    var btn = $('dca-hist-btn-consultar');
    var resultsBox = $('dca-hist-results');
    var loading = $('dca-hist-loading');

    try {
      if (btn) btn.disabled = true;
      if (loading) loading.style.display = 'flex';
      if (resultsBox) resultsBox.style.display = 'none';
      hideHistError();

      var rawData = $('dca-hist-data').value;
      var valor = parseFloat($('dca-hist-valor').value);
      console.log("[DCA] Lendo os dados: Data = " + rawData + " | Reais = " + valor);

      if (!rawData) throw new Error("Escolha uma data.");
      if (!valor || valor <= 0) throw new Error("Digite um valor em reais válido.");

      var historicoDiario = await carregarHistoricoDiario();

      var registroData = precoMaisProximo(historicoDiario, rawData);
      var registroHoje = historicoDiario[historicoDiario.length - 1];

      if (!registroData) throw new Error("Não há dados para essa data (antes do início do histórico).");

      var precoData = registroData.precoBtcBrl;
      var precoHoje = registroHoje.precoBtcBrl;

      var satsCompraria = (valor / precoData) * 100000000;
      var satsHoje = (valor / precoHoje) * 100000000;
      var diferenca = ((satsCompraria - satsHoje) / satsHoje) * 100;

      var grid = $('dca-hist-result-grid');
      if (grid) {
        grid.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span style="font-size:12px; color:#aaa;">Preço na data</span>
            <strong style="color:#fff; font-size:16px;">${formatarBRL(precoData)}</strong>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span style="font-size:12px; color:#aaa;">Compraria</span>
            <strong style="color:#F7931A; font-size:16px;">${formatarSats(satsCompraria)}</strong>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span style="font-size:12px; color:#aaa;">Hoje</span>
            <strong style="color:#10B981; font-size:16px;">${formatarSats(satsHoje)}</strong>
            <span style="font-size:11px; color:${diferenca >= 0 ? '#10B981' : '#EF4444'};">${diferenca >= 0 ? '+' : ''}${diferenca.toFixed(1)}% vs. essa data</span>
          </div>
        `;
      }

      if (registroData.data !== rawData) {
        showHistError('Sem pregão em ' + rawData.split('-').reverse().join('/') + ', mostrando o dado mais próximo (' + registroData.data.split('-').reverse().join('/') + ').');
      }

      if (resultsBox) resultsBox.style.display = 'block';
      console.log("[DCA] Consulta Histórica concluída.");

    } catch (e) {
      console.error("[DCA] Erro na consulta histórica:", e);
      showHistError(e.message);
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

  // Ancoragem e purificação dos botões (evita bugs de clicks duplos)
  var oldBtn = $('dca-btn-simulate');
  if (oldBtn) {
    var newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener('click', simulateDca);
    console.log("[DCA] Botão 'Simular' atrelado ao JS com sucesso.");
  }

  var oldHistBtn = $('dca-hist-btn-consultar');
  if (oldHistBtn) {
    var newHistBtn = oldHistBtn.cloneNode(true);
    oldHistBtn.parentNode.replaceChild(newHistBtn, oldHistBtn);
    newHistBtn.addEventListener('click', consultarHistorico);
    console.log("[DCA] Botão 'Consultar' atrelado ao JS com sucesso.");
  }

  fetchBtcTicker();
  setInterval(fetchBtcTicker, 60000);
};

// Aguarda os elementos existirem na tela para iniciar
function arrancarScript() {
  if (!document.getElementById('dca-btn-simulate') && !document.getElementById('dca-hist-btn-consultar')) {
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
