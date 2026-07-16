/**
 * BITCOIN INICIANTES — Conversor estilo Preev.com
 * Cálculos instantâneos, Sparklines em HTML5 Canvas, suporte a múltiplos timeframes e frações.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elementos do DOM
  const cryptoInput = document.getElementById('preev-crypto-input');
  const fiatInput = document.getElementById('preev-fiat-input');
  const cryptoLabel = document.getElementById('preev-crypto-label');
  const fiatSelect = document.getElementById('preev-fiat-select');
  const canvas = document.getElementById('preev-canvas');
  
  const scaleBtns = document.querySelectorAll('.preev__scale-btn');
  const coinBtns = document.querySelectorAll('.preev__coin-btn');
  const tfBtns = document.querySelectorAll('.preev__tf-btn');
  
  const changeEl = document.getElementById('preev-change');
  const highEl = document.getElementById('preev-high');
  const lowEl = document.getElementById('preev-low');

  // Estado da Aplicação
  let activeCoin = 'BTC';       // Ativo padrão
  let activeFiat = 'BRL';       // Fiduciária padrão
  let activeScale = 'btc';      // Fração selecionada (sat, micro, milli, btc, kilo)
  let activeTimeframe = '1M';   // Histórico padrão
  let exchangeRate = 0;         // Preço do ativo sem escala
  let pricesHistory = [];

  // Configurações de tempo para dados históricos da Binance
  const timeframeParams = {
    '1H': { interval: '1m', limit: 60 },
    '1D': { interval: '15m', limit: 96 },
    '1W': { interval: '2h', limit: 84 },
    '1M': { interval: '8h', limit: 90 },
    '1Y': { interval: '1d', limit: 365 }
  };

  // Multiplicadores matemáticos das escalas estilo Preev
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

  /**
   * Limpa formatação fiduciária para cálculos
   */
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

  /**
   * Formata os valores monetários de acordo com a moeda corrente
   */
  function formatCurrency(val) {
    if (isNaN(val) || val === null) return '—';
    const locale = activeFiat === 'BRL' ? 'pt-BR' : 'en-US';
    return val.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Converte moeda com base nas interações
   */
  function calculateConversion(trigger) {
    if (exchangeRate <= 0) return;
    
    const factor = getScaleFactor();
    const rateWithScale = exchangeRate * factor;

    if (trigger === 'crypto') {
      const cryptoAmount = parseCleanFloat(cryptoInput.value);
      fiatInput.value = formatCurrency(cryptoAmount * rateWithScale);
    } else {
      const fiatAmount = parseCleanFloat(fiatInput.value);
      const computedCrypto = fiatAmount / rateWithScale;
      cryptoInput.value = Number(computedCrypto.toFixed(8)).toString();
    }
  }

  /**
   * Ticker Real-Time via Binance API
   */
  async function fetchCurrentTicker() {
    try {
      const targetSymbol = activeFiat === 'USD' ? 'USDT' : activeFiat;
      const symbol = `${activeCoin}${targetSymbol}`;
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      const data = await res.json();
      
      if (data && data.price) {
        exchangeRate = parseFloat(data.price);
        
        // Atualiza campos se nenhum estiver em foco
        if (document.activeElement !== cryptoInput && document.activeElement !== fiatInput) {
          calculateConversion('crypto');
        }
      }
    } catch (err) {
      console.warn("Falha de rede ao requisitar preço imediato na Binance:", err);
    }
  }

  /**
   * Obtém Klines da Binance para desenhar o gráfico e calcular mín/máx
   */
  async function fetchHistoricalTrends() {
    try {
      const targetSymbol = activeFiat === 'USD' ? 'USDT' : activeFiat;
      const symbol = `${activeCoin}${targetSymbol}`;
      const tf = timeframeParams[activeTimeframe];

      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf.interval}&limit=${tf.limit}`);
      const data = await res.json();

      if (data && data.length > 0) {
        pricesHistory = data.map(candle => parseFloat(candle[4])); // Fechamentos
        const highPrices = data.map(candle => parseFloat(candle[2]));
        const lowPrices = data.map(candle => parseFloat(candle[3]));

        const maxPrice = Math.max(...highPrices) * getScaleFactor();
        const minPrice = Math.min(...lowPrices) * getScaleFactor();

        const openPrice = parseFloat(data[0][1]);
        const closePrice = parseFloat(data[data.length - 1][4]);
        const changePercent = ((closePrice - openPrice) / openPrice) * 100;

        renderStats(maxPrice, minPrice, changePercent);
        drawTrendChart(pricesHistory, changePercent >= 0);
      }
    } catch (err) {
      console.error("Falha ao buscar histórico de klines:", err);
    }
  }

  /**
   * Atualiza as estatísticas consolidadas no rodapé do Widget
   */
  function renderStats(high, low, pct) {
    const prefix = activeFiat === 'BRL' ? 'R$ ' : activeFiat === 'EUR' ? '€ ' : '$ ';
    highEl.textContent = `↑ ${prefix}${formatCurrency(high)}`;
    lowEl.textContent = `↓ ${prefix}${formatCurrency(low)}`;

    const isPositive = pct >= 0;
    changeEl.textContent = `${isPositive ? '▲ +' : '▼ '}${pct.toFixed(2)}%`;
    changeEl.className = `preev__stat-item change-indicator ${isPositive ? 'up' : 'down'}`;
  }

  /**
   * Desenha o Sparkline de Alta Densidade no Canvas
   */
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
      const y = h - 12 - ((price - min) / range) * (h - 24);
      return { x, y };
    });

    const themeColor = isBullish ? '#4ade80' : '#ff4d6d';
    const gradStart = isBullish ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 77, 109, 0.12)';

    // Desenha gradiente abaixo do gráfico
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

    // Desenha linha principal
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

  // Monitoria de Ações de Escala (sat, micro, milli, btc, kilo)
  scaleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      scaleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeScale = btn.getAttribute('data-scale');

      // Altera o rótulo do input
      cryptoLabel.textContent = activeScale === 'btc' ? activeCoin : activeScale;
      
      // Ajusta o input cripto para refletir a nova escala baseado na fiduciária atual
      const baseFiat = parseCleanFloat(fiatInput.value);
      const scaledRate = exchangeRate * getScaleFactor();
      const updatedCrypto = baseFiat / scaledRate;

      cryptoInput.value = isNaN(updatedCrypto) ? '1' : Number(updatedCrypto.toFixed(8)).toString();

      fetchHistoricalTrends();
    });
  });

  // Ativos Rápidos
  coinBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      coinBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCoin = btn.getAttribute('data-coin');

      // Se a moeda mudar, a escala volta a ser nativa do ativo
      scaleBtns.forEach(b => b.classList.remove('active'));
      document.querySelector('[data-scale="btc"]').classList.add('active');
      activeScale = 'btc';
      cryptoLabel.textContent = activeCoin;

      updateData();
    });
  });

  // Escuta interativa dos campos de texto
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

  // Moedas fiat
  fiatSelect.addEventListener('change', () => {
    activeFiat = fiatSelect.value;
    updateData();
  });

  // Timeframes
  tfBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tfBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTimeframe = btn.getAttribute('data-tf');
      fetchHistoricalTrends();
    });
  });

  // Redimensionamento do canvas
  window.addEventListener('resize', () => {
    if (pricesHistory.length > 0) {
      const isBullish = !changeEl.classList.contains('down');
      drawTrendChart(pricesHistory, isBullish);
    }
  });

  async function updateData() {
    await fetchCurrentTicker();
    await fetchHistoricalTrends();
  }

  // Inicialização padrão
  updateData();
  setInterval(fetchCurrentTicker, 10000); // Sincronização em segundo plano (10s)
});
