// shared-audio-player.js
// Unified audio player logic for both streams and personal player

import { globalAudioManager } from './global-audio-manager.js';

export class SharedAudioPlayer {
  constructor({ playerType, getStreamUrl, onUpdateButton }) {
    this.playerType = playerType; // 'streams' or 'personal'
    this.getStreamUrl = getStreamUrl; // function(uid) => url
    this.onUpdateButton = onUpdateButton; // function(button, isPlaying)
    this.audioElement = null;
    this.currentUid = null;
    this.isPlaying = false;
    this.currentButton = null;
    this._eventHandlers = {};

    // Register stop listener
    globalAudioManager.addListener(playerType, () => {
      this.stop();
    });
  }

  pause() {
    if (this.audioElement && !this.audioElement.paused && !this.audioElement.ended) {
      this.audioElement.pause();
      this.isPlaying = false;
      if (this.onUpdateButton && this.currentButton) {
        this.onUpdateButton(this.currentButton, false);
      }
    }
  }

  async play(uid, button) {
    const ctx = `[SharedAudioPlayer][${this.playerType}]${uid ? `[${uid}]` : ''}`;
    const isSameUid = this.currentUid === uid;
    const isActive = this.audioElement && !this.audioElement.paused && !this.audioElement.ended;

    // Guard: If already playing the requested UID and not paused/ended, do nothing
    if (isSameUid && isActive) {
      if (this.onUpdateButton) this.onUpdateButton(button || this.currentButton, true);
      return;
    }

    // If same UID but paused, resume
    if (isSameUid && this.audioElement && this.audioElement.paused && !this.audioElement.ended) {
      try {
        await this.audioElement.play();
        this.isPlaying = true;
        if (this.onUpdateButton) this.onUpdateButton(button || this.currentButton, true);
        globalAudioManager.startPlayback(this.playerType, uid);
      } catch (err) {
        this.isPlaying = false;
        if (this.onUpdateButton) this.onUpdateButton(button || this.currentButton, false);
        console.error(`${ctx} play() resume failed:`, err);
      }
      return;
    }

    // Otherwise, stop current and start new
    if (!isSameUid && this.audioElement) {
    } else {
    }
    this.stop();
    this.currentUid = uid;
    this.currentButton = button;
    const url = this.getStreamUrl(uid);
    this.audioElement = new Audio(url);
    this.audioElement.preload = 'auto';
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.style.display = 'none';
    document.body.appendChild(this.audioElement);
    this._attachEventHandlers();
    try {
      await this.audioElement.play();
      this.isPlaying = true;
      if (this.onUpdateButton) this.onUpdateButton(button, true);
      globalAudioManager.startPlayback(this.playerType, uid);
    } catch (err) {
      this.isPlaying = false;
      if (this.onUpdateButton) this.onUpdateButton(button, false);
      console.error(`${ctx} play() failed:`, err);
    }
  }

  stop() {
    if (this.audioElement) {
      this._removeEventHandlers();
      try {
        this.audioElement.pause();
        this.audioElement.removeAttribute('src');
        this.audioElement.load();
        if (this.audioElement.parentNode) {
          this.audioElement.parentNode.removeChild(this.audioElement);
        }
      } catch (e) {
        console.warn('[shared-audio-player] Error cleaning up audio element:', e);
      }
      this.audioElement = null;
    }
    this.isPlaying = false;
    this.currentUid = null;
    if (this.currentButton && this.onUpdateButton) {
      this.onUpdateButton(this.currentButton, false);
    }
    this.currentButton = null;
  }

  _attachEventHandlers() {
    if (!this.audioElement) return;
    const ctx = `[SharedAudioPlayer][${this.playerType}]${this.currentUid ? `[${this.currentUid}]` : ''}`;
    const logEvent = (event) => {
      // Debug logging disabled
    };
    // Core handlers
    const onPlay = (e) => {
      logEvent(e);
      this.isPlaying = true;
      if (this.currentButton && this.onUpdateButton) this.onUpdateButton(this.currentButton, true);
    };
    const onPause = (e) => {
      logEvent(e);
      // console.trace(`${ctx} Audio pause stack trace:`);
      this.isPlaying = false;
      if (this.currentButton && this.onUpdateButton) this.onUpdateButton(this.currentButton, false);
    };
    const onEnded = (e) => {
      logEvent(e);
      this.isPlaying = false;
      if (this.currentButton && this.onUpdateButton) this.onUpdateButton(this.currentButton, false);
    };
    const onError = (e) => {
      logEvent(e);
      this.isPlaying = false;
      if (this.currentButton && this.onUpdateButton) this.onUpdateButton(this.currentButton, false);
      console.error(`${ctx} Audio error:`, e);
    };
    // Attach handlers
    this.audioElement.addEventListener('play', onPlay);
    this.audioElement.addEventListener('pause', onPause);
    this.audioElement.addEventListener('ended', onEnded);
    this.audioElement.addEventListener('error', onError);
    // Attach debug logging for all relevant events
    const debugEvents = [
      'abort','canplay','canplaythrough','durationchange','emptied','encrypted','loadeddata','loadedmetadata',
      'loadstart','playing','progress','ratechange','seeked','seeking','stalled','suspend','timeupdate','volumechange','waiting'
    ];
    debugEvents.forEach(evt => {
      this.audioElement.addEventListener(evt, logEvent);
    }); // Logging now disabled
    this._eventHandlers = { onPlay, onPause, onEnded, onError, debugEvents, logEvent };
  }

  _removeEventHandlers() {
    if (!this.audioElement || !this._eventHandlers) return;
    const { onPlay, onPause, onEnded, onError } = this._eventHandlers;
    if (onPlay) this.audioElement.removeEventListener('play', onPlay);
    if (onPause) this.audioElement.removeEventListener('pause', onPause);
    if (onEnded) this.audioElement.removeEventListener('ended', onEnded);
    if (onError) this.audioElement.removeEventListener('error', onError);
    this._eventHandlers = {};
  }
}
