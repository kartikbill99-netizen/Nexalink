/* =============================================================
   NEXALINK — js/feed.js
   
   Feed and discover pages:
   - Load real users from Supabase database (not hardcoded array)
   - Render profile cards with real data
   - Filter and search capabilities
   - Discover section with random suggestions
   
   Fixes:
   - Issue #3: Search now displays real user names from DB
   
   Load order: after config.js, supabase.js, ui.js, auth.js
   ============================================================= */

// Page init states
window._feedState = {
  allUsers: [],
  filteredUsers: [],
  discoverUsers: [],
  currentFilter: 'all',
  searchQuery: '',
  isLoading: false
};

// ─────────────────────────────────────────────────────────────
// INIT FEED PAGE
// ─────────────────────────────────────────────────────────────
async function initFeedPage() {
  window._feedState.isLoading = true;
  
  // Load all users and display feed
  await loadFeedUsers();
  
  // Set up search listener with debounce
  setupSearchListener();
  
  // Load discover suggestions
  await loadDiscoverUsers();
  
  window._feedState.isLoading = false;
}

// ─────────────────────────────────────────────────────────────
// LOAD FEED USERS (all users except current)
// ─────────────────────────────────────────────────────────────
async function loadFeedUsers() {
  if (!isAuthenticated()) {
    console.warn('Not authenticated');
    return;
  }
  
  const currentUserId = window._nexaUser.id;
  
  try {
    // Fetch all users except current user
    const { data, error } = await window.sb
      .from('users')
      .select('*')
      .neq('id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Feed load error:', error);
      showToast('Failed to load feed', 'error');
      return;
    }
    
    window._feedState.allUsers = data || [];
    window._feedState.filteredUsers = [...window._feedState.allUsers];
    
    renderFeedCards();
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ Loaded', data.length, 'users for feed');
    }
    
  } catch (err) {
    console.error('Feed load exception:', err);
    showToast('Error loading feed', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// LOAD DISCOVER SUGGESTIONS (random sample)
// ─────────────────────────────────────────────────────────────
async function loadDiscoverUsers() {
  if (window._feedState.allUsers.length < 3) {
    // Use existing data if available
    window._feedState.discoverUsers = window._feedState.allUsers
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
  } else {
    // Random sample of 3 users
    const shuffled = [...window._feedState.allUsers].sort(() => Math.random() - 0.5);
    window._feedState.discoverUsers = shuffled.slice(0, 3);
  }
  
  renderSuggestedUsers();
}

// ─────────────────────────────────────────────────────────────
// RENDER FEED PROFILE CARDS
// ─────────────────────────────────────────────────────────────
function renderFeedCards() {
  const container = document.getElementById('feed-cards');
  if (!container) {
    console.warn('Feed cards container not found');
    return;
  }
  
  const users = window._feedState.filteredUsers;
  
  if (users.length === 0) {
    container.innerHTML = `
      <div class="chat-empty-state">
        <div class="big-icon">🔍</div>
        <h3>No profiles found</h3>
        <p>Try adjusting your search or filters to find service professionals.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = users.map(user => renderProfileCard(user)).join('');
}

// ─────────────────────────────────────────────────────────────
// RENDER SINGLE PROFILE CARD
// ─────────────────────────────────────────────────────────────
function renderProfileCard(user) {
  const initials = getInitials(user.fname, user.lname);
  const avatarHtml = user.avatar_url 
    ? `<img src="${user.avatar_url}" alt="Avatar" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`
    : `<div class="avatar" style="width:48px;height:48px;font-size:1.2rem;">${initials}</div>`;
  
  const skillTags = (user.skills || [])
    .slice(0, 3)
    .map(skill => `<span class="tag">${skill}</span>`)
    .join('');
  
  const ratingStars = user.rating 
    ? '⭐'.repeat(Math.min(5, Math.ceil(user.rating)))
    : '–';
  
  const onlineBadge = user.is_available 
    ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);margin-left:6px;"></span>'
    : '';
  
  return `
    <div class="profile-card">
      <div class="pc-header">
        ${avatarHtml}
        <div class="pc-info">
          <div class="pc-name">${user.fname} ${user.lname}${onlineBadge}</div>
          <div class="pc-role">${user.user_type || 'Service Professional'}</div>
          ${user.is_verified ? '<div class="pc-verified">✓ Verified</div>' : ''}
        </div>
      </div>
      
      ${user.bio ? `<div class="pc-bio">${escapeHtml(user.bio)}</div>` : ''}
      
      ${user.location ? `<div style="font-size:0.8rem;color:var(--text3);margin-bottom:0.75rem;">📍 ${escapeHtml(user.location)}</div>` : ''}
      
      ${skillTags ? `<div class="pc-tags">${skillTags}</div>` : ''}
      
      <div class="pc-footer">
        <div class="pc-stats">
          <div class="pc-stat">
            <strong>${user.projects_count || 0}</strong>
            <span>Projects</span>
          </div>
          <div class="pc-stat">
            <strong>${ratingStars}</strong>
            <span>Rating</span>
          </div>
        </div>
        <div class="pc-actions">
          <button class="btn btn-sm btn-secondary" onclick="startConversation('${user.id}', '${escapeHtml(user.fname)}')">
            💬 Message
          </button>
          <button class="btn btn-sm btn-primary" onclick="initiateCall('${user.id}', '${escapeHtml(user.fname)}')">
            📞 Call
          </button>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// RENDER SUGGESTED USERS (right panel)
// ─────────────────────────────────────────────────────────────
function renderSuggestedUsers() {
  const container = document.getElementById('suggested-users');
  if (!container) return;
  
  const users = window._feedState.discoverUsers;
  
  if (users.length === 0) {
    container.innerHTML = '<p style="color:var(--text3);font-size:0.875rem;">No suggestions available</p>';
    return;
  }
  
  container.innerHTML = users.map(user => `
    <div style="padding:1rem;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:0.75rem;cursor:pointer;" onclick="scrollToAndHighlight('${user.id}')">
      <div style="display:flex;gap:0.75rem;align-items:center;margin-bottom:0.5rem;">
        ${user.avatar_url 
          ? `<img src="${user.avatar_url}" alt="Avatar" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` 
          : `<div class="avatar" style="width:32px;height:32px;font-size:0.8rem;">${getInitials(user.fname, user.lname)}</div>`}
        <div style="flex:1;">
          <div style="font-weight:600;font-size:0.9rem;">${user.fname} ${user.lname}</div>
          <div style="font-size:0.75rem;color:var(--text3);">${user.user_type || 'Professional'}</div>
        </div>
      </div>
      <button class="btn btn-sm btn-secondary" style="width:100%;" onclick="startConversation('${user.id}', '${escapeHtml(user.fname)}')">Message</button>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────
// SEARCH WITH DEBOUNCE
// ─────────────────────────────────────────────────────────────
let searchTimeout;

function setupSearchListener() {
  const searchInput = document.getElementById('feed-search');
  if (!searchInput) return;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    searchTimeout = setTimeout(() => {
      searchFeed(query);
    }, 300);
  });
}

// ─────────────────────────────────────────────────────────────
// SEARCH FEED (live query)
// ─────────────────────────────────────────────────────────────
async function searchFeed(query) {
  if (!query) {
    // Restore full feed
    window._feedState.filteredUsers = [...window._feedState.allUsers];
    renderFeedCards();
    return;
  }
  
  const lowerQuery = query.toLowerCase();
  
  // Filter locally first (faster)
  const filtered = window._feedState.allUsers.filter(user => {
    const fullName = `${user.fname} ${user.lname}`.toLowerCase();
    const bio = (user.bio || '').toLowerCase();
    const role = (user.user_type || '').toLowerCase();
    const skills = (user.skills || []).map(s => s.toLowerCase()).join(' ');
    
    return (
      fullName.includes(lowerQuery) ||
      bio.includes(lowerQuery) ||
      role.includes(lowerQuery) ||
      skills.includes(lowerQuery)
    );
  });
  
  window._feedState.filteredUsers = filtered;
  window._feedState.searchQuery = query;
  
  renderFeedCards();
  
  if (window.NEXALINK_CONFIG.DEBUG) {
    console.log('🔍 Search:', query, '→', filtered.length, 'results');
  }
}

// ─────────────────────────────────────────────────────────────
// DISCOVER PAGE: APPLY FILTERS
// ─────────────────────────────────────────────────────────────
async function applyDiscover(filter) {
  let filtered = [...window._feedState.allUsers];
  
  // Filter by user type
  if (filter && filter !== 'all') {
    filtered = filtered.filter(u => u.user_type === filter);
  }
  
  // Filter by availability
  const availabilityFilter = document.querySelector('[data-filter="availability"]');
  if (availabilityFilter?.classList.contains('active')) {
    filtered = filtered.filter(u => u.is_available);
  }
  
  // Filter by verification
  const verifiedFilter = document.querySelector('[data-filter="verified"]');
  if (verifiedFilter?.classList.contains('active')) {
    filtered = filtered.filter(u => u.is_verified);
  }
  
  window._feedState.filteredUsers = filtered;
  window._feedState.currentFilter = filter || 'all';
  
  renderFeedCards();
}

// ─────────────────────────────────────────────────────────────
// RESET DISCOVER FILTERS
// ─────────────────────────────────────────────────────────────
function resetDiscover() {
  document.querySelectorAll('[data-filter]').forEach(chip => {
    chip.classList.remove('active');
  });
  
  window._feedState.filteredUsers = [...window._feedState.allUsers];
  window._feedState.currentFilter = 'all';
  
  renderFeedCards();
}

// ─────────────────────────────────────────────────────────────
// DISCOVER PAGE: INIT
// ─────────────────────────────────────────────────────────────
async function initDiscoverPage() {
  if (window._feedState.allUsers.length === 0) {
    await loadFeedUsers();
  }
  
  renderFeedCards();
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Scroll to a user card and highlight it
 */
function scrollToAndHighlight(userId) {
  const card = document.querySelector(`[data-user-id="${userId}"]`);
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.boxShadow = 'inset 0 0 0 2px var(--accent)';
    setTimeout(() => {
      card.style.boxShadow = '';
    }, 2000);
  }
}

/**
 * Start a conversation with a user (calls messages.js)
 */
function startConversation(userId, userName) {
  if (typeof openChat === 'function') {
    openChat(userId, userName);
    goTo('messages');
  } else {
    showToast('Messages not available yet', 'info');
  }
}

/**
 * Initiate a call with a user (calls calling.js)
 */
function initiateCall(userId, userName) {
  if (typeof startCall === 'function') {
    startCall(userId, userName);
  } else {
    showToast('Calling not available yet', 'info');
  }
}

if (window.NEXALINK_CONFIG.DEBUG) {
  console.log('✅ Feed module loaded');
}
