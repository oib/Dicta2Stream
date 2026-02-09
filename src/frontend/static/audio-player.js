/**
 * Audio Player Module
 * A shared audio player implementation based on the working "Your Stream" player
 */

import { globalAudioManager } from './global-audio-manager.js';

export class AudioPlayer {
  constructor() {
    // Audio state
    this.audioElement = null;
    this.currentUid = null;
    this.isPlaying = false;
    this.currentButton = null;
    this.audioUrl = '';
    this.lastPlayTime = 0;
    this.isLoading = false;
    this.loadTimeout = null; // For tracking loading timeouts
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 3000; // 3 seconds
    this.buffering = false;
    this.bufferRetryTimeout = null;
    this.lastLoadTime = 0;
    this.minLoadInterval = 2000; // 2 seconds between loads
    this.pendingLoad = false;
    
    // Create a single audio element that we'll reuse
    this.audioElement = new Audio();
    this.audioElement.preload = 'none';
    this.audioElement.crossOrigin = 'anonymous';
    
    // Bind methods
    this.loadAndPlay = this.loadAndPlay.bind(this);
    this.stop = this.stop.bind(this);
    this.cleanup = this.cleanup.bind(this);
    this.handlePlayError = this.handlePlayError.bind(this);
    this.handleStalled = this.handleStalled.bind(this);
    this.handleWaiting = this.handleWaiting.bind(this);
    this.handlePlaying = this.handlePlaying.bind(this);
    this.handleEnded = this.handleEnded.bind(this);
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Register with global audio manager to handle stop requests from other players
    globalAudioManager.addListener('personal', () => {
      console.log('[audio-player] Received stop request from global audio manager');
      this.stop();
    });
  }
  
