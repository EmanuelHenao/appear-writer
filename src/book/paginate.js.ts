// Paginador que corre dentro del documento del libro (vista previa y
// Chromium). Mueve cada bloque de #flow a páginas de tamaño fijo, parte
// los párrafos que no caben palabra a palabra y numera al final.
// Es JavaScript plano en una cadena para que no lo toque el empaquetador.

export const PAGINATE_JS = String.raw`
(function () {
  var flow = document.getElementById("flow");
  var book = document.getElementById("book");
  var tpl = document.getElementById("page-tpl");
  var limit = parseInt(document.body.dataset.previewLimit || "0", 10);
  var bookTitle = document.body.dataset.title || "";
  var body = null;

  function newPage(cls) {
    var page = tpl.content.firstElementChild.cloneNode(true);
    page.className = "page " + (cls || "text");
    book.appendChild(page);
    body = page.querySelector(".body");
    return page;
  }
  function overflows() {
    return body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1;
  }
  function textTarget(el) {
    return el.querySelector("[data-split]") || (el.hasAttribute("data-split") ? el : null);
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
      var parts = t.textContent.split(/(\s+)/);
      var head = rest.cloneNode(true);
      var meta = head.querySelector("[data-meta-end]");
      if (meta) meta.remove();
      var ht = textTarget(head);
      body.appendChild(head);
      var lo = 0, hi = parts.length;
      while (lo < hi) {
        var mid = Math.ceil((lo + hi) / 2);
        ht.textContent = parts.slice(0, mid).join("");
        if (overflows()) hi = mid - 1; else lo = mid;
      }
      // Se evita dejar una o dos palabras sueltas al pie de la página.
      if (lo <= 0 || (lo < 12 && lo < parts.length)) {
        body.removeChild(head);
        if (!body.children.length) { body.appendChild(rest); return; }
        newPage("text");
        continue;
      }
      ht.textContent = parts.slice(0, lo).join("").replace(/\s+$/, "");
      head.classList.add("split-head");
      var remaining = parts.slice(lo).join("").replace(/^\s+/, "");
      if (!remaining) { body.removeChild(head); body.appendChild(rest); return; }
      var tail = rest.cloneNode(true);
      tail.classList.add("cont");
      tail.classList.remove("first");
      textTarget(tail).textContent = remaining;
      newPage("text");
      body.appendChild(tail);
      if (!overflows()) return;
      body.removeChild(tail);
      rest = tail;
    }
  }

  function byKey(key) {
    return Array.prototype.filter.call(document.querySelectorAll("[data-key]"), function (el) { return el.dataset.key === key; });
  }
  function pageOf(el) {
    var p = el && el.closest(".page");
    return p ? Number(p.dataset.n) || 0 : 0;
  }

  function run() {
    var items = Array.prototype.slice.call(flow.children);
    var chapterOf = [];
    var currentChapter = "";
    var chapterPages = {};
    items.forEach(function (el) {
      if (el.dataset.chapter) currentChapter = el.dataset.chapter;
      var mode = el.dataset.mode || "flow";
      if (mode === "own") {
        var page = newPage(el.dataset.pageClass || "own");
        body.appendChild(el);
        if (el.dataset.chapterKey) chapterPages[el.dataset.chapterKey] = book.children.length;
        if (overflows() && el.dataset.longClass) {
          // Mensaje demasiado largo para una sola página: pasa a texto corrido.
          book.removeChild(page);
          el.className = el.dataset.longClass;
          el.dataset.mode = "flow";
          newPage("text");
          place(el);
        }
        body = null;
        return;
      }
      if (!body || el.dataset.newpage) {
        newPage(el.dataset.pageClass || "text");
        if (el.dataset.chapterKey) chapterPages[el.dataset.chapterKey] = book.children.length;
      }
      place(el);
    });
    flow.remove();

    // Números, cabeceras y márgenes espejo.
    var pages = Array.prototype.slice.call(book.children);
    var chapter = "";
    pages.forEach(function (page, i) {
      var n = i + 1;
      page.dataset.n = String(n);
      page.classList.add(i % 2 === 0 ? "recto" : "verso");
      var marker = page.querySelector("[data-chapter]");
      if (marker) chapter = marker.dataset.chapter;
      var folio = page.querySelector(".folio");
      if (folio && !page.classList.contains("nofolio")) folio.textContent = String(n);
      var hl = page.querySelector(".h-left");
      var hr = page.querySelector(".h-right");
      if (hl && hr && !page.classList.contains("nohead")) {
        hl.textContent = bookTitle;
        hr.textContent = chapter;
      }
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-toc]"), function (li) {
      var pn = li.querySelector(".pn");
      if (pn) pn.textContent = chapterPages[li.dataset.toc] || "";
    });
    var total = pages.length;
    // Con foco, la ventana de páginas se centra en el bloque elegido; empieza
    // en una página par (izquierda) para no romper los pliegos.
    var offset = 0;
    var focusKey = document.body.dataset.focus || "";
    if (limit && total > limit && focusKey) {
      var hit = byKey(focusKey)[0];
      var fp = hit ? hit.closest(".page") : null;
      var fi = fp ? pages.indexOf(fp) : -1;
      if (fi >= 0) {
        offset = Math.max(0, Math.min(total - limit, fi - Math.floor(limit / 2)));
        if (offset > 0 && offset % 2 === 0) offset -= 1;
      }
    }
    if (limit && total > limit) {
      pages.slice(0, offset).forEach(function (p) { p.remove(); });
      pages.slice(offset + limit).forEach(function (p) { p.remove(); });
      var note = document.createElement("p");
      note.className = "preview-note";
      note.textContent = offset
        ? "Vista previa de las páginas " + (offset + 1) + " a " + Math.min(total, offset + limit) + " de " + total + ". El archivo final incluye todas."
        : "Vista previa de las primeras " + limit + " páginas de " + total + ". El archivo final incluye todas.";
      book.appendChild(note);
    }
    // Visor de la vista previa: una página o doble página (por defecto),
    // zoom («ajustar» encaja la página o el pliego entero en la ventana)
    // y navegación. La página padre lo controla con postMessage.
    if (limit && window.matchMedia("screen").matches) {
      var view = { cols: 2, zoom: 0 };
      var shown = Array.prototype.slice.call(book.querySelectorAll(".page"));
      var current = 1;
      var z = 1;
      // En doble página, el índice (desde 1) de la página izquierda del pliego.
      var spreadStart = function (n) {
        if (view.cols !== 2) return n;
        if (offset === 0) return n > 1 && n % 2 === 1 ? n - 1 : n;
        return n % 2 === 0 ? n - 1 : n;
      };
      var inSpread = function (n) { return view.cols === 2 && !(offset === 0 && current === 1) && n === current + 1; };
      var report = function () {
        try { parent.postMessage({ type: "book-view", page: current, shown: shown.length, cols: view.cols, zoom: z, offset: offset, total: total }, "*"); } catch (e) {}
      };
      // Tira de miniaturas al pie: un clic lleva a esa página.
      var STRIP = 78;
      var strip = document.createElement("nav");
      strip.id = "strip";
      strip.setAttribute("aria-label", "Páginas");
      strip.style.cssText = "position:fixed;left:0;right:0;bottom:0;height:" + STRIP + "px;display:flex;gap:6px;align-items:center;overflow-x:auto;padding:0 12px;background:rgba(22,21,28,.94);border-top:1px solid #2b2935;z-index:5;scrollbar-width:thin";
      var thumbs = shown.map(function (p, i) {
        var h = STRIP - 22, s = h / p.offsetHeight, w = Math.round(p.offsetWidth * s);
        var b = document.createElement("button");
        b.type = "button";
        b.title = "Página " + (p.dataset.n || i + 1);
        b.setAttribute("aria-label", "Ir a la página " + (p.dataset.n || i + 1));
        b.style.cssText = "flex:none;position:relative;overflow:hidden;padding:0;border:0;border-radius:2px;cursor:pointer;background:none;width:" + w + "px;height:" + h + "px;" + (i > 0 && (i + offset) % 2 === 1 ? "margin-left:6px;" : "");
        var c = p.cloneNode(true);
        c.style.cssText = "position:absolute;left:0;top:0;transform:scale(" + s + ");transform-origin:0 0;box-shadow:none;pointer-events:none;grid-column:auto";
        b.appendChild(c);
        b.addEventListener("click", function () { current = spreadStart(i + 1); goTo(i + 1); report(); mark(); });
        strip.appendChild(b);
        return b;
      });
      var mark = function () {
        thumbs.forEach(function (b, i) {
          var n = i + 1;
          var on = n === current || inSpread(n);
          b.style.outline = on ? "2px solid #b6a6ff" : "none";
          b.style.outlineOffset = "2px";
          if (on && n === current) b.scrollIntoView({ block: "nearest", inline: "nearest" });
        });
      };
      document.body.appendChild(strip);
      document.body.style.paddingBottom = STRIP + 16 + "px";
      var baseReport = report;
      report = function () { baseReport(); mark(); };

      var fit = function () {
        var first = shown[0];
        if (!first) return;
        book.style.zoom = "1";
        var pw = first.offsetWidth, ph = first.offsetHeight;
        var cols = view.cols;
        book.style.gridTemplateColumns = "repeat(" + cols + ", var(--pw))";
        first.style.gridColumn = cols === 2 && offset === 0 ? "2" : "auto";
        var fitZ = Math.min((window.innerWidth - 32) / (pw * cols), (window.innerHeight - 32 - STRIP) / ph);
        z = view.zoom || Math.min(fitZ, 2);
        book.style.zoom = String(z);
        report();
      };
      var goTo = function (n) {
        var p = shown[Math.max(0, Math.min(shown.length - 1, n - 1))];
        if (p) p.scrollIntoView({ block: view.zoom ? "start" : "center" });
      };
      // Primera página visible (en doble página, la del pliego que se ve).
      var onScroll = function () {
        var mid = window.innerHeight * 0.4;
        for (var i = 0; i < shown.length; i++) {
          var r = shown[i].getBoundingClientRect();
          if (r.bottom > mid) {
            var n = spreadStart(i + 1);
            if (n !== current) { current = n; report(); }
            return;
          }
        }
      };
      window.addEventListener("message", function (e) {
        var d = e.data || {};
        if (d.type !== "book-control") return;
        var keep = current;
        if (d.cols) view.cols = d.cols === 1 ? 1 : 2;
        if ("zoom" in d) view.zoom = d.zoom || 0;
        if (d.cols || "zoom" in d) { fit(); goTo(keep); }
        if (d.goto) { current = d.goto; goTo(d.goto); report(); }
        if ("focus" in d) focus(d.focus, true);
      });
      // Elegir un bloque con un clic: la página padre abre su ficha.
      document.body.classList.add("previewing");
      book.addEventListener("click", function (e) {
        var el = e.target.closest && e.target.closest("[data-key]");
        if (!el) return;
        e.preventDefault();
        focus(el.dataset.key, false);
        try { parent.postMessage({ type: "book-pick", key: el.dataset.key, page: pageOf(el) }, "*"); } catch (err) {}
      });
      var focus = function (key, scroll) {
        Array.prototype.forEach.call(document.querySelectorAll(".picked"), function (el) { el.classList.remove("picked"); });
        if (!key) return;
        var els = byKey(key);
        els.forEach(function (el) { el.classList.add("picked"); });
        if (scroll && els[0]) {
          var idx = shown.indexOf(els[0].closest(".page"));
          if (idx >= 0) { current = spreadStart(idx + 1); goTo(idx + 1); report(); }
        }
        try { parent.postMessage({ type: "book-focus", key: key, found: els.length > 0, page: pageOf(els[0]) }, "*"); } catch (err) {}
      };
      fit();
      if (focusKey) focus(focusKey, true);
      window.addEventListener("resize", fit);
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    window.__BOOK_READY__ = { pages: total, chapters: chapterPages };
    document.body.dataset.ready = "1";
    try { parent.postMessage({ type: "book-ready", pages: total }, "*"); } catch (e) {}
  }

  var imgs = Array.prototype.slice.call(document.images).map(function (img) {
    return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
  });
  Promise.all([document.fonts.ready].concat(imgs)).then(run);
})();
`;
