/**
 * BITCOIN INICIANTES — Conversor de Criptomoedas estilo Preev
 * Utiliza Klines da API pública da Binance para as estatísticas de timeframe e gráfico de tendências.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const btcInput = document.getElementById('preev-btc-input');
  const fiatInput = document.getElementById('preev-fiat-input');
  const currencySelect = document.getElementById('preev-fiat-currency');
  const sparklineCanvas = document.getElementById('preev-sparkline');
  const changeDisplay = document.getElementById('preev-change');
  const highDisplay = document.getElementById('preev-high');
  const lowDisplay = document.getElementById('preev-low');
  const tfButtons = document.querySelectorAll('.preev__tf-btn');

  // App State
  let currentCurrency = currencySelect.value; // USD ou BRL
  let currentTimeframe = '1M';               // Padrão do site
  let btcPrice = 0;                           // Preço real-time de acordo com a moeda
  let pricesHistory = [];                     // Array de histórico do timeframe atual
  let updateInterval = null;

  // Parâmetros de tempo para a API da Binance
  const timeframeConfig = {
    '1H': { interval: '1m', limit: 60 },
    '1D': { interval: '15m', limit: 96 },
    '1S': { interval: '2h', limit: 84 },
    '1M': { interval: '8h', limit: 90 },
    '1A': { interval: '1d', limit: 365 }
  };

  /**
   * Remove toda formatação monetária e retorna como número float
   */
  function parseLocalFloat(str) {
    if (!str) return 0;
    // Remove todos os espaços
    let clean = str.replace(/\s/g, '');
    
    // Tratamento híbrido de separador decimal internacional/brasileiro
    if (clean.includes(',') && clean.includes('.')) {
      if (clean.indexOf(',') > clean.indexOf('.')) {
        // Formato brasileiro (ponto é milhar, vírgula é decimal)
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato americano (vírgula é milhar, ponto é decimal)
        clean = clean.replace(/,/g, '');
      }
    } else if (clean.includes(',')) {
      // Se tiver apenas vírgulas, substitui para ponto decimal
      clean = clean.replace(',', '.');
    }
    return parseFloat(clean) || 0;
  }

  /**
   * Formata moeda local baseada na seleção (BRL ou USD)
   */
  function formatFiat(num) {
    if (isNaN(num) || num === null) return '—';
    const locale = currentCurrency === 'BRL' ? 'pt-BR' : 'en-US';
    return num.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /**
   * Obtém cotação ao vivo diretamente da Binance
   */
  async function fetchLivePrice() {
    try {
      const symbol = currentCurrency === 'BRL' ? 'BTCBRL' : 'BTCUSDT';
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      const data = await response.json();
      if (data && data.price) {
        btcPrice = parseFloat(data.price);
        
        // Se o usuário não estiver focado nos inputs, sincronizamos os valores
        if (document.activeElement !== btcInput && document.activeElement !== fiatInput) {
          const btcVal = parseFloat(btcInput.value) || 0;
          fiatInput.value = formatFiat(btcVal * btcPrice);
        }
      }
    } catch (e) {
      console.warn("Falha ao atualizar preço real-time da Binance:", e);
    }
  }

  /**
   * Busca histórico de Klines para calcular estatísticas de timeframe e renderizar o gráfico
   */
  async function fetchHistoricalData() {
    try {
      const symbol = currentCurrency === 'BRL' ? 'BTCBRL' : 'BTCUSDT';
      const config = timeframeConfig[currentTimeframe];
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${config.interval}&limit=${config.limit}`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        // Estrutura do retorno da Binance Klines:
        // [ [ openTime, openPrice, highPrice, lowPrice, closePrice, ... ] ]
        pricesHistory = data.map(item => parseFloat(item[4])); // Fechamento (Close Price)
        
        const highs = data.map(item => parseFloat(item[2]));   // Máximas
        const lows = data.map(item => parseFloat(item[3]));    // Mínimas

        const absoluteHigh = Math.max(...highs);
        const absoluteLow = Math.min(...lows);
        
        // Preço de abertura da primeira Kline e fechamento da última
        const openPrice = parseFloat(data[0][1]);
        const currentClose = parseFloat(data[data.length - 1][4]);
        const percentChange = ((currentClose - openPrice) / openPrice) * 100;

        // Atualizar interface gráfica
        updateStatsUI(absoluteHigh, absoluteLow, percentChange);
        drawSparkline(pricesHistory, percentChange >= 0);
      }
    } catch (e) {
      console.error("Falha ao obter histórico de timeframes da Binance:", e);
    }
  }

  /**
   * Atualiza as informações do rodapé do Widget
   */
  function updateStatsUI(high, low, change) {
    const symbolPrefix = currentCurrency === 'BRL' ? 'R$ ' : '$ ';
    
    // Máxima e Mínima
    highDisplay.textContent = `↑ ${symbolPrefix}${formatFiat(high)}`;
    lowDisplay.textContent = `↓ ${symbolPrefix}${formatFiat(low)}`;

    // Variação percentual
    const isPositive = change >= 0;
    const sign = isPositive ? '▲ +' : '▼ ';
    
    changeDisplay.textContent = `${sign}${change.toFixed(2)}%`;
    
    // Aplicação das classes corretas
    changeDisplay.className = `preev__stat-item change-indicator ${isPositive ? 'up' : 'down'}`;
  }

  /**
   * Renderizador de Gráfico customizado (Sparkline) no Canvas
   */
  function drawSparkline(prices, isPositive) {
    const ctx = sparklineCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = sparklineCanvas.getBoundingClientRect();

    // Redimensionamento de alta densidade de pixels (Retina display)
    sparklineCanvas.width = rect.width * dpr;
    sparklineCanvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    if (prices.length < 2) return;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    // Converte os preços em pontos coordenados no canvas (margem vertical de 15px)
    const points = prices.map((price, index) => {
      const x = (index / (prices.length - 1)) * width;
      const y = height - 10 - ((price - min) / range) * (height - 20);
      return { x, y };
    });

    const strokeColor = isPositive ? '#00ffae' : '#ff4d6d';
    const gradientStart = isPositive ? 'rgba(0, 255, 174, 0.15)' : 'rgba(255, 77, 109, 0.15)';
    const gradientEnd = 'rgba(13, 13, 13, 0)';

    // 1. Desenhar Área Sombreada de Degradê Abaixo da Linha
    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
    fillGrad.addColorStop(0, gradientStart);
    fillGrad.addColorStop(1, gradientEnd);
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // 2. Desenhar a Linha de Tendência com Brilho Neon
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 6;
    ctx.stroke();

    // Desliga sombras para desenhos subsequentes
    ctx.shadowBlur = 0;
  }

  /**
   * Gerenciadores de Interação de Input
   */
  btcInput.addEventListener('input', () => {
    const btcVal = parseFloat(btcInput.value) || 0;
    fiatInput.value = formatFiat(btcVal * btcPrice);
  });

  fiatInput.addEventListener('input', () => {
    const fiatVal = parseLocalFloat(fiatInput.value);
    if (btcPrice > 0) {
      const computedBtc = fiatVal / btcPrice;
      // Formata com no máximo 8 casas decimais sem arredondamento grosseiro
      btcInput.value = Number(computedBtc.toFixed(8)).toString();
    }
  });

  // Limpa o formato monetário ao focar no campo para facilitar digitação
  fiatInput.addEventListener('focus', () => {
    const rawVal = parseLocalFloat(fiatInput.value);
    if (rawVal > 0) {
      fiatInput.value = rawVal.toString();
    } else {
      fiatInput.value = '';
    }
  });

  // Formata o valor novamente quando o usuário sai do campo (blur)
  fiatInput.addEventListener('blur', () => {
    const rawVal = parseLocalFloat(fiatInput.value);
    fiatInput.value = formatFiat(rawVal);
  });

  /**
   * Alternância de Moedas de Referência (BRL <-> USD)
   */
  currencySelect.addEventListener('change', () => {
    currentCurrency = currencySelect.value;
    
    // Atualização imediata
    fetchLivePrice().then(() => {
      // Recalcula o valor baseado na nova moeda de referência
      const btcVal = parseFloat(btcInput.value) || 0;
      fiatInput.value = formatFiat(btcVal * btcPrice);
    });
    fetchHistoricalData();
  });

  /**
   * Monitoramento de Cliques de Timeframe (1H, 1D, 1S, 1M, 1A)
   */
  tfButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tfButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTimeframe = btn.getAttribute('data-tf');
      
      // Busca dados e desenha dinamicamente
      fetchHistoricalData();
    });
  });

  // Redesenhar o gráfico caso ocorra redimensionamento de janela (responsivo)
  window.addEventListener('resize', () => {
    if (pricesHistory.length > 0) {
      const percentChange = parseFloat(changeDisplay.textContent.replace(/[▲▼\s+%]/g, '')) || 0;
      drawSparkline(pricesHistory, percentChange >= 0);
    }
  });

  /**
   * Inicialização e loops de sincronização automatizados
   */
  async function init() {
    await fetchLivePrice();
    await fetchHistoricalData();

    // Sincroniza em segundo plano a cada 10 segundos para cotação real-time fluida
    updateInterval = setInterval(() => {
      fetchLivePrice();
    }, 10000);
  }

  init();
});
