// Initialize the personal stream play button with the user's UID
document.addEventListener('DOMContentLoaded', () => {
  // Function to update the play button with UID
  function updatePersonalStreamPlayButton() {
    const playButton = document.querySelector('#me-page .play-pause-btn');
    const streamPlayer = document.querySelector('#me-page .stream-player');
    
    if (!playButton || !streamPlayer) return;
    
    // Get UID from localStorage or cookie
    const uid = localStorage.getItem('uid') || getCookie('uid');
    
    if (uid) {
      // Show the player and set the UID if not already set
      streamPlayer.style.display = 'block';
      if (!playButton.dataset.uid) {
        playButton.dataset.uid = uid;
      }
    } else {
      // Hide the player for guests
      streamPlayer.style.display = 'none';
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
