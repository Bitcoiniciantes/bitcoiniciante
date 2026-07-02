/* =====================================================================
   Configuração central — endpoints, chaves e constantes
   ===================================================================== */
window.BI_CONFIG = {
  // Formulário de contato (Formspree)
  formspreeId: 'xaqvwpak',
  contactEmail: 'bitcoiniciantes@proton.me',

  // APIs públicas
  api: {
    binanceKlines: 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24',
    binanceWs: 'wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/btcbrl@ticker/usdtbrl@ticker',
    binanceKlinesBase: 'https://api.binance.com/api/v3/klines',
    binanceTicker24h: 'https://api.binance.com/api/v3/ticker/24hr',
    mempoolFees: 'https://mempool.space/api/v1/fees/recommended',
    mempoolBlocks: 'https://mempool.space/api/v1/fees/mempool-blocks',
    mempoolPrices: 'https://mempool.space/api/v1/prices',
    fearGreed: 'https://api.alternative.me/fng/?limit=31&format=json',
    coingeckoSimple: 'https://api.coingecko.com/api/v3/simple/price',
    coingeckoMarketChart: 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart',
    mstrYahoo: 'https://query1.finance.yahoo.com/v8/finance/chart/MSTR?region=US&lang=en-US&interval=1m&range=1d',
    // PTAX (Banco Central do Brasil) — câmbio oficial USD/BRL, histórico completo, sem chave e sem limite de período
    ptaxPeriodo: 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)',
    corsProxy: 'https://api.allorigins.win/get?url='
  },

  // Firebase (Mural de Sentimentos)
  firebase: {
    apiKey: 'AIzaSyDssItjo_Ctfdlnqrf2KD5QmvH21h-sS3Y',
    authDomain: 'mural-bitcoiniciantes.firebaseapp.com',
    databaseURL: 'https://mural-bitcoiniciantes-default-rtdb.firebaseio.com',
    projectId: 'mural-bitcoiniciantes',
    storageBucket: 'mural-bitcoiniciantes.firebasestorage.app',
    messagingSenderId: '725960603784',
    appId: '1:725960603784:web:00b9a802e76afd593c873d'
  },

  // CDNs carregados sob demanda
  cdn: {
    chartjs: 'https://cdn.jsdelivr.net/npm/chart.js',
    firebaseApp: 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
    firebaseDb: 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js'
  }
};
