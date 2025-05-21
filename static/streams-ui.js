// static/streams-ui.js — public streams loader and profile-link handling
import { showOnly } from './router.js';

// Removed loadingStreams and lastStreamsPageVisible guards for instant fetch


export function initStreamsUI() {
  initStreamLinks();
  window.addEventListener('popstate', () => {
    highlightActiveProfileLink();
    maybeLoadStreamsOnShow();
  });
  document.addEventListener('visibilitychange', maybeLoadStreamsOnShow);
  maybeLoadStreamsOnShow();
}

function maybeLoadStreamsOnShow() {
  // Expose globally for nav.js
  const streamPage = document.getElementById('stream-page');
  const isVisible = streamPage && !streamPage.hidden;
  if (isVisible) {
    loadAndRenderStreams();
  }
}
window.maybeLoadStreamsOnShow = maybeLoadStreamsOnShow;

let currentlyPlayingAudio = null;
let currentlyPlayingButton = null;

document.addEventListener('DOMContentLoaded', initStreamsUI);

function loadAndRenderStreams() {
  const ul = document.getElementById('stream-list');
  if (!ul) {
    console.warn('[streams-ui] #stream-list not found in DOM');
    return;
  }
  console.debug('[streams-ui] loadAndRenderStreams (SSE mode) called');

  ul.innerHTML = '<li>Loading...</li>';
  let gotAny = false;
  let streams = [];
  // Close previous EventSource if any
  if (window._streamsSSE) {
    window._streamsSSE.close();
  }
  const evtSource = new window.EventSource('/streams-sse');
  window._streamsSSE = evtSource;

  evtSource.onmessage = function(event) {
    console.debug('[streams-ui] SSE event received:', event.data);
    try {
      const data = JSON.parse(event.data);
      if (data.end) {
        if (!gotAny) {
          ul.innerHTML = '<li>No active streams.</li>';
        }
        evtSource.close();
        highlightActiveProfileLink();
        return;
      }
      // Remove Loading... on any valid event
      if (!gotAny) {
        ul.innerHTML = '';
        gotAny = true;
      }
      streams.push(data);
      const uid = data.uid || '';
      const sizeMb = data.size ? (data.size / (1024 * 1024)).toFixed(1) : '?';
      const mtime = data.mtime ? new Date(data.mtime * 1000).toISOString().split('T')[0].replace(/-/g, '/') : '';
      const li = document.createElement('li');
      li.innerHTML = `
        <article class="stream-player">
          <h3>${uid}</h3>
          <audio id="audio-${uid}" class="stream-audio" preload="auto" crossOrigin="anonymous" src="/audio/${encodeURIComponent(uid)}/stream.opus"></audio>
          <div class="audio-controls">
            <button id="play-pause-${uid}">▶</button>
          </div>
          <p class="stream-info" style='color:gray;font-size:90%'>[${sizeMb} MB, ${mtime}]</p>
        </article>
      `;
      
      // Add play/pause handler after appending to DOM
      ul.appendChild(li);
      
      // Wait for DOM update
      requestAnimationFrame(() => {
        const playPauseButton = document.getElementById(`play-pause-${uid}`);
        const audio = document.getElementById(`audio-${uid}`);
        
        if (playPauseButton && audio) {
          playPauseButton.addEventListener('click', () => {
            try {
              if (audio.paused) {
                // Stop any currently playing audio first
                if (currentlyPlayingAudio && currentlyPlayingAudio !== audio) {
                  currentlyPlayingAudio.pause();
                  if (currentlyPlayingButton) {
                    currentlyPlayingButton.textContent = '▶';
                  }
                }
                
                // Stop the main player if it's playing
                if (typeof window.stopMainAudio === 'function') {
                  window.stopMainAudio();
                }
                
                audio.play().then(() => {
                  playPauseButton.textContent = '⏸️';
                  currentlyPlayingAudio = audio;
                  currentlyPlayingButton = playPauseButton;
                }).catch(e => {
                  console.error('Play failed:', e);
                  // Reset button if play fails
                  playPauseButton.textContent = '▶';
                  currentlyPlayingAudio = null;
                  currentlyPlayingButton = null;
                });
              } else {
                audio.pause();
                playPauseButton.textContent = '▶';
                if (currentlyPlayingAudio === audio) {
                  currentlyPlayingAudio = null;
                  currentlyPlayingButton = null;
                }
              }
            } catch (e) {
              console.error('Audio error:', e);
              playPauseButton.textContent = '▶';
              if (currentlyPlayingAudio === audio) {
                currentlyPlayingAudio = null;
                currentlyPlayingButton = null;
              }
            }
          });
        }
      });
      
      highlightActiveProfileLink();
      ul.appendChild(li);
      highlightActiveProfileLink();
    } catch (e) {
      // Remove Loading... even if JSON parse fails, to avoid stuck UI
      if (!gotAny) {
        ul.innerHTML = '';
        gotAny = true;
      }
      console.error('[streams-ui] SSE parse error', e, event.data);
    }
  };

  evtSource.onerror = function(err) {
    console.error('[streams-ui] SSE error', err);
    ul.innerHTML = '<li>Error loading stream list</li>';
    if (typeof showToast === 'function') {
      showToast('❌ Error loading public streams.');
    }
    evtSource.close();
    // Add reload button if not present
    const reloadButton = document.getElementById('reload-streams');
    if (!reloadButton) {
      const reloadHtml = '<button id="reload-streams" onclick="loadAndRenderStreams()">Reload</button>';
      ul.insertAdjacentHTML('beforeend', reloadHtml);
    }
  };
}

export function renderStreamList(streams) {
  const ul = document.getElementById('stream-list');
  if (!ul) {
    console.warn('[streams-ui] renderStreamList: #stream-list not found');
    return;
  }
  console.debug('[streams-ui] Rendering stream list:', streams);
  if (Array.isArray(streams)) {
    if (streams.length) {
      // Sort by mtime descending (most recent first)
      streams.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      ul.innerHTML = streams
        .map(stream => {
          const uid = stream.uid || '';
          const sizeKb = stream.size ? (stream.size / 1024).toFixed(1) : '?';
          const mtime = stream.mtime ? new Date(stream.mtime * 1000).toLocaleString() : '';
          return `<li><a href="/?profile=${encodeURIComponent(uid)}" class="profile-link">▶ ${uid}</a> <span style='color:gray;font-size:90%'>[${sizeKb} KB, ${mtime}]</span></li>`;
        })
        .join('');
    } else {
      ul.innerHTML = '<li>No active streams.</li>';
    }
  } else {
    ul.innerHTML = '<li>Error: Invalid stream data.</li>';
    console.error('[streams-ui] renderStreamList: streams is not an array', streams);
  }
  highlightActiveProfileLink();
  console.debug('[streams-ui] renderStreamList complete');
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



export function initStreamLinks() {
  const ul = document.getElementById('stream-list');
  if (!ul) return;
  ul.addEventListener('click', e => {
    const a = e.target.closest('a.profile-link');
    if (!a || !ul.contains(a)) return;
    e.preventDefault();
    const url = new URL(a.href, window.location.origin);
    const profileUid = url.searchParams.get('profile');
    if (profileUid) {
      if (window.location.search !== `?profile=${encodeURIComponent(profileUid)}`) {
        window.profileNavigationTriggered = true;
        window.history.pushState({}, '', `/?profile=${encodeURIComponent(profileUid)}#`);
        window.dispatchEvent(new Event('popstate'));
      } else {
        // If already on this profile, still highlight
        if (typeof window.highlightActiveProfileLink === "function") {
          window.highlightActiveProfileLink();
        }
      }
    }
  });
}
