// ==================== STUDENT AUTH (Matric + Password) ====================

let redirecting = false;

auth.onAuthStateChanged(async (user) => {
  if (!user || redirecting) return;
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists && doc.data().role === 'student') {
      redirecting = true;
      window.location.href = 'student.html';
    } else {
      await auth.signOut();
    }
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
    const snap = await db.collection('users')
      .where('matric', '==', matric)
      .where('role', '==', 'student')
      .limit(1)
      .get();

    if (snap.empty) {
      throw new Error('No account found with that matric number. Please register first.');
    }

    const email = snap.docs[0].data().email;
    await auth.signInWithEmailAndPassword(email, password);
    redirecting = true;
    window.location.href = 'student.html';

  } catch (err) {
    let msg = err.message;
    if (err.code === 'auth/wrong-password')    msg = 'Incorrect password. Please try again.';
    if (err.code === 'auth/too-many-requests') msg = 'Too many failed attempts. Try again later.';
    showLoginError(msg);
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
      throw new Error('An account with this matric number already exists. Please sign in.');
    }

    const cred = await auth.createUserWithEmailAndPassword(email, password);

    await db.collection('users').doc(cred.user.uid).set({
      name, matric, email, department, hostel,
      role: 'student',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    redirecting = true;
    window.location.href = 'student.html';

  } catch (err) {
    let msg = err.message;
    if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered. Please sign in.';
    if (err.code === 'auth/invalid-email')         msg = 'Please enter a valid email address.';
    showRegError(msg);
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
    ok.textContent = '✅ Reset link sent! Check your inbox (and spam folder). Return here to sign in.';
    ok.classList.remove('hidden');
    document.getElementById('resetEmail').value = '';
  } catch (e) {
    let msg = e.message;
    if (e.code === 'auth/user-not-found')  msg = 'No account found with that email address.';
    if (e.code === 'auth/invalid-email')   msg = 'Please enter a valid email address.';
    err.textContent = msg;
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Reset Link →';
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