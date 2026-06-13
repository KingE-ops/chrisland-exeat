// ==================== WARDEN DASHBOARD ====================

function revealDashboard() {
  document.body.style.visibility = 'visible';
}

// ---------------------------------------------------------------
// AUTH GUARD
// ---------------------------------------------------------------
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'login-warden.html'; return; }
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'warden') {
      // Don't signOut here — it triggers onAuthStateChanged again with null
      // causing a redirect loop. Just redirect directly.
      window.location.href = 'login-warden.html';
      return;
    }
    revealDashboard();
    document.getElementById('wardenName').textContent = userDoc.data().name;
  } catch(err) {
    // Don't signOut in catch either — same loop risk
    window.location.href = 'login-warden.html';
  }
});

// ---------------------------------------------------------------
// VERIFY BY PASS ID
// ---------------------------------------------------------------
const passIdForm = document.getElementById('passIdForm');
if (passIdForm) {
  passIdForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawInput = document.getElementById('passIdInput').value.trim().toUpperCase();
    if (!rawInput) return;

    const resultContainer = document.getElementById('passIdResult');
    resultContainer.innerHTML = '<p class="loading-text">Verifying pass, please wait...</p>';

    try {
      const snapshot = await db.collection('exeatRequests')
        .where('passId', '==', rawInput)
        .limit(1)
        .get();

      if (snapshot.empty) {
        showFailCard(resultContainer, rawInput, 'No valid exeat pass was found for this ID. It may be fraudulent, cancelled, or entered incorrectly.');
        return;
      }

      const data = snapshot.docs[0].data();

      // REVOCATION CHECK — hard block, same as not found
      if (data.status === 'revoked') {
        showFailCard(resultContainer, rawInput,
          'This exeat pass has been <strong>REVOKED</strong> by the Dean of Student Affairs. ' +
          'The student is not permitted to leave the hostel. Do not grant exit.'
        );
        return;
      }

      resultContainer.innerHTML = '';
      resultContainer.appendChild(createWardenCard(data));

    } catch (err) {
      resultContainer.innerHTML = '<p class="error-text">Verification failed. Please check your connection and try again.</p>';
    }
  });
}

// ---------------------------------------------------------------
// FAIL CARD — used for not found AND revoked
// ---------------------------------------------------------------
function showFailCard(container, passId, message) {
  container.innerHTML = `
    <div class="warden-result-card" style="border-color:var(--danger);">
      <div style="background:linear-gradient(90deg,#b91c1c,#dc2626); padding:14px 20px; display:flex; justify-content:space-between; align-items:center;">
        <span style="color:white; font-weight:800; font-size:0.88rem; letter-spacing:0.04em;">❌ PASS VERIFICATION FAILED</span>
        <button onclick="document.getElementById('passIdResult').innerHTML=''"
          style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); color:white; border-radius:6px; padding:4px 12px; font-size:0.78rem; font-weight:700; cursor:pointer;">✕ Close</button>
      </div>
      <div style="padding:24px;">
        <p style="font-size:0.9rem; color:var(--text); line-height:1.7;">
          Pass ID: <strong style="font-family:'DM Mono',monospace; color:var(--danger);">${passId}</strong><br/><br/>
          ${message}<br/><br/>
          <strong style="color:var(--danger);">Do not grant exit without a valid verified pass.</strong>
        </p>
      </div>
    </div>`;
}

