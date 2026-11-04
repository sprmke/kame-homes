// Applies the saved light/dark theme before first paint (avoids a flash) and keeps
// the browser/standalone status-bar colour in sync with the app theme.
// Lives in a same-origin file so the Content-Security-Policy needs no inline hash.
(function () {
  var key = 'kame-ui-theme';
  var LIGHT = '#f5f6f8';
  var DARK = '#121212';
  var stored = null;
  try {
    stored = localStorage.getItem(key);
  } catch (e) {
    stored = null;
  }
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark =
    stored === 'dark' || (stored !== 'light' && (stored === 'system' || !stored) && systemDark);
  if (dark) {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.style.colorScheme = 'light';
  }
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? DARK : LIGHT);
})();
