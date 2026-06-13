// ==================== STUDENT DASHBOARD ====================

let currentUser = null;
let requestsListener = null;

const LOGO_URL = './images/cu-logo.png';

// ISSUE 3 FIX: Called once auth confirms a valid student session.
// body { visibility: hidden } in student.html keeps the page blank
// until this runs — no dashboard content ever flashes to an unauth user.
function revealDashboard() {
  document.body.style.visibility = 'visible';
}

auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = 'login-student.html'; return; }

  // EMAIL VERIFICATION CHECK — boot unverified users back to login
  if (!user.emailVerified) {
    window.location.href = 'login-student.html';
    return;
  }

  const userDoc = await db.collection('users').doc(user.uid).get();
  if (!userDoc.exists || userDoc.data().role !== 'student') {
    window.location.href = 'login-student.html'; return;
  }
  // Valid verified student confirmed — now safe to reveal the dashboard
  revealDashboard();
  currentUser = { uid: user.uid, ...userDoc.data() };
  document.getElementById('studentName').textContent = currentUser.name;
  document.getElementById('studentMatric').textContent = currentUser.matric;
  document.getElementById('studentDept').textContent = currentUser.department;
  document.getElementById('studentHostel').textContent = currentUser.hostel;
  listenToMyRequests();
});

