/* =============================================================
   NEXALINK — js/supabase.js
   
   Supabase client initialization and global auth state management.
   
   Global state:
   - window.sb              — Supabase client (all methods)
   - window._nexaUser      — Current authenticated user object
   - window._nexaUserData  — User profile from DB (fetched after login)
   
   Load order: config.js → supabase.js → all others
   ============================================================= */

// Initialize Supabase client from config
const SUPABASE_URL = window.NEXALINK_CONFIG.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.NEXALINK_CONFIG.SUPABASE_ANON_KEY;

window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global user state
window._nexaUser = null;       // Auth user from supabase.auth
window._nexaUserData = null;   // User profile from DB (users table)

// ─────────────────────────────────────────────────────────────
// AUTH STATE LISTENER
// ─────────────────────────────────────────────────────────────
window.sb.auth.onAuthStateChange(async (event, session) => {
  if (window.NEXALINK_CONFIG.DEBUG) {
    console.log('🔐 Auth state changed:', event, session?.user?.email);
  }

  if (event === 'SIGNED_IN' && session) {
    // User just logged in or session restored
    window._nexaUser = session.user;
    
    // Fetch user profile from DB
    await loadCurrentUserProfile();
    
    // Update nav (show user nav, hide guest nav)
    updateNav('feed');
    
    // Go to feed if on landing/auth pages
    const currentPage = document.querySelector('.page.active')?.id;
    if (currentPage === 'page-landing' || currentPage === 'page-auth') {
      goTo('feed');
    }

  } else if (event === 'SIGNED_OUT') {
    // User logged out
    window._nexaUser = null;
    window._nexaUserData = null;
    
    // Update nav (show guest nav, hide user nav)
    document.getElementById('nav-guest').style.display = 'flex';
    document.getElementById('nav-user').style.display = 'none';
    
    // Go to landing
    goTo('landing');
    showToast('You have been logged out', 'info');
  }
});

// ─────────────────────────────────────────────────────────────
// LOAD CURRENT USER PROFILE FROM DATABASE
// ─────────────────────────────────────────────────────────────
async function loadCurrentUserProfile() {
  if (!window._nexaUser) {
    if (window.NEXALINK_CONFIG.DEBUG) console.warn('No user to load profile');
    return;
  }

  try {
    const { data, error } = await window.sb
      .from('users')
      .select('*')
      .eq('id', window._nexaUser.id)
      .single();

    if (error) {
      console.error('Error loading profile:', error);
      showToast('Could not load your profile', 'error');
      return;
    }

    window._nexaUserData = data;
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ User profile loaded:', data);
    }

    // Signal profile is ready (other modules can listen)
    window.dispatchEvent(new CustomEvent('profileLoaded'));

  } catch (err) {
    console.error('Exception loading profile:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// CHECK SESSION ON PAGE LOAD (if user already logged in)
// ─────────────────────────────────────────────────────────────
(async () => {
  try {
    const { data } = await window.sb.auth.getSession();
    if (data.session) {
      window._nexaUser = data.session.user;
      await loadCurrentUserProfile();
      
      // Show user nav
      document.getElementById('nav-guest').style.display = 'none';
      document.getElementById('nav-user').style.display = 'flex';
      
      if (window.NEXALINK_CONFIG.DEBUG) {
        console.log('🔓 Session restored for:', window._nexaUser.email);
      }
    }
  } catch (err) {
    console.error('Session check error:', err);
  }
})();

// ─────────────────────────────────────────────────────────────
// HELPER: Refresh user profile from DB
// ─────────────────────────────────────────────────────────────
async function refreshUserProfile() {
  if (!window._nexaUser) return;
  await loadCurrentUserProfile();
}

// ─────────────────────────────────────────────────────────────
// HELPER: Get current user auth object
// ─────────────────────────────────────────────────────────────
function getCurrentUser() {
  return window._nexaUser;
}

// ─────────────────────────────────────────────────────────────
// HELPER: Get current user DB profile
// ─────────────────────────────────────────────────────────────
function getCurrentUserData() {
  return window._nexaUserData;
}

// ─────────────────────────────────────────────────────────────
// HELPER: Check if user is authenticated
// ─────────────────────────────────────────────────────────────
function isAuthenticated() {
  return !!window._nexaUser;
}

if (window.NEXALINK_CONFIG.DEBUG) {
  console.log('✅ Supabase client initialized');
}
