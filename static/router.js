// static/router.js — core routing for SPA navigation
export const Router = {
  sections: [],
  // Map URL hashes to section IDs
  sectionMap: {
    'welcome': 'welcome-page',
    'streams': 'stream-page',
    'account': 'register-page',
    'login': 'login-page',
    'me': 'me-page',
    'your-stream': 'me-page'  // Map 'your-stream' to 'me-page'
  },
  
  init() {
    this.sections = Array.from(document.querySelectorAll("main > section"));
    // Set up hash change handler
    window.addEventListener('hashchange', this.handleHashChange.bind(this));
    // Initial route
    this.handleHashChange();
  },
  
  handleHashChange() {
    let hash = window.location.hash.substring(1) || 'welcome';
    
    // First check if the hash matches any direct section ID
    const directSection = this.sections.find(sec => sec.id === hash);
    
    if (directSection) {
      // If it's a direct section ID match, show it directly
      this.showOnly(hash);
    } else {
      // Otherwise, use the section map
      const sectionId = this.sectionMap[hash] || hash;
      this.showOnly(sectionId);
    }
  },
  
  showOnly(id) {
    if (!id) return;
    
    // Update URL hash without triggering hashchange
    if (window.location.hash !== `#${id}`) {
      window.history.pushState(null, '', `#${id}`);
    }
    
    const isAuthenticated = document.body.classList.contains('authenticated');
    const isMePage = id === 'me-page' || id === 'your-stream';
    
    // Helper function to update section visibility
    const updateSection = (sec) => {
      const isTarget = sec.id === id;
      const isGuestOnly = sec.classList.contains('guest-only');
      const isAuthOnly = sec.classList.contains('auth-only');
      const isAlwaysVisible = sec.classList.contains('always-visible');
      const isQuotaMeter = sec.id === 'quota-meter';
      const isUserUploadArea = sec.id === 'user-upload-area';
      const isLogOut = sec.id === 'log-out';
      
      // Determine if section should be visible
      let shouldShow = isTarget;
      
      // Always show sections with always-visible class
      if (isAlwaysVisible) {
        shouldShow = true;
      }
      
      // Handle guest-only sections
      if (isGuestOnly && isAuthenticated) {
        shouldShow = false;
      }
      
      // Handle auth-only sections
      if (isAuthOnly && !isAuthenticated) {
        shouldShow = false;
      }
      
      // Special case for me-page and its children
      const isChildOfMePage = sec.closest('#me-page') !== null;
      const shouldBeActive = isTarget || 
                          (isQuotaMeter && isMePage) || 
                          (isUserUploadArea && isMePage) ||
                          (isLogOut && isMePage) ||
                          (isChildOfMePage && isMePage);
      
      // Update visibility and tab index
      sec.hidden = !shouldShow;
      sec.tabIndex = shouldShow ? 0 : -1;
      
      // Update active state and ARIA attributes
      if (shouldBeActive) {
        sec.setAttribute('aria-current', 'page');
        sec.classList.add('active');
        
        // Ensure target section is visible
        if (sec.hidden) {
          sec.style.display = 'block';
          sec.hidden = false;
        }
        
        // Show all children of the active section
        if (isTarget) {
          sec.focus();
          // Make sure all auth-only children are visible
          const authChildren = sec.querySelectorAll('.auth-only');
          authChildren.forEach(child => {
            if (isAuthenticated) {
              child.style.display = '';
              child.hidden = false;
            }
          });
        }
      } else {
        sec.removeAttribute('aria-current');
        sec.classList.remove('active');
        
        // Reset display property for sections when not active
        if (shouldShow && !isAlwaysVisible) {
          sec.style.display = ''; // Reset to default from CSS
        }
      }
    };
    
    // Update all sections
    this.sections.forEach(updateSection);
    
    // Update active nav links
    document.querySelectorAll('[data-target], [href^="#"]').forEach(link => {
      let target = link.getAttribute('data-target');
      const href = link.getAttribute('href');
      
      // If no data-target, try to get from href
      if (!target && href) {
        // Remove any query parameters and # from the href
        const hash = href.split('?')[0].substring(1);
        // Use mapped section ID or the hash as is
        target = this.sectionMap[hash] || hash;
      }
      
      // Check if this link points to the current section or its mapped equivalent
      const linkId = this.sectionMap[target] || target;
      const currentId = this.sectionMap[id] || id;
      
      if (linkId === currentId) {
        link.setAttribute('aria-current', 'page');
        link.classList.add('active');
      } else {
        link.removeAttribute('aria-current');
        link.classList.remove('active');
      }
    });
    
    // Close mobile menu if open
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle && menuToggle.getAttribute('aria-expanded') === 'true') {
      menuToggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    }
    
    localStorage.setItem("last_page", id);
  }
};

// Initialize router when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  Router.init();
});

export const showOnly = Router.showOnly.bind(Router);
