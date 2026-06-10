// ==================== STUDENT AUTH (Matric + Password) ====================

let redirecting = false;

// Auth guard: only redirect if a valid student session already exists.
// Does NOT sign out other roles — that's handled at login time instead.
auth.onAuthStateChanged(async (user) => {
  if (!user || redirecting) return;
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists && doc.data().role === 'student') {
      redirecting = true;
      window.location.href = 'student.html';
    }
    // If role is not 'student', do nothing — let them stay on the login page
  } catch(e) {}
});

async function studentLogin() {
  const matric   = document.getElementById('loginMatric').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn      = document.getElementById('loginBtn');

  if (!matric || !password) {
    showLoginError('Please enter your matric number and password.'); return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    // Sign out any currently logged-in session first (e.g. DSA who wandered here)
    await auth.signOut();

    const snap = await db.collection('users')
      .where('matric', '==', matric)
      .where('role', '==', 'student')
      .limit(1)
      .get();

    if (snap.empty) {
      showLoginError('No student account found with that matric number. Please register first.');
      btn.disabled = false;
      btn.textContent = 'Sign In →';
      return;
    }

    const email = snap.docs[0].data().email;
    await auth.signInWithEmailAndPassword(email, password);
    redirecting = true;
    window.location.href = 'student.html';

  } catch (err) {
    showLoginError(friendlyAuthError(err));
    btn.disabled = false;
    btn.textContent = 'Sign In →';
  }
}

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
  btn.textContent = 'Creating account...';

  try {
    const existing = await db.collection('users')
      .where('matric', '==', matric)
      .limit(1)
      .get();

    if (!existing.empty) {
      showRegError('An account with this matric number already exists. Please sign in instead.');
      btn.disabled = false;
      btn.textContent = 'Create Account →';
      return;
    }

    const cred = await auth.createUserWithEmailAndPassword(email, password);

    // Write Firestore doc immediately — before onAuthStateChanged can react
    await db.collection('users').doc(cred.user.uid).set({
      name, matric, email, department, hostel,
      role: 'student',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Show success message briefly before redirecting
    showRegSuccess(`Welcome, ${name}! Your account has been created. Taking you to your dashboard…`);

    redirecting = true;
    setTimeout(() => { window.location.href = 'student.html'; }, 1800);

  } catch (err) {
    // If Firestore write failed after Auth account was created,
    // delete the orphaned Auth account so the user can try again cleanly
    if (auth.currentUser) {
      try { await auth.currentUser.delete(); } catch(_) {}
    }
    showRegError(friendlyAuthError(err));
    btn.disabled = false;
    btn.textContent = 'Create Account →';
  }
}

async function sendReset() {
  const email = document.getElementById('resetEmail').value.trim();
  const btn   = document.getElementById('resetBtn');
  const err   = document.getElementById('resetError');
  const ok    = document.getElementById('resetSuccess');

  err.classList.add('hidden');
  ok.classList.add('hidden');

  if (!email) {
    err.textContent = 'Please enter your email address.';
    err.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    await auth.sendPasswordResetEmail(email);
    ok.textContent = '✅ Reset link sent! Check your inbox (and spam folder), then come back here to sign in.';
    ok.classList.remove('hidden');
    document.getElementById('resetEmail').value = '';
  } catch (e) {
    err.textContent = friendlyAuthError(e);
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Reset Link →';
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
    case 'auth/email-already-in-use':
      return 'This email address is already registered. Please sign in instead.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact the university administrator.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

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
  setTimeout(() => el.classList.add('hidden'), 8000);
}

function showRegError(msg) {
  const el = document.getElementById('regError');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 8000);
}

function showRegSuccess(msg) {
  const errEl = document.getElementById('regError');

  // Use dedicated success element if it exists in HTML, otherwise create one
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