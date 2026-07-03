async function fetchMSTR() {
  if (!mstrEl) return;

  try {
    var url = CFG.api.corsProxy + encodeURIComponent(CFG.api.mstrYahoo);

    var response = await BI.fetchJSON(url, {
      timeout: 9000,
      retries: 1
    });

    // Compatível com vários proxies
    var json = response.contents
      ? JSON.parse(response.contents)
      : response;

    if (
      !json ||
      !json.chart ||
      !json.chart.result ||
      !json.chart.result.length
    ) {
      throw new Error("Resposta inválida do Yahoo.");
    }

    var meta = json.chart.result[0].meta;

    if (!meta) {
      throw new Error("Meta inexistente.");
    }

    var price = Number(meta.regularMarketPrice);

    var prevClose =
      Number(meta.chartPreviousClose) ||
      Number(meta.previousClose);

    if (!Number.isFinite(price)) {
      throw new Error("Preço inválido.");
    }

    // Atualiza somente quando recebeu um valor válido
    mstrEl.textContent = BI.formatUSD(price);

    if (
      Number.isFinite(prevClose) &&
      prevClose > 0 &&
      mstrChangeEl
    ) {
      var pct = ((price - prevClose) / prevClose) * 100;

      mstrChangeEl.textContent = BI.formatPct(pct);
      mstrChangeEl.className =
        "bci-change " + (pct >= 0 ? "up" : "down");
    }

  } catch (e) {

    // NÃO limpa a tela.
    // Mantém o último preço válido.
    console.warn("Yahoo MSTR indisponível:", e);

  }
}
