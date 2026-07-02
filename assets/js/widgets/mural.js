/* =====================================================================
   Widget: Mural de Sentimentos (Firebase Realtime Database)
   - Firebase carregado sob demanda (só quando o mural aparece)
   ===================================================================== */
window.BIWidgets = window.BIWidgets || {};
window.BIWidgets.mural = async function initMural() {
  'use strict';
  var CFG = window.BI_CONFIG;

  function $(id) { return document.getElementById(id); }
  if (!$('mural-root')) return;

  // Carrega Firebase sob demanda
  try {
    if (typeof window.firebase === 'undefined') {
      await BI.loadScripts([CFG.cdn.firebaseApp, CFG.cdn.firebaseDb]);
    }
  } catch (e) {
    var errEl = $('mural-error');
    if (errEl) { errEl.textContent = 'Não foi possível carregar o mural.'; errEl.style.display = 'block'; }
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(CFG.firebase);
  var db = firebase.database();
  var muralRef = db.ref('mural');

  var selectedMood = '';
  var currentBtcPrice = null;

  function getVisitorId() {
    var id = localStorage.getItem('mural_visitor_id');
    if (!id) {
      id = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('mural_visitor_id', id);
    }
    return id;
  }
  var VISITOR_ID = getVisitorId();

  // Preço BTC para carimbar nos posts
  BI.fetchJSON(CFG.api.coingeckoSimple + '?ids=bitcoin&vs_currencies=usd', { timeout: 8000, retries: 1 })
    .then(function (d) { if (d && d.bitcoin) currentBtcPrice = d.bitcoin.usd; })
    .catch(function () {});

  document.querySelectorAll('.mural__mood-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.mural__mood-btn').forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      selectedMood = btn.dataset.mood;
    });
  });

  var textarea = $('mural-texto');
  var charCount = $('mural-chars');
  textarea.addEventListener('input', function () { charCount.textContent = this.value.length + '/280'; });

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  muralRef.orderByChild('date').on('value', function (snapshot) {
    var entries = [];
    snapshot.forEach(function (child) {
      var entry = child.val();
      entry.firebaseKey = child.key;
      entries.push(entry);
    });
    renderFeed(entries);
  });

  function renderFeed(entries) {
    var feed = $('mural-feed');
    if (!entries || entries.length === 0) {
      feed.innerHTML = '<div class="mural__empty">Nenhuma entrada ainda. Seja o primeiro! 👆</div>';
      return;
    }
    feed.innerHTML = '';
    var sorted = entries.slice().reverse();

    sorted.forEach(function (entry, index) {
      var card = buildCard(entry);
      if (index > 0) { card.classList.add('mural__card--hidden'); card.style.display = 'none'; }
      feed.appendChild(card);
    });

    if (sorted.length > 1) {
      var toggle = document.createElement('button');
      toggle.className = 'mural__toggle-btn';
      toggle.innerHTML = '+ Ver mais ' + (sorted.length - 1) + ' comentário' + (sorted.length - 1 > 1 ? 's' : '');
      toggle.dataset.expanded = 'false';
      toggle.addEventListener('click', function () {
        var hidden = feed.querySelectorAll('.mural__card--hidden');
        if (toggle.dataset.expanded !== 'true') {
          hidden.forEach(function (c) { c.style.display = 'block'; });
          toggle.innerHTML = '− Recolher comentários';
          toggle.dataset.expanded = 'true';
        } else {
          hidden.forEach(function (c) { c.style.display = 'none'; });
          toggle.innerHTML = '+ Ver mais ' + (sorted.length - 1) + ' comentário' + (sorted.length - 1 > 1 ? 's' : '');
          toggle.dataset.expanded = 'false';
        }
      });
      feed.appendChild(toggle);
    }

    feed.querySelectorAll('.mural__btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () { startEdit(btn.dataset.key); });
    });
  }

  function buildCard(entry) {
    var btcTxt = entry.btcPrice
      ? 'USD ' + entry.btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';
    var card = document.createElement('div');
    card.className = 'mural__card';
    card.dataset.key = entry.firebaseKey;

    var isOwner = (entry.authorId === VISITOR_ID);
    var editBtn = isOwner
      ? '<button class="mural__btn-edit" data-key="' + entry.firebaseKey + '">✏️ Editar</button>'
      : '';

    card.innerHTML =
      '<div class="mural__card-top">' +
        '<div class="mural__card-left">' +
          '<span class="mural__card-mood">' + BI.escapeHtml(entry.mood || '\u20BF') + '</span>' +
          '<span class="mural__card-apelido">' + BI.escapeHtml(entry.apelido) + '</span>' +
        '</div>' +
        '<div class="mural__card-meta">' +
          '<div class="mural__card-dateline">' +
            '<span class="mural__card-date">' + formatDate(entry.date) + '</span>' +
            (btcTxt ? '<span class="mural__card-date" style="color:#444;">,</span><span class="mural__card-btc">' + btcTxt + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="mural__card-texto" id="texto-' + entry.firebaseKey + '">' + BI.escapeHtml(entry.texto) + '</div>' +
      (isOwner ? '<div class="mural__card-actions">' + editBtn + '</div>' : '');

    return card;
  }

  function startEdit(key) {
    var card = document.querySelector('[data-key="' + key + '"]');
    if (!card) return;
    var textoEl = $('texto-' + key);
    var actionsEl = card.querySelector('.mural__card-actions');
    var currentText = textoEl.textContent;

    textoEl.style.display = 'none';
    actionsEl.style.display = 'none';

    var editArea = document.createElement('textarea');
    editArea.className = 'mural__edit-area';
    editArea.value = currentText;
    editArea.rows = 3;

    var editActions = document.createElement('div');
    editActions.className = 'mural__edit-actions';
    editActions.innerHTML = '<button class="mural__btn-cancel">Cancelar</button><button class="mural__btn-save">Salvar</button>';

    var editNote = document.createElement('div');
    editNote.className = 'mural__edit-note';
    editNote.textContent = '⚠️ Entradas podem ser editadas, mas nunca apagadas.';

    card.appendChild(editArea);
    card.appendChild(editActions);
    card.appendChild(editNote);

    editActions.querySelector('.mural__btn-cancel').addEventListener('click', function () {
      editArea.remove(); editActions.remove(); editNote.remove();
      textoEl.style.display = ''; actionsEl.style.display = '';
    });
    editActions.querySelector('.mural__btn-save').addEventListener('click', function () {
      var newText = editArea.value.trim();
      if (!newText) return;
      muralRef.child(key).update({ texto: newText, editado: true });
    });
  }

  $('mural-btn-post').addEventListener('click', function () {
    var apelido = $('mural-apelido').value.trim();
    var texto = $('mural-texto').value.trim();
    var errorEl = $('mural-error');
    errorEl.style.display = 'none';

    if (!apelido) { errorEl.textContent = 'Informe seu apelido.'; errorEl.style.display = 'block'; return; }
    if (!selectedMood) { errorEl.textContent = 'Selecione um sentimento.'; errorEl.style.display = 'block'; return; }
    if (!texto) { errorEl.textContent = 'Escreva algo antes de publicar.'; errorEl.style.display = 'block'; return; }

    muralRef.push({
      apelido: apelido, mood: selectedMood, texto: texto,
      date: new Date().toISOString(), btcPrice: currentBtcPrice,
      editado: false, authorId: VISITOR_ID
    });

    $('mural-texto').value = '';
    $('mural-chars').textContent = '0/280';
    document.querySelectorAll('.mural__mood-btn').forEach(function (b) { b.classList.remove('selected'); });
    selectedMood = '';
  });
};
