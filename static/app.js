// app.js — Frontend upload + minimal native player logic with slide-in and pulse effect

import { playBeep } from "./sound.js";
import { showToast } from "./toast.js";

// Global audio state
let globalAudio = null;
let currentStreamUid = null;
let audioPlaying = false;
let lastPosition = 0;

// Utility functions
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Log debug messages to server
export function logToServer(msg) {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/log", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(JSON.stringify({ msg }));
}

// Handle magic link login redirect
function handleMagicLoginRedirect() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === 'success' && params.get('confirmed_uid')) {
    const username = params.get('confirmed_uid');
    localStorage.setItem('uid', username);
    localStorage.setItem('confirmed_uid', username);
    localStorage.setItem('uid_time', Date.now().toString());
    document.cookie = `uid=${encodeURIComponent(username)}; path=/`;
    
    // Update UI state immediately without reload
    const guestDashboard = document.getElementById('guest-dashboard');
    const userDashboard = document.getElementById('user-dashboard');
    const registerPage = document.getElementById('register-page');
    
    if (guestDashboard) guestDashboard.style.display = 'none';
    if (userDashboard) userDashboard.style.display = 'block';
    if (registerPage) registerPage.style.display = 'none';
    
    // Update URL and history without reloading
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Navigate to user's profile page
    if (window.showOnly) {
      window.showOnly('me-page');
    } else if (window.location.hash !== '#me') {
      window.location.hash = '#me';
    }
  }
}

// Audio player functions
function getOrCreateAudioElement() {
  if (!globalAudio) {
    globalAudio = document.getElementById('me-audio');
    if (!globalAudio) {
      console.error('Audio element not found');
      return null;
    }
    
    globalAudio.preload = 'metadata';
    globalAudio.crossOrigin = 'use-credentials';
    globalAudio.setAttribute('crossorigin', 'use-credentials');
    
    // Set up event listeners
    globalAudio.addEventListener('play', () => {
      audioPlaying = true;
      updatePlayPauseButton();
    });
    
    globalAudio.addEventListener('pause', () => {
      audioPlaying = false;
      updatePlayPauseButton();
    });
    
    globalAudio.addEventListener('timeupdate', () => {
      lastPosition = globalAudio.currentTime;
    });
    
    globalAudio.addEventListener('error', handleAudioError);
  }
  return globalAudio;
}

function handleAudioError(e) {
  const error = this.error;
  let errorMessage = 'Audio playback error';
  let shouldShowToast = true;
  
  if (error) {
    switch(error.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        errorMessage = 'Audio playback was aborted';
        shouldShowToast = false; // Don't show toast for aborted operations
        break;
      case MediaError.MEDIA_ERR_NETWORK:
        errorMessage = 'Network error while loading audio';
        break;
      case MediaError.MEDIA_ERR_DECODE:
        errorMessage = 'Error decoding audio. The file may be corrupted.';
        break;
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        // Don't show error for missing audio files on new accounts
        if (this.currentSrc && this.currentSrc.includes('stream.opus')) {
          console.log('Audio format not supported or file not found:', this.currentSrc);
          return;
        }
        errorMessage = 'Audio format not supported. Please upload a supported format (Opus/OGG).';
        break;
    }
    
    console.error('Audio error:', errorMessage, error);
    
    // Only show error toast if we have a valid error and it's not a missing file
    if (shouldShowToast && !(error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && !this.src)) {
      showToast(errorMessage, 'error');
    }
  }
  
  console.error('Audio error:', {
    error: error,
    src: this.currentSrc,
    networkState: this.networkState,
    readyState: this.readyState
  });
  
  if (errorMessage !== 'Audio format not supported') {
    showToast(`❌ ${errorMessage}`, 'error');
  }
}

function updatePlayPauseButton(audio, button) {
  if (button && audio) {
    button.textContent = audio.paused ? '▶️' : '⏸️';
  }
}

