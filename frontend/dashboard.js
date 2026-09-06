const API_BASE_URL = 'http://127.0.0.1:8000';
// const API_BASE_URL = 'http://192.168.100.6:8000';

function resolveProfileImageUrl(src) {
  if (!src) return null;
  if (/^data:|^https?:\/\//i.test(src)) return src;
  if (src.startsWith('/uploads/')) return `${API_BASE_URL}${src}`;
  return src;
}

function getUser() {
  try {
    const raw = JSON.parse(
      localStorage.getItem('barterUser') ||
      localStorage.getItem('bartifyUser') ||
      'null'
    );
    if (!raw) return {};
    const avatar = resolveProfileImageUrl(raw.avatar || raw.picture || raw.user_image || null);
    return {
      ...raw,
      avatar,
      picture: resolveProfileImageUrl(raw.picture || avatar),
      user_image: resolveProfileImageUrl(raw.user_image || avatar)
    };
  } catch(e) { return {}; }
}

function saveUser(u) {
  localStorage.setItem('barterUser',   JSON.stringify(u));
  localStorage.setItem('bartifyUser',  JSON.stringify(u));
}

function getOrInitUser() {
  return getUser();
}

// ════════════════════════════════════════════════════
// PRODUCTS — API se aate hain, memory mein cache hote hain
// ════════════════════════════════════════════════════
let myPosts = [];

async function loadMyPosts() {
  const token = localStorage.getItem('barterToken');
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE_URL}/posts/my`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    myPosts = (data.posts || []).map(p => {
      if (p.images) {
        p.images = p.images.map(src =>
          src && src.startsWith('/uploads/') ? `${API_BASE_URL}${src}` : src
        );
      }
      if (p.seller?.avatar?.startsWith('/uploads/')) {
        p.seller.avatar = `${API_BASE_URL}${p.seller.avatar}`;
      }
      return p;
    });
  } catch(e) {
    console.error('Could not load my posts:', e);
  }
}

// ════════════════════════════════════════════════════
// BARTER REQUESTS (offers API se aate hain)
// ════════════════════════════════════════════════════
let receivedOffers = [];
let sentOffers     = [];

function fixOfferImageUrls(o) {
  if (o.images) {
    o.images = o.images.map(src => src && src.startsWith('/uploads/') ? `${API_BASE_URL}${src}` : src);
  }
  if (o.post_image && o.post_image.startsWith('/uploads/')) {
    o.post_image = `${API_BASE_URL}${o.post_image}`;
  }
  if (o.offering_user?.avatar?.startsWith('/uploads/')) {
    o.offering_user.avatar = `${API_BASE_URL}${o.offering_user.avatar}`;
  }
  return o;
}

async function loadReceivedOffers() {
  const token = localStorage.getItem('barterToken');
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE_URL}/offers/received`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    receivedOffers = (data.offers || []).map(fixOfferImageUrls);
  } catch(e) {
    console.error('Could not load received offers:', e);
  }
}

async function loadSentOffers() {
  const token = localStorage.getItem('barterToken');
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE_URL}/offers/sent`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    sentOffers = (data.offers || []).map(fixOfferImageUrls);
  } catch(e) {
    console.error('Could not load sent offers:', e);
  }
}

let pendingDeleteId   = null;
let tempAvatarDataUrl = undefined;
let currentSection    = 'dashHome';

// ════════════════════════════════════════════════════
// APPLY USER TO ALL UI SLOTS
// ════════════════════════════════════════════════════
function applyUserToUI(u) {
  const firstName = u.firstName || (u.name ? u.name.split(' ')[0] : 'User');
  const lastName  = u.lastName  || (u.name ? u.name.split(' ').slice(1).join(' ') : '');
  const full      = `${firstName} ${lastName}`.trim() || 'User';
  const initial   = firstName.charAt(0).toUpperCase();
  const avatarSrc = resolveProfileImageUrl(u.avatar || u.picture || u.user_image);

  // Sidebar
  document.getElementById('sidebarName').textContent  = full;
  document.getElementById('sidebarEmail').textContent = u.email || '';
  setAvatarEl(document.getElementById('sidebarAvatar'), avatarSrc, initial);

  // Header dropdown
  document.getElementById('dropdownName').textContent  = full;
  document.getElementById('dropdownEmail').textContent = u.email || '';

  // Header profile button
  const hBtn = document.getElementById('headerProfileBtn');
  hBtn.innerHTML = avatarSrc
    ? `<img src="${avatarSrc}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : `<i class="fa-solid fa-user"></i>`;

  // Dashboard greeting
  const greet = document.getElementById('dashGreet');
  if (greet) greet.textContent = `Welcome back, ${firstName}! 👋`;
}

function setAvatarEl(el, src, initial) {
  if (!el) return;
  if (src) { el.innerHTML = `<img src="${src}" alt="avatar">`; }
  else      { el.textContent = initial; }
}

// ════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════
function navClick(el) {
  if (event) event.preventDefault();
  const section = el.dataset.section;
  if (!section) return;

  document.querySelectorAll('.nav-direct, .nav-sub a').forEach(a => a.classList.remove('active'));
  el.classList.add('active');

  showSection(section);
  if (window.innerWidth < 769) closeSidebarMobile();
}

function navigate(section) {
  document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
  const link = document.querySelector(`[data-section="${section}"]`);
  document.querySelectorAll('.nav-direct, .nav-sub a').forEach(a => a.classList.remove('active'));
  if (link) link.classList.add('active');
  showSection(section);
}

function showSection(section) {
  currentSection = section;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('sec-' + section);
  if (el) el.classList.add('active');

  // Update header title
  const titles = {
    dashHome:'Dashboard',            addListing:'Add a Barter Listing',
    editListing:'Edit Listing',      deleteListing:'Delete Listing',
    activeListings:'Active Listings', pendingListings:'Pending Listings',
    requestsReceived:'Barter Requests Received',
    requestsSent:'Barter Requests Sent',
    rejectedRequests:'Rejected Barter Requests',
    completedRequests:'Accepted Barter Requests',
    viewProfile:'My Profile',        editProfile:'Edit Profile',
    changePassword:'Change Password'
  };
  const ht = document.getElementById('headerTitle');
  if (ht) ht.textContent = titles[section] || 'Dashboard';

  renderSection(section);
}

function renderSection(s) {
  const map = {
    dashHome:         renderDashHome,
    editListing:      renderEditList,
    deleteListing:    renderDeleteList,
    activeListings:   renderActiveListings,
    pendingListings:  renderPendingListings,
    requestsReceived: renderRequestsReceived,
    requestsSent:     renderRequestsSent,
    rejectedRequests: renderRejectedRequests,
    completedRequests:renderCompletedRequests,
    viewProfile:      renderViewProfile,
    editProfile:      populateEditProfileForm
  };
  if (s === 'addListing') resetListingForm();
  if (map[s]) map[s]();
}

function toggleGroup(hdr) {
  hdr.classList.toggle('open');
  hdr.nextElementSibling.classList.toggle('open');
}

// ════════════════════════════════════════════════════
// SIDEBAR TOGGLE
// ════════════════════════════════════════════════════
let sidebarOpen = true;

