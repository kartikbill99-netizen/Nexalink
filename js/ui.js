/* =============================================================
   NEXALINK — js/ui.js
   
   Shared UI utilities:
   - Page navigation (goTo)
   - Toast notifications
   - Tab/section switching
   - Nav bar updates
   - Modal helpers
   
   Load order: config.js → supabase.js → ui.js → all others
   ============================================================= */

// ─────────────────────────────────────────────────────────────
// PAGE NAVIGATION STATE
// ─────────────────────────────────────────────────────────────
window._s = {
  currentPage: 'landing',
  activeTab: 'about',         // profile page tabs
  activeConv: null,           // messages page active conversation
  activeHelpTab: 'faq',       // help page active tab
};

// ─────────────────────────────────────────────────────────────
// PAGE ROUTING WITH AUTH GUARD
// ─────────────────────────────────────────────────────────────
/**
 * Navigate to a page. Protected pages require authentication.
 * Protected pages: feed, discover, messages, profile, help
 * Public pages: landing, auth
 */
function goTo(page) {
  // Pages that require authentication
  const protectedPages = ['feed', 'discover', 'messages', 'profile', 'help'];
  
  // Check auth
  if (protectedPages.includes(page) && !isAuthenticated()) {
    showToast('Please sign in first', 'info');
    goTo('auth');
    return;
  }

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  // Show target page
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) {
    targetPage.classList.add('active');
    window._s.currentPage = page;
    updateNav(page);
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('📄 Navigate to:', page);
    }

    // Call page-specific init if it exists
    const initFunc = window[`init${page.charAt(0).toUpperCase() + page.slice(1)}Page`];
    if (typeof initFunc === 'function') {
      initFunc();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// UPDATE NAV BAR ACTIVE STATE
// ─────────────────────────────────────────────────────────────
function updateNav(page) {
  // Clear all active nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Set active button based on page
  const navMap = {
    'landing': null,      // no active button on landing
    'auth': null,
    'feed': 'nb-feed',
    'discover': 'nb-discover',
    'messages': 'nb-messages',
    'profile': 'nb-profile',
    'help': 'nb-help'
  };
  
  const activeId = navMap[page];
  if (activeId) {
    document.getElementById(activeId)?.classList.add('active');
  }
}

// ─────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
/**
 * Show a temporary notification toast
 * @param {string} message - Toast text
 * @param {string} type    - 'success' | 'error' | 'info' (default: 'info')
 * @param {number} duration - Milliseconds before auto-dismiss (default: 3500)
 */
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.warn('Toast element not found in DOM');
    return;
  }

  // Clear previous timeout
  if (window._toastTimeout) clearTimeout(window._toastTimeout);

  // Set content
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  // Auto-hide after duration
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// ─────────────────────────────────────────────────────────────
// PROFILE PAGE: SWITCH TABS (About / Services / Edit)
// ─────────────────────────────────────────────────────────────
function switchProfileTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('[id^="profile-tab-"]').forEach(tab => {
    tab.style.display = 'none';
  });
  
  // Clear active buttons
  document.querySelectorAll('.profile-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  const tabEl = document.getElementById(`profile-tab-${tabName}`);
  if (tabEl) {
    tabEl.style.display = 'block';
    window._s.activeTab = tabName;
  }
  
  // Mark button as active
  event.target.classList.add('active');
}

// ─────────────────────────────────────────────────────────────
// SKILL CHIP SELECTION
// ─────────────────────────────────────────────────────────────
/**
 * Toggle skill chip selected state
 * @param {HTMLElement} el - The skill chip element
 */
function toggleSkill(el) {
  el.classList.toggle('selected');
}

/**
 * Get selected skills from the grid
 * @returns {string[]} Array of selected skill names
 */
function getSelectedSkills() {
  return Array.from(document.querySelectorAll('.skill-chip.selected'))
    .map(chip => chip.textContent.trim());
}

// ─────────────────────────────────────────────────────────────
// DISCOVER PAGE: FILTER MANAGEMENT
// ─────────────────────────────────────────────────────────────
function setActiveFilter(el, filterValue) {
  // Clear active chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.remove('active');
  });
  
  // Mark selected as active
  if (el) el.classList.add('active');
  
  // Trigger filter (feed.js handles actual filtering)
  applyDiscover(filterValue);
}

// ─────────────────────────────────────────────────────────────
// HELP PAGE: TAB SWITCHING
// ─────────────────────────────────────────────────────────────
/**
 * Switch help section tabs (FAQ / Report / Contact / Billing)
 * @param {string} tabName - Tab identifier
 */
