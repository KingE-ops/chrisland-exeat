// ==================== STAFF AUTH (Email + Password) ====================
// Shared by DSA and Warden login pages

// NOTE: No onAuthStateChanged here intentionally.
// Login pages must NEVER auto-redirect — only dashboards perform auth guards.
// If a student, DSA, or warden lands on this page, they must always log in manually.
// This prevents cross-role auto-login (e.g. a logged-in student being pushed into DSA dashboard).

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

  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    // Sign out any currently logged-in user first (e.g. a student who wandered here)
    await auth.signOut();

    await auth.signInWithEmailAndPassword(email, password);
    const user = auth.currentUser;
    const doc  = await db.collection('users').doc(user.uid).get();

    if (!doc.exists || doc.data().role !== 'dsa') {
      await auth.signOut();
      err.textContent = 'Access denied. This portal is for DSA staff only.';
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign In →';
      return;
    }

    window.location.href = 'dsa.html';

  } catch(e) {
    err.textContent = friendlyAuthError(e);
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Sign In →';
  }
}

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

  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    // Sign out any currently logged-in user first (e.g. a student who wandered here)
    await auth.signOut();

    await auth.signInWithEmailAndPassword(email, password);
    const user = auth.currentUser;
    const doc  = await db.collection('users').doc(user.uid).get();

    if (!doc.exists || doc.data().role !== 'warden') {
      await auth.signOut();
      err.textContent = 'Access denied. This portal is for hostel wardens only.';
      err.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign In →';
      return;
    }

    window.location.href = 'warden.html';

  } catch(e) {
    err.textContent = friendlyAuthError(e);
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Sign In →';
  }
}

// Converts Firebase auth errors into plain, user-friendly messages.
// No Firebase codes or technical jargon ever shown to the user.
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