// Stream loading and playback
async function loadProfileStream(uid) {
  const audio = getOrCreateAudioElement();
  if (!audio) {
    console.error('Failed to initialize audio element');
    return null;
  }

  // Hide playlist controls
  const mePrevBtn = document.getElementById("me-prev");
  const meNextBtn = document.getElementById("me-next");
  if (mePrevBtn) mePrevBtn.style.display = "none";
  if (meNextBtn) meNextBtn.style.display = "none";

  // Reset current stream and update audio source
  currentStreamUid = uid;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  
  // Wait a moment to ensure the previous source is cleared
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const username = localStorage.getItem('username') || uid;
  const audioUrl = `/audio/${encodeURIComponent(username)}/stream.opus?t=${Date.now()}`;
  
  try {
    console.log('Checking audio file at:', audioUrl);
    
    // First check if the audio file exists and get its content type
    const response = await fetch(audioUrl, { 
      method: 'HEAD',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.log('No audio file found for user:', username);
      updatePlayPauseButton(audio, document.querySelector('.play-pause-btn'));
      return null;
    }
    
    const contentType = response.headers.get('content-type');
    console.log('Audio content type:', contentType);
    
    if (!contentType || !contentType.includes('audio/')) {
      throw new Error(`Invalid content type: ${contentType || 'unknown'}`);
    }
    
    // Set the audio source with proper type hint
    const source = document.createElement('source');
    source.src = audioUrl;
    source.type = 'audio/ogg; codecs=opus';
    
    // Clear any existing sources
    while (audio.firstChild) {
      audio.removeChild(audio.firstChild);
    }
    audio.appendChild(source);
    
    // Load the new source
    await new Promise((resolve, reject) => {
      audio.load();
      audio.oncanplaythrough = resolve;
      audio.onerror = () => {
        reject(new Error('Failed to load audio source'));
      };
      // Set a timeout in case the audio never loads
      setTimeout(() => reject(new Error('Audio load timeout')), 10000);
    });
    
    console.log('Audio loaded, attempting to play...');
    
    // Try to play immediately
    try {
      await audio.play();
      audioPlaying = true;
      console.log('Audio playback started successfully');
    } catch (e) {
      console.log('Auto-play failed, waiting for user interaction:', e);
      audioPlaying = false;
      // Don't show error for autoplay restrictions
      if (!e.message.includes('play() failed because the user')) {
        showToast('Click the play button to start playback', 'info');
      }
    }
    
    // Show stream info if available
    const streamInfo = document.getElementById("stream-info");
    if (streamInfo) streamInfo.hidden = false;
    
  } catch (error) {
    console.error('Error checking/loading audio:', error);
    // Don't show error toasts for missing audio files or aborted requests
    if (error.name !== 'AbortError' && 
        !error.message.includes('404') && 
        !error.message.includes('Failed to load')) {
      showToast('Error loading audio: ' + (error.message || 'Unknown error'), 'error');
    }
    return null;
  }
  
  // Update button state
  updatePlayPauseButton(audio, document.querySelector('.play-pause-btn'));
  return audio;
}

// Navigation and UI functions
function showProfilePlayerFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const profileUid = params.get("profile");
  
  if (profileUid) {
    const mePage = document.getElementById("me-page");
    if (!mePage) return;
    
    document.querySelectorAll("main > section").forEach(sec => 
      sec.hidden = sec.id !== "me-page"
    );
    
    // Hide upload/delete/copy-url controls for guest view
    const uploadArea = document.getElementById("upload-area");
    if (uploadArea) uploadArea.hidden = true;
    
    const copyUrlBtn = document.getElementById("copy-url");
    if (copyUrlBtn) copyUrlBtn.style.display = "none";
    
    const deleteBtn = document.getElementById("delete-account");
    if (deleteBtn) deleteBtn.style.display = "none";
    
    // Update UI for guest view
    const meHeading = document.querySelector("#me-page h2");
    if (meHeading) meHeading.textContent = `${profileUid}'s Stream 🎙️`;
    
    const meDesc = document.querySelector("#me-page p");
    if (meDesc) meDesc.textContent = `This is ${profileUid}'s public stream.`;
    
    // Show a Play Stream button for explicit user action
    const streamInfo = document.getElementById("stream-info");
    if (streamInfo) {
      streamInfo.innerHTML = '';
      const playBtn = document.createElement('button');
      playBtn.textContent = "▶ Play Stream";
      playBtn.onclick = () => {
        loadProfileStream(profileUid);
        playBtn.disabled = true;
      };
      streamInfo.appendChild(playBtn);
      streamInfo.hidden = false;
    }
  }
}

function initNavigation() {
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      
      // Skip if href is empty or doesn't start with '#'
      if (!href || !href.startsWith('#')) {
        return; // Let the browser handle the link normally
      }
      
      const sectionId = href.substring(1); // Remove the '#'
      
      // Skip if sectionId is empty after removing '#'
      if (!sectionId) {
        console.warn('Empty section ID in navigation link:', link);
        return;
      }
      
      const section = document.getElementById(sectionId);
      if (section) {
        e.preventDefault();
        
        // Hide all sections first
        document.querySelectorAll('main > section').forEach(sec => {
          sec.hidden = sec.id !== sectionId;
        });
        
        // Special handling for me-page
        if (sectionId === 'me-page') {
          const registerPage = document.getElementById('register-page');
          if (registerPage) registerPage.hidden = true;
          
          // Show the upload box in me-page
          const uploadBox = document.querySelector('#me-page #user-upload-area');
          if (uploadBox) uploadBox.style.display = 'block';
        } else if (sectionId === 'register-page') {
          // Ensure me-page is hidden when register-page is shown
          const mePage = document.getElementById('me-page');
          if (mePage) mePage.hidden = true;
        }
        
        section.scrollIntoView({ behavior: "smooth" });
        
        // Close mobile menu if open
        const burger = document.getElementById('burger-toggle');
        if (burger && burger.checked) burger.checked = false;
      }
    });
  });
}

