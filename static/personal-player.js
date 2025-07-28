import { showToast } from "./toast.js";
import { globalAudioManager } from './global-audio-manager.js';

// Module-level state for the personal player
let audio = null;

/**
 * Finds or creates the audio element for the personal stream.
 * @returns {HTMLAudioElement | null}
 */
function getOrCreateAudioElement() {
  if (audio) {
    return audio;
  }

  audio = document.createElement('audio');
  audio.id = 'me-audio';
  audio.preload = 'metadata';
  audio.crossOrigin = 'use-credentials';
  document.body.appendChild(audio);

  // --- Setup Event Listeners (only once) ---
  audio.addEventListener('error', (e) => {
    console.error('Personal Player: Audio Element Error', e);
    const error = audio.error;
    let errorMessage = 'An unknown audio error occurred.';
    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          errorMessage = 'Audio playback was aborted.';
          break;
        case error.MEDIA_ERR_NETWORK:
          errorMessage = 'A network error caused the audio to fail.';
          break;
        case error.MEDIA_ERR_DECODE:
          errorMessage = 'The audio could not be decoded.';
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'The audio format is not supported by your browser.';
          break;
        default:
          errorMessage = `An unexpected error occurred (Code: ${error.code}).`;
          break;
      }
    }
    showToast(errorMessage, 'error');
  });

  audio.addEventListener('play', () => updatePlayPauseButton(true));
  audio.addEventListener('pause', () => updatePlayPauseButton(false));
  audio.addEventListener('ended', () => updatePlayPauseButton(false));

  // The canplaythrough listener is removed as it violates autoplay policies.
  // The user will perform a second click to play the media after it's loaded.

  return audio;
}

/**
 * Updates the play/pause button icon based on audio state.
 * @param {boolean} isPlaying - Whether the audio is currently playing.
 */
function updatePlayPauseButton(isPlaying) {
  const playPauseBtn = document.querySelector('#me-page .play-pause-btn');
  if (playPauseBtn) {
    playPauseBtn.textContent = isPlaying ? '⏸️' : '▶️';
  }
}

/**
 * Loads the user's personal audio stream into the player.
 * @param {string} uid - The user's unique ID.
 */
export async function loadProfileStream(uid) {
  const audioElement = getOrCreateAudioElement();
  const audioSrc = `/audio/${uid}/stream.opus?t=${Date.now()}`;
  console.log(`[personal-player.js] Setting personal audio source to: ${audioSrc}`);
  audioElement.src = audioSrc;
}

/**
 * Initializes the personal audio player, setting up event listeners.
 */
export function initPersonalPlayer() {
  const mePageSection = document.getElementById('me-page');
  if (!mePageSection) return;

  // Use a delegated event listener for the play button
  mePageSection.addEventListener('click', (e) => {
    const playPauseBtn = e.target.closest('.play-pause-btn');
    if (!playPauseBtn) return;

    e.stopPropagation();
    const audio = getOrCreateAudioElement();
    if (!audio) return;

    try {
      if (audio.paused) {
        if (!audio.src || audio.src.endsWith('/#')) {
          showToast('No audio file available. Please upload one first.', 'info');
          return;
        }

        console.log('Attempting to play...');
        globalAudioManager.startPlayback('personal', localStorage.getItem('uid') || 'personal');

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error(`Initial play() failed: ${error.name}. This is expected on first load.`);
            // If play fails, it's because the content isn't loaded.
            // The recovery is to call load(). The user will need to click play again.
            console.log('Calling load() to fetch media...');
            audio.load();
            showToast('Stream is loading. Please click play again in a moment.', 'info');
          });
        }
      } else {
        console.log('Attempting to pause...');
        audio.pause();
      }
    } catch (err) {
      console.error('A synchronous error occurred in handlePlayPause:', err);
      showToast('An unexpected error occurred with the audio player.', 'error');
    }
  });

  // Listen for stop requests from the global manager
  globalAudioManager.addListener('personal', () => {
    console.log('[personal-player.js] Received stop request from global audio manager.');
    const audio = getOrCreateAudioElement();
    if (audio && !audio.paused) {
      console.log('[personal-player.js] Pausing personal audio player.');
      audio.pause();
    }
  });

  // Initial setup
  getOrCreateAudioElement();
}
