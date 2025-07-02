// inject-nav.js - Handles dynamic injection and management of navigation elements
import { showOnly } from './router.js';

// Menu state
let isMenuOpen = false;

// Export the injectNavigation function
export function injectNavigation(isAuthenticated = false) {
  console.log('injectNavigation called with isAuthenticated:', isAuthenticated);
  const navContainer = document.getElementById('main-navigation');
  if (!navContainer) {
    console.error('Navigation container not found. Looking for #main-navigation');
    console.log('Available elements with id:', document.querySelectorAll('[id]'));
    return;
  }

  // Clear existing content
  navContainer.innerHTML = '';
  
  console.log('Creating navigation...');
  try {
    // Create the navigation wrapper
    const navWrapper = document.createElement('nav');
    navWrapper.className = 'nav-wrapper';
    
    // Create the navigation content
    const nav = isAuthenticated ? createUserNav() : createGuestNav();
    console.log('Navigation HTML created:', nav.outerHTML);
    
    // Append navigation to wrapper
    navWrapper.appendChild(nav);
    
    // Append to container
    navContainer.appendChild(navWrapper);
    
    console.log('Navigation appended to container');
    
    // Initialize menu toggle after navigation is injected
    setupMenuToggle();
    
    // Set up menu links
    setupMenuLinks();
    
    // Add click handler for the logo to navigate home
    const logo = document.querySelector('.logo');
    if (logo) {
      logo.addEventListener('click', (e) => {
        e.preventDefault();
        showOnly('welcome');
        closeMenu();
      });
    }
  } catch (error) {
    console.error('Error creating navigation:', error);
    return;
  }
  
    // Set up menu toggle for mobile
  setupMenuToggle();
  
  // Set up menu links
  setupMenuLinks();
  
  // Close menu when clicking on a nav link on mobile
  const navLinks = navContainer.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 768) { // Mobile breakpoint
        closeMenu();
      }
    });
  });
  
  // Add click handler for the logo to navigate home
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.addEventListener('click', (e) => {
      e.preventDefault();
      showOnly('welcome');
    });
  }
}

// Function to create the guest navigation
function createGuestNav() {
  const nav = document.createElement('div');
  nav.className = 'dashboard-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');
  
  const navList = document.createElement('ul');
  navList.className = 'nav-list';
  
  const links = [
    { id: 'nav-login', target: 'login', text: 'Login / Register' },
    { id: 'nav-streams', target: 'streams', text: 'Streams' },
    { id: 'nav-welcome', target: 'welcome', text: 'Welcome' }
  ];
  
  // Create and append links
  links.forEach((link) => {
    const li = document.createElement('li');
    li.className = 'nav-item';
    
    const a = document.createElement('a');
    a.id = link.id;
    a.href = `#${link.target}`;
    a.className = 'nav-link';
    a.setAttribute('data-target', link.target);
    a.textContent = link.text;
    
    // Add click handler for navigation
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = e.currentTarget.getAttribute('data-target');
      if (target) {
        window.location.hash = target;
        if (window.router && typeof window.router.showOnly === 'function') {
          window.router.showOnly(target);
        }
        // Close menu on mobile after clicking a link
        if (window.innerWidth < 768) {
          closeMenu();
        }
      }
    });
    
    li.appendChild(a);
    navList.appendChild(li);
  });
  
  nav.appendChild(navList);
  return nav;
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
  links.forEach((link, index) => {
    const li = document.createElement('li');
    li.className = 'nav-item';
    
    const a = document.createElement('a');
    a.id = link.id;
    a.href = '#';
    a.className = 'nav-link';
    
    // Special handling for logout
    if (link.target === 'logout') {
      a.href = '#';
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        closeMenu();
        // Use the handleLogout function from dashboard.js if available
        if (typeof handleLogout === 'function') {
          await handleLogout();
        } else {
          // Fallback in case handleLogout is not available
          localStorage.removeItem('user');
          localStorage.removeItem('uid');
          localStorage.removeItem('uid_time');
          localStorage.removeItem('confirmed_uid');
          document.cookie = 'uid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
          window.location.href = '/';
        }
        window.location.href = '#';
        // Force reload to reset the app state
        window.location.reload();
      });
    } else {
      a.setAttribute('data-target', link.target);
    }
    
    a.textContent = link.text;
    
    li.appendChild(a);
    navList.appendChild(li);
  });
  
  nav.appendChild(navList);
  return nav;
}

// Set up menu toggle functionality
function setupMenuToggle() {
  const menuToggle = document.querySelector('.menu-toggle');
  const navWrapper = document.querySelector('.nav-wrapper');
  
  if (!menuToggle || !navWrapper) return;
  
  menuToggle.addEventListener('click', toggleMenu);
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (isMenuOpen && !navWrapper.contains(e.target) && !menuToggle.contains(e.target)) {
      closeMenu();
    }
  });
  
  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMenuOpen) {
      closeMenu();
    }
  });
  
  // Close menu when resizing to desktop
  let resizeTimer;
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      closeMenu();
    }
  });
}