  /**
   * Load and play audio for a specific UID
   * @param {string} uid - The user ID for the audio stream
   * @param {HTMLElement} button - The play/pause button element
   */
  /**
   * Validates that a UID is in the correct UUID format
   * @param {string} uid - The UID to validate
   * @returns {boolean} True if valid, false otherwise
   */
  isValidUuid(uid) {
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uid);
  }

  /**
   * Logs an error and updates the button state
   * @param {HTMLElement} button - The button to update
   * @param {string} message - Error message to log
   */
  handleError(button, message) {
    console.error(message);
    if (button) {
      this.updateButtonState(button, 'error');
    }
  }

  async loadAndPlay(uid, button) {
    const now = Date.now();
    
    // Prevent rapid successive load attempts
    if (this.pendingLoad || (now - this.lastLoadTime < this.minLoadInterval)) {
      console.log('[AudioPlayer] Skipping duplicate load request');
      return;
    }
    
    // Validate UID exists and is in correct format
    if (!uid) {
      this.handleError(button, 'No UID provided for audio playback');
      return;
    }
    
    // For logging purposes
    const requestId = Math.random().toString(36).substr(2, 8);
    console.log(`[AudioPlayer] Load request ${requestId} for UID: ${uid}`);
    
    this.pendingLoad = true;
    this.lastLoadTime = now;
    
    // If we're in the middle of loading, check if it's for the same UID
    if (this.isLoading) {
      // If same UID, ignore duplicate request
      if (this.currentUid === uid) {
        console.log(`[AudioPlayer] Already loading this UID, ignoring duplicate request: ${uid}`);
        this.pendingLoad = false;
        return;
      }
      // If different UID, queue the new request
      console.log(`[AudioPlayer] Already loading, queuing request for UID: ${uid}`);
      setTimeout(() => {
        this.pendingLoad = false;
        this.loadAndPlay(uid, button);
      }, 500);
      return;
    }
    
    // If we're in the middle of loading, check if it's for the same UID
    if (this.isLoading) {
      // If same UID, ignore duplicate request
      if (this.currentUid === uid) {
        console.log('Already loading this UID, ignoring duplicate request:', uid);
        return;
      }
      // If different UID, queue the new request
      console.log('Already loading, queuing request for UID:', uid);
      setTimeout(() => this.loadAndPlay(uid, button), 500);
      return;
    }

    // If already playing this stream, just toggle pause/play
    if (this.currentUid === uid && this.audioElement) {
      try {
        if (this.isPlaying) {
          console.log('Pausing current playback');
          try {
            this.audioElement.pause();
            this.lastPlayTime = this.audioElement.currentTime;
            this.isPlaying = false;
            this.updateButtonState(button, 'paused');
          } catch (pauseError) {
            console.warn('Error pausing audio, continuing with state update:', pauseError);
            this.isPlaying = false;
            this.updateButtonState(button, 'paused');
          }
        } else {
          console.log('Resuming playback from time:', this.lastPlayTime);
          try {
            // If we have a last play time, seek to it
            if (this.lastPlayTime > 0) {
              this.audioElement.currentTime = this.lastPlayTime;
            }
            await this.audioElement.play();
            this.isPlaying = true;
            this.updateButtonState(button, 'playing');
          } catch (playError) {
            console.error('Error resuming playback, reloading source:', playError);
            // If resume fails, try reloading the source
            this.currentUid = null; // Force reload of the source
            return this.loadAndPlay(uid, button);
          }
        }
        return;  // Exit after handling pause/resume
      } catch (error) {
        console.error('Error toggling playback:', error);
        this.updateButtonState(button, 'error');
        return;
      }
    }

    // If we get here, we're loading a new stream
    this.isLoading = true;
    this.currentUid = uid;
    this.currentButton = button;
    this.isPlaying = true;
    this.updateButtonState(button, 'loading');
    
    // Notify global audio manager that personal player is starting
    globalAudioManager.startPlayback('personal', uid);

    try {
      // Only clean up if switching streams
      if (this.currentUid !== uid) {
        this.cleanup();
      }
      
      // Store the current button reference
      this.currentButton = button;
      this.currentUid = uid;
      
      // Create a new audio element if we don't have one
      if (!this.audioElement) {
        this.audioElement = new Audio();
      } else if (this.audioElement.readyState > 0) {
        // If we already have a loaded source, just play it
        try {
          await this.audioElement.play();
          this.isPlaying = true;
          this.updateButtonState(button, 'playing');
          return;
        } catch (playError) {
          console.warn('Error playing existing source, will reload:', playError);
          // Continue to load a new source
        }
      }
      
      // Clear any existing sources
      while (this.audioElement.firstChild) {
        this.audioElement.removeChild(this.audioElement.firstChild);
      }

      // Set the source URL with proper encoding and cache-busting timestamp
      // Using the format: /audio/{uid}/stream.opus?t={timestamp}
      // Only update timestamp if we're loading a different UID or after a retry
      const timestamp = this.retryCount > 0 ? new Date().getTime() : this.lastLoadTime;
      this.audioUrl = `/audio/${encodeURIComponent(uid)}/stream.opus?t=${timestamp}`;
      console.log(`[AudioPlayer] Loading audio from URL: ${this.audioUrl} (attempt ${this.retryCount + 1}/${this.maxRetries})`);
      console.log('Loading audio from URL:', this.audioUrl);
      this.audioElement.src = this.audioUrl;
      
      // Load the new source (don't await, let canplay handle it)
      try {
        this.audioElement.load();
        // If load() doesn't throw, we'll wait for canplay event
      } catch (e) {
        // Ignore abort errors as they're expected during rapid toggling
        if (e.name !== 'AbortError') {
          console.error('Error loading audio source:', e);
          this.isLoading = false;
          this.updateButtonState(button, 'error');
        }
      }
      
      // Reset the current time when loading a new source
      this.audioElement.currentTime = 0;
      this.lastPlayTime = 0;
      
      // Set up error handling
      this.audioElement.onerror = (e) => {
        console.error('Audio element error:', e, this.audioElement.error);
        this.isLoading = false;
        this.updateButtonState(button, 'error');
      };
      
      // Handle when audio is ready to play
      const onCanPlay = () => {
        this.audioElement.removeEventListener('canplay', onCanPlay);
        this.isLoading = false;
        if (this.lastPlayTime > 0) {
          this.audioElement.currentTime = this.lastPlayTime;
        }
        this.audioElement.play().then(() => {
          this.isPlaying = true;
          this.updateButtonState(button, 'playing');
        }).catch(e => {
          console.error('Error playing after load:', e);
          this.updateButtonState(button, 'error');
        });
      };
      
      // Define the error handler
      const errorHandler = (e) => {
        console.error('Audio element error:', e, this.audioElement.error);
        this.isLoading = false;
        this.updateButtonState(button, 'error');
      };

      // Define the play handler
      const playHandler = () => {
        // Clear any pending timeouts
        if (this.loadTimeout) {
          clearTimeout(this.loadTimeout);
          this.loadTimeout = null;
        }
        
        this.audioElement.removeEventListener('canplay', playHandler);
        this.isLoading = false;
        
        if (this.lastPlayTime > 0) {
          this.audioElement.currentTime = this.lastPlayTime;
        }
        
        this.audioElement.play().then(() => {
          this.isPlaying = true;
          this.updateButtonState(button, 'playing');
        }).catch(e => {
          console.error('Error playing after load:', e);
          this.isPlaying = false;
          this.updateButtonState(button, 'error');
        });
      };

      // Add event listeners
      this.audioElement.addEventListener('error', errorHandler, { once: true });
      this.audioElement.addEventListener('canplay', playHandler, { once: true });
      
      // Load and play the new source
      try {
        await this.audioElement.load();
        // Don't await play() here, let the canplay handler handle it
        
        // Set a timeout to handle cases where canplay doesn't fire
        this.loadTimeout = setTimeout(() => {
          if (this.isLoading) {
            console.warn('Audio loading timed out for UID:', uid);
            this.isLoading = false;
            this.updateButtonState(button, 'error');
          }
        }, 10000); // 10 second timeout
        
      } catch (e) {
        console.error('Error loading audio:', e);
        this.isLoading = false;
        this.updateButtonState(button, 'error');
        
        // Clear any pending timeouts
        if (this.loadTimeout) {
          clearTimeout(this.loadTimeout);
          this.loadTimeout = null;
        }
      }
      
    } catch (error) {
      console.error('Error in loadAndPlay:', error);
      
      // Only cleanup and show error if we're still on the same track
      if (this.currentUid === uid) {
        this.cleanup();
        this.updateButtonState(button, 'error');
      }
    }
  }
  
  /**
   * Stop playback and clean up resources
   */
  stop() {
    try {
      if (this.audioElement) {
        console.log('Stopping audio playback');
        this.audioElement.pause();
        this.lastPlayTime = this.audioElement.currentTime;
        this.isPlaying = false;
        
        // Notify global audio manager that personal player has stopped
        globalAudioManager.stopPlayback('personal');
        
        if (this.currentButton) {
          this.updateButtonState(this.currentButton, 'paused');
        }
      }
    } catch (error) {
      console.error('Error stopping audio:', error);
      // Don't throw, just log the error
    }
  }
  
  /**
   * Set up event listeners for the audio element
   */
  setupEventListeners() {
    if (!this.audioElement) return;
    
    // Remove any existing listeners to prevent duplicates
    this.audioElement.removeEventListener('error', this.handlePlayError);
    this.audioElement.removeEventListener('stalled', this.handleStalled);
    this.audioElement.removeEventListener('waiting', this.handleWaiting);
    this.audioElement.removeEventListener('playing', this.handlePlaying);
    this.audioElement.removeEventListener('ended', this.handleEnded);
    
    // Add new listeners
    this.audioElement.addEventListener('error', this.handlePlayError);
    this.audioElement.addEventListener('stalled', this.handleStalled);
    this.audioElement.addEventListener('waiting', this.handleWaiting);
    this.audioElement.addEventListener('playing', this.handlePlaying);
    this.audioElement.addEventListener('ended', this.handleEnded);
  }

  /**
   * Handle play errors
   */
  handlePlayError(event) {
    console.error('[AudioPlayer] Playback error:', {
      event: event.type,
      error: this.audioElement.error,
      currentTime: this.audioElement.currentTime,
      readyState: this.audioElement.readyState,
      networkState: this.audioElement.networkState,
      src: this.audioElement.src
    });
    
    this.isPlaying = false;
    this.buffering = false;
    this.pendingLoad = false;
    
    if (this.currentButton) {
      this.updateButtonState(this.currentButton, 'error');
    }
    
    // Auto-retry logic
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`Retrying playback (attempt ${this.retryCount}/${this.maxRetries})...`);
      
      setTimeout(() => {
        if (this.currentUid && this.currentButton) {
          this.loadAndPlay(this.currentUid, this.currentButton);
        }
      }, this.retryDelay);
    } else {
      console.error('Max retry attempts reached');
      this.retryCount = 0; // Reset for next time
    }
  }

  /**
   * Handle stalled audio (buffering issues)
   */
  handleStalled() {
    console.log('[AudioPlayer] Playback stalled, attempting to recover...');
    this.buffering = true;
    
    if (this.bufferRetryTimeout) {
      clearTimeout(this.bufferRetryTimeout);
    }
    
    this.bufferRetryTimeout = setTimeout(() => {
      if (this.buffering) {
        console.log('[AudioPlayer] Buffer recovery timeout, attempting to reload...');
        if (this.currentUid && this.currentButton) {
          // Only retry if we're still supposed to be playing
          if (this.isPlaying) {
            this.retryCount++;
            if (this.retryCount <= this.maxRetries) {
              console.log(`[AudioPlayer] Retry ${this.retryCount}/${this.maxRetries} for UID: ${this.currentUid}`);
              this.loadAndPlay(this.currentUid, this.currentButton);
            } else {
              console.error('[AudioPlayer] Max retry attempts reached');
              this.retryCount = 0;
              this.updateButtonState(this.currentButton, 'error');
            }
          }
        }
      }
    }, 5000); // 5 second buffer recovery timeout
  }

  /**
   * Handle waiting event (buffering)
   */
  handleWaiting() {
    console.log('Audio waiting for data...');
    this.buffering = true;
    if (this.currentButton) {
      this.updateButtonState(this.currentButton, 'loading');
    }
  }

  /**
   * Handle playing event (playback started/resumed)
   */
  handlePlaying() {
    console.log('Audio playback started/resumed');
    this.buffering = false;
    this.retryCount = 0; // Reset retry counter on successful playback
    if (this.bufferRetryTimeout) {
      clearTimeout(this.bufferRetryTimeout);
      this.bufferRetryTimeout = null;
    }
    if (this.currentButton) {
      this.updateButtonState(this.currentButton, 'playing');
    }
  }

  /**
   * Handle ended event (playback completed)
   */
  handleEnded() {
    console.log('Audio playback ended');
    this.isPlaying = false;
    this.buffering = false;
    if (this.currentButton) {
      this.updateButtonState(this.currentButton, 'paused');
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Clear any pending timeouts
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = null;
    }
    
    if (this.bufferRetryTimeout) {
      clearTimeout(this.bufferRetryTimeout);
      this.bufferRetryTimeout = null;
    }
    
    // Update button state if we have a reference to the current button
    if (this.currentButton) {
      this.updateButtonState(this.currentButton, 'paused');
    }
    
    // Pause the audio and store the current time
    if (this.audioElement) {
      try {
        // Remove event listeners to prevent memory leaks
        this.audioElement.removeEventListener('error', this.handlePlayError);
        this.audioElement.removeEventListener('stalled', this.handleStalled);
        this.audioElement.removeEventListener('waiting', this.handleWaiting);
        this.audioElement.removeEventListener('playing', this.handlePlaying);
        this.audioElement.removeEventListener('ended', this.handleEnded);
        
        try {
          this.audioElement.pause();
          this.lastPlayTime = this.audioElement.currentTime;
        } catch (e) {
          console.warn('Error pausing audio during cleanup:', e);
        }
        
        try {
          // Clear any existing sources
          while (this.audioElement.firstChild) {
            this.audioElement.removeChild(this.audioElement.firstChild);
          }
          
          // Clear the source and reset the audio element
          this.audioElement.removeAttribute('src');
          try {
            this.audioElement.load();
          } catch (e) {
            console.warn('Error in audio load during cleanup:', e);
          }
        } catch (e) {
          console.warn('Error cleaning up audio sources:', e);
        }
      } catch (e) {
        console.warn('Error during audio cleanup:', e);
      }
    }
    
    // Reset state
    this.currentUid = null;
    this.currentButton = null;
    this.audioUrl = '';
    this.isPlaying = false;
    this.buffering = false;
    this.retryCount = 0;
    
    // Notify global audio manager that personal player has stopped
    globalAudioManager.stopPlayback('personal');
  }
  
  /**
   * Update the state of a play/pause button
   * @param {HTMLElement} button - The button to update
   * @param {string} state - The state to set ('playing', 'paused', 'loading', 'error')
   */
  updateButtonState(button, state) {
    if (!button) return;
    
    // Only update the current button's state
    if (state === 'playing') {
      // If this button is now playing, update all buttons
      document.querySelectorAll('.play-pause-btn').forEach(btn => {
        btn.classList.remove('playing', 'paused', 'loading', 'error');
        if (btn === button) {
          btn.classList.add('playing');
        } else {
          btn.classList.add('paused');
        }
      });
    } else {
      // For other states, just update the target button
      button.classList.remove('playing', 'paused', 'loading', 'error');
      if (state) {
        button.classList.add(state);
      }
    }
    
    // Update button icon and aria-label for the target button
    const icon = button.querySelector('i');
    if (icon) {
      if (state === 'playing') {
        icon.className = 'fas fa-pause';
        button.setAttribute('aria-label', 'Pause');
      } else {
        icon.className = 'fas fa-play';
        button.setAttribute('aria-label', 'Play');
      }
    }
  }
}

// Create a singleton instance
export const audioPlayer = new AudioPlayer();

// Export utility functions for direct use
export function initAudioPlayer(container = document) {
  // Set up event delegation for play/pause buttons
  container.addEventListener('click', (e) => {
    const playButton = e.target.closest('.play-pause-btn');
    if (!playButton) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const uid = playButton.dataset.uid;
    if (!uid) return;
    
    audioPlayer.loadAndPlay(uid, playButton);
  });
  
  // Set up event delegation for stop buttons if they exist
  container.addEventListener('click', (e) => {
    const stopButton = e.target.closest('.stop-btn');
    if (!stopButton) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    audioPlayer.stop();
  });
}

// Auto-initialize if this is the main module
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initAudioPlayer();
  });
}
