/* =============================================================
   NEXALINK — js/profile.js
   
   Profile management:
   - Load user profile from database
   - Save profile edits
   - Upload avatar and banner images to Storage
   - Update profile display on page
   
   Fixes:
   - Issue #2: Profile edits now save to DB (not just in-memory)
   - Issue #5: Image upload now works (was missing entirely)
   
   Load order: after config.js, supabase.js, ui.js, auth.js
   ============================================================= */

// ─────────────────────────────────────────────────────────────
// INIT PROFILE PAGE
// ─────────────────────────────────────────────────────────────
function initProfilePage() {
  // Load current user's profile and display it
  loadAndDisplayProfile();
  
  // Wire up profile avatar click to trigger file input
  const avatarEl = document.querySelector('.profile-avatar');
  if (avatarEl) {
    avatarEl.style.cursor = 'pointer';
    avatarEl.addEventListener('click', () => {
      document.getElementById('avatar-upload')?.click();
    });
  }
  
  // Wire up banner edit button to trigger file input
  const bannerBtn = document.querySelector('[data-action="edit-banner"]');
  if (bannerBtn) {
    bannerBtn.addEventListener('click', () => {
      document.getElementById('banner-upload')?.click();
    });
  }
  
  // File input listeners
  document.getElementById('avatar-upload')?.addEventListener('change', (e) => {
    handleAvatarUpload(e.target.files[0]);
  });
  
  document.getElementById('banner-upload')?.addEventListener('change', (e) => {
    handleBannerUpload(e.target.files[0]);
  });
}

// ─────────────────────────────────────────────────────────────
// LOAD AND DISPLAY USER PROFILE
// ─────────────────────────────────────────────────────────────
async function loadAndDisplayProfile() {
  if (!isAuthenticated()) {
    console.warn('No user authenticated');
    return;
  }
  
  // Use the profile already loaded by supabase.js
  const profile = window._nexaUserData;
  
  if (!profile) {
    console.warn('Profile not yet loaded');
    return;
  }
  
  refreshProfileDisplay(profile);
}

