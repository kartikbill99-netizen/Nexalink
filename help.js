/* =============================================================
   NEXALINK — js/help.js
   
   Help page functionality:
   - Tab switching (FAQ, Report, Contact, Billing)
   - FAQ accordion (expand/collapse answers)
   - Complaint/support ticket form submission
   - Ticket reference generation
   
   Fixes:
   - Issue #6: Help section tabs and pages now open correctly
   
   Load order: after config.js, supabase.js, ui.js
   ============================================================= */

// Help page state
window._helpState = {
  activeTab: 'faq',
  ticketId: null
};

// ─────────────────────────────────────────────────────────────
// INIT HELP PAGE
// ─────────────────────────────────────────────────────────────
function initHelpPage() {
  // Set FAQ tab as active by default
  switchHelpTab('faq');
  
  // Wire up FAQ accordion
  setupFaqAccordion();
  
  // Wire up complaint form
  setupComplaintForm();
  
  // Wire up help card clicks
  setupHelpCardClicks();
}

// ─────────────────────────────────────────────────────────────
// SETUP FAQ ACCORDION
// ─────────────────────────────────────────────────────────────
function setupFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item .faq-question');
  
  faqItems.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      toggleFaq(button);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SETUP HELP CARD CLICKS (3-column grid to open tabs)
