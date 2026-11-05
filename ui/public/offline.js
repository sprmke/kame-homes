// Offline fallback page behaviour. Loaded as a same-origin file (the CSP is
// `script-src 'self'`, so inline handlers are not allowed).
(function () {
  var retry = document.getElementById('retry');
  if (retry) {
    retry.addEventListener('click', function () {
      window.location.reload();
    });
  }
  window.addEventListener('online', function () {
    window.location.reload();
  });
})();