// ─────────────────────────────────────────────────────────────
// REFRESH PROFILE DISPLAY (render data to DOM)
// ─────────────────────────────────────────────────────────────
function refreshProfileDisplay(profile) {
  if (!profile) {
    console.warn('No profile data to display');
    return;
  }
  
  // Update avatar
  const avatarEl = document.querySelector('.profile-avatar');
  if (avatarEl) {
    if (profile.avatar_url) {
      // Image URL
      avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="Avatar">`;
    } else {
      // Initials fallback
      const initials = getInitials(profile.fname, profile.lname);
      avatarEl.innerHTML = initials;
    }
  }
  
  // Update banner
  const banner = document.querySelector('.profile-banner');
  if (banner && profile.banner_url) {
    banner.style.backgroundImage = `url('${profile.banner_url}')`;
  }
  
  // Update profile name and handle
  const nameEl = document.querySelector('.profile-name');
  if (nameEl) {
    nameEl.textContent = `${profile.fname} ${profile.lname}`.trim() || 'Your Name';
  }
  
  const handleEl = document.querySelector('.profile-handle');
  if (handleEl) {
    handleEl.textContent = `@${profile.email?.split('@')[0] || 'user'}`;
  }
  
  // Update stats
  const statsElements = document.querySelectorAll('.profile-stat strong');
  if (statsElements[0]) statsElements[0].textContent = profile.rating || '0';
  if (statsElements[1]) statsElements[1].textContent = profile.projects_count || '0';
  
  // Update form fields (About tab)
  document.getElementById('pd-bio').value = profile.bio || '';
  document.getElementById('pd-location').value = profile.location || '';
  document.getElementById('pd-website').value = profile.website || '';
  document.getElementById('pd-phone').value = profile.phone || '';
  
  // Populate user type dropdown
  const userTypeEl = document.getElementById('pd-user-type');
  if (userTypeEl && profile.user_type) {
    userTypeEl.value = profile.user_type;
  }
  
  // Show skills (in edit form)
  displaySkills(profile.skills || []);
  
  if (window.NEXALINK_CONFIG.DEBUG) {
    console.log('✅ Profile displayed:', profile);
  }
}

// ─────────────────────────────────────────────────────────────
// DISPLAY SKILLS IN EDIT FORM
// ─────────────────────────────────────────────────────────────
function displaySkills(skills = []) {
  // Deselect all chips
  document.querySelectorAll('.skill-chip').forEach(chip => {
    chip.classList.remove('selected');
  });
  
  // Select user's skills
  skills.forEach(skillName => {
    const chip = Array.from(document.querySelectorAll('.skill-chip'))
      .find(c => c.textContent.trim() === skillName);
    if (chip) chip.classList.add('selected');
  });
}

// ─────────────────────────────────────────────────────────────
// SAVE PROFILE CHANGES
// ─────────────────────────────────────────────────────────────
async function saveProfile(event) {
  event?.preventDefault();
  
  if (!isAuthenticated()) {
    showToast('Not authenticated', 'error');
    return;
  }
  
  const btn = event?.target?.querySelector('button[type="submit"]') || 
              document.querySelector('button[data-action="save-profile"]');
  
  // Gather form data
  const updateData = {
    bio: document.getElementById('pd-bio')?.value || '',
    location: document.getElementById('pd-location')?.value || '',
    website: document.getElementById('pd-website')?.value || '',
    phone: document.getElementById('pd-phone')?.value || '',
    user_type: document.getElementById('pd-user-type')?.value || '',
    skills: getSelectedSkills()
  };
  
  // Validation
  if (!updateData.bio && !updateData.location) {
    showToast('Please add at least a bio or location', 'info');
    return;
  }
  
  setButtonLoading(btn, true);
  
  try {
    const { data, error } = await window.sb
      .from('users')
      .update(updateData)
      .eq('id', window._nexaUser.id)
      .select()
      .single();
    
    if (error) {
      console.error('Save error:', error);
      showToast('Failed to save profile', 'error');
      setButtonLoading(btn, false);
      return;
    }
    
    // Update local state
    window._nexaUserData = { ...window._nexaUserData, ...data };
    
    showToast('Profile updated!', 'success');
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ Profile saved:', data);
    }
    
    setButtonLoading(btn, false);
    
  } catch (err) {
    console.error('Save exception:', err);
    showToast('An error occurred', 'error');
    setButtonLoading(btn, false);
  }
}

// ─────────────────────────────────────────────────────────────
// UPLOAD AVATAR
// ─────────────────────────────────────────────────────────────
async function handleAvatarUpload(file) {
  if (!file) return;
  
  // Validate file
  if (!window.NEXALINK_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
    showToast('Please upload an image (JPEG, PNG, WebP, or GIF)', 'error');
    return;
  }
  
  if (file.size > window.NEXALINK_CONFIG.MAX_FILE_SIZE) {
    showToast('File is too large (max 5 MB)', 'error');
    return;
  }
  
  if (!isAuthenticated()) {
    showToast('Not authenticated', 'error');
    return;
  }
  
  const userId = window._nexaUser.id;
  const fileName = `${userId}/avatar.jpg`;
  
  try {
    // Show loading indicator
    const avatarEl = document.querySelector('.profile-avatar');
    const originalContent = avatarEl.innerHTML;
    avatarEl.innerHTML = '<span style="opacity:0.5;">Uploading...</span>';
    
    // 1. Delete old avatar if it exists
    await window.sb.storage
      .from('avatars')
      .remove([fileName])
      .catch(() => {});  // Ignore if doesn't exist
    
    // 2. Upload new avatar
    const { data: uploadData, error: uploadError } = await window.sb.storage
      .from('avatars')
      .upload(fileName, file, {
        upsert: true,
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      showToast('Failed to upload avatar', 'error');
      avatarEl.innerHTML = originalContent;
      return;
    }
    
    // 3. Get public URL
    const { data: urlData } = window.sb.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    const publicUrl = urlData.publicUrl;
    
    // 4. Save URL to database
    const { data: updateData, error: updateError } = await window.sb
      .from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)
      .select()
      .single();
    
    if (updateError) {
      console.error('DB update error:', updateError);
      showToast('Avatar uploaded but failed to save', 'error');
      return;
    }
    
    // 5. Update local state and display
    window._nexaUserData.avatar_url = publicUrl;
    refreshProfileDisplay(window._nexaUserData);
    
    showToast('Avatar updated!', 'success');
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ Avatar uploaded:', publicUrl);
    }
    
  } catch (err) {
    console.error('Avatar upload exception:', err);
    showToast('Upload failed', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// UPLOAD BANNER
// ─────────────────────────────────────────────────────────────
async function handleBannerUpload(file) {
  if (!file) return;
  
  // Validate file
  if (!window.NEXALINK_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
    showToast('Please upload an image (JPEG, PNG, WebP, or GIF)', 'error');
    return;
  }
  
  if (file.size > window.NEXALINK_CONFIG.MAX_FILE_SIZE) {
    showToast('File is too large (max 5 MB)', 'error');
    return;
  }
  
  if (!isAuthenticated()) {
    showToast('Not authenticated', 'error');
    return;
  }
  
  const userId = window._nexaUser.id;
  const fileName = `${userId}/banner.jpg`;
  
  try {
    // Show loading indicator
    const banner = document.querySelector('.profile-banner');
    const originalBg = banner.style.backgroundImage;
    banner.style.opacity = '0.7';
    
    // 1. Delete old banner if exists
    await window.sb.storage
      .from('banners')
      .remove([fileName])
      .catch(() => {});
    
    // 2. Upload new banner
    const { data: uploadData, error: uploadError } = await window.sb.storage
      .from('banners')
      .upload(fileName, file, {
        upsert: true,
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      showToast('Failed to upload banner', 'error');
      banner.style.opacity = '1';
      return;
    }
    
    // 3. Get public URL
    const { data: urlData } = window.sb.storage
      .from('banners')
      .getPublicUrl(fileName);
    
    const publicUrl = urlData.publicUrl;
    
    // 4. Save URL to database
    const { data: updateData, error: updateError } = await window.sb
      .from('users')
      .update({ banner_url: publicUrl })
      .eq('id', userId)
      .select()
      .single();
    
    if (updateError) {
      console.error('DB update error:', updateError);
      showToast('Banner uploaded but failed to save', 'error');
      banner.style.opacity = '1';
      return;
    }
    
    // 5. Update local state and display
    window._nexaUserData.banner_url = publicUrl;
    banner.style.backgroundImage = `url('${publicUrl}')`;
    banner.style.opacity = '1';
    
    showToast('Banner updated!', 'success');
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ Banner uploaded:', publicUrl);
    }
    
  } catch (err) {
    console.error('Banner upload exception:', err);
    showToast('Upload failed', 'error');
    document.querySelector('.profile-banner').style.opacity = '1';
  }
}

if (window.NEXALINK_CONFIG.DEBUG) {
  console.log('✅ Profile module loaded');
}
