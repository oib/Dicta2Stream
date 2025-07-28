// static/streams-ui.js — public streams loader and profile-link handling

import { globalAudioManager } from './global-audio-manager.js';

// Global variable to track if we should force refresh the stream list
let shouldForceRefresh = false;

// Function to refresh the stream list
window.refreshStreamList = function(force = true) {
  shouldForceRefresh = force;
  loadAndRenderStreams();
  return new Promise((resolve) => {
    // Resolve after a short delay to allow the stream list to update
    setTimeout(resolve, 500);
  });
};

// Removed loadingStreams and lastStreamsPageVisible guards for instant fetch

export function initStreamsUI() {
  initStreamLinks();
  window.addEventListener('popstate', () => {
    highlightActiveProfileLink();
    maybeLoadStreamsOnShow();
  });
  document.addEventListener('visibilitychange', maybeLoadStreamsOnShow);
  maybeLoadStreamsOnShow();
  
  // Register with global audio manager to handle stop requests from other players
  globalAudioManager.addListener('streams', () => {
    console.log('[streams-ui] Received stop request from global audio manager');
    stopPlayback();
  });
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

// Global variables for audio control
let currentlyPlayingAudio = null;

// Global variable to track the active SSE connection
let activeSSEConnection = null;

// Global cleanup function for SSE connections
const cleanupConnections = () => {
  if (window._streamsSSE) {
    if (window._streamsSSE.abort) {
      window._streamsSSE.abort();
    }
    window._streamsSSE = null;
  }
  
  if (window.connectionTimeout) {
    clearTimeout(window.connectionTimeout);
    window.connectionTimeout = null;
  }
  
  activeSSEConnection = null;
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initStreamsUI();
  
  // Also try to load streams immediately in case the page is already loaded
  setTimeout(() => {
    loadAndRenderStreams();
  }, 100);
});

