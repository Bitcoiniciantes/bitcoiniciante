/* =====================================================================
   BITCOIN INICIANTES — Widget Halving
   Countdown ao próximo halving + histórico de halvings anteriores
   ===================================================================== */

(function () {
  'use strict';

  /* ── Dados históricos dos halvings ── */
  const HALVINGS = [
    {
      n: 1,
      label: '1º Halving',
      date: '2012-11-28',
      block: 210000,
      rewardAntes: 50,
      rewardDepois: 25,
      precoNoDia: 12.35,
      topoApos: { preco: 1163, dias: 371, data: '2013-11-30' },
      fundoApos: { preco: 152, dias: 422, data: '2015-01-14' },
      bearDuracao: 406, // dias do topo ao fundo
      bullDuracao: 371, // dias do halving ao topo
    },
    {
      n: 2,
      label: '2º Halving',
      date: '2016-07-09',
      block: 420000,
      rewardAntes: 25,
      rewardDepois: 12.5,
      precoNoDia: 650,
      topoApos: { preco: 19891, dias: 526, data: '2017-12-17' },
      fundoApos: { preco: 3128, dias: 364, data: '2018-12-15' },
      bearDuracao: 364,
      bullDuracao: 526,
    },
    {
      n: 3,
      label: '3º Halving',
      date: '2020-05-11',
      block: 630000,
      rewardAntes: 12.5,
      rewardDepois: 6.25,
      precoNoDia: 8821,
      topoApos: { preco: 69000, dias: 549, data: '2021-11-10' },
      fundoApos: { preco: 15476, dias: 376, data: '2022-11-21' },
      bearDuracao: 376,
      bullDuracao: 549,
    },
    {
      n: 4,
      label: '4º Halving',
      date: '2024-04-20',
      block: 840000,
      rewardAntes: 6.25,
      rewardDepois: 3.125,
      precoNoDia: 64258,
      topoApos: null, // ciclo em andamento
      fundoApos: null,
      bearDuracao: null,
      bullDuracao: null,
    },
  ];

  /* ── Próximo halving (5º) ── */
  const NEXT_HALVING_BLOCK = 1050000;
  // Bloco estimado: 1.050.000 — ~abril 2028
  // Estimativa baseada em 10 min/bloco a partir do bloco atual aproximado
  const NEXT_HALVING_DATE_EST = new Date('2028-03-28T00:00:00Z');

  /* ── Helpers ── */
  function fmtUSD(n) {
    if (n >= 1000) return 'US$ ' + n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    return 'US$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtMulti(base, topo) {
    const m = topo / base;
    return m >= 10 ? m.toFixed(0) + 'x' : m.toFixed(1) + 'x';
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function diffDays(a, b) {
    return Math.round((b - a) / 86400000);
  }

  /* ── Busca bloco atual via mempool.space ── */
  async function fetchCurrentBlock() {
    try {
      const r = await fetch('https://mempool.space/api/blocks/tip/height');
      if (!r.ok) throw new Error();
      return await r.json();
    } catch {
      return null;
    }
  }

  /* ── Render countdown ── */
  function renderCountdown(targetDate) {
    const now = Date.now();
    const diff = targetDate - now;
    if (diff <= 0) return { d: '00', h: '00', m: '00', s: '00', done: true };
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { d: pad(d), h: pad(h), m: pad(m), s: pad(s), done: false };
  }

  /* ── Build widget HTML ── */
  function buildWidget() {
    const el = document.getElementById('halving-root');
    if (!el) return;

    el.innerHTML = `
<div class="halv__wrap">

  <!-- Header -->
  <div class="halv__header">
    <div class="halv__icon">&#8383;</div>
    <div>
      <div class="halv__title">Halving do Bitcoin</div>
      <div class="halv__sub">Contador + histórico de ciclos</div>
    </div>
    <span class="halv__live-dot"></span>
  </div>

  <!-- Countdown ao 5º Halving -->
  <div class="halv__countdown-box">
    <div class="halv__next-label">5º Halving — bloco <strong>${NEXT_HALVING_BLOCK.toLocaleString('pt-BR')}</strong></div>
    <div class="halv__clock" id="halv-clock">
      <div class="halv__unit"><span class="halv__num halv__num--days" id="halv-d">--</span><span class="halv__ulab">dias</span></div>
      <div class="halv__sep halv__sep--days">:</div>
      <div class="halv__unit"><span class="halv__num" id="halv-h">--</span><span class="halv__ulab">hrs</span></div>
      <div class="halv__sep">:</div>
      <div class="halv__unit"><span class="halv__num" id="halv-m">--</span><span class="halv__ulab">min</span></div>
      <div class="halv__sep">:</div>
      <div class="halv__unit"><span class="halv__num" id="halv-s">--</span><span class="halv__ulab">seg</span></div>
    </div>
    <div class="halv__blocks-row">
      <div class="halv__block-item">
        <span class="halv__block-label">Blocos faltando</span>
        <span class="halv__block-val" id="halv-blocks-left">—</span>
      </div>
      <div class="halv__block-divider"></div>
      <div class="halv__block-item">
        <span class="halv__block-label">Bloco atual</span>
        <span class="halv__block-val" id="halv-current-block">—</span>
      </div>
      <div class="halv__block-divider"></div>
      <div class="halv__block-item">
        <span class="halv__block-label">Recompensa agora</span>
        <span class="halv__block-val">3.125 ₿</span>
      </div>
    </div>
    <div class="halv__est-date" id="halv-est-date">Estimativa: ~março 2028</div>
  </div>

  <!-- Tabs -->
  <div class="halv__tabs" id="halv-tabs">
    <button class="halv__tab active" data-tab="0">1º</button>
    <button class="halv__tab" data-tab="1">2º</button>
    <button class="halv__tab" data-tab="2">3º</button>
    <button class="halv__tab" data-tab="3">4º ↗</button>
  </div>

  <!-- Tab content -->
  <div id="halv-tab-content"></div>

</div>`;

    // Render tab content
    renderTab(0);

    // Tab switching
    el.querySelectorAll('.halv__tab').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.halv__tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTab(Number(btn.dataset.tab));
      });
    });

    // Countdown ticker
    function tick() {
      const t = renderCountdown(NEXT_HALVING_DATE_EST);
      document.getElementById('halv-d').textContent = t.d;
      document.getElementById('halv-h').textContent = t.h;
      document.getElementById('halv-m').textContent = t.m;
      document.getElementById('halv-s').textContent = t.s;
    }
    tick();
    setInterval(tick, 1000);

    // Fetch bloco atual
    fetchCurrentBlock().then(block => {
      if (!block) return;
      const cur = document.getElementById('halv-current-block');
      const left = document.getElementById('halv-blocks-left');
      const est = document.getElementById('halv-est-date');
      if (cur) cur.textContent = block.toLocaleString('pt-BR');
      const blocosFaltando = NEXT_HALVING_BLOCK - block;
      if (left) left.textContent = blocosFaltando > 0 ? blocosFaltando.toLocaleString('pt-BR') : '0';
      // Recalcula estimativa: ~10 min/bloco
      if (blocosFaltando > 0) {
        const msLeft = blocosFaltando * 10 * 60 * 1000;
        const estDate = new Date(Date.now() + msLeft);
        const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
        if (est) est.textContent = `Estimativa: ~${meses[estDate.getMonth()]} ${estDate.getFullYear()} (${blocosFaltando.toLocaleString('pt-BR')} blocos)`;
      }
    });
  }

  /* ── Render tab de halving específico ── */
  function renderTab(idx) {
    const h = HALVINGS[idx];
    const c = document.getElementById('halv-tab-content');
    if (!c) return;

    const atual = idx === 3; // 4º halving — ciclo em andamento

    const gainRow = h.topoApos
      ? `<div class="halv__stat-item">
          <span class="halv__stat-label">Topo pós-halving</span>
          <span class="halv__stat-val halv__green">${fmtUSD(h.topoApos.preco)}</span>
          <span class="halv__stat-sub">${fmtMulti(h.precoNoDia, h.topoApos.preco)} · ${h.topoApos.dias} dias · ${h.topoApos.data}</span>
        </div>
        <div class="halv__stat-item">
          <span class="halv__stat-label">Fundo do bear</span>
          <span class="halv__stat-val halv__red">${fmtUSD(h.fundoApos.preco)}</span>
          <span class="halv__stat-sub">${h.fundoApos.dias} dias após o topo · ${h.fundoApos.data}</span>
        </div>`
      : `<div class="halv__stat-item halv__ongoing">
          <span class="halv__stat-label">Ciclo em andamento</span>
          <span class="halv__stat-val" style="color:#F7931A;">↗ Bull em curso</span>
          <span class="halv__stat-sub">Topo e fundo ainda não definidos</span>
        </div>`;

    const durRow = h.bullDuracao
      ? `<div class="halv__duration-row">
          <div class="halv__dur-item">
            <span class="halv__dur-label">Bull até o topo</span>
            <span class="halv__dur-val halv__green">${h.bullDuracao} dias</span>
          </div>
          <div class="halv__dur-div"></div>
          <div class="halv__dur-item">
            <span class="halv__dur-label">Bear topo→fundo</span>
            <span class="halv__dur-val halv__red">${h.bearDuracao} dias</span>
          </div>
        </div>`
      : '';

    c.innerHTML = `
<div class="halv__card">
  <div class="halv__card-head">
    <span class="halv__card-label">${h.label} — ${h.date}</span>
    <span class="halv__card-block">Bloco ${h.block.toLocaleString('pt-BR')}</span>
  </div>
  <div class="halv__reward-row">
    <div class="halv__reward-item">
      <span class="halv__reward-label">Recompensa antes</span>
      <span class="halv__reward-val">${h.rewardAntes} ₿</span>
    </div>
    <div class="halv__reward-arrow">→</div>
    <div class="halv__reward-item">
      <span class="halv__reward-label">Recompensa depois</span>
      <span class="halv__reward-val halv__orange">${h.rewardDepois} ₿</span>
    </div>
    <div class="halv__reward-div"></div>
    <div class="halv__reward-item">
      <span class="halv__reward-label">Preço no dia</span>
      <span class="halv__reward-val">${fmtUSD(h.precoNoDia)}</span>
    </div>
  </div>
  ${gainRow}
  ${durRow}
</div>`;
  }

  /* ── Init ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }
})();
