/* =====================================================================
   Widget: Taxas de transação (mempool.space)
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};
window.BIWidgets.mempool = function initMempool() {
  'use strict';
  var CFG = window.BI_CONFIG;

  var BTC_PRICE_USD = 0;
  var AVG_TX_VBYTES = 141;

  function satToUsd(sat) {
    if (!BTC_PRICE_USD) return 'US$ —';
    var usd = (sat * AVG_TX_VBYTES * BTC_PRICE_USD) / 1e8;
    return 'US$ ' + usd.toFixed(2);
  }

  function setText(id, txt) {
    var el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  function loadFees() {
    BI.fetchJSON(CFG.api.mempoolFees, { timeout: 8000, retries: 1 })
      .then(function (d) {
        var none = Math.max(1, Math.round(d.minimumFee || d.economyFee));
        var low = d.economyFee || d.hourFee;
        var med = d.halfHourFee || d.hourFee;
        var high = d.fastestFee;

        setText('mfee-none-val', none);
        setText('mfee-low-val', low);
        setText('mfee-med-val', med);
        setText('mfee-high-val', high);

        setText('mfee-none-usd', satToUsd(none));
        setText('mfee-low-usd', satToUsd(low));
        setText('mfee-med-usd', satToUsd(med));
        setText('mfee-high-usd', satToUsd(high));
      })
      .catch(function () { /* falha silenciosa */ });
  }

  function loadBtcPrice() {
    BI.fetchJSON(CFG.api.mempoolPrices, { timeout: 8000, retries: 1 })
      .then(function (d) { BTC_PRICE_USD = d.USD || 0; loadFees(); })
      .catch(function () { loadFees(); });
  }

  loadBtcPrice();
  setInterval(loadBtcPrice, 30000);
};
