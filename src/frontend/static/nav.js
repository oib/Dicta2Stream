import { showToast } from "./toast.js";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Determines the correct section to show based on auth status and requested section
function getValidSection(sectionId) {
    const isLoggedIn = !!getCookie('uid');
    const protectedSections = ['me-page', 'account-page'];
    const guestOnlySections = ['login-page', 'register-page', 'magic-login-page'];

    if (isLoggedIn) {
        // If logged in, guest-only sections are invalid, redirect to 'me-page'
        if (guestOnlySections.includes(sectionId)) {
            return 'me-page';
        }
    } else {
        // If not logged in, protected sections are invalid, redirect to 'welcome-page'
        if (protectedSections.includes(sectionId)) {
            return 'welcome-page';
        }
    }
    
    // If the section doesn't exist in the DOM, default to welcome page
    if (!document.getElementById(sectionId)) {
        return 'welcome-page';
    }

    return sectionId;
}

// Main function to show/hide sections
export function showSection(sectionId) {
    const mainSections = Array.from(document.querySelectorAll('main > section'));
    
    // Update body class for page-specific CSS
    document.body.className = document.body.className.replace(/page-\S+/g, '');
    document.body.classList.add(`page-${sectionId || 'welcome-page'}`);

    // Update active state of navigation links
    document.querySelectorAll('.dashboard-nav a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
        }
    });

    mainSections.forEach(section => {
        section.hidden = section.id !== sectionId;
    });

    // Update URL hash without causing a page scroll, this is for direct calls to showSection
    // Normal navigation is handled by the hashchange listener
    const currentHash = `#${sectionId}`;
    if (window.location.hash !== currentHash) {
        if (history.pushState) {
            if (sectionId && sectionId !== 'welcome-page') {
                history.pushState(null, null, currentHash);
            } else {
                history.pushState(null, null, window.location.pathname + window.location.search);
            }
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const isLoggedIn = !!getCookie('uid');
    document.body.classList.toggle('authenticated', isLoggedIn);

    // Unified click handler for SPA navigation
    document.body.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        // Ensure the link is not inside a component that handles its own navigation
        if (!link || link.closest('.no-global-nav')) return;

        e.preventDefault();
        const newHash = link.getAttribute('href');
        if (window.location.hash !== newHash) {
            window.location.hash = newHash;
        }
    });

    // Main routing logic on hash change
    const handleNavigation = () => {
        const sectionId = window.location.hash.substring(1) || 'welcome-page';
        const validSectionId = getValidSection(sectionId);

        if (sectionId !== validSectionId) {
            window.location.hash = validSectionId; // This will re-trigger handleNavigation
        } else {
            showSection(validSectionId);
        }
    };

    window.addEventListener('hashchange', handleNavigation);

    // Initial page load
    handleNavigation();
});
