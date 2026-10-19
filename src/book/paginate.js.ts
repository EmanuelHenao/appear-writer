// Paginador que corre dentro del documento del libro (vista previa y
// Chromium). Mueve cada bloque de #flow a páginas de tamaño fijo, parte
// los párrafos que no caben palabra a palabra y numera al final.
// El libro llega en secciones (el principio y cada capítulo, cada una con
// su huella): en la vista previa, al editar, solo se vuelven a paginar las
// secciones que cambiaron, sin recargar nada.
// Es JavaScript plano en una cadena para que no lo toque el empaquetador.

export const PAGINATE_JS = String.raw`
(function () {
  var flow = document.getElementById("flow");
  var book = document.getElementById("book");
  var tpl = document.getElementById("page-tpl");
  var limit = parseInt(document.body.dataset.previewLimit || "0", 10);
  var bookTitle = document.body.dataset.title || "";
  var body = null;
  // Dónde se crean las páginas nuevas y de qué sección son.
  var target = book;
  var seg = "";

  function newPage(cls) {
    var page = tpl.content.firstElementChild.cloneNode(true);
    page.className = "page " + (cls || "text");
    page.dataset.seg = seg;
    target.appendChild(page);
    body = page.querySelector(".body");
    return page;
  }
  function overflows() {
    return body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1;
  }
  function textTarget(el) {
    return el.querySelector("[data-split]") || (el.hasAttribute("data-split") ? el : null);
  }
  // Copia en dst los caracteres [a, b) de src conservando sus spans.
  function setRange(dst, src, a, b) {
    var copy = src.cloneNode(true);
    var pos = 0;
    var walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var len = n.textContent.length;
      var s0 = Math.max(a, pos) - pos, s1 = Math.min(b, pos + len) - pos;
      n.textContent = s1 > s0 ? n.textContent.slice(s0, s1) : "";
      pos += len;
    });
    // Quita los spans que quedaron vacíos.
    Array.prototype.slice.call(copy.querySelectorAll("span")).reverse().forEach(function (sp) { if (!sp.textContent) sp.remove(); });
    while (dst.firstChild) dst.removeChild(dst.firstChild);
    while (copy.firstChild) dst.appendChild(copy.firstChild);
  }

  // Coloca un elemento partiéndolo por palabras si no cabe en la página.
  function place(el) {
    body.appendChild(el);
    if (!overflows()) return;
    body.removeChild(el);
    var target = textTarget(el);
    if (!target) {
      // Imagen u otro bloque indivisible: a la página siguiente, quepa o no.
      if (body.children.length) newPage("text");
      body.appendChild(el);
      return;
    }
    var rest = el;
    while (true) {
      var t = textTarget(rest);
      // Copia del texto (con sus spans de formato) para recortarla por caracteres.
      var src = t.cloneNode(true);
      var full = t.textContent;
      var parts = full.split(/(\s+)/);
      var cut = [0];
      for (var k = 0; k < parts.length; k++) cut.push(cut[k] + parts[k].length);
      var head = rest.cloneNode(true);
      var meta = head.querySelector("[data-meta-end]");
      if (meta) meta.remove();
      var ht = textTarget(head);
      body.appendChild(head);
      var lo = 0, hi = parts.length;
      while (lo < hi) {
        var mid = Math.ceil((lo + hi) / 2);
        setRange(ht, src, 0, cut[mid]);
        if (overflows()) hi = mid - 1; else lo = mid;
      }
      // Se evita dejar una o dos palabras sueltas al pie de la página.
      if (lo <= 0 || (lo < 12 && lo < parts.length)) {
        body.removeChild(head);
        if (!body.children.length) { body.appendChild(rest); return; }
        newPage("text");
        continue;
      }
      var end = cut[lo];
      while (end > 0 && /\s/.test(full.charAt(end - 1))) end--;
      setRange(ht, src, 0, end);
      head.classList.add("split-head");
      var start = cut[lo];
      while (start < full.length && /\s/.test(full.charAt(start))) start++;
      if (start >= full.length) { body.removeChild(head); body.appendChild(rest); return; }
      var tail = rest.cloneNode(true);
      tail.classList.add("cont");
      tail.classList.remove("first");
      setRange(textTarget(tail), src, start, full.length);
      newPage("text");
      body.appendChild(tail);
      if (!overflows()) return;
      body.removeChild(tail);
      rest = tail;
    }
  }


  /** Pagina los bloques de una sección; cada sección empieza en página nueva. */
  function layoutSegment(section) {
    seg = section.dataset.seg || "";
    body = null;
    var created = [];
    var before = target.children.length;
    Array.prototype.slice.call(section.children).forEach(function (el) {
      var mode = el.dataset.mode || "flow";
      if (mode === "own") {
        var page = newPage(el.dataset.pageClass || "own");
        body.appendChild(el);
        if (overflows() && el.dataset.longClass) {
          // Mensaje demasiado largo para una sola página: pasa a texto corrido.
          page.remove();
          el.className = el.dataset.longClass;
          el.dataset.mode = "flow";
          newPage("text");
          place(el);
        }
        body = null;
        return;
      }
      if (!body || el.dataset.newpage) newPage(el.dataset.pageClass || "text");
      place(el);
    });
    body = null;
    for (var i = before; i < target.children.length; i++) created.push(target.children[i]);
    return created;
  }

  function bookPages() {
    return Array.prototype.slice.call(book.children).filter(function (el) { return el.classList.contains("page"); });
  }

  /** Números, cabeceras, márgenes espejo, números de capítulo e índice. */
  function finish() {
    var pages = bookPages();
    var chapter = "";
    pages.forEach(function (page, i) {
      var n = i + 1;
      page.dataset.n = String(n);
      page.classList.remove("recto", "verso");
      page.classList.add(i % 2 === 0 ? "recto" : "verso");
      var marker = page.querySelector("[data-chapter]");
      if (marker) chapter = marker.dataset.chapter;
      var folio = page.querySelector(".folio");
      if (folio) folio.textContent = page.classList.contains("nofolio") ? "" : String(n);
      var hl = page.querySelector(".h-left");
      var hr = page.querySelector(".h-right");
      if (hl && hr) {
        hl.textContent = page.classList.contains("nohead") ? "" : bookTitle;
        hr.textContent = page.classList.contains("nohead") ? "" : chapter;
      }
    });
    var chapterPages = {};
    var openers = Array.prototype.slice.call(book.querySelectorAll("[data-chapter-key]"));
    openers.forEach(function (el, i) {
      chapterPages[el.dataset.chapterKey] = Number(el.closest(".page").dataset.n);
      var eyebrow = el.querySelector("[data-roman]");
      if (eyebrow) {
        eyebrow.textContent = openers.length > 1 ? "Capítulo " + roman(i + 1) : "";
        eyebrow.style.display = openers.length > 1 ? "" : "none";
      }
    });
    Array.prototype.forEach.call(book.querySelectorAll("[data-toc]"), function (li) {
      var pn = li.querySelector(".pn");
      if (pn) pn.textContent = chapterPages[li.dataset.toc] || "";
    });
    return { pages: pages.length, chapters: chapterPages };
  }

  function roman(n) {
    var map = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    var out = "";
    map.forEach(function (m) { while (n >= m[0]) { out += m[1]; n -= m[0]; } });
    return out;
  }

  function byKey(key) {
    return Array.prototype.filter.call(book.querySelectorAll("[data-key]"), function (el) { return el.dataset.key === key; });
  }
  function pageOf(el) {
    var p = el && el.closest(".page");
    return p ? Number(p.dataset.n) || 0 : 0;
  }
  function whenLoaded(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll("img")).map(function (img) {
      return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    });
    return Promise.all([document.fonts.ready].concat(imgs));
  }

  var hashes = {};
  function run() {
    Array.prototype.slice.call(flow.children).forEach(function (s) {
      hashes[s.dataset.seg] = s.dataset.hash;
      layoutSegment(s);
    });
    flow.remove();
    var info = finish();
    if (limit && window.matchMedia("screen").matches) preview(info);
    window.__BOOK_READY__ = info;
    document.body.dataset.ready = "1";
    try { parent.postMessage({ type: "book-ready", pages: info.pages }, "*"); } catch (e) {}
  }

  // ── Vista previa ──────────────────────────────────────────────────
  // Todas las páginas se quedan en el documento y solo se muestra una
  // ventana de «limit» páginas; moverse por el libro solo cambia la ventana.
  function preview() {
    var view = { cols: 2, zoom: 0 };
    var current = 1;
    var z = 1;
    var start = 0;
    var picked = "";
    var STRIP = 78;
    document.body.classList.add("previewing");
    var post = function (m) { try { parent.postMessage(m, "*"); } catch (e) {} };
    var all = function () { return bookPages(); };
    var shown = function () { return all().filter(function (p) { return !p.classList.contains("off"); }); };

    // En doble página, el número de la página izquierda del pliego (la 1 va sola).
    var spreadStart = function (n) { return view.cols !== 2 || n <= 1 ? n : n % 2 === 0 ? n : n - 1; };
    var inSpread = function (n) { return view.cols === 2 && current > 1 && n === current + 1; };

    var strip = document.createElement("nav");
    strip.id = "strip";
    strip.setAttribute("aria-label", "Páginas");
    strip.style.cssText = "position:fixed;left:0;right:0;bottom:0;height:" + STRIP + "px;display:flex;gap:6px;align-items:center;overflow-x:auto;padding:0 12px;background:rgba(22,21,28,.94);border-top:1px solid #2b2935;z-index:5;scrollbar-width:thin";
    document.body.appendChild(strip);
    document.body.style.paddingBottom = STRIP + 16 + "px";
    var thumbs = [];

    var report = function () {
      post({ type: "book-view", page: current, shown: shown().length, cols: view.cols, zoom: z, total: all().length, first: start + 1 });
      mark();
    };
    var mark = function () {
      thumbs.forEach(function (b) {
        var n = Number(b.dataset.n);
        var on = n === current || inSpread(n);
        b.style.outline = on ? "2px solid #b6a6ff" : "none";
        b.style.outlineOffset = "2px";
        if (on && n === current) b.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    };
    var buildStrip = function () {
      strip.textContent = "";
      thumbs = shown().map(function (p) {
        var n = Number(p.dataset.n);
        var h = STRIP - 22, s = h / p.offsetHeight, w = Math.round(p.offsetWidth * s);
        var b = document.createElement("button");
        b.type = "button";
        b.dataset.n = String(n);
        b.title = "Página " + n;
        b.setAttribute("aria-label", "Ir a la página " + n);
        b.style.cssText = "flex:none;position:relative;overflow:hidden;padding:0;border:0;border-radius:2px;cursor:pointer;background:none;width:" + w + "px;height:" + h + "px;" + (n > 1 && n % 2 === 0 ? "margin-left:6px;" : "");
        var c = p.cloneNode(true);
        c.classList.remove("off");
        c.style.cssText = "position:absolute;left:0;top:0;transform:scale(" + s + ");transform-origin:0 0;box-shadow:none;pointer-events:none;grid-column:auto";
        Array.prototype.forEach.call(c.querySelectorAll(".picked"), function (el) { el.classList.remove("picked"); });
        b.appendChild(c);
        b.addEventListener("click", function () { goTo(n); });
        strip.appendChild(b);
        return b;
      });
    };

    // La ventana empieza en una página par (izquierda) para no romper los pliegos.
    var setWindow = function (n) {
      var pages = all();
      var total = pages.length;
      var s = limit >= total ? 0 : Math.max(0, Math.min(total - limit, n - 1 - Math.floor(limit / 2)));
      if (s > 0 && s % 2 === 0) s -= 1;
      if (s === start && pages.every(function (p, i) { return p.classList.contains("off") === (i < s || i >= s + limit); })) return false;
      start = s;
      pages.forEach(function (p, i) { p.classList.toggle("off", i < s || i >= s + limit); });
      buildStrip();
      fit();
      return true;
    };
    var inWindow = function (n) { return n > start && n <= start + limit; };

    var fit = function () {
      var vis = shown();
      var first = vis[0];
      if (!first) return;
      book.style.zoom = "1";
      var pw = first.offsetWidth, ph = first.offsetHeight;
      var cols = view.cols;
      book.style.gridTemplateColumns = "repeat(" + cols + ", var(--pw))";
      all().forEach(function (p) { p.style.gridColumn = ""; });
      first.style.gridColumn = cols === 2 && Number(first.dataset.n) === 1 ? "2" : "auto";
      var fitZ = Math.min((window.innerWidth - 32) / (pw * cols), (window.innerHeight - 32 - STRIP) / ph);
      z = view.zoom || Math.min(fitZ, 2);
      book.style.zoom = String(z);
    };
    var goTo = function (n, smooth) {
      var pages = all();
      n = Math.max(1, Math.min(pages.length, n));
      if (!inWindow(n)) setWindow(n);
      current = spreadStart(n);
      var p = pages[n - 1];
      if (p) p.scrollIntoView({ block: view.zoom ? "start" : "center", behavior: smooth ? "smooth" : "auto" });
      report();
    };
    var onScroll = function () {
      var mid = window.innerHeight * 0.4;
      var vis = shown();
      for (var i = 0; i < vis.length; i++) {
        var r = vis[i].getBoundingClientRect();
        if (r.bottom > mid) {
          var n = spreadStart(Number(vis[i].dataset.n));
          if (n !== current) { current = n; report(); }
          return;
        }
      }
    };
    var focus = function (key, scroll) {
      picked = key || "";
      Array.prototype.forEach.call(book.querySelectorAll(".picked"), function (el) { el.classList.remove("picked"); });
      if (!key) return;
      var els = byKey(key);
      els.forEach(function (el) { el.classList.add("picked"); });
      var n = pageOf(els[0]);
      if (n && (scroll || !inWindow(n))) goTo(n);
      post({ type: "book-focus", key: key, found: els.length > 0, page: n });
    };

    // Vuelve a paginar solo las secciones que cambiaron y las coloca en su sitio.
    var busy = Promise.resolve();
    var patch = function (segments) {
      busy = busy.then(function () {
        var changed = segments.filter(function (s) { return hashes[s.key] !== s.hash; });
        var keep = {};
        segments.forEach(function (s) { keep[s.key] = true; });
        var tmp = document.createElement("div");
        tmp.style.cssText = "position:absolute;left:-99999px;top:0;width:var(--pw)";
        tmp.innerHTML = changed.map(function (s) { return '<div data-seg="' + s.key.replace(/"/g, "&quot;") + '">' + s.html + "</div>"; }).join("");
        document.body.appendChild(tmp);
        var stage = document.createElement("div");
        stage.style.cssText = "position:absolute;left:-99999px;top:0";
        document.body.appendChild(stage);
        return whenLoaded(tmp).then(function () {
          target = stage;
          var fresh = {};
          Array.prototype.slice.call(tmp.children).forEach(function (s) { fresh[s.dataset.seg] = layoutSegment(s); });
          target = book;
          var bySeg = {};
          all().forEach(function (p) { (bySeg[p.dataset.seg] = bySeg[p.dataset.seg] || []).push(p); });
          var ordered = [];
          segments.forEach(function (s) {
            var list = fresh[s.key] || bySeg[s.key] || [];
            ordered = ordered.concat(list);
            hashes[s.key] = s.hash;
          });
          // Las páginas de secciones cambiadas o quitadas se van; el resto se reordena.
          all().forEach(function (p) { if (!keep[p.dataset.seg] || fresh[p.dataset.seg]) p.remove(); });
          ordered.forEach(function (p) { book.appendChild(p); });
          Object.keys(hashes).forEach(function (k) { if (!keep[k]) delete hashes[k]; });
          tmp.remove();
          stage.remove();
          var info = finish();
          window.__BOOK_READY__ = info;
          var keepPage = Math.min(current, info.pages);
          all().forEach(function (p) { p.classList.add("off"); });
          start = -1;
          setWindow(keepPage);
          if (picked) {
            // Si lo que editas quedó en otro pliego (una página añadida), la vista va hasta él.
            var pn = pageOf(byKey(picked)[0]);
            focus(picked, !!pn && spreadStart(pn) !== current);
          }
          var el = all()[keepPage - 1];
          if (el && !picked) el.scrollIntoView({ block: view.zoom ? "start" : "center" });
          report();
          post({ type: "book-patched", pages: info.pages, changed: changed.length });
        });
      });
    };

    window.addEventListener("message", function (e) {
      var d = e.data || {};
      if (d.type !== "book-control") return;
      if (d.cols) view.cols = d.cols === 1 ? 1 : 2;
      if ("zoom" in d) view.zoom = d.zoom || 0;
      if (d.cols || "zoom" in d) { fit(); goTo(current); }
      if (d.goto) goTo(d.goto);
      if ("focus" in d) focus(d.focus, d.scroll !== false);
      if (d.patch) patch(d.patch);
    });
    // Los atajos del estudio siguen funcionando con el foco dentro de la vista previa.
    window.addEventListener("keydown", function (e) {
      if (!/^(h|d|z|\?|ArrowLeft|ArrowRight|Escape)$/i.test(e.key)) return;
      post({ type: "book-key", key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey, alt: e.altKey });
    });
    // Elegir un bloque con un clic: la página padre abre su ficha.
    book.addEventListener("click", function (e) {
      var el = e.target.closest && e.target.closest("[data-key]");
      if (!el) return;
      e.preventDefault();
      focus(el.dataset.key, false);
      post({ type: "book-pick", key: el.dataset.key, page: pageOf(el) });
    });

    all().forEach(function (p) { p.classList.add("off"); });
    start = -1;
    var focusKey = document.body.dataset.focus || "";
    var initial = focusKey && byKey(focusKey)[0] ? pageOf(byKey(focusKey)[0]) : 1;
    setWindow(initial);
    if (focusKey) focus(focusKey, true);
    else report();
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  whenLoaded(document).then(run);
})();
`;
