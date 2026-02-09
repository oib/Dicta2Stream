// static/auth-ui.js — navigation link and back-button handlers
import { showSection } from './nav.js';

// Data-target navigation (e.g., at #links)
export function initNavLinks() {
  const linksContainer = document.getElementById('links');
  if (!linksContainer) return;
  linksContainer.addEventListener('click', e => {
    const a = e.target.closest('a[data-target]');
    if (!a || !linksContainer.contains(a)) return;
    e.preventDefault();
    const target = a.dataset.target;
    if (target) showSection(target);
    const burger = document.getElementById('burger-toggle');
    if (burger && burger.checked) burger.checked = false;
  });
}

// Back-button navigation
export function initBackButtons() {
  document.querySelectorAll('a[data-back]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const target = btn.dataset.back;
      if (target) showSection(target);
    });
  });
}
