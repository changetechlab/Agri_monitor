/**
 * Agri Monitor — js/auth.js
 * Supabase Auth with Phone OTP (rural-friendly) + Email fallback
 * Also handles guest/demo mode when Supabase is not configured
 */

window.AgriAuth = (() => {
  let currentUser = null;
  let currentRole = 'guest'; // 'farmer' | 'clf' | 'admin' | 'guest'

  // ============================================================
  // Initialize Supabase client
  // ============================================================
  function initSupabase() {
    const { SUPABASE_URL, SUPABASE_ANON_KEY, USE_SUPABASE } = window.AgriConfig || {};

    if (!USE_SUPABASE || !SUPABASE_URL || SUPABASE_URL.includes('your-project')) {
      console.log('[Auth] Running in demo mode — Supabase not configured');
      window.AgriDB = null;
      return null;
    }

    try {
      const { createClient } = supabase;
      window.AgriDB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('[Auth] Supabase initialized');
      return window.AgriDB;
    } catch (err) {
      console.error('[Auth] Supabase init failed:', err);
      window.AgriDB = null;
      return null;
    }
  }

  // ============================================================
  // Get current session (on page load)
  // ============================================================
  async function getSession() {
    if (!window.AgriDB) return null;

    const { data: { session }, error } = await window.AgriDB.auth.getSession();
    if (error || !session) return null;

    currentUser = session.user;
    await detectRole(currentUser);
    return currentUser;
  }

  // ============================================================
  // Phone OTP Login (Step 1: Send OTP)
  // ============================================================
  async function sendPhoneOTP(phone) {
    if (!window.AgriDB) {
      // Demo mode — simulate success
      return { success: true, demo: true };
    }

    // Normalize Indian phone number
    const normalized = phone.startsWith('+91') ? phone : `+91${phone.replace(/\D/g, '')}`;

    const { error } = await window.AgriDB.auth.signInWithOtp({
      phone: normalized
    });

    if (error) return { success: false, error: error.message };
    return { success: true, phone: normalized };
  }

  // ============================================================
  // Phone OTP Login (Step 2: Verify OTP)
  // ============================================================
  async function verifyPhoneOTP(phone, token) {
    if (!window.AgriDB) {
      // Demo mode — any 6-digit code works
      if (token.length === 6) {
        currentUser = { id: 'demo-user', phone, email: null, demo: true };
        currentRole = 'clf'; // Default demo role
        onLoginSuccess(currentUser);
        return { success: true, user: currentUser };
      }
      return { success: false, error: 'Invalid OTP (demo: use any 6 digits)' };
    }

    const normalized = phone.startsWith('+91') ? phone : `+91${phone.replace(/\D/g, '')}`;
    const { data, error } = await window.AgriDB.auth.verifyOtp({
      phone: normalized,
      token,
      type: 'sms'
    });

    if (error) return { success: false, error: error.message };

    currentUser = data.user;
    await detectRole(currentUser);
    onLoginSuccess(currentUser);
    return { success: true, user: currentUser };
  }

  // ============================================================
  // Email Login
  // ============================================================
  async function loginWithEmail(email, password) {
    if (!window.AgriDB) {
      if (email && password) {
        currentUser = { id: 'demo-user', email, demo: true };
        currentRole = 'clf';
        onLoginSuccess(currentUser);
        return { success: true, user: currentUser };
      }
      return { success: false, error: 'Please enter email and password' };
    }

    const { data, error } = await window.AgriDB.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };

    currentUser = data.user;
    await detectRole(currentUser);
    onLoginSuccess(currentUser);
    return { success: true, user: currentUser };
  }

  // ============================================================
  // Detect user role from metadata or profiles table
  // ============================================================
  async function detectRole(user) {
    if (!user || !window.AgriDB) {
      currentRole = 'guest';
      return;
    }

    // Check user metadata first (set during admin invite)
    if (user.user_metadata?.role) {
      currentRole = user.user_metadata.role;
      return;
    }

    // Default role
    currentRole = 'farmer';
  }

  // ============================================================
  // Logout
  // ============================================================
  async function logout() {
    if (window.AgriDB) {
      await window.AgriDB.auth.signOut();
    }
    currentUser = null;
    currentRole = 'guest';
    onLogout();
  }

  // ============================================================
  // Guest mode (read-only demo)
  // ============================================================
  function continueAsGuest() {
    currentUser = null;
    currentRole = 'guest';
    hideLoginModal();
    if (window.AgriApp) window.AgriApp.loadDemoData();
  }

  // ============================================================
  // Post-login actions
  // ============================================================
  function onLoginSuccess(user) {
    hideLoginModal();
    updateAuthUI(user);
    if (window.AgriApp) window.AgriApp.onLogin(user);
  }

  function onLogout() {
    updateAuthUI(null);
    if (window.AgriApp) window.AgriApp.onLogout();
  }

  // ============================================================
  // UI Helpers
  // ============================================================
  function updateAuthUI(user) {
    const loginBtn = document.getElementById('btn-login');
    const userDisplay = document.getElementById('user-display');
    const addFarmerBtn = document.getElementById('btn-add-farmer');

    if (user) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (userDisplay) {
        userDisplay.style.display = 'flex';
        const name = user.phone || user.email || 'उपयोगकर्ता';
        userDisplay.innerHTML = `
          <span class="user-avatar">👤</span>
          <span class="user-name">${name}</span>
          <button class="icon-btn sm" onclick="AgriAuth.logout()">बाहर</button>
        `;
      }
      if (addFarmerBtn) addFarmerBtn.disabled = false;
    } else {
      if (loginBtn) loginBtn.style.display = 'flex';
      if (userDisplay) userDisplay.style.display = 'none';
      if (addFarmerBtn) addFarmerBtn.disabled = (currentRole === 'guest');
    }
  }

  function showLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function hideLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.add('hidden');
  }

  // ============================================================
  // Bind modal events
  // ============================================================
  function bindEvents() {
    // Login button
    const loginBtn = document.getElementById('btn-login');
    if (loginBtn) loginBtn.addEventListener('click', showLoginModal);

    // Send OTP button
    const sendOtpBtn = document.getElementById('btn-send-otp');
    if (sendOtpBtn) sendOtpBtn.addEventListener('click', async () => {
      const phone = document.getElementById('input-phone').value.trim();
      if (!phone || phone.length < 10) {
        showAuthError('कृपया सही मोबाइल नंबर दर्ज करें');
        return;
      }
      sendOtpBtn.disabled = true;
      sendOtpBtn.textContent = 'भेज रहे हैं...';
      const result = await sendPhoneOTP(phone);
      sendOtpBtn.disabled = false;
      sendOtpBtn.textContent = 'OTP भेजें';
      if (result.success) {
        document.getElementById('otp-step').style.display = 'block';
        document.getElementById('phone-step').style.display = 'none';
        if (result.demo) showAuthMessage('Demo: कोई भी 6 अंक डालें');
        else showAuthMessage('OTP भेजा गया!');
      } else {
        showAuthError(result.error);
      }
    });

    // Verify OTP button
    const verifyBtn = document.getElementById('btn-verify-otp');
    if (verifyBtn) verifyBtn.addEventListener('click', async () => {
      const phone = document.getElementById('input-phone').value.trim();
      const otp = document.getElementById('input-otp').value.trim();
      if (!otp || otp.length !== 6) {
        showAuthError('6 अंकों का OTP डालें');
        return;
      }
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'जांच रहे हैं...';
      const result = await verifyPhoneOTP(phone, otp);
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'लॉगिन करें';
      if (!result.success) showAuthError(result.error);
    });

    // Email login form
    const emailLoginBtn = document.getElementById('btn-email-login');
    if (emailLoginBtn) emailLoginBtn.addEventListener('click', async () => {
      const email = document.getElementById('input-email').value.trim();
      const password = document.getElementById('input-password').value;
      emailLoginBtn.disabled = true;
      const result = await loginWithEmail(email, password);
      emailLoginBtn.disabled = false;
      if (!result.success) showAuthError(result.error);
    });

    // Guest mode
    const guestBtn = document.getElementById('btn-guest');
    if (guestBtn) guestBtn.addEventListener('click', continueAsGuest);

    // Close modal
    const closeBtn = document.getElementById('close-login-modal');
    if (closeBtn) closeBtn.addEventListener('click', hideLoginModal);

    // Tab switching (Phone / Email)
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.getElementById(`auth-${tab.dataset.panel}`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  function showAuthMessage(msg) {
    const el = document.getElementById('auth-message');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  // ============================================================
  // Public API
  // ============================================================
  return {
    init: () => {
      initSupabase();
      bindEvents();
      return getSession();
    },
    sendPhoneOTP,
    verifyPhoneOTP,
    loginWithEmail,
    logout,
    continueAsGuest,
    showLoginModal,
    getUser: () => currentUser,
    getRole: () => currentRole,
    isLoggedIn: () => !!currentUser,
    isAdmin: () => ['admin', 'clf'].includes(currentRole),
  };
})();
