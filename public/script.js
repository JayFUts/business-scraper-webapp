// ==================== GLOBAL STATE ====================
let currentUser = null;
let currentSessionId = null;
let currentResults = [];
let statusCheckInterval = null;

// ==================== AUTH FUNCTIONS ====================

// Check if user is already logged in on page load
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();
});

// Check authentication status
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      showApp();
      updateUserUI();
    } else {
      showAuth();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    showAuth();
  }
}

// Show authentication section
function showAuth() {
  document.getElementById('authSection').style.display = 'flex';
  document.getElementById('appSection').style.display = 'none';
}

// Show main app section
function showApp() {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('appSection').style.display = 'block';
}

// Update user interface with current user data
function updateUserUI() {
  if (currentUser) {
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('creditsCount').textContent = currentUser.credits;
  }
}

// Switch to login form
function showLogin() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
  
  // Update tab styles
  document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.auth-tab')[0].classList.add('active');
  
  // Clear errors
  document.getElementById('loginError').textContent = '';
  document.getElementById('registerError').textContent = '';
}

// Switch to register form
function showRegister() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
  
  // Update tab styles
  document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.auth-tab')[1].classList.add('active');
  
  // Clear errors
  document.getElementById('loginError').textContent = '';
  document.getElementById('registerError').textContent = '';
}

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;
      showApp();
      updateUserUI();
      errorDiv.textContent = '';
    } else {
      errorDiv.textContent = data.error || 'Login failed';
    }
  } catch (error) {
    console.error('Login error:', error);
    errorDiv.textContent = 'Network error. Please try again.';
  }
});

// Register form handler
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const errorDiv = document.getElementById('registerError');
  
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;
      showApp();
      updateUserUI();
      errorDiv.textContent = '';
    } else {
      errorDiv.textContent = data.error || 'Registration failed';
    }
  } catch (error) {
    console.error('Register error:', error);
    errorDiv.textContent = 'Network error. Please try again.';
  }
});

// Logout function
async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    
    currentUser = null;
    currentResults = [];
    
    // Clear intervals
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
    }
    
    showAuth();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// ==================== SCRAPING FUNCTIONS ====================

// Start search function (updated with auth)
async function startSearch() {
  const searchQuery = document.getElementById('searchInput').value.trim();
  if (!searchQuery) {
    alert('Please enter a search query');
    return;
  }

  // Check if user has enough credits
  if (currentUser.credits < 10) {
    alert('Insufficient credits! You need 10 credits (€1) per search. Please buy more credits.');
    showBuyCredits();
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
    // Start scraping with auth
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ searchQuery }),
    });

    if (response.status === 401) {
      alert('Please login to continue');
      showAuth();
      return;
    }

    if (response.status === 402) {
      const data = await response.json();
      alert(`Insufficient credits! You need ${data.required} credits but only have ${data.available}.`);
      showBuyCredits();
      return;
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    currentSessionId = data.sessionId;

    // Update credits display
    currentUser.credits = data.creditsRemaining;
    updateUserUI();

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
    const response = await fetch(`/api/status/${currentSessionId}`, {
      credentials: 'include'
    });
    
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
    const response = await fetch(`/api/export/${currentSessionId}/${format}`, {
      credentials: 'include'
    });
    
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

// ==================== CREDITS & PAYMENT FUNCTIONS ====================

// Show buy credits modal
function showBuyCredits() {
  document.getElementById('buyCreditsModal').style.display = 'flex';
}

// Close buy credits modal
function closeBuyCredits() {
  document.getElementById('buyCreditsModal').style.display = 'none';
}

// Buy credits function with real Stripe integration
async function buyCredits(credits, price) {
  // Only support the €10 package for now since we have one Stripe link
  if (price !== 10) {
    alert('Currently only €10 credit packages are available. Please select the Basic package.');
    return;
  }
  
  try {
    // Create a pending purchase record
    const response = await fetch('/api/payments/create-purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ 
        credits: credits,
        amount: price,
        email: currentUser.email
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create purchase record');
    }

    const data = await response.json();
    const purchaseId = data.purchaseId;
    
    // Redirect to Stripe with success/cancel URLs that include the purchase ID
    const baseUrl = window.location.origin;
    const stripeUrl = `https://buy.stripe.com/14AdR89kIbVBgAPbxF7AI00?client_reference_id=${purchaseId}&success_url=${encodeURIComponent(baseUrl + '/payment-success.html?purchase_id=' + purchaseId)}&cancel_url=${encodeURIComponent(baseUrl + '/payment-cancel.html')}`;
    
    // Open Stripe checkout in same window
    window.location.href = stripeUrl;
    
  } catch (error) {
    console.error('Payment error:', error);
    alert('Failed to initiate payment. Please try again.');
  }
}

// ==================== UTILITY FUNCTIONS ====================

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

// Close modal when clicking outside
window.addEventListener('click', (e) => {
  const modal = document.getElementById('buyCreditsModal');
  if (e.target === modal) {
    closeBuyCredits();
  }
});