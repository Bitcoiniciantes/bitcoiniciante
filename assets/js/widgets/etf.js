/* =====================================================================
   WIDGET: Spot Bitcoin ETF (SoSoValue) - ATUALIZADO
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};

window.BIWidgets.etfWidget = async function() {
    // ====================================================================
    // CHAVE DA API DA SOSOVALUE
    // ====================================================================
    const CHAVE_API_SOSOVALUE = "SOSO-85dba142513d4577893df18c8448e3de"; 
    // ====================================================================

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

    var dadosBrutos = [];   // dados diários crus, em ordem cronológica (mais antigo -> mais recente)
    var periodoAtual = 'diario';

    container.querySelectorAll('.btn-periodo').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.classList.contains('ativo')) return;
            container.querySelectorAll('.btn-periodo').forEach(function (b) { b.classList.remove('ativo'); });
            btn.classList.add('ativo');
            periodoAtual = btn.dataset.periodo;
            if (dadosBrutos.length) {
                renderizarGrafico(agregarPorPeriodo(dadosBrutos, periodoAtual));
            }
        });
    });

    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => buscarDadosSoSoValue();
        document.head.appendChild(script);
    } else {
        buscarDadosSoSoValue();
    }

   async function buscarDadosSoSoValue() {
    try {
        const url = "https://openapi.sosovalue.com/openapi/v1/etfs/summary-history?symbol=BTC&country_code=US&limit=365";

        console.log("Consultando:", url);

        const resposta = await fetch(url, {
            method: "GET",
            headers: {
                "x-soso-api-key": CHAVE_API_SOSOVALUE,
                "Accept": "application/json"
            }
        });

        const texto = await resposta.text();

        console.log("Status:", resposta.status);
        console.log("Resposta:", texto);

        if (!resposta.ok) {
            throw new Error(`HTTP ${resposta.status}`);
        }

        const json = JSON.parse(texto);

        if (json.code !== 0 || !Array.isArray(json.data)) {
            throw new Error(json.message || 'Resposta inesperada da API');
        }

        // API retorna do mais recente para o mais antigo -> inverte para ordem cronológica
        dadosBrutos = json.data.slice().reverse();

        atualizarStats(dadosBrutos);
        renderizarGrafico(agregarPorPeriodo(dadosBrutos, periodoAtual));

    } catch (e) {
        console.error(e);

        document.getElementById("etf-assets").innerText = "Erro";
        document.getElementById("etf-fluxo-ultimo").innerText = "Erro";
    }
}

    // Atualiza os cards de estatística com o dado diário mais recente
    // (independe do período escolhido no gráfico, igual ao site da SoSoValue)
    function atualizarStats(dados) {
        var ultimo = dados[dados.length - 1];
        var ultimoFluxo = Number(ultimo.total_net_inflow) / 1000000;
        var ultimosAssets = Number(ultimo.total_net_assets);

        var fluxoEl = document.getElementById('etf-fluxo-ultimo');
        fluxoEl.innerText = `${ultimoFluxo >= 0 ? '+' : ''}${ultimoFluxo.toFixed(1)}M`;
        fluxoEl.className = `halv__stat-val ${ultimoFluxo >= 0 ? 'halv__green' : 'halv__red'}`;
        document.getElementById('etf-assets').innerText = `$${(ultimosAssets / 1000000000).toFixed(2)}B`;
    }

    // Agrupa os registros diários em semanas (seg-dom) ou meses
    function agregarPorPeriodo(dados, periodo) {
        if (periodo === 'diario') {
            return {
                datas: dados.map(function (i) { return i.date; }),
                fluxos: dados.map(function (i) { return Number(i.total_net_inflow) / 1000000; }),
                assets: dados.map(function (i) { return Number(i.total_net_assets); })
            };
        }

        var grupos = new Map();

        dados.forEach(function (item) {
            var chave = periodo === 'semanal' ? chaveDaSemana(item.date) : item.date.slice(0, 7); // YYYY-MM
            if (!grupos.has(chave)) {
                grupos.set(chave, { rotulo: chave, fluxo: 0, assets: 0, ultimaData: '' });
            }
            var g = grupos.get(chave);
            g.fluxo += Number(item.total_net_inflow);
            // assets é um saldo acumulado, então usamos o valor do dia mais recente de cada grupo
            if (item.date >= g.ultimaData) {
                g.assets = Number(item.total_net_assets);
                g.ultimaData = item.date;
            }
        });

        var listaGrupos = Array.from(grupos.values());

        return {
            datas: listaGrupos.map(function (g) { return g.rotulo; }),
            fluxos: listaGrupos.map(function (g) { return g.fluxo / 1000000; }),
            assets: listaGrupos.map(function (g) { return g.assets; })
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
                    backgroundColor: dados.fluxos.map(v => v >= 0 ? '#4ade80' : '#ff4d6d'),
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
