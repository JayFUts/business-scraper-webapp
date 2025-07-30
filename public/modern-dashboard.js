// Modern Dashboard JavaScript

// Global variables
let isAuthenticated = false;
let currentUser = null;
let currentSessionId = null;
let statusCheckInterval = null;

// DOM elements
const authSection = document.getElementById('authSection');
const appSection = document.getElementById('appSection');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const statusContainer = document.getElementById('statusContainer');
const resultsSection = document.getElementById('resultsSection');
const buyCreditsModal = document.getElementById('buyCreditsModal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard JS loaded');
    try {
        checkAuth();
        setupEventListeners();
        setupAnimations();
        console.log('Dashboard initialization complete');
    } catch (error) {
        console.error('Dashboard initialization error:', error);
    }
});

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    // Auth tab switching
    const authTabs = document.querySelectorAll('.auth-tab');
    console.log('Found auth tabs:', authTabs.length);
    authTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Auth tab clicked:', tab.dataset.tab);
            const targetTab = tab.dataset.tab;
            switchAuthTab(targetTab);
        });
    });

    // Form submissions with active check
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (loginForm.classList.contains('active')) {
                console.log('Login form submitted (active)');
                handleLogin(e);
            } else {
                console.log('Login form submitted but not active - ignoring');
            }
        });
        console.log('Login form listener added');
    }
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (registerForm.classList.contains('active')) {
                console.log('Register form submitted (active)');
                handleRegister(e);
            } else {
                console.log('Register form submitted but not active - ignoring');
            }
        });
        console.log('Register form listener added');
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                startSearch();
            }
        });
    }
    
    // Navigation items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const navText = item.querySelector('span').textContent;
            handleNavigation(navText, item);
        });
    });

    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
        });
    }

    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024) {
            const sidebar = document.querySelector('.sidebar');
            const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
            
            if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                sidebar.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
            }
        }
    });
}

// Setup animations
function setupAnimations() {
    // Add fade-in animation to auth forms
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    const authCard = document.querySelector('.auth-card');
    if (authCard) {
        authCard.style.opacity = '0';
        authCard.style.transform = 'translateY(20px)';
        authCard.style.transition = 'all 0.6s ease-out';
        observer.observe(authCard);
    }
}

// Switch auth tabs
function switchAuthTab(tab) {
    console.log('Switching to tab:', tab);
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    
    console.log('Found tabs:', authTabs.length, 'Found forms:', authForms.length);
    
    authTabs.forEach(t => {
        if (t.dataset.tab === tab) {
            t.classList.add('active');
            console.log('Activated tab:', tab);
        } else {
            t.classList.remove('active');
        }
    });
    
    authForms.forEach(form => {
        if ((tab === 'login' && form.id === 'loginForm') || 
            (tab === 'register' && form.id === 'registerForm')) {
            form.classList.add('active');
            console.log('Activated form:', form.id);
            console.log('Form display after activation:', getComputedStyle(form).display);
            console.log('Form classes:', form.className);
        } else {
            form.classList.remove('active');
            console.log('Deactivated form:', form.id);
        }
    });
}

