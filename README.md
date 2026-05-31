# Nexalink — Service Professionals Network

A modern, real-time web application connecting freelancers and service providers with clients. Built with vanilla JavaScript and Supabase.

---

## 🚀 Quick Start

### Prerequisites
- A [Supabase](https://supabase.com) account with the database set up (see SQL below)
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Optional: A local web server for testing (e.g., `python -m http.server 8000`)

### Setup Steps

1. **Download the files**
   - Extract the `nexalink/` folder to your local machine or hosting provider

2. **Configure credentials** (done in `js/config.js`)
   - The Supabase URL and Anon Key are already in `js/config.js`
   - For production, move these to environment variables on your hosting platform

3. **Set up Supabase** (if not already done)
   - Run the complete SQL setup from the Supabase SQL Editor
   - The SQL is provided in the separate setup guide (`SUPABASE_SETUP.sql`)
   - This creates tables, RLS policies, triggers, and storage buckets

4. **Configure Google OAuth** (in Supabase)
   - Go to **Authentication** → **Providers** → **Google**
   - Set up your OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/)
   - In Supabase **Auth Settings**:
     - Add your site URL to "Site URL" (e.g., `http://localhost:3000` or `https://yourdomain.com`)
     - Add the same URL to "Redirect URLs" with `/*` (e.g., `http://localhost:3000/*`)

5. **Host the app**
   - Upload to any static hosting: Vercel, Netlify, GitHub Pages, or your own server
   - Open `index.html` in your browser

---

## 📁 Project Structure

```
nexalink/
├── index.html              ← Main HTML (no inline code)
├── .gitignore              ← Prevents committing secrets
│
├── css/
│   └── styles.css          ← All styles (extracted from original)
│
├── js/
│   ├── config.js           ← Supabase credentials + config
│   ├── supabase.js         ← Client init + auth state manager
│   ├── ui.js               ← Navigation, toasts, tabs, modals
│   ├── auth.js             ← Email/password + Google OAuth
│   ├── profile.js          ← Profile CRUD + image upload
│   ├── feed.js             ← Feed + discover (real DB users)
│   ├── search.js           ← Live search (local + advanced)
│   ├── messages.js         ← Messaging + Supabase Realtime
│   ├── calling.js          ← WebRTC voice calls
│   └── help.js             ← Help tabs + FAQ + support tickets
│
└── README.md               ← This file
```

### How Files Work Together

1. **Load order matters**:
   - `config.js` → `supabase.js` → `ui.js` → all others
   - See `index.html` for the correct `<script>` order

2. **Global state**:
   - `window.NEXALINK_CONFIG` — Credentials
   - `window.sb` — Supabase client
   - `window._nexaUser` — Current auth user
   - `window._nexaUserData` — User profile from DB
   - `window._s` — UI state (page, tabs, etc.)

3. **Key patterns**:
   - All async operations use `window.sb` (Supabase client)
   - Real-time features use Supabase Realtime channels
   - RLS (Row-Level Security) protects data at the database level
   - No frameworks — vanilla JS only

---

## ✅ Issues Fixed

### Issue #1: Login IDs not automatically saving
**What was broken**: Users logged in but weren't auto-inserted into the `users` table. Profile was lost on refresh.

**Fix**: 
- Replaced fake auth with real Supabase email/password and Google OAuth
- Added DB trigger `handle_new_user()` that auto-inserts users on signup
- `supabase.js` automatically fetches profile after login

### Issue #2: Edited login/profile data not saving
**What was broken**: Profile edits only saved to in-memory JS object. Lost on page reload.

**Fix**:
- `saveProfile()` now writes to Supabase `users` table
- After save, fetches fresh data from DB to ensure consistency
- `refreshProfileDisplay()` renders data from real DB, not local cache

### Issue #3: Search does not display user names
**What was broken**: Feed used hardcoded `profiles[]` array. No real data was displayed.

**Fix**:
- `feed.js` now queries real users from `users` table
- `search.js` performs live search across name, bio, skills, role
- Results highlight matching text with `<mark>` tags

### Issue #4: Calling section not working
**What was broken**: "Call" button just showed a toast. No actual calling logic.

**Fix**:
- Implemented WebRTC peer-to-peer audio calls in `calling.js`
- Supabase `call_signals` table used for signaling (offer/answer/ICE)
- Incoming call modal with accept/decline buttons
- Call timer, mute button, and proper cleanup

