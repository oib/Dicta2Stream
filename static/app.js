// app.js — Frontend upload + minimal native player logic with slide-in and pulse effect

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

import { playBeep } from "./sound.js";
import { showToast } from "./toast.js";


// Log debug messages to server
export function logToServer(msg) {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/log", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(JSON.stringify({ msg }));
}

// Expose for debugging
window.logToServer = logToServer;

// Handle magic link login redirect
(function handleMagicLoginRedirect() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === 'success' && params.get('confirmed_uid')) {
    const username = params.get('confirmed_uid');
    localStorage.setItem('uid', username);
    logToServer(`[DEBUG] localStorage.setItem('uid', '${username}')`);
    localStorage.setItem('confirmed_uid', username);
    logToServer(`[DEBUG] localStorage.setItem('confirmed_uid', '${username}')`);
    const uidTime = Date.now().toString();
    localStorage.setItem('uid_time', uidTime);
    logToServer(`[DEBUG] localStorage.setItem('uid_time', '${uidTime}')`);
    // Set uid as cookie for backend authentication
    document.cookie = "uid=" + encodeURIComponent(username) + "; path=/";
    // Remove query params from URL
    window.history.replaceState({}, document.title, window.location.pathname);
    // Reload to show dashboard as logged in
    location.reload();
    return;
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  // (Removed duplicate logToServer definition)

  // Guest vs. logged-in toggling is now handled by dashboard.js
  // --- Public profile view logic ---
  function showProfilePlayerFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const profileUid = params.get("profile");
    if (profileUid) {
      const mePage = document.getElementById("me-page");
      if (mePage) {
        document.querySelectorAll("main > section").forEach(sec => sec.hidden = sec.id !== "me-page");
        // Hide upload/delete/copy-url controls for guest view
        const uploadArea = document.getElementById("upload-area");
        if (uploadArea) uploadArea.hidden = true;
        const copyUrlBtn = document.getElementById("copy-url");
        if (copyUrlBtn) copyUrlBtn.style.display = "none";
        const deleteBtn = document.getElementById("delete-account");
        if (deleteBtn) deleteBtn.style.display = "none";
        // Update heading and description for guest view
        const meHeading = document.querySelector("#me-page h2");
        if (meHeading) meHeading.textContent = `${profileUid}'s Stream 🎙️`;
        const meDesc = document.querySelector("#me-page p");
        if (meDesc) meDesc.textContent = `This is ${profileUid}'s public stream.`;
        // Show a Play Stream button for explicit user action
        const streamInfo = document.getElementById("stream-info");
        if (streamInfo) {
          streamInfo.innerHTML = "";
          const playBtn = document.createElement('button');
          playBtn.textContent = "▶ Play Stream";
          playBtn.onclick = () => {
            loadProfileStream(profileUid);
            playBtn.disabled = true;
          };
          streamInfo.appendChild(playBtn);
          streamInfo.hidden = false;
        }
        // Do NOT call loadProfileStream(profileUid) automatically!
      }
    }
  }

  // --- Only run showProfilePlayerFromUrl after session/profile checks are complete ---
  function runProfilePlayerIfSessionValid() {
    if (typeof checkSessionValidity === "function" && !checkSessionValidity()) return;
    showProfilePlayerFromUrl();
  }
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(runProfilePlayerIfSessionValid, 200);
  });
  window.addEventListener('popstate', () => {
    setTimeout(runProfilePlayerIfSessionValid, 200);
  });
  window.showProfilePlayerFromUrl = showProfilePlayerFromUrl;

  // Global audio state
  let globalAudio = null;
  let currentStreamUid = null;
  let audioPlaying = false;
  let lastPosition = 0;
  
  // Expose main audio element for other scripts
  window.getMainAudio = () => globalAudio;
  window.stopMainAudio = () => {
    if (globalAudio) {
      globalAudio.pause();
      audioPlaying = false;
      updatePlayPauseButton();
    }
  };

  function getOrCreateAudioElement() {
    if (!globalAudio) {
      globalAudio = document.getElementById('me-audio');
      if (!globalAudio) {
        console.error('Audio element not found');
        return null;
      }
      // Set up audio element properties
      globalAudio.preload = 'metadata'; // Preload metadata for better performance
      globalAudio.crossOrigin = 'use-credentials'; // Use credentials for authenticated requests
      globalAudio.setAttribute('crossorigin', 'use-credentials'); // Explicitly set the attribute
      
      // Set up event listeners
      globalAudio.addEventListener('play', () => {
        audioPlaying = true;
        updatePlayPauseButton();
      });
      globalAudio.addEventListener('pause', () => {
        audioPlaying = false;
        updatePlayPauseButton();
      });
      globalAudio.addEventListener('timeupdate', () => lastPosition = globalAudio.currentTime);
      
      // Add error handling
      globalAudio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        showToast('❌ Audio playback error');
      });
    }
    return globalAudio;
  }

  // Function to update play/pause button state
  function updatePlayPauseButton() {
    const audio = getOrCreateAudioElement();
    if (playPauseButton && audio) {
      playPauseButton.textContent = audio.paused ? '▶' : '⏸️';
    }
  }

  // Initialize play/pause button
  const playPauseButton = document.getElementById('play-pause');
  if (playPauseButton) {
    // Set initial state
    updatePlayPauseButton();
    
    // Add click handler
    playPauseButton.addEventListener('click', () => {
      const audio = getOrCreateAudioElement();
      if (audio) {
        if (audio.paused) {
          // Stop any playing public streams first
          const publicPlayers = document.querySelectorAll('.stream-player audio');
          publicPlayers.forEach(player => {
            if (!player.paused) {
              player.pause();
              const button = player.closest('.stream-player').querySelector('.play-pause');
              if (button) {
                button.textContent = '▶';
              }
            }
          });
          
          audio.play().catch(e => {
            console.error('Play failed:', e);
            audioPlaying = false;
          });
        } else {
          audio.pause();
        }
        updatePlayPauseButton();
      }
    });
  }



  // Preload audio without playing it
  function preloadAudio(src) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      audio.src = src;
      audio.load();
      audio.oncanplaythrough = () => resolve(audio);
    });
  }

  // Load and play a stream
  async function loadProfileStream(uid) {
    const audio = getOrCreateAudioElement();
    if (!audio) return null;
    
    // Always reset current stream and update audio source
    currentStreamUid = uid;
    audio.pause();
    audio.src = '';
    
    // Wait a moment to ensure the previous source is cleared
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Set new source with cache-busting timestamp
    audio.src = `/audio/${encodeURIComponent(uid)}/stream.opus?t=${Date.now()}`;
    
    // Try to play immediately
    try {
      await audio.play();
      audioPlaying = true;
    } catch (e) {
      console.error('Play failed:', e);
      audioPlaying = false;
    }
    
    // Show stream info
    const streamInfo = document.getElementById("stream-info");
    if (streamInfo) streamInfo.hidden = false;
    
    // Update button state
    updatePlayPauseButton();
    
    return audio;
  }

