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
                    <span class="halv__stat-label">Preço Atual BTC</span>
                    <span class="halv__stat-val" id="etf-preco-btc">A carregar...</span>
                </div>
                <div class="halv__stat-item">
                    <span class="halv__stat-label">Fluxo Líquido (Último)</span>
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
        script.onload = () => buscarDadosSoSoValue('1d');
        document.head.appendChild(script);
    } else {
        buscarDadosSoSoValue('1d');
    }

    let graficoInstancia = null;

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
            document.getElementById('etf-fluxo-ultimo').className = "halv__stat-val";

            // URL CORRIGIDA: Base URL oficial + Endpoint de Fluxo
            const urlAlvo = `https://openapi.sosovalue.com/openapi/v1/etf/btc/flow?period=${periodo}`;
            const url = `https://corsproxy.io/?${encodeURIComponent(urlAlvo)}`;
            
            const resposta = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': CHAVE_API_SOSOVALUE
                }
            });

            if (!resposta.ok) throw new Error("Erro na API: " + resposta.status);

            const json = await resposta.json();
            
            // Mapeamento dos dados (ajustado para a estrutura da API openapi)
            const dados = {
                datas: json.data.map(item => item.date),
                fluxos: json.data.map(item => item.netInflow),
                precos: json.data.map(item => item.btcPrice)
            };
            
            renderizarGrafico(dados);

        } catch (error) {
            console.error("Erro na busca:", error);
            document.getElementById('etf-fluxo-ultimo').innerText = "Erro";
            document.getElementById('etf-fluxo-ultimo').className = "halv__stat-val halv__red";
        }
    }

    function renderizarGrafico(dados) {
        if (!dados.precos || !dados.precos.length) return;

        const precoBtc = dados.precos[dados.precos.length - 1];
        const ultimoFluxo = dados.fluxos[dados.fluxos.length - 1];
        
        document.getElementById('etf-preco-btc').innerText = `$${Number(precoBtc).toLocaleString()}`;
        
        const elementoFluxo = document.getElementById('etf-fluxo-ultimo');
        elementoFluxo.innerText = `${ultimoFluxo >= 0 ? '+' : ''}${ultimoFluxo}M`;
        elementoFluxo.className = `halv__stat-val ${ultimoFluxo >= 0 ? 'halv__green' : 'halv__red'}`;

        const ctx = document.getElementById('canvas-etf-oficial').getContext('2d');
        const coresBarras = dados.fluxos.map(v => v >= 0 ? '#4ade80' : '#ff4d6d'); 

        if (graficoInstancia) graficoInstancia.destroy();

        graficoInstancia = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dados.datas,
                datasets: [
                    {
                        type: 'line',
                        label: 'Preço BTC ($)',
                        data: dados.precos,
                        borderColor: '#ff9f1a', 
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.2,
                        yAxisID: 'yPreco'
                    },
                    {
                        type: 'bar',
                        label: 'Fluxo Líquido (M$)',
                        data: dados.fluxos,
                        backgroundColor: coresBarras,
                        yAxisID: 'yFluxo',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#ccc' } },
                    yFluxo: { position: 'left', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#ccc', callback: (v) => v + 'M' } },
                    yPreco: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#ff9f1a' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
};
