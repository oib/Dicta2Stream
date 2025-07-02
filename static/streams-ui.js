// static/streams-ui.js — public streams loader and profile-link handling
import { showOnly } from './router.js';

console.log('[streams-ui] Module loaded');

// Removed loadingStreams and lastStreamsPageVisible guards for instant fetch

export function initStreamsUI() {
  console.log('[streams-ui] Initializing streams UI');
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

// Global variables for audio control
let currentlyPlayingAudio = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('[streams-ui] DOM content loaded, initializing streams UI');
  initStreamsUI();
  
  // Also try to load streams immediately in case the page is already loaded
  setTimeout(() => {
    console.log('[streams-ui] Attempting initial stream load');
    loadAndRenderStreams();
  }, 100);
});

function loadAndRenderStreams() {
  console.log('[streams-ui] loadAndRenderStreams called');
  const ul = document.getElementById('stream-list');
  if (!ul) {
    console.warn('[streams-ui] #stream-list not found in DOM');
    return;
  }
  
  // Clear any existing error messages or retry buttons
  ul.innerHTML = '<li>Loading public streams...</li>';
  
  // Add a timestamp to prevent caching issues
  const timestamp = new Date().getTime();
  
  // Use the same protocol as the current page to avoid mixed content issues
  const baseUrl = window.location.origin;
  const sseUrl = `${baseUrl}/streams-sse?t=${timestamp}`;
  
  console.log(`[streams-ui] Connecting to ${sseUrl}`);
  
  let gotAny = false;
  let streams = [];
  let connectionTimeout = null;
  
  // Close previous connection and clear any pending timeouts
  if (window._streamsSSE) {
    console.log('[streams-ui] Aborting previous connection');
    if (window._streamsSSE.abort) {
      window._streamsSSE.abort();
    }
    window._streamsSSE = null;
  }
  if (connectionTimeout) {
    clearTimeout(connectionTimeout);
    connectionTimeout = null;
  }
  
  console.log(`[streams-ui] Creating fetch-based SSE connection to ${sseUrl}`);
  
  // Use fetch with ReadableStream for better CORS handling
  const controller = new AbortController();
  const signal = controller.signal;
  
  // Store the controller for cleanup
  window._streamsSSE = controller;
  
  // Set a connection timeout
  connectionTimeout = setTimeout(() => {
    if (!gotAny) {
      console.log('[streams-ui] Connection timeout reached, forcing retry...');
      controller.abort();
      loadAndRenderStreams();
    }
  }, 10000); // 10 second timeout
  
  console.log('[streams-ui] Making fetch request to:', sseUrl);
  
  console.log('[streams-ui] Making fetch request to:', sseUrl);
  
  console.log('[streams-ui] Creating fetch request with URL:', sseUrl);
  
  // Make the fetch request
  fetch(sseUrl, {
    method: 'GET',
    headers: {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
    credentials: 'same-origin',
    signal: signal,
    // Add mode and redirect options for better error handling
    mode: 'cors',
    redirect: 'follow'
  })
  .then(response => {
    console.log('[streams-ui] Fetch response received, status:', response.status, response.statusText);
    console.log('[streams-ui] Response URL:', response.url);
    console.log('[streams-ui] Response type:', response.type);
    console.log('[streams-ui] Response redirected:', response.redirected);
    console.log('[streams-ui] Response headers:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    
    if (!response.ok) {
      // Try to get the response text for error details
      return response.text().then(text => {
        console.error('[streams-ui] Error response body:', text);
        const error = new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
        error.response = { status: response.status, statusText: response.statusText, body: text };
        throw error;
      }).catch(textError => {
        console.error('[streams-ui] Could not read error response body:', textError);
        const error = new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
        error.response = { status: response.status, statusText: response.statusText };
        throw error;
      });
    }
    
    if (!response.body) {
      const error = new Error('Response body is null or undefined');
      console.error('[streams-ui] No response body:', error);
      throw error;
    }
    
    console.log('[streams-ui] Response body is available, content-type:', response.headers.get('content-type'));
    
    // Get the readable stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    // Process the stream
    function processStream({ done, value }) {
      if (done) {
        console.log('[streams-ui] Stream completed');
        // Process any remaining data in the buffer
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            processSSEEvent(data);
          } catch (e) {
            console.error('[streams-ui] Error parsing final data:', e);
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
    console.error('[streams-ui] Fetch request failed:', error);
    
    // Log additional error details
    if (error.name === 'TypeError') {
      console.error('[streams-ui] This is likely a network error or CORS issue');
      if (error.message.includes('fetch')) {
        console.error('[streams-ui] The fetch request was blocked or failed to reach the server');
      }
      if (error.message.includes('CORS')) {
        console.error('[streams-ui] CORS error detected. Check server CORS configuration');
      }
    }
    
    if (error.name === 'AbortError') {
      console.log('[streams-ui] Request was aborted');
    } else {
      console.error('[streams-ui] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        constructor: error.constructor.name,
        errorCode: error.code,
        errorNumber: error.errno,
        response: error.response
      });
      
      // Show a user-friendly error message
      const ul = document.getElementById('stream-list');
      if (ul) {
        ul.innerHTML = `
          <li class="error">
            <p>Error loading streams. Please try again later.</p>
            <p><small>Technical details: ${error.name}: ${error.message}</small></p>
          </li>
        `;
      }
      
      handleSSEError(error);
    }
  });
  
  // Function to process SSE events
  function processSSEEvent(data) {
    console.log('[streams-ui] Received SSE event:', data);
    
    if (data.end) {
      console.log('[streams-ui] Received end event, total streams:', streams.length);
      
      if (streams.length === 0) {
        console.log('[streams-ui] No streams found, showing empty state');
        ul.innerHTML = '<li>No active streams.</li>';
        return;
      }
      
      // Sort streams by mtime in descending order (newest first)
      streams.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      console.log('[streams-ui] Sorted streams:', streams);
      
      // Clear the list
      ul.innerHTML = '';
      
      // Render each stream in sorted order
      streams.forEach((stream, index) => {
        const uid = stream.uid || `stream-${index}`;
        const sizeMb = stream.size ? (stream.size / (1024 * 1024)).toFixed(1) : '?';
        const mtime = stream.mtime ? new Date(stream.mtime * 1000).toISOString().split('T')[0].replace(/-/g, '/') : '';
        
        console.log(`[streams-ui] Rendering stream ${index + 1}/${streams.length}:`, { uid, sizeMb, mtime });
        
        const li = document.createElement('li');
        li.className = 'stream-item';
        
        try {
          li.innerHTML = `
            <article class="stream-player" data-uid="${escapeHtml(uid)}">
              <h3>${escapeHtml(uid)}</h3>
              <div class="audio-controls">
                <button class="play-pause-btn" data-uid="${escapeHtml(uid)}" aria-label="Play">▶️</button>
              </div>
              <p class="stream-info" style='color:gray;font-size:90%'>[${sizeMb} MB, ${mtime}]</p>
            </article>
          `;
          ul.appendChild(li);
          console.log(`[streams-ui] Successfully rendered stream: ${uid}`);
        } catch (error) {
          console.error(`[streams-ui] Error rendering stream ${uid}:`, error);
          const errorLi = document.createElement('li');
          errorLi.textContent = `Error loading stream: ${uid}`;
          errorLi.style.color = 'red';
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
  console.log(`[streams-ui] loadAndPlayAudio called for UID: ${uid}`);
  
  // If trying to play the currently paused audio, just resume it
  if (audioElement && currentUid === uid) {
    console.log('[streams-ui] Resuming existing audio');
    try {
      await audioElement.play();
      isPlaying = true;
      updatePlayPauseButton(playPauseBtn, true);
      return;
    } catch (error) {
      console.error('Error resuming audio:', error);
      // Fall through to reload if resume fails
    }
  }
  
  // Stop any current playback
  stopPlayback();
  
  // Update UI
  updatePlayPauseButton(playPauseBtn, true);
  currentlyPlayingButton = playPauseBtn;
  currentUid = uid;
  
  try {
    console.log(`[streams-ui] Creating new audio element for ${uid}`);
    
    // Create a new audio element with the correct MIME type
    const audioUrl = `/audio/${encodeURIComponent(uid)}/stream.opus`;
    console.log(`[streams-ui] Loading audio from: ${audioUrl}`);
    
    // Create a new audio element with a small delay to prevent race conditions
    await new Promise(resolve => setTimeout(resolve, 50));
    
    audioElement = new Audio(audioUrl);
    audioElement.preload = 'auto';
    audioElement.crossOrigin = 'anonymous'; // Important for CORS
    
    // Set up event handlers with proper binding
    const onPlay = () => {
      console.log('[streams-ui] Audio play event');
      isPlaying = true;
      updatePlayPauseButton(playPauseBtn, true);
    };
    
    const onPause = () => {
      console.log('[streams-ui] Audio pause event');
      isPlaying = false;
      updatePlayPauseButton(playPauseBtn, false);
    };
    
    const onEnded = () => {
      console.log('[streams-ui] Audio ended event');
      isPlaying = false;
      cleanupAudio();
    };
    
    const onError = (e) => {
      // Ignore errors from previous audio elements that were cleaned up
      if (!audioElement || audioElement.readyState === 0) {
        console.log('[streams-ui] Ignoring error from cleaned up audio element');
        return;
      }
      
      console.error('[streams-ui] Audio error:', e);
      console.error('Error details:', audioElement.error);
      isPlaying = false;
      updatePlayPauseButton(playPauseBtn, false);
      
      // Don't show error to user for aborted requests
      if (audioElement.error && audioElement.error.code === MediaError.MEDIA_ERR_ABORTED) {
        console.log('[streams-ui] Playback was aborted as expected');
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
    console.log('[streams-ui] Starting audio playback');
    try {
      const playPromise = audioElement.play();
      
      if (playPromise !== undefined) {
        await playPromise.catch(error => {
          // Ignore abort errors when switching between streams
          if (error.name !== 'AbortError') {
            console.error('[streams-ui] Play failed:', error);
            throw error;
          }
          console.log('[streams-ui] Play was aborted as expected');
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

// Event delegation for play/pause buttons
document.addEventListener('click', async (e) => {
  const playPauseBtn = e.target.closest('.play-pause-btn');
  if (!playPauseBtn) return;
  
  // Prevent default to avoid any potential form submission or link following
  e.preventDefault();
  e.stopPropagation();
  
  const uid = playPauseBtn.dataset.uid;
  if (!uid) {
    console.error('No UID found for play button');
    return;
  }
  
  console.log(`[streams-ui] Play/pause clicked for UID: ${uid}, currentUid: ${currentUid}, isPlaying: ${isPlaying}`);
  
  // If clicking the currently playing button, toggle pause/play
  if (currentUid === uid) {
    if (isPlaying) {
      console.log('[streams-ui] Pausing current audio');
      await audioElement.pause();
      isPlaying = false;
      updatePlayPauseButton(playPauseBtn, false);
    } else {
      console.log('[streams-ui] Resuming current audio');
      try {
        await audioElement.play();
        isPlaying = true;
        updatePlayPauseButton(playPauseBtn, true);
      } catch (error) {
        console.error('[streams-ui] Error resuming audio:', error);
        // If resume fails, try reloading the audio
        await loadAndPlayAudio(uid, playPauseBtn);
      }
    }
    return;
  }
  
  // If a different stream is playing, stop it and start the new one
  console.log(`[streams-ui] Switching to new audio stream: ${uid}`);
  stopPlayback();
  await loadAndPlayAudio(uid, playPauseBtn);
});

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
