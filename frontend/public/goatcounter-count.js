// Minimal self-hosted GoatCounter-compatible client (no third-party script load, CSP script-src 'self').
// Only sends explicit window.goatcounter.count({path, event}) calls; never auto-tracks page views.
(function () {
  "use strict";
  var el = document.currentScript;
  var endpoint = el && el.getAttribute("data-goatcounter");
  if (!endpoint) return;
  window.goatcounter = window.goatcounter || {};
  window.goatcounter.count = function (vars) {
    if (!vars || typeof vars.path !== "string") return;
    var q = "p=" + encodeURIComponent(vars.path) + (vars.event ? "&e=1" : "") + "&rnd=" + Math.random().toString(36).slice(2);
    var img = new Image();
    img.src = endpoint.replace(/\/count\/?$/, "") + "/count?" + q;
  };
})();
