/* =============================================================
   NEXALINK — js/auth.js
   
   Authentication module:
   - Email/password login and registration
   - Google OAuth with account chooser (prompt=select_account)
   - Phone OTP (optional future enhancement)
   - Logout
   
   Fixes:
   - Issue #1: Real auth integration (not fake)
   - Issue #7: Real Google OAuth (not fake auto-login)
   
   Load order: after config.js, supabase.js, ui.js
   ============================================================= */

// ─────────────────────────────────────────────────────────────
// INIT AUTH PAGE (called on page load)
// ─────────────────────────────────────────────────────────────
function initAuthPage() {
  // Make sure login tab is visible by default
  const loginTab = document.querySelector('[data-tab="login"]') || 
                   document.querySelector('.auth-tab:first-child');
  if (loginTab) {
    switchAuthTab('login');
  }
  
  // Clear all forms and errors
  document.querySelectorAll('[id^="auth-form-"]').forEach(form => {
    form.reset();
  });
  document.querySelectorAll('.auth-error').forEach(err => {
    err.classList.remove('show');
  });
}

// ─────────────────────────────────────────────────────────────
// EMAIL / PASSWORD LOGIN
// ─────────────────────────────────────────────────────────────
async function handleLogin(event) {
  event?.preventDefault();
  
  const email = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;
  const btn = event?.target?.querySelector('button[type="submit"]') || 
              document.querySelector('button[data-action="login"]');
  
  // Validation
  if (!email || !password) {
    showAuthError('login-error', 'Please enter email and password');
    return;
  }
  
  if (!email.includes('@')) {
    showAuthError('login-error', 'Please enter a valid email address');
    return;
  }
  
  clearAuthError('login-error');
  setButtonLoading(btn, true);
  
  try {
    const { data, error } = await window.sb.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      // Handle specific error cases
      if (error.message.includes('Invalid login credentials')) {
        showAuthError('login-error', 'Incorrect email or password');
      } else if (error.message.includes('Email not confirmed')) {
        showAuthError('login-error', 'Please verify your email address');
      } else {
        showAuthError('login-error', error.message || 'Login failed');
      }
      console.error('Login error:', error);
      setButtonLoading(btn, false);
      return;
    }
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ Login successful:', data.user.email);
    }
    
    showToast('Welcome back!', 'success');
    // Navigation happens automatically via onAuthStateChange
    
  } catch (err) {
    console.error('Login exception:', err);
    showAuthError('login-error', 'An unexpected error occurred');
    setButtonLoading(btn, false);
  }
}

// ─────────────────────────────────────────────────────────────
// EMAIL / PASSWORD REGISTRATION
// ─────────────────────────────────────────────────────────────
async function handleRegister(event) {
  event?.preventDefault();
  
  const fname = document.getElementById('register-fname')?.value?.trim();
  const lname = document.getElementById('register-lname')?.value?.trim();
  const email = document.getElementById('register-email')?.value?.trim();
  const password = document.getElementById('register-password')?.value;
  const confirmPassword = document.getElementById('register-confirm')?.value;
  const btn = event?.target?.querySelector('button[type="submit"]') || 
              document.querySelector('button[data-action="register"]');
  
  // Validation
  if (!fname || !lname || !email || !password) {
    showAuthError('register-error', 'Please fill in all fields');
    return;
  }
  
  if (!email.includes('@')) {
    showAuthError('register-error', 'Please enter a valid email address');
    return;
  }
  
  if (password.length < 6) {
    showAuthError('register-error', 'Password must be at least 6 characters');
    return;
  }
  
  if (password !== confirmPassword) {
    showAuthError('register-error', 'Passwords do not match');
    return;
  }
  
  clearAuthError('register-error');
  setButtonLoading(btn, true);
  
  try {
    const { data, error } = await window.sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          fname,
          lname
        },
        // Auto-confirm in development (optional)
        // emailRedirectTo: window.location.origin
      }
    });
    
    if (error) {
      if (error.message.includes('already registered')) {
        showAuthError('register-error', 'This email is already registered. Try logging in.');
      } else {
        showAuthError('register-error', error.message || 'Registration failed');
      }
      console.error('Register error:', error);
      setButtonLoading(btn, false);
      return;
    }
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ Registration successful:', data.user.email);
    }
    
    showToast('Account created! Check your email to confirm.', 'success');
    
    // Clear form
    document.getElementById('register-form')?.reset();
    
    // Switch back to login tab after a moment
    setTimeout(() => {
      switchAuthTab('login');
    }, 1500);
    
  } catch (err) {
    console.error('Register exception:', err);
    showAuthError('register-error', 'An unexpected error occurred');
    setButtonLoading(btn, false);
  }
}

