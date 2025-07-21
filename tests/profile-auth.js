/**
 * Authentication Profiling Tool for dicta2stream
 * 
 * This script profiles the authentication-related operations during navigation
 * to identify performance bottlenecks in the logged-in experience.
 * 
 * Usage:
 * 1. Open browser console (F12 → Console)
 * 2. Copy and paste this entire script
 * 3. Run: profileAuthNavigation()
 */

(function() {
  'use strict';

  // Store original methods we want to profile
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  // Track authentication-related operations with detailed metrics
  const authProfile = {
    // Core metrics
    startTime: null,
    operations: [],
    navigationEvents: [],
    
    // Counters
    fetchCount: 0,
    xhrCount: 0,
    domUpdates: 0,
    authChecks: 0,
    
    // Performance metrics
    totalTime: 0,
    maxFrameTime: 0,
    longTasks: [],
    
    // Memory tracking
    memorySamples: [],
    maxMemory: 0,
    
    // Navigation tracking
    currentNavigation: null,
    navigationStart: null
  };
  
  // Track long tasks and performance metrics
  if (window.PerformanceObserver) {
    // Check which entry types are supported
    const supportedEntryTypes = PerformanceObserver.supportedEntryTypes || [];
    
    // Only set up observers for supported types
    const perfObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        // Track any task longer than 50ms as a long task
        if (entry.duration > 50) {
          authProfile.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
            name: entry.name || 'unknown',
            type: entry.entryType
          });
        }
      }
    });
    
    // Try to observe supported entry types
    try {
      // Check for longtask support (not available in all browsers)
      if (supportedEntryTypes.includes('longtask')) {
        perfObserver.observe({ entryTypes: ['longtask'] });
      }
      
      // Always try to observe paint timing
      try {
        if (supportedEntryTypes.includes('paint')) {
          perfObserver.observe({ entryTypes: ['paint'] });
        } else {
          // Fallback to buffered paint observation
          perfObserver.observe({ type: 'paint', buffered: true });
        }
      } catch (e) {
        console.debug('Paint timing not supported:', e.message);
      }
      
    } catch (e) {
      console.debug('Performance observation not supported:', e.message);
    }
  }

  // Instrument fetch API
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    const isAuthRelated = isAuthOperation(url);
    
    if (isAuthRelated) {
      const start = performance.now();
      authProfile.fetchCount++;
      
      try {
        const response = await originalFetch.apply(this, args);
        const duration = performance.now() - start;
        
        authProfile.operations.push({
          type: 'fetch',
          url,
          duration,
          timestamp: new Date().toISOString(),
          status: response.status,
          size: response.headers.get('content-length') || 'unknown'
        });
        
        return response;
      } catch (error) {
        const duration = performance.now() - start;
        authProfile.operations.push({
          type: 'fetch',
          url,
          duration,
          timestamp: new Date().toISOString(),
          error: error.message,
          status: 'error'
        });
        throw error;
      }
    }
    
    return originalFetch.apply(this, args);
  };

  // Instrument XHR
  XMLHttpRequest.prototype.open = function(method, url) {
    this._authProfile = isAuthOperation(url);
    if (this._authProfile) {
      this._startTime = performance.now();
      this._url = url;
      authProfile.xhrCount++;
    }
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    if (this._authProfile) {
      this.addEventListener('load', () => {
        const duration = performance.now() - this._startTime;
        authProfile.operations.push({
          type: 'xhr',
          url: this._url,
          duration,
          timestamp: new Date().toISOString(),
          status: this.status,
          size: this.getResponseHeader('content-length') || 'unknown'
        });
      });
      
      this.addEventListener('error', (error) => {
        const duration = performance.now() - this._startTime;
        authProfile.operations.push({
          type: 'xhr',
          url: this._url,
          duration,
          timestamp: new Date().toISOString(),
          error: error.message,
          status: 'error'
        });
      });
    }
    
    return originalXHRSend.apply(this, arguments);
  };

  // Track DOM updates after navigation with more details
  const observer = new MutationObserver((mutations) => {
    if (document.body.classList.contains('authenticated')) {
      const now = performance.now();
      const updateInfo = {
        timestamp: now,
        mutations: mutations.length,
        addedNodes: 0,
        removedNodes: 0,
        attributeChanges: 0,
        characterDataChanges: 0
      };
      
      mutations.forEach(mutation => {
        updateInfo.addedNodes += mutation.addedNodes.length || 0;
        updateInfo.removedNodes += mutation.removedNodes.length || 0;
        updateInfo.attributeChanges += mutation.type === 'attributes' ? 1 : 0;
        updateInfo.characterDataChanges += mutation.type === 'characterData' ? 1 : 0;
      });
      
      authProfile.domUpdates += mutations.length;
      
      // Track memory usage if supported
      if (window.performance && window.performance.memory) {
        updateInfo.memoryUsed = performance.memory.usedJSHeapSize;
        updateInfo.memoryTotal = performance.memory.totalJSHeapSize;
        updateInfo.memoryLimit = performance.memory.jsHeapSizeLimit;
        
        authProfile.memorySamples.push({
          timestamp: now,
          memory: performance.memory.usedJSHeapSize
        });
        
        authProfile.maxMemory = Math.max(
          authProfile.maxMemory, 
          performance.memory.usedJSHeapSize
        );
      }
      
      // Track frame time
      requestAnimationFrame(() => {
        const frameTime = performance.now() - now;
        authProfile.maxFrameTime = Math.max(authProfile.maxFrameTime, frameTime);
      });
    }
  });

  // Track authentication state changes
  const originalAddClass = DOMTokenList.prototype.add;
  const originalRemoveClass = DOMTokenList.prototype.remove;

  DOMTokenList.prototype.add = function(...args) {
    if (this === document.body.classList && args[0] === 'authenticated') {
      authProfile.authChecks++;
      if (!authProfile.startTime) {
        authProfile.startTime = performance.now();
        observer.observe(document.body, { 
          childList: true, 
          subtree: true,
          attributes: true,
          characterData: true
        });
      }
    }
    return originalAddClass.apply(this, args);
  };

  DOMTokenList.prototype.remove = function(...args) {
    if (this === document.body.classList && args[0] === 'authenticated') {
      authProfile.totalTime = performance.now() - (authProfile.startTime || performance.now());
      observer.disconnect();
    }
    return originalRemoveClass.apply(this, args);
  };

  // Helper to identify auth-related operations
  function isAuthOperation(url) {
    if (!url) return false;
    const authKeywords = [
      'auth', 'login', 'session', 'token', 'user', 'profile',
      'me', 'account', 'verify', 'validate', 'check'
    ];
    return authKeywords.some(keyword => 
      url.toLowerCase().includes(keyword)
    );
  }

  // Main function to run the profile
  window.profileAuthNavigation = async function() {
    // Reset profile with all metrics
    Object.assign(authProfile, {
      startTime: null,
      operations: [],
      navigationEvents: [],
      fetchCount: 0,
      xhrCount: 0,
      domUpdates: 0,
      authChecks: 0,
      totalTime: 0,
      maxFrameTime: 0,
      longTasks: [],
      memorySamples: [],
      maxMemory: 0,
      currentNavigation: null,
      navigationStart: null
    });
    
    // Track navigation events
    if (window.performance) {
      const navObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.entryType === 'navigation') {
            authProfile.navigationEvents.push({
              type: 'navigation',
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
              domComplete: entry.domComplete,
              domContentLoaded: entry.domContentLoadedEventEnd,
              load: entry.loadEventEnd
            });
          }
        });
      });
      
      try {
        navObserver.observe({ entryTypes: ['navigation'] });
      } catch (e) {
        console.warn('Navigation timing not supported:', e);
      }
    }

    console.log('Starting authentication navigation profile...');
    console.log('1. Navigate to a few pages while logged in');
    console.log('2. Run getAuthProfile() to see the results');
    console.log('3. Run resetAuthProfile() to start over');

    // Add global accessor
    window.getAuthProfile = function() {
      const now = performance.now();
      const duration = authProfile.startTime ? (now - authProfile.startTime) / 1000 : 0;
      
      console.log('%c\n=== AUTHENTICATION PROFILE RESULTS ===', 'font-weight:bold;font-size:1.2em');
      
      // Summary
      console.log('\n%c--- PERFORMANCE SUMMARY ---', 'font-weight:bold');
      console.log(`Total Monitoring Time: ${duration.toFixed(2)}s`);
      console.log(`Authentication Checks: ${authProfile.authChecks}`);
      console.log(`Fetch API Calls: ${authProfile.fetchCount}`);
      console.log(`XHR Requests: ${authProfile.xhrCount}`);
      console.log(`DOM Updates: ${authProfile.domUpdates}`);
      console.log(`Max Frame Time: ${authProfile.maxFrameTime.toFixed(2)}ms`);
      
      // Memory usage
      if (authProfile.memorySamples.length > 0) {
        const lastMem = authProfile.memorySamples[authProfile.memorySamples.length - 1];
        console.log(`\n%c--- MEMORY USAGE ---`, 'font-weight:bold');
        console.log(`Max Memory Used: ${(authProfile.maxMemory / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Current Memory: ${(lastMem.memory / 1024 / 1024).toFixed(2)} MB`);
      }
      
      // Long tasks
      if (authProfile.longTasks.length > 0) {
        console.log(`\n%c--- LONG TASKS (${authProfile.longTasks.length} > 50ms) ---`, 'font-weight:bold');
        authProfile.longTasks
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 5)
          .forEach((task, i) => {
            console.log(`#${i + 1} ${task.name}: ${task.duration.toFixed(2)}ms`);
          });
      }
      
      // Slow operations
      if (authProfile.operations.length > 0) {
        console.log('\n%c--- SLOW OPERATIONS ---', 'font-weight:bold');
        const sortedOps = [...authProfile.operations].sort((a, b) => b.duration - a.duration);
        sortedOps.slice(0, 10).forEach((op, i) => {
          const memUsage = op.memory ? ` | +${(op.memory / 1024).toFixed(2)}KB` : '';
          console.log(`#${i + 1} [${op.type.toUpperCase()}] ${op.url || 'unknown'}: ${op.duration.toFixed(2)}ms${memUsage}`);
        });
      }
      
      return authProfile;
    };

    window.resetAuthProfile = function() {
      Object.assign(authProfile, {
        startTime: null,
        operations: [],
        fetchCount: 0,
        xhrCount: 0,
        domUpdates: 0,
        authChecks: 0,
        totalTime: 0
      });
      console.log('Authentication profile has been reset');
    };
  };

  console.log('Authentication profiler loaded. Run profileAuthNavigation() to start.');
})();