// ---------------------------------------------------------------
// WARDEN CARD
// ---------------------------------------------------------------
function createWardenCard(data) {
  const card = document.createElement('div');
  card.className = 'warden-result-card';

  const today      = new Date(); today.setHours(0, 0, 0, 0);
  const returnDate = new Date(data.returnDate); returnDate.setHours(0, 0, 0, 0);
  const departure  = new Date(data.departureDate); departure.setHours(0, 0, 0, 0);
  const isExpired  = returnDate < today;
  const notStarted = departure > today;

  // EXPIRY — if expired, show a hard warning banner instead of the green one
  const verifyBanner = isExpired
    ? `<div style="background:linear-gradient(90deg,#92400e,#b45309); padding:18px 20px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div style="display:flex; gap:14px; align-items:flex-start;">
          <span style="font-size:1.6rem; flex-shrink:0;">⚠️</span>
          <div>
            <p style="color:white; font-weight:800; font-size:0.95rem; margin-bottom:4px;">Pass EXPIRED — Return Date Has Passed</p>
            <p style="color:rgba(255,255,255,0.85); font-size:0.8rem; line-height:1.6; margin:0;">
              This exeat pass is no longer valid. The student's permitted return date was <strong>${formatDate(data.returnDate)}</strong>.
              Do not grant re-entry or exit on this pass.
            </p>
          </div>
        </div>
        <button onclick="document.getElementById('passIdResult').innerHTML=''"
          style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); color:white; border-radius:6px; padding:5px 14px; font-size:0.78rem; font-weight:700; cursor:pointer; white-space:nowrap; flex-shrink:0;">✕ Close</button>
      </div>`
    : `<div style="background:linear-gradient(135deg,#064e3b,#065f46); padding:18px 20px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div style="display:flex; gap:14px; align-items:flex-start;">
          <span style="font-size:1.6rem; flex-shrink:0;">✅</span>
          <div>
            <p style="color:white; font-weight:800; font-size:0.95rem; margin-bottom:4px; letter-spacing:0.01em;">Pass Verified — Authentic Exeat</p>
            <p style="color:rgba(255,255,255,0.78); font-size:0.8rem; line-height:1.6; margin:0;">
              This exeat pass has been duly issued and approved by the Dean of Student Affairs, Chrisland University.
            </p>
          </div>
        </div>
        <button onclick="document.getElementById('passIdResult').innerHTML=''"
          style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); color:white; border-radius:6px; padding:5px 14px; font-size:0.78rem; font-weight:700; cursor:pointer; white-space:nowrap; flex-shrink:0;">✕ Close</button>
      </div>`;

  let statusBadge = '';
  if (isExpired) {
    statusBadge = '<div class="expired-badge" style="background:#fef3c7;color:#92400e;border:1.5px solid #f59e0b;padding:6px 14px;border-radius:6px;font-size:0.78rem;font-weight:800;">⚠️ EXPIRED — Return date has passed. Pass is no longer valid.</div>';
  } else if (notStarted) {
    statusBadge = '<div class="upcoming-badge" style="background:var(--pending-bg);color:#92400e;padding:4px 10px;border-radius:20px;font-size:0.74rem;font-weight:800;">🕐 UPCOMING — Leave not yet commenced</div>';
  } else {
    statusBadge = '<div class="valid-badge">🟢 VALID — Currently active</div>';
  }

  card.innerHTML = `
    ${verifyBanner}
    <div class="result-header">
      <div class="${isExpired ? 'expired-badge' : 'approved-badge'}">${isExpired ? '⚠️ EXPIRED EXEAT — CHRISLAND UNIVERSITY' : '✅ APPROVED EXEAT — CHRISLAND UNIVERSITY'}</div>
      ${statusBadge}
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
        ${data.passId ? `
        <div class="detail-item highlight">
          <span class="detail-label">Pass ID</span>
          <span class="detail-value" style="font-family:'DM Mono',monospace; color:var(--purple); font-weight:700;">${data.passId}</span>
        </div>` : ''}
        <div class="detail-item"><span class="detail-label">Destination</span><span class="detail-value">📍 ${data.destination}</span></div>
        <div class="detail-item"><span class="detail-label">Reason for Leave</span><span class="detail-value">${data.reason}</span></div>
        <div class="detail-item"><span class="detail-label">Departure Date</span><span class="detail-value">🗓 ${formatDate(data.departureDate)}</span></div>
        <div class="detail-item">
          <span class="detail-label">Return Date</span>
          <span class="detail-value ${isExpired ? 'expired-text' : ''}">🗓 ${formatDate(data.returnDate)}${isExpired ? ' — EXPIRED' : ''}</span>
        </div>
        <div class="detail-item"><span class="detail-label">Emergency Contact</span><span class="detail-value">👤 ${data.emergencyContact} — ${data.emergencyPhone}</span></div>
        <div class="detail-item"><span class="detail-label">Authorised By</span><span class="detail-value">Dean of Student Affairs, Chrisland University</span></div>
        ${data.dsaComment ? `<div class="detail-item"><span class="detail-label">DSA Remarks</span><span class="detail-value">${data.dsaComment}</span></div>` : ''}
      </div>
    </div>`;

  return card;
}

// ---------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------
function logout() { auth.signOut().then(() => window.location.href = 'login-warden.html'); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('active'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('active'); }
function formatDate(d) { if (!d) return 'N/A'; return new Date(d).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' }); }
function showToast(msg, type='info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.className = `toast ${type} show`;
  setTimeout(() => t.className = 'toast', 3500);
}