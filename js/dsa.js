// ==================== DSA DASHBOARD ====================

const EMAILJS_PUBLIC_KEY  = 'ezWjHBAXQcsbK50cL';
const EMAILJS_SERVICE_ID  = 'service_6sr6s4y';
const EMAILJS_TEMPLATE_ID = 'template_5693fnr';

let currentDSA      = null;
let pendingAction   = null;
let pendingListener = null;
let emailJSReady    = false;

function revealDashboard() {
  document.body.style.visibility = 'visible';
}

function loadEmailJS() {
  if (emailJSReady) return;
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
  script.onload = () => { emailjs.init(EMAILJS_PUBLIC_KEY); emailJSReady = true; };
  document.head.appendChild(script);
}

// ---------------------------------------------------------------
// AUTH GUARD
// ---------------------------------------------------------------
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'login-dsa.html'; return; }
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'dsa') {
      window.location.href = 'login-dsa.html';
      return;
    }
    revealDashboard();
    currentDSA = { uid: user.uid, ...userDoc.data() };
    document.getElementById('dsaName').textContent = currentDSA.name;
    loadRequests('pending');
    loadStats();
    startPendingBadge();
    loadEmailJS();
  } catch(err) {
    window.location.href = 'login-dsa.html';
  }
});

// ---------------------------------------------------------------
// GENERATE UNIQUE PASS ID
// ---------------------------------------------------------------
function generatePassId() {
  const year  = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `EX-${year}-${code}`;
}

// ---------------------------------------------------------------
// SEND EMAIL
// ---------------------------------------------------------------
async function sendExeatEmail(studentEmail, studentName, status, data, comment) {
  if (!emailJSReady) { console.warn('EmailJS not ready'); return; }
  const statusLabels = { approved: 'Approved ✅', rejected: 'Rejected ❌', revoked: 'Revoked 🚫' };
  const messages = {
    approved: `We are pleased to inform you that your exeat request has been approved by the Dean of Student Affairs. Please download your exeat pass from the student portal and present it to the hostel warden when leaving.`,
    rejected: `We regret to inform you that your exeat request has been rejected by the Dean of Student Affairs. ${comment ? 'Please see the DSA comment below for more details.' : 'Please contact the DSA office for further information.'}`,
    revoked:  `We regret to inform you that your previously approved exeat pass has been revoked by the Dean of Student Affairs. ${comment ? 'Please see the DSA comment below.' : 'Please contact the DSA office for further information.'} Your pass is no longer valid.`
  };
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email:       studentEmail,
      student_name:   studentName,
      status:         statusLabels[status] || status,
      message:        messages[status] || '',
      destination:    data.destination,
      departure_date: formatDate(data.departureDate),
      return_date:    formatDate(data.returnDate),
      // Plain text — the EmailJS template wraps it in its own styled <p> tag
      dsa_comment:    comment ? `DSA Comment: ${comment}` : '',
      pass_id:        data.passId || ''
    });
  } catch(e) { console.error('EmailJS error:', e); }
}

// ---------------------------------------------------------------
// LIVE PENDING BADGE
// ---------------------------------------------------------------
function startPendingBadge() {
  if (pendingListener) pendingListener();
  pendingListener = db.collection('exeatRequests')
    .where('status', '==', 'pending')
    .onSnapshot(snap => {
      const count = snap.size;
      document.title = count > 0 ? `(${count}) DSA Portal — Chrisland` : 'DSA Portal — Chrisland';
      const badge = document.getElementById('pendingBadge');
      if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-flex' : 'none'; }
    });
}

// ---------------------------------------------------------------
// LOAD REQUESTS
// ---------------------------------------------------------------
async function loadRequests(status = 'pending') {
  const container = document.getElementById('requestsContainer');
  container.innerHTML = '<p class="loading-text">Loading...</p>';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const activeTab = document.querySelector(`[data-status="${status}"]`);
  if (activeTab) activeTab.classList.add('active');

  const fromDate = document.getElementById('filterFrom')?.value;
  const toDate   = document.getElementById('filterTo')?.value;

  try {
    let query = db.collection('exeatRequests').orderBy('createdAt', 'desc');
    if (status !== 'all') query = query.where('status', '==', status);
    const snapshot = await query.get();

    let docs = [];
    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));

    if (fromDate) {
      const from = new Date(fromDate);
      docs = docs.filter(d => d.departureDate && new Date(d.departureDate) >= from);
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59);
      docs = docs.filter(d => d.departureDate && new Date(d.departureDate) <= to);
    }

    if (docs.length === 0) {
      container.innerHTML = `<p class="empty-text">No ${status === 'all' ? '' : status} requests found.</p>`;
      return;
    }
    container.innerHTML = '';
    docs.forEach(d => container.appendChild(createDSACard(d.id, d)));
  } catch (err) {
    container.innerHTML = '<p class="error-text">Unable to load requests. Please refresh the page.</p>';
  }
}