function toggleSidebar() {
  if (window.innerWidth < 769) {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('mobile-open');
    document.getElementById('sidebar-overlay').style.display =
      sb.classList.contains('mobile-open') ? 'block' : 'none';
  } else {
    sidebarOpen = !sidebarOpen;
    document.getElementById('sidebar').classList.toggle('collapsed', !sidebarOpen);
    document.getElementById('header').classList.toggle('sidebar-collapsed', !sidebarOpen);
    document.getElementById('main').classList.toggle('sidebar-collapsed', !sidebarOpen);
  }
}

function closeSidebarMobile() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebar-overlay').style.display = 'none';
}

// ════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════
function condClass(c) {
  return { 'Like New':'like-new', 'Good':'good', 'Fair':'fair', 'Poor':'fair' }[c] || '';
}

function thumbEl(p) {
  // Support both {image} string and {images:[]} array
  const src = (p.images && p.images[0]) ? p.images[0] : (p.image || null);
  return src
    ? `<div class="listing-thumb"><img src="${src}" alt="${esc(p.title)}" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-image\\'></i>'"></div>`
    : `<div class="listing-thumb"><i class="fa-solid fa-image"></i></div>`;
}

function emptyState(icon, title, msg, btn='') {
  return `<div style="background:var(--card-bg);border:1.5px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);">
    <div class="empty-state">
      <div class="icon"><i class="${icon}"></i></div>
      <h4>${title}</h4>
      <p>${msg}</p>
      ${btn}
    </div>
  </div>`;
}

function normCond(p) {
  if (p.cond) return p.cond + '/10';
  if (p.condLabel) return p.condLabel;
  if (p.condition) return p.condition;
  return '—';
}
function normValue(p) {
  if (p.valueFrom !== undefined && p.valueTo !== undefined && Number(p.valueTo) > 0) {
    if (Number(p.valueFrom) === Number(p.valueTo)) return Number(p.valueFrom).toLocaleString();
    return Number(p.valueFrom).toLocaleString() + ' — ' + Number(p.valueTo).toLocaleString();
  }
  if (p.valueFrom !== undefined && Number(p.valueFrom) > 0) return Number(p.valueFrom).toLocaleString();
  return Number(p.value || 0).toLocaleString();
}
function normCat(p)    { return p.cat || p.category || ''; }
function normStatus(p) { return p.status || 'active'; }

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════════
// DASHBOARD HOME
// ════════════════════════════════════════════════════
function renderDashHome() {
  const myActive  = myPosts.filter(p => normStatus(p) === 'active');
  const myPending = myPosts.filter(p => normStatus(p) === 'pending');

  document.getElementById('statActive').textContent    = myActive.length;
  document.getElementById('statPending').textContent   = myPending.length;
  document.getElementById('statCompleted').textContent =
    receivedOffers.filter(o => o.status === 'accepted').length +
    sentOffers.filter(o => o.status === 'accepted').length;
  document.getElementById('statRequests').textContent  =
    receivedOffers.filter(o => o.status === 'pending').length;

  // Recent listings (last 5)
  const recent = myPosts.slice(0, 5);
  const rlEl = document.getElementById('dashRecentListings');
  if (!recent.length) {
    rlEl.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px;">
      No listings yet. <a href="#" onclick="navigate('addListing');return false;" style="color:var(--primary);font-weight:600;">Add one →</a>
    </div>`;
  } else {
    rlEl.innerHTML = recent.map(p => {
      const imgSrc = (p.images && p.images[0]) ? p.images[0] : (p.image || null);
      const imgEl  = imgSrc
        ? `<div class="recent-thumb"><img src="${imgSrc}" alt=""></div>`
        : `<div class="recent-thumb"><i class="fa-solid fa-image"></i></div>`;
      const status   = normStatus(p);
      const badgeCls = status === 'active' ? 'rb-active' : 'rb-pending';
      return `
        <div class="recent-row" onclick="navigate('${status === 'pending' ? 'pendingListings' : 'activeListings'}')">
          ${imgEl}
          <div class="recent-info">
            <div class="recent-title">${esc(p.title)}</div>
            <div class="recent-meta">Rs. ${normValue(p)} · ${esc(normCat(p))}</div>
          </div>
          <span class="recent-badge ${badgeCls}">${status.charAt(0).toUpperCase()+status.slice(1)}</span>
        </div>`;
    }).join('');
  }

  // Activity feed
  const actEl = document.getElementById('dashActivity');
  actEl.innerHTML = `<div class="empty-state">No recent activity yet.</div>`;
}

// ════════════════════════════════════════════════════
// EDIT LISTING — redirects to list-item.html
// ════════════════════════════════════════════════════
function renderEditList() {
  const c = document.getElementById('editListingList');
  const editable = myPosts.filter(p => normStatus(p) === 'active');
  if (!editable.length) {
    c.innerHTML = emptyState('fa-solid fa-pen-to-square','No listings to edit','Approved listings will appear here for editing.',
      `<a href="#" onclick="navigate('addListing');return false;" class="btn-primary-sm" style="margin:0 auto;"><i class="fa-solid fa-plus"></i> Add Listing</a>`);
    return;
  }
  c.innerHTML = editable.map(p => `
    <div class="listing-card">
      ${thumbEl(p)}
      <div class="listing-info">
        <div class="listing-name">${esc(p.title)}</div>
        <div class="listing-desc">${esc(p.desc || '')}</div>
        <div class="listing-meta">
          <span class="badge-condition ${condClass(normCond(p))}">${normCond(p)}</span>
          <span class="listing-price">Rs. ${normValue(p)}</span>
          <span style="font-size:11px;color:var(--text-muted);">${esc(normCat(p))}</span>
        </div>
      </div>
      <div class="listing-actions">
        <button class="btn-edit-sm" onclick="goEdit('${p.id}')">
          <i class="fa-solid fa-pen"></i> Edit
        </button>
      </div>
    </div>`).join('');
}

function goEdit(id) {
  const p = myPosts.find(x => String(x.id) === String(id));
  if (p && normStatus(p) === 'pending') {
    showToast('Pending listings can’t be edited until they’re approved.', 'error');
    return;
  }
  navigate('addListing');
  // slight delay so section is visible before we fill it
  setTimeout(() => loadEditIntoForm(id), 30);
}

/* ═══ PRODUCT DETAIL MODAL (dashboard ke andar hi — homepage jaisa card) ═══ */
function openDetail(id) {
  const p = myPosts.find(x => String(x.id) === String(id));
  if (!p) return;

  const condLabel = p.cond ? (p.cond + '/10') : (p.condLabel || '');
  const condPillClass = p.cond >= 9 ? 'like-new' : p.cond >= 7 ? 'good' : p.cond >= 5 ? 'fair' : 'poor';

  const sellerName = (p.seller && p.seller.name) ? p.seller.name : (p.ownerName || 'Bartify User');
  const sellerInit = sellerName.charAt(0).toUpperCase();
  const sellerAvHTML = (p.seller && p.seller.avatar) ? `<img src="${p.seller.avatar}" alt="">` : sellerInit;
  const dateStr = p.date ? new Date(p.date).toLocaleDateString('en-US',{ month:'numeric', day:'numeric', year:'numeric' }) : '';

  const imgs = (p.images && p.images.length) ? p.images : [];
  const mainHTML = imgs.length
    ? `<img src="${imgs[0]}" alt="${esc(p.title)}" class="pd-main-img" id="pdMainImg">`
    : `<div class="pd-main-placeholder"><i class="bi bi-image"></i></div>`;
  const thumbsHTML = imgs.length > 1
    ? `<div class="pd-thumbs">${imgs.map((src,i) =>
        `<img src="${src}" class="pd-thumb${i===0?' active':''}" onclick="switchImg('${src}',this)" alt="">`
      ).join('')}</div>` : '';

  const tradeHTML = p.trade
    ? `<div class="pd-label">Looking for</div><p class="pd-trade-text">${esc(p.trade)}</p>` : '';

  const condPillHTML = condLabel
    ? `<div class="pd-cond-pill ${condPillClass}">
         <i class="bi bi-patch-check-fill" style="font-size:14px;"></i>
         Condition: ${esc(condLabel)}
       </div>` : '';

  const statusBadge = normStatus(p) === 'pending'
    ? `<span class="listing-status status-pending" style="margin-left:8px;">Pending</span>` : '';

  const actionHTML = normStatus(p) === 'pending'
    ? `<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:12px 14px;font-size:.82rem;color:#92400e;display:flex;align-items:center;gap:8px;">
         <i class="bi bi-hourglass-split"></i> Awaiting approval — editing is disabled until it's live.
       </div>`
    : `<button class="btn-edit-sm" style="width:100%;justify-content:center;" onclick="closeDetail();goEdit('${p.id}')"><i class="fa-solid fa-pen"></i> Edit this listing</button>`;

  document.getElementById('pdBody').innerHTML = `
    <div class="pd-gallery">
      ${mainHTML}
      ${thumbsHTML}
    </div>
    <div class="pd-info">
      <h2 class="pd-title">${esc(p.title)}${statusBadge}</h2>
      <div class="pd-seller">
        <div class="pd-seller-av">${sellerAvHTML}</div>
        <div><div class="pd-seller-name">${esc(sellerName)}</div></div>
      </div>
      <div class="pd-seller-meta">
        ${dateStr ? `<span><i class="bi bi-calendar3"></i> ${dateStr}</span>` : ''}
        <span><i class="bi bi-tag"></i> ${esc(normCat(p)||'General')}</span>
      </div>
      ${condPillHTML}
      <div class="pd-label">Description</div>
      <p class="pd-section-text">${esc(p.desc || 'No description provided.')}</p>
      ${tradeHTML}
      <div class="pd-value-box">
        <div class="pd-label">Estimated value</div>
        <div class="pd-value-big">Rs. ${normValue(p)}</div>
      </div>
      ${actionHTML}
    </div>`;

  document.getElementById('pdOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function switchImg(src, thumb) {
  const main = document.getElementById('pdMainImg');
  if (main) main.src = src;
  document.querySelectorAll('.pd-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}

function closeDetail() {
  document.getElementById('pdOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function overlayClick(e) {
  if (e.target === document.getElementById('pdOverlay')) closeDetail();
}

// ════════════════════════════════════════════════════
// DELETE LISTING
// ════════════════════════════════════════════════════
function renderDeleteList() {
  const c = document.getElementById('deleteListingList');
  if (!myPosts.length) {
    c.innerHTML = emptyState('fa-solid fa-trash','No listings','You have no listings to delete.');
    return;
  }
  c.innerHTML = myPosts.map(p => `
    <div class="listing-card">
      ${thumbEl(p)}
      <div class="listing-info">
        <div class="listing-name">${esc(p.title)}</div>
        <div class="listing-desc">${esc(p.desc || '')}</div>
        <div class="listing-meta">
          <span class="badge-condition ${condClass(normCond(p))}">${normCond(p)}</span>
          <span class="listing-price">Rs. ${normValue(p)}</span>
        </div>
      </div>
      <div class="listing-actions">
        <button class="btn-delete-sm" onclick="promptDelete('${p.id}','${(p.title||'').replace(/'/g,"\\'")}')">
          <i class="fa-solid fa-trash"></i> Delete
        </button>
      </div>
    </div>`).join('');
}

function promptDelete(id, name) {
  pendingDeleteId = id;
  document.getElementById('deleteItemName').textContent = `"${name}"`;
  document.getElementById('confirmDeleteBtn').onclick = doDelete;
  new bootstrap.Modal(document.getElementById('deleteModal')).show();
}

async function doDelete() {
  const token = localStorage.getItem('barterToken');
  try {
    const res = await fetch(`${API_BASE_URL}/posts/${pendingDeleteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Delete failed');
    }
    bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
    await loadMyPosts();
    showToast('Listing deleted.', 'success');
    renderSection(currentSection);
    renderDashHome();
  } catch(e) {
    showToast(e.message || 'Could not delete listing.', 'error');
  }
}

