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
            // URL OFICIAL CONFORME DOCUMENTAÇÃO
            const urlAlvo = `https://openapi.sosovalue.com/openapi/v1/etfs/summary-history?symbol=BTC&country_code=US`;
            const url = `https://corsproxy.io/?${encodeURIComponent(urlAlvo)}`;
            
            const resposta = await fetch(url, {
                method: 'GET',
                headers: { 'x-soso-api-key': CHAVE_API_SOSOVALUE }
            });

            if (!resposta.ok) throw new Error("Erro na API: " + resposta.status);

            const json = await resposta.json();
            
            // A API retorna o array diretamente (json), sem .data
            // A API retorna ordenado (o primeiro é o mais recente), vamos inverter para o gráfico
            const dataArray = Array.isArray(json) ? json.reverse() : [];
            
            const dados = {
                datas: dataArray.map(item => item.date),
                fluxos: dataArray.map(item => item.total_net_inflow / 1000000), // Convertendo para Milhões
                assets: dataArray.map(item => item.total_net_assets)
            };
            
            renderizarGrafico(dados);

        } catch (error) {
            console.error("Erro na busca:", error);
            document.getElementById('etf-fluxo-ultimo').innerText = "Erro";
        }
    }

    function renderizarGrafico(dados) {
        if (!dados.fluxos.length) return;

        const ultimoFluxo = dados.fluxos[dados.fluxos.length - 1];
        const ultimosAssets = dados.assets[dados.assets.length - 1];
        
        document.getElementById('etf-fluxo-ultimo').innerText = `${ultimoFluxo >= 0 ? '+' : ''}${ultimoFluxo.toFixed(1)}M`;
        document.getElementById('etf-fluxo-ultimo').className = `halv__stat-val ${ultimoFluxo >= 0 ? 'halv__green' : 'halv__red'}`;
        document.getElementById('etf-assets').innerText = `$${(ultimosAssets/1000000000).toFixed(2)}B`;

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
