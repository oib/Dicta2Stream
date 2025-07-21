// app.js — Frontend upload + minimal native player logic with slide-in and pulse effect

import { playBeep } from "./sound.js";
import { showToast } from "./toast.js";
import { injectNavigation } from "./inject-nav.js";

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
    console.log('Magic link login detected for user:', username);
    
    // Update authentication state
    localStorage.setItem('uid', username);
    localStorage.setItem('confirmed_uid', username);
    localStorage.setItem('uid_time', Date.now().toString());
    document.cookie = `uid=${encodeURIComponent(username)}; path=/; SameSite=Lax`;
    
    // Update UI state
    document.body.classList.add('authenticated');
    document.body.classList.remove('guest');
    
    // Update local storage and cookies
    localStorage.setItem('isAuthenticated', 'true');
    document.cookie = `isAuthenticated=true; path=/; SameSite=Lax`;
    
    // Update URL and history without reloading
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Update navigation
    if (typeof injectNavigation === 'function') {
      console.log('Updating navigation after magic link login');
      injectNavigation(true);
    } else {
      console.warn('injectNavigation function not available after magic link login');
    }
    
    // Navigate to user's profile page
    if (window.showOnly) {
      console.log('Navigating to me-page');
      window.showOnly('me-page');
    } else if (window.location.hash !== '#me') {
      window.location.hash = '#me';
    }
    
    // Auth state will be updated by the polling mechanism
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
  // Get all navigation links
  const navLinks = document.querySelectorAll('nav a, .dashboard-nav a');
  
  // Handle navigation link clicks
  const handleNavClick = (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    
    // Check both href and data-target attributes
    const target = link.getAttribute('data-target');
    const href = link.getAttribute('href');
    
    // Let the browser handle external links
    if (href && (href.startsWith('http') || href.startsWith('mailto:'))) {
      return;
    }
    
    // If no data-target and no hash in href, let browser handle it
    if (!target && (!href || !href.startsWith('#'))) {
      return;
    }
    
    // Prefer data-target over href
    let sectionId = target || (href ? href.substring(1) : '');
    
    // Special case for the 'me' route which maps to 'me-page'
    if (sectionId === 'me') {
      sectionId = 'me-page';
    }
    
    // Skip if no valid section ID
    if (!sectionId) {
      console.warn('No valid section ID in navigation link:', link);
      return;
    }
    
    // Let the router handle the navigation
    e.preventDefault();
    e.stopPropagation();
    
    // Update body class to reflect the current section
    document.body.className = ''; // Clear existing classes
    document.body.classList.add(`page-${sectionId.replace('-page', '')}`);
    
    // Update URL hash - the router will handle the rest
    window.location.hash = sectionId;
    
    // Close mobile menu if open
    const burger = document.getElementById('burger-toggle');
    if (burger && burger.checked) burger.checked = false;
  };
  
  // Add click event listeners to all navigation links
  navLinks.forEach(link => {
    link.addEventListener('click', handleNavClick);
  });
  
  // Handle initial page load and hash changes
  const handleHashChange = () => {
    let hash = window.location.hash.substring(1);
    
    // Map URL hashes to section IDs if they don't match exactly
    const sectionMap = {
      'welcome': 'welcome-page',
      'streams': 'stream-page',
      'account': 'register-page',
      'login': 'login-page',
      'me': 'me-page'
    };
    
    // Use mapped section ID or the hash as is
    const sectionId = sectionMap[hash] || hash || 'welcome-page';
    const targetSection = document.getElementById(sectionId);
    
    if (targetSection) {
      // Hide all sections
      document.querySelectorAll('main > section').forEach(section => {
        section.hidden = section.id !== sectionId;
      });
      
      // Show target section
      targetSection.hidden = false;
      targetSection.scrollIntoView({ behavior: 'smooth' });
      
      // Update active state of navigation links
      navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        // Match both the exact hash and the mapped section ID
        link.classList.toggle('active', 
          linkHref === `#${hash}` || 
          linkHref === `#${sectionId}` ||
          link.getAttribute('data-target') === sectionId ||
          link.getAttribute('data-target') === hash
        );
      });
      
      // Special handling for streams page
      if (sectionId === 'stream-page' && typeof window.maybeLoadStreamsOnShow === 'function') {
        window.maybeLoadStreamsOnShow();
      }
    } else {
      console.warn(`Section with ID '${sectionId}' not found`);
    }
  };
  
  // Listen for hash changes
  window.addEventListener('hashchange', handleHashChange);
  
  // Handle initial page load
  handleHashChange();
}