// Toggle mobile menu
function toggleMenu(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  const navWrapper = document.querySelector('.nav-wrapper');
  const menuToggle = document.querySelector('.menu-toggle');
  
  if (!navWrapper || !menuToggle) return;
  
  isMenuOpen = !isMenuOpen;
  
  if (isMenuOpen) {
    // Open menu
    navWrapper.classList.add('active');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.innerHTML = '✕';
    document.body.style.overflow = 'hidden';
    
    // Focus the first link in the menu for better keyboard navigation
    const firstLink = navWrapper.querySelector('a');
    if (firstLink) firstLink.focus();
    
    // Add click outside handler
    document._handleClickOutside = (e) => {
      if (!navWrapper.contains(e.target) && e.target !== menuToggle) {
        closeMenu();
      }
    };
    document.addEventListener('click', document._handleClickOutside);
    
    // Add escape key handler
    document._handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };
    document.addEventListener('keydown', document._handleEscape);
  } else {
    closeMenu();
  }
}

// Close menu function
function closeMenu() {
  const navWrapper = document.querySelector('.nav-wrapper');
  const menuToggle = document.querySelector('.menu-toggle');
  
  if (!navWrapper || !menuToggle) return;
  
  isMenuOpen = false;
  navWrapper.classList.remove('active');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.innerHTML = '☰';
  document.body.style.overflow = '';
  
  // Remove event listeners
  if (document._handleClickOutside) {
    document.removeEventListener('click', document._handleClickOutside);
    delete document._handleClickOutside;
  }
  
  if (document._handleEscape) {
    document.removeEventListener('keydown', document._handleEscape);
    delete document._handleEscape;
  }
}

// Initialize menu toggle on page load
function initializeMenuToggle() {
  console.log('Initializing menu toggle...');
  const menuToggle = document.getElementById('menu-toggle');
  
  if (!menuToggle) {
    console.error('Main menu toggle button not found!');
    return;
  }
  
  console.log('Menu toggle button found:', menuToggle);
  
  // Remove any existing click listeners
  const newToggle = menuToggle.cloneNode(true);
  if (menuToggle.parentNode) {
    menuToggle.parentNode.replaceChild(newToggle, menuToggle);
    console.log('Replaced menu toggle button');
  } else {
    console.error('Menu toggle has no parent node!');
    return;
  }
  
  // Add click handler to the new toggle
  newToggle.addEventListener('click', function(event) {
    console.log('Menu toggle clicked!', event);
    event.preventDefault();
    event.stopPropagation();
    toggleMenu(event);
    return false;
  });
  
  // Also handle the header menu toggle if it exists
  const headerMenuToggle = document.getElementById('header-menu-toggle');
  if (headerMenuToggle) {
    console.log('Header menu toggle found, syncing with main menu');
    headerMenuToggle.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      newToggle.click(); // Trigger the main menu toggle
      return false;
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');
  
  // Initialize navigation based on authentication state
  // This will be set by the main app after checking auth status
  if (window.initializeNavigation) {
    window.initializeNavigation();
  }
  
  // Initialize menu toggle
  initializeMenuToggle();
  
  // Also try to initialize after a short delay in case the DOM changes
  setTimeout(initializeMenuToggle, 500);
});

// Navigation injection function
export function injectNavigation(isAuthenticated = false) {
  console.log('Injecting navigation, isAuthenticated:', isAuthenticated);
  const container = document.getElementById('main-navigation');
  const navWrapper = document.querySelector('.nav-wrapper');
  
  if (!container || !navWrapper) {
    console.error('Navigation elements not found. Looking for #main-navigation and .nav-wrapper');
    return null;
  }
  
  try {
    // Store scroll position
    const scrollPosition = window.scrollY;
    
    // Clear existing navigation
    container.innerHTML = '';
    
    // Create the appropriate navigation based on authentication status
    const nav = isAuthenticated ? createUserNav() : createGuestNav();
    
    // Append the navigation to the container
    container.appendChild(nav);
    
    // Set up menu toggle functionality
    setupMenuToggle();
    
    // Set up navigation links
    setupMenuLinks();
    
    // Show the appropriate page based on URL
    if (window.location.hash === '#streams' || window.location.pathname === '/streams') {
      showOnly('stream-page');
      if (typeof window.maybeLoadStreamsOnShow === 'function') {
        window.maybeLoadStreamsOnShow();
      }
    } else if (!window.location.hash || window.location.hash === '#') {
      // Show welcome page by default if no hash
      showOnly('welcome-page');
    }
    
    // Restore scroll position
    window.scrollTo(0, scrollPosition);
    
    return nav;
  } catch (error) {
    console.error('Error injecting navigation:', error);
    return null;
  }
}

// Set up menu links with click handlers
function setupMenuLinks() {
  // Handle navigation link clicks
  document.addEventListener('click', function(e) {
    // Check if click is on a nav link or its children
    let link = e.target.closest('.nav-link');
    if (!link) return;
    
    const target = link.getAttribute('data-target');
    if (target) {
      e.preventDefault();
      console.log('Navigation link clicked:', target);
      showOnly(target);
      closeMenu();
      
      // Update active state
      document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('active');
      });
      link.classList.add('active');
    }
  });
}

// Make the function available globally for debugging
window.injectNavigation = injectNavigation;
