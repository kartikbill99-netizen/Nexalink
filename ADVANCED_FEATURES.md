# 🚀 Advanced Features Guide

This guide shows how to extend Nexalink with additional features using the existing architecture.

---

## Table of Contents
1. [Video Calling](#video-calling)
2. [Reviews & Ratings](#reviews--ratings)
3. [Notifications](#notifications)
4. [File Sharing](#file-sharing)
5. [Payments Integration](#payments-integration)
6. [Scheduling & Bookings](#scheduling--bookings)
7. [Admin Dashboard](#admin-dashboard)
8. [Analytics](#analytics)

---

## 📹 Video Calling

Upgrade from audio-only to video calls.

### Database Changes
```sql
-- Add video call preferences
ALTER TABLE users ADD COLUMN 
  prefer_video BOOLEAN DEFAULT false;

-- Track call history
CREATE TABLE call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL REFERENCES users(id),
  callee_id UUID NOT NULL REFERENCES users(id),
  start_time TIMESTAMPTZ DEFAULT now(),
  end_time TIMESTAMPTZ,
  duration_seconds INT,
  type TEXT CHECK (type IN ('audio', 'video')),
  status TEXT DEFAULT 'completed'
);
```

### Code Changes

#### Update `js/calling.js`
```javascript
// Replace requestUserMedia() with:
async function requestUserMedia(videoEnabled = false) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: videoEnabled ? {
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } : false
    });
    
    window._callState.localStream = stream;
    
    // Display video locally if enabled
    if (videoEnabled) {
      const videoEl = document.getElementById('local-video');
      if (videoEl) {
        videoEl.srcObject = stream;
      }
    }
    
    return stream;
  } catch (err) {
    console.error('Media request error:', err);
    showToast('Could not access camera/mic', 'error');
    return null;
  }
}

// Update startCall to include video option
async function startCall(calleeId, calleeName, enableVideo = false) {
  // ... existing code ...
  const stream = await requestUserMedia(enableVideo);
  
  // Add video tracks if enabled
  if (enableVideo) {
    stream.getVideoTracks().forEach(track => {
      window._callState.peerConnection.addTrack(track, stream);
    });
  }
}
```

#### Update HTML for video
```html
<!-- In call modal -->
<div class="call-modal-box">
  <!-- Video containers -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
    <video id="local-video" autoplay muted></video>
    <video id="remote-video" autoplay></video>
  </div>
  
  <!-- Rest of modal -->
  <div class="call-modal-name">John Doe</div>
  <!-- ... -->
</div>
```

### Toggle Video Button
```javascript
function toggleVideo() {
  const videoTracks = window._callState.localStream
    ?.getVideoTracks();
  
  if (!videoTracks || videoTracks.length === 0) {
    showToast('Video not available', 'error');
    return;
  }
  
  videoTracks.forEach(track => {
    track.enabled = !track.enabled;
  });
  
  const btn = document.querySelector('.call-btn.video');
  btn.classList.toggle('active');
}
```

---

## ⭐ Reviews & Ratings

Let users rate and review each other.

### Database Schema
```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating NUMERIC(2,1) CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE(reviewer_id, reviewee_id)  -- One review per user pair
);

-- Update users table for ratings
ALTER TABLE users ADD COLUMN 
  avg_rating NUMERIC(2,1) DEFAULT 0;
ALTER TABLE users ADD COLUMN 
  review_count INT DEFAULT 0;
```

### RLS Policies
```sql
-- Users can read all reviews
ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;

CREATE POLICY "reviews_select_public"
  ON reviews FOR SELECT USING (true);

-- Users can only insert their own reviews
CREATE POLICY "reviews_insert_own"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

-- Users can only update their own reviews
CREATE POLICY "reviews_update_own"
  ON reviews FOR UPDATE
  USING (auth.uid() = reviewer_id);
```

### Frontend Code
```javascript
// In new file: js/reviews.js

async function submitReview(revieweeId, rating, comment) {
  if (!isAuthenticated()) {
    showToast('Please sign in to review', 'error');
    return;
  }
  
  if (rating < 1 || rating > 5) {
    showToast('Rating must be between 1 and 5', 'error');
    return;
  }
  
  try {
    const { data, error } = await window.sb
      .from('reviews')
      .upsert({
        reviewer_id: window._nexaUser.id,
        reviewee_id: revieweeId,
        rating,
        comment: comment || null
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Update user's average rating
    updateUserRating(revieweeId);
    
    showToast('Review submitted!', 'success');
    
  } catch (err) {
    console.error('Review error:', err);
    showToast('Failed to submit review', 'error');
  }
}

async function updateUserRating(userId) {
  try {
    const { data } = await window.sb
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', userId);
    
    if (data && data.length > 0) {
      const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
      
      await window.sb
        .from('users')
        .update({
          avg_rating: avg.toFixed(1),
          review_count: data.length
        })
        .eq('id', userId);
    }
  } catch (err) {
    console.error('Update rating error:', err);
  }
}

async function getReviews(userId) {
  try {
    const { data, error } = await window.sb
      .from('reviews')
      .select('*, reviewer:users(fname, lname, avatar_url)')
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (err) {
    console.error('Get reviews error:', err);
    return [];
  }
}
```

---

## 🔔 Notifications

Send real-time notifications to users.

### Database Schema
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'message', 'call', 'review', 'connection', 'mention'
  )),
  title TEXT NOT NULL,
  description TEXT,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable notifications for Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

### Create Notification Helper
```javascript
// In js/notifications.js

async function createNotification(userId, type, title, description, actionUrl, actorId) {
  try {
    const { error } = await window.sb
      .from('notifications')
      .insert({
        user_id: userId,
        actor_id: actorId || null,
        type,
        title,
        description,
        action_url: actionUrl,
        is_read: false
      });
    
    if (error) throw error;
    
  } catch (err) {
    console.error('Create notification error:', err);
  }
}

async function loadNotifications() {
  if (!isAuthenticated()) return;
  
  try {
    const { data } = await window.sb
      .from('notifications')
      .select('*, actor:users(fname, lname)')
      .eq('user_id', window._nexaUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    return data || [];
  } catch (err) {
    console.error('Load notifications error:', err);
    return [];
  }
}

function subscribeToNotifications() {
  const channel = window.sb
    .channel(`notifications-${window._nexaUser.id}`)
    .on('postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${window._nexaUser.id}`
      },
      (payload) => {
        const notif = payload.new;
        showToast(notif.title, 'info');
        updateNotificationBadge();
      }
    )
    .subscribe();
}

function updateNotificationBadge() {
  // Update unread count in UI
  window.sb
    .from('notifications')
    .select('count', { count: 'exact' })
    .eq('user_id', window._nexaUser.id)
    .eq('is_read', false)
    .then(({ count }) => {
      const badge = document.querySelector('[data-notif-badge]');
      if (badge) {
        badge.textContent = count || '';
        badge.style.display = count > 0 ? 'block' : 'none';
      }
    });
}
```

### Usage
```javascript
// When user receives a message
await createNotification(
  receiverId,
  'message',
  `New message from ${senderName}`,
  messagePreview,
  `/messages?user=${senderId}`,
  senderId
);

// When user gets a call
await createNotification(
  receiverId,
  'call',
  `${callerName} is calling...`,
  null,
  null,
  callerId
);
```

---

## 📤 File Sharing

Let users share documents and files in messages.

### Database Changes
```sql
CREATE TABLE file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_size INT,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Storage Bucket
```sql
-- Create file-sharing bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('file-uploads', 'file-uploads', true);

-- Add RLS policies
CREATE POLICY "file_uploads_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'file-uploads');

CREATE POLICY "file_uploads_insert_auth"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'file-uploads'
    AND auth.uid() IS NOT NULL
  );
```

### File Upload Code
```javascript
async function uploadFile(file, messageId = null) {
  if (!isAuthenticated()) return;
  
  const maxSize = 10 * 1024 * 1024;  // 10 MB
  if (file.size > maxSize) {
    showToast('File too large (max 10 MB)', 'error');
    return;
  }
  
  const userId = window._nexaUser.id;
  const timestamp = Date.now();
  const storagePath = `${userId}/${timestamp}-${file.name}`;
  
  try {
    // Upload to storage
    const { data: uploadData, error: uploadError } = await window.sb.storage
      .from('file-uploads')
      .upload(storagePath, file);
    
    if (uploadError) throw uploadError;
    
    // Get public URL
    const { data: urlData } = window.sb.storage
      .from('file-uploads')
      .getPublicUrl(storagePath);
    
    // Save to database
    const { data, error } = await window.sb
      .from('file_uploads')
      .insert({
        user_id: userId,
        message_id: messageId,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        storage_path: storagePath,
        public_url: urlData.publicUrl
      })
      .select()
      .single();
    
    if (error) throw error;
    
    showToast('File uploaded!', 'success');
    return data;
    
  } catch (err) {
    console.error('File upload error:', err);
    showToast('Upload failed', 'error');
  }
}
```

---

## 💳 Payments Integration (Stripe)

Add payment processing for premium features or services.

### Setup Stripe
```bash
npm install @stripe/stripe-js
```

### Database Schema
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  stripe_payment_id TEXT UNIQUE,
  amount INT,  -- In cents
  currency TEXT DEFAULT 'USD',
  status TEXT CHECK (status IN ('pending', 'succeeded', 'failed')),
  service TEXT,  -- e.g., 'premium_subscription', 'service_payment'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Payment Function
```javascript
// js/payments.js

import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe('pk_test_your_key_here');

async function createPaymentIntent(amount, service) {
  try {
    // Call your backend endpoint that uses Stripe API
    const response = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount * 100,  // Convert to cents
        service,
        userId: window._nexaUser.id
      })
    });
    
    const { clientSecret } = await response.json();
    return clientSecret;
    
  } catch (err) {
    console.error('Payment intent error:', err);
    return null;
  }
}

async function processPayment(amount, service) {
  const clientSecret = await createPaymentIntent(amount, service);
  if (!clientSecret) return false;
  
  const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: cardElement,  // Stripe card element
      billing_details: {
        name: `${window._nexaUserData.fname} ${window._nexaUserData.lname}`
      }
    }
  });
  
  if (error) {
    showToast(error.message, 'error');
    return false;
  }
  
  if (paymentIntent.status === 'succeeded') {
    showToast('Payment successful!', 'success');
    return true;
  }
}
```

---

## 📅 Scheduling & Bookings

Allow users to book services and schedule calls.

### Database Schema
```sql
CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT CHECK (day_of_week >= 0 AND day_of_week <= 6),  -- 0=Sunday
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT true
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id),
  provider_id UUID NOT NULL REFERENCES users(id),
  service_name TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Booking Code
```javascript
async function checkAvailability(userId, date) {
  try {
    const dayOfWeek = new Date(date).getDay();
    
    const { data } = await window.sb
      .from('availability')
      .select('*')
      .eq('user_id', userId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_available', true);
    
    return data || [];
  } catch (err) {
    console.error('Availability check error:', err);
    return [];
  }
}

async function createBooking(providerId, serviceName, startTime, endTime, notes) {
  try {
    const { data, error } = await window.sb
      .from('bookings')
      .insert({
        client_id: window._nexaUser.id,
        provider_id: providerId,
        service_name: serviceName,
        start_time: startTime,
        end_time: endTime,
        status: 'pending',
        notes
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Send notification to provider
    await createNotification(
      providerId,
      'booking',
      `New booking from ${window._nexaUserData.fname}`,
      serviceName,
      `/bookings`,
      window._nexaUser.id
    );
    
    showToast('Booking request sent!', 'success');
    return data;
    
  } catch (err) {
    console.error('Booking error:', err);
    showToast('Failed to create booking', 'error');
  }
}
```

---

## 👨‍💼 Admin Dashboard

Add admin features for moderation and analytics.

### Database Schema
```sql
-- Add admin role to users
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' 
  CHECK (role IN ('user', 'moderator', 'admin'));

-- Admin audit log
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  action TEXT,
  target_type TEXT,  -- 'user', 'review', 'message'
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Admin Check Function
```javascript
function isAdmin() {
  return window._nexaUserData?.role === 'admin';
}

function isModerator() {
  return ['admin', 'moderator'].includes(window._nexaUserData?.role);
}

// Protect admin routes
function requireAdmin() {
  if (!isAdmin()) {
    showToast('Admin access required', 'error');
    goTo('feed');
    return false;
  }
  return true;
}
```

---

## 📊 Analytics

Track user behavior and engagement.

### Database Schema
```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT,  -- 'login', 'message_sent', 'call_initiated', 'profile_updated'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Track Events
```javascript
async function trackEvent(eventType, metadata = {}) {
  if (!isAuthenticated()) return;
  
  try {
    await window.sb
      .from('analytics_events')
      .insert({
        user_id: window._nexaUser.id,
        event_type: eventType,
        metadata
      });
  } catch (err) {
    console.error('Analytics error:', err);
  }
}

// Use in key places:
// On login
trackEvent('login', { provider: 'email' });
trackEvent('login', { provider: 'google' });

// On message send
trackEvent('message_sent', { receiver_id: receiverId });

// On call
trackEvent('call_initiated', { callee_id: calleeId, type: 'audio' });
```

---

## 🧪 Testing Advanced Features

### Test Checklist
- [ ] Video calls transmit correctly
- [ ] Reviews save and update ratings
- [ ] Notifications appear in real-time
- [ ] File uploads complete successfully
- [ ] Payments process through Stripe
- [ ] Bookings can be created and confirmed
- [ ] Admin dashboard loads with proper permissions
- [ ] Analytics tracks all events

---

## 📚 Further Reading

- [Supabase PostgreSQL Functions](https://supabase.com/docs/guides/database/functions)
- [Stripe JavaScript Integration](https://stripe.com/docs/js)
- [WebRTC Advanced Features](https://webrtc.googleblog.com/)
- [Real-time Analytics with Supabase](https://supabase.com/docs/guides/realtime)

---

**Ready to add features?** Pick one from above and follow the code examples!