function initProfilePlayer() {
  if (typeof checkSessionValidity === "function" && !checkSessionValidity()) return;
  showProfilePlayerFromUrl();
}

// Track previous authentication state
let wasAuthenticated = null;
// Debug flag - set to false to disable auth state change logs
const DEBUG_AUTH_STATE = false;

// Track all intervals and timeouts
const activeIntervals = new Map();
const activeTimeouts = new Map();

// Store original timer functions
const originalSetInterval = window.setInterval;
const originalClearInterval = window.clearInterval;
const originalSetTimeout = window.setTimeout;
const originalClearTimeout = window.clearTimeout;

// Override setInterval to track all intervals
window.setInterval = (callback, delay, ...args) => {
  const id = originalSetInterval((...args) => {
    trackFunctionCall('setInterval callback', { id, delay, callback: callback.toString() });
    return callback(...args);
  }, delay, ...args);
  
  activeIntervals.set(id, {
    id,
    delay,
    callback: callback.toString(),
    createdAt: Date.now(),
    stack: new Error().stack
  });
  
  if (DEBUG_AUTH_STATE) {
    console.log(`[Interval ${id}] Created with delay ${delay}ms`, {
      id,
      delay,
      callback: callback.toString(),
      stack: new Error().stack
    });
  }
  
  return id;
};

// Override clearInterval to track interval cleanup
window.clearInterval = (id) => {
  if (activeIntervals.has(id)) {
    activeIntervals.delete(id);
    if (DEBUG_AUTH_STATE) {
      console.log(`[Interval ${id}] Cleared`);
    }
  } else if (DEBUG_AUTH_STATE) {
    console.log(`[Interval ${id}] Cleared (not tracked)`);
  }
  originalClearInterval(id);
};

// Override setTimeout to track timeouts (debug logging disabled)
window.setTimeout = (callback, delay, ...args) => {
  const id = originalSetTimeout(callback, delay, ...args);
  // Store minimal info without logging
  activeTimeouts.set(id, { 
    id, 
    delay, 
    callback: callback.toString(), 
    createdAt: Date.now() 
  });
  return id;
};

// Override clearTimeout to track timeout cleanup (debug logging disabled)
window.clearTimeout = (id) => {
  if (activeTimeouts.has(id)) {
    activeTimeouts.delete(id);
  }
  originalClearTimeout(id);
};

// Track auth check calls and cache state
let lastAuthCheckTime = 0;
let authCheckCounter = 0;
const AUTH_CHECK_DEBOUNCE = 1000; // 1 second
let authStateCache = {
  timestamp: 0,
  value: null,
  ttl: 5000 // Cache TTL in milliseconds
};

// Override console.log to capture all logs
const originalConsoleLog = console.log;
const originalConsoleGroup = console.group;
const originalConsoleGroupEnd = console.groupEnd;

// Track all console logs
const consoleLogs = [];
const MAX_LOGS = 100;

console.log = function(...args) {
  // Store the log
  consoleLogs.push({
    type: 'log',
    timestamp: new Date().toISOString(),
    args: [...args],
    stack: new Error().stack
  });
  
  // Keep only the most recent logs
  while (consoleLogs.length > MAX_LOGS) {
    consoleLogs.shift();
  }
  
  // Filter out the auth state check messages
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Auth State Check')) {
    return;
  }
  
  originalConsoleLog.apply(console, args);
};

// Track console groups
console.group = function(...args) {
  consoleLogs.push({ type: 'group', timestamp: new Date().toISOString(), args });
  originalConsoleGroup.apply(console, args);
};

console.groupEnd = function() {
  consoleLogs.push({ type: 'groupEnd', timestamp: new Date().toISOString() });
  originalConsoleGroupEnd.apply(console);
};