// Handle navigation
function handleNavigation(section, clickedItem) {
    console.log('Navigation clicked:', section);
    
    // Update active nav item
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    clickedItem.classList.add('active');
    
    // Get main content sections
    const searchContainer = document.querySelector('.search-container');
    const statusContainer = document.getElementById('statusContainer');
    const resultsSection = document.getElementById('resultsSection');
    
    // Hide all sections first
    if (searchContainer) searchContainer.style.display = 'none';
    if (statusContainer) statusContainer.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    
    switch(section.toLowerCase()) {
        case 'search':
            // Restore original search content if it was modified
            if (searchContainer) {
                searchContainer.innerHTML = `
                    <div class="search-header">
                        <h1 class="page-title">Find Business Leads</h1>
                        <p class="page-subtitle">Search Google Maps and extract 50+ businesses with contact information</p>
                    </div>
                
                    <div class="search-card">
                        <div class="search-input-group">
                            <svg class="search-icon" viewBox="0 0 24 24" fill="none">
                                <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <input type="text" id="searchInput" class="search-input" placeholder="e.g., restaurants in Amsterdam" value="restaurants in Amsterdam">
                            <button id="searchButton" onclick="startSearch()" class="btn btn-primary search-btn">
                                <span id="buttonText">Search</span>
                                <div id="loadingSpinner" class="spinner" style="display: none;"></div>
                            </button>
                        </div>
                        
                        <div class="search-tips">
                            <div class="tip">
                                <svg class="tip-icon" viewBox="0 0 20 20" fill="none">
                                    <path d="M9 11H11M9 7H11M9 15H11M19 10C19 14.9706 14.9706 19 10 19C1.02944 19 1 14.9706 1 10C1 5.02944 1.02944 1 10 1C14.9706 1 19 5.02944 19 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <span>Be specific with your search (e.g., "Italian restaurants in Rome")</span>
                            </div>
                        </div>
                    </div>
                `;
                searchContainer.style.display = 'block';
            }
            break;
            
        case 'history':
            showHistorySection();
            break;
            
        case 'settings':
            showSettingsSection();
            break;
            
        default:
            if (searchContainer) {
                searchContainer.style.display = 'block';
                updatePageHeader('Find Business Leads', 'Search Google Maps and extract 50+ businesses with contact information');
            }
    }
}

// Update page header
function updatePageHeader(title, subtitle) {
    const pageTitle = document.querySelector('.page-title');
    const pageSubtitle = document.querySelector('.page-subtitle');
    
    if (pageTitle) pageTitle.textContent = title;
    if (pageSubtitle) pageSubtitle.textContent = subtitle;
}

