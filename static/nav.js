import { showToast } from "./toast.js";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

document.addEventListener("DOMContentLoaded", () => {
  const Router = {
    sections: Array.from(document.querySelectorAll("main > section")),
    showOnly(id) {
      this.sections.forEach(sec => {
        sec.hidden = sec.id !== id;
        sec.tabIndex = -1;
      });
      // Show user-upload-area only when me-page is shown and user is logged in
      const userUpload = document.getElementById("user-upload-area");
      if (userUpload) {
        const uid = getCookie("uid");
        userUpload.style.display = (id === "me-page" && uid) ? '' : 'none';
      }
      localStorage.setItem("last_page", id);
      const target = document.getElementById(id);
      if (target) target.focus();
    },
    init() {
      initNavLinks();
      initBackButtons();
  
      initStreamLinks();
    }
  };
  const showOnly = Router.showOnly.bind(Router);

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
  Router.init();
});
