/* =====================================================================
   Orquestrador principal
   - menu mobile, FAQ, formulário de contato
   - lazy-load de cada widget quando entra na viewport
   ===================================================================== */
(function () {
  'use strict';
  var CFG = window.BI_CONFIG;

  /* ---------- Menu mobile ---------- */
  var mobileMenu = document.getElementById('mobile-menu');
  var navList = document.getElementById('nav-list');
  if (mobileMenu && navList) {
    mobileMenu.addEventListener('click', function () {
      var active = mobileMenu.classList.toggle('active');
      navList.classList.toggle('active');
      mobileMenu.setAttribute('aria-expanded', active);
    });
    document.querySelectorAll('#nav-list a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileMenu.classList.remove('active');
        navList.classList.remove('active');
        mobileMenu.setAttribute('aria-expanded', false);
      });
    });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.parentElement;
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(function (i) { i.classList.remove('open'); });
      if (!isOpen) item.classList.add('open');
    });
  });

  /* ---------- Formulário de contato (Formspree) ---------- */
  var consultForm = document.getElementById('consultForm');
  if (consultForm) {
    consultForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = this.querySelector('.form-submit');
      var textoOriginal = btn.textContent;
      var errEl = document.getElementById('formErrorMsg');
      if (errEl) errEl.style.display = 'none';
      btn.textContent = 'Processando…';
      btn.disabled = true;

      function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
      var data = {
        nome: val('nome'),
        email: val('email'),
        whatsapp: val('whatsapp') || 'não informado',
        cidade: val('cidade') || 'não informado',
        servico: val('servico'),
        nivel: val('nivel') || 'não informado',
        mensagem: val('mensagem'),
        _subject: '[BITCOIN INICIANTES] Nova Consulta – ' + val('nome'),
        _replyto: val('email')
      };

      function showErr(msg) {
        if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
        else { alert(msg); }
        btn.textContent = textoOriginal;
        btn.disabled = false;
      }

      try {
        var res = await fetch('https://formspree.io/f/' + CFG.formspreeId, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          consultForm.style.display = 'none';
          document.getElementById('formSuccess').style.display = 'block';
        } else {
          var json = await res.json();
          var erros = json.errors ? json.errors.map(function (er) { return er.message; }).join(', ') : 'Tente novamente.';
          showErr('Falha ao enviar: ' + erros);
        }
      } catch (err) {
        showErr('Problema de conexão. Verifique seu sinal e tente novamente.');
      }
    });
  }

  /* ---------- Lazy-load dos widgets ---------- */
  // Cada widget carrega seu script só quando o container se aproxima da tela.
  function lazyWidget(anchorId, scriptSrc, initName) {
    var anchor = document.getElementById(anchorId);
    if (!anchor) return;
    BI.onVisible(anchor, function () {
      BI.loadScript(scriptSrc)
        .then(function () {
          if (window.BIWidgets && window.BIWidgets[initName]) {
            window.BIWidgets[initName]();
          }
        })
        .catch(function () {});
    });
  }

  // ticker fica no hero (acima da dobra) → margem maior para iniciar cedo
  lazyWidget('btcTickerCard', 'assets/js/widgets/btc-ticker.js', 'btcTicker');
  lazyWidget('fng-root', 'assets/js/widgets/fear-greed.js', 'fearGreed');
  lazyWidget('mempool-root', 'assets/js/widgets/mempool.js', 'mempool');
  lazyWidget('sif-root', 'assets/js/widgets/sif.js', 'sif');
  lazyWidget('dca-root', 'assets/js/widgets/dca.js?v=99', 'dca');
  lazyWidget('mural-root', 'assets/js/widgets/mural.js', 'mural');
  lazyWidget('halving-root', 'assets/js/widgets/halving.js', 'halving');
})();

/* =====================================================================
   WIDGET: Spot Bitcoin ETF (SoSoValue)
   ===================================================================== */
(async function iniciarWidgetETFOficial() {
    // ====================================================================
    // CHAVE DA API DA SOSOVALUE (Gere em m.sosovalue.com/developer)
    // ====================================================================
    const CHAVE_API_SOSOVALUE = "SOSO-85dba142513d4577893df18c8448e3de"; 
    // ====================================================================

    const container = document.getElementById('widget-etf-sosovalue');
    if (!container) return;

    // Estrutura HTML limpa, usando as classes do seu widgets.css
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

    document.querySelectorAll('.btn-periodo').forEach(botao => {
        botao.addEventListener('click', function() {
            document.querySelectorAll('.btn-periodo').forEach(b => b.classList.remove('ativo'));
            this.classList.add('ativo');
            buscarDadosSoSoValue(this.getAttribute('data-periodo'));
        });
    });

    async function buscarDadosSoSoValue(periodo) {
        try {
            document.getElementById('etf-fluxo-ultimo').innerText = "A carregar...";
            document.getElementById('etf-fluxo-ultimo').className = "halv__stat-val";

            const url = `https://api.sosovalue.com/v1/etf/us-btc-spot/flow?period=${periodo}`;
            const resposta = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': CHAVE_API_SOSOVALUE
                }
            });

            if (!resposta.ok) throw new Error("Erro na API");

            const json = await resposta.json();
            const dados = {
                datas: json.data.map(item => item.date),
                fluxos: json.data.map(item => item.netInflow),
                precos: json.data.map(item => item.btcPrice)
            };
            
            renderizarGrafico(dados);

        } catch (error) {
            console.error("Falha ao puxar os dados:", error);
            document.getElementById('etf-fluxo-ultimo').innerText = "Erro na API";
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
})();