// Track all function calls that might trigger auth checks
const trackedFunctions = ['checkAuthState', 'setInterval', 'setTimeout', 'addEventListener', 'removeEventListener'];
const functionCalls = [];
const MAX_FUNCTION_CALLS = 100;



// Function to format stack trace for better readability
function formatStack(stack) {
  if (!stack) return 'No stack trace';
  // Remove the first line (the error message) and limit to 5 frames
  const frames = stack.split('\n').slice(1).slice(0, 5);
  return frames.join('\n');
}

// Function to dump debug info
window.dumpDebugInfo = () => {
  console.group('Debug Info');
  
  // Active Intervals
  console.group('Active Intervals');
  if (activeIntervals.size === 0) {
    console.log('No active intervals');
  } else {
    activeIntervals.forEach((info, id) => {
      console.group(`Interval ${id} (${info.delay}ms)`);
      console.log('Created at:', new Date(info.createdAt).toISOString());
      console.log('Callback:', info.callback.split('\n')[0]); // First line of callback
      console.log('Stack trace:');
      console.log(formatStack(info.stack));
      console.groupEnd();
    });
  }
  console.groupEnd();
  
  // Active Timeouts
  console.group('Active Timeouts');
  if (activeTimeouts.size === 0) {
    console.log('No active timeouts');
  } else {
    activeTimeouts.forEach((info, id) => {
      console.group(`Timeout ${id} (${info.delay}ms)`);
      console.log('Created at:', new Date(info.createdAt).toISOString());
      console.log('Callback:', info.callback.split('\n')[0]); // First line of callback
      console.log('Stack trace:');
      console.log(formatStack(info.stack));
      console.groupEnd();
    });
  }
  console.groupEnd();
  
  // Document state
  console.group('Document State');
  console.log('Visibility:', document.visibilityState);
  console.log('Has Focus:', document.hasFocus());
  console.log('URL:', window.location.href);
  console.groupEnd();
  
  // Recent logs
  console.group('Recent Logs (10 most recent)');
  if (consoleLogs.length === 0) {
    console.log('No logs recorded');
  } else {
    consoleLogs.slice(-10).forEach((log, i) => {
      console.group(`Log ${i + 1} (${log.timestamp})`);
      console.log(...log.args);
      if (log.stack) {
        console.log('Stack trace:');
        console.log(formatStack(log.stack));
      }
      console.groupEnd();
    });
  }
  console.groupEnd();
  
  // Auth state
  console.group('Auth State');
  console.log('Has auth cookie:', document.cookie.includes('sessionid='));
  console.log('Has UID cookie:', document.cookie.includes('uid='));
  console.log('Has localStorage auth:', localStorage.getItem('isAuthenticated') === 'true');
  console.log('Has auth token:', !!localStorage.getItem('auth_token'));
  console.groupEnd();
  
  console.groupEnd(); // End main group
};

function trackFunctionCall(name, ...args) {
  const callInfo = {
    name,
    time: Date.now(),
    timestamp: new Date().toISOString(),
    args: args.map(arg => {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }),
    stack: new Error().stack
  };
  
  functionCalls.push(callInfo);
  if (functionCalls.length > MAX_FUNCTION_CALLS) {
    functionCalls.shift();
  }
  
  if (name === 'checkAuthState') {
    console.group(`[${functionCalls.length}] Auth check at ${callInfo.timestamp}`);
    console.log('Call stack:', callInfo.stack);
    console.log('Recent function calls:', functionCalls.slice(-5));
    console.groupEnd();
  }
}

// Override tracked functions
trackedFunctions.forEach(fnName => {
  if (window[fnName]) {
    const originalFn = window[fnName];
    window[fnName] = function(...args) {
      trackFunctionCall(fnName, ...args);
      return originalFn.apply(this, args);
    };
  }
});