// ─────────────────────────────────────────────────────────────
function setupHelpCardClicks() {
  const cards = document.querySelectorAll('.help-grid .help-card');
  
  cards.forEach((card, index) => {
    card.addEventListener('click', () => {
      const tabMap = ['faq', 'report', 'contact', 'billing'];
      const tabName = tabMap[index] || 'faq';
      switchHelpTab(tabName);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// SETUP COMPLAINT FORM
// ─────────────────────────────────────────────────────────────
function setupComplaintForm() {
  const form = document.getElementById('complaint-form');
  if (form) {
    form.addEventListener('submit', handleComplaintSubmit);
  }
}

// ─────────────────────────────────────────────────────────────
// HANDLE COMPLAINT FORM SUBMISSION
// ─────────────────────────────────────────────────────────────
async function handleComplaintSubmit(event) {
  event.preventDefault();
  
  // Gather form data
  const name = document.getElementById('complaint-name')?.value?.trim();
  const email = document.getElementById('complaint-email')?.value?.trim();
  const category = document.getElementById('complaint-category')?.value;
  const priority = document.getElementById('complaint-priority')?.value;
  const description = document.getElementById('complaint-description')?.value?.trim();
  
  // Validation
  if (!name || !email || !category || !description) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  if (!email.includes('@')) {
    showToast('Please enter a valid email address', 'error');
    return;
  }
  
  if (description.length < 10) {
    showToast('Description must be at least 10 characters', 'error');
    return;
  }
  
  const submitBtn = event.target.querySelector('button[type="submit"]');
  setButtonLoading(submitBtn, true);
  
  try {
    // Generate ticket reference
    const ticketRef = generateTicketRef();
    
    // Prepare data
    const ticketData = {
      name,
      email,
      category,
      priority: priority || 'Low – General inquiry',
      description,
      ticket_ref: ticketRef,
      user_id: isAuthenticated() ? window._nexaUser.id : null,
      status: 'open'
    };
    
    // Insert into database
    const { data, error } = await window.sb
      .from('help_tickets')
      .insert([ticketData])
      .select()
      .single();
    
    if (error) {
      console.error('Ticket submission error:', error);
      showToast('Failed to submit ticket. Please try again.', 'error');
      setButtonLoading(submitBtn, false);
      return;
    }
    
    // Store ticket ID for reference
    window._helpState.ticketId = data.id;
    
    // Show success state
    showTicketSuccess(ticketRef);
    
    // Clear form
    event.target.reset();
    
    setButtonLoading(submitBtn, false);
    
    if (window.NEXALINK_CONFIG.DEBUG) {
      console.log('✅ Ticket submitted:', ticketRef);
    }
    
  } catch (err) {
    console.error('Ticket submission exception:', err);
    showToast('An error occurred. Please try again.', 'error');
    setButtonLoading(submitBtn, false);
  }
}

// ─────────────────────────────────────────────────────────────
// GENERATE TICKET REFERENCE (NX-XXXXXXXX)
// ─────────────────────────────────────────────────────────────
function generateTicketRef() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `NX-${random}${timestamp}`.substring(0, 12);
}

// ─────────────────────────────────────────────────────────────
// SHOW TICKET SUCCESS STATE
// ─────────────────────────────────────────────────────────────
function showTicketSuccess(ticketRef) {
  // Hide form and show success message
  const form = document.getElementById('complaint-form');
  if (form) {
    form.style.display = 'none';
  }
  
  const successEl = document.createElement('div');
  successEl.className = 'status-badge show';
  successEl.style.cssText = `
    display: flex !important;
    flex-direction: column;
    gap: 1rem;
    padding: 2rem;
    background: var(--green-light);
    border: 2px solid var(--green);
    border-radius: var(--radius);
    text-align: center;
    margin-top: 2rem;
  `;
  successEl.innerHTML = `
    <div style="font-size: 2rem;">✅</div>
    <div>
      <h3 style="font-size: 1.1rem; color: var(--text); margin-bottom: 0.5rem;">Ticket Submitted</h3>
      <p style="color: var(--text2); margin: 0;">Your support request has been received.</p>
    </div>
    <div style="background: var(--surface); padding: 1rem; border-radius: var(--radius-sm); font-family: 'DM Mono', monospace;">
      <div style="font-size: 0.75rem; color: var(--text3); text-transform: uppercase; margin-bottom: 0.25rem;">Reference Number</div>
      <div style="font-size: 1.25rem; color: var(--accent); font-weight: 700;">${ticketRef}</div>
    </div>
    <p style="color: var(--text3); font-size: 0.875rem; margin: 0;">
      We'll get back to you within 24 hours via email. Keep your reference number for follow-ups.
    </p>
    <button class="btn btn-secondary" onclick="resetComplaintForm()" style="width: 100%;">Submit Another Ticket</button>
  `;
  
  const container = document.querySelector('.complaint-form');
  if (container) {
    container.appendChild(successEl);
  }
  
  showToast('Ticket submitted successfully!', 'success');
}

// ─────────────────────────────────────────────────────────────
// RESET COMPLAINT FORM (after success)
// ─────────────────────────────────────────────────────────────
function resetComplaintForm() {
  // Remove success message
  document.querySelectorAll('.status-badge').forEach(el => {
    if (el.innerHTML.includes('Ticket Submitted')) {
      el.remove();
    }
  });
  
  // Show form again
  const form = document.getElementById('complaint-form');
  if (form) {
    form.style.display = 'flex';
    form.reset();
  }
}

// ─────────────────────────────────────────────────────────────
// FAQ ACCORDION TOGGLE (defined in ui.js but improved here)
// ─────────────────────────────────────────────────────────────
function toggleFaqItem(el) {
  const item = el.closest('.faq-item');
  if (!item) return;
  
  const answer = item.querySelector('.faq-answer');
  const isOpen = el.classList.contains('open');
  
  // Close all other FAQ items in the same section
  const section = el.closest('.faq-section') || item.parentElement;
  section.querySelectorAll('.faq-item').forEach(faq => {
    if (faq !== item) {
      const q = faq.querySelector('.faq-question');
      const a = faq.querySelector('.faq-answer');
      q.classList.remove('open');
      a.classList.remove('open');
    }
  });
  
  // Toggle current item
  el.classList.toggle('open');
  answer.classList.toggle('open');
}

// ─────────────────────────────────────────────────────────────
// SAMPLE FAQ DATA (if needed to populate dynamically)
// ─────────────────────────────────────────────────────────────
const faqData = [
  {
    question: 'How do I create a profile?',
    answer: 'Sign up with your email and complete your profile with your name, location, skills, and a bio. You can also upload a profile picture and banner.'
  },
  {
    question: 'How do I find service providers?',
    answer: 'Use the Feed to see recent professionals or the Discover page to filter by type, location, and skills. Search for specific services using the search bar.'
  },
  {
    question: 'How do I send a message?',
    answer: 'Visit the Messages page or click the Message button on any profile. You can communicate directly with service professionals.'
  },
  {
    question: 'Can I make voice calls?',
    answer: 'Yes! Click the Call button during a conversation to initiate an audio call. Both parties must have microphone access enabled.'
  },
  {
    question: 'Is my information secure?',
    answer: 'Yes. All your data is encrypted and stored securely in our database. We never share your information with third parties.'
  },
  {
    question: 'How do I verify my identity?',
    answer: 'Visit your profile and complete the verification process. This helps build trust with other professionals on the platform.'
  },
  {
    question: 'How do I report a user?',
    answer: 'Use the Help page and submit a support ticket. Select "Report" as the category and describe the issue. Our team will review it promptly.'
  },
  {
    question: 'What happens if I forget my password?',
    answer: 'Click "Forgot Password" on the login page. We\'ll send you a secure link to reset your password via email.'
  }
];

// ─────────────────────────────────────────────────────────────
// HELPER: POPULATE FAQ FROM DATA
// ─────────────────────────────────────────────────────────────
function populateFaqSection() {
  const faqContainer = document.getElementById('faq-items');
  if (!faqContainer) return;
  
  const html = faqData.map((item, index) => `
    <div class="faq-item">
      <button class="faq-question" onclick="toggleFaqItem(this)">
        <span>${item.question}</span>
        <span class="faq-chevron">⌄</span>
      </button>
      <div class="faq-answer">
        ${item.answer}
      </div>
    </div>
  `).join('');
  
  faqContainer.innerHTML = html;
  setupFaqAccordion();
}

// ─────────────────────────────────────────────────────────────
// CATEGORIES FOR COMPLAINT FORM
// ─────────────────────────────────────────────────────────────
const ticketCategories = [
  'Report a User',
  'Report Inappropriate Content',
  'Technical Issue',
  'Billing Question',
  'Account Security',
  'Feature Request',
  'General Inquiry'
];

const ticketPriorities = [
  'Low – General inquiry',
  'Medium – Needs response',
  'High – Urgent issue',
  'Critical – Account compromised'
];

if (window.NEXALINK_CONFIG.DEBUG) {
  console.log('✅ Help module loaded');
}
