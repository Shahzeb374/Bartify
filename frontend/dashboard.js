// ════════════════════════════════════════════════════
// USER — reads from BOTH keys (index uses barterUser)
// ════════════════════════════════════════════════════
const API_BASE_URL = 'http://127.0.0.1:8000';

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('barterUser') ||
                      localStorage.getItem('bartifyUser') || 'null') || {};
  } catch(e) { return {}; }
}

function toImageUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || String(path).startsWith('data:')) return path;
  return `${API_BASE_URL}/${String(path).replace(/^\/+/, '')}`;
}

function getAvatarPath(u) {
  return toImageUrl(u.avatar || u.picture || u.user_image || null);
}

function saveUser(u) {
  // Write to both keys so all pages stay in sync
  localStorage.setItem('barterUser', JSON.stringify(u));
  localStorage.setItem('bartifyUser', JSON.stringify(u));
}
function getOrInitUser() {
  let u = getUser();
  if (!u.email) {
    u = { firstName:'John', lastName:'Doe', email:'john@example.com',
          phone:'+92 300 1234567', city:'Karachi', bio:'', avatar:null,
          name:'John Doe' };
    saveUser(u);
  }
  return u;
}

// ════════════════════════════════════════════════════
// PRODUCTS — uses bartifyProducts (shared with index)
// ════════════════════════════════════════════════════
function getProducts() {
  try { return JSON.parse(localStorage.getItem('bartifyProducts') || '[]'); }
  catch(e) { return []; }
}
function saveProducts(list) { localStorage.setItem('bartifyProducts', JSON.stringify(list)); }