// Update the visibility of the account deletion section based on authentication state
function updateAccountDeletionVisibility(isAuthenticated) {
  console.log('[ACCOUNT-DELETION] updateAccountDeletionVisibility called with isAuthenticated:', isAuthenticated);
  
  // Find the account deletion section and its auth-only wrapper
  const authOnlyWrapper = document.querySelector('#privacy-page .auth-only');
  const accountDeletionSection = document.getElementById('account-deletion');
  
  console.log('[ACCOUNT-DELETION] Elements found:', { 
    authOnlyWrapper: !!authOnlyWrapper, 
    accountDeletionSection: !!accountDeletionSection 
  });
  
  // Function to show an element with all necessary styles
  const showElement = (element) => {
    if (!element) return;
    
    console.log('[ACCOUNT-DELETION] Showing element:', element);
    
    // Remove any hiding classes
    element.classList.remove('hidden', 'auth-only-hidden');
    
    // Set all possible visibility properties
    element.style.display = 'block';
    element.style.visibility = 'visible';
    element.style.opacity = '1';
    element.style.height = 'auto';
    element.style.position = 'relative';
    element.style.clip = 'auto';
    element.style.overflow = 'visible';
    
    // Add a class to mark as visible
    element.classList.add('account-visible');
  };
  
  // Function to hide an element
  const hideElement = (element) => {
    if (!element) return;
    
    console.log('[ACCOUNT-DELETION] Hiding element:', element);
    
    // Set display to none to completely remove from layout
    element.style.display = 'none';
    
    // Remove any visibility-related classes
    element.classList.remove('account-visible');
  };
  
  if (isAuthenticated) {
    console.log('[ACCOUNT-DELETION] User is authenticated, checking if on privacy page');
    
      // Get the current page state - only show on #privacy-page
    const currentHash = window.location.hash;
    const isPrivacyPage = currentHash === '#privacy-page';
    
    console.log('[ACCOUNT-DELETION] Debug - Page State:', {
      isAuthenticated,
      currentHash,
      isPrivacyPage,
      documentTitle: document.title
    });
    
    if (isAuthenticated && isPrivacyPage) {
      console.log('[ACCOUNT-DELETION] On privacy page, showing account deletion section');
      
      // Show the auth wrapper and account deletion section
      if (authOnlyWrapper) {
        authOnlyWrapper.style.display = 'block';
        authOnlyWrapper.style.visibility = 'visible';
      }
      
      if (accountDeletionSection) {
        accountDeletionSection.style.display = 'block';
        accountDeletionSection.style.visibility = 'visible';
      }
    } else {
      console.log('[ACCOUNT-DELETION] Not on privacy page, hiding account deletion section');
      
      // Hide the account deletion section
      if (accountDeletionSection) {
        accountDeletionSection.style.display = 'none';
        accountDeletionSection.style.visibility = 'hidden';
      }
      
      // Only hide the auth wrapper if we're not on the privacy page
      if (authOnlyWrapper && !isPrivacyPage) {
        authOnlyWrapper.style.display = 'none';
        authOnlyWrapper.style.visibility = 'hidden';
      }
    }
    
    // Debug: Log the current state after updates
    if (accountDeletionSection) {
      console.log('[ACCOUNT-DELETION] Account deletion section state after show:', {
        display: window.getComputedStyle(accountDeletionSection).display,
        visibility: window.getComputedStyle(accountDeletionSection).visibility,
        classes: accountDeletionSection.className,
        parent: accountDeletionSection.parentElement ? {
          tag: accountDeletionSection.parentElement.tagName,
          classes: accountDeletionSection.parentElement.className,
          display: window.getComputedStyle(accountDeletionSection.parentElement).display
        } : 'no parent'
      });
    }
    
  } else {
    console.log('[ACCOUNT-DELETION] User is not authenticated, hiding account deletion section');
    
    // Hide the account deletion section but keep the auth-only wrapper for other potential content
    if (accountDeletionSection) {
      hideElement(accountDeletionSection);
    }
    
    // Only hide the auth-only wrapper if it doesn't contain other important content
    if (authOnlyWrapper) {
      const hasOtherContent = Array.from(authOnlyWrapper.children).some(
        child => child.id !== 'account-deletion' && child.offsetParent !== null
      );
      
      if (!hasOtherContent) {
        hideElement(authOnlyWrapper);
      }
    }
  }
  
  // Log final state for debugging
  console.log('[ACCOUNT-DELETION] Final state:', {
    authOnlyWrapper: authOnlyWrapper ? {
      display: window.getComputedStyle(authOnlyWrapper).display,
      visibility: window.getComputedStyle(authOnlyWrapper).visibility,
      classes: authOnlyWrapper.className
    } : 'not found',
    accountDeletionSection: accountDeletionSection ? {
      display: window.getComputedStyle(accountDeletionSection).display,
      visibility: window.getComputedStyle(accountDeletionSection).visibility,
      classes: accountDeletionSection.className,
      parent: accountDeletionSection.parentElement ? {
        tag: accountDeletionSection.parentElement.tagName,
        classes: accountDeletionSection.parentElement.className,
        display: window.getComputedStyle(accountDeletionSection.parentElement).display
      } : 'no parent'
    } : 'not found'
  });
}

