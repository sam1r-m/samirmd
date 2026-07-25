// Vercel Web Analytics + Speed Insights for a no-build static site.
// The v2 npm packages resolve an obfuscated, ad-blocker-resilient script path
// from a build-time seed. With no build step the first-party /_vercel/* routes
// are the equivalent, and Vercel keeps serving them once each product is
// enabled on the project.

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

  // Speed Insights buckets every metric by route, which it reads from a data
  // attribute on its own script tag. Without it each data point arrives with an
  // empty route and the dashboard has nothing to group pages by. Stripping
  // .html also keeps /film and /film.html from splitting into two routes.
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