// Show history section
function showHistorySection() {
    updatePageHeader('Search History', 'View your previous searches and results');
    
    const mainContent = document.querySelector('.search-container');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="search-header">
                <h1 class="page-title">Search History</h1>
                <p class="page-subtitle">View your previous searches and results</p>
            </div>
            <div class="history-content">
                <div class="history-card">
                    <div class="history-icon">
                        <svg viewBox="0 0 24 24" fill="none" style="width: 48px; height: 48px; color: var(--gray-400);">
                            <path d="M12 8V12M12 16H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <h2 style="color: var(--gray-700); margin-bottom: var(--space-sm);">No Search History Yet</h2>
                    <p style="color: var(--gray-600); margin-bottom: var(--space-lg);">Your search history will appear here after you perform your first search.</p>
                    <button onclick="goToSearch()" class="btn btn-primary">
                        <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                            <path d="M17 17L13 13M15 9C15 12.3137 12.3137 15 9 15C5.68629 15 3 12.3137 3 9C3 5.68629 5.68629 3 9 3C12.3137 3 15 5.68629 15 9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Start Your First Search
                    </button>
                </div>
            </div>
        `;
        mainContent.style.display = 'block';
    }
}

// Show settings section  
function showSettingsSection() {
    updatePageHeader('Account Settings', 'Manage your account and preferences');
    
    const mainContent = document.querySelector('.search-container');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="search-header">
                <h1 class="page-title">Account Settings</h1>
                <p class="page-subtitle">Manage your account and preferences</p>
            </div>
            <div class="settings-content">
                <div class="settings-section">
                    <h2 class="settings-title">Account Information</h2>
                    <div class="settings-card">
                        <div class="setting-item">
                            <div class="setting-label">
                                <strong>Email Address</strong>
                                <p style="color: var(--gray-600); font-size: 0.875rem;">Your account email address</p>
                            </div>
                            <div class="setting-value">
                                <span style="color: var(--gray-700);">${currentUser ? currentUser.email : 'Not available'}</span>
                            </div>
                        </div>
                        <div class="setting-item">
                            <div class="setting-label">
                                <strong>Account Credits</strong>
                                <p style="color: var(--gray-600); font-size: 0.875rem;">Available search credits</p>
                            </div>
                            <div class="setting-value">
                                <span style="color: var(--primary); font-weight: 600;">${currentUser ? currentUser.credits : 0} credits</span>
                                <button onclick="showBuyCredits()" class="btn btn-primary btn-small" style="margin-left: var(--space-sm);">Buy More</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h2 class="settings-title">Preferences</h2>
                    <div class="settings-card">
                        <div class="setting-item">
                            <div class="setting-label">
                                <strong>Export Format</strong>
                                <p style="color: var(--gray-600); font-size: 0.875rem;">Default format for exporting results</p>
                            </div>
                            <div class="setting-value">
                                <select class="form-control" style="padding: var(--space-xs) var(--space-sm); border: 1px solid var(--gray-300); border-radius: var(--radius-md);">
                                    <option value="csv">CSV</option>
                                    <option value="json">JSON</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h2 class="settings-title" style="color: var(--error);">Danger Zone</h2>
                    <div class="settings-card" style="border-color: var(--error);">
                        <div class="setting-item">
                            <div class="setting-label">
                                <strong>Sign Out</strong>
                                <p style="color: var(--gray-600); font-size: 0.875rem;">Sign out of your account</p>
                            </div>
                            <div class="setting-value">
                                <button onclick="logout()" class="btn btn-secondary" style="color: var(--error); border-color: var(--error);">
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        mainContent.style.display = 'block';
    }
}

// Go to search page (helper function)
function goToSearch() {
    console.log('Going to search page');
    const searchNavItem = document.querySelector('.nav-item[href="#"]:first-of-type'); // First nav item is Search
    if (searchNavItem) {
        handleNavigation('Search', searchNavItem);
    }
}

// Check authentication
async function checkAuth() {
    console.log('Checking authentication...');
    try {
        const response = await fetch('/api/auth/me');
        console.log('Auth response status:', response.status);
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            console.log('User authenticated:', currentUser);
            showDashboard();
        } else {
            console.log('User not authenticated, showing auth form');
            showAuth();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showAuth();
    }
}

// Show auth section
function showAuth() {
    console.log('Showing auth section');
    console.log('Auth section element:', authSection);
    console.log('App section element:', appSection);
    
    if (authSection) {
        authSection.style.display = 'flex';
        console.log('Auth section display set to flex');
    }
    if (appSection) {
        appSection.style.display = 'none';
        console.log('App section hidden');
    }
    isAuthenticated = false;
    
    // Ensure login form is active by default
    switchAuthTab('login');
    
    // Test element visibility and clickability
    setTimeout(() => {
        const loginTab = document.querySelector('[data-tab="login"]');
        const registerTab = document.querySelector('[data-tab="register"]');
        const emailInput = document.getElementById('loginEmail');
        
        console.log('Login tab clickable:', loginTab && getComputedStyle(loginTab).pointerEvents !== 'none');
        console.log('Register tab clickable:', registerTab && getComputedStyle(registerTab).pointerEvents !== 'none');
        console.log('Email input visible:', emailInput && getComputedStyle(emailInput).display !== 'none');
        
        if (loginTab) {
            console.log('Login tab z-index:', getComputedStyle(loginTab).zIndex);
            console.log('Login tab position:', getComputedStyle(loginTab).position);
        }
    }, 100);
}

// Show dashboard
function showDashboard() {
    authSection.style.display = 'none';
    appSection.style.display = 'flex';
    isAuthenticated = true;
    
    // Update user info
    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('creditsCount').textContent = currentUser.credits || 0;
    
    // Add entrance animation
    appSection.style.opacity = '0';
    appSection.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        appSection.style.transition = 'all 0.3s ease-out';
        appSection.style.opacity = '1';
        appSection.style.transform = 'scale(1)';
    }, 10);
}

// Handle login
async function handleLogin(e) {
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    
    // Prevent multiple submissions
    if (submitButton.disabled) return;
    
    // Clear previous errors
    errorDiv.textContent = '';
    
    // Add loading state
    submitButton.disabled = true;
    submitButton.innerHTML = `
        <span>Signing in...</span>
        <div class="spinner"></div>
    `;
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            showDashboard();
            loginForm.reset();
            errorDiv.textContent = '';
        } else {
            const errorMessage = data.error || 'Login failed - invalid email or password';
            errorDiv.textContent = errorMessage;
            console.log('Login failed:', response.status, errorMessage);
            shakeElement(loginForm);
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error. Please try again.';
        shakeElement(loginForm);
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = `
            Sign In
            <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                <path d="M7 10L13 10M13 10L10 7M13 10L10 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    }
}