### Issue #5: Banner/profile image upload not working
**What was broken**: "Edit Banner" button had no handler. No file upload logic.

**Fix**:
- Added hidden `<input type="file">` elements for avatar and banner
- `profile.js` implements file upload to Supabase Storage
- Auto-generates public URLs and saves to DB
- Shows upload progress and success states

### Issue #6: Help section tabs/pages not opening
**What was broken**: `.help-card` elements had no onclick handlers. Tabs didn't switch.

**Fix**:
- Added `switchHelpTab()` to show/hide tab content
- Help cards now trigger tab switches
- FAQ accordion with open/close animations
- Complaint form submits to `help_tickets` table

### Issue #7: Google login opens automatically like guest account
**What was broken**: `handleGoogleAuth()` was a fake stub that auto-logged in after 1.2 seconds.

**Fix**:
- Real Supabase OAuth integration
- Uses `prompt=select_account` to force account chooser (no auto-login)
- Proper redirect handling on return from Google

---

## 🔐 Security

### Credentials
- **config.js**: Contains Supabase URL and Anon Key
  - Anon Key is intentionally public-safe by design
  - RLS policies on database protect sensitive data
  - For production, use environment variables on your hosting provider

### Row-Level Security (RLS)
All tables have RLS enabled:
- `users`: Public read, only own write/update/delete
- `messages`: Only read own sent/received, only send as self
- `help_tickets`: Submit freely, only see own tickets
- `call_signals`: Only see calls involving you
- Storage buckets: Upload to own folder only

### Privacy
- Messages are encrypted in transit (HTTPS)
- Passwords hashed server-side
- No third-party tracking
- Users control their own data

---

## 📚 Database Schema

### Users Table
```sql
id, email, fname, lname, phone, bio, location, website, user_type,
skills (array), avatar_url, banner_url, is_available, is_verified,
rating, projects_count, created_at, updated_at
```

### Messages Table
```sql
id, sender_id, receiver_id, content, is_read, created_at
```

### Help Tickets Table
```sql
id, user_id, name, email, category, priority, description,
ticket_ref, status, created_at
```

### Call Signals Table
```sql
id, caller_id, callee_id, signal_type, payload (JSON), created_at
```

### Connections Table (Friend requests)
```sql
id, requester_id, addressee_id, status, created_at
```

---

## 🎯 Features

### ✅ Authentication
- Email/password signup and login
- Google OAuth (with account chooser)
- Email confirmation (optional)
- Password reset
- Session persistence

### ✅ Profile Management
- Edit profile (name, bio, location, skills)
- Upload avatar image
- Upload banner image
- Verification badge
- Rating system

### ✅ Discovery
- Browse all users
- Filter by professional type
- Search by name, skills, bio
- Suggested users for you
- Trending professionals

### ✅ Messaging
- One-to-one conversations
- Real-time message delivery (Supabase Realtime)
- Message history
- Unread badges
- Mark messages as read

### ✅ Calling
- WebRTC audio calls (peer-to-peer)
- Incoming call modal
- Call timer
- Mute/unmute during call
- Proper connection cleanup

### ✅ Help & Support
- FAQ with accordion
- Support ticket submission
- Unique ticket references
- Category and priority system
- Status tracking

---

## 🚀 Deployment

### Vercel (Recommended)
```bash
vercel
```

### Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir .
```

### GitHub Pages
1. Push to `main` branch
2. Enable GitHub Pages in repository settings
3. Set source to `main` branch

### Traditional Hosting
1. Upload entire `nexalink/` folder via FTP
2. Point domain to the folder
3. Ensure `index.html` is accessible

### Environment Variables (Production)
If hosting on a platform with env var support:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Then update `config.js` to read from `window.env` or build-time variables.

---

## 🛠️ Troubleshooting

### "Failed to fetch users"
- Check Supabase Status Page
- Verify RLS policies allow SELECT on users table
- Check browser console for errors

### Google OAuth not working
- Verify redirect URLs in both Supabase and Google Cloud Console match exactly
- Check browser console for CORS errors
- Ensure site URL in Supabase Auth settings is correct

### Messages not appearing
- Check Supabase Realtime is enabled in project settings
- Verify RLS policies on messages table
- Check browser console for Realtime subscription errors

### File upload fails
- Check Storage buckets exist (`avatars` and `banners`)
- Verify Storage policies allow insert
- Check file size (max 5 MB)
- Ensure file type is image (JPEG, PNG, WebP, GIF)

### Call won't connect
- Check browser permissions for microphone
- Verify both users have accepted call
- Check firewall allows WebRTC (STUN servers on port 3478)
- Try HTTPS (WebRTC requires secure context)

---

## 📞 Support

For issues or questions:
1. Check the Help page in the app (❓ Help tab)
2. Review Supabase documentation: https://supabase.com/docs
3. Check browser console for error messages
4. Verify all SQL setup completed successfully

---

## 📝 License

This project is provided as-is. Modify and use freely for your own projects.

---

**Version**: 1.0.0  
**Last Updated**: May 2024  
**Built with**: Supabase, Vanilla JavaScript, WebRTC

---

## 🧑‍💻 Development Guide

### Setting Up Dev Environment

1. **Local development**
   ```bash
   # Start a simple HTTP server
   python -m http.server 8000
   # or with Node
   npx http-server
   ```
   Then open `http://localhost:8000` in your browser

2. **Enable debug mode**
   - Edit `js/config.js`
   - Set `DEBUG: true`
   - Check browser console for detailed logs

3. **Testing locally**
   - Open DevTools (F12)
   - Check Console for errors
   - Check Network tab for API calls
   - Use Realtime subscriptions in browser console

### Adding New Features

#### Example: Add a new page
```javascript
// 1. Add HTML in index.html
<div class="page" id="page-newfeature">
  <h1>New Feature</h1>
</div>

// 2. Add init function in new file or existing
function initNewfeaturePage() {
  console.log('New feature page loaded');
  // Load data, set up listeners, etc.
}

// 3. Navigate with
goTo('newfeature');
```

#### Example: Add database query
```javascript
// In any JS file
const { data, error } = await window.sb
  .from('users')
  .select('id, fname, lname')
  .eq('is_verified', true)
  .limit(10);

if (error) {
  console.error('Query error:', error);
  showToast('Failed to load data', 'error');
  return;
}

// Use data...
console.log(data);
```

#### Example: Add Realtime listener
```javascript
// Subscribe to changes
const channel = window.sb
  .channel('my-channel')
  .on('postgres_changes', 
    {
      event: '*',  // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'users'
    },
    (payload) => {
      console.log('Change received!', payload);
      // Handle new/updated/deleted data
    }
  )
  .subscribe();

// Unsubscribe when done
window.sb.removeChannel(channel);
```

---

## 📖 API Reference

### Authentication

#### `handleLogin(event)`
Login with email and password
```javascript
// Called from form submission
await handleLogin(event);
// User is logged in via onAuthStateChange callback
```

#### `handleRegister(event)`
Register new account with fname, lname, email, password
```javascript
await handleRegister(event);
// User gets confirmation email (if email auth enabled)
```

#### `handleGoogleAuth(event)`
Initiate Google OAuth with account chooser
```javascript
await handleGoogleAuth();
// Redirects to Google, returns to redirectTo URL
```

#### `logout()`
Sign out current user
```javascript
await logout();
// Navigates to landing, clears session
```

#### `isAuthenticated()`
Check if user is logged in
```javascript
if (isAuthenticated()) {
  // User is logged in
}
```

#### `getCurrentUser()`
Get current auth user object
```javascript
const user = getCurrentUser();
// Returns: { id, email, user_metadata, ... }
```

#### `getCurrentUserData()`
Get current user's profile from database
```javascript
const profile = getCurrentUserData();
// Returns: { id, email, fname, lname, bio, avatar_url, ... }
```

---

### Navigation & UI

#### `goTo(page)`
Navigate to a page with auth guard
```javascript
goTo('feed');       // Feed page (requires auth)
goTo('landing');    // Landing page (public)
goTo('auth');       // Auth page (public)
```

#### `showToast(message, type, duration)`
Show temporary notification
```javascript
showToast('Profile updated!', 'success');     // Green
showToast('Something went wrong', 'error');   // Red
showToast('Please sign in', 'info');          // Blue
showToast('Custom message', 'info', 5000);    // 5 second duration
```

#### `switchProfileTab(tabName)`
Switch profile page tabs
```javascript
switchProfileTab('about');      // About tab
switchProfileTab('services');   // Services tab
switchProfileTab('edit');       // Edit tab
```

