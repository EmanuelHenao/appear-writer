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
  // Las páginas llenas salen del documento hasta el final: si se quedaran,
  // cada medida volvería a maquetar todo el libro (miles de páginas).
  var sink = null;

  function retire() {
    var page = body && body.closest(".page");
    if (page && page.parentNode === target) sink.appendChild(page);
  }
  function newPage(cls) {
    retire();
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
  // El texto de un bloque partible, preparado una sola vez: sus tramos
  // (cada nodo de texto con los spans que lo envuelven) y sus palabras.
  function indexText(t) {
    var nodes = [];
    var pos = 0;
    var walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      var n = walker.currentNode;
      var chain = [];
      for (var p = n.parentNode; p && p !== t; p = p.parentNode) chain.push(p);
      nodes.push({ start: pos, text: n.data, chain: chain });
      pos += n.data.length;
    }
    var full = t.textContent;
    var starts = [], ends = [];
    var re = /\S+/g, m;
    while ((m = re.exec(full))) { starts.push(m.index); ends.push(m.index + m[0].length); }
    return { nodes: nodes, starts: starts, ends: ends, length: full.length };
  }
  // Escribe en dst los caracteres [a, b) conservando sus spans. Solo toca los
  // tramos de ese rango (el primero se busca por bisección).
  function fill(dst, text, a, b) {
    dst.textContent = "";
    var ns = text.nodes;
    var lo = 0, hi = ns.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (ns[mid].start <= a) lo = mid; else hi = mid - 1;
    }
    for (var i = lo; i < ns.length && ns[i].start < b; i++) {
      var n = ns[i];
      var s0 = Math.max(a, n.start) - n.start, s1 = Math.min(b, n.start + n.text.length) - n.start;
      if (s1 <= s0) continue;
      var node = document.createTextNode(n.text.slice(s0, s1));
      for (var c = 0; c < n.chain.length; c++) {
        var w = n.chain[c].cloneNode(false);
        w.appendChild(node);
        node = w;
      }
      dst.appendChild(node);
    }
  }

  // Coloca un elemento partiéndolo por palabras si no cabe en la página.
  // Cada página cuesta lo que su texto (por galope y bisección), no lo que
  // queda del bloque: un párrafo de cien páginas sigue siendo lineal.
  var MIN_WORDS = 6;
  // Un texto más largo que esto no cabe en una página: se parte sin medirlo
  // entero (maquetar un párrafo enorme de una vez es más que lineal).
  var LONG_TEXT = 4000;
  function place(el) {
    var t = textTarget(el);
    if (!t || t.textContent.length <= LONG_TEXT) {
      body.appendChild(el);
      if (!overflows()) return;
      body.removeChild(el);
    }
    var text = t && indexText(t);
    if (!text || !text.starts.length) {
      // Imagen u otro bloque indivisible: a la página siguiente, quepa o no.
      if (body.children.length) newPage("text");
      body.appendChild(el);
      return;
    }
    // Un molde sin texto: cada trozo es una copia barata del molde.
    var shell = el.cloneNode(true);
    textTarget(shell).textContent = "";
    var words = text.starts.length;
    var at = 0;
    while (true) {
      var piece = shell.cloneNode(true);
      if (at > 0) {
        piece.classList.add("cont");
        piece.classList.remove("first");
        // Las fotos del mensaje ya salieron con el primer trozo.
        var photos = piece.querySelector(".msg-photos");
        if (photos) photos.remove();
      }
      // El pie (nombre y fecha) va solo con el último trozo: se aparta y se devuelve a su sitio.
      var meta = piece.querySelector("[data-meta-end]");
      var metaParent = meta && meta.parentNode, metaNext = meta && meta.nextSibling;
      if (meta) meta.remove();
      var pt = textTarget(piece);
      var from = text.starts[at];
      body.appendChild(piece);
      var left = words - at;
      // Galope: 16, 32, 64… palabras hasta pasarse; luego bisección.
      var ok = 0, bad = -1, n = Math.min(16, left);
      while (true) {
        fill(pt, text, from, text.ends[at + n - 1]);
        if (overflows()) { bad = n; break; }
        ok = n;
        if (n === left) break;
        n = Math.min(n * 2, left);
      }
      if (bad < 0) {
        // Cabe todo lo que queda: va con su pie (nombre y fecha).
        fill(pt, text, from, text.length);
        if (meta) metaParent.insertBefore(meta, metaNext);
        if (!overflows() || !meta) return;
        // El pie no cabe: el texto se queda aquí y el pie se recorta, como antes.
        return;
      }
      while (bad - ok > 1) {
        var mid = (ok + bad) >> 1;
        fill(pt, text, from, text.ends[at + mid - 1]);
        if (overflows()) bad = mid; else ok = mid;
      }
      // Se evita dejar una o dos palabras sueltas al pie de la página.
      if (ok < MIN_WORDS) {
        body.removeChild(piece);
        if (!body.children.length) {
          fill(pt, text, from, text.length);
          if (meta) metaParent.insertBefore(meta, metaNext);
          body.appendChild(piece);
          return;
        }
        newPage("text");
        continue;
      }
      fill(pt, text, from, text.ends[at + ok - 1]);
      piece.classList.add("split-head");
      at += ok;
      newPage("text");
    }
  }


  function layoutBlock(el) {
    var mode = el.dataset.mode || "flow";
    if (mode === "own") {
      var page = newPage(el.dataset.pageClass || "own");
      body.appendChild(el);
      var tooBig = overflows();
      if (tooBig && el.dataset.joined) {
        // Los mensajes juntados no caben en una página: pasan a texto corrido.
        page.remove();
        newPage("text");
        Array.prototype.slice.call(el.children).forEach(function (m) {
          m.className = "msg msg-long";
          place(m);
        });
      } else if (tooBig && el.dataset.longClass) {
        // Mensaje demasiado largo para una sola página: pasa a texto corrido.
        page.remove();
        el.className = el.dataset.longClass;
        el.dataset.mode = "flow";
        newPage("text");
        place(el);
      }
      retire();
      body = null;
      return;
    }
    if (!body || el.dataset.newpage) newPage(el.dataset.pageClass || "text");
    place(el);
  }

  // En la vista previa el paginador comparte el hilo con el estudio: trabaja
  // a tramos y cede el paso entre uno y otro para no congelar la pestaña.
  var BUDGET_MS = limit ? 30 : Infinity;
  var later = (function () {
    var ch = new MessageChannel();
    var queue = [];
    ch.port1.onmessage = function () { queue.shift()(); };
    return function (fn) { queue.push(fn); ch.port2.postMessage(0); };
  })();
  // Al abrir la vista previa se ve cuántas páginas lleva; al editar, no hace falta.
  var laid = 0;
  var progress = null;
  var counting = false;
  function showProgress(n) {
    if (!counting) return;
    if (!progress) {
      progress = document.createElement("div");
      progress.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#cfc9da;font:13px system-ui,sans-serif;z-index:6";
      document.body.appendChild(progress);
    }
    progress.textContent = "Maquetando el libro… " + n.toLocaleString("es") + " páginas";
  }

  /**
   * Pagina los bloques de una sección; cada sección empieza en página nueva.
   * Llama a done con sus páginas, aún fuera del documento.
   */
  function layoutSegment(section, done) {
    seg = section.dataset.seg || "";
    body = null;
    sink = document.createDocumentFragment();
    var els = Array.prototype.slice.call(section.children);
    var i = 0;
    (function step() {
      var t0 = performance.now();
      while (i < els.length) {
        layoutBlock(els[i++]);
        if (i < els.length && performance.now() - t0 > BUDGET_MS) {
          showProgress(laid + sink.children.length);
          later(step);
          return;
        }
      }
      retire();
      body = null;
      laid += sink.children.length;
      done(Array.prototype.slice.call(sink.children));
    })();
  }

  /** Pagina varias secciones una tras otra; done recibe las páginas de cada una por su clave. */
  function layoutAll(sections, done) {
    var out = {};
    var k = 0;
    laid = 0;
    (function next() {
      if (k >= sections.length) {
        if (progress) progress.remove();
        progress = null;
        counting = false;
        return done(out);
      }
      var s = sections[k++];
      layoutSegment(s, function (pages) { out[s.dataset.seg] = pages; next(); });
    })();
  }

  // Se calculan al numerar: la vista previa no vuelve a recorrer el libro por cada clic o desplazamiento.
  var pageList = [];
  var keyIndex = {};

  // Lo que cada página aporta a la numeración se lee una sola vez, al crearla.
  function scan(page) {
    if (page.__scanned) return;
    page.__scanned = true;
    var marker = page.querySelector("[data-chapter]");
    page.__marker = marker ? marker.dataset.chapter : null;
    page.__openers = Array.prototype.slice.call(page.querySelectorAll("[data-chapter-key]"));
    page.__toc = Array.prototype.slice.call(page.querySelectorAll("[data-toc]"));
    page.__keys = Array.prototype.slice.call(page.querySelectorAll("[data-key]"));
  }
  /** Escribe en la página su número, su lado y sus cabeceras. */
  function decorate(page) {
    var n = page.__n;
    page.dataset.n = String(n);
    page.classList.remove("recto", "verso");
    page.classList.add(n % 2 === 1 ? "recto" : "verso");
    var folio = page.querySelector(".folio");
    if (folio) folio.textContent = page.classList.contains("nofolio") ? "" : String(n);
    var hl = page.querySelector(".h-left");
    var hr = page.querySelector(".h-right");
    if (hl && hr) {
      hl.textContent = page.classList.contains("nohead") ? "" : bookTitle;
      hr.textContent = page.classList.contains("nohead") ? "" : page.__chap;
    }
  }
  // En la vista previa solo se escriben las páginas que se ven (decorate al
  // mostrarlas); numerar el resto es una pasada en JavaScript, sin tocar el DOM.
  var lazy = !!limit && window.matchMedia("screen").matches;

  /** Números, cabeceras, márgenes espejo, números de capítulo e índice. */
  function finish(pages) {
    pageList = pages;
    keyIndex = {};
    var openers = [];
    var tocs = [];
    var chapter = "";
    pages.forEach(function (page, i) {
      scan(page);
      page.__n = i + 1;
      if (page.__marker) chapter = page.__marker;
      page.__chap = chapter;
      page.__keys.forEach(function (el) { (keyIndex[el.dataset.key] = keyIndex[el.dataset.key] || []).push(el); });
      page.__openers.forEach(function (el) { openers.push(el); });
      page.__toc.forEach(function (el) { tocs.push(el); });
      if (!lazy) decorate(page);
    });
    var chapterPages = {};
    openers.forEach(function (el, i) {
      chapterPages[el.dataset.chapterKey] = el.closest(".page").__n;
      var eyebrow = el.querySelector("[data-roman]");
      if (eyebrow) {
        eyebrow.textContent = openers.length > 1 ? "Capítulo " + roman(i + 1) : "";
        eyebrow.style.display = openers.length > 1 ? "" : "none";
      }
    });
    tocs.forEach(function (li) {
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

  // Para las pruebas: todas las páginas, también las que no están en el documento.
  window.__bookPages = function () { return pageList; };
  function byKey(key) {
    return keyIndex[key] || [];
  }
  function pageOf(el) {
    var p = el && el.closest(".page");
    return p ? p.__n || 0 : 0;
  }
  function whenLoaded(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll("img")).map(function (img) {
      return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
    });
    return Promise.all([document.fonts.ready].concat(imgs));
  }

  var hashes = {};
  function run() {
    var sections = Array.prototype.slice.call(flow.children);
    sections.forEach(function (s) { hashes[s.dataset.seg] = s.dataset.hash; });
    // En la vista previa la página que se está llenando no se ve.
    var stage = null;
    if (limit) {
      stage = document.createElement("div");
      stage.style.cssText = "position:absolute;left:-99999px;top:0";
      document.body.appendChild(stage);
      target = stage;
      counting = true;
    }
    showProgress(0);
    layoutAll(sections, function (bySeg) {
      target = book;
      if (stage) stage.remove();
      flow.remove();
      var pages = [];
      sections.forEach(function (s) { bySeg[s.dataset.seg].forEach(function (p) { pages.push(p); }); });
      // En la vista previa el libro vive en un arreglo y en el documento solo
      // está la ventana: con miles de páginas dentro, cada medida y cada cambio
      // costaría lo que el libro entero.
      if (!lazy) {
        var frag = document.createDocumentFragment();
        pages.forEach(function (p) { frag.appendChild(p); });
        book.appendChild(frag);
      }
      ready(pages);
    });
  }
  function ready(pages) {
    var info = finish(pages);
    if (limit && window.matchMedia("screen").matches) preview(info);
    window.__BOOK_READY__ = info;
    document.body.dataset.ready = "1";
    try { parent.postMessage({ type: "book-ready", pages: info.pages, hashes: hashes }, "*"); } catch (e) {}
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
    var all = function () { return pageList; };
    // La ventana son las páginas [start, start + limit): nunca se recorre el libro entero.
    var shown = function () { return start < 0 ? [] : pageList.slice(start, start + limit); };
    var hideWindow = function () { shown().forEach(function (p) { p.remove(); }); start = -1; };

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
      if (s === start) return false;
      hideWindow();
      start = s;
      var frag = document.createDocumentFragment();
      for (var i = s; i < Math.min(total, s + limit); i++) {
        decorate(pages[i]);
        frag.appendChild(pages[i]);
      }
      book.appendChild(frag);
      buildStrip();
      fit();
      return true;
    };
    var inWindow = function (n) { return n > start && n <= start + limit; };

    var gridded = null;
    var fit = function () {
      var vis = shown();
      var first = vis[0];
      if (!first) return;
      book.style.zoom = "1";
      var pw = first.offsetWidth, ph = first.offsetHeight;
      var cols = view.cols;
      book.style.gridTemplateColumns = "repeat(" + cols + ", var(--pw))";
      if (gridded) gridded.style.gridColumn = "";
      gridded = first;
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
    var pickedEls = [];
    var focus = function (key, scroll) {
      picked = key || "";
      pickedEls.forEach(function (el) { el.classList.remove("picked"); });
      pickedEls = [];
      if (!key) return;
      var els = byKey(key);
      pickedEls = els.slice();
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
        // Si falta el HTML de una sección cambiada (huellas desfasadas), se recarga entera.
        if (changed.some(function (s) { return typeof s.html !== "string"; })) { location.reload(); return; }
        var keep = {};
        segments.forEach(function (s) { keep[s.key] = true; });
        var tmp = document.createElement("div");
        tmp.style.display = "none";
        tmp.innerHTML = changed.map(function (s) { return '<div data-seg="' + s.key.replace(/"/g, "&quot;") + '">' + s.html + "</div>"; }).join("");
        document.body.appendChild(tmp);
        var stage = document.createElement("div");
        stage.style.cssText = "position:absolute;left:-99999px;top:0";
        document.body.appendChild(stage);
        return whenLoaded(tmp).then(function () {
          target = stage;
          return new Promise(function (resolve) { layoutAll(Array.prototype.slice.call(tmp.children), resolve); });
        }).then(function (fresh) {
          target = book;
          hideWindow();
          var bySeg = {};
          pageList.forEach(function (p) { (bySeg[p.dataset.seg] = bySeg[p.dataset.seg] || []).push(p); });
          // El libro nuevo, sección por sección: las cambiadas con sus páginas
          // nuevas, el resto con las que ya tenía. Las quitadas se quedan fuera.
          var next = [];
          segments.forEach(function (sg) {
            (fresh[sg.key] || bySeg[sg.key] || []).forEach(function (p) { next.push(p); });
            hashes[sg.key] = sg.hash;
          });
          Object.keys(hashes).forEach(function (k) { if (!keep[k]) delete hashes[k]; });
          tmp.remove();
          stage.remove();
          var info = finish(next);
          window.__BOOK_READY__ = info;
          var keepPage = Math.min(current, info.pages);
          setWindow(keepPage);
          if (picked) {
            // Si lo que editas quedó en otro pliego (una página añadida), la vista va hasta él.
            var pn = pageOf(byKey(picked)[0]);
            focus(picked, !!pn && spreadStart(pn) !== current);
          }
          var el = all()[keepPage - 1];
          if (el && !picked) el.scrollIntoView({ block: view.zoom ? "start" : "center" });
          report();
          post({ type: "book-patched", pages: info.pages, changed: changed.length, hashes: hashes });
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
      if (!/^(h|d|j|z|\?|ArrowLeft|ArrowRight|Escape)$/i.test(e.key)) return;
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