function applyFilters() {
  const activeTab = document.querySelector('.tab-btn.active');
  loadRequests(activeTab?.dataset.status || 'pending');
}
function clearFilters() {
  document.getElementById('filterFrom').value = '';
  document.getElementById('filterTo').value = '';
  applyFilters();
}

// ---------------------------------------------------------------
// REQUEST CARD
// ---------------------------------------------------------------
function createDSACard(docId, data) {
  const card = document.createElement('div');
  card.className = `dsa-card status-${data.status}`;
  const statusLabels = {
    pending:   '⏳ Pending',
    approved:  '✅ Approved',
    rejected:  '❌ Rejected',
    cancelled: '🚫 Cancelled',
    revoked:   '🔴 Revoked'   // REVOCATION — new status label
  };
  card.innerHTML = `
    <div class="card-header">
      <div>
        <div class="student-name">${data.studentName}</div>
        <div class="student-meta">${data.matric} &bull; ${data.department} &bull; ${data.hostel}</div>
      </div>
      <span class="status-badge ${data.status}">${statusLabels[data.status] || data.status}</span>
    </div>
    <div class="card-body">
      <div class="info-grid">
        <div><strong>Destination</strong><p>📍 ${data.destination}</p></div>
        <div><strong>Reason</strong><p>${data.reason}</p></div>
        <div><strong>Departure</strong><p>${formatDate(data.departureDate)}</p></div>
        <div><strong>Return</strong><p>${formatDate(data.returnDate)}</p></div>
        <div><strong>Emergency Contact</strong><p>${data.emergencyContact}</p></div>
        <div><strong>Phone</strong><p>${data.emergencyPhone}</p></div>
        ${data.passId ? `<div><strong>Pass ID</strong><p style="font-family:monospace;color:#4B0082;font-weight:700">${data.passId}</p></div>` : ''}
      </div>
      ${data.dsaComment ? `<div class="existing-comment">💬 <strong>Comment:</strong> ${data.dsaComment}</div>` : ''}
      ${data.revokedAt ? `<div class="existing-comment" style="color:#b91c1c;">🔴 <strong>Revoked:</strong> ${formatTimestamp(data.revokedAt)}</div>` : ''}
    </div>

    ${data.status === 'pending' ? `
    <div class="card-actions">
      <textarea id="comment-${docId}" class="comment-input" placeholder="Optional comment to student..."></textarea>
      <div class="action-buttons">
        <button class="btn-approve" onclick="confirmAction('${docId}', 'approved')">✅ Approve</button>
        <button class="btn-reject"  onclick="confirmAction('${docId}', 'rejected')">❌ Reject</button>
      </div>
    </div>` : ''}

    ${data.status === 'approved' ? `
    <div class="card-actions">
      <textarea id="revoke-comment-${docId}" class="comment-input" placeholder="Reason for revoking this pass (recommended)..."></textarea>
      <div class="action-buttons">
        <button class="btn-reject" onclick="confirmRevoke('${docId}')">🔴 Revoke Pass</button>
      </div>
    </div>` : ''}

    <div class="card-footer">
      <span class="card-date">Submitted: ${data.createdAt ? formatTimestamp(data.createdAt) : 'N/A'}</span>
    </div>`;
  return card;
}

// ---------------------------------------------------------------
// APPROVE / REJECT MODAL
// ---------------------------------------------------------------
function confirmAction(docId, status) {
  pendingAction = { docId, status, type: 'decision' };
  const modal      = document.getElementById('confirmModal');
  const icon       = document.getElementById('modalIcon');
  const title      = document.getElementById('modalTitle');
  const msg        = document.getElementById('modalMsg');
  const confirmBtn = document.getElementById('modalConfirmBtn');
  if (status === 'approved') {
    icon.textContent       = '✅';
    title.textContent      = 'Approve Exeat?';
    msg.textContent        = "This will approve the student's exeat request and generate a unique Pass ID. They will be notified by email.";
    confirmBtn.className   = 'modal-btn-confirm-approve';
    confirmBtn.textContent = 'Yes, Approve';
  } else {
    icon.textContent       = '❌';
    title.textContent      = 'Reject Exeat?';
    msg.textContent        = "This will reject the student's exeat request. They will be notified by email.";
    confirmBtn.className   = 'modal-btn-confirm-reject';
    confirmBtn.textContent = 'Yes, Reject';
  }
  modal.classList.remove('hidden');
}

// ---------------------------------------------------------------
// REVOKE MODAL
// ---------------------------------------------------------------
function confirmRevoke(docId) {
  pendingAction = { docId, status: 'revoked', type: 'revoke' };
  const modal      = document.getElementById('confirmModal');
  const icon       = document.getElementById('modalIcon');
  const title      = document.getElementById('modalTitle');
  const msg        = document.getElementById('modalMsg');
  const confirmBtn = document.getElementById('modalConfirmBtn');
  icon.textContent       = '🔴';
  title.textContent      = 'Revoke This Pass?';
  msg.textContent        = "This will permanently revoke the student's approved exeat pass. The pass will be rejected at the warden gate and the student will be notified by email. This cannot be undone.";
  confirmBtn.className   = 'modal-btn-confirm-reject';
  confirmBtn.textContent = 'Yes, Revoke Pass';
  modal.classList.remove('hidden');
}