// Handle registration
async function handleRegister(e) {
    console.log('handleRegister called');
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const errorDiv = document.getElementById('registerError');
    const submitButton = registerForm.querySelector('button[type="submit"]');
    
    console.log('Register attempt:', { email, password: password.length > 0 ? '***' : 'empty' });
    
    // Prevent multiple submissions
    if (submitButton.disabled) return;
    
    // Clear previous errors
    errorDiv.textContent = '';
    
    // Add loading state
    submitButton.disabled = true;
    submitButton.innerHTML = `
        <span>Creating account...</span>
        <div class="spinner"></div>
    `;
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Auto-login after registration
            const loginResponse = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            if (loginResponse.ok) {
                const loginData = await loginResponse.json();
                currentUser = loginData.user;
                showDashboard();
                registerForm.reset();
                errorDiv.textContent = '';
            }
        } else {
            const errorMessage = data.error || 'Registration failed';
            errorDiv.textContent = errorMessage;
            console.log('Registration failed:', response.status, errorMessage);
            shakeElement(registerForm);
        }
    } catch (error) {
        errorDiv.textContent = 'Connection error. Please try again.';
        shakeElement(registerForm);
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = `
            Create Account
            <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                <path d="M7 10L13 10M13 10L10 7M13 10L10 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
    }
}

// Logout
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    currentUser = null;
    showAuth();
}

// Start search
async function startSearch() {
    const searchInputElement = document.getElementById('searchInput');
    const query = searchInputElement ? searchInputElement.value.trim() : '';
    
    console.log('Search started with query:', query);
    
    if (!query) {
        console.log('No query provided');
        if (searchInputElement) {
            shakeElement(searchInputElement);
            searchInputElement.focus();
        }
        return;
    }
    
    // Check credits
    if (currentUser.credits < 10) {
        showBuyCredits();
        return;
    }
    
    // Update UI
    const searchButtonElement = document.getElementById('searchButton');
    const buttonTextElement = document.getElementById('buttonText');
    const loadingSpinnerElement = document.getElementById('loadingSpinner');
    const statusContainerElement = document.getElementById('statusContainer');
    const resultsSectionElement = document.getElementById('resultsSection');
    
    if (searchButtonElement) searchButtonElement.disabled = true;
    if (buttonTextElement) buttonTextElement.style.display = 'none';
    if (loadingSpinnerElement) loadingSpinnerElement.style.display = 'block';
    
    if (statusContainerElement) statusContainerElement.style.display = 'block';
    if (resultsSectionElement) resultsSectionElement.style.display = 'none';
    
    updateStatus('Initializing search...', 0);
    
    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentSessionId = data.sessionId;
            currentUser.credits = data.remainingCredits;
            document.getElementById('creditsCount').textContent = currentUser.credits;
            
            // Start polling for status
            statusCheckInterval = setInterval(checkSearchStatus, 2000);
        } else {
            throw new Error(data.error || 'Search failed');
        }
    } catch (error) {
        updateStatus(`Error: ${error.message}`, 0);
        resetSearchButton();
    }
}

// Check search status
async function checkSearchStatus() {
    if (!currentSessionId) return;
    
    try {
        const response = await fetch(`/api/status/${currentSessionId}`);
        const data = await response.json();
        
        if (response.ok) {
            const { status, progress, message, results } = data;
            
            updateStatus(message || 'Processing...', progress);
            
            if (status === 'completed') {
                clearInterval(statusCheckInterval);
                displayResults(results);
                resetSearchButton();
            } else if (status === 'failed') {
                clearInterval(statusCheckInterval);
                updateStatus('Search failed. Please try again.', 0);
                resetSearchButton();
                
                // Refund credits on failure
                currentUser.credits += 10;
                document.getElementById('creditsCount').textContent = currentUser.credits;
            }
        }
    } catch (error) {
        console.error('Status check error:', error);
    }
}

// Update status
function updateStatus(message, progress) {
    const statusEl = document.getElementById('status');
    const progressFill = document.getElementById('progressFill');
    
    statusEl.textContent = message;
    progressFill.style.width = `${progress}%`;
}

// Display results
function displayResults(results) {
    statusContainer.style.display = 'none';
    resultsSection.style.display = 'block';
    
    document.getElementById('resultCount').textContent = results.length;
    
    const resultsGrid = document.getElementById('results');
    resultsGrid.innerHTML = '';
    
    results.forEach((business, index) => {
        const card = createBusinessCard(business);
        resultsGrid.appendChild(card);
        
        // Add staggered animation
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 50);
    });
}

// Create business card
function createBusinessCard(business) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'all 0.3s ease-out';
    
    const rating = business.rating ? `⭐ ${business.rating}` : '';
    const email = business.emails && business.emails.length > 0 
        ? `<div class="business-detail">
             <svg viewBox="0 0 24 24" fill="none">
               <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
             <a href="mailto:${business.emails[0]}" class="business-email">${business.emails[0]}</a>
           </div>` 
        : '';
    
    const website = business.website 
        ? `<div class="business-detail">
             <svg viewBox="0 0 24 24" fill="none">
               <path d="M10 13C10.4295 13.5741 10.9774 14.0491 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59695 21.9548 8.33394 21.9434 7.02296C21.932 5.71198 21.4061 4.45791 20.4791 3.53087C19.5521 2.60383 18.298 2.07799 16.987 2.0666C15.676 2.0552 14.413 2.55918 13.47 3.46997L11.75 5.17997M14 11C13.5705 10.4258 13.0226 9.95078 12.3934 9.60703C11.7642 9.26327 11.0685 9.05885 10.3533 9.00763C9.63819 8.95641 8.92037 9.0596 8.24864 9.31018C7.57691 9.56077 6.96684 9.9529 6.46 10.46L3.46 13.46C2.54921 14.403 2.04523 15.666 2.05662 16.977C2.06801 18.288 2.59385 19.542 3.52089 20.4691C4.44793 21.396 5.702 21.9219 7.01298 21.9333C8.32396 21.9447 9.58697 21.4407 10.53 20.53L12.24 18.82" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
             </svg>
             <a href="${business.website}" target="_blank" rel="noopener">${new URL(business.website).hostname}</a>
           </div>` 
        : '';
    
    card.innerHTML = `
        <div class="business-header">
            <h3 class="business-name">${business.name || 'Unknown Business'}</h3>
            ${rating ? `<div class="business-rating">${rating}</div>` : ''}
        </div>
        <div class="business-details">
            <div class="business-detail">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 5.58172 6.58172 2 11 2C15.4183 2 19 5.58172 19 10Z" stroke="currentColor" stroke-width="2"/>
                    <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2"/>
                </svg>
                <span>${business.address || 'No address'}</span>
            </div>
            ${business.phone ? `
                <div class="business-detail">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M22 16.92V19.92C22.0011 20.1985 21.9441 20.4742 21.8325 20.7293C21.7209 20.9845 21.5573 21.2136 21.3521 21.4019C21.1468 21.5901 20.9046 21.7335 20.6407 21.8227C20.3769 21.9119 20.0974 21.9451 19.82 21.92C16.7428 21.5856 13.787 20.5341 11.19 18.85C8.77382 17.3147 6.72533 15.2662 5.18999 12.85C3.49997 10.2412 2.44824 7.27099 2.11999 4.18C2.09501 3.90347 2.12787 3.62476 2.21649 3.36162C2.30512 3.09849 2.44756 2.85669 2.63476 2.65162C2.82196 2.44655 3.0498 2.28271 3.30379 2.17052C3.55777 2.05833 3.83233 2.00026 4.10999 2H7.10999C7.5953 1.99522 8.06579 2.16708 8.43376 2.48353C8.80173 2.79999 9.04207 3.23945 9.10999 3.72C9.23662 4.68007 9.47144 5.62273 9.80999 6.53C9.94454 6.88792 9.97366 7.27691 9.89391 7.65088C9.81415 8.02485 9.62886 8.36811 9.35999 8.64L8.08999 9.91C9.51355 12.4135 11.5864 14.4864 14.09 15.91L15.36 14.64C15.6319 14.3711 15.9751 14.1858 16.3491 14.1061C16.7231 14.0263 17.1121 14.0555 17.47 14.19C18.3773 14.5286 19.3199 14.7634 20.28 14.89C20.7658 14.9585 21.2094 15.2032 21.5265 15.5775C21.8437 15.9518 22.0122 16.4296 22 16.92Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <a href="tel:${business.phone}">${business.phone}</a>
                </div>
            ` : ''}
            ${website}
            ${email}
        </div>
    `;
    
    return card;
}

// Export results
async function exportResults(format) {
    if (!currentSessionId) return;
    
    try {
        const response = await fetch(`/api/export/${currentSessionId}/${format}`);
        
        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `businesses_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export results');
    }
}

