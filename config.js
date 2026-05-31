/* =============================================================
   NEXALINK — js/config.js
   
   IMPORTANT: Configuration object with Supabase credentials.
   ⚠️  SECURITY WARNING:
   - This file is loaded in the browser and credentials ARE visible in source.
   - This is INTENTIONAL and SAFE — the Supabase Anon Key is public-safe by design.
   - RLS policies on the database protect your data (not the key).
   - NEVER commit real credentials to public repositories.
   - For production, use environment variables on your hosting platform.
   
   Load this file FIRST, before all other scripts.
   ============================================================= */

// Global configuration object
window.NEXALINK_CONFIG = {
  // Supabase project URL (public)
  SUPABASE_URL: 'https://vyyfqjwnpqzfhkitjsyx.supabase.co',
  
  // Supabase Anonymous Key (public, but RLS-protected)
  SUPABASE_ANON_KEY: 'sb_publishable_Jq3RIj3fJugV5D4wxFwpEA_GtPjPgEL',
  
  // App configuration
  APP_NAME: 'Nexalink',
  APP_URL: window.location.origin,
  
  // Storage bucket names
  STORAGE_BUCKETS: {
    AVATARS: 'avatars',
    BANNERS: 'banners'
  },
  
  // Max file sizes (in bytes)
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5 MB
  
  // Allowed image MIME types
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  
  // Debug mode (set to false in production)
  DEBUG: true
};

// Freeze the object to prevent accidental modifications
Object.freeze(window.NEXALINK_CONFIG);

// Log init (only in debug mode)
if (window.NEXALINK_CONFIG.DEBUG) {
  console.log('🔗 Nexalink Config loaded', {
    url: window.NEXALINK_CONFIG.SUPABASE_URL,
    keyPrefix: window.NEXALINK_CONFIG.SUPABASE_ANON_KEY.substring(0, 20) + '...'
  });
}
