// nav.js — lightweight navigation & magic‑link handling

// fallback toast if app.js not yet loaded
if (typeof window.showToast !== "function") {
  window.showToast = (msg) => alert(msg);
}

document.addEventListener("DOMContentLoaded", () => {
  const Router = {
    sections: Array.from(document.querySelectorAll("main > section")),
    showOnly(id) {
      this.sections.forEach(sec => {
        sec.hidden = sec.id !== id;
        sec.tabIndex = -1;
      });
      localStorage.setItem("last_page", id);
      const target = document.getElementById(id);
      if (target) target.focus();
    },
    init() {
      initNavLinks();
      initBackButtons();
      initStreamsLoader();
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
  window.addEventListener('popstate', highlightActiveProfileLink);

  /* restore last page (unless magic‑link token present) */
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  if (!token) {
    const last = localStorage.getItem("last_page");
    if (last && document.getElementById(last)) showOnly(last);
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

  // Debounce loading and helper for streams list
  let loadingStreams = false;
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
    const linksContainer = document.getElementById("links");
    if (!linksContainer) return;
    linksContainer.addEventListener("click", e => {
      const a = e.target.closest("a[data-target]");
      if (!a || !linksContainer.contains(a)) return;
      e.preventDefault();
      const target = a.dataset.target;
      if (target) showOnly(target);
      const burger = document.getElementById("burger-toggle");
      if (burger && burger.checked) burger.checked = false;
    });
  }

  function initBackButtons() {
    document.querySelectorAll('a[data-back]').forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        const target = btn.dataset.back;
        if (target) showOnly(target);
      });
    });
  }

  function initStreamsLoader() {
    const streamsLink = document.getElementById("show-streams");
    streamsLink?.addEventListener("click", async e => {
      e.preventDefault();
      if (loadingStreams) return;
      loadingStreams = true;
      showOnly("stream-page");
      try {
        const res = await fetch("/streams");
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        renderStreamList(data.streams || []);
      } catch {
        const ul = document.getElementById("stream-list");
        if (ul) ul.innerHTML = "<li>Error loading stream list</li>";
      } finally {
        loadingStreams = false;
      }
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