// Buy credits modal
function showBuyCredits() {
    buyCreditsModal.style.display = 'flex';
    buyCreditsModal.style.opacity = '0';
    
    setTimeout(() => {
        buyCreditsModal.style.transition = 'opacity 0.3s ease-out';
        buyCreditsModal.style.opacity = '1';
    }, 10);
}

function closeBuyCredits() {
    buyCreditsModal.style.opacity = '0';
    setTimeout(() => {
        buyCreditsModal.style.display = 'none';
    }, 300);
}

// Buy credits
async function buyCredits(credits, amount) {
    try {
        const response = await fetch('/api/payments/create-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credits, amount })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store purchase ID
            localStorage.setItem('pendingPurchaseId', data.purchaseId);
            
            // Redirect to Stripe
            window.location.href = `https://buy.stripe.com/14AdR89kIbVBgAPbxF7AI00?client_reference_id=${data.purchaseId}`;
        } else {
            alert('Failed to create purchase. Please try again.');
        }
    } catch (error) {
        console.error('Purchase error:', error);
        alert('Connection error. Please try again.');
    }
}

// Helper functions
function resetSearchButton() {
    const searchButtonElement = document.getElementById('searchButton');
    const buttonTextElement = document.getElementById('buttonText');
    const loadingSpinnerElement = document.getElementById('loadingSpinner');
    
    if (searchButtonElement) searchButtonElement.disabled = false;
    if (buttonTextElement) buttonTextElement.style.display = 'inline';
    if (loadingSpinnerElement) loadingSpinnerElement.style.display = 'none';
}