function switchHelpTab(tabName) {
  // Hide all help tab contents
  document.querySelectorAll('.help-tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  // Clear active tab buttons
  document.querySelectorAll('.help-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected content
  const contentEl = document.getElementById(`help-tab-${tabName}`);
  if (contentEl) {
    contentEl.classList.add('active');
    window._s.activeHelpTab = tabName;
  }
  
  // Mark button as active (if called from onclick)
  if (event && event.target) {
    event.target.classList.add('active');
  }
}

// ─────────────────────────────────────────────────────────────
// HELP PAGE: FAQ ACCORDION
// ─────────────────────────────────────────────────────────────
/**
 * Toggle FAQ item open/close
 * @param {HTMLElement} el - The .faq-question button
 */
function toggleFaq(el) {
  const item = el.closest('.faq-item');
  const answer = item.querySelector('.faq-answer');
  
  // Close all other FAQs in the same section
  item.parentElement.querySelectorAll('.faq-item').forEach(faq => {
    if (faq !== item) {
      faq.querySelector('.faq-question').classList.remove('open');
      faq.querySelector('.faq-answer').classList.remove('open');
    }
  });
  
  // Toggle current
  el.classList.toggle('open');
  answer.classList.toggle('open');
}

// ─────────────────────────────────────────────────────────────
// AUTH PAGE: SWITCH TABS (Login / Register)
// ─────────────────────────────────────────────────────────────
function switchAuthTab(tabName) {
  // Clear active buttons
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Clear visible forms
  document.querySelectorAll('[id^="auth-form-"]').forEach(form => {
    form.style.display = 'none';
  });
  
  // Show selected form
  document.getElementById(`auth-form-${tabName}`).style.display = 'flex';
  event.target.classList.add('active');
  
  // Clear errors
  document.querySelectorAll('.auth-error').forEach(err => {
    err.classList.remove('show');
  });
}

// ─────────────────────────────────────────────────────────────
// MODAL HELPERS
// ─────────────────────────────────────────────────────────────
/**
 * Show a modal overlay
 * @param {string} modalId - Element ID of the modal
 */
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

/**
 * Hide a modal overlay
 * @param {string} modalId - Element ID of the modal
 */
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

// ─────────────────────────────────────────────────────────────
// BUTTON LOADING STATE
// ─────────────────────────────────────────────────────────────
/**
 * Set a button to loading state with spinner
 * @param {HTMLElement} btn - Button element
 * @param {boolean} isLoading - True to show spinner, false to hide
 */
function setButtonLoading(btn, isLoading = true) {
  if (!btn) return;
  
  if (isLoading) {
    btn.disabled = true;
    const spinner = document.createElement('span');
    spinner.className = 'btn-spinner' + (btn.className.includes('primary') ? '' : ' dark');
    btn.prepend(spinner);
  } else {
    btn.disabled = false;
    const spinner = btn.querySelector('.btn-spinner');
    if (spinner) spinner.remove();
  }
}

// ─────────────────────────────────────────────────────────────
// INLINE ERROR DISPLAY
// ─────────────────────────────────────────────────────────────
/**
 * Show inline error message in auth form
 * @param {string} errorId - ID of the error element
 * @param {string} message - Error message text
 */
function showAuthError(errorId, message) {
  const errorEl = document.getElementById(errorId);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add('show');
  }
}

/**
 * Clear inline error message
 * @param {string} errorId - ID of the error element
 */
function clearAuthError(errorId) {
  const errorEl = document.getElementById(errorId);
  if (errorEl) {
    errorEl.classList.remove('show');
  }
}

// ─────────────────────────────────────────────────────────────
// AVATAR INITIALS GENERATOR
// ─────────────────────────────────────────────────────────────
/**
 * Generate initials from name
 * @param {string} fname - First name
 * @param {string} lname - Last name
 * @returns {string} Two-letter initials
 */
function getInitials(fname = '', lname = '') {
  const f = (fname || '').charAt(0).toUpperCase();
  const l = (lname || '').charAt(0).toUpperCase();
  return (f + l) || '?';
}

// ─────────────────────────────────────────────────────────────
// FORMAT HELPERS
// ─────────────────────────────────────────────────────────────
/**
 * Format date to readable string
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date (e.g., "Dec 25, 2:30 PM")
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format time for chat (e.g., "2:30 PM")
 * @param {Date|string} date - Date to format
 * @returns {string} Time string
 */
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

if (window.NEXALINK_CONFIG.DEBUG) {
  console.log('✅ UI utilities loaded');
}
