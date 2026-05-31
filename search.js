/* =============================================================
   NEXALINK — js/search.js
   
   Advanced search functionality:
   - Live search as user types (with debounce)
   - Search across multiple fields: name, bio, skills, role
   - Database-backed queries for large datasets
   - Search result highlighting
   
   Note: Also integrates with feed.js for the main feed search
   
   Load order: after config.js, supabase.js, ui.js, feed.js
   ============================================================= */

// Search state
window._searchState = {
  query: '',
  results: [],
  isSearching: false,
  lastQuery: '',
  debounceTimer: null
};

// ─────────────────────────────────────────────────────────────
// INIT SEARCH LISTENERS
// ─────────────────────────────────────────────────────────────
function initSearchListeners() {
  const searchInputs = document.querySelectorAll('[data-search], .search-input, #feed-search');
  
  searchInputs.forEach(input => {
    input.addEventListener('input', handleSearchInput);
    input.addEventListener('focus', handleSearchFocus);
  });
  
  // Click outside to close search results
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-search], .search-bar')) {
      hideSearchResults();
    }
  });
}

// ─────────────────────────────────────────────────────────────
// HANDLE SEARCH INPUT
// ─────────────────────────────────────────────────────────────
function handleSearchInput(event) {
  const query = event.target.value.trim();
  
  // Clear previous timeout
  clearTimeout(window._searchState.debounceTimer);
  
  // Debounce search (300ms)
  window._searchState.debounceTimer = setTimeout(() => {
    if (query.length === 0) {
      hideSearchResults();
      return;
    }
    
    if (query.length < 2) {
      return; // Don't search for single characters
    }
    
    performSearch(query);
  }, 300);
}

// ─────────────────────────────────────────────────────────────
// HANDLE SEARCH FOCUS
// ─────────────────────────────────────────────────────────────
function handleSearchFocus(event) {
  const query = event.target.value.trim();
  
  if (query.length >= 2) {
    showSearchResults();
  }
}

// ─────────────────────────────────────────────────────────────
// PERFORM SEARCH
// ─────────────────────────────────────────────────────────────
async function performSearch(query) {
  if (!isAuthenticated()) {
    showToast('Please sign in to search', 'info');
    return;
  }
  
  const currentUserId = window._nexaUser.id;
  window._searchState.isSearching = true;
  window._searchState.query = query;
  
  try {
    // Search with Supabase using .ilike() for case-insensitive matching
    const { data, error } = await window.sb
      .from('users')
      .select('*')
      .neq('id', currentUserId)
      .or(
        `fname.ilike.%${query}%,lname.ilike.%${query}%,bio.ilike.%${query}%,user_type.ilike.%${query}%`
      )
      .limit(20);
    
    if (error) {
      console.error('Search error:', error);
      window._searchState.results = [];
      showSearchResultsError('Search failed');
      return;
    }
    
    window._searchState.results = data || [];
    window._searchState.isSearching = false;
    
    renderSearchResults(query);
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('🔍 Search results for "' + query + '":', data.length, 'results');
    }
    
  } catch (err) {
    console.error('Search exception:', err);
    window._searchState.results = [];
    window._searchState.isSearching = false;
    showSearchResultsError('Search error');
  }
}

