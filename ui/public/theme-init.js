// Applies the saved light/dark theme before first paint (avoids a flash).
// Lives in a same-origin file so the Content-Security-Policy needs no inline hash.
(function () {
  var key = 'kame-ui-theme';
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
})();
