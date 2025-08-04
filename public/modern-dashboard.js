// Modern Dashboard JavaScript

// XSS Protection - HTML sanitization utility
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Safe DOM helper functions
function setTextContent(element, text) {
    if (element) {
        element.textContent = text || '';
    }
}

function setInnerHTML(element, html) {
    if (element) {
        // Only use innerHTML for pre-sanitized content
        element.innerHTML = html;
    }
}

function createSafeElement(tagName, textContent, attributes = {}) {
    const element = document.createElement(tagName);
    if (textContent) {
        element.textContent = textContent;
    }
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'href' && !value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('tel:') && !value.startsWith('mailto:')) {
            // Validate URL schemes for security
            continue;
        }
        element.setAttribute(key, value);
    }
    return element;
}

// Global variables
let isAuthenticated = false;
let currentUser = null;
let currentSessionId = null;
let statusCheckInterval = null;
let searchHistory = []; // Store completed searches
let activeSearch = null; // Track active search state
let isSearchInProgress = false; // Track if search is in progress
let sentEmails = []; // Store sent emails history
let userSettings = {
    companyName: '',
    companyDescription: '',
    services: '',
    contactPerson: '',
    emailSignature: '',
    companyLogo: null
};

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

// Load persistent data from database
async function loadPersistentData() {
    console.log('Loading persistent data...');
    
    try {
        // Load search results
        const searchResponse = await fetch('/api/search-results', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.searchResults) {
                // Convert database format to frontend format
                searchHistory = searchData.searchResults.map(result => ({
                    query: result.search_query,
                    results: result.results_data,
                    count: result.results_count,
                    timestamp: result.created_at,
                    sessionId: result.session_id
                }));
                console.log(`Loaded ${searchHistory.length} search results from database`);
            }
        }
        
        // Load sent emails
        const emailResponse = await fetch('/api/email/history', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (emailResponse.ok) {
            const emailData = await emailResponse.json();
            if (emailData.emails) {
                sentEmails = emailData.emails;
                console.log(`Loaded ${sentEmails.length} sent emails from database`);
            }
        }
        
        // Load user settings
        const settingsResponse = await fetch('/api/user-settings', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (settingsResponse.ok) {
            const settingsData = await settingsResponse.json();
            if (settingsData.settings) {
                // Update userSettings object with database data
                userSettings = {
                    companyName: settingsData.settings.company_name || '',
                    companyDescription: settingsData.settings.company_description || '',
                    services: settingsData.settings.services || '',
                    contactPerson: settingsData.settings.contact_person || '',
                    emailSignature: settingsData.settings.email_signature || '',
                    companyLogo: settingsData.settings.company_logo || null
                };
                
                // Also load email configuration if exists
                if (settingsData.settings.email_config) {
                    localStorage.setItem('emailConfig', JSON.stringify(settingsData.settings.email_config));
                }
                
                console.log('Loaded user settings from database');
            }
        }
        
    } catch (error) {
        console.error('Error loading persistent data:', error);
    }
}

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
    
    // Main button event listeners
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
    
    const buyCreditsButton = document.getElementById('buyCreditsButton');
    if (buyCreditsButton) {
        buyCreditsButton.addEventListener('click', showBuyCredits);
    }
    
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', startSearch);
    }
    
    const exportCsvButton = document.getElementById('exportCsvButton');
    if (exportCsvButton) {
        exportCsvButton.addEventListener('click', () => exportResults('csv'));
    }
    
    const exportJsonButton = document.getElementById('exportJsonButton');
    if (exportJsonButton) {
        exportJsonButton.addEventListener('click', () => exportResults('json'));
    }
    
    const exportExcelButton = document.getElementById('exportExcelButton');
    if (exportExcelButton) {
        exportExcelButton.addEventListener('click', () => exportResults('excel'));
    }
    
    // Modal event listeners
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeBuyCredits);
    }
    
    const modalCloseButton = document.getElementById('modalCloseButton');
    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', closeBuyCredits);
    }
    
    const buyCreditsModalButton = document.getElementById('buyCreditsModalButton');
    if (buyCreditsModalButton) {
        buyCreditsModalButton.addEventListener('click', () => buyCredits());
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
    
    // Hide all sections first (but keep search running in background)
    if (searchContainer) searchContainer.style.display = 'none';
    if (statusContainer && !isSearchInProgress) statusContainer.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    
    // If search is in progress, show indicator
    if (isSearchInProgress) {
        showSearchProgressIndicator();
    }
    
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
            
        case 'results':
            showResultsSection();
            break;
            
        case 'emails sent':
            showEmailsSentSection();
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
        if (searchHistory.length === 0) {
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
        } else {
            // Display actual search history
            let historyHTML = `
                <div class="search-header">
                    <h1 class="page-title">Search History</h1>
                    <p class="page-subtitle">View your previous searches and results</p>
                </div>
                <div class="history-content">
            `;
            
            searchHistory.forEach((search, index) => {
                const searchDate = new Date(search.timestamp).toLocaleDateString();
                const searchTime = new Date(search.timestamp).toLocaleTimeString();
                
                historyHTML += `
                    <div class="history-item">
                        <div class="history-item-header">
                            <h3>${escapeHtml(search.query)}</h3>
                            <span class="history-date">${searchDate} • ${searchTime}</span>
                        </div>
                        <div class="history-item-meta">
                            <span class="business-count">${search.count || search.results?.length || 0} businesses found</span>
                            <div class="history-actions">
                                <button onclick="viewSearchResults(${index})" class="btn btn-secondary btn-sm">
                                    <svg class="btn-icon" viewBox="0 0 20 20" fill="none" style="width: 16px; height: 16px;">
                                        <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M2.04834 10C3.11834 6.50002 6.23167 4.16669 10 4.16669C13.7683 4.16669 16.8817 6.50002 17.9517 10C16.8817 13.5 13.7683 15.8334 10 15.8334C6.23167 15.8334 3.11834 13.5 2.04834 10Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    View Results
                                </button>
                                <button onclick="exportSearchResults(${index}, 'csv')" class="btn btn-outline btn-sm">
                                    <svg class="btn-icon" viewBox="0 0 20 20" fill="none" style="width: 16px; height: 16px;">
                                        <path d="M4.16669 15.8334H15.8334V17.5H4.16669V15.8334ZM15.8334 8.33335L10 14.1667L4.16669 8.33335H7.50002V2.50002H12.5V8.33335H15.8334Z" fill="currentColor"/>
                                    </svg>
                                    CSV
                                </button>
                                <button onclick="exportSearchResults(${index}, 'excel')" class="btn btn-primary btn-sm">
                                    <svg class="btn-icon" viewBox="0 0 20 20" fill="none" style="width: 16px; height: 16px;">
                                        <path d="M3.33331 2.5H16.6666C17.5833 2.5 18.3333 3.25 18.3333 4.16667V15.8333C18.3333 16.75 17.5833 17.5 16.6666 17.5H3.33331C2.41665 17.5 1.66665 16.75 1.66665 15.8333V4.16667C1.66665 3.25 2.41665 2.5 3.33331 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M1.66665 7.5H18.3333M5.83331 2.5V17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                    Excel
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            historyHTML += '</div>';
            mainContent.innerHTML = historyHTML;
        }
        mainContent.style.display = 'block';
    }
}

// Show results section
function showResultsSection() {
    updatePageHeader('Search Results', 'View and export your completed searches');
    
    const mainContent = document.querySelector('.search-container');
    if (mainContent) {
        if (searchHistory.length === 0) {
            mainContent.innerHTML = `
                <div class="search-header">
                    <h1 class="page-title">Search Results</h1>
                    <p class="page-subtitle">View and export your completed searches</p>
                </div>
                <div class="history-content">
                    <div class="history-card">
                        <div class="history-icon">
                            <svg viewBox="0 0 24 24" fill="none" style="width: 48px; height: 48px; color: var(--gray-400);">
                                <path d="M9 12H15M9 16H15M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H12.5858C12.851 3 13.1054 3.10536 13.2929 3.29289L19.7071 9.70711C19.8946 9.89464 20 10.149 20 10.4142V19C20 20.1046 19.1046 21 18 21H17ZM17 21V11H13V7H7V19H17Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <h2 style="color: var(--gray-700); margin-bottom: var(--space-sm);">No Search Results Yet</h2>
                        <p style="color: var(--gray-600); margin-bottom: var(--space-lg);">Complete a search to view and export your results here.</p>
                        <button id="startFirstSearchButton" class="btn btn-primary">
                            <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                                <path d="M17 17L13 13M15 9C15 12.3137 12.3137 15 9 15C5.68629 15 3 12.3137 3 9C3 5.68629 5.68629 3 9 3C12.3137 3 15 5.68629 15 9Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Start Your First Search
                        </button>
                    </div>
                </div>
            `;
            
            // Add event listener for the start first search button
            setTimeout(() => {
                const startFirstSearchButton = document.getElementById('startFirstSearchButton');
                if (startFirstSearchButton) {
                    startFirstSearchButton.addEventListener('click', goToSearch);
                }
            }, 0);
        } else {
            // Create search history cards safely
            const resultsList = document.createElement('div');
            resultsList.className = 'results-list';
            
            searchHistory.forEach(search => {
                const card = document.createElement('div');
                card.className = 'result-card';
                
                const header = document.createElement('div');
                header.className = 'result-header';
                
                const info = document.createElement('div');
                info.className = 'result-info';
                
                // Safe query display
                const query = createSafeElement('h3', `"${search.query}"`, { class: 'result-query' });
                info.appendChild(query);
                
                const meta = document.createElement('div');
                meta.className = 'result-meta';
                
                const count = createSafeElement('span', `${search.count || search.results?.length || 0} businesses`, { class: 'result-count' });
                const date = createSafeElement('span', new Date(search.timestamp).toLocaleString(), { class: 'result-date' });
                meta.appendChild(count);
                meta.appendChild(date);
                info.appendChild(meta);
                
                const actions = document.createElement('div');
                actions.className = 'result-actions';
                
                const viewButton = document.createElement('button');
                viewButton.className = 'btn btn-primary btn-sm';
                viewButton.innerHTML = `
                    <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                        <path d="M10 12.5L10 7.5M10 12.5L7.5 10M10 12.5L12.5 10M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    View Results
                `;
                viewButton.addEventListener('click', () => viewSearchResults(search.id));
                actions.appendChild(viewButton);
                
                header.appendChild(info);
                header.appendChild(actions);
                card.appendChild(header);
                resultsList.appendChild(card);
            });
            
            // Clear and rebuild content safely
            mainContent.innerHTML = '';
            
            const header = document.createElement('div');
            header.className = 'search-header';
            
            const title = createSafeElement('h1', 'Search Results', { class: 'page-title' });
            const subtitle = createSafeElement('p', 'View and export your completed searches', { class: 'page-subtitle' });
            header.appendChild(title);
            header.appendChild(subtitle);
            
            mainContent.appendChild(header);
            mainContent.appendChild(resultsList);
        }
        mainContent.style.display = 'block';
    }
}

// Show emails sent section
function showEmailsSentSection() {
    updatePageHeader('Emails Sent', 'View and manage your sent personalized emails');
    
    const mainContent = document.querySelector('.search-container');
    if (mainContent) {
        // Load sent emails from localStorage
        const savedEmails = JSON.parse(localStorage.getItem('sentEmails') || '[]');
        
        mainContent.innerHTML = `
            <div class="search-header">
                <h1 class="page-title">Emails Sent</h1>
                <p class="page-subtitle">View and manage your sent personalized emails</p>
            </div>
            <div class="emails-sent-content">
                ${savedEmails.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon">📧</div>
                        <h3>No emails sent yet</h3>
                        <p>When you generate and send personalized emails, they'll appear here.</p>
                    </div>
                ` : `
                    <div class="emails-grid">
                        ${savedEmails.map(email => `
                            <div class="email-card">
                                <div class="email-header">
                                    <h4>${escapeHtml(email.businessName)}</h4>
                                    <span class="email-date">${email.sentAt}</span>
                                </div>
                                <div class="email-preview">
                                    <strong>Subject:</strong> ${escapeHtml(email.subject)}<br>
                                    <div class="email-body-preview">${escapeHtml(email.body.substring(0, 150))}...</div>
                                </div>
                                <div class="email-actions">
                                    <button onclick="viewFullEmail('${email.id}')" class="btn btn-secondary btn-sm">View Full</button>
                                    <a href="mailto:${email.businessEmail}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}" class="btn btn-primary btn-sm">Send Again</a>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;
        mainContent.style.display = 'block';
    }
}

// Show settings section  
function showSettingsSection() {
    updatePageHeader('Settings', 'Configure your business information and email preferences');
    
    // Load settings from localStorage
    const savedSettings = JSON.parse(localStorage.getItem('userSettings') || '{}');
    userSettings = { ...userSettings, ...savedSettings };
    
    const mainContent = document.querySelector('.search-container');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="search-header">
                <h1 class="page-title">Settings</h1>
                <p class="page-subtitle">Configure your business information and email preferences</p>
            </div>
            <div class="settings-content">
                <!-- Account Information -->
                <div class="settings-section">
                    <h2 class="settings-title">
                        <svg class="section-icon" viewBox="0 0 24 24" fill="none">
                            <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Account Information
                    </h2>
                    <div class="settings-card">
                        <div class="setting-item">
                            <div class="setting-label">
                                <strong>Email Address</strong>
                                <p>Your account email address</p>
                            </div>
                            <div class="setting-value">
                                <span id="userEmailDisplay">Loading...</span>
                            </div>
                        </div>
                        <div class="setting-item">
                            <div class="setting-label">
                                <strong>Account Credits</strong>
                                <p>Available search credits</p>
                            </div>
                            <div class="setting-value">
                                <span id="userCreditsDisplay" class="credits-display">Loading...</span>
                                <button id="buyMoreCreditsButton" class="btn btn-primary btn-sm">Buy More Credits</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Business Information -->
                <div class="settings-section">
                    <h2 class="settings-title">
                        <svg class="section-icon" viewBox="0 0 24 24" fill="none">
                            <path d="M19 21V5C19 4.44772 18.5523 4 18 4H6C5.44772 4 5 4.44772 5 5V21L12 17L19 21Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Business Information
                    </h2>
                    <div class="settings-card">
                        <div class="form-group">
                            <label class="form-label">Company Name</label>
                            <input type="text" id="companyName" class="form-input" placeholder="Your company name" value="${escapeHtml(userSettings.companyName || '')}">
                            <small>This will be used in personalized emails</small>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Company Description</label>
                            <textarea id="companyDescription" class="form-input" rows="3" placeholder="Brief description of your company...">${escapeHtml(userSettings.companyDescription || '')}</textarea>
                            <small>Help AI understand your business better</small>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Services/Products</label>
                            <input type="text" id="services" class="form-input" placeholder="e.g., Web development, Marketing, Consulting" value="${escapeHtml(userSettings.services || '')}">
                            <small>What do you offer? This helps personalize emails</small>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Contact Person</label>
                            <input type="text" id="contactPerson" class="form-input" placeholder="Your name or sales person name" value="${escapeHtml(userSettings.contactPerson || '')}">
                            <small>Name to use in email signatures</small>
                        </div>
                    </div>
                </div>
                
                <!-- Email Settings -->
                <div class="settings-section">
                    <h2 class="settings-title">
                        <svg class="section-icon" viewBox="0 0 24 24" fill="none">
                            <path d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Email Configuration
                    </h2>
                    <div class="settings-card">
                        <div class="form-group">
                            <label class="form-label">Email Signature</label>
                            <textarea id="emailSignature" class="form-input" rows="6" placeholder="Best regards,
[Your Name]
[Your Title]
[Company Name]
[Phone] | [Email] | [Website]">${escapeHtml(userSettings.emailSignature || '')}</textarea>
                            <small>This signature will be automatically added to generated emails</small>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Company Logo</label>
                            <div class="logo-upload-area">
                                <input type="file" id="logoUpload" accept="image/*" style="display: none;">
                                <div class="logo-preview" id="logoPreview">
                                    ${userSettings.companyLogo ? `<img src="${userSettings.companyLogo}" alt="Company Logo">` : '<div class="logo-placeholder">📷 Upload Logo</div>'}
                                </div>
                                <div class="logo-actions">
                                    <button onclick="document.getElementById('logoUpload').click()" class="btn btn-secondary btn-sm">Choose Image</button>
                                    ${userSettings.companyLogo ? '<button onclick="removeLogo()" class="btn btn-outline btn-sm">Remove</button>' : ''}
                                </div>
                            </div>
                            <small>Recommended: 200x80px, PNG/JPG format</small>
                        </div>
                    </div>
                </div>
                
                <!-- Connect Email Account -->
                <div class="settings-section">
                    <h2 class="settings-title">
                        <svg class="section-icon" viewBox="0 0 24 24" fill="none">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Connect Your Email
                    </h2>
                    <div class="settings-card email-connect-card">
                        <div class="email-provider-tabs">
                            <button class="provider-tab active" onclick="showEmailProvider('gmail')">
                                <img src="https://www.google.com/gmail/about/static-2.0/images/logo-gmail.png" alt="Gmail" class="provider-logo">
                                Gmail
                            </button>
                            <button class="provider-tab" onclick="showEmailProvider('outlook')">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg" alt="Outlook" class="provider-logo">
                                Outlook
                            </button>
                            <button class="provider-tab" onclick="showEmailProvider('custom')">
                                <svg class="provider-logo" viewBox="0 0 24 24" fill="none">
                                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                Custom SMTP
                            </button>
                        </div>
                        
                        <div id="emailProviderContent">
                            <!-- Gmail Instructions (default) -->
                            <div id="gmail-setup" class="provider-setup">
                                <div class="setup-instructions">
                                    <h3>📧 Connect Your Gmail Account</h3>
                                    <p>To send emails directly from LeadFinders, you need to create an app-specific password:</p>
                                    
                                    <div class="instruction-steps">
                                        <div class="step">
                                            <span class="step-number">1</span>
                                            <div class="step-content">
                                                <p><strong>Enable 2-Factor Authentication</strong></p>
                                                <p>First, make sure 2FA is enabled on your Google account</p>
                                                <a href="https://myaccount.google.com/security" target="_blank" class="btn btn-secondary btn-sm">
                                                    Go to Security Settings →
                                                </a>
                                            </div>
                                        </div>
                                        
                                        <div class="step">
                                            <span class="step-number">2</span>
                                            <div class="step-content">
                                                <p><strong>Create App Password</strong></p>
                                                <p>Generate a special password for LeadFinders</p>
                                                <a href="https://myaccount.google.com/apppasswords" target="_blank" class="btn btn-primary btn-sm">
                                                    Create App Password →
                                                </a>
                                            </div>
                                        </div>
                                        
                                        <div class="step">
                                            <span class="step-number">3</span>
                                            <div class="step-content">
                                                <p><strong>Configure Below</strong></p>
                                                <p>Enter your email and the 16-character app password</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="email-config-form">
                                    <div class="form-group">
                                        <label class="form-label">Gmail Address</label>
                                        <input type="email" id="gmail-email" class="form-input" placeholder="your@gmail.com">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">App Password</label>
                                        <input type="password" id="gmail-password" class="form-input" placeholder="xxxx xxxx xxxx xxxx">
                                        <small>16-character password from Google (not your regular password)</small>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Outlook Instructions -->
                            <div id="outlook-setup" class="provider-setup" style="display: none;">
                                <div class="setup-instructions">
                                    <h3>📮 Connect Your Outlook Account</h3>
                                    <p>To send emails directly from LeadFinders via Outlook, follow these steps:</p>
                                    
                                    <div class="instruction-steps">
                                        <div class="step">
                                            <span class="step-number">1</span>
                                            <div class="step-content">
                                                <p><strong>Go to Security Settings</strong></p>
                                                <p>Access your Microsoft account security page</p>
                                                <a href="https://account.microsoft.com/security" target="_blank" class="btn btn-secondary btn-sm">
                                                    Microsoft Security →
                                                </a>
                                            </div>
                                        </div>
                                        
                                        <div class="step">
                                            <span class="step-number">2</span>
                                            <div class="step-content">
                                                <p><strong>Create App Password</strong></p>
                                                <p>Under "Advanced security" → "App passwords"</p>
                                                <a href="https://account.live.com/proofs/AppPassword" target="_blank" class="btn btn-primary btn-sm">
                                                    Create App Password →
                                                </a>
                                            </div>
                                        </div>
                                        
                                        <div class="step">
                                            <span class="step-number">3</span>
                                            <div class="step-content">
                                                <p><strong>Configure Below</strong></p>
                                                <p>Enter your email and the generated app password</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="email-config-form">
                                    <div class="form-group">
                                        <label class="form-label">Outlook Email</label>
                                        <input type="email" id="outlook-email" class="form-input" placeholder="your@outlook.com">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">App Password</label>
                                        <input type="password" id="outlook-password" class="form-input" placeholder="Generated app password">
                                        <small>App password from Microsoft (not your regular password)</small>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Custom SMTP -->
                            <div id="custom-setup" class="provider-setup" style="display: none;">
                                <div class="setup-instructions">
                                    <h3>⚙️ Custom SMTP Configuration</h3>
                                    <p>Configure your own SMTP server for sending emails:</p>
                                </div>
                                
                                <div class="email-config-form">
                                    <div class="form-group">
                                        <label class="form-label">SMTP Host</label>
                                        <input type="text" id="custom-host" class="form-input" placeholder="smtp.example.com">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">SMTP Port</label>
                                        <input type="number" id="custom-port" class="form-input" placeholder="587" value="587">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Email Address</label>
                                        <input type="email" id="custom-email" class="form-input" placeholder="your@domain.com">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Password</label>
                                        <input type="password" id="custom-password" class="form-input" placeholder="Your email password">
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="email-config-actions">
                            <button onclick="testEmailConfiguration()" class="btn btn-secondary">
                                <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" stroke-width="2"/>
                                    <path d="M10 6v4l2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                                Test Connection
                            </button>
                            <button onclick="saveEmailConfiguration()" class="btn btn-primary">
                                <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                                    <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                Save Configuration
                            </button>
                        </div>
                        
                        <div id="emailConfigStatus" class="config-status"></div>
                    </div>
                </div>
                
                <!-- Save Button -->
                <div class="settings-actions">
                    <button onclick="saveSettings()" class="btn btn-primary btn-large">Save Settings</button>
                    <button onclick="resetSettings()" class="btn btn-outline btn-large">Reset to Defaults</button>
                </div>
            </div>
        `;
        mainContent.style.display = 'block';
        
        // Initialize settings
        initializeSettings();
    }
}

// Initialize settings functionality
function initializeSettings() {
    // Populate user data
    setTimeout(() => {
        const userEmailDisplay = document.getElementById('userEmailDisplay');
        const userCreditsDisplay = document.getElementById('userCreditsDisplay');
        const buyMoreCreditsButton = document.getElementById('buyMoreCreditsButton');
        
        if (userEmailDisplay) {
            setTextContent(userEmailDisplay, currentUser ? currentUser.email : 'Not available');
        }
        if (userCreditsDisplay) {
            setTextContent(userCreditsDisplay, currentUser ? `${currentUser.credits} credits` : '0 credits');
        }
        if (buyMoreCreditsButton) {
            buyMoreCreditsButton.addEventListener('click', showBuyCredits);
        }
        
        // Setup logo upload
        const logoUpload = document.getElementById('logoUpload');
        if (logoUpload) {
            logoUpload.addEventListener('change', handleLogoUpload);
        }
    }, 100);
}

// Handle logo upload
function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const logoPreview = document.getElementById('logoPreview');
            if (logoPreview) {
                logoPreview.innerHTML = `<img src="${e.target.result}" alt="Company Logo">`;
                userSettings.companyLogo = e.target.result;
                
                // Update actions
                const logoActions = logoPreview.nextElementSibling;
                if (logoActions) {
                    logoActions.innerHTML = `
                        <button onclick="document.getElementById('logoUpload').click()" class="btn btn-secondary btn-sm">Change Image</button>
                        <button onclick="removeLogo()" class="btn btn-outline btn-sm">Remove</button>
                    `;
                }
            }
        };
        reader.readAsDataURL(file);
    }
}

// Remove logo
function removeLogo() {
    const logoPreview = document.getElementById('logoPreview');
    if (logoPreview) {
        logoPreview.innerHTML = '<div class="logo-placeholder">📷 Upload Logo</div>';
        userSettings.companyLogo = null;
        
        // Update actions
        const logoActions = logoPreview.nextElementSibling;
        if (logoActions) {
            logoActions.innerHTML = '<button onclick="document.getElementById(\'logoUpload\').click()" class="btn btn-secondary btn-sm">Choose Image</button>';
        }
    }
}

// Save settings
async function saveSettings() {
    // Get form values
    const companyName = document.getElementById('companyName')?.value || '';
    const companyDescription = document.getElementById('companyDescription')?.value || '';
    const services = document.getElementById('services')?.value || '';
    const contactPerson = document.getElementById('contactPerson')?.value || '';
    const emailSignature = document.getElementById('emailSignature')?.value || '';
    
    // Update settings object
    userSettings = {
        ...userSettings,
        companyName,
        companyDescription,
        services,
        contactPerson,
        emailSignature
    };
    
    try {
        // Save to database
        const emailConfig = localStorage.getItem('emailConfig') ? JSON.parse(localStorage.getItem('emailConfig')) : null;
        
        const response = await fetch('/api/user-settings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                ...userSettings,
                emailConfig: emailConfig
            })
        });
        
        if (response.ok) {
            // Also save to localStorage as backup
            localStorage.setItem('userSettings', JSON.stringify(userSettings));
            showNotification('Settings saved successfully!', 'success');
        } else {
            throw new Error('Failed to save settings to database');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        // Fallback to localStorage only
        localStorage.setItem('userSettings', JSON.stringify(userSettings));
        showNotification('Settings saved locally (database save failed)', 'warning');
    }
}

