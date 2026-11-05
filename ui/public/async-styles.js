// Turns `<link rel="preload" as="style" data-async-style>` into a stylesheet once it loads,
// so the font CSS never blocks first paint. Replaces an inline onload handler (CSP).
(function () {
  var links = document.querySelectorAll('link[rel="preload"][as="style"][data-async-style]');
  for (var i = 0; i < links.length; i += 1) {
    (function (link) {
      var swap = function () {
        link.rel = 'stylesheet';
      };
      link.addEventListener('load', swap, { once: true });
      window.addEventListener('load', swap, { once: true });
    })(links[i]);
  }
})();
