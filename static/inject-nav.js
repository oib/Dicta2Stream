// inject-nav.js - Handles dynamic injection and management of navigation elements
import { showOnly } from './router.js';

// Function to set up guest navigation links
function setupGuestNav() {
  const guestDashboard = document.getElementById('guest-dashboard');
  if (!guestDashboard) return;
  
  const links = guestDashboard.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('href')?.substring(1); // Remove '#'
      if (target) {
        window.location.hash = target;
        if (window.router && typeof window.router.showOnly === 'function') {
          window.router.showOnly(target);
        }
      }
    });
  });
}

// Function to set up user navigation links
function setupUserNav() {
  const userDashboard = document.getElementById('user-dashboard');
  if (!userDashboard) return;
  
  const links = userDashboard.querySelectorAll('a');
  links.forEach(link => {
    // Handle logout specially
    if (link.getAttribute('href') === '#logout') {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.handleLogout) {
          window.handleLogout();
        }
      });
    } else {
      // Handle regular navigation
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('href')?.substring(1); // Remove '#'
        if (target) {
          window.location.hash = target;
          if (window.router && typeof window.router.showOnly === 'function') {
            window.router.showOnly(target);
          }
        }
      });
    }
  });
}

function createUserNav() {
  const nav = document.createElement('div');
  nav.className = 'dashboard-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'User navigation');
  
  const navList = document.createElement('ul');
  navList.className = 'nav-list';
  
  const links = [
    { id: 'user-stream', target: 'your-stream', text: 'Your Stream' },
    { id: 'nav-streams', target: 'streams', text: 'Streams' },
    { id: 'nav-welcome', target: 'welcome', text: 'Welcome' },
    { id: 'user-logout', target: 'logout', text: 'Logout' }
  ];
  
  // Create and append links
  links.forEach((link) => {
    const li = document.createElement('li');
    li.className = 'nav-item';
    
    const a = document.createElement('a');
    a.id = link.id;
    a.href = '#';
    a.className = 'nav-link';
    a.setAttribute('data-target', link.target);
    a.textContent = link.text;
    
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = e.currentTarget.getAttribute('data-target');
      if (target === 'logout') {
        if (window.handleLogout) {
          window.handleLogout();
        }
      } else if (target) {
        window.location.hash = target;
        if (window.router && typeof window.router.showOnly === 'function') {
          window.router.showOnly(target);
        }
      }
    });
    
    li.appendChild(a);
    navList.appendChild(li);
  });
  
  nav.appendChild(navList);
  return nav;
}

// Navigation injection function
export function injectNavigation(isAuthenticated = false) {
  // Get the appropriate dashboard element based on auth state
  const guestDashboard = document.getElementById('guest-dashboard');
  const userDashboard = document.getElementById('user-dashboard');
  
  if (isAuthenticated) {
    // Show user dashboard, hide guest dashboard
    if (guestDashboard) guestDashboard.style.display = 'none';
    if (userDashboard) userDashboard.style.display = 'block';
    document.body.classList.add('authenticated');
    document.body.classList.remove('guest-mode');
  } else {
    // Show guest dashboard, hide user dashboard
    if (guestDashboard) guestDashboard.style.display = 'block';
    if (userDashboard) userDashboard.style.display = 'none';
    document.body.classList.add('guest-mode');
    document.body.classList.remove('authenticated');
  }
  
  // Set up menu links and active state
  setupMenuLinks();
  updateActiveNav();
  
  return isAuthenticated ? userDashboard : guestDashboard;
}

// Set up menu links with click handlers
function setupMenuLinks() {
  // Set up guest and user navigation links
  setupGuestNav();
  setupUserNav();
  
  // Handle hash changes for SPA navigation
  window.addEventListener('hashchange', updateActiveNav);
}

// Update active navigation link
function updateActiveNav() {
  const currentHash = window.location.hash.substring(1) || 'welcome';
  
  // Remove active class from all links in both dashboards
  document.querySelectorAll('#guest-dashboard a, #user-dashboard a').forEach(link => {
    link.classList.remove('active');
    // Check if this link's href matches the current hash
    const linkTarget = link.getAttribute('href')?.substring(1); // Remove '#'
    if (linkTarget === currentHash) {
      link.classList.add('active');
    }
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication state and initialize navigation
  const isAuthenticated = document.cookie.includes('sessionid=') || 
                         localStorage.getItem('isAuthenticated') === 'true';
  
  // Initialize navigation based on authentication state
  injectNavigation(isAuthenticated);
  
  // Set up menu links and active navigation
  setupMenuLinks();
  updateActiveNav();
  
  // Update body classes based on authentication state
  if (isAuthenticated) {
    document.body.classList.add('authenticated');
    document.body.classList.remove('guest-mode');
  } else {
    document.body.classList.add('guest-mode');
    document.body.classList.remove('authenticated');
  }
  
  console.log('[NAV] Navigation initialized', { isAuthenticated });
});

// Make the function available globally for debugging
window.injectNavigation = injectNavigation;