// Load and play a stream
async function loadProfileStream(uid) {
  const audio = getOrCreateAudioElement();
  if (!audio) return null;

  // Hide playlist controls
  const mePrevBtn = document.getElementById("me-prev");
  if (mePrevBtn) mePrevBtn.style.display = "none";
  const meNextBtn = document.getElementById("me-next");
  if (meNextBtn) meNextBtn.style.display = "none";

  // Handle navigation to "Your Stream"
  const mePageLink = document.getElementById("show-me");
  if (mePageLink) {
    mePageLink.addEventListener("click", async (e) => {
      e.preventDefault();
      const uid = localStorage.getItem("uid");
      if (!uid) return;

      // Show loading state
      const streamInfo = document.getElementById("stream-info");
      if (streamInfo) {
        streamInfo.hidden = false;
        streamInfo.innerHTML = '<p>Loading stream...</p>';
      }

      try {
        // Load the stream but don't autoplay
        await loadProfileStream(uid);

        // Update URL without triggering a full page reload
        if (window.location.pathname !== '/') {
          window.history.pushState({}, '', '/');
        }

        // Show the me-page section
        const mePage = document.getElementById('me-page');
        if (mePage) {
          document.querySelectorAll('main > section').forEach(s => s.hidden = s.id !== 'me-page');
        }

        // Clear loading state
        const streamInfo = document.getElementById('stream-info');
        if (streamInfo) {
          streamInfo.innerHTML = '';
        }
      } catch (error) {
        console.error('Error loading stream:', error);
        const streamInfo = document.getElementById('stream-info');
        if (streamInfo) {
          streamInfo.innerHTML = '<p>Error loading stream. Please try again.</p>';
        }
      }
    });
  }

  // Always reset current stream and update audio source
  currentStreamUid = uid;
  audio.pause();
  audio.src = '';

  // Wait a moment to ensure the previous source is cleared
  await new Promise(resolve => setTimeout(resolve, 50));

  // Set new source with cache-busting timestamp
  audio.src = `/audio/${encodeURIComponent(uid)}/stream.opus?t=${Date.now()}`;

  // Try to play immediately
  try {
    await audio.play();
    audioPlaying = true;
  } catch (e) {
    console.error('Play failed:', e);
    audioPlaying = false;
  }

  // Show stream info
  const streamInfo = document.getElementById("stream-info");
  if (streamInfo) streamInfo.hidden = false;

  // Update button state
  updatePlayPauseButton();

  return audio;
}