function closeModal() { document.getElementById('confirmModal').classList.add('hidden'); pendingAction = null; }

async function executeAction() {
  if (!pendingAction) return;
  const { docId, status, type } = pendingAction;

  // Get comment from the right textarea
  const commentEl = type === 'revoke'
    ? document.getElementById(`revoke-comment-${docId}`)
    : document.getElementById(`comment-${docId}`);
  const comment = commentEl?.value.trim() || '';

  // Show loading state on confirm button — keep modal open so user sees spinner
  const confirmBtn   = document.getElementById('modalConfirmBtn');
  const cancelBtn    = document.getElementById('modalCancelBtn') || document.querySelector('.modal-btn-cancel');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><span class="btn-spinner"></span> Processing…</span>';
  if (cancelBtn) cancelBtn.disabled = true;

  try {
    const passId = status === 'approved' ? generatePassId() : null;

    const updateData = {
      status,
      dsaComment: comment,
      updatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
      reviewedBy: 'Dean of Student Affairs',
      reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (passId)            updateData.passId    = passId;
    if (status === 'revoked') updateData.revokedAt = firebase.firestore.FieldValue.serverTimestamp();

    await db.collection('exeatRequests').doc(docId).update(updateData);

    // Send email notification
    const requestDoc  = await db.collection('exeatRequests').doc(docId).get();
    const requestData = requestDoc.data();
    const studentSnap = await db.collection('users').where('matric', '==', requestData.matric).limit(1).get();
    if (!studentSnap.empty) {
      await sendExeatEmail(
        studentSnap.docs[0].data().email,
        studentSnap.docs[0].data().name,
        status, requestData, comment
      );
    }

    const toastMsg = {
      approved: `Request approved. Pass ID: ${passId}`,
      rejected: 'Request rejected.',
      revoked:  '🔴 Pass revoked. Student has been notified by email.'
    };
    showToast(toastMsg[status] || 'Done.', status === 'approved' ? 'success' : 'error');

    loadRequests(status === 'revoked' ? 'approved' : 'pending');
    loadStats();

  } catch (err) {
    showToast('Something went wrong. Please try again.', 'error');
  } finally {
    closeModal();
    confirmBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
  }
}

// ---------------------------------------------------------------
// STATS — includes revoked count
// ---------------------------------------------------------------
async function loadStats() {
  try {
    const [p, a, r, v] = await Promise.all([
      db.collection('exeatRequests').where('status','==','pending').get(),
      db.collection('exeatRequests').where('status','==','approved').get(),
      db.collection('exeatRequests').where('status','==','rejected').get(),
      db.collection('exeatRequests').where('status','==','revoked').get()
    ]);
    document.getElementById('statPending').textContent  = p.size;
    document.getElementById('statApproved').textContent = a.size;
    document.getElementById('statRejected').textContent = r.size;
    document.getElementById('statRevoked').textContent  = v.size;
    document.getElementById('statTotal').textContent    = p.size + a.size + r.size + v.size;
  } catch(e) {}
}

// ---------------------------------------------------------------
// SEARCH
// ---------------------------------------------------------------
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', debounce(async () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { loadRequests('pending'); return; }
    try {
      const snapshot = await db.collection('exeatRequests').orderBy('createdAt','desc').get();
      const container = document.getElementById('requestsContainer');
      container.innerHTML = '';
      let found = false;
      snapshot.forEach(doc => {
        const d = doc.data();
        if (
          d.studentName.toLowerCase().includes(q) ||
          d.matric.toLowerCase().includes(q) ||
          d.destination.toLowerCase().includes(q) ||
          (d.passId && d.passId.toLowerCase().includes(q))
        ) {
          container.appendChild(createDSACard(doc.id, d));
          found = true;
        }
      });
      if (!found) container.innerHTML = '<p class="empty-text">No results found.</p>';
    } catch(e) {
      document.getElementById('requestsContainer').innerHTML =
        '<p class="error-text">Unable to complete search. Please try again.</p>';
    }
  }, 400));
}

// ---------------------------------------------------------------
// NAV & UTILS
// ---------------------------------------------------------------
function showDSASection(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById(section).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-section="${section}"]`).classList.add('active');
  closeSidebar();
}
function logout() { if (pendingListener) pendingListener(); auth.signOut().then(() => window.location.href = 'login-dsa.html'); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('active'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('active'); }
function formatDate(d) { if (!d) return 'N/A'; return new Date(d).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' }); }
function formatTimestamp(ts) { if (!ts || !ts.toDate) return ''; return ts.toDate().toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' }); }
function showToast(msg, type='success') { const t=document.getElementById('toast'); t.textContent=msg; t.className=`toast ${type} show`; setTimeout(()=>t.classList.remove('show'),5000); }
function debounce(fn, d) { let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a),d); }; }