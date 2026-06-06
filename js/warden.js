// ==================== WARDEN DASHBOARD ====================

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'login-warden.html'; return; }
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      await db.collection('users').doc(user.uid).set({ name: user.email, email: user.email, role: 'warden', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      document.getElementById('wardenName').textContent = user.email;
    } else {
      document.getElementById('wardenName').textContent = userDoc.data().name;
    }
  } catch(err) { document.getElementById('wardenName').textContent = user.email || 'Warden'; }
});

const searchForm = document.getElementById('searchForm');
if (searchForm) {
  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = document.getElementById('studentSearch').value.trim().toLowerCase();
    if (!query) return;
    const resultContainer = document.getElementById('searchResult');
    resultContainer.innerHTML = '<p class="loading-text">Searching...</p>';
    try {
      const snapshot = await db.collection('exeatRequests').where('status', '==', 'approved').orderBy('createdAt', 'desc').get();
      const matches = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.studentName.toLowerCase().includes(query) || d.matric.toLowerCase().includes(query)) matches.push(d);
      });
      if (matches.length === 0) {
        resultContainer.innerHTML = `
          <div class="no-result">
            <div class="no-result-icon">🔍</div>
            <h3>No approved exeat found</h3>
            <p>No approved exeat for "<strong>${query}</strong>".<br/>The request may be pending, rejected, or doesn't exist.</p>
          </div>`;
        return;
      }
      resultContainer.innerHTML = '';
      matches.forEach(d => resultContainer.appendChild(createWardenCard(d)));
    } catch (err) {
      resultContainer.innerHTML = '<p class="error-text">Search failed: ' + err.message + '</p>';
    }
  });
}

function createWardenCard(data) {
  const card = document.createElement('div');
  card.className = 'warden-result-card';
  const isExpired = new Date(data.returnDate) < new Date();
  card.innerHTML = `
    <div class="result-header">
      <div class="approved-badge">✅ APPROVED EXEAT — CHRISLAND UNIVERSITY</div>
      ${isExpired ? '<div class="expired-badge">⚠️ EXPIRED</div>' : '<div class="valid-badge">🟢 VALID</div>'}
    </div>
    <div class="result-body">
      <div class="student-profile">
        <div class="avatar">${data.studentName.charAt(0).toUpperCase()}</div>
        <div>
          <h2>${data.studentName}</h2>
          <p>${data.matric} &bull; ${data.department}</p>
          <p>${data.hostel}</p>
        </div>
      </div>
      <div class="exeat-details">
        <div class="detail-item"><span class="detail-label">Destination</span><span class="detail-value">📍 ${data.destination}</span></div>
        <div class="detail-item"><span class="detail-label">Reason</span><span class="detail-value">${data.reason}</span></div>
        <div class="detail-item"><span class="detail-label">Departure Date</span><span class="detail-value">🗓 ${formatDate(data.departureDate)}</span></div>
        <div class="detail-item"><span class="detail-label">Return Date</span><span class="detail-value ${isExpired ? 'expired-text' : ''}">🗓 ${formatDate(data.returnDate)}${isExpired ? ' — EXPIRED' : ''}</span></div>
        <div class="detail-item"><span class="detail-label">Emergency Contact</span><span class="detail-value">👤 ${data.emergencyContact} — ${data.emergencyPhone}</span></div>
        <div class="detail-item"><span class="detail-label">Approved By</span><span class="detail-value">Dean of Student Affairs, Chrisland University</span></div>
        ${data.dsaComment ? `<div class="detail-item"><span class="detail-label">Note</span><span class="detail-value">${data.dsaComment}</span></div>` : ''}
      </div>
    </div>`;
  return card;
}

function logout() { auth.signOut().then(() => window.location.href = 'login-warden.html'); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('active'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('active'); }
function formatDate(d) { if (!d) return 'N/A'; return new Date(d).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' }); }