// Check authentication state and update UI with caching and debouncing
function checkAuthState(force = false) {
  const now = Date.now();
  
  // Return cached value if still valid and not forcing a refresh
  if (!force && now - authStateCache.timestamp < authStateCache.ttl && authStateCache.value !== null) {
    return authStateCache.value;
  }
  
  // Debounce rapid calls
  if (now - lastAuthCheckTime < AUTH_CHECK_DEBOUNCE && !force) {
    return wasAuthenticated === true;
  }
  
  lastAuthCheckTime = now;
  authCheckCounter++;
  
  // Use a single check for authentication state
  let isAuthenticated = false;
  
  // Check the most likely indicators first for better performance
  isAuthenticated = 
    document.cookie.includes('isAuthenticated=') ||
    document.cookie.includes('uid=') ||
    localStorage.getItem('isAuthenticated') === 'true' ||
    !!localStorage.getItem('authToken');
    
  // Update cache
  authStateCache = {
    timestamp: now,
    value: isAuthenticated,
    ttl: isAuthenticated ? 30000 : 5000 // Longer TTL for authenticated users
  };

  if (DEBUG_AUTH_STATE && isAuthenticated !== wasAuthenticated) {
    console.log('Auth State Check:', {
      isAuthenticated,
      wasAuthenticated,
      cacheHit: !force && now - authStateCache.timestamp < authStateCache.ttl,
      cacheAge: now - authStateCache.timestamp
    });
  }
  
  // Only update if authentication state has changed
  if (isAuthenticated !== wasAuthenticated) {
    if (DEBUG_AUTH_STATE) {
      console.log('Auth state changed, updating navigation...');
    }
    
    // Update UI state
    if (isAuthenticated) {
      document.body.classList.add('authenticated');
      document.body.classList.remove('guest');
    } else {
      document.body.classList.remove('authenticated');
      document.body.classList.add('guest');
    }
    
    // Update navigation
    if (typeof injectNavigation === 'function') {
      injectNavigation(isAuthenticated);
    } else if (DEBUG_AUTH_STATE) {
      console.warn('injectNavigation function not found');
    }
    
    // Update account deletion section visibility
    updateAccountDeletionVisibility(isAuthenticated);
    
    // Update the tracked state
    wasAuthenticated = isAuthenticated;
    
    // Force reflow to ensure CSS updates
    void document.body.offsetHeight;
  }
  
  return isAuthenticated;
}