function loadAndRenderStreams() {
  const ul = document.getElementById('stream-list');
  if (!ul) {
    console.error('[STREAMS-UI] Stream list element not found');
    return;
  }
  console.log('[STREAMS-UI] loadAndRenderStreams called, shouldForceRefresh:', shouldForceRefresh);
  
  // Don't start a new connection if one is already active and we're not forcing a refresh
  if (activeSSEConnection && !shouldForceRefresh) {
    return;
  }
  
  // If we're forcing a refresh, clean up the existing connection
  if (shouldForceRefresh && activeSSEConnection) {
    // Clean up any existing connections
    cleanupConnections();
    shouldForceRefresh = false; // Reset the flag after handling
  }
  
  // Clear any existing error messages or retry buttons
  ul.innerHTML = '<li>Loading public streams...</li>';
  
  // Add a timestamp to prevent caching issues
  const timestamp = new Date().getTime();
  
  // Use the same protocol as the current page to avoid mixed content issues
  const baseUrl = window.location.origin;
  const sseUrl = `${baseUrl}/streams-sse?t=${timestamp}`;
  
  let gotAny = false;
  let streams = [];
  window.connectionTimeout = null;
  
  // Clean up any existing connections
  cleanupConnections();
  
  // Reset the retry count if we have a successful connection
  window.streamRetryCount = 0;
  
  if (window.connectionTimeout) {
    clearTimeout(window.connectionTimeout);
    window.connectionTimeout = null;
  }
  
  // Use fetch with ReadableStream for better CORS handling
  const controller = new AbortController();
  const signal = controller.signal;
  
  // Store the controller for cleanup
  window._streamsSSE = controller;
  
  // Track the active connection
  activeSSEConnection = controller;
  
  // Set a connection timeout with debug info
  const connectionStartTime = Date.now();
  const connectionTimeoutId = setTimeout(() => {
    if (!gotAny) {
      // Only log in development (localhost) or if explicitly enabled
      const isLocalDevelopment = window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1';
      if (isLocalDevelopment || window.DEBUG_STREAMS) {
        const duration = Date.now() - connectionStartTime;
        console.group('[streams-ui] Connection timeout reached');
        console.log(`Duration: ${duration}ms`);
        console.log('Current time:', new Date().toISOString());
        console.log('Streams received:', streams.length);
        console.log('Active intervals:', window.activeIntervals ? window.activeIntervals.size : 'N/A');
        console.log('Active timeouts:', window.activeTimeouts ? window.activeTimeouts.size : 'N/A');
        console.groupEnd();
      }
      
      // Clean up and retry with backoff
      controller.abort();
      
      // Only retry if we haven't exceeded max retries
      const retryCount = window.streamRetryCount || 0;
      if (retryCount < 3) { // Max 3 retries
        window.streamRetryCount = retryCount + 1;
        const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
        setTimeout(loadAndRenderStreams, backoffTime);
      }
    }
  }, 15000); // 15 second timeout (increased from 10s)
  
  // Store the timeout ID for cleanup
  window.connectionTimeout = connectionTimeoutId;
  
  // Make the fetch request with proper error handling
  fetch(sseUrl, {
    method: 'GET',
    headers: {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
    credentials: 'same-origin',
    signal: signal,
    mode: 'cors',
    redirect: 'follow'
  })
  .then(response => {    
    if (!response.ok) {
      // Try to get the response text for error details
      return response.text().then(text => {
        const error = new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
        error.response = { status: response.status, statusText: response.statusText, body: text };
        throw error;
      }).catch(() => {
        const error = new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
        error.response = { status: response.status, statusText: response.statusText };
        throw error;
      });
    }
    
    if (!response.body) {
      throw new Error('Response body is null or undefined');
    }
    
    // Get the readable stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    // Process the stream
    function processStream({ done, value }) {
      console.log('[STREAMS-UI] processStream called with done:', done);
      if (done) {
        console.log('[STREAMS-UI] Stream processing complete');
        // Process any remaining data in the buffer
        if (buffer.trim()) {
          console.log('[STREAMS-UI] Processing remaining buffer data');
          try {
            const data = JSON.parse(buffer);
            console.log('[STREAMS-UI] Parsed data from buffer:', data);
            processSSEEvent(data);
          } catch (e) {
            console.error('[STREAMS-UI] Error parsing buffer data:', e);
          }
        }
        return;
      }
      
      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete events in the buffer
      const events = buffer.split('\n\n');
      buffer = events.pop() || ''; // Keep incomplete event in buffer
      
      for (const event of events) {
        if (!event.trim()) continue;
        
        // Extract data field from SSE format
        const dataMatch = event.match(/^data: (\{.*\})$/m);
        if (dataMatch && dataMatch[1]) {
          try {
            const data = JSON.parse(dataMatch[1]);
            processSSEEvent(data);
          } catch (e) {
            console.error('[streams-ui] Error parsing event data:', e, 'Event:', event);
          }
        }
      }
      
      // Read the next chunk
      return reader.read().then(processStream);
    }
    
    // Start reading the stream
    return reader.read().then(processStream);
  })
  .catch(error => {
    // Only handle the error if it's not an abort error
    if (error.name !== 'AbortError') {
      // Clean up the controller reference
      window._streamsSSE = null;
      activeSSEConnection = null;
      
      // Clear the connection timeout
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      
      // Show a user-friendly error message
      const ul = document.getElementById('stream-list');
      if (ul) {
        let errorMessage = 'Error loading streams. ';
      
        if (error.message && error.message.includes('Failed to fetch')) {
          errorMessage += 'Unable to connect to the server. Please check your internet connection.';
        } else if (error.message && error.message.includes('CORS')) {
          errorMessage += 'A server configuration issue occurred. Please try again later.';
        } else {
          errorMessage += 'Please try again later.';
        }
        
        ul.innerHTML = `
          <li class="error">
            <p>${errorMessage}</p>
            <button id="retry-loading" class="retry-button">
              <span class="retry-icon">↻</span> Try Again
            </button>
          </li>
        `;
        
        // Add retry handler
        const retryButton = document.getElementById('retry-loading');
        if (retryButton) {
          retryButton.addEventListener('click', () => {
            ul.innerHTML = '<li>Loading streams...</li>';
            loadAndRenderStreams();
          });
        }
      }
    }
  });
  
  // Function to process SSE events
  function processSSEEvent(data) {
    console.log('[STREAMS-UI] Processing SSE event:', data);
    if (data.end) {
      if (streams.length === 0) {
        ul.innerHTML = '<li>No active streams.</li>';
        return;
      }
      
      // Sort streams by mtime in descending order (newest first)
      streams.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      
      // Clear the list
      ul.innerHTML = '';
      
      // Render each stream in sorted order
      streams.forEach((stream, index) => {
        const uid = stream.uid || `stream-${index}`;
        const username = stream.username || 'Unknown User';
        const sizeMb = stream.size ? (stream.size / (1024 * 1024)).toFixed(1) : '?';
        const mtime = stream.mtime ? new Date(stream.mtime * 1000).toISOString().split('T')[0].replace(/-/g, '/') : '';
        
        const li = document.createElement('li');
        li.className = 'stream-item';
        
        try {
          li.innerHTML = `
            <article class="stream-player" data-uid="${escapeHtml(uid)}">
              <h3>${escapeHtml(username)}</h3>
              <div class="audio-controls">
                <button class="play-pause-btn" data-uid="${escapeHtml(uid)}" aria-label="Play">▶️</button>
              </div>
              <p class="stream-info" style='color:var(--text-muted);font-size:90%'>[${sizeMb} MB, ${mtime}]</p>
            </article>
          `;
          ul.appendChild(li);
        } catch (error) {
          const errorLi = document.createElement('li');
          errorLi.textContent = `Error loading stream: ${uid}`;
          errorLi.style.color = 'var(--error)';
          ul.appendChild(errorLi);
        }
      });
      
      highlightActiveProfileLink();
      return;
    }
    
    // Add stream to our collection
    streams.push(data);
    
    // If this is the first stream, clear the loading message
    if (!gotAny) {
      ul.innerHTML = '';
      gotAny = true;
    }
  }
  
  // Function to handle SSE errors
  function handleSSEError(error) {
    console.error('[streams-ui] SSE error:', error);
    
    // Only show error if we haven't already loaded any streams
    if (streams.length === 0) {
      const errorMsg = 'Error connecting to stream server. Please try again.';
      
      ul.innerHTML = `
        <li>${errorMsg}</li>
        <li><button id="reload-streams" onclick="loadAndRenderStreams()" class="retry-button">🔄 Retry</button></li>
      `;
      
      if (typeof showToast === 'function') {
        showToast('❌ ' + errorMsg);
      }
      
      // Auto-retry after 5 seconds
      setTimeout(() => {
        loadAndRenderStreams();
      }, 5000);
    }
  }

  // Error and open handlers are now part of the fetch implementation
  // Message handling is now part of the fetch implementation
  // Error handling is now part of the fetch implementation
}

export function renderStreamList(streams) {
  const ul = document.getElementById('stream-list');
  if (!ul) {
    console.warn('[STREAMS-UI] renderStreamList: #stream-list not found');
    return;
  }
  console.log('[STREAMS-UI] Rendering stream list with', streams.length, 'streams');
  console.debug('[STREAMS-UI] Streams data:', streams);
  if (Array.isArray(streams)) {
    if (streams.length) {
      // Sort by mtime descending (most recent first)
      streams.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      ul.innerHTML = streams
        .map(stream => {
          const uid = stream.uid || '';
          const username = stream.username || 'Unknown User';
          const sizeKb = stream.size ? (stream.size / 1024).toFixed(1) : '?';
          const mtime = stream.mtime ? new Date(stream.mtime * 1000).toLocaleString() : '';
          return `<li><a href="/?profile=${encodeURIComponent(uid)}" class="profile-link">▶ ${escapeHtml(username)}</a> <span style='color:var(--text-muted);font-size:90%'>[${sizeKb} KB, ${mtime}]</span></li>`;
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

// Helper function to safely escape HTML
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Function to update play/pause button state
function updatePlayPauseButton(button, isPlaying) {
  if (!button) return;
  button.textContent = isPlaying ? '⏸️' : '▶️';
  button.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
}

// Audio context for Web Audio API
let audioContext = null;
let audioSource = null;
let audioBuffer = null;
let isPlaying = false;
let currentUid = null;
let currentlyPlayingButton = null; // Controls the currently active play/pause button
let startTime = 0;
let pauseTime = 0;
let audioStartTime = 0;
let audioElement = null; // HTML5 Audio element for Opus playback

// Initialize audio context
function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// Stop current playback completely
function stopPlayback() {
  console.log('[streams-ui] Stopping playback');
  
  // Stop Web Audio API if active
  if (audioSource) {
    try {
      // Don't try to stop if already stopped
      if (audioSource.context && audioSource.context.state !== 'closed') {
        audioSource.stop();
        audioSource.disconnect();
      }
    } catch (e) {
      // Ignore errors when stopping already stopped sources
      if (!e.message.includes('has already been stopped') && 
          !e.message.includes('has already finished playing')) {
        console.warn('Error stopping audio source:', e);
      }
    }
    audioSource = null;
  }
  
  // Stop HTML5 Audio element if active
  if (audioElement) {
    try {
      // Remove all event listeners first
      if (audioElement._eventHandlers) {
        const { onPlay, onPause, onEnded, onError } = audioElement._eventHandlers;
        if (onPlay) audioElement.removeEventListener('play', onPlay);
        if (onPause) audioElement.removeEventListener('pause', onPause);
        if (onEnded) audioElement.removeEventListener('ended', onEnded);
        if (onError) audioElement.removeEventListener('error', onError);
      }
      
      // Pause and reset the audio element
      audioElement.pause();
      audioElement.removeAttribute('src');
      audioElement.load();
      
      // Clear references
      if (audioElement._eventHandlers) {
        delete audioElement._eventHandlers;
      }
      
      // Nullify the element to allow garbage collection
      audioElement = null;
    } catch (e) {
      console.warn('Error cleaning up audio element:', e);
    }
  }
  
  // Reset state
  audioBuffer = null;
  isPlaying = false;
  startTime = 0;
  pauseTime = 0;
  audioStartTime = 0;
  
  // Notify global audio manager that streams player has stopped
  globalAudioManager.stopPlayback('streams');
  
  // Update UI
  if (currentlyPlayingButton) {
    updatePlayPauseButton(currentlyPlayingButton, false);
    currentlyPlayingButton = null;
  }
  
  // Clear current playing reference
  currentlyPlayingAudio = null;
}

// Load and play audio using HTML5 Audio element for Opus
async function loadAndPlayAudio(uid, playPauseBtn) {
  // If we already have an audio element for this UID and it's paused, just resume it
  if (audioElement && currentUid === uid && audioElement.paused) {
    try {
      await audioElement.play();
      isPlaying = true;
      updatePlayPauseButton(playPauseBtn, true);
      return;
    } catch (error) {
      // Fall through to reload if resume fails
    }
  }
  
  // Stop any current playback
  stopPlayback();
  
  // Notify global audio manager that streams player is starting
  globalAudioManager.startPlayback('streams', uid);
  
  // Update UI
  updatePlayPauseButton(playPauseBtn, true);
  currentlyPlayingButton = playPauseBtn;
  currentUid = uid;
  
  try {
    // Create a new audio element with the correct MIME type
    const audioUrl = `/audio/${encodeURIComponent(uid)}/stream.opus`;
    
    // Create a new audio element with a small delay to prevent race conditions
    await new Promise(resolve => setTimeout(resolve, 50));
    
    audioElement = new Audio(audioUrl);
    audioElement.preload = 'auto';
    audioElement.crossOrigin = 'anonymous'; // Important for CORS
    
    // Set up event handlers with proper binding
    const onPlay = () => {
      isPlaying = true;
      updatePlayPauseButton(playPauseBtn, true);
    };
    
    const onPause = () => {
      isPlaying = false;
      updatePlayPauseButton(playPauseBtn, false);
    };
    
    const onEnded = () => {
      isPlaying = false;
      cleanupAudio();
    };
    
    const onError = (e) => {
      // Ignore errors from previous audio elements that were cleaned up
      if (!audioElement || audioElement.readyState === 0) {
        return;
      }
      
      isPlaying = false;
      updatePlayPauseButton(playPauseBtn, false);
      
      // Don't show error to user for aborted requests
      if (audioElement.error && audioElement.error.code === MediaError.MEDIA_ERR_ABORTED) {
        return;
      }
      
      // Show error to user for other errors
      if (typeof showToast === 'function') {
        showToast('Error playing audio. The format may not be supported.', 'error');
      }
    };
    
    // Add event listeners
    audioElement.addEventListener('play', onPlay, { once: true });
    audioElement.addEventListener('pause', onPause);
    audioElement.addEventListener('ended', onEnded, { once: true });
    audioElement.addEventListener('error', onError);
    
    // Store references for cleanup
    audioElement._eventHandlers = { onPlay, onPause, onEnded, onError };
    
    // Start playback with error handling
    try {
      const playPromise = audioElement.play();
      
      if (playPromise !== undefined) {
        await playPromise.catch(error => {
          // Ignore abort errors when switching between streams
          if (error.name !== 'AbortError') {
            throw error;
          }
        });
      }
      
      isPlaying = true;
    } catch (error) {
      // Only log unexpected errors
      if (error.name !== 'AbortError') {
        console.error('[streams-ui] Error during playback:', error);
        throw error;
      }
    }
    
  } catch (error) {
    console.error('[streams-ui] Error loading/playing audio:', error);
    if (playPauseBtn) {
      updatePlayPauseButton(playPauseBtn, false);
    }
    
    // Only show error if it's not an abort error
    if (error.name !== 'AbortError' && typeof showToast === 'function') {
      showToast('Error playing audio. Please try again.', 'error');
    }
  }
}

// Handle audio ended event
function handleAudioEnded() {
  isPlaying = false;
  if (currentlyPlayingButton) {
    updatePlayPauseButton(currentlyPlayingButton, false);
  }
  cleanupAudio();
}

// Clean up audio resources
function cleanupAudio() {
  console.log('[streams-ui] Cleaning up audio resources');
  
  // Clean up Web Audio API resources if they exist
  if (audioSource) {
    try {
      if (isPlaying) {
        audioSource.stop();
      }
      audioSource.disconnect();
    } catch (e) {
      console.warn('Error cleaning up audio source:', e);
    }
    audioSource = null;
  }
  
  // Clean up HTML5 Audio element if it exists
  if (audioElement) {
    try {
      // Remove event listeners first
      if (audioElement._eventHandlers) {
        const { onPlay, onPause, onEnded, onError } = audioElement._eventHandlers;
        if (onPlay) audioElement.removeEventListener('play', onPlay);
        if (onPause) audioElement.removeEventListener('pause', onPause);
        if (onEnded) audioElement.removeEventListener('ended', onEnded);
        if (onError) audioElement.removeEventListener('error', onError);
      }
      
      // Pause and clean up the audio element
      audioElement.pause();
      audioElement.removeAttribute('src');
      audioElement.load();
      
      // Force garbage collection by removing references
      if (audioElement._eventHandlers) {
        delete audioElement._eventHandlers;
      }
      
      audioElement = null;
    } catch (e) {
      console.warn('Error cleaning up audio element:', e);
    }
  }
  
  // Reset state
  isPlaying = false;
  currentUid = null;
  
  // Update UI
  if (currentlyPlayingButton) {
    updatePlayPauseButton(currentlyPlayingButton, false);
    currentlyPlayingButton = null;
  }
}

// Event delegation for play/pause buttons - only handle buttons within the stream list
const streamList = document.getElementById('stream-list');
if (streamList) {
  streamList.addEventListener('click', async (e) => {
    const playPauseBtn = e.target.closest('.play-pause-btn');
    // Skip if not a play button or if it's the personal stream's play button
    if (!playPauseBtn || playPauseBtn.closest('#me-page')) return;
    
    // Prevent event from bubbling up to document-level handlers
    e.stopPropagation();
    e.stopImmediatePropagation();
    e.preventDefault();
  
    const uid = playPauseBtn.dataset.uid;
    if (!uid) {
      return;
    }
    
    // If clicking the currently playing button, toggle pause/play
    if (currentUid === uid) {
      if (isPlaying) {
        await audioElement.pause();
        isPlaying = false;
        updatePlayPauseButton(playPauseBtn, false);
      } else {
        try {
          await audioElement.play();
          isPlaying = true;
          updatePlayPauseButton(playPauseBtn, true);
        } catch (error) {
          // If resume fails, try reloading the audio
          await loadAndPlayAudio(uid, playPauseBtn);
        }
      }
      return;
    }
    
    // If a different stream is playing, stop it and start the new one
    stopPlayback();
    await loadAndPlayAudio(uid, playPauseBtn);
  });
}

// Handle audio end event to update button state
document.addEventListener('play', (e) => {
  if (e.target.tagName === 'AUDIO' && e.target !== currentlyPlayingAudio) {
    if (currentlyPlayingAudio) {
      currentlyPlayingAudio.pause();
    }
    currentlyPlayingAudio = e.target;
    
    // Update the play/pause button state
    const playerArticle = e.target.closest('.stream-player');
    if (playerArticle) {
      const playBtn = playerArticle.querySelector('.play-pause-btn');
      if (playBtn) {
        if (currentlyPlayingButton && currentlyPlayingButton !== playBtn) {
          updatePlayPauseButton(currentlyPlayingButton, false);
        }
        updatePlayPauseButton(playBtn, true);
        currentlyPlayingButton = playBtn;
      }
    }
  }
}, true);

// Handle audio pause event
document.addEventListener('pause', (e) => {
  if (e.target.tagName === 'AUDIO' && e.target === currentlyPlayingAudio) {
    const playerArticle = e.target.closest('.stream-player');
    if (playerArticle) {
      const playBtn = playerArticle.querySelector('.play-pause-btn');
      if (playBtn) {
        updatePlayPauseButton(playBtn, false);
      }
    }
    currentlyPlayingAudio = null;
    currentlyPlayingButton = null;
  }
}, true);
