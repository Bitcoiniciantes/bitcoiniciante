/**
 * BITCOIN INICIANTES — Conversor de Bitcoin Minimalista
 * Restrito a BTC / USD / BRL.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos do DOM
  const cryptoInput = document.getElementById('preev-crypto-input');
  const fiatInput = document.getElementById('preev-fiat-input');
  const cryptoLabel = document.getElementById('preev-crypto-label');
  const fiatSelect = document.getElementById('preev-fiat-select');
  const canvas = document.getElementById('preev-canvas');
  
  const scaleBtns = document.querySelectorAll('.preev__scale-btn');
  const tfBtns = document.querySelectorAll('.preev__tf-btn');
  
  const changeEl = document.getElementById('preev-change');
  const highEl = document.getElementById('preev-high');
  const lowEl = document.getElementById('preev-low');

  // Estado
  let activeFiat = fiatSelect.value; // USD ou BRL
  let activeScale = 'btc';
  let activeTimeframe = '1M';
  let exchangeRate = 0; // Preço puro de 1 BTC
  let pricesHistory = [];
  let openPriceReference = 0; // Para desenhar a linha base tracejada no gráfico

  // Configurações Binance
  const timeframeParams = {
    '1H': { interval: '1m', limit: 60 },
    '1D': { interval: '15m', limit: 96 },
    '1W': { interval: '2h', limit: 84 },
    '1M': { interval: '8h', limit: 90 },
    '1Y': { interval: '1d', limit: 365 }
  };

  const scaleMultipliers = {
    sat: 0.00000001,
    micro: 0.000001,
    milli: 0.001,
    btc: 1,
    kilo: 1000
  };

  function getScaleFactor() {
    return scaleMultipliers[activeScale] || 1;
  }

  function parseCleanFloat(val) {
    if (!val) return 0;
    let raw = val.replace(/\s/g, '');
    if (raw.includes(',') && raw.includes('.')) {
      if (raw.indexOf(',') > raw.indexOf('.')) {
        raw = raw.replace(/\./g, '').replace(',', '.');
      } else {
        raw = raw.replace(/,/g, '');
      }
    } else if (raw.includes(',')) {
      raw = raw.replace(',', '.');
    }
    return parseFloat(raw) || 0;
  }

  function formatCurrency(val) {
    if (isNaN(val) || val === null) return '—';
    const locale = activeFiat === 'BRL' ? 'pt-BR' : 'en-US';
    return val.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function calculateConversion(trigger) {
    if (exchangeRate <= 0) return;
    const rateWithScale = exchangeRate * getScaleFactor();

    if (trigger === 'crypto') {
      const cryptoAmount = parseCleanFloat(cryptoInput.value);
      fiatInput.value = formatCurrency(cryptoAmount * rateWithScale);
    } else {
      const fiatAmount = parseCleanFloat(fiatInput.value);
      const computedCrypto = fiatAmount / rateWithScale;
      // Impede notações científicas chatas e limita a 8 casas
      cryptoInput.value = Number(computedCrypto.toFixed(8)).toString();
    }
  }

  async function fetchCurrentTicker() {
    try {
      const symbol = `BTC${activeFiat === 'USD' ? 'USDT' : activeFiat}`;
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      const data = await res.json();
      
      if (data && data.price) {
        exchangeRate = parseFloat(data.price);
        if (document.activeElement !== cryptoInput && document.activeElement !== fiatInput) {
          calculateConversion('crypto');
        }
      }
    } catch (err) {
      console.warn("Falha ao obter preço da Binance:", err);
    }
  }

  async function fetchHistoricalTrends() {
    try {
      const symbol = `BTC${activeFiat === 'USD' ? 'USDT' : activeFiat}`;
      const tf = timeframeParams[activeTimeframe];

      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf.interval}&limit=${tf.limit}`);
      const data = await res.json();

      if (data && data.length > 0) {
        pricesHistory = data.map(candle => parseFloat(candle[4]));
        const highs = data.map(candle => parseFloat(candle[2]));
        const lows = data.map(candle => parseFloat(candle[3]));

        const maxPrice = Math.max(...highs) * getScaleFactor();
        const minPrice = Math.min(...lows) * getScaleFactor();

        openPriceReference = parseFloat(data[0][1]); // Salva para a linha tracejada
        const closePrice = parseFloat(data[data.length - 1][4]);
        const changePercent = ((closePrice - openPriceReference) / openPriceReference) * 100;

        renderStats(maxPrice, minPrice, changePercent);
        drawTrendChart(pricesHistory, changePercent >= 0);
      }
    } catch (err) {
      console.error("Falha ao buscar Klines:", err);
    }
  }

  function renderStats(high, low, pct) {
    const prefix = activeFiat === 'BRL' ? 'R$ ' : '$ ';
    highEl.textContent = `↑ ${prefix}${formatCurrency(high)}`;
    lowEl.textContent = `↓ ${prefix}${formatCurrency(low)}`;

    const isPositive = pct >= 0;
    changeEl.textContent = `${isPositive ? '▼' : '▼'} ${pct.toFixed(2)}%`;
    changeEl.className = `preev__stat-item change-indicator ${isPositive ? 'up' : 'down'}`;
    
    // Ajuste cosmético da seta baseado na referência (a seta de queda muda de direção no original)
    if (isPositive) changeEl.textContent = changeEl.textContent.replace('▼', '▲');
  }

  function drawTrendChart(prices, isBullish) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);
    if (prices.length < 2) return;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    // Coordenadas
    const coords = prices.map((price, idx) => {
      const x = (idx / (prices.length - 1)) * w;
      const y = h - 15 - ((price - min) / range) * (h - 30);
      return { x, y };
    });

    const themeColor = isBullish ? '#34d399' : '#f87171';
    const gradStart = isBullish ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)';

    // 1. Linha Base Tracejada (Abertura)
    const openY = h - 15 - ((openPriceReference - min) / range) * (h - 30);
    ctx.beginPath();
    ctx.setLineDash([6, 6]);
    ctx.moveTo(0, openY);
    ctx.lineTo(w, openY);
    ctx.strokeStyle = '#d5d7dc';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]); // Reseta traços

    // 2. Gradiente Inferior
    ctx.beginPath();
    ctx.moveTo(coords[0].x, h);
    ctx.lineTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(coords[i].x, coords[i].y);
    }
    ctx.lineTo(coords[coords.length - 1].x, h);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, gradStart);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // 3. Linha do Gráfico Principal
    ctx.beginPath();
    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(coords[i].x, coords[i].y);
    }
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Interações - Frações BTC
  scaleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      scaleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeScale = btn.getAttribute('data-scale');

      cryptoLabel.textContent = activeScale === 'btc' ? 'BTC' : activeScale;
      
      const baseFiat = parseCleanFloat(fiatInput.value);
      const scaledRate = exchangeRate * getScaleFactor();
      const updatedCrypto = baseFiat / scaledRate;

      cryptoInput.value = isNaN(updatedCrypto) ? '1' : Number(updatedCrypto.toFixed(8)).toString();
      fetchHistoricalTrends();
    });
  });

  // Inputs Textuais
  cryptoInput.addEventListener('input', () => calculateConversion('crypto'));
  fiatInput.addEventListener('input', () => calculateConversion('fiat'));

  fiatInput.addEventListener('focus', () => {
    const rawVal = parseCleanFloat(fiatInput.value);
    fiatInput.value = rawVal > 0 ? rawVal.toString() : '';
  });

  fiatInput.addEventListener('blur', () => {
    const rawVal = parseCleanFloat(fiatInput.value);
    fiatInput.value = formatCurrency(rawVal);
  });

  // Mudança de Moeda Fiat (Restrito a USD e BRL)
  fiatSelect.addEventListener('change', () => {
    activeFiat = fiatSelect.value;
    updateAll();
  });

  // Timeframes (1H, 1D, etc)
  tfBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tfBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTimeframe = btn.getAttribute('data-tf');
      fetchHistoricalTrends();
    });
  });

  // Responsive Canvas
  window.addEventListener('resize', () => {
    if (pricesHistory.length > 0) {
      const isBullish = changeEl.classList.contains('up');
      drawTrendChart(pricesHistory, isBullish);
    }
  });

  async function updateAll() {
    await fetchCurrentTicker();
    await fetchHistoricalTrends();
  }

  // Init
  updateAll();
  setInterval(fetchCurrentTicker, 10000); // 10 segundos
});
