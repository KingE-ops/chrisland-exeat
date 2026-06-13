// ==================== STUDENT AUTH (Matric + Password) ====================

let redirecting = false;

// ---------------------------------------------------------------
// MATRIC WHITELIST
// allowedMatrics/{swe-2024-007} → { used: false }
// ---------------------------------------------------------------
function toDocId(matric) {
  return matric.trim().toLowerCase().replace(/\//g, '-');
}

async function isMatricAllowed(matric) {
  const doc = await db.collection('allowedMatrics').doc(toDocId(matric)).get();
  return doc.exists && doc.data().used !== true;
}

async function markMatricAsUsed(matric) {
  await db.collection('allowedMatrics').doc(toDocId(matric)).update({ used: true });
}

// ---------------------------------------------------------------
// BRUTE FORCE THROTTLE
// ---------------------------------------------------------------
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 5 * 60 * 1000;

let loginAttempts = 0;
let lockoutUntil  = 0;

function isLockedOut() { return Date.now() < lockoutUntil; }

function recordFailedAttempt() {
  loginAttempts++;
  if (loginAttempts >= MAX_ATTEMPTS) {
    lockoutUntil  = Date.now() + LOCKOUT_MS;
    loginAttempts = 0;
  }
}

function resetAttempts() { loginAttempts = 0; lockoutUntil = 0; }

function lockoutMessage() {
  const remaining = Math.ceil((lockoutUntil - Date.now()) / 60000);
  return `Too many failed attempts. Please wait ${remaining} minute${remaining !== 1 ? 's' : ''} before trying again.`;
}

// ---------------------------------------------------------------
// AUTH GUARD
// Runs on the login page — if already logged in as student, skip to dashboard
// ---------------------------------------------------------------
auth.onAuthStateChanged(async (user) => {
  if (!user || redirecting) return;
  if (!user.emailVerified) return; // unverified — stay on login page
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists && doc.data().role === 'student') {
      redirecting = true;
      window.location.href = 'student.html';
    }
  } catch(e) {}
});

