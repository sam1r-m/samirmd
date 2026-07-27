(function () {
  if (
    location.protocol === "file:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"
  ) {
    return;
  }

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

  var route = location.pathname.replace(/\.html$/, "").replace(/\/index$/, "/");
  if (route.length > 1 && route.charAt(route.length - 1) === "/") {
    route = route.slice(0, -1);
  }

  function load(src, dataset) {
    var script = document.createElement("script");
    script.src = src;
    for (var key in dataset) {
      script.dataset[key] = dataset[key];
    }
    document.head.appendChild(script);
  }

  load("/_vercel/insights/script.js");
  load("/_vercel/speed-insights/script.js", { route: route || "/" });
})();
