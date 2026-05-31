/* =============================================================
   NEXALINK — js/calling.js
   
   Voice calling functionality:
   - WebRTC peer-to-peer audio calls
   - Supabase Realtime for call signaling (offer/answer/ICE)
   - Incoming call modal with accept/decline
   - Call timer and mute controls
   
   Fixes:
   - Issue #4: Calling section now works with real WebRTC
   
   Note: Audio-only for MVP. Video can be added later.
   
   Load order: after config.js, supabase.js, ui.js, messages.js
   ============================================================= */

// Call state
window._callState = {
  peerConnection: null,
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isCallActive: false,
  currentCalleeId: null,
  currentCalleeName: '',
  callStartTime: null,
  callTimerInterval: null,
  realtimeChannel: null,
  signalingQueue: []  // Queue for ICE candidates while connection is establishing
};

// RTCPeerConnection configuration (STUN servers for NAT traversal)
const rtcConfig = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.services.mozilla.com:3478' }
  ]
};

// ─────────────────────────────────────────────────────────────
// REQUEST USER MEDIA (get microphone access)
// ─────────────────────────────────────────────────────────────
async function requestUserMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false  // Audio-only for MVP
    });
    
    window._callState.localStream = stream;
    return stream;
    
  } catch (err) {
    console.error('Media request error:', err);
    showToast('Could not access microphone. Check browser permissions.', 'error');
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// START CALL (caller side)
// ─────────────────────────────────────────────────────────────
async function startCall(calleeId, calleeName) {
  if (!isAuthenticated()) {
    showToast('Please sign in to call', 'error');
    return;
  }
  
  if (!calleeId) {
    showToast('Invalid call recipient', 'error');
    return;
  }
  
  try {
    // Request microphone access
    const stream = await requestUserMedia();
    if (!stream) return;
    
    // Create peer connection
    window._callState.peerConnection = new RTCPeerConnection(rtcConfig);
    window._callState.currentCalleeId = calleeId;
    window._callState.currentCalleeName = calleeName;
    
    // Add local stream tracks
    stream.getTracks().forEach(track => {
      window._callState.peerConnection.addTrack(track, stream);
    });
    
    // Handle remote stream
    window._callState.peerConnection.ontrack = (event) => {
      if (!window._callState.remoteStream) {
        window._callState.remoteStream = new MediaStream();
      }
      window._callState.remoteStream.addTrack(event.track);
    };
    
    // Handle ICE candidates
    window._callState.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendCallSignal('ice', { candidate: event.candidate.candidate });
      }
    };
    
    // Create and send offer
    const offer = await window._callState.peerConnection.createOffer();
    await window._callState.peerConnection.setLocalDescription(offer);
    
    sendCallSignal('offer', { offer });
    
    // Show calling modal
    showCallingModal(calleeName, 'Calling...');
    
    // Set up realtime listener for answer
    subscribeToCallSignals(calleeId);
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('📞 Call initiated to', calleeName);
    }
    
  } catch (err) {
    console.error('Start call error:', err);
    showToast('Failed to start call', 'error');
    cleanupCall();
  }
}