function initProfilePlayer() {
  if (typeof checkSessionValidity === "function" && !checkSessionValidity()) return;
  showProfilePlayerFromUrl();
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Handle magic link redirect if needed
  handleMagicLoginRedirect();
  
  // Initialize components
  initNavigation();
  
  // Initialize profile player after a short delay
  setTimeout(() => {
    initProfilePlayer();
    
    // Set up play/pause button click handler
    document.addEventListener('click', (e) => {
      const playPauseBtn = e.target.closest('.play-pause-btn');
      if (!playPauseBtn || playPauseBtn.id === 'logout-button') return;
      
      const audio = getOrCreateAudioElement();
      if (!audio) return;
      
      try {
        if (audio.paused) {
          // Stop any currently playing audio first
          if (window.currentlyPlayingAudio && window.currentlyPlayingAudio !== audio) {
            window.currentlyPlayingAudio.pause();
            if (window.currentlyPlayingButton) {
              updatePlayPauseButton(window.currentlyPlayingAudio, window.currentlyPlayingButton);
            }
          }
          
          // Stop any playing public streams
          const publicPlayers = document.querySelectorAll('.stream-player audio');
          publicPlayers.forEach(player => {
            if (!player.paused) {
              player.pause();
              const btn = player.closest('.stream-player').querySelector('.play-pause-btn');
              if (btn) updatePlayPauseButton(player, btn);
            }
          });
          
          // Check if audio has a valid source before attempting to play
          // Only show this message for the main player, not public streams
          if (!audio.src && !playPauseBtn.closest('.stream-player')) {
            console.log('No audio source available for main player');
            showToast('No audio file available. Please upload an audio file first.', 'info');
            audioPlaying = false;
            updatePlayPauseButton(audio, playPauseBtn);
            return;
          }

          // Store the current play promise to handle aborts
          const playPromise = audio.play();
          
          // Handle successful play
          playPromise.then(() => {
            // Only update state if this is still the current play action
            if (audio === getMainAudio()) {
              window.currentlyPlayingAudio = audio;
              window.currentlyPlayingButton = playPauseBtn;
              updatePlayPauseButton(audio, playPauseBtn);
            }
          }).catch(e => {
            // Don't log aborted errors as they're normal during rapid play/pause
            if (e.name !== 'AbortError') {
              console.error('Play failed:', e);
            } else {
              console.log('Playback was aborted as expected');
              return; // Skip UI updates for aborted play
            }
            
            // Only update state if this is still the current audio element
            if (audio === getMainAudio()) {
              audioPlaying = false;
              updatePlayPauseButton(audio, playPauseBtn);
              
              // Provide more specific error messages
              if (e.name === 'NotSupportedError' || e.name === 'NotAllowedError') {
                showToast('Could not play audio. The format may not be supported.', 'error');
              } else if (e.name !== 'AbortError') { // Skip toast for aborted errors
                showToast('Failed to play audio. Please try again.', 'error');
              }
            }
          });
        } else {
          audio.pause();
          if (window.currentlyPlayingAudio === audio) {
            window.currentlyPlayingAudio = null;
            window.currentlyPlayingButton = null;
          }
          updatePlayPauseButton(audio, playPauseBtn);
        }
      } catch (e) {
        console.error('Audio error:', e);
        updatePlayPauseButton(audio, playPauseBtn);
      }
    });
    
    // Set up delete account button if it exists
    const deleteAccountBtn = document.getElementById('delete-account');
    if (deleteAccountBtn) {
      deleteAccountBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
          return;
        }
        
        try {
          const response = await fetch('/api/delete-account', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (response.ok) {
            // Clear local storage and redirect to home page
            localStorage.clear();
            window.location.href = '/';
          } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete account');
          }
        } catch (error) {
          console.error('Error deleting account:', error);
          showToast(`❌ ${error.message || 'Failed to delete account'}`, 'error');
        }
      });
    }
    
  }, 200); // End of setTimeout
});

// Expose functions for global access
window.logToServer = logToServer;
window.getMainAudio = () => globalAudio;
window.stopMainAudio = () => {
  if (globalAudio) {
    globalAudio.pause();
    audioPlaying = false;
    updatePlayPauseButton();
  }
};
window.loadProfileStream = loadProfileStream;
