/**
 * BITCOIN INICIANTES — Conversor Bidirecional Estilo Preev
 * Suporte nativo para formatação PT-BR em todas as caixas.
 */

document.addEventListener('DOMContentLoaded', () => {
  const inputLeft = document.getElementById('preev-left-input');
  const selectLeft = document.getElementById('preev-left-select');
  const inputRight = document.getElementById('preev-right-input');
  const selectRight = document.getElementById('preev-right-select');
  const canvas = document.getElementById('preev-canvas');
  
  const scaleBtns = document.querySelectorAll('.preev__scale-btn');
  const tfBtns = document.querySelectorAll('.preev__tf-btn');
  
  const changeEl = document.getElementById('preev-change');
  const highEl = document.getElementById('preev-high');
  const lowEl = document.getElementById('preev-low');

  let activeScale = 'btc';
  let activeTimeframe = '1M';
  let exchangeRate = 0; 
  let pricesHistory = [];
  let openPriceReference = 0;

  const timeframeParams = {
    '1H': { interval: '1m', limit: 60 },
    '1D': { interval: '15m', limit: 96 },
    '1W': { interval: '2h', limit: 84 },
    '1M': { interval: '8h', limit: 90 },
    '1Y': { interval: '1d', limit: 365 }
  };

  const scaleMultipliers = { sat: 0.00000001, micro: 0.000001, milli: 0.001, btc: 1, kilo: 1000 };
  const scaleLabels = { sat: 's', micro: 'μ', milli: 'm', btc: '', kilo: 'k' };

  /**
   * Identifica automaticamente qual API chamar baseado nos 2 ativos selecionados
   */
  function getPairConfig() {
    const from = selectLeft.value;
    const to = selectRight.value;
    if (from === to) return null; // Moedas Iguais
    
    // Mapeamento Bidirecional
    if (from === 'BTC' && to === 'USD') return { symbol: 'BTCUSDT', invert: false };
    if (from === 'USD' && to === 'BTC') return { symbol: 'BTCUSDT', invert: true };
    if (from === 'BTC' && to === 'BRL') return { symbol: 'BTCBRL', invert: false };
    if (from === 'BRL' && to === 'BTC') return { symbol: 'BTCBRL', invert: true };
    if (from === 'USD' && to === 'BRL') return { symbol: 'USDTBRL', invert: false };
    if (from === 'BRL' && to === 'USD') return { symbol: 'USDTBRL', invert: true };
    
    return null;
  }

  /**
   * Limpa qualquer formatação digitada pelo usuário e extrai o valor real Float (Lógica Blindada)
   */
  function parseCleanFloat(val) {
    if (!val) return 0;
    let raw = val.toString().replace(/\s/g, '');
    
    const commaCount = (raw.match(/,/g) || []).length;
    const dotCount = (raw.match(/\./g) || []).length;
    
    if (dotCount > 0 && commaCount > 0) {
        if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
            raw = raw.replace(/\./g, '').replace(',', '.'); // Formato pt-BR (1.234,56)
        } else {
            raw = raw.replace(/,/g, ''); // Formato en-US (1,234.56)
        }
    } else if (commaCount > 1) {
         raw = raw.replace(/,/g, ''); 
    } else if (dotCount > 1) {
         raw = raw.replace(/\./g, '');
    } else if (commaCount === 1) {
         raw = raw.replace(',', '.'); // Se houver apenas 1 vírgula, assume que é decimal pt-BR
    }
    return parseFloat(raw) || 0;
  }

  /**
   * Força a formatação PT-BR universal para todas as moedas
   */
  function formatNumber(val, asset) {
    if (isNaN(val) || val === null) return '—';
    const isCrypto = asset === 'BTC';
    
    // Criptomoedas podem ter até 8 casas decimais. Moedas Fiat travadas em 2 casas.
    const maxDec = isCrypto ? 8 : 2;
    const minDec = isCrypto ? 0 : 2;
    
    return val.toLocaleString('pt-BR', {
      minimumFractionDigits: minDec,
      maximumFractionDigits: maxDec
    });
  }

  /**
   * Executa a matemática de conversão cruzada entre as duas caixas
   */
  function calculateConversion(triggerBox) {
    const config = getPairConfig();
    const factorLeft = selectLeft.value === 'BTC' ? scaleMultipliers[activeScale] : 1;
    const factorRight = selectRight.value === 'BTC' ? scaleMultipliers[activeScale] : 1;

    // Se o usuário selecionou moedas iguais (ex: USD p/ USD)
    if (!config) {
        if (triggerBox === 'left') {
            const val = parseCleanFloat(inputLeft.value);
            inputRight.value = formatNumber(val * (factorLeft / factorRight), selectRight.value);
        } else {
            const val = parseCleanFloat(inputRight.value);
            inputLeft.value = formatNumber(val * (factorRight / factorLeft), selectLeft.value);
        }
        return;
    }

    if (exchangeRate <= 0) return;

    // A taxa real da Binance. Inverte se a seleção estiver espelhada.
    const rate = config.invert ? (1 / exchangeRate) : exchangeRate;

    if (triggerBox === 'left') {
        const val = parseCleanFloat(inputLeft.value);
        const result = val * (factorLeft / factorRight) * rate;
        inputRight.value = formatNumber(result, selectRight.value);
    } else {
        const val = parseCleanFloat(inputRight.value);
        const result = val * (factorRight / factorLeft) * (1 / rate);
        inputLeft.value = formatNumber(result, selectLeft.value);
    }
  }

  /**
   * Atualiza as opções do Dropdown dinamicamente com base na escala (BTC, mBTC, etc)
   */
  function updateSelectTexts() {
    const prefix = scaleLabels[activeScale] || '';
    [selectLeft, selectRight].forEach(select => {
        Array.from(select.options).forEach(opt => {
            if (opt.value === 'BTC') {
                opt.text = prefix + 'BTC';
            }
        });
    });
  }

  // ==========================================
  // CHAMADAS DE API DA BINANCE
  // ==========================================
  
  async function fetchCurrentTicker() {
    const config = getPairConfig();
    if (!config) return;

    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${config.symbol}`);
      const data = await res.json();
      
      if (data && data.price) {
        exchangeRate = parseFloat(data.price);
        // Atualiza passivamente caso o usuário não esteja digitando
        if (document.activeElement !== inputLeft && document.activeElement !== inputRight) {
          calculateConversion('left');
        }
      }
    } catch (err) {
      console.warn("Falha de rede Binance:", err);
    }
  }

  async function fetchHistoricalTrends() {
    const config = getPairConfig();
    
    // Se forem as mesmas moedas, esconde/limpa o gráfico
    if (!config) {
         const ctx = canvas.getContext('2d');
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         renderStats(0, 0, 0);
         return;
    }
    
    const tf = timeframeParams[activeTimeframe];
    
    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${config.symbol}&interval=${tf.interval}&limit=${tf.limit}`);
      const data = await res.json();

      if (data && data.length > 0) {
        let closes = data.map(c => parseFloat(c[4]));
        let highs = data.map(c => parseFloat(c[2]));
        let lows = data.map(c => parseFloat(c[3]));
        let openReference = parseFloat(data[0][1]);
        let closeLast = parseFloat(data[data.length - 1][4]);

        // Se o par estiver invertido (ex: BRL p/ BTC), inverte todo o histórico
        if (config.invert) {
            closes = closes.map(v => 1 / v);
            const newHighs = lows.map(v => 1 / v); // A mínima antiga vira a máxima invertida
            const newLows = highs.map(v => 1 / v);
            highs = newHighs;
            lows = newLows;
            openReference = 1 / openReference;
            closeLast = 1 / closeLast;
        }

        // Aplica o multiplicador da fração do Bitcoin na exibição do gráfico
        const factorLeft = selectLeft.value === 'BTC' ? scaleMultipliers[activeScale] : 1;
        const factorRight = selectRight.value === 'BTC' ? scaleMultipliers[activeScale] : 1;
        const priceMultiplier = factorLeft / factorRight;

        closes = closes.map(v => v * priceMultiplier);
        highs = highs.map(v => v * priceMultiplier);
        lows = lows.map(v => v * priceMultiplier);
        openReference = openReference * priceMultiplier;
        closeLast = closeLast * priceMultiplier;

        const maxPrice = Math.max(...highs);
        const minPrice = Math.min(...lows);
        const changePercent = ((closeLast - openReference) / openReference) * 100;

        openPriceReference = openReference;
        pricesHistory = closes;

        renderStats(maxPrice, minPrice, changePercent);
        drawTrendChart(pricesHistory, changePercent >= 0);
      }
    } catch (err) {
      console.error("Erro Klines:", err);
    }
  }

  // ==========================================
  // RENDERIZAÇÃO GRÁFICA (STATS + CANVAS)
  // ==========================================

  function renderStats(high, low, pct) {
    const prefixObj = { BRL: 'R$ ', USD: '$ ', BTC: '₿ ' };
    const prefix = prefixObj[selectRight.value] || '';
    
    highEl.textContent = `↑ ${prefix}${formatNumber(high, selectRight.value)}`;
    lowEl.textContent = `↓ ${prefix}${formatNumber(low, selectRight.value)}`;

    const isPositive = pct >= 0;
    // Forçamos o fix de 2 casas numéricas, mantendo o símbolo nativo na frente
    changeEl.textContent = `${isPositive ? '▲' : '▼'} ${pct.toFixed(2)}%`;
    changeEl.className = `preev__stat-item change-indicator ${isPositive ? 'up' : 'down'}`;
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

    const coords = prices.map((price, idx) => {
      const x = (idx / (prices.length - 1)) * w;
      const y = h - 15 - ((price - min) / range) * (h - 30);
      return { x, y };
    });

    const themeColor = isBullish ? '#34d399' : '#f87171';
    const gradStart = isBullish ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)';

    // Linha Base (Abertura do Período)
    const openY = h - 15 - ((openPriceReference - min) / range) * (h - 30);
    ctx.beginPath();
    ctx.setLineDash([6, 6]);
    ctx.moveTo(0, openY);
    ctx.lineTo(w, openY);
    ctx.strokeStyle = '#d5d7dc';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]); 

    // Gradiente Base
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

    // Traçado Principal
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

  // ==========================================
  // LISTENERS DE INTERAÇÃO (USUÁRIO)
  // ==========================================

  // Botões de Escala do BTC (Sats, mBTC, etc)
  scaleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      scaleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeScale = btn.getAttribute('data-scale');

      updateSelectTexts();
      calculateConversion('left');
      fetchHistoricalTrends();
    });
  });

  // Inputs de Valores
  inputLeft.addEventListener('input', () => calculateConversion('left'));
  inputRight.addEventListener('input', () => calculateConversion('right'));

  // Ao focar na caixa de input, substitui os pontos p/ facilitar digitação no Brasil
  [inputLeft, inputRight].forEach(input => {
      input.addEventListener('focus', () => {
          const rawVal = parseCleanFloat(input.value);
          input.value = rawVal > 0 ? rawVal.toString().replace('.', ',') : '';
      });
      
      // Ao remover o foco (click fora), formata o número perfeitamente com pontos
      input.addEventListener('blur', () => {
          const rawVal = parseCleanFloat(input.value);
          const asset = input === inputLeft ? selectLeft.value : selectRight.value;
          input.value = formatNumber(rawVal, asset);
      });
  });

  // Selects (Dropdowns)
  [selectLeft, selectRight].forEach(select => {
      select.addEventListener('change', () => {
          updateAll();
      });
  });

  // Botões de Timeframe
  tfBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tfBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTimeframe = btn.getAttribute('data-tf');
      fetchHistoricalTrends();
    });
  });

  window.addEventListener('resize', () => {
    if (pricesHistory.length > 0) {
      const isBullish = changeEl.classList.contains('up');
      drawTrendChart(pricesHistory, isBullish);
    }
  });

  // ==========================================
  // BOOTSTRAP DO SCRIPT
  // ==========================================
  
  async function updateAll() {
    updateSelectTexts();
    await fetchCurrentTicker();
    await fetchHistoricalTrends();
  }

  updateAll();
  setInterval(fetchCurrentTicker, 10000); // Atualiza mercado de background (10s)
});
