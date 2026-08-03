(function () {
  var gallery = document.querySelector(".photo-gallery");
  var figures = Array.prototype.slice.call(
    document.querySelectorAll(".photo-figure")
  );
  if (!gallery || !figures.length) return;

  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightbox-image");
  var lightboxCaption = document.getElementById("lightbox-caption");
  var btnClose = document.getElementById("lightbox-close");
  var btnPrev = document.getElementById("lightbox-prev");
  var btnNext = document.getElementById("lightbox-next");
  var activeIndex = -1;
  var lastFocus = null;
  var resizeTimer = null;
  var reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var VIEW_KEY = "samirmd-photo-view";
  var SORT_KEY = "samirmd-photo-sort";
  var VIEWS = ["masonry", "grid"];
  var SORTS = ["newest", "oldest", "shuffle"];

  function columnCount() {
    var width = window.innerWidth;
    if (width >= 1024) return 3;
    if (width >= 640) return 2;
    return 1;
  }

  function estimateFigureHeight(fig) {
    var img = fig.querySelector("img");
    var w = img ? Number(img.getAttribute("width")) || 0 : 0;
    var h = img ? Number(img.getAttribute("height")) || 0 : 0;
    var ratio = w > 0 && h > 0 ? h / w : 0.75;
    var caption = fig.querySelector(".photo-caption");
    var captionH = caption ? 56 : 0;
    return ratio * 1000 + captionH;
  }

  function applyLayout() {
    var view = document.body.getAttribute("data-view");
    var cols = gallery.querySelectorAll(".photo-col");
    Array.prototype.forEach.call(cols, function (col) {
      col.parentNode && col.parentNode.removeChild(col);
    });

    if (view !== "masonry") {
      figures.forEach(function (fig) {
        gallery.appendChild(fig);
      });
      return;
    }

    var n = columnCount();
    var buckets = [];
    var heights = [];
    for (var i = 0; i < n; i += 1) {
      var col = document.createElement("div");
      col.className = "photo-col";
      gallery.appendChild(col);
      buckets.push(col);
      heights.push(0);
    }

    var gap = 24;
    figures.forEach(function (fig) {
      var shortest = 0;
      for (var c = 1; c < n; c += 1) {
        if (heights[c] < heights[shortest]) shortest = c;
      }
      buckets[shortest].appendChild(fig);
      heights[shortest] += estimateFigureHeight(fig) + gap;
    });
  }

  function setView(view) {
    if (view === "sheet" || view === "fill") view = "masonry";
    if (VIEWS.indexOf(view) === -1) view = "masonry";
    document.body.setAttribute("data-view", view);
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch (e) {}
    var buttons = document.querySelectorAll(".view-toggle [data-view]");
    Array.prototype.forEach.call(buttons, function (btn) {
      var on = btn.getAttribute("data-view") === view;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    applyLayout();
  }

  var savedView = "masonry";
  try {
    savedView = localStorage.getItem(VIEW_KEY) || "masonry";
  } catch (e) {}
  setView(savedView);

  var toggle = document.querySelector(".view-toggle");
  if (toggle) {
    toggle.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-view]");
      if (!btn || !toggle.contains(btn)) return;
      setView(btn.getAttribute("data-view"));
    });
  }

  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(applyLayout, 120);
  });

  function takenValue(figure) {
    return figure.getAttribute("data-taken") || "";
  }

  function compareTaken(a, b) {
    var da = takenValue(a);
    var db = takenValue(b);
    if (da && db && da !== db) return da < db ? -1 : 1;
    if (da && !db) return -1;
    if (!da && db) return 1;
    var sa = a.querySelector("img");
    var sb = b.querySelector("img");
    var ia = sa ? sa.getAttribute("src") || "" : "";
    var ib = sb ? sb.getAttribute("src") || "" : "";
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  }

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function bindFigureClicks() {
    figures.forEach(function (figure, index) {
      var button = figure.querySelector(".photo-button");
      if (!button) return;
      button.onclick = function () {
        openAt(index);
      };
    });
  }

  function applyOrder(ordered) {
    figures = ordered;
    applyLayout();
    bindFigureClicks();
  }

  function setSort(mode) {
    if (SORTS.indexOf(mode) === -1) mode = "newest";
    try {
      localStorage.setItem(SORT_KEY, mode);
    } catch (e) {}

    var buttons = document.querySelectorAll(".sort-toggle [data-sort]");
    Array.prototype.forEach.call(buttons, function (btn) {
      var on = btn.getAttribute("data-sort") === mode;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });

    var ordered;
    if (mode === "oldest") {
      ordered = figures.slice().sort(compareTaken);
    } else if (mode === "shuffle") {
      ordered = shuffle(figures);
    } else {
      ordered = figures.slice().sort(function (a, b) {
        return compareTaken(b, a);
      });
    }
    applyOrder(ordered);
  }

  var savedSort = "newest";
  try {
    savedSort = localStorage.getItem(SORT_KEY) || "newest";
  } catch (e) {}
  setSort(savedSort);

  var sortToggle = document.querySelector(".sort-toggle");
  if (sortToggle) {
    sortToggle.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-sort]");
      if (!btn || !sortToggle.contains(btn)) return;
      setSort(btn.getAttribute("data-sort"));
    });
  }

  function whenImageReady(img, done) {
    if (!img) {
      done();
      return;
    }
    var finish = function () {
      if (img.decode) {
        img.decode().then(done, done);
      } else {
        done();
      }
    };
    if (img.complete && img.naturalWidth > 0) {
      finish();
      return;
    }
    var onLoad = function () {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
      finish();
    };
    var onError = function () {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
      done();
    };
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
  }

  function revealFigure(fig, delay) {
    if (fig.classList.contains("is-visible")) return;
    window.setTimeout(function () {
      fig.classList.add("is-visible");
    }, delay || 0);
  }

  function watchReveals() {
    figures.forEach(function (fig, i) {
      var img = fig.querySelector("img");
      var delay = reduceMotion ? 0 : Math.min(i % 4, 3) * 60;
      var imageReady = false;
      var inView = reduceMotion || !("IntersectionObserver" in window);

      var tryReveal = function () {
        if (imageReady && inView) revealFigure(fig, delay);
      };

      whenImageReady(img, function () {
        imageReady = true;
        tryReveal();
      });

      if (!inView) {
        var reveal = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              inView = true;
              tryReveal();
              reveal.unobserve(entry.target);
            });
          },
          { rootMargin: "12% 0px", threshold: 0.01 }
        );
        reveal.observe(fig);
      } else {
        tryReveal();
      }
    });
  }

  watchReveals();

  function captionHtml(figure) {
    var cap = figure.querySelector(".photo-caption");
    return cap ? cap.innerHTML : "";
  }

  function openAt(index) {
    if (index < 0 || index >= figures.length) return;
    var figure = figures[index];
    var img = figure.querySelector("img");
    if (!img) return;

    activeIndex = index;
    lastFocus = document.activeElement;
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt || "";
    lightboxCaption.innerHTML = captionHtml(figure);
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    btnClose.focus();
  }

  function close() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    activeIndex = -1;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function step(delta) {
    if (activeIndex < 0) return;
    var next = (activeIndex + delta + figures.length) % figures.length;
    openAt(next);
  }

  bindFigureClicks();

  btnClose.addEventListener("click", close);
  btnPrev.addEventListener("click", function () {
    step(-1);
  });
  btnNext.addEventListener("click", function () {
    step(1);
  });

  lightbox.addEventListener("click", function (event) {
    if (event.target === lightbox) close();
  });

  document.addEventListener("keydown", function (event) {
    if (!lightbox.classList.contains("is-open")) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  });
})();
