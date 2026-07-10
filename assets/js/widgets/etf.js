/* =====================================================================
   WIDGET: Spot Bitcoin ETF (SoSoValue)
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

    // Estrutura HTML
    container.innerHTML = `
        <div class="btc-ultra-card etf-widget">
            <div class="etf-header">
                <h3 class="etf-title">Spot Bitcoin ETF (Fluxo)</h3>
                <div class="etf-filtros">
                    <button class="btn-periodo ativo" data-periodo="1d">Diário</button>
                    <button class="btn-periodo" data-periodo="7d">Semanal</button>
                    <button class="btn-periodo" data-periodo="30d">Mensal</button>
                </div>
            </div>
            
            <div class="etf-grid">
                <div class="halv__stat-item">
                    <span class="halv__stat-label">Total Assets</span>
                    <span class="halv__stat-val" id="etf-assets">A carregar...</span>
                </div>
                <div class="halv__stat-item">
                    <span class="halv__stat-label">Fluxo Líquido</span>
                    <span class="halv__stat-val" id="etf-fluxo-ultimo">A carregar...</span>
                </div>
            </div>

            <div class="etf-canvas-container">
                <canvas id="canvas-etf-oficial"></canvas>
            </div>
        </div>
    `;

    // Carrega o Chart.js se não estiver carregado
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = () => buscarDadosSoSoValue('1d');
        document.head.appendChild(script);
    } else {
        buscarDadosSoSoValue('1d');
    }

    // Lógica dos botões
    document.querySelectorAll('#widget-etf-sosovalue .btn-periodo').forEach(botao => {
        botao.addEventListener('click', function() {
            document.querySelectorAll('#widget-etf-sosovalue .btn-periodo').forEach(b => b.classList.remove('ativo'));
            this.classList.add('ativo');
            buscarDadosSoSoValue(this.getAttribute('data-periodo'));
        });
    });

    async function buscarDadosSoSoValue(periodo) {
        try {
            document.getElementById('etf-fluxo-ultimo').innerText = "A carregar...";
            
            // ATENÇÃO: Se continuar dando 404, verifique no painel o caminho exato.
            // Tentei a URL padrão baseada na documentação da SoSoValue.
            const urlAlvo = `https://openapi.sosovalue.com/openapi/v1/etf/btc/flow?period=${periodo}`;
            const url = `https://corsproxy.io/?${encodeURIComponent(urlAlvo)}`;
            
            const resposta = await fetch(url, {
                method: 'GET',
                headers: {
                    'x-soso-api-key': CHAVE_API_SOSOVALUE
                }
            });

            if (!resposta.ok) throw new Error("Erro na API: " + resposta.status);

            const dataArray = await resposta.json();
            
            // Processamento dos dados reais que você enviou
            const dados = {
                datas: dataArray.map(item => item.date),
                fluxos: dataArray.map(item => item.total_net_inflow / 1000000), // Em milhões
                assets: dataArray.map(item => item.total_net_assets)
            };
            
            renderizarGrafico(dados);

        } catch (error) {
            console.error("Erro na busca:", error);
            document.getElementById('etf-fluxo-ultimo').innerText = "Erro";
            document.getElementById('etf-fluxo-ultimo').className = "halv__stat-val halv__red";
        }
    }

    function renderizarGrafico(dados) {
        if (!dados.fluxos.length) return;

        // Atualiza os resumos
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
                    label: 'Fluxo (M$)',
                    data: dados.fluxos,
                    backgroundColor: dados.fluxos.map(v => v >= 0 ? '#4ade80' : '#ff4d6d'),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#ccc' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#ccc' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
};