// Export the function for use in other modules
window.loadProfileStream = loadProfileStream;

document.addEventListener("DOMContentLoaded", () => {
  // Initialize play/pause button
  const playPauseButton = document.getElementById('play-pause');
  if (playPauseButton) {
    // Set initial state
    audioPlaying = false;
    updatePlayPauseButton();
    
    // Add event listener
    playPauseButton.addEventListener('click', () => {
      const audio = getMainAudio();
      if (audio) {
        if (audio.paused) {
          audio.play();
        } else {
          audio.pause();
        }
        updatePlayPauseButton();
      }
    });
  }

  // Add bot protection for registration form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', (e) => {
      const botTrap = e.target.elements.bot_trap;
      if (botTrap && botTrap.value) {
        e.preventDefault();
        showToast('❌ Bot detected! Please try again.');
        return false;
      }
      return true;
    });
  }

  // Initialize navigation
  document.querySelectorAll('#links a[data-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-target');
      // Only hide other sections when not opening #me-page
      if (target !== 'me-page') fadeAllSections();
      const section = document.getElementById(target);
      if (section) {
        section.hidden = false;
        section.classList.add("slide-in");
        section.scrollIntoView({ behavior: "smooth" });
      }
      const burger = document.getElementById('burger-toggle');
      if (burger && burger.checked) burger.checked = false;
    });
  });

  // Initialize profile player if valid session
  setTimeout(runProfilePlayerIfSessionValid, 200);
  window.addEventListener('popstate', () => {
    setTimeout(runProfilePlayerIfSessionValid, 200);
  });
});
  // Initialize navigation
  document.querySelectorAll('#links a[data-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-target');
      // Only hide other sections when not opening #me-page
      if (target !== 'me-page') fadeAllSections();
      const section = document.getElementById(target);
      if (section) {
        section.hidden = false;
        section.classList.add("slide-in");
        section.scrollIntoView({ behavior: "smooth" });
      }
      const burger = document.getElementById('burger-toggle');
      if (burger && burger.checked) burger.checked = false;
    });
  });

  // Initialize profile player if valid session
  setTimeout(runProfilePlayerIfSessionValid, 200);
  window.addEventListener('popstate', () => {
    setTimeout(runProfilePlayerIfSessionValid, 200);
  });
});
