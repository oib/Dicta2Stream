// upload.js — Frontend file upload handler

import { showToast } from "./toast.js";
import { playBeep } from "./sound.js";
import { logToServer } from "./app.js";

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
  const spinner = document.getElementById("spinner");
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

      playBeep(432, 0.25, "sine");
    } else {
      streamInfo.hidden = true;
      spinner.style.display = "none";
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

  // Export the upload function for use in other modules
  window.upload = upload;

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
