/*
 * App init script — externalized so the CSP can drop script-src 'unsafe-inline'.
 *
 *  1. Swaps the preloaded Google Fonts stylesheet from preload → stylesheet
 *     (replaces the previous inline `onload` handler on the <link>).
 *  2. Hides the pre-paint app shell once React renders into #root.
 */
(function () {
  // --- 1. Async font stylesheet swap ----------------------------------------
  var fontLink = document.querySelector('link[rel="preload"][as="style"][data-font-swap]');
  if (fontLink) {
    var swap = function () {
      fontLink.onload = null;
      fontLink.rel = 'stylesheet';
    };
    if (fontLink.sheet) {
      swap();
    } else {
      fontLink.addEventListener('load', swap, { once: true });
    }
  }

  // --- 2. Pre-paint shell hide ----------------------------------------------
  var el = document.getElementById('app-shell');
  if (!el) return;
  var root = document.getElementById('root');
  var hide = function () {
    el.classList.add('hide');
    setTimeout(function () {
      el && el.parentNode && el.parentNode.removeChild(el);
    }, 350);
  };
  var start = Date.now();
  var iv = setInterval(function () {
    if (root && root.firstChild) {
      clearInterval(iv);
      hide();
    } else if (Date.now() - start > 15000) {
      clearInterval(iv);
      hide();
    }
  }, 60);
})();