#### `switchHelpTab(tabName)`
Switch help page tabs
```javascript
switchHelpTab('faq');           // FAQ tab
switchHelpTab('report');        // Report tab
switchHelpTab('contact');       // Contact tab
```

#### `showModal(modalId)` / `hideModal(modalId)`
Show/hide modal overlays
```javascript
showModal('call-modal');        // Show call modal
hideModal('call-modal');        // Hide call modal
```

---

### Profile Management

#### `loadAndDisplayProfile()`
Load current user's profile and render it
```javascript
await loadAndDisplayProfile();
// Fetches from DB and updates display
```

#### `saveProfile(event)`
Save profile changes to database
```javascript
await saveProfile(event);
// Updates: bio, location, website, phone, user_type, skills
```

#### `handleAvatarUpload(file)`
Upload profile avatar image
```javascript
const file = document.getElementById('avatar-upload').files[0];
await handleAvatarUpload(file);
// Uploads to Storage, updates DB
```

#### `handleBannerUpload(file)`
Upload profile banner image
```javascript
const file = document.getElementById('banner-upload').files[0];
await handleBannerUpload(file);
// Uploads to Storage, updates DB
```

#### `refreshProfileDisplay(profile)`
Render profile data to DOM
```javascript
refreshProfileDisplay(window._nexaUserData);
// Updates all profile DOM elements
```

---

### Feed & Discovery

#### `loadFeedUsers()`
Load all users for feed from database
```javascript
await loadFeedUsers();
// Fetches users, excludes current user
```

#### `searchFeed(query)`
Search feed locally with live results
```javascript
searchFeed('designer');
// Filters loaded users by name/skills/bio
```

#### `applyDiscover(filter)`
Apply filters to discover page
```javascript
applyDiscover('Freelancer');    // By type
applyDiscover('all');           // Clear filters
```

#### `renderProfileCard(user)`
Generate HTML for a single profile card
```javascript
const html = renderProfileCard(user);
// Returns: <div class="profile-card">...</div>
```

---

### Messaging

#### `initMessagesPage()`
Initialize messages page
```javascript
initMessagesPage();
// Loads conversations, sets up Realtime
```

#### `loadConversations()`
Load all conversations for current user
```javascript
await loadConversations();
// Fetches list of unique conversation partners
```

#### `selectConversation(userId, userName)`
Open a specific conversation
```javascript
selectConversation('user-id-123', 'John');
// Loads messages, renders chat area
```

#### `sendMessage(event)`
Send a message in current conversation
```javascript
await sendMessage(event);
// Inserts message to DB, updates UI
```

#### `openChat(userId, userName)`
Start a new conversation (from feed)
```javascript
openChat('user-id', 'User Name');
// Navigates to messages page
```

---

### Calling (WebRTC)

#### `startCall(calleeId, calleeName)`
Initiate a voice call
```javascript
startCall('user-id-123', 'John Doe');
// Creates RTCPeerConnection, sends offer
```

#### `answerCall()`
Answer an incoming call
```javascript
answerCall();
// Creates answer, establishes connection
```

#### `endCall()`
End active call
```javascript
endCall();
// Closes RTCPeerConnection, stops streams
```

#### `toggleMute()`
Toggle audio mute during call
```javascript
toggleMute();
// Enables/disables microphone track
```

#### `requestUserMedia()`
Request microphone access
```javascript
const stream = await requestUserMedia();
// Returns: MediaStream with audio track
```

---

### Help & Support

#### `initHelpPage()`
Initialize help page
```javascript
initHelpPage();
// Sets up FAQ accordion, form handlers
```

#### `handleComplaintSubmit(event)`
Submit support ticket
```javascript
await handleComplaintSubmit(event);
// Inserts ticket to DB, shows confirmation
```

#### `generateTicketRef()`
Generate unique ticket reference
```javascript
const ref = generateTicketRef();
// Returns: "NX-ABC123XYZ"
```

#### `toggleFaq(el)`
Toggle FAQ item open/close
```javascript
toggleFaq(questionButton);
// Expands/collapses answer
```

---

### Utilities

#### `getInitials(fname, lname)`
Generate initials from name
```javascript
const initials = getInitials('John', 'Doe');
// Returns: "JD"
```

#### `formatDate(date)`
Format date to readable string
```javascript
const str = formatDate(new Date());
// Returns: "Dec 25, 2:30 PM"
```

