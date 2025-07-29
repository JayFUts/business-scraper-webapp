let currentSessionId = null;
let currentResults = [];
let statusCheckInterval = null;

// Start search function
async function startSearch() {
  const searchQuery = document.getElementById('searchInput').value.trim();
  if (!searchQuery) {
    alert('Please enter a search query');
    return;
  }

  const searchButton = document.getElementById('searchButton');
  const buttonText = document.getElementById('buttonText');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const statusDiv = document.getElementById('status');
  const progressBar = document.getElementById('progressBar');
  const resultsSection = document.getElementById('resultsSection');

  // Reset UI
  searchButton.disabled = true;
  buttonText.style.display = 'none';
  loadingSpinner.style.display = 'block';
  statusDiv.textContent = 'Starting search...';
  progressBar.style.display = 'block';
  resultsSection.style.display = 'none';
  currentResults = [];

  try {
    // Start scraping
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ searchQuery }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    currentSessionId = data.sessionId;

    // Start polling for status updates
    statusCheckInterval = setInterval(checkStatus, 2000);

  } catch (error) {
    console.error('Error starting search:', error);
    statusDiv.textContent = 'Error: ' + error.message;
    resetUI();
  }
}

// Check scraping status
async function checkStatus() {
  if (!currentSessionId) return;

  try {
    const response = await fetch(`/api/status/${currentSessionId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Update status
    document.getElementById('status').textContent = data.status;
    
    // Update progress bar based on status
    updateProgressBar(data.status);

    // Check if completed
    if (data.hasResults && data.results) {
      currentResults = data.results;
      displayResults(data.results);
      clearInterval(statusCheckInterval);
      resetUI();
    } else if (data.status.startsWith('Error:')) {
      clearInterval(statusCheckInterval);
      resetUI();
    }

  } catch (error) {
    console.error('Error checking status:', error);
    document.getElementById('status').textContent = 'Error checking status';
    clearInterval(statusCheckInterval);
    resetUI();
  }
}

// Update progress bar based on status message
function updateProgressBar(status) {
  const progressFill = document.getElementById('progressFill');
  let progress = 0;

  if (status.includes('Opening')) progress = 10;
  else if (status.includes('consent')) progress = 20;
  else if (status.includes('Waiting for results')) progress = 30;
  else if (status.includes('Scrolling')) {
    const match = status.match(/\((\d+)\/(\d+)\)/);
    if (match) {
      const current = parseInt(match[1]);
      const total = parseInt(match[2]);
      progress = 30 + (current / total) * 30; // 30-60%
    } else {
      progress = 45;
    }
  }
  else if (status.includes('Extracting')) progress = 65;
  else if (status.includes('Processing')) progress = 70;
  else if (status.includes('Getting details')) {
    const match = status.match(/\((\d+)\/(\d+)\)/);
    if (match) {
      const current = parseInt(match[1]);
      const total = parseInt(match[2]);
      progress = 70 + (current / total) * 25; // 70-95%
    } else {
      progress = 80;
    }
  }
  else if (status.includes('Checking website')) progress = 85;
  else if (status.includes('completed')) progress = 100;

  progressFill.style.width = progress + '%';
}

// Display results
function displayResults(results) {
  const resultsSection = document.getElementById('resultsSection');
  const resultsDiv = document.getElementById('results');
  const resultCount = document.getElementById('resultCount');

  resultCount.textContent = results.length;
  resultsDiv.innerHTML = '';

  results.forEach((business, index) => {
    const card = document.createElement('div');
    card.className = 'business-card';
    
    const name = business.name || `Business ${index + 1}`;
    const address = business.address || 'No address';
    const phone = business.phone || 'No phone';
    const email = business.email || 'No email';
    const website = business.website || 'No website';

    card.innerHTML = `
      <div class="business-name">${escapeHtml(name)}</div>
      <div class="business-detail">
        📍 ${escapeHtml(address)}
      </div>
      <div class="business-detail">
        📞 ${escapeHtml(phone)}
      </div>
      <div class="business-detail">
        ✉️ ${email === 'No email' ? email : `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`}
      </div>
      <div class="business-detail">
        🌐 ${website === 'No website' ? website : `<a href="${escapeHtml(website)}" target="_blank" rel="noopener">${escapeHtml(website)}</a>`}
      </div>
    `;
    
    resultsDiv.appendChild(card);
  });

  resultsSection.style.display = 'block';
  
  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Export results
async function exportResults(format) {
  if (!currentSessionId || currentResults.length === 0) {
    alert('No results to export');
    return;
  }

  try {
    const response = await fetch(`/api/export/${currentSessionId}/${format}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Create download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `businesses.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

  } catch (error) {
    console.error('Export error:', error);
    alert('Export failed: ' + error.message);
  }
}

// Reset UI after search completion
function resetUI() {
  const searchButton = document.getElementById('searchButton');
  const buttonText = document.getElementById('buttonText');
  const loadingSpinner = document.getElementById('loadingSpinner');
  const progressBar = document.getElementById('progressBar');

  searchButton.disabled = false;
  buttonText.style.display = 'inline';
  loadingSpinner.style.display = 'none';
  
  // Hide progress bar after a delay
  setTimeout(() => {
    progressBar.style.display = 'none';
  }, 2000);
}

// Utility function to escape HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Allow Enter key to trigger search
document.getElementById('searchInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    startSearch();
  }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
});