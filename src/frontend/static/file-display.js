// This function is responsible for rendering the list of files to the DOM.
// It is globally accessible via window.displayUserFiles.

// Helper function to wait for showToast to be available
function waitForShowToast() {
    return new Promise((resolve) => {
        if (window.showToast) {
            resolve(window.showToast);
        } else {
            setTimeout(() => waitForShowToast().then(resolve), 100);
        }
    });
}

window.displayUserFiles = function(uid, files) {
    const fileList = document.getElementById('file-list');
    if (!fileList) {
        // Debug messages disabled
        return;
    }

    if (!files || files.length === 0) {
        fileList.innerHTML = '<li>You have no uploaded files yet.</li>';
        return;
    }

    const fragment = document.createDocumentFragment();
    const displayedFiles = new Set();

    files.forEach(file => {
        // Use original_name for display, stored_name for operations.
        let displayName = file.original_name || file.stored_name || 'Unnamed File';
        const storedFileName = file.stored_name || file.original_name;
        // No UUID pattern replacement: always show the original_name from backend.

        // Skip if no valid identifier is found or if it's a duplicate.
        if (!storedFileName || displayedFiles.has(storedFileName)) {
            return;
        }
        displayedFiles.add(storedFileName);

        const listItem = document.createElement('li');
        const fileUrl = `/user-uploads/${uid}/${encodeURIComponent(storedFileName)}`;
        const fileSize = file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A';
        
        let fileIcon = '🎵'; // Default icon
        const fileExt = displayName.split('.').pop().toLowerCase();
        if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(fileExt)) {
            fileIcon = '🎵';
        } else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(fileExt)) {
            fileIcon = '🖼️';
        } else if (['pdf', 'doc', 'docx', 'txt'].includes(fileExt)) {
            fileIcon = '📄';
        }
        
        listItem.innerHTML = `
            <div class="file-info">
              <div class="file-header">
                <span class="file-name">${displayName}</span>
                <span class="file-size">${fileSize}</span>
              </div>
            </div>
            <button class="delete-file" title="Delete file" data-filename="${storedFileName}" data-display-name="${displayName}">🗑️</button>
        `;
        
        fragment.appendChild(listItem);
    });

    fileList.appendChild(fragment);
};

// Function to handle file deletion
async function deleteFile(uid, fileName, listItem, displayName = '') {
  const fileToDelete = displayName || fileName;
  if (!confirm(`Are you sure you want to delete "${fileToDelete}"?`)) {
    return;
  }
  
  // Show loading state
  if (listItem) {
    listItem.style.opacity = '0.6';
    listItem.style.pointerEvents = 'none';
    const deleteButton = listItem.querySelector('.delete-file');
    if (deleteButton) {
      deleteButton.disabled = true;
      deleteButton.textContent = '⏳';
    }
  }
  
  try {
    if (!uid) {
      throw new Error('User not authenticated. Please log in again.');
    }
    
    // Debug messages disabled
    const authToken = localStorage.getItem('authToken');
    const headers = { 'Content-Type': 'application/json' };
    
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Get the email from localStorage (it's the UID)
    const email = localStorage.getItem('uid');
    if (!email) {
      throw new Error('User not authenticated');
    }
    
    // The backend expects the full email as the UID in the path
    // We need to ensure it's properly encoded for the URL
    const username = email;
    // Debug messages disabled
    
    // Check if the filename is just a UUID (without log ID prefix)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.\w+$/i;
    let fileToDelete = fileName;
    
    // If the filename is just a UUID, try to find the actual file with log ID prefix
    if (uuidPattern.test(fileName)) {
      // Debug messages disabled
      try {
        // First try to get the list of files to find the one with the matching UUID
        const filesResponse = await fetch(`/user-files/${uid}`, {
          method: 'GET',
          headers: headers,
          credentials: 'include'
        });
        
        if (filesResponse.ok) {
          const filesData = await filesResponse.json();
          if (filesData.files && Array.isArray(filesData.files)) {
            // Look for a file that contains our UUID in its name
            const matchingFile = filesData.files.find(f => 
              f.stored_name && f.stored_name.includes(fileName)
            );
            
            if (matchingFile && matchingFile.stored_name) {
              // Debug messages disabled
              fileToDelete = matchingFile.stored_name;
            }
          }
        }
      } catch (e) {
        // Debug messages disabled
        // Continue with the original filename if there's an error
      }
    }
    
    // Use the username in the URL with the correct filename
    // Debug messages disabled
    const response = await fetch(`/uploads/${username}/${encodeURIComponent(fileToDelete)}`, {
      method: 'DELETE',
      headers: headers,
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    // Remove the file from the UI immediately
    if (listItem && listItem.parentNode) {
      listItem.parentNode.removeChild(listItem);
    }
    
    // Show success message
    // Wait for showToast to be available
    const showToast = await waitForShowToast();
    showToast(`Successfully deleted "${fileToDelete}"`, 'success');
    
    // If the file list is now empty, show a message
    const fileList = document.getElementById('file-list');
    if (fileList && fileList.children.length === 0) {
      fileList.innerHTML = '<li class="no-files">No files uploaded yet.</li>';
    }
    
    // Refresh the file list and stream
    const uid_current = localStorage.getItem('uid');
    if (window.fetchAndDisplayFiles) {
      // Use email-based UID for file operations if available, fallback to uid_current
        const fileOperationUid = localStorage.getItem('uid') || uid_current;  // uid is now email-based  
      // Debug messages disabled
      await window.fetchAndDisplayFiles(fileOperationUid);
    }
    if (window.loadProfileStream) {
      await window.loadProfileStream(uid_current);
    }
  } catch (error) {
    // Debug messages disabled
    // Wait for showToast to be available
    const showToast = await waitForShowToast();
    showToast(`Error deleting "${fileToDelete}": ${error.message}`, 'error');
    
    // Reset the button state if there was an error
    if (listItem) {
      listItem.style.opacity = '';
      listItem.style.pointerEvents = '';
      const deleteButton = listItem.querySelector('.delete-file');
      if (deleteButton) {
        deleteButton.disabled = false;
        deleteButton.textContent = '🗑️';
      }
    }
  }
}

// Add event delegation for delete buttons
document.addEventListener('DOMContentLoaded', () => {
  const fileList = document.getElementById('file-list');
  if (fileList) {
    fileList.addEventListener('click', async (e) => {
      const deleteButton = e.target.closest('.delete-file');
      if (deleteButton) {
        e.preventDefault();
        e.stopPropagation();
        
        const listItem = deleteButton.closest('li');
        if (!listItem) return;
        
        const uid = localStorage.getItem('uid');
        if (!uid) {
          // Wait for showToast to be available
          const showToast = await waitForShowToast();
          showToast('You need to be logged in to delete files', 'error');
          // Debug messages disabled
          return;
        }
        
        const fileName = deleteButton.getAttribute('data-filename');
        const displayName = deleteButton.getAttribute('data-display-name') || fileName;
        
        deleteFile(uid, fileName, listItem, displayName);
      }
    });
  }
});
