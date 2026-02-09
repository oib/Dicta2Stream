import { showToast } from "./toast.js";
import { playBeep } from "./sound.js";

document.addEventListener('DOMContentLoaded', () => {
  // This module handles the file upload functionality, including drag-and-drop,
  // progress indication, and post-upload actions like refreshing the file list.

  // DOM elements are fetched once the DOM is ready
  const dropzone = document.getElementById("user-upload-area");
  const fileInput = document.getElementById("fileInputUser");
  const fileList = document.getElementById("file-list");

  // Early exit if critical UI elements are missing
  if (!dropzone || !fileInput || !fileList) {
    // Debug messages disabled
    return;
  } 

  // Attach all event listeners
  initializeUploadListeners();


  /**
   * Main upload function
   * @param {File} file - The file to upload
   */
  async function upload(file) {
    // Get user ID from localStorage or cookie
    const uid = localStorage.getItem('uid') || getCookie('uid');
    if (!uid) {
      // Debug messages disabled
      showToast("You must be logged in to upload files.", "error");
      return;
    }

    // Debug messages disabled

    // Create and display the upload status indicator
    const statusDiv = createStatusIndicator(file.name);
    fileList.prepend(statusDiv);

    const progressBar = statusDiv.querySelector('.progress-bar');
    const statusText = statusDiv.querySelector('.status-text');

    const formData = new FormData();
    formData.append("file", file);
    formData.append("uid", uid);

    try {
      const response = await fetch(`/upload`, {
        method: "POST",
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed with non-JSON response.' }));
        throw new Error(errorData.detail || 'Unknown upload error');
      }

      const result = await response.json();
      // Debug messages disabled
      playBeep(800, 0.2); // Success beep - higher frequency

      // Update UI to show success
      statusText.textContent = 'Success!';
      progressBar.style.width = '100%';
      progressBar.style.backgroundColor = 'var(--success-color)';

      // Remove the status indicator after a short delay
      setTimeout(() => {
        statusDiv.remove();
      }, 2000);

      // --- Post-Upload Actions ---
      await postUploadActions(uid);

    } catch (error) {
      // Debug messages disabled
      playBeep(200, 0.5); // Error beep - lower frequency, longer duration
      statusText.textContent = `Error: ${error.message}`;
      progressBar.style.backgroundColor = 'var(--error-color)';
      statusDiv.classList.add('upload-error');
    }
  }

  /**
   * Actions to perform after a successful upload.
   * @param {string} uid - The user's ID
   */
  async function postUploadActions(uid) {
    // 1. Refresh the user's personal stream if the function is available
    if (window.loadProfileStream) {
      await window.loadProfileStream(uid);
    }
    // 2. Refresh the file list by re-fetching and then displaying.
    if (window.fetchAndDisplayFiles) {
      // Use email-based UID for file operations if available, fallback to uid
        const fileOperationUid = localStorage.getItem('uid') || uid;  // uid is now email-based
      // Debug messages disabled
      await window.fetchAndDisplayFiles(fileOperationUid);
    }
    // 3. Update quota display after upload
    if (window.updateQuotaDisplay) {
      const quotaUid = localStorage.getItem('uid') || uid;
      // Debug messages disabled
      await window.updateQuotaDisplay(quotaUid);
    }
    // 4. Refresh the public stream list to update the last update time
    if (window.refreshStreamList) {
      await window.refreshStreamList();
    }
  }

  /**
   * Creates the DOM element for the upload status indicator.
   * @param {string} fileName - The name of the file being uploaded.
   * @returns {HTMLElement}
   */
  function createStatusIndicator(fileName) {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'upload-status-indicator';
    statusDiv.innerHTML = `
      <div class="file-info">
        <span class="file-name">${fileName}</span>
        <span class="status-text">Uploading...</span>
      </div>
      <div class="progress-container">
        <div class="progress-bar"></div>
      </div>
    `;
    return statusDiv;
  }

  /**
   * Initializes all event listeners for the upload UI.
   */
  function initializeUploadListeners() {
    dropzone.addEventListener("click", () => {
      fileInput.click();
    });

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) {
        upload(file);
      }
    });

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        upload(file);
      }
    });
  }

  /**
   * Helper function to get a cookie value by name.
   * @param {string} name - The name of the cookie.
   * @returns {string|null}
   */
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Make the upload function globally accessible if needed by other scripts
  window.upload = upload;
});