// ─────────────────────────────────────────────────────────────
// GOOGLE OAUTH
// ─────────────────────────────────────────────────────────────
/**
 * Initiate Google OAuth with account chooser prompt.
 * prompt=select_account forces user to pick their account (not auto-login)
 * Fixes Issue #7: No more fake auto-login
 */
async function handleGoogleAuth(event) {
  event?.preventDefault();
  
  const btn = event?.target || document.querySelector('button[data-action="google"]');
  setButtonLoading(btn, true);
  
  try {
    const { data, error } = await window.sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: {
          // Force Google to show account chooser (don't auto-login with existing account)
          prompt: 'select_account'
        },
        redirectTo: window.NEXALINK_CONFIG.APP_URL || window.location.origin
      }
    });
    
    if (error) {
      console.error('Google OAuth error:', error);
      showToast('Google login failed', 'error');
      setButtonLoading(btn, false);
      return;
    }
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('🔐 Google OAuth initiated');
    }
    
    // Note: Redirect happens automatically; user returns to redirectTo URL
    
  } catch (err) {
    console.error('Google OAuth exception:', err);
    showToast('Google login failed', 'error');
    setButtonLoading(btn, false);
  }
}

// ─────────────────────────────────────────────────────────────
// PHONE OTP LOGIN (optional, for future use)
// ─────────────────────────────────────────────────────────────
async function handlePhoneAuth(event) {
  event?.preventDefault();
  
  const phone = document.getElementById('phone-input')?.value?.trim();
  const btn = event?.target?.querySelector('button[type="submit"]');
  
  if (!phone) {
    showToast('Please enter a phone number', 'error');
    return;
  }
  
  setButtonLoading(btn, true);
  
  try {
    const { data, error } = await window.sb.auth.signInWithOtp({
      phone
    });
    
    if (error) {
      console.error('Phone OTP error:', error);
      showToast('Could not send OTP', 'error');
      setButtonLoading(btn, false);
      return;
    }
    
    showToast('OTP sent to your phone', 'success');
    // Show OTP verification form (to be implemented)
    
  } catch (err) {
    console.error('Phone OTP exception:', err);
    showToast('Phone authentication failed', 'error');
    setButtonLoading(btn, false);
  }
}

// ─────────────────────────────────────────────────────────────
// VERIFY OTP (for phone or email)
// ─────────────────────────────────────────────────────────────
async function handleVerifyOtp(type, phone, token) {
  try {
    const { data, error } = await window.sb.auth.verifyOtp({
      phone,
      token,
      type: 'sms'  // or 'email'
    });
    
    if (error) {
      showToast('Invalid OTP', 'error');
      return;
    }
    
    showToast('Verified!', 'success');
    // User is now authenticated
    
  } catch (err) {
    console.error('OTP verification error:', err);
    showToast('Verification failed', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────
async function logout() {
  try {
    const { error } = await window.sb.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
      showToast('Logout failed', 'error');
      return;
    }
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ User logged out');
    }
    
    // onAuthStateChange handler will take care of UI updates
    
  } catch (err) {
    console.error('Logout exception:', err);
    showToast('Logout failed', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// PASSWORD RESET (optional)
// ─────────────────────────────────────────────────────────────
async function handleForgotPassword(email) {
  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email', 'error');
    return;
  }
  
  try {
    const { data, error } = await window.sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '?reset=true'
    });
    
    if (error) {
      console.error('Reset error:', error);
      showToast('Could not send reset link', 'error');
      return;
    }
    
    showToast('Check your email for reset instructions', 'success');
    
  } catch (err) {
    console.error('Reset exception:', err);
    showToast('Password reset failed', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// LOGIN SUCCESS CALLBACK (deprecated, use onAuthStateChange instead)
// ─────────────────────────────────────────────────────────────
// This function is no longer used; supabase.js handles state changes
// Kept for reference only
function loginSuccess(name, email) {
  // Deprecated
}

if (window.NEXALINK_CONFIG.DEBUG) {
  console.log('✅ Auth module loaded');
}