// ════════════════════════════════════════════════════
// BARTER REQUESTS (in-memory demo)
// ════════════════════════════════════════════════════
let barterRequests = [
  { id:1, fromUser:'Sara Ahmed', fromInitial:'S', time:'2 hours ago',
    yourItem:  { title:'Vintage Leather Armchair', image:'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=80&q=80' },
    theirItem: { title:'Gaming Laptop',            image:'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=80&q=80' },
    status:'received', message:"I'd love to exchange my gaming laptop for your armchair!" },
  { id:2, fromUser:'Ali Raza', fromInitial:'A', time:'1 day ago',
    yourItem:  { title:'Canon EOS 5D Mark III',   image:'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=80&q=80' },
    theirItem: { title:'MacBook Pro 2022',         image:'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=80&q=80' },
    status:'received', message:'Would love to trade my MacBook for your camera!' }
];
let completedBarters = [
  { id:10, fromUser:'Hina Malik', fromInitial:'H', time:'1 week ago',
    yourItem:  { title:'Bookshelf (Oak)', image:'https://images.unsplash.com/photo-1549497538-303791108f95?w=80&q=80' },
    theirItem: { title:'Coffee Table',   image:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=80&q=80' },
    status:'completed' }
];
let cancelledBarters = [
  { id:20, fromUser:'Usman Khan', fromInitial:'U', time:'3 days ago',
    yourItem:  { title:'Mountain Bike',      image:'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=80&q=80' },
    theirItem: { title:'Tennis Racket Set',  image:'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=80&q=80' },
    status:'cancelled' }
];

let pendingDeleteId = null;
let tempAvatarDataUrl = undefined;
let currentSection = 'dashHome';

// ════════════════════════════════════════════════════
// APPLY USER TO UI
// ════════════════════════════════════════════════════
function applyUserToUI(u) {
  const firstName = u.firstName || (u.name ? u.name.split(' ')[0] : 'User');
  const lastName  = u.lastName  || (u.name ? u.name.split(' ').slice(1).join(' ') : '');
  const full      = `${firstName} ${lastName}`.trim() || 'User';
  const initial   = firstName.charAt(0).toUpperCase();
  const av        = getAvatarPath(u);

  document.getElementById('sidebarName').textContent  = full;
  document.getElementById('sidebarEmail').textContent = u.email || '';
  setAvatarEl(document.getElementById('sidebarAvatar'), av, initial);

  document.getElementById('dropdownName').textContent  = full;
  document.getElementById('dropdownEmail').textContent = u.email || '';

  const hBtn = document.getElementById('headerProfileBtn');
  hBtn.innerHTML = av
    ? `<img src="${av}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : `<i class="fa-solid fa-user"></i>`;

  // Dashboard greeting
  const greet = document.getElementById('dashGreet');
  if (greet) greet.textContent = `Welcome back, ${firstName}! 👋`;
}

function setAvatarEl(el, src, initial) {
  if (src) { el.innerHTML = `<img src="${src}" alt="avatar">`; }
  else      { el.textContent = initial; }
}

// ════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════
function navClick(el) {
  // Called from onclick on anchor/nav-direct — prevent default if href="#"
  event && event.preventDefault && event.preventDefault();
  const section = el.dataset.section;
  if (!section) return;

  // Deactivate all
  document.querySelectorAll('.nav-direct, .nav-sub a').forEach(a => a.classList.remove('active'));
  el.classList.add('active');

  showSection(section);
  if (window.innerWidth < 769) closeSidebarMobile();
}

function navigate(section) {
  document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
  // Find matching nav link
  const link = document.querySelector(`[data-section="${section}"]`);
  document.querySelectorAll('.nav-direct, .nav-sub a').forEach(a => a.classList.remove('active'));
  if (link) link.classList.add('active');
  showSection(section);
}

function showSection(section) {
  currentSection = section;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('sec-' + section);
  if (el) { el.classList.add('active'); }

  // Update header title
  const titles = {
    dashHome:'Dashboard', addListing:'Add a Barter Listing',
    editListing:'Edit Listing', deleteListing:'Delete Listing',
    activeListings:'Active Listings', pendingListings:'Pending Listings',
    requestsReceived:'Barter Requests', completedRequests:'Completed Requests',
    cancelledRequests:'Cancelled Requests', viewProfile:'My Profile',
    editProfile:'Edit Profile', changePassword:'Change Password'
  };
  document.getElementById('headerTitle').textContent = titles[section] || 'Dashboard';

  renderSection(section);
}

function renderSection(s) {
  const map = {
    dashHome: renderDashHome,
    editListing: renderEditList,
    deleteListing: renderDeleteList,
    activeListings: renderActiveListings,
    pendingListings: renderPendingListings,
    requestsReceived: renderRequestsReceived,
    completedRequests: renderCompletedRequests,
    cancelledRequests: renderCancelledRequests,
    viewProfile: renderViewProfile,
    editProfile: populateEditProfileForm
  };
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
// DASHBOARD HOME
// ════════════════════════════════════════════════════
function renderDashHome() {
  const products = getProducts();
  const myActive  = products.filter(p => p.status === 'active'  || !p.status);
  const myPending = products.filter(p => p.status === 'pending');

  document.getElementById('statActive').textContent    = myActive.length;
  document.getElementById('statPending').textContent   = myPending.length;
  document.getElementById('statCompleted').textContent = completedBarters.length;
  document.getElementById('statRequests').textContent  = barterRequests.length;

  // Recent listings (last 5)
  const recent = products.slice(-5).reverse();
  const rlEl = document.getElementById('dashRecentListings');
  if (!recent.length) {
    rlEl.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px;">No listings yet. <a href="list-item.html" style="color:var(--primary);font-weight:600;">Add one →</a></div>`;
  } else {
    rlEl.innerHTML = recent.map(p => {
      const img = (p.images && p.images[0]) ? p.images[0] : (p.image || null);
      const imgEl = img
        ? `<div class="recent-thumb"><img src="${img}" alt=""></div>`
        : `<div class="recent-thumb"><i class="fa-solid fa-image"></i></div>`;
      const status = p.status || 'active';
      const badgeCls = status === 'active' ? 'rb-active' : 'rb-pending';
      return `<div class="recent-row" onclick="navigate('activeListings')">
        ${imgEl}
        <div class="recent-info">
          <div class="recent-title">${esc(p.title)}</div>
          <div class="recent-meta">Rs. ${Number(p.value||0).toLocaleString()} · ${esc(p.cat||p.category||'General')}</div>
        </div>
        <span class="recent-badge ${badgeCls}">${status.charAt(0).toUpperCase()+status.slice(1)}</span>
      </div>`;
    }).join('');
  }

  // Activity feed
  const actEl = document.getElementById('dashActivity');
  const activities = [
    { dot:'blue',  icon:'fa-plus',              text:'You listed <strong>Vintage Leather Armchair</strong>',  time:'2 days ago' },
    { dot:'purple',icon:'fa-bell',              text:'<strong>Sara Ahmed</strong> sent you a barter request', time:'2 hours ago' },
    { dot:'green', icon:'fa-handshake',         text:'Exchange with <strong>Hina Malik</strong> completed',   time:'1 week ago' },
    { dot:'amber', icon:'fa-pen',               text:'You updated <strong>Canon EOS 5D Mark III</strong>',   time:'3 days ago' },
    { dot:'red',   icon:'fa-xmark',             text:'Request from <strong>Usman Khan</strong> declined',    time:'3 days ago' },
  ];
  actEl.innerHTML = activities.map(a => `
    <div class="activity-row">
      <div class="act-dot ${a.dot}"><i class="fa-solid ${a.icon}"></i></div>
      <div>
        <div class="act-text">${a.text}</div>
        <div class="act-time">${a.time}</div>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════
function condClass(c) {
  return { 'Like New':'like-new', 'Good':'good', 'Fair':'fair', 'Poor':'fair' }[c] || '';
}

function thumbEl(p) {
  // Support both {image} (old) and {images:[]} (new)
  const src = (p.images && p.images[0]) ? p.images[0] : (p.image || null);
  return src
    ? `<div class="listing-thumb"><img src="${src}" alt="${esc(p.title)}" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-image\\'></i>'"></div>`
    : `<div class="listing-thumb"><i class="fa-solid fa-image"></i></div>`;
}

function emptyState(icon, title, msg, btn='') {
  return `<div style="background:var(--card-bg);border:1.5px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);">
    <div class="empty-state"><div class="icon"><i class="${icon}"></i></div>
    <h4>${title}</h4><p>${msg}</p>${btn}</div></div>`;
}

function normCond(p) {
  return p.condLabel || p.condition || 'Good';
}
function normValue(p) {
  return Number(p.value || 0).toLocaleString();
}
function normCat(p) { return p.cat || p.category || ''; }

// ════════════════════════════════════════════════════
// EDIT LISTING — redirect to list-item.html
// ════════════════════════════════════════════════════
function renderEditList() {
  const products = getProducts();
  const c = document.getElementById('editListingList');
  if (!products.length) {
    c.innerHTML = emptyState('fa-solid fa-pen-to-square','No listings to edit','Add a listing first.',
      `<a href="list-item.html" class="btn-primary-sm" style="margin:0 auto;"><i class="fa-solid fa-plus"></i> Add Listing</a>`);
    return;
  }
  c.innerHTML = products.map(p => `
    <div class="listing-card">
      ${thumbEl(p)}
      <div class="listing-info">
        <div class="listing-name">${esc(p.title)}</div>
        <div class="listing-desc">${esc(p.desc||'')}</div>
        <div class="listing-meta">
          <span class="badge-condition ${condClass(normCond(p))}">${normCond(p)}</span>
          <span class="listing-price">Rs. ${normValue(p)}</span>
          <span style="font-size:11px;color:var(--text-muted);">${esc(normCat(p))}</span>
        </div>
      </div>
      <div class="listing-actions">
        <button class="btn-edit-sm" onclick="goEdit('${p.id}')"><i class="fa-solid fa-pen"></i> Edit</button>
      </div>
    </div>`).join('');
}

function goEdit(id) {
  localStorage.setItem('bartifyEditListingId', id);
  window.location.href = 'list-item.html?mode=edit&id=' + id;
}

// ════════════════════════════════════════════════════
// DELETE LISTING
// ════════════════════════════════════════════════════
function renderDeleteList() {
  const products = getProducts();
  const c = document.getElementById('deleteListingList');
  if (!products.length) {
    c.innerHTML = emptyState('fa-solid fa-trash','No listings','You have no listings to delete.');
    return;
  }
  c.innerHTML = products.map(p => `
    <div class="listing-card">
      ${thumbEl(p)}
      <div class="listing-info">
        <div class="listing-name">${esc(p.title)}</div>
        <div class="listing-desc">${esc(p.desc||'')}</div>
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

function doDelete() {
  saveProducts(getProducts().filter(x => String(x.id) !== String(pendingDeleteId)));
  bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
  showToast('Listing deleted.', 'success');
  renderSection(currentSection);
  renderDashHome();
}

// ════════════════════════════════════════════════════
// ACTIVE LISTINGS
// ════════════════════════════════════════════════════
function renderActiveListings() {
  const products = getProducts();
  const active = products.filter(p => !p.status || p.status === 'active');
  document.getElementById('activeCount').textContent = `${active.length} Active`;
  const c = document.getElementById('activeListingsList');
  if (!active.length) {
    c.innerHTML = emptyState('fa-solid fa-boxes-stacked','No active listings','Your active listings will appear here.',
      `<a href="list-item.html" class="btn-primary-sm" style="margin:0 auto;"><i class="fa-solid fa-plus"></i> Add Listing</a>`);
    return;
  }
  c.innerHTML = active.map(p => `
    <div class="listing-card">
      ${thumbEl(p)}
      <div class="listing-info">
        <div class="listing-name">${esc(p.title)}</div>
        <div class="listing-desc">${esc(p.desc||'')}</div>
        <div class="listing-extra-meta">
          <div class="meta-item"><span class="meta-label">Category</span><span class="meta-value">${esc(normCat(p))}</span></div>
          <div class="meta-item"><span class="meta-label">Condition</span><span class="meta-value">${normCond(p)}</span></div>
          <div class="meta-item"><span class="meta-label">Est. Value</span><span class="meta-value">Rs. ${normValue(p)}</span></div>
          <div class="meta-item"><span class="meta-label">Posted</span><span class="meta-value">${p.date||'—'}</span></div>
        </div>
        <div class="listing-meta mt-2">
          <button class="btn-view-sm"><i class="fa-regular fa-eye"></i> View</button>
          <button class="btn-edit-sm" onclick="goEdit('${p.id}')"><i class="fa-solid fa-pen"></i> Edit</button>
        </div>
      </div>
      <div class="listing-actions"><span class="listing-status status-active">Active</span></div>
    </div>`).join('');
}

// ════════════════════════════════════════════════════
// PENDING LISTINGS
// ════════════════════════════════════════════════════
function renderPendingListings() {
  const products = getProducts();
  const pending = products.filter(p => p.status === 'pending');
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
        <div class="listing-desc">${esc(p.desc||'')}</div>
        <div class="listing-extra-meta">
          <div class="meta-item"><span class="meta-label">Condition</span><span class="meta-value">${normCond(p)}</span></div>
          <div class="meta-item"><span class="meta-label">Est. Value</span><span class="meta-value">Rs. ${normValue(p)}</span></div>
          <div class="meta-item"><span class="meta-label">Submitted</span><span class="meta-value">${p.date||'—'}</span></div>
        </div>
      </div>
      <div class="listing-actions"><span class="listing-status status-pending">Pending</span></div>
    </div>`).join('');
}

// ════════════════════════════════════════════════════
// BARTER REQUESTS
// ════════════════════════════════════════════════════
function requestCard(req, actions='') {
  const badge = req.status !== 'received'
    ? `<span class="listing-status status-${req.status}" style="text-transform:capitalize;">${req.status}</span>` : '';
  return `
    <div class="request-card">
      <div class="request-top">
        <div class="request-user">
          <div class="request-avatar">${req.fromInitial}</div>
          <div><div class="request-username">${esc(req.fromUser)}</div>
            <div class="request-time"><i class="fa-regular fa-clock"></i> ${req.time}</div></div>
        </div>${badge}
      </div>
      ${req.message ? `<p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">"${esc(req.message)}"</p>` : ''}
      <div class="request-exchange">
        <div class="exchange-item">
          <div class="exchange-thumb"><img src="${req.theirItem.image}" alt="" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-box\\'></i>'"></div>
          <div><div class="exchange-label">Their Offer</div><div class="exchange-name">${esc(req.theirItem.title)}</div></div>
        </div>
        <div class="exchange-arrow"><i class="fa-solid fa-arrow-right-arrow-left"></i></div>
        <div class="exchange-item">
          <div class="exchange-thumb"><img src="${req.yourItem.image}" alt="" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-box\\'></i>'"></div>
          <div><div class="exchange-label">Your Item</div><div class="exchange-name">${esc(req.yourItem.title)}</div></div>
        </div>
      </div>
      ${actions ? `<div class="request-actions">${actions}</div>` : ''}
    </div>`;
}

function renderRequestsReceived() {
  document.getElementById('receivedCount').textContent = `${barterRequests.length} Requests`;
  const c = document.getElementById('requestsReceivedList');
  if (!barterRequests.length) {
    c.innerHTML = emptyState('fa-solid fa-arrow-right-arrow-left','No requests yet','Barter requests will appear here.');
    return;
  }
  c.innerHTML = barterRequests.map((r,i) => requestCard(r,`
    <button class="btn-accept-sm" onclick="acceptRequest(${i})"><i class="fa-solid fa-check"></i> Accept</button>
    <button class="btn-reject-sm" onclick="rejectRequest(${i})"><i class="fa-solid fa-times"></i> Decline</button>
    <button class="btn-view-sm" onclick="openChatWith('${r.fromUser}','${r.fromInitial}')"><i class="fa-regular fa-message"></i> Message</button>
  `)).join('');
}

function acceptRequest(i) {
  const r = barterRequests.splice(i,1)[0]; r.status='completed'; completedBarters.unshift(r);
  showToast('Barter request accepted!','success'); renderRequestsReceived(); renderDashHome();
}
function rejectRequest(i) {
  const r = barterRequests.splice(i,1)[0]; r.status='cancelled'; cancelledBarters.unshift(r);
  showToast('Request declined.','error'); renderRequestsReceived(); renderDashHome();
}
function renderCompletedRequests() {
  const c = document.getElementById('completedRequestsList');
  c.innerHTML = completedBarters.length
    ? completedBarters.map(r => requestCard(r)).join('')
    : emptyState('fa-solid fa-handshake','No completed barters','Accepted exchanges will appear here.');
}
function renderCancelledRequests() {
  const c = document.getElementById('cancelledRequestsList');
  c.innerHTML = cancelledBarters.length
    ? cancelledBarters.map(r => requestCard(r)).join('')
    : emptyState('fa-solid fa-ban','No cancelled requests','Declined or cancelled exchanges will appear here.');
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
  document.getElementById('profileViewCity').textContent  = u.city  || '—';

  const bw = document.getElementById('profileBioWrap');
  bw.style.display = u.bio ? 'block' : 'none';
  if (u.bio) document.getElementById('profileViewBio').textContent = u.bio;

  const av = getAvatarPath(u);
  setAvatarEl(document.getElementById('profileViewAvatar'), av, initial);
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
  document.getElementById('epCity').value      = u.city  || '';
  document.getElementById('epBio').value       = u.bio   || '';
  const av = getAvatarPath(u);
  setAvatarEl(document.getElementById('editAvatarPreview'), av, firstName.charAt(0).toUpperCase()||'U');
}

function handleAvatarChange(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    tempAvatarDataUrl = ev.target.result;
    document.getElementById('editAvatarPreview').innerHTML = `<img src="${tempAvatarDataUrl}" alt="avatar">`;
  };
  reader.readAsDataURL(file);
}

function saveProfile(e) {
  e.preventDefault();
  const u = getOrInitUser();
  u.firstName = document.getElementById('epFirstName').value.trim();
  u.lastName  = document.getElementById('epLastName').value.trim();
  u.name      = `${u.firstName} ${u.lastName}`.trim();
  u.phone     = document.getElementById('epPhone').value.trim();
  u.city      = document.getElementById('epCity').value.trim();
  u.bio       = document.getElementById('epBio').value.trim();
  if (tempAvatarDataUrl !== undefined) { u.avatar = tempAvatarDataUrl; u.picture = tempAvatarDataUrl; }
  saveUser(u);
  applyUserToUI(u);
  showToast('Profile updated successfully!','success');
  navigate('viewProfile');
}

// ════════════════════════════════════════════════════
// CHANGE PASSWORD
// ════════════════════════════════════════════════════
function changePassword(e) {
  e.preventDefault();
  const np = document.getElementById('cpNew').value;
  const cp = document.getElementById('cpConfirm').value;
  if (np !== cp) { showToast('Passwords do not match.','error'); return; }
  const u = getOrInitUser(); u.password = np; saveUser(u);
  showToast('Password updated successfully!','success');
  e.target.reset();
}

// ════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════
function confirmLogout() { new bootstrap.Modal(document.getElementById('logoutModal')).show(); }
function doLogout() {
  bootstrap.Modal.getInstance(document.getElementById('logoutModal')).hide();
  showToast('Logged out. Redirecting…');
  setTimeout(() => { window.location.href = 'index.html'; }, 1400);
}

// ════════════════════════════════════════════════════
// MESSAGES WIDGET
// ════════════════════════════════════════════════════
const DEMO_CONTACTS = [
  { name:'Sara Ahmed',  init:'S', preview:'I\'d love to exchange!', unread:2 },
  { name:'Ali Raza',    init:'A', preview:'Is the camera still available?', unread:1 },
  { name:'Hina Malik',  init:'H', preview:'Exchange completed ✓',   unread:0 },
  { name:'Usman Khan',  init:'U', preview:'No thanks, changed my mind.', unread:0 }
];

const DEMO_MSGS = {
  'Sara Ahmed': [
    { from:'them', text:"Hi! I'd love to exchange my gaming laptop for your armchair.", time:'10:34 AM' },
    { from:'me',   text:'Hey Sara! Sure, what specs is the laptop?',                   time:'10:36 AM' },
    { from:'them', text:'It\'s a Dell XPS 15, i7, 16GB RAM, 512GB SSD.',              time:'10:38 AM' },
    { from:'me',   text:'That sounds fair! Let\'s arrange a meetup.',                  time:'10:40 AM' }
  ],
  'Ali Raza': [
    { from:'them', text:'Is the Canon EOS 5D still available?', time:'Yesterday' },
    { from:'me',   text:'Yes it is! Interested in trading?',   time:'Yesterday' }
  ]
};

let activeContact = null;
let allContacts   = [...DEMO_CONTACTS];
let chatHistory   = { ...DEMO_MSGS };

function openMessages() {
  document.getElementById('msgOverlay').classList.add('show');
  renderContactsList(allContacts);
  showContactsList();
}
function closeMessages() { document.getElementById('msgOverlay').classList.remove('show'); }
function msgOverlayClick(e) { if (e.target === document.getElementById('msgOverlay')) closeMessages(); }

function renderContactsList(contacts) {
  const el = document.getElementById('msgContactsList');
  if (!contacts.length) { el.innerHTML = `<div style="padding:24px;text-align:center;font-size:13px;color:var(--text-muted);">No conversations yet.</div>`; return; }
  el.innerHTML = contacts.map(c => `
    <div class="msg-contact" onclick="openChat('${c.name}','${c.init}')">
      <div class="msg-contact-av">${c.init}</div>
      <div style="flex:1;min-width:0;">
        <div class="msg-contact-name">${esc(c.name)}</div>
        <div class="msg-contact-preview">${esc(c.preview)}</div>
      </div>
      ${c.unread ? `<span class="msg-unread">${c.unread}</span>` : ''}
    </div>`).join('');
}

function filterContacts(q) {
  const filtered = allContacts.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
  renderContactsList(filtered);
}

function showContactsList() {
  document.getElementById('msgContactsPanel').style.display = 'flex';
  document.getElementById('msgContactsPanel').style.flexDirection = 'column';
  document.getElementById('msgChatPanel').classList.remove('show');
  activeContact = null;
}

function openChatWith(name, init) {
  openMessages();
  setTimeout(() => openChat(name, init), 50);
}

function openChat(name, init) {
  activeContact = name;
  document.getElementById('chatPartnerName').textContent = name;
  document.getElementById('chatPartnerAv').textContent   = init;

  // Mark as read
  const c = allContacts.find(x => x.name === name);
  if (c) c.unread = 0;

  // Show chat panel
  document.getElementById('msgContactsPanel').style.display = 'none';
  document.getElementById('msgChatPanel').classList.add('show');

  renderChatMessages(name);
  setTimeout(() => { const msgs = document.getElementById('chatMessages'); msgs.scrollTop = msgs.scrollHeight; }, 50);
}

function renderChatMessages(name) {
  const msgs = chatHistory[name] || [];
  const el   = document.getElementById('chatMessages');
  el.innerHTML = msgs.map(m => `
    <div>
      <div class="msg-bubble ${m.from}">${esc(m.text)}</div>
      <div class="msg-bubble-time" style="text-align:${m.from==='me'?'right':'left'}">${m.time}</div>
    </div>`).join('');
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text || !activeContact) return;
  if (!chatHistory[activeContact]) chatHistory[activeContact] = [];
  chatHistory[activeContact].push({ from:'me', text, time:'Just now' });
  renderChatMessages(activeContact);
  input.value = '';
  const msgs = document.getElementById('chatMessages');
  setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 50);

  // Update preview
  const c = allContacts.find(x => x.name === activeContact);
  if (c) c.preview = text;
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

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const u = getOrInitUser();
  applyUserToUI(u);

  if (localStorage.getItem('bartifyJustAdded')) {
    localStorage.removeItem('bartifyJustAdded');
    showToast('Listing published successfully!','success');
    navigate('activeListings');
    return;
  }
  if (localStorage.getItem('bartifyJustEdited')) {
    localStorage.removeItem('bartifyJustEdited');
    showToast('Listing updated successfully!','success');
    navigate('editListing');
    return;
  }

  showSection('dashHome');
});