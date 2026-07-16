/**
 * BITCOIN INICIANTES — Conversor de Ativos (BTC, PAXG, USD, BRL)
 */

document.addEventListener('DOMContentLoaded', () => {
  const inputLeft = document.getElementById('preev-left-input');
  const selectLeft = document.getElementById('preev-left-select');
  const inputRight = document.getElementById('preev-right-input');
  const selectRight = document.getElementById('preev-right-select');
  const titleEl = document.getElementById('preev-title');
  const canvas = document.getElementById('preev-canvas');
  const tfBtns = document.querySelectorAll('.preev__tf-btn');
  const changeEl = document.getElementById('preev-change');
  const highEl = document.getElementById('preev-high');
  const lowEl = document.getElementById('preev-low');

  // Mapeamento centralizado de Ativos
  const assets = {
    BTC:  { name: "Bitcoin", symbol: "₿", decimals: 8 },
    PAXG: { name: "PAX Gold", symbol: "PAXG", decimals: 5 },
    USD:  { name: "US Dollar", symbol: "$", decimals: 2 },
    BRL:  { name: "Real Brasileiro", symbol: "R$", decimals: 2 }
  };

  let activeTimeframe = '1M';
  let exchangeRate = 0; 
  let pricesHistory = [];
  let openPriceReference = 0;

  function updateTitle() {
      const from = assets[selectLeft.value].name;
      const to = assets[selectRight.value].name;
      titleEl.textContent = `${from} para ${to}`;
  }

  function getPairSymbol() {
    const from = selectLeft.value;
    const to = selectRight.value;
    if (from === to) return null;
    
    // Lista de pares suportados na Binance
    const pairs = {
        'BTC-USD': 'BTCUSDT', 'USD-BTC': 'BTCUSDT',
        'BTC-BRL': 'BTCBRL', 'BRL-BTC': 'BTCBRL',
        'USD-BRL': 'USDTBRL', 'BRL-USD': 'USDTBRL',
        'PAXG-USD': 'PAXGUSDT', 'USD-PAXG': 'PAXGUSDT'
    };
    return pairs[`${from}-${to}`] || pairs[`${to}-${from}`];
  }

  function formatNumber(val, assetKey) {
    if (isNaN(val) || val === null) return '—';
    const decimals = assets[assetKey].decimals;
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  }

  function parseCleanFloat(val) {
    return parseFloat(val.toString().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')) || 0;
  }

  function calculateConversion(triggerBox) {
    const from = selectLeft.value;
    const to = selectRight.value;

    if (from === to) {
        if (triggerBox === 'left') inputRight.value = inputLeft.value;
        else inputLeft.value = inputRight.value;
        return;
    }

    const symbol = getPairSymbol();
    if (!symbol || exchangeRate <= 0) return;

    // Se o par na API for "BTCUSDT" mas a seleção for "USD-BTC", inverte a taxa
    const isDirect = (symbol === `${from}${to}` || (symbol === 'BTCUSDT' && from === 'BTC')); 
    const rate = isDirect ? exchangeRate : (1 / exchangeRate);

    if (triggerBox === 'left') {
        const val = parseCleanFloat(inputLeft.value);
        inputRight.value = formatNumber(val * rate, to);
    } else {
        const val = parseCleanFloat(inputRight.value);
        inputLeft.value = formatNumber(val * (1 / rate), from);
    }
  }

  async function fetchCurrentTicker() {
    const symbol = getPairSymbol();
    if (!symbol) {
        exchangeRate = 1;
        calculateConversion('left');
        return;
    }
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      const data = await res.json();
      if (data && data.price) {
        exchangeRate = parseFloat(data.price);
        calculateConversion('left');
      }
    } catch (err) { console.warn(err); }
  }

  // --- Funções de Gráfico (mantendo a lógica de limpeza) ---
  // ... (use as mesmas funções renderStats, drawTrendChart e fetchHistoricalTrends do script anterior) ...

  [selectLeft, selectRight].forEach(s => s.addEventListener('change', () => { 
      updateTitle();
      updateAll(); 
  }));
  
  // ... (restante dos listeners)
  updateTitle();
  updateAll();
});
