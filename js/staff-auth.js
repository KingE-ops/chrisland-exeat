// ==================== STAFF AUTH (Email + Password) ====================
// Shared by DSA and Warden login pages.
//
// NOTE: No onAuthStateChanged here intentionally.
// Login pages must NEVER auto-redirect — only dashboards perform auth guards.

// ---------------------------------------------------------------
// ISSUE 2 FIX — CLIENT-SIDE LOGIN THROTTLE
// Separate attempt counters for DSA and Warden.
// After MAX_ATTEMPTS failures, enforces a LOCKOUT_MS cooldown.
// ---------------------------------------------------------------
const STAFF_MAX_ATTEMPTS = 5;
const STAFF_LOCKOUT_MS   = 5 * 60 * 1000;

const throttle = {
  dsa:    { attempts: 0, lockoutUntil: 0 },
  warden: { attempts: 0, lockoutUntil: 0 }
};

function isLockedOut(role) {
  return Date.now() < throttle[role].lockoutUntil;
}

function recordFailedAttempt(role) {
  throttle[role].attempts++;
  if (throttle[role].attempts >= STAFF_MAX_ATTEMPTS) {
    throttle[role].lockoutUntil = Date.now() + STAFF_LOCKOUT_MS;
    throttle[role].attempts = 0;
  }
}

function resetAttempts(role) {
  throttle[role].attempts = 0;
  throttle[role].lockoutUntil = 0;
}

function lockoutMessage(role) {
  const remaining = Math.ceil((throttle[role].lockoutUntil - Date.now()) / 60000);
  return `Too many failed attempts. Please wait ${remaining} minute${remaining !== 1 ? 's' : ''} before trying again.`;
}

function remainingAttemptsMessage(role) {
  const left = STAFF_MAX_ATTEMPTS - throttle[role].attempts;
  return left > 0 ? ` ${left} attempt${left !== 1 ? 's' : ''} remaining before lockout.` : '';
}

// ---------------------------------------------------------------
// DSA LOGIN
// ---------------------------------------------------------------
async function dsaLogin() {
  const email    = document.getElementById('dsaEmail').value.trim();
  const password = document.getElementById('dsaPassword').value;
  const btn      = document.getElementById('dsaLoginBtn');
  const err      = document.getElementById('dsaError');

  err.classList.add('hidden');

  if (!email || !password) {
    err.textContent = 'Please enter your email and password.';
    err.classList.remove('hidden');
    return;
  }

  // Lockout check
  if (isLockedOut('dsa')) {
    err.textContent = lockoutMessage('dsa');
    err.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    await auth.signInWithEmailAndPassword(email, password);

    const user    = auth.currentUser;
    const userDoc = await db.collection('users').doc(user.uid).get();

    if (!userDoc.exists || userDoc.data().role !== 'dsa') {
      await auth.signOut();
      recordFailedAttempt('dsa');
      err.textContent = isLockedOut('dsa')
        ? lockoutMessage('dsa')
        : 'Access denied. This portal is for DSA staff only.' + remainingAttemptsMessage('dsa');
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign In →';
      return;
    }

    resetAttempts('dsa');
    window.location.href = 'dsa.html';

  } catch(e) {
    if (
      e.code === 'auth/wrong-password' ||
      e.code === 'auth/invalid-credential' ||
      e.code === 'auth/user-not-found'
    ) {
      recordFailedAttempt('dsa');
      err.textContent = isLockedOut('dsa')
        ? lockoutMessage('dsa')
        : 'Incorrect email or password.' + remainingAttemptsMessage('dsa');
    } else {
      err.textContent = friendlyAuthError(e);
    }
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Sign In →';
  }
}

// ---------------------------------------------------------------
// WARDEN LOGIN
// ---------------------------------------------------------------
async function wardenLogin() {
  const email    = document.getElementById('wardenEmail').value.trim();
  const password = document.getElementById('wardenPassword').value;
  const btn      = document.getElementById('wardenLoginBtn');
  const err      = document.getElementById('wardenError');

  err.classList.add('hidden');

  if (!email || !password) {
    err.textContent = 'Please enter your email and password.';
    err.classList.remove('hidden');
    return;
  }

  // Lockout check
  if (isLockedOut('warden')) {
    err.textContent = lockoutMessage('warden');
    err.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    await auth.signInWithEmailAndPassword(email, password);

    const user    = auth.currentUser;
    const userDoc = await db.collection('users').doc(user.uid).get();

    if (!userDoc.exists || userDoc.data().role !== 'warden') {
      await auth.signOut();
      recordFailedAttempt('warden');
      err.textContent = isLockedOut('warden')
        ? lockoutMessage('warden')
        : 'Access denied. This portal is for hostel wardens only.' + remainingAttemptsMessage('warden');
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign In →';
      return;
    }

    resetAttempts('warden');
    window.location.href = 'warden.html';

  } catch(e) {
    if (
      e.code === 'auth/wrong-password' ||
      e.code === 'auth/invalid-credential' ||
      e.code === 'auth/user-not-found'
    ) {
      recordFailedAttempt('warden');
      err.textContent = isLockedOut('warden')
        ? lockoutMessage('warden')
        : 'Incorrect email or password.' + remainingAttemptsMessage('warden');
    } else {
      err.textContent = friendlyAuthError(e);
    }
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Sign In →';
  }
}

// ---------------------------------------------------------------
// ERROR MESSAGES
// ---------------------------------------------------------------
function friendlyAuthError(e) {
  switch(e.code) {
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password. Please try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact the university administrator.';
    default:
      return 'Something went wrong. Please try again.';
  }
}