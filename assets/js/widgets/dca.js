/* =====================================================================
   Widget: Simulador DCA em Bitcoin - EXORCISTA E ANTI-ADBLOCK
   + Consulta Histórica de Preço (data -> preço / satoshis)
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};

window.BIWidgets.dca = function initDca() {
  'use strict';

  var CFG = window.BI_CONFIG || { api: { binanceTicker24h: 'https://api.binance.com/api/v3/ticker/24hr' } };
  var dcaChart = null;

  // Cache do histórico diário, compartilhado entre o simulador e a consulta
  var historicoDiarioCache = null;
  var historicoDiarioPromise = null;

  function $(id) { return document.getElementById(id); }

  if (!$('dca-btn-simulate') && !$('dca-hist-btn-consultar')) return;

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

  /* -------------------- Busca do Histórico (diário) -------------------- */
  // Retorna um array ordenado de { data: 'YYYY-MM-DD', precoBtcBrl, precoBtcUsd, cotacaoUsdBrl }
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
          let response = await fetch(url);
          if (response.ok) {
            let json = await response.json();
            json.sort(function(a, b) { return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0); });
            historicoDiarioCache = json;
            return json;
          }
        } catch (e) {}
      }
      throw new Error("O ficheiro de histórico JSON não foi encontrado.");
    })();

    return historicoDiarioPromise;
  }

  // Agrupa o histórico diário em 1 registro por mês (pega o primeiro dia disponível de cada mês),
  // no mesmo formato que o Simulador DCA mensal já espera: { mes: 'YYYY-MM', precoBtcBrl }
  function agruparPorMes(historicoDiario) {
    var porMes = {};
    for (var i = 0; i < historicoDiario.length; i++) {
      var item = historicoDiario[i];
      var mes = item.data.slice(0, 7); // 'YYYY-MM'
      if (!porMes[mes]) {
        porMes[mes] = { mes: mes, precoBtcBrl: item.precoBtcBrl };
      }
    }
    var lista = Object.keys(porMes).map(function(k) { return porMes[k]; });
    lista.sort(function(a, b) { return a.mes < b.mes ? -1 : (a.mes > b.mes ? 1 : 0); });
    return lista;
  }

  // Acha o registro do dia exato, ou o dia anterior mais próximo (fim de semana/feriado)
  function precoMaisProximo(historicoDiario, dataAlvoIso) {
    var alvo = new Date(dataAlvoIso + 'T00:00:00');
    var melhor = null;
    for (var i = 0; i < historicoDiario.length; i++) {
      var item = historicoDiario[i];
      var d = new Date(item.data + 'T00:00:00');
      if (d <= alvo) {
        melhor = item;
      } else {
        break; // array está ordenado, pode parar
      }
    }
    return melhor;
  }

  /* -------------------- Simulador Principal (mensal) -------------------- */
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
  plugins: { 
    legend: { labels: { color: '#aaa', font: { size: 10 } } },
    // NOVO: Código adicionado para formatar a caixinha do mouse com 2 casas decimais
    tooltip: {
      callbacks: {
        label: function(context) {
          var valor = context.parsed.y;
          return context.dataset.label + ': R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
      }
    }
  },
  scales: {
    x: { ticks: { maxTicksLimit: 5, font: { size: 9 }, color: '#666' }, grid: { display: false } },
    y: { ticks: { font: { size: 9 }, color: '#666', callback: function (v) { return 'R$ ' + v.toLocaleString('pt-BR'); } }, grid: { color: 'rgba(255,255,255,0.05)' } }
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

  /* -------------------- Consulta Histórica (data -> preço / satoshis) -------------------- */
  function showHistError(msg) {
    var errEl = $('dca-hist-error');
    if (errEl) {
      errEl.textContent = '⚠️ ' + msg;
      errEl.style.display = 'block';
    }
  }

  function hideHistError() {
    var errEl = $('dca-hist-error');
    if (errEl) {
      errEl.style.display = 'none';
      errEl.textContent = '';
    }
  }

  function formatarBRL(v) {
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatarSats(sats) {
    return Math.round(sats).toLocaleString('pt-BR') + ' sats';
  }

  async function consultarHistorico() {
    var btn = $('dca-hist-btn-consultar');
    var resultsBox = $('dca-hist-results');
    var loading = $('dca-hist-loading');

    try {
      if (btn) btn.disabled = true;
      if (loading) loading.style.display = 'flex';
      if (resultsBox) resultsBox.style.display = 'none';
      hideHistError();

      var rawData = $('dca-hist-data').value; // input type="date" -> 'YYYY-MM-DD'
      var valor = parseFloat($('dca-hist-valor').value);

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

    } catch (e) {
      console.error(e);
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

  // === O HACK CLONE: Mata qualquer fantasma do código antigo ===
  var oldBtn = $('dca-btn-simulate');
  if (oldBtn) {
    var newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener('click', simulateDca);
  }

  var oldHistBtn = $('dca-hist-btn-consultar');
  if (oldHistBtn) {
    var newHistBtn = oldHistBtn.cloneNode(true);
    oldHistBtn.parentNode.replaceChild(newHistBtn, oldHistBtn);
    newHistBtn.addEventListener('click', consultarHistorico);
  }

  // Data padrão da consulta: hoje
  var histDataInput = $('dca-hist-data');
  if (histDataInput && !histDataInput.value) {
    histDataInput.valueAsDate = new Date();
  }

  fetchBtcTicker();
  setInterval(fetchBtcTicker, 60000);
};

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
