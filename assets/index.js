(function () {
  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var highlights = document.querySelectorAll("span.hl");
  Array.prototype.forEach.call(highlights, function (el) {
    el.addEventListener("click", function () {
      el.classList.toggle("is-lit");
    });
  });

  var name = document.getElementById("name");
  if (name) {
    var FACES = [
      { font: "", track: "-0.025em" },
      { font: 'Georgia, "Times New Roman", Times, serif', track: "-0.012em" },
      {
        font: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        track: "-0.045em",
      },
      {
        font: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
        track: "-0.004em",
      },
      { font: '"Trebuchet MS", "Segoe UI", Tahoma, sans-serif', track: "-0.018em" },
    ];
    var face = 0;

    name.addEventListener("click", function () {
      face = (face + 1) % FACES.length;
      var next = FACES[face];

      if (!reduceMotion.matches) {
        name.style.opacity = "0.4";
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            name.style.opacity = "";
          });
        });
      }

      name.style.fontFamily = next.font;
      name.style.letterSpacing = next.track;
    });
  }

  var button = document.getElementById("theme-toggle");
  if (!button) return;

  var KEY = "samirmd-theme";
  var COLORS = { light: "#f7f4ed", dark: "#0d0c0b" };
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  var meta = document.querySelector('meta[name="theme-color"]');

  function current() {
    var explicit = root.getAttribute("data-theme");
    if (explicit === "light" || explicit === "dark") return explicit;
    return media.matches ? "dark" : "light";
  }

  function sync() {
    var theme = current();
    button.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );
    if (meta) meta.setAttribute("content", COLORS[theme]);
  }

  sync();

  button.addEventListener("click", function () {
    var next = current() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme-changing", "");
    root.setAttribute("data-theme", next);
    sync();
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {}
    window.setTimeout(function () {
      root.removeAttribute("data-theme-changing");
    }, 240);
  });

  if (media.addEventListener) {
    media.addEventListener("change", sync);
  }
})();
