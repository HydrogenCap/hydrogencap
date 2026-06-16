/*
 * Service worker registration — externalized for strict CSP (no script-src 'unsafe-inline').
 * Skips registration inside iframes and Lovable preview hosts; unregisters stale workers there.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  var inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch (e) {
    inIframe = true;
  }
  var host = window.location.hostname;
  var isPreview =
    host.indexOf('id-preview--') !== -1 ||
    host.indexOf('lovableproject.com') !== -1 ||
    host.indexOf('lovable.app') !== -1;
  if (inIframe || isPreview) {
    navigator.serviceWorker
      .getRegistrations()
      .then(function (regs) {
        regs.forEach(function (r) {
          r.unregister();
        });
      })
      .catch(function () {});
    return;
  }
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
  });
})();
