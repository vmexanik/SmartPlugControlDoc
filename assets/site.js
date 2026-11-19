/* Навігація, пейджер, кнопки "копіювати", перемикач теми.
 * Щоб додати сторінку — додайте рядок у PAGES і створіть html-файл за зразком. */
(function () {
  'use strict';

  /* Публічний репозиторій сайту: тут і релізи з прошивками, і issues. */
  var REPO_SLUG = 'vmexanik/SmartPlugControlDoc';
  var REPO = 'https://github.com/' + REPO_SLUG;
  /* Набір документації. Корінь сайту описує поточну мажорну лінію; при виході
   * нової мажорної версії archive-docs.py копіює сайт у теку <DOC_ID>/ і
   * переписує ці два рядки (ROOT стає '../'). Список наборів: versions.json. */
  var DOC_ID = '2.x';
  var ROOT = '';
  window.SPC = { repo: REPO_SLUG, doc: DOC_ID, root: ROOT };
  var PAGES = [
    { href: 'index.html',        title: 'Огляд' },
    { href: 'hardware.html',     title: 'Підключення' },
    { href: 'setup.html',        title: 'Перше налаштування' },
    { href: 'interface.html',    title: 'Веб-інтерфейс' },
    { href: 'devices.html',      title: 'Розетки та протоколи' },
    { href: 'ac.html',           title: 'Напруга мережі (AC1)' },
    { href: 'firmware.html',     title: 'Завантажити прошивку' },
    { href: 'maintenance.html',  title: 'Оновлення і скидання' },
    { href: 'faq.html',          title: 'Проблеми та відповіді' }
  ];

  var file = location.pathname.split('/').pop() || 'index.html';
  var cur = -1;
  PAGES.forEach(function (p, i) { if (p.href === file) cur = i; });

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var side = document.getElementById('side');
  if (side) {
    var links = PAGES.map(function (p, i) {
      return '<a href="' + p.href + '"' + (i === cur ? ' aria-current="page"' : '') + '>' + esc(p.title) + '</a>';
    }).join('');
    side.innerHTML =
      '<a class="brand" href="index.html"><img src="assets/favicon.svg" alt="">' +
      '<span>Smart Plug Control<small>інструкція користувача</small></span></a>' +
      '<label class="doc-ver" id="doc-ver" hidden><span>Документація для прошивки</span>' +
      '<select id="doc-ver-sel" aria-label="Версія документації"></select></label>' +
      '<nav aria-label="Розділи">' + links +
      '<div class="sep"></div>' +
      '<a href="demo/index.html">Інтерактивне демо</a>' +
      '<a class="ext" href="' + REPO + '" target="_blank" rel="noopener">GitHub</a>' +
      '</nav>' +
      '<button class="theme-btn" id="theme-btn" type="button" aria-label="Змінити тему">Тема: авто</button>' +
      '<div class="side-foot">Прошивка v' + esc(DOC_ID) + ' · ESP32-S3</div>';
  }

  /* prev / next */
  var main = document.querySelector('main');
  if (main && cur >= 0) {
    var pager = document.createElement('div');
    pager.className = 'pager';
    var html = '';
    if (cur > 0) html += '<a class="prev" href="' + PAGES[cur - 1].href + '"><small>← Назад</small>' + esc(PAGES[cur - 1].title) + '</a>';
    if (cur < PAGES.length - 1) html += '<a class="next" href="' + PAGES[cur + 1].href + '"><small>Далі →</small>' + esc(PAGES[cur + 1].title) + '</a>';
    pager.innerHTML = html;
    main.appendChild(pager);
  }

  /* copy buttons on <pre> */
  Array.prototype.forEach.call(document.querySelectorAll('pre'), function (pre) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'copy'; b.textContent = 'Копіювати';
    b.addEventListener('click', function () {
      var text = pre.innerText.replace(/Копіювати$|Скопійовано$/, '').trimEnd();
      var done = function () { b.textContent = 'Скопійовано'; setTimeout(function () { b.textContent = 'Копіювати'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
      else done();
    });
    pre.appendChild(b);
  });

  /* ---------- версії документації ---------- */
  /* Перейти на ту саму сторінку в іншому наборі; якщо її там немає — на головну набору. */
  function goDoc(d) {
    var base = ROOT + (d.path || '');
    var target = base + file + location.hash;
    fetch(target, { method: 'HEAD' }).then(function (r) {
      location.href = r.ok ? target : base + 'index.html';
    }).catch(function () { location.href = target; });
  }
  window.SPC.goDoc = goDoc;
  window.SPC.docs = fetch(ROOT + 'versions.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw r; return r.json(); })
    .then(function (j) { return (j && j.docs) || []; })
    .catch(function () { return []; });
  window.SPC.docs.then(function (docs) {
    /* Прошивка відкриває інструкцію як .../?fw=2.1.6 — переходимо на документацію її лінії. */
    var fw = (location.search.match(/[?&]fw=([^&#]+)/) || [])[1];
    if (fw) {
      fw = decodeURIComponent(fw).replace(/^v?/, 'v');
      var want = docs.filter(function (d) {
        try { return new RegExp(d.match).test(fw); } catch (e) { return false; }
      })[0];
      if (want && want.id !== DOC_ID) { goDoc(want); return; }
    }
    var me = docs.filter(function (d) { return d.id === DOC_ID; })[0];
    var latest = docs.filter(function (d) { return d.latest; })[0] || docs[0];
    var wrap = document.getElementById('doc-ver'), sel = document.getElementById('doc-ver-sel');
    if (wrap && docs.length > 1) {
      sel.innerHTML = docs.map(function (d) {
        return '<option value="' + esc(d.id) + '"' + (d.id === DOC_ID ? ' selected' : '') + '>' +
          esc(d.label || d.id) + (d.latest ? ' (поточна)' : '') + '</option>';
      }).join('');
      sel.addEventListener('change', function () {
        var d = docs.filter(function (x) { return x.id === sel.value; })[0];
        if (d) goDoc(d);
      });
      wrap.hidden = false;
    }
    if (main && me && latest && !me.latest) {
      var b = document.createElement('div');
      b.className = 'callout warn doc-old';
      b.innerHTML = '<span class="t">Документація для прошивки ' + esc(me.label || me.id) + '</span>' +
        'Це стара версія інструкції. Для актуальної прошивки ' + esc(latest.label || latest.id) +
        ' дивіться <a href="#" id="doc-old-go">поточну документацію</a>.';
      main.insertBefore(b, main.firstChild);
      document.getElementById('doc-old-go').addEventListener('click', function (e) { e.preventDefault(); goDoc(latest); });
    }
  });

  /* theme: auto -> light -> dark */
  var btn = document.getElementById('theme-btn');
  var KEY = 'spc-theme';
  var names = { auto: 'авто', light: 'світла', dark: 'темна' };
  function get() { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } }
  function apply(t) {
    var r = document.documentElement;
    if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
    if (btn) btn.textContent = 'Тема: ' + names[t];
  }
  apply(get());
  if (btn) btn.addEventListener('click', function () {
    var order = ['auto', 'light', 'dark'];
    var next = order[(order.indexOf(get()) + 1) % 3];
    try { localStorage.setItem(KEY, next); } catch (e) { /* приватний режим */ }
    apply(next);
  });
})();