#### `formatTime(date)`
Format time string
```javascript
const time = formatTime(new Date());
// Returns: "2:30 PM"
```

#### `getSelectedSkills()`
Get array of selected skill chips
```javascript
const skills = getSelectedSkills();
// Returns: ["JavaScript", "UI Design", ...]
```

#### `toggleSkill(el)`
Toggle skill chip selected state
```javascript
toggleSkill(chipElement);
// Adds/removes 'selected' class
```

---

## 🔍 Debugging

### Console Logging
Enable debug mode in `js/config.js`:
```javascript
DEBUG: true  // Logs all major operations to console
```

Then check browser DevTools console (F12):
```
✅ Supabase client initialized
✅ Session restored for: user@email.com
✅ Loaded 25 users for feed
📞 Call initiated to John Doe
```

### Inspect State
```javascript
// In browser console:
window._nexaUser           // Current auth user
window._nexaUserData       // User profile from DB
window._s                  // UI state
window._feedState          // Feed page state
window._messagesState      // Messages page state
window._callState          // Call state
window.sb                  // Supabase client
```

### Test Queries
```javascript
// Test a database query in console:
const { data, error } = await window.sb
  .from('users')
  .select('*')
  .limit(5);
console.log(data, error);

// Test a Realtime subscription:
const channel = window.sb
  .channel('test')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'users' },
    (payload) => console.log('Change!', payload)
  )
  .subscribe();
```

### Network Requests
1. Open DevTools → Network tab
2. Filter by Fetch/XSS to see Supabase API calls
3. Click on request to see request/response headers and body

### Real-time Issues
```javascript
// Check Realtime status:
window.sb.realtime.instance.state;  // Should be 'joined'

// View active subscriptions:
window.sb.realtime.channels;        // Array of channels

// Reconnect if needed:
window.sb.realtime.disconnect();
window.sb.realtime.connect();
```

---

## 🧪 Testing

### Manual Testing Checklist

**Authentication**
- [ ] Sign up with email/password
- [ ] Verify email confirmation works
- [ ] Sign in with email/password
- [ ] Sign in with Google (account chooser appears)
- [ ] Google account creates user row in DB
- [ ] Password reset flow works
- [ ] Logout clears session

**Profile**
- [ ] Edit bio, location, website, phone
- [ ] Save profile to DB
- [ ] Upload avatar image
- [ ] Upload banner image
- [ ] Images are public URLs
- [ ] Skills selection works

**Feed & Discovery**
- [ ] Load and display users
- [ ] Filter by professional type
- [ ] Search by name/skills
- [ ] Results highlight match
- [ ] Visit suggested users

**Messages**
- [ ] Load conversations
- [ ] Send message
- [ ] Receive message (Realtime)
- [ ] Unread badge appears
- [ ] Mark as read

**Calling**
- [ ] Initiate call (offer sent)
- [ ] Incoming call modal appears
- [ ] Answer call
- [ ] Audio transmits
- [ ] Mute/unmute works
- [ ] End call cleanly

**Help**
- [ ] FAQ accordion opens/closes
- [ ] Submit support ticket
- [ ] Ticket ref generated
- [ ] Confirmation displayed

### Unit Testing (Future)
```javascript
// Example test structure (using Jest)
describe('Auth Module', () => {
  it('should register new user', async () => {
    const result = await handleRegister({
      fname: 'Test',
      lname: 'User',
      email: 'test@example.com',
      password: 'password123'
    });
    expect(result).toBeDefined();
  });

  it('should login with email/password', async () => {
    // ...
  });
});
```

---

## 🔒 Security Best Practices

