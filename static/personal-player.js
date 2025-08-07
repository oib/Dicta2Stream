import { showToast } from "./toast.js";
import { SharedAudioPlayer } from './shared-audio-player.js';

function getPersonalStreamUrl(uid) {
  return `/audio/${encodeURIComponent(uid)}/stream.opus`;
}

function updatePlayPauseButton(button, isPlaying) {
  if (button) button.textContent = isPlaying ? '⏸️' : '▶️';
  // Optionally, update other UI elements here
}

const personalPlayer = new SharedAudioPlayer({
  playerType: 'personal',
  getStreamUrl: getPersonalStreamUrl,
  onUpdateButton: updatePlayPauseButton
});

/**
 * Finds or creates the audio element for the personal stream.
 * @returns {HTMLAudioElement | null}
 */
function cleanupPersonalAudio() {
  if (audioElement) {
    try {
      if (audioElement._eventHandlers) {
        const { onPlay, onPause, onEnded, onError } = audioElement._eventHandlers;
        if (onPlay) audioElement.removeEventListener('play', onPlay);
        if (onPause) audioElement.removeEventListener('pause', onPause);
        if (onEnded) audioElement.removeEventListener('ended', onEnded);
        if (onError) audioElement.removeEventListener('error', onError);
      }
      audioElement.pause();
      audioElement.removeAttribute('src');
      audioElement.load();
      if (audioElement._eventHandlers) delete audioElement._eventHandlers;
      // Remove from DOM
      if (audioElement.parentNode) audioElement.parentNode.removeChild(audioElement);
    } catch (e) {
      console.warn('[personal-player.js] Error cleaning up audio element:', e);
    }
    audioElement = null;
  }
}



// Use the shared player for loading and playing the personal stream
export function loadProfileStream(uid, playPauseBtn) {
  if (!uid) {
    showToast('No UID provided for profile stream', 'error');
    return;
  }
  personalPlayer.play(uid, playPauseBtn);
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
    const uid = localStorage.getItem('uid');
    if (!uid) {
      showToast('Please log in to play audio.', 'error');
      return;
    }
    // Toggle play/pause
    if (personalPlayer.audioElement && !personalPlayer.audioElement.paused && !personalPlayer.audioElement.ended) {
      personalPlayer.pause();
    } else {
      loadProfileStream(uid, playPauseBtn);
    }
  });

  // Make loadProfileStream globally accessible for upload.js
  window.loadProfileStream = loadProfileStream;
}
