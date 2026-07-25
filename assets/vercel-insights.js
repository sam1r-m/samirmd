window.va =
  window.va ||
  function () {
    (window.vaq = window.vaq || []).push(arguments);
  };

window.si =
  window.si ||
  function () {
    (window.siq = window.siq || []).push(arguments);
  };

["/_vercel/insights/script.js", "/_vercel/speed-insights/script.js"].forEach(
  function (src) {
    var script = document.createElement("script");
    script.defer = true;
    script.src = src;
    document.head.appendChild(script);
  }
);

document.addEventListener("click", function (event) {
  var target = event.target;
  if (!target || !target.closest) return;

  var link = target.closest("[data-analytics-event]");
  if (!link || typeof window.va !== "function") return;

  window.va("event", {
    name: link.dataset.analyticsEvent,
    data: {
      label: link.dataset.analyticsLabel || link.textContent.trim(),
      href: link.href,
    },
  });
});
