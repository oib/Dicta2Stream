// app.js - Main application entry point

import { initPersonalPlayer } from './personal-player.js';

/**
 * Initializes the primary navigation and routing system.
 * This function sets up event listeners for navigation links and handles hash-based routing.
 */
function initNavigation() {
  const navLinks = document.querySelectorAll('nav a, .dashboard-nav a, .footer-links a');

  const handleNavClick = (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    const target = link.getAttribute('data-target');

    if (href && (href.startsWith('http') || href.startsWith('mailto:'))) {
      return; // External link
    }

    e.preventDefault();
    e.stopPropagation();

    let sectionId = target || (href ? href.substring(1) : 'welcome-page');
    if (sectionId === 'me' || sectionId === 'account') {
        sectionId = sectionId + '-page';
    }

    window.location.hash = sectionId;
  };

  const handleHashChange = () => {
    let hash = window.location.hash.substring(1);
    if (!hash || !document.getElementById(hash)) {
      hash = 'welcome-page';
    }

    document.querySelectorAll('main > section').forEach(section => {
      section.classList.remove('active');
    });

    const activeSection = document.getElementById(hash);
    if (activeSection) {
      activeSection.classList.add('active');
    }

    navLinks.forEach(link => {
      const linkTarget = link.getAttribute('data-target') || (link.getAttribute('href') ? link.getAttribute('href').substring(1) : '');
      const isActive = (linkTarget === hash) || (linkTarget === 'me' && hash === 'me-page');
      link.classList.toggle('active', isActive);
    });
  };

  document.body.addEventListener('click', handleNavClick);
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange(); // Initial call
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initPersonalPlayer();
});