// ---------------------------------------------------------------
// LOGIN
// Flow: matric → lookup matricIndex (public) → get email →
//       signInWithEmailAndPassword → check emailVerified → dashboard
//
// WHY matricIndex?
// The users collection now requires auth to read (security fix).
// But we need to look up a student's email by matric BEFORE signing
// them in. matricIndex is a separate public collection containing
// only { email } per matric — no sensitive data exposed.
// ---------------------------------------------------------------
async function studentLogin() {
  const matric   = document.getElementById('loginMatric').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn      = document.getElementById('loginBtn');

  if (!matric || !password) {
    showLoginError('Please enter your matric number and password.'); return;
  }
  if (isLockedOut()) {
    showLoginError(lockoutMessage()); return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    await auth.signOut();

    // ── Lookup email from public matricIndex ─────────────────────
    const indexDoc = await db.collection('matricIndex').doc(toDocId(matric)).get();

    if (!indexDoc.exists) {
      recordFailedAttempt();
      showLoginError(
        isLockedOut()
          ? lockoutMessage()
          : 'No student account found with that matric number. Please register first.'
      );
      btn.disabled = false; btn.textContent = 'Sign In →'; return;
    }

    const email = indexDoc.data().email;

    try {
      await auth.signInWithEmailAndPassword(email, password);

      // ── Email verification gate ──────────────────────────────
      if (!auth.currentUser.emailVerified) {
        await auth.signOut();
        const errEl = document.getElementById('loginError');
        errEl.innerHTML = '📧 Please verify your email before signing in. Check your inbox. ' +
          '<span class="toggle-link" style="cursor:pointer;text-decoration:underline;" ' +
          `onclick="resendVerification('${email}', this)">Resend verification email.</span>`;
        errEl.classList.remove('hidden');
        setTimeout(() => errEl.classList.add('hidden'), 15000);
        btn.disabled = false; btn.textContent = 'Sign In →'; return;
      }

      resetAttempts();
      redirecting = true;
      window.location.href = 'student.html';

    } catch (authErr) {
      if (
        authErr.code === 'auth/wrong-password' ||
        authErr.code === 'auth/invalid-credential'
      ) {
        recordFailedAttempt();
        const remaining = MAX_ATTEMPTS - loginAttempts;
        showLoginError(
          isLockedOut()
            ? lockoutMessage()
            : `Incorrect password. ${remaining > 0 ? `${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.` : ''}`
        );
      } else {
        showLoginError(friendlyAuthError(authErr));
      }
      btn.disabled = false; btn.textContent = 'Sign In →';
    }

  } catch (err) {
    showLoginError(friendlyAuthError(err));
    btn.disabled = false; btn.textContent = 'Sign In →';
  }
}

// ---------------------------------------------------------------
// RESEND VERIFICATION EMAIL
// ---------------------------------------------------------------
async function resendVerification(email, linkEl) {
  try {
    // Sign in temporarily to get the user object, then send verification
    const cred = await auth.signInWithEmailAndPassword(
      email,
      prompt('Enter your password to resend the verification email:') || ''
    );
    await cred.user.sendEmailVerification();
    await auth.signOut();
    if (linkEl) linkEl.textContent = '✅ Sent! Check your inbox.';
  } catch(e) {
    showLoginError('Could not resend. Please try again in a few minutes.');
  }
}

// ---------------------------------------------------------------
// REGISTER
// After creating account, writes to BOTH users and matricIndex
// ---------------------------------------------------------------
async function registerStudent() {
  const name            = document.getElementById('regName').value.trim();
  const matric          = document.getElementById('regMatric').value.trim();
  const email           = document.getElementById('regEmail').value.trim();
  const department      = document.getElementById('regDepartment').value.trim();
  const hostel          = document.getElementById('regHostel').value.trim();
  const password        = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const btn             = document.getElementById('regBtn');

  if (!name || !matric || !email || !department || !hostel || !password) {
    showRegError('Please fill in all fields.'); return;
  }
  if (password.length < 6) {
    showRegError('Password must be at least 6 characters.'); return;
  }
  if (password !== confirmPassword) {
    showRegError('Passwords do not match.'); return;
  }

  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    // ── STEP 1: Whitelist check ──────────────────────────────────
    const allowed = await isMatricAllowed(matric);
    if (!allowed) {
      showRegError(
        'This matric number is not on the approved student list, or has already been used to register. ' +
        'Please contact the ICT office if you believe this is an error.'
      );
      btn.disabled = false; btn.textContent = 'Create Account →'; return;
    }

    // ── STEP 2: Duplicate check ──────────────────────────────────
    const indexDoc = await db.collection('matricIndex').doc(toDocId(matric)).get();
    if (indexDoc.exists) {
      showRegError('An account with this matric number already exists. Please sign in instead.');
      btn.disabled = false; btn.textContent = 'Create Account →'; return;
    }

    btn.textContent = 'Creating account...';

    // ── STEP 3: Create Firebase Auth account ─────────────────────
    const cred = await auth.createUserWithEmailAndPassword(email, password);

    // ── STEP 4: Write Firestore profile ──────────────────────────
    await db.collection('users').doc(cred.user.uid).set({
      name, matric, email, department, hostel,
      role: 'student',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // ── STEP 5: Write matricIndex entry (public lookup) ──────────
    // Only stores email — no sensitive data
    await db.collection('matricIndex').doc(toDocId(matric)).set({
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // ── STEP 6: Send verification email ──────────────────────────
    await cred.user.sendEmailVerification();

    // ── STEP 7: Mark matric as used in whitelist ─────────────────
    await markMatricAsUsed(matric);

    // ── STEP 8: Sign out — must verify email first ───────────────
    await auth.signOut();
    redirecting = false;

    showRegSuccess(
      `✅ Account created! A verification link has been sent to ${email}. ` +
      `Please check your inbox (and spam folder), click the link, then come back here to sign in.`
    );
    setTimeout(() => { showLogin(); }, 5000);

  } catch (err) {
    if (auth.currentUser) {
      try { await auth.currentUser.delete(); } catch(_) {}
    }
    showRegError(friendlyAuthError(err));
    btn.disabled = false; btn.textContent = 'Create Account →';
  }
}

// ---------------------------------------------------------------
// PASSWORD RESET
// ---------------------------------------------------------------
async function sendReset() {
  const email = document.getElementById('resetEmail').value.trim();
  const btn   = document.getElementById('resetBtn');
  const err   = document.getElementById('resetError');
  const ok    = document.getElementById('resetSuccess');

  err.classList.add('hidden');
  ok.classList.add('hidden');

  if (!email) {
    err.textContent = 'Please enter your email address.';
    err.classList.remove('hidden'); return;
  }

  btn.disabled = true; btn.textContent = 'Sending...';

  try {
    await auth.sendPasswordResetEmail(email);
    ok.textContent = '✅ Reset link sent! Check your inbox (and spam folder), then come back here to sign in.';
    ok.classList.remove('hidden');
    document.getElementById('resetEmail').value = '';
  } catch (e) {
    err.textContent = friendlyAuthError(e);
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Send Reset Link →';
  }
}

// ---------------------------------------------------------------
// ERROR MESSAGES
// ---------------------------------------------------------------
function friendlyAuthError(e) {
  switch(e.code) {
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':       return 'Incorrect email or password. Please try again.';
    case 'auth/invalid-email':        return 'Please enter a valid email address.';
    case 'auth/email-already-in-use': return 'This email address is already registered. Please sign in instead.';
    case 'auth/too-many-requests':    return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed': return 'Network error. Please check your internet connection and try again.';
    case 'auth/weak-password':        return 'Password must be at least 6 characters.';
    case 'auth/user-disabled':        return 'This account has been disabled. Please contact the university administrator.';
    default:                          return 'Something went wrong. Please try again.';
  }
}

// ---------------------------------------------------------------
// UI HELPERS
// ---------------------------------------------------------------
function showLogin() {
  document.getElementById('registerSection').classList.add('hidden');
  document.getElementById('resetSection').classList.add('hidden');
  document.getElementById('loginSection').classList.remove('hidden');
}
function showRegister() {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('resetSection').classList.add('hidden');
  document.getElementById('registerSection').classList.remove('hidden');
}
function showReset() {
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('registerSection').classList.add('hidden');
  document.getElementById('resetSection').classList.remove('hidden');
}
function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 12000);
}
function showRegError(msg) {
  const el = document.getElementById('regError');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 10000);
}
function showRegSuccess(msg) {
  const errEl = document.getElementById('regError');
  let el = document.getElementById('regSuccess');
  if (!el) {
    el = document.createElement('div');
    el.id = 'regSuccess';
    el.className = 'alert alert-success';
    errEl.insertAdjacentElement('afterend', el);
  }
  errEl.classList.add('hidden');
  el.textContent = msg;
  el.classList.remove('hidden');
}