// ════════════════════════════════════════════════════
// ACTIVE LISTINGS
// ════════════════════════════════════════════════════
function renderActiveListings() {
  const active = myPosts.filter(p => normStatus(p) === 'active');
  document.getElementById('activeCount').textContent = `${active.length} Active`;
  const c = document.getElementById('activeListingsList');
  if (!active.length) {
    c.innerHTML = emptyState('fa-solid fa-boxes-stacked','No active listings','Your active listings will appear here.',
      `<a href="#" onclick="navigate('addListing');return false;" class="btn-primary-sm" style="margin:0 auto;"><i class="fa-solid fa-plus"></i> Add Listing</a>`);
    return;
  }
  c.innerHTML = active.map(p => `
    <div class="listing-card">
      ${thumbEl(p)}
      <div class="listing-info">
        <div class="listing-name">${esc(p.title)}</div>
        <div class="listing-desc">${esc(p.desc || '')}</div>
        <div class="listing-extra-meta">
          <div class="meta-item"><span class="meta-label">Category</span><span class="meta-value">${esc(normCat(p))}</span></div>
          <div class="meta-item"><span class="meta-label">Condition</span><span class="meta-value">${normCond(p)}</span></div>
          <div class="meta-item"><span class="meta-label">Est. Value</span><span class="meta-value">Rs. ${normValue(p)}</span></div>
          <div class="meta-item"><span class="meta-label">Posted</span><span class="meta-value">${p.date || '—'}</span></div>
        </div>
        <div class="listing-meta mt-2">
          <button class="btn-view-sm" onclick="openDetail('${p.id}')"><i class="fa-regular fa-eye"></i> View</button>
          <button class="btn-edit-sm" onclick="goEdit('${p.id}')"><i class="fa-solid fa-pen"></i> Edit</button>
        </div>
      </div>
      <div class="listing-actions">
        <span class="listing-status status-active">Active</span>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════════════════════
// PENDING LISTINGS
// ════════════════════════════════════════════════════
function renderPendingListings() {
  const pending = myPosts.filter(p => normStatus(p) === 'pending');
  document.getElementById('pendingCount').textContent = `${pending.length} Pending`;
  const c = document.getElementById('pendingListingsList');
  if (!pending.length) {
    c.innerHTML = emptyState('fa-regular fa-clock','No pending listings','Newly added listings appear here until approved.');
    return;
  }
  c.innerHTML = pending.map(p => `
    <div class="listing-card">
      ${thumbEl(p)}
      <div class="listing-info">
        <div class="listing-name">${esc(p.title)}</div>
        <div class="listing-desc">${esc(p.desc || '')}</div>
        <div class="listing-extra-meta">
          <div class="meta-item"><span class="meta-label">Condition</span><span class="meta-value">${normCond(p)}</span></div>
          <div class="meta-item"><span class="meta-label">Est. Value</span><span class="meta-value">Rs. ${normValue(p)}</span></div>
          <div class="meta-item"><span class="meta-label">Submitted</span><span class="meta-value">${p.date || '—'}</span></div>
        </div>
        <div class="listing-meta mt-2">
          <button class="btn-view-sm" onclick="openDetail('${p.id}')"><i class="fa-regular fa-eye"></i> View</button>
        </div>
      </div>
      <div class="listing-actions">
        <span class="listing-status status-pending">Pending</span>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════════════════════
// BARTER REQUESTS
// ════════════════════════════════════════════════════
function formatOfferTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PK', { month:'short', day:'numeric', year:'numeric' });
}

function offerStatusClass(status) {
  return status === 'accepted' ? 'completed' : status === 'rejected' ? 'cancelled' : 'pending';
}

function receivedRequestCardHTML(o) {
  const fromName = (o.offering_user && o.offering_user.name) || 'Bartify User';
  const fromInit = fromName.charAt(0).toUpperCase();
  const myPost   = myPosts.find(p => String(p.id) === String(o.post_id));
  const myImg    = myPost && myPost.images && myPost.images[0] ? myPost.images[0] : '';
  const theirImg = (o.images && o.images[0]) || '';
  const badge    = o.status !== 'pending'
    ? `<span class="listing-status status-${offerStatusClass(o.status)}" style="text-transform:capitalize;">${o.status}</span>` : '';
  const actions  = o.status === 'pending' ? `
    <button class="btn-accept-sm" onclick="handleAcceptOffer(${o.id})"><i class="fa-solid fa-check"></i> Accept</button>
    <button class="btn-reject-sm" onclick="handleRejectOffer(${o.id})"><i class="fa-solid fa-times"></i> Decline</button>
    <button class="btn-view-sm" onclick="openOfferDetail(${o.id},'received')"><i class="fa-regular fa-eye"></i> View</button>
  ` : `<button class="btn-view-sm" onclick="openOfferDetail(${o.id},'received')"><i class="fa-regular fa-eye"></i> View</button>`;

  return `
    <div class="request-card">
      <div class="request-top">
        <div class="request-user">
          <div class="request-avatar">${fromInit}</div>
          <div>
            <div class="request-username">${esc(fromName)}</div>
            <div class="request-time"><i class="fa-regular fa-clock"></i> ${formatOfferTime(o.created_at)}</div>
          </div>
        </div>
        ${badge}
      </div>
      ${o.description ? `<p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">"${esc(o.description)}"</p>` : ''}
      <div class="request-exchange">
        <div class="exchange-item">
          <div class="exchange-thumb">${theirImg ? `<img src="${theirImg}" alt="">` : `<i class="fa-solid fa-box"></i>`}</div>
          <div>
            <div class="exchange-label">Their Offer</div>
            <div class="exchange-name">${esc(o.title)}</div>
          </div>
        </div>
        <div class="exchange-arrow"><i class="fa-solid fa-arrow-right-arrow-left"></i></div>
        <div class="exchange-item">
          <div class="exchange-thumb">${myImg ? `<img src="${myImg}" alt="">` : `<i class="fa-solid fa-box"></i>`}</div>
          <div>
            <div class="exchange-label">Your Item</div>
            <div class="exchange-name">${esc(o.post_title || 'Your listing')}</div>
          </div>
        </div>
      </div>
      <div class="request-actions">${actions}</div>
    </div>`;
}

function sentRequestCardHTML(o) {
  const myImg    = (o.images && o.images[0]) || '';
  const theirImg = o.post_image || '';
  const badge    = `<span class="listing-status status-${offerStatusClass(o.status)}" style="text-transform:capitalize;">${o.status}</span>`;

  return `
    <div class="request-card">
      <div class="request-top">
        <div class="request-user">
          <div class="request-avatar"><i class="fa-solid fa-store" style="font-size:14px;"></i></div>
          <div>
            <div class="request-username">${esc(o.post_owner_name || 'Bartify User')}</div>
            <div class="request-time"><i class="fa-regular fa-clock"></i> ${formatOfferTime(o.created_at)}</div>
          </div>
        </div>
        ${badge}
      </div>
      <div class="request-exchange">
        <div class="exchange-item">
          <div class="exchange-thumb">${myImg ? `<img src="${myImg}" alt="">` : `<i class="fa-solid fa-box"></i>`}</div>
          <div>
            <div class="exchange-label">You Offered</div>
            <div class="exchange-name">${esc(o.title)}</div>
          </div>
        </div>
        <div class="exchange-arrow"><i class="fa-solid fa-arrow-right-arrow-left"></i></div>
        <div class="exchange-item">
          <div class="exchange-thumb">${theirImg ? `<img src="${theirImg}" alt="">` : `<i class="fa-solid fa-box"></i>`}</div>
          <div>
            <div class="exchange-label">For</div>
            <div class="exchange-name">${esc(o.post_title || 'Listing')}</div>
          </div>
        </div>
      </div>
      <div class="request-actions">
        <button class="btn-view-sm" onclick="openOfferDetail(${o.id},'sent')"><i class="fa-regular fa-eye"></i> View</button>
      </div>
    </div>`;
}

/* ═══ OFFER DETAIL MODAL — same pdOverlay jo homepage/apni-post view mein use hota hai ═══ */
function openOfferDetail(id, direction) {
  const list = direction === 'received' ? receivedOffers : sentOffers;
  const o = list.find(x => String(x.id) === String(id));
  if (!o) return;

  const condLabel = o.condition_score ? (o.condition_score + '/10') : '';
  const condPillClass = o.condition_score >= 9 ? 'like-new' : o.condition_score >= 7 ? 'good' : o.condition_score >= 5 ? 'fair' : 'poor';

  const imgs = (o.images && o.images.length) ? o.images : [];
  const mainHTML = imgs.length
    ? `<img src="${imgs[0]}" alt="${esc(o.title)}" class="pd-main-img" id="pdMainImg">`
    : `<div class="pd-main-placeholder"><i class="bi bi-image"></i></div>`;
  const thumbsHTML = imgs.length > 1
    ? `<div class="pd-thumbs">${imgs.map((src,i) =>
        `<img src="${src}" class="pd-thumb${i===0?' active':''}" onclick="switchImg('${src}',this)" alt="">`
      ).join('')}</div>` : '';

  const condPillHTML = condLabel
    ? `<div class="pd-cond-pill ${condPillClass}">
         <i class="bi bi-patch-check-fill" style="font-size:14px;"></i>
         Condition: ${esc(condLabel)}
       </div>` : '';

  const valueHTML = (o.price_from || o.price_to)
    ? `<div class="pd-value-box">
         <div class="pd-label">Estimated value</div>
         <div class="pd-value-big">Rs. ${normValue({valueFrom:o.price_from, valueTo:o.price_to, value:o.price_from})}</div>
       </div>` : '';

  const statusBadge = o.status !== 'pending'
    ? `<span class="listing-status status-${offerStatusClass(o.status)}" style="margin-left:8px;text-transform:capitalize;">${o.status}</span>` : '';

  let contextHTML = '';
  let actionHTML  = '';

  if (direction === 'received') {
    const fromName = (o.offering_user && o.offering_user.name) || 'A user';
    contextHTML = `
      <div class="pd-seller">
        <div class="pd-seller-av">${fromName.charAt(0).toUpperCase()}</div>
        <div><div class="pd-seller-name">${esc(fromName)}</div><div style="font-size:.72rem;color:#9ca3af;">wants to trade for "${esc(o.post_title || '')}"</div></div>
      </div>`;
    if (o.status === 'pending') {
      actionHTML = `
        <div style="display:flex;gap:10px;">
          <button class="btn-accept-sm" style="flex:1;justify-content:center;" onclick="handleAcceptOffer(${o.id})"><i class="fa-solid fa-check"></i> Accept</button>
          <button class="btn-reject-sm" style="flex:1;justify-content:center;" onclick="handleRejectOffer(${o.id})"><i class="fa-solid fa-times"></i> Decline</button>
        </div>`;
    }
  } else {
    contextHTML = `
      <div class="pd-seller">
        <div class="pd-seller-av"><i class="fa-solid fa-store" style="font-size:14px;"></i></div>
        <div><div class="pd-seller-name">Offer for "${esc(o.post_title || '')}"</div><div style="font-size:.72rem;color:#9ca3af;">Owner: ${esc(o.post_owner_name || 'Bartify User')}</div></div>
      </div>`;
  }

  document.getElementById('pdBody').innerHTML = `
    <div class="pd-gallery">
      ${mainHTML}
      ${thumbsHTML}
    </div>
    <div class="pd-info">
      <h2 class="pd-title">${esc(o.title)}${statusBadge}</h2>
      ${contextHTML}
      <div class="pd-seller-meta">
        <span><i class="bi bi-tag"></i> ${esc(o.category || 'General')}</span>
      </div>
      ${condPillHTML}
      <div class="pd-label">Description</div>
      <p class="pd-section-text">${esc(o.description || 'No description provided.')}</p>
      ${valueHTML}
      ${actionHTML}
    </div>`;

  document.getElementById('pdOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

async function handleAcceptOffer(id) {
  const token = localStorage.getItem('barterToken');
  try {
    const res = await fetch(`${API_BASE_URL}/offers/${id}/accept`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to accept offer');
    }
    closeDetail();
    await loadReceivedOffers();
    showToast('Barter request accepted! 🎉', 'success');
    renderDashHome();

    const offer = receivedOffers.find(o => String(o.id) === String(id));
    if (offer && offer.offering_user && offer.offering_user.id) {
      const prefill = `Hi! I've accepted your offer ("${offer.title}") for "${offer.post_title || 'my listing'}". Let's arrange the exchange!`;
      openChatWith(offer.offering_user.id, prefill);
    } else {
      navigate('completedRequests');
    }
  } catch(e) {
    showToast(e.message || 'Could not accept offer.', 'error');
  }
}

async function handleRejectOffer(id) {
  const token = localStorage.getItem('barterToken');
  try {
    const res = await fetch(`${API_BASE_URL}/offers/${id}/reject`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to reject offer');
    }
    closeDetail();
    await loadReceivedOffers();
    showToast('Request declined.', 'error');
    renderSection(currentSection);
    renderDashHome();
  } catch(e) {
    showToast(e.message || 'Could not reject offer.', 'error');
  }
}

function renderRequestsReceived() {
  const pending = receivedOffers.filter(o => o.status === 'pending');
  document.getElementById('receivedCount').textContent = `${pending.length} Requests`;
  const c = document.getElementById('requestsReceivedList');
  c.innerHTML = pending.length
    ? pending.map(o => receivedRequestCardHTML(o)).join('')
    : emptyState('fa-solid fa-arrow-right-arrow-left','No requests yet','Barter requests will appear here.');
}

function renderRequestsSent() {
  const pending = sentOffers.filter(o => o.status === 'pending');
  document.getElementById('sentCount').textContent = `${pending.length} Requests`;
  const c = document.getElementById('requestsSentList');
  c.innerHTML = pending.length
    ? pending.map(o => sentRequestCardHTML(o)).join('')
    : emptyState('fa-regular fa-paper-plane','No sent requests','Offers you send to other listings will appear here.');
}

function renderCompletedRequests() {
  const all = [
    ...receivedOffers.filter(o => o.status === 'accepted').map(o => ({o, dir:'received'})),
    ...sentOffers.filter(o => o.status === 'accepted').map(o => ({o, dir:'sent'}))
  ].sort((a,b) => new Date(b.o.created_at) - new Date(a.o.created_at));

  const c = document.getElementById('completedRequestsList');
  c.innerHTML = all.length
    ? all.map(x => x.dir === 'received' ? receivedRequestCardHTML(x.o) : sentRequestCardHTML(x.o)).join('')
    : emptyState('fa-solid fa-handshake','No completed barters','Accepted exchanges will appear here.');
}

function renderRejectedRequests() {
  const all = [
    ...receivedOffers.filter(o => o.status === 'rejected').map(o => ({o, dir:'received'})),
    ...sentOffers.filter(o => o.status === 'rejected').map(o => ({o, dir:'sent'}))
  ].sort((a,b) => new Date(b.o.created_at) - new Date(a.o.created_at));

  const c = document.getElementById('rejectedRequestsList');
  c.innerHTML = all.length
    ? all.map(x => x.dir === 'received' ? receivedRequestCardHTML(x.o) : sentRequestCardHTML(x.o)).join('')
    : emptyState('fa-solid fa-ban','No rejected requests','Declined barter requests will appear here.');
}

// ════════════════════════════════════════════════════
// VIEW PROFILE
// ════════════════════════════════════════════════════
function renderViewProfile() {
  const u = getOrInitUser();
  const firstName = u.firstName || (u.name||'').split(' ')[0] || 'User';
  const lastName  = u.lastName  || (u.name||'').split(' ').slice(1).join(' ') || '';
  const full      = `${firstName} ${lastName}`.trim();
  const initial   = firstName.charAt(0).toUpperCase();

  document.getElementById('profileViewName').textContent  = full;
  document.getElementById('profileViewEmail').textContent = u.email || '—';
  document.getElementById('profileViewFirst').textContent = firstName || '—';
  document.getElementById('profileViewLast').textContent  = lastName  || '—';
  document.getElementById('profileViewPhone').textContent = u.phone || '—';

  setAvatarEl(document.getElementById('profileViewAvatar'), resolveProfileImageUrl(u.avatar || u.picture || u.user_image), initial);
}

// ════════════════════════════════════════════════════
// EDIT PROFILE
// ════════════════════════════════════════════════════
function populateEditProfileForm() {
  const u = getOrInitUser();
  tempAvatarDataUrl = undefined;
  const firstName = u.firstName || (u.name||'').split(' ')[0] || '';
  const lastName  = u.lastName  || (u.name||'').split(' ').slice(1).join(' ') || '';

  document.getElementById('epFirstName').value = firstName;
  document.getElementById('epLastName').value  = lastName;
  document.getElementById('epEmail').value     = u.email || '';
  document.getElementById('epPhone').value     = u.phone || '';

  setAvatarEl(
    document.getElementById('editAvatarPreview'),
    resolveProfileImageUrl(u.avatar || u.picture || u.user_image),
    firstName.charAt(0).toUpperCase() || 'U'
  );
}

function handleAvatarChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    tempAvatarDataUrl = ev.target.result;
    document.getElementById('editAvatarPreview').innerHTML = `<img src="${tempAvatarDataUrl}" alt="avatar">`;
  };
  reader.readAsDataURL(file);
}

async function saveProfile(e) {
  e.preventDefault();
  const token = localStorage.getItem('barterToken');
  if (!token) {
    showToast('Please log in again.', 'error');
    return;
  }

  const firstName = document.getElementById('epFirstName').value.trim();
  const lastName  = document.getElementById('epLastName').value.trim();
  const phone     = document.getElementById('epPhone').value.trim();
  const fullName  = `${firstName} ${lastName}`.trim();

  const formData = new FormData();
  formData.append('name', fullName);
  formData.append('contact', phone);

  const avatarFile = document.getElementById('avatarUpload').files[0];
  if (avatarFile) {
    formData.append('user_image', avatarFile);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.detail || 'Failed to update profile');
    }

    // Update localStorage
    const u = getOrInitUser();
    u.firstName = firstName;
    u.lastName = lastName;
    u.name = fullName;
    u.phone = phone;
    if (data.user?.picture) {
      u.avatar = resolveProfileImageUrl(data.user.picture);
      u.picture = u.avatar;
      u.user_image = u.avatar;
    }
    saveUser(u);
    applyUserToUI(u);

    showToast('Profile updated successfully! ✅', 'success');
    navigate('viewProfile');
  } catch(err) {
    showToast(err.message || 'Could not update profile.', 'error');
  }
}

// ════════════════════════════════════════════════════
// CHANGE PASSWORD
// ════════════════════════════════════════════════════
async function changePassword(e) {
  e.preventDefault();
  const token = localStorage.getItem('barterToken');
  if (!token) {
    showToast('Please log in first.', 'error');
    return;
  }

  const current = document.getElementById('cpCurrent').value;
  const newPwd  = document.getElementById('cpNew').value;
  const confirm = document.getElementById('cpConfirm').value;

  if (!current || !newPwd || !confirm) {
    showToast('All fields are required.', 'error');
    return;
  }

  if (newPwd !== confirm) {
    showToast('New passwords do not match.', 'error');
    return;
  }

  if (newPwd.length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  if (!/[A-Z]/.test(newPwd)) {
    showToast('Password must contain uppercase letter.', 'error');
    return;
  }

  if (!/[0-9]/.test(newPwd)) {
    showToast('Password must contain digit.', 'error');
    return;
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPwd)) {
    showToast('Password must contain special character.', 'error');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('current_password', current);
    formData.append('new_password', newPwd);

    const res = await fetch(`${API_BASE_URL}/users/change-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.detail || 'Failed to change password');
    }

    showToast('Password changed successfully! Logging you out…', 'success');
    setTimeout(() => {
      localStorage.removeItem('barterToken');
      localStorage.removeItem('barterUser');
      localStorage.removeItem('bartifyUser');
      window.location.href = 'login.html';
    }, 2000);
  } catch(err) {
    showToast(err.message || 'Could not change password.', 'error');
  }
}

