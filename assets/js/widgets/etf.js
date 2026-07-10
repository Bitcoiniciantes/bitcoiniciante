/* =====================================================================
   WIDGET: Spot Bitcoin ETF (SoSoValue)
   O histórico é acumulado dia a dia por um GitHub Action e salvo em
   dados/historico_etf.json (ver scripts/atualizar_etf.js). O widget só
   lê esse arquivo — não chama mais a API da SoSoValue no navegador.
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};

window.BIWidgets.etfWidget = async function () {
    const container = document.getElementById('widget-etf-sosovalue');
    if (!container) return;

    container.innerHTML = `
        <div class="btc-ultra-card etf-widget">
            <div class="etf-header">
                <h3 class="etf-title">Histórico ETF BTC (EUA)</h3>
                <div class="etf-filtros">
                    <button type="button" class="btn-periodo ativo" data-periodo="diario">Diariamente</button>
                    <button type="button" class="btn-periodo" data-periodo="semanal">Semanalmente</button>
                    <button type="button" class="btn-periodo" data-periodo="mensal">Mensal</button>
                </div>
            </div>

            <div class="etf-grid">
                <div class="halv__stat-item">
                    <span class="halv__stat-label">Ativos Totais</span>
                    <span class="halv__stat-val" id="etf-assets">A carregar...</span>
                </div>
                <div class="halv__stat-item">
                    <span class="halv__stat-label">Fluxo (Último dia)</span>
                    <span class="halv__stat-val" id="etf-fluxo-ultimo">A carregar...</span>
                </div>
            </div>

            <div class="etf-canvas-container">
                <canvas id="canvas-etf-oficial"></canvas>
            </div>
        </div>
    `;

    var DIAS_DIARIO = 30;
    var SEMANAS_SEMANAL = 12;
    var MESES_MENSAL = 12;

    var historico = [];      // histórico completo acumulado, ordem cronológica (mais antigo -> mais recente)
    var periodoAtual = 'diario';

    container.querySelectorAll('.btn-periodo').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.classList.contains('ativo')) return;
            container.querySelectorAll('.btn-periodo').forEach(function (b) { b.classList.remove('ativo'); });
            btn.classList.add('ativo');
            periodoAtual = btn.dataset.periodo;
            if (historico.length) {
                renderizarGrafico(dadosDoPeriodo(historico, periodoAtual));
            }
        });
    });

    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = carregarHistorico;
        document.head.appendChild(script);
    } else {
        carregarHistorico();
    }

    async function carregarHistorico() {
        var urls = [
            './dados/historico_etf.json',
            'https://raw.githubusercontent.com/Bitcoiniciantes/bitcoiniciante/main/dados/historico_etf.json'
        ];

        for (var i = 0; i < urls.length; i++) {
            try {
                var resposta = await fetch(urls[i]);
                if (resposta.ok) {
                    var json = await resposta.json();
                    json.sort(function (a, b) { return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0); });
                    historico = json;
                    atualizarStats(historico);
                    renderizarGrafico(dadosDoPeriodo(historico, periodoAtual));
                    return;
                }
            } catch (e) {}
        }

        console.error('[ETF] histórico não encontrado em nenhuma das fontes.');
        document.getElementById('etf-assets').innerText = 'Erro';
        document.getElementById('etf-fluxo-ultimo').innerText = 'Erro';
    }

    // Sempre reflete o dia mais recente do histórico completo, independente do período escolhido no gráfico
    function atualizarStats(dados) {
        var ultimo = dados[dados.length - 1];
        var ultimoFluxo = ultimo.fluxoLiquidoUsd / 1000000;
        var ultimosAssets = ultimo.ativosTotaisUsd;

        var fluxoEl = document.getElementById('etf-fluxo-ultimo');
        fluxoEl.innerText = `${ultimoFluxo >= 0 ? '+' : ''}${ultimoFluxo.toFixed(1)}M`;
        fluxoEl.className = `halv__stat-val ${ultimoFluxo >= 0 ? 'halv__green' : 'halv__red'}`;
        document.getElementById('etf-assets').innerText = `$${(ultimosAssets / 1000000000).toFixed(2)}B`;
    }

    // Recorta o histórico completo conforme o período escolhido:
    // diário = últimos 30 dias | semanal = últimas 12 semanas | mensal = últimos 12 meses
    function dadosDoPeriodo(dados, periodo) {
        if (periodo === 'diario') {
            var diario = dados.slice(-DIAS_DIARIO);
            return {
                datas: diario.map(function (i) { return i.data; }),
                fluxos: diario.map(function (i) { return i.fluxoLiquidoUsd / 1000000; })
            };
        }

        var agrupado = agregarPorPeriodo(dados, periodo);
        var limite = periodo === 'semanal' ? SEMANAS_SEMANAL : MESES_MENSAL;
        return {
            datas: agrupado.datas.slice(-limite),
            fluxos: agrupado.fluxos.slice(-limite)
        };
    }

    // Agrupa os registros diários em semanas (seg-dom) ou meses, somando o fluxo líquido de cada grupo
    function agregarPorPeriodo(dados, periodo) {
        var grupos = new Map();

        dados.forEach(function (item) {
            var chave = periodo === 'semanal' ? chaveDaSemana(item.data) : item.data.slice(0, 7); // YYYY-MM
            if (!grupos.has(chave)) grupos.set(chave, { rotulo: chave, fluxo: 0 });
            grupos.get(chave).fluxo += item.fluxoLiquidoUsd;
        });

        var lista = Array.from(grupos.values());
        return {
            datas: lista.map(function (g) { return g.rotulo; }),
            fluxos: lista.map(function (g) { return g.fluxo / 1000000; })
        };
    }

    // Retorna a segunda-feira (ISO) da semana correspondente à data, como rótulo "AAAA-MM-DD"
    function chaveDaSemana(dataStr) {
        var d = new Date(dataStr + 'T00:00:00Z');
        var diaSemana = d.getUTCDay(); // 0=dom ... 6=sáb
        var diffParaSegunda = (diaSemana === 0 ? -6 : 1 - diaSemana);
        d.setUTCDate(d.getUTCDate() + diffParaSegunda);
        return d.toISOString().slice(0, 10);
    }

    function renderizarGrafico(dados) {
        if (!dados.fluxos.length) return;

        const ctx = document.getElementById('canvas-etf-oficial').getContext('2d');

        if (window.graficoInstancia) window.graficoInstancia.destroy();

        window.graficoInstancia = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dados.datas,
                datasets: [{
                    label: 'Fluxo Líquido (M$)',
                    data: dados.fluxos,
                    backgroundColor: dados.fluxos.map(function (v) { return v >= 0 ? '#4ade80' : '#ff4d6d'; }),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#ccc', maxRotation: 0 } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#ccc' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
};
