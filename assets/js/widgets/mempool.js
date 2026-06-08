/* =====================================================================
   Widget: Taxas de transação (mempool.space)
   - Usa /mempool-blocks para mostrar valores fracionados (0.2, 0.7 sat/vB)
     iguais aos exibidos no mempool.space
   - Faz fallback para /fees/recommended (inteiros) caso /mempool-blocks
     não responda
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};
window.BIWidgets.mempool = function initMempool() {
  'use strict';
  var CFG = window.BI_CONFIG;

  var BTC_PRICE_USD = 0;
  var AVG_TX_VBYTES = 141;

  // Formata sat/vB iguais ao mempool.space:
  //  < 1   → uma casa decimal (0.2)
  //  < 10  → uma casa só se tiver fração (1, 1.2)
  //  >= 10 → inteiro (45)
  function fmtSat(v) {
    if (v == null || isNaN(v)) return '—';
    if (v < 1)  return v.toFixed(1).replace('.', ',');
    if (v < 10) return (Math.round(v * 10) / 10).toString().replace('.', ',');
    return Math.round(v).toString();
  }

  function satToUsd(sat) {
    if (!BTC_PRICE_USD) return 'US$ —';
    var usd = (sat * AVG_TX_VBYTES * BTC_PRICE_USD) / 1e8;
    return 'US$ ' + usd.toFixed(2);
  }

  function setText(id, txt) {
    var el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  function applyFees(none, low, med, high) {
    setText('mfee-none-val', fmtSat(none));
    setText('mfee-low-val',  fmtSat(low));
    setText('mfee-med-val',  fmtSat(med));
    setText('mfee-high-val', fmtSat(high));

    setText('mfee-none-usd', satToUsd(none));
    setText('mfee-low-usd',  satToUsd(low));
    setText('mfee-med-usd',  satToUsd(med));
    setText('mfee-high-usd', satToUsd(high));
  }

  // Lê /mempool-blocks e extrai medianas dos próximos blocos
  function fromBlocks(blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) return null;
    // bloco mais "barato" da fila = última posição (próximas confirmações
    // são o primeiro bloco; quanto mais fundo, menor a taxa de inclusão)
    var first = blocks[0];                                  // próximo bloco
    var last  = blocks[blocks.length - 1];                  // bloco mais ao fundo
    var mid   = blocks[Math.floor(blocks.length / 2)] || first;

    var high = first.medianFee;
    var med  = mid.medianFee;
    var low  = last.medianFee;
    // "sem prioridade" = taxa mínima da fila do último bloco
    var none = (last.feeRange && last.feeRange.length)
      ? last.feeRange[0]
      : low;

    return { none: none, low: low, med: med, high: high };
  }

  function loadFees() {
    // 1ª tentativa: /mempool-blocks (valores fracionados)
    BI.fetchJSON(CFG.api.mempoolBlocks, { timeout: 8000, retries: 1 })
      .then(function (blocks) {
        var f = fromBlocks(blocks);
        if (f) {
          applyFees(f.none, f.low, f.med, f.high);
        } else {
          throw new Error('blocos vazios');
        }
      })
      .catch(function () {
        // Fallback: /fees/recommended (inteiros)
        BI.fetchJSON(CFG.api.mempoolFees, { timeout: 8000, retries: 1 })
          .then(function (d) {
            var none = Math.max(1, d.minimumFee || d.economyFee);
            var low  = d.economyFee  || d.hourFee;
            var med  = d.halfHourFee || d.hourFee;
            var high = d.fastestFee;
            applyFees(none, low, med, high);
          })
          .catch(function () { /* falha silenciosa */ });
      });
  }

  function loadBtcPrice() {
    BI.fetchJSON(CFG.api.mempoolPrices, { timeout: 8000, retries: 1 })
      .then(function (d) { BTC_PRICE_USD = d.USD || 0; loadFees(); })
      .catch(function () { loadFees(); });
  }

  loadBtcPrice();
  setInterval(loadBtcPrice, 30000);
};
