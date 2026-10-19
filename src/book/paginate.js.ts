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
    if (limit && total > limit) {
      pages.slice(limit).forEach(function (p) { p.remove(); });
      var note = document.createElement("p");
      note.className = "preview-note";
      note.textContent = "Vista previa de las primeras " + limit + " páginas de " + total + ". El archivo final incluye todas.";
      book.appendChild(note);
    }
    // En la vista previa se escala para ver páginas enfrentadas.
    if (limit && window.matchMedia("screen").matches) {
      var fit = function () {
        var first = book.querySelector(".page");
        if (!first) return;
        var pw = first.offsetWidth;
        var avail = window.innerWidth - 32;
        var cols = avail >= pw * 2 * 0.42 ? 2 : 1;
        book.style.gridTemplateColumns = "repeat(" + cols + ", var(--pw))";
        first.style.gridColumn = cols === 2 ? "2" : "auto";
        book.style.zoom = String(Math.min(1, avail / (pw * cols)));
      };
      fit();
      window.addEventListener("resize", fit);
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
