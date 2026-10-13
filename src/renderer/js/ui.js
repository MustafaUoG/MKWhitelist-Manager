// Small helpers shared by the rest of the page

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const TOAST_DURATION_MS = 5000;

export function $(selector) {
  return document.querySelector(selector);
}

// Builds <svg class="icon"><use href="#icon-name"></use></svg> from the shapes defined in index.html
export function icon(name) {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.classList.add('icon');
  svg.setAttribute('aria-hidden', 'true');

  const use = document.createElementNS(SVG_NAMESPACE, 'use');
  use.setAttribute('href', `#icon-${name}`);
  svg.append(use);
  return svg;
}

// type is 'success' or 'error'. A new toast replaces the one on screen, so they never stack up.
export function toast(message, type = 'success') {
  const element = document.createElement('div');
  element.className = `toast is-${type}`;
  element.append(icon(type === 'error' ? 'alert' : 'check'), message);
  $('#toasts').replaceChildren(element);

  setTimeout(async () => {
    await element.animate({ opacity: [1, 0] }, { duration: 200 }).finished;
    element.remove();
  }, TOAST_DURATION_MS);
}

// label is what was copied, e.g. "Minecraft UUID"
export async function copyText(text, label) {
  const result = await window.api.copyText(text);
  if (result.ok) {
    toast(`Copied ${label}`);
  } else {
    toast(`Couldn't copy: ${result.error}`, 'error');
  }
}