// ════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════
function confirmLogout() {
  new bootstrap.Modal(document.getElementById('logoutModal')).show();
}

function doLogout() {
  if (chatSocket) { chatSocket.onclose = null; chatSocket.close(); chatSocket = null; }
  localStorage.removeItem('barterToken');
  localStorage.removeItem('barterUser');
  localStorage.removeItem('bartifyUser');
  bootstrap.Modal.getInstance(document.getElementById('logoutModal')).hide();
  showToast('Logged out. Redirecting…');
  setTimeout(() => { window.location.href = 'index.html'; }, 1400);
}

// ════════════════════════════════════════════════════
// MESSAGES WIDGET (real conversations + WebSocket live receive)
// ════════════════════════════════════════════════════
let activeConversationId = null;
let conversations        = [];
let chatSocket            = null;

function formatMsgTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-PK', { hour:'2-digit', minute:'2-digit' });
}

async function loadConversations() {
  const token = localStorage.getItem('barterToken');
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE_URL}/messages/conversations`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    conversations = (data.conversations || []).map(c => {
      if (c.other_user?.avatar?.startsWith('/uploads/')) {
        c.other_user.avatar = `${API_BASE_URL}${c.other_user.avatar}`;
      }
      return c;
    });
    updateNotificationBadges();
    if (document.getElementById('msgOverlay')?.classList.contains('show') && !activeConversationId) {
      renderContactsList(conversations);
    }
  } catch(e) {
    console.error('Could not load conversations:', e);
  }
}

function updateNotificationBadges() {
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const msgBadge = document.getElementById('msgBtnBadge');
  if (msgBadge) {
    msgBadge.textContent  = totalUnread > 9 ? '9+' : totalUnread;
    msgBadge.style.display = totalUnread > 0 ? 'inline-flex' : 'none';
  }

  const pendingReq = receivedOffers.filter(o => o.status === 'pending').length;
  const reqBadge = document.getElementById('requestsNavBadge');
  if (reqBadge) {
    reqBadge.textContent  = pendingReq > 9 ? '9+' : pendingReq;
    reqBadge.style.display = pendingReq > 0 ? 'inline-flex' : 'none';
  }
}

// ═══ WEBSOCKET — sirf live receive ke liye ═══
function connectMessagesSocket() {
  const token = localStorage.getItem('barterToken');
  if (!token) return;
  if (chatSocket && (chatSocket.readyState === WebSocket.OPEN || chatSocket.readyState === WebSocket.CONNECTING)) return;

  const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + `/messages/ws?token=${encodeURIComponent(token)}`;
  chatSocket = new WebSocket(wsUrl);

  chatSocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'new_message') handleIncomingMessage(data.conversation_id, data.message);
    } catch(e) { /* ignore malformed frame */ }
  };

  chatSocket.onclose = () => {
    // Thodi der baad reconnect try karo, agar abhi bhi logged in hain
    setTimeout(() => { if (localStorage.getItem('barterToken')) connectMessagesSocket(); }, 3000);
  };
}

function handleIncomingMessage(conversationId, message) {
  let convo = conversations.find(c => c.id === conversationId);

  if (activeConversationId === conversationId && document.getElementById('msgOverlay')?.classList.contains('show')) {
    // Isi waqt yehi chat khuli hai — turant bubble add karo, unread mat badhao
    appendMessageBubble(message, false);
    if (convo) { convo.last_message = message.content; convo.last_message_at = message.created_at; }
  } else {
    // Kisi aur conversation ka ya widget band hai — unread count badhao
    if (convo) {
      convo.unread_count   = (convo.unread_count || 0) + 1;
      convo.last_message   = message.content;
      convo.last_message_at = message.created_at;
    }
    showToast('New message received', '');
  }
  updateNotificationBadges();
  if (document.getElementById('msgOverlay')?.classList.contains('show') && !activeConversationId) {
    renderContactsList(conversations);
  }
}

function openMessages() {
  document.getElementById('msgOverlay').classList.add('show');
  loadConversations();
  showContactsList();
}

function closeMessages() {
  document.getElementById('msgOverlay').classList.remove('show');
}

function msgOverlayClick(e) {
  if (e.target === document.getElementById('msgOverlay')) closeMessages();
}

function renderContactsList(list) {
  const el = document.getElementById('msgContactsList');
  if (!list.length) {
    el.innerHTML = `<div style="padding:24px;text-align:center;font-size:13px;color:var(--text-muted);">No conversations yet.</div>`;
    return;
  }
  el.innerHTML = list.map(c => {
    const name = (c.other_user && c.other_user.name) || 'Bartify User';
    const init = name.charAt(0).toUpperCase();
    return `
    <div class="msg-contact" onclick="openChat(${c.id})">
      <div class="msg-contact-av">${init}</div>
      <div style="flex:1;min-width:0;">
        <div class="msg-contact-name">${esc(name)}</div>
        <div class="msg-contact-preview">${esc(c.last_message || 'Say hi 👋')}</div>
      </div>
      ${c.unread_count ? `<span class="msg-unread">${c.unread_count}</span>` : ''}
    </div>`;
  }).join('');
}

function filterContacts(q) {
  const query = q.toLowerCase();
  const filtered = conversations.filter(c => ((c.other_user && c.other_user.name) || '').toLowerCase().includes(query));
  renderContactsList(filtered);
}

function showContactsList() {
  const cp = document.getElementById('msgContactsPanel');
  cp.style.display = 'flex';
  cp.style.flexDirection = 'column';
  cp.style.flex = '1';
  cp.style.overflow = 'hidden';
  document.getElementById('msgChatPanel').classList.remove('show');
  activeConversationId = null;
  renderContactsList(conversations);
}

// ═══ Kisi specific user ke sath chat kholna (Accept flow yahi call karta hai) ═══
async function openChatWith(userId, prefillMessage) {
  openMessages();
  const token = localStorage.getItem('barterToken');
  try {
    const res = await fetch(`${API_BASE_URL}/messages/conversations/with/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Could not open conversation');
    const data = await res.json();

    if (!conversations.find(c => c.id === data.id)) {
      conversations.unshift({ id: data.id, other_user: data.other_user, last_message:'', last_message_at:null, unread_count:0 });
    }
    await openChat(data.id);
    if (prefillMessage) {
      const input = document.getElementById('chatInput');
      input.value = prefillMessage;
      input.focus();
    }
  } catch(e) {
    showToast(e.message || 'Could not open chat.', 'error');
  }
}

