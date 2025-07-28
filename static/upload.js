// upload.js — Frontend file upload handler

import { showToast } from "./toast.js";
import { playBeep } from "./sound.js";
import { logToServer } from "./logger.js";

// Initialize upload system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const dropzone = document.getElementById("user-upload-area");
  if (dropzone) {
    dropzone.setAttribute("aria-label", "Upload area. Click or drop an audio file to upload.");
  }
  const fileInput = document.getElementById("fileInputUser");
  const fileInfo = document.createElement("div");
  fileInfo.id = "file-info";
  fileInfo.style.textAlign = "center";
  if (fileInput) {
    fileInput.parentNode.insertBefore(fileInfo, fileInput.nextSibling);
  }
  const streamInfo = document.getElementById("stream-info");
  const streamUrlEl = document.getElementById("streamUrl");
  const spinner = document.getElementById("spinner") || { style: { display: 'none' } };
  let abortController;

  // Upload function
  const upload = async (file) => {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    fileInfo.innerText = `📁 ${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    if (file.size > 100 * 1024 * 1024) {
      showToast("❌ File too large. Please upload a file smaller than 100MB.");
      return;
    }
    spinner.style.display = "block";
    showToast('📡 Uploading…');

    fileInput.disabled = true;
    dropzone.classList.add("uploading");
    const formData = new FormData();
    const sessionUid = localStorage.getItem("uid");
    formData.append("uid", sessionUid);
    formData.append("file", file);

    const res = await fetch("/upload", {
      signal: abortController.signal,
      method: "POST",
      body: formData,
    });

    let data, parseError;
    try {
      data = await res.json();
    } catch (e) {
      parseError = e;
    }
    if (!data) {
      showToast("❌ Upload failed: " + (parseError && parseError.message ? parseError.message : "Unknown error"));
      spinner.style.display = "none";
      fileInput.disabled = false;
      dropzone.classList.remove("uploading");
      return;
    }
    if (res.ok) {
      if (data.quota && data.quota.used_mb !== undefined) {
        const bar = document.getElementById("quota-bar");
        const text = document.getElementById("quota-text");
        const quotaSec = document.getElementById("quota-meter");
        if (bar && text && quotaSec) {
          quotaSec.hidden = false;
          const used = parseFloat(data.quota.used_mb);
          bar.value = used;
          bar.max = 100;
          text.textContent = `${used.toFixed(1)} MB used`;
        }
      }
      spinner.style.display = "none";
      fileInput.disabled = false;
      dropzone.classList.remove("uploading");
      showToast("✅ Upload successful.");

      // Refresh the audio player and file list
      const uid = localStorage.getItem("uid");
      if (uid) {
        try {
          if (window.loadProfileStream) {
            await window.loadProfileStream(uid);
          }
          // Refresh the file list
          if (window.fetchAndDisplayFiles) {
            await window.fetchAndDisplayFiles(uid);
          }
          
          // Refresh the stream list to update the last update time
          if (window.refreshStreamList) {
            await window.refreshStreamList();
          }
        } catch (e) {
          console.error('Failed to refresh:', e);
        }
      }

      playBeep(432, 0.25, "sine");
    } else {
      if (streamInfo) streamInfo.hidden = true;
      if (spinner) spinner.style.display = "none";
      if ((data.detail || data.error || "").includes("music")) {
        showToast("🎵 Upload rejected: singing or music detected.");
      } else {
        showToast(`❌ Upload failed: ${data.detail || data.error}`);
      }

      if (fileInput) fileInput.value = null;
      if (dropzone) dropzone.classList.remove("uploading");
      if (fileInput) fileInput.disabled = false;
      if (streamInfo) streamInfo.classList.remove("visible", "slide-in");
    }
  };

  // Function to fetch and display uploaded files
  async function fetchAndDisplayFiles(uidFromParam) {
    console.log('[UPLOAD] fetchAndDisplayFiles called with uid:', uidFromParam);
    
    // Get the file list element
    const fileList = document.getElementById('file-list');
    if (!fileList) {
      const errorMsg = 'File list element not found in DOM';
      console.error(errorMsg);
      return showErrorInUI(errorMsg);
    }

    // Get UID from parameter, localStorage, or cookie
    const uid = uidFromParam || localStorage.getItem('uid') || getCookie('uid');
    const authToken = localStorage.getItem('authToken');
    const headers = {
      'Accept': 'application/json',
    };
  
    // Include auth token in headers if available, but don't fail if it's not
    // The server should handle both token-based and UID-based auth
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    } else {
      console.debug('[UPLOAD] No auth token available, using UID-only authentication');
    }

    console.log('[UPLOAD] Auth state - UID:', uid, 'Token exists:', !!authToken);

    if (!uid) {
      console.error('[UPLOAD] No UID found in any source');
      fileList.innerHTML = '<li class="error-message">User session expired. Please refresh the page.</li>';
      return;
    }

    // Log the authentication method being used
    if (!authToken) {
      console.debug('[UPLOAD] No auth token found, using UID-only authentication');
    } else {
      console.debug('[UPLOAD] Using token-based authentication');
    }

    // Show loading state
    fileList.innerHTML = '<li class="loading-message">Loading files...</li>';

    try {
      console.log(`[DEBUG] Fetching files for user: ${uid}`);
      const response = await fetch(`/me/${uid}`, {
        headers: {
          'Authorization': authToken ? `Bearer ${authToken}` : '',
          'Content-Type': 'application/json',
        },
      });
      console.log('[DEBUG] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        const errorMsg = `Failed to fetch files: ${response.status} ${response.statusText} - ${errorText}`;
        console.error(`[ERROR] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      const data = await response.json();
      console.log('[DEBUG] Received files data:', data);
      
      if (!data.files) {
        throw new Error('Invalid response format: missing files array');
      }
      
      if (data.files.length > 0) {
        // Sort files by name
        const sortedFiles = [...data.files].sort((a, b) => a.name.localeCompare(b.name));
        
        fileList.innerHTML = sortedFiles.map(file => {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
          const displayName = file.original_name || file.name;
          const isRenamed = file.original_name && file.original_name !== file.name;
          return `
            <li class="file-item" data-filename="${file.name}">
              <div class="file-name" title="${isRenamed ? `Stored as: ${file.name}` : displayName}">
                ${displayName}
                ${isRenamed ? `<div class="stored-as"><button class="delete-file" data-filename="${file.name}" data-original-name="${file.original_name}" title="Delete file">🗑️</button></div>` : 
                  `<button class="delete-file" data-filename="${file.name}" data-original-name="${file.original_name}" title="Delete file">🗑️</button>`}
              </div>
              <span class="file-size">${sizeMB} MB</span>
            </li>
          `;
        }).join('');
      } else {
        fileList.innerHTML = '<li class="empty-message">No files uploaded yet</li>';
      }
      
      // Delete button handling is now managed by dashboard.js
      
      // Update quota display if available
      if (data.quota !== undefined) {
        const bar = document.getElementById('quota-bar');
        const text = document.getElementById('quota-text');
        const quotaSec = document.getElementById('quota-meter');
        if (bar && text && quotaSec) {
          quotaSec.hidden = false;
          bar.value = data.quota;
          bar.max = 100;
          text.textContent = `${data.quota.toFixed(1)} MB`;
        }
      }
    } catch (error) {
      const errorMessage = `Error loading file list: ${error.message || 'Unknown error'}`;
      console.error('[ERROR]', errorMessage, error);
      showErrorInUI(errorMessage, fileList);
    }
    
    // Helper function to show error messages in the UI
    function showErrorInUI(message, targetElement = null) {
      const errorHtml = `
        <div style="
          padding: 10px;
          margin: 5px 0;
          background: #2a0f0f;
          border-left: 3px solid #f55;
          color: var(--error-hover);
          font-family: monospace;
          font-size: 0.9em;
          white-space: pre-wrap;
          word-break: break-word;
        ">
          <div style="font-weight: bold; color: var(--error);">Error loading files</div>
          <div style="margin-top: 5px;">${message}</div>
          <div style="margin-top: 10px; font-size: 0.8em; color: var(--text-muted);">
            Check browser console for details
          </div>
        </div>
      `;
      
      if (targetElement) {
        targetElement.innerHTML = errorHtml;
      } else {
        // If no target element, try to find it
        const fileList = document.getElementById('file-list');
        if (fileList) fileList.innerHTML = errorHtml;
      }
    }
  }

  // Helper function to get cookie value by name
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Export functions for use in other modules
  window.upload = upload;
  window.fetchAndDisplayFiles = fetchAndDisplayFiles;

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => {
      console.log("[DEBUG] Dropzone clicked");
      fileInput.click();
      console.log("[DEBUG] fileInput.click() called");
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
      dropzone.style.transition = "background-color 0.3s ease";
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });
    dropzone.addEventListener("drop", (e) => {
      dropzone.classList.add("pulse");
      setTimeout(() => dropzone.classList.remove("pulse"), 400);
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    });
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) upload(file);
    });
  }
});