// Reset settings
async function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
        userSettings = {
            companyName: '',
            companyDescription: '',
            services: '',
            contactPerson: '',
            emailSignature: '',
            companyLogo: null
        };
        
        try {
            // Reset in database
            const response = await fetch('/api/user-settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(userSettings)
            });
            
            if (response.ok) {
                localStorage.removeItem('userSettings');
                showSettingsSection(); // Refresh the page
                showNotification('Settings reset to defaults', 'info');
            } else {
                throw new Error('Failed to reset settings in database');
            }
        } catch (error) {
            console.error('Error resetting settings:', error);
            // Fallback to local reset
            localStorage.removeItem('userSettings');
            showSettingsSection();
            showNotification('Settings reset locally (database reset failed)', 'warning');
        }
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${escapeHtml(message)}</span>
            <button onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Go to search page (helper function)
function goToSearch() {
    console.log('Going to search page');
    const searchNavItem = document.querySelector('.nav-item[href="#"]:first-of-type'); // First nav item is Search
    if (searchNavItem) {
        handleNavigation('Search', searchNavItem);
    }
}

// View search results from history
function viewSearchResults(index) {
    if (searchHistory[index] && searchHistory[index].results) {
        // Store current results for viewing
        currentSearchResults = searchHistory[index].results;
        currentSearchQuery = searchHistory[index].query;
        
        // Switch to results tab and display
        const resultsNavItem = document.querySelector('.nav-item:nth-child(3)'); // Results tab
        if (resultsNavItem) {
            handleNavigation('Results', resultsNavItem);
        }
        
        // Display the specific results
        setTimeout(() => {
            displaySearchResults(searchHistory[index].results, searchHistory[index].query);
        }, 100);
    }
}