async function openChat(conversationId) {
  activeConversationId = conversationId;
  const convo = conversations.find(c => c.id === conversationId);
  const name  = (convo && convo.other_user && convo.other_user.name) || 'User';

  document.getElementById('chatPartnerName').textContent = name;
  document.getElementById('chatPartnerAv').textContent   = name.charAt(0).toUpperCase();

  document.getElementById('msgContactsPanel').style.display = 'none';
  document.getElementById('msgChatPanel').classList.add('show');
  document.getElementById('chatMessages').innerHTML = '';

  const token = localStorage.getItem('barterToken');
  try {
    const res = await fetch(`${API_BASE_URL}/messages/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    renderChatMessages(data.messages || []);
  } catch(e) {
    console.error('Could not load messages:', e);
  }

  if (convo) convo.unread_count = 0;
  updateNotificationBadges();

  const msgs = document.getElementById('chatMessages');
  setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 50);
}

function myUserId() {
  const u = getUser();
  return u && u.id;
}

function renderChatMessages(list) {
  const myId = myUserId();
  const el = document.getElementById('chatMessages');
  el.innerHTML = list.map(m => {
    const mine = String(m.sender_id) === String(myId);
    return `
    <div>
      <div class="msg-bubble ${mine ? 'me' : 'them'}">${esc(m.content)}</div>
      <div class="msg-bubble-time" style="text-align:${mine?'right':'left'}">${formatMsgTime(m.created_at)}</div>
    </div>`;
  }).join('');
}

function appendMessageBubble(message, isMine) {
  const myId = myUserId();
  const mine = isMine || String(message.sender_id) === String(myId);
  const el = document.getElementById('chatMessages');
  el.insertAdjacentHTML('beforeend', `
    <div>
      <div class="msg-bubble ${mine ? 'me' : 'them'}">${esc(message.content)}</div>
      <div class="msg-bubble-time" style="text-align:${mine?'right':'left'}">${formatMsgTime(message.created_at)}</div>
    </div>`);
  el.scrollTop = el.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text || !activeConversationId) return;

  input.value = '';
  const token = localStorage.getItem('barterToken');
  const formData = new FormData();
  formData.append('content', text);

  try {
    const res = await fetch(`${API_BASE_URL}/messages/conversations/${activeConversationId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (!res.ok) throw new Error('Failed to send');
    const data = await res.json();

    appendMessageBubble(data.message, true);

    const convo = conversations.find(c => c.id === activeConversationId);
    if (convo) { convo.last_message = text; convo.last_message_at = data.message.created_at; }
  } catch(e) {
    showToast('Could not send message.', 'error');
    input.value = text; // wapis daal do taake user retry kar sake
  }
}

// ════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════
function showToast(msg, type='') {
  const icons = { success:'fa-circle-check', error:'fa-circle-xmark', '':'fa-circle-info' };
  const t = document.createElement('div');
  t.className = `toast-msg ${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type]||icons['']}"></i> ${msg}`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ════════════════════════════════════════════════════
// ADD LISTING — IMAGE UPLOAD
// ════════════════════════════════════════════════════
let uploadedImages = [null, null, null, null];
let uploadedImageFiles = [null, null, null, null];
let editingId = null;

function renderUploadSlots() {
  const grid = document.getElementById('uploadGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const box = document.createElement('div');
    box.className = 'upload-box';
    if (uploadedImages[i]) {
      box.innerHTML = `
        <img src="${uploadedImages[i]}" class="preview-img" alt="img ${i+1}">
        <button type="button" class="remove-img" onclick="removeImage(${i})">
          <i class="fa-solid fa-times"></i>
        </button>`;
    } else {
      box.innerHTML = `
        <i class="fa-solid fa-cloud-arrow-up"></i>
        <span>${i === 0 ? 'Upload' : 'Add'}</span>
        <input type="file" accept="image/*" onchange="handleImageUpload(event,${i})">`;
    }
    grid.appendChild(box);
  }
}

function handleImageUpload(e, index) {
  const file = e.target.files[0];
  if (!file) return;
  uploadedImageFiles[index] = file;
  const reader = new FileReader();
  reader.onload = ev => { uploadedImages[index] = ev.target.result; renderUploadSlots(); };
  reader.readAsDataURL(file);
}

function removeImage(index) {
  uploadedImages[index] = null;
  uploadedImageFiles[index] = null;
  renderUploadSlots();
}

function resetListingForm() {
  editingId = null;
  uploadedImages = [null, null, null, null];
  uploadedImageFiles = [null, null, null, null];
  const form = document.getElementById('listItemForm');
  if (form) form.reset();
  renderUploadSlots();
  // Reset counter
  const counter = document.getElementById('tradeCounter');
  const msg     = document.getElementById('tradeCounterMsg');
  if (counter) { counter.textContent = '0/20'; counter.classList.remove('at-limit'); }
  if (msg)     msg.style.display = 'none';
  // Reset title/button labels
  const t = document.getElementById('addListingTitle');
  const s = document.getElementById('addListingSubtitle');
  const b = document.getElementById('publishBtnText');
  if (t) t.textContent = 'Add a Barter Listing';
  if (s) s.textContent = 'Share details about what you\'d like to exchange.';
  if (b) b.textContent = 'Publish Listing';
}

function loadEditIntoForm(id) {
  const p = myPosts.find(x => String(x.id) === String(id));
  if (!p) return;
  editingId = id;
  document.getElementById('addListingTitle').textContent  = 'Edit Listing';
  document.getElementById('addListingSubtitle').textContent = 'Update your barter listing details.';
  document.getElementById('publishBtnText').textContent   = 'Save Changes';
  document.getElementById('itemTitle').value = p.title || '';
  document.getElementById('itemDesc').value  = p.desc  || '';
  document.getElementById('itemCat').value   = p.cat || p.category || '';
  document.getElementById('itemCond').value  = p.cond ? String(p.cond) : '';
  const tradeVal = (p.trade || '').slice(0, 20);
  document.getElementById('itemTrade').value = tradeVal;
  // Sync counter with loaded value
  updateTradeCounter(document.getElementById('itemTrade'));
  if (p.valueFrom !== undefined) {
    document.getElementById('valueFrom').value = p.valueFrom;
    document.getElementById('valueTo').value   = p.valueTo || '';
  } else if (p.value) {
    document.getElementById('valueFrom').value = p.value;
    document.getElementById('valueTo').value   = p.value;
  }
  const imgs = p.images || (p.image ? [p.image] : []);
  imgs.forEach((src, i) => { if (i < 4) uploadedImages[i] = src; });
  renderUploadSlots();
}

function cancelListingForm() {
  resetListingForm();
  navigate('dashHome');
}

function buildLocalProductFromBackend(post, fallback) {
  const imageList = Array.isArray(post.images)
    ? post.images.map(img => typeof img === 'string' ? img : (img && img.image_url) ? img.image_url : null).filter(Boolean)
    : [];
  const seller = post.seller || {};
  const sellerName = seller.name || fallback.sellerName || 'User';
  return {
    id: String(post.id || post.p_id || post.post_id || `p-${Date.now()}`),
    title: post.title || fallback.title,
    cat: post.cat || post.category || fallback.cat,
    category: post.category || post.cat || fallback.cat,
    desc: post.desc || post.description || fallback.desc,
    trade: post.trade || post.in_exchange_for || fallback.trade,
    cond: Number(post.cond ?? post.condition_score ?? fallback.cond ?? 0),
    condLabel: post.condLabel || fallback.condLabel,
    value: Number(post.value ?? post.valueFrom ?? fallback.valueFrom ?? 0),
    valueFrom: Number(post.valueFrom ?? post.price_from ?? fallback.valueFrom ?? 0),
    valueTo: Number(post.valueTo ?? post.price_to ?? fallback.valueTo ?? 0),
    images: imageList,
    status: post.status || 'active',
    date: post.date || fallback.date,
    created_at: post.created_at || null,
    seller: {
      name: sellerName,
      avatar: seller.avatar || fallback.sellerAvatar || null
    },
    ownerEmail: post.ownerEmail || fallback.ownerEmail || ''
  };
}

async function publishListing(e) {
  e.preventDefault();
  const title = document.getElementById('itemTitle').value.trim();
  const cat   = document.getElementById('itemCat').value;
  if (!title || !cat) { showToast('Please fill in Title and Category.','error'); return; }

  const description = document.getElementById('itemDesc').value.trim();
  const descriptionWords = description ? description.split(/\s+/).length : 0;
  if (descriptionWords < 16 || descriptionWords > 34) {
    showToast(`Description must contain 16 to 34 words. You entered ${descriptionWords}.`, 'error');
    document.getElementById('itemDesc').focus();
    return;
  }

  const token = localStorage.getItem('barterToken');
  if (!token) { showToast('Please log in again before publishing.', 'error'); return; }

  const fromVal  = parseInt(document.getElementById('valueFrom').value) || 0;
  const toVal    = parseInt(document.getElementById('valueTo').value)   || fromVal;
  const condVal  = parseInt(document.getElementById('itemCond').value)  || 0;
  const tradeVal = (document.getElementById('itemTrade').value.trim()).slice(0, 30);

  const formData = new FormData();
  formData.append('title',            title);
  formData.append('description',      description);
  formData.append('in_exchange_for',  tradeVal);
  formData.append('category',         cat);
  formData.append('price_from',       String(fromVal));
  formData.append('price_to',         String(toVal));
  formData.append('condition_score',  String(condVal));

  if (editingId) {
    // ── EDIT: PUT /posts/{id} ──
    // Only attach NEW files (existing images stay on server)
    uploadedImageFiles.forEach(file => {
      if (file) formData.append('images', file);
    });

    try {
      const res = await fetch(`${API_BASE_URL}/posts/${editingId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || 'Failed to update listing');

      await loadMyPosts();
      showToast('Listing updated! ✅', 'success');
      resetListingForm();
      setTimeout(() => navigate('activeListings'), 900);
    } catch(err) {
      showToast(err.message || 'Could not update listing.', 'error');
    }

  } else {
    // ── CREATE: POST /posts/ ──
    uploadedImageFiles.forEach(file => {
      if (file) formData.append('images', file);
    });

    try {
      const res = await fetch(`${API_BASE_URL}/posts/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || data?.message || 'Failed to publish listing');

      await loadMyPosts();
      showToast('Listing published! 🎉', 'success');
      resetListingForm();
      setTimeout(() => navigate('activeListings'), 900);
    } catch(err) {
      showToast(err.message || 'Could not publish listing.', 'error');
    }
  }
}

// ════════════════════════════════════════════════════
// ADD LISTING — TRADE COUNTER & VALUE SYNC
// ════════════════════════════════════════════════════
function updateTradeCounter(el) {
  const max = 30;
  // Enforce hard limit (belt-and-suspenders beyond maxlength)
  if (el.value.length > max) el.value = el.value.slice(0, max);
  const len = el.value.length;
  const counter = document.getElementById('tradeCounter');
  const msg     = document.getElementById('tradeCounterMsg');
  if (!counter) return;
  counter.textContent = `${len}/${max}`;
  if (len >= max) {
    counter.classList.add('at-limit');
    if (msg) msg.style.display = 'inline';
  } else {
    counter.classList.remove('at-limit');
    if (msg) msg.style.display = 'none';
  }
}

function syncValueTo() {
  const from = parseInt(document.getElementById('valueFrom').value) || 0;
  const toEl  = document.getElementById('valueTo');
  if (from && (!toEl.value || parseInt(toEl.value) < from)) {
    toEl.placeholder = from + '+';
  }
}

// ════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════
// ════════════════════════════════════════════════════
// TOKEN EXPIRY HANDLING
// ════════════════════════════════════════════════════
function handleTokenExpiry() {
  localStorage.removeItem('barterToken');
  localStorage.removeItem('barterUser');
  localStorage.removeItem('bartifyUser');
  showToast('Session expired. Please log in again.', 'error');
  setTimeout(() => { window.location.href = 'index.html'; }, 1500);
}

// Wrap fetch calls to handle 401 globally
const originalFetch = window.fetch;
window.fetch = function(...args) {
  return originalFetch.apply(this, args).then(response => {
    if (response.status === 401) {
      handleTokenExpiry();
    }
    return response;
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  const u = getOrInitUser();
  applyUserToUI(u);

  await loadMyPosts();
  await loadReceivedOffers();
  await loadSentOffers();
  await loadConversations();
  updateNotificationBadges();
  connectMessagesSocket();

  // Check if redirected with a specific section (from index.html "List Item", etc.)
  const urlParams = new URLSearchParams(window.location.search);
  const sectionParam = urlParams.get('section');
  const validSections = ['dashHome','addListing','editListing','deleteListing',
    'activeListings','pendingListings','requestsReceived','requestsSent',
    'rejectedRequests','completedRequests','viewProfile','editProfile','changePassword'];
  if (sectionParam && validSections.includes(sectionParam)) {
    navigate(sectionParam);
    return;
  }

  showSection('dashHome');
});