// Periodically check authentication state with optimized polling
function setupAuthStatePolling() {
  // Initial check with force to ensure we get the latest state
  checkAuthState(true);
  
  // Use a single interval for all checks
  const checkAndUpdate = () => {
    // Only force check if the page is visible
    checkAuthState(!document.hidden);
  };
  
  // Check every 30 seconds (reduced from previous implementation)
  const AUTH_CHECK_INTERVAL = 30000;
  setInterval(checkAndUpdate, AUTH_CHECK_INTERVAL);
  
  // Listen for storage events (like login/logout from other tabs)
  const handleStorageEvent = (e) => {
    if (['isAuthenticated', 'authToken', 'uid'].includes(e.key)) {
      checkAuthState(true); // Force check on relevant storage changes
    }
  };
  
  window.addEventListener('storage', handleStorageEvent);
  
  // Check auth state when page becomes visible
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      checkAuthState(true);
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Cleanup function
  return () => {
    window.removeEventListener('storage', handleStorageEvent);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}


// Function to handle page navigation
function handlePageNavigation() {
  const isAuthenticated = checkAuthState();
  updateAccountDeletionVisibility(isAuthenticated);
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Set up authentication state monitoring
  setupAuthStatePolling();
  
  // Handle magic link redirect if needed
  handleMagicLoginRedirect();
  
  // Initialize components
  initNavigation();
  
  // Initialize account deletion section visibility
  handlePageNavigation();
  
  // Listen for hash changes to update visibility when navigating
  window.addEventListener('hashchange', handlePageNavigation);
  
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
    const deleteAccountFromPrivacyBtn = document.getElementById('delete-account-from-privacy');
    
    const deleteAccount = async (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      if (!confirm('Are you sure you want to delete your account?\n\nThis action cannot be undone.')) {
        return;
      }
      
      // Show loading state
      const deleteBtn = e?.target.closest('button');
      const originalText = deleteBtn?.textContent || 'Delete My Account';
      if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Deleting...';
      }
      
      try {
        // Get UID from localStorage
        const uid = localStorage.getItem('uid');
        if (!uid) {
          throw new Error('User not authenticated. Please log in again.');
        }
        
        console.log('Sending delete account request for UID:', uid);
        const response = await fetch('/api/delete-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            uid: uid // Include UID in the request body
          })
        });
        
        console.log('Received response status:', response.status, response.statusText);
        
        // Try to parse response as JSON, but handle non-JSON responses
        let data;
        const text = await response.text();
        try {
          data = text ? JSON.parse(text) : {};
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError);
          console.log('Raw response text:', text);
          data = {};
        }
        
        if (response.ok) {
          console.log('Account deletion successful');
          showToast('✅ Account deleted successfully', 'success');
          // Clear local storage and redirect to home page after a short delay
          setTimeout(() => {
            localStorage.clear();
            window.location.href = '/';
          }, 1000);
        } else {
          console.error('Delete account failed:', { status: response.status, data });
          const errorMessage = data.detail || data.message || 
                             data.error || 
                             `Server returned ${response.status} ${response.statusText}`;
          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error('Error in deleteAccount:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
          error: error
        });
        
        // Try to extract a meaningful error message
        let errorMessage = 'Failed to delete account';
        if (error instanceof Error) {
          errorMessage = error.message || error.toString();
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object') {
          errorMessage = error.message || JSON.stringify(error);
        }
        
        showToast(`❌ ${errorMessage}`, 'error');
      } finally {
        // Restore button state
        if (deleteBtn) {
          deleteBtn.disabled = false;
          deleteBtn.textContent = originalText;
        }
      }
      };
      
      // Add event listeners to both delete account buttons
      if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', deleteAccount);
      }
      
      if (deleteAccountFromPrivacyBtn) {
        deleteAccountFromPrivacyBtn.addEventListener('click', deleteAccount);
      }
    
  }, 200); // End of setTimeout
});

// Logout function
async function logout(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  // If handleLogout is available in dashboard.js, use it for comprehensive logout
  if (typeof handleLogout === 'function') {
    try {
      await handleLogout(event);
    } catch (error) {
      console.error('Error during logout:', error);
      // Fall back to basic logout if handleLogout fails
      basicLogout();
    }
  } else {
    // Fallback to basic logout if handleLogout is not available
    basicLogout();
  }
}

// Basic client-side logout as fallback
function basicLogout() {
  // Clear authentication state
  document.body.classList.remove('authenticated');
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('uid');
  localStorage.removeItem('confirmed_uid');
  localStorage.removeItem('uid_time');
  localStorage.removeItem('authToken');
  
  // Clear all cookies with proper SameSite attribute
  document.cookie.split(';').forEach(cookie => {
    const [name] = cookie.trim().split('=');
    if (name) {
      document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; domain=${window.location.hostname}; SameSite=Lax`;
    }
  });
  
  // Stop any playing audio
  stopMainAudio();
  
  // Force a hard redirect to ensure all state is cleared
  window.location.href = '/';
}

// Add click handler for logout button
document.addEventListener('click', (e) => {
  if (e.target.id === 'logout-button' || e.target.closest('#logout-button')) {
    e.preventDefault();
    logout();
  }
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
