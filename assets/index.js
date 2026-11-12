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

  var drops = document.querySelectorAll(".row-drop details");
  Array.prototype.forEach.call(drops, function (details) {
    var summary = details.querySelector("summary");
    var panel = details.querySelector(".roles");
    if (!summary || !panel) return;

    summary.addEventListener("click", function (event) {
      event.preventDefault();
      if (panel.dataset.animating === "1") return;

      var styles = getComputedStyle(document.documentElement);
      var padTop = styles.getPropertyValue("--s5").trim() || "1rem";
      var padBottom = styles.getPropertyValue("--s1").trim() || "0.25rem";

      if (reduceMotion.matches) {
        details.open = !details.open;
        panel.classList.toggle("is-instant", details.open);
        panel.classList.toggle("is-settled", details.open);
        panel.style.height = "";
        panel.style.opacity = "";
        panel.style.paddingTop = "";
        panel.style.paddingBottom = "";
        return;
      }

      function settle(opening) {
        panel.style.height = "";
        panel.style.opacity = "";
        panel.style.paddingTop = "";
        panel.style.paddingBottom = "";
        panel.dataset.animating = "";
        panel.classList.toggle("is-settled", opening);
      }

      function watchHeight(opening) {
        function onEnd(endEvent) {
          if (endEvent.target !== panel || endEvent.propertyName !== "height") return;
          panel.removeEventListener("transitionend", onEnd);
          if (!opening) details.open = false;
          settle(opening);
        }
        panel.addEventListener("transitionend", onEnd);
      }

      if (details.open) {
        panel.classList.remove("is-settled");
        panel.style.paddingTop = padTop;
        panel.style.paddingBottom = padBottom;
        panel.style.height = "auto";
        panel.style.opacity = "1";
        var full = panel.scrollHeight;
        panel.style.height = full + "px";
        panel.dataset.animating = "1";
        panel.offsetHeight;
        window.requestAnimationFrame(function () {
          panel.style.height = "0px";
          panel.style.opacity = "0";
          panel.style.paddingTop = "0px";
          panel.style.paddingBottom = "0px";
        });
        watchHeight(false);
        return;
      }

      details.open = true;
      panel.classList.remove("is-settled");
      panel.style.height = "auto";
      panel.style.paddingTop = padTop;
      panel.style.paddingBottom = padBottom;
      panel.style.opacity = "0";
      var target = panel.scrollHeight;
      panel.style.height = "0px";
      panel.style.paddingTop = "0px";
      panel.style.paddingBottom = "0px";
      panel.dataset.animating = "1";
      panel.offsetHeight;
      window.requestAnimationFrame(function () {
        panel.style.height = target + "px";
        panel.style.opacity = "1";
        panel.style.paddingTop = padTop;
        panel.style.paddingBottom = padBottom;
      });
      watchHeight(true);
    });
  });

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
