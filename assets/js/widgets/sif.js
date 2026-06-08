/* =====================================================================
   Widget: Simulador de Independência Financeira (offline, sem API)
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};
window.BIWidgets.sif = function initSif() {
  'use strict';

  function fmtFull(v) { return 'R$ ' + Math.round(v).toLocaleString('pt-BR'); }
  function fmtBRL(v) { return v >= 1000 ? 'R$ ' + (v / 1000).toFixed(1) + 'k' : 'R$ ' + Math.round(v); }

  function $(id) { return document.getElementById(id); }
  if (!$('sif-selic')) return;

  function calcular() {
    var selic = parseFloat($('sif-selic').value);
    var ipca = parseFloat($('sif-ipca').value);
    var dep = parseInt($('sif-dep').value, 10);
    var desp = parseFloat($('sif-desp').value);
    var rec = parseFloat($('sif-rec').value);
    var patAtual = parseFloat($('sif-pat-atual').value);

    // Taxa real (Fisher)
    var taxaRealAnual = ((1 + selic / 100) / (1 + ipca / 100) - 1);
    var deficitMensal = Math.max(0, desp - rec);
    var montanteBase = taxaRealAnual > 0 ? (deficitMensal * 12) / taxaRealAnual : 0;
    var margemSeguranca = 1 + (dep * 0.10);
    var patrimonioFinal = montanteBase * margemSeguranca;

    var gap = Math.max(0, patrimonioFinal - patAtual);
    var progressoPct = patrimonioFinal > 0 ? Math.min(100, (patAtual / patrimonioFinal) * 100) : 100;
    var rendaPassivaAtual = taxaRealAnual > 0 ? (patAtual * taxaRealAnual) / 12 : 0;
    var jurosFaltante = Math.max(0, ((patrimonioFinal * taxaRealAnual) / 12) - rendaPassivaAtual);

    $('sif-juro-anual').textContent = (taxaRealAnual * 100).toFixed(2).replace('.', ',') + '%';
    $('sif-custo-liq').textContent = fmtFull(deficitMensal);
    $('sif-patrimonio').textContent = fmtFull(patrimonioFinal);
    $('sif-fator-badge').textContent = 'MARGEM: +' + (dep * 10) + '%';

    $('sif-prog-pct').textContent = progressoPct.toFixed(1).replace('.', ',') + '%';
    $('sif-gap-txt').textContent = 'Falta Acumular: ' + fmtFull(gap);
    $('sif-prog-fill').style.width = progressoPct + '%';

    var maxVal = Math.max(desp, rec, rendaPassivaAtual + jurosFaltante, 5000);
    var axisMax = Math.ceil(maxVal / 5000) * 5000;

    function setBar(id, val) {
      var pct = Math.min(100, Math.max(5, (val / axisMax) * 100));
      var el = $(id);
      el.style.width = pct + '%';
      el.innerHTML = '<span>' + fmtBRL(val) + '</span>';
    }
    setBar('sif-bar-desp', desp);
    setBar('sif-bar-renda', rec);
    setBar('sif-bar-passiva', rendaPassivaAtual);
    setBar('sif-bar-juros', jurosFaltante);

    var rendaPassivaTotalAlvo = rendaPassivaAtual + jurosFaltante;
    var ratio = desp > 0 ? Math.min(1, rendaPassivaTotalAlvo / desp) : 0;
    $('sif-gauge-arc').style.strokeDashoffset = 301.6 - (301.6 * ratio);

    var ticks = [];
    for (var i = 0; i <= 4; i++) ticks.push('<span>' + fmtBRL(axisMax * i / 4) + '</span>');
    $('sif-axis').innerHTML = ticks.join('');

    $('sif-val-pat-atual').textContent = patAtual.toLocaleString('pt-BR');
    $('sif-val-selic').textContent = selic.toFixed(1).replace('.', ',');
    $('sif-val-ipca').textContent = ipca.toFixed(1).replace('.', ',');
    $('sif-val-dep').textContent = dep;
    $('sif-val-desp').textContent = desp.toLocaleString('pt-BR');
    $('sif-val-rec').textContent = rec.toLocaleString('pt-BR');
  }

  ['sif-pat-atual', 'sif-selic', 'sif-ipca', 'sif-dep', 'sif-desp', 'sif-rec'].forEach(function (id) {
    $(id).addEventListener('input', calcular);
  });

  calcular();
};
