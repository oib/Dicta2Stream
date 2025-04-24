// app.js — Frontend upload + minimal native player logic with slide-in and pulse effect

import { playBeep } from "./sound.js";

// 🔔 Minimal toast helper so calls to showToast() don’t fail
function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  toast.style.position = "fixed";
  toast.style.bottom = "1.5rem";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "#333";
  toast.style.color = "#fff";
  toast.style.padding = "0.6em 1.2em";
  toast.style.borderRadius = "6px";
  toast.style.boxShadow = "0 2px 6px rgba(0,0,0,.2)";
  toast.style.zIndex = 9999;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

document.addEventListener("DOMContentLoaded", () => {
  // Guest vs. logged-in toggling is now handled by dashboard.js
  // --- Public profile view logic ---
  function showProfilePlayerFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const profileUid = params.get("profile");
    if (profileUid) {
      const mePage = document.getElementById("me-page");
      if (mePage) {
        document.querySelectorAll("main > section").forEach(sec => sec.hidden = sec.id !== "me-page");
        // Hide upload/delete/copy-url controls for guest view
        const uploadArea = document.getElementById("upload-area");
        if (uploadArea) uploadArea.hidden = true;
        const copyUrlBtn = document.getElementById("copy-url");
        if (copyUrlBtn) copyUrlBtn.style.display = "none";
        const deleteBtn = document.getElementById("delete-account");
        if (deleteBtn) deleteBtn.style.display = "none";
        // Update heading and description for guest view
        const meHeading = document.querySelector("#me-page h2");
        if (meHeading) meHeading.textContent = `${profileUid}'s Stream 🎙️`;
        const meDesc = document.querySelector("#me-page p");
        if (meDesc) meDesc.textContent = `This is ${profileUid}'s public stream.`;
        // Load playlist for the given profileUid
        loadProfilePlaylist(profileUid);
      }
    }
  }
  // Run on popstate (SPA navigation and browser back/forward)
  window.addEventListener('popstate', showProfilePlayerFromUrl);

  async function loadProfilePlaylist(uid) {
    const meAudio = document.getElementById("me-audio");
    if (!meAudio) return;
    const resp = await fetch(`/user-files/${encodeURIComponent(uid)}`);
    const data = await resp.json();
    if (!data.files || !Array.isArray(data.files) || data.files.length === 0) {
      meAudio.src = "";
      return;
    }
    // Shuffle playlist
    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
    window.mePlaylist = shuffle(data.files.map(f => `/audio/${uid}/${f}`));
    window.mePlaylistIdx = 0;
    const newSrc = window.mePlaylist[window.mePlaylistIdx];
    meAudio.src = newSrc;
    meAudio.load();
    meAudio.play().catch(() => {/* autoplay may be blocked, ignore */});
  }
  window.loadProfilePlaylist = loadProfilePlaylist;

  // --- Playlist for #me-page ---
  const mePageLink = document.getElementById("show-me");
  const meAudio = document.getElementById("me-audio");
  const copyUrlBtn = document.getElementById("copy-url");
  if (copyUrlBtn) copyUrlBtn.onclick = () => {
    const uid = localStorage.getItem("uid");
    if (uid) {
      const streamUrl = `${window.location.origin}/stream/${encodeURIComponent(uid)}`;
      navigator.clipboard.writeText(streamUrl);
      showToast(`Copied your stream URL: ${streamUrl}`);
    } else {
      showToast("No user stream URL available");
    }
  };
  let mePlaylist = [];
  let mePlaylistIdx = 0;
  // Playlist UI is hidden, so do not render
  const mePrevBtn = document.getElementById("me-prev");
  if (mePrevBtn) mePrevBtn.style.display = "none";
  const meNextBtn = document.getElementById("me-next");
  if (meNextBtn) meNextBtn.style.display = "none";

  async function loadUserPlaylist() {
    const uid = localStorage.getItem("uid");
    if (!uid) return;
    const resp = await fetch(`/user-files/${encodeURIComponent(uid)}`);
    const data = await resp.json();
    if (!data.files || !Array.isArray(data.files) || data.files.length === 0) {
      meAudio.src = "";
      return;
    }
    // Shuffle playlist
    function shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    }
    mePlaylist = shuffle(data.files.map(f => `/audio/${uid}/${f}`));
    mePlaylistIdx = 0;
    const newSrc = mePlaylist[mePlaylistIdx];
    const prevSrc = meAudio.src;
    const wasPlaying = !meAudio.paused && !meAudio.ended && meAudio.currentTime > 0;
    const fullNewSrc = window.location.origin + newSrc;
    if (prevSrc !== fullNewSrc) {
      meAudio.src = newSrc;
      meAudio.load();
    } // else: do nothing, already loaded
    // Don't call load() if already playing the correct file
    // Don't call load() redundantly
    // Don't set src redundantly
    // This prevents DOMException from fetch aborts
  }

  if (mePageLink && meAudio) {
    mePageLink.addEventListener("click", async () => {
      await loadUserPlaylist();
      // Start playback from current index
      if (mePlaylist.length > 0) {
        const newSrc = mePlaylist[mePlaylistIdx];
        const prevSrc = meAudio.src;
        const fullNewSrc = window.location.origin + newSrc;
        if (prevSrc !== fullNewSrc) {
          meAudio.src = newSrc;
          meAudio.load();
        }
        meAudio.play();
      }
    });
    meAudio.addEventListener("ended", () => {
      if (mePlaylist.length > 1) {
        mePlaylistIdx = (mePlaylistIdx + 1) % mePlaylist.length;
        meAudio.src = mePlaylist[mePlaylistIdx];
        meAudio.load();
        meAudio.play();
      } else if (mePlaylist.length === 1) {
        // Only one file: restart
        meAudio.currentTime = 0;
        meAudio.load();
        meAudio.play();
      }
    });

    // Detect player stop and random play a new track
    meAudio.addEventListener("pause", () => {
      // Only trigger if playback reached the end and playlist has more than 1 track
      if (meAudio.ended && mePlaylist.length > 1) {
        let nextIdx;
        do {
          nextIdx = Math.floor(Math.random() * mePlaylist.length);
        } while (nextIdx === mePlaylistIdx && mePlaylist.length > 1);
        mePlaylistIdx = nextIdx;
        meAudio.currentTime = 0;
        meAudio.src = mePlaylist[mePlaylistIdx];
        meAudio.load();
        meAudio.play();
        
      }
    });
    
    
  }

  const deleteBtn = document.getElementById("delete-account");
  if (deleteBtn) deleteBtn.onclick = async () => {
    if (!confirm("Are you sure you want to delete your account and all uploaded audio?")) return;
    const res = await fetch("/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid })
    });
    if (res.ok) {
      showToast("✅ Account deleted");
      localStorage.removeItem("uid");
      setTimeout(() => window.location.reload(), 2000);
    } else {
      const msg = (await res.json()).detail || res.status;
      showToast("❌ Delete failed: " + msg);
    }
  };

  const fadeAllSections = () => {
    const uid = localStorage.getItem('uid');
    document.querySelectorAll("main > section").forEach(section => {
      // Always keep upload-area visible for logged-in users
      if (uid && section.id === 'upload-area') return;
      if (!section.hidden) {
        section.classList.add("fade-out");
        setTimeout(() => {
          section.classList.remove("fade-out");
          section.hidden = true;
        }, 300);
      }
    });
  };

  const dropzone = document.getElementById("upload-area");
  dropzone.setAttribute("aria-label", "Upload area. Click or drop an audio file to upload.");
  const fileInput = document.getElementById("fileInput");
  const fileInfo = document.createElement("div");
  fileInfo.id = "file-info";
  fileInfo.style.textAlign = "center";
  fileInput.parentNode.insertBefore(fileInfo, fileInput.nextSibling);
  const streamInfo = document.getElementById("stream-info");
  const streamUrlEl = document.getElementById("streamUrl");

  const status = document.getElementById("status");
  const spinner = document.getElementById("spinner");

  const uid = localStorage.getItem("uid");
  const uidTime = parseInt(localStorage.getItem("uid_time"), 10);
  const now = Date.now();
  // Hide register button if logged in
  const registerBtn = document.getElementById("show-register");
  if (uid && localStorage.getItem("confirmed_uid") === uid && uidTime && (now - uidTime) < 3600000) {
    if (registerBtn) registerBtn.style.display = "none";
  } else {
    if (registerBtn) registerBtn.style.display = "";
  }
  if (!uid || !uidTime || (now - uidTime) > 3600000) {
    localStorage.removeItem("uid");
    localStorage.removeItem("confirmed_uid");
    localStorage.removeItem("uid_time");
    status.className = "error-toast";
    status.innerText = "❌ Session expired. Please log in again.";
    // Add Login or Register button only for this error
    let loginBtn = document.createElement('button');
    loginBtn.textContent = 'Login or Register';
    loginBtn.className = 'login-register-btn';
    loginBtn.onclick = () => {
      document.querySelectorAll('main > section').forEach(sec => sec.hidden = sec.id !== 'register-page');
    };
    status.appendChild(document.createElement('br'));
    status.appendChild(loginBtn);
    // Remove the status div after a short delay so only toast remains
    setTimeout(() => {
      if (status.parentNode) status.parentNode.removeChild(status);
    }, 100);
    return;
  }
  const confirmed = localStorage.getItem("confirmed_uid");
  if (!confirmed || uid !== confirmed) {
    status.className = "error-toast";
    status.innerText = "❌ Please confirm your account via email first.";
    showToast(status.innerText);
    return;
  }

  let abortController;

  const upload = async (file) => {
    if (abortController) abortController.abort();
    abortController = new AbortController();
    fileInfo.innerText = `📁 ${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    if (file.size > 100 * 1024 * 1024) {
      status.className = "error-toast";
      status.innerText = "❌ Session expired. Please log in again.";
      // Add Login or Register button only for this error
      let loginBtn = document.createElement('button');
      loginBtn.textContent = 'Login or Register';
      loginBtn.className = 'login-register-btn';
      loginBtn.onclick = () => {
        document.querySelectorAll('main > section').forEach(sec => sec.hidden = sec.id !== 'register-page');
      };
      status.appendChild(document.createElement('br'));
      status.appendChild(loginBtn);
      showToast(status.innerText);
      return;
    }
    spinner.style.display = "block";
    status.innerHTML = '📡 Uploading…';
    status.className = "uploading-toast";
    fileInput.disabled = true;
    dropzone.classList.add("uploading");
    const formData = new FormData();
    formData.append("uid", uid);
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
      status.className = "error-toast";
      status.innerText = "❌ Upload failed: " + (parseError && parseError.message ? parseError.message : "Unknown error");
      showToast(status.innerText);
      spinner.style.display = "none";
      fileInput.disabled = false;
      dropzone.classList.remove("uploading");
      return;
    }
    if (res.ok) {
      status.className = "success-toast";
      streamInfo.hidden = false;
      streamInfo.innerHTML = `
        <p>Your stream is now live:</p>
        <audio controls id="me-audio" aria-label="Stream audio player. Your uploaded voice loop plays here.">
          <p style='font-size: 0.9em; text-align: center;'>🔁 This stream loops forever</p>
          <source src="${data.stream_url}" type="audio/ogg">
        </audio>
        <p><a href="${data.stream_url}" target="_blank" class="button" aria-label="Open your stream in a new tab">Open in external player</a></p>
      `;
      const meAudio = document.getElementById("me-audio");
      meAudio.addEventListener("ended", () => {
        if (mePlaylist.length > 1) {
          mePlaylistIdx = (mePlaylistIdx + 1) % mePlaylist.length;
          meAudio.src = mePlaylist[mePlaylistIdx];
          meAudio.load();
        meAudio.play();
          meUrl.value = mePlaylist[mePlaylistIdx];
        } else if (mePlaylist.length === 1) {
          // Only one file: restart
          meAudio.currentTime = 0;
          meAudio.load();
        meAudio.play();
        }
      });
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
      showToast(status.innerText);
      status.innerText = "✅ Upload successful.";

      playBeep(432, 0.25, "sine");

      setTimeout(() => status.innerText = "", 5000);
      streamInfo.classList.add("visible", "slide-in");
    } else {
      streamInfo.hidden = true;
      status.className = "error-toast";
      spinner.style.display = "none";
      if ((data.detail || data.error || "").includes("music")) {
        status.innerText = "🎵 Upload rejected: singing or music detected.";
      } else {
        status.innerText = `❌ Upload failed: ${data.detail || data.error}`;
      }
      showToast(status.innerText);
      fileInput.value = null;
      dropzone.classList.remove("uploading");
      fileInput.disabled = false;
      streamInfo.classList.remove("visible", "slide-in");
    }
  };

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
    status.innerText = "";
    status.className = "";
    const file = e.target.files[0];
    if (file) upload(file);
  });

  document.querySelectorAll('#links a[data-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-target');
      // Only hide other sections when not opening #me-page
      if (target !== 'me-page') fadeAllSections();
      const section = document.getElementById(target);
      if (section) {
        section.hidden = false;
        section.classList.add("slide-in");
        section.scrollIntoView({ behavior: "smooth" });
      }
      const burger = document.getElementById('burger-toggle');
      if (burger && burger.checked) burger.checked = false;
    });
  });
});
