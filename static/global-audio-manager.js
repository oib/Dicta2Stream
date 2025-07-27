/**
 * Global Audio Manager
 * Coordinates audio playback between different components to ensure only one audio plays at a time
 */

class GlobalAudioManager {
  constructor() {
    this.currentPlayer = null; // 'streams' or 'personal' or null
    this.currentUid = null;
    this.listeners = new Set();
    
    // Bind methods
    this.startPlayback = this.startPlayback.bind(this);
    this.stopPlayback = this.stopPlayback.bind(this);
    this.addListener = this.addListener.bind(this);
    this.removeListener = this.removeListener.bind(this);
  }

  /**
   * Register a player that wants to start playback
   * @param {string} playerType - 'streams' or 'personal'
   * @param {string} uid - The UID being played
   * @param {Object} playerInstance - Reference to the player instance
   */
  startPlayback(playerType, uid, playerInstance = null) {
    // If the same player is already playing the same UID, allow it
    if (this.currentPlayer === playerType && this.currentUid === uid) {
      return true;
    }

    // Stop any currently playing audio
    if (this.currentPlayer && this.currentPlayer !== playerType) {
      this.notifyStop(this.currentPlayer);
    }

    // Update current state
    this.currentPlayer = playerType;
    this.currentUid = uid;
    
    console.log(`Global Audio Manager: ${playerType} player started playing UID: ${uid}`);
    return true;
  }

  /**
   * Notify that playback has stopped
   * @param {string} playerType - 'streams' or 'personal'
   */
  stopPlayback(playerType) {
    if (this.currentPlayer === playerType) {
      console.log(`Global Audio Manager: ${playerType} player stopped`);
      this.currentPlayer = null;
      this.currentUid = null;
    }
  }

  /**
   * Get current playback state
   */
  getCurrentState() {
    return {
      player: this.currentPlayer,
      uid: this.currentUid
    };
  }

  /**
   * Check if a specific player is currently active
   */
  isPlayerActive(playerType) {
    return this.currentPlayer === playerType;
  }

  /**
   * Add a listener for stop events
   * @param {string} playerType - 'streams' or 'personal'
   * @param {Function} callback - Function to call when this player should stop
   */
  addListener(playerType, callback) {
    const listener = { playerType, callback };
    this.listeners.add(listener);
    return listener;
  }

  /**
   * Remove a listener
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify a specific player type to stop
   */
  notifyStop(playerType) {
    console.log(`Global Audio Manager: Notifying ${playerType} player to stop`);
    this.listeners.forEach(listener => {
      if (listener.playerType === playerType) {
        try {
          listener.callback();
        } catch (error) {
          console.error(`Error calling stop callback for ${playerType}:`, error);
        }
      }
    });
  }

  /**
   * Force stop all playback
   */
  stopAll() {
    if (this.currentPlayer) {
      this.notifyStop(this.currentPlayer);
      this.currentPlayer = null;
      this.currentUid = null;
    }
  }
}

// Create singleton instance
export const globalAudioManager = new GlobalAudioManager();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  window.globalAudioManager = globalAudioManager;
}
