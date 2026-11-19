/* Сторінка "Завантажити прошивку": список версій з GitHub Releases.
 *
 * Кожна версія — реліз у репозиторії сайту з тегом vX.Y.Z і вкладеннями:
 *   smart_plug_control-X.Y.Z.bin       звичайна збірка
 *   smart_plug_control-X.Y.Z-eng.bin   інженерна збірка (необов'язково)
 * Pre-release на GitHub = бета на сайті. Чернетки (draft) не видно. */
(function () {
  'use strict';

  var REPO = (window.SPC && window.SPC.repo) || 'vmexanik/SmartPlugControlDoc';
  var API = 'https://api.github.com/repos/' + REPO + '/releases?per_page=100';
  var RELEASES_PAGE = 'https://github.com/' + REPO + '/releases';
  var CACHE_KEY = 'spc-releases';
  var CACHE_MS = 10 * 60 * 1000;   // анонімний API GitHub: 60 запитів/год з IP
  var BETA_KEY = 'spc-show-beta';

  var $ = function (id) { return document.getElementById(id); };
  var sel = $('fw-select'), beta = $('fw-beta'), card = $('fw-card');
  $('fw-releases-link').href = RELEASES_PAGE;

  var all = [];
  var docs = [];                         // набори документації з versions.json
  var DOC_ID = (window.SPC && window.SPC.doc) || '';

  /* До якого набору документації належить тег релізу (поле match у versions.json). */
  function docFor(tag) {
    for (var i = 0; i < docs.length; i++) {
      try { if (new RegExp(docs[i].match).test(tag)) return docs[i]; } catch (e) { /* поганий regex */ }
    }
    return null;
  }
  function mine(r) { var d = docFor(r.tag); return !d || d.id === DOC_ID; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function store(fn) { try { return fn(); } catch (e) { return null; } }

  function size(b) { return b >= 1048576 ? (b / 1048576).toFixed(2) + ' МБ' : Math.round(b / 1024) + ' КБ'; }
  function date(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* Мінімальний Markdown для приміток до релізу: заголовки, списки, `код`, **жирний**, [посилання](https://…). */
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }
  function md(text) {
    var out = [], list = false, para = [];
    function flushPara() { if (para.length) { out.push('<p>' + para.join(' ') + '</p>'); para = []; } }
    function closeList() { if (list) { out.push('</ul>'); list = false; } }
    String(text || '').replace(/\r/g, '').split('\n').forEach(function (line) {
      var m;
      if (!line.trim()) { flushPara(); closeList(); return; }
      if ((m = line.match(/^#{1,6}\s+(.*)$/))) { flushPara(); closeList(); out.push('<h4>' + inline(m[1]) + '</h4>'); return; }
      if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) { flushPara(); if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
      closeList(); para.push(inline(line.trim()));
    });
    flushPara(); closeList();
    return out.join('');
  }

  function normalize(list) {
    return list.filter(function (r) { return !r.draft; }).map(function (r) {
      var main = null, eng = null;
      (r.assets || []).forEach(function (a) {
        if (!/\.bin$/i.test(a.name)) return;
        var f = { name: a.name, url: a.browser_download_url, size: a.size };
        if (/-eng\.bin$/i.test(a.name)) eng = eng || f; else main = main || f;
      });
      return {
        tag: r.tag_name, name: r.name || r.tag_name, beta: !!r.prerelease,
        date: r.published_at, notes: r.body || '', page: r.html_url, main: main, eng: eng
      };
    }).filter(function (r) { return r.main || r.eng; });
  }

  function visible() {
    return all.filter(function (r) { return beta.checked || !r.beta; });
  }

  function fill() {
    var list = visible();
    var want = decodeURIComponent(location.hash.slice(1)) || sel.value;
    sel.innerHTML = '';
    if (!list.length) {
      sel.disabled = true;
      sel.innerHTML = '<option>' + (all.length ? 'Лише бета-версії: увімкніть прапорець нижче' : 'Ще немає опублікованих версій') + '</option>';
      card.hidden = true;
      return;
    }
    var latest = list[0].tag;
    // Групи за наборами документації: свій набір першим, решта — з позначкою.
    var groups = {}, order = [];
    list.forEach(function (r) {
      var d = docFor(r.tag), key = d ? d.id : '';
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(r);
    });
    order.sort(function (a, b) { return (b === DOC_ID) - (a === DOC_ID); });
    order.forEach(function (key) {
      var parent = sel;
      if (order.length > 1) {
        parent = document.createElement('optgroup');
        parent.label = key ? 'Прошивка ' + key + (key === DOC_ID ? ' — ця документація' : ' — інша документація') : 'Інші';
        sel.appendChild(parent);
      }
      groups[key].forEach(function (r) {
        var o = document.createElement('option');
        o.value = r.tag;
        o.textContent = r.tag + (r.tag === latest ? ' — остання' : '') + (r.beta ? ' (бета)' : '') +
          (r.date ? ' · ' + date(r.date) : '');
        parent.appendChild(o);
      });
    });
    sel.disabled = false;
    var own = list.filter(mine)[0];
    if (list.some(function (r) { return r.tag === want; })) sel.value = want;
    else if (own) sel.value = own.tag;
    show();
  }

  function fileBtn(f, kind) {
    if (!f) {
      return '<span class="fw-file off"><span class="fw-kind">' + (kind === 'eng' ? 'Інженерна' : 'Звичайна') +
        '</span><span class="fw-meta">для цієї версії немає</span></span>';
    }
    return '<a class="fw-file ' + kind + '" href="' + esc(f.url) + '" download>' +
      '<span class="fw-kind">' + (kind === 'eng' ? 'Інженерна збірка' : 'Завантажити прошивку') + '</span>' +
      '<span class="fw-meta">' + esc(f.name) + ' · ' + size(f.size) + '</span></a>';
  }

  function show() {
    var r = all.filter(function (x) { return x.tag === sel.value; })[0];
    if (!r) { card.hidden = true; return; }
    var latest = visible()[0];
    var d = docFor(r.tag), other = d && d.id !== DOC_ID ? d : null;
    $('fw-title').textContent = r.name;
    $('fw-badges').innerHTML =
      (latest && r.tag === latest.tag ? '<span class="pill on">остання</span> ' : '') +
      (r.beta ? '<span class="pill warn">бета</span>' : '');
    $('fw-date').textContent = date(r.date);
    $('fw-files').innerHTML = fileBtn(r.main, 'main') + fileBtn(r.eng, 'eng') +
      (other ? '<div class="callout warn fw-other"><span class="t">Ця прошивка описана в іншій документації</span>' +
        'Версія ' + esc(r.tag) + ' належить до лінії ' + esc(other.label || other.id) +
        ': інтерфейс і налаштування можуть відрізнятися. <a href="#" id="fw-other-go">Відкрити документацію ' +
        esc(other.label || other.id) + '</a>.</div>' : '');
    if (other) $('fw-other-go').addEventListener('click', function (e) {
      e.preventDefault(); window.SPC.goDoc(other);
    });
    var notes = md(r.notes);
    $('fw-notes').innerHTML = (notes ? '<h3>Що нового</h3>' + notes : '') +
      '<p class="fw-more"><a href="' + esc(r.page) + '" target="_blank" rel="noopener">Сторінка випуску на GitHub</a></p>';
    card.hidden = false;
    if (history.replaceState) history.replaceState(null, '', '#' + encodeURIComponent(r.tag));
  }

  function fail(msg) {
    sel.innerHTML = '<option>Список недоступний</option>';
    sel.disabled = true;
    $('fw-error-text').textContent = msg + ' ';
    $('fw-error').hidden = false;
  }

  function load() {
    var cached = store(function () { return JSON.parse(sessionStorage.getItem(CACHE_KEY)); });
    if (cached && Date.now() - cached.t < CACHE_MS && Array.isArray(cached.d)) return Promise.resolve(cached.d);
    return fetch(API, { headers: { Accept: 'application/vnd.github+json' } }).then(function (res) {
      if (res.status === 403 || res.status === 429) throw new Error('GitHub тимчасово обмежив кількість запитів, спробуйте за кілька хвилин.');
      if (res.status === 404) throw new Error('Репозиторій з прошивками не знайдено.');
      if (!res.ok) throw new Error('GitHub відповів помилкою ' + res.status + '.');
      return res.json();
    }).then(function (d) {
      var list = normalize(d);
      store(function () { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: list })); });
      return list;
    });
  }

  beta.checked = store(function () { return localStorage.getItem(BETA_KEY) === '1'; }) || false;
  beta.addEventListener('change', function () {
    store(function () { localStorage.setItem(BETA_KEY, beta.checked ? '1' : '0'); });
    fill();
  });
  /* Вибір версії з іншої мажорної лінії перемикає всю документацію на неї. */
  sel.addEventListener('change', function () {
    var d = docFor(sel.value);
    if (d && d.id !== DOC_ID && window.SPC && window.SPC.goDoc) {
      history.replaceState && history.replaceState(null, '', '#' + encodeURIComponent(sel.value));
      window.SPC.goDoc(d);
      return;
    }
    show();
  });

  var docsReady = (window.SPC && window.SPC.docs) || Promise.resolve([]);
  Promise.all([load(), docsReady]).then(function (res) {
    var list = res[0];
    docs = res[1] || [];
    all = list;
    // посилання #v2.1.0-beta на бета-версію вмикає прапорець само
    var want = decodeURIComponent(location.hash.slice(1));
    if (!beta.checked && all.some(function (r) { return r.tag === want && r.beta; })) beta.checked = true;
    fill();
  }).catch(function (e) {
    fail(e && e.message && /GitHub|Репозиторій/.test(e.message) ? e.message : 'Немає зв\'язку з GitHub.');
  });
})();
