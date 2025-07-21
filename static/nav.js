import { showToast } from "./toast.js";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

document.addEventListener("DOMContentLoaded", () => {
  // Check authentication status
  const isLoggedIn = !!getCookie('uid');
  
  // Update body class for CSS-based visibility
  document.body.classList.toggle('logged-in', isLoggedIn);
  
  // Get all main content sections
  const mainSections = Array.from(document.querySelectorAll('main > section'));
  
  // Show/hide sections with smooth transitions
  const showSection = (sectionId) => {
    // Update body class to indicate current page
    document.body.className = '';
    if (sectionId) {
      document.body.classList.add(`page-${sectionId}`);
    } else {
      document.body.classList.add('page-welcome');
    }
    
    // Update active state of navigation links
    document.querySelectorAll('.dashboard-nav a').forEach(link => {
      link.classList.remove('active');
      if ((!sectionId && link.getAttribute('href') === '#welcome-page') || 
          (sectionId && link.getAttribute('href') === `#${sectionId}`)) {
        link.classList.add('active');
      }
    });
    
    mainSections.forEach(section => {
      // Skip navigation sections
      if (section.id === 'guest-dashboard' || section.id === 'user-dashboard') {
        return;
      }
      
      const isTarget = section.id === sectionId;
      const isLegalPage = ['terms-page', 'privacy-page', 'imprint-page'].includes(sectionId);
      const isWelcomePage = !sectionId || sectionId === 'welcome-page';
      
      if (isTarget || (isLegalPage && section.id === sectionId)) {
        // Show the target section or legal page
        section.classList.add('active');
        section.hidden = false;
        
        // Focus the section for accessibility with a small delay
        // Only focus if the section is focusable and in the viewport
        const focusSection = () => {
          try {
            if (section && typeof section.focus === 'function' && 
                section.offsetParent !== null && // Check if element is visible
                section.getBoundingClientRect().top < window.innerHeight &&
                section.getBoundingClientRect().bottom > 0) {
              section.focus({ preventScroll: true });
            }
          } catch (e) {
            // Silently fail if focusing isn't possible
            if (window.DEBUG_NAV || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
              console.debug('Could not focus section:', e);
            }
          }
        };
        
        // Use requestAnimationFrame for better performance
        requestAnimationFrame(() => {
          // Only set the timeout in debug mode or local development
          if (window.DEBUG_NAV || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            setTimeout(focusSection, 50);
          } else {
            focusSection();
          }
        });
      } else if (isWelcomePage && section.id === 'welcome-page') {
        // Special handling for welcome page
        section.classList.add('active');
        section.hidden = false;
      } else {
        // Hide other sections
        section.classList.remove('active');
        section.hidden = true;
      }
    });
    
    // Update URL hash without page scroll
    if (sectionId && !['terms-page', 'privacy-page', 'imprint-page'].includes(sectionId)) {
      if (sectionId === 'welcome-page') {
        history.replaceState(null, '', window.location.pathname);
      } else {
        history.replaceState(null, '', `#${sectionId}`);
      }
    }
  };
  
  // Handle initial page load
  const getValidSection = (sectionId) => {
    const protectedSections = ['me-page', 'register-page'];
    
    // If not logged in and trying to access protected section
    if (!isLoggedIn && protectedSections.includes(sectionId)) {
      return 'welcome-page';
    }
    
    // If section doesn't exist, default to welcome page
    if (!document.getElementById(sectionId)) {
      return 'welcome-page';
    }
    
    return sectionId;
  };
  
  // Process initial page load
  const initialPage = window.location.hash.substring(1) || 'welcome-page';
  const validSection = getValidSection(initialPage);
  
  // Update URL if needed
  if (validSection !== initialPage) {
    window.location.hash = validSection;
  }
  
  // Show the appropriate section
  showSection(validSection);

  const Router = {
    sections: Array.from(document.querySelectorAll("main > section")),
    
    showOnly(id) {
      // Validate the section ID
      const validId = getValidSection(id);
      
      // Update URL if needed
      if (validId !== id) {
        window.location.hash = validId;
        return;
      }
      
      // Show the requested section
      showSection(validId);
      
      // Handle the quota meter visibility - only show with 'me-page'
      const quotaMeter = document.getElementById('quota-meter');
      if (quotaMeter) {
        quotaMeter.hidden = validId !== 'me-page';
        quotaMeter.tabIndex = validId === 'me-page' ? 0 : -1;
      }
      
      // Update navigation active states
      this.updateActiveNav(validId);
    },
    
    updateActiveNav(activeId) {
      // Update active states for navigation links
      document.querySelectorAll('.dashboard-nav a').forEach(link => {
        const target = link.getAttribute('href').substring(1);
        if (target === activeId) {
          link.setAttribute('aria-current', 'page');
          link.classList.add('active');
        } else {
          link.removeAttribute('aria-current');
          link.classList.remove('active');
        }
      });
    }
  };
  
  // Initialize the router
  const router = Router;
  
  // Handle section visibility based on authentication
  const updateSectionVisibility = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    // Skip navigation sections and quota meter
    if (['guest-dashboard', 'user-dashboard', 'quota-meter'].includes(sectionId)) {
      return;
    }
    
    const currentHash = window.location.hash.substring(1);
    const isLegalPage = ['terms-page', 'privacy-page', 'imprint-page'].includes(sectionId);
    
    // Special handling for legal pages - always show when in hash
    if (isLegalPage) {
      const isActive = sectionId === currentHash;
      section.hidden = !isActive;
      section.tabIndex = isActive ? 0 : -1;
      if (isActive) section.focus();
      return;
    }
    
    // Special handling for me-page - only show to authenticated users
    if (sectionId === 'me-page') {
      section.hidden = !isLoggedIn || currentHash !== 'me-page';
      section.tabIndex = (isLoggedIn && currentHash === 'me-page') ? 0 : -1;
      return;
    }
    
    // Special handling for register page - only show to guests
    if (sectionId === 'register-page') {
      section.hidden = isLoggedIn || currentHash !== 'register-page';
      section.tabIndex = (!isLoggedIn && currentHash === 'register-page') ? 0 : -1;
      return;
    }
    
    // For other sections, show if they match the current section ID
    const isActive = sectionId === currentHash;
    section.hidden = !isActive;
    section.tabIndex = isActive ? 0 : -1;
    
    if (isActive) {
      section.focus();
    }
  };
  
  // Initialize the router
  router.init = function() {
    // Update visibility for all sections
    this.sections.forEach(section => {
      updateSectionVisibility(section.id);
    });
    
    // Show user-upload-area only when me-page is shown and user is logged in
    const userUpload = document.getElementById("user-upload-area");
    if (userUpload) {
      const uid = getCookie("uid");
      userUpload.style.display = (window.location.hash === '#me-page' && uid) ? '' : 'none';
    }
    
    // Store the current page
    localStorage.setItem("last_page", window.location.hash.substring(1));
    
    // Initialize navigation
    initNavLinks();
    initBackButtons();
    initStreamLinks();
    
    // Ensure proper focus management for accessibility
    const currentSection = document.querySelector('main > section:not([hidden])');
    if (currentSection) {
      currentSection.setAttribute('tabindex', '0');
      currentSection.focus();
    }
  };
  
  // Initialize the router
  router.init();
  
  // Handle footer links
  document.querySelectorAll('.footer-links a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.target;
      if (target) {
        // Update URL hash to maintain proper history state
        window.location.hash = target;
        // Use the router to handle the navigation
        if (router && typeof router.showOnly === 'function') {
          router.showOnly(target);
        } else {
          // Fallback to showSection if router is not available
          showSection(target);
        }
      }
    });
  });
  
  // Export the showOnly function for global access
  window.showOnly = router.showOnly.bind(router);
  
  // Make router available globally for debugging
  window.appRouter = router;

  // Highlight active profile link on browser back/forward navigation
  function highlightActiveProfileLink() {
    const params = new URLSearchParams(window.location.search);
    const profileUid = params.get('profile');
    const ul = document.getElementById('stream-list');
    if (!ul) return;
    ul.querySelectorAll('a.profile-link').forEach(link => {
      const url = new URL(link.href, window.location.origin);
      const uidParam = url.searchParams.get('profile');
      link.classList.toggle('active', uidParam === profileUid);
    });
  }
  window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const profileUid = params.get('profile');
    const currentPage = window.location.hash.substring(1) || 'welcome-page';
    
    // Prevent unauthorized access to me-page
    if ((currentPage === 'me-page' || profileUid) && !getCookie('uid')) {
      history.replaceState(null, '', '#welcome-page');
      showOnly('welcome-page');
      return;
    }
    
    if (profileUid) {
      showOnly('me-page');
      if (typeof window.showProfilePlayerFromUrl === 'function') {
        window.showProfilePlayerFromUrl();
      }
    } else {
      highlightActiveProfileLink();
    }
  });

  /* restore last page (unless magic‑link token present) */
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  if (!token) {
    const last = localStorage.getItem("last_page");
    if (last && document.getElementById(last)) {
      showOnly(last);
    } else if (document.getElementById("welcome-page")) {
      // Show Welcome page by default for all new/guest users
      showOnly("welcome-page");
    }
    // Highlight active link on initial load
    highlightActiveProfileLink();
  }

  /* token → show magic‑login page */
  if (token) {
    document.getElementById("magic-token").value = token;
    showOnly("magic-login-page");
    const err = params.get("error");
    if (err) {
      const box = document.getElementById("magic-error");
      box.textContent = decodeURIComponent(err);
      box.style.display = "block";
    }
  }


  function renderStreamList(streams) {
    const ul = document.getElementById("stream-list");
    if (!ul) return;
    if (streams.length) {
      streams.sort();
      ul.innerHTML = streams.map(uid => `
        <li><a href="/?profile=${encodeURIComponent(uid)}" class="profile-link">▶ ${uid}</a></li>
      `).join("");
    } else {
      ul.innerHTML = "<li>No active streams.</li>";
    }
    // Ensure correct link is active after rendering
    highlightActiveProfileLink();
  }

  // Initialize navigation listeners
  function initNavLinks() {
    const navIds = ["links", "user-dashboard", "guest-dashboard"];
    navIds.forEach(id => {
      const nav = document.getElementById(id);
      if (!nav) return;
      nav.addEventListener("click", e => {
        const a = e.target.closest("a[data-target]");
        if (!a || !nav.contains(a)) return;
        e.preventDefault();

        // Save audio state before navigation
        const audio = document.getElementById('me-audio');
        const wasPlaying = audio && !audio.paused;
        const currentTime = audio ? audio.currentTime : 0;
        
        const target = a.dataset.target;
        if (target) showOnly(target);
        
        // Handle stream page specifically
        if (target === "stream-page" && typeof window.maybeLoadStreamsOnShow === "function") {
          window.maybeLoadStreamsOnShow();
        }
        // Handle me-page specifically
        else if (target === "me-page" && audio) {
          // Restore audio state if it was playing
          if (wasPlaying) {
            audio.currentTime = currentTime;
            audio.play().catch(e => console.error('Play failed:', e));
          }
        }
      });
    });

    // Add click handlers for footer links with audio state saving
    document.querySelectorAll(".footer-links a").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const target = link.dataset.target;
        if (!target) return;

        // Save audio state before navigation
        const audio = document.getElementById('me-audio');
        const wasPlaying = audio && !audio.paused;
        const currentTime = audio ? audio.currentTime : 0;

        showOnly(target);

        // Handle me-page specifically
        if (target === "me-page" && audio) {
          // Restore audio state if it was playing
          if (wasPlaying) {
            audio.currentTime = currentTime;
            audio.play().catch(e => console.error('Play failed:', e));
          }
        }
      });
    });
  }
        
  function initBackButtons() {
    document.querySelectorAll('a[data-back]').forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        const target = btn.dataset.back;
        if (target) showOnly(target);
        // Ensure streams load instantly when stream-page is shown
        if (target === "stream-page" && typeof window.maybeLoadStreamsOnShow === "function") {
          window.maybeLoadStreamsOnShow();
        }
      });
    });
  }



  function initStreamLinks() {
    const ul = document.getElementById("stream-list");
    if (!ul) return;
    ul.addEventListener("click", e => {
      const a = e.target.closest("a.profile-link");
      if (!a || !ul.contains(a)) return;
      e.preventDefault();
      const url = new URL(a.href, window.location.origin);
      const profileUid = url.searchParams.get("profile");
      if (profileUid && window.location.search !== `?profile=${encodeURIComponent(profileUid)}`) {
        window.profileNavigationTriggered = true;
        window.history.pushState({}, '', `/?profile=${encodeURIComponent(profileUid)}`);
        window.dispatchEvent(new Event("popstate"));
      }
    });
  }

  // Initialize Router
  document.addEventListener('visibilitychange', () => {
    // Re-check authentication when tab becomes visible again
    if (!document.hidden && window.location.hash === '#me-page' && !getCookie('uid')) {
      window.location.hash = 'welcome-page';
      showOnly('welcome-page');
    }
  });

  Router.init();
});