function listenToMyRequests() {
  if (!currentUser) return;
  if (requestsListener) requestsListener();
  const container = document.getElementById('myRequests');
  container.innerHTML = '<p class="loading-text">Loading your requests...</p>';
  requestsListener = db.collection('exeatRequests')
    .where('studentId', '==', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot((snapshot) => {
      if (snapshot.empty) { container.innerHTML = '<p class="empty-text">You have no exeat requests yet.</p>'; return; }
      snapshot.docChanges().forEach(change => {
        if (change.type === 'modified') {
          const data = change.doc.data();
          if (data.status === 'approved') showToast('🎉 Your exeat request has been approved!', 'success');
          else if (data.status === 'rejected') showToast('❌ Your exeat request was rejected.', 'error');
        }
      });
      container.innerHTML = '';
      snapshot.forEach(doc => container.appendChild(createRequestCard(doc.id, doc.data())));
    }, () => { container.innerHTML = '<p class="error-text">Unable to load requests. Please refresh.</p>'; });
}

const exeatForm = document.getElementById('exeatForm');
if (exeatForm) {
  exeatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const destination      = document.getElementById('destination').value.trim();
    const reason           = document.getElementById('reason').value.trim();
    const departureDate    = document.getElementById('departureDate').value;
    const returnDate       = document.getElementById('returnDate').value;
    const emergencyContact = document.getElementById('emergencyContact').value.trim();
    const emergencyPhone   = document.getElementById('emergencyPhone').value.trim();
    if (new Date(returnDate) <= new Date(departureDate)) { showToast('Return date must be after departure date.', 'error'); return; }
    const existing = await db.collection('exeatRequests').where('studentId', '==', currentUser.uid).where('status', '==', 'pending').limit(1).get();
    if (!existing.empty) { showToast('You already have a pending request. Wait for DSA to review it first.', 'error'); return; }
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = 'Submitting...';
    try {
      await db.collection('exeatRequests').add({
        studentId: currentUser.uid, studentName: currentUser.name, matric: currentUser.matric,
        hostel: currentUser.hostel, department: currentUser.department,
        destination, reason, departureDate, returnDate, emergencyContact, emergencyPhone,
        status: 'pending', dsaComment: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Exeat request submitted!', 'success');
      exeatForm.reset();
      showSection('trackSection');
    } catch (err) { showToast('Something went wrong. Please try again.', 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Submit Request →'; }
  });
}

async function cancelRequest(docId) {
  const modal = document.getElementById('cancelModal');
  modal.classList.remove('hidden');
  document.getElementById('cancelConfirmBtn').onclick = async () => {
    modal.classList.add('hidden');
    try {
      await db.collection('exeatRequests').doc(docId).update({ status: 'cancelled', updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      showToast('Request cancelled.', 'info');
    } catch (err) { showToast('Something went wrong. Please try again.', 'error'); }
  };
}
function closeCancelModal() { document.getElementById('cancelModal').classList.add('hidden'); }

function createRequestCard(docId, data) {
  const card = document.createElement('div');
  card.className = `request-card status-${data.status}`;
  const statusLabels = { pending: '⏳ Pending DSA Review', approved: '✅ Approved', rejected: '❌ Rejected', cancelled: '🚫 Cancelled' };
  card.innerHTML = `
    <div class="card-header">
      <span class="card-destination">📍 ${data.destination}</span>
      <span class="status-badge ${data.status}">${statusLabels[data.status] || data.status}</span>
    </div>
    <div class="card-body">
      <p><strong>Reason:</strong> ${data.reason}</p>
      <p><strong>Departure:</strong> ${formatDate(data.departureDate)} &nbsp;→&nbsp; <strong>Return:</strong> ${formatDate(data.returnDate)}</p>
      ${data.passId ? `<p><strong>Pass ID:</strong> <span style="font-family:monospace;color:#4B0082;font-weight:700">${data.passId}</span></p>` : ''}
      ${data.dsaComment ? `<p class="comment">💬 <strong>DSA Note:</strong> ${data.dsaComment}</p>` : ''}
    </div>
    ${data.status === 'approved' ? `<div style="padding-top:12px"><button class="btn-download" onclick='downloadStudentExeat(${JSON.stringify(data).replace(/'/g, "&#39;")})'>⬇️ Download Exeat Pass (PDF)</button></div>` : ''}
    ${data.status === 'pending' ? `<div style="padding-top:10px"><button class="btn-cancel" onclick="cancelRequest('${docId}')">🚫 Cancel Request</button></div>` : ''}
    <div class="card-footer"><span class="card-date">${data.createdAt ? formatTimestamp(data.createdAt) : 'Just now'}</span></div>`;
  return card;
}

// ── Logo loader — three strategies to handle CORS ──
async function fetchLogoAsBase64(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) return await blobToBase64(await res.blob());
  } catch(_) {}
  try { return await imageToBase64ViaCanvas(url); } catch(_) {}
  return null;
}
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function imageToBase64ViaCanvas(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch(e) { reject(e); }
    };
    img.onerror = reject;
    img.src = url + '?cb=' + Date.now();
  });
}

// ── PDF Generator ──
async function downloadStudentExeat(data) {
  const logoBase64 = await fetchLogoAsBase64(LOGO_URL);
  const logoTag = logoBase64
    ? `<img class="logo" src="${logoBase64}" alt="Chrisland University"/>`
    : `<div class="logo-fallback">CU</div>`;

  const qrValue = data.passId || data.matric;
  const qrHint  = data.passId
    ? `Scan to verify this pass instantly in the warden portal, or type the Pass ID: <strong>${data.passId}</strong>`
    : `Enter matric number <strong>${data.matric}</strong> in the warden portal to verify.`;

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Exeat Pass — ${data.passId || data.matric}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 210mm; font-family: 'Georgia', serif; background: #fff; color: #1a0533; }
    .page { width: 190mm; margin: 0 auto; padding: 10mm 10mm 8mm; position: relative; }
    .header { display: flex; align-items: center; gap: 14px; padding-bottom: 10px; border-bottom: 2.5px solid #4B0082; margin-bottom: 12px; }
    .logo { width: 62px; height: 62px; object-fit: contain; flex-shrink: 0; border-radius: 50%; }
    .logo-fallback { width: 62px; height: 62px; border-radius: 50%; background: #4B0082; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 900; flex-shrink: 0; font-family: sans-serif; }
    .header-text .uni-name { font-size: 1.1rem; font-weight: 700; color: #4B0082; }
    .header-text .uni-sub { font-size: 0.68rem; color: #6B5B8A; margin-top: 1px; text-transform: uppercase; letter-spacing: 0.04em; }
    .header-text .doc-title { font-size: 0.78rem; color: #4B0082; margin-top: 5px; font-weight: 600; border-top: 1px solid #D8B4FE; padding-top: 4px; }
    .stamp-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .approved-stamp { background: #dcfce7; border: 1.5px solid #16a34a; color: #14532d; padding: 5px 14px; border-radius: 5px; font-weight: 700; font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase; }
    .pass-id-stamp { font-size: 0.78rem; font-family: 'Courier New', monospace; color: #4B0082; font-weight: 700; background: #f3e8ff; border: 1.5px solid #c084fc; padding: 5px 12px; border-radius: 5px; }
    .section-title { font-size: 0.6rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 7px; border-bottom: 1px solid #f3e8ff; padding-bottom: 3px; }
    .info-block { margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 14px; }
    .field-label { font-size: 0.6rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
    .field-value { font-size: 0.82rem; color: #1a0533; font-weight: 500; margin-top: 1px; }
    .divider { border: none; border-top: 1px solid #e9d8fd; margin: 8px 0; }
    .qr-section { display: flex; align-items: center; gap: 14px; margin: 10px 0; padding: 10px 14px; background: #f7f3fe; border: 1px solid #e4d5f9; border-radius: 8px; }
    .qr-box { flex-shrink: 0; }
    .qr-info .qr-label { font-size: 0.58rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
    .qr-info .qr-hint { font-size: 0.65rem; color: #6B5B8A; line-height: 1.55; }
    .sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 14px; }
    .sig-label { font-size: 0.6rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 24px; }
    .sig-line { border-bottom: 1.5px solid #4B0082; margin-bottom: 5px; }
    .sig-name { font-size: 0.65rem; color: #6B5B8A; }
    .footer { margin-top: 14px; padding-top: 10px; border-top: 2px solid #4B0082; display: flex; justify-content: space-between; align-items: center; }
    .footer-left { font-size: 0.62rem; color: #9ca3af; max-width: 320px; line-height: 1.5; }
    .footer-right { font-size: 0.62rem; color: #4B0082; font-weight: 700; text-align: right; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 4.5rem; color: rgba(75,0,130,0.04); font-weight: 900; pointer-events: none; white-space: nowrap; }
    @media print {
      html, body { width: 210mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: A4 portrait; margin: 0; }
    }
  </style>
</head>
<body>
<div class="watermark">CHRISLAND UNIVERSITY</div>
<div class="page">
  <div class="header">
    ${logoTag}
    <div class="header-text">
      <div class="uni-name">CHRISLAND UNIVERSITY</div>
      <div class="uni-sub">Ajebo Road, Abeokuta, Ogun State — Intellectual Radiance</div>
      <div class="doc-title">Office of the Dean of Student Affairs — Student Exeat Pass</div>
    </div>
  </div>
  <div class="stamp-row">
    <div class="approved-stamp">✅ Approved by Dean of Student Affairs</div>
    ${data.passId ? `<div class="pass-id-stamp">🔐 ${data.passId}</div>` : `<div style="font-size:0.7rem;color:#9ca3af;font-family:monospace">REF: EX/${data.matric}/${new Date().getFullYear()}</div>`}
  </div>
  <div class="info-block">
    <div class="section-title">Student Information</div>
    <div class="info-grid">
      <div class="field"><div class="field-label">Full Name</div><div class="field-value">${data.studentName}</div></div>
      <div class="field"><div class="field-label">Matric Number</div><div class="field-value">${data.matric}</div></div>
      <div class="field"><div class="field-label">Department</div><div class="field-value">${data.department}</div></div>
      <div class="field"><div class="field-label">Hostel</div><div class="field-value">${data.hostel}</div></div>
    </div>
  </div>
  <hr class="divider"/>
  <div class="info-block">
    <div class="section-title">Leave Details</div>
    <div class="info-grid">
      <div class="field"><div class="field-label">Destination</div><div class="field-value">📍 ${data.destination}</div></div>
      <div class="field"><div class="field-label">Reason for Leave</div><div class="field-value">${data.reason}</div></div>
      <div class="field"><div class="field-label">Departure Date</div><div class="field-value">${formatDate(data.departureDate)}</div></div>
      <div class="field"><div class="field-label">Expected Return Date</div><div class="field-value">${formatDate(data.returnDate)}</div></div>
    </div>
  </div>
  <hr class="divider"/>
  <div class="info-block">
    <div class="section-title">Emergency Contact</div>
    <div class="info-grid">
      <div class="field"><div class="field-label">Contact Person</div><div class="field-value">${data.emergencyContact}</div></div>
      <div class="field"><div class="field-label">Phone Number</div><div class="field-value">${data.emergencyPhone}</div></div>
    </div>
    ${data.dsaComment ? `<div class="field" style="margin-top:8px"><div class="field-label">DSA Note</div><div class="field-value">${data.dsaComment}</div></div>` : ''}
  </div>
  <hr class="divider"/>
  <div class="qr-section">
    <div class="qr-box" id="qrcode"></div>
    <div class="qr-info">
      <div class="qr-label">Warden Verification</div>
      <div class="qr-hint">${qrHint}</div>
    </div>
  </div>
  <div class="sig-row">
    <div class="sig-box">
      <div class="sig-label">Dean of Student Affairs</div>
      <div class="sig-line"></div>
      <div class="sig-name">Signature &amp; Official Stamp</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Hostel Warden</div>
      <div class="sig-line"></div>
      <div class="sig-name">Signature &amp; Official Stamp</div>
    </div>
  </div>
  <div class="footer">
    <div class="footer-left">This exeat pass was issued by the Office of the Dean of Student Affairs, Chrisland University. Any alteration, forgery, or misuse of this document is a disciplinary offence.</div>
    <div class="footer-right">Chrisland University<br/>www.chrislanduniversity.edu.ng</div>
  </div>
</div>
<script>
  window.onload = function () {
    new QRCode(document.getElementById('qrcode'), {
      text: '${qrValue}',
      width: 75, height: 75,
      colorDark: '#4B0082', colorLight: '#f7f3fe',
      correctLevel: QRCode.CorrectLevel.H
    });
    setTimeout(() => window.print(), 700);
  };
<\/script>
</body>
</html>`);
  win.document.close();
}

function showSection(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById(section).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-section="${section}"]`);
  if (btn) btn.classList.add('active');
  closeSidebar();
}

function logout() { if (requestsListener) requestsListener(); auth.signOut().then(() => window.location.href = 'login-student.html'); }
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebarOverlay').classList.toggle('active'); }
function closeSidebar() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('active'); }
function formatDate(d) { if (!d) return 'N/A'; return new Date(d).toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' }); }
function formatTimestamp(ts) { if (!ts || !ts.toDate) return ''; return ts.toDate().toLocaleDateString('en-NG', { day:'numeric', month:'short', year:'numeric' }); }
function showToast(msg, type='success') { const t=document.getElementById('toast'); t.textContent=msg; t.className=`toast ${type} show`; setTimeout(()=>t.classList.remove('show'),5000); }