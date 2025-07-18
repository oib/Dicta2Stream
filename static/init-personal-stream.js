// Initialize the personal stream play button with the user's UID
document.addEventListener('DOMContentLoaded', () => {
  // Function to update the play button with UID
  function updatePersonalStreamPlayButton() {
    const playButton = document.querySelector('#me-page .play-pause-btn');
    if (!playButton) return;
    
    // Get UID from localStorage or cookie
    const uid = localStorage.getItem('uid') || getCookie('uid');
    
    if (uid) {
      // Set the data-uid attribute if not already set
      if (!playButton.dataset.uid) {
        playButton.dataset.uid = uid;
        console.log('[personal-stream] Set UID for personal stream play button:', uid);
      }
    } else {
      console.warn('[personal-stream] No UID found for personal stream play button');
    }
  }

  // Helper function to get cookie value by name
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Initial update
  updatePersonalStreamPlayButton();
  
  // Also update when auth state changes (e.g., after login)
  document.addEventListener('authStateChanged', updatePersonalStreamPlayButton);
});