// ─────────────────────────────────────────────────────────────
// RENDER SEARCH RESULTS
// ─────────────────────────────────────────────────────────────
function renderSearchResults(query) {
  const results = window._searchState.results;
  
  if (results.length === 0) {
    showSearchResultsError('No results found for: ' + query);
    return;
  }
  
  // Build results HTML
  const resultsHtml = results.map(user => {
    const initials = getInitials(user.fname, user.lname);
    const avatarHtml = user.avatar_url
      ? `<img src="${user.avatar_url}" alt="Avatar" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
      : `<div class="avatar" style="width:40px;height:40px;font-size:1rem;">${initials}</div>`;
    
    const fullName = `${user.fname} ${user.lname}`;
    const highlightedName = highlightMatch(fullName, query);
    const highlightedRole = highlightMatch(user.user_type || '', query);
    
    return `
      <div class="search-result-item" onclick="selectSearchResult('${user.id}', '${fullName.replace(/'/g, "\\'")}')">
        <div style="display:flex;gap:0.75rem;align-items:center;">
          ${avatarHtml}
          <div style="flex:1;overflow:hidden;">
            <div style="font-weight:600;font-size:0.9rem;">${highlightedName}</div>
            <div style="font-size:0.75rem;color:var(--text3);">${highlightedRole}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  const container = getSearchResultsContainer();
  if (container) {
    container.innerHTML = resultsHtml;
    container.style.display = 'block';
  }
}

// ─────────────────────────────────────────────────────────────
// HIGHLIGHT SEARCH MATCH IN TEXT
// ─────────────────────────────────────────────────────────────
function highlightMatch(text, query) {
  if (!text || !query) return text;
  
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

// ─────────────────────────────────────────────────────────────
// SHOW/HIDE SEARCH RESULTS
// ─────────────────────────────────────────────────────────────
function showSearchResults() {
  const container = getSearchResultsContainer();
  if (container) {
    container.style.display = 'block';
  }
}

function hideSearchResults() {
  const container = getSearchResultsContainer();
  if (container) {
    container.style.display = 'none';
  }
}

function showSearchResultsError(message) {
  const container = getSearchResultsContainer();
  if (container) {
    container.innerHTML = `
      <div style="padding:1rem;text-align:center;color:var(--text3);font-size:0.875rem;">
        ${message}
      </div>
    `;
    container.style.display = 'block';
  }
}

// ─────────────────────────────────────────────────────────────
// GET/CREATE SEARCH RESULTS CONTAINER
// ─────────────────────────────────────────────────────────────
function getSearchResultsContainer() {
  let container = document.getElementById('search-results-container');
  
  if (!container) {
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
      container = document.createElement('div');
      container.id = 'search-results-container';
      container.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--surface);
        border: 1px solid var(--border);
        border-top: none;
        border-radius: 0 0 var(--radius-sm) var(--radius-sm);
        max-height: 400px;
        overflow-y: auto;
        z-index: 50;
        display: none;
        box-shadow: var(--shadow);
      `;
      
      // Make search bar position relative
      searchBar.style.position = 'relative';
      searchBar.appendChild(container);
    }
  }
  
  return container;
}

// ─────────────────────────────────────────────────────────────
// SELECT SEARCH RESULT
// ─────────────────────────────────────────────────────────────
function selectSearchResult(userId, userName) {
  hideSearchResults();
  
  // Clear search input
  const searchInput = document.querySelector('[data-search], .search-input, #feed-search');
  if (searchInput) {
    searchInput.value = '';
  }
  
  // Open conversation with selected user
  if (typeof startConversation === 'function') {
    startConversation(userId, userName);
  } else {
    showToast('Messages not available yet', 'info');
  }
}

// ─────────────────────────────────────────────────────────────
// ADVANCED SEARCH (direct query with filters)
// ─────────────────────────────────────────────────────────────
/**
 * Perform advanced search with multiple filters
 * @param {Object} filters - Search criteria
 *   - query: string to search for
 *   - userType: filter by user type
 *   - skills: array of skills to match
 *   - isVerified: boolean
 *   - isAvailable: boolean
 *   - minRating: minimum rating
 * @returns {Promise<Array>} Search results
 */
async function advancedSearch(filters = {}) {
  if (!isAuthenticated()) {
    return [];
  }
  
  const currentUserId = window._nexaUser.id;
  let query = window.sb
    .from('users')
    .select('*')
    .neq('id', currentUserId);
  
  // Text search
  if (filters.query) {
    query = query.or(
      `fname.ilike.%${filters.query}%,lname.ilike.%${filters.query}%,bio.ilike.%${filters.query}%`
    );
  }
  
  // Filter by user type
  if (filters.userType) {
    query = query.eq('user_type', filters.userType);
  }
  
  // Filter by verification status
  if (filters.isVerified !== undefined) {
    query = query.eq('is_verified', filters.isVerified);
  }
  
  // Filter by availability
  if (filters.isAvailable !== undefined) {
    query = query.eq('is_available', filters.isAvailable);
  }
  
  // Filter by minimum rating
  if (filters.minRating !== undefined) {
    query = query.gte('rating', filters.minRating);
  }
  
  // Filter by skills (array contains)
  if (filters.skills && filters.skills.length > 0) {
    // Note: Supabase array filtering requires .contains()
    for (const skill of filters.skills) {
      query = query.contains('skills', [skill]);
    }
  }
  
  const { data, error } = await query.limit(50);
  
  if (error) {
    console.error('Advanced search error:', error);
    return [];
  }
  
  return data || [];
}

// ─────────────────────────────────────────────────────────────
// GLOBAL SEARCH ACROSS ALL FIELDS
// ─────────────────────────────────────────────────────────────
/**
 * Search all user fields (name, bio, skills, role, etc.)
 * @param {string} query - Search query
 * @returns {Promise<Array>} Matching users
 */
async function globalSearch(query) {
  return advancedSearch({ query });
}

// ─────────────────────────────────────────────────────────────
// SEARCH BY SKILLS
// ─────────────────────────────────────────────────────────────
/**
 * Find users with specific skills
 * @param {string|Array} skills - Skill name(s) to search for
 * @returns {Promise<Array>} Users with those skills
 */
async function searchBySkills(skills) {
  const skillArray = Array.isArray(skills) ? skills : [skills];
  return advancedSearch({ skills: skillArray });
}

// ─────────────────────────────────────────────────────────────
// SEARCH BY LOCATION
// ─────────────────────────────────────────────────────────────
/**
 * Find users in a specific location
 * @param {string} location - Location to search for
 * @returns {Promise<Array>} Users in that location
 */
async function searchByLocation(location) {
  if (!isAuthenticated()) {
    return [];
  }
  
  const currentUserId = window._nexaUser.id;
  
  const { data, error } = await window.sb
    .from('users')
    .select('*')
    .neq('id', currentUserId)
    .ilike('location', `%${location}%`)
    .limit(50);
  
  if (error) {
    console.error('Location search error:', error);
    return [];
  }
  
  return data || [];
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Slight delay to ensure other modules are loaded
  setTimeout(initSearchListeners, 500);
});

if (window.NEXALINK_CONFIG.DEBUG) {
  console.log('✅ Search module loaded');
}
