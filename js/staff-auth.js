// ==================== STAFF AUTH (Email + Password) ====================
// Shared by DSA and Warden login pages

let redirecting = false;

auth.onAuthStateChanged(async (user) => {
  if (!user || redirecting) return;
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists) return;
    const role = doc.data().role;
    if (role === 'dsa') {
      redirecting = true;
      window.location.href = 'dsa.html';
    } else if (role === 'warden') {
      redirecting = true;
      window.location.href = 'warden.html';
    } else {
      await auth.signOut();
    }
  } catch(e) {}
});

async function dsaLogin() {
  const email    = document.getElementById('dsaEmail').value.trim();
  const password = document.getElementById('dsaPassword').value;
  const btn      = document.getElementById('dsaLoginBtn');
  const err      = document.getElementById('dsaError');

  err.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    await auth.signInWithEmailAndPassword(email, password);
    const user = auth.currentUser;
    const doc  = await db.collection('users').doc(user.uid).get();
    if (!doc.exists || doc.data().role !== 'dsa') {
      await auth.signOut();
      throw new Error('This account does not have DSA access.');
    }
    redirecting = true;
    window.location.href = 'dsa.html';
  } catch(e) {
    const msgs = {
      'auth/user-not-found':     'No account found with this email.',
      'auth/wrong-password':     'Incorrect password.',
      'auth/invalid-email':      'Invalid email address.',
      'auth/invalid-credential': 'Invalid email or password.'
    };
    err.textContent = msgs[e.code] || e.message;
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
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    await auth.signInWithEmailAndPassword(email, password);
    const user = auth.currentUser;
    const doc  = await db.collection('users').doc(user.uid).get();
    if (!doc.exists || doc.data().role !== 'warden') {
      await auth.signOut();
      throw new Error('This account does not have warden access.');
    }
    redirecting = true;
    window.location.href = 'warden.html';
  } catch(e) {
    const msgs = {
      'auth/user-not-found':     'No account found with this email.',
      'auth/wrong-password':     'Incorrect password.',
      'auth/invalid-email':      'Invalid email address.',
      'auth/invalid-credential': 'Invalid email or password.'
    };
    err.textContent = msgs[e.code] || e.message;
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Sign In →';
  }
}