// Export search results from history
function exportSearchResults(index, format) {
    if (searchHistory[index] && searchHistory[index].results) {
        const results = searchHistory[index].results;
        const query = searchHistory[index].query;
        
        if (format === 'csv') {
            exportToCSV(results, query);
        } else if (format === 'json') {
            exportToJSON(results, query);
        } else if (format === 'excel') {
            exportToExcel(results, query);
        }
    }
}

// Export to CSV function
function exportToCSV(results, query) {
    const headers = ['Name', 'Address', 'Phone', 'Email', 'Website'];
    const csvContent = [
        headers.join(','),
        ...results.map(business => [
            `"${(business.name || '').replace(/"/g, '""')}"`,
            `"${(business.address || '').replace(/"/g, '""')}"`,
            `"${(business.phone || '').replace(/"/g, '""')}"`,
            `"${(business.email || '').replace(/"/g, '""')}"`,
            `"${(business.website || '').replace(/"/g, '""')}"`
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${query.replace(/[^a-z0-9]/gi, '_')}_results.csv`;
    link.click();
}

// Export to JSON function
function exportToJSON(results, query) {
    const jsonContent = JSON.stringify({
        query: query,
        exportDate: new Date().toISOString(),
        totalResults: results.length,
        results: results
    }, null, 2);
    
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${query.replace(/[^a-z0-9]/gi, '_')}_results.json`;
    link.click();
}

// Export to Excel function (using SheetJS)
function exportToExcel(results, query) {
    // Create a new workbook
    const wb = XLSX.utils.book_new();
    
    // Prepare data for Excel
    const data = results.map(business => ({
        'Business Name': business.name || '',
        'Address': business.address || '',
        'Phone Number': business.phone || '',
        'Email Address': business.email || '',
        'Website': business.website || ''
    }));
    
    // Add search info sheet
    const infoData = [
        ['Search Query', query],
        ['Export Date', new Date().toLocaleString()],
        ['Total Results', results.length],
        ['', ''],
        ['Generated by', 'LeadFinders Business Scraper']
    ];
    
    // Create worksheets
    const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
    const wsResults = XLSX.utils.json_to_sheet(data);
    
    // Add worksheets to workbook
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Search Info');
    XLSX.utils.book_append_sheet(wb, wsResults, 'Business Results');
    
    // Auto-size columns
    const colWidths = [
        { wch: 30 }, // Business Name
        { wch: 40 }, // Address  
        { wch: 15 }, // Phone
        { wch: 25 }, // Email
        { wch: 35 }  // Website
    ];
    wsResults['!cols'] = colWidths;
    
    // Export the file
    XLSX.writeFile(wb, `${query.replace(/[^a-z0-9]/gi, '_')}_results.xlsx`);
}

// Check authentication
async function checkAuth() {
    console.log('Checking authentication...');
    try {
        // Get token from localStorage
        const token = localStorage.getItem('authToken');
        console.log('Token found:', token ? 'YES' : 'NO');
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add Authorization header if token exists
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            headers: headers,
            credentials: 'include' // Include cookies for session auth
        });
        
        console.log('Auth response status:', response.status);
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            console.log('User authenticated:', currentUser);
            showDashboard();
            
            // Load persistent data after authentication
            await loadPersistentData();
        } else {
            console.log('User not authenticated, showing auth form');
            // Clear invalid token
            localStorage.removeItem('authToken');
            showAuth();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        // Clear invalid token
        localStorage.removeItem('authToken');
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
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            // Store token for future requests
            if (data.token) {
                localStorage.setItem('authToken', data.token);
            }
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

// Show search progress indicator
function showSearchProgressIndicator() {
    // Remove any existing indicator
    const existingIndicator = document.querySelector('.search-progress-indicator');
    if (existingIndicator) existingIndicator.remove();
    
    // Create new indicator
    const indicator = document.createElement('div');
    indicator.className = 'search-progress-indicator';
    indicator.innerHTML = `
        <div class="indicator-content">
            <div class="indicator-spinner"></div>
            <span>Search in progress...</span>
        </div>
    `;
    document.body.appendChild(indicator);
}

// Show completion notification
function showCompletionNotification(resultCount, searchQuery) {
    // Remove progress indicator
    const indicator = document.querySelector('.search-progress-indicator');
    if (indicator) indicator.remove();
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = 'completion-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <svg class="notification-icon" viewBox="0 0 24 24" fill="none">
                <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <div class="notification-text">
                <h4>Search Complete!</h4>
                <p>Found ${resultCount} businesses for "${escapeHtml(searchQuery)}"</p>
            </div>
            <button class="notification-action" onclick="viewResults()">View Results</button>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
    `;
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        notification.remove();
    }, 10000);
}

// Generate personalized email
async function generatePersonalizedEmail(business) {
    // Show loading modal
    showEmailModal(business, null, true);
    
    try {
        // Load user settings
        const savedSettings = JSON.parse(localStorage.getItem('userSettings') || '{}');
        
        const response = await fetch('/api/generate-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                businessName: business.name,
                businessInfo: {
                    type: business.type || 'Business',
                    address: business.address,
                    website: business.website,
                    phone: business.phone
                },
                userCompany: savedSettings.companyName || localStorage.getItem('userCompany') || '',
                userProduct: savedSettings.services || localStorage.getItem('userProduct') || '',
                companyDescription: savedSettings.companyDescription || '',
                contactPerson: savedSettings.contactPerson || ''
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate email');
        }
        
        const emailData = await response.json();
        
        // Add signature if available
        if (savedSettings.emailSignature) {
            emailData.body = emailData.body + '\n\n' + savedSettings.emailSignature;
        }
        
        showEmailModal(business, emailData, false);
        
    } catch (error) {
        console.error('Email generation error:', error);
        alert('Failed to generate email: ' + error.message);
        closeEmailModal();
    }
}

// Show email modal
function showEmailModal(business, emailData, isLoading) {
    // Remove existing modal if any
    const existingModal = document.getElementById('emailModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'emailModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content email-modal">
            <div class="modal-header">
                <h2>Personalized Email for ${escapeHtml(business.name)}</h2>
                <button class="modal-close" onclick="closeEmailModal()">✕</button>
            </div>
            <div class="modal-body">
                ${isLoading ? `
                    <div class="email-loading">
                        <div class="spinner"></div>
                        <p>Generating personalized email...</p>
                    </div>
                ` : `
                    <div class="email-settings">
                        <div class="form-group">
                            <label>Your Company Name</label>
                            <input type="text" id="userCompany" class="form-input" placeholder="Your company name" value="${escapeHtml(localStorage.getItem('userCompany') || '')}">
                        </div>
                        <div class="form-group">
                            <label>Your Product/Service</label>
                            <input type="text" id="userProduct" class="form-input" placeholder="What you offer" value="${escapeHtml(localStorage.getItem('userProduct') || '')}">
                        </div>
                    </div>
                    <div class="email-preview">
                        <div class="form-group">
                            <label>Subject</label>
                            <input type="text" id="emailSubject" class="form-input" value="${escapeHtml(emailData.subject)}">
                        </div>
                        <div class="form-group">
                            <label>Email Content</label>
                            <textarea id="emailBody" class="form-input email-textarea" rows="10">${escapeHtml(emailData.body)}</textarea>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="regenerateEmail('${escapeHtml(JSON.stringify(business))}')">
                            <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                                <path d="M4 2V7H9M16 18V13H11M3.51 9C3.92 6.64 5.18 4.56 7.06 3.16C9.84 1.02 13.59 0.65 16.71 2.28M16.49 11C16.08 13.36 14.82 15.44 12.94 16.84C10.16 18.98 6.41 19.35 3.29 17.72" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Regenerate
                        </button>
                        <button class="btn btn-primary" onclick="copyEmail(event)">
                            <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                                <path d="M8 4H6C5.46957 4 4.96086 4.21071 4.58579 4.58579C4.21071 4.96086 4 5.46957 4 6V18C4 18.5304 4.21071 19.0391 4.58579 19.4142C4.96086 19.7893 5.46957 20 6 20H14C14.5304 20 15.0391 19.7893 15.4142 19.4142C15.7893 19.0391 16 18.5304 16 18V16M8 4V2C8 1.46957 8.21071 0.960859 8.58579 0.585786C8.96086 0.210714 9.46957 0 10 0H14L20 6V14C20 14.5304 19.7893 15.0391 19.4142 15.4142C19.0391 15.7893 18.5304 16 18 16H16M8 4H10C10.5304 4 11.0391 4.21071 11.4142 4.58579C11.7893 4.96086 12 5.46957 12 6V8H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Copy to Clipboard
                        </button>
                        <button onclick="sendEmailDirectly(${JSON.stringify(business)}, '${emailData.subject}', \`${emailData.body}\`)" class="btn btn-success">
                            <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                            Send Email
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Save company info when changed
    if (!isLoading) {
        document.getElementById('userCompany').addEventListener('change', (e) => {
            localStorage.setItem('userCompany', e.target.value);
        });
        document.getElementById('userProduct').addEventListener('change', (e) => {
            localStorage.setItem('userProduct', e.target.value);
        });
    }
}

// Close email modal
function closeEmailModal() {
    const modal = document.getElementById('emailModal');
    if (modal) modal.remove();
}

// Copy email to clipboard
async function copyEmail(event) {
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailBody').value;
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    
    try {
        await navigator.clipboard.writeText(fullEmail);
        
        // Show success feedback
        const copyBtn = event.target.closest('button');
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                <path d="M5 13L9 17L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Copied!
        `;
        copyBtn.classList.add('btn-success');
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.classList.remove('btn-success');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
    }
}

// Open in email client and save to history
function openInEmailClient(businessJson, subject, body) {
    const business = JSON.parse(businessJson);
    
    // Save email to sent history
    const emailRecord = {
        id: Date.now().toString(),
        businessName: business.name,
        businessEmail: business.email,
        subject: subject,
        body: body,
        sentAt: new Date().toLocaleString()
    };
    
    // Get existing sent emails
    const sentEmails = JSON.parse(localStorage.getItem('sentEmails') || '[]');
    sentEmails.unshift(emailRecord); // Add to beginning
    
    // Keep only last 50 emails
    if (sentEmails.length > 50) {
        sentEmails.splice(50);
    }
    
    // Save back to localStorage
    localStorage.setItem('sentEmails', JSON.stringify(sentEmails));
    
    // Open email client
    const emailUrl = `mailto:${business.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = emailUrl;
    
    // Show success notification
    showNotification(`Email saved to history and opened in your email client!`, 'success');
    
    // Close modal after a short delay
    setTimeout(() => {
        closeEmailModal();
    }, 1000);
}

// View full email from history
function viewFullEmail(emailId) {
    const sentEmails = JSON.parse(localStorage.getItem('sentEmails') || '[]');
    const email = sentEmails.find(e => e.id === emailId);
    
    if (email) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content email-modal">
                <div class="modal-header">
                    <h2>Email Details</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="email-details">
                        <div class="form-group">
                            <label class="form-label">To</label>
                            <div class="form-display">${escapeHtml(email.businessName)} (${escapeHtml(email.businessEmail)})</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Subject</label>
                            <div class="form-display">${escapeHtml(email.subject)}</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Sent</label>
                            <div class="form-display">${email.sentAt}</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Content</label>
                            <div class="email-content">${escapeHtml(email.body).replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <a href="mailto:${email.businessEmail}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}" class="btn btn-primary">Send Again</a>
                        <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    }
}

// Regenerate email
async function regenerateEmail(businessJson) {
    const business = JSON.parse(businessJson);
    generatePersonalizedEmail(business);
}

// Navigate to results tab
function viewResults() {
    // Find Results nav item by text content
    const navItems = document.querySelectorAll('.nav-item');
    for (let item of navItems) {
        const span = item.querySelector('span');
        if (span && span.textContent === 'Results') {
            item.click();
            return;
        }
    }
    // Fallback: Results is typically the 3rd nav item
    if (navItems[2]) navItems[2].click();
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
    
    updateStatus('🚀 Starting search... Grab a coffee, this takes 2-3 minutes!', 5);
    
    // Set search in progress flag
    isSearchInProgress = true;
    activeSearch = { query, startTime: Date.now() };
    
    try {
        const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ searchQuery: query })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentSessionId = data.sessionId;
            currentUser.credits = data.creditsRemaining;
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
            
            // Make status messages more user-friendly
            let friendlyMessage = message || 'Processing...';
            
            if (message) {
                if (message.includes('Opening Google Maps')) {
                    friendlyMessage = '🗺️ Opening Google Maps...';
                } else if (message.includes('cookie consent')) {
                    friendlyMessage = '🍪 Handling cookie consent...';
                } else if (message.includes('Scrolling')) {
                    friendlyMessage = '📜 Loading more businesses...';
                } else if (message.includes('Extracting business listings')) {
                    friendlyMessage = '🏢 Found businesses, extracting details...';
                } else if (message.includes('Processing') && message.includes('businesses')) {
                    friendlyMessage = '📋 Getting contact details...';
                } else if (message.includes('Getting details for')) {
                    const match = message.match(/Getting details for (.+?) \((\d+)\/(\d+)\)/);
                    if (match) {
                        friendlyMessage = `📞 Getting details for ${match[1]} (${match[2]}/${match[3]})`;
                    }
                } else if (message.includes('Checking website')) {
                    friendlyMessage = '🌐 Checking business websites for emails...';
                } else if (message.includes('Scraping completed')) {
                    friendlyMessage = '✅ Search completed! Preparing results...';
                }
            }
            
            updateStatus(friendlyMessage, progress || 0);
            
            if (status === 'completed') {
                clearInterval(statusCheckInterval);
                isSearchInProgress = false;
                
                updateStatus('🎉 Search completed! Found ' + (results?.length || 0) + ' businesses', 100);
                
                // Store the completed search
                const completedSearch = {
                    id: currentSessionId,
                    query: activeSearch?.query || document.getElementById('searchInput').value.trim(),
                    results: results,
                    resultCount: results?.length || 0,
                    completedAt: new Date().toLocaleString()
                };
                searchHistory.unshift(completedSearch); // Add to beginning of array
                
                // Show notification if user is on a different tab
                const searchContainer = document.querySelector('.search-container');
                if (!searchContainer || searchContainer.style.display === 'none') {
                    showCompletionNotification(results?.length || 0, completedSearch.query);
                }
                
                setTimeout(() => {
                    // Show success message and reset
                    updateStatus('✅ Results saved! Click "Results" tab to view them.', 100);
                    resetSearchButton();
                    
                    // Update nav indicator if results tab exists
                    updateResultsNavIndicator();
                }, 1500);
            } else if (status === 'failed') {
                clearInterval(statusCheckInterval);
                isSearchInProgress = false;
                updateStatus('❌ Search failed. Please try again.', 0);
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

// View specific search results
function viewSearchResults(searchId) {
    const search = searchHistory.find(s => s.id === searchId);
    if (!search) return;
    
    const mainContent = document.querySelector('.search-container');
    if (mainContent) {
        // Create business cards safely using DOM methods
        const businessGrid = document.createElement('div');
        businessGrid.className = 'business-results-grid';
        
        search.results.forEach((business, index) => {
            const card = document.createElement('div');
            card.className = 'business-card';
            card.style.cssText = `opacity: 0; transform: translateY(20px); animation: slideInUp 0.3s ease-out ${index * 0.05}s forwards;`;
            
            // Business header
            const header = document.createElement('div');
            header.className = 'business-header';
            
            const name = createSafeElement('h3', business.name || 'Unknown Business', { class: 'business-name' });
            header.appendChild(name);
            
            if (business.address) {
                const meta = document.createElement('div');
                meta.className = 'business-meta';
                const address = createSafeElement('span', `📍 ${business.address}`, { class: 'business-address' });
                meta.appendChild(address);
                header.appendChild(meta);
            }
            
            card.appendChild(header);
            
            // Business contact
            const contact = document.createElement('div');
            contact.className = 'business-contact';
            
            if (business.phone) {
                const phoneItem = document.createElement('div');
                phoneItem.className = 'contact-item';
                phoneItem.textContent = '📞 ';
                const phoneLink = createSafeElement('a', business.phone, { href: `tel:${business.phone}` });
                phoneItem.appendChild(phoneLink);
                contact.appendChild(phoneItem);
            }
            
            if (business.email) {
                const emailItem = document.createElement('div');
                emailItem.className = 'contact-item';
                emailItem.textContent = '✉️ ';
                const emailLink = createSafeElement('a', business.email, { href: `mailto:${business.email}` });
                emailItem.appendChild(emailLink);
                contact.appendChild(emailItem);
            }
            
            if (business.website) {
                const websiteItem = document.createElement('div');
                websiteItem.className = 'contact-item';
                websiteItem.textContent = '🌐 ';
                const websiteUrl = business.website.startsWith('http') ? business.website : 'https://' + business.website;
                const websiteLink = createSafeElement('a', business.website, { href: websiteUrl, target: '_blank' });
                websiteItem.appendChild(websiteLink);
                contact.appendChild(websiteItem);
            }
            
            card.appendChild(contact);
            
            // Add email generation button if email exists
            if (business.email) {
                const actions = document.createElement('div');
                actions.className = 'business-actions';
                
                const emailButton = document.createElement('button');
                emailButton.className = 'btn btn-primary btn-sm generate-email-btn';
                emailButton.innerHTML = `
                    <svg class="btn-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 5C3 4.44772 3.44772 4 4 4H16C16.5523 4 17 4.44772 17 5V15C17 15.5523 16.5523 16 16 16H4C3.44772 16 3 15.5523 3 15V5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M3 5L10 11L17 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Create Personalized Email
                `;
                emailButton.onclick = () => generatePersonalizedEmail(business);
                
                actions.appendChild(emailButton);
                card.appendChild(actions);
            }
            
            businessGrid.appendChild(card);
        });
        
        // Clear and rebuild main content safely
        mainContent.innerHTML = '';
        
        // Create header section
        const header = document.createElement('div');
        header.className = 'search-header';
        
        // Back button (will add event listener after creation)
        const backButton = document.createElement('button');
        backButton.className = 'btn btn-secondary btn-sm back-button';
        backButton.id = 'backToResultsButton';
        backButton.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                <path d="M12.5 7.5L7.5 10L12.5 12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Back to Results
        `;
        header.appendChild(backButton);
        
        // Title and subtitle
        const title = createSafeElement('h1', `"${search.query}"`, { class: 'page-title' });
        const subtitle = createSafeElement('p', `Found ${search.resultCount} businesses • ${search.completedAt}`, { class: 'page-subtitle' });
        header.appendChild(title);
        header.appendChild(subtitle);
        
        // Export buttons
        const exportActions = document.createElement('div');
        exportActions.className = 'export-actions';
        
        const exportCsvBtn = document.createElement('button');
        exportCsvBtn.className = 'btn btn-outline btn-sm';
        exportCsvBtn.id = 'exportCsvIndividualButton';
        exportCsvBtn.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                <path d="M10 12.5L10 7.5M10 12.5L7.5 10M10 12.5L12.5 10M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Export CSV
        `;
        
        const exportJsonBtn = document.createElement('button');
        exportJsonBtn.className = 'btn btn-outline btn-sm';
        exportJsonBtn.id = 'exportJsonIndividualButton';
        exportJsonBtn.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 20 20" fill="none">
                <path d="M10 12.5L10 7.5M10 12.5L7.5 10M10 12.5L12.5 10M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Export JSON
        `;
        
        exportActions.appendChild(exportCsvBtn);
        exportActions.appendChild(exportJsonBtn);
        header.appendChild(exportActions);
        
        mainContent.appendChild(header);
        mainContent.appendChild(businessGrid);
        
        // Add event listeners for the new buttons
        backButton.addEventListener('click', showResultsSection);
        exportCsvBtn.addEventListener('click', () => exportResults(searchId, 'csv'));
        exportJsonBtn.addEventListener('click', () => exportResults(searchId, 'json'));
        mainContent.style.display = 'block';
    }
}

// Export search results
function exportResults(searchId, format) {
    const search = searchHistory.find(s => s.id === searchId);
    if (!search) return;
    
    if (format === 'csv') {
        const csv = 'Name,Address,Phone,Email,Website\n' + 
            search.results.map(r => `"${r.name || ''}","${r.address || ''}","${r.phone || ''}","${r.email || ''}","${r.website || ''}"`).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${search.query.replace(/[^a-zA-Z0-9]/g, '_')}_results.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    } else if (format === 'json') {
        const json = JSON.stringify(search.results, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${search.query.replace(/[^a-zA-Z0-9]/g, '_')}_results.json`;
        a.click();
        window.URL.revokeObjectURL(url);
    }
}

// Update results navigation indicator
function updateResultsNavIndicator() {
    // Find the Results nav item by looking for the span with "Results" text
    const navItems = document.querySelectorAll('.nav-item');
    let resultsNav = null;
    
    navItems.forEach(item => {
        const span = item.querySelector('span');
        if (span && span.textContent.trim() === 'Results') {
            resultsNav = item;
        }
    });
    
    if (resultsNav && searchHistory.length > 0) {
        let badge = resultsNav.querySelector('.nav-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'nav-badge';
            badge.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                background: var(--primary);
                color: white;
                border-radius: 10px;
                padding: 2px 6px;
                font-size: 12px;
                font-weight: 500;
                min-width: 18px;
                text-align: center;
            `;
            resultsNav.style.position = 'relative';
            resultsNav.appendChild(badge);
        }
        badge.textContent = searchHistory.length;
    }
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
    // For Excel export, use client-side export directly
    if (format === 'excel') {
        if (searchHistory.length > 0) {
            const lastSearch = searchHistory[searchHistory.length - 1];
            if (lastSearch && lastSearch.results) {
                exportToExcel(lastSearch.results, lastSearch.query);
                return;
            }
        }
        alert('No results available for export');
        return;
    }
    
    // For CSV and JSON, use server-side export if sessionId available
    if (!currentSessionId) {
        // Fallback to client-side export for History tab results
        if (searchHistory.length > 0) {
            const lastSearch = searchHistory[searchHistory.length - 1];
            if (lastSearch && lastSearch.results) {
                if (format === 'csv') {
                    exportToCSV(lastSearch.results, lastSearch.query);
                } else if (format === 'json') {
                    exportToJSON(lastSearch.results, lastSearch.query);
                }
                return;
            }
        }
        alert('No results available for export');
        return;
    }
    
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

// Buy credits - secure implementation with package ID only
async function buyCredits(packageId = 'starter-pack') {
    try {
        const response = await fetch('/api/payments/create-purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ packageId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store purchase ID
            localStorage.setItem('pendingPurchaseId', data.purchaseId);
            
            // Redirect to Stripe using server-provided URL
            window.location.href = `${data.stripeUrl}?client_reference_id=${data.purchaseId}`;
        } else {
            alert(data.error || 'Failed to create purchase. Please try again.');
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

// Email configuration functions
let currentEmailProvider = 'gmail';
let emailConfig = JSON.parse(localStorage.getItem('emailConfig') || '{}');

// Show email provider setup
function showEmailProvider(provider) {
    // Update tabs
    document.querySelectorAll('.provider-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.closest('.provider-tab').classList.add('active');
    
    // Hide all setups
    document.querySelectorAll('.provider-setup').forEach(setup => {
        setup.style.display = 'none';
    });
    
    // Show selected setup
    document.getElementById(`${provider}-setup`).style.display = 'block';
    currentEmailProvider = provider;
    
    // Load saved config if exists
    if (emailConfig[provider]) {
        const config = emailConfig[provider];
        if (provider === 'gmail') {
            document.getElementById('gmail-email').value = config.email || '';
            document.getElementById('gmail-password').value = config.password || '';
        } else if (provider === 'outlook') {
            document.getElementById('outlook-email').value = config.email || '';
            document.getElementById('outlook-password').value = config.password || '';
        } else if (provider === 'custom') {
            document.getElementById('custom-host').value = config.host || '';
            document.getElementById('custom-port').value = config.port || '587';
            document.getElementById('custom-email').value = config.email || '';
            document.getElementById('custom-password').value = config.password || '';
        }
    }
}

// Test email configuration
async function testEmailConfiguration() {
    const statusDiv = document.getElementById('emailConfigStatus');
    statusDiv.innerHTML = '<div class="status-loading">🔄 Testing connection...</div>';
    
    let config = {};
    
    if (currentEmailProvider === 'gmail') {
        config = {
            provider: 'gmail',
            email: document.getElementById('gmail-email').value,
            password: document.getElementById('gmail-password').value
        };
    } else if (currentEmailProvider === 'outlook') {
        config = {
            provider: 'outlook',
            email: document.getElementById('outlook-email').value,
            password: document.getElementById('outlook-password').value
        };
    } else if (currentEmailProvider === 'custom') {
        config = {
            provider: 'custom',
            email: document.getElementById('custom-email').value,
            password: document.getElementById('custom-password').value,
            customHost: document.getElementById('custom-host').value,
            customPort: document.getElementById('custom-port').value
        };
    }
    
    try {
        const response = await fetch('/api/email/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
        if (result.success) {
            statusDiv.innerHTML = '<div class="status-success">✅ Connection successful! Email configuration is working.</div>';
        } else {
            statusDiv.innerHTML = `<div class="status-error">❌ Connection failed: ${escapeHtml(result.error)}<br><small>${escapeHtml(result.hint || '')}</small></div>`;
        }
    } catch (error) {
        statusDiv.innerHTML = '<div class="status-error">❌ Test failed: ' + escapeHtml(error.message) + '</div>';
    }
}

// Save email configuration
function saveEmailConfiguration() {
    const statusDiv = document.getElementById('emailConfigStatus');
    
    let config = {};
    
    if (currentEmailProvider === 'gmail') {
        config = {
            email: document.getElementById('gmail-email').value,
            password: document.getElementById('gmail-password').value
        };
    } else if (currentEmailProvider === 'outlook') {
        config = {
            email: document.getElementById('outlook-email').value,
            password: document.getElementById('outlook-password').value
        };
    } else if (currentEmailProvider === 'custom') {
        config = {
            email: document.getElementById('custom-email').value,
            password: document.getElementById('custom-password').value,
            host: document.getElementById('custom-host').value,
            port: document.getElementById('custom-port').value
        };
    }
    
    // Save to localStorage
    emailConfig[currentEmailProvider] = config;
    emailConfig.activeProvider = currentEmailProvider;
    localStorage.setItem('emailConfig', JSON.stringify(emailConfig));
    
    statusDiv.innerHTML = '<div class="status-success">✅ Email configuration saved!</div>';
    
    setTimeout(() => {
        statusDiv.innerHTML = '';
    }, 3000);
}

// Send email directly
async function sendEmailDirectly(businessData, subject, body) {
    // Parse business object if it's a string
    const business = typeof businessData === 'string' ? JSON.parse(businessData) : businessData;
    
    const config = emailConfig[emailConfig.activeProvider];
    
    if (!config || !config.email || !config.password) {
        alert('Please configure your email settings first in the Settings page.');
        return;
    }
    
    if (!business.email) {
        alert('No email address found for this business.');
        return;
    }
    
    try {
        const response = await fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: business.email,
                subject: subject,
                body: body,
                emailConfig: {
                    provider: emailConfig.activeProvider,
                    ...config,
                    companyName: userSettings.companyName || ''
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Add to sent emails
            sentEmails.push({
                recipient: business.email,
                businessName: business.name,
                subject: subject,
                body: body,
                sentAt: new Date().toISOString()
            });
            localStorage.setItem('sentEmails', JSON.stringify(sentEmails));
            
            // Show success
            showNotification(`Email sent successfully to ${business.name}!`, 'success');
            closeEmailModal();
        } else {
            alert('Failed to send email: ' + result.error);
        }
    } catch (error) {
        alert('Error sending email: ' + error.message);
    }
}