// ==================== STAFF AUTH (Email + Password) ====================
// Shared by DSA and Warden login pages
// Safety: if user lands on login page, sign them out first
// This prevents redirect loops from stale sessions
auth.signOut();
// Redirect if already logged in
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (!doc.exists) return;
    const role = doc.data().role;
    if (role === 'dsa') window.location.href = 'dsa.html';
    else if (role === 'warden') window.location.href = 'warden.html';
  } catch(e) {}
});