// ─────────────────────────────────────────────────────────────
// ANSWER CALL (callee side)
// ─────────────────────────────────────────────────────────────
async function answerCall() {
  try {
    // Request microphone access
    const stream = await requestUserMedia();
    if (!stream) return;
    
    if (!window._callState.peerConnection) {
      showToast('Call no longer available', 'error');
      return;
    }
    
    // Add local stream tracks
    stream.getTracks().forEach(track => {
      window._callState.peerConnection.addTrack(track, stream);
    });
    
    // Handle remote stream
    window._callState.peerConnection.ontrack = (event) => {
      if (!window._callState.remoteStream) {
        window._callState.remoteStream = new MediaStream();
      }
      window._callState.remoteStream.addTrack(event.track);
    };
    
    // Create and send answer
    const answer = await window._callState.peerConnection.createAnswer();
    await window._callState.peerConnection.setLocalDescription(answer);
    
    sendCallSignal('answer', { answer });
    
    // Hide incoming call modal and show connected state
    hideModal('incoming-call-modal');
    showCallingModal(window._callState.currentCalleeName, 'Connected');
    
    window._callState.isCallActive = true;
    startCallTimer();
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ Call answered');
    }
    
  } catch (err) {
    console.error('Answer call error:', err);
    showToast('Failed to answer call', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// SEND CALL SIGNAL (via Supabase)
// ─────────────────────────────────────────────────────────────
async function sendCallSignal(signalType, payload) {
  if (!isAuthenticated() || !window._callState.currentCalleeId) {
    return;
  }
  
  try {
    const { error } = await window.sb
      .from('call_signals')
      .insert({
        caller_id: window._nexaUser.id,
        callee_id: window._callState.currentCalleeId,
        signal_type: signalType,
        payload: payload
      });
    
    if (error) {
      console.error('Signal send error:', error);
    }
    
  } catch (err) {
    console.error('Signal send exception:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// SUBSCRIBE TO CALL SIGNALS (realtime updates)
// ─────────────────────────────────────────────────────────────
function subscribeToCallSignals(otherId) {
  const currentUserId = window._nexaUser.id;
  
  // Unsubscribe from previous if exists
  if (window._callState.realtimeChannel) {
    window.sb.removeChannel(window._callState.realtimeChannel);
  }
  
  // Subscribe to call signals
  const channel = window.sb
    .channel(`call-${currentUserId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'call_signals',
        filter: `callee_id=eq.${currentUserId}`
      },
      async (payload) => {
        const signal = payload.new;
        
        // Only process signals from the other party
        if (signal.caller_id !== otherId && signal.callee_id !== otherId) return;
        
        await handleCallSignal(signal);
      }
    )
    .subscribe();
  
  window._callState.realtimeChannel = channel;
}

// ─────────────────────────────────────────────────────────────
// HANDLE INCOMING CALL SIGNAL
// ─────────────────────────────────────────────────────────────
async function handleCallSignal(signal) {
  const { signal_type, payload } = signal;
  
  try {
    if (signal_type === 'offer') {
      // Incoming call
      await handleIncomingOffer(payload, signal.caller_id);
      
    } else if (signal_type === 'answer') {
      // Answer to our offer
      if (window._callState.peerConnection) {
        await window._callState.peerConnection.setRemoteDescription(
          new RTCSessionDescription(payload.answer)
        );
        
        window._callState.isCallActive = true;
        startCallTimer();
        
        // Update modal to show connected
        const statusEl = document.querySelector('.call-modal-status');
        if (statusEl) {
          statusEl.textContent = 'Connected';
          statusEl.classList.add('connected');
        }
      }
      
    } else if (signal_type === 'ice') {
      // ICE candidate
      if (window._callState.peerConnection && payload.candidate) {
        try {
          await window._callState.peerConnection.addIceCandidate(
            new RTCIceCandidate({ candidate: payload.candidate })
          );
        } catch (err) {
          // ICE candidate might fail if connection is not ready yet (queue it)
          if (window._callState.signalingQueue.length < 50) {
            window._callState.signalingQueue.push(() =>
              window._callState.peerConnection.addIceCandidate(
                new RTCIceCandidate({ candidate: payload.candidate })
              )
            );
          }
        }
      }
      
    } else if (signal_type === 'hangup') {
      // Other party ended call
      endCall();
    }
    
  } catch (err) {
    console.error('Handle signal error:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// HANDLE INCOMING OFFER (show incoming call modal)
// ─────────────────────────────────────────────────────────────
async function handleIncomingOffer(payload, callerId) {
  try {
    // Create peer connection
    window._callState.peerConnection = new RTCPeerConnection(rtcConfig);
    
    // Set remote description (offer from caller)
    await window._callState.peerConnection.setRemoteDescription(
      new RTCSessionDescription(payload.offer)
    );
    
    // Handle ICE candidates
    window._callState.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendCallSignal('ice', { candidate: event.candidate.candidate });
      }
    };
    
    // Handle remote stream
    window._callState.peerConnection.ontrack = (event) => {
      if (!window._callState.remoteStream) {
        window._callState.remoteStream = new MediaStream();
      }
      window._callState.remoteStream.addTrack(event.track);
    };
    
    // Get caller info
    const { data: caller } = await window.sb
      .from('users')
      .select('fname, lname')
      .eq('id', callerId)
      .single();
    
    if (caller) {
      window._callState.currentCalleeId = callerId;
      window._callState.currentCalleeName = `${caller.fname} ${caller.lname}`;
    }
    
    // Show incoming call modal
    showIncomingCallModal(`${caller?.fname || 'User'} ${caller?.lname || ''}`);
    
    // Subscribe to signals
    subscribeToCallSignals(callerId);
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('📞 Incoming call from', window._callState.currentCalleeName);
    }
    
  } catch (err) {
    console.error('Incoming offer error:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// SHOW INCOMING CALL MODAL
// ─────────────────────────────────────────────────────────────
function showIncomingCallModal(callerName) {
  const modal = document.getElementById('incoming-call-modal');
  if (!modal) return;
  
  const nameEl = modal.querySelector('.call-modal-name');
  const statusEl = modal.querySelector('.call-modal-status');
  
  if (nameEl) nameEl.textContent = callerName;
  if (statusEl) statusEl.textContent = 'Incoming call…';
  
  showModal('incoming-call-modal');
}

// ─────────────────────────────────────────────────────────────
// SHOW CALLING MODAL (active call)
// ─────────────────────────────────────────────────────────────
function showCallingModal(userName, status = 'Calling...') {
  const modal = document.getElementById('call-modal');
  if (!modal) return;
  
  const nameEl = modal.querySelector('.call-modal-name');
  const statusEl = modal.querySelector('.call-modal-status');
  
  if (nameEl) nameEl.textContent = userName;
  if (statusEl) {
    statusEl.textContent = status;
    if (status === 'Connected') {
      statusEl.classList.add('connected');
    }
  }
  
  showModal('call-modal');
}

// ─────────────────────────────────────────────────────────────
// START CALL TIMER
// ─────────────────────────────────────────────────────────────
function startCallTimer() {
  window._callState.callStartTime = Date.now();
  
  const timerEl = document.querySelector('.call-modal-timer');
  if (timerEl) {
    timerEl.classList.add('show');
  }
  
  window._callState.callTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - window._callState.callStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    if (timerEl) {
      timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

// ─────────────────────────────────────────────────────────────
// TOGGLE MUTE
// ─────────────────────────────────────────────────────────────
function toggleMute() {
  if (!window._callState.localStream) return;
  
  const isCurrentlyMuted = !window._callState.localStream
    .getAudioTracks()[0]
    .enabled;
  
  window._callState.localStream.getAudioTracks().forEach(track => {
    track.enabled = isCurrentlyMuted;
  });
  
  window._callState.isMuted = !isCurrentlyMuted;
  
  const muteBtn = document.querySelector('.call-btn.mute');
  if (muteBtn) {
    muteBtn.classList.toggle('active');
  }
  
  showToast(window._callState.isMuted ? 'Muted' : 'Unmuted', 'info');
}

// ─────────────────────────────────────────────────────────────
// END CALL
// ─────────────────────────────────────────────────────────────
function endCall() {
  // Send hangup signal to other party
  if (window._callState.currentCalleeId) {
    sendCallSignal('hangup', {});
  }
  
  // Cleanup
  cleanupCall();
  
  // Close modal
  hideModal('call-modal');
  hideModal('incoming-call-modal');
  
  showToast('Call ended', 'info');
}

// ─────────────────────────────────────────────────────────────
// CLEANUP CALL (close connections, stop streams)
// ─────────────────────────────────────────────────────────────
function cleanupCall() {
  // Clear timer
  if (window._callState.callTimerInterval) {
    clearInterval(window._callState.callTimerInterval);
    window._callState.callTimerInterval = null;
  }
  
  // Stop local stream
  if (window._callState.localStream) {
    window._callState.localStream.getTracks().forEach(track => track.stop());
    window._callState.localStream = null;
  }
  
  // Close peer connection
  if (window._callState.peerConnection) {
    window._callState.peerConnection.close();
    window._callState.peerConnection = null;
  }
  
  // Stop remote stream
  if (window._callState.remoteStream) {
    window._callState.remoteStream.getTracks().forEach(track => track.stop());
    window._callState.remoteStream = null;
  }
  
  // Unsubscribe realtime
  if (window._callState.realtimeChannel) {
    window.sb.removeChannel(window._callState.realtimeChannel);
    window._callState.realtimeChannel = null;
  }
  
  // Reset state
  window._callState.isCallActive = false;
  window._callState.isMuted = false;
  window._callState.currentCalleeId = null;
  window._callState.callStartTime = null;
  window._callState.signalingQueue = [];
}

// ─────────────────────────────────────────────────────────────
// DECLINE INCOMING CALL
// ─────────────────────────────────────────────────────────────
function declineCall() {
  hideModal('incoming-call-modal');
  cleanupCall();
  showToast('Call declined', 'info');
}

if (window.NEXALINK_CONFIG.DEBUG) {
  console.log('✅ Calling module loaded');
}
