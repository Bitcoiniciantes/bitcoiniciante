const fs = require('fs');
const path = require('path');

async function gerarHistorico() {
  try {
    // 1. Busca BTC em Dólar e Dólar em Real do Yahoo Finance (15 anos)
    const resBtc = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1mo&range=15y');
    const btcJson = await resBtc.json();
    
    const resBrl = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/BRL=X?interval=1mo&range=15y');
    const brlJson = await resBrl.json();

    const btcTimestamps = btcJson.chart.result[0].timestamp;
    const btcPrices = btcJson.chart.result[0].indicators.quote[0].close;
    
    const brlTimestamps = brlJson.chart.result[0].timestamp;
    const brlPrices = brlJson.chart.result[0].indicators.quote[0].close;

    let historicoMensal = [];

    // 2. Cruza os dados mês a mês
    for (let i = 0; i < btcTimestamps.length; i++) {
      const date = new Date(btcTimestamps[i] * 1000);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const btcUsd = btcPrices[i];
      if (!btcUsd) continue;

      let brlRate = 5.0; // Valor padrão de segurança
      for (let j = 0; j < brlTimestamps.length; j++) {
        const dDate = new Date(brlTimestamps[j] * 1000);
        if (dDate.getFullYear() === date.getFullYear() && dDate.getMonth() === date.getMonth()) {
          brlRate = brlPrices[j] || brlRate;
          break;
        }
      }

      historicoMensal.push({
        mes: yearMonth,
        precoBtcBrl: btcUsd * brlRate
      });
    }

    // 3. Cria a pasta 'dados' se não existir e salva o JSON
    const dirPath = path.join(__dirname, '../dados');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    const filePath = path.join(dirPath, 'historico_dca.json');
    fs.writeFileSync(filePath, JSON.stringify(historicoMensal, null, 2));
    
  } catch (error) {
    console.error("Erro:", error);
    process.exit(1);
  }
}

gerarHistorico();
