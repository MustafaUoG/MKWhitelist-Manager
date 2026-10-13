// Loaded in <head>, so the theme is applied before anything is painted.
// The main process passes the saved theme in the page URL (see createWindow in main.js).
(() => {
  const params = new URLSearchParams(window.location.search);
  document.documentElement.dataset.theme = params.get('theme') === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.platform = params.get('platform') ?? '';
})();
