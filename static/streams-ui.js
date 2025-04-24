// static/streams-ui.js — public streams loader and profile-link handling
import { showOnly } from './router.js';

let loadingStreams = false;

export function renderStreamList(streams) {
  const ul = document.getElementById('stream-list');
  if (!ul) return;
  if (streams.length) {
    streams.sort();
    ul.innerHTML = streams
      .map(
        uid => `<li><a href="/?profile=${encodeURIComponent(uid)}" class="profile-link">▶ ${uid}</a></li>`
      )
      .join('');
  } else {
    ul.innerHTML = '<li>No active streams.</li>';
  }
  highlightActiveProfileLink();
}

export function highlightActiveProfileLink() {
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

export function initStreamsLoader() {
  const streamsLink = document.getElementById('show-streams');
  streamsLink?.addEventListener('click', async e => {
    e.preventDefault();
    if (loadingStreams) return;
    loadingStreams = true;
    showOnly('stream-page');
    try {
      const res = await fetch('/streams');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      renderStreamList(data.streams || []);
    } catch {
      const ul = document.getElementById('stream-list');
      if (ul) ul.innerHTML = '<li>Error loading stream list</li>';
    } finally {
      loadingStreams = false;
    }
  });
}

export function initStreamLinks() {
  const ul = document.getElementById('stream-list');
  if (!ul) return;
  ul.addEventListener('click', e => {
    const a = e.target.closest('a.profile-link');
    if (!a || !ul.contains(a)) return;
    e.preventDefault();
    const url = new URL(a.href, window.location.origin);
    const profileUid = url.searchParams.get('profile');
    if (profileUid && window.location.search !== `?profile=${encodeURIComponent(profileUid)}`) {
      window.profileNavigationTriggered = true;
      window.history.pushState({}, '', `/?profile=${encodeURIComponent(profileUid)}`);
      window.dispatchEvent(new Event('popstate'));
    }
  });
}

export function initStreamsUI() {
  initStreamsLoader();
  initStreamLinks();
  window.addEventListener('popstate', highlightActiveProfileLink);
}