### Credentials
✅ **DO:**
- Store Supabase URL + Anon Key in `config.js` (it's safe by design)
- Use environment variables in production
- Keep private keys off GitHub
- Rotate API keys regularly

❌ **DON'T:**
- Hardcode API keys in commits
- Share credentials in chat/email
- Use same password for Supabase and other services
- Store personal API keys in public repos

### Data Protection
✅ **DO:**
- Enable RLS on all tables
- Verify user ID before updating their data
- Use HTTPS in production
- Validate input on client AND server

❌ **DON'T:**
- Trust client-side validation alone
- Expose user IDs in URLs/logs
- Store sensitive data without encryption
- Bypass RLS policies

### Third-Party Services
✅ **DO:**
- Use Supabase's built-in OAuth (Google, GitHub)
- Keep SDKs updated
- Review dependency security

❌ **DON'T:**
- Use untrusted OAuth providers
- Hardcode redirect URLs
- Store OAuth tokens without encryption

---

## 📊 Performance Tips

### Database
- Use `.select()` to fetch only needed columns
- Add `.limit()` to queries
- Index frequently searched columns
- Use Realtime only for critical updates

### Frontend
- Lazy load images
- Debounce search input (300ms)
- Cache user list locally
- Minimize re-renders

### Network
- Minify CSS/JS for production
- Use CDN for static assets
- Enable gzip compression
- Preload critical resources

---

## 🎓 Learning Resources

### Supabase
- [Official Docs](https://supabase.com/docs)
- [JavaScript Client Lib](https://supabase.com/docs/reference/javascript)
- [RLS Best Practices](https://supabase.com/docs/learn/auth-deep-dive/auth-policies)
- [Realtime Channels](https://supabase.com/docs/guides/realtime/overview)

### WebRTC
- [MDN WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [WebRTC Samples](https://webrtc.github.io/samples/)
- [STUN/TURN Servers](https://webrtc.org/getting-started/peer-connections)

### JavaScript
- [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/)
- [ES6+ Features](https://github.com/lukehoban/es6features)
- [Async/Await](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Promises)

### Web APIs
- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)

---

## 🐛 Common Issues & Solutions

### "Supabase client not initialized"
**Cause**: `supabase.js` not loaded or `config.js` missing credentials  
**Solution**: Verify script load order in `index.html`, check browser console for errors

### "RLS policy error"
**Cause**: User doesn't have permission for operation  
**Solution**: Check RLS policies in Supabase, verify user_id is correct

### "CORS error"
**Cause**: Request blocked by browser security  
**Solution**: Ensure Supabase URL is correct, check Site URL in Auth settings

### "WebRTC connection fails"
**Cause**: Firewall blocks peer-to-peer, STUN server unavailable  
**Solution**: Check firewall settings, use HTTPS, try different STUN server

### "Realtime not working"
**Cause**: Realtime not enabled in project, channel not subscribed  
**Solution**: Enable Realtime in Supabase project settings, check subscription logs

---

## 🚢 Production Checklist

- [ ] Replace debug URLs with production URLs
- [ ] Set `DEBUG: false` in config.js
- [ ] Enable HTTPS/SSL
- [ ] Set correct Site URL in Supabase Auth
- [ ] Add domain to Google OAuth redirect URLs
- [ ] Enable reCAPTCHA (optional)
- [ ] Set up email templates
- [ ] Test all auth flows
- [ ] Test calling with real network
- [ ] Monitor Supabase database usage
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Backup database regularly
- [ ] Document deployment process
- [ ] Create monitoring alerts

---

## 📞 Getting Help

### Before Asking
1. Check browser console for errors (F12)
2. Review logs in Supabase dashboard
3. Test with example code from docs
4. Search GitHub issues for similar problems

### Where to Ask
- [Supabase Discord](https://discord.supabase.com) — Supabase-specific issues
- [Stack Overflow](https://stackoverflow.com) — Tag with `supabase`, `webrtc`, `javascript`
- [GitHub Issues](https://github.com/supabase/supabase) — Bug reports for Supabase
- [MDN Web Docs](https://developer.mozilla.org) — JavaScript and Web API questions

### Providing Good Error Reports
Include:
1. **Error message** (exact text from console)
2. **Steps to reproduce** (what you were doing)
3. **Expected behavior** (what should have happened)
4. **Actual behavior** (what did happen)
5. **Environment** (browser, OS, Supabase region)
6. **Screenshots** (of error modal or console)

---

## 📄 License & Attribution

This project is provided as-is. Feel free to:
- ✅ Use for personal projects
- ✅ Modify and customize
- ✅ Deploy commercially
- ✅ Share with attribution

Please respect the licenses of dependencies:
- Supabase (open source)
- Google Fonts (free)
- Any third-party libraries

---

## 🙏 Contributors

Built with care by the Nexalink team. Contributions welcome!

---

**Questions?** Check the Help section in the app or review this README.

**Ready to deploy?** Follow the [Deployment](#-deployment) section above.

**Need more features?** See [Adding New Features](#example-add-a-new-page) for the development pattern.
