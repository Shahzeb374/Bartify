// const API_BASE_URL = 'http://127.0.0.1:8000';
const API_BASE_URL = 'http://192.168.100.6:8000';

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
  let u = getUser();
  if (!u.email) {
    u = { firstName:'John', lastName:'Doe', email:'john@example.com',
          phone:'+92 300 1234567', city:'Karachi', bio:'', avatar:null, name:'John Doe' };
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
function saveProducts(list) {
  localStorage.setItem('bartifyProducts', JSON.stringify(list));
}

// ════════════════════════════════════════════════════
// BARTER REQUESTS (demo data)
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
    yourItem:  { title:'Mountain Bike',     image:'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=80&q=80' },
    theirItem: { title:'Tennis Racket Set', image:'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=80&q=80' },
    status:'cancelled' }
];

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
    completedRequests:'Completed Barter Requests',
    cancelledRequests:'Cancelled Barter Requests',
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
    completedRequests:renderCompletedRequests,
    cancelledRequests:renderCancelledRequests,
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
  const products = getProducts();
  const myActive  = products.filter(p => normStatus(p) === 'active');
  const myPending = products.filter(p => normStatus(p) === 'pending');

  document.getElementById('statActive').textContent    = myActive.length;
  document.getElementById('statPending').textContent   = myPending.length;
  document.getElementById('statCompleted').textContent = completedBarters.length;
  document.getElementById('statRequests').textContent  = barterRequests.length;

  // Recent listings (last 5)
  const recent = products.slice(-5).reverse();
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
        <div class="recent-row" onclick="navigate('activeListings')">
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
  const activities = [
    { dot:'blue',  icon:'fa-plus',      text:'You listed <strong>Vintage Leather Armchair</strong>',  time:'2 days ago' },
    { dot:'purple',icon:'fa-bell',      text:'<strong>Sara Ahmed</strong> sent you a barter request', time:'2 hours ago' },
    { dot:'green', icon:'fa-handshake', text:'Exchange with <strong>Hina Malik</strong> completed',   time:'1 week ago' },
    { dot:'amber', icon:'fa-pen',       text:'You updated <strong>Canon EOS 5D Mark III</strong>',    time:'3 days ago' },
    { dot:'red',   icon:'fa-xmark',     text:'Request from <strong>Usman Khan</strong> declined',     time:'3 days ago' },
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
// EDIT LISTING — redirects to list-item.html
// ════════════════════════════════════════════════════
function renderEditList() {
  const products = getProducts();
  const c = document.getElementById('editListingList');
  if (!products.length) {
    c.innerHTML = emptyState('fa-solid fa-pen-to-square','No listings to edit','Add a listing first.',
      `<a href="#" onclick="navigate('addListing');return false;" class="btn-primary-sm" style="margin:0 auto;"><i class="fa-solid fa-plus"></i> Add Listing</a>`);
    return;
  }
  c.innerHTML = products.map(p => `
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
  navigate('addListing');
  // slight delay so section is visible before we fill it
  setTimeout(() => loadEditIntoForm(id), 30);
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
  const active = products.filter(p => normStatus(p) === 'active');
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
          <button class="btn-view-sm"><i class="fa-regular fa-eye"></i> View</button>
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
  const products = getProducts();
  const pending = products.filter(p => normStatus(p) === 'pending');
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
      </div>
      <div class="listing-actions">
        <span class="listing-status status-pending">Pending</span>
      </div>
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
          <div>
            <div class="request-username">${esc(req.fromUser)}</div>
            <div class="request-time"><i class="fa-regular fa-clock"></i> ${req.time}</div>
          </div>
        </div>
        ${badge}
      </div>
      ${req.message ? `<p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">"${esc(req.message)}"</p>` : ''}
      <div class="request-exchange">
        <div class="exchange-item">
          <div class="exchange-thumb">
            <img src="${req.theirItem.image}" alt="" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-box\\'></i>'">
          </div>
          <div>
            <div class="exchange-label">Their Offer</div>
            <div class="exchange-name">${esc(req.theirItem.title)}</div>
          </div>
        </div>
        <div class="exchange-arrow"><i class="fa-solid fa-arrow-right-arrow-left"></i></div>
        <div class="exchange-item">
          <div class="exchange-thumb">
            <img src="${req.yourItem.image}" alt="" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-box\\'></i>'">
          </div>
          <div>
            <div class="exchange-label">Your Item</div>
            <div class="exchange-name">${esc(req.yourItem.title)}</div>
          </div>
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
    <button class="btn-view-sm" onclick="openChatWith('${r.fromUser}','${r.fromInitial}')">
      <i class="fa-regular fa-message"></i> Message
    </button>
  `)).join('');
}

function acceptRequest(i) {
  const r = barterRequests.splice(i,1)[0];
  r.status = 'completed';
  completedBarters.unshift(r);
  showToast('Barter request accepted!','success');
  renderRequestsReceived();
  renderDashHome();
}

function rejectRequest(i) {
  const r = barterRequests.splice(i,1)[0];
  r.status = 'cancelled';
  cancelledBarters.unshift(r);
  showToast('Request declined.','error');
  renderRequestsReceived();
  renderDashHome();
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
  document.getElementById('epCity').value      = u.city  || '';
  document.getElementById('epBio').value       = u.bio   || '';

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
  const u = getOrInitUser();
  u.password = np;
  saveUser(u);
  showToast('Password updated successfully!','success');
  e.target.reset();
}

// ════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════
function confirmLogout() {
  new bootstrap.Modal(document.getElementById('logoutModal')).show();
}

function doLogout() {
  bootstrap.Modal.getInstance(document.getElementById('logoutModal')).hide();
  showToast('Logged out. Redirecting…');
  setTimeout(() => { window.location.href = 'index.html'; }, 1400);
}

// ════════════════════════════════════════════════════
// MESSAGES WIDGET
// ════════════════════════════════════════════════════
const DEMO_CONTACTS = [
  { name:'Sara Ahmed', init:'S', preview:"I'd love to exchange!", unread:2 },
  { name:'Ali Raza',   init:'A', preview:'Is the camera still available?', unread:1 },
  { name:'Hina Malik', init:'H', preview:'Exchange completed ✓',  unread:0 },
  { name:'Usman Khan', init:'U', preview:'No thanks, changed my mind.', unread:0 }
];

const DEMO_MSGS = {
  'Sara Ahmed': [
    { from:'them', text:"Hi! I'd love to exchange my gaming laptop for your armchair.", time:'10:34 AM' },
    { from:'me',   text:'Hey Sara! Sure, what specs is the laptop?',                   time:'10:36 AM' },
    { from:'them', text:"It's a Dell XPS 15, i7, 16GB RAM, 512GB SSD.",               time:'10:38 AM' },
    { from:'me',   text:"That sounds fair! Let's arrange a meetup.",                   time:'10:40 AM' }
  ],
  'Ali Raza': [
    { from:'them', text:'Is the Canon EOS 5D still available?', time:'Yesterday' },
    { from:'me',   text:'Yes it is! Interested in trading?',    time:'Yesterday' }
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

function closeMessages() {
  document.getElementById('msgOverlay').classList.remove('show');
}

function msgOverlayClick(e) {
  if (e.target === document.getElementById('msgOverlay')) closeMessages();
}

function renderContactsList(contacts) {
  const el = document.getElementById('msgContactsList');
  if (!contacts.length) {
    el.innerHTML = `<div style="padding:24px;text-align:center;font-size:13px;color:var(--text-muted);">No conversations yet.</div>`;
    return;
  }
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
  const cp = document.getElementById('msgContactsPanel');
  cp.style.display = 'flex';
  cp.style.flexDirection = 'column';
  cp.style.flex = '1';
  cp.style.overflow = 'hidden';
  document.getElementById('msgChatPanel').classList.remove('show');
  activeContact = null;
}

function openChatWith(name, init) {
  openMessages();
  setTimeout(() => openChat(name, init), 60);
}

function openChat(name, init) {
  activeContact = name;
  document.getElementById('chatPartnerName').textContent = name;
  document.getElementById('chatPartnerAv').textContent   = init;

  // Mark as read
  const c = allContacts.find(x => x.name === name);
  if (c) c.unread = 0;

  document.getElementById('msgContactsPanel').style.display = 'none';
  document.getElementById('msgChatPanel').classList.add('show');

  renderChatMessages(name);
  setTimeout(() => {
    const msgs = document.getElementById('chatMessages');
    msgs.scrollTop = msgs.scrollHeight;
  }, 50);
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
  const products = JSON.parse(localStorage.getItem('bartifyProducts') || '[]');
  const p = products.find(x => String(x.id) === String(id));
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

  const fromVal  = parseInt(document.getElementById('valueFrom').value) || 0;
  const toVal    = parseInt(document.getElementById('valueTo').value)   || fromVal;
  const condVal  = parseInt(document.getElementById('itemCond').value)  || 0;
  const condLabel = condVal >= 9 ? 'Like New' : condVal >= 7 ? 'Good' : condVal >= 5 ? 'Fair' : condVal > 0 ? 'Poor' : '';
  const tradeVal  = (document.getElementById('itemTrade').value.trim()).slice(0, 20);
  const images   = uploadedImages.filter(Boolean);
  const user     = getUser();
  const today    = new Date().toISOString().split('T')[0];

  let products = JSON.parse(localStorage.getItem('bartifyProducts') || '[]');

  if (editingId) {
    products = products.map(p => {
      if (String(p.id) === String(editingId)) {
        return {
          ...p,
          title, cat, category: cat,
          desc:  document.getElementById('itemDesc').value.trim(),
          trade: tradeVal,
          cond: condVal, condLabel,
          value: fromVal, valueFrom: fromVal, valueTo: toVal,
          images: images.length ? images : (p.images || []),
          status: p.status || 'active'
        };
      }
      return p;
    });
    localStorage.setItem('bartifyProducts', JSON.stringify(products));
    showToast('Listing updated!', 'success');
    resetListingForm();
    setTimeout(() => navigate('activeListings'), 900);
  } else {
    const token = localStorage.getItem('barterToken');
    if (!token) {
      showToast('Please log in again before publishing a listing.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', document.getElementById('itemDesc').value.trim());
    formData.append('in_exchange_for', tradeVal);
    formData.append('category', cat);
    formData.append('price_from', String(fromVal));
    formData.append('price_to', String(toVal));
    formData.append('condition_score', String(condVal));

    uploadedImageFiles.forEach(file => {
      if (file) formData.append('images', file);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/posts/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || 'Failed to publish listing');
      }

      const created = data.post || data;
      const newProduct = buildLocalProductFromBackend(created, {
        title,
        cat,
        desc: document.getElementById('itemDesc').value.trim(),
        trade: tradeVal,
        cond: condVal,
        condLabel,
        valueFrom: fromVal,
        valueTo: toVal,
        date: today,
        sellerName: user.firstName ? `${user.firstName} ${user.lastName||''}`.trim() : (user.name || 'User'),
        sellerAvatar: user.avatar || user.picture || user.user_image || null,
        ownerEmail: user.email || ''
      });

      products.push(newProduct);
      localStorage.setItem('bartifyProducts', JSON.stringify(products));
      showToast('Listing published! 🎉', 'success');
      resetListingForm();
      setTimeout(() => navigate('activeListings'), 900);
    } catch (err) {
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
document.addEventListener('DOMContentLoaded', () => {
  const u = getOrInitUser();
  applyUserToUI(u);

  // Check if redirected with a specific section (from index.html "List Item", etc.)
  const urlParams = new URLSearchParams(window.location.search);
  const sectionParam = urlParams.get('section');
  const validSections = ['dashHome','addListing','editListing','deleteListing',
    'activeListings','pendingListings','requestsReceived','completedRequests',
    'cancelledRequests','viewProfile','editProfile','changePassword'];
  if (sectionParam && validSections.includes(sectionParam)) {
    navigate(sectionParam);
    return;
  }

  showSection('dashHome');
});