/* =============================================================
   NEXALINK — js/messages.js
   
   Messaging functionality:
   - Load conversations for current user
   - Send and receive messages in real-time via Supabase Realtime
   - Mark messages as read
   - Display message history
   - Open/manage individual conversations
   
   Load order: after config.js, supabase.js, ui.js, feed.js
   ============================================================= */

// Messages state
window._messagesState = {
  conversations: [],
  currentConvUserId: null,
  currentConvUserName: '',
  messages: [],
  realtimeSubscription: null
};

// ─────────────────────────────────────────────────────────────
// INIT MESSAGES PAGE
// ─────────────────────────────────────────────────────────────
async function initMessagesPage() {
  if (!isAuthenticated()) {
    goTo('auth');
    return;
  }
  
  // Load conversations
  await loadConversations();
  
  // Set up realtime listener
  subscribeToNewMessages();
}

// ─────────────────────────────────────────────────────────────
// LOAD CONVERSATIONS FOR CURRENT USER
// ─────────────────────────────────────────────────────────────
async function loadConversations() {
  const currentUserId = window._nexaUser.id;
  
  try {
    // Get all unique conversations (sent and received)
    const { data: sent, error: sentError } = await window.sb
      .from('messages')
      .select('receiver_id')
      .eq('sender_id', currentUserId)
      .order('created_at', { ascending: false });
    
    const { data: received, error: receivedError } = await window.sb
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', currentUserId)
      .order('created_at', { ascending: false });
    
    if (sentError || receivedError) {
      console.error('Load conversations error:', sentError || receivedError);
      showToast('Failed to load conversations', 'error');
      return;
    }
    
    // Get unique user IDs
    const userIds = new Set();
    (sent || []).forEach(msg => userIds.add(msg.receiver_id));
    (received || []).forEach(msg => userIds.add(msg.sender_id));
    
    if (userIds.size === 0) {
      renderConversationsEmpty();
      return;
    }
    
    // Fetch user data for each conversation
    const convUsers = await Promise.all(
      Array.from(userIds).map(userId =>
        window.sb.from('users').select('*').eq('id', userId).single()
      )
    );
    
    window._messagesState.conversations = convUsers
      .filter(result => !result.error)
      .map(result => result.data);
    
    renderConversationsList();
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ Loaded', window._messagesState.conversations.length, 'conversations');
    }
    
  } catch (err) {
    console.error('Conversations load exception:', err);
    showToast('Error loading conversations', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// RENDER CONVERSATIONS LIST
// ─────────────────────────────────────────────────────────────
function renderConversationsList() {
  const container = document.getElementById('conversations-list');
  if (!container) return;
  
  const convs = window._messagesState.conversations;
  
  if (convs.length === 0) {
    renderConversationsEmpty();
    return;
  }
  
  const html = convs.map(user => {
    const initials = getInitials(user.fname, user.lname);
    const avatarHtml = user.avatar_url
      ? `<img src="${user.avatar_url}" alt="Avatar" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
      : `<div class="avatar" style="width:40px;height:40px;font-size:0.9rem;">${initials}</div>`;
    
    const isActive = window._messagesState.currentConvUserId === user.id ? 'active' : '';
    
    return `
      <div class="conv-item ${isActive}" onclick="selectConversation('${user.id}', '${user.fname}')">
        ${avatarHtml}
        <div class="conv-info">
          <div class="conv-name">${user.fname} ${user.lname}</div>
          <div class="conv-preview">${user.user_type || 'User'}</div>
        </div>
      </div>
    `;
  }).join('');
  
  container.innerHTML = html;
}

function renderConversationsEmpty() {
  const container = document.getElementById('conversations-list');
  if (container) {
    container.innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--text3);">
        <div style="font-size:2rem;margin-bottom:1rem;">💬</div>
        <p>No conversations yet</p>
        <p style="font-size:0.8rem;margin-top:0.5rem;">Start messaging by visiting the Feed</p>
      </div>
    `;
  }
}

// ─────────────────────────────────────────────────────────────
// SELECT/OPEN CONVERSATION
// ─────────────────────────────────────────────────────────────
async function selectConversation(userId, userName) {
  window._messagesState.currentConvUserId = userId;
  window._messagesState.currentConvUserName = userName;
  
  // Update conversation list active state
  renderConversationsList();
  
  // Load messages for this conversation
  await loadConversationMessages(userId);
  
  // Render chat area
  renderChatArea();
  
  // Focus on input
  setTimeout(() => {
    document.getElementById('chat-input')?.focus();
  }, 100);
}

// ─────────────────────────────────────────────────────────────
// LOAD MESSAGES FOR A CONVERSATION
// ─────────────────────────────────────────────────────────────
async function loadConversationMessages(otherUserId) {
  const currentUserId = window._nexaUser.id;
  
  try {
    const { data, error } = await window.sb
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (error) {
      console.error('Messages load error:', error);
      return;
    }
    
    window._messagesState.messages = data || [];
    
    // Mark received messages as read
    if (data && data.length > 0) {
      const unreadIds = data
        .filter(msg => msg.receiver_id === currentUserId && !msg.is_read)
        .map(msg => msg.id);
      
      if (unreadIds.length > 0) {
        await window.sb
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadIds);
      }
    }
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ Loaded', data.length, 'messages');
    }
    
  } catch (err) {
    console.error('Messages load exception:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// RENDER CHAT AREA
// ─────────────────────────────────────────────────────────────
function renderChatArea() {
  const header = document.querySelector('.chat-header');
  const messagesContainer = document.getElementById('chat-messages');
  
  if (!header || !messagesContainer) return;
  
  const otherUser = window._messagesState.conversations.find(
    u => u.id === window._messagesState.currentConvUserId
  );
  
  if (!otherUser) return;
  
  // Update header
  const initials = getInitials(otherUser.fname, otherUser.lname);
  const avatarHtml = otherUser.avatar_url
    ? `<img src="${otherUser.avatar_url}" alt="Avatar" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">`
    : `<div class="avatar" style="width:36px;height:36px;font-size:0.8rem;">${initials}</div>`;
  
  header.innerHTML = `
    ${avatarHtml}
    <div style="flex:1;">
      <div style="font-weight:600;">${otherUser.fname} ${otherUser.lname}</div>
      <div style="font-size:0.75rem;color:var(--text3);">${otherUser.user_type || 'User'}</div>
    </div>
    <button class="btn btn-sm btn-secondary" onclick="initiateCall('${otherUser.id}', '${otherUser.fname}')">📞 Call</button>
  `;
  
  // Render messages
  const messages = window._messagesState.messages;
  const currentUserId = window._nexaUser.id;
  
  if (messages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="chat-empty-state">
        <div class="big-icon">👋</div>
        <h3>Say hello!</h3>
        <p>Start the conversation with ${otherUser.fname}</p>
      </div>
    `;
    return;
  }
  
  const html = messages.map(msg => {
    const isSent = msg.sender_id === currentUserId;
    const msgClass = isSent ? 'sent' : 'received';
    const time = formatTime(msg.created_at);
    
    return `
      <div class="msg ${msgClass}">
        <div class="msg-bubble">${escapeHtml(msg.content)}</div>
        <div class="msg-time">${time}</div>
      </div>
    `;
  }).join('');
  
  messagesContainer.innerHTML = html;
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ─────────────────────────────────────────────────────────────
// SEND MESSAGE
// ─────────────────────────────────────────────────────────────
async function sendMessage(event) {
  event?.preventDefault();
  
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  
  if (!content) return;
  
  if (!isAuthenticated() || !window._messagesState.currentConvUserId) {
    showToast('Cannot send message', 'error');
    return;
  }
  
  const sendBtn = document.querySelector('.send-btn');
  setButtonLoading(sendBtn, true);
  
  try {
    const { data, error } = await window.sb
      .from('messages')
      .insert({
        sender_id: window._nexaUser.id,
        receiver_id: window._messagesState.currentConvUserId,
        content: content,
        is_read: false
      })
      .select()
      .single();
    
    if (error) {
      console.error('Send error:', error);
      showToast('Failed to send message', 'error');
      setButtonLoading(sendBtn, false);
      return;
    }
    
    // Clear input
    input.value = '';
    
    // Add to local state
    window._messagesState.messages.push(data);
    
    // Re-render
    renderChatArea();
    
    setButtonLoading(sendBtn, false);
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ Message sent');
    }
    
  } catch (err) {
    console.error('Send exception:', err);
    showToast('Error sending message', 'error');
    setButtonLoading(sendBtn, false);
  }
}

// ─────────────────────────────────────────────────────────────
// SUBSCRIBE TO REALTIME MESSAGE UPDATES
// ─────────────────────────────────────────────────────────────
function subscribeToNewMessages() {
  if (!isAuthenticated()) return;
  
  const currentUserId = window._nexaUser.id;
  
  // Unsubscribe from previous if exists
  if (window._messagesState.realtimeSubscription) {
    window.sb.removeChannel(window._messagesState.realtimeSubscription);
  }
  
  // Subscribe to messages table changes
  const channel = window.sb
    .channel('messages-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      },
      (payload) => {
        const newMsg = payload.new;
        
        // Only update if message is for current conversation
        if (
          (newMsg.sender_id === window._messagesState.currentConvUserId &&
           newMsg.receiver_id === currentUserId) ||
          (newMsg.receiver_id === window._messagesState.currentConvUserId &&
           newMsg.sender_id === currentUserId)
        ) {
          window._messagesState.messages.push(newMsg);
          renderChatArea();
        }
      }
    )
    .subscribe();
  
  window._messagesState.realtimeSubscription = channel;
  
  if (window.NEXALINK_CONFIG.DEBUG) {
    console.log('✅ Subscribed to realtime messages');
  }
}

// ─────────────────────────────────────────────────────────────
// OPEN CHAT WITH USER (from feed)
// ─────────────────────────────────────────────────────────────
async function openChat(userId, userName) {
  await selectConversation(userId, userName);
}

// ─────────────────────────────────────────────────────────────
// CLOSE CONVERSATION
// ─────────────────────────────────────────────────────────────
function closeConversation() {
  window._messagesState.currentConvUserId = null;
  window._messagesState.currentConvUserName = '';
  window._messagesState.messages = [];
  
  const chatArea = document.querySelector('.chat-area');
  if (chatArea) {
    chatArea.innerHTML = `
      <div class="chat-empty-state">
        <div class="big-icon">💬</div>
        <h3>No conversation selected</h3>
        <p>Choose a conversation from the list to start messaging</p>
      </div>
    `;
  }
}

if (window.NEXALINK_CONFIG.DEBUG) {
  console.log('✅ Messages module loaded');
}