function shakeElement(element) {
    element.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
        element.style.animation = '';
    }, 500);
}

// Add shake animation
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
`;
document.head.appendChild(shakeStyle);

// Check for pending purchase on page load
window.addEventListener('load', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const purchaseComplete = urlParams.get('purchase_complete');
    
    if (purchaseComplete === 'true') {
        const purchaseId = localStorage.getItem('pendingPurchaseId');
        
        if (purchaseId) {
            try {
                const response = await fetch('/api/payments/complete-purchase', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ purchaseId })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    currentUser.credits = data.newCredits;
                    document.getElementById('creditsCount').textContent = currentUser.credits;
                    
                    // Show success message
                    const successMessage = document.createElement('div');
                    successMessage.className = 'success-toast';
                    successMessage.textContent = '✅ Credits added successfully!';
                    successMessage.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: var(--success);
                        color: white;
                        padding: var(--space-md) var(--space-lg);
                        border-radius: var(--radius-lg);
                        box-shadow: var(--shadow-lg);
                        z-index: 1000;
                        animation: slideIn 0.3s ease-out;
                    `;
                    
                    document.body.appendChild(successMessage);
                    
                    setTimeout(() => {
                        successMessage.style.animation = 'slideOut 0.3s ease-out';
                        setTimeout(() => successMessage.remove(), 300);
                    }, 3000);
                    
                    localStorage.removeItem('pendingPurchaseId');
                }
            } catch (error) {
                console.error('Purchase completion error:', error);
            }
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

// Add slide animations
const slideStyle = document.createElement('style');
slideStyle.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(slideStyle);